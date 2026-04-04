# WhisperDrop インストール & ビルド手順

## 前提条件

| ツール | バージョン | 用途 |
|--------|-----------|------|
| **Node.js** | 18+ | フロントエンドビルド |
| **Rust** | stable (rustup) | Tauri バックエンド |
| **Python** | 3.10 - 3.12 | 音声処理サイドカー |
| **Ollama** (任意) | latest | ローカル LLM 後処理 |

Windows x64 のみ対応。

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

### 1.4 Tauri CLI

```bash
npm install -g @tauri-apps/cli
```

---

## 2. 開発モードで起動

```bash
npm run tauri dev
```

- Vite dev server + Rust ビルド + Python sidecar が自動起動
- ファイル変更で自動リビルド（HMR）
- グローバルショートカット: **Ctrl+Shift+Space** で音声入力

---

## 3. インストーラー生成（配布用）

### 3.1 サイドカー exe ビルド

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

### 3.2 フルビルド（インストーラー生成）

```bash
npm run tauri build
```

出力:
```
src-tauri/target/release/bundle/nsis/WhisperDrop_0.1.0_x64-setup.exe  (~242MB)
```

### 3.3 ワンコマンドビルド

サイドカー + Tauri を一括実行:

```bash
npm run build:all
```

> 事前に CPU 版 torch をインストールしておくこと（3.1 参照）。

---

## 4. npm スクリプト一覧

| コマンド | 説明 |
|----------|------|
| `npm run dev` | Vite dev server のみ起動 |
| `npm run tauri dev` | 開発モード（Vite + Rust + Python） |
| `npm run build:sidecar` | PyInstaller でサイドカー exe 生成 |
| `npm run tauri build` | NSIS インストーラー生成 |
| `npm run build:all` | サイドカー + インストーラー一括生成 |

---

## 5. プロジェクト構成

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

## 6. トラブルシューティング

### `tauri dev` で「HotKey already registered」エラー
別の WhisperDrop プロセスが残っている。タスクマネージャーで `whisperdrop.exe` を終了する。

### `build:sidecar` でサイズが 2GB 超
GPU 版 torch が含まれている。3.1 の手順で CPU 版に切り替えてリビルドする。

### `tauri build` で WiX / NSIS エラー
サイドカー exe が 2GB 超だとインストーラー生成に失敗する。CPU 版 torch でリビルドする。

### ポート 1420 が使用中
別の Vite プロセスが残っている。`netstat -ano | findstr :1420` で PID を確認し終了する。
