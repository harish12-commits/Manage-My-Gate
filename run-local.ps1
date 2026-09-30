<#
.SYNOPSIS
  One script to check and run everything locally: Docker containers (MongoDB, Redis),
  backend API, web frontend and (optionally) the mobile app, each in its own named
  Windows Terminal tab.

.EXAMPLES
  .\run-local.ps1                 # check -> start containers -> install deps -> start apps -> health check
  .\run-local.ps1 -Status         # only report what is running / healthy, start nothing
  .\run-local.ps1 -Mobile         # also start the Expo mobile app
  .\run-local.ps1 -MongoExpress   # also start the Mongo Express DB UI (docker)
  .\run-local.ps1 -SkipDocker     # use your own MongoDB/Redis, don't touch Docker
  .\run-local.ps1 -Test           # run backend tests only
  .\run-local.ps1 -Stop           # stop the docker containers started by this script
  .\run-local.ps1 -ResetDb        # DROP local dev DB, rebuild indexes/permissions, re-seed demo data, then start
  .\run-local.ps1 -Install        # force a fresh npm install everywhere

  If scripts are blocked:  powershell -ExecutionPolicy Bypass -File .\run-local.ps1
#>
param(
  [switch]$Status,
  [switch]$Stop,
  [switch]$Mobile,
  [switch]$NoMobile,
  [switch]$MongoExpress,
  [switch]$SkipDocker,
  [switch]$Test,
  [switch]$Install,
  [switch]$ResetDb
)

$ErrorActionPreference = 'Stop'
# Mobile (Expo) app starts by default; pass -NoMobile to skip it.
$Mobile = -not $NoMobile
$Root      = $PSScriptRoot
$Backend   = Join-Path $Root 'backend'
$Frontend  = Join-Path $Root 'frontend'
$MobileDir = Join-Path $Root 'mobile\mobile-app'
$EnvFile   = Join-Path $Backend '.env'

$script:Problems = @()
$script:DockerDown = $false
function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "  [ OK ] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Bad($msg)  { Write-Host "  [FAIL] $msg" -ForegroundColor Red; $script:Problems += $msg }
function Abort($msg) { Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 }

# --- helpers ----------------------------------------------------------------
function Test-Port($port, $hostName = '127.0.0.1') {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $iar = $client.BeginConnect($hostName, [int]$port, $null, $null)
    return ($iar.AsyncWaitHandle.WaitOne(800) -and $client.Connected)
  } catch { return $false } finally { $client.Close() }
}

function Wait-Port($port, $label, $seconds = 60) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Port $port) { Ok "$label is accepting connections on :$port"; return $true }
    Start-Sleep -Seconds 2
  }
  Bad "$label did not come up on :$port within ${seconds}s"
  return $false
}

# Real MongoDB ping using the backend's own driver + MONGODB_URI (an open port is not proof Mongo is serving).
function Test-Mongo {
  if (-not (Test-Path (Join-Path $Backend 'node_modules\mongoose'))) { return (Test-Port $MongoPort) }
  $js = "require('dotenv').config({path:'.env'});const m=require('mongoose');m.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:6000}).then(()=>m.connection.db.admin().ping()).then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)})"
  Push-Location $Backend
  $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { node -e $js 2>&1 | Out-Null; return ($LASTEXITCODE -eq 0) } finally { $ErrorActionPreference = $prev; Pop-Location }
}

function Wait-Mongo($label, $seconds = 90) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Mongo) { Ok "$label is answering queries"; return $true }
    Start-Sleep -Seconds 3
  }
  Bad "$label is not answering queries within ${seconds}s"
  return $false
}

function Wait-Http($url, $label, $seconds = 60) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -lt 500) { Ok "$label responded ($($r.StatusCode)) at $url"; return $true }
    } catch {
      if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -lt 500) {
        Ok "$label responded at $url"; return $true
      }
    }
    Start-Sleep -Seconds 2
  }
  Bad "$label did not respond at $url within ${seconds}s"
  return $false
}

function Read-EnvValue($name, $default = $null) {
  if (-not (Test-Path $EnvFile)) { return $default }
  $m = Select-String -Path $EnvFile -Pattern "^\s*$name\s*=\s*(.*)$" | Select-Object -First 1
  if ($m) { return $m.Matches.Groups[1].Value.Trim().Trim('"').Trim("'") }
  return $default
}

function Test-DockerReady {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return $false }
  # `docker info` can hang forever when Docker Desktop is half-started, so bound it to 15s.
  $p = Start-Process docker -ArgumentList 'info' -NoNewWindow -PassThru -RedirectStandardOutput ([IO.Path]::GetTempFileName()) -RedirectStandardError ([IO.Path]::GetTempFileName())
  if (-not $p.WaitForExit(15000)) { try { $p.Kill() } catch {}; return $false }
  return ($p.ExitCode -eq 0)
}

# Ports this stack uses (read from .env / docker-compose defaults)
$BackendPort  = [int](Read-EnvValue 'PORT' '5000')
$MongoPort    = [int](Read-EnvValue 'DB_PORT_EXTERNAL' '27019')
$RedisPort    = [int](Read-EnvValue 'REDIS_PORT_EXTERNAL' '6379')
$FrontendPort = 3004   # frontend/vite.config.js
$ExpressPort  = [int](Read-EnvValue 'MONGO_EXPRESS_PORT' '8081')

