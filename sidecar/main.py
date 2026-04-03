"""WhisperDrop Python sidecar — entry point.

Operates in two modes:
1. Sidecar mode (default): reads JSON from stdin, writes JSON to stdout
2. CLI mode (--cli): interactive testing with Enter to toggle recording
"""

import argparse
import io
import json
import sys
import threading
import time

# Force UTF-8 for stdin/stdout on Windows
if sys.platform == "win32":
    sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8")
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)

from audio import AudioRecorder, list_input_devices
from transcribe import LocalTranscriber, CloudTranscriber, create_transcriber
from postprocess import postprocess, list_ollama_models


def send(msg: dict):
    """Write a JSON message to stdout (for Tauri)."""
    sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
    sys.stdout.flush()


class WhisperDropSidecar:
    def __init__(self):
        self.config = {
            "mode": "local",
            "model": "large-v3-turbo",
            "language": None,
            "llm_postprocess": False,
            "llm_provider": "none",
            "claude_api_key": None,
            "openai_api_key": None,
            "vad_threshold": 0.5,
            "silence_duration": 1.5,
            "input_device": None,
            "custom_vocabulary": "",
            "ollama_model": "qwen2.5:1.5b",
            "ollama_url": "http://localhost:11434",
        }
        self.transcriber = None
        self.recorder = None
        self._recording_thread = None

    def _on_audio_level(self, level: float):
        send({"status": "audio_level", "level": round(level, 3)})

    def _build_initial_prompt(self) -> str | None:
        vocab = self.config.get("custom_vocabulary", "").strip()
        if not vocab:
            return None
        return vocab

    def _init_transcriber(self):
        api_key = self.config.get("openai_api_key")
        self.transcriber = create_transcriber(
            mode=self.config["mode"],
            model_size=self.config["model"],
            language=self.config["language"],
            openai_api_key=api_key,
            initial_prompt=self._build_initial_prompt(),
        )
        if isinstance(self.transcriber, LocalTranscriber):
            self.transcriber.preload()

    def _init_recorder(self):
        self.recorder = AudioRecorder(
            vad_threshold=self.config["vad_threshold"],
            silence_duration=self.config["silence_duration"],
            on_audio_level=self._on_audio_level,
            device=self.config["input_device"],
        )

    def handle_start_recording(self):
        if self.transcriber is None:
            self._init_transcriber()
        if self.recorder is None:
            self._init_recorder()

        def record_and_transcribe():
            try:
                send({"status": "recording_started"})
                audio = self.recorder.record_until_silence()

                if len(audio) == 0:
                    send({"status": "done", "text": ""})
                    return

                send({"status": "transcribing"})
                text = self.transcriber.transcribe(audio)

                if self.config["llm_postprocess"] and text:
                    text = self._run_postprocess(text)

                send({"status": "done", "text": text})
            except Exception as e:
                send({"status": "error", "message": str(e)})

        self._recording_thread = threading.Thread(
            target=record_and_transcribe, daemon=True
        )
        self._recording_thread.start()

    def handle_stop_recording(self):
        if not self.recorder or not self.recorder._recording:
            return

        audio = self.recorder.stop()

        if len(audio) == 0:
            send({"status": "done", "text": ""})
            return

        try:
            if self.transcriber is None:
                self._init_transcriber()

            send({"status": "transcribing"})
            text = self.transcriber.transcribe(audio)

                if self.config["llm_postprocess"] and text:
                    text = self._run_postprocess(text)

                send({"status": "done", "text": text})
            except Exception as e:
                send({"status": "error", "message": str(e)})

    def handle_set_config(self, config: dict):
        old_mode = self.config.get("mode")
        old_model = self.config.get("model")
        old_device = self.config.get("input_device")
        old_vocab = self.config.get("custom_vocabulary")

        self.config.update(config)

        new_mode = self.config.get("mode")
        new_model = self.config.get("model")
        new_vocab = self.config.get("custom_vocabulary")
        new_device = self.config.get("input_device")

        if new_mode != old_mode or new_model != old_model or new_vocab != old_vocab:
            self.transcriber = None

        if new_device != old_device:
            self.recorder = None

        send({"status": "config_updated", "model": new_model})

    def _run_postprocess(self, text: str) -> str:
        send({"status": "postprocessing"})
        api_key = (
            self.config["claude_api_key"]
            if self.config["llm_provider"] == "claude"
            else self.config["openai_api_key"]
        )
        return postprocess(
            text,
            provider=self.config["llm_provider"],
            api_key=api_key,
            ollama_model=self.config.get("ollama_model", "qwen2.5:1.5b"),
            ollama_url=self.config.get("ollama_url", "http://localhost:11434"),
        )

    def handle_list_ollama_models(self):
        url = self.config.get("ollama_url", "http://localhost:11434")
        models = list_ollama_models(url)
        send({"status": "ollama_models", "models": models})

    def handle_list_devices(self):
        try:
            devices = list_input_devices()
            send({"status": "devices", "devices": devices})
        except Exception as e:
            send({"status": "error", "message": f"Failed to list devices: {e}"})

    def handle_cancel(self):
        if self.recorder:
            self.recorder.cancel()
        send({"status": "cancelled"})

    def run_sidecar(self):
        """Main loop: read JSON commands from stdin."""
        send({"status": "ready"})

        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                cmd = json.loads(line)
            except json.JSONDecodeError:
                send({"status": "error", "message": f"Invalid JSON: {line}"})
                continue

            action = cmd.get("action")
            if action == "start_recording":
                self.handle_start_recording()
            elif action == "stop_recording":
                self.handle_stop_recording()
            elif action == "set_config":
                self.handle_set_config(cmd.get("config", {}))
            elif action == "cancel":
                self.handle_cancel()
            elif action == "list_devices":
                self.handle_list_devices()
            elif action == "list_ollama_models":
                self.handle_list_ollama_models()
            elif action == "ping":
                send({"status": "pong"})
            elif action == "preload":
                try:
                    self._init_transcriber()
                    send({"status": "model_loaded"})
                except Exception as e:
                    send({"status": "error", "message": str(e)})
            else:
                send({"status": "error", "message": f"Unknown action: {action}"})

    def run_cli(self, model: str = "base", language: str | None = None):
        """Interactive CLI mode for testing."""
        self.config["model"] = model
        self.config["language"] = language
        self._init_transcriber()
        self._init_recorder()

        print(f"WhisperDrop CLI (model={model}, language={language or 'auto'})")
        print("Press Enter to start recording, Enter again to stop.")
        print("Type 'q' to quit.\n")

        while True:
            cmd = input("> ").strip()
            if cmd.lower() == "q":
                break

            print("Recording... (press Enter to stop)")
            self.recorder.start()
            input()
            audio = self.recorder.stop()

            if len(audio) == 0:
                print("(no audio captured)")
                continue

            print("Transcribing...")
            start = time.time()
            text = self.transcriber.transcribe(audio)
            elapsed = time.time() - start

            print(f"[{elapsed:.2f}s] {text}\n")


def main():
    parser = argparse.ArgumentParser(description="WhisperDrop sidecar")
    parser.add_argument(
        "--cli", action="store_true", help="Run in interactive CLI mode"
    )
    parser.add_argument(
        "--model", default="base", help="Whisper model size (default: base)"
    )
    parser.add_argument(
        "--language", default=None, help="Language code (default: auto-detect)"
    )
    args = parser.parse_args()

    sidecar = WhisperDropSidecar()

    if args.cli:
        sidecar.run_cli(model=args.model, language=args.language)
    else:
        sidecar.run_sidecar()


if __name__ == "__main__":
    main()
