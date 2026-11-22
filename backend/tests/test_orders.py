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
 guest=Client();guest.req('orders/index.php',401);guest.req('orders/create.php',401,{})
 a=Client();b=Client();a.login(emails[0]);b.login(emails[1]);a.req('orders/quote.php',409);ok('guest and empty cart rejected')
 a.cart(2);quote=a.req('orders/quote.php')['data'];assert quote['subtotal_vnd']==440000 and quote['shipping_fee_vnd']==30000 and quote['total_vnd']==470000
 data=a.payload();a.req('orders/create.php',403,data,False);a.req('orders/create.php',400,dict(data,total_vnd=1));a.req('orders/create.php',422,dict(data,recipient_phone='bad'))
 before=inspect();order=a.req('orders/create.php',201,data)['data'];oid=order['id'];assert order['status']=='pending' and order['payment_status']=='pending' and order['payment_method']=='cod' and order['paid_at'] is None
 assert order['recipient_name']==data['recipient_name'] and order['ward']==data['ward'] and order['items'][0]['quantity']==2 and order['total_vnd']==470000
 assert inspect(order_id=oid)['stock']==before['stock']-2 and a.req('cart.php')['data']['items']==[] and inspect()['addresses']==before['addresses']+1
 assert a.req('orders/create.php',body=data)['meta']['replayed'] and a.req('orders/create.php',body=data)['data']['id']==oid
 a.req('orders/create.php',409,dict(data,customer_note='changed'))
 assert a.req('orders/detail.php?checkout_key='+data['idempotency_key'])['data']['id']==oid
 b.req('orders/detail.php?id='+str(oid),404);b.req('orders/cancel.php',404,{'order_id':oid});ok('create snapshots/address/COD unpaid, backend VND, stock/cart; CSRF/input/owner; replay and hash conflict')
 fixture('product-change',product_id=pid);assert a.req('orders/detail.php?id='+str(oid))['data']['items']==order['items'];ok('order snapshots independent from current product name/price')
 a.req('orders/cancel.php',body={'order_id':oid});a.req('orders/cancel.php',body={'order_id':oid});state=inspect(order_id=oid);assert state['stock']==before['stock'] and len(state['movements'])==2 and all(int(m['n'])==1 for m in state['movements']);ok('cancel restores stock once; duplicate cancellation does not repeat movement')
 fixture('stock',product_id=pid,stock=2);a.cart(2);b.cart(2);pa=a.payload();pb=b.payload()
 def compete(c,payload):
  r=urllib.request.Request(BASE+'orders/create.php',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','X-CSRF-Token':c.csrf})
  try:r=c.opener.open(r,timeout=20)
  except urllib.error.HTTPError as e:r=e
  return r.status,json.loads(r.read())
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:outcomes=list(pool.map(lambda x:compete(*x),[(a,pa),(b,pb)]))
 assert sorted(x[0] for x in outcomes)==[201,409]
 assert next(x[1] for x in outcomes if x[0]==409)['error']['code']=='INSUFFICIENT_STOCK'
 # Exactly one committed order, stock zero, and failed request retained its cart.
 assert inspect()['stock']==0
 all_orders=a.req('orders/index.php')['data']+b.req('orders/index.php')['data'];pending=[o for o in all_orders if o['status']=='pending'];assert len(pending)==1
 winner=pending[0];win=a if winner in a.req('orders/index.php')['data'] else b
 win.req('orders/cancel.php',body={'order_id':winner['id']});assert inspect()['stock']==2;ok('two users contend for stock 2: only one order commits, no negative stock')
 a.req('cart/clear.php',body={});b.req('cart/clear.php',body={});fixture('stock',product_id=pid,stock=5);a.cart();request=a.payload();a2=Client();a2.login(emails[0])
 # Concurrent raw responses allow either request to be creator/replay.
 def concurrent_create(c):
  req=urllib.request.Request(BASE+'orders/create.php',data=json.dumps(request).encode(),headers={'Content-Type':'application/json','X-CSRF-Token':c.csrf})
  r=c.opener.open(req,timeout=20);assert r.status in [200,201];return json.loads(r.read())
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:replies=list(pool.map(concurrent_create,[a,a2]))
 assert replies[0]['data']['id']==replies[1]['data']['id'] and inspect()['stock']==4
 new_id=replies[0]['data']['id'];a.req('orders/create.php',body=request);assert inspect()['stock']==4;ok('concurrent same-key requests and lost-response retry create one order and deduct once')
 a.req('orders/cancel.php',body={'order_id':new_id});a.cart();request=a.payload();before=inspect();fixture('trigger-on')
 try:a.req('orders/create.php',500,request)
 finally:fixture('trigger-off')
 after=inspect();assert before==after and a.req('cart.php')['data']['total_quantity']==1;ok('injected payment INSERT error rolls back order/address/items/stock/movements/cart deletion')
 fixture('stock',product_id=pid,stock=0);a.req('orders/create.php',409,request);fixture('stock',product_id=pid,stock=5,status='archived');a.req('orders/create.php',409,request);fixture('stock',product_id=pid,stock=5)
 request=a.payload();delivered=a.req('orders/create.php',201,request)['data'];fixture('order-status',email=emails[0],order_id=delivered['id'],status='delivered');a.req('orders/cancel.php',409,{'order_id':delivered['id']});ok('out-of-stock/archived blocked; delivered order cannot cancel')
 history=a.req('orders/index.php')['data'];assert history[0]['id']==delivered['id'] and len({x['id'] for x in history})==len(history)
 a.req('auth/logout.php',body={});a.login(emails[0]);assert a.req('orders/detail.php?id='+str(oid))['data']['status']=='cancelled';ok('history newest first, detail snapshots and logout/login persistence')
 report['result']='PASS'
finally:
 fixture('cleanup',emails=emails);Path('frontend/.artifacts/orders-api.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print('Isolated fixtures cleaned; live catalog was not modified.',flush=True)
