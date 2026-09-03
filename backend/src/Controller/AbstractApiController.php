<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Room;
use App\Entity\User;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

abstract class AbstractApiController extends AbstractController
{
    /** @return array<string, mixed> */
    protected function payload(Request $request): array
    {
        if ($request->getContent() === '') {
            return [];
        }

        try {
            $data = $request->toArray();
        } catch (\JsonException|\Throwable) {
            throw new BadRequestHttpException('Тело запроса должно быть корректным JSON');
        }

        return $data;
    }

    protected function currentUser(): User
    {
        $user = $this->getUser();
        \assert($user instanceof User);

        return $user;
    }

    protected function denyUnlessMember(Room $room): void
    {
        if (!$room->hasMember($this->currentUser())) {
            throw new AccessDeniedHttpException('Вы не участник этой комнаты');
        }
    }

    protected function denyUnlessOwner(Room $room): void
    {
        if (!$room->isOwnedBy($this->currentUser())) {
            throw new AccessDeniedHttpException('Действие доступно только владельцу комнаты');
        }
    }
}
