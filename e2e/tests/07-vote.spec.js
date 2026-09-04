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
  voteCard,
} from '../helpers.js'

/** UC-07. Оценка задачи (голосование). */
test.describe('UC-07 Голосование', () => {
  test('участник голосует, меняет и отменяет голос; остальные видят факт, но не значение', async ({
    page,
    browser,
  }) => {
    await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    const round = await startRoundViaApi(page, task.id, 300)
    const { context, page: memberPage, user: member } = await joinAsNewMember(browser, room)
    await openRoom(page, room.id, room.name)
    await openRoom(memberPage, room.id, room.name)

    const ownerRound = activeRoundCard(page)
    const memberRound = activeRoundCard(memberPage)
    const memberBadge = memberChip(page, member.name)

    // Голос: карточка выделяется у участника, владелец видит факт голосования.
    await voteCard(memberRound, '5').click()
    await expect(voteCard(memberRound, '5')).toHaveClass(/selected/)
    await expect(memberBadge).toHaveClass(/active/)
    await expect(ownerRound.getByText(/Проголосовали 1 из 2/)).toBeVisible()

    // Значение не раскрывается: в состоянии активного раунда нет ни votes, ни stats.
    const secret = await (await page.request.get(`/api/rounds/${round.id}`)).json()
    expect(secret.status).toBe('active')
    expect(secret.voted_user_ids).toEqual([member.id])
    expect(secret).not.toHaveProperty('votes')
    expect(secret).not.toHaveProperty('stats')
    expect(JSON.stringify(secret)).not.toContain('"5"')

    // Изменение голоса: учитывается последний, участник по-прежнему один.
    await voteCard(memberRound, '8').click()
    await expect(voteCard(memberRound, '8')).toHaveClass(/selected/)
    await expect(voteCard(memberRound, '5')).not.toHaveClass(/selected/)
    await expect(ownerRound.getByText(/Проголосовали 1 из 2/)).toBeVisible()

    // Отмена: повторное нажатие снимает голос.
    await voteCard(memberRound, '8').click()
    await expect(voteCard(memberRound, '8')).not.toHaveClass(/selected/)
    await expect(memberBadge).not.toHaveClass(/active/)
    await expect(ownerRound.getByText(/Проголосовали 0 из 2/)).toBeVisible()

    // После завершения раскрывается именно последний голос.
    await voteCard(memberRound, '13').click()
    await expect(memberBadge).toHaveClass(/active/)
    await page.request.post(`/api/rounds/${round.id}/finish`)
    const finished = await (await page.request.get(`/api/rounds/${round.id}`)).json()
    expect(finished.votes).toEqual([{ user: expect.objectContaining({ id: member.id }), value: '13' }])

    await context.close()
  })

  test('служебные значения ? и ☕ принимаются как голос', async ({ page }) => {
    await registerViaApi(page)
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    const round = await startRoundViaApi(page, task.id)

    for (const value of ['?', '☕']) {
      const response = await page.request.post(`/api/rounds/${round.id}/vote`, { data: { value } })
      expect(response.status(), value).toBe(200)
    }
  })

  test('2б: значение не из шкалы — 422; 2в: не участник — 403', async ({ page, browser }) => {
    await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    const round = await startRoundViaApi(page, task.id)

    for (const value of ['4', 'XL', '']) {
      const response = await page.request.post(`/api/rounds/${round.id}/vote`, { data: { value } })
      expect(response.status(), `value=${value}`).toBe(422)
    }

    const stranger = await browser.newContext()
    const strangerPage = await stranger.newPage()
    await registerViaApi(strangerPage, makeUser('stranger'))
    expect((await strangerPage.request.post(`/api/rounds/${round.id}/vote`, { data: { value: '5' } })).status()).toBe(403)
    expect((await strangerPage.request.get(`/api/rounds/${round.id}`)).status()).toBe(403)
    await stranger.close()
  })

  test('6: когда проголосовали все, владелец получает уведомление', async ({ page, browser }) => {
    await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    const round = await startRoundViaApi(page, task.id, 300)
    const { context, page: memberPage } = await joinAsNewMember(browser, room)
    await openRoom(page, room.id, room.name)

    await voteCard(activeRoundCard(page), '3').click()
    await expect(page.getByText('Проголосовали все участники')).toHaveCount(0)

    await memberPage.request.post(`/api/rounds/${round.id}/vote`, { data: { value: '5' } })
    await expect(page.getByText('Проголосовали все участники — можно остановить раунд')).toBeVisible()
    await expect(activeRoundCard(page).getByText(/Проголосовали 2 из 2/)).toBeVisible()

    await context.close()
  })

  test('2а: голос после завершения раунда отклоняется', async ({ page }) => {
    await registerViaApi(page)
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    const round = await startRoundViaApi(page, task.id)
    await page.request.post(`/api/rounds/${round.id}/finish`)

    const vote = await page.request.post(`/api/rounds/${round.id}/vote`, { data: { value: '5' } })
    expect(vote.status()).toBe(409)
    expect((await vote.json()).message).toBe('Раунд уже завершён')
    expect((await page.request.delete(`/api/rounds/${round.id}/vote`)).status()).toBe(409)
  })

  test('участник без голоса не попадает в результаты раунда', async ({ page, browser }) => {
    await registerViaApi(page, makeUser('owner'))
    const room = await createRoomViaApi(page)
    const task = await createTaskViaApi(page, room.id)
    const { context, page: memberPage, user: member } = await joinAsNewMember(browser, room)
    const round = await startRoundViaApi(page, task.id)

    await page.request.post(`/api/rounds/${round.id}/vote`, { data: { value: '2' } })
    await page.request.post(`/api/rounds/${round.id}/finish`)

    const finished = await (await memberPage.request.get(`/api/rounds/${round.id}`)).json()
    expect(finished.votes.map((v) => v.user.id)).not.toContain(member.id)
    expect(finished.stats.total).toBe(1)

    await context.close()
  })
})
