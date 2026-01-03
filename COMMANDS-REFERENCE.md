# POULTRY LIMS - Command Reference Guide
## Development & Production Management

---

## 📁 PROJECT PATHS

```
Local Project: C:\Users\SSLORK\Desktop\POULTRY LIMS VERSIONS\v1.2\POULTRY LIMS
NAS Project:   /volume3/docker/poultry-lims
NAS IP:        192.168.55.92
NAS User:      alihassan
```

---

## 🐳 DOCKER HUB COMMANDS

### Build Images
```powershell
# Build Backend Image
docker build --no-cache -t sslorkk/poultry-lims-backend:latest -t sslorkk/poultry-lims-backend:v1.2 -f backend/Dockerfile ./backend

# Build Frontend Image
docker build --no-cache -t sslorkk/poultry-lims-frontend:latest -t sslorkk/poultry-lims-frontend:v1.2 -f frontend/Dockerfile ./frontend
```

### Push to Docker Hub
```powershell
# Login to Docker Hub (if not logged in)
docker login

# Push Backend
docker push sslorkk/poultry-lims-backend:latest
docker push sslorkk/poultry-lims-backend:v1.2

# Push Frontend
docker push sslorkk/poultry-lims-frontend:latest
docker push sslorkk/poultry-lims-frontend:v1.2
```

### Pull from Docker Hub
```powershell
# Pull Backend
docker pull sslorkk/poultry-lims-backend:latest

# Pull Frontend
docker pull sslorkk/poultry-lims-frontend:latest
```

---

## 💾 SAVE/LOAD TAR FILES (For Offline Transfer)

### Save Images to TAR (on Windows)
```powershell
# Save Backend Image
docker save -o poultry-lims-backend.tar sslorkk/poultry-lims-backend:latest

# Save Frontend Image
docker save -o poultry-lims-frontend.tar sslorkk/poultry-lims-frontend:latest
```

### Load Images from TAR (on NAS via SSH)
```bash
cd /volume3/docker/poultry-lims
sudo docker load -i poultry-lims-backend.tar
sudo docker load -i poultry-lims-frontend.tar
```

---

## 🖥️ LOCAL DEVELOPMENT

### Start Development Environment
```powershell
# Start all containers (builds if needed)
docker-compose -f docker-compose-dev.yml up -d

# Start with rebuild
docker-compose -f docker-compose-dev.yml up -d --build

# View logs
docker-compose -f docker-compose-dev.yml logs -f

# View specific container logs
docker-compose -f docker-compose-dev.yml logs -f backend
docker-compose -f docker-compose-dev.yml logs -f frontend
```

### Stop Development Environment
```powershell
# Stop containers (keep data)
docker-compose -f docker-compose-dev.yml down

# Stop and remove volumes (DELETES DATA!)
docker-compose -f docker-compose-dev.yml down -v
```

### Access Local App
```
Frontend: http://localhost:3000
Backend:  http://localhost:8000
API Docs: http://localhost:8000/docs
```

---

## 🏭 PRODUCTION (NAS)

### SSH to NAS
```powershell
ssh alihassan@192.168.55.92
```

### Navigate to Project
```bash
cd /volume3/docker/poultry-lims
```

### Update Production (Method 1: Docker Hub Pull)
```bash
# Pull latest images
sudo docker-compose -f docker-compose.yml pull

# Restart containers
sudo docker-compose -f docker-compose.yml down
sudo docker-compose -f docker-compose.yml up -d
```

### Update Production (Method 2: TAR File Upload)
```bash
# After uploading TAR files via File Station
cd /volume3/docker/poultry-lims
sudo docker load -i poultry-lims-backend.tar
sudo docker load -i poultry-lims-frontend.tar
sudo docker-compose -f docker-compose.yml down
sudo docker-compose -f docker-compose.yml up -d
```

### View Production Logs
```bash
# View all logs
sudo docker-compose -f docker-compose.yml logs -f

# View last 50 lines of backend
sudo docker logs lims_backend --tail 50

# View last 50 lines of frontend
sudo docker logs lims_frontend --tail 50
```

### Restart Single Container
```bash
sudo docker restart lims_backend
sudo docker restart lims_frontend
sudo docker restart lims_db
```

### Access Production App
```
Frontend: http://192.168.55.92:3000
Backend:  http://192.168.55.92:8000
API Docs: http://192.168.55.92:8000/docs
```

---

## 🗄️ DATABASE COMMANDS (PostgreSQL on NAS)

