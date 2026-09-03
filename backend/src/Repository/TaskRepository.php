<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Room;
use App\Entity\Task;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<Task> */
class TaskRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Task::class);
    }

    public function nextPosition(Room $room): int
    {
        $max = $this->createQueryBuilder('t')
            ->select('MAX(t.position)')
            ->andWhere('t.room = :room')
            ->setParameter('room', $room)
            ->getQuery()
            ->getSingleScalarResult();

        return $max === null ? 0 : (int) $max + 1;
    }
}
