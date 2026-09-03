.PHONY: up down build logs sh console migrate diff install front-build worker-logs

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

sh:
	docker compose exec php sh

console:
	docker compose exec php bin/console $(ARGS)

install:
	docker compose exec php composer install

diff:
	docker compose exec php bin/console doctrine:migrations:diff

migrate:
	docker compose exec php bin/console doctrine:migrations:migrate --no-interaction

front-build:
	docker compose exec frontend npm run build

worker-logs:
	docker compose logs -f worker
