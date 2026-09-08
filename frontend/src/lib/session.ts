import { reactive } from 'vue'
import { api } from './api'
import type { User } from '../types/api'

interface SessionState {
  user: User | null
  loaded: boolean
}

export const session = reactive<SessionState>({
  user: null,
  loaded: false,
})

export async function loadSession(): Promise<void> {
  try {
    session.user = await api.me()
  } catch {
    session.user = null
  } finally {
    session.loaded = true
  }
}

export function setUser(user: User): void {
  session.user = user
  session.loaded = true
}

export async function logout(): Promise<void> {
  await api.logout().catch(() => {})
  session.user = null
}
