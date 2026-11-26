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

config=Path('C:/xampp/htdocs/manga-store-orders-test-20261120/manga-store/backend/config/payment.local.php');config_before=config.read_bytes()
try:
 for i,email in enumerate(emails):
  cli('scripts/admin_account.php',{'action':'create','email':email,'full_name':'Payment Sandbox Fixture','password':password})
  if not i:cli('tests/auth_fixture.php',{'action':'demote','email':email})
 a=Client();admin=Client();a.login(emails[0]);admin.login(emails[1]);guest=Client();a.req('cart/add.php',body={'product_id':10,'quantity':2});cart=a.req('cart.php')['data']
 def bank(key=None):
  q=a.req('orders/quote.php?mode=buy_now&product_id=9&quantity=1')['data'];assert q['payment_options']['bank_transfer'] and q['payment_simulation'];d=a.payload(key);d.update(mode='buy_now',product_id=9,quantity=1,payment_method='bank_transfer',quote_fingerprint=q['quote_fingerprint']);return d
 def report_data():return admin.req('admin/reports/overview.php?preset=today')['data']
 baseline=report_data()['overview'];before=inspect();data=bank();order=a.req('orders/create.php',201,data)['data'];oid=order['id'];instructions=order['payment_instructions'];assert order['payment_method']=='bank_transfer' and order['payment_status']=='pending' and order['paid_at'] is None
 assert instructions['simulation'] and instructions['account_number'] is None and instructions['bank_bin'] is None and instructions['reference']=='MU'+str(oid) and 'NOT-A-PAYMENT' in instructions['qr_payload'] and not instructions['qr_payload'].startswith('000201')
 assert a.req('cart.php')['data']==cart and inspect()['stock']==before['stock']-1;assert report_data()['overview']['collected_bank_vnd']==baseline['collected_bank_vnd'];assert a.req('orders/create.php',body=data)['data']['id']==oid
 a.req('orders/create.php',409,dict(data,payment_method='cod'));a.req('orders/create.php',400,dict(data,paid=True));ok('Sandbox bank order pending, non-payment QR/no bank account; Buy Now/cart isolation and method-bound idempotency; no fake revenue')
 receipt={'order_id':oid,'received':True,'reference':'SANDBOX-'+nonce,'amount_vnd':order['total_vnd'],'payment_reference':instructions['reference']}
 guest.req('admin/payment-confirm.php',401,receipt);a.req('admin/payment-confirm.php',403,receipt);admin.req('admin/payment-confirm.php',403,receipt,False)
 admin.req('admin/payment-confirm.php',409,dict(receipt,amount_vnd=1));admin.req('admin/payment-confirm.php',409,dict(receipt,payment_reference='MU0'));admin.req('admin/payment-confirm.php',422,dict(receipt,received=False))
 paid=admin.req('admin/payment-confirm.php',body=receipt)['data'];assert paid['payment_status']=='paid' and paid['paid_at'] and paid['payment_instructions'] is None
 admin.req('admin/payment-confirm.php',body=receipt);a.req('orders/cancel.php',409,{'order_id':oid})
 metrics=report_data()['overview'];assert int(metrics['collected_bank_vnd'])-int(baseline['collected_bank_vnd'])==order['total_vnd'] and metrics['collected_cod_vnd']==baseline['collected_cod_vnd'] and int(metrics['collected_total_vnd'])==int(metrics['collected_bank_vnd'])+int(metrics['collected_cod_vnd']);ok('Admin/session/CSRF; amount+reference reconciliation; one paid_at; no customer self-paid; Reports separate bank/COD and total; paid order cannot cancel/refund')
 second=a.req('orders/create.php',201,bank())['data'];dup=dict(receipt,order_id=second['id'],payment_reference='MU'+str(second['id']))
 admin.req('admin/payment-confirm.php',409,dup);assert report_data()['overview']['collected_bank_vnd']==metrics['collected_bank_vnd']
 a.req('orders/cancel.php',body={'order_id':second['id']});a.req('orders/cancel.php',body={'order_id':second['id']});assert a.req('orders/detail.php?id='+str(second['id']))['data']['payment_instructions'] is None;ok('same bank receipt cannot pay a second order; unpaid bank cancellation restocks exactly once')
 third=a.req('orders/create.php',201,bank())['data'];receipt3=dict(receipt,order_id=third['id'],payment_reference='MU'+str(third['id']),reference='PARALLEL-'+nonce);admin2=Client();admin2.login(emails[1])
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:replies=list(pool.map(lambda c:c.req('admin/payment-confirm.php',body=receipt3),[admin,admin2]))
 assert all(r['data']['id']==third['id'] and r['data']['payment_status']=='paid' for r in replies)
 assert int(report_data()['overview']['collected_bank_vnd'])==int(metrics['collected_bank_vnd'])+third['total_vnd'];ok('two Admin sessions concurrently reconcile once without duplicate revenue')
 before=inspect();d=bank();fixture('trigger-on')
 try:a.req('orders/create.php',500,d)
 finally:fixture('trigger-off')
 assert inspect()==before and a.req('cart.php')['data']==cart;ok('bank payment INSERT failure rolls back stock/order/items/address/movements and preserves cart')
 config.write_text("<?php return ['enabled'=>false];",encoding='utf-8');d=dict(data,idempotency_key=secrets.token_hex(16))
 q=a.req('orders/quote.php?mode=buy_now&product_id=9&quantity=1')['data'];assert not q['payment_options']['bank_transfer'];d['quote_fingerprint']=q['quote_fingerprint'];before=inspect();a.req('orders/create.php',409,d);assert inspect()==before;ok('missing configuration disables bank/QR and rejects creation without any writes')
 report['result']='PASS'
finally:
 config.write_bytes(config_before);fixture('cleanup',emails=emails);Path('frontend/.artifacts/13-payments-api.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print('Sandbox fixtures cleaned; main DB/account configuration untouched.',flush=True)
