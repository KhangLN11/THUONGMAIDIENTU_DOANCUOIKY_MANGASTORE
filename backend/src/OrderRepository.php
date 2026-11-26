<?php
declare(strict_types=1);
require_once __DIR__.'/PaymentSettings.php';
final class OrderException extends RuntimeException
{
    public string $errorCode; public int $status;
    public function __construct(string $code,int $status=409){parent::__construct($code);$this->errorCode=$code;$this->status=$status;}
}
final class OrderRepository
{
    private int $fee;
    public function __construct(private PDO $pdo,private int $userId){
        $fee=getenv('CHECKOUT_SHIPPING_FEE_VND');$fee=$fee===false?'30000':$fee;
        if(!ctype_digit($fee)||strlen($fee)>9)throw new RuntimeException('Invalid checkout configuration.');
        $this->fee=(int)$fee;
    }
    private function cart(bool $lock=false, ?array $selection=null): array
    {
        $id=null;
        if($selection===null){
            $s=$this->pdo->prepare('SELECT id FROM carts WHERE user_id=?'.($lock?' FOR UPDATE':''));$s->execute([$this->userId]);$id=$s->fetchColumn();
            if($id===false)throw new OrderException('CART_EMPTY');
            $s=$this->pdo->prepare('SELECT product_id,quantity FROM cart_items WHERE cart_id=? ORDER BY product_id'.($lock?' FOR UPDATE':''));$s->execute([$id]);$items=$s->fetchAll();
            if(!$items)throw new OrderException('CART_EMPTY');
        }else{$items=[$selection];}
        $total=0;$fingerprint=[];$lines=[];
        foreach($items as $item){
            $s=$this->pdo->prepare('SELECT id,sku,name_vi,name_en,status,stock_quantity,price_vnd,sale_price_vnd FROM products WHERE id=?'.($lock?' FOR UPDATE':''));$s->execute([$item['product_id']]);$p=$s->fetch();
            $qty=(int)$item['quantity'];if(!$p||$p['status']!=='active')throw new OrderException('PRODUCT_UNAVAILABLE');
            if($qty<1||$qty>999)throw new OrderException('INVALID_QUANTITY',422);
            if((int)$p['stock_quantity']<$qty)throw new OrderException('INSUFFICIENT_STOCK');
            $base=(int)$p['price_vnd'];$sale=$p['sale_price_vnd']===null?null:(int)$p['sale_price_vnd'];$price=$sale!==null&&$sale>0&&$sale<=$base?$sale:$base;
            if($price<0||$price>intdiv(99999999999999,$qty))throw new OrderException('AMOUNT_OUT_OF_RANGE',422);
            $line=$price*$qty;if($total>99999999999999-$line)throw new OrderException('AMOUNT_OUT_OF_RANGE',422);$total+=$line;
            $lines[]=['product_id'=>(int)$p['id'],'sku'=>$p['sku'],'name_vi'=>$p['name_vi'],'name_en'=>$p['name_en'],'quantity'=>$qty,'unit_price_vnd'=>$price,'line_total_vnd'=>$line];
            $fingerprint[]=[(int)$p['id'],$qty,$price];
        }
        if($total>99999999999999-$this->fee)throw new OrderException('AMOUNT_OUT_OF_RANGE',422);
        return ['cart_id'=>(int)$id,'items'=>$lines,'subtotal_vnd'=>$total,'shipping_fee_vnd'=>$this->fee,'discount_vnd'=>0,'total_vnd'=>$total+$this->fee,
            'currency'=>'VND','quote_fingerprint'=>hash('sha256',json_encode($selection===null?[$fingerprint,$this->fee]:['buy_now',$fingerprint,$this->fee],JSON_THROW_ON_ERROR))];
    }
    public function quote(?array $selection=null):array{$q=$this->cart(false,$selection);$ready=PaymentSettings::account($this->pdo)!==null&&strlen((string)$q['total_vnd'])<=13;return $q+['payment_options'=>['cod'=>true,'bank_transfer'=>$ready,'vietqr'=>$ready],'payment_simulation'=>(PaymentSettings::account($this->pdo)['simulation']??false)];}
    private function byKey(string $key,bool $lock=false):?array{
        $s=$this->pdo->prepare('SELECT id,checkout_request_hash FROM orders WHERE user_id=? AND idempotency_key=?'.($lock?' FOR UPDATE':''));$s->execute([$this->userId,$key]);return $s->fetch()?:null;
    }
    public function create(array $input):array
    {
        $selection=($input['mode']??'cart')==='buy_now'?['product_id'=>$input['product_id'],'quantity'=>$input['quantity']]:null;
        // Legacy cart canonical payload stays byte-compatible; buy_now includes mode and selection.
        $key=$input['idempotency_key'];$canonical=$input;unset($canonical['idempotency_key']);$hash=hash('sha256',json_encode($canonical,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
        $existing=$this->byKey($key);if($existing)return $this->replay($existing,$hash);
        for($attempt=0;;$attempt++){
            try{
                $this->pdo->beginTransaction();
                // Lock the same cart row as CommerceRepository before any product lock.
                if($selection===null){$s=$this->pdo->prepare('SELECT id FROM carts WHERE user_id=? FOR UPDATE');$s->execute([$this->userId]);if($s->fetchColumn()===false)throw new OrderException('CART_EMPTY');}
                $existing=$this->byKey($key,true);if($existing){$this->pdo->commit();return $this->replay($existing,$hash);}
                $quote=$this->cart(true,$selection);
                if(!hash_equals($quote['quote_fingerprint'],$input['quote_fingerprint']))throw new OrderException('QUOTE_CHANGED');
                if($input['payment_method']==='bank_transfer'&&(PaymentSettings::account($this->pdo)===null||strlen((string)$quote['total_vnd'])>13))throw new OrderException('PAYMENT_UNAVAILABLE');
                $code='MS-'.date('Ymd').'-'.strtoupper(bin2hex(random_bytes(8)));
                $address=[$input['recipient_name'],$input['recipient_phone'],$input['province'],$input['district'],$input['ward'],$input['address_line']];
                $s=$this->pdo->prepare('INSERT INTO addresses(user_id,recipient_name,recipient_phone,province,district,ward,address_line,is_default) VALUES(?,?,?,?,?,?,?,0)');$s->execute(array_merge([$this->userId],$address));
                $s=$this->pdo->prepare("INSERT INTO orders(order_code,user_id,recipient_name,recipient_phone,province,district,ward,address_line,customer_note,status,subtotal_vnd,shipping_fee_vnd,discount_vnd,total_vnd,idempotency_key,checkout_request_hash) VALUES(?,?,?,?,?,?,?,?,?,'pending',?,?,0,?,?,?)");
                $s->execute(array_merge([$code,$this->userId],$address,[$input['customer_note'],$quote['subtotal_vnd'],$quote['shipping_fee_vnd'],$quote['total_vnd'],$key,$hash]));$id=(int)$this->pdo->lastInsertId();
                foreach($quote['items'] as $line){
                    $s=$this->pdo->prepare('INSERT INTO order_items(order_id,product_id,sku_snapshot,name_vi_snapshot,name_en_snapshot,unit_price_vnd,quantity,line_total_vnd) VALUES(?,?,?,?,?,?,?,?)');$s->execute([$id,$line['product_id'],$line['sku'],$line['name_vi'],$line['name_en'],$line['unit_price_vnd'],$line['quantity'],$line['line_total_vnd']]);
                    $s=$this->pdo->prepare("UPDATE products SET stock_quantity=stock_quantity-? WHERE id=? AND stock_quantity>=? AND status='active'");$s->execute([$line['quantity'],$line['product_id'],$line['quantity']]);if($s->rowCount()!==1)throw new OrderException('INSUFFICIENT_STOCK');
                    $s=$this->pdo->prepare("INSERT INTO inventory_movements(product_id,order_id,actor_user_id,quantity_delta,reason,note) VALUES(?,?,?,?,'sale',?)");$s->execute([$line['product_id'],$id,$this->userId,-$line['quantity'],$code]);
                }
                $s=$this->pdo->prepare("INSERT INTO payments(order_id,method,status,amount_vnd) VALUES(?,?,'pending',?)");$s->execute([$id,$input['payment_method'],$quote['total_vnd']]);
                $s=$this->pdo->prepare("INSERT INTO shipments(order_id,status) VALUES(?,'pending')");$s->execute([$id]);
                if($selection===null){$s=$this->pdo->prepare('DELETE FROM cart_items WHERE cart_id=?');$s->execute([$quote['cart_id']]);}
                $this->pdo->commit();return ['order'=>$this->detail($id),'replayed'=>false];
            }catch(Throwable $e){
                if($this->pdo->inTransaction())$this->pdo->rollBack();
                if($e instanceof PDOException&&in_array((int)($e->errorInfo[1]??0),[1213,1205],true)&&$attempt<2){usleep(30000*($attempt+1));continue;}
                if($e instanceof PDOException&&(int)($e->errorInfo[1]??0)===1062){$existing=$this->byKey($key);if($existing)return $this->replay($existing,$hash);}
                throw $e;
            }
        }
    }
    private function replay(array $row,string $hash):array{
        if(!hash_equals($row['checkout_request_hash'],$hash))throw new OrderException('IDEMPOTENCY_CONFLICT');
        return ['order'=>$this->detail((int)$row['id']),'replayed'=>true];
    }
    public function index():array{
        $s=$this->pdo->prepare('SELECT o.id,o.order_code,o.status,o.total_vnd,o.created_at,p.method AS payment_method,p.status AS payment_status FROM orders o LEFT JOIN payments p ON p.order_id=o.id WHERE o.user_id=? ORDER BY o.created_at DESC,o.id DESC LIMIT 100');$s->execute([$this->userId]);
        return array_map(static function($r){$r['id']=(int)$r['id'];$r['total_vnd']=(int)$r['total_vnd'];return $r;},$s->fetchAll());
    }
    public function detail(int $id=0,?string $key=null):array{
        $sql='SELECT o.id,o.order_code,o.status,o.recipient_name,o.recipient_phone,o.province,o.district,o.ward,o.address_line,o.customer_note,o.subtotal_vnd,o.shipping_fee_vnd,o.discount_vnd,o.total_vnd,o.created_at,p.method AS payment_method,p.status AS payment_status,p.paid_at,s.status AS shipment_status FROM orders o LEFT JOIN payments p ON p.order_id=o.id LEFT JOIN shipments s ON s.order_id=o.id WHERE o.user_id=? AND '.($key===null?'o.id=?':'o.idempotency_key=?');
        $s=$this->pdo->prepare($sql);$s->execute([$this->userId,$key??$id]);$row=$s->fetch();if(!$row)throw new OrderException('ORDER_NOT_FOUND',404);
        foreach(['id','subtotal_vnd','shipping_fee_vnd','discount_vnd','total_vnd'] as $k)$row[$k]=(int)$row[$k];
        $s=$this->pdo->prepare('SELECT oi.product_id,oi.sku_snapshot,oi.name_vi_snapshot,oi.name_en_snapshot,oi.unit_price_vnd,oi.quantity,oi.line_total_vnd,(SELECT pi.image_url FROM product_images pi WHERE pi.product_id=oi.product_id ORDER BY pi.is_primary DESC,pi.sort_order,pi.id LIMIT 1) AS image_url FROM order_items oi WHERE oi.order_id=? ORDER BY oi.id');$s->execute([$row['id']]);$row['items']=$s->fetchAll();
        foreach($row['items'] as &$item)foreach(['product_id','unit_price_vnd','quantity','line_total_vnd'] as $k)$item[$k]=$item[$k]===null?null:(int)$item[$k];unset($item);
        $row['simulation']=(bool)preg_match('/\Amanga_store_[a-z_]+test_[0-9]+\z/D',(string)$this->pdo->query('SELECT DATABASE()')->fetchColumn());
        $row['payment_instructions']=PaymentSettings::instructions($this->pdo,$row);
        return $row;
    }
    public function cancel(int $id, ?int $actorUserId=null):array{
        $this->pdo->beginTransaction();
        try{
            $s=$this->pdo->prepare('SELECT status,idempotency_key FROM orders WHERE id=? AND user_id=? FOR UPDATE');$s->execute([$id,$this->userId]);$o=$s->fetch();if(!$o)throw new OrderException('ORDER_NOT_FOUND',404);
            if($o['status']==='cancelled'){$this->pdo->commit();return $this->detail($id);}
            if($o['status']!=='pending'||$o['idempotency_key']===null)throw new OrderException('ORDER_NOT_CANCELLABLE');
            $s=$this->pdo->prepare('SELECT method,status FROM payments WHERE order_id=? FOR UPDATE');$s->execute([$id]);$pay=$s->fetch();
            $s=$this->pdo->prepare('SELECT status FROM shipments WHERE order_id=? FOR UPDATE');$s->execute([$id]);$shipment=$s->fetchColumn();
            if(!$pay||!in_array($pay['method'],['cod','bank_transfer'],true)||$pay['status']!=='pending'||$shipment!=='pending')throw new OrderException('ORDER_NOT_CANCELLABLE');
            $s=$this->pdo->prepare('SELECT product_id,SUM(quantity) AS quantity FROM order_items WHERE order_id=? GROUP BY product_id ORDER BY product_id');$s->execute([$id]);$items=$s->fetchAll();
            foreach($items as $item){
                if($item['product_id']===null)throw new OrderException('INVENTORY_INCONSISTENT');
                $s=$this->pdo->prepare('SELECT stock_quantity FROM products WHERE id=? FOR UPDATE');$s->execute([$item['product_id']]);$stock=$s->fetchColumn();
                $s=$this->pdo->prepare("SELECT COALESCE(SUM(quantity_delta),0) FROM inventory_movements WHERE order_id=? AND product_id=? AND reason IN ('sale','cancel_restock')");$s->execute([$id,$item['product_id']]);
                if($stock===false||(int)$s->fetchColumn()!==-(int)$item['quantity']||(int)$stock>4294967295-(int)$item['quantity'])throw new OrderException('INVENTORY_INCONSISTENT');
                $s=$this->pdo->prepare('UPDATE products SET stock_quantity=stock_quantity+? WHERE id=?');$s->execute([$item['quantity'],$item['product_id']]);
                $s=$this->pdo->prepare("INSERT INTO inventory_movements(product_id,order_id,actor_user_id,quantity_delta,reason) VALUES(?,?,?,?,'cancel_restock')");$s->execute([$item['product_id'],$id,$actorUserId??$this->userId,$item['quantity']]);
            }
            if(!$items)throw new OrderException('INVENTORY_INCONSISTENT');
            $s=$this->pdo->prepare("UPDATE orders SET status='cancelled' WHERE id=? AND user_id=?");$s->execute([$id,$this->userId]);
            $s=$this->pdo->prepare("UPDATE payments SET status='failed' WHERE order_id=? AND status='pending'");$s->execute([$id]);
            $this->pdo->commit();return $this->detail($id);
        }catch(Throwable $e){if($this->pdo->inTransaction())$this->pdo->rollBack();throw $e;}
    }
}
