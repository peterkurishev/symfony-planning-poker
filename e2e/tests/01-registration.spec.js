import { expect, test } from '../fixtures.js'
import { makeUser, registerViaApi } from '../helpers.js'

/** UC-01. Регистрация. */
test.describe('UC-01 Регистрация', () => {
  test('гость регистрируется, автоматически авторизуется и попадает в список комнат', async ({ page }) => {
    const user = makeUser('reg')
    await page.goto('/register')

    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Имя').fill(user.name)
    await page.getByLabel('Пароль').fill(user.password)
    await page.getByRole('button', { name: 'Создать аккаунт' }).click()

    await expect(page).toHaveURL(/\/rooms$/)
    await expect(page.locator('.topbar-user')).toContainText(user.name)

    const me = await page.request.get('/api/me')
    expect(me.status()).toBe(200)
    expect(await me.json()).toMatchObject({ email: user.email, name: user.name })
  })

  test('2а: занятый email — ошибка у поля, введённые данные сохраняются', async ({ page, browser }) => {
    // Занимаем email в другом контексте, чтобы текущая страница осталась гостевой.
    const other = await browser.newContext()
    const existing = await registerViaApi(await other.newPage(), makeUser('taken'))
    await other.close()

    await page.goto('/register')
    await page.getByLabel('Email').fill(existing.email)
    await page.getByLabel('Имя').fill('Новый пользователь')
    await page.getByLabel('Пароль').fill('password123')
    await page.getByRole('button', { name: 'Создать аккаунт' }).click()

    await expect(page.getByText('Этот email уже занят')).toBeVisible()
    await expect(page).toHaveURL(/\/register$/)
    await expect(page.getByLabel('Имя')).toHaveValue('Новый пользователь')
    await expect(page.getByLabel('Email')).toHaveValue(existing.email)
  })

  test('2б: невалидные данные — ошибки у соответствующих полей', async ({ page }) => {
    const user = makeUser('bad')
    await page.goto('/register')
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Имя').fill('A') // короче 2 символов
    await page.getByLabel('Пароль').fill('short') // короче 8 символов
    await page.getByRole('button', { name: 'Создать аккаунт' }).click()

    await expect(page).toHaveURL(/\/register$/)
    // Ошибка выводится сразу после соответствующего поля.
    await expect(page.locator('label:has-text("Имя") + p.error')).toBeVisible()
    await expect(page.locator('label:has-text("Пароль") + p.error')).toBeVisible()
    await expect(page.locator('label:has-text("Email") + p.error')).toHaveCount(0)
  })

  test('API: правила валидации — email, имя 2–50, пароль от 8 символов', async ({ request }) => {
    const response = await request.post('/api/register', {
      data: { email: 'не-email', name: 'x'.repeat(51), password: '1234567' },
    })
    expect(response.status()).toBe(422)
    const body = await response.json()
    expect(Object.keys(body.errors).sort()).toEqual(['email', 'name', 'password'])
  })

  test('2в: авторизованный пользователь перенаправляется со страницы регистрации', async ({ page }) => {
    await registerViaApi(page)
    await page.goto('/register')
    await expect(page).toHaveURL(/\/rooms$/)
  })
})
