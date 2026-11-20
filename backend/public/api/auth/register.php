<?php
declare(strict_types=1);
require_once __DIR__ . '/../../../src/auth_bootstrap.php';
Auth::method('POST');
Auth::csrf();
$input = Auth::input();
[$email, $password, $name] = Auth::credentials($input, true);
AuthRateLimiter::consume('register-ip:' . Auth::ip(), 10);
$user = Auth::repository()->register($name, $email, $password);
// Registration does not authenticate: explicitly sign in afterwards.
Auth::result($user, 201);
