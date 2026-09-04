import { expect, test } from '../fixtures.js'
import { createRoomViaApi, errorAlert, makeUser, registerViaApi, topbar } from '../helpers.js'

/** UC-02. Вход в систему. */
test.describe('UC-02 Вход', () => {
  /** Регистрирует пользователя в отдельном контексте и возвращает его учётные данные. */
  async function existingUser(browser, label = 'login') {
    const context = await browser.newContext()
    const page = await context.newPage()
    const user = await registerViaApi(page, makeUser(label))
    await context.close()
    return user
  }

  test('вход по email и паролю ведёт в список комнат', async ({ page, browser }) => {
    const user = await existingUser(browser)

    await page.goto('/login')
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Пароль').fill(user.password)
    await page.getByRole('button', { name: 'Войти' }).click()

    await expect(page).toHaveURL(/\/rooms$/)
    await expect(topbar(page)).toContainText(user.name)
  })

  test('2а: неверный пароль — общая ошибка без уточнения', async ({ page, browser }) => {
    const user = await existingUser(browser)

    await page.goto('/login')
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Пароль').fill('wrong-password')
    await page.getByRole('button', { name: 'Войти' }).click()

    await expect(page.getByText('Неверный email или пароль')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('2б: после 5 неудачных попыток вход блокируется даже с верным паролем', async ({ page, browser }) => {
    const user = await existingUser(browser, 'throttle')

    for (let i = 0; i < 5; i += 1) {
      const attempt = await page.request.post('/api/login', {
        data: { email: user.email, password: `wrong-${i}` },
      })
      expect(attempt.status()).toBe(401)
    }

    const blocked = await page.request.post('/api/login', {
      data: { email: user.email, password: user.password },
    })
    expect(blocked.status()).toBe(401)

    await page.goto('/login')
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Пароль').fill(user.password)
    await page.getByRole('button', { name: 'Войти' }).click()
    await expect(errorAlert(page)).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('3а: гость по ссылке-приглашению после входа попадает в комнату', async ({ page, browser }) => {
    const ownerContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    await registerViaApi(ownerPage, makeUser('owner'))
    const room = await createRoomViaApi(ownerPage, { name: 'Комната по приглашению' })
    await ownerContext.close()

    const guest = await existingUser(browser, 'guest')

    await page.goto(`/join/${room.invite_code}`)
    await expect(page).toHaveURL(new RegExp(`/login\\?redirect=.*join.*${room.invite_code}`))

    await page.getByLabel('Email').fill(guest.email)
    await page.getByLabel('Пароль').fill(guest.password)
    await page.getByRole('button', { name: 'Войти' }).click()

    await expect(page).toHaveURL(new RegExp(`/rooms/${room.id}$`))
    await expect(page.getByRole('heading', { level: 1, name: room.name })).toBeVisible()
    await expect(page.getByTestId('members')).toContainText(guest.name)
  })

  test('выход уничтожает сессию, защищённые страницы снова требуют входа', async ({ page }) => {
    await registerViaApi(page)
    await page.goto('/rooms')
    await page.getByRole('button', { name: 'Выйти' }).click()
    await expect(page).toHaveURL(/\/login$/)

    expect((await page.request.get('/api/me')).status()).toBe(401)

    await page.goto('/rooms')
    await expect(page).toHaveURL(/\/login\?redirect=/)
  })
})
