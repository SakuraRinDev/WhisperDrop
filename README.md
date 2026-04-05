<p align="center">
  <img src="public/header-banner.png" alt="WhisperDrop" width="100%" />
</p>

<h1 align="center">WhisperDrop</h1>

<p align="center">
  ローカル完結の音声入力アプリ。<br/>
  ショートカット一発で音声をテキスト化し、アクティブなウィンドウにペーストします。
</p>

<p align="center">
  <a href="https://github.com/SakuraRinDev/WhisperDrop/releases/latest">
    <strong>ダウンロード (Windows / macOS)</strong>
  </a>
</p>

---

## 特徴

- **完全ローカル** — インターネット接続不要、音声データは端末内で処理
- **日本語特化モデル対応** — kotoba-whisper で高精度な日本語認識
- **LLM 後処理** — Claude / OpenAI / Ollama でフィラー除去・句読点修正
- **カスタム辞書** — 固有名詞・専門用語の認識精度を向上
- **グローバルショートカット** — `Ctrl+Shift+Space` でどこからでも起動
- **オーバーレイ UI** — 録音中は画面下部に波形アニメーション表示
- **履歴機能** — 過去の文字起こし結果を検索・コピー

## インストール

[Releases ページ](https://github.com/SakuraRinDev/WhisperDrop/releases/latest) から OS に合ったインストーラーをダウンロード:

| OS | ファイル | 説明 |
|---|---|---|
| Windows | `.exe` | 推奨。ダウンロードして実行 |
| Windows | `.msi` | 企業向けサイレントインストール対応 |
| macOS | `.dmg` | 開いてアプリケーションフォルダにドラッグ |

## 使い方

1. インストール後、初回起動で Whisper モデルが自動ダウンロードされます（約 1.5GB）
2. `Ctrl+Shift+Space` で録音開始
3. 話し終わると自動停止 → テキストがアクティブウィンドウにペースト

### ショートカット

| キー | 動作 |
|---|---|
| `Ctrl+Shift+Space` | 録音開始 / 停止 |
| `Ctrl+Shift+Space` x2 (素早く) | ロックモード（長時間録音） |
| `Escape` | 録音・文字起こしをキャンセル |

## 設定

トレイアイコンを左クリックで設定画面を開きます。

| 設定 | 説明 |
|---|---|
| Model | `large-v3-turbo`（多言語） / `kotoba-v2.0`（日本語特化） |
| Language | 言語指定 (auto / ja / en など) |
| Custom Vocabulary | 固有名詞を登録 → 認識精度向上 |
| LLM Post-processing | LLM による自動修正 ON/OFF |
| Microphone | 入力デバイス選択 |

## LLM 後処理の有効化について

LLM 後処理を有効にすると、音声認識結果をさらに LLM で自動修正できます（フィラー除去、句読点補正、漢字修正など）。

### Ollama（ローカル LLM）を使う場合

1. [Ollama をインストール](https://ollama.com/download)（Windows / macOS 対応）
2. インストール後、Ollama は自動でバックグラウンド起動します（トレイ常駐）
3. WhisperDrop の「詳細設定」タブで LLM 後処理を ON にする
4. 「モデル」タブから使いたいモデルをダウンロード（推奨: `qwen2.5:1.5b`）

> Ollama はバックグラウンドで動作するため、特別なポップアップや操作は不要です。

### Cloud API を使う場合

Claude または OpenAI の API キーを「詳細設定」→「API Keys」に入力するだけです。Ollama のインストールは不要です。

## アーキテクチャ

```
音声 → Whisper (faster-whisper) → LLM 後処理 (optional) → テキストペースト
```

| レイヤー | 技術 |
|---|---|
| フロントエンド | React + TypeScript + Tailwind CSS |
| デスクトップ | Tauri v2 (Rust) |
| 音声認識 | Python sidecar (faster-whisper + Silero VAD) |
| LLM 後処理 | Claude / OpenAI API / Ollama |

## 開発に参加する

開発環境の構築・ビルド手順は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## License

MIT
