<?php

declare(strict_types=1);

namespace App\Message;

/** Отложенная остановка раунда по таймеру (UC-08). */
final readonly class FinishRoundMessage
{
    public function __construct(public string $roundId)
    {
    }
}
