"""LLM post-processing: filler removal, punctuation, formatting."""

import json
import urllib.request
import urllib.error
from typing import Literal

SYSTEM_PROMPT = """You are a text post-processor for speech-to-text output.
Your job is to clean up transcribed text while preserving the speaker's intent.

Rules:
- Remove filler words (um, uh, えー, あのー, えっと, まあ, etc.)
- Fix punctuation and add appropriate sentence breaks
- Do NOT change the meaning or add new information
- Do NOT translate between languages
- Keep the same language as the input
- Return ONLY the cleaned text, no explanations"""


def postprocess_with_claude(text: str, api_key: str, instruction: str | None = None) -> str:
    """Post-process transcribed text using Claude API."""
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)

    user_msg = f"Clean up this transcribed text:\n\n{text}"
    if instruction:
        user_msg += f"\n\nAdditional instruction: {instruction}"

    message = client.messages.create(
        model="claude-sonnet-4-6-20250514",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_msg}],
    )
    return message.content[0].text.strip()


def postprocess_with_openai(text: str, api_key: str, instruction: str | None = None) -> str:
    """Post-process transcribed text using OpenAI GPT API."""
    import openai

    client = openai.OpenAI(api_key=api_key)

    user_msg = f"Clean up this transcribed text:\n\n{text}"
    if instruction:
        user_msg += f"\n\nAdditional instruction: {instruction}"

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        max_tokens=1024,
    )
    return response.choices[0].message.content.strip()


def postprocess_with_ollama(
    text: str,
    model: str = "qwen2.5:1.5b",
    base_url: str = "http://localhost:11434",
    instruction: str | None = None,
) -> str:
    """Post-process transcribed text using local Ollama."""
    user_msg = f"Clean up this transcribed text:\n\n{text}"
    if instruction:
        user_msg += f"\n\nAdditional instruction: {instruction}"

    payload = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        "stream": False,
        "options": {"temperature": 0.1, "num_predict": 256},
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{base_url}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["message"]["content"].strip()


def list_ollama_models(base_url: str = "http://localhost:11434") -> list[dict]:
    """Fetch available models from Ollama."""
    try:
        req = urllib.request.Request(f"{base_url}/api/tags")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return [
            {"name": m["name"], "size": m.get("size", 0)}
            for m in data.get("models", [])
        ]
    except (urllib.error.URLError, OSError):
        return []


def load_recommended_models(config_path: str | None = None) -> list[dict]:
    """Load recommended models from ollama_models.json."""
    import os
    if config_path is None:
        config_path = os.path.join(os.path.dirname(__file__), "ollama_models.json")
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("recommended", [])
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def pull_ollama_model(
    model_name: str,
    base_url: str = "http://localhost:11434",
    on_progress=None,
):
    """Pull (download) an Ollama model with progress callback.

    on_progress(status, completed, total) is called during download.
    Returns True on success, raises on error.
    """
    payload = json.dumps({"name": model_name, "stream": True}).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url}/api/pull",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=600) as resp:
        for raw_line in resp:
            line = raw_line.decode("utf-8").strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            status = msg.get("status", "")
            completed = msg.get("completed", 0)
            total = msg.get("total", 0)
            if on_progress:
                on_progress(status, completed, total)
            if msg.get("error"):
                raise RuntimeError(msg["error"])
    return True


def postprocess(
    text: str,
    provider: Literal["claude", "openai", "ollama", "none"] = "none",
    api_key: str | None = None,
    instruction: str | None = None,
    ollama_model: str = "qwen2.5:1.5b",
    ollama_url: str = "http://localhost:11434",
) -> str:
    """Post-process text with the specified LLM provider."""
    if provider == "none":
        return text
    if provider == "claude":
        if not api_key:
            return text
        return postprocess_with_claude(text, api_key, instruction)
    if provider == "openai":
        if not api_key:
            return text
        return postprocess_with_openai(text, api_key, instruction)
    if provider == "ollama":
        return postprocess_with_ollama(text, ollama_model, ollama_url, instruction)
    return text
