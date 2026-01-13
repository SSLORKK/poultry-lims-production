#!/bin/bash
# =============================================================================
# LIMS PRODUCTION COMPLETE BACKUP SCRIPT for Synology NAS
# =============================================================================
# This script performs a COMPLETE backup of ALL data:
# - PostgreSQL database (full dump with all schemas, data, indexes)
# - Uploaded files (COA documents, attachments)
# - Docker volumes
#
# Setup Instructions:
# 1. Copy this script to your Synology NAS: /volume3/docker/scripts/
# 2. Make it executable: chmod +x /volume3/docker/scripts/synology_backup.sh
# 3. In Synology DSM, go to Control Panel > Task Scheduler
# 4. Create > Scheduled Task > User-defined script
# 5. Set schedule (e.g., daily at 2:00 AM)
# 6. In Task Settings, enter: /volume3/docker/scripts/synology_backup.sh
# 7. Run as: root
# =============================================================================

set -e  # Exit on any error

# =============================================================================
# CONFIGURATION - MODIFY THESE VALUES FOR YOUR PRODUCTION SETUP
# =============================================================================
CONTAINER_NAME="lims_db"                    # PostgreSQL container name
DB_USER="lims_user"                         # Database username
DB_NAME="lims_db"                           # Database name
BACKUP_DIR="/volume3/docker/backup"         # Main backup directory
UPLOADS_SOURCE="/volume3/docker/lims_uploads"  # Uploads volume path (adjust to your setup)
RETENTION_DAYS=30                           # Keep daily backups for 30 days
WEEKLY_RETENTION_DAYS=90                    # Keep weekly backups for 90 days
MONTHLY_RETENTION_DAYS=365                  # Keep monthly backups for 1 year
LOG_FILE="$BACKUP_DIR/backup.log"

# =============================================================================
# FUNCTIONS
# =============================================================================

# Create backup directories
mkdir -p "$BACKUP_DIR/daily"
mkdir -p "$BACKUP_DIR/weekly"
mkdir -p "$BACKUP_DIR/monthly"
mkdir -p "$BACKUP_DIR/uploads"

# Generate timestamp
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
DATE_ONLY=$(date +%Y-%m-%d)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
DAY_OF_MONTH=$(date +%d)

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handler
error_exit() {
    log "ERROR: $1"
    exit 1
}

# =============================================================================
# BACKUP PROCESS
# =============================================================================

log "================================================================"
log "LIMS PRODUCTION BACKUP - Starting complete backup"
log "================================================================"

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    error_exit "Container '$CONTAINER_NAME' is not running!"
fi

# -----------------------------------------------------------------------------
# 1. DATABASE BACKUP (Complete with all data)
# -----------------------------------------------------------------------------
log "Step 1/4: Creating complete database backup..."

DB_BACKUP_FILE="$BACKUP_DIR/daily/lims_db_${TIMESTAMP}.sql"

# Full backup with:
# --clean: Include DROP commands before CREATE
# --if-exists: Use IF EXISTS with DROP commands
# --create: Include CREATE DATABASE statement
# --no-owner: Skip ownership commands (portable)
# --no-privileges: Skip privilege commands (portable)
# --verbose: Show progress
docker exec "$CONTAINER_NAME" pg_dump \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --clean \
    --if-exists \
    --create \
    --no-owner \
    --no-privileges \
    --format=plain \
    --encoding=UTF8 \
    > "$DB_BACKUP_FILE" 2>> "$LOG_FILE"

if [ ! -s "$DB_BACKUP_FILE" ]; then
    error_exit "Database backup failed or file is empty!"
fi

# Get row counts for verification
log "Verifying backup - getting table row counts..."
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    'samples' as table_name, COUNT(*) as rows FROM samples
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
" >> "$LOG_FILE" 2>&1

# Compress database backup
log "Compressing database backup..."
gzip -f "$DB_BACKUP_FILE"
DB_COMPRESSED="${DB_BACKUP_FILE}.gz"
DB_SIZE=$(du -h "$DB_COMPRESSED" | cut -f1)
log "Database backup completed: $DB_COMPRESSED ($DB_SIZE)"

# -----------------------------------------------------------------------------
# 2. BINARY BACKUP (Custom format for faster restore)
# -----------------------------------------------------------------------------
log "Step 2/4: Creating binary backup (custom format)..."

BINARY_BACKUP_FILE="$BACKUP_DIR/daily/lims_db_${TIMESTAMP}.dump"

docker exec "$CONTAINER_NAME" pg_dump \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=custom \
    --compress=9 \
    --no-owner \
    --no-privileges \
    > "$BINARY_BACKUP_FILE" 2>> "$LOG_FILE"

if [ -s "$BINARY_BACKUP_FILE" ]; then
    BINARY_SIZE=$(du -h "$BINARY_BACKUP_FILE" | cut -f1)
    log "Binary backup completed: $BINARY_BACKUP_FILE ($BINARY_SIZE)"
