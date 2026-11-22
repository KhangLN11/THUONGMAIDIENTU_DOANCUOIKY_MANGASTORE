<?php
declare(strict_types=1);
require_once __DIR__.'/ProductImageStorage.php';
final class AdminImageUpload{
 public static function handle(PDO $pdo):array{
  admin_fields($_POST,['product_id','alt_vi','alt_en']);$id=admin_id($_POST['product_id']??null);
  if(count($_FILES)!==1||!isset($_FILES['image'])||!is_array($_FILES['image']))throw new AdminException('INVALID_IMAGE');$f=$_FILES['image'];
  if(($f['error']??1)!==UPLOAD_ERR_OK||!is_string($f['tmp_name']??null)||!is_uploaded_file($f['tmp_name'])||!is_string($f['name']??null)||str_contains($f['name'],'..')||strpbrk($f['name'],"/\\")!==false)throw new AdminException('INVALID_IMAGE');
  $ext=strtolower(pathinfo($f['name'],PATHINFO_EXTENSION));if(!in_array($ext,['jpg','jpeg','png','webp'],true))throw new AdminException('INVALID_IMAGE');
  $bytes=file_get_contents($f['tmp_name'],false,null,0,5*1024*1024+1);if($bytes===false||strlen($bytes)<1||strlen($bytes)>5*1024*1024)throw new AdminException('INVALID_IMAGE');
  $info=@getimagesizefromstring($bytes);if(!$info||$info[0]*$info[1]>8000000)throw new AdminException('INVALID_IMAGE');
  $temp=sys_get_temp_dir().'/manga-admin-'.bin2hex(random_bytes(16)).'.'.$ext;$h=fopen($temp,'xb');if(!$h)throw new RuntimeException('Staging unavailable.');
  $staged=false;try{if(fwrite($h,$bytes)!==strlen($bytes))throw new RuntimeException('Staging unavailable.');$staged=true;}finally{fclose($h);if(!$staged&&is_file($temp))unlink($temp);}
  $written=null;$committed=false;
  try{
   $pdo->beginTransaction();$s=$pdo->prepare('SELECT name_vi,name_en FROM products WHERE id=? FOR UPDATE');$s->execute([$id]);$p=$s->fetch();if(!$p)throw new AdminException('NOT_FOUND',404);
   $s=$pdo->prepare('SELECT COUNT(*),COALESCE(MAX(sort_order),-1),COALESCE(SUM(is_primary),0) FROM product_images WHERE product_id=?');$s->execute([$id]);$existing=$s->fetch(PDO::FETCH_NUM);
   $root=__DIR__.'/../public/uploads/products';$written=(new ProductImageStorage($root))->stage($temp,(string)$id,true);
   $s=$pdo->prepare('INSERT INTO product_images(product_id,image_url,alt_vi,alt_en,sort_order,is_primary) VALUES(?,?,?,?,?,?)');$s->execute([$id,$written['image_url'],admin_text($_POST['alt_vi']??$p['name_vi'],255,false),admin_text($_POST['alt_en']??$p['name_en'],255,false),(int)$existing[1]+1,(int)$existing[2]===0?1:0]);
   $imageId=(int)$pdo->lastInsertId();$pdo->commit();$committed=true;return ['id'=>$imageId,'image_url'=>$written['image_url']];
  }catch(InvalidArgumentException $e){if($pdo->inTransaction())$pdo->rollBack();throw new AdminException('INVALID_IMAGE');}
  finally{
   if($pdo->inTransaction())$pdo->rollBack();
   if(!$committed&&$written){$path=__DIR__.'/../public/uploads/products/'.$id.'/'.$written['filename'];if(preg_match('/\A[a-f0-9]{32}\.(jpg|png|webp)\z/D',$written['filename'])&&is_file($path))unlink($path);}
   if(is_file($temp))unlink($temp);
  }
 }
}
