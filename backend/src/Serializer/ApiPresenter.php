<?php

declare(strict_types=1);

namespace App\Serializer;

use App\Entity\Room;
use App\Entity\Round;
use App\Entity\Task;
use App\Entity\User;
use App\Service\RoundService;

/** Преобразование сущностей в структуры JSON-ответов. */
class ApiPresenter
{
    public function __construct(private readonly RoundService $rounds)
    {
    }

    public function user(User $user): array
    {
        return [
            'id' => (string) $user->getId(),
            'email' => $user->getEmail(),
            'name' => $user->getName(),
        ];
    }

    public function room(Room $room, bool $withTasks = true): array
    {
        $data = [
            'id' => (string) $room->getId(),
            'name' => $room->getName(),
            'owner' => $this->user($room->getOwner()),
            'scale' => [
                'type' => $room->getScaleType()->value,
                'values' => $room->getScaleValues(),
                'votable' => $room->getVotableValues(),
                'numeric' => $room->isNumericScale(),
            ],
            'default_timer_sec' => $room->getDefaultTimerSec(),
            'invite_code' => $room->getInviteCode(),
            'created_at' => $room->getCreatedAt()->format(\DateTimeInterface::ATOM),
            'members' => array_map(
                fn ($member): array => $this->user($member->getUser()),
                $room->getMembers()->toArray(),
            ),
        ];

        if ($withTasks) {
            $data['tasks'] = array_map(fn (Task $task): array => $this->task($task), $room->getTasks()->toArray());
        }

        return $data;
    }

    public function task(Task $task): array
    {
        $lastRound = $task->getLastRound();

        return [
            'id' => (string) $task->getId(),
            'title' => $task->getTitle(),
            'description' => $task->getDescription(),
            'external_url' => $task->getExternalUrl(),
            'position' => $task->getPosition(),
            'status' => $task->getStatus()->value,
            'final_estimate' => $task->getFinalEstimate(),
            'created_at' => $task->getCreatedAt()->format(\DateTimeInterface::ATOM),
            'last_round' => $lastRound === null ? null : $this->round($lastRound),
        ];
    }

    /** Значения голосов раскрываются только у завершённого раунда (UC-07). */
    public function round(Round $round): array
    {
        $data = [
            'id' => (string) $round->getId(),
            'task' => (string) $round->getTask()->getId(),
            'status' => $round->getStatus()->value,
            'started_at' => $round->getStartedAt()->format(\DateTimeInterface::ATOM),
            'deadline_at' => $round->getDeadlineAt()->format(\DateTimeInterface::ATOM),
            'duration_sec' => $round->getDurationSec(),
            'finished_at' => $round->getFinishedAt()?->format(\DateTimeInterface::ATOM),
            'voted_user_ids' => $this->rounds->voterIds($round),
        ];

        if (!$round->isActive()) {
            $data['votes'] = array_map(
                fn ($vote): array => [
                    'user' => $this->user($vote->getUser()),
                    'value' => $vote->getValue(),
                ],
                $round->getVotes()->toArray(),
            );
            $data['stats'] = $this->rounds->statsFor($round);
        }

        return $data;
    }
}
