#!/usr/bin/env bash
# Local demo: SQLite API on :8000 + Next.js dev server on :3000 with seeded demo data.
# Usage: scripts/dev.sh            (first run installs deps, migrates and seeds)
#        scripts/dev.sh --reset    (drops and re-seeds the SQLite database)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/api"
[ -d vendor ] || composer install --no-interaction
[ -f .env ] || { cp .env.example .env && php artisan key:generate; }
touch database/database.sqlite
if [ "${1:-}" = "--reset" ] || ! php artisan migrate:status >/dev/null 2>&1 || php artisan migrate:status | grep -q "Pending"; then
  php artisan migrate:fresh --seed --force
fi
cd "$ROOT/web"
[ -d node_modules ] || npm install
[ -f .env.local ] || cp .env.example .env.local

trap 'kill 0' EXIT
( cd "$ROOT/api" && php artisan serve --host=127.0.0.1 --port=8000 ) &
( cd "$ROOT/api" && php artisan schedule:work ) &
( cd "$ROOT/api" && php artisan queue:work --sleep=3 --tries=3 ) &
( cd "$ROOT/web" && npm run dev ) &
cat <<MSG

  Lembar Transport dev stack
  --------------------------
  Customer   http://localhost:3000
  Driver     http://localhost:3000/driver      (OTP demo: 08120000001 … 08120000006, kode OTP tampil di layar)
  Admin      http://localhost:3000/admin/masuk (super@lembartransport.test / password; ops@, verifier@, finance@)
  API        http://localhost:8000/api/v1

MSG
wait
