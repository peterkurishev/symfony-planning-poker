<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Round;
use App\Entity\Task;
use App\Serializer\ApiPresenter;
use App\Service\RoundService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
use Symfony\Component\Routing\Attribute\Route;

/** UC-06 Запуск оценки, UC-07 голосование, UC-08 остановка и фиксация итога. */
#[Route('/api')]
class RoundController extends AbstractApiController
{
    public function __construct(
        private readonly RoundService $rounds,
        private readonly ApiPresenter $presenter,
    ) {
    }

    #[Route('/tasks/{id}/rounds', name: 'api_rounds_start', methods: ['POST'])]
    public function start(Task $task, Request $request): JsonResponse
    {
        $this->denyUnlessOwner($task->getRoom());
        $data = $this->payload($request);
        $duration = isset($data['duration_sec']) ? (int) $data['duration_sec'] : null;

        $round = $this->rounds->start($task, $duration);

        return $this->json($this->presenter->round($round), Response::HTTP_CREATED);
    }

    #[Route('/rounds/{id}', name: 'api_rounds_show', methods: ['GET'])]
    public function show(Round $round): JsonResponse
    {
        $this->denyUnlessMember($round->getTask()->getRoom());

        if ($round->isActive() && $round->isExpired()) {
            $this->rounds->finish($round);
        }

        return $this->json($this->presenter->round($round));
    }

    /** Досрочная остановка владельцем. */
    #[Route('/rounds/{id}/finish', name: 'api_rounds_finish', methods: ['POST'])]
    public function finish(Round $round): JsonResponse
    {
        $this->denyUnlessOwner($round->getTask()->getRoom());

        return $this->json($this->presenter->round($this->rounds->finish($round)));
    }

    #[Route('/rounds/{id}/vote', name: 'api_rounds_vote', methods: ['POST'])]
    public function vote(Round $round, Request $request): JsonResponse
    {
        $this->denyUnlessMember($round->getTask()->getRoom());
        $value = $this->payload($request)['value'] ?? null;
        if (!is_scalar($value) || trim((string) $value) === '') {
            throw new UnprocessableEntityHttpException('Укажите значение оценки');
        }

        $this->rounds->vote($round, $this->currentUser(), (string) $value);

        return $this->json($this->presenter->round($round));
    }

    #[Route('/rounds/{id}/vote', name: 'api_rounds_retract', methods: ['DELETE'])]
    public function retract(Round $round): JsonResponse
    {
        $this->denyUnlessMember($round->getTask()->getRoom());
        $this->rounds->retractVote($round, $this->currentUser());

        return $this->json($this->presenter->round($round));
    }

    /** Фиксация итоговой оценки задачи владельцем. */
    #[Route('/tasks/{id}/estimate', name: 'api_tasks_estimate', methods: ['POST'])]
    public function estimate(Task $task, Request $request): JsonResponse
    {
        $this->denyUnlessOwner($task->getRoom());
        $estimate = $this->payload($request)['final_estimate'] ?? null;
        if (!is_scalar($estimate) || trim((string) $estimate) === '') {
            throw new UnprocessableEntityHttpException('Укажите итоговую оценку');
        }

        $this->rounds->finalize($task, (string) $estimate);

        return $this->json($this->presenter->task($task));
    }
}
