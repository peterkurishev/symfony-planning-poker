import { escapeRegExp, expect, Given, resolve, Then, When } from './fixtures.js'
import { activeRoundCard, memberChip, resultCard, voteCard } from '../helpers.js'
import { fetchTask, taskByTitle } from './tasks.steps.js'

async function startRound(ctx, actor, { title, duration } = {}) {
  const task = taskByTitle(ctx, title)
  const response = await ctx.pageOf(actor).request.post(`/api/tasks/${task.id}/rounds`, {
    data: duration ? { duration_sec: duration } : {},
  })
  ctx.setResponse(response)
  return response
}

async function startRoundOk(ctx, actor, options) {
  const response = await startRound(ctx, actor, options)
  expect(response.status(), await response.text()).toBe(201)
  ctx.round = await ctx.json()
  ctx.rounds.push(ctx.round)
}

Given('{actor} запустил/запускает раунд по задаче', async ({ ctx }, actor) => {
  await startRoundOk(ctx, actor)
})

Given('{actor} запустил/запускает раунд по задаче {quoted}', async ({ ctx }, actor, title) => {
  await startRoundOk(ctx, actor, { title })
})

Given('{actor} запустил/запускает раунд по задаче с длительностью {int} секунд', async ({ ctx }, actor, duration) => {
  await startRoundOk(ctx, actor, { duration })
})

When('{actor} пытается запустить раунд по задаче', async ({ ctx }, actor) => {
  await startRound(ctx, actor)
})

When('{actor} пытается запустить раунд по задаче {quoted}', async ({ ctx }, actor, title) => {
  await startRound(ctx, actor, { title })
})

When('{actor} пытается запустить раунд по задаче с длительностью {int} секунд', async ({ ctx }, actor, duration) => {
  await startRound(ctx, actor, { duration })
})

async function vote(ctx, actor, value) {
  const response = await ctx.pageOf(actor).request.post(`/api/rounds/${ctx.round.id}/vote`, { data: { value } })
  ctx.setResponse(response)
  return response
}

Given('{actor} голосует/проголосовал/проголосовала через API за {quoted}', async ({ ctx }, actor, value) => {
  const response = await vote(ctx, actor, value)
  expect(response.status(), await response.text()).toBe(200)
})

When('{actor} пытается проголосовать через API за {quoted}', async ({ ctx }, actor, value) => {
  await vote(ctx, actor, value)
})

async function finish(ctx, actor) {
  const response = await ctx.pageOf(actor).request.post(`/api/rounds/${ctx.round.id}/finish`)
  ctx.setResponse(response)
  return response
}

Given('{actor} завершает/завершил раунд через API', async ({ ctx }, actor) => {
  const response = await finish(ctx, actor)
  expect(response.status(), await response.text()).toBe(200)
  ctx.finishResults.push(await ctx.json())
})

When('{actor} пытается завершить раунд через API', async ({ ctx }, actor) => {
  await finish(ctx, actor)
})

When('{actor} пытается зафиксировать итог {quoted} через API', async ({ ctx }, actor, estimate) => {
  ctx.setResponse(
    await ctx.pageOf(actor).request.post(`/api/tasks/${ctx.task.id}/estimate`, { data: { final_estimate: estimate } }),
  )
})

When('{actor} запрашивает раунд через API', async ({ ctx }, actor) => {
  ctx.setResponse(await ctx.pageOf(actor).request.get(`/api/rounds/${ctx.round.id}`))
})

When('{actor} нажимает карточку {quoted}', async ({ ctx }, actor, value) => {
  await voteCard(activeRoundCard(ctx.pageOf(actor)), value).click()
})

When('{actor} нажимает карточку итога {quoted}', async ({ ctx }, actor, value) => {
  await voteCard(resultCard(ctx.pageOf(actor)), value).click()
})

Then('{actor} видит/видят активный раунд', async ({ ctx }, actor) => {
  for (const page of ctx.pagesOf(actor)) await expect(activeRoundCard(page)).toBeVisible()
})

Then('{actor} видит/видят активный раунд по задаче', async ({ ctx }, actor) => {
  for (const page of ctx.pagesOf(actor)) {
    await expect(activeRoundCard(page).getByRole('heading', { name: ctx.task.title })).toBeVisible()
  }
})

Then('{actor} не видит/видят активного раунда', async ({ ctx }, actor) => {
  for (const page of ctx.pagesOf(actor)) await expect(activeRoundCard(page)).toHaveCount(0)
})

Then('{actor} видит/видят таймер активного раунда', async ({ ctx }, actor) => {
  for (const page of ctx.pagesOf(actor)) await expect(activeRoundCard(page).getByTestId('timer')).toBeVisible()
})

/** Таймер показывает mm:ss; допустимый диапазон в секундах превращается в перечисление значений. */
Then('{actor} видит/видят на таймере от {int} до {int} секунд', async ({ ctx }, actor, min, max) => {
  const values = []
  for (let s = min; s <= max; s += 1) {
    values.push(`${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`)
  }
  const range = new RegExp(`^(?:${values.join('|')})$`)
  for (const page of ctx.pagesOf(actor)) await expect(activeRoundCard(page).getByTestId('timer')).toHaveText(range)
})

Then('{actor} видит/видят {int} карточек голосования', async ({ ctx }, actor, count) => {
  for (const page of ctx.pagesOf(actor)) await expect(activeRoundCard(page).locator('.vote-card')).toHaveCount(count)
})

Then('{actor} видит/видят карточки голосования:', async ({ ctx }, actor, table) => {
  for (const page of ctx.pagesOf(actor)) await expect(activeRoundCard(page).locator('.vote-card')).toHaveText(table.raw()[0])
})

