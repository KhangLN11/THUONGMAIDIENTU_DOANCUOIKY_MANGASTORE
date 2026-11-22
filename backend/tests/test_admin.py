import json,secrets,subprocess,os,urllib.request,urllib.error,http.cookiejar,concurrent.futures,hashlib
from pathlib import Path
PHP='C:/xampp/php/php.exe';BASE='http://localhost/manga-store-admin-test-20261122/manga-store/backend/public/api/';env=dict(os.environ,DB_NAME='manga_store_admin_test_20261122')
nonce=secrets.token_hex(6);emails=[f'auth-test-{nonce}-admin@example.test',f'auth-test-{nonce}@example.test'];password=secrets.token_urlsafe(24);sku='ADMTEST-'+nonce;report={'checks':[]}
def cli(script,data):return subprocess.run([PHP,'backend/'+script],input=json.dumps(data),text=True,capture_output=True,env=env,check=True).stdout
def fixture(action,**kw):return json.loads(cli('tests/admin_fixture.php',dict(action=action,**kw)))
class Client:
 def __init__(self):self.jar=http.cookiejar.CookieJar();self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar));self.csrf=''
 def req(self,path,status=200,body=None,csrf=True):
  h={'Accept':'application/json'}
  if body is not None:h['Content-Type']='application/json'
  if body is not None and csrf:h['X-CSRF-Token']=self.csrf
  r=urllib.request.Request(BASE+path,data=None if body is None else json.dumps(body).encode(),headers=h)
  try:r=self.opener.open(r,timeout=20)
  except urllib.error.HTTPError as e:r=e
  raw=r.read().decode();assert r.status==status,(path,r.status,raw);assert 'password_hash' not in raw and 'SQLSTATE' not in raw
  d=json.loads(raw);token=d.get('meta',{}).get('csrf_token')
  if isinstance(token,str):self.csrf=token
  return d
 def login(self,email):self.req('auth/me.php',401);return self.req('auth/login.php',body={'email':email,'password':password})['data']
 def upload(self,pid,filename,bytes_,status=200,csrf=True):
  boundary='MangaBoundary'+secrets.token_hex(8)
  body=(f'--{boundary}\r\nContent-Disposition: form-data; name="product_id"\r\n\r\n{pid}\r\n--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{filename}"\r\nContent-Type: image/jpeg\r\n\r\n').encode()+bytes_+f'\r\n--{boundary}--\r\n'.encode()
  headers={'Content-Type':'multipart/form-data; boundary='+boundary}
  if csrf:headers['X-CSRF-Token']=self.csrf
  req=urllib.request.Request(BASE+'admin/image-upload.php',data=body,headers=headers)
  try:r=self.opener.open(req,timeout=30)
  except urllib.error.HTTPError as e:r=e
  raw=r.read();assert r.status==status,(r.status,raw[:300]);return json.loads(raw)
