<?php
declare(strict_types=1);
require_once __DIR__.'/auth_bootstrap.php';
require_once __DIR__.'/OrderRepository.php';
function order_id($value):int{
    if(is_int($value)&&$value>0&&$value<=9007199254740991)return $value;
    if(is_string($value)&&preg_match('/\A[1-9][0-9]{0,14}\z/D',$value))return (int)$value;
    throw new OrderException('INVALID_INPUT',422);
}
function checkout_source(array $data, bool $query=false):?array{
    $mode=$data['mode']??'cart';
    if(!in_array($mode,['cart','buy_now'],true))throw new OrderException('INVALID_INPUT',422);
    if($mode==='cart'){
        if(isset($data['product_id'])||isset($data['quantity']))throw new OrderException('INVALID_INPUT',422);
        return null;
    }
    $quantity=$data['quantity']??null;
    if($query&&is_string($quantity)&&preg_match('/\A[1-9][0-9]{0,2}\z/D',$quantity))$quantity=(int)$quantity;
    if(!is_int($quantity)||$quantity<1||$quantity>999)throw new OrderException('INVALID_QUANTITY',422);
    return ['product_id'=>order_id($data['product_id']??null),'quantity'=>$quantity];
}
function checkout_input(array $data):array{
    $allowed=['idempotency_key','quote_fingerprint','recipient_name','recipient_phone','province','district','ward','address_line','customer_note','payment_method','mode','product_id','quantity'];
    if(array_diff(array_keys($data),$allowed))throw new OrderException('INVALID_INPUT',400);
    $out=[];
    foreach(['idempotency_key'=>32,'quote_fingerprint'=>64] as $key=>$length){if(!is_string($data[$key]??null)||!preg_match('/\A[a-f0-9]{'.$length.'}\z/D',$data[$key]))throw new OrderException('INVALID_INPUT',422);$out[$key]=$data[$key];}
    foreach(['recipient_name'=>150,'recipient_phone'=>20,'province'=>120,'district'=>120,'ward'=>120,'address_line'=>255,'customer_note'=>2000] as $key=>$max){
        $value=$data[$key]??'';if($value===null&&in_array($key,['district','customer_note'],true))$value='';
        if(!is_string($value))throw new OrderException('INVALID_ADDRESS',422);$value=trim($value);
        if(!preg_match('/\A[^\p{C}]{0,'.$max.'}\z/u',$value)||($value===''&&!in_array($key,['district','customer_note'],true)))throw new OrderException('INVALID_ADDRESS',422);
        $out[$key]=$value===''?null:$value;
    }
    if(!preg_match('/\A\+?[0-9]{8,15}\z/D',$out['recipient_phone']))throw new OrderException('INVALID_ADDRESS',422);
    if(($data['payment_method']??null)!=='cod')throw new OrderException('COD_ONLY',422);$out['payment_method']='cod';$source=checkout_source($data);if($source!==null){$out['mode']='buy_now';$out+=$source;}return $out;
}
function orders_run(string $action):void{
    try{
        Auth::method(in_array($action,['create','cancel'],true)?'POST':'GET');$user=Auth::requireUser();
        $repo=new OrderRepository(Database::connect(),(int)$user['id']);
        if($action==='create'){
            Auth::csrf();$result=$repo->create(checkout_input(Auth::input()));
            auth_json(['success'=>true,'data'=>$result['order'],'meta'=>['replayed'=>$result['replayed']]],$result['replayed']?200:201);
        }
        if($action==='cancel'){
            Auth::csrf();$input=Auth::input();if(array_diff(array_keys($input),['order_id']))throw new OrderException('INVALID_INPUT',400);
            $data=$repo->cancel(order_id($input['order_id']??null));
        }elseif($action==='quote'){if(array_diff(array_keys($_GET),['mode','product_id','quantity']))throw new OrderException('INVALID_INPUT',400);$data=$repo->quote(checkout_source($_GET,true));}
        elseif($action==='index'){$data=$repo->index();}
        elseif($action==='detail'){
            if(isset($_GET['checkout_key'])){if(count($_GET)!==1||!is_string($_GET['checkout_key'])||!preg_match('/\A[a-f0-9]{32}\z/D',$_GET['checkout_key']))throw new OrderException('INVALID_INPUT',422);$data=$repo->detail(0,$_GET['checkout_key']);}
            else{$data=$repo->detail(order_id($_GET['id']??null));}
        }else throw new OrderException('INVALID_INPUT',400);
        auth_json(['success'=>true,'data'=>$data]);
    }catch(OrderException $e){auth_error($e->errorCode,$e->status);}
}
