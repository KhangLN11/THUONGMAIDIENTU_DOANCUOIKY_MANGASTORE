<?php
declare(strict_types=1);
require_once __DIR__.'/ProductRepository.php';
final class CommerceException extends RuntimeException
{
    public string $errorCode;
    public int $status;
    public function __construct(string $code, int $status = 409) { parent::__construct($code); $this->errorCode=$code; $this->status=$status; }
}
final class CommerceRepository
{
    public function __construct(private PDO $pdo, private int $userId) {}
    private function cartId(bool $create = false): ?int
    {
        if ($create) {
            $s=$this->pdo->prepare('INSERT INTO carts(user_id) VALUES(?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)');$s->execute([$this->userId]);
        }
        $s=$this->pdo->prepare('SELECT id FROM carts WHERE user_id=?'.($create?' FOR UPDATE':''));$s->execute([$this->userId]);
        $id=$s->fetchColumn();return $id===false?null:(int)$id;
    }
    public function cart(): array
    {
        $s=$this->pdo->prepare('SELECT ci.id,ci.product_id,ci.quantity,p.name_vi,p.name_en,p.status,p.stock_quantity,p.price_vnd,p.sale_price_vnd FROM cart_items ci JOIN carts c ON c.id=ci.cart_id JOIN products p ON p.id=ci.product_id WHERE c.user_id=? ORDER BY ci.product_id');$s->execute([$this->userId]);
        $products=[];foreach((new ProductRepository($this->pdo))->activeProducts() as $p)$products[$p['id']]=$p;
        $items=[];$total=0;$count=0;
        foreach($s->fetchAll() as $row){
            $base=(int)$row['price_vnd'];$sale=$row['sale_price_vnd']===null?null:(int)$row['sale_price_vnd'];
            $price=$sale!==null&&$sale>0&&$sale<=$base?$sale:$base;
            $qty=(int)$row['quantity'];
            if($qty<1||$price<0||$price>intdiv(9007199254740991,$qty))throw new CommerceException('AMOUNT_OUT_OF_RANGE',422);
            $line=$price*$qty;
            if($total>9007199254740991-$line)throw new CommerceException('AMOUNT_OUT_OF_RANGE',422);
            $items[]=['id'=>(int)$row['id'],'product_id'=>(int)$row['product_id'],'quantity'=>$qty,'product'=>$products[(int)$row['product_id']]??null,
                'name_vi'=>$row['name_vi'],'name_en'=>$row['name_en'],'unit_price_vnd'=>$price,'line_total_vnd'=>$line,
                'available'=>$row['status']==='active'&&(int)$row['stock_quantity']>=$qty];
            $total+=$line;$count+=$qty;
        }
        return ['items'=>$items,'total_quantity'=>$count,'subtotal_vnd'=>$total,'currency'=>'VND'];
    }
    public function wishlist(): array
    {
        $s=$this->pdo->prepare('SELECT product_id FROM wishlists WHERE user_id=? ORDER BY product_id');$s->execute([$this->userId]);
        $ids=array_map('intval',$s->fetchAll(PDO::FETCH_COLUMN));$products=[];
        foreach((new ProductRepository($this->pdo))->activeProducts() as $p)if(in_array($p['id'],$ids,true))$products[]=$p;
        return ['product_ids'=>$ids,'products'=>$products];
    }
    public function mutate(string $operation, array $input): void
    {
        $this->pdo->beginTransaction();
        try {
            // One lock serializes every cart operation, including merge, across sessions.
            $cart=$this->cartId(true);
            if($operation==='clear'){$s=$this->pdo->prepare('DELETE FROM cart_items WHERE cart_id=?');$s->execute([$cart]);}
            elseif($operation==='merge'){
                $items=$input['items'];usort($items,static fn($a,$b)=>$a['product_id']<=>$b['product_id']);
                foreach($items as $item)$this->put($cart,$item['product_id'],$item['quantity'],true,true);
                foreach($input['wishlist'] as $id)$this->wish($id,true);
            } elseif($operation==='remove'){
                $s=$this->pdo->prepare('DELETE FROM cart_items WHERE cart_id=? AND product_id=?');$s->execute([$cart,$input['product_id']]);
            } elseif($operation==='add'||$operation==='update'){
                $this->put($cart,$input['product_id'],$input['quantity'],$operation==='add');
            } elseif($operation==='wish-add'||$operation==='wish-remove'){$this->wish($input['product_id'],$operation==='wish-add');}
            else throw new CommerceException('INVALID_INPUT',400);
            $s=$this->pdo->prepare('UPDATE carts SET updated_at=CURRENT_TIMESTAMP WHERE id=?');$s->execute([$cart]);
            $this->pdo->commit();
        } catch(Throwable $e){if($this->pdo->inTransaction())$this->pdo->rollBack();throw $e;}
    }
    private function active(int $id): array
    {
        $s=$this->pdo->prepare('SELECT status,stock_quantity FROM products WHERE id=? FOR UPDATE');$s->execute([$id]);$p=$s->fetch();
        if(!$p||$p['status']!=='active')throw new CommerceException('PRODUCT_UNAVAILABLE',404);
        return $p;
    }
    private function put(int $cart,int $id,int $quantity,bool $add,bool $clamp=false): void
    {
        $p=$this->active($id);
        $s=$this->pdo->prepare('SELECT quantity FROM cart_items WHERE cart_id=? AND product_id=?');$s->execute([$cart,$id]);$old=$s->fetchColumn();
        if(!$add&&$old===false)throw new CommerceException('ITEM_NOT_FOUND',404);
        $target=$quantity+($add&&$old!==false?(int)$old:0);$stock=min(999,(int)$p['stock_quantity']);
        if($clamp)$target=min($stock,$target);
        if($target<1||$target>$stock)throw new CommerceException('INSUFFICIENT_STOCK');
        $s=$this->pdo->prepare('INSERT INTO cart_items(cart_id,product_id,quantity) VALUES(?,?,?) ON DUPLICATE KEY UPDATE quantity=VALUES(quantity)');$s->execute([$cart,$id,$target]);
    }
    private function wish(int $id,bool $add): void
    {
        if($add){$this->active($id);$s=$this->pdo->prepare('INSERT INTO wishlists(user_id,product_id) VALUES(?,?) ON DUPLICATE KEY UPDATE product_id=VALUES(product_id)');}
        else $s=$this->pdo->prepare('DELETE FROM wishlists WHERE user_id=? AND product_id=?');
        $s->execute([$this->userId,$id]);
    }
}
