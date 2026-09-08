# Сервис оценки задач

Planning poker для командной оценки: комнаты, задачи, шкалы, раунды с таймером и голосование в реальном времени.

Стек: PHP 8.4 + Symfony (API), Vue 3 + TypeScript + Vite (SPA), PostgreSQL 16, Redis 7.

## Запуск

```
docker compose up -d --build
docker compose exec php bin/console doctrine:migrations:migrate --no-interaction
```

- Фронтенд: http://localhost:5173
- API: http://localhost:8080/api

## Сервисы

| Сервис | Назначение |
|--------|------------|
| frontend | Vite dev-сервер, проксирует `/api` на nginx |
| nginx | отдаёт Symfony через php-fpm, порт 8080 |
| php | приложение Symfony |
| worker | `messenger:consume async` — остановка раундов по таймеру |
| postgres | долговременные данные |
| redis | сессии, голоса активного раунда, очередь, поток событий |
| e2e | Playwright + playwright-bdd; профиль `e2e`, не стартует вместе со стеком |

## Структура

- `usecases/` — варианты использования, по одному файлу на сценарий
- `API.md` — справочник HTTP API
- `backend/` — Symfony: сущности, сервисы, контроллеры, миграции
- `frontend/` — Vue SPA: экраны входа, списка комнат, комнаты с оценкой
- `e2e/` — end-to-end тесты (Playwright + playwright-bdd): Gherkin-сценарии в `features/`, по одному файлу
  на сценарий из `usecases/`; определения шагов в `steps/`

## Как это работает

Голоса активного раунда лежат в Redis и не раскрываются до остановки. Запуск раунда ставит отложенное
сообщение в очередь, воркер закрывает раунд по дедлайну и переносит голоса в PostgreSQL. Если воркер
недоступен, просроченный раунд закрывается при следующем обращении к комнате. Изменения комнаты
публикуются в поток Redis и доходят до браузера через Server-Sent Events на `/api/rooms/{id}/events`.

## Полезные команды

```
make up          # поднять всё
make migrate     # применить миграции
make logs        # логи
make console ARGS="debug:router"
make e2e         # e2e-тесты в контейнере Playwright (стек должен быть поднят)
make e2e SCREENSHOTS=1   # то же со скриншотом после каждого шага
make e2e-report  # HTML-отчёт последнего прогона на http://localhost:9323
```

## Тесты

E2E-тесты живут в `e2e/` и запускаются в контейнере `mcr.microsoft.com/playwright` против работающего стека
(`http://frontend:5173` внутри docker-сети). Сценарии написаны на Gherkin по-русски (`e2e/features/*.feature`,
по одному файлу на UC), шаги реализованы в `e2e/steps/*.steps.js`; `npx bddgen` (playwright-bdd) превращает
их в Playwright-спеки в `e2e/.features-gen/` (в git не хранится), после чего идёт обычный `playwright test`.
Каждый сценарий регистрирует своих пользователей и создаёт свои комнаты, поэтому база не сбрасывается.
Подмножество: `make e2e ARGS="08-finish-round"` (фильтр по имени файла) или `make e2e ARGS='--grep "UC-08"'`.
Артефакты (`test-results/`, `playwright-report/`) — в `e2e/`. Локально без docker: `cd e2e && npm test`.

`make e2e SCREENSHOTS=1` включает снимок экрана после каждого шага — действия (переход, клик, ввод) и успешной
проверки `expect` над элементом или страницей: файлы `e2e/test-results/<тест>/steps/NNN-<шаг>.png`, они же
прикрепляются к HTML-отчёту (`make e2e-report`). По умолчанию выключено, чтобы не замедлять прогон.

### CI (GitHub Actions)

Workflow `.github/workflows/e2e.yml` гоняет e2e-тесты на push в `master`, в pull request и вручную
(Actions → E2E → Run workflow, там же можно задать фильтр `args` и включить скриншоты). Поднимается тот же
`docker compose`-стек, что и локально, применяются миграции, затем `make e2e`. Образ php собирается с кэшем
слоёв GitHub Actions, `backend/vendor` и `e2e/node_modules` кэшируются по lock-файлам. HTML-отчёт и артефакты
упавших тестов (трейсы, скриншоты) лежат в артефакте `playwright-report`; при падении в лог выводятся логи
всех контейнеров.
