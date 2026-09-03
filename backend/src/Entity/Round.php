<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\RoundStatus;
use App\Repository\RoundRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: RoundRepository::class)]
#[ORM\Table(name: 'rounds')]
#[ORM\Index(name: 'idx_rounds_task', columns: ['task_id'])]
#[ORM\Index(name: 'idx_rounds_status_deadline', columns: ['status', 'deadline_at'])]
class Round
{
    #[ORM\Id]
    #[ORM\Column(type: UuidType::NAME, unique: true)]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Task::class, inversedBy: 'rounds')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Task $task;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $startedAt;

    #[ORM\Column]
    private int $durationSec;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $deadlineAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $finishedAt = null;

    #[ORM\Column(length: 20, enumType: RoundStatus::class)]
    private RoundStatus $status = RoundStatus::Active;

    /** @var Collection<int, Vote> */
    #[ORM\OneToMany(targetEntity: Vote::class, mappedBy: 'round', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $votes;

    public function __construct(Task $task, int $durationSec, ?\DateTimeImmutable $startedAt = null)
    {
        $this->id = Uuid::v7();
        $this->task = $task;
        $this->durationSec = $durationSec;
        $this->startedAt = $startedAt ?? new \DateTimeImmutable();
        $this->deadlineAt = $this->startedAt->modify(sprintf('+%d seconds', $durationSec));
        $this->votes = new ArrayCollection();
        $task->addRound($this);
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getTask(): Task
    {
        return $this->task;
    }

    public function getStartedAt(): \DateTimeImmutable
    {
        return $this->startedAt;
    }

    public function getDurationSec(): int
    {
        return $this->durationSec;
    }

    public function getDeadlineAt(): \DateTimeImmutable
    {
        return $this->deadlineAt;
    }

    public function getFinishedAt(): ?\DateTimeImmutable
    {
        return $this->finishedAt;
    }

    public function getStatus(): RoundStatus
    {
        return $this->status;
    }

    public function isActive(): bool
    {
        return $this->status === RoundStatus::Active;
    }

    public function isExpired(?\DateTimeImmutable $now = null): bool
    {
        return ($now ?? new \DateTimeImmutable()) >= $this->deadlineAt;
    }

    public function finish(?\DateTimeImmutable $finishedAt = null): void
    {
        if (!$this->isActive()) {
            return;
        }
        $this->status = RoundStatus::Finished;
        $this->finishedAt = $finishedAt ?? new \DateTimeImmutable();
    }

    /** @return Collection<int, Vote> */
    public function getVotes(): Collection
    {
        return $this->votes;
    }

    public function addVote(User $user, string $value): Vote
    {
        foreach ($this->votes as $vote) {
            if ($vote->getUser()->getId()->equals($user->getId())) {
                $vote->setValue($value);

                return $vote;
            }
        }

        $vote = new Vote($this, $user, $value);
        $this->votes->add($vote);

        return $vote;
    }
}
