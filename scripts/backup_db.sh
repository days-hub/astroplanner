#!/usr/bin/env bash
# Nightly Postgres backup with rotation, run from the repo root on the server.
#
# Install as a cron job (crontab -e):
#   0 3 * * * /opt/astroplanner/scripts/backup_db.sh >> /var/log/astroplanner-backup.log 2>&1
#
# Restore with:
#   gunzip -c backups/astroplanner-<stamp>.sql.gz | \
#     docker compose exec -T db psql -U astro astroplanner
set -euo pipefail

cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP="${KEEP:-14}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/astroplanner-$STAMP.sql.gz"

docker compose exec -T db pg_dump -U astro astroplanner | gzip > "$OUT"

# Keep the newest $KEEP dumps, delete the rest
ls -1t "$BACKUP_DIR"/astroplanner-*.sql.gz | tail -n +$((KEEP + 1)) | xargs -r rm --

echo "$(date -Is) backup written: $OUT ($(du -h "$OUT" | cut -f1))"
