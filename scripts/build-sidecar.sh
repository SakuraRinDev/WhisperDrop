#!/usr/bin/env bash
# Build the Python sidecar into a standalone executable using PyInstaller.
# Usage: bash scripts/build-sidecar.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SIDECAR_DIR="$PROJECT_ROOT/sidecar"
BINARIES_DIR="$PROJECT_ROOT/src-tauri/binaries"
SPEC_FILE="$SIDECAR_DIR/whisper-sidecar.spec"

VENV_DIR="$SIDECAR_DIR/.venv"
VENV_PYTHON="$VENV_DIR/bin/python"

# Determine target triple from rustc
TARGET_TRIPLE=$(rustc -vV | grep '^host:' | sed 's/host: //')
echo "[1/4] Target triple: $TARGET_TRIPLE"

# Ensure PyInstaller is installed
echo "[2/4] Ensuring PyInstaller..."
"$VENV_PYTHON" -m pip install pyinstaller --quiet 2>/dev/null || true

DIST_PATH="$SIDECAR_DIR/dist"
WORK_PATH="$SIDECAR_DIR/build"

# Run PyInstaller (--onefile via spec)
echo "[3/4] Building sidecar with PyInstaller..."
"$VENV_PYTHON" -m PyInstaller \
    --distpath "$DIST_PATH" \
    --workpath "$WORK_PATH" \
    --noconfirm \
    --clean \
    "$SPEC_FILE"

# On macOS the output has no extension; on Linux it also has no extension
EXE_SRC="$DIST_PATH/whisper-sidecar"
EXE_DEST="$BINARIES_DIR/whisper-sidecar-$TARGET_TRIPLE"

mkdir -p "$BINARIES_DIR"

echo "[4/4] Copying to $EXE_DEST ..."
cp "$EXE_SRC" "$EXE_DEST"
chmod +x "$EXE_DEST"

SIZE_MB=$(du -m "$EXE_DEST" | cut -f1)
echo "Build complete! Sidecar size: ${SIZE_MB}MB"