### Access Database Shell
```bash
sudo docker exec -it lims_db psql -U lims_user -d lims_db
```

### Run SQL Command Directly
```bash
sudo docker exec lims_db psql -U lims_user -d lims_db -c "YOUR SQL HERE"
```

### Common Database Operations
```bash
# List all tables
sudo docker exec lims_db psql -U lims_user -d lims_db -c "\dt"

# Describe table structure
sudo docker exec lims_db psql -U lims_user -d lims_db -c "\d tablename"

# Add column to table
sudo docker exec lims_db psql -U lims_user -d lims_db -c "ALTER TABLE tablename ADD COLUMN IF NOT EXISTS columnname TYPE;"

# Backup database
sudo docker exec lims_db pg_dump -U lims_user lims_db > backup_$(date +%Y%m%d).sql

# Restore database
sudo docker exec -i lims_db psql -U lims_user -d lims_db < backup.sql
```

### Add All Missing Columns (v1.2 Schema Fix)
```bash
sudo docker exec lims_db psql -U lims_user -d lims_db -c "
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture VARCHAR;
ALTER TABLE samples ADD COLUMN IF NOT EXISTS last_edited_by VARCHAR(255);
ALTER TABLE units ADD COLUMN IF NOT EXISTS house JSON;
ALTER TABLE units ADD COLUMN IF NOT EXISTS age VARCHAR(50);
ALTER TABLE units ADD COLUMN IF NOT EXISTS source JSON;
ALTER TABLE units ADD COLUMN IF NOT EXISTS sample_type JSON;
ALTER TABLE units ADD COLUMN IF NOT EXISTS samples_number INTEGER;
ALTER TABLE units ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS coa_status VARCHAR(50);
ALTER TABLE units ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
ALTER TABLE units ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
ALTER TABLE units ADD COLUMN IF NOT EXISTS last_edited_by VARCHAR(255);
ALTER TABLE microbiology_coas ADD COLUMN IF NOT EXISTS ast_data JSON;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS company_id INTEGER;
ALTER TABLE farms ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS signature_image VARCHAR;
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
"
```

### Clear All Data (Keep Schema & Admin User)
```bash
# ⚠️ WARNING: This deletes ALL data except admin user and departments!
sudo docker exec lims_db psql -U lims_user -d lims_db -c "
TRUNCATE TABLE 
  edit_history,
  microbiology_coas,
  pcr_coa,
  serology_coas,
  microbiology_data,
  pcr_data,
  serology_data,
  units,
  samples,
  companies,
  farms,
  flocks,
  cycles,
  statuses,
  houses,
  sources,
  sample_types,
  diseases,
  kit_types,
  technicians,
  signatures,
  extraction_methods,
  culture_isolation_types,
  pathogenic_fungi_mold,
  culture_screened_pathogens,
  ast_disks,
  ast_disks_fastidious,
  ast_disks_staphylococcus,
  ast_disks_enterococcus,
  counters
RESTART IDENTITY CASCADE;
"
```

### Clear Specific Table Data
```bash
# Clear samples and related data only
sudo docker exec lims_db psql -U lims_user -d lims_db -c "
TRUNCATE TABLE units, samples RESTART IDENTITY CASCADE;
"

# Clear control data (companies, farms, etc.)
sudo docker exec lims_db psql -U lims_user -d lims_db -c "
TRUNCATE TABLE companies, farms, flocks, cycles, houses, sources RESTART IDENTITY CASCADE;
"

# Clear only Microbiology data (keep samples registered)
sudo docker exec lims_db psql -U lims_user -d lims_db -c "
DELETE FROM microbiology_data WHERE unit_id IN (SELECT id FROM units WHERE department_id = 3);
DELETE FROM microbiology_coas WHERE unit_id IN (SELECT id FROM units WHERE department_id = 3);
"

# Clear only PCR data (keep samples registered)
sudo docker exec lims_db psql -U lims_user -d lims_db -c "
DELETE FROM pcr_data WHERE unit_id IN (SELECT id FROM units WHERE department_id = 1);
DELETE FROM pcr_coa WHERE unit_id IN (SELECT id FROM units WHERE department_id = 1);
"

# Clear only Serology data (keep samples registered)
sudo docker exec lims_db psql -U lims_user -d lims_db -c "
DELETE FROM serology_data WHERE unit_id IN (SELECT id FROM units WHERE department_id = 2);
DELETE FROM serology_coas WHERE unit_id IN (SELECT id FROM units WHERE department_id = 2);
"
```

