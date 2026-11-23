<?php
declare(strict_types=1);
require_once __DIR__.'/admin_bootstrap.php';

/** Product-management-only queries. Inventory and other Admin pages retain their APIs. */
final class AdminProductCatalog {
 public function __construct(private PDO $pdo) {}
 public function listing(array $q):array {
  $base=admin_query('products');
  $series=isset($q['series_id'])&&$q['series_id']!==''?admin_id($q['series_id']):null;
  $sort=admin_enum($q['sort']??'updated',['updated','name','price_asc','price_desc','stock_asc','stock_desc']);
  $lang=admin_enum($q['language']??'vi',['vi','en']);
  $low=admin_enum($q['low']??'0',['0','1']);
  $effective='CASE WHEN p.sale_price_vnd>0 AND p.sale_price_vnd<=p.price_vnd THEN p.sale_price_vnd ELSE p.price_vnd END';
  $orders=['updated'=>'p.updated_at DESC,p.id DESC','name'=>'p.name_'.$lang.' ASC,p.id ASC','price_asc'=>$effective.' ASC,p.id ASC','price_desc'=>$effective.' DESC,p.id DESC','stock_asc'=>'p.stock_quantity ASC,p.id ASC','stock_desc'=>'p.stock_quantity DESC,p.id DESC'];
  $where=' WHERE 1=1';$params=[];
  if($base['q']!==''){$where.=" AND (p.name_vi LIKE ? ESCAPE '!' OR p.name_en LIKE ? ESCAPE '!' OR p.sku LIKE ? ESCAPE '!' OR p.slug LIKE ? ESCAPE '!')";$term='%'.strtr($base['q'],['!'=>'!!','%'=>'!%','_'=>'!_']).'%';$params=array_fill(0,4,$term);}
  foreach(['category_id'=>$base['category_id'],'series_id'=>$series] as $column=>$value)if($value!==null){$where.=' AND p.'.$column.'=?';$params[]=$value;}
  if($base['status']!==''){$where.=' AND p.status=?';$params[]=$base['status'];}
  if($low==='1')$where.=" AND p.status='active' AND p.stock_quantity<=5";
  $this->pdo->beginTransaction();try {
   $s=$this->pdo->prepare('SELECT COUNT(*) FROM products p'.$where);$s->execute($params);$total=(int)$s->fetchColumn();$last=max(1,(int)ceil($total/$base['size']));$page=min($base['page'],$last);
   $sql='SELECT p.*,(SELECT image_url FROM product_images i WHERE i.product_id=p.id ORDER BY i.is_primary DESC,i.sort_order,i.id LIMIT 1) AS image_url FROM products p'.$where.' ORDER BY '.$orders[$sort].' LIMIT '.$base['size'].' OFFSET '.(($page-1)*$base['size']);
   $s=$this->pdo->prepare($sql);$s->execute($params);$items=array_map([AdminRepository::class,'product'],$s->fetchAll());
   $overview=$this->pdo->query("SELECT COUNT(*) AS total,COALESCE(SUM(status='active'),0) AS active,COALESCE(SUM(status='archived'),0) AS archived,COALESCE(SUM(status='draft'),0) AS draft FROM products")->fetch();$overview=array_map('intval',$overview);
   $this->pdo->commit();return ['items'=>$items,'meta'=>['page'=>$page,'page_size'=>$base['size'],'total'=>$total,'last_page'=>$last],'overview'=>$overview,'low_stock_threshold'=>5];
  }catch(Throwable $e){if($this->pdo->inTransaction())$this->pdo->rollBack();throw $e;}
 }
 public function createSeries(array $d):array {
  admin_fields($d,['title','slug','original_title','description_vi','description_en']);
  $rawTitle=$d['title']??null;if(is_string($rawTitle)&&preg_match('//u',$rawTitle))$rawTitle=preg_replace('/\A\s+|\s+\z/u','',$rawTitle);$title=admin_text($rawTitle,200);$slug=admin_text($d['slug']??null,160);
  if(!preg_match('/\A[a-z0-9]+(?:-[a-z0-9]+)*\z/D',$slug))throw new AdminException('INVALID_SERIES',422);
  $original=admin_text($d['original_title']??'',200,false);
  $vi=admin_text($d['description_vi']??'',2000,false,true);$en=admin_text($d['description_en']??'',2000,false,true);
  // The two UNIQUE indexes enforce identity atomically, even across sessions/requests.
  try{$s=$this->pdo->prepare('INSERT INTO manga_series(title,slug,original_title,description_vi,description_en) VALUES(?,?,?,?,?)');$s->execute([$title,$slug,$original===''?null:$original,$vi===''?null:$vi,$en===''?null:$en]);}
  catch(PDOException $e){if((int)($e->errorInfo[1]??0)!==1062)throw $e;
   $s=$this->pdo->prepare('SELECT id,title,slug,original_title,description_vi,description_en,is_active FROM manga_series WHERE title=? OR slug=? ORDER BY id LIMIT 2');$s->execute([$title,$slug]);
   auth_json(['success'=>false,'error'=>['code'=>'DUPLICATE_SERIES','message'=>'Series already exists.'],'data'=>['existing'=>$s->fetchAll()]],409);
  }
  $id=(int)$this->pdo->lastInsertId();$s=$this->pdo->prepare('SELECT id,title,slug,original_title,description_vi,description_en,is_active FROM manga_series WHERE id=?');$s->execute([$id]);$row=$s->fetch();$row['id']=(int)$row['id'];$row['is_active']=(bool)$row['is_active'];return $row;
 }
}
function admin_catalog_run(string $action):void {
 try{Auth::method($action==='series-create'?'POST':'GET');Auth::requireAdmin();$repo=new AdminProductCatalog(Database::connect());
  if($action==='series-create'){Auth::csrf();$data=$repo->createSeries(admin_json());auth_json(['success'=>true,'data'=>$data],201);}
  auth_json(['success'=>true,'data'=>$repo->listing($_GET)]);
 }catch(AdminException $e){auth_error($e->errorCode,$e->status);}
}
