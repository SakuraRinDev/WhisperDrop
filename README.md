# WhisperDrop

ローカル完結の音声入力アプリ。Alt キー一発で音声をテキスト化し、アクティブなウィンドウにペーストします。

## 特徴

- **完全ローカル** — インターネット接続不要、プライバシー保護
- **faster-whisper** — CTranslate2 ベースの高速音声認識
- **LLM 後処理** — Claude / OpenAI / ローカル LLM で認識結果を自動修正
- **カスタム辞書** — `initial_prompt` による固有名詞・専門用語の認識精度向上
- **グローバルショートカット** — `Ctrl+Shift+Space` でどこからでも起動
- **オーバーレイ UI** — 録音中は画面下部に波形アニメーション表示

## アーキテクチャ

```
音声 → Whisper (faster-whisper) → LLM 後処理 (optional) → テキストペースト
```

| レイヤー | 技術 |
|---|---|
| フロントエンド | React + TypeScript + Tailwind CSS |
| デスクトップ | Tauri v2 (Rust) |
| 音声認識 | Python sidecar (faster-whisper + Silero VAD) |
| LLM 後処理 | Claude / OpenAI API / Ollama (予定) |

## セットアップ

### 前提条件

- Node.js 18+
- Rust toolchain
- Python 3.10+

### インストール

```bash
# フロントエンド依存
npm install

# Python sidecar 依存
cd sidecar
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
cd ..
```

### 開発

```bash
npm run tauri dev
```

### ビルド

```bash
npm run tauri build
```

## 設定

トレイアイコンを左クリックで設定画面を開きます。

| 設定 | 説明 |
|---|---|
| Model | Whisper モデルサイズ (tiny〜large-v3) |
| Language | 言語指定 (auto / ja / en など) |
| Custom Vocabulary | 固有名詞を文章で記述 → 認識精度向上 |
| LLM Post-processing | LLM による自動修正 ON/OFF |
| Microphone | 入力デバイス選択 |
| VAD Threshold | 音声検出感度 (0.1〜0.9) |
| Silence Duration | 無音自動停止までの秒数 |

## ショートカット

| キー | 動作 |
|---|---|
| `Ctrl+Shift+Space` | 録音開始 / 停止 |
| `Ctrl+Shift+Space` x2 (素早く) | ロックモード (長時間録音) |

## ロードマップ

- [ ] Ollama 連携 (ローカル LLM 後処理)
- [ ] PyInstaller によるsidecar exe 化
- [ ] ストリーミング文字起こし
- [ ] 画面コンテキスト取得

## License

MIT
