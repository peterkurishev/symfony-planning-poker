import { expect, test } from '../fixtures.js'
import {
  activeRoundCard,
  createRoomViaApi,
  createTaskViaApi,
  joinAsNewMember,
  makeUser,
  memberChip,
  openRoom,
  registerViaApi,
  startRoundViaApi,
  taskRow,
  voteCard,
} from '../helpers.js'

/** UC-06. Запуск оценки. */
test.describe('UC-06 Запуск раунда', () => {
  test('владелец запускает раунд: таймер, карточки, статус задачи, уведомление участника', async ({
    page,
    browser,
  }) => {
    await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page, { default_timer_sec: 120 })
    const task = await createTaskViaApi(page, room.id)
    const other = await createTaskViaApi(page, room.id, { title: 'Другая задача' })
    const { context, page: memberPage } = await joinAsNewMember(browser, room)
    await openRoom(memberPage, room.id, room.name)
    await openRoom(page, room.id, room.name)

    await page.getByLabel('Таймер, сек').fill('300')
    const startedAt = Date.now()
    await taskRow(page, task.title).getByRole('button', { name: 'Начать оценку' }).click()

    const ownerRound = activeRoundCard(page)
    await expect(ownerRound.getByRole('heading', { name: task.title })).toBeVisible()
    await expect(ownerRound.getByTestId('timer')).toHaveText(/^0[4-5]:[0-5]\d$/)
    await expect(ownerRound.locator('.vote-card')).toHaveCount(13)
    await expect(ownerRound.getByText(/Проголосовали 0 из 2/)).toBeVisible()
    await expect(ownerRound.getByRole('button', { name: 'Остановить оценку' })).toBeVisible()
    await expect(taskRow(page, task.title).getByTestId('task-status')).toHaveText('идёт')
    // Пока раунд идёт, второй запустить нельзя.
    await expect(taskRow(page, other.title).getByRole('button', { name: 'Начать оценку' })).toBeDisabled()

    // Участник получил round.started: видит задачу, отсчёт и карточки, но не кнопку остановки.
    const memberRound = activeRoundCard(memberPage)
    await expect(memberRound.getByRole('heading', { name: task.title })).toBeVisible()
    await expect(memberRound.getByTestId('timer')).toBeVisible()
    await expect(memberRound.getByRole('button', { name: 'Остановить оценку' })).toHaveCount(0)

    const fresh = await (await page.request.get(`/api/rooms/${room.id}`)).json()
    const freshTask = fresh.tasks.find((t) => t.id === task.id)
    expect(freshTask.status).toBe('estimating')
    expect(freshTask.last_round.status).toBe('active')
    expect(freshTask.last_round.duration_sec).toBe(300)
    // Дедлайн = старт + длительность (с запасом на сетевые задержки).
    const deadline = new Date(freshTask.last_round.deadline_at).getTime()
    expect(Math.abs(deadline - (startedAt + 300_000))).toBeLessThan(15_000)

    await context.close()
  })

  test('без явной длительности берётся таймер комнаты по умолчанию', async ({ page }) => {
    await registerViaApi(page)
    const room = await createRoomViaApi(page, { default_timer_sec: 45 })
    const task = await createTaskViaApi(page, room.id)
    const round = await startRoundViaApi(page, task.id)
    expect(round.duration_sec).toBe(45)
    expect(round.voted_user_ids).toEqual([])
    expect(round).not.toHaveProperty('votes')
  })

  test('2а: при активном раунде повторный запуск отклоняется', async ({ page }) => {
    await registerViaApi(page)
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    const other = await createTaskViaApi(page, room.id)
    await startRoundViaApi(page, task.id)

    for (const target of [task, other]) {
      const response = await page.request.post(`/api/tasks/${target.id}/rounds`)
      expect(response.status()).toBe(409)
      expect((await response.json()).message).toContain('уже идёт оценка')
    }
  })

  test('2: длительность вне 10–1800 секунд отклоняется', async ({ page }) => {
    await registerViaApi(page)
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)

    for (const duration of [9, 1801]) {
      const response = await page.request.post(`/api/tasks/${task.id}/rounds`, { data: { duration_sec: duration } })
      expect(response.status(), `duration=${duration}`).toBe(422)
    }
  })

  test('не владелец не может запустить раунд', async ({ page, browser }) => {
    await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    const { context, page: memberPage } = await joinAsNewMember(browser, room)

    expect((await memberPage.request.post(`/api/tasks/${task.id}/rounds`)).status()).toBe(403)

    await context.close()
  })

  test('участник, подключившийся в середине раунда, видит задачу и может проголосовать', async ({
    page,
    browser,
  }) => {
    await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    await startRoundViaApi(page, task.id, 120)

    const { context, page: memberPage, user } = await joinAsNewMember(browser, room, 'late')
    await openRoom(memberPage, room.id, room.name)

    const memberRound = activeRoundCard(memberPage)
    await expect(memberRound.getByRole('heading', { name: task.title })).toBeVisible()
    await expect(memberRound.getByTestId('timer')).toHaveText(/^0[01]:[0-5]\d$/)

    await voteCard(memberRound, '5').click()
    await expect(voteCard(memberRound, '5')).toHaveClass(/selected/)
    await expect(memberChip(memberPage, user.name)).toHaveClass(/active/)

    await context.close()
  })
})
