<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Room;
use App\Entity\Round;
use App\Entity\Task;
use App\Entity\User;
use App\Enum\TaskStatus;
use App\Exception\DomainException;
use App\Message\FinishRoundMessage;
use App\Repository\RoundRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Messenger\MessageBusInterface;
use Symfony\Component\Messenger\Stamp\DelayStamp;
use Symfony\Component\Uid\Uuid;

/** Жизненный цикл раунда оценки (UC-06, UC-07, UC-08). */
class RoundService
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly RoundRepository $rounds,
        private readonly VoteStorage $voteStorage,
        private readonly EstimationStats $stats,
        private readonly RoomEventPublisher $events,
        private readonly MessageBusInterface $bus,
    ) {
    }

    /** UC-06: запуск раунда по задаче. */
    public function start(Task $task, ?int $durationSec): Round
    {
        $room = $task->getRoom();
        $this->finishExpired($room);

        if ($room->getActiveRound() !== null) {
            throw new DomainException('В комнате уже идёт оценка. Сначала остановите текущий раунд.');
        }

        $duration = $durationSec ?? $room->getDefaultTimerSec();
        if ($duration < Room::MIN_TIMER_SEC || $duration > Room::MAX_TIMER_SEC) {
            throw new DomainException(
                sprintf('Длительность раунда должна быть от %d до %d секунд', Room::MIN_TIMER_SEC, Room::MAX_TIMER_SEC),
                Response::HTTP_UNPROCESSABLE_ENTITY,
            );
        }

        $round = new Round($task, $duration);
        $task->setStatus(TaskStatus::Estimating);
        $this->em->persist($round);
        $this->em->flush();

        $this->bus->dispatch(new FinishRoundMessage((string) $round->getId()), [new DelayStamp($duration * 1000)]);

        $this->events->publish($room, 'round.started', [
            'round' => (string) $round->getId(),
            'task' => (string) $task->getId(),
            'deadline_at' => $round->getDeadlineAt()->format(\DateTimeInterface::ATOM),
            'scale' => $room->getVotableValues(),
        ]);

        return $round;
    }

    /** UC-07: голос участника. */
    public function vote(Round $round, User $user, string $value): void
    {
        $room = $round->getTask()->getRoom();

        if (!$round->isActive() || $round->isExpired()) {
            $this->finish($round);

            throw new DomainException('Раунд уже завершён');
        }

        if (!in_array($value, $room->getVotableValues(), true)) {
            throw new DomainException('Значение не входит в шкалу комнаты', Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $this->voteStorage->put($round, $user->getId(), $value);

        $this->events->publish($room, 'vote.cast', [
            'round' => (string) $round->getId(),
            'user' => (string) $user->getId(),
        ]);

        if ($this->allVoted($round)) {
            $this->events->publish($room, 'round.all_voted', ['round' => (string) $round->getId()]);
        }
    }

    /** UC-07: отмена голоса. */
    public function retractVote(Round $round, User $user): void
    {
        if (!$round->isActive() || $round->isExpired()) {
            throw new DomainException('Раунд уже завершён');
        }

        $this->voteStorage->remove($round, $user->getId());
        $this->events->publish($round->getTask()->getRoom(), 'vote.retracted', [
            'round' => (string) $round->getId(),
            'user' => (string) $user->getId(),
        ]);
    }

    /** UC-08: завершение раунда — по таймеру или вручную. Идемпотентно. */
    public function finish(Round $round): Round
    {
        if (!$round->isActive()) {
            return $round;
        }

        $stored = $this->voteStorage->all($round);
        foreach ($stored as $userId => $value) {
            $user = $this->em->find(User::class, Uuid::fromString($userId));
            if ($user !== null) {
                $vote = $round->addVote($user, $value);
                $this->em->persist($vote);
            }
        }

        $round->finish();
        $this->em->flush();
        $this->voteStorage->clear($round);

        $room = $round->getTask()->getRoom();
        $this->events->publish($room, 'round.finished', [
            'round' => (string) $round->getId(),
            'task' => (string) $round->getTask()->getId(),
            'stats' => $this->statsFor($round),
        ]);

        return $round;
    }

    /** UC-08: фиксация итоговой оценки владельцем. */
    public function finalize(Task $task, string $estimate): void
    {
        $room = $task->getRoom();
        if (!in_array($estimate, $room->getScaleValues(), true)) {
            throw new DomainException('Итоговая оценка должна быть значением шкалы', Response::HTTP_UNPROCESSABLE_ENTITY);
        }
        if ($task->getActiveRound() !== null) {
            throw new DomainException('Сначала остановите раунд');
        }

        $task->setFinalEstimate($estimate);
        $this->em->flush();

        $this->events->publish($room, 'task.estimated', [
            'task' => (string) $task->getId(),
            'final_estimate' => $estimate,
        ]);
    }

    /** Ленивое завершение просроченных раундов на случай сбоя воркера (UC-08). */
    public function finishExpired(Room $room): void
    {
        foreach ($this->rounds->findExpiredActive($room) as $round) {
            $this->finish($round);
        }
    }

    /** @return array<string, mixed> */
    public function statsFor(Round $round): array
    {
        $room = $round->getTask()->getRoom();

        if ($round->isActive()) {
            $votes = $this->voteStorage->all($round);
        } else {
            $votes = [];
            foreach ($round->getVotes() as $vote) {
                $votes[(string) $vote->getUser()->getId()] = $vote->getValue();
            }
        }

        return $this->stats->calculate($room, $votes);
    }

    /** @return list<string> идентификаторы проголосовавших, без значений */
    public function voterIds(Round $round): array
    {
        if ($round->isActive()) {
            return $this->voteStorage->voterIds($round);
        }

        return array_map(
            static fn ($vote): string => (string) $vote->getUser()->getId(),
            $round->getVotes()->toArray(),
        );
    }

    private function allVoted(Round $round): bool
    {
        $members = $round->getTask()->getRoom()->getMembers()->count();

        return $members > 0 && count($this->voteStorage->voterIds($round)) >= $members;
    }
}
