<?php

declare(strict_types=1);

namespace App\Service;

class InviteCodeGenerator
{
    private const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    private const LENGTH = 12;

    public function generate(): string
    {
        $max = strlen(self::ALPHABET) - 1;
        $code = '';
        for ($i = 0; $i < self::LENGTH; ++$i) {
            $code .= self::ALPHABET[random_int(0, $max)];
        }

        return $code;
    }
}
