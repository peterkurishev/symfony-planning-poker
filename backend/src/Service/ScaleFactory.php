<?php

declare(strict_types=1);

namespace App\Service;

use App\Enum\ScaleType;
use App\Exception\DomainException;
use Symfony\Component\HttpFoundation\Response;

/** Разбор и валидация шкалы оценки (UC-05). */
class ScaleFactory
{
    private const MIN_VALUES = 2;
    private const MAX_VALUES = 30;
    private const MAX_VALUE_LENGTH = 10;

    /**
     * @param string|list<string>|null $rawValues
     *
     * @return array{ScaleType, list<string>|null}
     */
    public function create(?string $type, string|array|null $rawValues): array
    {
        $scaleType = ScaleType::tryFrom((string) $type)
            ?? throw new DomainException('Неизвестный тип шкалы', Response::HTTP_UNPROCESSABLE_ENTITY);

        if ($scaleType !== ScaleType::Custom) {
            return [$scaleType, null];
        }

        return [$scaleType, $this->normalizeCustomValues($rawValues)];
    }

    /**
     * @param string|list<string>|null $rawValues
     *
     * @return list<string>
     */
    public function normalizeCustomValues(string|array|null $rawValues): array
    {
        $items = is_string($rawValues)
            ? preg_split('/[\r\n,;]+/', $rawValues) ?: []
            : (array) $rawValues;

        $values = [];
        foreach ($items as $item) {
            $value = trim((string) $item);
            if ($value === '') {
                continue;
            }
            if (mb_strlen($value) > self::MAX_VALUE_LENGTH) {
                throw new DomainException(
                    sprintf('Значение «%s» длиннее %d символов', $value, self::MAX_VALUE_LENGTH),
                    Response::HTTP_UNPROCESSABLE_ENTITY,
                );
            }
            if (in_array($value, $values, true)) {
                throw new DomainException(
                    sprintf('Значение «%s» повторяется', $value),
                    Response::HTTP_UNPROCESSABLE_ENTITY,
                );
            }
            $values[] = $value;
        }

        $count = count($values);
        if ($count < self::MIN_VALUES || $count > self::MAX_VALUES) {
            throw new DomainException(
                sprintf('Произвольная шкала должна содержать от %d до %d значений', self::MIN_VALUES, self::MAX_VALUES),
                Response::HTTP_UNPROCESSABLE_ENTITY,
            );
        }

        return $values;
    }
}
