<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\RoundStatus;
use App\Enum\TaskStatus;
use App\Repository\TaskRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: TaskRepository::class)]
#[ORM\Table(name: 'tasks')]
#[ORM\Index(name: 'idx_tasks_room_position', columns: ['room_id', 'position'])]
class Task
{
    #[ORM\Id]
    #[ORM\Column(type: UuidType::NAME, unique: true)]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Room::class, inversedBy: 'tasks')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Room $room;

    #[ORM\Column(length: 200)]
    private string $title;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    private ?string $description = null;

    #[ORM\Column(length: 2048, nullable: true)]
    private ?string $externalUrl = null;

    #[ORM\Column]
    private int $position;

    #[ORM\Column(length: 20, enumType: TaskStatus::class)]
    private TaskStatus $status = TaskStatus::Pending;

    #[ORM\Column(length: 10, nullable: true)]
    private ?string $finalEstimate = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    /** @var Collection<int, Round> */
    #[ORM\OneToMany(targetEntity: Round::class, mappedBy: 'task', cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['startedAt' => 'DESC'])]
    private Collection $rounds;

    public function __construct(Room $room, string $title, int $position)
    {
        $this->id = Uuid::v7();
        $this->room = $room;
        $this->title = $title;
        $this->position = $position;
        $this->createdAt = new \DateTimeImmutable();
        $this->rounds = new ArrayCollection();
        $room->addTask($this);
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getRoom(): Room
    {
        return $this->room;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function setTitle(string $title): void
    {
        $this->title = $title;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): void
    {
        $this->description = $description;
    }

    public function getExternalUrl(): ?string
    {
        return $this->externalUrl;
    }

    public function setExternalUrl(?string $externalUrl): void
    {
        $this->externalUrl = $externalUrl;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    public function setPosition(int $position): void
    {
        $this->position = $position;
    }

    public function getStatus(): TaskStatus
    {
        return $this->status;
    }

    public function setStatus(TaskStatus $status): void
    {
        $this->status = $status;
    }

    public function getFinalEstimate(): ?string
    {
        return $this->finalEstimate;
    }

    public function setFinalEstimate(?string $finalEstimate): void
    {
        $this->finalEstimate = $finalEstimate;
        $this->status = $finalEstimate === null ? TaskStatus::Pending : TaskStatus::Estimated;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    /** @return Collection<int, Round> */
    public function getRounds(): Collection
    {
        return $this->rounds;
    }

    public function addRound(Round $round): void
    {
        if (!$this->rounds->contains($round)) {
            $this->rounds->add($round);
        }
    }

    public function getActiveRound(): ?Round
    {
        foreach ($this->rounds as $round) {
            if ($round->getStatus() === RoundStatus::Active) {
                return $round;
            }
        }

        return null;
    }

    public function getLastRound(): ?Round
    {
        return $this->rounds->first() ?: null;
    }
}
