import { request } from '@playwright/test'

/**
 * Ждём, пока поднимутся фронтенд (Vite) и API (nginx → php-fpm).
 * Контейнер frontend на старте делает `npm install`, поэтому дать ему время.
 */
export default async function globalSetup(config) {
  const baseURL = config.projects[0].use.baseURL
  const deadline = Date.now() + 180_000
  const ctx = await request.newContext({ baseURL })

  try {
    while (true) {
      try {
        const front = await ctx.get('/')
        // /api/me без сессии отвечает 401 — значит, nginx и php уже готовы.
        const api = await ctx.get('/api/me')
        if (front.ok() && api.status() === 401) return
      } catch {
        // сервис ещё не слушает порт
      }
      if (Date.now() > deadline) {
        throw new Error(`Стек не поднялся за 180 секунд: ${baseURL}`)
      }
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  } finally {
    await ctx.dispose()
  }
}
