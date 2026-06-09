$repoRoot = Resolve-Path "$PSScriptRoot\..\.."
$logDir = Join-Path $repoRoot ".run-logs"

New-Item -ItemType Directory -Force $logDir | Out-Null

$existing = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -eq 3306 } |
  Select-Object -First 1

if ($existing) {
  Write-Host "MySQL is already listening on port 3306."
  exit 0
}

$mysqlCandidates = @(
  @{
    Exe = "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe"
    Defaults = "$PSScriptRoot\..\mysql-local.ini"
    WorkingDirectory = "C:\Program Files\MySQL\MySQL Server 8.4\bin"
  },
  @{
    Exe = "C:\xampp\mysql\bin\mysqld.exe"
    Defaults = "C:\xampp\mysql\bin\my.ini"
    WorkingDirectory = "C:\xampp\mysql\bin"
  }
)

$mysqlConfig = $mysqlCandidates |
  Where-Object { (Test-Path $_.Exe) -and (Test-Path $_.Defaults) } |
  Select-Object -First 1

if (-not $mysqlConfig) {
  Write-Error "MySQL executable was not found. Install MySQL Server or XAMPP, then run this script again."
  exit 1
}

$mysqlExe = (Resolve-Path $mysqlConfig.Exe).Path
$defaultsFile = (Resolve-Path $mysqlConfig.Defaults).Path
$workingDirectory = if (Test-Path $mysqlConfig.WorkingDirectory) {
  (Resolve-Path $mysqlConfig.WorkingDirectory).Path
} else {
  Split-Path $mysqlExe -Parent
}

Start-Process `
  -FilePath $mysqlExe `
  -ArgumentList @("--defaults-file=$defaultsFile", "--console") `
  -WorkingDirectory $workingDirectory `
  -RedirectStandardOutput (Join-Path $logDir "mysql.out.log") `
  -RedirectStandardError (Join-Path $logDir "mysql.err.log") `
  -WindowStyle Hidden

Start-Sleep -Seconds 5

$started = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -eq 3306 } |
  Select-Object -First 1

if ($started) {
  Write-Host "MySQL started on port 3306."
  exit 0
}

Write-Error "MySQL did not start. Check .run-logs/mysql.err.log."
exit 1
