#!/bin/sh
set -eu

usage() {
  echo "Usage: RESTORE_DATABASE_URL=... RESTORE_CONFIRM=yes $0 <backup.dump>" >&2
  exit 2
}

[ "$#" -eq 1 ] || usage
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
[ "${RESTORE_CONFIRM:-}" = "yes" ] || {
  echo "Refusing restore: set RESTORE_CONFIRM=yes to acknowledge the destructive operation." >&2
  exit 2
}

backup_path="$1"
verifier="/usr/local/bin/postgres-backup-verify.sh"
[ -x "$verifier" ] || verifier="$(dirname "$0")/postgres-backup-verify.sh"
[ -f "$verifier" ] || {
  echo "Backup verifier not found." >&2
  exit 1
}

sh "$verifier" "$backup_path"

echo "[$(date -u +%FT%TZ)] restoring verified PostgreSQL backup: $backup_path"
pg_restore \
  --dbname="$RESTORE_DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "$backup_path"
echo "[$(date -u +%FT%TZ)] PostgreSQL restore completed: $backup_path"
