# ==============================================================================
# Manage-My-Gate: Automated Docker Build & Push Script
# Default tag: prd1.0
# ==============================================================================
param(
    [string]$Tag = "prd1.0",
    [string]$Registry = "atocash",
    [switch]$SkipPush
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Manage-My-Gate: Build & Push Docker Images to Docker Hub" -ForegroundColor Cyan
Write-Host "  Target Registry: $Registry" -ForegroundColor Cyan
Write-Host "  Target Image Tag: $Tag" -ForegroundColor Cyan
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

# 2. Build Backend Image
Write-Host "`n[2/4] Building Backend Image ($Registry/manage-my-gate-server:$Tag)..." -ForegroundColor Yellow
docker build `
  -t "${Registry}/manage-my-gate-server:${Tag}" `
  -t "${Registry}/manage-my-gate-server:latest" `
  ./backend
if ($LASTEXITCODE -ne 0) {
    Write-Error "Backend Docker build failed!"
    exit 1
}
Write-Host "Backend image built successfully." -ForegroundColor Green

# 3. Build Frontend Image
Write-Host "`n[3/4] Building Frontend Image ($Registry/manage-my-gate-client:$Tag)..." -ForegroundColor Yellow
docker build `
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
Write-Host "Frontend image built successfully." -ForegroundColor Green

# 4. Push Images to Docker Hub
if ($SkipPush) {
    Write-Host "`n[4/4] Skipping push step (-SkipPush flag specified)." -ForegroundColor Yellow
} else {
    Write-Host "`n[4/4] Pushing images to Docker Hub..." -ForegroundColor Yellow

    Write-Host "Pushing ${Registry}/manage-my-gate-server:${Tag}..." -ForegroundColor Cyan
    docker push "${Registry}/manage-my-gate-server:${Tag}"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Pushing backend image failed! Please run 'docker login' and try again."
        exit 1
    }

    Write-Host "Pushing ${Registry}/manage-my-gate-client:${Tag}..." -ForegroundColor Cyan
    docker push "${Registry}/manage-my-gate-client:${Tag}"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Pushing frontend image failed! Please run 'docker login' and try again."
        exit 1
    }
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "  SUCCESS: Docker images prepared for production!        " -ForegroundColor Green
Write-Host "  - Backend:  ${Registry}/manage-my-gate-server:${Tag}   " -ForegroundColor Green
Write-Host "  - Frontend: ${Registry}/manage-my-gate-client:${Tag}   " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
