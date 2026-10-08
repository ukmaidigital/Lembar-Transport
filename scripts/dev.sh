#!/usr/bin/env bash
# Local demo: SQLite API on :8000 + Next.js dev server on :3000 with seeded demo data.
# Usage: scripts/dev.sh            (SQLite; first run installs deps, migrates and seeds)
#        scripts/dev.sh --mysql    (MySQL 8 + Redis in Docker via deploy/docker-compose.dev.yml)
#        scripts/dev.sh --reset    (drop and re-seed the database; combine with --mysql)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RESET=""; MYSQL=""
for arg in "$@"; do case "$arg" in --reset) RESET=1 ;; --mysql) MYSQL=1 ;; esac; done

cd "$ROOT/api"
[ -d vendor ] || composer install --no-interaction
[ -f .env ] || { cp .env.example .env && php artisan key:generate; }

if [ -n "$MYSQL" ]; then
  # MySQL + Redis containers; the API/web keep running natively and connect to 127.0.0.1.
  docker compose -f "$ROOT/deploy/docker-compose.dev.yml" up -d
  echo "waiting for mysql…"
  until [ "$(docker inspect -f '{{.State.Health.Status}}' lembar-dev-mysql-1 2>/dev/null)" = healthy ]; do sleep 2; done
  export DB_CONNECTION=mysql DB_HOST=127.0.0.1 DB_PORT=3306 DB_DATABASE=lembar DB_USERNAME=lembar DB_PASSWORD=secret
  export CACHE_STORE=redis QUEUE_CONNECTION=redis SESSION_DRIVER=redis REDIS_HOST=127.0.0.1
  QUEUE_ARGS="redis"
else
  export DB_CONNECTION=sqlite DB_DATABASE="$ROOT/api/database/database.sqlite"
  touch database/database.sqlite
  QUEUE_ARGS=""
fi
php artisan config:clear >/dev/null
if [ -n "$RESET" ] || ! php artisan migrate:status >/dev/null 2>&1 || php artisan migrate:status | grep -q "Pending"; then
  php artisan migrate:fresh --seed --force
fi
cd "$ROOT/web"
[ -d node_modules ] || npm install
[ -f .env.local ] || cp .env.example .env.local

trap 'kill 0' EXIT
( cd "$ROOT/api" && php artisan serve --host=127.0.0.1 --port=8000 ) &
( cd "$ROOT/api" && php artisan schedule:work ) &
( cd "$ROOT/api" && php artisan queue:work $QUEUE_ARGS --sleep=3 --tries=3 ) &
( cd "$ROOT/web" && npm run dev ) &
cat <<MSG

  Lembar Transport dev stack
  --------------------------
  Customer   http://localhost:3000
  Driver     http://localhost:3000/driver      (OTP demo: 08120000001 … 08120000006, kode OTP tampil di layar)
  Admin      http://localhost:3000/admin/masuk (super@lembartransport.test / password; ops@, verifier@, finance@)
  API        http://localhost:8000/api/v1
  Database   ${MYSQL:+MySQL 8 @ 127.0.0.1:3306 (lembar/secret) + Redis 6379 — docker compose -f deploy/docker-compose.dev.yml}${MYSQL:-SQLite api/database/database.sqlite}

MSG
wait
