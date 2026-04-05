"""Whisper transcription: local (faster-whisper) and cloud (OpenAI API)."""

import io
import os
import tempfile
from pathlib import Path
from typing import Literal

import numpy as np

MODEL_SIZES = ["large-v3-turbo", "kotoba-v2.0"]
DEFAULT_MODEL = "large-v3-turbo"

MODEL_ID_MAP = {
    "kotoba-v2.0": "kotoba-tech/kotoba-whisper-v2.0-faster",
}

KOTOBA_MODELS = {"kotoba-v2.0"}


def get_models_dir() -> Path:
    """Get the directory for storing Whisper models."""
    home = Path.home()
    models_dir = home / ".whisperdrop" / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    return models_dir


def resolve_model_id(model_name: str) -> str:
    """Map UI model name to HuggingFace model ID for faster-whisper."""
    return MODEL_ID_MAP.get(model_name, model_name)


def is_model_cached(model_name: str) -> bool:
    """Check if a model is already downloaded."""
    model_id = resolve_model_id(model_name)
    models_dir = get_models_dir()
    candidate = models_dir / model_id.replace("/", "--")
    if candidate.is_dir() and any(candidate.iterdir()):
        return True
    candidate2 = models_dir / f"models--{model_id.replace('/', '--')}"
    if candidate2.is_dir() and any(candidate2.iterdir()):
        return True
    if not "/" in model_id:
        candidate3 = models_dir / f"faster-whisper-{model_id}"
        if candidate3.is_dir() and any(candidate3.iterdir()):
            return True
    return False


class LocalTranscriber:
    """Transcription using faster-whisper (local, CPU or CUDA)."""

    def __init__(
        self,
        model_size: str = DEFAULT_MODEL,
        language: str | None = None,
        device: str = "auto",
        initial_prompt: str | None = None,
    ):
        self.model_size = model_size
        self.language = language  # None = auto-detect
        self.device = device
        self.initial_prompt = initial_prompt
        self._model = None

    @property
    def _is_kotoba(self) -> bool:
        return self.model_size in KOTOBA_MODELS

    def preload(self):
        """Pre-load the model into memory."""
        if self._model is None:
            from faster_whisper import WhisperModel

            model_id = resolve_model_id(self.model_size)
            compute_type = "float16" if self.device == "cuda" else "int8"
            self._model = WhisperModel(
                model_id,
                device=self.device,
                compute_type=compute_type,
                download_root=str(get_models_dir()),
            )

    def transcribe(self, audio: np.ndarray, sample_rate: int = 16000) -> str:
        """Transcribe audio numpy array to text."""
        self.preload()

        kwargs = dict(
            language=self.language,
            beam_size=5,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
            initial_prompt=self.initial_prompt,
        )
        if self._is_kotoba:
            kwargs["condition_on_previous_text"] = False

        segments, info = self._model.transcribe(audio, **kwargs)

        text = "".join(segment.text for segment in segments).strip()
        return text

    def change_model(self, model_size: str):
        """Switch to a different model size."""
        if model_size != self.model_size:
            self.model_size = model_size
            self._model = None  # Force reload


class CloudTranscriber:
    """Transcription using OpenAI Whisper API."""

    def __init__(self, api_key: str, language: str | None = None):
        self.language = language
        import openai

        self.client = openai.OpenAI(api_key=api_key)

    def transcribe(self, audio: np.ndarray, sample_rate: int = 16000) -> str:
        """Transcribe audio via OpenAI Whisper API."""
        import wave

        # Convert numpy array to WAV bytes
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(sample_rate)
            audio_int16 = (audio * 32767).astype(np.int16)
            wf.writeframes(audio_int16.tobytes())
        buf.seek(0)
        buf.name = "audio.wav"

        kwargs = {"model": "whisper-1", "file": buf}
        if self.language:
            kwargs["language"] = self.language

        result = self.client.audio.transcriptions.create(**kwargs)
        return result.text.strip()


def create_transcriber(
    mode: Literal["local", "cloud"] = "local",
    model_size: str = DEFAULT_MODEL,
    language: str | None = None,
    openai_api_key: str | None = None,
    initial_prompt: str | None = None,
):
    """Factory function to create the appropriate transcriber."""
    if mode == "cloud":
        if not openai_api_key:
            raise ValueError("OpenAI API key required for cloud transcription")
        return CloudTranscriber(api_key=openai_api_key, language=language)
    return LocalTranscriber(
        model_size=model_size, language=language, initial_prompt=initial_prompt
    )
