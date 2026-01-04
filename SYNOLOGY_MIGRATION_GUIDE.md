# Poultry LIMS - Synology NAS Database Migration Guide

## Overview
This guide explains how to apply new database migrations to your Synology NAS PostgreSQL database.

## Prerequisites
- SSH access to Synology NAS
- PostgreSQL installed on Synology (via Docker or native package)
- Database backup completed (recommended before migrations)

## New Migrations in This Release

### 1. Sequence-Based Counters Migration
**File:** `20250103_add_sequences_atomic_counters.py`
**Purpose:** Add atomic counter sequences for sample/unit code generation

### 2. Sequence-Based Counters V2
**File:** `20260103_add_sequence_based_counters.py`
**Purpose:** Enhanced counter system with better concurrency handling

## Migration Steps

### Option 1: Direct SSH to Synology NAS

#### Step 1: SSH into Synology NAS
```bash
ssh your_username@your_nas_ip
```

#### Step 2: Navigate to Your Project Directory
```bash
cd /volume1/docker/poultry-lims/backend  # Adjust path as needed
```

#### Step 3: Activate Python Virtual Environment
```bash
source venv/bin/activate  # Or your specific venv path
```

#### Step 4: Check Current Migration Status
```bash
alembic current
```

#### Step 5: Review Pending Migrations
```bash
alembic history
```

#### Step 6: Backup Database (Recommended)
```bash
# Using pg_dump if PostgreSQL is accessible
pg_dump -h localhost -U postgres poultry_lims > backup_$(date +%Y%m%d_%H%M%S).sql

# Or using Docker if PostgreSQL runs in container
docker exec lims_db pg_dump -U postgres poultry_lims > backup_$(date +%Y%m%d_%H%M%S).sql
```

#### Step 7: Apply All Pending Migrations
```bash
alembic upgrade head
```

#### Step 8: Verify Migration Success
```bash
alembic current
# Should show the latest revision
```

#### Step 9: Verify Database Changes
```bash
# Check if sequences were created
docker exec -it lims_db psql -U postgres -d poultry_lims -c "\ds"

# Check sequence tables
docker exec -it lims_db psql -U postgres -d poultry_lims -c "SELECT * FROM alembic_version;"
```

---

### Option 2: Using Docker Compose on Synology

#### Step 1: SSH into Synology NAS
```bash
ssh your_username@your_nas_ip
```

#### Step 2: Navigate to Docker Compose Directory
```bash
cd /volume1/docker/poultry-lims
```

#### Step 3: Stop Running Containers
```bash
docker-compose down
```

#### Step 4: Pull Latest Code
```bash
git pull origin main
```

#### Step 5: Start Database Container Only
```bash
docker-compose up -d db
```

#### Step 6: Wait for Database to Be Ready
```bash
# Wait 10-15 seconds
sleep 15
```

#### Step 7: Run Migrations Using Backend Container
```bash
# Run alembic upgrade in backend container
docker-compose run --rm backend alembic upgrade head
```

#### Step 8: Verify Migration
```bash
docker-compose run --rm backend alembic current
```

#### Step 9: Start All Services
```bash
docker-compose up -d
```

---

### Option 3: Manual SQL Execution (If Alembic Fails)

If Alembic encounters issues, you can manually execute the migration SQL:

#### Step 1: Extract SQL from Migration Files
```bash
# On your local machine
cd backend/alembic/versions
cat 20250103_add_sequences_atomic_counters.py | grep -A 100 "def upgrade():"
cat 20260103_add_sequence_based_counters.py | grep -A 100 "def upgrade():"
```

#### Step 2: Connect to Database on Synology
```bash
# SSH to Synology
ssh your_username@your_nas_ip

# Connect to PostgreSQL
docker exec -it lims_db psql -U postgres -d poultry_lims
```

#### Step 3: Execute Migration SQL
```sql
-- Update alembic version first (replace with actual revision IDs)
INSERT INTO alembic_version (version_num) VALUES ('20250103_add_sequences_atomic_counters');

-- Create sequences (example - adjust based on actual migration)
CREATE SEQUENCE IF NOT EXISTS sample_code_seq;
CREATE SEQUENCE IF NOT EXISTS unit_code_seq;

-- Update to next migration
UPDATE alembic_version SET version_num = '20260103_add_sequence_based_counters';

-- Create additional sequences/tables as needed
```

#### Step 4: Exit PostgreSQL
```sql
\q
```

---

## Verification Steps

After migration, verify the following:

### 1. Check Alembic Version
```bash
docker exec -it lims_db psql -U postgres -d poultry_lims -c "SELECT * FROM alembic_version;"
```

### 2. Verify Sequences Exist
```bash
docker exec -it lims_db psql -U postgres -d poultry_lims -c "\ds"
```

### 3. Test Sample Code Generation
```bash
# Access backend logs
docker-compose logs -f backend

# Try creating a new sample via API or web UI
# Verify sample code is generated correctly
```

### 4. Check Application Logs
```bash
docker-compose logs backend | grep -i error
docker-compose logs backend | grep -i sequence
```

---

## Troubleshooting

### Issue 1: "Database is locked" or "Migration already applied"
**Solution:** Check current version and skip if already applied
```bash
alembic current
# If shows latest version, migration is already done
```

### Issue 2: "Permission denied" on database operations
**Solution:** Ensure PostgreSQL user has proper permissions
```sql
-- In PostgreSQL
GRANT ALL PRIVILEGES ON DATABASE poultry_lims TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
```

### Issue 3: "Sequence already exists"
**Solution:** Use `IF NOT EXISTS` in SQL or drop and recreate
```sql
DROP SEQUENCE IF EXISTS sample_code_seq CASCADE;
CREATE SEQUENCE sample_code_seq START WITH 1;
```

### Issue 4: Alembic cannot find migration files
**Solution:** Ensure migration files are in the correct directory
```bash
ls -la backend/alembic/versions/
# Should see the new migration files
```

---

## Rollback Procedure

If migration causes issues, you can rollback:

### Option 1: Using Alembic
```bash
alembic downgrade -1  # Rollback one migration
alembic downgrade base  # Rollback all migrations
```

### Option 2: Restore from Backup
```bash
# Stop containers
docker-compose down

# Restore database
docker exec -i lims_db psql -U postgres poultry_lims < backup_20250104_090000.sql

# Restart containers
docker-compose up -d
```

---

## Post-Migration Checklist

- [ ] Alembic shows latest revision
- [ ] All sequences created successfully
- [ ] Sample codes generate correctly
- [ ] Unit codes generate correctly
- [ ] No errors in application logs
- [ ] Frontend can create new samples
- [ ] Frontend can create new units
- [ ] All existing data intact

---

## Quick Reference Commands

```bash
# SSH to Synology
ssh user@nas_ip

# Navigate to project
cd /volume1/docker/poultry-lims

# Check migration status
docker-compose run --rm backend alembic current

# Apply migrations
docker-compose run --rm backend alembic upgrade head

# View migration history
docker-compose run --rm backend alembic history

# Rollback one migration
docker-compose run --rm backend alembic downgrade -1

# View logs
docker-compose logs -f backend

# Restart services
docker-compose restart backend
```

---

## Support

If you encounter issues:
1. Check application logs: `docker-compose logs backend`
2. Check database logs: `docker-compose logs db`
3. Verify migration files exist in `backend/alembic/versions/`
4. Ensure PostgreSQL is running and accessible
5. Contact support with error messages and logs
