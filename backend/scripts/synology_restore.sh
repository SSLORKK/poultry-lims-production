#!/bin/bash
# =============================================================================
# LIMS Database Restore Script for Synology NAS
# =============================================================================
# This script restores the PostgreSQL database from a backup file
# 
# Usage: ./synology_restore.sh /path/to/backup.sql.gz
# =============================================================================

# Configuration
CONTAINER_NAME="lims_db"
DB_USER="lims_user"
DB_NAME="lims_db"

# Check arguments
if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file>"
    echo "Example: $0 /volume3/docker/backup/lims_db_2026-01-12_020000.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"

# Check if file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container '$CONTAINER_NAME' is not running!"
    exit 1
fi

# Confirm restore
echo "WARNING: This will OVERWRITE the current database!"
echo "Backup file: $BACKUP_FILE"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo "Starting restore..."

# Handle compressed files
if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "Decompressing backup file..."
    TEMP_FILE="/tmp/lims_restore_$(date +%s).sql"
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
    RESTORE_FILE="$TEMP_FILE"
else
    RESTORE_FILE="$BACKUP_FILE"
fi

# Copy file into container
echo "Copying backup to container..."
docker cp "$RESTORE_FILE" "$CONTAINER_NAME:/tmp/restore.sql"

# Drop and recreate database, then restore
echo "Restoring database..."
docker exec "$CONTAINER_NAME" bash -c "
    psql -U $DB_USER -d postgres -c 'DROP DATABASE IF EXISTS $DB_NAME;'
    psql -U $DB_USER -d postgres -c 'CREATE DATABASE $DB_NAME;'
    psql -U $DB_USER -d $DB_NAME < /tmp/restore.sql
    rm /tmp/restore.sql
"

# Cleanup temp file
if [ -n "$TEMP_FILE" ] && [ -f "$TEMP_FILE" ]; then
    rm "$TEMP_FILE"
fi

if [ $? -eq 0 ]; then
    echo "SUCCESS: Database restored successfully!"
else
    echo "ERROR: Restore may have failed. Please check the database."
    exit 1
fi
