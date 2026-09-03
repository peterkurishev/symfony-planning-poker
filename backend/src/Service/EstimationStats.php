<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Room;
use App\Enum\ScaleType;

/** Статистика по голосам раунда (UC-05, UC-08). */
class EstimationStats
{
    /**
     * @param array<string, string> $votes user_id => значение
     *
     * @return array{
     *     numeric: bool,
     *     total: int,
     *     counted: int,
     *     average: float|null,
     *     median: float|null,
     *     suggestion: string|null,
     *     distribution: array<string, int>,
     *     mode: string|null,
     *     spread: bool
     * }
     */
    public function calculate(Room $room, array $votes): array
    {
        $distribution = [];
        foreach ($votes as $value) {
            $distribution[$value] = ($distribution[$value] ?? 0) + 1;
        }
        arsort($distribution);

        $numbers = [];
        foreach ($votes as $value) {
            if (!in_array($value, ScaleType::SPECIAL_VALUES, true) && is_numeric($value)) {
                $numbers[] = (float) $value;
            }
        }
        sort($numbers);

        $isNumeric = $room->isNumericScale() && $numbers !== [];
        $average = $isNumeric ? round(array_sum($numbers) / count($numbers), 1) : null;
        $median = $isNumeric ? $this->median($numbers) : null;
        $mode = $distribution === [] ? null : (string) array_key_first($distribution);

        return [
            'numeric' => $isNumeric,
            'total' => count($votes),
            'counted' => count($numbers),
            'average' => $average,
            'median' => $median,
            'suggestion' => $median !== null ? $this->closestScaleValue($room, $median) : $mode,
            'distribution' => $distribution,
            'mode' => $mode,
            'spread' => $this->hasWideSpread($room, $votes),
        ];
    }

    /** @param list<float> $numbers отсортированные значения */
    private function median(array $numbers): float
    {
        $count = count($numbers);
        $middle = intdiv($count, 2);

        return $count % 2 === 1
            ? $numbers[$middle]
            : round(($numbers[$middle - 1] + $numbers[$middle]) / 2, 1);
    }

    private function closestScaleValue(Room $room, float $target): ?string
    {
        $best = null;
        $bestDistance = null;
        foreach ($room->getScaleValues() as $value) {
            if (!is_numeric($value)) {
                continue;
            }
            $distance = abs((float) $value - $target);
            if ($bestDistance === null || $distance < $bestDistance) {
                $best = $value;
                $bestDistance = $distance;
            }
        }

        return $best;
    }

    /** Голоса расходятся более чем на 2 позиции шкалы (UC-08). */
    private function hasWideSpread(Room $room, array $votes): bool
    {
        $scale = $room->getScaleValues();
        $positions = [];
        foreach ($votes as $value) {
            $index = array_search($value, $scale, true);
            if ($index !== false) {
                $positions[] = $index;
            }
        }

        return count($positions) > 1 && (max($positions) - min($positions)) > 2;
    }
}
