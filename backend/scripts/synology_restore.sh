#!/bin/bash
# =============================================================================
# LIMS PRODUCTION RESTORE SCRIPT for Synology NAS
# =============================================================================
# This script restores the PostgreSQL database from a backup file
# Supports both SQL (.sql.gz) and binary (.dump) backup formats
# 
# Usage: 
#   ./synology_restore.sh /path/to/backup.sql.gz
#   ./synology_restore.sh /path/to/backup.dump
# =============================================================================

# Configuration - MODIFY THESE FOR YOUR SETUP
CONTAINER_NAME="lims_db"
DB_USER="lims_user"
DB_NAME="lims_db"
BACKUP_DIR="/volume3/docker/backup"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

error_exit() {
    echo -e "${RED}ERROR: $1${NC}"
    exit 1
}

# Show available backups if no argument provided
if [ -z "$1" ]; then
    echo "=============================================="
    echo "LIMS Database Restore Tool"
    echo "=============================================="
    echo ""
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    echo ""
    echo "--- DAILY BACKUPS ---"
    ls -lh "$BACKUP_DIR/daily/"*.sql.gz 2>/dev/null | tail -10 || echo "  No daily SQL backups found"
    ls -lh "$BACKUP_DIR/daily/"*.dump 2>/dev/null | tail -5 || echo "  No daily binary backups found"
    echo ""
    echo "--- WEEKLY BACKUPS ---"
    ls -lh "$BACKUP_DIR/weekly/"*.sql.gz 2>/dev/null | tail -5 || echo "  No weekly backups found"
    echo ""
    echo "--- MONTHLY BACKUPS ---"
    ls -lh "$BACKUP_DIR/monthly/"*.sql.gz 2>/dev/null | tail -5 || echo "  No monthly backups found"
    echo ""
    echo "Examples:"
    echo "  $0 $BACKUP_DIR/daily/lims_db_2026-01-13_020000.sql.gz"
    echo "  $0 $BACKUP_DIR/daily/lims_db_2026-01-13_020000.dump"
    exit 0
fi

BACKUP_FILE="$1"

# Check if file exists
if [ ! -f "$BACKUP_FILE" ]; then
    error_exit "Backup file not found: $BACKUP_FILE"
fi

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    error_exit "Container '$CONTAINER_NAME' is not running!"
fi

# Get file info
FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
FILE_DATE=$(stat -c %y "$BACKUP_FILE" 2>/dev/null || stat -f %Sm "$BACKUP_FILE" 2>/dev/null)

echo ""
echo -e "${YELLOW}=============================================="
echo "WARNING: DATABASE RESTORE"
echo "==============================================${NC}"
echo ""
echo "This will COMPLETELY REPLACE the current database!"
echo ""
echo "Backup file: $BACKUP_FILE"
echo "File size: $FILE_SIZE"
echo "File date: $FILE_DATE"
echo ""

# Get current row counts before restore
log "Current database status:"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 'samples' as table_name, COUNT(*) as rows FROM samples
UNION ALL SELECT 'units', COUNT(*) FROM units
UNION ALL SELECT 'users', COUNT(*) FROM users
ORDER BY table_name;
" 2>/dev/null || echo "  (Could not query current database)"

echo ""
read -p "Type 'RESTORE' to confirm: " CONFIRM

if [ "$CONFIRM" != "RESTORE" ]; then
    echo "Restore cancelled."
    exit 0
fi

log "Starting restore process..."

