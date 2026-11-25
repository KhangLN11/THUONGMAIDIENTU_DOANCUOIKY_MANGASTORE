import json,secrets,subprocess,http.cookiejar,urllib.request,urllib.error,concurrent.futures,os
from pathlib import Path
BASE='http://localhost/manga-store-orders-test-20261120/manga-store/backend/public/api/'
PHP='C:/xampp/php/php.exe';env=dict(os.environ,DB_NAME='manga_store_orders_test_20261120')
nonce=secrets.token_hex(6);emails=[f'auth-test-{nonce}@example.test',f'auth-test-{nonce}-other@example.test'];password=secrets.token_urlsafe(24);report={'checks':[]}
def cli(script,data):
 r=subprocess.run([PHP,'backend/'+script],input=json.dumps(data),text=True,capture_output=True,env=env,check=True);return r.stdout
pid=9
def fixture(action,**data):return json.loads(cli('tests/orders_fixture.php',dict(action=action,**data)))
def inspect(email=emails[0],order_id=0):return fixture('inspect',email=email,product_id=pid,order_id=order_id)
class Client:
 def __init__(self):self.jar=http.cookiejar.CookieJar();self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar));self.csrf=''
 def req(self,path,status=200,body=None,csrf=True):
  h={'Accept':'application/json'}
  if body is not None:h['Content-Type']='application/json'
  if body is not None and csrf:h['X-CSRF-Token']=self.csrf
  r=urllib.request.Request(BASE+path,data=None if body is None else json.dumps(body).encode(),headers=h)
  try:r=self.opener.open(r,timeout=20)
  except urllib.error.HTTPError as e:r=e
  raw=r.read().decode();assert r.status==status,(path,r.status,raw);assert 'SQLSTATE' not in raw and 'password_hash' not in raw
  d=json.loads(raw);token=d.get('meta',{}).get('csrf_token')
  if isinstance(token,str):self.csrf=token
  return d
 def login(self,email):self.req('auth/me.php',401);self.req('auth/login.php',body={'email':email,'password':password})
 def cart(self,n=1):self.req('cart/clear.php',body={});self.req('cart/add.php',body={'product_id':pid,'quantity':n})
 def payload(self,key=None):return {'idempotency_key':key or secrets.token_hex(16),'quote_fingerprint':self.req('orders/quote.php')['data']['quote_fingerprint'],'recipient_name':'Người Nhận Test','recipient_phone':'0900000000','province':'Thành phố Test','district':None,'ward':'Phường Test','address_line':'123 Test Street','customer_note':'COD test only','payment_method':'cod'}
