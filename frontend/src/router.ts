import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { loadSession, session } from './lib/session'

declare module 'vue-router' {
  interface RouteMeta {
    /** Маршрут только для неавторизованных: вход и регистрация. */
    guest?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/rooms' },
  { path: '/login', name: 'login', component: () => import('./views/LoginView.vue'), meta: { guest: true } },
  { path: '/register', name: 'register', component: () => import('./views/RegisterView.vue'), meta: { guest: true } },
  { path: '/rooms', name: 'rooms', component: () => import('./views/RoomsView.vue') },
  { path: '/rooms/:id', name: 'room', component: () => import('./views/RoomView.vue'), props: true },
  { path: '/join/:code', name: 'join', component: () => import('./views/JoinView.vue'), props: true },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  if (!session.loaded) {
    await loadSession()
  }

  if (!to.meta.guest && !session.user) {
    // Ссылка-приглашение открывается после входа (UC-02, альтернатива 3а).
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.guest && session.user) {
    return { name: 'rooms' }
  }

  return true
})
