#!/bin/sh
set -eu

usage() {
  echo "Usage: $0 <backup.dump>" >&2
  exit 2
}

[ "$#" -eq 1 ] || usage

backup_path="$1"
checksum_path="$backup_path.sha256"

[ -f "$backup_path" ] || { echo "Backup not found: $backup_path" >&2; exit 1; }
[ -f "$checksum_path" ] || { echo "Checksum not found: $checksum_path" >&2; exit 1; }

expected_checksum="$(awk 'NR == 1 { print $1 }' "$checksum_path")"
case "$expected_checksum" in
  ''|*[!0-9a-fA-F]*)
    echo "Invalid checksum format: $checksum_path" >&2
    exit 1
    ;;
esac

[ "${#expected_checksum}" -eq 64 ] || {
  echo "Invalid SHA-256 checksum length: $checksum_path" >&2
  exit 1
}

actual_checksum="$(sha256sum "$backup_path" | awk '{ print $1 }')"
if [ "$actual_checksum" != "$expected_checksum" ]; then
  echo "Backup checksum mismatch: $backup_path" >&2
  exit 1
fi

if ! pg_restore --list "$backup_path" >/dev/null; then
  echo "Backup archive is not readable by pg_restore: $backup_path" >&2
  exit 1
fi

echo "Backup integrity verified: $backup_path"
