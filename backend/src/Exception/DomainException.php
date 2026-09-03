<?php

declare(strict_types=1);

namespace App\Exception;

use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpFoundation\Response;

/** Нарушение бизнес-правила: отдаётся клиенту как 409 или указанный код. */
class DomainException extends HttpException
{
    public function __construct(string $message, int $statusCode = Response::HTTP_CONFLICT)
    {
        parent::__construct($statusCode, $message);
    }
}
