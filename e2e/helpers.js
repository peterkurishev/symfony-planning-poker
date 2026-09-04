import { expect } from '@playwright/test'

let counter = 0

/** Уникальный суффикс, чтобы тесты не пересекались по email и названиям. */
export function uniq() {
  counter += 1
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${counter}`
}

export function makeUser(label = 'user') {
  const id = uniq()
  return { email: `${label}-${id}@example.com`, name: `${label} ${id}`, password: 'password123' }
}

/**
 * Регистрация через API. page.request делит cookie-jar с браузерным контекстом,
 * поэтому после вызова страница уже авторизована.
 */
export async function registerViaApi(page, user = makeUser()) {
  const response = await page.request.post('/api/register', { data: user })
  expect(response.status(), await response.text()).toBe(201)
  return { ...user, ...(await response.json()) }
}

export async function loginViaApi(page, { email, password }) {
  const response = await page.request.post('/api/login', { data: { email, password } })
  expect(response.status(), await response.text()).toBe(200)
  return response.json()
}

export async function createRoomViaApi(page, payload = {}) {
  const response = await page.request.post('/api/rooms', {
    data: { name: `Комната ${uniq()}`, scale_type: 'fibonacci', ...payload },
  })
  expect(response.status(), await response.text()).toBe(201)
  return response.json()
}

export async function joinRoomViaApi(page, inviteCode) {
  const response = await page.request.post(`/api/rooms/join/${inviteCode}`)
  expect(response.status(), await response.text()).toBe(200)
  return response.json()
}

export async function createTaskViaApi(page, roomId, payload = {}) {
  const response = await page.request.post(`/api/rooms/${roomId}/tasks`, {
    data: { title: `Задача ${uniq()}`, ...payload },
  })
  expect(response.status(), await response.text()).toBe(201)
  return response.json()
}

export async function startRoundViaApi(page, taskId, durationSec) {
  const response = await page.request.post(`/api/tasks/${taskId}/rounds`, {
    data: durationSec ? { duration_sec: durationSec } : {},
  })
  expect(response.status(), await response.text()).toBe(201)
  return response.json()
}

/** Открыть страницу комнаты и дождаться её загрузки. */
export async function openRoom(page, roomId, roomName) {
  await page.goto(`/rooms/${roomId}`)
  await expect(page.getByRole('heading', { level: 1, name: roomName })).toBeVisible()
}

/**
 * Второй участник: отдельный браузерный контекст (своя сессия), зарегистрирован
 * и присоединён к комнате по коду приглашения.
 */
export async function joinAsNewMember(browser, room, label = 'member') {
  const context = await browser.newContext()
  const page = await context.newPage()
  const user = await registerViaApi(page, makeUser(label))
  await joinRoomViaApi(page, room.invite_code)
  return { context, page, user }
}

/** Имя текущего пользователя показывается в шапке (v-app-bar → role=banner). */
export function topbar(page) {
  return page.getByRole('banner')
}

/**
 * Сообщение об ошибке поля Vuetify (v-text-field :error-messages). Контейнер .v-messages
 * с role=alert есть у каждого поля всегда, поэтому «нет ошибки» проверяется через toBeEmpty().
 */
export function fieldError(page, label) {
  return page.locator('.v-input', { has: page.getByLabel(label) }).getByRole('alert')
}

/** Общая ошибка формы/страницы (v-alert). */
export function errorAlert(page) {
  return page.locator('.v-alert').filter({ hasText: /\S/ })
}

/** v-select — не <select>: открываем меню и выбираем пункт по заголовку. */
export async function selectScale(page, title) {
  // Клик по внутреннему input перехватывает .v-field__input, поэтому кликаем по полю целиком.
  await page.locator('.v-select', { has: page.getByLabel('Шкала оценки') }).locator('.v-field').click()
  await page.getByRole('option', { name: title, exact: true }).click()
}

/** Открыть диалог «Новая задача» на странице комнаты (только у владельца). */
export async function openTaskDialog(page) {
  await page.getByRole('button', { name: 'Задача', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Новая задача' })).toBeVisible()
  return dialog
}

/** Блок активного раунда на странице комнаты. */
export function activeRoundCard(page) {
  return page.getByTestId('active-round')
}

/** Блок результатов последнего завершённого раунда. */
export function resultCard(page) {
  return page.getByTestId('finished-round')
}

/** Чип участника в шапке комнаты; при отданном голосе получает класс active. */
export function memberChip(page, name) {
  return page.getByTestId('members').getByTestId('member').filter({ hasText: name })
}

/** Карточка значения шкалы (в блоке активного раунда или в блоке фиксации итога). */
export function voteCard(scope, value) {
  return scope.locator('.vote-card', { hasText: new RegExp(`^\\s*${escapeRegExp(value)}\\s*$`) })
}

/** Все строки списка «Задачи» в порядке отображения. */
export function taskRows(page) {
  return page.getByTestId('tasks').locator('.v-list-item')
}

/** Строка задачи в списке «Задачи». */
export function taskRow(page, title) {
  return taskRows(page).filter({ hasText: title })
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
