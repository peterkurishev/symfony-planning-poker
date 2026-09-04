import fs from 'node:fs/promises'
import path from 'node:path'
import { test as base } from '@playwright/test'

/**
 * Пошаговые скриншоты: после каждого действия на странице (goto, click, fill, …) и после
 * каждой успешной проверки expect() над Locator/Page снимается снимок экрана; он кладётся в
 * test-results/<тест>/steps/NNN-<шаг>.png и прикрепляется к HTML-отчёту.
 *
 * Включается переменной окружения E2E_SCREENSHOTS=1 (`make e2e SCREENSHOTS=1`);
 * по умолчанию выключено, чтобы не замедлять прогон.
 */
const enabled = ['1', 'true', 'yes', 'on'].includes(String(process.env.E2E_SCREENSHOTS ?? '').toLowerCase())

const PAGE_ACTIONS = ['goto', 'reload', 'goBack', 'click', 'dblclick', 'fill', 'press', 'selectOption', 'check', 'uncheck']
const LOCATOR_ACTIONS = ['click', 'dblclick', 'fill', 'press', 'selectOption', 'check', 'uncheck', 'hover', 'clear', 'setInputFiles']

/** Активный «регистратор» текущего теста; воркер выполняет тесты по одному. */
let recorder = null
let patched = false

function slug(value) {
  return String(value)
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'step'
}

/** Короткая подпись действия: метод + селектор/URL + значение. */
function describe(action, target, args) {
  const parts = [action]
  if (target) parts.push(target)
  // Значение: у goto — URL (args[0]); у page.fill('sel', v) — args[1]; у locator.fill(v) — args[0].
  const value = action === 'goto' ? args[0] : target && args.length > 1 ? args[1] : args[0]
  if (['fill', 'press', 'selectOption', 'goto'].includes(action) && (typeof value === 'string' || typeof value === 'number')) {
    parts.push(String(value))
  }
  return parts.join(' ')
}

async function snap(page, label) {
  const current = recorder
  if (!current || !page || page.isClosed()) return
  current.counter += 1
  const name = `${String(current.counter).padStart(3, '0')}-${slug(label)}`
  const file = path.join(current.dir, `${name}.png`)
  try {
    await page.screenshot({ path: file, fullPage: true })
    await current.testInfo.attach(name, { path: file, contentType: 'image/png' })
  } catch {
    // Страница могла закрыться между действием и снимком — это не ошибка теста.
  }
}

function wrap(proto, method, resolvePage, resolveTarget) {
  const original = proto[method]
  if (typeof original !== 'function') return
  proto[method] = async function (...args) {
    const result = await original.apply(this, args)
    await snap(resolvePage(this), describe(method, resolveTarget(this, args), args))
    return result
  }
}

/** Патчим прототипы Page и Locator один раз на воркер. */
function patchPrototypes(page) {
  if (patched) return
  patched = true

  const pageProto = Object.getPrototypeOf(page)
  const locatorProto = Object.getPrototypeOf(page.locator('body'))

  // У page.click(selector, …) цель — первый аргумент; у page.goto(url) URL попадёт в подпись как значение.
  const NAVIGATION = ['goto', 'reload', 'goBack']
  for (const method of PAGE_ACTIONS) {
    wrap(
      pageProto,
      method,
      (self) => self,
      (self, args) => (NAVIGATION.includes(method) ? '' : String(args[0] ?? '')),
    )
  }
  // У page.click('sel', value) значение — второй аргумент, поэтому его сдвигаем для describe().
  for (const method of LOCATOR_ACTIONS) {
    wrap(locatorProto, method, (self) => self.page(), (self) => String(self))
  }
}

/** Страница, к которой относится проверяемое значение: Locator → его page, Page → сама. */
function pageOf(actual) {
  if (!actual || typeof actual !== 'object') return null
  if (typeof actual.page === 'function' && typeof actual.click === 'function') return actual.page()
  if (typeof actual.screenshot === 'function' && typeof actual.goto === 'function') return actual
  return null
}

/**
 * expect() с тем же снимком после каждой успешной асинхронной проверки над Locator/Page:
 * действие фиксирует момент «нажали», проверка — момент «дождались результата».
 */
function wrapExpect(baseExpect) {
  const handler = (page) => ({
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value === 'function') {
        return (...args) => {
          const result = value.apply(target, args)
          return result && typeof result.then === 'function'
            ? result.then(async (resolved) => {
                await snap(page, `expect ${String(prop)} ${describeTarget(target)}`)
                return resolved
              })
            : result
        }
      }
      // `.not`, `.resolves` и т.п. — вложенный набор матчеров.
      return value && typeof value === 'object' ? new Proxy(value, handler(page)) : value
    },
  })

  const wrapped = (actual, ...rest) => {
    const matchers = baseExpect(actual, ...rest)
    const page = pageOf(actual)
    if (!page || !recorder) return matchers
    matchers[TARGET] = actual
    return new Proxy(matchers, handler(page))
  }
  // expect.soft / poll / extend / objectContaining / anything … — статические члены остаются.
  Object.assign(wrapped, baseExpect)
  return wrapped
}

const TARGET = Symbol('expect-target')
function describeTarget(matchers) {
  const actual = matchers[TARGET]
  // У Locator есть page(); у Page — нет, и для неё подпись не нужна.
  return actual && typeof actual.page === 'function' ? String(actual) : ''
}

export const test = base.extend({
  stepScreenshots: [
    async ({ page }, use, testInfo) => {
      if (!enabled) {
        await use()
        return
      }

      patchPrototypes(page)
      const dir = testInfo.outputPath('steps')
      await fs.mkdir(dir, { recursive: true })
      recorder = { dir, counter: 0, testInfo }

      await use()

      recorder = null
    },
    { auto: true },
  ],
})

export const expect = enabled ? wrapExpect(base.expect) : base.expect
