<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__.'/../src/Database.php';
$pdo=Database::connect();
$tables=$pdo->query("SHOW FULL TABLES WHERE Table_type='BASE TABLE'")->fetchAll(PDO::FETCH_NUM);
$result=['database'=>'manga_store','tables'=>[]];
foreach ($tables as $item) {
    $table=$item[0];
    if (!preg_match('/^[a-zA-Z0-9_]+$/D',$table)) throw new RuntimeException('Unsafe table name.');
    $rows=$pdo->query('SELECT * FROM `'.$table.'`')->fetchAll(PDO::FETCH_ASSOC);
    $encoded=array_map(static fn(array $row): string=>json_encode($row,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$rows);
    sort($encoded,SORT_STRING);
    $schema=$pdo->query('SHOW CREATE TABLE `'.$table.'`')->fetch(PDO::FETCH_NUM)[1];
    $result['tables'][$table]=['count'=>count($rows),'sha256'=>hash('sha256',implode("\n",$encoded)),'schema'=>$schema,'rows'=>$rows];
}
$status=$pdo->query("SHOW COLUMNS FROM products LIKE 'status'")->fetch(PDO::FETCH_ASSOC);
$result['archived_supported']=strpos($status['Type'],"'archived'")!==false;
echo json_encode($result,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR).PHP_EOL;
