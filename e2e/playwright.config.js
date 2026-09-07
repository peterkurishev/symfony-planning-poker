import { defineConfig, devices } from '@playwright/test'
import { defineBddConfig } from 'playwright-bdd'

// Внутри docker-контейнера e2e фронтенд доступен по имени сервиса; с хоста — по localhost.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

// Gherkin-сценарии (features/) превращаются в спеки в .features-gen/ командой `npx bddgen`.
const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.js',
  featuresRoot: './features',
  language: 'ru',
})

export default defineConfig({
  testDir,
  globalSetup: './global-setup.js',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Сценарии не зависят друг от друга (у каждого свои пользователи и комнаты),
  // но ходят в один backend — не перегружаем его.
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'ru-RU',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
