<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__.'/../src/Database.php';
$pdo=Database::connect();
$lines=file(__DIR__.'/../../database/catalog/demo-products/catalog.sql',FILE_IGNORE_NEW_LINES|FILE_SKIP_EMPTY_LINES);
$checked=0;
foreach ($lines as $line) {
    if (strpos($line,'INSERT INTO ')!==0) continue;
    // Native server prepare validates syntax/column names. Deliberately NEVER execute.
    $statement=$pdo->prepare($line);
    if (!$statement) throw new RuntimeException('Could not prepare generated INSERT.');
    $statement=null;
    $checked++;
}
if ($checked!==76) throw new RuntimeException('Unexpected statement count.');
echo "PASS: 76 generated INSERT statements prepared by MariaDB; executions=0, writes=0.\n";
