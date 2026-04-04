# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for WhisperDrop sidecar (onefile mode).

Single exe output — all native libs (torch, ctranslate2, etc.) are packed inside.
Tauri bundles this via externalBin without needing extra resources config.
"""

import os

block_cipher = None
sidecar_dir = os.path.dirname(os.path.abspath(SPEC))

a = Analysis(
    [os.path.join(sidecar_dir, 'main.py')],
    pathex=[sidecar_dir],
    binaries=[],
    datas=[
        (os.path.join(sidecar_dir, 'ollama_models.json'), '.'),
    ],
    hiddenimports=[
        'torch',
        'torch.nn',
        'torch.nn.functional',
        'faster_whisper',
        'ctranslate2',
        'sounddevice',
        '_sounddevice_data',
        'anthropic',
        'openai',
        'pyperclip',
        'numpy',
        'huggingface_hub',
        'tokenizers',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'matplotlib',
        'tkinter',
        'PIL',
        'cv2',
        'scipy',
        'pandas',
        'IPython',
        'notebook',
        'pytest',
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='whisper-sidecar',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
)
