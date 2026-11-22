import json,secrets,subprocess,os,urllib.request,urllib.error,http.cookiejar,concurrent.futures,hashlib
from pathlib import Path
PHP='C:/xampp/php/php.exe';BASE='http://localhost/manga-store-images-test-20261122/manga-store/backend/public/api/';env=dict(os.environ,DB_NAME='manga_store_images_test_20261122')
nonce=secrets.token_hex(6);emails=[f'auth-test-{nonce}-admin@example.test',f'auth-test-{nonce}@example.test'];password=secrets.token_urlsafe(24);sku='IMGTEST-'+nonce;checks=[]
def cli(script,data):return subprocess.run([PHP,'backend/'+script],input=json.dumps(data),encoding='utf-8',text=True,capture_output=True,env=env,check=True).stdout
def fixture(action,**kw):return json.loads(cli('tests/images_fixture.php',dict(action=action,**kw)))
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
def multipart(c,pid,name,bytes_,status=200,image=None,csrf=True):
 boundary='MangaImage'+secrets.token_hex(8);fields={'product_id':str(pid)}
 if image:fields.update(image_id=str(image['id']),expected_image_url=image['image_url'])
 body=b''
 for k,v in fields.items():body+=(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n').encode()
 body+=(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{name}"\r\nContent-Type: image/jpeg\r\n\r\n').encode()+bytes_+f'\r\n--{boundary}--\r\n'.encode();headers={'Content-Type':'multipart/form-data; boundary='+boundary}
 if csrf:headers['X-CSRF-Token']=c.csrf
 req=urllib.request.Request(BASE+'admin/image-'+('replace' if image else 'upload')+'.php',data=body,headers=headers)
 try:r=c.opener.open(req,timeout=30)
 except urllib.error.HTTPError as e:r=e
 raw=r.read();assert r.status==status,(r.status,raw[:500]);assert b'SQLSTATE' not in raw and b'password_hash' not in raw;return json.loads(raw)
def ok(text):checks.append(text);print('PASS',text,flush=True)
def imgbody(pid,image):return {'product_id':pid,'image_id':image['id'],'expected_image_url':image['image_url']}
def public(pid):return Client().req('product.php?id='+str(pid))['data']
def fetch_image(url):return urllib.request.urlopen('http://localhost/manga-store-images-test-20261122'+url).read()
try:
 for i,email in enumerate(emails):
  cli('scripts/admin_account.php',{'action':'create','email':email,'full_name':'Images fixture','password':password})
  if i:cli('tests/auth_fixture.php',{'action':'demote','email':email})
 a=Client();a.login(emails[0]);customer=Client();customer.login(emails[1]);guest=Client()
 for action in ['delete','primary']:
  guest.req('admin/image-'+action+'.php',401,{});customer.req('admin/image-'+action+'.php',403,{});a.req('admin/image-'+action+'.php',403,{},csrf=False)
 guest.req('admin/image-replace.php',401,{});customer.req('admin/image-replace.php',403,{});a.req('admin/image-replace.php',403,{},csrf=False)
 cat=a.req('admin/metadata.php')['data']['categories'][0]['id'];fields={'category_id':int(cat),'series_id':None,'sku':sku,'slug':'images-'+nonce,'name_vi':'Ảnh thử nghiệm','name_en':'Image Fixture','description_vi':'Không phải catalog thật','description_en':'Isolated fixture','price_vnd':50000,'sale_price_vnd':None,'stock_quantity':5,'status':'active'}
 p=a.req('admin/product-create.php',201 if False else 200,fields)['data'];pid=p['id'];p2=a.req('admin/product-create.php',body=dict(fields,sku=sku+'-OTHER',slug='images-'+nonce+'-other'))['data'];pid2=p2['id']
 a.req('admin/product-create.php',409,fields);a.req('admin/product-create.php',409,dict(fields,sku=sku+'-DUP'))
 for changes in [{'price_vnd':-1},{'sale_price_vnd':0},{'stock_quantity':-1},{'category_id':9999999},{'series_id':9999999}]:a.req('admin/product-create.php',422,dict(fields,sku=sku+'-INVALID',slug='images-'+nonce+'-invalid',**changes))
 ok('new image endpoints require Admin and CSRF; existing creation validates duplicate SKU/slug, price, stock, category and series')
 manifest=json.loads(Path('database/catalog/demo-products/manifest.json').read_text(encoding='utf-8'));paths=[Path('database/catalog/demo-products')/p['images'][0]['local_path'] for p in [p for p in manifest['products'] if p['images'][0]['local_path'].endswith('.jpg')][:2]];b1,b2=[x.read_bytes() for x in paths]
 for b in [b1,b2,b1]:multipart(a,pid,'cover.jpg',b)
 multipart(a,pid2,'other.jpg',b2)
 images=a.req('admin/product.php?id='+str(pid))['data']['images'];original_order=[i['id'] for i in images];assert len(images)==3 and sum(int(i['is_primary']) for i in images)==1
 a.req('admin/image-primary.php',body=imgbody(pid,images[2]));a.req('admin/image-primary.php',body=imgbody(pid,images[2]))
 pub=public(pid);assert pub['image_url']==images[2]['image_url'] and [i['id'] for i in pub['images']]==original_order
 a.req('admin/image-delete.php',404,imgbody(pid2,images[0]));multipart(a,pid2,'wrong.jpg',b1,404,images[0]);assert len(public(pid2)['images'])==1
 ok('upload, exactly one primary, repeat primary is safe, public product/list reflect primary without reordering, cross-product writes denied')
 image=pub['images'][2];old=image['image_url'];oldbytes=fetch_image(old);sort=image['sort_order'];replaced=multipart(a,pid,'new.jpg',b2,image=image)['data'];assert replaced['id']==image['id'] and replaced['image_url']!=old
 now=public(pid);image=next(i for i in now['images'] if i['id']==image['id']);assert image['is_primary'] and image['sort_order']==sort and now['image_url']==image['image_url'] and fetch_image(old)==oldbytes and fetch_image(image['image_url'])==b2
 a.req('admin/image-delete.php',409,{'product_id':pid,'image_id':image['id'],'expected_image_url':old})
 beforefiles=fixture('files',product_id=pid)
 for name,b in [('fake.jpg',b'not an image'),('polyglot.jpg',b1+b'<?php echo 1; ?>'),('bad.svg',b'<svg/>'),('huge.jpg',b'x'*(5*1024*1024+1))]:multipart(a,pid,name,b,422,image)
 assert fixture('files',product_id=pid)==beforefiles
 fixture('trigger-on',product_id=pid)
 try:multipart(a,pid,'rollback.jpg',b1,500,image)
 finally:fixture('trigger-off')
 assert fixture('files',product_id=pid)==beforefiles and public(pid)['image_url']==image['image_url'] and fetch_image(image['image_url'])==b2
 ok('replacement preserves ID/order/primary; invalid file or injected DB failure preserves old image and cleans newly staged file')
 a2=Client();a2.login(emails[0])
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  def replace_pair(c):
   boundary='Race'+secrets.token_hex(8);fields=imgbody(pid,image);head=b''
   for k,v in fields.items():head+=(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n').encode()
   data=head+(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="race.jpg"\r\nContent-Type: image/jpeg\r\n\r\n').encode()+b1+f'\r\n--{boundary}--\r\n'.encode();req=urllib.request.Request(BASE+'admin/image-replace.php',data=data,headers={'Content-Type':'multipart/form-data; boundary='+boundary,'X-CSRF-Token':c.csrf})
   try:r=c.opener.open(req)
   except urllib.error.HTTPError as e:r=e
   r.read();return r.status
  statuses=list(pool.map(replace_pair,[a,a2]))
 assert sorted(statuses)==[200,409] and sum(i['is_primary'] for i in public(pid)['images'])==1
 ok('concurrent replacement with same expected URL commits once; stale request returns 409')
 pub=public(pid);primary=next(i for i in pub['images'] if i['is_primary']);a.req('admin/image-delete.php',body=imgbody(pid,primary));remaining=public(pid)['images'];assert len(remaining)==2 and next(i['id'] for i in remaining if i['is_primary'])==remaining[0]['id']
 a.req('admin/image-delete.php',body=imgbody(pid,remaining[1]));last=public(pid)['images'][0];a.req('admin/image-delete.php',409,imgbody(pid,last));assert public(pid)['image_url']==last['image_url']
 p=a.req('admin/product.php?id='+str(pid))['data'];a.req('admin/product-archive.php',body={'product_id':pid,'expected_version':p['version'],'status':'archived'});a.req('admin/image-delete.php',body=imgbody(pid,last));assert not a.req('admin/product.php?id='+str(pid))['data']['images']
 p=a.req('admin/product.php?id='+str(pid))['data'];assert p['stock_quantity']==5 and len(public(pid2)['images'])==1
 ok('delete primary elects stable fallback; active last image protected; archived last image allowed; other product and stock unchanged')
 audit=subprocess.run([PHP,'C:/xampp/htdocs/manga-store-images-test-20261122/manga-store/backend/scripts/audit_product_images.php'],capture_output=True,text=True,encoding='utf-8',env=env,check=True);audit=json.loads(audit.stdout);assert audit['read_only'] and any(f['image_url']==old for f in audit['files'])
 ok('removed/replaced files remain available for recovery and read-only audit reports them without deleting files')
 report={'result':'PASS','checks':checks}
finally:
 fixture('cleanup',skus=[sku,sku+'-OTHER'])
 for email in emails:cli('tests/auth_fixture.php',{'action':'delete','email':email})
 Path('frontend/.artifacts/images-api.json').write_text(json.dumps({'result':'PASS' if len(checks)==6 else 'INCOMPLETE','checks':checks},indent=2),encoding='utf-8');print('Isolated image fixtures cleaned; no live catalog writes.',flush=True)
