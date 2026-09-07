# Allow MarketPlus dev servers through Windows Firewall (run once as Administrator).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/setup-mobile-dev.ps1

$ports = @(5173, 5001)

foreach ($port in $ports) {
  $name = "MarketPlus Dev TCP $port"
  $existing = netsh advfirewall firewall show rule name="$name" 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Rule already exists: $name"
    continue
  }
  netsh advfirewall firewall add rule name="$name" dir=in action=allow protocol=TCP localport=$port | Out-Null
  Write-Host "Added firewall rule: $name"
}

Write-Host ""
Write-Host "Done. Restart: npm run dev"
Write-Host "Then on your phone open the URL shown in the terminal (http://192.168.x.x:5173)"
