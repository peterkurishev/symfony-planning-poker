<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Room;
use App\Repository\RoomRepository;
use App\Serializer\ApiPresenter;
use App\Service\InviteCodeGenerator;
use App\Service\RoomEventPublisher;
use App\Service\RoundService;
use App\Service\ScaleFactory;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
use Symfony\Component\Routing\Attribute\Route;

/** UC-03 Создание комнаты и присоединение по ссылке, UC-05 выбор шкалы. */
#[Route('/api/rooms')]
class RoomController extends AbstractApiController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly RoomRepository $rooms,
        private readonly ApiPresenter $presenter,
        private readonly ScaleFactory $scales,
        private readonly InviteCodeGenerator $codes,
        private readonly RoundService $rounds,
        private readonly RoomEventPublisher $events,
    ) {
    }

    #[Route('', name: 'api_rooms_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        return $this->json(array_map(
            fn (Room $room): array => $this->presenter->room($room, withTasks: false),
            $this->rooms->findForUser($this->currentUser()),
        ));
    }

    #[Route('', name: 'api_rooms_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = $this->payload($request);
        $name = trim((string) ($data['name'] ?? ''));
        if (mb_strlen($name) < 2 || mb_strlen($name) > 100) {
            throw new UnprocessableEntityHttpException('Название комнаты должно быть от 2 до 100 символов');
        }

        [$scaleType, $scaleValues] = $this->scales->create($data['scale_type'] ?? null, $data['scale_values'] ?? null);

        $room = new Room($name, $this->currentUser(), $scaleType, $scaleValues, $this->codes->generate());
        $room->setDefaultTimerSec($this->validTimer($data['default_timer_sec'] ?? Room::DEFAULT_TIMER_SEC));

        $this->em->persist($room);
        $this->em->flush();

        return $this->json($this->presenter->room($room), Response::HTTP_CREATED);
    }

    #[Route('/{id}', name: 'api_rooms_show', methods: ['GET'])]
    public function show(Room $room): JsonResponse
    {
        $this->denyUnlessMember($room);
        $this->rounds->finishExpired($room);

        return $this->json($this->presenter->room($room));
    }

    #[Route('/{id}', name: 'api_rooms_update', methods: ['PATCH'])]
    public function update(Room $room, Request $request): JsonResponse
    {
        $this->denyUnlessOwner($room);
        $this->rounds->finishExpired($room);
        $data = $this->payload($request);

        if (isset($data['name'])) {
            $name = trim((string) $data['name']);
            if (mb_strlen($name) < 2 || mb_strlen($name) > 100) {
                throw new UnprocessableEntityHttpException('Название комнаты должно быть от 2 до 100 символов');
            }
            $room->setName($name);
        }

        if (isset($data['scale_type'])) {
            if ($room->getActiveRound() !== null) {
                throw new UnprocessableEntityHttpException('Нельзя менять шкалу во время активного раунда');
            }
            [$scaleType, $scaleValues] = $this->scales->create($data['scale_type'], $data['scale_values'] ?? null);
            $room->setScale($scaleType, $scaleValues);
        }

        if (isset($data['default_timer_sec'])) {
            $room->setDefaultTimerSec($this->validTimer($data['default_timer_sec']));
        }

        $this->em->flush();
        $this->events->publish($room, 'room.updated', ['room' => (string) $room->getId()]);

        return $this->json($this->presenter->room($room));
    }

    /** Перегенерация ссылки-приглашения: старый код перестаёт действовать. */
    #[Route('/{id}/invite', name: 'api_rooms_reset_invite', methods: ['POST'])]
    public function resetInvite(Room $room): JsonResponse
    {
        $this->denyUnlessOwner($room);
        $room->setInviteCode($this->codes->generate());
        $this->em->flush();

        return $this->json(['invite_code' => $room->getInviteCode()]);
    }

    /** Присоединение по ссылке-приглашению. */
    #[Route('/join/{code}', name: 'api_rooms_join', methods: ['POST'])]
    public function join(string $code): JsonResponse
    {
        $room = $this->rooms->findByInviteCode($code)
            ?? throw new NotFoundHttpException('Комната не найдена');

        $user = $this->currentUser();
        if (!$room->hasMember($user)) {
            $member = $room->addMember($user);
            $this->em->persist($member);
            $this->em->flush();
            $this->events->publish($room, 'member.joined', ['user' => (string) $user->getId()]);
        }

        $this->rounds->finishExpired($room);

        return $this->json($this->presenter->room($room));
    }

    private function validTimer(mixed $value): int
    {
        $seconds = (int) $value;
        if ($seconds < Room::MIN_TIMER_SEC || $seconds > Room::MAX_TIMER_SEC) {
            throw new UnprocessableEntityHttpException(
                sprintf('Таймер должен быть от %d до %d секунд', Room::MIN_TIMER_SEC, Room::MAX_TIMER_SEC),
            );
        }

        return $seconds;
    }
}
