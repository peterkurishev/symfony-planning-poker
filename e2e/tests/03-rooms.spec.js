import { expect, test } from '@playwright/test'
import {
  createRoomViaApi,
  createTaskViaApi,
  joinAsNewMember,
  makeUser,
  openRoom,
  registerViaApi,
  startRoundViaApi,
  uniq,
} from '../helpers.js'

/** UC-03. Создание комнаты и присоединение по ссылке. */
test.describe('UC-03 Комната', () => {
  test('пользователь создаёт комнату и видит ссылку-приглашение', async ({ page }) => {
    await registerViaApi(page)
    const name = `Спринт ${uniq()}`

    await page.goto('/rooms')
    await page.getByLabel('Название').fill(name)
    await page.getByLabel('Шкала оценки').selectOption('fibonacci')
    await page.getByLabel('Таймер раунда, секунд').fill('90')
    await page.getByRole('button', { name: 'Создать комнату' }).click()

    await expect(page).toHaveURL(/\/rooms\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
    await expect(page.locator('.badge', { hasText: 'fibonacci' })).toBeVisible()

    const invite = page.locator('input[readonly]')
    await expect(invite).toHaveValue(/\/join\/[A-Za-z0-9]{12}$/)
    await expect(page.getByRole('button', { name: 'Скопировать ссылку' })).toBeVisible()

    // Создатель — владелец и участник; таймер сохранён.
    const roomId = page.url().split('/').pop()
    const room = await (await page.request.get(`/api/rooms/${roomId}`)).json()
    expect(room.default_timer_sec).toBe(90)
    expect(room.members.map((m) => m.email)).toContain(room.owner.email)

    // Комната появляется в списке «Мои комнаты».
    await page.goto('/rooms')
    await expect(page.getByRole('link', { name })).toBeVisible()
  })

  test('4а: невалидные данные комнаты — ошибки показываются в форме', async ({ page }) => {
    await registerViaApi(page)
    await page.goto('/rooms')

    await page.getByLabel('Название').fill('A')
    await page.getByRole('button', { name: 'Создать комнату' }).click()
    await expect(page.getByText('Название комнаты должно быть от 2 до 100 символов')).toBeVisible()

    // Таймер вне диапазона останавливает встроенная валидация поля (min/max), форма не уходит на сервер.
    await page.getByLabel('Название').fill('Нормальное название')
    const timer = page.getByLabel('Таймер раунда, секунд')
    await timer.fill('5')
    await page.getByRole('button', { name: 'Создать комнату' }).click()
    expect(await timer.evaluate((el) => el.validity.rangeUnderflow)).toBe(true)
    await expect(page).toHaveURL(/\/rooms$/)
  })

  test('API: диапазон таймера 10–1800 секунд', async ({ page }) => {
    await registerViaApi(page)
    for (const timer of [9, 1801]) {
      const response = await page.request.post('/api/rooms', {
        data: { name: 'Таймер', scale_type: 'fibonacci', default_timer_sec: timer },
      })
      expect(response.status(), `timer=${timer}`).toBe(422)
    }
  })

  test('присоединение по ссылке: участник добавляется, владелец видит его в реальном времени', async ({
    page,
    browser,
  }) => {
    await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page)
    await openRoom(page, room.id, room.name)

    const memberContext = await browser.newContext()
    const memberPage = await memberContext.newPage()
    const member = await registerViaApi(memberPage, makeUser('member'))

    await memberPage.goto(`/join/${room.invite_code}`)
    await expect(memberPage).toHaveURL(new RegExp(`/rooms/${room.id}$`))
    await expect(memberPage.getByRole('heading', { level: 1, name: room.name })).toBeVisible()

    // Событие member.joined доставляется владельцу по SSE без перезагрузки.
    await expect(page.getByText(/Участники:/)).toContainText(member.name)

    // Повторное присоединение не дублирует участника.
    await memberPage.goto(`/join/${room.invite_code}`)
    await expect(memberPage).toHaveURL(new RegExp(`/rooms/${room.id}$`))
    const fresh = await (await page.request.get(`/api/rooms/${room.id}`)).json()
    expect(fresh.members.filter((m) => m.email === member.email)).toHaveLength(1)

    await memberContext.close()
  })

  test('3а: неизвестный код приглашения — «Комната не найдена»', async ({ page }) => {
    await registerViaApi(page)
    await page.goto('/join/nosuchcode0000')
    await expect(page.getByText('Комната не найдена')).toBeVisible()
    await expect(page.getByRole('link', { name: 'К списку комнат' })).toBeVisible()
  })

  test('перегенерация ссылки: старый код перестаёт действовать', async ({ page, browser }) => {
    await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page)
    const oldCode = room.invite_code

    const reset = await page.request.post(`/api/rooms/${room.id}/invite`)
    expect(reset.status()).toBe(200)
    const { invite_code: newCode } = await reset.json()
    expect(newCode).not.toBe(oldCode)

    const memberContext = await browser.newContext()
    const memberPage = await memberContext.newPage()
    await registerViaApi(memberPage, makeUser('member'))

    expect((await memberPage.request.post(`/api/rooms/join/${oldCode}`)).status()).toBe(404)
    expect((await memberPage.request.post(`/api/rooms/join/${newCode}`)).status()).toBe(200)

    await memberContext.close()
  })

  test('смена шкалы владельцем: запрещена во время активного раунда, разрешена после', async ({ page }) => {
    await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    const round = await startRoundViaApi(page, task.id)

    const denied = await page.request.patch(`/api/rooms/${room.id}`, { data: { scale_type: 'pow2' } })
    expect(denied.status()).toBe(422)
    expect((await denied.json()).message).toContain('активного раунда')

    expect((await page.request.post(`/api/rounds/${round.id}/finish`)).status()).toBe(200)

    const allowed = await page.request.patch(`/api/rooms/${room.id}`, { data: { scale_type: 'pow2' } })
    expect(allowed.status()).toBe(200)
    expect((await allowed.json()).scale.type).toBe('pow2')
  })

  test('не владелец не может менять настройки и перегенерировать ссылку', async ({ page, browser }) => {
    await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page)
    const { context, page: memberPage } = await joinAsNewMember(browser, room)

    expect((await memberPage.request.patch(`/api/rooms/${room.id}`, { data: { name: 'Чужая' } })).status()).toBe(403)
    expect((await memberPage.request.post(`/api/rooms/${room.id}/invite`)).status()).toBe(403)

    await context.close()
  })
})
