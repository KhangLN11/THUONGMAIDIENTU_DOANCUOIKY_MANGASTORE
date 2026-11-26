<?php
declare(strict_types=1);
/** Read-only account history; never mutates orders, payment or inventory. */
final class AccountOrderRead {
 public function __construct(private PDO $pdo,private int $userId){}
 public function page(array $q):array{
  if(array_diff(array_keys($q),['view','status','page','per_page']))throw new OrderException('INVALID_INPUT',422);
  foreach($q as $v)if(!is_string($v))throw new OrderException('INVALID_INPUT',422);
  $statuses=['pending','confirmed','processing','shipping','delivered','cancelled'];$filter=$q['status']??'all';
  if(($q['view']??null)!=='account'||!in_array($filter,array_merge(['all'],$statuses),true))throw new OrderException('INVALID_INPUT',422);
  $requested=$q['page']??'1';$size=$q['per_page']??'10';
  if(!preg_match('/\A[1-9][0-9]{0,6}\z/D',$requested)||!in_array($size,['10','20','50'],true))throw new OrderException('INVALID_INPUT',422);
  $this->pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');$this->pdo->exec('START TRANSACTION READ ONLY');
  try{
   $counts=array_fill_keys($statuses,0);$s=$this->pdo->prepare('SELECT status,COUNT(*) AS n FROM orders WHERE user_id=? GROUP BY status');$s->execute([$this->userId]);foreach($s->fetchAll() as $r)$counts[$r['status']]=(int)$r['n'];
   $all=array_sum($counts);$total=$filter==='all'?$all:$counts[$filter];$pages=max(1,(int)ceil($total/(int)$size));$page=min((int)$requested,$pages);
   $params=[$this->userId];$where='o.user_id=?';if($filter!=='all'){$where.=' AND o.status=?';$params[]=$filter;}
   $s=$this->pdo->prepare('SELECT o.id,o.order_code,o.status,o.total_vnd,o.created_at,p.method AS payment_method,p.status AS payment_status FROM orders o LEFT JOIN payments p ON p.order_id=o.id WHERE '.$where.' ORDER BY o.created_at DESC,o.id DESC LIMIT '.(int)$size.' OFFSET '.(($page-1)*(int)$size));$s->execute($params);$rows=$s->fetchAll();
   foreach($rows as &$r){$r['id']=(int)$r['id'];$r['total_vnd']=(int)$r['total_vnd'];}unset($r);
   $this->pdo->commit();return ['items'=>$rows,'counts'=>$counts,'total_orders'=>$all,'total'=>$total,'page'=>$page,'pages'=>$pages,'page_size'=>(int)$size];
  }catch(Throwable $e){if($this->pdo->inTransaction())$this->pdo->rollBack();throw $e;}
 }
}
