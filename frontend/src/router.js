import { createRouter, createWebHistory } from 'vue-router'
import { loadSession, session } from './lib/session.js'

const routes = [
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
