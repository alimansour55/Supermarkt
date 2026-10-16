# MarketPlus shop agent — Windows installer.
# Run once, in PowerShell as Administrator, from the folder that holds shop-agent.mjs and config.json:
#   powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
# It checks Node.js and the settings, then registers a task that starts the agent with Windows
# (and restarts it after an update or a crash). Remove it with:  .\install-windows.ps1 -Uninstall

param([switch]$Uninstall)

$ErrorActionPreference = 'Stop'
$TaskName = 'MarketPlus Shop Agent'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path

if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Removed the '$TaskName' task. The files in $Here were left in place."
  exit 0
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  Write-Host 'Node.js is not installed. Install the LTS version from https://nodejs.org and run this again.' -ForegroundColor Red
  exit 1
}
$major = [int]((& $node --version).TrimStart('v').Split('.')[0])
if ($major -lt 18) {
  Write-Host "Node.js $major is too old - install version 18 or newer from https://nodejs.org" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path (Join-Path $Here 'config.json'))) {
  Copy-Item (Join-Path $Here 'config.example.json') (Join-Path $Here 'config.json')
  Write-Host 'Created config.json - open it, paste your API key and folder/database details, then run this again.' -ForegroundColor Yellow
  notepad (Join-Path $Here 'config.json')
  exit 0
}

Write-Host 'Testing the settings...'
& $node (Join-Path $Here 'shop-agent.mjs') --test
if ($LASTEXITCODE -ne 0) {
  Write-Host 'The test failed - fix config.json and run this again.' -ForegroundColor Red
  exit 1
}

# A tiny loop so the agent comes back after it updates itself or crashes.
$runner = Join-Path $Here 'run-agent.cmd'
@"
@echo off
cd /d "$Here"
:loop
"$node" shop-agent.mjs
timeout /t 10 /nobreak >nul
goto loop
"@ | Set-Content -Encoding ASCII $runner

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$runner`"" -WorkingDirectory $Here
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName

Write-Host "Installed. The agent now runs in the background and starts with Windows." -ForegroundColor Green
Write-Host "Log file: $(Join-Path $Here 'agent-data\agent.log')"
