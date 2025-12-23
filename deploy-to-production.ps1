# =============================================================================
# POULTRY LIMS - Deploy to Production (Synology NAS)
# =============================================================================
# This script builds and pushes Docker images to Docker Hub, then triggers
# the Synology NAS to pull and restart the containers.
# =============================================================================

param(
    [switch]$BackendOnly,
    [switch]$FrontendOnly,
    [switch]$SkipPush,
    [switch]$Help
)

if ($Help) {
    Write-Host "
POULTRY LIMS Deployment Script
==============================

Usage: .\deploy-to-production.ps1 [options]

Options:
  -BackendOnly   Only build and deploy the backend
  -FrontendOnly  Only build and deploy the frontend
  -SkipPush      Build images but don't push to Docker Hub
  -Help          Show this help message

Examples:
  .\deploy-to-production.ps1              # Deploy both backend and frontend
  .\deploy-to-production.ps1 -BackendOnly # Deploy only backend
"
    exit 0
}

$ErrorActionPreference = "Stop"

# Configuration
$DOCKER_USERNAME = "sslorkk"
$BACKEND_IMAGE = "$DOCKER_USERNAME/poultry-lims-backend:latest"
$FRONTEND_IMAGE = "$DOCKER_USERNAME/poultry-lims-frontend:latest"
$NAS_IP = "192.168.55.92"
$NAS_USER = "alihassan"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  POULTRY LIMS - Production Deployment" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build Docker Images
Write-Host "[1/4] Building Docker images..." -ForegroundColor Yellow

if (-not $FrontendOnly) {
    Write-Host "  -> Building backend image..." -ForegroundColor Gray
    docker build -t $BACKEND_IMAGE ./backend
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Backend build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "  -> Backend image built successfully!" -ForegroundColor Green
}

if (-not $BackendOnly) {
    Write-Host "  -> Building frontend image..." -ForegroundColor Gray
    docker build -t $FRONTEND_IMAGE ./frontend
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Frontend build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "  -> Frontend image built successfully!" -ForegroundColor Green
}

if ($SkipPush) {
    Write-Host ""
    Write-Host "Skipping push (--SkipPush flag set)" -ForegroundColor Yellow
    Write-Host "Images built locally but not pushed to Docker Hub." -ForegroundColor Yellow
    exit 0
}

# Step 2: Push to Docker Hub
Write-Host ""
Write-Host "[2/4] Pushing images to Docker Hub..." -ForegroundColor Yellow

if (-not $FrontendOnly) {
    Write-Host "  -> Pushing backend image..." -ForegroundColor Gray
    docker push $BACKEND_IMAGE
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Backend push failed! Make sure you're logged in: docker login" -ForegroundColor Red
        exit 1
    }
    Write-Host "  -> Backend pushed successfully!" -ForegroundColor Green
}

if (-not $BackendOnly) {
    Write-Host "  -> Pushing frontend image..." -ForegroundColor Gray
    docker push $FRONTEND_IMAGE
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Frontend push failed! Make sure you're logged in: docker login" -ForegroundColor Red
        exit 1
    }
    Write-Host "  -> Frontend pushed successfully!" -ForegroundColor Green
}

# Step 3: Display instructions for Synology
Write-Host ""
Write-Host "[3/4] Images pushed to Docker Hub!" -ForegroundColor Green
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  NEXT STEPS - Update Synology NAS" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Option A: Via Synology Container Manager UI" -ForegroundColor Yellow
Write-Host "  1. Open Container Manager on your Synology NAS"
Write-Host "  2. Go to 'Project' section"
Write-Host "  3. Select 'poultry-lims' project"
Write-Host "  4. Click 'Action' -> 'Build'"
Write-Host "  5. This will pull latest images and restart containers"
Write-Host ""
Write-Host "Option B: Via SSH (Advanced)" -ForegroundColor Yellow
Write-Host "  1. SSH into your NAS: ssh $NAS_USER@$NAS_IP"
Write-Host "  2. Navigate to project folder"
Write-Host "  3. Run: docker-compose pull"
Write-Host "  4. Run: docker-compose up -d"
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access your LIMS at: http://$NAS_IP:3000" -ForegroundColor Cyan
Write-Host ""
