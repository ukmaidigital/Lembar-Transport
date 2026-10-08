#!/usr/bin/env bash
# Boots the API (fresh SQLite + demo seed) and the production web build, runs the three e2e flows, tears down.
# Env: E2E_OUTPUT (screenshots dir), E2E_KEEP=1 to leave servers running.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export E2E_OUTPUT="${E2E_OUTPUT:-$ROOT/web/e2e/output}"
mkdir -p "$E2E_OUTPUT"

cd "$ROOT/api"
[ -f .env ] || { cp .env.example .env && php artisan key:generate; }
export DB_CONNECTION=sqlite DB_DATABASE="$E2E_OUTPUT/e2e.sqlite" CACHE_STORE=database QUEUE_CONNECTION=sync APP_ENV=local LEMBAR_OTP_EXPOSE=true LEMBAR_ADMIN_2FA_REQUIRED=false
rm -f "$DB_DATABASE"; touch "$DB_DATABASE"
php artisan migrate:fresh --seed --force --no-interaction >/dev/null
php artisan serve --host=127.0.0.1 --port=8000 >"$E2E_OUTPUT/api.log" 2>&1 &
API_PID=$!

cd "$ROOT/web"
export NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1 API_INTERNAL_URL=http://127.0.0.1:8000/api/v1 SESSION_COOKIE=lt_token
[ -d .next ] && [ -z "${E2E_SKIP_BUILD:-}" ] && rm -rf .next
[ -d .next ] || npm run build >"$E2E_OUTPUT/build.log" 2>&1
npx next start -p 3000 >"$E2E_OUTPUT/web.log" 2>&1 &
WEB_PID=$!
cleanup() { if [ -z "${E2E_KEEP:-}" ]; then kill $API_PID $WEB_PID 2>/dev/null || true; fi; }
trap cleanup EXIT

for i in $(seq 1 60); do curl -sf http://127.0.0.1:8000/api/v1/public/zones >/dev/null && curl -sf http://127.0.0.1:3000/ >/dev/null && break; sleep 1; done

# Create an offer for the demo driver so the driver flow can exercise accept (dispatch tick for a fresh order).
php -d display_errors=0 "$ROOT/api/artisan" tinker --execute='app(\App\Services\DispatchEngine::class)->tick();' >/dev/null 2>&1 || true

status=0
for flow in customer driver admin; do
  node "$ROOT/web/e2e/$flow.mjs" || status=1
done
exit $status
