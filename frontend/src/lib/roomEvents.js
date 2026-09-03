/**
 * Подписка на события комнаты (SSE). Возвращает функцию отписки.
 * Браузер сам переподключается при обрыве, поэтому достаточно обработчика onEvent.
 */
export function subscribeToRoom(roomId, onEvent) {
  const source = new EventSource(`/api/rooms/${roomId}/events`, { withCredentials: true })

  const names = [
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
  ]

  const handler = (message) => {
    let data = null
    try {
      data = JSON.parse(message.data)
    } catch {
      return
    }
    onEvent(data.event ?? message.type, data.payload ?? {})
  }

  names.forEach((name) => source.addEventListener(name, handler))

  return () => {
    names.forEach((name) => source.removeEventListener(name, handler))
    source.close()
  }
}
