#requires -Version 5.1
<#
Restarts the Healthy Visit backend cleanly.

Usage:
  powershell -ExecutionPolicy Bypass -File "...\backend\restart-backend.ps1"
  powershell -ExecutionPolicy Bypass -File "...\backend\restart-backend.ps1" -Nuclear

-Nuclear: kills ALL python.exe on the machine first. Use this when a "ghost"
process is still listening on 127.0.0.1:9999 and the normal kill loop can't
reach it.
#>
param(
    [switch]$Nuclear
)

$ErrorActionPreference = "Stop"
$BackendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $BackendDir
Write-Host "[restart] backend folder: $BackendDir" -ForegroundColor Cyan

function Get-Listeners9999 {
    return @(Get-NetTCPConnection -LocalPort 9999 -State Listen -ErrorAction SilentlyContinue)
}

function Show-Listeners9999 {
    $rows = Get-Listeners9999
    if ($rows.Count -eq 0) {
        Write-Host "[restart] (no LISTENers on 9999)" -ForegroundColor DarkGray
        return
    }
    foreach ($r in $rows) {
        $procName = "?"; $procPath = "?"
        try {
            $p = Get-Process -Id $r.OwningProcess -ErrorAction Stop
            $procName = $p.ProcessName
            $procPath = $p.Path
        } catch {}
        Write-Host ("[restart]   LISTEN {0,-15}:{1}  PID={2,-6} {3}  {4}" -f $r.LocalAddress, $r.LocalPort, $r.OwningProcess, $procName, $procPath) -ForegroundColor Cyan
    }
}

function Kill-Pid {
    param([int]$TargetPid)
    if (-not $TargetPid -or $TargetPid -eq 0) { return }
    try {
        $proc = Get-Process -Id $TargetPid -ErrorAction Stop
        Write-Host "[restart]   stopping PID $TargetPid ($($proc.ProcessName) - $($proc.Path))" -ForegroundColor Yellow
        Stop-Process -Id $TargetPid -Force -ErrorAction Stop
    } catch {
        Write-Host "[restart]   Stop-Process failed for PID $TargetPid ($($_.Exception.Message)); trying taskkill /T..." -ForegroundColor DarkYellow
        & cmd.exe /c "taskkill /F /T /PID $TargetPid" | Out-Null
    }
}

function Stop-Port9999 {
    for ($attempt = 1; $attempt -le 6; $attempt++) {
        $listeners = Get-Listeners9999
        if ($listeners.Count -eq 0) {
            Write-Host "[restart] no LISTENing process on 9999." -ForegroundColor Green
            return
        }
        $pids = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
        Write-Host "[restart] attempt $attempt - LISTEN on 9999 held by PID(s): $($pids -join ', ')" -ForegroundColor Yellow
        foreach ($targetPid in $pids) { Kill-Pid -TargetPid $targetPid }
        Start-Sleep -Milliseconds 800
    }
    $still = Get-Listeners9999
    if ($still.Count -gt 0) {
        $stillPids = ($still | Select-Object -ExpandProperty OwningProcess -Unique) -join ', '
        throw "Port 9999 LISTEN is STILL held after 6 kill attempts. PID(s): $stillPids. Re-run this script with -Nuclear, or end those PIDs in Task Manager (Details tab)."
    }
    Write-Host "[restart] port 9999 is now free." -ForegroundColor Green
}

if ($Nuclear) {
    Write-Host "[restart] -Nuclear: stopping ALL python.exe processes on this machine..." -ForegroundColor Magenta
    Get-Process python -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "[restart]   killing python PID $($_.Id) - $($_.Path)" -ForegroundColor Magenta
        Kill-Pid -TargetPid $_.Id
    }
    Start-Sleep -Seconds 1
}

Write-Host "[restart] listeners on 9999 BEFORE cleanup:" -ForegroundColor Cyan
Show-Listeners9999

Stop-Port9999

Write-Host "[restart] listeners on 9999 AFTER cleanup:" -ForegroundColor Cyan
Show-Listeners9999

$VenvDir = Join-Path $BackendDir ".venv"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    Write-Host "[restart] creating virtual env at .venv ..." -ForegroundColor Cyan
    python -m venv .venv
}
if (-not (Test-Path $VenvPython)) {
    throw "Could not find/create $VenvPython. Install Python 3.9+ and rerun."
}

Write-Host "[restart] using interpreter: $VenvPython" -ForegroundColor Cyan
& $VenvPython -m pip install --upgrade pip --quiet
& $VenvPython -m pip install -r requirements.txt --quiet

$EnvFile = Join-Path $BackendDir ".env"
if (-not (Test-Path $EnvFile)) {
    throw "Missing $EnvFile. Create it with one line: OPENAI_API_KEY=sk-..."
}
$envText = Get-Content $EnvFile -Raw
if ($envText -notmatch "OPENAI_API_KEY\s*=\s*\S+") {
    Write-Host "[restart] WARNING: OPENAI_API_KEY does not appear set in .env (LLM will fall back to scripts)." -ForegroundColor Yellow
} else {
    Write-Host "[restart] OPENAI_API_KEY found in .env." -ForegroundColor Green
}

Write-Host "[restart] starting server (Ctrl+C to stop)..." -ForegroundColor Cyan
& $VenvPython server.py
