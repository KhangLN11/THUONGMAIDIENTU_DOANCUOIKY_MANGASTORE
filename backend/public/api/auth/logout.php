<?php
declare(strict_types=1);
require_once __DIR__ . '/../../../src/auth_bootstrap.php';
Auth::method('POST');
Auth::csrf();
$_SESSION = [];
$options = session_get_cookie_params();
setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $options['path'], 'secure' => $options['secure'], 'httponly' => true, 'samesite' => $options['samesite']]);
session_destroy();
Auth::result(null);
