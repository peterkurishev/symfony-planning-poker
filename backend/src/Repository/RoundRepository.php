<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Room;
use App\Entity\Round;
use App\Enum\RoundStatus;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<Round> */
class RoundRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Round::class);
    }

    /**
     * Активные раунды комнаты с истёкшим дедлайном.
     *
     * @return list<Round>
     */
    public function findExpiredActive(Room $room): array
    {
        return $this->createQueryBuilder('r')
            ->join('r.task', 't')
            ->andWhere('t.room = :room')
            ->andWhere('r.status = :status')
            ->andWhere('r.deadlineAt <= :now')
            ->setParameter('room', $room)
            ->setParameter('status', RoundStatus::Active)
            ->setParameter('now', new \DateTimeImmutable())
            ->getQuery()
            ->getResult();
    }
}
