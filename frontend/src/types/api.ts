/** Типы ответов и запросов HTTP API (см. API.md и backend/src/Serializer/ApiPresenter.php). */

export type ScaleType = 'fibonacci' | 'pow2' | 'custom'
export type RoundStatus = 'active' | 'finished'
export type TaskStatus = 'pending' | 'estimating' | 'estimated'

export interface User {
  id: string
  email: string
  name: string
}

export interface Scale {
  type: ScaleType
  values: string[]
  /** Значения шкалы плюс служебные («?», «☕»). */
  votable: string[]
  numeric: boolean
}

export interface RoundStats {
  numeric: boolean
  total: number
  counted: number
  average: number | null
  median: number | null
  suggestion: string | null
  distribution: Record<string, number>
  mode: string | null
  spread: boolean
}

export interface Vote {
  user: User
  value: string
}

interface RoundBase {
  id: string
  task: string
  status: RoundStatus
  started_at: string
  deadline_at: string
  duration_sec: number
  finished_at: string | null
  voted_user_ids: string[]
}

/** У активного раунда значения голосов скрыты (UC-07). */
export interface ActiveRound extends RoundBase {
  status: 'active'
}

export interface FinishedRound extends RoundBase {
  status: 'finished'
  finished_at: string
  votes: Vote[]
  stats: RoundStats
}

export type Round = ActiveRound | FinishedRound

export interface Task {
  id: string
  title: string
  description: string | null
  external_url: string | null
  position: number
  status: TaskStatus
  final_estimate: string | null
  created_at: string
  last_round: Round | null
}

/** Комната в списке — без задач. */
export interface RoomSummary {
  id: string
  name: string
  owner: User
  scale: Scale
  default_timer_sec: number
  invite_code: string
  created_at: string
  members: User[]
}

export interface Room extends RoomSummary {
  tasks: Task[]
}

export interface RegisterPayload {
  email: string
  name: string
  password: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface CreateRoomPayload {
  name: string
  scale_type: ScaleType
  scale_values?: string | string[] | null
  default_timer_sec?: number
}

export type UpdateRoomPayload = Partial<CreateRoomPayload>

export interface CreateTaskPayload {
  title: string
  description?: string | null
  external_url?: string | null
}

export type UpdateTaskPayload = Partial<CreateTaskPayload>

export interface StartRoundPayload {
  duration_sec?: number
}

/** Ошибки валидации по полям формы. */
export type FieldErrors = Record<string, string>

export const ROOM_EVENT_NAMES = [
  'member.joined',
  'room.updated',
  'task.created',
  'task.updated',
  'task.deleted',
  'task.reordered',
  'round.started',
  'vote.cast',
  'vote.retracted',
  'round.all_voted',
  'round.finished',
  'task.estimated',
] as const

export type RoomEventName = (typeof ROOM_EVENT_NAMES)[number]
