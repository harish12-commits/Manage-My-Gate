# ==============================================================================
# Nahom (Manage-My-Gate): Automated Docker Build & Push Script
# Default Image: nahom:prd1.0
# ==============================================================================
param(
    [string]$ImageName = "nahom",
    [string]$Tag = "prd1.0",
    [string]$Registry = "atocash",
    [switch]$SkipPush
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Nahom: Build & Tag Production Docker Images" -ForegroundColor Cyan
Write-Host "  Primary Image: ${ImageName}:${Tag}" -ForegroundColor Cyan
Write-Host "  Registry Image: ${Registry}/manage-my-gate-server:${Tag}" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verify Docker Engine
Write-Host "`n[1/4] Checking Docker daemon status..." -ForegroundColor Yellow
$dockerReady = $false
try {
    $null = docker version
    $dockerReady = $true
} catch {
    $dockerReady = $false
}

if (-not $dockerReady) {
    Write-Host "Docker daemon is not running. Launching Docker Desktop..." -ForegroundColor Yellow
    $dockerPath = "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
    if (Test-Path $dockerPath) {
        Start-Process $dockerPath
    } else {
        Start-Process "Docker Desktop"
    }

    Write-Host "Waiting for Docker engine to become ready..." -ForegroundColor Yellow
    $retries = 30
    while ($retries -gt 0) {
        Start-Sleep -Seconds 3
        try {
            $null = docker version 2>$null
            Write-Host "Docker daemon is online and ready!" -ForegroundColor Green
            $dockerReady = $true
            break
        } catch {
            Write-Host "." -NoNewline
        }
        $retries--
    }

    if (-not $dockerReady) {
        Write-Error "Docker Desktop failed to initialize. Please ensure Docker Desktop is running and try again."
        exit 1
    }
} else {
    Write-Host "Docker daemon is online and ready." -ForegroundColor Green
}

# Navigate to project root
Set-Location -Path $PSScriptRoot

# 2. Build Backend Image (nahom:prd1.0)
Write-Host "`n[2/4] Building Backend Image (${ImageName}:${Tag})..." -ForegroundColor Yellow
docker build `
  -t "${ImageName}:${Tag}" `
  -t "${ImageName}:latest" `
  -t "${ImageName}-backend:${Tag}" `
  -t "${Registry}/manage-my-gate-server:${Tag}" `
  -t "${Registry}/manage-my-gate-server:latest" `
  ./backend
if ($LASTEXITCODE -ne 0) {
    Write-Error "Backend Docker build failed!"
    exit 1
}
Write-Host "Backend image built successfully as ${ImageName}:${Tag}." -ForegroundColor Green

# 3. Build Frontend Image (nahom-frontend:prd1.0)
Write-Host "`n[3/4] Building Frontend Image (${ImageName}-frontend:${Tag})..." -ForegroundColor Yellow
docker build `
  -t "${ImageName}-frontend:${Tag}" `
  -t "${ImageName}-frontend:latest" `
  -t "${ImageName}-client:${Tag}" `
  -t "${Registry}/manage-my-gate-client:${Tag}" `
  -t "${Registry}/manage-my-gate-client:latest" `
  --build-arg VITE_API_URL="/api" `
  --build-arg VITE_SOCKET_URL="" `
  --build-arg VITE_GOOGLE_CLIENT_ID="610778456829-edvpd6gcav2u31jo0p2aeligfopvqfbo.apps.googleusercontent.com" `
  --build-arg VITE_MICROSOFT_CLIENT_ID="00000000-0000-0000-0000-000000000000" `
  --build-arg VITE_MICROSOFT_TENANT_ID="common" `
  ./frontend
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend Docker build failed!"
    exit 1
}
Write-Host "Frontend image built successfully as ${ImageName}-frontend:${Tag}." -ForegroundColor Green

# 4. Push Images
if ($SkipPush) {
    Write-Host "`n[4/4] Skipping push step (-SkipPush specified)." -ForegroundColor Yellow
} else {
    Write-Host "`n[4/4] Pushing images..." -ForegroundColor Yellow

    if ($Registry) {
        Write-Host "Pushing ${Registry}/manage-my-gate-server:${Tag}..." -ForegroundColor Cyan
        docker push "${Registry}/manage-my-gate-server:${Tag}"
        Write-Host "Pushing ${Registry}/manage-my-gate-client:${Tag}..." -ForegroundColor Cyan
        docker push "${Registry}/manage-my-gate-client:${Tag}"
    }

    try {
        Write-Host "Pushing ${ImageName}:${Tag}..." -ForegroundColor Cyan
        docker push "${ImageName}:${Tag}"
        Write-Host "Pushing ${ImageName}-frontend:${Tag}..." -ForegroundColor Cyan
        docker push "${ImageName}-frontend:${Tag}"
    } catch {
        Write-Host "Local tag push skipped or requires repository credentials." -ForegroundColor Yellow
    }
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "  SUCCESS: Docker production images ready!               " -ForegroundColor Green
Write-Host "  - Backend:  ${ImageName}:${Tag}                        " -ForegroundColor Green
Write-Host "  - Frontend: ${ImageName}-frontend:${Tag}               " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
