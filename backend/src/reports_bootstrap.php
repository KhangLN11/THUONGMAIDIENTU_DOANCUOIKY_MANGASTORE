<?php
declare(strict_types=1);
require_once __DIR__.'/auth_bootstrap.php';
require_once __DIR__.'/ReportRepository.php';
function report_csv_cell($v):string{
 $v=$v===null?'':(string)$v;
 // Prevent leading whitespace/control characters from concealing a spreadsheet formula.
 if(preg_match('/^[\s\x00-\x20\x7f\x{FEFF}]*[=+@-]/u',$v)||preg_match('/^[\t\r\n]/',$v))$v="'".$v;
 return $v;
}
function reports_run(string $section):void{
 try{
  Auth::method('GET');Auth::requireAdmin();$period=new ReportPeriod($_GET);$repo=new ReportRepository(Database::connect(),$period);
  if($section==='export'){
   $type=$_GET['type']??'revenue';if(!in_array($type,['revenue','orders','products','inventory'],true))throw new ReportException('INVALID_REPORT_FILTER');
   $lang=$_GET['language']??'vi';if(!in_array($lang,['vi','en'],true))throw new ReportException('INVALID_REPORT_FILTER');
   $rows=$repo->snapshot(fn()=>$repo->export($type));
   $simulation=$repo->metadata()['simulation'];
   $headers=[
    'revenue'=>['bucket','total_orders','created_order_value_vnd','average_order_vnd','collected_orders','collected_cod_vnd'],
    'orders'=>['order_code','created_at','status','total_vnd','payment_method','payment_status','paid_at','confirmed_cod_for_order_vnd'],
    'products'=>['product_id','sku','name_vi','name_en','sold_quantity','sales_value_vnd'],
    'inventory'=>['sku','name_vi','name_en','category_vi','category_en','status','stock_quantity','price_vnd','sale_price_vnd']
   ][$type];
   array_unshift($headers,'data_mode');
   $labels=['data_mode'=>'Loại dữ liệu','bucket'=>'Kỳ báo cáo','total_orders'=>'Số đơn','created_order_value_vnd'=>'Giá trị đơn tạo (VND)','average_order_vnd'=>'Trung bình đơn (VND)','collected_orders'=>'Đơn thu COD','collected_cod_vnd'=>'COD đã thu (VND)','order_code'=>'Mã đơn','created_at'=>'Ngày tạo UTC+7','status'=>'Trạng thái','total_vnd'=>'Tổng đơn (VND)','payment_method'=>'Phương thức','payment_status'=>'Trạng thái thanh toán','paid_at'=>'Ngày thu UTC+7','confirmed_cod_for_order_vnd'=>'COD đã thu của đơn (VND)','product_id'=>'ID sản phẩm','sku'=>'SKU','name_vi'=>'Tên tiếng Việt','name_en'=>'Tên tiếng Anh','sold_quantity'=>'Số lượng đã giao','sales_value_vnd'=>'Giá trị hàng đã giao (VND)','category_vi'=>'Danh mục VI','category_en'=>'Danh mục EN','stock_quantity'=>'Tồn kho hiện tại','price_vnd'=>'Giá gốc (VND)','sale_price_vnd'=>'Giá khuyến mãi (VND)'];
   header('Content-Type: text/csv; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
   header('Content-Disposition: attachment; filename="manga-'.$type.'-'.$period->start->format('Y-m-d').'-'.$period->end->modify('-1 day')->format('Y-m-d').'.csv"');
   $f=fopen('php://output','wb');fwrite($f,"\xEF\xBB\xBF");fputcsv($f,array_map(fn($h)=>$lang==='vi'?$labels[$h]:$h,$headers),',','"','');
   foreach($rows as $r){$r['data_mode']=$simulation?'SIMULATED':'DATABASE';fputcsv($f,array_map(fn($h)=>report_csv_cell($r[$h]??null),$headers),',','"','');}fclose($f);exit;
  }
  if($section==='overview')$data=$repo->snapshot(fn()=>$repo->all());
  else{$methods=['revenue'=>'revenue','orders'=>'statuses','products'=>'products','categories'=>'categories'];if(!isset($methods[$section]))throw new ReportException('INVALID_REPORT_FILTER');$data=$repo->snapshot(fn()=>['period'=>$repo->metadata(),'items'=>$repo->{$methods[$section]}()]);}
  auth_json(['success'=>true,'data'=>$data]);
 }catch(ReportException $e){auth_error($e->errorCode,$e->status);}
}
