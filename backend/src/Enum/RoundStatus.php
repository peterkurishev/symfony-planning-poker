<?php

declare(strict_types=1);

namespace App\Enum;

enum RoundStatus: string
{
    case Active = 'active';
    case Finished = 'finished';
}
