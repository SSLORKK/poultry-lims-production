# Production Deployment - Potential Errors and Solutions

## Overview

This guide covers common errors you may encounter when deploying the updated Docker images to production, and how to resolve them.

---

## 🔴 Critical Errors (Must Fix Before Users Can Use System)

### 1. **Database Migration Not Applied**

**Error Message:**
```
Sample code generation failed: Unable to generate unique sample code after multiple attempts
```

**Cause:** Production data still has old unit code format (`DEPT-YY-NUM`) but code expects new format (`DEPTYY-NUM`).

**Solution:**
```bash
# Run migration script BEFORE deploying new code
cd backend
python renumber_samples.py --year 2026 --live --sync-counters
```

**Prevention:** Always run migration first, then deploy code.

---

### 2. **Counter Desynchronization**

**Error Message:**
```
Unit code already exists: PCR26-1
```

**Cause:** Counter table doesn't match actual data in samples/units tables.

**Solution:**
```bash
# Sync counters manually
python -c "
from app.core.database import SessionLocal
from app.repositories.counter_repository import CounterRepository
db = SessionLocal()
repo = CounterRepository(db)
repo.sync_sample_counter(2026)
repo.sync_unit_counter(1, 2026)  # PCR
repo.sync_unit_counter(2, 2026)  # SER
repo.sync_unit_counter(3, 2026)  # MIC
db.close()
print('Counters synced successfully')
"
```

**Prevention:** Run migration with `--sync-counters` flag.

---

### 3. **Duplicate Sample/Unit Codes**

**Error Message:**
```
IntegrityError: duplicate key value violates unique constraint "uq_sample_code"
```

**Cause:** Duplicate codes exist in database (from previous bugs or manual edits).

**Solution:**
```sql
-- Find duplicates
SELECT sample_code, COUNT(*) 
FROM samples 
WHERE year = 2026 
GROUP BY sample_code 
HAVING COUNT(*) > 1;

-- Fix by renumbering
python renumber_samples.py --year 2026 --live
```

**Prevention:** Add unique constraints to database:
```sql
ALTER TABLE samples ADD CONSTRAINT unique_sample_code UNIQUE (sample_code);
ALTER TABLE units ADD CONSTRAINT unique_unit_code UNIQUE (unit_code);
```

---

## 🟡 High Priority Errors (Users Cannot Use System)

### 4. **Database Connection Failed**

**Error Message:**
```
sqlalchemy.exc.OperationalError: could not connect to server
```

**Cause:** Database not accessible, wrong credentials, or network issue.

**Solution:**
```bash
# Check database is running
docker ps | grep postgres

# Check connection
docker exec backend_container python -c "
from app.core.database import engine
try:
    with engine.connect() as conn:
        print('Database connected successfully')
except Exception as e:
    print(f'Connection failed: {e}')
"

# Check environment variables
docker exec backend_container env | grep DATABASE_URL
```

**Prevention:** Test database connection before deployment.

---

### 5. **Missing Environment Variables**

**Error Message:**
```
KeyError: 'DATABASE_URL' or 'SECRET_KEY'
```

**Cause:** `.env` file not loaded or variables missing.

**Solution:**
```bash
# Check environment variables in container
docker exec backend_container env | grep -E "DATABASE_URL|SECRET_KEY"

# Add missing variables to .env file
echo "DATABASE_URL=postgresql://user:pass@host:5432/dbname" >> .env
echo "SECRET_KEY=your-secret-key" >> .env

# Restart container
docker-compose restart backend
```

**Prevention:** Verify all required variables in `.env` file.

---

### 6. **Port Already in Use**

**Error Message:**
```
Error starting userland proxy: listen tcp 0.0.0.0:8000: bind: address already in use
```

**Cause:** Another service using the same port.

**Solution:**
```bash
# Find what's using the port
netstat -ano | findstr :8000  # Windows
lsof -i :8000  # Linux/Mac

# Stop the conflicting service or change port
# In docker-compose.yml:
ports:
  - "8001:8000"  # Use different port
```

