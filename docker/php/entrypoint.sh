#!/bin/sh
# Точка входа php-контейнеров: гарантирует наличие зависимостей перед запуском команды.
# Каталог /app примонтирован с хоста, поэтому vendor/ не попадает в образ и его
# приходится ставить при старте (аналогично `npm install` во frontend-контейнере).
set -e

mkdir -p /app/var

# Блокировка нужна, чтобы php и worker не запускали composer install одновременно
# на одном и том же примонтированном каталоге.
flock /app/var/composer-install.lock -c '
    if [ ! -f /app/vendor/autoload_runtime.php ]; then
        echo "[entrypoint] vendor/ отсутствует — выполняется composer install"
        composer install --no-interaction --prefer-dist --no-progress --working-dir=/app
    fi
'

exec docker-php-entrypoint "$@"
