<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__.'/../src/Database.php';
require_once __DIR__.'/../src/ProductImageStorage.php';
require_once __DIR__.'/../src/DemoCatalog.php';
function ensure(bool $condition,string $message): void { if (!$condition) throw new RuntimeException($message); }
$base=__DIR__.'/../../database/catalog/demo-products';
$manifest=DemoCatalog::read($base.'/manifest.json');
$validation=DemoCatalog::validate($manifest,$base);
ensure($validation['products']===23 && $validation['images']===35,'Expected prepared catalog size');
// Actual database is read only. All inserts below target an isolated in-memory SQLite database.
$mysql=Database::connect();
$current=[];
foreach (['categories','manga_series','products','product_images'] as $table) $current[$table]=DemoCatalog::query($mysql,'SELECT * FROM '.$table.' ORDER BY id');
// Recreate the pre-catalog fixture in memory even after the live catalog is installed.
// MySQL data is only read; filtering below affects PHP arrays, not database rows.
$catalogSkus=array_column($manifest['products'],'sku');
$current['products']=array_values(array_filter($current['products'],static fn(array $row): bool=>!in_array($row['sku'],$catalogSkus,true)));
$fixtureIds=array_column($current['products'],'id');
$current['product_images']=array_values(array_filter($current['product_images'],static fn(array $row): bool=>in_array($row['product_id'],$fixtureIds,true)));
$usedCategories=array_column($current['products'],'category_id');
$usedSeries=array_column($current['products'],'series_id');
$catalogSeries=array_column($manifest['series'],'slug');
$current['categories']=array_values(array_filter($current['categories'],static fn(array $row): bool=>$row['slug']!=='novels'||in_array($row['id'],$usedCategories,true)));
$current['manga_series']=array_values(array_filter($current['manga_series'],static fn(array $row): bool=>!in_array($row['slug'],$catalogSeries,true)||in_array($row['id'],$usedSeries,true)));
$pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec('PRAGMA foreign_keys=ON');
$pdo->exec('CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT,parent_id INTEGER,slug TEXT UNIQUE,name_vi TEXT,name_en TEXT,sort_order INTEGER,is_active INTEGER)');
$pdo->exec('CREATE TABLE manga_series (id INTEGER PRIMARY KEY AUTOINCREMENT,slug TEXT UNIQUE,title TEXT,original_title TEXT,description_vi TEXT,description_en TEXT,banner_image_url TEXT,is_active INTEGER)');
$pdo->exec('CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT,category_id INTEGER REFERENCES categories(id),series_id INTEGER REFERENCES manga_series(id),sku TEXT UNIQUE,slug TEXT UNIQUE,name_vi TEXT,name_en TEXT,description_vi TEXT,description_en TEXT,price_vnd INTEGER,sale_price_vnd INTEGER,stock_quantity INTEGER,status TEXT,is_featured INTEGER,created_at TEXT,updated_at TEXT)');
$pdo->exec('CREATE TABLE product_images (id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER REFERENCES products(id),image_url TEXT,alt_vi TEXT,alt_en TEXT,sort_order INTEGER,is_primary INTEGER)');
foreach ($current as $table=>$rows) foreach ($rows as $row) {
    $columns=array_keys($row);
    $sql='INSERT INTO '.$table.' ('.implode(',',$columns).') VALUES ('.implode(',',array_fill(0,count($columns),'?')).')';
    $pdo->prepare($sql)->execute(array_values($row));
}
// Force different IDs in the isolated test to prove import URLs resolve by SKU.
$pdo->exec("UPDATE sqlite_sequence SET seq=1000 WHERE name='products'");
$old=DemoCatalog::query($pdo,'SELECT * FROM products WHERE sku NOT LIKE ? ORDER BY id', ['CAT-%']);
$initial=DemoCatalog::plan($pdo,$manifest);
ensure(!$initial['conflicts'],'Initial plan must have no conflicts');
$pdo->beginTransaction();
DemoCatalog::insert($pdo,$manifest,false);
ensure((int)DemoCatalog::query($pdo,'SELECT COUNT(*) AS n FROM product_images')[0]['n']===count($current['product_images']),'Image links inserted before staged file verification');
DemoCatalog::insertImages($pdo,$manifest);
$pdo->commit();
$again=DemoCatalog::plan($pdo,$manifest);
ensure(!$again['conflicts'] && $again['new_products']===0 && $again['new_images']===0 && $again['new_categories']===0 && $again['new_series']===0,'Repeat must be a no-op');
$countBefore=DemoCatalog::query($pdo,'SELECT COUNT(*) AS total FROM products')[0]['total'];
DemoCatalog::insert($pdo,$manifest);
ensure(DemoCatalog::query($pdo,'SELECT COUNT(*) AS total FROM products')[0]['total']===$countBefore,'Repeat duplicated products');
ensure($old===DemoCatalog::query($pdo,'SELECT * FROM products WHERE sku NOT LIKE ? ORDER BY id', ['CAT-%']),'Legacy rows changed');
ensure(DemoCatalog::query($pdo,'PRAGMA foreign_key_check')===[],'Foreign key integrity');
foreach ($manifest['products'] as $product) {
    $row=DemoCatalog::query($pdo,'SELECT * FROM products WHERE sku=?',[$product['sku']])[0];
    ensure((int)$row['id']>1000,'Importer relied on predicted IDs');
    $images=DemoCatalog::query($pdo,'SELECT * FROM product_images WHERE product_id=? ORDER BY sort_order,id',[$row['id']]);
    ensure(count($images)===count($product['images']),'Missing gallery image');
    foreach ($images as $image) ensure(strpos($image['image_url'],'/'.$row['id'].'/')!==false,'Image URL must use actual product ID');
    ensure(array_sum(array_column($images,'is_primary'))===1,'Primary image count');
    ensure((int)$row['price_vnd']===$product['price_vnd'],'VND amount changed');
}
$pdo->prepare('UPDATE products SET name_en=? WHERE sku=?')->execute(['Deliberately changed',$manifest['products'][0]['sku']]);
ensure(count(DemoCatalog::plan($pdo,$manifest)['conflicts'])>0,'Existing mismatch must be rejected');
foreach (['duplicate-sku','invalid-price','missing-fk','unsafe-file','missing-primary'] as $case) {
    $bad=$manifest;
    if ($case==='duplicate-sku') $bad['products'][1]['sku']=$bad['products'][0]['sku'];
    if ($case==='invalid-price') $bad['products'][0]['sale_price_vnd']=0;
    if ($case==='missing-fk') $bad['products'][0]['category_slug']='unknown';
    if ($case==='unsafe-file') $bad['products'][0]['images'][0]['filename']='../bad.php';
    if ($case==='missing-primary') $bad['products'][0]['images'][0]['is_primary']=false;
    $rejected=false;
    try { DemoCatalog::validate($bad,$base); } catch (RuntimeException $expected) { $rejected=true; }
    ensure($rejected,'Validation accepted '.$case);
}
echo "PASS: 23 products/35 raster assets validated; isolated SQLite insert/re-run/foreign keys/one-primary checks; legacy rows unchanged; conflicts and invalid inputs rejected. MySQL writes: 0.\n";
