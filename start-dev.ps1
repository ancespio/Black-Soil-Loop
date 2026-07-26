param(
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$backendDir = $root
$python = Join-Path $root '.venv\Scripts\python.exe'
$frontendUrl = 'http://localhost:8080/frontdesign-v1/'
$backendUrl = 'http://127.0.0.1:8000/healthz'

if (-not (Test-Path -LiteralPath $python)) {
    throw '.venv was not found. Create the virtual environment and install requirements.txt first.'
}

$logRoot = [System.IO.Path]::GetTempPath()
$runId = [DateTime]::Now.ToString('yyyyMMdd-HHmmss-fff')
$backendLog = Join-Path $logRoot "black-soil-loop-backend-$runId.log"
$backendErrorLog = Join-Path $logRoot "black-soil-loop-backend-error-$runId.log"
$frontendLog = Join-Path $logRoot "black-soil-loop-frontend-$runId.log"
$frontendErrorLog = Join-Path $logRoot "black-soil-loop-frontend-error-$runId.log"
$backendProcess = $null
$frontendProcess = $null

function Stop-ChildProcess {
    param([System.Diagnostics.Process]$Process)

    if ($null -ne $Process -and -not $Process.HasExited) {
        Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
    }
}

function Show-LogTail {
    param([string]$Path)

    if (Test-Path -LiteralPath $Path) {
        Get-Content -LiteralPath $Path -Tail 20 -ErrorAction SilentlyContinue
    }
}

try {
    $backendProcess = Start-Process `
        -FilePath $python `
        -WorkingDirectory $backendDir `
        -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000') `
        -WindowStyle Hidden `
        -RedirectStandardOutput $backendLog `
        -RedirectStandardError $backendErrorLog `
        -PassThru

    $frontendProcess = Start-Process `
        -FilePath $python `
        -WorkingDirectory $root `
        -ArgumentList @('-m', 'http.server', '8080', '--directory', ('"{0}"' -f $root)) `
        -WindowStyle Hidden `
        -RedirectStandardOutput $frontendLog `
        -RedirectStandardError $frontendErrorLog `
        -PassThru

    $deadline = (Get-Date).AddSeconds(30)
    $backendReady = $false
    $frontendReady = $false

    while ((Get-Date) -lt $deadline -and (-not $backendReady -or -not $frontendReady)) {
        if (-not $backendProcess.HasExited) {
            try {
                $null = Invoke-WebRequest -Uri $backendUrl -UseBasicParsing -TimeoutSec 1
                $backendReady = $true
            } catch {
                # The service is still starting.
            }
        }

        if (-not $frontendProcess.HasExited) {
            try {
                $null = Invoke-WebRequest -Uri $frontendUrl -UseBasicParsing -TimeoutSec 1
                $frontendReady = $true
            } catch {
                # The service is still starting.
            }
        }

        if (-not $backendReady -or -not $frontendReady) {
            Start-Sleep -Milliseconds 250
        }
    }

    if (-not $backendReady) {
        throw "Backend did not start within 30 seconds.`n$(Show-LogTail $backendErrorLog)"
    }

    if (-not $frontendReady) {
        throw "Frontend did not start within 30 seconds.`n$(Show-LogTail $frontendErrorLog)"
    }

    Write-Host 'Black-Soil-Loop is ready.' -ForegroundColor Green
    Write-Host "Backend: $backendUrl"
    Write-Host "Frontend: $frontendUrl"
    Write-Host "Backend log: $backendLog"
    Write-Host "Frontend log: $frontendLog"
    Write-Host 'The browser will open. Press Ctrl+C to stop both services.' -ForegroundColor Yellow
    if (-not $NoBrowser) {
        Start-Process $frontendUrl | Out-Null
    }

    while ($true) {
        if ($backendProcess.HasExited) {
            throw "The backend process exited.`n$(Show-LogTail $backendErrorLog)"
        }
        if ($frontendProcess.HasExited) {
            throw "The frontend process exited.`n$(Show-LogTail $frontendErrorLog)"
        }
        Start-Sleep -Seconds 2
    }
} finally {
    Stop-ChildProcess $backendProcess
    Stop-ChildProcess $frontendProcess
}
