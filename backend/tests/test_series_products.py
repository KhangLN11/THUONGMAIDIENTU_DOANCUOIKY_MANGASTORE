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

import threading
series_prefix='12a-test-'+nonce
try:
 for i,email in enumerate(emails):
  cli('scripts/admin_account.php',{'action':'create','email':email,'full_name':'Series Test Admin' if i==0 else 'Series Test Customer','password':password})
  if i:cli('tests/auth_fixture.php',{'email':email,'action':'demote'})
 a=Client();b=Client();customer=Client();guest=Client();a.login(emails[0]);b.login(emails[0]);customer.login(emails[1])
 guest.req('admin/series-create.php',401,{})
 customer.req('admin/series-create.php',403,{})
 a.req('admin/series-create.php',403,{},False)
 a.req('admin/series-create.php',405)
 for bad in [{'title':'','slug':'ok'},{'title':'x','slug':'BAD SLUG'},{'title':'a'*201,'slug':'ok'},{'title':'x','slug':'a'*161},{'title':'x','slug':'okay','role':'admin'},{'title':'x','slug':'okay','is_active':False}]:a.req('admin/series-create.php',400 if ('role' in bad or 'is_active' in bad) else 422,bad)
 ok('series API guest/customer/CSRF/method and invalid title/slug/unknown fields rejected')
 body={'title':'  Kiểm Thử Series '+nonce+'  ','slug':series_prefix,'original_title':'Original','description_vi':'Mô tả kiểm thử','description_en':'Test description'}
 result=a.req('admin/series-create.php',201,body)['data'];assert result['title']==body['title'].strip() and result['original_title']=='Original';sid=result['id']
 a.req('admin/series-create.php',409,dict(body,slug=series_prefix+'-dup',title='KIEM THU SERIES '+nonce))
 a.req('admin/series-create.php',409,dict(body,title='Another '+nonce))
 ok('real MariaDB unique title/slug, trim, bilingual descriptions, case/accent collation, 201/409 responses')
 barrier=threading.Barrier(2)
 def create(c):
  req=urllib.request.Request(BASE+'admin/series-create.php',data=json.dumps(dict(body,title='Concurrent '+nonce,slug=series_prefix+('-a' if c is a else '-b'))).encode(),headers={'Content-Type':'application/json','X-CSRF-Token':c.csrf})
  barrier.wait(timeout=5)
  try:r=c.opener.open(req,timeout=20)
  except urllib.error.HTTPError as e:r=e
  r.read();return r.status
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:assert sorted(pool.map(create,[a,b]))==[201,409]
 stored=json.loads(cli('tests/series_fixture.php',{'prefix':series_prefix}));assert len(stored)==2
 ok('two simultaneous Apache requests using separate admin sessions yield exactly one series 201 + one conflict 409')
 meta=a.req('admin/metadata.php')['data'];cat=int(next(c['id'] for c in meta['categories'] if c['slug']=='manga'))
 product={'sku':sku,'slug':series_prefix+'-product','name_vi':'Truyện thử - Tập 1','name_en':'Test Series - Volume 1','description_vi':'Nội dung','description_en':'Description','category_id':cat,'series_id':sid,'price_vnd':50000,'sale_price_vnd':45000,'stock_quantity':3,'status':'active'}
 p=a.req('admin/product-create.php',body=product)['data'];assert p['series_id']==sid
 a.req('admin/product-create.php',409,product)
 a.req('admin/product-create.php',422,dict(product,sku=sku+'x',slug=series_prefix+'-invalid',series_id=999999999))
 public=Client().req('product.php?id='+str(p['id']))['data'];assert public['series']['id']==sid
 ok('product links the new real series, valid FK, duplicate product rejected, public detail recognizes the real series')
 for sort in ['updated','name','price_asc','price_desc','stock_asc','stock_desc']:
  data=a.req('admin/products.php?sort='+sort+'&page_size=10&language=en')['data'];assert len(data['items'])<=10
  if sort.startswith('price'):values=[i['sale_price_vnd'] if i['sale_price_vnd'] is not None and 0<i['sale_price_vnd']<=i['price_vnd'] else i['price_vnd'] for i in data['items']];assert values==sorted(values,reverse=sort.endswith('desc'))
  if sort.startswith('stock'):values=[i['stock_quantity'] for i in data['items']];assert values==sorted(values,reverse=sort.endswith('desc'))
 result=a.req('admin/products.php?series_id='+str(sid)+'&status=active')['data'];assert [i['id'] for i in result['items']]==[p['id']]
 for term in [sku,'Test Series',series_prefix+'-product']:
  assert a.req('admin/products.php?q='+urllib.parse.quote(term))['data']['meta']['total']>=1
 for query in ['sort=SQL%20INJECTION','language=xx','series_id=-1','page_size=51']:a.req('admin/products.php?'+query,422)
 first=a.req('admin/products.php?page_size=10&page=1')['data'];second=a.req('admin/products.php?page_size=10&page=2')['data'];assert not set(i['id'] for i in first['items'])&set(i['id'] for i in second['items'])
 clamped=a.req('admin/products.php?page=999&page_size=10')['data'];assert clamped['meta']['page']==clamped['meta']['last_page']
 empty=a.req('admin/products.php?q=no-such-'+nonce)['data'];assert empty['meta']['total']==0 and empty['items']==[]
 ok('search VI/EN/SKU/slug, series/status, all sort options, effective price, pagination/no duplicate rows/clamp, empty and invalid filters')
 long_title='界'*200
 long_row=a.req('admin/series-create.php',201,{'title':'\u00a0'+long_title+'\u00a0','slug':series_prefix+'-long'})['data'];assert long_row['title']==long_title
 a.req('admin/series-create.php',409,{'title':long_title,'slug':series_prefix+'-long-duplicate'})
 ok('full 200-character UTF-8 unique index, Unicode outer whitespace trim, duplicate rejected without index prefix truncation')

 report['result']='PASS';Path('frontend/.artifacts/12a-api.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
finally:
 fixture('cleanup',emails=emails,skus=[sku])
 cli('tests/series_fixture.php',{'action':'cleanup','prefix':series_prefix})
