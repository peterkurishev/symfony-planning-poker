import { expect, test } from '../fixtures.js'
import {
  activeRoundCard,
  createRoomViaApi,
  createTaskViaApi,
  joinAsNewMember,
  makeUser,
  openRoom,
  registerViaApi,
  resultCard,
  startRoundViaApi,
  taskRow,
  voteCard,
} from '../helpers.js'

/** UC-08. Остановка оценки: по таймеру, вручную, статистика и фиксация итога. */
test.describe('UC-08 Завершение раунда', () => {
  test('ручная остановка: голоса раскрываются, статистика, владелец фиксирует итог', async ({
    page,
    browser,
  }) => {
    const owner = await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    const round = await startRoundViaApi(page, task.id, 300)
    const { context, page: memberPage, user: member } = await joinAsNewMember(browser, room)
    await openRoom(page, room.id, room.name)
    await openRoom(memberPage, room.id, room.name)

    await voteCard(activeRoundCard(page), '3').click()
    await voteCard(activeRoundCard(memberPage), '8').click()
    await expect(activeRoundCard(page).getByText(/Проголосовали 2 из 2/)).toBeVisible()

    await page.getByRole('button', { name: 'Остановить оценку' }).click()

    // У обоих: раунд завершён, голоса раскрыты поимённо, среднее и медиана.
    for (const p of [page, memberPage]) {
      const result = resultCard(p)
      await expect(result.getByRole('heading', { name: `Результат: ${task.title}` })).toBeVisible()
      await expect(result.locator('tr', { hasText: owner.name })).toContainText('3')
      await expect(result.locator('tr', { hasText: member.name })).toContainText('8')
      await expect(result.getByText(/Среднее 5[.,]5, медиана 5[.,]5/)).toBeVisible()
      await expect(activeRoundCard(p)).toHaveCount(0)
    }

    const finished = await (await page.request.get(`/api/rounds/${round.id}`)).json()
    expect(finished.status).toBe('finished')
    expect(finished.finished_at).not.toBeNull()
    expect(finished.stats).toMatchObject({ average: 5.5, median: 5.5, suggestion: '5', spread: false })

    // Участник не фиксирует итог, владелец видит подсказку (ближайшее к медиане значение шкалы).
    await expect(resultCard(memberPage).getByText('Зафиксировать итог:')).toHaveCount(0)
    const fixBlock = resultCard(page)
    await expect(fixBlock.getByText('Зафиксировать итог:')).toBeVisible()
    await expect(voteCard(fixBlock, '5')).toHaveClass(/selected/)

    // Владелец выбирает другое значение — задача оценена, участник узнаёт через task.estimated.
    await voteCard(fixBlock, '8').click()
    await expect(taskRow(page, task.title).locator('.badge.done')).toHaveText('8')
    await expect(taskRow(memberPage, task.title).locator('.badge.done')).toHaveText('8')
    await expect(fixBlock.getByText('Зафиксировать итог:')).toHaveCount(0)

    const fresh = await (await page.request.get(`/api/rooms/${room.id}`)).json()
    expect(fresh.tasks.find((t) => t.id === task.id)).toMatchObject({ status: 'estimated', final_estimate: '8' })

    await context.close()
  })

  test('остановка по таймеру: раунд завершается без участия владельца', async ({ page }) => {
    await registerViaApi(page)
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    await openRoom(page, room.id, room.name)

    await page.getByLabel('Таймер, сек').fill('10')
    await taskRow(page, task.title).getByRole('button', { name: 'Начать оценку' }).click()
    await voteCard(activeRoundCard(page), '5').click()
    await expect(activeRoundCard(page).locator('.timer')).toHaveText(/^00:0\d$/)

    // Воркер закрывает раунд по дедлайну (или сработает ленивое завершение при перезагрузке данных).
    await expect(resultCard(page)).toBeVisible({ timeout: 30_000 })
    await expect(activeRoundCard(page)).toHaveCount(0)

    const fresh = await (await page.request.get(`/api/rooms/${room.id}`)).json()
    const lastRound = fresh.tasks[0].last_round
    expect(lastRound.status).toBe('finished')
    expect(lastRound.votes).toHaveLength(1)
    expect(lastRound.stats.median).toBe(5)
  })

  test('сбой воркера: просроченный раунд закрывается лениво при чтении комнаты', async ({ page }) => {
    await registerViaApi(page)
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    const round = await startRoundViaApi(page, task.id, 10)
    await page.request.post(`/api/rounds/${round.id}/vote`, { data: { value: '2' } })

    // Даже если воркер не успел, любое чтение комнаты после дедлайна должно вернуть завершённый раунд.
    await page.waitForTimeout(11_000)
    const fresh = await (await page.request.get(`/api/rooms/${room.id}`)).json()
    const lastRound = fresh.tasks[0].last_round
    expect(lastRound.status).toBe('finished')
    expect(lastRound.votes).toEqual([{ user: expect.anything(), value: '2' }])
  })

  test('завершение идемпотентно: повторная остановка ничего не меняет', async ({ page }) => {
    await registerViaApi(page)
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    const round = await startRoundViaApi(page, task.id)
    await page.request.post(`/api/rounds/${round.id}/vote`, { data: { value: '5' } })

    const first = await (await page.request.post(`/api/rounds/${round.id}/finish`)).json()
    const second = await (await page.request.post(`/api/rounds/${round.id}/finish`)).json()
    expect(second.finished_at).toBe(first.finished_at)
    expect(second.votes).toHaveLength(1)
  })

  test('5а: никто не проголосовал — статистика не считается, владелец может задать итог вручную', async ({
    page,
  }) => {
    await registerViaApi(page)
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    const round = await startRoundViaApi(page, task.id)
    await page.request.post(`/api/rounds/${round.id}/finish`)

    const finished = await (await page.request.get(`/api/rounds/${round.id}`)).json()
    expect(finished.votes).toEqual([])
    expect(finished.stats).toMatchObject({ total: 0, average: null, median: null, suggestion: null, mode: null })

    await openRoom(page, room.id, room.name)
    await expect(resultCard(page)).toBeVisible()
    await voteCard(resultCard(page), '13').click()
    await expect(taskRow(page, task.title).locator('.badge.done')).toHaveText('13')
  })

  test('5б: большой разброс голосов подсвечивается', async ({ page, browser }) => {
    await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    const { context, page: memberPage } = await joinAsNewMember(browser, room)
    const round = await startRoundViaApi(page, task.id)

    await page.request.post(`/api/rounds/${round.id}/vote`, { data: { value: '1' } })
    await memberPage.request.post(`/api/rounds/${round.id}/vote`, { data: { value: '21' } })
    await page.request.post(`/api/rounds/${round.id}/finish`)

    await openRoom(page, room.id, room.name)
    await expect(resultCard(page).getByText('Голоса сильно расходятся')).toBeVisible()

    await context.close()
  })

  test('7а: повторный раунд по той же задаче, предыдущий сохраняется в истории', async ({ page }) => {
    await registerViaApi(page)
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)

    const first = await startRoundViaApi(page, task.id)
    await page.request.post(`/api/rounds/${first.id}/vote`, { data: { value: '3' } })
    await page.request.post(`/api/rounds/${first.id}/finish`)

    await openRoom(page, room.id, room.name)
    await taskRow(page, task.title).getByRole('button', { name: 'Начать оценку' }).click()
    await expect(activeRoundCard(page)).toBeVisible()

    const fresh = await (await page.request.get(`/api/rooms/${room.id}`)).json()
    const second = fresh.tasks[0].last_round
    expect(second.id).not.toBe(first.id)
    expect(second.status).toBe('active')

    const history = await (await page.request.get(`/api/rounds/${first.id}`)).json()
    expect(history.status).toBe('finished')
    expect(history.votes).toHaveLength(1)
  })

  test('7б: без фиксации итога задача остаётся «оценивается»; фиксация при активном раунде запрещена', async ({
    page,
  }) => {
    await registerViaApi(page)
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    const round = await startRoundViaApi(page, task.id)

    const early = await page.request.post(`/api/tasks/${task.id}/estimate`, { data: { final_estimate: '5' } })
    expect(early.status()).toBe(409)

    await page.request.post(`/api/rounds/${round.id}/finish`)
    let fresh = await (await page.request.get(`/api/rooms/${room.id}`)).json()
    expect(fresh.tasks[0]).toMatchObject({ status: 'estimating', final_estimate: null })

    const wrong = await page.request.post(`/api/tasks/${task.id}/estimate`, { data: { final_estimate: '4' } })
    expect(wrong.status()).toBe(422)

    expect((await page.request.post(`/api/tasks/${task.id}/estimate`, { data: { final_estimate: '5' } })).status()).toBe(200)
    fresh = await (await page.request.get(`/api/rooms/${room.id}`)).json()
    expect(fresh.tasks[0]).toMatchObject({ status: 'estimated', final_estimate: '5' })
  })

  test('не владелец не может остановить раунд и зафиксировать итог', async ({ page, browser }) => {
    await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    const round = await startRoundViaApi(page, task.id)
    const { context, page: memberPage } = await joinAsNewMember(browser, room)

    expect((await memberPage.request.post(`/api/rounds/${round.id}/finish`)).status()).toBe(403)
    await page.request.post(`/api/rounds/${round.id}/finish`)
    expect(
      (await memberPage.request.post(`/api/tasks/${task.id}/estimate`, { data: { final_estimate: '5' } })).status(),
    ).toBe(403)

    await context.close()
  })
})
