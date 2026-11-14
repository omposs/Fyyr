$ErrorActionPreference = 'Stop'
$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) { throw 'Install the backend dependencies first; see README.md.' }
if (-not (Test-Path (Join-Path $PSScriptRoot 'frontend\node_modules\vite\bin\vite.js'))) {
    throw 'Run npm.cmd ci in frontend first; see README.md.'
}
$root = $PSScriptRoot.Replace("'", "''")
Start-Process powershell.exe -ArgumentList '-NoExit', '-Command', "Set-Location -LiteralPath '$root'; & '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
Start-Process powershell.exe -ArgumentList '-NoExit', '-Command', "Set-Location -LiteralPath '$root\frontend'; npm.cmd run dev -- --host localhost --port 5173 --strictPort"
Write-Host 'Services launched in two terminals. Open http://localhost:5173. Stop each service with Ctrl+C in its terminal.'
