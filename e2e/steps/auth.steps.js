import { expect, Given, Then, When } from './fixtures.js'
import { makeUser, registerViaApi, topbar } from '../helpers.js'

/** Пользователь, зарегистрированный в отдельном контексте: текущая страница остаётся гостевой. */
Given('существует зарегистрированный пользователь {quoted}', async ({ ctx, browser }, label) => {
  const context = await browser.newContext()
  ctx.users[label] = await registerViaApi(await context.newPage(), makeUser(label))
  await context.close()
})

Given('подготовлены данные нового пользователя {quoted}', async ({ ctx }, label) => {
  ctx.users[label] = makeUser(label)
})

Given('{actor} зарегистрирован/зарегистрирована', async ({ ctx, page }, actor) => {
  const [key] = actor
  if (key === 'main') {
    ctx.user = ctx.users.main = await registerViaApi(page, makeUser('owner'))
    return
  }
  await ctx.actor(key)
})

When(
  '{actor} {int} раз отправляет неверный пароль пользователя {quoted} через API',
  async ({ ctx }, actor, times, label) => {
    const page = ctx.pageOf(actor)
    const { email } = ctx.userOf(label)
    for (let i = 0; i < times; i += 1) {
      const attempt = await page.request.post('/api/login', { data: { email, password: `wrong-${i}` } })
      expect(attempt.status(), `попытка ${i + 1}`).toBe(401)
    }
  },
)

When('вход через API с верным паролем пользователя {quoted} отклоняется', async ({ ctx, page }, label) => {
  const { email, password } = ctx.userOf(label)
  const blocked = await page.request.post('/api/login', { data: { email, password } })
  expect(blocked.status()).toBe(401)
})

Then('{actor} видит/видят в шапке имя пользователя {quoted}', async ({ ctx }, actor, label) => {
  for (const page of ctx.pagesOf(actor)) {
    await expect(topbar(page)).toContainText(ctx.userOf(label).name)
  }
})

Then('{actor} перенаправлен на страницу входа с возвратом на ссылку-приглашение', async ({ ctx }, actor) => {
  await expect(ctx.pageOf(actor)).toHaveURL(new RegExp(`/login\\?redirect=.*join.*${ctx.room.invite_code}`))
})

Then('{actor} перенаправлен на страницу входа с параметром redirect', async ({ ctx }, actor) => {
  await expect(ctx.pageOf(actor)).toHaveURL(/\/login\?redirect=/)
})
