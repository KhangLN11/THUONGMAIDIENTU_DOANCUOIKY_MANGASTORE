<?php
declare(strict_types=1);
require_once __DIR__.'/../../../src/admin_bootstrap.php';
require_once __DIR__.'/../../../src/AdminImageUpload.php';
try { Auth::method('POST'); Auth::requireAdmin(); Auth::csrf(); auth_json(['success'=>true,'data'=>AdminImageUpload::handle(Database::connect())]); } catch(AdminException $e){auth_error($e->errorCode,$e->status);}
