<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\ScaleType;
use App\Repository\RoomRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Types\UuidType;
use Symfony\Component\Uid\Uuid;

#[ORM\Entity(repositoryClass: RoomRepository::class)]
#[ORM\Table(name: 'rooms')]
#[ORM\UniqueConstraint(name: 'uniq_rooms_invite_code', columns: ['invite_code'])]
class Room
{
    public const DEFAULT_TIMER_SEC = 60;
    public const MIN_TIMER_SEC = 10;
    public const MAX_TIMER_SEC = 1800;

    #[ORM\Id]
    #[ORM\Column(type: UuidType::NAME, unique: true)]
    private Uuid $id;

    #[ORM\Column(length: 100)]
    private string $name;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $owner;

    #[ORM\Column(length: 20, enumType: ScaleType::class)]
    private ScaleType $scaleType;

    /** @var list<string>|null Значения произвольной шкалы; для предустановленных — null. */
    #[ORM\Column(type: Types::JSON, nullable: true)]
    private ?array $scaleValues = null;

    #[ORM\Column]
    private int $defaultTimerSec = self::DEFAULT_TIMER_SEC;

    #[ORM\Column(length: 16)]
    private string $inviteCode;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private \DateTimeImmutable $createdAt;

    /** @var Collection<int, RoomMember> */
    #[ORM\OneToMany(targetEntity: RoomMember::class, mappedBy: 'room', cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $members;

    /** @var Collection<int, Task> */
    #[ORM\OneToMany(targetEntity: Task::class, mappedBy: 'room', cascade: ['persist', 'remove'], orphanRemoval: true)]
    #[ORM\OrderBy(['position' => 'ASC'])]
    private Collection $tasks;

    public function __construct(string $name, User $owner, ScaleType $scaleType, ?array $scaleValues, string $inviteCode)
    {
        $this->id = Uuid::v7();
        $this->name = $name;
        $this->owner = $owner;
        $this->scaleType = $scaleType;
        $this->scaleValues = $scaleType === ScaleType::Custom ? $scaleValues : null;
        $this->inviteCode = $inviteCode;
        $this->createdAt = new \DateTimeImmutable();
        $this->members = new ArrayCollection();
        $this->tasks = new ArrayCollection();
        $this->addMember($owner);
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getOwner(): User
    {
        return $this->owner;
    }

    public function isOwnedBy(User $user): bool
    {
        return $this->owner->getId()->equals($user->getId());
    }

    public function getScaleType(): ScaleType
    {
        return $this->scaleType;
    }

    public function setScale(ScaleType $scaleType, ?array $scaleValues): void
    {
        $this->scaleType = $scaleType;
        $this->scaleValues = $scaleType === ScaleType::Custom ? $scaleValues : null;
    }

    /**
     * Полный список значений шкалы (без служебных).
     *
     * @return list<string>
     */
    public function getScaleValues(): array
    {
        return $this->scaleType->presetValues() ?? $this->scaleValues ?? [];
    }

    /** Все допустимые для голосования значения, включая служебные. */
    public function getVotableValues(): array
    {
        return [...$this->getScaleValues(), ...ScaleType::SPECIAL_VALUES];
    }

    public function isNumericScale(): bool
    {
        $values = $this->getScaleValues();
        if ($values === []) {
            return false;
        }
        foreach ($values as $value) {
            if (!is_numeric($value)) {
                return false;
            }
        }

        return true;
    }

    public function getDefaultTimerSec(): int
    {
        return $this->defaultTimerSec;
    }

    public function setDefaultTimerSec(int $seconds): void
    {
        $this->defaultTimerSec = $seconds;
    }

    public function getInviteCode(): string
    {
        return $this->inviteCode;
    }

    public function setInviteCode(string $inviteCode): void
    {
        $this->inviteCode = $inviteCode;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    /** @return Collection<int, RoomMember> */
    public function getMembers(): Collection
    {
        return $this->members;
    }

    public function hasMember(User $user): bool
    {
        return $this->findMember($user) !== null;
    }

    public function findMember(User $user): ?RoomMember
    {
        foreach ($this->members as $member) {
            if ($member->getUser()->getId()->equals($user->getId())) {
                return $member;
            }
        }

        return null;
    }

    public function addMember(User $user): RoomMember
    {
        if ($existing = $this->findMember($user)) {
            return $existing;
        }

        $member = new RoomMember($this, $user);
        $this->members->add($member);

        return $member;
    }

    /** @return Collection<int, Task> */
    public function getTasks(): Collection
    {
        return $this->tasks;
    }

    public function addTask(Task $task): void
    {
        if (!$this->tasks->contains($task)) {
            $this->tasks->add($task);
        }
    }

    public function removeTask(Task $task): void
    {
        $this->tasks->removeElement($task);
    }

    public function getActiveRound(): ?Round
    {
        foreach ($this->tasks as $task) {
            if ($round = $task->getActiveRound()) {
                return $round;
            }
        }

        return null;
    }
}
