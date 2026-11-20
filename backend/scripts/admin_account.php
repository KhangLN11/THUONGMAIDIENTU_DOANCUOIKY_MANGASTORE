<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../src/Database.php';
// Input via STDIN JSON, not command-line password arguments or a tracked config file.
// create: {action,email,full_name,password}; promote: {action,email,confirm_email}
try {
    $input = json_decode(stream_get_contents(STDIN), true, 8, JSON_THROW_ON_ERROR);
    $action = $input['action'] ?? '';
    $email = strtolower(trim($input['email'] ?? ''));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) throw new RuntimeException('Invalid email.');
    $pdo = Database::connect();
    if ($action === 'create') {
        $name = trim($input['full_name'] ?? '');
        $password = $input['password'] ?? '';
        if (!is_string($password) || strlen($password) < 12 || strlen($password) > 72 || str_contains($password, "\0") || !preg_match('/\A[^\p{C}]{2,150}\z/u', $name)) throw new RuntimeException('Invalid name/password.');
        $statement = $pdo->prepare("INSERT INTO users(full_name,email,password_hash,role,status) VALUES(?,?,?,'admin','active')");
        $statement->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT)]);
    } elseif ($action === 'promote' && ($input['confirm_email'] ?? '') === $email) {
        $statement = $pdo->prepare("UPDATE users SET role='admin' WHERE email=? AND status='active' AND role='customer'");
        $statement->execute([$email]);
        if ($statement->rowCount() !== 1) throw new RuntimeException('No eligible user.');
    } else { throw new RuntimeException('Invalid action/confirmation.'); }
    echo "Admin action completed.\n";
} catch (Throwable $error) { fwrite(STDERR, "Admin action failed; verify input, unique email and local database configuration.\n"); exit(1); }
