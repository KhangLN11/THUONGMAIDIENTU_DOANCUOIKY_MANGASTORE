<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }
require_once __DIR__.'/../src/Database.php';
require_once __DIR__.'/../src/ProductImageStorage.php';
require_once __DIR__.'/../src/DemoCatalog.php';
$options=getopt('',['dry-run','apply','backup-dir:','approved-sha256:']);
$pdo=null; $locked=false;
try {
    if (!isset($options['backup-dir']) || !is_string($options['backup-dir'])) throw new RuntimeException('Provide --backup-dir with the verified pre-import snapshot.');
    $backup=realpath($options['backup-dir']);
    if (!$backup || !is_file($backup.'/before.json') || !is_file($backup.'/manga_store_full.sql') || !is_file($backup.'/after-import-before-archive.json')) throw new RuntimeException('Pre-import backup/import verification snapshot missing.');
    $before=json_decode(file_get_contents($backup.'/before.json'),true,512,JSON_THROW_ON_ERROR);
    $legacy=$before['tables']['products']['rows'];
    $expected=['DEMO-MANGA-001','DEMO-MANGA-002','DEMO-MANGA-003','DEMO-FIG-001','DEMO-ACC-001','DEMO-POS-001','DEMO-APP-001','DEMO-STA-001'];
    $actual=array_column($legacy,'sku'); sort($actual); sort($expected);
    if (count($legacy)!==8 || $actual!==$expected) throw new RuntimeException('Legacy SKU allowlist differs from approved eight.');
    $path=__DIR__.'/../../database/catalog/demo-products/manifest.json';
    $sha=hash_file('sha256',$path); $manifest=DemoCatalog::read($path);
    $pdo=Database::connect();
    $status=DemoCatalog::query($pdo,"SHOW COLUMNS FROM products LIKE 'status'")[0];
    if (strpos($status['Type'],"'archived'")===false) throw new RuntimeException('Schema does not explicitly support archived. No migration performed.');
    $plan=DemoCatalog::plan($pdo,$manifest);
    if ($plan['conflicts'] || $plan['new_categories'] || $plan['new_series'] || $plan['new_products'] || $plan['new_images']) throw new RuntimeException('New catalog import is not complete; archive refused.');
    if ((int)DemoCatalog::query($pdo,'SELECT COUNT(*) AS n FROM products')[0]['n']!==31 || (int)DemoCatalog::query($pdo,'SELECT COUNT(*) AS n FROM product_images')[0]['n']!==35) throw new RuntimeException('Unexpected catalog totals.');
    $report=['manifest_sha256'=>$sha,'legacy_skus'=>$expected,'new_products_verified'=>23,'images_verified'=>35,'schema_supports_archived'=>true,'fields_to_change'=>['status'],'rows_to_archive'=>0];
    foreach ($legacy as $old) {
        $row=DemoCatalog::query($pdo,'SELECT * FROM products WHERE id=? AND sku=?',[$old['id'],$old['sku']]);
        if (count($row)!==1) throw new RuntimeException('Legacy ID/SKU changed.');
        foreach ($old as $key=>$value) if ($key!=='status' && $row[0][$key]!==$value) throw new RuntimeException('Legacy data changed: '.$old['sku'].' / '.$key);
        if (!in_array($row[0]['status'],['active','archived'],true)) throw new RuntimeException('Unexpected legacy status.');
        if ($row[0]['status']==='active') $report['rows_to_archive']++;
    }
    if (!isset($options['apply'])) { echo json_encode($report,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR).PHP_EOL; exit; }
    if (isset($options['dry-run']) || !isset($options['approved-sha256']) || !is_string($options['approved-sha256']) || !hash_equals($sha,$options['approved-sha256'])) throw new RuntimeException('Approved manifest hash required.');
    $locked=(int)DemoCatalog::query($pdo,"SELECT GET_LOCK('manga-store-demo-catalog',10) AS acquired")[0]['acquired']===1;
    if (!$locked) throw new RuntimeException('Another catalog operation is running.');
    $report['image_http_verification']=DemoCatalog::verifyImages($pdo,$manifest,['http://localhost','http://localhost:8443']);
    $pdo->beginTransaction();
    $changed=0;
    foreach ($legacy as $old) {
        $row=DemoCatalog::query($pdo,'SELECT * FROM products WHERE id=? AND sku=? FOR UPDATE',[$old['id'],$old['sku']])[0] ?? null;
        if (!$row) throw new RuntimeException('Legacy row disappeared.');
        foreach ($old as $key=>$value) if ($key!=='status' && $row[$key]!==$value) throw new RuntimeException('Concurrent legacy change.');
        if (!in_array($row['status'],['active','archived'],true)) throw new RuntimeException('Unexpected locked legacy status.');
        // Explicitly preserve updated_at so status is the only changed field.
        $update=$pdo->prepare("UPDATE products SET status='archived', updated_at=updated_at WHERE id=? AND sku=? AND status='active'");
        $update->execute([$old['id'],$old['sku']]); $changed+=$update->rowCount();
        $after=DemoCatalog::query($pdo,'SELECT * FROM products WHERE id=?',[$old['id']])[0];
        foreach ($old as $key=>$value) if ($after[$key]!==($key==='status'?'archived':$value)) throw new RuntimeException('Archive changed an unexpected field.');
    }
    $counts=DemoCatalog::query($pdo,'SELECT status,COUNT(*) AS n FROM products GROUP BY status');
    $map=array_column($counts,'n','status');
    if ((int)($map['active']??0)!==23 || (int)($map['archived']??0)!==8) throw new RuntimeException('Archive counts mismatch.');
    $pdo->commit();
    $report['archived_rows']=$changed; $report['completed']=true;
    echo json_encode($report,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR).PHP_EOL;
} catch (Throwable $error) {
    if ($pdo instanceof PDO && $pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR,'Archive stopped: '.$error->getMessage().PHP_EOL); exit(1);
} finally {
    if ($locked && $pdo instanceof PDO) DemoCatalog::query($pdo,"SELECT RELEASE_LOCK('manga-store-demo-catalog')");
}
