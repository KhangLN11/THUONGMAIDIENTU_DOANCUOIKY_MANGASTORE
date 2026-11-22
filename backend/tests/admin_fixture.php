<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../src/Database.php';$pdo=Database::connect();
if($pdo->query('SELECT DATABASE()')->fetchColumn()!=='manga_store_admin_test_20261122')throw new RuntimeException('Admin fixture requires isolated database.');
$d=json_decode(stream_get_contents(STDIN),true,16,JSON_THROW_ON_ERROR);$action=$d['action']??'';
if($action==='order'){
 $email=$d['email'];if(!preg_match('/\Aauth-test-[a-f0-9]{12}(?:-[a-z]+)?@example\.test\z/D',$email))throw new RuntimeException('Invalid fixture email.');
 $s=$pdo->prepare('SELECT id FROM users WHERE email=?');$s->execute([$email]);$uid=(int)$s->fetchColumn();
 $s=$pdo->prepare("SELECT id FROM products WHERE id=? AND sku LIKE 'ADMTEST-%'");$s->execute([(int)$d['product_id']]);if(!$uid||!$s->fetchColumn())throw new RuntimeException('Fixture target missing.');
 require_once __DIR__.'/../src/CommerceRepository.php';require_once __DIR__.'/../src/OrderRepository.php';
 (new CommerceRepository($pdo,$uid))->mutate('add',['product_id'=>(int)$d['product_id'],'quantity'=>1]);$repo=new OrderRepository($pdo,$uid);$q=$repo->quote();
 $r=$repo->create(['idempotency_key'=>bin2hex(random_bytes(16)),'quote_fingerprint'=>$q['quote_fingerprint'],'recipient_name'=>'Admin GUI Customer','recipient_phone'=>'0900000000','province'=>'Test','district'=>null,'ward'=>'Test','address_line'=>'Test street','customer_note'=>null,'payment_method'=>'cod']);echo json_encode($r['order'],JSON_THROW_ON_ERROR);
}elseif($action==='find-product'){
 $s=$pdo->prepare('SELECT id FROM products WHERE sku=?');$s->execute([$d['sku']]);echo json_encode(['id'=>(int)$s->fetchColumn()],JSON_THROW_ON_ERROR);
}elseif($action==='inspect'){
 $p=$pdo->prepare('SELECT stock_quantity,status FROM products WHERE id=?');$p->execute([(int)$d['product_id']]);
 $s=$pdo->prepare('SELECT reason,quantity_delta,actor_user_id,order_id FROM inventory_movements WHERE product_id=? ORDER BY id');$s->execute([(int)$d['product_id']]);
 echo json_encode(['product'=>$p->fetch(),'movements'=>$s->fetchAll()],JSON_THROW_ON_ERROR);
}elseif($action==='cleanup'){
 foreach($d['emails'] as $email){if(!preg_match('/\Aauth-test-[a-f0-9]{12}(?:-[a-z]+)?@example\.test\z/D',$email))throw new RuntimeException('Invalid fixture email.');
  $s=$pdo->prepare('DELETE im FROM inventory_movements im JOIN orders o ON o.id=im.order_id JOIN users u ON u.id=o.user_id WHERE u.email=?');$s->execute([$email]);
  $s=$pdo->prepare('DELETE o FROM orders o JOIN users u ON u.id=o.user_id WHERE u.email=?');$s->execute([$email]);
  $s=$pdo->prepare('DELETE ci FROM cart_items ci JOIN carts c ON c.id=ci.cart_id JOIN users u ON u.id=c.user_id WHERE u.email=?');$s->execute([$email]);
 }
 foreach($d['skus'] as $sku){if(!preg_match('/\AADMTEST-[a-f0-9]{12}(?:-[A-Z]+)?\z/D',$sku))throw new RuntimeException('Invalid fixture SKU.');
  $s=$pdo->prepare('SELECT id FROM products WHERE sku=?');$s->execute([$sku]);$id=$s->fetchColumn();if($id===false)continue;
  $s=$pdo->prepare('DELETE FROM inventory_movements WHERE product_id=?');$s->execute([$id]);
  $s=$pdo->prepare('DELETE FROM products WHERE id=? AND sku=?');$s->execute([$id,$sku]);
  $root='C:/xampp/htdocs/manga-store-admin-test-20261122/manga-store/backend/public/uploads/products';$dir=$root.'/'.(int)$id;
  if(is_dir($dir)&&!is_link($dir)){foreach(new DirectoryIterator($dir) as $f){if($f->isDot())continue;if($f->isLink()||!$f->isFile()||!preg_match('/\A(?:[a-f0-9]{32}\.(?:jpg|png|webp)|probe\.php)\z/D',$f->getFilename()))throw new RuntimeException('Unexpected fixture file.');unlink($f->getPathname());}rmdir($dir);}
 }
 foreach($d['emails'] as $email){$s=$pdo->prepare('DELETE FROM users WHERE email=?');$s->execute([$email]);}echo '{}';
}else throw new RuntimeException('Invalid fixture action.');
