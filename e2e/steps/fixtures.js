import { createBdd, defineParameterType } from 'playwright-bdd'
import { test as base, expect } from '../fixtures.js'
import { joinAsNewMember, joinRoomViaApi, makeUser, registerViaApi } from '../helpers.js'

/*
 * Акторы сценария. «main» — стандартная фикстура page (владелец / пользователь / гость);
 * остальные (участник, участник «a», посторонний, другой пользователь) получают свой
 * браузерный контекст и регистрируются лениво при первом упоминании.
 */
const ACTOR = 'владелец|пользователь|гость|участник «[^»]+»|участник|посторонний|другой пользователь'

/** {actor} — именительный падеж; возвращает массив ключей: «владелец и участник видят …». */
defineParameterType({
  name: 'actor',
  regexp: new RegExp(`(?:${ACTOR})(?: и (?:${ACTOR}))*`),
  transformer: (text) => text.split(' и ').map(actorKey),
  useForSnippets: false,
})

/** {whose} — родительный падеж: «голос владельца», «в списке участников участника «a»». */
defineParameterType({
  name: 'whose',
  regexp: /владельца|участника «[^»]+»|участника|постороннего|пользователя «[^»]+»/,
  transformer: whoseKey,
  useForSnippets: false,
})

/**
 * {quoted} — строка в «ёлочках» (встроенный {string} понимает только "…" и '…').
 * Допускает пустую «» и один уровень вложенных кавычек: «Значение «S» повторяется».
 */
defineParameterType({
  name: 'quoted',
  regexp: /«((?:[^«»]|«[^«»]*»)*)»/,
  transformer: (value) => value,
  useForSnippets: true,
})

function actorKey(text) {
  if (['владелец', 'пользователь', 'гость'].includes(text)) return 'main'
  const named = text.match(/^участник «(.+)»$/)
  if (named) return named[1]
  const key = { участник: 'member', посторонний: 'stranger', 'другой пользователь': 'other' }[text]
  if (!key) throw new Error(`Неизвестный актор: ${text}`)
  return key
}

function whoseKey(text) {
  if (text === 'владельца') return 'main'
  const named = text.match(/^(?:участника|пользователя) «(.+)»$/)
  if (named) return named[1]
  const key = { участника: 'member', постороннего: 'stranger' }[text]
  if (!key) throw new Error(`Неизвестный актор: ${text}`)
  return key
}

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Подстановка данных сценария в пути, тела запросов и ожидания:
 * {{room.id}}, {{round.id}}, {{task.id}}, {{tasks.Название.id}}, {{users.member.id}},
 * {{oldInviteCode}}, {{room.invite_code}}; {{x*51}} — строка из N символов «x».
 */
export function resolve(ctx, text) {
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr) => {
    const repeat = expr.match(/^x\*(\d+)$/)
    if (repeat) return 'x'.repeat(Number(repeat[1]))
    let value = ctx
    for (const part of expr.split('.')) {
      value = value?.[part]
      if (value === undefined) throw new Error(`Неизвестная подстановка {{${expr}}}`)
    }
    return String(value)
  })
}

function createWorld(page, browser) {
  const ctx = {
    actors: new Map([['main', { page, context: null }]]),
    users: {},
    user: null,
    room: null,
    rooms: {},
    task: null,
    tasks: {},
    round: null,
    rounds: [],
    response: null,
    finishResults: [],
    startedAt: null,
    oldInviteCode: null,

    /** Актор по ключу; дополнительные создаются (свой контекст + регистрация) при первом обращении. */
    async actor(key) {
      const existing = ctx.actors.get(key)
      if (existing) return existing
      const context = await browser.newContext()
      const actorPage = await context.newPage()
      const user = await registerViaApi(actorPage, makeUser(key))
      const actor = { page: actorPage, context, user }
      ctx.actors.set(key, actor)
      ctx.users[key] = user
      return actor
    },

    /** Страница ровно одного, уже существующего актора (для действий). */
    pageOf(keys) {
      if (keys.length !== 1) throw new Error(`Ожидался один актор, получено: ${keys.join(', ')}`)
      return ctx.pagesOf(keys)[0]
    },

    /** Страницы перечисленных акторов (для проверок «владелец и участник видят …»). */
    pagesOf(keys) {
      return keys.map((key) => {
        const actor = ctx.actors.get(key)
        if (!actor) throw new Error(`Актор «${key}» ещё не появился в сценарии`)
        return actor.page
      })
    },

    userOf(key) {
      const user = ctx.users[key]
      if (!user) throw new Error(`Пользователь «${key}» неизвестен`)
      return user
    },

    /** Присоединить актора к текущей комнате; нового — создать и зарегистрировать. */
    async join(key) {
      if (!ctx.room) throw new Error('Комната ещё не создана')
      if (ctx.actors.has(key)) {
        await joinRoomViaApi(ctx.actors.get(key).page, ctx.room.invite_code)
        return
      }
      const { context, page: memberPage, user } = await joinAsNewMember(browser, ctx.room, key)
      ctx.actors.set(key, { page: memberPage, context, user })
      ctx.users[key] = user
    },

    setResponse(response) {
      ctx.response = response
      ctx.responseJson = undefined
    },

    /** JSON последнего ответа (разбирается один раз). */
    async json() {
      if (!ctx.response) throw new Error('Нет последнего ответа API')
      if (ctx.responseJson === undefined) ctx.responseJson = await ctx.response.json()
      return ctx.responseJson
    },

    async dispose() {
      for (const [key, actor] of ctx.actors) {
        if (key !== 'main') await actor.context.close()
      }
    },
  }
  return ctx
}

export const test = base.extend({
  ctx: async ({ page, browser }, use) => {
    const ctx = createWorld(page, browser)
    await use(ctx)
    await ctx.dispose()
  },
})

export const { Given, When, Then } = createBdd(test)
export { expect }
