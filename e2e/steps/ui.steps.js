import { escapeRegExp, expect, Then, When } from './fixtures.js'
import { errorAlert, fieldError, selectScale } from '../helpers.js'

const USER_FIELDS = { email: 'email', имя: 'name', пароль: 'password' }

function userField(ctx, field, label) {
  const key = USER_FIELDS[field]
  if (!key) throw new Error(`Неизвестное поле пользователя: ${field} (ожидается email, имя или пароль)`)
  return ctx.userOf(label)[key]
}

When('{actor} открывает страницу {quoted}', async ({ ctx }, actor, path) => {
  await ctx.pageOf(actor).goto(path)
})

When('{actor} вводит в поле {quoted} значение {quoted}', async ({ ctx }, actor, label, value) => {
  await ctx.pageOf(actor).getByLabel(label).fill(value)
})

When('{actor} вводит в поле {quoted} {word} пользователя {quoted}', async ({ ctx }, actor, label, field, user) => {
  await ctx.pageOf(actor).getByLabel(label).fill(userField(ctx, field, user))
})

When('{actor} вводит в поле {quoted} строку из {int} символов', async ({ ctx }, actor, label, length) => {
  await ctx.pageOf(actor).getByLabel(label).fill('x'.repeat(length))
})

When('{actor} нажимает кнопку {quoted}', async ({ ctx }, actor, name) => {
  await ctx.pageOf(actor).getByRole('button', { name }).click()
})

When('{actor} выбирает шкалу {quoted}', async ({ ctx }, actor, title) => {
  await selectScale(ctx.pageOf(actor), title)
})

When('проходит {int} секунда/секунды/секунд', async ({ page }, seconds) => {
  await page.waitForTimeout(seconds * 1000)
})

async function expectPath(ctx, actor, path) {
  for (const page of ctx.pagesOf(actor)) {
    await expect(page).toHaveURL(new RegExp(`${escapeRegExp(path)}$`))
  }
}

Then('{actor} попадает/попадают на страницу {quoted}', async ({ ctx }, actor, path) => {
  await expectPath(ctx, actor, path)
})

Then('{actor} остаётся на странице {quoted}', async ({ ctx }, actor, path) => {
  await expectPath(ctx, actor, path)
})

Then('{actor} видит/видят текст {quoted}', async ({ ctx }, actor, text) => {
  for (const page of ctx.pagesOf(actor)) await expect(page.getByText(text)).toBeVisible()
})

Then('{actor} не видит/видят текст {quoted}', async ({ ctx }, actor, text) => {
  for (const page of ctx.pagesOf(actor)) await expect(page.getByText(text)).toHaveCount(0)
})

Then('{actor} видит/видят кнопку {quoted}', async ({ ctx }, actor, name) => {
  for (const page of ctx.pagesOf(actor)) await expect(page.getByRole('button', { name })).toBeVisible()
})

/** Точное совпадение имени: «Задача» не должна цепляться за другие кнопки со словом «задача». */

Then('{actor} не видит/видят кнопку {quoted}', async ({ ctx }, actor, name) => {
  for (const page of ctx.pagesOf(actor)) await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
})

Then('{actor} видит/видят ссылку {quoted}', async ({ ctx }, actor, name) => {
  for (const page of ctx.pagesOf(actor)) await expect(page.getByRole('link', { name })).toBeVisible()
})

Then('{actor} видит/видят заголовок {quoted}', async ({ ctx }, actor, name) => {
  for (const page of ctx.pagesOf(actor)) await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
})

Then('{actor} видит/видят в поле {quoted} значение {quoted}', async ({ ctx }, actor, label, value) => {
  for (const page of ctx.pagesOf(actor)) await expect(page.getByLabel(label)).toHaveValue(value)
})

Then('{actor} видит/видят в поле {quoted} {word} пользователя {quoted}', async ({ ctx }, actor, label, field, user) => {
  for (const page of ctx.pagesOf(actor)) await expect(page.getByLabel(label)).toHaveValue(userField(ctx, field, user))
})

Then('{actor} видит/видят ошибку под полем {quoted}', async ({ ctx }, actor, label) => {
  for (const page of ctx.pagesOf(actor)) await expect(fieldError(page, label)).toHaveText(/\S/)
})

Then('{actor} не видит/видят ошибки под полем {quoted}', async ({ ctx }, actor, label) => {
  for (const page of ctx.pagesOf(actor)) await expect(fieldError(page, label)).toBeEmpty()
})

Then('{actor} видит/видят общую ошибку формы', async ({ ctx }, actor) => {
  for (const page of ctx.pagesOf(actor)) await expect(errorAlert(page)).toBeVisible()
})

/** Нативная валидация input[min]: поле помечено невалидным, форма не отправляется. */
Then('{actor} видит, что поле {quoted} отклонено браузером как значение ниже минимума', async ({ ctx }, actor, label) => {
  const field = ctx.pageOf(actor).getByLabel(label)
  expect(await field.evaluate((el) => el.validity.rangeUnderflow)).toBe(true)
})
