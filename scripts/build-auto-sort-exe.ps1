param(
  [string]$PythonExe = "python"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EntryScript = Join-Path $PSScriptRoot "auto_sort_downloads.py"
$OutputDir = Join-Path $ProjectRoot "release\auto-sort"
$WorkDir = Join-Path $ProjectRoot "build\auto-sort"

Write-Host "자동 분류 exe 빌드를 시작함."
Write-Host "출력 경로: $OutputDir"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null

& $PythonExe -m PyInstaller `
  --onefile `
  --console `
  --name "WithCueAutoSort" `
  --distpath $OutputDir `
  --workpath $WorkDir `
  --specpath $WorkDir `
  $EntryScript

Write-Host "자동 분류 exe 빌드를 완료했음."
