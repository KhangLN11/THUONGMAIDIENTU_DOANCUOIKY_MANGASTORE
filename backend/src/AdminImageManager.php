<?php
declare(strict_types=1);
/** All image writers lock the parent product first. Old files are retained, never unlinked here. */
final class AdminImageManager {
 public static function normalize(PDO $pdo,int $productId,?int $preferred=null):void {
  $s=$pdo->prepare('SELECT id,is_primary FROM product_images WHERE product_id=? ORDER BY sort_order,id FOR UPDATE');$s->execute([$productId]);$rows=$s->fetchAll();if(!$rows)return;
  $chosen=$preferred;
  if($chosen===null){foreach($rows as $r)if((int)$r['is_primary']===1){$chosen=(int)$r['id'];break;}$chosen??=(int)$rows[0]['id'];}
  if(!in_array($chosen,array_map(static fn($r)=>(int)$r['id'],$rows),true))throw new AdminException('IMAGE_NOT_FOUND',404);
  $s=$pdo->prepare('UPDATE product_images SET is_primary=CASE WHEN id=? THEN 1 ELSE 0 END WHERE product_id=?');$s->execute([$chosen,$productId]);
 }
 public static function cleanupNew(PDO $pdo,int $id,array $written):void {
  // A lost commit acknowledgement must not remove an image that actually committed.
  try{
   if(!preg_match('/^[a-f0-9]{32}\.(?:jpg|png|webp)$/D',$written['filename']))return;
   $root=realpath(__DIR__.'/../public/uploads/products');if(!$root||is_link(__DIR__.'/../public/uploads/products'))return;
   $dir=$root.DIRECTORY_SEPARATOR.$id;$path=$dir.DIRECTORY_SEPARATOR.$written['filename'];
   if(is_link($dir)||realpath($dir)!==$dir||is_link($path)||realpath($path)!==$path||!is_file($path))return;
   $s=$pdo->prepare('SELECT COUNT(*) FROM product_images WHERE image_url=?');$s->execute([$written['image_url']]);
   if((int)$s->fetchColumn()===0&&!@unlink($path))error_log('Manga image cleanup deferred; run CLI image audit.');
  }catch(Throwable $e){error_log('Manga image cleanup uncertain; file retained for audit.');}
 }
 public static function retained(PDO $pdo,string $url):array {
  $s=$pdo->prepare('SELECT COUNT(*) FROM product_images WHERE image_url=?');$s->execute([$url]);
  return ['image_url'=>$url,'status'=>'retained_for_recovery','remaining_references'=>(int)$s->fetchColumn()];
 }
 public static function mutate(PDO $pdo,array $d,string $action):array {
  $pdo->beginTransaction();try{
   $s=$pdo->prepare('SELECT status FROM products WHERE id=? FOR UPDATE');$s->execute([$d['product_id']]);$status=$s->fetchColumn();if($status===false)throw new AdminException('NOT_FOUND',404);
   $s=$pdo->prepare('SELECT image_url,is_primary FROM product_images WHERE id=? AND product_id=? FOR UPDATE');$s->execute([$d['image_id'],$d['product_id']]);$image=$s->fetch();if(!$image)throw new AdminException('IMAGE_NOT_FOUND',404);
   if(!hash_equals($image['image_url'],$d['expected_image_url']))throw new AdminException('STALE_IMAGE',409);
   if($action==='delete'){
    $s=$pdo->prepare('SELECT COUNT(*) FROM product_images WHERE product_id=?');$s->execute([$d['product_id']]);if($status==='active'&&(int)$s->fetchColumn()===1)throw new AdminException('LAST_ACTIVE_IMAGE',409);
    $s=$pdo->prepare('DELETE FROM product_images WHERE id=? AND product_id=?');$s->execute([$d['image_id'],$d['product_id']]);self::normalize($pdo,$d['product_id']);$cleanup=self::retained($pdo,$image['image_url']);
   }else{self::normalize($pdo,$d['product_id'],$d['image_id']);$cleanup=null;}
   $pdo->commit();return ['product_id'=>$d['product_id'],'image_id'=>$d['image_id'],'cleanup'=>$cleanup];
  }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
 }
}
