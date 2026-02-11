param()

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $repoRoot "apps\kiosk-backend"
$frontendDir = Join-Path $repoRoot "apps\kiosk-frontend"
$envFile = Join-Path $repoRoot ".env"

function Stop-Port([int]$port) {
  $lines = netstat -ano | Select-String (":" + $port + "\s")
  foreach ($line in $lines) {
    $parts = ($line -replace "\s+", " ").Trim().Split(" ")
    $procId = $parts[-1]
    if ($procId -and $procId -ne "0") {
      try { taskkill /PID $procId /F | Out-Null } catch { }
    }
  }
}

Stop-Port 5176
Stop-Port 8006

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$backendDir'; .\.venv\Scripts\Activate.ps1; python -m uvicorn app.main:app --reload --port 8006 --env-file '$envFile'"
)

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$frontendDir'; npm run dev -- --port 5176"
)

Write-Host "Frontend: http://localhost:5176"
Write-Host "Backend health: http://127.0.0.1:8006/api/health"
Write-Host "RAG test: http://127.0.0.1:8006/api/rag_test"
