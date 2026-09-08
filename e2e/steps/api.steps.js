import { expect, resolve, Then, When } from './fixtures.js'

async function send(ctx, actor, method, path, body) {
  const page = ctx.pageOf(actor)
  const options = { method }
  if (body) options.data = JSON.parse(resolve(ctx, body))
  ctx.setResponse(await page.request.fetch(resolve(ctx, path), options))
}

When('{actor} отправляет {word} {quoted}', async ({ ctx }, actor, method, path) => {
  await send(ctx, actor, method, path)
})

When('{actor} отправляет {word} {quoted} с телом:', async ({ ctx }, actor, method, path, body) => {
  await send(ctx, actor, method, path, body)
})

/** Пакет запросов: таблица «метод | путь | тело | статус». */
When('{actor} отправляет запросы к API и получает ожидаемые статусы:', async ({ ctx }, actor, table) => {
  for (const row of table.hashes()) {
    await send(ctx, actor, row['метод'], row['путь'], row['тело'] || undefined)
    expect(ctx.response.status(), `${row['метод']} ${row['путь']} ${row['тело']}`).toBe(Number(row['статус']))
  }
})

Then('ответ имеет статус {int}', async ({ ctx }, status) => {
  expect(ctx.response.status(), await ctx.response.text()).toBe(status)
})

/** Частичное сравнение: объекты — по подмножеству полей, массивы — поэлементно и по длине. */
Then('ответ содержит:', async ({ ctx }, expected) => {
  expect(await ctx.json()).toMatchObject(JSON.parse(resolve(ctx, expected)))
})

Then('в ответе нет поля {quoted}', async ({ ctx }, field) => {
  expect(await ctx.json()).not.toHaveProperty(field)
})

Then('ответ не содержит строку {quoted}', async ({ ctx }, needle) => {
  expect(JSON.stringify(await ctx.json())).not.toContain(needle)
})

Then('поле {quoted} в ответе не равно null', async ({ ctx }, field) => {
  expect((await ctx.json())[field]).not.toBeNull()
})

Then('сообщение в ответе содержит {quoted}', async ({ ctx }, text) => {
  expect((await ctx.json()).message).toContain(text)
})

Then('сообщение в ответе равно {quoted}', async ({ ctx }, text) => {
  expect((await ctx.json()).message).toBe(text)
})

Then('ошибки в ответе относятся к полям {quoted}', async ({ ctx }, fields) => {
  expect(Object.keys((await ctx.json()).errors).sort()).toEqual(fields.split(',').map((f) => f.trim()).sort())
})

Then('в ответе нет голоса {whose}', async ({ ctx }, whose) => {
  const { votes } = await ctx.json()
  expect(votes.map((vote) => vote.user.id)).not.toContain(ctx.userOf(whose).id)
})
