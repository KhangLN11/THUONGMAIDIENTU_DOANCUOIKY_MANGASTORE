<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__.'/../src/Database.php';
require_once __DIR__.'/../src/ProductImageStorage.php';
require_once __DIR__.'/../src/DemoCatalog.php';
$options=getopt('', ['dry-run','apply','restore-images','approved-sha256:','backup:']);
$path=__DIR__.'/../../database/catalog/demo-products/manifest.json';
$created=[]; $pdo=null; $locked=false;
try {
    $manifest=DemoCatalog::read($path);
    $validation=DemoCatalog::validate($manifest,dirname($path));
    $sha=hash_file('sha256',$path);
    $pdo=Database::connect();
    $required=['products'=>['id','sku','slug','name_vi','name_en','description_vi','description_en','price_vnd','sale_price_vnd','stock_quantity','category_id','series_id','status','is_featured'],'categories'=>['id','slug','name_vi','name_en','sort_order','is_active'],'manga_series'=>['id','slug','title','is_active'],'product_images'=>['id','product_id','image_url','alt_vi','alt_en','sort_order','is_primary']];
    foreach ($required as $table=>$columns) {
        $actual=array_column(DemoCatalog::query($pdo,'SHOW COLUMNS FROM `'.$table.'`'),'Field');
        if (array_diff($columns,$actual)) throw new RuntimeException('Database schema mismatch: '.$table);
    }
    $plan=DemoCatalog::plan($pdo,$manifest);
    $apply=isset($options['apply']); $restore=isset($options['restore-images']);
    if ($apply && $restore) throw new RuntimeException('Choose apply OR restore-images.');
    $report=['mode'=>$apply?'apply':($restore?'restore-images':'dry-run'),'manifest_sha256'=>$sha,'validation'=>$validation,'plan'=>$plan,'approval_required_for_writes'=>true];
    if (!$apply && !$restore) {
        $report['mysql_writes']=0;
        echo json_encode($report,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR).PHP_EOL;
        exit($plan['conflicts'] ? 1 : 0);
    }
    if (isset($options['dry-run']) || !isset($options['approved-sha256']) || !is_string($options['approved-sha256']) || !hash_equals($sha,$options['approved-sha256'])) throw new RuntimeException('Writes require explicit --approved-sha256 matching the reviewed manifest.');
    if ($plan['conflicts']) throw new RuntimeException('Conflicts detected; refusing all writes.');
    if (!isset($options['backup']) || !is_string($options['backup']) || !is_file($options['backup']) || filesize($options['backup'])<100) throw new RuntimeException('Provide the verified nonempty SQL backup path using --backup before writes.');
    $locked=(int)DemoCatalog::query($pdo,"SELECT GET_LOCK('manga-store-demo-catalog',10) AS acquired")[0]['acquired']===1;
    if (!$locked) throw new RuntimeException('Another catalog import is running.');
    $pdo->beginTransaction();
    if (DemoCatalog::plan($pdo,$manifest)['conflicts']) throw new RuntimeException('Catalog changed since preflight.');
    if ($apply) DemoCatalog::insert($pdo,$manifest,false);
    elseif ($plan['new_products'] || $plan['new_images'] || $plan['new_categories'] || $plan['new_series']) throw new RuntimeException('SQL import is incomplete; restore-images refuses catalog writes.');
    $report['files_copied']=DemoCatalog::restoreImages($pdo,$manifest,dirname($path),$created);
    $report['images_verified_before_linking']=DemoCatalog::verifyImages($pdo,$manifest,[getenv('CATALOG_APACHE_ORIGIN') ?: 'http://localhost',getenv('CATALOG_VITE_ORIGIN') ?: 'http://localhost:8443']);
    if ($apply) DemoCatalog::insertImages($pdo,$manifest);
    $pdo->commit();
    $report['completed']=true;
    echo json_encode($report,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR).PHP_EOL;
} catch (Throwable $error) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    $root=realpath(__DIR__.'/../public/uploads/products');
    foreach ($created as $file) {
        $resolved=realpath($file);
        if ($resolved && strncmp($resolved,$root.DIRECTORY_SEPARATOR,strlen($root)+1)===0 && is_file($resolved)) unlink($resolved);
    }
    fwrite(STDERR,'Catalog preparation/import failed: '.$error->getMessage().PHP_EOL);
    exit(1);
} finally {
    if ($locked && $pdo instanceof PDO) DemoCatalog::query($pdo,"SELECT RELEASE_LOCK('manga-store-demo-catalog')");
}
