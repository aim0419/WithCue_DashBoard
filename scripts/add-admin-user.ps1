param(
  [Parameter(Mandatory = $true)]
  [string]$Name,

  [Parameter(Mandatory = $true)]
  [string]$BirthDate,

  [Parameter(Mandatory = $true)]
  [ValidateSet("male", "female")]
  [string]$Gender,

  [Parameter(Mandatory = $true)]
  [int]$UserNumber
)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

node ./backend/scripts/upsert-admin-user.mjs $Name $BirthDate $Gender $UserNumber
