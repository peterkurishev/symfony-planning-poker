FROM php:8.4-fpm-alpine

RUN apk add --no-cache icu-dev libpq-dev linux-headers git unzip $PHPIZE_DEPS \
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql intl opcache \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && apk del $PHPIZE_DEPS

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

RUN printf 'opcache.enable=1\nopcache.validate_timestamps=1\nopcache.revalidate_freq=0\n' > /usr/local/etc/php/conf.d/opcache.ini \
    && printf 'date.timezone=UTC\nmemory_limit=512M\noutput_buffering=Off\nzlib.output_compression=Off\nmax_execution_time=0\n' > /usr/local/etc/php/conf.d/app.ini

COPY entrypoint.sh /usr/local/bin/app-entrypoint.sh
RUN chmod +x /usr/local/bin/app-entrypoint.sh

WORKDIR /app

ENV COMPOSER_ALLOW_SUPERUSER=1

ENTRYPOINT ["/usr/local/bin/app-entrypoint.sh"]
CMD ["php-fpm"]
