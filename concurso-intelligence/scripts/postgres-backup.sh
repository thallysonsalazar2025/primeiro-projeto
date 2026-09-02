#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

BACKUP_INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_ONESHOT="${BACKUP_ONESHOT:-false}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"

case "$BACKUP_INTERVAL_SECONDS" in
  ''|*[!0-9]*) echo "BACKUP_INTERVAL_SECONDS must be a positive integer" >&2; exit 1 ;;
esac
case "$BACKUP_RETENTION_DAYS" in
  ''|*[!0-9]*) echo "BACKUP_RETENTION_DAYS must be a non-negative integer" >&2; exit 1 ;;
esac
[ "$BACKUP_INTERVAL_SECONDS" -gt 0 ] || { echo "BACKUP_INTERVAL_SECONDS must be greater than zero" >&2; exit 1; }

mkdir -p "$BACKUP_DIR"

run_backup() {
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  final_path="$BACKUP_DIR/concurso-intelligence-$timestamp.dump"
  temp_path="$final_path.tmp"

  echo "[$(date -u +%FT%TZ)] starting PostgreSQL backup"
  rm -f "$temp_path"

  if pg_dump \
    --dbname="$DATABASE_URL" \
    --format=custom \
    --no-owner \
    --no-privileges \
    --file="$temp_path"; then
    mv "$temp_path" "$final_path"
    echo "[$(date -u +%FT%TZ)] backup created: $final_path"
  else
    rm -f "$temp_path"
    echo "[$(date -u +%FT%TZ)] PostgreSQL backup failed" >&2
    return 1
  fi

  find "$BACKUP_DIR" -type f -name 'concurso-intelligence-*.dump' -mtime "+$BACKUP_RETENTION_DAYS" -delete
}

while :; do
  run_backup

  if [ "$BACKUP_ONESHOT" = "true" ]; then
    exit 0
  fi

  sleep "$BACKUP_INTERVAL_SECONDS"
done
