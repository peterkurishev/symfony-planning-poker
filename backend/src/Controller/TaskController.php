<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Room;
use App\Entity\Task;
use App\Repository\TaskRepository;
use App\Serializer\ApiPresenter;
use App\Service\RoomEventPublisher;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Uid\Uuid;

/** UC-04 Создание задачи на оценку. */
#[Route('/api')]
class TaskController extends AbstractApiController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly TaskRepository $tasks,
        private readonly ApiPresenter $presenter,
        private readonly RoomEventPublisher $events,
    ) {
    }

    #[Route('/rooms/{id}/tasks', name: 'api_tasks_create', methods: ['POST'])]
    public function create(Room $room, Request $request): JsonResponse
    {
        $this->denyUnlessOwner($room);
        $data = $this->payload($request);

        $task = new Task($room, $this->validTitle($data['title'] ?? ''), $this->tasks->nextPosition($room));
        $task->setDescription($this->validDescription($data['description'] ?? null));
        $task->setExternalUrl($this->validUrl($data['external_url'] ?? null));

        $this->em->persist($task);
        $this->em->flush();
        $this->events->publish($room, 'task.created', ['task' => (string) $task->getId()]);

        return $this->json($this->presenter->task($task), Response::HTTP_CREATED);
    }

    #[Route('/tasks/{id}', name: 'api_tasks_update', methods: ['PATCH'])]
    public function update(Task $task, Request $request): JsonResponse
    {
        $room = $task->getRoom();
        $this->denyUnlessOwner($room);

        if ($task->getActiveRound() !== null) {
            throw new UnprocessableEntityHttpException('Нельзя менять задачу во время активного раунда');
        }

        $data = $this->payload($request);
        if (isset($data['title'])) {
            $task->setTitle($this->validTitle($data['title']));
        }
        if (array_key_exists('description', $data)) {
            $task->setDescription($this->validDescription($data['description']));
        }
        if (array_key_exists('external_url', $data)) {
            $task->setExternalUrl($this->validUrl($data['external_url']));
        }

        $this->em->flush();
        $this->events->publish($room, 'task.updated', ['task' => (string) $task->getId()]);

        return $this->json($this->presenter->task($task));
    }

    #[Route('/tasks/{id}', name: 'api_tasks_delete', methods: ['DELETE'])]
    public function delete(Task $task): JsonResponse
    {
        $room = $task->getRoom();
        $this->denyUnlessOwner($room);

        if ($task->getActiveRound() !== null) {
            throw new UnprocessableEntityHttpException('Нельзя удалить задачу во время активного раунда');
        }

        $id = (string) $task->getId();
        $room->removeTask($task);
        $this->em->remove($task);
        $this->em->flush();
        $this->events->publish($room, 'task.deleted', ['task' => $id]);

        return $this->json(null, Response::HTTP_NO_CONTENT);
    }

    /** Изменение порядка задач: передаётся полный список идентификаторов. */
    #[Route('/rooms/{id}/tasks/reorder', name: 'api_tasks_reorder', methods: ['POST'])]
    public function reorder(Room $room, Request $request): JsonResponse
    {
        $this->denyUnlessOwner($room);
        $ids = (array) ($this->payload($request)['task_ids'] ?? []);

        $byId = [];
        foreach ($room->getTasks() as $task) {
            $byId[(string) $task->getId()] = $task;
        }

        $position = 0;
        foreach ($ids as $rawId) {
            $id = Uuid::isValid((string) $rawId) ? (string) Uuid::fromString((string) $rawId) : null;
            if ($id === null || !isset($byId[$id])) {
                throw new UnprocessableEntityHttpException('Список содержит задачу не из этой комнаты');
            }
            $byId[$id]->setPosition($position++);
        }

        $this->em->flush();
        $this->events->publish($room, 'task.reordered', ['task_ids' => array_values($ids)]);

        return $this->json($this->presenter->room($room));
    }

    private function validTitle(mixed $value): string
    {
        $title = trim((string) $value);
        if ($title === '' || mb_strlen($title) > 200) {
            throw new UnprocessableEntityHttpException('Название задачи должно быть от 1 до 200 символов');
        }

        return $title;
    }

    private function validDescription(mixed $value): ?string
    {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }
        $description = trim((string) $value);
        if (mb_strlen($description) > 5000) {
            throw new UnprocessableEntityHttpException('Описание не должно превышать 5000 символов');
        }

        return $description;
    }

    private function validUrl(mixed $value): ?string
    {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }
        $url = trim((string) $value);
        if (filter_var($url, \FILTER_VALIDATE_URL) === false) {
            throw new UnprocessableEntityHttpException('Ссылка должна быть корректным URL');
        }

        return $url;
    }
}
