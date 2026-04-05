export type Locale = "en" | "ja";

const dict = {
  // Tabs
  "tab.settings": { en: "Settings", ja: "設定" },
  "tab.models": { en: "Models", ja: "モデル" },
  "tab.dictionary": { en: "Dictionary", ja: "辞書" },

  "tab.usage": { en: "Usage", ja: "使い方" },

  // Usage tab
  "usage.hotkeys": { en: "Hotkeys", ja: "ホットキー" },
  "usage.hotkey.record": {
    en: "Start / Stop recording (push-to-talk)",
    ja: "録音の開始 / 停止（プッシュトゥトーク）",
  },
  "usage.hotkey.lock": {
    en: "Lock recording (double-tap) — stays on until next double-tap",
    ja: "ロック録音（ダブルタップ）— 再度ダブルタップまで継続",
  },
  "usage.hotkey.cancel": {
    en: "Cancel recording or transcription",
    ja: "録音・文字起こしをキャンセル",
  },
  "usage.flow": { en: "How it works", ja: "基本の流れ" },
  "usage.flow.1": {
    en: "Press Ctrl+Shift+Space to start recording",
    ja: "Ctrl+Shift+Space で録音開始",
  },
  "usage.flow.2": {
    en: "Speak into your microphone",
    ja: "マイクに向かって話す",
  },
  "usage.flow.3": {
    en: "Press again to stop, or wait for auto-stop on silence",
    ja: "もう一度押して停止、または無音で自動停止",
  },
  "usage.flow.4": {
    en: "Transcribed text is automatically pasted at your cursor",
    ja: "文字起こし結果がカーソル位置に自動ペースト",
  },
  "usage.tips": { en: "Tips", ja: "ヒント" },
  "usage.tip.escape": {
    en: "If transcription gets stuck, press Escape to cancel and return to normal.",
    ja: "文字起こしが止まった場合は Escape でキャンセルして通常状態に戻れます。",
  },
  "usage.tip.focus": {
    en: "Make sure your text cursor is in the target app before pressing the hotkey.",
    ja: "ホットキーを押す前に、入力先アプリにカーソルを置いてください。",
  },

  // Transcription
  "section.transcription": { en: "Transcription", ja: "文字起こし" },
  "label.mode": { en: "Mode", ja: "モード" },
  "label.model": { en: "Model", ja: "モデル" },
  "label.language": { en: "Language", ja: "言語" },
  "opt.local": { en: "Local (faster-whisper)", ja: "ローカル (faster-whisper)" },
  "opt.cloud": { en: "Cloud (OpenAI Whisper API)", ja: "クラウド (OpenAI Whisper API)" },

  // LLM
  "section.llm": { en: "LLM Post-processing (Beta)", ja: "LLM後処理 (Beta)" },
  "label.enable": { en: "Enable", ja: "有効化" },
  "llm.desc": {
    en: "Use LLM for filler removal, punctuation, and kanji correction",
    ja: "LLMでフィラー除去・句読点修正・漢字補正を追加で行う",
  },
  "llm.limit": {
    en: "Supports up to ~1000 chars (JA) / ~3000 chars (EN) per input.",
    ja: "1回の入力は日本語 約1000文字 / 英語 約3000文字まで対応。",
  },
  "llm.model": { en: "Model", ja: "モデル" },
  "llm.noOllama": { en: "Ollama not detected", ja: "Ollamaが検出されませんでした" },
  "llm.installOllama": {
    en: "Install Ollama to use local LLMs.",
    ja: "ローカルLLMを利用するには Ollama のインストールが必要です。",
  },
  "llm.noModel": { en: "No models installed", ja: "モデルが未インストールです" },
  "llm.dlModel": {
    en: "Download a model from the Models tab.",
    ja: "「モデル」タブからモデルをDLしてください。",
  },

  // Ollama Models
  "section.ollamaModels": { en: "Ollama Models", ja: "Ollamaモデル" },
  "ollama.desc": {
    en: "Manage & download models. Edit sidecar/ollama_models.json to add recommended models.",
    ja: "モデルの管理・ダウンロード。sidecar/ollama_models.json を編集して推奨モデルを追加できます。",
  },
  "ollama.notConnected": {
    en: "Ollama not connected, or loading…",
    ja: "Ollama未接続、または読み込み中…",
  },
  "ollama.retry": { en: "Retry", ja: "再取得" },
  "ollama.downloading": { en: "Downloading…", ja: "DL中…" },

  // Vocabulary
  "section.vocabulary": { en: "Custom Vocabulary", ja: "カスタム辞書" },
  "vocab.desc": {
    en: "Register words/names to improve Whisper accuracy.",
    ja: "単語/名前と読みを登録すると、Whisperの認識精度が向上します。",
  },
  "vocab.registered": { en: "{n} entries registered", ja: "{n} 件登録済み" },
  "vocab.none": { en: "No entries", ja: "未登録" },
  "vocab.edit": { en: "Edit dictionary", ja: "辞書を編集" },
  "vocab.word": { en: "Word / Name", ja: "単語・名前" },
  "vocab.reading": { en: "Reading (optional)", ja: "読み（任意）" },
  "vocab.addRow": { en: "+ Add row", ja: "+ 行を追加" },
  "vocab.save": { en: "Save", ja: "保存" },
  "vocab.cancel": { en: "Cancel", ja: "キャンセル" },

  // API Keys
  "section.apiKeys": { en: "API Keys", ja: "APIキー" },

  // Microphone
  "section.mic": { en: "Microphone", ja: "マイク" },
  "label.inputDevice": { en: "Input Device", ja: "入力デバイス" },

  // Advanced
  "section.advanced": { en: "Advanced", ja: "詳細設定" },

  // History
  "tab.history": { en: "History", ja: "履歴" },
  "history.empty": { en: "No history yet", ja: "履歴がありません" },
  "history.emptyDesc": {
    en: "Transcriptions will appear here.",
    ja: "音声入力した内容がここに表示されます。",
  },
  "history.count": { en: "{n} entries", ja: "{n} 件" },
  "history.clearAll": { en: "Clear all", ja: "全削除" },
  "history.copy": { en: "Copy", ja: "コピー" },
  "history.delete": { en: "Delete", ja: "削除" },
  "history.copied": { en: "Copied!", ja: "コピーしました" },

  // LLM help
  "llm.helpLink": {
    en: "How to enable",
    ja: "機能の有効化について",
  },

  // Model download
  "model.downloadTitle": { en: "Download Model", ja: "モデルのダウンロード" },
  "model.downloadConfirm": {
    en: "Download \"{name}\" (~{size}MB)? This may take a few minutes.",
    ja: "「{name}」（約{size}MB）をダウンロードしますか？数分かかる場合があります。",
  },
  "model.download": { en: "Download", ja: "ダウンロード" },
  "model.cancel": { en: "Cancel", ja: "キャンセル" },
  "model.downloading": { en: "Downloading model…", ja: "モデルをダウンロード中…" },

  // LLM Tone
  "label.llmTone": { en: "Tone", ja: "文体" },
  "tone.normal": { en: "Normal", ja: "通常" },
  "tone.casual": { en: "Casual", ja: "カジュアル" },
  "tone.official": { en: "Official", ja: "オフィシャル" },
  "tone.normal.desc": { en: "Clean, natural text", ja: "綺麗な文章に" },
  "tone.casual.desc": { en: "Conversational style", ja: "口語っぽいカジュアルさ" },
  "tone.official.desc": { en: "Formal, polite text", ja: "綺麗かつ丁寧な文章へ" },

  // Overlay
  "label.overlayPosition": { en: "Overlay Position", ja: "オーバーレイ位置" },
  "overlay.top": { en: "Top", ja: "上" },
  "overlay.bottom": { en: "Bottom", ja: "下" },

  // VAD / Silence
  "vad.desc": {
    en: "Voice detection sensitivity. Lower = picks up quieter voices. Higher = ignores noise.",
    ja: "音声検出の感度。低いほど小さい声も拾う。高いほどノイズを無視。",
  },
  "silence.desc": {
    en: "Auto-stop after this duration of silence. Shorter = may cut off. Longer = more waiting.",
    ja: "この秒数の無音で自動停止。短いと途切れやすく、長いと待ちが長い。",
  },

  // General
  "saved": { en: "Settings saved", ja: "設定を保存しました" },
  "afterInstall": { en: "After install, click ↻ to refresh", ja: "インストール後「↻」で再取得" },
} as const;

export type I18nKey = keyof typeof dict;

export function t(key: I18nKey, locale: Locale, params?: Record<string, string | number>): string {
  const entry = dict[key];
  let text: string = entry?.[locale] ?? entry?.["en"] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}