Then('{actor} видит/видят карточки итога:', async ({ ctx }, actor, table) => {
  for (const page of ctx.pagesOf(actor)) await expect(resultCard(page).locator('.vote-card')).toHaveText(table.raw()[0])
})

Then('{actor} видит/видят карточку {quoted} выделенной', async ({ ctx }, actor, value) => {
  for (const page of ctx.pagesOf(actor)) await expect(voteCard(activeRoundCard(page), value)).toHaveClass(/selected/)
})

Then('{actor} видит/видят карточку {quoted} невыделенной', async ({ ctx }, actor, value) => {
  for (const page of ctx.pagesOf(actor)) await expect(voteCard(activeRoundCard(page), value)).not.toHaveClass(/selected/)
})

Then('{actor} видит/видят карточку итога {quoted} выделенной', async ({ ctx }, actor, value) => {
  for (const page of ctx.pagesOf(actor)) await expect(voteCard(resultCard(page), value)).toHaveClass(/selected/)
})

/** Чип участника в шапке комнаты получает класс active, когда голос отдан (значение не раскрывается). */
Then('{actor} видит, что {actor} проголосовал/проголосовала', async ({ ctx }, actor, subject) => {
  await expect(memberChip(ctx.pageOf(actor), ctx.userOf(subject[0]).name)).toHaveClass(/active/)
})

Then('{actor} видит, что {actor} ещё не проголосовал/проголосовала', async ({ ctx }, actor, subject) => {
  await expect(memberChip(ctx.pageOf(actor), ctx.userOf(subject[0]).name)).not.toHaveClass(/active/)
})

Then('{actor} дожидается/дожидаются результатов раунда в течение {int} секунд', async ({ ctx }, actor, seconds) => {
  for (const page of ctx.pagesOf(actor)) await expect(resultCard(page)).toBeVisible({ timeout: seconds * 1000 })
})

Then('{actor} видит/видят результаты раунда', async ({ ctx }, actor) => {
  for (const page of ctx.pagesOf(actor)) await expect(resultCard(page)).toBeVisible()
})

Then('{actor} видит/видят результаты раунда по задаче', async ({ ctx }, actor) => {
  for (const page of ctx.pagesOf(actor)) {
    await expect(resultCard(page).getByRole('heading', { name: ctx.task.title })).toBeVisible()
  }
})

Then('{actor} видит/видят в результатах голос {whose} {quoted}', async ({ ctx }, actor, whose, value) => {
  const { name } = ctx.userOf(whose)
  for (const page of ctx.pagesOf(actor)) await expect(resultCard(page).locator('tr', { hasText: name })).toContainText(value)
})

/** Десятичный разделитель зависит от локали, поэтому «5.5» ищется как 5[.,]5. */
Then('{actor} видит/видят в результатах среднее {quoted} и медиану {quoted}', async ({ ctx }, actor, average, median) => {
  const number = (value) => escapeRegExp(value).replace('\\.', '[.,]')
  for (const page of ctx.pagesOf(actor)) {
    await expect(resultCard(page).getByText(new RegExp(`Среднее: ${number(average)}`))).toBeVisible()
    await expect(resultCard(page).getByText(new RegExp(`Медиана: ${number(median)}`))).toBeVisible()
  }
})

Then('{actor} видит/видят в результатах текст {quoted}', async ({ ctx }, actor, text) => {
  for (const page of ctx.pagesOf(actor)) await expect(resultCard(page).getByText(text)).toBeVisible()
})

Then('{actor} не видит/видят в результатах текст {quoted}', async ({ ctx }, actor, text) => {
  for (const page of ctx.pagesOf(actor)) await expect(resultCard(page).getByText(text)).toHaveCount(0)
})

async function fetchRound(ctx, roundId) {
  return (await ctx.pageOf(['main']).request.get(`/api/rounds/${roundId}`)).json()
}

Then('раунд в API имеет:', async ({ ctx }, expected) => {
  expect(await fetchRound(ctx, ctx.round.id)).toMatchObject(JSON.parse(resolve(ctx, expected)))
})

Then('предыдущий раунд в API имеет:', async ({ ctx }, expected) => {
  const previous = ctx.rounds.at(-2)
  if (!previous) throw new Error('Предыдущего раунда нет')
  expect(await fetchRound(ctx, previous.id)).toMatchObject(JSON.parse(resolve(ctx, expected)))
})

Then('последний раунд задачи в API имеет:', async ({ ctx }, expected) => {
  expect((await fetchTask(ctx)).last_round).toMatchObject(JSON.parse(resolve(ctx, expected)))
})

Then('у задачи в API начался новый раунд, отличный от предыдущего', async ({ ctx }) => {
  const { last_round: current } = await fetchTask(ctx)
  expect(current.id).not.toBe(ctx.round.id)
  expect(current.status).toBe('active')
  ctx.round = current
  ctx.rounds.push(current)
})

/** Дедлайн = момент нажатия «Начать оценку» + длительность, с запасом на сетевые задержки. */
Then('дедлайн последнего раунда задачи в API равен моменту запуска плюс {int} секунд', async ({ ctx }, seconds) => {
  const { last_round: round } = await fetchTask(ctx)
  const deadline = new Date(round.deadline_at).getTime()
  expect(Math.abs(deadline - (ctx.startedAt + seconds * 1000))).toBeLessThan(15_000)
})

Then('повторное завершение вернуло тот же finished_at и {int} голос/голоса/голосов', async ({ ctx }, votes) => {
  const [first, second] = ctx.finishResults.slice(-2)
  expect(second.finished_at).toBe(first.finished_at)
  expect(second.votes).toHaveLength(votes)
})
