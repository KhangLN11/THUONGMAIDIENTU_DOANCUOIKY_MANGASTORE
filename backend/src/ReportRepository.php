<?php
declare(strict_types=1);
final class ReportException extends RuntimeException {
 public function __construct(public string $errorCode, public int $status=422){parent::__construct($errorCode);}
}
final class ReportPeriod {
 public DateTimeImmutable $start; public DateTimeImmutable $end; public string $group; public string $preset;
 public function __construct(array $q){
  if(array_diff(array_keys($q),['preset','start','end','group','type','language']))throw new ReportException('INVALID_REPORT_FILTER');
  foreach($q as $v)if(!is_string($v))throw new ReportException('INVALID_REPORT_FILTER');
  $tz=new DateTimeZone('Asia/Ho_Chi_Minh');$today=new DateTimeImmutable('today',$tz);
  $this->preset=$q['preset']??'30days';$this->group=$q['group']??'day';
  if(!in_array($this->group,['day','month','year'],true))throw new ReportException('INVALID_REPORT_FILTER');
  if($this->preset==='custom'){
   $parse=static function(string $v)use($tz):DateTimeImmutable{$d=DateTimeImmutable::createFromFormat('!Y-m-d',$v,$tz);if(!$d||$d->format('Y-m-d')!==$v||$v<'2000-01-01'||$v>'2099-12-31')throw new ReportException('INVALID_REPORT_FILTER');return $d;};
   $this->start=$parse($q['start']??'');$this->end=$parse($q['end']??'')->modify('+1 day');
  }else{
   if(isset($q['start'])||isset($q['end']))throw new ReportException('INVALID_REPORT_FILTER');
   $starts=['today'=>$today,'7days'=>$today->modify('-6 days'),'30days'=>$today->modify('-29 days'),'month'=>$today->modify('first day of this month'),'year'=>$today->setDate((int)$today->format('Y'),1,1)];
   if(!isset($starts[$this->preset]))throw new ReportException('INVALID_REPORT_FILTER');$this->start=$starts[$this->preset];$this->end=$today->modify('+1 day');
  }
  $days=(int)$this->start->diff($this->end)->format('%r%a');if($days<1||$days>366)throw new ReportException('INVALID_REPORT_FILTER');
 }
 public function bounds():array{return[$this->start->format('Y-m-d H:i:s'),$this->end->format('Y-m-d H:i:s')];}
 public function meta():array{return['preset'=>$this->preset,'start'=>$this->start->format('Y-m-d'),'end'=>$this->end->modify('-1 day')->format('Y-m-d'),'end_exclusive'=>$this->end->format('Y-m-d H:i:s'),'timezone'=>'Asia/Ho_Chi_Minh','utc_offset'=>'+07:00','group'=>$this->group,'max_days'=>366,'snapshot_metrics'=>['total_customers','active_products','low_stock','inventory'],'sold_basis'=>'currently_delivered_orders_created_in_period','cod_basis'=>'confirmed_cod_paid_at_in_period','category_basis'=>'current_product_category_not_historical_snapshot','refunds_adjusted'=>false];}
}
final class ReportRepository {
 private const COD="p.method='cod' AND p.status='paid' AND p.paid_at IS NOT NULL AND p.transaction_ref IS NOT NULL AND TRIM(p.transaction_ref)<>'' AND o.status='delivered'";
 public function __construct(private PDO $pdo,private ReportPeriod $period){}
 private function query(string $sql,array $params=[]):array{$s=$this->pdo->prepare($sql);$s->execute($params);return $s->fetchAll();}
 private function sums(array $row,array $counts):array{foreach($counts as $k)$row[$k]=(int)$row[$k];return $row;}
 public function snapshot(callable $fn):array{
  // Existing writers store local DATETIME, not UTC. Refuse an incompatible server rather than silently shift history.
  if((int)$this->pdo->query('SELECT TIMESTAMPDIFF(SECOND,UTC_TIMESTAMP(),NOW())')->fetchColumn()!==25200)throw new ReportException('REPORT_TIMEZONE_ERROR',503);
  $this->pdo->exec("SET SESSION time_zone='+07:00'");
  $this->pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');$this->pdo->exec('START TRANSACTION READ ONLY');
  try{$r=$fn();$this->pdo->commit();return $r;}catch(Throwable $e){if($this->pdo->inTransaction())$this->pdo->rollBack();throw $e;}
 }
 public function overview():array{
  $b=$this->period->bounds();
  $r=$this->query("SELECT COUNT(*) AS total_orders,COALESCE(SUM(status='pending'),0) AS pending_orders,COALESCE(SUM(status IN ('confirmed','processing','shipping')),0) AS processing_orders,COALESCE(SUM(status='delivered'),0) AS completed_orders,COALESCE(SUM(status='cancelled'),0) AS cancelled_orders,CAST(COALESCE(SUM(total_vnd),0) AS CHAR) AS created_order_value_vnd,CAST(COALESCE(ROUND(AVG(total_vnd),0),0) AS CHAR) AS average_order_vnd FROM orders WHERE created_at>=? AND created_at<?",$b)[0];
  $r=$this->sums($r,['total_orders','pending_orders','processing_orders','completed_orders','cancelled_orders']);
  $now=$this->query("SELECT (SELECT COUNT(*) FROM users WHERE role='customer') AS total_customers,(SELECT COUNT(*) FROM products WHERE status='active') AS active_products,(SELECT COUNT(*) FROM products WHERE status='active' AND stock_quantity<=5) AS low_stock")[0];
  $r+=$this->sums($now,['total_customers','active_products','low_stock']);
  $r['sold_quantity']=(int)$this->query("SELECT COALESCE(SUM(i.quantity),0) AS n FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status='delivered' AND o.created_at>=? AND o.created_at<?",$b)[0]['n'];
  $paid=$this->query("SELECT CAST(COALESCE(SUM(p.amount_vnd),0) AS CHAR) AS collected_cod_vnd,COUNT(*) AS collected_orders,CAST(COALESCE(ROUND(AVG(p.amount_vnd),0),0) AS CHAR) AS average_collected_vnd FROM payments p JOIN orders o ON o.id=p.order_id WHERE ".self::COD.' AND p.paid_at>=? AND p.paid_at<?',$b)[0];
  return $r+$this->sums($paid,['collected_orders']);
 }
 public function revenue():array{
  $format=['day'=>'%Y-%m-%d','month'=>'%Y-%m','year'=>'%Y'][$this->period->group];$b=$this->period->bounds();
  $orders=$this->query("SELECT DATE_FORMAT(created_at,'$format') AS bucket,COUNT(*) AS total_orders,CAST(SUM(total_vnd) AS CHAR) AS created_order_value_vnd,CAST(ROUND(AVG(total_vnd),0) AS CHAR) AS average_order_vnd FROM orders WHERE created_at>=? AND created_at<? GROUP BY bucket",$b);
  $payments=$this->query("SELECT DATE_FORMAT(p.paid_at,'$format') AS bucket,COUNT(*) AS collected_orders,CAST(SUM(p.amount_vnd) AS CHAR) AS collected_cod_vnd FROM payments p JOIN orders o ON o.id=p.order_id WHERE ".self::COD.' AND p.paid_at>=? AND p.paid_at<? GROUP BY bucket',$b);
  $by=[];foreach($orders as $r)$by[$r['bucket']]=$this->sums($r,['total_orders']);foreach($payments as $r)$by[$r['bucket']]=($by[$r['bucket']]??[])+$this->sums($r,['collected_orders']);
  $step=['day'=>'+1 day','month'=>'+1 month','year'=>'+1 year'][$this->period->group];$f=['day'=>'Y-m-d','month'=>'Y-m','year'=>'Y'][$this->period->group];$d=$this->period->start;
  if($this->period->group==='month')$d=$d->modify('first day of this month');elseif($this->period->group==='year')$d=$d->setDate((int)$d->format('Y'),1,1);
  $rows=[];for(;$d<$this->period->end;$d=$d->modify($step)){$k=$d->format($f);$rows[]=($by[$k]??[])+['bucket'=>$k,'total_orders'=>0,'created_order_value_vnd'=>'0','average_order_vnd'=>'0','collected_orders'=>0,'collected_cod_vnd'=>'0'];}return $rows;
 }
 public function statuses():array{
  $r=$this->query('SELECT status,COUNT(*) AS total_orders FROM orders WHERE created_at>=? AND created_at<? GROUP BY status',$this->period->bounds());$by=[];foreach($r as $v)$by[$v['status']]=(int)$v['total_orders'];$out=[];foreach(['pending','confirmed','processing','shipping','delivered','cancelled'] as $s)$out[]=['status'=>$s,'total_orders'=>$by[$s]??0];return $out;
 }
 public function products():array{
  return array_map(fn($r)=>$this->sums($r,['sold_quantity']),$this->query("SELECT i.product_id,MIN(i.sku_snapshot) AS sku,MAX(i.name_vi_snapshot) AS name_vi,MAX(i.name_en_snapshot) AS name_en,SUM(i.quantity) AS sold_quantity,CAST(SUM(i.line_total_vnd) AS CHAR) AS sales_value_vnd FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status='delivered' AND o.created_at>=? AND o.created_at<? GROUP BY i.product_id,CASE WHEN i.product_id IS NULL THEN i.sku_snapshot ELSE '' END ORDER BY SUM(i.quantity) DESC,SUM(i.line_total_vnd) DESC,i.product_id,sku LIMIT 10",$this->period->bounds()));
 }
 public function categories():array{
  // Category itself is not snapshotted by checkout; deleted product links are explicitly unclassified.
  $sales=$this->query("SELECT p.category_id,SUM(i.quantity) AS sold_quantity,CAST(SUM(i.line_total_vnd) AS CHAR) AS sales_value_vnd FROM order_items i JOIN orders o ON o.id=i.order_id LEFT JOIN products p ON p.id=i.product_id WHERE o.status='delivered' AND o.created_at>=? AND o.created_at<? GROUP BY p.category_id",$this->period->bounds());
  $rows=$this->query('SELECT id AS category_id,slug,name_vi,name_en FROM categories ORDER BY sort_order,id');$by=[];foreach($sales as $s)$by[$s['category_id']??'unknown']=$s;
  foreach($rows as &$r){$s=$by[$r['category_id']]??[];$r['category_id']=(int)$r['category_id'];$r['sold_quantity']=(int)($s['sold_quantity']??0);$r['sales_value_vnd']=$s['sales_value_vnd']??'0';}unset($r);
  if(isset($by['unknown']))$rows[]=['category_id'=>null,'slug'=>'unclassified','name_vi'=>'Chưa phân loại','name_en'=>'Unclassified','sold_quantity'=>(int)$by['unknown']['sold_quantity'],'sales_value_vnd'=>$by['unknown']['sales_value_vnd']];return $rows;
 }
 public function metadata():array{return $this->period->meta()+['simulation'=>in_array($this->pdo->query('SELECT DATABASE()')->fetchColumn(),['manga_store_reports_demo','manga_store_reports_test_20261122'],true)];}
 public function all():array{return ['period'=>$this->metadata(),'overview'=>$this->overview(),'revenue'=>$this->revenue(),'statuses'=>$this->statuses(),'products'=>$this->products(),'categories'=>$this->categories()];}
 public function export(string $type):array{
  if($type==='revenue')return $this->revenue();if($type==='products')return $this->products();
  if($type==='orders'){$rows=$this->query("SELECT o.order_code,o.created_at,o.status,CAST(o.total_vnd AS CHAR) AS total_vnd,p.method AS payment_method,p.status AS payment_status,p.paid_at,CAST(CASE WHEN ".self::COD." THEN p.amount_vnd ELSE 0 END AS CHAR) AS confirmed_cod_for_order_vnd FROM orders o LEFT JOIN payments p ON p.order_id=o.id WHERE o.created_at>=? AND o.created_at<? ORDER BY o.created_at,o.id LIMIT 10001",$this->period->bounds());}
  elseif($type==='inventory'){$rows=$this->query('SELECT p.sku,p.name_vi,p.name_en,c.name_vi AS category_vi,c.name_en AS category_en,p.status,p.stock_quantity,CAST(p.price_vnd AS CHAR) AS price_vnd,CAST(p.sale_price_vnd AS CHAR) AS sale_price_vnd FROM products p LEFT JOIN categories c ON c.id=p.category_id ORDER BY p.id LIMIT 10001');}
  else throw new ReportException('INVALID_REPORT_FILTER');if(count($rows)>10000)throw new ReportException('EXPORT_LIMIT',422);return $rows;
 }
}
