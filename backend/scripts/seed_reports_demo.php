<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../src/Database.php';$pdo=Database::connect();$db=$pdo->query('SELECT DATABASE()')->fetchColumn();
if(!in_array($db,['manga_store_reports_demo','manga_store_reports_test_20261122'],true))throw new RuntimeException('Only isolated reports demo/test databases are allowed; live is forbidden.');
$action=$argv[1]??'--plan';if(!in_array($action,['--plan','--apply','--cleanup'],true))throw new RuntimeException('Use --plan, --apply or --cleanup.');
$prefix='RPTSIM-';$email='reports-simulation@example.test';
if($action==='--plan'){echo json_encode(['database'=>$db,'simulation'=>true,'products'=>3,'orders'=>12,'customer_email'=>$email,'note'=>'SIMULATED COD, no actual money. Explicit --apply required; --cleanup removes only this fixture.'],JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR);exit;}
$pdo->exec("SET SESSION time_zone='+07:00'");$pdo->beginTransaction();
try{
 $s=$pdo->prepare('SELECT id FROM users WHERE email=? FOR UPDATE');$s->execute([$email]);$uid=$s->fetchColumn();
 if($action==='--cleanup'){
  if($uid){
   $s=$pdo->prepare('SELECT COUNT(*) FROM orders WHERE user_id=? AND order_code NOT LIKE ?');$s->execute([$uid,$prefix.'%']);if((int)$s->fetchColumn()!==0)throw new RuntimeException('Unexpected orders: cleanup stopped.');
   $s=$pdo->prepare('DELETE im FROM inventory_movements im JOIN orders o ON o.id=im.order_id WHERE o.user_id=? AND o.order_code LIKE ?');$s->execute([$uid,$prefix.'%']);
   $s=$pdo->prepare('DELETE FROM orders WHERE user_id=? AND order_code LIKE ?');$s->execute([$uid,$prefix.'%']);
   $s=$pdo->prepare('DELETE FROM users WHERE id=?');$s->execute([$uid]);
  }
  $s=$pdo->prepare('DELETE im FROM inventory_movements im JOIN products p ON p.id=im.product_id WHERE p.sku IN (?,?,?)');$s->execute(['RPTSIM-MANGA','RPTSIM-NOVEL','RPTSIM-FIGURE']);
  $s=$pdo->prepare('DELETE FROM products WHERE sku IN (?,?,?)');$s->execute(['RPTSIM-MANGA','RPTSIM-NOVEL','RPTSIM-FIGURE']);$pdo->commit();echo '{"simulation":true,"cleaned":true}';exit;
 }
 if($uid){$s=$pdo->prepare('SELECT COUNT(*) FROM orders WHERE user_id=? AND order_code LIKE ?');$s->execute([$uid,$prefix.'%']);if((int)$s->fetchColumn()!==12)throw new RuntimeException('Partial simulation exists; inspect/cleanup before reapplying.');$pdo->commit();echo '{"simulation":true,"already_seeded":true}';exit;}
 $s=$pdo->prepare("INSERT INTO users(full_name,email,password_hash,role) VALUES(?,?,?,'customer')");$s->execute(['[SIMULATION] Báo cáo đồ án',$email,password_hash(bin2hex(random_bytes(32)),PASSWORD_DEFAULT)]);$uid=(int)$pdo->lastInsertId();
 $ids=[];
 foreach([['MANGA','manga','Sách mô phỏng =1+1','SIMULATED Manga',100000],['NOVEL','novels','=HYPERLINK("https://example.invalid")','+SIMULATED Novel',200000],['FIGURE','figures','Mô hình mô phỏng','SIMULATED Figure',300000]] as $p){
  $s=$pdo->prepare('SELECT id FROM categories WHERE slug=?');$s->execute([$p[1]]);$category=$s->fetchColumn();if(!$category)throw new RuntimeException('Required category missing.');
  $s=$pdo->prepare("INSERT INTO products(category_id,sku,slug,name_vi,name_en,price_vnd,stock_quantity,status) VALUES(?,?,?,?,?,?,100,'active')");$s->execute([$category,$prefix.$p[0],'reports-simulation-'.strtolower($p[0]),$p[2],$p[3],$p[4]]);$ids[$p[0]]=(int)$pdo->lastInsertId();
  $s=$pdo->prepare("INSERT INTO inventory_movements(product_id,quantity_delta,reason,note) VALUES(?,100,'initial','SIMULATION, not actual inventory')");$s->execute([$ids[$p[0]]]);
 }
 $orders=[
 ['A','2026-01-01 00:00:00','delivered',[['MANGA',2],['NOVEL',1]],'cod','paid','2026-01-02 10:00:00','SIMULATION-A'],
 ['B','2026-01-10 12:00:00','delivered',[['FIGURE',1]],'cod','pending',null,null],
 ['C','2026-01-15 12:00:00','cancelled',[['MANGA',5]],'cod','pending',null,null],
 ['D','2026-01-20 12:00:00','pending',[['NOVEL',1]],'cod','pending',null,null],
 ['E','2026-01-25 12:00:00','processing',[['MANGA',1]],'cod','pending',null,null],
 ['F','2025-12-31 23:59:59','delivered',[['MANGA',1]],'cod','paid','2026-01-01 00:00:00','SIMULATION-F'],
 ['G','2026-02-01 00:00:00','delivered',[['NOVEL',1]],'cod','paid','2026-02-01 00:00:00','SIMULATION-G'],
 ['H','2026-01-21 12:00:00','confirmed',[['MANGA',1]],'cod','pending',null,null],
 ['I','2026-01-26 12:00:00','shipping',[['FIGURE',1]],'cod','pending',null,null],
 ['J','2026-01-31 23:59:59','delivered',[['MANGA',1]],'cod','paid','2026-02-01 00:00:00','SIMULATION-J'],
 ['K','2026-01-05 12:00:00','delivered',[['FIGURE',2]],'cod','paid','2026-01-05 12:00:00',null],
 ['L','2026-01-06 12:00:00','delivered',[['MANGA',1]],'bank_transfer','paid','2026-01-06 12:00:00','SIMULATION-NON-COD']
 ];$prices=['MANGA'=>100000,'NOVEL'=>200000,'FIGURE'=>300000];
 foreach($orders as [$code,$date,$status,$items,$method,$payment,$paid,$ref]){
  $subtotal=0;foreach($items as [$key,$qty])$subtotal+=$prices[$key]*$qty;$total=$subtotal+30000;
  $s=$pdo->prepare("INSERT INTO orders(order_code,user_id,recipient_name,recipient_phone,province,ward,address_line,customer_note,status,subtotal_vnd,shipping_fee_vnd,total_vnd,created_at,updated_at) VALUES(?,?,'SIMULATION','0900000000','SIMULATION','SIMULATION','SIMULATION','SIMULATED, no actual payment',?,?,30000,?,?,?)");$s->execute([$prefix.$code,$uid,$status,$subtotal,$total,$date,$date]);$oid=(int)$pdo->lastInsertId();
  foreach($items as [$key,$qty]){
   $s=$pdo->prepare('SELECT sku,name_vi,name_en FROM products WHERE id=?');$s->execute([$ids[$key]]);$p=$s->fetch();
   $s=$pdo->prepare('INSERT INTO order_items(order_id,product_id,sku_snapshot,name_vi_snapshot,name_en_snapshot,unit_price_vnd,quantity,line_total_vnd) VALUES(?,?,?,?,?,?,?,?)');$s->execute([$oid,$ids[$key],$p['sku'],$p['name_vi'],$p['name_en'],$prices[$key],$qty,$prices[$key]*$qty]);
   $s=$pdo->prepare("INSERT INTO inventory_movements(product_id,order_id,quantity_delta,reason,note,created_at) VALUES(?,?,?,'sale','SIMULATION',?)");$s->execute([$ids[$key],$oid,-$qty,$date]);
   if($status==='cancelled'){$s=$pdo->prepare("INSERT INTO inventory_movements(product_id,order_id,quantity_delta,reason,note,created_at) VALUES(?,?,?,'cancel_restock','SIMULATION',?)");$s->execute([$ids[$key],$oid,$qty,$date]);}
   else{$s=$pdo->prepare('UPDATE products SET stock_quantity=stock_quantity-? WHERE id=?');$s->execute([$qty,$ids[$key]]);}
  }
  $s=$pdo->prepare('INSERT INTO payments(order_id,method,status,amount_vnd,transaction_ref,paid_at,created_at) VALUES(?,?,?,?,?,?,?)');$s->execute([$oid,$method,$payment,$total,$ref,$paid,$date]);
  $shipment=$status==='delivered'?'delivered':($status==='shipping'?'shipped':($status==='processing'?'packed':'pending'));
  $s=$pdo->prepare('INSERT INTO shipments(order_id,status) VALUES(?,?)');$s->execute([$oid,$shipment]);
 }
 $pdo->commit();echo json_encode(['simulation'=>true,'products'=>3,'orders'=>12,'period'=>'2026-01-01 to 2026-01-31','expected'=>['orders'=>10,'created_vnd'=>'3000000','collected_vnd'=>'560000','sold_units'=>8]],JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR);
}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
