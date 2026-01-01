#!/bin/bash
# =============================================================================
# POULTRY LIMS - Database Backup Script
# =============================================================================
# Run this BEFORE any update to backup your database
# =============================================================================

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/lims_backup_$TIMESTAMP.sql"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo "========================================"
echo "POULTRY LIMS - Database Backup"
echo "========================================"
echo ""

echo "Creating backup: $BACKUP_FILE"
docker exec lims_db pg_dump -U lims_user lims_db > $BACKUP_FILE

if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h $BACKUP_FILE | cut -f1)
    echo ""
    echo "✓ Backup created successfully!"
    echo "  File: $BACKUP_FILE"
    echo "  Size: $SIZE"
    echo ""
    echo "To restore: docker exec -i lims_db psql -U lims_user lims_db < $BACKUP_FILE"
else
    echo "✗ Backup failed!"
    exit 1
fi
