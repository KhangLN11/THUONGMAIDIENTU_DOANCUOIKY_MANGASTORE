<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../src/Database.php';$pdo=Database::connect();
$refs=$pdo->query('SELECT image_url FROM product_images')->fetchAll(PDO::FETCH_COLUMN);$known=array_fill_keys($refs,true);$root=realpath(__DIR__.'/../public/uploads/products');if(!$root||is_link(__DIR__.'/../public/uploads/products'))throw new RuntimeException('Invalid root');
$out=[];foreach(new DirectoryIterator($root) as $dir){if(!$dir->isDir()||$dir->isDot()||$dir->isLink()||!preg_match('/^[1-9][0-9]*$/D',$dir->getFilename()))continue;
 foreach(new DirectoryIterator($dir->getPathname()) as $f){if(!$f->isFile()||$f->isLink()||!preg_match('/^[a-f0-9]{32}\.(?:jpg|png|webp)$/D',$f->getFilename()))continue;
  $url='/manga-store/backend/public/uploads/products/'.$dir->getFilename().'/'.$f->getFilename();if(!isset($known[$url]))$out[]=['image_url'=>$url,'bytes'=>$f->getSize(),'status'=>'unreferenced_retained'];
 }
}
echo json_encode(['read_only'=>true,'files'=>$out,'note'=>'Audit only. No file is deleted. Compare DB/upload backups before manual recovery or cleanup.'],JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR);
