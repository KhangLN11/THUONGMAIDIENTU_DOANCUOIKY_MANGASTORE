<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../src/Database.php';$pdo=Database::connect();if($pdo->query('SELECT DATABASE()')->fetchColumn()!=='manga_store_images_test_20261122')throw new RuntimeException('Isolated images DB required.');
$d=json_decode(stream_get_contents(STDIN),true,16,JSON_THROW_ON_ERROR);$action=$d['action']??'';
if(in_array($action,['trigger-on','trigger-off'],true)){
 $pdo->exec('DROP TRIGGER IF EXISTS images_test_fail');
 if($action==='trigger-on'){$id=(int)$d['product_id'];$pdo->exec("CREATE TRIGGER images_test_fail BEFORE UPDATE ON product_images FOR EACH ROW BEGIN IF OLD.product_id=$id THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Injected image failure'; END IF; END");}echo '{}';
}elseif($action==='files'){
 $id=(int)$d['product_id'];$dir='C:/xampp/htdocs/manga-store-images-test-20261122/manga-store/backend/public/uploads/products/'.$id;echo json_encode(is_dir($dir)?array_values(array_diff(scandir($dir),['.','..'])):[],JSON_THROW_ON_ERROR);
}elseif($action==='find'){$s=$pdo->prepare('SELECT id FROM products WHERE sku=?');$s->execute([$d['sku']]);echo json_encode(['id'=>(int)$s->fetchColumn()]);
}elseif($action==='cleanup'){
 $pdo->exec('DROP TRIGGER IF EXISTS images_test_fail');
 foreach($d['skus'] as $sku){if(!preg_match('/^IMGTEST-[a-f0-9]{12}(?:-[A-Z]+)?$/D',$sku))throw new RuntimeException('Invalid SKU');$s=$pdo->prepare('SELECT id FROM products WHERE sku=?');$s->execute([$sku]);$id=$s->fetchColumn();if(!$id)continue;
  $pdo->beginTransaction();try{$s=$pdo->prepare('DELETE FROM inventory_movements WHERE product_id=?');$s->execute([$id]);$s=$pdo->prepare('DELETE FROM products WHERE id=? AND sku=?');$s->execute([$id,$sku]);$pdo->commit();}catch(Throwable $e){$pdo->rollBack();throw $e;}
  $dir='C:/xampp/htdocs/manga-store-images-test-20261122/manga-store/backend/public/uploads/products/'.(int)$id;
  if(is_dir($dir)&&!is_link($dir)){foreach(new DirectoryIterator($dir) as $f){if($f->isDot())continue;if($f->isLink()||!$f->isFile()||!preg_match('/^[a-f0-9]{32}\.(?:jpg|png|webp)$/D',$f->getFilename()))throw new RuntimeException('Unexpected test file');unlink($f->getPathname());}rmdir($dir);}
 }echo '{}';
}else throw new RuntimeException('Unknown action');
