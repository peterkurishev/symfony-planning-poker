import { ROOM_EVENT_NAMES, type RoomEventName } from '../types/api'

export type RoomEventHandler = (event: RoomEventName, payload: Record<string, unknown>) => void

interface EventEnvelope {
  event?: RoomEventName
  payload?: Record<string, unknown>
}

/**
 * Подписка на события комнаты (SSE). Возвращает функцию отписки.
 * Браузер сам переподключается при обрыве, поэтому достаточно обработчика onEvent.
 */
export function subscribeToRoom(roomId: string, onEvent: RoomEventHandler): () => void {
  const source = new EventSource(`/api/rooms/${roomId}/events`, { withCredentials: true })

  const handler = (message: MessageEvent<string>) => {
    let data: EventEnvelope
    try {
      data = JSON.parse(message.data) as EventEnvelope
    } catch {
      return
    }
    onEvent(data.event ?? (message.type as RoomEventName), data.payload ?? {})
  }

  ROOM_EVENT_NAMES.forEach((name) => source.addEventListener(name, handler))

  return () => {
    ROOM_EVENT_NAMES.forEach((name) => source.removeEventListener(name, handler))
    source.close()
  }
}
