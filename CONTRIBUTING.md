# WhisperDrop 開発ガイド

## 前提条件

| ツール | バージョン | 用途 |
|--------|-----------|------|
| **Node.js** | 18+ | フロントエンドビルド |
| **Rust** | **1.85+** (stable, rustup 推奨) | Tauri バックエンド |
| **Python** | 3.10 - 3.12 (3.13 不可) | 音声処理サイドカー |
| **Ollama** (任意) | latest | ローカル LLM 後処理（[インストール](https://ollama.com/download)） |

> **Rust について**: 依存クレート (`time` など) が `edition2024` を要求するため Rust 1.85 以上が必要です。Mac で `brew install rust` を使うと Homebrew formula のスナップショット版が入り自動更新されないため、`rustup` の使用を強く推奨します。
> ```bash
> # rustup インストール (Mac/Linux)
> curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
> ```
> すでに `brew install rust` してしまっている場合は `brew upgrade rust` で最新化してください。

> **Python について**: Python 3.13 では一部依存 (`ctranslate2` など) のホイールが揃わないことがあります。Mac は `brew install python@3.12` で 3.12 を入れて venv を作るのが安全です。

Ollama を使う場合は、インストール後にターミナルで `ollama pull qwen2.5:1.5b` を実行してモデルを取得してください。Ollama はインストール後にバックグラウンドで自動起動します。

---

## 1. 開発環境セットアップ

### 1.1 リポジトリクローン

```bash
git clone <repo-url>
cd WhisperDrop
```

### 1.2 フロントエンド依存

```bash
npm install
```

### 1.3 Python 仮想環境 (sidecar)

#### Windows

```powershell
cd sidecar
python -m venv .venv
.\.venv\Scripts\activate

# GPU (CUDA 12.8) — 開発時はこちらを推奨
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128

# または CPU のみ（軽量だが推論が遅い）
# pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu

pip install -r requirements.txt
cd ..
```

#### macOS

Apple Silicon の Mac には CUDA 版 PyTorch は存在しないので CPU/MPS 版を使用します。

```bash
cd sidecar
/opt/homebrew/bin/python3.12 -m venv .venv
source .venv/bin/activate

pip install --upgrade pip
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
pip install pyinstaller   # サイドカーをビルドする場合
cd ..
```

### 1.4 Tauri CLI

```bash
npm install -g @tauri-apps/cli
```

---

## 2. Whisper モデルの準備

初回起動時にモデルのダウンロードが必要です。UI の設定画面からモデルを選択するとダウンロードが始まりますが、事前に CLI で取得しておくこともできます。

| モデル | HuggingFace ID | サイズ | 用途 |
|--------|----------------|--------|------|
| `large-v3-turbo` | (faster-whisper 組込) | ~1.5GB | 多言語対応（デフォルト） |
| `kotoba-v2.0` | `kotoba-tech/kotoba-whisper-v2.0-faster` | ~1.5GB | 日本語特化（高精度・高速） |

```powershell
cd sidecar
.\.venv\Scripts\activate

# large-v3-turbo を事前ダウンロード
python -c "from faster_whisper import WhisperModel; WhisperModel('large-v3-turbo', download_root='../.whisperdrop_models_test')"

# kotoba-v2.0 (日本語特化) を事前ダウンロード
python -c "from faster_whisper import WhisperModel; WhisperModel('kotoba-tech/kotoba-whisper-v2.0-faster', download_root='../.whisperdrop_models_test')"

cd ..
```

> モデルは `~/.whisperdrop/models/` にキャッシュされます。上のコマンドはテスト用パスです。アプリ起動時に自動で正しいパスにダウンロードされます。

---

## 3. 開発モードで起動

```bash
npm run tauri dev
```

- Vite dev server + Rust ビルド + Python sidecar が自動起動
- ファイル変更で自動リビルド（HMR）
- グローバルショートカット: **Ctrl+Shift+Space** で音声入力

---

## 4. インストーラー生成（配布用）

### 4.1 サイドカー exe ビルド

サイドカー（Python 音声処理部分）を PyInstaller で単一 exe に変換する。

```powershell
# CPU 版 torch でビルド（サイズ削減: ~215MB）
cd sidecar
.\.venv\Scripts\activate
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu --force-reinstall --no-deps
pip install pyinstaller
cd ..

# ビルド実行
npm run build:sidecar
```

出力: `src-tauri/binaries/whisper-sidecar-x86_64-pc-windows-msvc.exe` (~215MB)

> **注意**: ビルド後に開発を続ける場合は GPU 版 torch に戻す。
> ```powershell
> cd sidecar && .\.venv\Scripts\activate
> pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128 --force-reinstall --no-deps
> cd ..
> ```

### 4.2 フルビルド（インストーラー生成）

```bash
npm run tauri build
```

出力:
```
src-tauri/target/release/bundle/nsis/WhisperDrop_0.1.0_x64-setup.exe  (~242MB)
```

### 4.3 ワンコマンドビルド

サイドカー + Tauri を一括実行:

```bash
npm run build:all
```

> 事前に CPU 版 torch をインストールしておくこと（4.1 参照）。

---

## 5. npm スクリプト一覧

| コマンド | 説明 |
|----------|------|
| `npm run dev` | Vite dev server のみ起動 |
| `npm run tauri dev` | 開発モード（Vite + Rust + Python） |
| `npm run build:sidecar` | PyInstaller でサイドカー exe 生成 |
| `npm run tauri build` | NSIS インストーラー生成 |
| `npm run build:all` | サイドカー + インストーラー一括生成 |

---

## 6. プロジェクト構成

```
WhisperDrop/
├── src/                    # React フロントエンド
│   ├── components/         # UI コンポーネント
│   ├── hooks/              # カスタムフック
│   ├── i18n.ts             # EN/JP 国際化
│   └── types.ts            # 型定義
├── src-tauri/              # Rust バックエンド (Tauri)
│   ├── src/
│   │   ├── lib.rs          # メインエントリ
│   │   ├── hotkey.rs       # グローバルショートカット
│   │   ├── paste.rs        # クリップボード & ペースト
│   │   ├── focus.rs        # ウィンドウフォーカス管理
│   │   ├── sidecar.rs      # Python サイドカー通信
│   │   └── db.rs           # SQLite スキーマ
│   ├── binaries/           # サイドカー exe (ビルド成果物)
│   └── tauri.conf.json     # Tauri 設定
├── sidecar/                # Python 音声処理
│   ├── main.py             # エントリポイント
│   ├── audio.py            # 録音 & VAD
│   ├── postprocess.py      # LLM 後処理
│   ├── requirements.txt    # Python 依存
│   └── whisper-sidecar.spec# PyInstaller 設定
└── scripts/
    └── build-sidecar.ps1   # サイドカービルドスクリプト
```

---

## 7. トラブルシューティング

### `tauri dev` で「HotKey already registered」エラー
前回の WhisperDrop プロセスが正常終了せず、グローバルショートカットが登録されたまま残っている。タスクマネージャーで `whisperdrop.exe` を終了する。

### `build:sidecar` でサイズが 2GB 超
GPU 版 torch が含まれている。4.1 の手順で CPU 版に切り替えてリビルドする。

### `tauri build` で WiX / NSIS エラー
サイドカー exe が 2GB 超だとインストーラー生成に失敗する。CPU 版 torch でリビルドする（4.1 参照）。

### ポート 1420 が使用中
前回の `tauri dev` が正常終了しなかった場合、Vite 開発サーバー（localhost:1420）がポートを占有したまま残ることがある。`netstat -ano | findstr :1420` で PID を確認し、タスクマネージャーで終了する。Mac の場合は `lsof -i :1420` → `kill <PID>`。

### Mac で `cargo build` が `feature edition2024 is required` で失敗する
Rust が古い (1.85 未満)。`brew upgrade rust`、または `rustup` をインストールして `rustup update stable` する。

### Mac で「The window is set to be transparent but the macos-private-api is not enabled」警告
`tauri.conf.json` の `app.macOSPrivateApi` と、`src-tauri/Cargo.toml` の `tauri` features に `macos-private-api` が必要。本リポジトリでは設定済み。

### Mac で配布 DMG が「壊れています」と表示される
未署名・未公証アプリに対する Gatekeeper のブロックです。実際にファイルが壊れているわけではありません。回避するにはアプリを `/Applications` にコピーした上で:
```bash
xattr -cr /Applications/WhisperDrop.app
```
を実行してから起動してください。根本的な解決には Apple Developer ID による codesign + notarize が必要です（CI 未対応）。
