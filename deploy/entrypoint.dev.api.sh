#!/bin/sh
# Dev entrypoint for the api, queue and scheduler containers.
# LEMBAR_SETUP=1 (api only): install vendor, create .env + APP_KEY, wait for MySQL, migrate (+ seed demo on an empty DB).
# Other containers wait until vendor/ and the database are ready, then run their command.
set -e
cd /app

wait_for_mysql() {
  until php -r 'try { new PDO("mysql:host=".getenv("DB_HOST").";port=".(getenv("DB_PORT") ?: 3306).";dbname=".getenv("DB_DATABASE"), getenv("DB_USERNAME"), getenv("DB_PASSWORD")); } catch (Throwable $e) { exit(1); }' 2>/dev/null; do
    echo "[lembar] menunggu MySQL..."; sleep 2
  done
}

if [ "${LEMBAR_SETUP:-0}" = "1" ]; then
  if [ ! -f vendor/autoload.php ] || [ composer.lock -nt vendor/.lembar-installed ]; then
    echo "[lembar] composer install..."
    composer install --no-interaction --prefer-dist --no-progress
    touch vendor/.lembar-installed
  fi
  if [ ! -f .env ]; then
    cp .env.example .env
  fi
  if ! grep -q '^APP_KEY=base64:' .env; then
    php artisan key:generate --force
  fi
  mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs storage/app/private bootstrap/cache
  php artisan config:clear >/dev/null
  wait_for_mysql
  if php artisan migrate:status >/dev/null 2>&1; then
    php artisan migrate --force
  else
    echo "[lembar] database kosong: migrate + seed data demo..."
    php artisan migrate --force --seed
  fi
  touch storage/.lembar-ready
else
  until [ -f vendor/autoload.php ] && [ -f storage/.lembar-ready ]; do
    echo "[lembar] menunggu container api selesai setup..."; sleep 3
  done
  wait_for_mysql
fi

exec "$@"
