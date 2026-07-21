#!/usr/bin/env bash
# Belt-and-suspenders demo-account cleanup, run from the repo root on the
# server. The backend already purges expired demo accounts at startup and
# hourly while it's up; this cron job covers the gap where the process is
# down or restarting so cleanup can't lapse.
#
# It calls the same purge_expired_demo_users() the app uses, so the TTL
# (DEMO_USER_TTL_HOURS) and FK cascades behave identically. No-op when demo
# mode was never enabled — there simply won't be any is_demo rows to remove.
#
# Install as a cron job (crontab -e):
#   30 * * * * /opt/astroplanner/scripts/purge_demo_users.sh >> /var/log/astroplanner-demo-purge.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."

docker compose exec -T backend python -c "
from app.db.database import SessionLocal
from app.routers.demo import purge_expired_demo_users

db = SessionLocal()
try:
    print(f'purged {purge_expired_demo_users(db)} expired demo account(s)')
finally:
    db.close()
"

echo "$(date -Is) demo purge run"
