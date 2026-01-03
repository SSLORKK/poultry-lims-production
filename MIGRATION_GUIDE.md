# Production Data Migration Guide

## Overview

This guide explains how to apply the counter logic changes to existing production data, including:
1. Migrating unit codes from old format to new format
2. Syncing counters with actual data
3. Filling gaps in sample/unit numbering
4. Verifying data integrity

---

## Changes Applied to Code

### 1. Unit Code Format Change
- **Old format:** `DEPT-YY-NUM` (e.g., `PCR-26-1`)
- **New format:** `DEPTYY-NUM` (e.g., `PCR26-1`)

### 2. Counter Logic Fixes
- Counter decrement now sets to actual max (not just -1)
- Reservation system uses gap-filling
- Added thread-safe locking

---

## Migration Strategy

### Option A: Use Renumbering Script (Recommended)

The `renumber_samples.py` script handles all migrations automatically.

#### Step 1: Backup Database
```bash
# PostgreSQL backup
pg_dump -U username -h localhost -d poultry_lims > backup_$(date +%Y%m%d_%H%M%S).sql

# Or use Docker if running in container
docker exec postgres_container pg_dump -U username poultry_lims > backup.sql
```

#### Step 2: Dry Run (Preview Changes)
```bash
cd backend
python renumber_samples.py --year 2026 --dry-run
```

This will show:
- Samples to be renumbered
- Units to be renumbered
- Any conflicts detected
- Cross-department validation results

#### Step 3: Review Dry Run Output
Check for:
- Conflicts between departments
- Unexpected renumbering
- Correct format changes (DEPT-YY-NUM → DEPTYY-NUM)

#### Step 4: Live Run (Apply Changes)
```bash
python renumber_samples.py --year 2026 --live --sync-counters
```

This will:
- Renumber samples sequentially
- Renumber units per department
- Update unit codes to new format
- Sync counters with actual data
- Track all changes in edit history

#### Step 5: Verify Results
```sql
-- Check sample codes are sequential
SELECT sample_code 
FROM samples 
WHERE year = 2026 
ORDER BY sample_code;

-- Check unit codes have new format
SELECT unit_code 
FROM units 
WHERE unit_code LIKE '%-%-%'  -- Should return 0 (old format)
  AND sample_id IN (SELECT id FROM samples WHERE year = 2026);

-- Check unit codes per department
SELECT department_id, COUNT(*), MIN(unit_code), MAX(unit_code)
FROM units u
JOIN samples s ON u.sample_id = s.id
WHERE s.year = 2026
GROUP BY department_id;
```

---

### Option B: Manual SQL Migration

If you prefer manual control, use these SQL scripts.

#### Step 1: Backup (Required!)
```sql
-- Create backup tables
CREATE TABLE samples_backup AS SELECT * FROM samples;
CREATE TABLE units_backup AS SELECT * FROM units;
CREATE TABLE counters_backup AS SELECT * FROM counters;
```

#### Step 2: Migrate Unit Codes to New Format
```sql
-- Update unit codes from DEPT-YY-NUM to DEPTYY-NUM
UPDATE units u
SET unit_code = 
    CASE 
        -- New format: DEPTYY-NUM (e.g., PCR26-1)
        WHEN u.unit_code ~ '^[A-Z]{3}-\d{2}-\d+$' THEN
            SUBSTRING(u.unit_code FROM 1 FOR 3) || 
            SUBSTRING(u.unit_code FROM 5 FOR 2) || '-' ||
            SUBSTRING(u.unit_code FROM 8)
        -- Already new format: DEPTYY-NUM
        WHEN u.unit_code ~ '^[A-Z]{3}\d{2}-\d+$' THEN u.unit_code
        -- Oldest format: DEPT-NUM (no year)
        WHEN u.unit_code ~ '^[A-Z]{3}-\d+$' THEN
            SUBSTRING(u.unit_code FROM 1 FOR 3) || 
            EXTRACT(YEAR FROM CURRENT_DATE)::text::substring(3,2) || '-' ||
            SUBSTRING(u.unit_code FROM 5)
        ELSE u.unit_code
    END
WHERE EXISTS (
    SELECT 1 FROM samples s 
    WHERE s.id = u.sample_id AND s.year = 2026
);

-- Verify migration
SELECT unit_code 
FROM units 
WHERE sample_id IN (SELECT id FROM samples WHERE year = 2026)
  AND unit_code LIKE '%-%-%';  -- Should return 0
```

