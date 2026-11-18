<?php
declare(strict_types=1);
// Copy to database.local.php (ignored by Git). Environment variables take priority.
return [
    'host' => '127.0.0.1',
    'port' => '3306',
    'database' => 'manga_store',
    'username' => 'root',
    'password' => '', // Set only in database.local.php when required locally.
];