# --- Stop -------------------------------------------------------------------
if ($Stop) {
  Step 'Stopping docker containers'
  Push-Location $Root
  docker compose stop mongodb mongodb-rs-init redis mongo-express
  Pop-Location
  Write-Host 'Close the terminal tabs to stop the backend/frontend/mobile.' -ForegroundColor DarkGray
  exit 0
}

# --- Preflight checks -------------------------------------------------------
Step 'Checking prerequisites'

if (Get-Command node -ErrorAction SilentlyContinue) {
  $nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
  if ($nodeMajor -ge 20) { Ok "Node $(node -v)" } else { Bad "Node $(node -v) is too old; v20+ required" }
} else { Bad 'Node.js is not installed' }

if (Get-Command npm -ErrorAction SilentlyContinue) { Ok "npm $(npm -v)" } else { Bad 'npm is not installed' }

if (Get-Command wt -ErrorAction SilentlyContinue) { Ok 'Windows Terminal available (named tabs)' }
else { Warn 'Windows Terminal not found; apps will open in separate windows' }

if (-not $SkipDocker) {
  if (Test-DockerReady) { Ok 'Docker daemon is running' }
  else { $script:DockerDown = $true; Warn 'Docker is not installed, not running, or not responding' }
}

if (-not (Test-Path $EnvFile)) {
  $example = Join-Path $Backend '.env.example'
  if ((Test-Path $example) -and -not $Status) {
    Copy-Item $example $EnvFile
    Abort 'backend\.env was missing. Copied .env.example -> .env. Fill in the secrets and re-run.'
  }
  Bad 'backend\.env not found'
} else {
  $missing = @('MONGODB_URI', 'JWT_SECRET', 'SESSION_SECRET', 'ENCRYPTION_KEY') | Where-Object { -not (Read-EnvValue $_) }
  if ($missing) { Bad "backend\.env is missing: $($missing -join ', ')" } else { Ok 'backend\.env has all required keys' }
  if ((Read-EnvValue 'NODE_ENV' 'development') -eq 'production') {
    Warn 'NODE_ENV=production: JWT_REFRESH_SECRET (different from JWT_SECRET) and a 32+ char JWT_SECRET are required'
  }
}

Step 'Checking ports'
$busy = @{}
foreach ($p in @(
    @{ Name = 'Backend';  Port = $BackendPort },
    @{ Name = 'Frontend'; Port = $FrontendPort })) {
  if (Test-Port $p.Port) { $busy[$p.Name] = $true; Warn "$($p.Name) port :$($p.Port) is already in use (already running?)" }
  else { Ok "$($p.Name) port :$($p.Port) is free" }
}
if (Test-Mongo) { Ok 'MongoDB answers queries' } else { Warn 'MongoDB is not answering (port may be open but the server is down/hung)' }
if (Test-Port $RedisPort) { Ok "Redis reachable on :$RedisPort" } else { Warn "Redis not reachable on :$RedisPort yet" }

# --- Status only ------------------------------------------------------------
if ($Status) {
  Step 'Service health'
  foreach ($u in @(
      @{ L = 'Backend API'; U = "http://localhost:$BackendPort/api/health" },
      @{ L = 'Frontend';    U = "http://localhost:$FrontendPort" })) {
    try { $r = Invoke-WebRequest -Uri $u.U -UseBasicParsing -TimeoutSec 3; Ok "$($u.L) up ($($r.StatusCode))" }
    catch { Warn "$($u.L) not responding at $($u.U)" }
  }
  if (-not $script:DockerDown) { Step 'Containers'; docker ps --filter "name=mmg-" --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}" }
  exit 0
}

if ($script:Problems.Count -gt 0) {
  Write-Host "`nFix the problems above and re-run:" -ForegroundColor Red
  $script:Problems | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  exit 1
}

# --- Containers -------------------------------------------------------------
# MongoDB + Redis already serving (e.g. containers left running)? Then Docker itself is not needed.
if (-not $SkipDocker -and $script:DockerDown -and (Test-Mongo) -and (Test-Port $RedisPort)) {
  Warn 'Docker CLI is not responding, but MongoDB and Redis are already up; using them as-is.'
  $SkipDocker = [switch]$true
}

if (-not $SkipDocker -and $script:DockerDown) {
  # Try to launch Docker Desktop ourselves and wait for the engine (up to ~3 minutes).
  $dd = @("$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe", "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe", "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($dd) {
    Step 'Starting Docker Desktop and waiting for the engine'
    if (-not (Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue)) { Start-Process $dd }
    $deadline = (Get-Date).AddSeconds(180)
    while ((Get-Date) -lt $deadline) {
      if (Test-DockerReady) { $script:DockerDown = $false; Ok 'Docker engine is running'; break }
      Write-Host '  ...waiting for Docker' -ForegroundColor DarkGray
      Start-Sleep -Seconds 5
    }
  }
}

