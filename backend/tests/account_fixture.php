<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../src/Database.php';$pdo=Database::connect();
if($pdo->query('SELECT DATABASE()')->fetchColumn()!=='manga_store_orders_test_20261120')throw new RuntimeException('Isolated account fixture only.');
$d=json_decode(stream_get_contents(STDIN),true,16,JSON_THROW_ON_ERROR);
if(($d['action']??'')==='seed'){
 if(!preg_match('/\A[a-f0-9]{12}\z/D',$d['nonce']))throw new RuntimeException('Invalid nonce');
 $s=$pdo->prepare('SELECT id FROM users WHERE email=?');$s->execute([$d['email']]);$uid=$s->fetchColumn();if(!$uid||!preg_match('/\Aauth-test-[a-f0-9]{12}(?:-[a-z]+)?@example\.test\z/D',$d['email']))throw new RuntimeException('Invalid fixture user');
 $p=$pdo->query('SELECT * FROM products WHERE id=9')->fetch();$status=['pending','confirmed','processing','shipping','delivered','cancelled'];$pdo->beginTransaction();
 try{for($i=0;$i<(int)$d['count'];$i++){
  $s=$pdo->prepare("INSERT INTO orders(order_code,user_id,recipient_name,recipient_phone,province,ward,address_line,status,subtotal_vnd,shipping_fee_vnd,total_vnd,customer_note) VALUES(?,?,'Account Sandbox','0900000000','Test City','Test Ward','Test Address',?,220000,30000,250000,'Read-only account fixture, not a real sale')");$s->execute(['ACCTEST-'.$d['nonce'].'-'.$uid.'-'.$i,$uid,$status[$i%6]]);$id=$pdo->lastInsertId();
  $s=$pdo->prepare('INSERT INTO order_items(order_id,product_id,sku_snapshot,name_vi_snapshot,name_en_snapshot,unit_price_vnd,quantity,line_total_vnd) VALUES(?,9,?,?,?,220000,1,220000)');$s->execute([$id,$p['sku'],$p['name_vi'],$p['name_en']]);
  $s=$pdo->prepare('INSERT INTO payments(order_id,method,status,amount_vnd,paid_at,transaction_ref) VALUES(?,?,?,250000,?,?)');$paid=$i%6===4;$s->execute([$id,$i%3===1?'bank_transfer':'cod',$paid?'paid':'pending',$paid?date('Y-m-d H:i:s'):null,$paid?'SANDBOX-ACCT-'.$id:null]);
 }$s=$pdo->prepare('INSERT INTO wishlists(user_id,product_id) VALUES(?,9),(?,10),(?,11)');$s->execute([$uid,$uid,$uid]);$pdo->commit();echo json_encode(['user_id'=>(int)$uid,'orders'=>(int)$d['count']]);}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}else throw new RuntimeException('Unknown fixture action');
