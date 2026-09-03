<?php

declare(strict_types=1);

namespace App\MessageHandler;

use App\Entity\Round;
use App\Message\FinishRoundMessage;
use App\Service\RoundService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;
use Symfony\Component\Uid\Uuid;

#[AsMessageHandler]
final readonly class FinishRoundHandler
{
    public function __construct(
        private EntityManagerInterface $em,
        private RoundService $rounds,
    ) {
    }

    public function __invoke(FinishRoundMessage $message): void
    {
        $round = $this->em->find(Round::class, Uuid::fromString($message->roundId));

        // Раунд удалён или уже остановлен вручную — делать нечего.
        if ($round === null || !$round->isActive()) {
            return;
        }

        $this->rounds->finish($round);
    }
}
