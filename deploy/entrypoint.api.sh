#!/bin/sh
# Waits for MySQL, runs migrations once (api service only) and caches config/routes.
set -e
if [ "$1" = "php-fpm" ] && [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  until php -r 'try { new PDO("mysql:host='"$DB_HOST"';port='"${DB_PORT:-3306}"';dbname='"$DB_DATABASE"'", "'"$DB_USERNAME"'", "'"$DB_PASSWORD"'"); } catch (Exception $e) { exit(1); }' 2>/dev/null; do
    echo "waiting for mysql…"; sleep 2
  done
  php artisan migrate --force
  if [ "${SEED_DEMO:-0}" = "1" ]; then php artisan db:seed --force; fi
fi
php artisan config:cache && php artisan route:cache && php artisan event:cache
exec "$@"
