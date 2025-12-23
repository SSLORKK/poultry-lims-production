# POULTRY LIMS - Deployment Guide

## Overview

This project has two deployment modes:
- **Development** (`docker-compose-dev.yml`) - For local development on your PC
- **Production** (`docker-compose.yml`) - For Synology NAS deployment

## Quick Reference

| Environment | File | Command | URL |
|-------------|------|---------|-----|
| Development | `docker-compose-dev.yml` | `docker-compose -f docker-compose-dev.yml up` | http://localhost:3000 |
| Production | `docker-compose.yml` | `docker-compose up -d` | http://192.168.55.92:3000 |

---

## Local Development (Your PC)

### Start Development Environment
```powershell
# Start all services with live reload
docker-compose -f docker-compose-dev.yml up

# Or run in background
docker-compose -f docker-compose-dev.yml up -d
```

### Stop Development Environment
```powershell
docker-compose -f docker-compose-dev.yml down
```

### Rebuild After Code Changes
```powershell
# Rebuild specific service
docker-compose -f docker-compose-dev.yml build backend
docker-compose -f docker-compose-dev.yml build frontend

# Rebuild and restart
docker-compose -f docker-compose-dev.yml up --build
```

---

## Production Deployment (Synology NAS)

### Initial Setup on Synology NAS

1. **Open Container Manager** on your Synology NAS
2. Go to **Project** section
3. Click **Create**
4. Set project name: `poultry-lims`
5. Set path: Create a folder like `/docker/poultry-lims`
6. Upload `docker-compose.yml` to that folder
7. Click **Build** to start the project

### Update Production (Push New Version)

#### Method 1: Using PowerShell Script (Recommended)
```powershell
# Deploy both backend and frontend
.\deploy-to-production.ps1

# Deploy only backend
.\deploy-to-production.ps1 -BackendOnly

# Deploy only frontend
.\deploy-to-production.ps1 -FrontendOnly
```

#### Method 2: Manual Commands
```powershell
# 1. Build images
docker build -t sslorkk/poultry-lims-backend:latest ./backend
docker build -t sslorkk/poultry-lims-frontend:latest ./frontend

# 2. Push to Docker Hub
docker push sslorkk/poultry-lims-backend:latest
docker push sslorkk/poultry-lims-frontend:latest

# 3. On Synology: Pull and restart (via Container Manager UI)
#    - Go to Project -> poultry-lims -> Action -> Build
```

---

## Synology NAS Configuration

### Network Information
- **NAS IP:** 192.168.55.92
- **LIMS URL:** http://192.168.55.92:3000
- **API URL:** http://192.168.55.92:8000/api/v1

### Ports Used
| Service | Port |
|---------|------|
| Frontend | 3000 |
| Backend API | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |

### Data Persistence
All data is stored in Docker volumes:
- `postgres_data` - Database
- `redis_data` - Cache
- `lims_uploads` - Uploaded files (COA PDFs, etc.)

---

## Development Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT WORKFLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. DEVELOP (Local PC)                                          │
│     docker-compose -f docker-compose-dev.yml up                 │
│     - Make code changes                                          │
│     - Test at http://localhost:3000                             │
│                                                                  │
│  2. BUILD & PUSH (Local PC)                                     │
│     .\deploy-to-production.ps1                                  │
│     - Builds Docker images                                       │
│     - Pushes to Docker Hub                                       │
│                                                                  │
│  3. UPDATE PRODUCTION (Synology NAS)                            │
│     Container Manager -> Project -> Build                        │
│     - Pulls latest images                                        │
│     - Restarts containers                                        │
│                                                                  │
│  4. VERIFY                                                       │
│     Access http://192.168.55.92:3000                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Docker Login Issues
```powershell
docker logout
docker login --username sslorkk
```

### View Container Logs
```powershell
# Development
docker-compose -f docker-compose-dev.yml logs -f backend
docker-compose -f docker-compose-dev.yml logs -f frontend

# On Synology via SSH
docker logs lims_backend -f
docker logs lims_frontend -f
```

### Reset Database (Development Only!)
```powershell
docker-compose -f docker-compose-dev.yml down -v
docker-compose -f docker-compose-dev.yml up
```

### Force Rebuild Images
```powershell
docker-compose -f docker-compose-dev.yml build --no-cache
```
