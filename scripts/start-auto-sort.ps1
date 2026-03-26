param(
  [string]$WatchDir = "$HOME\Desktop\Data_Auto"
)

Write-Host "Data_Auto 자동 분류 감시를 시작함."
Write-Host "감시 경로: $WatchDir"

python "$PSScriptRoot\auto_sort_downloads.py" --watch-dir "$WatchDir"
