<?php
declare(strict_types=1);
require_once __DIR__.'/OrderRepository.php';
final class AdminException extends RuntimeException{
 public string $errorCode;public int $status;
 public function __construct(string $code,int $status=422){parent::__construct($code);$this->errorCode=$code;$this->status=$status;}
}
final class AdminRepository{
 public function __construct(private PDO $pdo,private int $actor){}
 public function dashboard():array{
  $sql="SELECT (SELECT COUNT(*) FROM products WHERE status='active') AS active_products,(SELECT COUNT(*) FROM orders) AS total_orders,(SELECT COUNT(*) FROM orders WHERE status IN ('pending','confirmed','processing')) AS pending_orders,(SELECT COUNT(*) FROM products WHERE status='active' AND stock_quantity<=5) AS low_stock,(SELECT COALESCE(SUM(p.amount_vnd),0) FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.method='cod' AND p.status='paid' AND p.paid_at IS NOT NULL AND p.transaction_ref IS NOT NULL AND o.status='delivered') AS collected_cod_vnd";
  return array_map('intval',$this->pdo->query($sql)->fetch());
 }
 private function page(string $select,string $from,array $params,int $page,int $size,string $order):array{
  $s=$this->pdo->prepare('SELECT COUNT(*) '.$from);$s->execute($params);$total=(int)$s->fetchColumn();
  $s=$this->pdo->prepare($select.' '.$from.' ORDER BY '.$order.' LIMIT '.$size.' OFFSET '.(($page-1)*$size));$s->execute($params);
  return ['items'=>$s->fetchAll(),'meta'=>['page'=>$page,'page_size'=>$size,'total'=>$total,'last_page'=>max(1,(int)ceil($total/$size))]];
 }
 public function orders(array $q):array{
  $from='FROM orders o JOIN users u ON u.id=o.user_id WHERE 1=1';$params=[];
  if($q['q']!==''){$from.=' AND o.order_code LIKE ?';$params[]='%'.$q['q'].'%';}
  if($q['status']!==''){$from.=' AND o.status=?';$params[]=$q['status'];}
  $r=$this->page('SELECT o.id,o.order_code,o.recipient_name,o.recipient_phone,o.status,o.total_vnd,o.created_at,u.email',$from,$params,$q['page'],$q['size'],'o.id DESC');
  foreach($r['items'] as &$v){$v['id']=(int)$v['id'];$v['total_vnd']=(int)$v['total_vnd'];}unset($v);return $r;
 }
 private function orderOwner(int $id):int{$s=$this->pdo->prepare('SELECT user_id FROM orders WHERE id=?');$s->execute([$id]);$uid=$s->fetchColumn();if($uid===false)throw new AdminException('NOT_FOUND',404);return(int)$uid;}
 public function order(int $id):array{return(new OrderRepository($this->pdo,$this->orderOwner($id)))->detail($id);}
 public function transition(array $d):array{
  $id=$d['order_id'];if($d['status']==='cancelled')return(new OrderRepository($this->pdo,$this->orderOwner($id)))->cancel($id,$this->actor);
  $next=['pending'=>'confirmed','confirmed'=>'processing','processing'=>'shipping','shipping'=>'delivered'];
  $this->pdo->beginTransaction();try{
   $s=$this->pdo->prepare('SELECT status FROM orders WHERE id=? FOR UPDATE');$s->execute([$id]);$current=$s->fetchColumn();if($current===false)throw new AdminException('NOT_FOUND',404);
   if($current===$d['status']){$this->pdo->commit();return $this->order($id);}
   if($current!==$d['expected_status']||($next[$current]??null)!==$d['status'])throw new AdminException('INVALID_TRANSITION',409);
   $s=$this->pdo->prepare('SELECT status FROM shipments WHERE order_id=? FOR UPDATE');$s->execute([$id]);$shipment=$s->fetchColumn();
   $expected=['pending'=>'pending','confirmed'=>'pending','processing'=>'packed','shipping'=>'shipped'];
   if($shipment!==$expected[$current])throw new AdminException('INCONSISTENT_ORDER',409);
   $s=$this->pdo->prepare('UPDATE orders SET status=? WHERE id=?');$s->execute([$d['status'],$id]);
   if($d['status']==='processing'){$s=$this->pdo->prepare("UPDATE shipments SET status='packed' WHERE order_id=?");$s->execute([$id]);}
   elseif($d['status']==='shipping'){$s=$this->pdo->prepare("UPDATE shipments SET status='shipped',shipped_at=CURRENT_TIMESTAMP WHERE order_id=?");$s->execute([$id]);}
   elseif($d['status']==='delivered'){$s=$this->pdo->prepare("UPDATE shipments SET status='delivered',delivered_at=CURRENT_TIMESTAMP WHERE order_id=?");$s->execute([$id]);}
   $this->pdo->commit();return $this->order($id);
  }catch(Throwable $e){if($this->pdo->inTransaction())$this->pdo->rollBack();throw $e;}
 }
 public function collect(array $d):array{
  // Serialize manual receipt reconciliation across admins and orders; no duplicate bank reference.
  $lock='manga-bank-'.substr(hash('sha256',(string)$this->pdo->query('SELECT DATABASE()')->fetchColumn()),0,40);
  $q=$this->pdo->prepare('SELECT GET_LOCK(?,5)');$q->execute([$lock]);if((int)$q->fetchColumn()!==1)throw new AdminException('PAYMENT_BUSY',409);
  try{
   $this->pdo->beginTransaction();
   $s=$this->pdo->prepare('SELECT status,total_vnd FROM orders WHERE id=? FOR UPDATE');$s->execute([$d['order_id']]);$order=$s->fetch();if(!$order||$order['status']==='cancelled')throw new AdminException('PAYMENT_NOT_ALLOWED',409);
   $s=$this->pdo->prepare('SELECT method,status,transaction_ref,amount_vnd FROM payments WHERE order_id=? FOR UPDATE');$s->execute([$d['order_id']]);$p=$s->fetch();
   if(!$p||!in_array($p['method'],['cod','bank_transfer'],true))throw new AdminException('PAYMENT_NOT_ALLOWED',409);
   $bank=$p['method']==='bank_transfer';
   if(!$bank&&$order['status']!=='delivered')throw new AdminException('PAYMENT_NOT_ALLOWED',409);
   if($bank&&(($d['amount_vnd']??null)!==(int)$p['amount_vnd']||(int)$p['amount_vnd']!==(int)$order['total_vnd']||($d['payment_reference']??null)!==PaymentSettings::reference($d['order_id'])))throw new AdminException('PAYMENT_MISMATCH',409);
   $receipt=$bank?strtoupper(trim($d['reference'])):$d['reference'];
   $ref=$bank?'bank:'.$receipt:'manual:'.$this->actor.':'.$receipt;
   if($p['status']==='paid'){if($p['transaction_ref']!==$ref)throw new AdminException('STALE_DATA',409);$this->pdo->commit();return $this->order($d['order_id']);}
   if($p['status']!=='pending')throw new AdminException('PAYMENT_NOT_ALLOWED',409);
   if($bank){$s=$this->pdo->prepare("SELECT id FROM payments WHERE method='bank_transfer' AND transaction_ref=? AND order_id<>? LIMIT 1");$s->execute([$ref,$d['order_id']]);if($s->fetchColumn()!==false)throw new AdminException('DUPLICATE_RECEIPT',409);}
   $s=$this->pdo->prepare("UPDATE payments SET status='paid',paid_at=CURRENT_TIMESTAMP,transaction_ref=? WHERE order_id=? AND status='pending'");$s->execute([$ref,$d['order_id']]);
   $this->pdo->commit();return $this->order($d['order_id']);
  }catch(Throwable $e){if($this->pdo->inTransaction())$this->pdo->rollBack();throw $e;}
  finally{$s=$this->pdo->prepare('SELECT RELEASE_LOCK(?)');$s->execute([$lock]);}
 }
 public static function product(array $p):array{
  foreach(['id','category_id','stock_quantity','price_vnd','is_featured'] as $k)$p[$k]=(int)$p[$k];foreach(['series_id','sale_price_vnd'] as $k)$p[$k]=$p[$k]===null?null:(int)$p[$k];
  $keys=['id','category_id','series_id','sku','slug','name_vi','name_en','description_vi','description_en','price_vnd','sale_price_vnd','stock_quantity','status','is_featured','updated_at'];$version=[];foreach($keys as $k)$version[$k]=$p[$k];$p['version']=hash('sha256',json_encode($version,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));return $p;
 }
 public function products(array $q,bool $inventory=false):array{
  $from='FROM products p WHERE 1=1';$params=[];
  if($q['q']!==''){$from.=' AND (p.name_vi LIKE ? OR p.name_en LIKE ? OR p.sku LIKE ?)';$params=array_fill(0,3,'%'.$q['q'].'%');}
  if($q['status']!==''){$from.=' AND p.status=?';$params[]=$q['status'];}
  if($q['category_id']!==null){$from.=' AND p.category_id=?';$params[]=$q['category_id'];}
  if($inventory&&$q['low'])$from.=' AND p.status=\'active\' AND p.stock_quantity<=5';
  $r=$this->page('SELECT p.*,(SELECT image_url FROM product_images i WHERE i.product_id=p.id ORDER BY i.is_primary DESC,i.sort_order,i.id LIMIT 1) AS image_url',$from,$params,$q['page'],$q['size'],'p.id DESC');
  $r['items']=array_map([self::class,'product'],$r['items']);return $r;
 }
 public function productDetail(int $id):array{
  $s=$this->pdo->prepare('SELECT * FROM products WHERE id=?');$s->execute([$id]);$p=$s->fetch();if(!$p)throw new AdminException('NOT_FOUND',404);$p=self::product($p);
  $s=$this->pdo->prepare('SELECT id,image_url,alt_vi,alt_en,sort_order,is_primary FROM product_images WHERE product_id=? ORDER BY sort_order,id');$s->execute([$id]);$p['images']=$s->fetchAll();return $p;
 }
 public function metadata():array{
  return ['categories'=>$this->pdo->query('SELECT id,slug,name_vi,name_en FROM categories ORDER BY sort_order,id')->fetchAll(),'series'=>$this->pdo->query('SELECT id,title FROM manga_series ORDER BY title,id')->fetchAll()];
 }
 public function saveProduct(array $d,bool $create):array{
  $this->pdo->beginTransaction();try{
   if(!$create){$s=$this->pdo->prepare('SELECT * FROM products WHERE id=? FOR UPDATE');$s->execute([$d['product_id']]);$old=$s->fetch();if(!$old)throw new AdminException('NOT_FOUND',404);if(!hash_equals(self::product($old)['version'],$d['expected_version']))throw new AdminException('STALE_DATA',409);}
   $s=$this->pdo->prepare('SELECT id FROM categories WHERE id=?');$s->execute([$d['category_id']]);if(!$s->fetchColumn())throw new AdminException('INVALID_INPUT');
   if($d['series_id']!==null){$s=$this->pdo->prepare('SELECT id FROM manga_series WHERE id=?');$s->execute([$d['series_id']]);if(!$s->fetchColumn())throw new AdminException('INVALID_INPUT');}
   $keys=['category_id','series_id','sku','slug','name_vi','name_en','description_vi','description_en','price_vnd','sale_price_vnd','status'];$values=array_map(static fn($k)=>$d[$k],$keys);
   if($create){$s=$this->pdo->prepare('INSERT INTO products('.implode(',',$keys).',stock_quantity) VALUES('.implode(',',array_fill(0,count($keys)+1,'?')).')');$s->execute(array_merge($values,[$d['stock_quantity']]));$id=(int)$this->pdo->lastInsertId();
    if($d['stock_quantity']>0){$s=$this->pdo->prepare("INSERT INTO inventory_movements(product_id,actor_user_id,quantity_delta,reason,note) VALUES(?,?,?,'initial',?)");$s->execute([$id,$this->actor,$d['stock_quantity'],'Admin product creation']);}
   }else{$id=$d['product_id'];$s=$this->pdo->prepare('UPDATE products SET '.implode(',',array_map(static fn($k)=>$k.'=?',$keys)).' WHERE id=?');$s->execute(array_merge($values,[$id]));}
   $this->pdo->commit();return $this->productDetail($id);
  }catch(Throwable $e){if($this->pdo->inTransaction())$this->pdo->rollBack();if($e instanceof PDOException&&(int)($e->errorInfo[1]??0)===1062)throw new AdminException('DUPLICATE_PRODUCT',409);throw $e;}
 }
 public function archive(array $d):array{
  $this->pdo->beginTransaction();try{
   $s=$this->pdo->prepare('SELECT * FROM products WHERE id=? FOR UPDATE');$s->execute([$d['product_id']]);$p=$s->fetch();if(!$p)throw new AdminException('NOT_FOUND',404);
   if($p['status']===$d['status']){$this->pdo->commit();return $this->productDetail($d['product_id']);}
   if(!hash_equals(self::product($p)['version'],$d['expected_version']))throw new AdminException('STALE_DATA',409);
   $s=$this->pdo->prepare('UPDATE products SET status=? WHERE id=?');$s->execute([$d['status'],$d['product_id']]);$this->pdo->commit();return $this->productDetail($d['product_id']);
  }catch(Throwable $e){if($this->pdo->inTransaction())$this->pdo->rollBack();throw $e;}
 }
 public function adjust(array $d):array{
  $this->pdo->beginTransaction();try{
   $s=$this->pdo->prepare('SELECT stock_quantity FROM products WHERE id=? FOR UPDATE');$s->execute([$d['product_id']]);$old=$s->fetchColumn();if($old===false)throw new AdminException('NOT_FOUND',404);$old=(int)$old;
   if($old!==$d['expected_stock'])throw new AdminException('STALE_DATA',409);$next=$old+$d['quantity_delta'];if($next<0||$next>4294967295)throw new AdminException('INVALID_STOCK');
   $s=$this->pdo->prepare('UPDATE products SET stock_quantity=? WHERE id=?');$s->execute([$next,$d['product_id']]);
   $s=$this->pdo->prepare("INSERT INTO inventory_movements(product_id,actor_user_id,quantity_delta,reason,note) VALUES(?,?,?,'adjustment',?)");$s->execute([$d['product_id'],$this->actor,$d['quantity_delta'],$d['reason']]);
   $this->pdo->commit();return $this->productDetail($d['product_id']);
  }catch(Throwable $e){if($this->pdo->inTransaction())$this->pdo->rollBack();throw $e;}
 }
 public function movements(int $id):array{
  $s=$this->pdo->prepare('SELECT id,order_id,actor_user_id,quantity_delta,reason,note,created_at FROM inventory_movements WHERE product_id=? ORDER BY id DESC LIMIT 50');$s->execute([$id]);return $s->fetchAll();
 }
 public function customers(array $q):array{
  $from="FROM users u WHERE u.role='customer'";$params=[];if($q['q']!==''){$from.=' AND (u.email LIKE ? OR u.full_name LIKE ?)';$params=['%'.$q['q'].'%','%'.$q['q'].'%'];}
  return $this->page('SELECT u.id,u.full_name,u.email,u.phone,u.status,u.created_at,(SELECT COUNT(*) FROM orders o WHERE o.user_id=u.id) AS order_count',$from,$params,$q['page'],$q['size'],'u.id DESC');
 }
}
