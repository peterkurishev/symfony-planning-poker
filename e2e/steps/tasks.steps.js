import { expect, Given, resolve, Then, When } from './fixtures.js'
import { createTaskViaApi, openTaskDialog, taskRow, taskRows } from '../helpers.js'

/** Безымянная «задача» сценария. */
Given('{actor} создал задачу', async ({ ctx }, actor) => {
  ctx.task = await createTaskViaApi(ctx.pageOf(actor), ctx.room.id)
  ctx.tasks[ctx.task.title] = ctx.task
})

/** Именованная задача; на «задачу» сценария не влияет. */
Given('{actor} создал задачу {quoted}', async ({ ctx }, actor, title) => {
  ctx.tasks[title] = await createTaskViaApi(ctx.pageOf(actor), ctx.room.id, { title })
})

export function taskByTitle(ctx, title) {
  const task = title === undefined ? ctx.task : ctx.tasks[title]
  if (!task) throw new Error(`Задача ${title === undefined ? 'сценария' : `«${title}»`} не создана`)
  return task
}

When('{actor} открывает диалог новой задачи', async ({ ctx }, actor) => {
  await openTaskDialog(ctx.pageOf(actor))
})

async function clickInTaskRow(ctx, actor, name, title) {
  const page = ctx.pageOf(actor)
  // Момент запуска нужен для проверки дедлайна раунда.
  if (name === 'Начать оценку') ctx.startedAt = Date.now()
  await taskRow(page, taskByTitle(ctx, title).title).getByRole('button', { name }).click()
}

When('{actor} нажимает {quoted} у задачи', async ({ ctx }, actor, name) => {
  await clickInTaskRow(ctx, actor, name)
})

When('{actor} нажимает {quoted} у задачи {quoted}', async ({ ctx }, actor, name, title) => {
  await clickInTaskRow(ctx, actor, name, title)
})

When('{actor} переименовывает задачу {quoted} в {quoted} через API', async ({ ctx }, actor, from, to) => {
  const task = taskByTitle(ctx, from)
  const response = await ctx.pageOf(actor).request.patch(`/api/tasks/${task.id}`, { data: { title: to } })
  ctx.setResponse(response)
  if (response.ok()) ctx.tasks[to] = await ctx.json()
})

Then('{actor} видит, что диалог закрыт', async ({ ctx }, actor) => {
  await expect(ctx.pageOf(actor).getByRole('dialog')).toBeHidden()
})

Then('{actor} видит, что форма новой задачи очищена', async ({ ctx }, actor) => {
  const dialog = await openTaskDialog(ctx.pageOf(actor))
  await expect(dialog.getByLabel('Название')).toHaveValue('')
})

Then('{actor} видит/видят задачу в списке', async ({ ctx }, actor) => {
  for (const page of ctx.pagesOf(actor)) await expect(taskRow(page, ctx.task.title)).toBeVisible()
})

Then('{actor} видит/видят задачу {quoted} в списке', async ({ ctx }, actor, title) => {
  for (const page of ctx.pagesOf(actor)) await expect(taskRow(page, title)).toBeVisible()
})

Then('{actor} не видит/видят задачу {quoted} в списке', async ({ ctx }, actor, title) => {
  for (const page of ctx.pagesOf(actor)) await expect(taskRow(page, title)).toHaveCount(0)
})

Then('{actor} видит/видят задачи в порядке:', async ({ ctx }, actor, table) => {
  const expected = table.raw()[0]
  for (const page of ctx.pagesOf(actor)) {
    await expect(taskRows(page)).toHaveCount(expected.length)
    const titles = await taskRows(page).allInnerTexts()
    expected.forEach((title, i) => expect(titles[i]).toContain(title))
  }
})

Then('{actor} видит/видят статус задачи {quoted}', async ({ ctx }, actor, status) => {
  for (const page of ctx.pagesOf(actor)) {
    await expect(taskRow(page, ctx.task.title).getByTestId('task-status')).toHaveText(status)
  }
})

Then('{actor} видит/видят у задачи итоговую оценку {quoted}', async ({ ctx }, actor, estimate) => {
  for (const page of ctx.pagesOf(actor)) {
    await expect(taskRow(page, ctx.task.title).getByTestId('task-estimate')).toHaveText(estimate)
  }
})

Then('{actor} видит, что кнопка {quoted} у задачи {quoted} недоступна', async ({ ctx }, actor, name, title) => {
  await expect(taskRow(ctx.pageOf(actor), title).getByRole('button', { name })).toBeDisabled()
})

Then('позиция задачи {quoted} больше позиции задачи {quoted}', async ({ ctx }, later, earlier) => {
  expect(taskByTitle(ctx, later).position).toBeGreaterThan(taskByTitle(ctx, earlier).position)
})

/** Задача из свежего состояния комнаты (глазами владельца): по названию или «задача» сценария. */
export async function fetchTask(ctx, title) {
  const room = await (await ctx.pageOf(['main']).request.get(`/api/rooms/${ctx.room.id}`)).json()
  const task = title === undefined ? room.tasks.find((t) => t.id === ctx.task.id) : room.tasks.find((t) => t.title === title)
  if (!task) throw new Error(`Задача ${title === undefined ? 'сценария' : `«${title}»`} не найдена в комнате`)
  return task
}

Then('задача в API имеет:', async ({ ctx }, expected) => {
  expect(await fetchTask(ctx)).toMatchObject(JSON.parse(resolve(ctx, expected)))
})

Then('задача {quoted} в API имеет:', async ({ ctx }, title, expected) => {
  expect(await fetchTask(ctx, title)).toMatchObject(JSON.parse(resolve(ctx, expected)))
})

Then('задачи в API идут в порядке:', async ({ ctx }, table) => {
  const room = await (await ctx.pageOf(['main']).request.get(`/api/rooms/${ctx.room.id}`)).json()
  expect(room.tasks.map((t) => t.title)).toEqual(table.raw()[0])
})
