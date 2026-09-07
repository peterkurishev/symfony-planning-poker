import { expect, Given, resolve, Then, When } from './fixtures.js'
import { createRoomViaApi, openRoom } from '../helpers.js'

async function createRoom(ctx, actor, payload = {}) {
  const [key] = actor
  const { page } = await ctx.actor(key)
  const room = await createRoomViaApi(page, payload)
  ctx.room = room
  ctx.rooms[room.name] = room
  return room
}

Given('{actor} создал комнату', async ({ ctx }, actor) => {
  await createRoom(ctx, actor)
})

Given('{actor} создал комнату {quoted}', async ({ ctx }, actor, name) => {
  await createRoom(ctx, actor, { name })
})

Given('{actor} создал комнату с таймером {int} секунд', async ({ ctx }, actor, timer) => {
  await createRoom(ctx, actor, { default_timer_sec: timer })
})

Given('{actor} создал комнату со шкалой {quoted}', async ({ ctx }, actor, scaleType) => {
  await createRoom(ctx, actor, { scale_type: scaleType })
})

Given('{actor} создал комнату с произвольной шкалой {quoted}', async ({ ctx }, actor, values) => {
  await createRoom(ctx, actor, { scale_type: 'custom', scale_values: values })
})

/** Сырая строка значений (DocString) — проверка нормализации пробелов, пустых значений и переводов строк. */
Given('{actor} создал комнату с произвольной шкалой из строки:', async ({ ctx }, actor, values) => {
  await createRoom(ctx, actor, { scale_type: 'custom', scale_values: values })
})

Given('{actor} создал комнату с произвольной шкалой из значений:', async ({ ctx }, actor, table) => {
  await createRoom(ctx, actor, { scale_type: 'custom', scale_values: table.raw()[0] })
})

When('{actor} пытается создать комнату с произвольной шкалой из {int} значений через API', async ({ ctx }, actor, count) => {
  const page = ctx.pageOf(actor)
  ctx.setResponse(
    await page.request.post('/api/rooms', {
      data: { name: 'Шкала', scale_type: 'custom', scale_values: Array.from({ length: count }, (_, i) => String(i)) },
    }),
  )
})

Given('{actor} присоединился/присоединилась к комнате', async ({ ctx }, actor) => {
  await ctx.join(actor[0])
})

When('{actor} открывает ссылку-приглашение комнаты', async ({ ctx }, actor) => {
  await ctx.pageOf(actor).goto(`/join/${ctx.room.invite_code}`)
})

When('{actor} открывает/открыл/открыла страницу комнаты', async ({ ctx }, actor) => {
  await openRoom(ctx.pageOf(actor), ctx.room.id, ctx.room.name)
})

When('{actor} перегенерирует ссылку-приглашение через API', async ({ ctx }, actor) => {
  const response = await ctx.pageOf(actor).request.post(`/api/rooms/${ctx.room.id}/invite`)
  ctx.setResponse(response)
  if (response.ok()) {
    ctx.oldInviteCode = ctx.room.invite_code
    ctx.room.invite_code = (await ctx.json()).invite_code
  }
})

When('{actor} запрашивает комнату через API', async ({ ctx }, actor) => {
  ctx.setResponse(await ctx.pageOf(actor).request.get(`/api/rooms/${ctx.room.id}`))
})

Then('{actor} попадает/попадают на страницу созданной комнаты', async ({ ctx }, actor) => {
  const page = ctx.pageOf(actor)
  await expect(page).toHaveURL(/\/rooms\/[0-9a-f-]{36}$/)
  const roomId = page.url().split('/').pop()
  ctx.room = await (await page.request.get(`/api/rooms/${roomId}`)).json()
  ctx.rooms[ctx.room.name] = ctx.room
})

Then('{actor} попадает/попадают на страницу комнаты', async ({ ctx }, actor) => {
  for (const page of ctx.pagesOf(actor)) await expect(page).toHaveURL(new RegExp(`/rooms/${ctx.room.id}$`))
})

Then('{actor} видит/видят заголовок комнаты', async ({ ctx }, actor) => {
  for (const page of ctx.pagesOf(actor)) {
    await expect(page.getByRole('heading', { level: 1, name: ctx.room.name })).toBeVisible()
  }
})

Then('{actor} видит/видят шкалу комнаты {quoted}', async ({ ctx }, actor, scale) => {
  for (const page of ctx.pagesOf(actor)) await expect(page.getByTestId('room-scale')).toHaveText(scale)
})

Then('{actor} видит/видят ссылку-приглашение', async ({ ctx }, actor) => {
  for (const page of ctx.pagesOf(actor)) {
    await expect(page.locator('input[readonly]')).toHaveValue(/\/join\/[A-Za-z0-9]{12}$/)
  }
})

Then('{actor} видит/видят в списке участников {whose}', async ({ ctx }, actor, whose) => {
  for (const page of ctx.pagesOf(actor)) await expect(page.getByTestId('members')).toContainText(ctx.userOf(whose).name)
})

Then('новый код приглашения отличается от старого', async ({ ctx }) => {
  expect(ctx.room.invite_code).not.toBe(ctx.oldInviteCode)
})

/** Свежее состояние комнаты глазами владельца (main). */
async function fetchRoom(ctx) {
  return (await ctx.pageOf(['main']).request.get(`/api/rooms/${ctx.room.id}`)).json()
}

Then('комната в API имеет:', async ({ ctx }, expected) => {
  expect(await fetchRoom(ctx)).toMatchObject(JSON.parse(resolve(ctx, expected)))
})

Then('среди участников комнаты в API есть её владелец', async ({ ctx }) => {
  const room = await fetchRoom(ctx)
  expect(room.members.map((m) => m.email)).toContain(room.owner.email)
})

Then('{actor} присутствует в участниках комнаты в API ровно один раз', async ({ ctx }, actor) => {
  const { email } = ctx.userOf(actor[0])
  const room = await fetchRoom(ctx)
  expect(room.members.filter((m) => m.email === email)).toHaveLength(1)
})

Then('шкала комнаты в API равна:', async ({ ctx }, expected) => {
  expect(ctx.room.scale).toEqual(JSON.parse(expected))
})

Then('значения шкалы комнаты:', async ({ ctx }, table) => {
  expect(ctx.room.scale.values).toEqual(table.raw()[0])
})

Then('шкала комнаты {word}', async ({ ctx }, kind) => {
  const numeric = { числовая: true, нечисловая: false }[kind]
  if (numeric === undefined) throw new Error(`Ожидается «числовая» или «нечисловая», получено: ${kind}`)
  expect(ctx.room.scale.numeric).toBe(numeric)
})
