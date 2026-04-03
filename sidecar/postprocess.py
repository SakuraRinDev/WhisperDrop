"""LLM post-processing: filler removal, punctuation, formatting."""

import json
import urllib.request
import urllib.error
from typing import Literal

SYSTEM_PROMPTS = {
    "ja": """音声認識の出力テキストを修正するアシスタントです。
話者の意図を保ちつつ、以下のルールで修正してください。

ルール:
- フィラー（えー、あのー、えっと、まあ、うーん等）を除去
- 句読点（。、）を適切に追加
- 漢字の誤変換を文脈から修正
- 製品名・サービス名・技術用語はカタカナではなく正式な英語表記にする（例: アクアボイス→AquaVoice、ウィスパー→Whisper、リアクト→React、タウリ→Tauri）
- 文全体を英語に翻訳しない。日本語の文の中で固有名詞だけ英語にする
- 意味を変えない、情報を追加しない
- 修正後のテキストのみ返す（説明不要）""",

    "en": """You are a post-processor for speech-to-text output.
Clean up the transcribed text while preserving the speaker's intent.

Rules:
- Remove filler words (um, uh, like, you know, so, basically, etc.)
- Fix punctuation, capitalization, and sentence breaks
- Correct obvious mishearings based on context
- Fix proper nouns, product names, and technical terms to their official spelling (e.g., whisper drop→WhisperDrop, aqua voice→AquaVoice)
- Do NOT translate — keep English as English
- Do NOT change meaning or add information
- Return ONLY the cleaned text, no explanations""",

    "auto": """You are a post-processor for speech-to-text output.
Clean up the transcribed text while preserving the speaker's intent and language.

Rules:
- Remove filler words (um, uh, えー, あのー, えっと, like, you know, etc.)
- Fix punctuation and sentence breaks appropriate to the language
- For Japanese: fix kanji errors, add 。、 punctuation
- For English: fix capitalization, proper nouns
- Do NOT translate between languages — keep the original language
- Do NOT change meaning or add information
- Return ONLY the cleaned text, no explanations""",
}

USER_MSG_TEMPLATES = {
    "ja": "以下の音声認識テキストを修正してください:\n\n{text}",
    "en": "Clean up this transcribed text:\n\n{text}",
    "auto": "Clean up this transcribed text:\n\n{text}",
}


def get_prompts(language: str | None) -> tuple[str, str]:
    """Return (system_prompt, user_msg_template) for the given language."""
    key = language if language in SYSTEM_PROMPTS else "auto"
    return SYSTEM_PROMPTS[key], USER_MSG_TEMPLATES[key]


def postprocess_with_claude(
    text: str, api_key: str, instruction: str | None = None, language: str | None = None,
) -> str:
    """Post-process transcribed text using Claude API."""
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    sys_prompt, msg_tpl = get_prompts(language)

    user_msg = msg_tpl.format(text=text)
    if instruction:
        user_msg += f"\n\n{instruction}"

    message = client.messages.create(
        model="claude-sonnet-4-6-20250514",
        max_tokens=1024,
        system=sys_prompt,
        messages=[{"role": "user", "content": user_msg}],
    )
    return message.content[0].text.strip()


def postprocess_with_openai(
    text: str, api_key: str, instruction: str | None = None, language: str | None = None,
) -> str:
    """Post-process transcribed text using OpenAI GPT API."""
    import openai

    client = openai.OpenAI(api_key=api_key)
    sys_prompt, msg_tpl = get_prompts(language)

    user_msg = msg_tpl.format(text=text)
    if instruction:
        user_msg += f"\n\n{instruction}"

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_msg},
        ],
        max_tokens=1024,
    )
    return response.choices[0].message.content.strip()


def postprocess_with_ollama(
    text: str,
    model: str = "gemma4:e2b",
    base_url: str = "http://localhost:11434",
    instruction: str | None = None,
    language: str | None = None,
    on_token=None,
) -> str:
    """Post-process transcribed text using local Ollama with streaming."""
    sys_prompt, msg_tpl = get_prompts(language)

    user_msg = msg_tpl.format(text=text)
    if instruction:
        user_msg += f"\n\n{instruction}"

    payload = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_msg},
        ],
        "stream": True,
        "keep_alive": "30m",
        "options": {"temperature": 0.1, "num_predict": 256, "num_ctx": 512},
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{base_url}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
    )

    result_parts = []
    with urllib.request.urlopen(req, timeout=60) as resp:
        for raw_line in resp:
            line = raw_line.decode("utf-8").strip()
            if not line:
                continue
            try:
                chunk = json.loads(line)
            except json.JSONDecodeError:
                continue
            token = chunk.get("message", {}).get("content", "")
            if token:
                result_parts.append(token)
                if on_token:
                    on_token("".join(result_parts))
            if chunk.get("done"):
                break

    return "".join(result_parts).strip()


def warmup_ollama_model(model: str, base_url: str = "http://localhost:11434") -> bool:
    """Send a minimal request to load the model into VRAM."""
    try:
        payload = json.dumps({
            "model": model,
            "messages": [{"role": "user", "content": "hi"}],
            "stream": False,
            "keep_alive": "30m",
            "options": {"num_predict": 1, "num_ctx": 32},
        }).encode("utf-8")
        req = urllib.request.Request(
            f"{base_url}/api/chat",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            resp.read()
        return True
    except Exception:
        return False


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
    ollama_model: str = "gemma4:e2b",
    ollama_url: str = "http://localhost:11434",
    language: str | None = None,
    on_token=None,
) -> str:
    """Post-process text with the specified LLM provider."""
    if provider == "none":
        return text
    if provider == "claude":
        if not api_key:
            return text
        return postprocess_with_claude(text, api_key, instruction, language)
    if provider == "openai":
        if not api_key:
            return text
        return postprocess_with_openai(text, api_key, instruction, language)
    if provider == "ollama":
        return postprocess_with_ollama(
            text, ollama_model, ollama_url, instruction, language, on_token,
        )
    return text