---

## 📦 GIT COMMANDS

### Daily Workflow
```powershell
# Check status
git status

# Add all changes
git add .

# Commit with message
git commit -m "Your commit message"

# Push to remote
git push origin main
```

### Create Release Tag
```powershell
# Create tag
git tag -a v1.2.1 -m "Version 1.2.1 - Description"

# Push tag
git push origin v1.2.1

# List tags
git tag -l
```

### Branch Operations
```powershell
# Create new branch
git checkout -b feature/new-feature

# Switch branch
git checkout main

# Merge branch
git merge feature/new-feature

# Delete branch
git branch -d feature/new-feature
```

---

## 🔧 TROUBLESHOOTING

### Check Container Status
```bash
# On NAS
sudo docker ps -a
sudo docker-compose -f docker-compose.yml ps
```

### View Container Resource Usage
```bash
sudo docker stats
```

### Clean Up Docker (Use Carefully!)
```powershell
# Remove unused images
docker image prune -a

# Remove unused volumes (CAREFUL - may delete data!)
docker volume prune

# Remove all stopped containers
docker container prune
```

### Fix Permission Issues on NAS
```bash
sudo chown -R alihassan:users /volume3/docker/poultry-lims
```

---

## 🚀 FULL DEPLOYMENT WORKFLOW

### 1. Make Code Changes Locally
```powershell
# Edit files...
# Test locally
docker-compose -f docker-compose-dev.yml up -d --build
```

### 2. Build & Push Docker Images
```powershell
# Build
docker build --no-cache -t sslorkk/poultry-lims-backend:latest -t sslorkk/poultry-lims-backend:v1.2 -f backend/Dockerfile ./backend
docker build --no-cache -t sslorkk/poultry-lims-frontend:latest -t sslorkk/poultry-lims-frontend:v1.2 -f frontend/Dockerfile ./frontend

# Push to Docker Hub
docker push sslorkk/poultry-lims-backend:latest
docker push sslorkk/poultry-lims-backend:v1.2
docker push sslorkk/poultry-lims-frontend:latest
docker push sslorkk/poultry-lims-frontend:v1.2
```

### 3. Save TAR Files (if NAS can't pull from Docker Hub)
```powershell
docker save -o poultry-lims-backend.tar sslorkk/poultry-lims-backend:latest
docker save -o poultry-lims-frontend.tar sslorkk/poultry-lims-frontend:latest
```

### 4. Upload to NAS
- Open File Station: http://192.168.55.92:5000
- Navigate to: /volume3/docker/poultry-lims/
- Upload: poultry-lims-backend.tar, poultry-lims-frontend.tar

### 5. Update NAS Production
```bash
ssh alihassan@192.168.55.92
cd /volume3/docker/poultry-lims
sudo docker load -i poultry-lims-backend.tar
sudo docker load -i poultry-lims-frontend.tar
sudo docker-compose -f docker-compose.yml down
sudo docker-compose -f docker-compose.yml up -d
```

### 6. Verify Deployment
```bash
sudo docker logs lims_backend --tail 20
sudo docker logs lims_frontend --tail 20
```

### 7. Commit to Git
```powershell
git add .
git commit -m "v1.2.x - Description of changes"
git push origin main
```

---

## 📋 QUICK REFERENCE

| Action | Command |
|--------|---------|
| Start Dev | `docker-compose -f docker-compose-dev.yml up -d --build` |
| Stop Dev | `docker-compose -f docker-compose-dev.yml down` |
| Build Backend | `docker build --no-cache -t sslorkk/poultry-lims-backend:latest -f backend/Dockerfile ./backend` |
| Build Frontend | `docker build --no-cache -t sslorkk/poultry-lims-frontend:latest -f frontend/Dockerfile ./frontend` |
| Save Backend TAR | `docker save -o poultry-lims-backend.tar sslorkk/poultry-lims-backend:latest` |
| Save Frontend TAR | `docker save -o poultry-lims-frontend.tar sslorkk/poultry-lims-frontend:latest` |
| SSH to NAS | `ssh alihassan@192.168.55.92` |
| Load TAR on NAS | `sudo docker load -i filename.tar` |
| Restart Backend | `sudo docker restart lims_backend` |
| View Backend Logs | `sudo docker logs lims_backend --tail 50` |
| DB Shell | `sudo docker exec -it lims_db psql -U lims_user -d lims_db` |

---

*Last Updated: January 2026*
