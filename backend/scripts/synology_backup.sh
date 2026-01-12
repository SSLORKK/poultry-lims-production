#!/bin/bash
# =============================================================================
# LIMS Database Backup Script for Synology NAS
# =============================================================================
# This script backs up the PostgreSQL database from a Docker container
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

# Configuration - MODIFY THESE VALUES FOR YOUR SETUP
CONTAINER_NAME="lims_db"           # Docker container name
DB_USER="lims_user"                # Database username
DB_NAME="lims_db"                  # Database name
BACKUP_DIR="/volume3/docker/backup"  # Backup directory on NAS
RETENTION_DAYS=30                  # Keep backups for this many days
LOG_FILE="/volume3/docker/backup/backup.log"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp and filename
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/lims_db_$TIMESTAMP.sql"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "========== Starting backup =========="

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    log "ERROR: Container '$CONTAINER_NAME' is not running!"
    exit 1
fi

# Perform the backup using docker exec with bash -c for proper output capture
log "Creating backup: $BACKUP_FILE"
docker exec "$CONTAINER_NAME" bash -c "pg_dump -U $DB_USER -d $DB_NAME" > "$BACKUP_FILE" 2>> "$LOG_FILE"

# Check if backup was successful
if [ $? -eq 0 ] && [ -s "$BACKUP_FILE" ]; then
    FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log "SUCCESS: Backup created successfully ($FILESIZE)"
    
    # Compress the backup
    gzip "$BACKUP_FILE"
    if [ -f "${BACKUP_FILE}.gz" ]; then
        COMPRESSED_SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
        log "Compressed backup: ${BACKUP_FILE}.gz ($COMPRESSED_SIZE)"
    fi
    
    # Delete old backups
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    DELETED_COUNT=$(find "$BACKUP_DIR" -name "lims_db_*.sql*" -mtime +$RETENTION_DAYS -delete -print | wc -l)
    log "Deleted $DELETED_COUNT old backup(s)"
else
    log "ERROR: Backup failed or file is empty!"
    rm -f "$BACKUP_FILE"
    exit 1
fi

log "========== Backup complete =========="
