<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__.'/../src/Database.php';
$data=json_decode(stream_get_contents(STDIN),true,8,JSON_THROW_ON_ERROR);
$email=$data['email']??'';
if (!is_string($email)||!preg_match('/\Aauth-test-[a-f0-9]{12}(?:-[a-z]+)?@example\.test\z/D',$email)) throw new RuntimeException('Only generated auth test accounts are allowed.');
$pdo=Database::connect();
$statement=$pdo->prepare('SELECT * FROM users WHERE email=?');$statement->execute([$email]);$user=$statement->fetch();
$action=$data['action']??'inspect';
if($action==='inspect') {
 echo json_encode(['exists'=>(bool)$user,'id'=>$user?(int)$user['id']:null,'role'=>$user['role']??null,'status'=>$user['status']??null,
 'hashed'=>$user && password_get_info($user['password_hash'])['algoName']!=='unknown',
 'password_valid'=>$user && isset($data['password']) && password_verify($data['password'],$user['password_hash'])],JSON_THROW_ON_ERROR);
} elseif($action==='delete') {
 $statement=$pdo->prepare('DELETE FROM users WHERE email=?');$statement->execute([$email]);echo json_encode(['deleted'=>$statement->rowCount()]);
} elseif($action==='block'||$action==='unblock') {
 $statement=$pdo->prepare('UPDATE users SET status=? WHERE email=?');$statement->execute([$action==='block'?'blocked':'active',$email]);echo '{}';
} elseif($action==='demote') {
 $statement=$pdo->prepare("UPDATE users SET role='customer' WHERE email=?");$statement->execute([$email]);echo '{}';
} else throw new RuntimeException('Unknown test action.');
