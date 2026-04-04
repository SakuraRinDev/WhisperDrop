#!/usr/bin/env pwsh
# Build the Python sidecar into a standalone executable using PyInstaller.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/build-sidecar.ps1

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$SidecarDir = Join-Path $ProjectRoot "sidecar"
$SrcTauriDir = Join-Path $ProjectRoot "src-tauri"
$BinariesDir = Join-Path $SrcTauriDir "binaries"

$VenvDir = Join-Path $SidecarDir ".venv"
$VenvScripts = Join-Path $VenvDir "Scripts"
$VenvPython = Join-Path $VenvScripts "python.exe"
$SpecFile = Join-Path $SidecarDir "whisper-sidecar.spec"

# Determine target triple
$TargetTriple = (rustc -vV 2>&1 | Select-String "host:").ToString().Trim().Replace("host: ", "")
Write-Host "[1/4] Target triple: $TargetTriple" -ForegroundColor Cyan

# Ensure PyInstaller is installed
Write-Host "[2/4] Ensuring PyInstaller..." -ForegroundColor Cyan
$ErrorActionPreference = "Continue"
& $VenvPython -m pip install pyinstaller --quiet 2>&1 | Out-Null
$ErrorActionPreference = "Stop"

$DistPath = Join-Path $SidecarDir "dist"
$WorkPath = Join-Path $SidecarDir "build"

# Run PyInstaller (--onefile via spec)
Write-Host "[3/4] Building sidecar with PyInstaller..." -ForegroundColor Cyan
& $VenvPython -m PyInstaller `
    --distpath $DistPath `
    --workpath $WorkPath `
    --noconfirm `
    --clean `
    $SpecFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "PyInstaller build failed!" -ForegroundColor Red
    exit 1
}

# Copy single exe to src-tauri/binaries/ with target triple name
$ExeSrc = Join-Path $DistPath "whisper-sidecar.exe"
$ExeDest = Join-Path $BinariesDir "whisper-sidecar-$TargetTriple.exe"

if (-not (Test-Path $BinariesDir)) {
    New-Item -ItemType Directory -Force -Path $BinariesDir | Out-Null
}

Write-Host "[4/4] Copying to $ExeDest ..." -ForegroundColor Cyan
Copy-Item $ExeSrc $ExeDest -Force

$SizeMB = [math]::Round((Get-Item $ExeDest).Length / 1MB, 1)
Write-Host "Build complete! Sidecar size: ${SizeMB}MB" -ForegroundColor Green
