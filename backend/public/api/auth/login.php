<?php
declare(strict_types=1);
require_once __DIR__ . '/../../../src/auth_bootstrap.php';
Auth::method('POST');
Auth::csrf();
[$email, $password] = Auth::credentials(Auth::input(), false);
AuthRateLimiter::consume('login-ip:' . Auth::ip(), 30);
AuthRateLimiter::consume('login-email:' . $email, 5);
$user = Auth::repository()->byEmail($email);
// Perform a real password verification for unknown emails too; no account enumeration in login errors.
$hash = $user['password_hash'] ?? '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
$valid = password_verify($password, $hash);
if (!$user || !$valid || $user['status'] !== 'active') auth_error('INVALID_CREDENTIALS', 401);
Auth::signedIn($user);
Auth::result($user);
