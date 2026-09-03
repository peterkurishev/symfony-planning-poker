<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Room;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Доставка событий комнаты в браузер через Server-Sent Events.
 * Источник — поток Redis, который наполняет RoomEventPublisher.
 */
#[Route('/api')]
class EventStreamController extends AbstractApiController
{
    private const BLOCK_MS = 15000;
    private const MAX_LIFETIME_SEC = 900;

    public function __construct(private readonly \Redis $redis)
    {
    }

    #[Route('/rooms/{id}/events', name: 'api_rooms_events', methods: ['GET'])]
    public function events(Room $room): StreamedResponse
    {
        $this->denyUnlessMember($room);

        // Освобождаем блокировку сессии, иначе долгий стрим заморозит остальные запросы вкладки.
        $this->container->get('request_stack')->getSession()->save();

        $streamKey = sprintf('room:%s:events', $room->getId());
        $redis = $this->redis;

        $response = new StreamedResponse(static function () use ($redis, $streamKey): void {
            $lastId = '$';
            $startedAt = time();

            echo "retry: 3000\n\n";
            flush();

            while (time() - $startedAt < self::MAX_LIFETIME_SEC) {
                if (connection_aborted() === 1) {
                    return;
                }

                $result = $redis->xRead([$streamKey => $lastId], 20, self::BLOCK_MS);

                if (!is_array($result) || $result === []) {
                    // Комментарий-пульс держит соединение живым через прокси.
                    echo ": keep-alive\n\n";
                    flush();

                    continue;
                }

                foreach ($result[$streamKey] ?? [] as $id => $fields) {
                    $lastId = (string) $id;
                    $data = [
                        'event' => $fields['event'] ?? 'unknown',
                        'at' => $fields['at'] ?? null,
                        'payload' => json_decode((string) ($fields['payload'] ?? '{}'), true),
                    ];
                    printf(
                        "id: %s\nevent: %s\ndata: %s\n\n",
                        $lastId,
                        $data['event'],
                        json_encode($data, \JSON_UNESCAPED_UNICODE),
                    );
                    flush();
                }
            }
        });

        $response->headers->set('Content-Type', 'text/event-stream');
        $response->headers->set('Cache-Control', 'no-cache');
        $response->headers->set('X-Accel-Buffering', 'no');
        $response->setStatusCode(Response::HTTP_OK);

        return $response;
    }
}
