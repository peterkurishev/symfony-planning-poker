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
  selectScale,
  startRoundViaApi,
  voteCard,
} from '../helpers.js'

/** UC-05. Шкалы оценки. */
test.describe('UC-05 Шкалы', () => {
  test('предустановленные шкалы: Фибоначчи и степени двойки', async ({ page }) => {
    await registerViaApi(page)

    const fib = await createRoomViaApi(page, { scale_type: 'fibonacci' })
    expect(fib.scale).toEqual({
      type: 'fibonacci',
      values: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89'],
      votable: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?', '☕'],
      numeric: true,
    })

    const pow2 = await createRoomViaApi(page, { scale_type: 'pow2' })
    expect(pow2.scale.values).toEqual(['1', '2', '4', '8', '16', '32', '64'])
    expect(pow2.scale.numeric).toBe(true)
  })

  test('произвольная шкала: нормализация, порядок ввода, признак числовой', async ({ page }) => {
    await registerViaApi(page)

    const sizes = await createRoomViaApi(page, { scale_type: 'custom', scale_values: ' XL, XS ,,S\nM  , L ' })
    expect(sizes.scale.values).toEqual(['XL', 'XS', 'S', 'M', 'L'])
    expect(sizes.scale.numeric).toBe(false)

    const numbers = await createRoomViaApi(page, { scale_type: 'custom', scale_values: ['0.5', '1', '2', '4', '8'] })
    expect(numbers.scale.values).toEqual(['0.5', '1', '2', '4', '8'])
    expect(numbers.scale.numeric).toBe(true)
  })

  test('4а: ошибки произвольной шкалы называют проблемное значение', async ({ page }) => {
    await registerViaApi(page)
    await page.goto('/rooms')
    await page.getByLabel('Название').fill('Шкала')
    await selectScale(page, 'Произвольная')

    await page.getByLabel('Значения через запятую').fill('S, M, S')
    await page.getByRole('button', { name: 'Создать комнату' }).click()
    await expect(page.getByText('Значение «S» повторяется')).toBeVisible()

    await page.getByLabel('Значения через запятую').fill('S, ОченьДлинноеЗначение')
    await page.getByRole('button', { name: 'Создать комнату' }).click()
    await expect(page.getByText('Значение «ОченьДлинноеЗначение» длиннее 10 символов')).toBeVisible()

    await page.getByLabel('Значения через запятую').fill('S')
    await page.getByRole('button', { name: 'Создать комнату' }).click()
    await expect(page.getByText('Произвольная шкала должна содержать от 2 до 30 значений')).toBeVisible()

    const tooMany = await page.request.post('/api/rooms', {
      data: { name: 'Шкала', scale_type: 'custom', scale_values: Array.from({ length: 31 }, (_, i) => String(i)) },
    })
    expect(tooMany.status()).toBe(422)
    expect((await page.request.post('/api/rooms', { data: { name: 'Шкала', scale_type: 'unknown' } })).status()).toBe(422)
  })

  test('карточки голосования содержат шкалу и служебные значения, итог — только шкалу', async ({ page }) => {
    await registerViaApi(page)
    const room = await createRoomViaApi(page, { scale_type: 'custom', scale_values: 'XS, S, M, L, XL' })
    const task = await createTaskViaApi(page, room.id)
    const round = await startRoundViaApi(page, task.id)
    await openRoom(page, room.id, room.name)

    const cards = activeRoundCard(page).locator('.vote-card')
    await expect(cards).toHaveText(['XS', 'S', 'M', 'L', 'XL', '?', '☕'])

    await voteCard(activeRoundCard(page), 'M').click()
    expect((await page.request.post(`/api/rounds/${round.id}/finish`)).status()).toBe(200)

    // В блоке фиксации итога служебных значений нет.
    await expect(resultCard(page).locator('.vote-card')).toHaveText(['XS', 'S', 'M', 'L', 'XL'])
    const estimate = await page.request.post(`/api/tasks/${task.id}/estimate`, { data: { final_estimate: '?' } })
    expect(estimate.status()).toBe(422)
  })

  test('нечисловая шкала: распределение и мода, среднее не считается', async ({ page, browser }) => {
    await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page, { scale_type: 'custom', scale_values: 'XS, S, M, L, XL' })
    const task = await createTaskViaApi(page, room.id)
    const a = await joinAsNewMember(browser, room, 'a')
    const b = await joinAsNewMember(browser, room, 'b')
    const round = await startRoundViaApi(page, task.id)

    await page.request.post(`/api/rounds/${round.id}/vote`, { data: { value: 'M' } })
    await a.page.request.post(`/api/rounds/${round.id}/vote`, { data: { value: 'M' } })
    await b.page.request.post(`/api/rounds/${round.id}/vote`, { data: { value: 'L' } })
    await page.request.post(`/api/rounds/${round.id}/finish`)

    const finished = await (await page.request.get(`/api/rounds/${round.id}`)).json()
    expect(finished.stats).toMatchObject({
      numeric: false,
      total: 3,
      counted: 0,
      average: null,
      median: null,
      mode: 'M',
      suggestion: 'M',
      distribution: { M: 2, L: 1 },
    })

    await openRoom(page, room.id, room.name)
    await expect(resultCard(page).getByText(/Чаще всего: M/)).toBeVisible()

    await a.context.close()
    await b.context.close()
  })

  test('числовая шкала: ? и ☕ не участвуют в среднем и медиане', async ({ page, browser }) => {
    await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    const a = await joinAsNewMember(browser, room, 'a')
    const b = await joinAsNewMember(browser, room, 'b')
    const round = await startRoundViaApi(page, task.id)

    await page.request.post(`/api/rounds/${round.id}/vote`, { data: { value: '3' } })
    await a.page.request.post(`/api/rounds/${round.id}/vote`, { data: { value: '8' } })
    await b.page.request.post(`/api/rounds/${round.id}/vote`, { data: { value: '☕' } })
    await page.request.post(`/api/rounds/${round.id}/finish`)

    const finished = await (await page.request.get(`/api/rounds/${round.id}`)).json()
    expect(finished.stats).toMatchObject({
      numeric: true,
      total: 3,
      counted: 2,
      average: 5.5,
      median: 5.5,
      suggestion: '5',
    })

    await a.context.close()
    await b.context.close()
  })
})
