# PowerShell script to kill process using port 3001
# Usage: .\kill-port.ps1 [port]

param(
    [int]$Port = 3001
)

Write-Host "Finding processes using port $Port..." -ForegroundColor Yellow

$processes = netstat -ano | findstr ":$Port" | Select-String "LISTENING"

if ($processes) {
    $pids = $processes | ForEach-Object {
        $_.ToString().Split(' ', [StringSplitOptions]::RemoveEmptyEntries) | Select-Object -Last 1
    } | Sort-Object -Unique
    
    foreach ($pid in $pids) {
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "Killing process: $($process.ProcessName) (PID: $pid)" -ForegroundColor Red
            Stop-Process -Id $pid -Force
            Write-Host "Process $pid terminated" -ForegroundColor Green
        }
    }
} else {
    Write-Host "No processes found using port $Port" -ForegroundColor Green
}

Write-Host "Done!" -ForegroundColor Green

