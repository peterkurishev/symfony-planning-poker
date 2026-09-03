const BASE = '/api'

export class ApiError extends Error {
  constructor(message, status, errors = null) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

async function request(method, path, body) {
  const response = await fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 204) return null

  const text = await response.text()
  const data = text ? JSON.parse(text) : null

  if (!response.ok) {
    const message = data?.message ?? data?.error ?? 'Не удалось выполнить запрос'
    throw new ApiError(message, response.status, data?.errors ?? null)
  }

  return data
}

export const api = {
  register: (payload) => request('POST', '/register', payload),
  login: (payload) => request('POST', '/login', payload),
  logout: () => request('POST', '/logout'),
  me: () => request('GET', '/me'),

  rooms: () => request('GET', '/rooms'),
  createRoom: (payload) => request('POST', '/rooms', payload),
  room: (id) => request('GET', `/rooms/${id}`),
  updateRoom: (id, payload) => request('PATCH', `/rooms/${id}`, payload),
  resetInvite: (id) => request('POST', `/rooms/${id}/invite`),
  joinRoom: (code) => request('POST', `/rooms/join/${code}`),

  createTask: (roomId, payload) => request('POST', `/rooms/${roomId}/tasks`, payload),
  updateTask: (id, payload) => request('PATCH', `/tasks/${id}`, payload),
  deleteTask: (id) => request('DELETE', `/tasks/${id}`),

  startRound: (taskId, payload) => request('POST', `/tasks/${taskId}/rounds`, payload),
  round: (id) => request('GET', `/rounds/${id}`),
  finishRound: (id) => request('POST', `/rounds/${id}/finish`),
  vote: (roundId, value) => request('POST', `/rounds/${roundId}/vote`, { value }),
  retractVote: (roundId) => request('DELETE', `/rounds/${roundId}/vote`),
  estimate: (taskId, finalEstimate) =>
    request('POST', `/tasks/${taskId}/estimate`, { final_estimate: finalEstimate }),
}
