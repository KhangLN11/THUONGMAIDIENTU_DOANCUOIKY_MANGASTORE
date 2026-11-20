<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../src/Database.php';
$d=json_decode(stream_get_contents(STDIN),true,16,JSON_THROW_ON_ERROR);$email=$d['email']??'';
if(!is_string($email)||!preg_match('/\Aauth-test-[a-f0-9]{12}(?:-[a-z]+)?@example\.test\z/D',$email))throw new RuntimeException('Only generated fixtures allowed.');
$pdo=Database::connect();$s=$pdo->prepare('SELECT id FROM users WHERE email=?');$s->execute([$email]);$uid=$s->fetchColumn();
if(!$uid)throw new RuntimeException('Fixture user missing.');
if(($d['action']??'')==='pending'){
 if(!preg_match('/\A[a-zA-Z0-9,-]{22,128}\z/D',$d['session_id']??'')||!preg_match('/\A[a-f0-9]{32}\z/D',$d['operation_key']??''))throw new RuntimeException('Invalid fixture session.');
 session_name('MANGA_STORE_SESSION');session_id($d['session_id']);session_start();
 if((int)($_SESSION['user_id']??0)!==(int)$uid)throw new RuntimeException('Wrong fixture session owner.');
 $_SESSION['commerce_receipts'][$d['operation_key']]=['hash'=>hash('sha256',json_encode([$d['items'],$d['wishlist']],JSON_THROW_ON_ERROR)),'state'=>'pending'];session_write_close();echo '{}';
}else{
 $s=$pdo->prepare('SELECT ci.product_id,ci.quantity FROM cart_items ci JOIN carts c ON c.id=ci.cart_id WHERE c.user_id=? ORDER BY ci.product_id');$s->execute([$uid]);
 $w=$pdo->prepare('SELECT product_id FROM wishlists WHERE user_id=? ORDER BY product_id');$w->execute([$uid]);echo json_encode(['items'=>$s->fetchAll(),'wishlist'=>$w->fetchAll(PDO::FETCH_COLUMN)],JSON_THROW_ON_ERROR);
}
