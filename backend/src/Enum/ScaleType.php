<?php

declare(strict_types=1);

namespace App\Enum;

enum ScaleType: string
{
    case Fibonacci = 'fibonacci';
    case Pow2 = 'pow2';
    case Custom = 'custom';

    /** Служебные значения, не участвующие в расчёте статистики. */
    public const SPECIAL_VALUES = ['?', '☕'];

    /**
     * Предустановленные значения шкалы. Для произвольной шкалы — null.
     *
     * @return list<string>|null
     */
    public function presetValues(): ?array
    {
        return match ($this) {
            self::Fibonacci => ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89'],
            self::Pow2 => ['1', '2', '4', '8', '16', '32', '64'],
            self::Custom => null,
        };
    }
}
