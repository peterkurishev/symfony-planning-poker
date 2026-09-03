<?php

declare(strict_types=1);

namespace App\Enum;

enum TaskStatus: string
{
    case Pending = 'pending';
    case Estimating = 'estimating';
    case Estimated = 'estimated';
}
