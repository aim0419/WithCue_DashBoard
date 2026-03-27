#!/usr/bin/env bash

set -euo pipefail

PYTHON_EXE="${1:-python3}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENTRY_SCRIPT="${SCRIPT_DIR}/auto_sort_downloads.py"
OUTPUT_DIR="${PROJECT_ROOT}/release/auto-sort-macos"
WORK_DIR="${PROJECT_ROOT}/build/auto-sort-macos"

echo "macOS 자동 분류 앱 빌드를 시작합니다."
echo "출력 경로: ${OUTPUT_DIR}"

mkdir -p "${OUTPUT_DIR}" "${WORK_DIR}"

"${PYTHON_EXE}" -m PyInstaller \
  --noconfirm \
  --windowed \
  --name "WithCueAutoSort" \
  --distpath "${OUTPUT_DIR}" \
  --workpath "${WORK_DIR}" \
  --specpath "${WORK_DIR}" \
  "${ENTRY_SCRIPT}"

echo "macOS 자동 분류 앱 빌드를 완료했습니다."
