import { reactive } from 'vue'
import { api } from './api.js'

export const session = reactive({
  user: null,
  loaded: false,
})

export async function loadSession() {
  try {
    session.user = await api.me()
  } catch {
    session.user = null
  } finally {
    session.loaded = true
  }
}

export function setUser(user) {
  session.user = user
  session.loaded = true
}

export async function logout() {
  await api.logout().catch(() => {})
  session.user = null
}
