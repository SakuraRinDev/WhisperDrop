"""Audio capture with sounddevice + Silero VAD for silence detection."""

import io
import queue
import threading
from typing import Callable

import numpy as np
import sounddevice as sd

SAMPLE_RATE = 16000
CHANNELS = 1
BLOCK_SIZE = 512  # ~32ms per block at 16kHz


def list_input_devices() -> list[dict]:
    """Return a list of available audio input devices."""
    devices = sd.query_devices()
    result = []
    for i, d in enumerate(devices):
        if d["max_input_channels"] > 0:
            is_default = i == sd.default.device[0]
            result.append({
                "id": i,
                "name": d["name"],
                "channels": d["max_input_channels"],
                "sample_rate": d["default_samplerate"],
                "default": is_default,
            })
    return result


_VAD_MODEL = None
_VAD_LOAD_LOCK = threading.Lock()


def load_vad_model():
    """Load Silero VAD model. Cached at module level so the startup preload
    thread and the AudioRecorder share the same instance — this avoids racing
    a torch.hub download/JIT-compile against the sounddevice native callback,
    which has crashed the sidecar in the past."""
    global _VAD_MODEL
    if _VAD_MODEL is not None:
        return _VAD_MODEL
    with _VAD_LOAD_LOCK:
        if _VAD_MODEL is not None:
            return _VAD_MODEL
        import torch

        model, _utils = torch.hub.load(
            "snakers4/silero-vad", "silero_vad", trust_repo=True
        )
        _VAD_MODEL = model
        return _VAD_MODEL


class AudioRecorder:
    def __init__(
        self,
        vad_threshold: float = 0.5,
        silence_duration: float = 1.5,
        on_audio_level: Callable[[float], None] | None = None,
        device: int | None = None,
    ):
        self.vad_threshold = vad_threshold
        self.silence_duration = silence_duration
        self.on_audio_level = on_audio_level
        self.device = device

        self._audio_buffer: list[np.ndarray] = []
        self._queue: queue.Queue[np.ndarray] = queue.Queue()
        self._recording = False
        self._stream: sd.InputStream | None = None
        self._vad_model = None
        self._stop_event = threading.Event()

    def _ensure_vad(self):
        # load_vad_model() returns a module-level cached instance, so this is
        # cheap (and safe to call from any thread) once the startup preload
        # thread has completed.
        if self._vad_model is None:
            self._vad_model = load_vad_model()

    def _audio_callback(self, indata: np.ndarray, frames, time_info, status):
        if self._recording:
            self._queue.put(indata.copy())

    def _open_stream(self):
        """Create and start a new audio input stream."""
        self._audio_buffer = []
        self._recording = True
        self._stop_event.clear()
        self._stream = sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            dtype="float32",
            blocksize=BLOCK_SIZE,
            device=self.device,
            callback=self._audio_callback,
        )
        self._stream.start()

    def start(self):
        """Start recording from microphone."""
        self._ensure_vad()
        self._open_stream()

    def stop(self) -> np.ndarray:
        """Stop recording and return the audio buffer as a numpy array."""
        self._recording = False
        self._stop_event.set()
        # Atomically claim ownership of the stream so concurrent stop()/cancel()
        # calls (e.g. VAD-triggered auto-stop racing with a user hotkey stop)
        # cannot double-close it.
        stream = self._stream
        self._stream = None
        if stream is not None:
            stream.stop()
            stream.close()

        # Drain remaining items from queue
        while not self._queue.empty():
            try:
                chunk = self._queue.get_nowait()
                self._audio_buffer.append(chunk)
            except queue.Empty:
                break

        if not self._audio_buffer:
            return np.array([], dtype=np.float32)
        return np.concatenate(self._audio_buffer, axis=0).flatten()

    def record_until_silence(self) -> np.ndarray:
        """Record until VAD detects prolonged silence. Returns audio array."""
        import torch

        self._ensure_vad()
        self._open_stream()

        silent_chunks = 0
        chunks_for_silence = int(
            self.silence_duration * SAMPLE_RATE / BLOCK_SIZE
        )
        has_speech = False

        while not self._stop_event.is_set():
            try:
                chunk = self._queue.get(timeout=0.1)
            except queue.Empty:
                continue

            self._audio_buffer.append(chunk)

            # Calculate RMS for UI
            rms = float(np.sqrt(np.mean(chunk**2)))
            level = min(rms * 10, 1.0)
            if self.on_audio_level:
                self.on_audio_level(level)

            # Run VAD on chunk (needs 512 samples at 16kHz)
            audio_tensor = torch.from_numpy(chunk.flatten())
            if len(audio_tensor) >= BLOCK_SIZE:
                speech_prob = self._vad_model(
                    audio_tensor[:BLOCK_SIZE], SAMPLE_RATE
                ).item()

                if speech_prob >= self.vad_threshold:
                    has_speech = True
                    silent_chunks = 0
                else:
                    if has_speech:
                        silent_chunks += 1

                if has_speech and silent_chunks >= chunks_for_silence:
                    break

        return self.stop()

    def cancel(self):
        """Cancel recording without returning audio."""
        self._stop_event.set()
        self._recording = False
        stream = self._stream
        self._stream = None
        if stream is not None:
            stream.stop()
            stream.close()
        self._audio_buffer = []

    @staticmethod
    def calculate_rms(audio_chunk: np.ndarray) -> float:
        """Calculate RMS level normalized to 0-1 range."""
        rms = np.sqrt(np.mean(audio_chunk**2))
        return min(float(rms) * 10, 1.0)
