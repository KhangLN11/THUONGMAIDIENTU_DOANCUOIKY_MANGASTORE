<?php
declare(strict_types=1);
require_once __DIR__.'/auth_bootstrap.php';
require_once __DIR__.'/CommerceRepository.php';

function commerce_integer($value): int
{
    if(!is_int($value)||$value<1||$value>9007199254740991)throw new CommerceException('INVALID_INPUT',422);
    return $value;
}
function commerce_input(string $operation): array
{
    $input=Auth::input();
    $allowed=$operation==='clear'?[]:($operation==='merge'?['items','wishlist','operation_key','context']:['product_id']);
    if($operation==='add'||$operation==='update')$allowed[]='quantity';
    if(array_diff(array_keys($input),$allowed))throw new CommerceException('INVALID_INPUT',400);
    if($operation==='merge'){
        if(!is_string($input['operation_key']??null)||!preg_match('/\A[a-f0-9]{32}\z/D',$input['operation_key'])||!is_string($input['context']??null))throw new CommerceException('INVALID_INPUT',422);
        if(!is_array($input['items']??null)||count($input['items'])>100||!is_array($input['wishlist']??null)||count($input['wishlist'])>100)throw new CommerceException('INVALID_INPUT',422);
        $ids=[];$items=[];
        foreach($input['items'] as $item){
            if(!$item instanceof stdClass)throw new CommerceException('INVALID_INPUT',422);
            $item=(array)$item;if(array_diff(array_keys($item),['product_id','quantity']))throw new CommerceException('INVALID_INPUT',400);
            $id=commerce_integer($item['product_id']??null);$qty=commerce_integer($item['quantity']??null);
            if($qty>999||isset($ids[$id]))throw new CommerceException('INVALID_INPUT',422);
            $ids[$id]=true;$items[]=['product_id'=>$id,'quantity'=>$qty];
        }
        $input['items']=$items;$input['wishlist']=array_values(array_unique(array_map('commerce_integer',$input['wishlist'])));
    } elseif($operation!=='clear'){
        $input['product_id']=commerce_integer($input['product_id']??null);
        if($operation==='add'||$operation==='update'){
            $input['quantity']=commerce_integer($input['quantity']??null);
            if($input['quantity']>999)throw new CommerceException('INVALID_INPUT',422);
        }
    }
    return $input;
}
function commerce_result(CommerceRepository $repository,string $type='both'): void
{
    $_SESSION['commerce_context']??=bin2hex(random_bytes(16));
    $data=$type==='cart'?$repository->cart():($type==='wishlist'?$repository->wishlist():['cart'=>$repository->cart(),'wishlist'=>$repository->wishlist()]);
    auth_json(['success'=>true,'data'=>$data,'meta'=>['csrf_token'=>$_SESSION['csrf'],'merge_context'=>$_SESSION['commerce_context']]]);
}
function commerce_run(string $operation): void
{
    try {
        Auth::method(in_array($operation,['cart','wishlist'],true)?'GET':'POST');
        $user=Auth::requireUser();
        $repository=new CommerceRepository(Database::connect(),(int)$user['id']);
        $_SESSION['commerce_context']??=bin2hex(random_bytes(16));
        if($operation==='cart'||$operation==='wishlist'){commerce_result($repository,$operation);return;}
        Auth::csrf();$input=commerce_input($operation);
        if($operation!=='merge'){$repository->mutate($operation,$input);commerce_result($repository);return;}
        // Persist a reservation BEFORE SQL changes. A crash/unknown commit is never replayed.
        if(!hash_equals($_SESSION['commerce_context'],$input['context']))throw new CommerceException('MERGE_CONTEXT_CHANGED');
        $key=$input['operation_key'];$hash=hash('sha256',json_encode([$input['items'],$input['wishlist']],JSON_THROW_ON_ERROR));
        $receipt=$_SESSION['commerce_receipts'][$key]??null;
        if($receipt){
            if($receipt['hash']!==$hash)throw new CommerceException('MERGE_KEY_REUSED');
            if($receipt['state']!=='done')throw new CommerceException('MERGE_UNCERTAIN');
            commerce_result($repository);return;
        }
        if(count($_SESSION['commerce_receipts']??[])>=100)throw new CommerceException('MERGE_LIMIT');
        $context=$_SESSION['commerce_context'];$session=session_id();
        $_SESSION['commerce_receipts'][$key]=['hash'=>$hash,'state'=>'pending'];
        if(!session_write_close())throw new RuntimeException('Cannot persist merge reservation.');
        try{$repository->mutate('merge',$input);}
        catch(Throwable $e){
            session_id($session);session_start();
            if(($_SESSION['commerce_context']??null)===$context)unset($_SESSION['commerce_receipts'][$key]);
            throw $e;
        }
        session_id($session);session_start();
        if(($_SESSION['commerce_context']??null)!==$context)throw new CommerceException('MERGE_UNCERTAIN');
        $_SESSION['commerce_receipts'][$key]=['hash'=>$hash,'state'=>'done'];
        if(!session_write_close())throw new RuntimeException('Cannot persist merge completion.');
        session_id($session);session_start();
        commerce_result($repository);
    } catch(CommerceException $e){auth_error($e->errorCode,$e->status);}
}
