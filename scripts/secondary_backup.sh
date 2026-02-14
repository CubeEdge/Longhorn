#!/bin/zsh
# Secondary Backup Script - Runs every 72 hours
# Backs up database to Extended Storage

SOURCE_DB="/Users/admin/Documents/server/Longhorn/server/longhorn.db"
BACKUP_DIR="/Volumes/Extended Storage/LonghornBackups/db"
RETENTION_DAYS=30

# Create backup with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="longhorn_secondary_${TIMESTAMP}.db"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

echo "[$(date)] Starting secondary backup..."
echo "[$(date)] Source: ${SOURCE_DB}"
echo "[$(date)] Destination: ${BACKUP_PATH}"

# Check if source exists
if [[ ! -f "$SOURCE_DB" ]]; then
    echo "[$(date)] ERROR: Source database not found!"
    exit 1
fi

# Check if backup directory is writable
if [[ ! -w "$BACKUP_DIR" ]]; then
    echo "[$(date)] ERROR: Backup directory not writable!"
    exit 1
fi

# Perform SQLite online backup
if sqlite3 "$SOURCE_DB" ".backup '${BACKUP_PATH}'"; then
    echo "[$(date)] Backup successful: ${BACKUP_FILE}"
    
    # Get file size
    FILE_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
    echo "[$(date)] Backup size: ${FILE_SIZE}"
else
    echo "[$(date)] ERROR: Backup failed!"
    exit 1
fi

# Clean up old backups (older than 30 days)
echo "[$(date)] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "longhorn_secondary_*.db" -mtime +${RETENTION_DAYS} -delete

# Count remaining backups
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/longhorn_secondary_*.db 2>/dev/null | wc -l)
echo "[$(date)] Total backups in retention: ${BACKUP_COUNT}"
echo "[$(date)] Secondary backup completed."
