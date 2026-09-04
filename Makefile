.PHONY: up down build logs sh console migrate diff install front-build worker-logs e2e e2e-report

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

# E2E-тесты в контейнере Playwright; ARGS передаются playwright test (например ARGS="tests/07-vote.spec.js").
# SCREENSHOTS=1 включает снимок экрана после каждого шага (test-results/<тест>/steps/ и HTML-отчёт).
SCREENSHOTS ?= 0
export E2E_UID ?= $(shell id -u)
export E2E_GID ?= $(shell id -g)
e2e:
	docker compose --profile e2e run --rm -e E2E_SCREENSHOTS=$(SCREENSHOTS) e2e sh -c "npm install --no-audit --no-fund && npx playwright test $(ARGS)"

# HTML-отчёт последнего прогона на http://localhost:9323
e2e-report:
	docker compose --profile e2e run --rm -p 9323:9323 e2e npx playwright show-report --host 0.0.0.0
