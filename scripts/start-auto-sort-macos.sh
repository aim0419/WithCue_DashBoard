#!/usr/bin/env bash

set -euo pipefail

PYTHON_EXE="${PYTHON_EXE:-python3}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WATCH_DIR="${1:-$HOME/Desktop/Data_Auto}"

echo "macOS 자동 분류기를 시작합니다."
echo "감시 경로: ${WATCH_DIR}"

"${PYTHON_EXE}" "${SCRIPT_DIR}/auto_sort_downloads.py" --watch-dir "${WATCH_DIR}"
