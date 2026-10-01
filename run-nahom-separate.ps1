<#
.SYNOPSIS
  Manage Nahom (prd1.0) Separate Stack (Option A) on host ports 5007 (API) and 3005 (Web).

.EXAMPLES
  .\run-nahom-separate.ps1 -Up       # Start the separate prd1.0 stack
  .\run-nahom-separate.ps1 -Down     # Stop the separate prd1.0 stack
  .\run-nahom-separate.ps1 -Status   # Check running container status and ports
  .\run-nahom-separate.ps1 -Logs     # Stream container logs
#>
param(
  [switch]$Up,
  [switch]$Down,
  [switch]$Status,
  [switch]$Logs
)

$ErrorActionPreference = 'Stop'
$ScriptDir = $PSScriptRoot
$ComposeFile = Join-Path $ScriptDir 'docker-compose.nahom.yml'

# Auto-detect existing docker network if mmg-network doesn't exist
$networkName = "mmg-network"
try {
    $existingNetworks = docker network ls --format "{{.Name}}"
    if ($existingNetworks -contains "mmg-network") {
        $networkName = "mmg-network"
    } elseif ($existingNetworks -contains "gatedcommunity_mmg-network") {
        $networkName = "gatedcommunity_mmg-network"
    } elseif ($existingNetworks -match "_mmg-network$") {
        $networkName = ($existingNetworks | Where-Object { $_ -match "_mmg-network$" } | Select-Object -First 1)
    }
} catch {}

$env:DOCKER_NETWORK = $networkName

if ($Down) {
    Write-Host "`nStopping Nahom (prd1.0) separate stack..." -ForegroundColor Yellow
    docker compose -f $ComposeFile down
    Write-Host "Nahom prd1.0 stack stopped." -ForegroundColor Green
    exit 0
}

if ($Logs) {
    docker compose -f $ComposeFile logs -f --tail 100
    exit 0
}

if ($Status -or (-not $Up)) {
    Write-Host "`n=== Nahom Separate Stack Status (Option A) ===" -ForegroundColor Cyan
    docker ps -a --filter "name=nahom" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
    if (-not $Up) {
        Write-Host "`nUsage: .\run-nahom-separate.ps1 -Up | -Down | -Status | -Logs" -ForegroundColor Yellow
        exit 0
    }
}

if ($Up) {
    Write-Host "`nStarting Nahom (prd1.0) on ports 5007 and 3005..." -ForegroundColor Cyan
    Write-Host "Target Docker Network: $networkName" -ForegroundColor Cyan
    docker compose -f $ComposeFile up -d
    Write-Host "`nNahom prd1.0 containers started successfully!" -ForegroundColor Green
    Write-Host "  - Backend API:  http://localhost:5007" -ForegroundColor Green
    Write-Host "  - Frontend Web: http://localhost:3005" -ForegroundColor Green
    docker ps --filter "name=nahom" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
}
