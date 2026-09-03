<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260903202142 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE room_members (id UUID NOT NULL, joined_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, room_id UUID NOT NULL, user_id UUID NOT NULL, PRIMARY KEY (id))');
        $this->addSql('CREATE INDEX IDX_A9826E1F54177093 ON room_members (room_id)');
        $this->addSql('CREATE INDEX IDX_A9826E1FA76ED395 ON room_members (user_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_room_members_room_user ON room_members (room_id, user_id)');
        $this->addSql('CREATE TABLE rooms (id UUID NOT NULL, name VARCHAR(100) NOT NULL, scale_type VARCHAR(20) NOT NULL, scale_values JSON DEFAULT NULL, default_timer_sec INT NOT NULL, invite_code VARCHAR(16) NOT NULL, created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, owner_id UUID NOT NULL, PRIMARY KEY (id))');
        $this->addSql('CREATE INDEX IDX_7CA11A967E3C61F9 ON rooms (owner_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_rooms_invite_code ON rooms (invite_code)');
        $this->addSql('CREATE TABLE rounds (id UUID NOT NULL, started_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, duration_sec INT NOT NULL, deadline_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, finished_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL, status VARCHAR(20) NOT NULL, task_id UUID NOT NULL, PRIMARY KEY (id))');
        $this->addSql('CREATE INDEX idx_rounds_task ON rounds (task_id)');
        $this->addSql('CREATE INDEX idx_rounds_status_deadline ON rounds (status, deadline_at)');
        $this->addSql('CREATE TABLE tasks (id UUID NOT NULL, title VARCHAR(200) NOT NULL, description TEXT DEFAULT NULL, external_url VARCHAR(2048) DEFAULT NULL, position INT NOT NULL, status VARCHAR(20) NOT NULL, final_estimate VARCHAR(10) DEFAULT NULL, created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, room_id UUID NOT NULL, PRIMARY KEY (id))');
        $this->addSql('CREATE INDEX IDX_5058659754177093 ON tasks (room_id)');
        $this->addSql('CREATE INDEX idx_tasks_room_position ON tasks (room_id, position)');
        $this->addSql('CREATE TABLE users (id UUID NOT NULL, email VARCHAR(180) NOT NULL, name VARCHAR(50) NOT NULL, password VARCHAR(255) NOT NULL, roles JSON NOT NULL, created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, PRIMARY KEY (id))');
        $this->addSql('CREATE UNIQUE INDEX uniq_users_email ON users (email)');
        $this->addSql('CREATE TABLE votes (id UUID NOT NULL, value VARCHAR(10) NOT NULL, created_at TIMESTAMP(0) WITHOUT TIME ZONE NOT NULL, round_id UUID NOT NULL, user_id UUID NOT NULL, PRIMARY KEY (id))');
        $this->addSql('CREATE INDEX IDX_518B7ACFA76ED395 ON votes (user_id)');
        $this->addSql('CREATE INDEX idx_votes_round ON votes (round_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_votes_round_user ON votes (round_id, user_id)');
        $this->addSql('ALTER TABLE room_members ADD CONSTRAINT FK_A9826E1F54177093 FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE room_members ADD CONSTRAINT FK_A9826E1FA76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE rooms ADD CONSTRAINT FK_7CA11A967E3C61F9 FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE rounds ADD CONSTRAINT FK_3A7FD5548DB60186 FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE tasks ADD CONSTRAINT FK_5058659754177093 FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE votes ADD CONSTRAINT FK_518B7ACFA6005CA0 FOREIGN KEY (round_id) REFERENCES rounds (id) ON DELETE CASCADE NOT DEFERRABLE');
        $this->addSql('ALTER TABLE votes ADD CONSTRAINT FK_518B7ACFA76ED395 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE NOT DEFERRABLE');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE room_members DROP CONSTRAINT FK_A9826E1F54177093');
        $this->addSql('ALTER TABLE room_members DROP CONSTRAINT FK_A9826E1FA76ED395');
        $this->addSql('ALTER TABLE rooms DROP CONSTRAINT FK_7CA11A967E3C61F9');
        $this->addSql('ALTER TABLE rounds DROP CONSTRAINT FK_3A7FD5548DB60186');
        $this->addSql('ALTER TABLE tasks DROP CONSTRAINT FK_5058659754177093');
        $this->addSql('ALTER TABLE votes DROP CONSTRAINT FK_518B7ACFA6005CA0');
        $this->addSql('ALTER TABLE votes DROP CONSTRAINT FK_518B7ACFA76ED395');
        $this->addSql('DROP TABLE room_members');
        $this->addSql('DROP TABLE rooms');
        $this->addSql('DROP TABLE rounds');
        $this->addSql('DROP TABLE tasks');
        $this->addSql('DROP TABLE users');
        $this->addSql('DROP TABLE votes');
    }
}
