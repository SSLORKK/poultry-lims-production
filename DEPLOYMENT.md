# POULTRY LIMS - Deployment Guide

## 🚨 IMPORTANT RULES

### ✅ SAFE Commands (Data Preserved)
```bash
docker-compose -f docker-compose-hub.yml down      # Stops containers, keeps data
docker-compose -f docker-compose-hub.yml pull      # Downloads new images
docker-compose -f docker-compose-hub.yml up -d     # Starts containers
```

### ❌ DANGEROUS Commands (Data DELETED)
```bash
docker-compose -f docker-compose-hub.yml down -v   # DELETES ALL DATA!
docker volume rm poultrylims_postgres_data         # DELETES DATABASE!
docker system prune -a --volumes                   # DELETES EVERYTHING!
```

---

## 📋 Standard Update Workflow

### Step 1: Backup Database (ALWAYS do this first!)
```bash
./scripts/backup-database.sh
# OR manually:
docker exec lims_db pg_dump -U lims_user lims_db > backup_$(date +%Y%m%d).sql
```

### Step 2: Pull New Images
```bash
docker-compose -f docker-compose-hub.yml pull
```

### Step 3: Restart Containers
```bash
docker-compose -f docker-compose-hub.yml down
docker-compose -f docker-compose-hub.yml up -d
```

### Step 4: Verify
```bash
docker-compose -f docker-compose-hub.yml ps
docker logs lims_backend --tail 20
```

---

## 🔧 Troubleshooting

### 502 Bad Gateway Error
**Cause**: Frontend can't reach backend via Docker network

**Fix**:
```bash
# Check if containers can communicate
docker exec lims_frontend ping backend -c 2

# If ping fails, restart with network cleanup
docker-compose -f docker-compose-hub.yml down
docker network prune -f
docker-compose -f docker-compose-hub.yml up -d
```

### Database Connection Error
**Cause**: Backend can't connect to PostgreSQL

**Fix**:
```bash
# Check database logs
docker logs lims_db --tail 50

# Check if database is healthy
docker exec lims_db pg_isready -U lims_user -d lims_db
```

### Images Not Updating
**Cause**: Docker using cached images

**Fix**:
```bash
docker-compose -f docker-compose-hub.yml pull
docker-compose -f docker-compose-hub.yml up -d --force-recreate
```

---

## 🔄 Quick Reference

| Action | Command |
|--------|---------|
| Update (safe) | `./scripts/update-production.sh` |
| Backup DB | `./scripts/backup-database.sh` |
| View logs | `docker logs lims_backend -f` |
| Check status | `docker-compose -f docker-compose-hub.yml ps` |
| Restart all | `docker-compose -f docker-compose-hub.yml restart` |

---

## 📦 Version Info

- **Current Version**: v1.2
- **Docker Hub**: 
  - `sslorkk/poultrylims-frontend:v1.2`
  - `sslorkk/poultrylims-backend:v1.2`
