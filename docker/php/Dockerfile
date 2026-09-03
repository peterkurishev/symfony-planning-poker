FROM php:8.4-fpm-alpine

RUN apk add --no-cache icu-dev libpq-dev linux-headers $PHPIZE_DEPS \
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql intl opcache \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del $PHPIZE_DEPS

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

RUN printf 'opcache.enable=1\nopcache.validate_timestamps=1\nopcache.revalidate_freq=0\n' > /usr/local/etc/php/conf.d/opcache.ini \
    && printf 'date.timezone=UTC\nmemory_limit=512M\n' > /usr/local/etc/php/conf.d/app.ini

WORKDIR /app
