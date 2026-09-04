import { expect, test } from '../fixtures.js'
import {
  createRoomViaApi,
  createTaskViaApi,
  joinAsNewMember,
  makeUser,
  openRoom,
  openTaskDialog,
  registerViaApi,
  startRoundViaApi,
  taskRow,
  taskRows,
  uniq,
} from '../helpers.js'

/** UC-04. Создание задачи на оценку. */
test.describe('UC-04 Задачи', () => {
  test('владелец добавляет задачу, участник видит её в реальном времени', async ({ page, browser }) => {
    await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page)
    const { context, page: memberPage } = await joinAsNewMember(browser, room)
    await openRoom(memberPage, room.id, room.name)
    await expect(memberPage.getByText('Задач пока нет.')).toBeVisible()

    await openRoom(page, room.id, room.name)
    const title = `Задача ${uniq()}`
    const dialog = await openTaskDialog(page)
    await dialog.getByLabel('Название').fill(title)
    await dialog.getByLabel('Описание').fill('Описание задачи')
    await dialog.getByLabel('Ссылка на тикет').fill('https://tracker.example.com/T-1')
    await dialog.getByRole('button', { name: 'Добавить' }).click()

    await expect(dialog).toBeHidden()
    await expect(taskRow(page, title)).toBeVisible()
    // Событие task.created у участника.
    await expect(taskRow(memberPage, title)).toBeVisible()
    // Форма очищается после добавления.
    await expect((await openTaskDialog(page)).getByLabel('Название')).toHaveValue('')

    const fresh = await (await page.request.get(`/api/rooms/${room.id}`)).json()
    const task = fresh.tasks.find((t) => t.title === title)
    expect(task).toMatchObject({
      status: 'pending',
      description: 'Описание задачи',
      external_url: 'https://tracker.example.com/T-1',
      final_estimate: null,
    })

    await context.close()
  })

  test('новая задача попадает в конец списка', async ({ page }) => {
    await registerViaApi(page)
    const room = await createRoomViaApi(page)
    const first = await createTaskViaApi(page, room.id, { title: 'Первая' })
    const second = await createTaskViaApi(page, room.id, { title: 'Вторая' })
    expect(second.position).toBeGreaterThan(first.position)

    await openRoom(page, room.id, room.name)
    const titles = await taskRows(page).allInnerTexts()
    expect(titles[0]).toContain('Первая')
    expect(titles[1]).toContain('Вторая')
  })

  test('2а: невалидные данные — ошибка показывается в форме', async ({ page }) => {
    await registerViaApi(page)
    const room = await createRoomViaApi(page)
    await openRoom(page, room.id, room.name)

    const dialog = await openTaskDialog(page)
    await dialog.getByLabel('Название').fill('x'.repeat(201))
    await dialog.getByRole('button', { name: 'Добавить' }).click()
    await expect(page.getByText('Название задачи должно быть от 1 до 200 символов')).toBeVisible()
  })

  test('API: правила валидации задачи', async ({ page }) => {
    await registerViaApi(page)
    const room = await createRoomViaApi(page)
    const post = (data) => page.request.post(`/api/rooms/${room.id}/tasks`, { data })

    expect((await post({ title: '' })).status()).toBe(422)
    expect((await post({ title: 'ok', description: 'x'.repeat(5001) })).status()).toBe(422)
    expect((await post({ title: 'ok', external_url: 'not a url' })).status()).toBe(422)
    expect((await post({ title: 'ok', description: 'x'.repeat(5000) })).status()).toBe(201)
  })

  test('редактирование: владелец меняет задачу, участник видит изменения; во время раунда запрещено', async ({
    page,
    browser,
  }) => {
    await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id, { title: 'Старое название' })
    const { context, page: memberPage } = await joinAsNewMember(browser, room)
    await openRoom(memberPage, room.id, room.name)

    const updated = await page.request.patch(`/api/tasks/${task.id}`, { data: { title: 'Новое название' } })
    expect(updated.status()).toBe(200)
    await expect(taskRow(memberPage, 'Новое название')).toBeVisible()

    await startRoundViaApi(page, task.id)
    const denied = await page.request.patch(`/api/tasks/${task.id}`, { data: { title: 'Ещё одно' } })
    expect(denied.status()).toBe(422)
    expect((await denied.json()).message).toContain('активного раунда')

    await context.close()
  })

  test('удаление: задача исчезает у всех; во время раунда запрещено', async ({ page, browser }) => {
    await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page)
    const doomed = await createTaskViaApi(page, room.id, { title: 'На удаление' })
    const active = await createTaskViaApi(page, room.id, { title: 'В оценке' })
    const { context, page: memberPage } = await joinAsNewMember(browser, room)
    await openRoom(memberPage, room.id, room.name)
    await openRoom(page, room.id, room.name)

    await taskRow(page, 'На удаление').getByRole('button', { name: 'Удалить' }).click()
    await expect(taskRow(page, 'На удаление')).toHaveCount(0)
    await expect(taskRow(memberPage, 'На удаление')).toHaveCount(0)
    expect((await page.request.delete(`/api/tasks/${doomed.id}`)).status()).toBe(404)

    await startRoundViaApi(page, active.id)
    expect((await page.request.delete(`/api/tasks/${active.id}`)).status()).toBe(422)

    await context.close()
  })

  test('изменение порядка задач сохраняется', async ({ page }) => {
    await registerViaApi(page)
    const room = await createRoomViaApi(page)
    const a = await createTaskViaApi(page, room.id, { title: 'A' })
    const b = await createTaskViaApi(page, room.id, { title: 'B' })
    const c = await createTaskViaApi(page, room.id, { title: 'C' })

    const reordered = await page.request.post(`/api/rooms/${room.id}/tasks/reorder`, {
      data: { task_ids: [c.id, a.id, b.id] },
    })
    expect(reordered.status()).toBe(200)

    const fresh = await (await page.request.get(`/api/rooms/${room.id}`)).json()
    expect(fresh.tasks.map((t) => t.title)).toEqual(['C', 'A', 'B'])

    const foreign = await page.request.post(`/api/rooms/${room.id}/tasks/reorder`, {
      data: { task_ids: [a.id, '00000000-0000-7000-8000-000000000000'] },
    })
    expect(foreign.status()).toBe(422)
  })

  test('не владелец: не видит форму и кнопки, при запросе к API получает 403', async ({ page, browser }) => {
    await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    const { context, page: memberPage } = await joinAsNewMember(browser, room)

    await openRoom(memberPage, room.id, room.name)
    await expect(taskRow(memberPage, task.title)).toBeVisible()
    await expect(memberPage.getByRole('button', { name: 'Задача', exact: true })).toHaveCount(0)
    await expect(memberPage.getByRole('button', { name: 'Начать оценку' })).toHaveCount(0)
    await expect(memberPage.getByRole('button', { name: 'Удалить' })).toHaveCount(0)

    const { request } = memberPage
    expect((await request.post(`/api/rooms/${room.id}/tasks`, { data: { title: 'Чужая' } })).status()).toBe(403)
    expect((await request.patch(`/api/tasks/${task.id}`, { data: { title: 'Чужая' } })).status()).toBe(403)
    expect((await request.delete(`/api/tasks/${task.id}`)).status()).toBe(403)
    expect(
      (await request.post(`/api/rooms/${room.id}/tasks/reorder`, { data: { task_ids: [task.id] } })).status(),
    ).toBe(403)

    await context.close()
  })
})
