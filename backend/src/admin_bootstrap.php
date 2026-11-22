<?php
declare(strict_types=1);
require_once __DIR__.'/auth_bootstrap.php';
require_once __DIR__.'/AdminRepository.php';
function admin_num($v,int $min=1,int $max=9007199254740991):int{if(!is_int($v)||$v<$min||$v>$max)throw new AdminException('INVALID_INPUT');return $v;}
function admin_id($v):int{if(is_string($v)&&preg_match('/\A[1-9][0-9]{0,14}\z/D',$v))$v=(int)$v;return admin_num($v);}
function admin_text($v,int $max,bool $required=true,bool $multiline=false):string{
 if(!is_string($v))throw new AdminException('INVALID_INPUT');$v=trim($v);
 if(!preg_match('//u',$v)||preg_match_all('/./us',$v)>$max||($required&&$v==='')||(!$multiline&&preg_match('/\p{C}/u',$v))||($multiline&&preg_match('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/',$v)))throw new AdminException('INVALID_INPUT');return $v;
}
function admin_enum($v,array $values):string{if(!is_string($v)||!in_array($v,$values,true))throw new AdminException('INVALID_INPUT');return $v;}
function admin_fields(array $d,array $allowed):void{if(array_diff(array_keys($d),$allowed))throw new AdminException('INVALID_INPUT',400);}
function admin_version($v):string{if(!is_string($v)||!preg_match('/\A[a-f0-9]{64}\z/D',$v))throw new AdminException('INVALID_INPUT');return $v;}
function admin_json():array{
 if(strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')throw new AdminException('INVALID_INPUT',415);
 $raw=file_get_contents('php://input',false,null,0,32769);if($raw===false||strlen($raw)>32768)throw new AdminException('INVALID_INPUT',413);
 try{$d=json_decode($raw,false,8,JSON_THROW_ON_ERROR);}catch(JsonException $e){throw new AdminException('INVALID_INPUT');}
 if(!$d instanceof stdClass)throw new AdminException('INVALID_INPUT');return(array)$d;
}
function admin_query(string $kind):array{
 $page=admin_id($_GET['page']??'1');$size=admin_id($_GET['page_size']??'20');if($page>100000||$size>50)throw new AdminException('INVALID_INPUT');
 $q=admin_text($_GET['q']??'',100,false);$status=$_GET['status']??'';
 $states=$kind==='orders'?['pending','confirmed','processing','shipping','delivered','cancelled']:['draft','active','archived'];
 if($status!=='')$status=admin_enum($status,$states);
 return ['page'=>$page,'size'=>$size,'q'=>$q,'status'=>$status,'category_id'=>isset($_GET['category_id'])&&$_GET['category_id']!==''?admin_id($_GET['category_id']):null,'low'=>($_GET['low']??'0')==='1'];
}
function admin_product_input(array $d,bool $create):array{
 $fields=['category_id','series_id','sku','slug','name_vi','name_en','description_vi','description_en','price_vnd','sale_price_vnd','status'];
 admin_fields($d,array_merge($fields,$create?['stock_quantity']:['product_id','expected_version']));$r=[];
 $r['category_id']=admin_num($d['category_id']??null);$r['series_id']=($d['series_id']??null)===null?null:admin_num($d['series_id']);
 $r['sku']=admin_text($d['sku']??null,64);$r['slug']=admin_text($d['slug']??null,200);
 if(!preg_match('/\A[A-Za-z0-9._-]+\z/D',$r['sku'])||!preg_match('/\A[a-z0-9]+(?:-[a-z0-9]+)*\z/D',$r['slug']))throw new AdminException('INVALID_INPUT');
 foreach(['name_vi','name_en'] as $k)$r[$k]=admin_text($d[$k]??null,255);
 foreach(['description_vi','description_en'] as $k)$r[$k]=admin_text($d[$k]??'',2000,false,true);
 $r['price_vnd']=admin_num($d['price_vnd']??null,0,99999999999999);$r['sale_price_vnd']=($d['sale_price_vnd']??null)===null?null:admin_num($d['sale_price_vnd'],1,$r['price_vnd']);
 $r['status']=admin_enum($d['status']??null,['draft','active','archived']);
 if($create)$r['stock_quantity']=admin_num($d['stock_quantity']??null,0,2147483647);
 else{$r['product_id']=admin_num($d['product_id']??null);$r['expected_version']=admin_version($d['expected_version']??null);}
 return $r;
}
function admin_run(string $action):void{
 try{
  $writes=['order-status','payment-confirm','product-create','product-update','product-archive','inventory-adjust'];Auth::method(in_array($action,$writes,true)?'POST':'GET');$admin=Auth::requireAdmin();$repo=new AdminRepository(Database::connect(),(int)$admin['id']);
  if(in_array($action,$writes,true)){Auth::csrf();$d=admin_json();}
  switch($action){
   case 'dashboard':$data=$repo->dashboard();break;
   case 'orders':$data=$repo->orders(admin_query('orders'));break;
   case 'order':$data=$repo->order(admin_id($_GET['id']??null));break;
   case 'order-status':admin_fields($d,['order_id','status','expected_status']);$data=$repo->transition(['order_id'=>admin_num($d['order_id']??null),'status'=>admin_enum($d['status']??null,['pending','confirmed','processing','shipping','delivered','cancelled']),'expected_status'=>admin_enum($d['expected_status']??null,['pending','confirmed','processing','shipping','delivered','cancelled'])]);break;
   case 'payment-confirm':admin_fields($d,['order_id','received','reference']);if(($d['received']??null)!==true)throw new AdminException('PAYMENT_CONFIRMATION_REQUIRED');$data=$repo->collect(['order_id'=>admin_num($d['order_id']??null),'reference'=>admin_text($d['reference']??null,150)]);break;
   case 'products':$data=$repo->products(admin_query('products'));break;
   case 'product':$data=$repo->productDetail(admin_id($_GET['id']??null));break;
   case 'metadata':$data=$repo->metadata();break;
   case 'product-create':$data=$repo->saveProduct(admin_product_input($d,true),true);break;
   case 'product-update':$data=$repo->saveProduct(admin_product_input($d,false),false);break;
   case 'product-archive':admin_fields($d,['product_id','status','expected_version']);$data=$repo->archive(['product_id'=>admin_num($d['product_id']??null),'status'=>admin_enum($d['status']??null,['active','archived']),'expected_version'=>admin_version($d['expected_version']??null)]);break;
   case 'inventory':$data=$repo->products(admin_query('products'),true);break;
   case 'inventory-movements':$data=$repo->movements(admin_id($_GET['product_id']??null));break;
   case 'inventory-adjust':admin_fields($d,['product_id','quantity_delta','expected_stock','reason']);$delta=admin_num($d['quantity_delta']??null,-2147483647,2147483647);if($delta===0)throw new AdminException('INVALID_STOCK');$data=$repo->adjust(['product_id'=>admin_num($d['product_id']??null),'quantity_delta'=>$delta,'expected_stock'=>admin_num($d['expected_stock']??null,0,4294967295),'reason'=>admin_text($d['reason']??null,255)]);break;
   case 'customers':$data=$repo->customers(admin_query('customers'));break;
   default:throw new AdminException('NOT_FOUND',404);
  }
  auth_json(['success'=>true,'data'=>$data]);
 }catch(AdminException $e){auth_error($e->errorCode,$e->status);}catch(OrderException $e){auth_error($e->errorCode,$e->status);}
}
