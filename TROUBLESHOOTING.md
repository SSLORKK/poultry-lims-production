# LIMS Troubleshooting Guide

## Issue: "Units by Department" Dropdown Empty in Sample Registration

### Problem
When registering a new sample, the "Units by Department" dropdown was empty and you couldn't add units.

### Root Cause
The database was not initialized with the default departments (PCR, Serology, Microbiology).

### Solution ✅
Updated `backend/init_db.py` to automatically create the three default departments when the database is initialized.

### Default Departments Created
1. **PCR** (Code: PCR)
2. **Serology** (Code: SER)
3. **Microbiology** (Code: MIC)

### How to Verify It's Fixed
1. Open your browser and go to: http://localhost:3000
2. Login with sslork/sslork634827@@##
3. Navigate to "Register Sample"
4. You should now see the dropdown: **"+ Add Unit from Department"**
5. The dropdown should contain:
   - PCR (PCR)
   - Serology (SER)
   - Microbiology (MIC)

---

## Issue: Cannot Login to Frontend

### Problem
Login page doesn't work or shows errors.

### Solution ✅
Updated Docker configuration to properly proxy API requests from frontend to backend.

### What Was Fixed
1. Added Nginx proxy configuration in `frontend/nginx.conf`
2. Configured frontend to use relative API URL (`/api/v1`)
3. Added proper container linking in `docker-compose.yml`

### How to Verify
1. Open http://localhost:3000
2. Enter username: `sslork`, password: `sslork634827@@##`
3. You should be redirected to the dashboard

---

## Common Issues & Solutions

### 1. Containers Not Starting
```bash
# Check status
docker-compose ps

# View logs
docker-compose logs

# Restart everything
docker-compose down
docker-compose up -d
```

### 2. Database Connection Issues
```bash
# Check if database is healthy
docker-compose ps

# Should show "healthy" status for lims_db
# If not, restart:
docker-compose restart db
```

### 3. Frontend Not Loading
```bash
# Rebuild frontend
docker-compose up -d --build frontend

# Check logs
docker-compose logs frontend
```

### 4. Backend API Errors
```bash
# Check backend logs
docker-compose logs backend --tail=50

# Restart backend
docker-compose restart backend
```

### 5. Need to Reset Everything
```bash
# WARNING: This deletes all data!
docker-compose down -v
docker-compose up -d --build

# This will:
# - Delete all containers
# - Delete all volumes (database data)
# - Rebuild images
# - Create fresh database with default admin and departments
```

---

## Database Management

### View Departments
Access the database:
```bash
docker-compose exec db psql -U lims_user -d lims_db
```

Then run:
```sql
SELECT * FROM departments;
```

Expected output:
```
 id |     name      | code 
----+---------------+------
  1 | PCR           | PCR
  2 | Serology      | SER
  3 | Microbiology  | MIC
```

### Add More Departments (if needed)
You can add departments through the API or directly in the database:

**Via API** (recommended):
1. Login to http://localhost:3000
2. Navigate to Settings/Controls
3. Add new department

**Via Database**:
```sql
INSERT INTO departments (name, code) VALUES ('New Department', 'NEW');
```

---

## File Changes Made

### Backend Files Modified
- `backend/init_db.py` - Added default departments creation
- `backend/requirements.txt` - Added missing packages (openpyxl, reportlab)
- `backend/Dockerfile` - Updated working directory and Python path

### Frontend Files Modified
- `frontend/nginx.conf` - Added API proxy configuration
- `frontend/Dockerfile` - Added build arguments for API URL
- `frontend/src/vite-env.d.ts` - Created TypeScript environment definitions
- `frontend/src/components/MainLayout.tsx` - Removed unused imports
- `frontend/src/features/reports/components/Reports.tsx` - Fixed null checks

### Docker Files Modified
- `docker-compose.yml` - Added frontend-backend linking and build args
- `backend/.dockerignore` - Created
- `frontend/.dockerignore` - Created
- `.dockerignore` - Created

---

## Next Steps

1. ✅ Login to the application
2. ✅ Try registering a sample with units
3. ✅ Test all three departments (PCR, Serology, Microbiology)
4. Change the admin password (Settings → User Management)
5. Add your own companies, farms, and other dropdown data in Controls

---

## Support

If you encounter any other issues:
1. Check the logs: `docker-compose logs`
2. Verify all containers are running: `docker-compose ps`
3. Try restarting: `docker-compose restart`
4. Last resort: `docker-compose down && docker-compose up -d`

---

**Last Updated**: After fixing departments initialization issue
