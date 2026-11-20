"""Real MySQL/Apache/Vite; generated fixture users are removed via their FK cascades."""
import json,secrets,subprocess,http.cookiejar,urllib.request,urllib.error,concurrent.futures
from pathlib import Path
PHP='C:/xampp/php/php.exe';BASE='http://localhost/manga-store/backend/public/api/'
nonce=secrets.token_hex(6);emails=[f'auth-test-{nonce}@example.test',f'auth-test-{nonce}-other@example.test'];password=secrets.token_urlsafe(24)
report={'checks':[]}
def fixture(email,action='inspect',script='auth_fixture.php',**extra):
 r=subprocess.run([PHP,'backend/tests/'+script],input=json.dumps(dict(email=email,action=action,**extra)),text=True,capture_output=True,check=True);return json.loads(r.stdout)
class Client:
 def __init__(self,base=BASE):self.base=base;self.jar=http.cookiejar.CookieJar();self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar));self.csrf=''
 def req(self,path,status=200,body=None,csrf=True):
  h={'Accept':'application/json'}
  if body is not None:h['Content-Type']='application/json'
  if body is not None and csrf:h['X-CSRF-Token']=self.csrf
  request=urllib.request.Request(self.base+path,data=None if body is None else json.dumps(body).encode(),headers=h)
  try:r=self.opener.open(request,timeout=20)
  except urllib.error.HTTPError as e:r=e
  raw=r.read().decode();assert r.status==status,(path,r.status,raw)
  assert 'password_hash' not in raw and 'SQLSTATE' not in raw
  data=json.loads(raw);token=data.get('meta',{}).get('csrf_token')
  if isinstance(token,str):self.csrf=token
  return data
 def login(self,email):self.req('auth/me.php',401);self.req('auth/login.php',body={'email':email,'password':password})
 def sid(self):return next(c.value for c in self.jar if c.name=='MANGA_STORE_SESSION')
