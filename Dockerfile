FROM php:8.2

RUN apt-get update && apt-get install -y \
    git \
    zip \
    curl

COPY --from=composer:2.8.12 /usr/bin/composer /usr/bin/composer

COPY composer.json /app/composer.json
RUN composer install -d /app
COPY init.php /app/init.php

ENTRYPOINT ["php", "/app/init.php"]
