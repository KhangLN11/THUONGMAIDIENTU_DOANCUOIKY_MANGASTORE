<?php
declare(strict_types=1);
require_once __DIR__.'/../../../src/admin_bootstrap.php';
require_once __DIR__.'/../../../src/AdminImageManager.php';
try {
 Auth::method('POST');Auth::requireAdmin();Auth::csrf();$d=admin_json();admin_fields($d,['product_id','image_id','expected_image_url']);
 $data=AdminImageManager::mutate(Database::connect(),['product_id'=>admin_num($d['product_id']??null),'image_id'=>admin_num($d['image_id']??null),'expected_image_url'=>admin_text($d['expected_image_url']??null,500)],'primary');
 auth_json(['success'=>true,'data'=>$data]);
}catch(AdminException $e){auth_error($e->errorCode,$e->status);}
