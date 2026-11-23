<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../src/Database.php';$pdo=Database::connect();
if($pdo->query('SELECT DATABASE()')->fetchColumn()!=='manga_store_admin_test_20261122')throw new RuntimeException('Isolated series test database required.');
$d=json_decode(stream_get_contents(STDIN),true,16,JSON_THROW_ON_ERROR);$prefix=$d['prefix']??'';
if(!preg_match('/\A12a-test-[a-f0-9]{12}\z/D',$prefix))throw new RuntimeException('Invalid test prefix');
if(($d['action']??'')==='cleanup'){$s=$pdo->prepare('DELETE FROM manga_series WHERE slug LIKE ? AND NOT EXISTS(SELECT 1 FROM products WHERE products.series_id=manga_series.id)');$s->execute([$prefix.'%']);echo json_encode(['removed'=>$s->rowCount()]);}
else{$s=$pdo->prepare('SELECT id,title,slug FROM manga_series WHERE slug LIKE ? ORDER BY id');$s->execute([$prefix.'%']);echo json_encode($s->fetchAll(),JSON_THROW_ON_ERROR);}
