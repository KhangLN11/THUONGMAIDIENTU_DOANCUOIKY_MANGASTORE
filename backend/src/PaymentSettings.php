<?php
declare(strict_types=1);
/** Receiving account is owner-verified configuration, never a browser-supplied value. */
final class PaymentSettings {
 public static function account(PDO $pdo):?array {
  $path=__DIR__.'/../config/payment.local.php';
  $c=is_file($path)?require $path:[];
  if(!is_array($c)||($c['enabled']??false)!==true)return null;
  if(($c['sandbox']??false)===true){if(!preg_match('/\Amanga_store_[a-z_]+test_[0-9]+\z/D',(string)$pdo->query('SELECT DATABASE()')->fetchColumn()))return null;return ['bank_name'=>'SANDBOX','bank_bin'=>null,'account_number'=>null,'account_name'=>null,'simulation'=>true];}
  if(($c['verified']??false)!==true||(string)$pdo->query('SELECT DATABASE()')->fetchColumn()!=='manga_store')return null;
  foreach(['bank_name','bank_bin','account_number','account_name'] as $k)if(!is_string($c[$k]??null)||trim($c[$k])!==$c[$k]||!preg_match('/\A[^\p{C}]{1,100}\z/u',$c[$k]))return null;
  if(!preg_match('/\A[0-9]{6}\z/D',$c['bank_bin'])||!preg_match('/\A[A-Za-z0-9]{1,19}\z/D',$c['account_number']))return null;
  $simulation=($c['simulation']??false)===true;
  if($simulation&&!preg_match('/\Amanga_store_[a-z_]+test_[0-9]+\z/D',(string)$pdo->query('SELECT DATABASE()')->fetchColumn()))return null;
  return array_intersect_key($c,array_flip(['bank_name','bank_bin','account_number','account_name']))+['simulation'=>$simulation];
 }
 public static function reference(int $id):string{return 'MU'.$id;}
 private static function tlv(string $id,string $v):string{if(strlen($v)>99)throw new RuntimeException('QR field too long');return $id.str_pad((string)strlen($v),2,'0',STR_PAD_LEFT).$v;}
 public static function payload(array $a,int $amount,string $reference):string {
  if($amount<0||strlen((string)$amount)>13||!preg_match('/\AMU[1-9][0-9]{0,19}\z/D',$reference))throw new RuntimeException('Invalid QR data');
  $merchant=self::tlv('00','A000000727').self::tlv('01',self::tlv('00',$a['bank_bin']).self::tlv('01',$a['account_number'])).self::tlv('02','QRIBFTTA');
  $text='000201010212'.self::tlv('38',$merchant).'5303704'.self::tlv('54',(string)$amount).'5802VN'.self::tlv('62',self::tlv('08',$reference)).'6304';
  $crc=0xFFFF;for($i=0;$i<strlen($text);$i++){$crc^=ord($text[$i])<<8;for($b=0;$b<8;$b++)$crc=(($crc<<1)^(($crc&0x8000)?0x1021:0))&0xFFFF;}
  return $text.strtoupper(str_pad(dechex($crc),4,'0',STR_PAD_LEFT));
 }
 public static function instructions(PDO $pdo,array $order):?array {
  if($order['payment_method']!=='bank_transfer'||$order['payment_status']!=='pending'||$order['status']==='cancelled')return null;
  $account=self::account($pdo);if($account===null||strlen((string)$order['total_vnd'])>13)return null;
  $reference=self::reference($order['id']);
  return $account+['amount_vnd'=>$order['total_vnd'],'reference'=>$reference,'qr_payload'=>$account['simulation']?'MANGA-UNIVERSE-SANDBOX|ORDER='.$order['order_code'].'|AMOUNT='.$order['total_vnd'].'|REFERENCE='.$reference.'|NOT-A-PAYMENT':self::payload($account,$order['total_vnd'],$reference)];
 }
}
