<?php
declare(strict_types=1);
require_once __DIR__ . '/../../../src/auth_bootstrap.php';
Auth::method('GET');
Auth::result(Auth::requireUser());
