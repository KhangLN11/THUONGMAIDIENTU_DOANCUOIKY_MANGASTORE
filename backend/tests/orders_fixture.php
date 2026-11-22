<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../src/Database.php';$pdo=Database::connect();
if($pdo->query('SELECT DATABASE()')->fetchColumn()!=='manga_store_orders_test_20261120')throw new RuntimeException('Orders fixture requires isolated database.');
$d=json_decode(stream_get_contents(STDIN),true,16,JSON_THROW_ON_ERROR);$action=$d['action']??'';
if($action==='stock'){
 $s=$pdo->prepare('UPDATE products SET stock_quantity=?,status=? WHERE id=? AND sku LIKE ?');$s->execute([(int)$d['stock'],$d['status']??'active',(int)$d['product_id'],'CAT-%']);echo '{}';
}elseif($action==='product-change'){
 $s=$pdo->prepare('UPDATE products SET price_vnd=price_vnd+1000,sale_price_vnd=NULL,name_vi=? WHERE id=? AND sku LIKE ?');$s->execute(['Snapshot changed fixture',(int)$d['product_id'],'CAT-%']);echo '{}';
}elseif($action==='trigger-on'){$pdo->exec("CREATE TRIGGER stage8_fail_payment BEFORE INSERT ON payments FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected test failure'");echo '{}';
}elseif($action==='trigger-off'){$pdo->exec('DROP TRIGGER IF EXISTS stage8_fail_payment');echo '{}';
}elseif($action==='order-status'){$s=$pdo->prepare('UPDATE orders SET status=? WHERE id=? AND user_id IN (SELECT id FROM users WHERE email=?)');$s->execute([$d['status'],(int)$d['order_id'],$d['email']]);echo '{}';
}elseif($action==='inspect'){
 $s=$pdo->prepare('SELECT stock_quantity FROM products WHERE id=?');$s->execute([(int)$d['product_id']]);$stock=(int)$s->fetchColumn();
 $s=$pdo->prepare('SELECT id,status,total_vnd FROM orders WHERE user_id IN (SELECT id FROM users WHERE email=?) ORDER BY id');$s->execute([$d['email']]);$orders=$s->fetchAll();
 $s=$pdo->prepare('SELECT reason,SUM(quantity_delta) AS delta,COUNT(*) AS n FROM inventory_movements WHERE order_id=? GROUP BY reason');$s->execute([(int)($d['order_id']??0)]);
 echo json_encode(['stock'=>$stock,'orders'=>$orders,'movements'=>$s->fetchAll(),'addresses'=>(int)$pdo->query('SELECT COUNT(*) FROM addresses')->fetchColumn()],JSON_THROW_ON_ERROR);
}elseif($action==='cleanup'){
 $pdo->exec('DROP TRIGGER IF EXISTS stage8_fail_payment');
 foreach($d['emails'] as $email){
  if(!preg_match('/\Aauth-test-[a-f0-9]{12}(?:-[a-z]+)?@example\.test\z/D',$email))throw new RuntimeException('Invalid fixture email.');
  $s=$pdo->prepare('DELETE im FROM inventory_movements im JOIN orders o ON o.id=im.order_id JOIN users u ON u.id=o.user_id WHERE u.email=?');$s->execute([$email]);
  $s=$pdo->prepare('DELETE o FROM orders o JOIN users u ON u.id=o.user_id WHERE u.email=?');$s->execute([$email]);
  $s=$pdo->prepare('DELETE FROM users WHERE email=?');$s->execute([$email]);
 }
 $before=json_decode(file_get_contents('C:/xampp/manga-store-backups/2026-11-20-orders/before.json'),true,512,JSON_THROW_ON_ERROR);
 $s=$pdo->prepare('UPDATE products SET stock_quantity=?,status=?,name_vi=?,name_en=?,price_vnd=?,sale_price_vnd=?,updated_at=? WHERE id=? AND sku=?');
 foreach($before['tables']['products']['rows'] as $p)$s->execute([$p['stock_quantity'],$p['status'],$p['name_vi'],$p['name_en'],$p['price_vnd'],$p['sale_price_vnd'],$p['updated_at'],$p['id'],$p['sku']]);echo '{}';
}else throw new RuntimeException('Unknown fixture action.');