**Prevention:** Check port availability before deployment.

---

## 🟢 Medium Priority Errors (Partial Functionality)

### 7. **Image Pull Failed**

**Error Message:**
```
Error: image 'sslorkk/poultrylims-backend:v1.2' not found
```

**Cause:** Image not pushed to Docker Hub or wrong tag.

**Solution:**
```bash
# Build and push image
cd backend
docker build -t sslorkk/poultrylims-backend:v1.2 .
docker push sslorkk/poultrylims-backend:v1.2

# Or pull from Docker Hub
docker pull sslorkk/poultrylims-backend:v1.2
```

**Prevention:** Push images before deployment.

---

### 8. **Volume Mount Failed**

**Error Message:**
```
Error: Cannot start service backend: error while mounting volume
```

**Cause:** Volume path doesn't exist or permission denied.

**Solution:**
```bash
# Create volume directory
mkdir -p ./data/postgres

# Check permissions
ls -la ./data/postgres

# Fix permissions (Linux/Mac)
chmod 755 ./data/postgres

# Update docker-compose.yml to use absolute path
volumes:
  - /absolute/path/to/data:/var/lib/postgresql/data
```

**Prevention:** Verify volume paths exist before starting.

---

### 9. **Frontend Build Failed**

**Error Message:**
```
Error: Build failed with exit code 1
```

**Cause:** Frontend build errors, missing dependencies, or TypeScript errors.

**Solution:**
```bash
# Check build logs
docker-compose logs frontend

# Rebuild locally first
cd frontend
npm install
npm run build

# Fix any errors, then rebuild Docker image
docker build -t sslorkk/poultrylims-frontend:v1.2 .
```

**Prevention:** Test build locally before pushing.

---

### 10. **Backend Startup Failed**

**Error Message:**
```
Error: Backend service exited with code 1
```

**Cause:** Python errors, import failures, or startup script issues.

**Solution:**
```bash
# Check backend logs
docker-compose logs backend

# Check if container is running
docker ps | grep backend

# Restart backend
docker-compose restart backend

# Or rebuild
docker-compose up -d --build backend
```

**Prevention:** Test backend startup locally.

---

## 🔵 Low Priority Errors (Minor Issues)

### 11. **Counter Table Missing**

**Error Message:**
```
sqlalchemy.exc.ProgrammingError: relation "counters" does not exist
```

**Cause:** Database schema not initialized.

**Solution:**
```bash
# Run migrations
docker exec backend_container alembic upgrade head

# Or initialize database
docker exec backend_container python -c "
from app.core.database import engine
from app.models import Base
Base.metadata.create_all(bind=engine)
print('Database initialized')
"
```

**Prevention:** Run migrations as part of deployment.

---

### 12. **Memory Limit Exceeded**

**Error Message:**
```
Error: Container killed due to memory limit
```

**Cause:** Container ran out of memory.

**Solution:**
```bash
# Check memory usage
docker stats

# Increase memory limit in docker-compose.yml
services:
  backend:
    mem_limit: 2g  # Increase to 2GB
```

**Prevention:** Monitor memory usage and set appropriate limits.

---

## Pre-Deployment Checklist

Before deploying to production, verify:

### Database
- [ ] Backup created
- [ ] Migration script tested on staging
- [ ] Counters synced
- [ ] No duplicate codes
- [ ] Connection tested

### Docker Images
- [ ] Backend image built and pushed
- [ ] Frontend image built and pushed
- [ ] Correct tags used (v1.2)
- [ ] Images pull successfully

### Configuration
- [ ] Environment variables set
- [ ] Ports available
- [ ] Volumes mounted
- [ ] Secrets configured

### Testing
- [ ] Dry-run migration successful
- [ ] Sample registration works
- [ ] Unit code format correct
- [ ] Counter increments properly

