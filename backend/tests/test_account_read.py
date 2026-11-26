import json,secrets,subprocess,http.cookiejar,urllib.request,urllib.error,concurrent.futures,os
from pathlib import Path
BASE='http://localhost/manga-store-orders-test-20261120/manga-store/backend/public/api/'
PHP='C:/xampp/php/php.exe';env=dict(os.environ,DB_NAME='manga_store_orders_test_20261120')
nonce=secrets.token_hex(6);emails=[f'auth-test-{nonce}@example.test',f'auth-test-{nonce}-other@example.test'];password=secrets.token_urlsafe(24);report={'checks':[]}
def cli(script,data):
 r=subprocess.run([PHP,'backend/'+script],input=json.dumps(data),text=True,encoding="utf-8",capture_output=True,env=env,check=True);return r.stdout
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
 for email in emails:
  cli('scripts/admin_account.php',{'action':'create','email':email,'full_name':'Trần Minh Anh','password':password});cli('tests/auth_fixture.php',{'action':'demote','email':email})
 cli('tests/account_fixture.php',{'action':'seed','email':emails[0],'nonce':nonce,'count':105});cli('tests/account_fixture.php',{'action':'seed','email':emails[1],'nonce':nonce,'count':3})
 a=Client();b=Client();a.login(emails[0]);b.login(emails[1]);Client().req('orders/index.php?view=account',401)
 before=json.loads(cli('scripts/catalog_snapshot.php',{}))['tables']
 d=a.req('orders/index.php?view=account')['data'];assert d['total_orders']==105 and len(d['items'])==10 and d['pages']==11 and sum(d['counts'].values())==105
 assert d['counts']==dict(pending=18,confirmed=18,processing=18,shipping=17,delivered=17,cancelled=17)
 ids=[]
 for page in range(1,12):ids.extend(i['id'] for i in a.req('orders/index.php?view=account&page='+str(page))['data']['items'])
 assert len(ids)==len(set(ids))==105 and ids==sorted(ids,reverse=True)
 for status,n in d['counts'].items():
  f=a.req('orders/index.php?view=account&status='+status)['data'];assert f['total']==n and f['total_orders']==105 and all(i['status']==status for i in f['items'])
 assert a.req('orders/index.php?view=account&page=9999999')['data']['page']==11
 for q in ['status=wrong','status[]=pending','page=0','page=-1','per_page=1000','page=1%20OR%201=1','view=invalid']:a.req('orders/index.php?view=account&'+q,422)
 other=b.req('orders/index.php?view=account')['data'];assert other['total_orders']==3 and not set(ids)&{i['id'] for i in other['items']};b.req('orders/detail.php?id='+str(ids[0]),404)
 assert len(a.req('orders/index.php')['data'])==100
 after=json.loads(cli('scripts/catalog_snapshot.php',{}))['tables'];assert all(before[k]['sha256']==after[k]['sha256'] and before[k]['schema']==after[k]['schema'] for k in before)
 ok('Account exact totals/status counts beyond 100, pagination/dedup/stable sorting/clamping, validation, ownership, legacy response, all 17 tables unchanged by reads');report['result']='PASS'
finally:
 fixture('cleanup',emails=emails);Path('frontend/.artifacts/14-account-api.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print('Only isolated account fixtures were created/cleaned.')