def ok(s):report['checks'].append(s);print('PASS',s,flush=True)
try:
 for i,email in enumerate(emails):
  assert not json.loads(cli('tests/auth_fixture.php',{'email':email,'action':'inspect'}))['exists']
  cli('scripts/admin_account.php',{'action':'create','email':email,'full_name':'Admin Fixture' if i==0 else 'Customer Fixture','password':password})
  if i:cli('tests/auth_fixture.php',{'email':email,'action':'demote'})
 guest=Client();guest.req('admin/dashboard.php',401);a=Client();customer=Client();admin=a.login(emails[0]);customer.login(emails[1])
 endpoints=['dashboard.php','orders.php','products.php','inventory.php','customers.php','metadata.php','product.php?id=9','order.php?id=1','inventory-movements.php?product_id=9']
 for ep in endpoints:customer.req('admin/'+ep,403)
 customer.req('admin/product-create.php',403,{})
 baseline=a.req('admin/dashboard.php')['data'];assert baseline['active_products']==23 and baseline['collected_cod_vnd']==0
 a.req('admin/product-create.php',403,{},False);a.req('admin/products.php?page_size=999',422)
 meta=a.req('admin/metadata.php')['data'];category=int(meta['categories'][0]['id']);series=int(meta['series'][0]['id'])
 body={'sku':sku,'slug':'admin-test-'+nonce,'name_vi':'Sản phẩm kiểm thử Admin','name_en':'Admin Test Product','description_vi':'Mô tả thử nghiệm','description_en':'Test description','category_id':category,'series_id':series,'price_vnd':50000,'sale_price_vnd':45000,'stock_quantity':2,'status':'active'}
 p=a.req('admin/product-create.php',body=body)['data'];pid=p['id'];assert p['stock_quantity']==2
 a.req('admin/product-create.php',409,body);a.req('admin/product-create.php',422,dict(body,sku=sku+'-BAD',sale_price_vnd=0));a.req('admin/product-create.php',422,dict(body,sku=sku+'-BAD',category_id=999999))
 assert a.req('admin/products.php?q='+sku)['data']['meta']['total']==1
 a.req('admin/product-update.php',400,dict(body,product_id=pid,expected_version=p['version']))
 edit={k:v for k,v in body.items() if k!='stock_quantity'};edit.update(product_id=pid,expected_version=p['version'],name_vi='Tên đã chỉnh sửa')
 p=a.req('admin/product-update.php',body=edit)['data'];a.req('admin/product-update.php',409,edit)
 ok('guest/customer admin denial; CSRF; dashboard counts; paginated search; create/edit validation; SKU uniqueness; stock cannot be edited through product form; stale version rejected')
 adjust={'product_id':pid,'expected_stock':2,'quantity_delta':3,'reason':'Test restock count'}
 p=a.req('admin/inventory-adjust.php',body=adjust)['data'];assert p['stock_quantity']==5
 a.req('admin/inventory-adjust.php',409,adjust);a.req('admin/inventory-adjust.php',422,dict(adjust,expected_stock=5,quantity_delta=-6));a.req('admin/inventory-adjust.php',422,dict(adjust,expected_stock=5,quantity_delta=1.2));a.req('admin/inventory-adjust.php',422,dict(adjust,expected_stock=5,reason=''))
 a2=Client();a2.login(emails[0]);adjust_request=dict(adjust,expected_stock=5,quantity_delta=-1)
 def change(c):
  req=urllib.request.Request(BASE+'admin/inventory-adjust.php',data=json.dumps(adjust_request).encode(),headers={'Content-Type':'application/json','X-CSRF-Token':c.csrf})
  try:r=c.opener.open(req,timeout=20)
  except urllib.error.HTTPError as e:r=e
  r.read();return r.status
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:assert sorted(pool.map(change,[a,a2]))==[200,409]
 assert fixture('inspect',product_id=pid)['product']['stock_quantity']==4
 movements=a.req('admin/inventory-movements.php?product_id='+str(pid))['data'];assert any(int(m['actor_user_id'])==admin['id'] and m['reason']=='adjustment' for m in movements)
 ok('inventory transaction/CAS, integer/nonnegative validation, concurrent adjustment no lost update, actor/reason audit')
 sample=next(Path('backend/public/uploads/products').rglob('*.jpg')).read_bytes()
 customer.upload(pid,'cover.jpg',sample,403);a.upload(pid,'cover.jpg',sample,403,False)
 sanitized=a.upload(pid,'../cover.jpg',sample)['data'];assert sanitized['image_url'].startswith('/manga-store/backend/public/uploads/products/'+str(pid)+'/') and '..' not in sanitized['image_url'];a.upload(pid,'cover.jpg',b'not an image',422);a.upload(pid,'cover.svg',b'<svg/>',422);a.upload(pid,'large.jpg',sample+b'x'*(5*1024*1024+1),422);a.upload(pid,'cover.jpg',sample+b'<?php echo 1;',422)
 images=[a.upload(pid,'cover.jpg',sample)['data'],a.upload(pid,'cover.jpg',sample)['data']];assert images[0]['id']>0 and images[0]['image_url']!=images[1]['image_url']
 p=a.req('admin/product.php?id='+str(pid))['data'];assert len(p['images'])==3 and sum(int(i['is_primary']) for i in p['images'])==1
 for image in images:
  r=urllib.request.urlopen('http://localhost/manga-store-admin-test-20261122'+image['image_url'],timeout=10);assert r.status==200 and hashlib.sha256(r.read()).digest()==hashlib.sha256(sample).digest()
 probe=Path('C:/xampp/htdocs/manga-store-admin-test-20261122/manga-store/backend/public/uploads/products')/str(pid)/'probe.php';probe.write_text("<?php echo 'ADMIN_EXECUTED';")
 try:r=urllib.request.urlopen('http://localhost/manga-store-admin-test-20261122/manga-store/backend/public/uploads/products/'+str(pid)+'/probe.php',timeout=10)
 except urllib.error.HTTPError as e:r=e
 assert r.status==403 and b'ADMIN_EXECUTED' not in r.read();probe.unlink()
 ok('upload admin+CSRF only; traversal filename cannot escape storage; MIME/SVG/PHP-polyglot rejected; random no-overwrite raster URLs, HTTP bytes, one primary, PHP execution blocked')
 customer.req('cart/add.php',body={'product_id':pid,'quantity':1});q=customer.req('orders/quote.php')['data']
 checkout={'idempotency_key':secrets.token_hex(16),'quote_fingerprint':q['quote_fingerprint'],'recipient_name':'Test Customer','recipient_phone':'0900000000','province':'Test','district':None,'ward':'Test','address_line':'Test street','customer_note':None,'payment_method':'cod'}
 order=customer.req('orders/create.php',201,checkout)['data'];oid=order['id'];assert order['total_vnd']==75000
 filtered=a.req('admin/orders.php?q='+order['order_code']+'&status=pending')['data'];assert filtered['meta']['total']==1
 a.req('admin/order-status.php',409,{'order_id':oid,'expected_status':'pending','status':'delivered'})
 a.req('admin/payment-confirm.php',422,{'order_id':oid,'received':False,'reference':'TEST'})
 a.req('admin/payment-confirm.php',409,{'order_id':oid,'received':True,'reference':'TEST'})
 current='pending'
 for target in ['confirmed','processing','shipping','delivered']:
  order=a.req('admin/order-status.php',body={'order_id':oid,'expected_status':current,'status':target})['data'];assert order['status']==target and order['payment_status']=='pending';current=target
 assert a.req('admin/dashboard.php')['data']['collected_cod_vnd']==0
 paid=a.req('admin/payment-confirm.php',body={'order_id':oid,'received':True,'reference':'TEST-RECEIPT-'+nonce})['data'];assert paid['payment_status']=='paid' and paid['paid_at'] is not None
 a.req('admin/payment-confirm.php',body={'order_id':oid,'received':True,'reference':'TEST-RECEIPT-'+nonce});a.req('admin/payment-confirm.php',409,{'order_id':oid,'received':True,'reference':'DIFFERENT'})
 assert a.req('admin/dashboard.php')['data']['collected_cod_vnd']==75000
 a.req('admin/order-status.php',409,{'order_id':oid,'expected_status':'delivered','status':'cancelled'})
 ok('order search/detail; valid shipment/status flow; invalid jumps/cancellation rejected; delivery is not payment; explicit receipt/paid_at and revenue counted once')
 p=a.req('admin/product.php?id='+str(pid))['data'];edited=dict(edit,expected_version=p['version'],name_vi='Renamed after order',price_vnd=80000,sale_price_vnd=60000)
 p=a.req('admin/product-update.php',body=edited)['data'];p=a.req('admin/product-archive.php',body={'product_id':pid,'expected_version':p['version'],'status':'archived'})['data']
 assert customer.req('orders/detail.php?id='+str(oid))['data']['items'][0]['unit_price_vnd']==45000
 assert customer.req('orders/detail.php?id='+str(oid))['data']['items'][0]['name_vi_snapshot']=='Tên đã chỉnh sửa'
 p=a.req('admin/product-archive.php',body={'product_id':pid,'expected_version':p['version'],'status':'active'})['data'];stock=p['stock_quantity']
 customer.req('cart/add.php',body={'product_id':pid,'quantity':1});checkout.update(idempotency_key=secrets.token_hex(16),quote_fingerprint=customer.req('orders/quote.php')['data']['quote_fingerprint']);pending=customer.req('orders/create.php',201,checkout)['data'];cancel={'order_id':pending['id'],'expected_status':'pending','status':'cancelled'}
 a.req('admin/order-status.php',body=cancel);a.req('admin/order-status.php',body=cancel);customer.req('orders/cancel.php',body={'order_id':pending['id']})
 inspected=fixture('inspect',product_id=pid);assert inspected['product']['stock_quantity']==stock
 restocks=[m for m in inspected['movements'] if m['reason']=='cancel_restock' and int(m['order_id'])==pending['id']];assert len(restocks)==1 and int(restocks[0]['actor_user_id'])==admin['id']
 a.req('admin/order-status.php',409,dict(cancel,expected_status='cancelled',status='delivered'))
 assert customer.req('orders/create.php',body=checkout)['data']['id']==pending['id']
 ok('product edits/archive preserve order snapshots; admin cancellation reuses Stage 8, actor correct, one restock across admin/customer retries; checkout idempotency intact')
 race_body=dict(body,sku=sku+'-RACE',slug='admin-race-'+nonce,stock_quantity=2);race=a.req('admin/product-create.php',body=race_body)['data'];race_id=race['id']
 customer.req('cart/add.php',body={'product_id':race_id,'quantity':2});race_quote=customer.req('orders/quote.php')['data'];race_checkout=dict(checkout,idempotency_key=secrets.token_hex(16),quote_fingerprint=race_quote['quote_fingerprint'])
 def race_call(client,path,payload):
  req=urllib.request.Request(BASE+path,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','X-CSRF-Token':client.csrf})
  try:r=client.opener.open(req,timeout=20)
  except urllib.error.HTTPError as e:r=e
  return r.status,json.loads(r.read())
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  fa=pool.submit(race_call,a,'admin/inventory-adjust.php',{'product_id':race_id,'expected_stock':2,'quantity_delta':-1,'reason':'Concurrent stock check'})
  fc=pool.submit(race_call,customer,'orders/create.php',race_checkout);ra,rc=fa.result(),fc.result()
 assert (ra[0],rc[0]) in [(200,409),(409,201)],(ra,rc)
 state=fixture('inspect',product_id=race_id);assert state['product']['stock_quantity'] in [0,1]
 if rc[0]==201:a.req('admin/order-status.php',body={'order_id':rc[1]['data']['id'],'expected_status':'pending','status':'cancelled'})
 ok('admin adjustment versus simultaneous checkout: compare-and-swap preserves sale, no overwrite or negative stock')
 customers=a.req('admin/customers.php?q='+nonce)['data'];assert len(customers['items'])==1 and customers['items'][0]['email']==emails[1] and int(customers['items'][0]['order_count']) in [2,3]
 assert all('role' not in c and 'password_hash' not in c for c in customers['items']);a.req('admin/customers.php',405,{'role':'admin'})
 cli('tests/auth_fixture.php',{'email':emails[0],'action':'demote'});a.req('admin/dashboard.php',403)
 report['result']='PASS';ok('customers read-only without hashes/role controls; admin privilege revocation enforced immediately')
finally:
 fixture('cleanup',emails=emails,skus=[sku,sku+'-RACE']);Path('frontend/.artifacts/admin-api.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print('Admin fixtures/orders/products/uploads cleaned in isolated DB only.',flush=True)