if (-not $SkipDocker -and $script:DockerDown) {
  if ((Test-Mongo) -and (Test-Port $RedisPort)) {
    Warn 'Docker unavailable, but MongoDB and Redis are already reachable; using them as-is.'
    $SkipDocker = [switch]$true
  } else {
    Abort 'Docker is unavailable and MongoDB is not answering. Restart Docker Desktop (quit it fully, reopen, wait for "Engine running"), or run your own MongoDB and use -SkipDocker.'
  }
}

if (-not $SkipDocker) {
  Step 'Starting containers (MongoDB, Redis)'
  $services = @('mongodb', 'mongodb-rs-init', 'redis')
  if ($MongoExpress) { $services += 'mongo-express' }
  Push-Location $Root
  docker compose up -d @services
  $code = $LASTEXITCODE
  Pop-Location
  if ($code -ne 0) { Abort 'docker compose failed to start the containers.' }
  [void](Wait-Mongo 'MongoDB' 90)
  [void](Wait-Port $RedisPort 'Redis' 30)
  if ($script:Problems.Count -gt 0) { Abort 'Containers are not healthy; see above. Try: docker compose logs mongodb' }
}

# --- Dependencies -----------------------------------------------------------
function Ensure-Deps($dir, $name) {
  if ($Install -or -not (Test-Path (Join-Path $dir 'node_modules'))) {
    Step "Installing $name dependencies"
    Push-Location $dir
    npm install
    $c = $LASTEXITCODE
    Pop-Location
    if ($c -ne 0) { Abort "npm install failed for $name." }
  } else { Ok "$name dependencies present" }
}
Step 'Checking dependencies'
Ensure-Deps $Backend 'backend'

if ($Test) {
  Step 'Running backend tests'
  Push-Location $Backend
  npm test
  $code = $LASTEXITCODE
  Pop-Location
  exit $code
}

if ($ResetDb) {
  Step 'Resetting local database (drop -> migrate -> seed)'
  Push-Location $Backend
  node scripts/reset_and_seed_local.mjs --yes
  $c = $LASTEXITCODE
  Pop-Location
  if ($c -ne 0) { Abort 'Database reset failed; see output above.' }
}

Ensure-Deps $Frontend 'frontend'
if ($Mobile) { Ensure-Deps $MobileDir 'mobile' }

if (-not (Test-Mongo)) {
  Abort 'MongoDB is not answering queries, so the backend cannot start. Fix MongoDB (or MONGODB_URI in backend\.env) and re-run.'
}

# --- Launch apps: one Windows Terminal window, one named tab each -----------
$apps = @()
if (-not $busy['Backend'])  { $apps += @{ Title = 'Backend';  Dir = $Backend;  Cmd = 'npm run dev' } }
if (-not $busy['Frontend']) { $apps += @{ Title = 'Frontend'; Dir = $Frontend; Cmd = 'npm start' } }
if ($Mobile)                { $apps += @{ Title = 'Mobile';   Dir = $MobileDir; Cmd = 'npm start' } }

if ($apps.Count -eq 0) {
  Warn 'Backend and frontend are already running; nothing to start.'
} elseif (Get-Command wt -ErrorAction SilentlyContinue) {
  Step 'Opening Windows Terminal with one tab per app'
  $tabs = foreach ($a in $apps) {
    "new-tab --title `"$($a.Title)`" --suppressApplicationTitle -d `"$($a.Dir)`" powershell -NoExit -Command `"$($a.Cmd)`""
  }
  Start-Process wt -ArgumentList ($tabs -join ' ; ')
} else {
  Step 'Opening separate windows (Windows Terminal not found)'
  foreach ($a in $apps) {
    Start-Process powershell -ArgumentList '-NoExit', '-Command',
      "`$Host.UI.RawUI.WindowTitle='$($a.Title)'; Set-Location '$($a.Dir)'; $($a.Cmd)"
  }
}

# --- Post-launch health check -----------------------------------------------
Step 'Waiting for apps to become healthy'
[void](Wait-Http "http://localhost:$BackendPort/api/health" 'Backend API' 90)
[void](Wait-Http "http://localhost:$FrontendPort" 'Frontend' 90)

Write-Host "`n------------------------------------------------------------" -ForegroundColor DarkGray
if ($script:Problems.Count -eq 0) { Write-Host ' Everything is up.' -ForegroundColor Green }
else {
  Write-Host ' Some services are not healthy - check their tabs for errors:' -ForegroundColor Red
  $script:Problems | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
}
Write-Host " Frontend : http://localhost:$FrontendPort"
Write-Host " Backend  : http://localhost:$BackendPort/api/health"
Write-Host " MongoDB  : mongodb://127.0.0.1:$MongoPort   Redis: 127.0.0.1:$RedisPort"
if ($MongoExpress) { Write-Host " Mongo UI : http://localhost:$ExpressPort" }
if (-not $SkipDocker) { Write-Host ' Stop containers: .\run-local.ps1 -Stop' -ForegroundColor DarkGray }
Write-Host ' Close a terminal tab to stop that app.' -ForegroundColor DarkGray
