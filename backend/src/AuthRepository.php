<?php
declare(strict_types=1);
final class AuthRepository
{
    public function __construct(private PDO $pdo) {}
    public function byEmail(string $email): ?array
    {
        $statement = $this->pdo->prepare('SELECT id, full_name, email, password_hash, role, status, created_at FROM users WHERE email = ? LIMIT 1');
        $statement->execute([$email]);
        return $statement->fetch() ?: null;
    }
    public function byId(int $id): ?array
    {
        $statement = $this->pdo->prepare('SELECT id, full_name, email, role, status, created_at FROM users WHERE id = ? LIMIT 1');
        $statement->execute([$id]);
        return $statement->fetch() ?: null;
    }
    public function register(string $name, string $email, string $password): array
    {
        try {
            $statement = $this->pdo->prepare("INSERT INTO users (full_name, email, password_hash, role, status) VALUES (?, ?, ?, 'customer', 'active')");
            $statement->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]);
        } catch (PDOException $exception) {
            if (($exception->errorInfo[1] ?? null) === 1062) auth_error('EMAIL_EXISTS', 409);
            throw $exception;
        }
        return $this->byId((int) $this->pdo->lastInsertId());
    }
    public static function publicUser(array $user): array
    {
        return ['id' => (int) $user['id'], 'full_name' => $user['full_name'], 'email' => $user['email'],
            'role' => $user['role'] === 'admin' ? 'admin' : 'user', 'status' => $user['status'], 'created_at' => $user['created_at']];
    }
}