#### Step 3: Sync Counters
```sql
-- Sync sample counter
UPDATE counters c
SET current_value = (
    SELECT MAX(CAST(SPLIT_PART(sample_code, '-', 2) AS INTEGER))
    FROM samples
    WHERE year = c.year AND sample_code LIKE 'SMP%'
)
WHERE counter_type = 'sample' AND department_id IS NULL;

-- Sync unit counters per department
UPDATE counters c
SET current_value = (
    SELECT MAX(
        CASE 
            WHEN u.unit_code ~ '^[A-Z]{3}\d{2}-\d+$' THEN 
                CAST(SPLIT_PART(u.unit_code, '-', 2) AS INTEGER)
            WHEN u.unit_code ~ '^[A-Z]{3}-\d{2}-\d+$' THEN 
                CAST(SPLIT_PART(u.unit_code, '-', 3) AS INTEGER)
            ELSE 0
        END
    )
    FROM units u
    WHERE u.department_id = c.department_id
      AND EXISTS (
          SELECT 1 FROM samples s 
          WHERE s.id = u.sample_id AND s.year = c.year
      )
)
WHERE counter_type = 'unit';
```

#### Step 4: Fill Gaps (Optional)
Use the renumbering script for this, as manual gap-filling is complex.

---

## Verification Checklist

After migration, verify:

### Sample Codes
- [ ] All sample codes follow `SMPYY-NUM` format
- [ ] Sample codes are sequential for each year
- [ ] No gaps in numbering (or gaps are intentional)
- [ ] Sample codes in edit history are preserved

### Unit Codes
- [ ] All unit codes follow `DEPTYY-NUM` format
- [ ] Unit codes are sequential per department per year
- [ ] No cross-department conflicts
- [ ] Old format codes no longer exist

### Counters
- [ ] Sample counter equals highest sample number
- [ ] Unit counters equal highest unit number per department
- [ ] Counter year matches sample/year

### Data Integrity
- [ ] All samples have valid units
- [ ] No orphaned units (units without samples)
- [ ] Edit history shows all changes
- [ ] No duplicate sample codes
- [ ] No duplicate unit codes

---

## Rollback Plan

If something goes wrong:

### Option A: Restore from Backup
```bash
# PostgreSQL restore
psql -U username -h localhost -d poultry_lims < backup.sql

# Or using Docker
docker exec -i postgres_container psql -U username poultry_lims < backup.sql
```

### Option B: Restore Backup Tables
```sql
-- Restore from backup tables
TRUNCATE samples CASCADE;
INSERT INTO samples SELECT * FROM samples_backup;

TRUNCATE units CASCADE;
INSERT INTO units SELECT * FROM units_backup;

TRUNCATE counters CASCADE;
INSERT INTO counters SELECT * FROM counters_backup;
```

---

## Post-Migration Steps

### 1. Update Application
Rebuild and deploy the updated backend:
```bash
docker build -t sslorkk/poultrylims-backend:v1.2 ./backend
docker push sslorkk/poultrylims-backend:v1.2
```

### 2. Restart Services
```bash
docker-compose down
docker-compose up -d
```

### 3. Monitor Logs
Check for any errors:
```bash
docker-compose logs -f backend
```

### 4. Test Registration
- Create a new sample
- Verify sample code format
- Verify unit code format
- Check that counters increment correctly

### 5. Run Counter Sync (Optional)
To ensure counters are fully synced:
```bash
python -c "
from app.core.database import SessionLocal
from app.repositories.counter_repository import CounterRepository
db = SessionLocal()
repo = CounterRepository(db)
repo.sync_sample_counter(2026)
# Sync for each department
repo.sync_unit_counter(1, 2026)  # PCR
repo.sync_unit_counter(2, 2026)  # SER
repo.sync_unit_counter(3, 2026)  # MIC
db.close()
"
```

---

## Common Issues and Solutions

### Issue: Duplicate sample codes after migration
**Solution:** Run the renumbering script to fix duplicates

### Issue: Unit codes still in old format
**Solution:** Check if migration was applied to the correct year

### Issue: Counter values don't match actual data
**Solution:** Run `sync_sample_counter()` and `sync_unit_counter()` manually

### Issue: Edit history shows old codes
**Solution:** This is expected - edit history preserves original values

### Issue: Performance issues during migration
**Solution:** Run migration during low-traffic hours, consider batching

---

## Timeline Estimate

| Step | Time Estimate |
|------|---------------|
| Backup | 5-10 minutes |
| Dry Run | 5-15 minutes (depends on data size) |
| Review | 10-30 minutes |
| Live Run | 15-60 minutes (depends on data size) |
| Verification | 15-30 minutes |
| **Total** | **50-145 minutes** |

---

## Support

If you encounter issues:
1. Check logs: `docker-compose logs backend`
2. Verify backup exists
3. Run rollback if needed
4. Contact support with error details

---

## Notes

- Migration is idempotent - can be run multiple times safely
- Always backup before running live migration
- Test on staging environment first if available
- Schedule migration during maintenance window
- Notify users of potential downtime
