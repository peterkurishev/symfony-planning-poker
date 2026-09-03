<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\User;
use App\Repository\UserRepository;
use App\Serializer\ApiPresenter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/** UC-01 Регистрация, UC-02 Вход в систему. */
#[Route('/api')]
class AuthController extends AbstractApiController
{
    #[Route('/register', name: 'api_register', methods: ['POST'])]
    public function register(
        Request $request,
        ValidatorInterface $validator,
        UserRepository $users,
        EntityManagerInterface $em,
        UserPasswordHasherInterface $hasher,
        ApiPresenter $presenter,
        Security $security,
    ): JsonResponse {
        $data = $this->payload($request);
        $email = trim((string) ($data['email'] ?? ''));
        $name = trim((string) ($data['name'] ?? ''));
        $password = (string) ($data['password'] ?? '');

        $violations = $validator->validate(
            ['email' => $email, 'name' => $name, 'password' => $password],
            new Assert\Collection([
                'email' => [new Assert\NotBlank(), new Assert\Email(), new Assert\Length(max: 180)],
                'name' => [new Assert\NotBlank(), new Assert\Length(min: 2, max: 50)],
                'password' => [new Assert\NotBlank(), new Assert\Length(min: 8, max: 4096)],
            ]),
        );

        $errors = [];
        foreach ($violations as $violation) {
            $errors[trim($violation->getPropertyPath(), '[]')] = $violation->getMessage();
        }

        if ($users->findOneBy(['email' => $email]) !== null) {
            $errors['email'] = 'Этот email уже занят';
        }

        if ($errors !== []) {
            return $this->json(['message' => 'Проверьте правильность заполнения полей', 'errors' => $errors], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $user = new User($email, $name);
        $user->setPassword($hasher->hashPassword($user, $password));
        $em->persist($user);
        $em->flush();

        $security->login($user, 'json_login');

        return $this->json($presenter->user($user), Response::HTTP_CREATED);
    }

    /** Вызывается после успешной проверки логина и пароля системой безопасности. */
    #[Route('/login', name: 'api_login', methods: ['POST'])]
    public function login(ApiPresenter $presenter): JsonResponse
    {
        return $this->json($presenter->user($this->currentUser()));
    }

    #[Route('/logout', name: 'api_logout', methods: ['POST'])]
    public function logout(): void
    {
        throw new \LogicException('Перехватывается системой безопасности');
    }

    #[Route('/me', name: 'api_me', methods: ['GET'])]
    public function me(ApiPresenter $presenter): JsonResponse
    {
        return $this->json($presenter->user($this->currentUser()));
    }
}
