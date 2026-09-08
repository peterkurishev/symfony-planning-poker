import type {
  CreateRoomPayload,
  CreateTaskPayload,
  FieldErrors,
  LoginPayload,
  RegisterPayload,
  Room,
  RoomSummary,
  Round,
  StartRoundPayload,
  Task,
  UpdateRoomPayload,
  UpdateTaskPayload,
  User,
} from '../types/api'

const BASE = '/api'

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

interface ErrorBody {
  message?: string
  error?: string
  errors?: FieldErrors
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: FieldErrors | null = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Текст ошибки для показа пользователю: из ApiError, Error или произвольного значения. */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return 'Не удалось выполнить запрос'
}

export function errorStatus(e: unknown): number | null {
  return e instanceof ApiError ? e.status : null
}

async function request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
  const response = await fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 204) return null as T

  const text = await response.text()
  const data: unknown = text ? JSON.parse(text) : null

  if (!response.ok) {
    const error = (data ?? {}) as ErrorBody
    const message = error.message ?? error.error ?? 'Не удалось выполнить запрос'
    throw new ApiError(message, response.status, error.errors ?? null)
  }

  return data as T
}

export const api = {
  register: (payload: RegisterPayload) => request<User>('POST', '/register', payload),
  login: (payload: LoginPayload) => request<User>('POST', '/login', payload),
  logout: () => request<null>('POST', '/logout'),
  me: () => request<User>('GET', '/me'),

  rooms: () => request<RoomSummary[]>('GET', '/rooms'),
  createRoom: (payload: CreateRoomPayload) => request<Room>('POST', '/rooms', payload),
  room: (id: string) => request<Room>('GET', `/rooms/${id}`),
  updateRoom: (id: string, payload: UpdateRoomPayload) =>
    request<Room>('PATCH', `/rooms/${id}`, payload),
  resetInvite: (id: string) => request<{ invite_code: string }>('POST', `/rooms/${id}/invite`),
  joinRoom: (code: string) => request<Room>('POST', `/rooms/join/${code}`),

  createTask: (roomId: string, payload: CreateTaskPayload) =>
    request<Task>('POST', `/rooms/${roomId}/tasks`, payload),
  updateTask: (id: string, payload: UpdateTaskPayload) =>
    request<Task>('PATCH', `/tasks/${id}`, payload),
  deleteTask: (id: string) => request<null>('DELETE', `/tasks/${id}`),

  startRound: (taskId: string, payload: StartRoundPayload) =>
    request<Round>('POST', `/tasks/${taskId}/rounds`, payload),
  round: (id: string) => request<Round>('GET', `/rounds/${id}`),
  finishRound: (id: string) => request<Round>('POST', `/rounds/${id}/finish`),
  vote: (roundId: string, value: string) =>
    request<Round>('POST', `/rounds/${roundId}/vote`, { value }),
  retractVote: (roundId: string) => request<Round>('DELETE', `/rounds/${roundId}/vote`),
  estimate: (taskId: string, finalEstimate: string) =>
    request<Task>('POST', `/tasks/${taskId}/estimate`, { final_estimate: finalEstimate }),
}