# Determine backup type and restore accordingly
if [[ "$BACKUP_FILE" == *.dump ]]; then
    # Binary format restore (pg_restore)
    log "Detected binary backup format (.dump)"
    log "Using pg_restore for faster restore..."
    
    # Copy file into container
    docker cp "$BACKUP_FILE" "$CONTAINER_NAME:/tmp/restore.dump"
    
    # Terminate existing connections and restore
    docker exec "$CONTAINER_NAME" bash -c "
        # Terminate all connections to the database
        psql -U $DB_USER -d postgres -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();\" 2>/dev/null
        
        # Drop and recreate database
        psql -U $DB_USER -d postgres -c 'DROP DATABASE IF EXISTS $DB_NAME;'
        psql -U $DB_USER -d postgres -c 'CREATE DATABASE $DB_NAME;'
        
        # Restore using pg_restore (faster for large databases)
        pg_restore -U $DB_USER -d $DB_NAME --no-owner --no-privileges --jobs=4 /tmp/restore.dump
        
        # Cleanup
        rm /tmp/restore.dump
    "
    
elif [[ "$BACKUP_FILE" == *.gz ]]; then
    # Compressed SQL format
    log "Detected compressed SQL backup format (.sql.gz)"
    log "Decompressing and restoring..."
    
    TEMP_FILE="/tmp/lims_restore_$(date +%s).sql"
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
    
    # Copy file into container
    docker cp "$TEMP_FILE" "$CONTAINER_NAME:/tmp/restore.sql"
    rm "$TEMP_FILE"
    
    # Terminate existing connections and restore
    docker exec "$CONTAINER_NAME" bash -c "
        # Terminate all connections to the database
        psql -U $DB_USER -d postgres -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();\" 2>/dev/null
        
        # Drop and recreate database
        psql -U $DB_USER -d postgres -c 'DROP DATABASE IF EXISTS $DB_NAME;'
        psql -U $DB_USER -d postgres -c 'CREATE DATABASE $DB_NAME;'
        
        # Restore from SQL
        psql -U $DB_USER -d $DB_NAME < /tmp/restore.sql
        
        # Cleanup
        rm /tmp/restore.sql
    "
    
elif [[ "$BACKUP_FILE" == *.sql ]]; then
    # Plain SQL format
    log "Detected plain SQL backup format (.sql)"
    
    docker cp "$BACKUP_FILE" "$CONTAINER_NAME:/tmp/restore.sql"
    
    docker exec "$CONTAINER_NAME" bash -c "
        psql -U $DB_USER -d postgres -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();\" 2>/dev/null
        psql -U $DB_USER -d postgres -c 'DROP DATABASE IF EXISTS $DB_NAME;'
        psql -U $DB_USER -d postgres -c 'CREATE DATABASE $DB_NAME;'
        psql -U $DB_USER -d $DB_NAME < /tmp/restore.sql
        rm /tmp/restore.sql
    "
else
    error_exit "Unknown backup format. Supported: .sql, .sql.gz, .dump"
fi

# Verify restore
if [ $? -eq 0 ]; then
    echo ""
    log "${GREEN}Restore completed! Verifying...${NC}"
    echo ""
    
    # Show row counts after restore
    log "Database status after restore:"
    docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 'samples' as table_name, COUNT(*) as rows FROM samples
UNION ALL SELECT 'units', COUNT(*) FROM units
UNION ALL SELECT 'departments', COUNT(*) FROM departments
UNION ALL SELECT 'pcr_data', COUNT(*) FROM pcr_data
UNION ALL SELECT 'serology_data', COUNT(*) FROM serology_data
UNION ALL SELECT 'microbiology_data', COUNT(*) FROM microbiology_data
UNION ALL SELECT 'pcr_coa', COUNT(*) FROM pcr_coa
UNION ALL SELECT 'serology_coa', COUNT(*) FROM serology_coa
UNION ALL SELECT 'microbiology_coa', COUNT(*) FROM microbiology_coa
UNION ALL SELECT 'users', COUNT(*) FROM users
ORDER BY table_name;
"
    
    echo ""
    echo -e "${GREEN}=============================================="
    echo "SUCCESS: Database restored successfully!"
    echo "==============================================${NC}"
    echo ""
    echo "NOTE: You may need to restart the backend container:"
    echo "  docker restart lims_backend"
else
    error_exit "Restore may have failed. Please check the database manually."
fi
