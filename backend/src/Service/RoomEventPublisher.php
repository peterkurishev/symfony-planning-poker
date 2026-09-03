<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Room;
use Psr\Log\LoggerInterface;

/**
 * Публикация событий комнаты для realtime-клиентов.
 * Пока события складываются в Redis Stream; транспорт до браузера (Mercure/WebSocket)
 * подключается на следующем шаге и читает тот же поток.
 */
class RoomEventPublisher
{
    private const MAX_STREAM_LENGTH = 1000;

    public function __construct(
        private readonly \Redis $redis,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function publish(Room $room, string $event, array $payload = []): void
    {
        $message = [
            'event' => $event,
            'room' => (string) $room->getId(),
            'at' => (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
            'payload' => json_encode($payload, \JSON_THROW_ON_ERROR | \JSON_UNESCAPED_UNICODE),
        ];

        try {
            $this->redis->xAdd(
                sprintf('room:%s:events', $room->getId()),
                '*',
                $message,
                self::MAX_STREAM_LENGTH,
                true,
            );
        } catch (\Throwable $e) {
            $this->logger->error('Не удалось опубликовать событие комнаты', [
                'event' => $event,
                'room' => (string) $room->getId(),
                'exception' => $e,
            ]);
        }
    }
}