def ok(s):report['checks'].append(s);print('PASS',s,flush=True)
try:
 for email in emails:cli('scripts/admin_account.php',{'action':'create','email':email,'full_name':'Order Fixture','password':password});cli('tests/auth_fixture.php',{'action':'demote','email':email})
 a=Client();b=Client();a.login(emails[0]);b.login(emails[1]);guest=Client();guest.req('orders/quote.php?mode=buy_now&product_id=9&quantity=1',401)
 a.req('cart/add.php',body={'product_id':10,'quantity':2});cart=a.req('cart.php')['data'];before=inspect()
 def quote(n=1,product=9):return a.req(f'orders/quote.php?mode=buy_now&product_id={product}&quantity={n}')['data']
 def payload(n=1,key=None):
  p=a.payload(key);p.update(mode='buy_now',product_id=9,quantity=n,quote_fingerprint=quote(n)['quote_fingerprint']);return p
 q=quote(3);assert q['subtotal_vnd']==660000 and q['total_vnd']==690000 and len(q['items'])==1 and q['items'][0]['quantity']==3
 assert inspect()==before and a.req('cart.php')['data']==cart
 a.req('orders/quote.php?mode=buy_now&product_id=9&quantity=0',422);a.req('orders/quote.php?mode=buy_now&product_id=9&quantity=1.5',422);a.req('orders/quote.php?mode=oops',422)
 data=payload(3);a.req('orders/create.php',403,data,False);a.req('orders/create.php',400,dict(data,price_vnd=1));a.req('orders/create.php',422,dict(data,quantity='3'))
 order=a.req('orders/create.php',201,data)['data'];oid=order['id'];assert order['payment_status']=='pending' and order['paid_at'] is None and order['total_vnd']==690000
 assert len(order['items'])==1 and order['items'][0]['quantity']==3 and inspect()['stock']==before['stock']-3 and a.req('cart.php')['data']==cart
 assert a.req('orders/create.php',body=data)['data']['id']==oid and inspect()['stock']==before['stock']-3
 for changed in [dict(data,quantity=2),dict(data,mode='cart',product_id=None,quantity=None),dict(data,customer_note='different')]:a.req('orders/create.php',409,changed)
 b.req('orders/detail.php?id='+str(oid),404);a.req('orders/cancel.php',body={'order_id':oid});a.req('orders/cancel.php',body={'order_id':oid});assert inspect()['stock']==before['stock'] and a.req('cart.php')['data']==cart
 ok('Buy Now server quote/COD/snapshot/quantity; cart byte-equivalent; CSRF/session/validation; replay/mode-content conflict; cancel once')
 data=payload();empty=b.req('cart.php')['data'];solo=b.req('orders/create.php',201,data)['data'];assert b.req('cart.php')['data']==empty;b.req('orders/cancel.php',body={'order_id':solo['id']});ok('Buy Now succeeds without a cart; no temporary cart items')
 data=payload();before=inspect();fixture('trigger-on')
 try:a.req('orders/create.php',500,data)
 finally:fixture('trigger-off')
 assert inspect()==before and a.req('cart.php')['data']==cart;ok('Buy Now payment INSERT failure rolls back every database write; cart unchanged')
 data=payload();fixture('product-change',product_id=9);a.req('orders/create.php',409,data);assert inspect()==before;ok('price changed after quote is rejected without deducting stock')
 fixture('stock',product_id=9,stock=2);data=payload(2);a2=Client();a2.login(emails[0])
 def post(c,p):
  req=urllib.request.Request(BASE+'orders/create.php',data=json.dumps(p).encode(),headers={'Content-Type':'application/json','X-CSRF-Token':c.csrf})
  try:r=c.opener.open(req,timeout=20)
  except urllib.error.HTTPError as e:r=e
  return r.status,json.loads(r.read())
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:out=list(pool.map(lambda c:post(c,data),[a,a2]))
 assert sorted(x[0] for x in out)==[200,201] and out[0][1]['data']['id']==out[1][1]['data']['id'] and inspect()['stock']==0
 assert a.req('orders/create.php',body=data)['data']['id']==out[0][1]['data']['id'] and inspect()['stock']==0
 a.req('orders/cancel.php',body={'order_id':out[0][1]['data']['id']});ok('concurrent separate sessions same user/key + lost response retry: one order, one deduction')
 da=payload(2);db=dict(da,idempotency_key=secrets.token_hex(16))
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:out=list(pool.map(lambda x:post(*x),[(a,da),(b,db)]))
 assert sorted(x[0] for x in out)==[201,409] and inspect()['stock']==0
 winner=next(x[1]['data'] for x in out if x[0]==201);owner=a if any(o['id']==winner['id'] for o in a.req('orders/index.php')['data']) else b
 owner.req('orders/cancel.php',body={'order_id':winner['id']});assert inspect()['stock']==2;ok('two Buy Now buyers cannot oversell stock; failed order rolls back')
 fixture('stock',product_id=9,stock=0);a.req('orders/quote.php?mode=buy_now&product_id=9&quantity=1',409)
 fixture('stock',product_id=9,stock=5,status='archived');a.req('orders/quote.php?mode=buy_now&product_id=9&quantity=1',409)
 a.req('orders/quote.php?mode=buy_now&product_id=999999&quantity=1',409);ok('zero stock, archived and missing products rejected')
 fixture('stock',product_id=9,stock=5);a.req('cart/add.php',body={'product_id':9,'quantity':1});multi=a.payload();q=a.req('orders/quote.php')['data'];assert len(q['items'])==2 and q['total_vnd']==sum(i['line_total_vnd'] for i in q['items'])+30000
 placed=a.req('orders/create.php',201,multi)['data'];assert len(placed['items'])==2 and a.req('cart.php')['data']['items']==[]
 assert a.req('orders/create.php',body=dict(multi,mode='cart'))['data']['id']==placed['id']
 a.req('orders/cancel.php',body={'order_id':placed['id']});a.req('orders/cancel.php',body={'order_id':placed['id']});assert inspect()['stock']==5;ok('Cart multi-product order still clears only cart, supports legacy/explicit cart replay and cancellation once')
 report['result']='PASS'
finally:
 fixture('cleanup',emails=emails);Path('frontend/.artifacts/12c-buy-now-api.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print('Isolated fixtures cleaned; main database untouched.',flush=True)