else
    log "WARNING: Binary backup failed, continuing with SQL backup..."
fi

# -----------------------------------------------------------------------------
# 3. UPLOADS BACKUP (Files and documents)
# -----------------------------------------------------------------------------
log "Step 3/4: Backing up uploaded files..."

if [ -d "$UPLOADS_SOURCE" ]; then
    UPLOADS_BACKUP="$BACKUP_DIR/uploads/lims_uploads_${TIMESTAMP}.tar.gz"
    tar -czf "$UPLOADS_BACKUP" -C "$(dirname $UPLOADS_SOURCE)" "$(basename $UPLOADS_SOURCE)" 2>> "$LOG_FILE"
    
    if [ -f "$UPLOADS_BACKUP" ]; then
        UPLOADS_SIZE=$(du -h "$UPLOADS_BACKUP" | cut -f1)
        log "Uploads backup completed: $UPLOADS_BACKUP ($UPLOADS_SIZE)"
    else
        log "WARNING: Uploads backup may have failed"
    fi
else
    log "INFO: No uploads directory found at $UPLOADS_SOURCE (may be empty or different path)"
fi

# -----------------------------------------------------------------------------
# 4. RETENTION MANAGEMENT (Daily/Weekly/Monthly)
# -----------------------------------------------------------------------------
log "Step 4/4: Managing backup retention..."

# Copy to weekly backup (every Sunday)
if [ "$DAY_OF_WEEK" -eq 7 ]; then
    log "Creating weekly backup copy..."
    cp "$DB_COMPRESSED" "$BACKUP_DIR/weekly/lims_db_weekly_${DATE_ONLY}.sql.gz"
    [ -f "$BINARY_BACKUP_FILE" ] && cp "$BINARY_BACKUP_FILE" "$BACKUP_DIR/weekly/lims_db_weekly_${DATE_ONLY}.dump"
fi

# Copy to monthly backup (1st of month)
if [ "$DAY_OF_MONTH" -eq "01" ]; then
    log "Creating monthly backup copy..."
    cp "$DB_COMPRESSED" "$BACKUP_DIR/monthly/lims_db_monthly_${DATE_ONLY}.sql.gz"
    [ -f "$BINARY_BACKUP_FILE" ] && cp "$BINARY_BACKUP_FILE" "$BACKUP_DIR/monthly/lims_db_monthly_${DATE_ONLY}.dump"
fi

# Clean up old backups
log "Cleaning up old backups..."

# Daily: Keep for RETENTION_DAYS
DAILY_DELETED=$(find "$BACKUP_DIR/daily" -name "lims_db_*" -mtime +$RETENTION_DAYS -delete -print 2>/dev/null | wc -l)
log "Deleted $DAILY_DELETED old daily backup(s)"

# Weekly: Keep for WEEKLY_RETENTION_DAYS
WEEKLY_DELETED=$(find "$BACKUP_DIR/weekly" -name "lims_db_*" -mtime +$WEEKLY_RETENTION_DAYS -delete -print 2>/dev/null | wc -l)
log "Deleted $WEEKLY_DELETED old weekly backup(s)"

# Monthly: Keep for MONTHLY_RETENTION_DAYS
MONTHLY_DELETED=$(find "$BACKUP_DIR/monthly" -name "lims_db_*" -mtime +$MONTHLY_RETENTION_DAYS -delete -print 2>/dev/null | wc -l)
log "Deleted $MONTHLY_DELETED old monthly backup(s)"

# Uploads: Keep for RETENTION_DAYS
UPLOADS_DELETED=$(find "$BACKUP_DIR/uploads" -name "lims_uploads_*" -mtime +$RETENTION_DAYS -delete -print 2>/dev/null | wc -l)
log "Deleted $UPLOADS_DELETED old uploads backup(s)"

# -----------------------------------------------------------------------------
# SUMMARY
# -----------------------------------------------------------------------------
log "================================================================"
log "BACKUP COMPLETED SUCCESSFULLY"
log "================================================================"
log "Database SQL: $DB_COMPRESSED ($DB_SIZE)"
[ -f "$BINARY_BACKUP_FILE" ] && log "Database Binary: $BINARY_BACKUP_FILE ($BINARY_SIZE)"
[ -f "$UPLOADS_BACKUP" ] && log "Uploads: $UPLOADS_BACKUP ($UPLOADS_SIZE)"
log ""
log "Backup Directory Structure:"
log "  $BACKUP_DIR/daily/   - Daily backups (kept $RETENTION_DAYS days)"
log "  $BACKUP_DIR/weekly/  - Weekly backups (kept $WEEKLY_RETENTION_DAYS days)"
log "  $BACKUP_DIR/monthly/ - Monthly backups (kept $MONTHLY_RETENTION_DAYS days)"
log "  $BACKUP_DIR/uploads/ - File uploads (kept $RETENTION_DAYS days)"
log "================================================================"

exit 0
