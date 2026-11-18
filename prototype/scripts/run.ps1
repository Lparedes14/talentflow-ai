# PowerShell equivalent of run.sh, for teammates on Windows.
#
#   .\scripts\run.ps1 09_compare_extractors.py --limit 220
#   .\scripts\run.ps1 13 --audit-only
#   .\scripts\run.ps1
#
# Same behaviour: writes data\runs\<timestamp>-<script>.log, refreshes latest.log, captures
# stdout and stderr together, redacts keys, passes the exit status through.
#
# If PowerShell refuses to run this, it is the execution policy, not the script:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
$runs = Join-Path $root "data\runs"
New-Item -ItemType Directory -Force -Path $runs | Out-Null

$available = Get-ChildItem (Join-Path $root "scripts") -Filter "*.py" |
             Where-Object { $_.Name -match '^\d+_' } | Select-Object -ExpandProperty Name

if ($args.Count -eq 0) {
    Write-Host "usage: .\scripts\run.ps1 <script> [args...]"
    Write-Host "`navailable:"
    $available | ForEach-Object { Write-Host "  $_" }
    exit 2
}

$wanted = $args[0]
$rest = @()
if ($args.Count -gt 1) { $rest = $args[1..($args.Count - 1)] }
$base = [System.IO.Path]::GetFileNameWithoutExtension($wanted)

$matched = @($available | Where-Object { $_ -like "*$base*" })
if ($matched.Count -eq 0) {
    Write-Host "no script matches '$wanted'. available:"
    $available | ForEach-Object { Write-Host "  $_" }
    exit 2
} elseif ($matched.Count -gt 1) {
    Write-Host "'$wanted' matches more than one script, be more specific:"
    $matched | ForEach-Object { Write-Host "  $_" }
    exit 2
}

$scriptName = $matched[0]
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$log = Join-Path $runs "$stamp-$([System.IO.Path]::GetFileNameWithoutExtension($scriptName)).log"

$pyVersion = (& python --version 2>&1) -join " "
$venv = if ($env:VIRTUAL_ENV) { $env:VIRTUAL_ENV } else { "none active" }
@(
    "# $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    "# command : python scripts\$scriptName $($rest -join ' ')"
    "# python  : $pyVersion"
    "# venv    : $venv"
    "# ---------------------------------------------------------------------"
) | Set-Content -Path $log -Encoding utf8

Push-Location $root
try {
    # 2>&1 merges stderr into stdout so a traceback lands beside the lines that led to it.
    & python -u (Join-Path "scripts" $scriptName) @rest 2>&1 | Tee-Object -FilePath $log -Append
    $status = $LASTEXITCODE
} finally {
    Pop-Location
}

Add-Content -Path $log -Value "# ---------------------------------------------------------------------"
Add-Content -Path $log -Value "# exit status: $status"

# Redact anything key-shaped before this file goes anywhere.
$text = Get-Content -Path $log -Raw
$text = $text -replace '(sk-ant-api[\w-]{8})[\w-]+', '$1<redacted>'
$text = $text -replace '(sk-proj-[\w-]{8})[\w-]+', '$1<redacted>'
$text = $text -replace '(AIzaSy[\w-]{4})[\w-]+',   '$1<redacted>'
$text = $text -replace '(ghp_[\w]{4})[\w]+',       '$1<redacted>'
Set-Content -Path $log -Value $text -Encoding utf8
Copy-Item -Path $log -Destination (Join-Path $runs "latest.log") -Force

Write-Host ""
Write-Host "log: data\runs\$(Split-Path $log -Leaf)   (also data\runs\latest.log)"
exit $status