---

## Deployment Procedure

### Step 1: Prepare
```bash
# Backup database
pg_dump -U username -h localhost -d poultry_lims > backup_$(date +%Y%m%d_%H%M%S).sql

# Pull new images
docker pull sslorkk/poultrylims-backend:v1.2
docker pull sslorkk/poultrylims-frontend:v1.2
```

### Step 2: Run Migration
```bash
# Dry run first
python renumber_samples.py --year 2026 --dry-run

# Live run
python renumber_samples.py --year 2026 --live --sync-counters
```

### Step 3: Deploy
```bash
# Stop services
docker-compose down

# Update docker-compose.yml with new image tags
# Then start services
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Step 4: Verify
```bash
# Check services are running
docker ps

# Test sample registration
# Check logs for errors
docker-compose logs backend | grep -i error
```

---

## Rollback Procedure

If deployment fails:

### Option 1: Restore Previous Version
```bash
# Stop services
docker-compose down

# Update docker-compose.yml to use previous image tags
# v1.2 → v1.1

# Start services
docker-compose up -d
```

### Option 2: Restore Database
```bash
# Restore from backup
psql -U username -h localhost -d poultry_lims < backup.sql
```

### Option 3: Fix and Redeploy
```bash
# Fix the issue
# Rebuild images
docker build -t sslorkk/poultrylims-backend:v1.2 ./backend
docker push sslorkk/poultrylims-backend:v1.2

# Redeploy
docker-compose up -d
```

---

## Monitoring After Deployment

### Check Logs
```bash
# Backend logs
docker-compose logs -f backend

# Frontend logs
docker-compose logs -f frontend

# Database logs
docker-compose logs -f postgres
```

### Monitor Performance
```bash
# Container stats
docker stats

# Database connections
docker exec postgres_container psql -U username -d poultry_lims -c "SELECT count(*) FROM pg_stat_activity;"

# Sample creation rate
docker-compose logs backend | grep "Sample created" | wc -l
```

### Health Checks
```bash
# Backend health
curl http://localhost:8000/health

# Frontend health
curl http://localhost:3000

# Database health
docker exec postgres_container pg_isready
```

---

## Common Error Patterns

### Pattern 1: "It works on my machine"
- **Cause:** Environment differences (Python version, dependencies)
- **Fix:** Use same Docker image in all environments

### Pattern 2: "Worked yesterday, broken today"
- **Cause:** Data changes, configuration drift
- **Fix:** Use versioned configs, automated backups

### Pattern 3: "Only fails under load"
- **Cause:** Race conditions, resource limits
- **Fix:** Load testing, proper locking, monitoring

---

## Support Information

If you encounter errors not covered here:

1. **Collect logs:**
   ```bash
   docker-compose logs > deployment_logs.txt
   ```

2. **Check database state:**
   ```sql
   SELECT COUNT(*) FROM samples WHERE year = 2026;
   SELECT COUNT(*) FROM units;
   SELECT * FROM counters;
   ```

3. **Verify configuration:**
   ```bash
   docker-compose config
   ```

4. **Contact support with:**
   - Error messages
   - Logs
   - Database state
   - Configuration details

---

## Summary

| Error Type | Likelihood | Impact | Prevention |
|------------|------------|--------|------------|
| Migration not applied | High | Critical | Run migration before deploy |
| Counter desync | Medium | Critical | Sync counters regularly |
| Duplicate codes | Low | Critical | Add unique constraints |
| DB connection failed | Low | High | Test connection first |
| Missing env vars | Medium | High | Verify .env file |
| Port conflicts | Low | Medium | Check ports first |
| Image pull failed | Low | Medium | Push images first |
| Volume mount failed | Low | Medium | Verify paths exist |
| Build failed | Low | Medium | Test build locally |
| Startup failed | Low | Medium | Test startup locally |

**Most Critical:** Always run migration BEFORE deploying new code!
