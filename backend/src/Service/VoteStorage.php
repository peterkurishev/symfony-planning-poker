<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Round;
use Symfony\Component\Uid\Uuid;

/**
 * Голоса активного раунда живут в Redis и раскрываются только после завершения (UC-07, UC-08).
 */
class VoteStorage
{
    /** Запас времени, чтобы ключ пережил завершение раунда. */
    private const TTL_MARGIN_SEC = 300;

    public function __construct(private readonly \Redis $redis)
    {
    }

    public function put(Round $round, Uuid $userId, string $value): void
    {
        $key = $this->key($round);
        $this->redis->hSet($key, (string) $userId, $value);
        $this->redis->expire($key, $round->getDurationSec() + self::TTL_MARGIN_SEC);
    }

    public function remove(Round $round, Uuid $userId): void
    {
        $this->redis->hDel($this->key($round), (string) $userId);
    }

    /** @return array<string, string> user_id => значение */
    public function all(Round $round): array
    {
        $votes = $this->redis->hGetAll($this->key($round));

        return is_array($votes) ? $votes : [];
    }

    /** @return list<string> идентификаторы проголосовавших */
    public function voterIds(Round $round): array
    {
        return array_keys($this->all($round));
    }

    public function clear(Round $round): void
    {
        $this->redis->del($this->key($round));
    }

    private function key(Round $round): string
    {
        return sprintf('round:%s:votes', $round->getId());
    }
}