def ok(label):report['checks'].append(label);print('PASS',label)
def qty(data,pid):return next((i['quantity'] for i in data['items'] if i['product_id']==pid),0)
for e in emails:assert not fixture(e)['exists']
try:
 guest=Client();guest.req('auth/me.php',401);guest.req('cart.php',401);guest.req('wishlist.php',401);guest.req('cart/add.php',401,{'product_id':9,'quantity':1})
 for email in emails:guest.req('auth/register.php',201,{'full_name':'Commerce Test','email':email,'password':password})
 a=Client();b=Client();a.login(emails[0]);b.login(emails[1]);ok('auth required; two isolated customer sessions')
 catalog=a.req('products.php')['data'];p=next(p for p in catalog if p['sale_price_vnd'] is not None);other=next(x for x in catalog if x['id']!=p['id']);pid=p['id'];oid=other['id'];price=p['sale_price_vnd']
 assert a.req('cart.php')['data']['items']==[]
 a.req('cart/add.php',403,{'product_id':pid,'quantity':1},csrf=False)
 data=a.req('cart/add.php',body={'product_id':pid,'quantity':2})['data']['cart'];assert qty(data,pid)==2 and data['subtotal_vnd']==2*price
 data=a.req('cart/add.php',body={'product_id':pid,'quantity':1})['data']['cart'];assert qty(data,pid)==3
 assert len(fixture(emails[0],script='commerce_fixture.php')['items'])==1
 a.req('cart/add.php',400,{'product_id':pid,'quantity':1,'price_vnd':1})
 ok('CSRF; add/duplicate unique row; valid sale VND totals; client price rejected')
 for n in [0,-1,1.5,'2',None]:a.req('cart/update.php',422,{'product_id':pid,'quantity':n})
 a.req('cart/update.php',409,{'product_id':pid,'quantity':p['stock_quantity']+1})
 data=a.req('cart/update.php',body={'product_id':pid,'quantity':1})['data']['cart'];assert qty(data,pid)==1
 a.req('cart/add.php',404,{'product_id':1,'quantity':1});a.req('cart/add.php',404,{'product_id':999999,'quantity':1})
 ok('positive integers; stock limit; quantity update; archived/missing rejected')
 b.req('cart/add.php',body={'product_id':oid,'quantity':1})
 a.req('cart/update.php',404,{'product_id':oid,'quantity':1})
 for path in ['cart/add.php','cart/update.php','cart/remove.php']:
  payload={'product_id':oid,'user_id':fixture(emails[1])['id']}
  if path!='cart/remove.php':payload['quantity']=1
  a.req(path,400,payload)
 assert qty(b.req('cart.php')['data'],oid)==1
 ok('cross-account ownership and spoofed user_id rejected')
 a.req('wishlist/add.php',body={'product_id':pid});a.req('wishlist/add.php',body={'product_id':pid})
 assert a.req('wishlist.php')['data']['product_ids']==[pid]
 assert len(fixture(emails[0],script='commerce_fixture.php')['wishlist'])==1
 b.req('wishlist/add.php',body={'product_id':oid});a.req('wishlist/remove.php',body={'product_id':oid});assert b.req('wishlist.php')['data']['product_ids']==[oid]
 a.req('wishlist/add.php',403,{'product_id':oid},csrf=False)
 ok('wishlist persists; duplicate no-op; isolation; CSRF')
 context=a.req('cart.php')['meta']['merge_context'];key=secrets.token_hex(16)
 merge={'context':context,'operation_key':key,'items':[{'product_id':pid,'quantity':2}],'wishlist':[oid]}
 first=a.req('cart/merge.php',body=merge)['data'];again=a.req('cart/merge.php',body=merge)['data'];assert qty(first['cart'],pid)==3 and qty(again['cart'],pid)==3
 changed=dict(merge,items=[{'product_id':pid,'quantity':3}]);a.req('cart/merge.php',409,changed)
 a.req('cart/merge.php',409,dict(merge,context='invalid'))
 pending=dict(merge,operation_key=secrets.token_hex(16));fixture(emails[0],action='pending',script='commerce_fixture.php',session_id=a.sid(),operation_key=pending['operation_key'],items=pending['items'],wishlist=pending['wishlist'])
 result=a.req('cart/merge.php',409,pending);assert result['error']['code']=='MERGE_UNCERTAIN' and qty(a.req('cart.php')['data'],pid)==3
 ok('guest merge additive once; retry idempotent; key/context tampering; pending receipt never replayed')
 before=a.req('cart.php')['data'];bad=dict(merge,operation_key=secrets.token_hex(16),items=[{'product_id':pid,'quantity':1},{'product_id':999999,'quantity':1}]);a.req('cart/merge.php',404,bad);assert a.req('cart.php')['data']==before
 clamp=dict(merge,operation_key=secrets.token_hex(16),items=[{'product_id':pid,'quantity':999}]);data=a.req('cart/merge.php',body=clamp)['data']['cart'];assert qty(data,pid)==p['stock_quantity']
 ok('failed merge rolls back all writes; guest sums clamp to stock without changing stock')
 a.req('cart/update.php',body={'product_id':pid,'quantity':1})
 a2=Client();a2.login(emails[0])
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(lambda c:c.req('cart/add.php',body={'product_id':pid,'quantity':1}),[a,a2]))
 assert qty(a.req('cart.php')['data'],pid)==3
 ok('concurrent sessions serialize cart additions; no lost update')
 a.req('auth/logout.php',body={});a.req('cart.php',401);a.login(emails[0]);assert qty(a.req('cart.php')['data'],pid)==3 and set(a.req('wishlist.php')['data']['product_ids'])=={pid,oid}
 a.req('cart/merge.php',409,merge)
 ok('cart/wishlist survive logout-login; old merge context rejected')
 a.req('cart/remove.php',body={'product_id':pid});assert a.req('cart.php')['data']['items']==[]
 a.req('cart/add.php',body={'product_id':pid,'quantity':1});a.req('cart/clear.php',body={});assert a.req('cart.php')['data']['subtotal_vnd']==0
 a.req('wishlist/remove.php',body={'product_id':pid});a.req('wishlist/remove.php',body={'product_id':oid});assert a.req('wishlist.php')['data']['product_ids']==[]
 proxy=Client('http://localhost:8443/api/');proxy.login(emails[1]);assert qty(proxy.req('cart.php')['data'],oid)==1
 a.req('auth/logout.php',body={});b.req('auth/logout.php',body={});proxy.req('auth/logout.php',body={});a2.req('auth/logout.php',body={})
 assert len(catalog)==23
 ok('remove/clear/wishlist removal; Vite proxy session; catalog 23')
 report['result']='PASS'
finally:
 report['cleanup']={e:fixture(e,'delete')['deleted'] for e in emails}
 Path('frontend/.artifacts/commerce-api.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
 print('Generated fixture users and their carts/wishlists removed by FK cascade.')
