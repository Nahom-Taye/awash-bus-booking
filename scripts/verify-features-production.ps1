param(
  [Parameter(Mandatory = $true)]
  [string]$BuildRoot,
  [int]$Port = 3104
)

$ErrorActionPreference = "Stop"
$sourceRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$resolvedBuildRoot = (Resolve-Path -LiteralPath $BuildRoot).Path
$databaseLine = Get-Content -LiteralPath (Join-Path $resolvedBuildRoot ".env") |
  Where-Object { $_ -match "^DATABASE_URL=" } |
  Select-Object -First 1

if (-not $databaseLine) {
  throw "DATABASE_URL is not configured."
}

$databaseValue = $databaseLine.
  Substring($databaseLine.IndexOf("=") + 1).
  Trim().
  Trim('"').
  Trim("'")
$databaseSeparator = if ($databaseValue.Contains("?")) { "&" } else { "?" }
$boundedDatabaseUrl =
  $databaseValue + $databaseSeparator + "connection_limit=3&pool_timeout=30"

$currentPathValue = [Environment]::GetEnvironmentVariable("Path", "Process")
[Environment]::SetEnvironmentVariable("PATH", $null, "Process")
[Environment]::SetEnvironmentVariable("Path", $currentPathValue, "Process")

$env:DATABASE_URL = $boundedDatabaseUrl
$stdoutPath = Join-Path $resolvedBuildRoot "verification-server.stdout.log"
$stderrPath = Join-Path $resolvedBuildRoot "verification-server.stderr.log"
$serverProcess = Start-Process `
  -FilePath "C:\Program Files\nodejs\node.exe" `
  -ArgumentList "node_modules/next/dist/bin/next start -p $Port" `
  -WorkingDirectory $resolvedBuildRoot `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath `
  -PassThru

try {
  $deadline = (Get-Date).AddSeconds(45)
  do {
    $listener = netstat -ano |
      Select-String "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+\d+\s*$" |
      Select-Object -First 1
    if ($listener) {
      break
    }
    if ($serverProcess.HasExited) {
      Get-Content -LiteralPath $stdoutPath -Tail 80 -ErrorAction SilentlyContinue
      Get-Content -LiteralPath $stderrPath -Tail 80 -ErrorAction SilentlyContinue
      throw "The isolated production server exited before becoming ready."
    }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)

  if (-not $listener) {
    throw "The isolated production server did not become ready."
  }

  Write-Output "Isolated production server ready."
  Set-Location -LiteralPath $sourceRoot
  $env:TEST_DATABASE_URL = $boundedDatabaseUrl
  $env:TEST_BASE_URL = "http://127.0.0.1:$Port"
  & node --env-file=.env scripts/verify-features.mjs
  $verificationExitCode = $LASTEXITCODE

  if ($verificationExitCode -ne 0) {
    Get-Content -LiteralPath $stderrPath -Tail 120 -ErrorAction SilentlyContinue
    throw "Feature verification failed with exit code $verificationExitCode."
  }
} finally {
  $listenerLine = netstat -ano |
    Select-String "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$" |
    Select-Object -First 1
  if ($listenerLine) {
    $listenerProcessId = [int]$listenerLine.Matches[0].Groups[1].Value
    Stop-Process -Id $listenerProcessId -ErrorAction SilentlyContinue
  }
  if (-not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -ErrorAction SilentlyContinue
  }
}
