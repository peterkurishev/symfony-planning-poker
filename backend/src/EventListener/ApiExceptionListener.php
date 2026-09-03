<?php

declare(strict_types=1);

namespace App\EventListener;

use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

/** Ошибки под /api отдаются в JSON. */
#[AsEventListener(event: 'kernel.exception')]
final readonly class ApiExceptionListener
{
    public function __construct(private bool $debug = false)
    {
    }

    public function __invoke(ExceptionEvent $event): void
    {
        if (!str_starts_with($event->getRequest()->getPathInfo(), '/api')) {
            return;
        }

        $exception = $event->getThrowable();
        $status = $exception instanceof HttpExceptionInterface
            ? $exception->getStatusCode()
            : Response::HTTP_INTERNAL_SERVER_ERROR;

        $message = $exception instanceof HttpExceptionInterface || $this->debug
            ? $exception->getMessage()
            : 'Внутренняя ошибка сервера';

        $event->setResponse(new JsonResponse(['message' => $message], $status));
    }
}
