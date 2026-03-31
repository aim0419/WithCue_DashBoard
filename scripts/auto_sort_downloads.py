from __future__ import annotations

import argparse
import shutil
import sys
import time
from pathlib import Path


# 파일명 코드와 부위 폴더를 매핑함.
BODY_PART_FOLDERS = {
    "01": "Neck",
    "011": "Neck",
    "02": "Hip",
    "021": "Hip",
    "03": "L_Shoulder",
    "031": "L_Shoulder",
    "04": "R_Shoulder",
    "041": "R_Shoulder",
    "05": "L_Knee",
    "051": "L_Knee",
    "06": "R_Knee",
    "061": "R_Knee",
}

# 다운로드 중간 파일 확장자를 제외함.
PENDING_SUFFIXES = {".crdownload", ".part", ".tmp"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Data_Auto 폴더를 감시하면서 파일명을 기준으로 부위별 폴더에 자동 분류함."
    )
    parser.add_argument(
        "--watch-dir",
        default=str(Path.home() / "Desktop" / "Data_Auto"),
        help="감시할 Data_Auto 폴더 경로를 지정함.",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=1.0,
        help="폴더를 다시 확인할 간격(초)을 지정함.",
    )
    parser.add_argument(
        "--settle-seconds",
        type=float,
        default=2.0,
        help="파일 크기가 안정됐는지 확인할 대기 시간(초)을 지정함.",
    )
    return parser.parse_args()


def ensure_base_structure(base_dir: Path) -> None:
    # 기본 Data_Auto 및 부위별 폴더를 미리 생성함.
    base_dir.mkdir(parents=True, exist_ok=True)
    for folder_name in BODY_PART_FOLDERS.values():
        (base_dir / folder_name).mkdir(parents=True, exist_ok=True)
    (base_dir / "_unclassified").mkdir(parents=True, exist_ok=True)


def is_pending_file(file_path: Path) -> bool:
    return file_path.suffix.lower() in PENDING_SUFFIXES


def is_file_stable(file_path: Path, settle_seconds: float) -> bool:
    # 다운로드 완료 전 파일 이동을 막기 위해 크기 안정 여부를 확인함.
    try:
        first_size = file_path.stat().st_size
    except FileNotFoundError:
        return False

    time.sleep(settle_seconds)

    try:
        second_size = file_path.stat().st_size
    except FileNotFoundError:
        return False

    return first_size == second_size


def resolve_target_directory(base_dir: Path, file_name: str) -> Path:
    # 파일명 형식 A-01-05.webm 에서 부위 코드를 읽어 대상 폴더를 결정함.
    stem = Path(file_name).stem
    parts = stem.split("-")
    if len(parts) < 3:
        return base_dir / "_unclassified"

    body_part_code = parts[1]
    target_folder = BODY_PART_FOLDERS.get(body_part_code)
    if target_folder is None:
        return base_dir / "_unclassified"

    return base_dir / target_folder


def move_file_to_target(file_path: Path, target_dir: Path) -> None:
    target_path = target_dir / file_path.name

    # 같은 이름이 있으면 덮어쓰지 않고 뒤에 일련번호를 붙임.
    if target_path.exists():
        stem = target_path.stem
        suffix = target_path.suffix
        index = 1
        while True:
            candidate = target_dir / f"{stem}_{index}{suffix}"
            if not candidate.exists():
                target_path = candidate
                break
            index += 1

    shutil.move(str(file_path), str(target_path))
    print(f"[이동 완료] {file_path.name} -> {target_path}")


def scan_and_sort(base_dir: Path, settle_seconds: float) -> None:
    # 루트 Data_Auto 폴더에 새로 떨어진 파일만 분류 대상으로 삼음.
    for file_path in base_dir.iterdir():
        if not file_path.is_file():
            continue

        if is_pending_file(file_path):
            continue

        if not is_file_stable(file_path, settle_seconds):
            continue

        target_dir = resolve_target_directory(base_dir, file_path.name)
        move_file_to_target(file_path, target_dir)


def main() -> int:
    args = parse_args()
    watch_dir = Path(args.watch_dir).expanduser().resolve()

    ensure_base_structure(watch_dir)

    print(f"[감시 시작] {watch_dir}")
    print("[안내] 종료하려면 Ctrl+C를 누르면 됨.")

    try:
        while True:
            scan_and_sort(watch_dir, args.settle_seconds)
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\n[감시 종료] 사용자가 중단했음.")
        return 0
    except Exception as exc:  # pragma: no cover
        print(f"[오류] 자동 분류 중 예외가 발생했음: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
