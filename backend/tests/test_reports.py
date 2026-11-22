import csv,io,json,secrets,subprocess,os,urllib.request,urllib.error,http.cookiejar
from pathlib import Path
PHP='C:/xampp/php/php.exe';BASE='http://localhost/manga-store-reports-test-20261122/manga-store/backend/public/api/'
env=dict(os.environ,DB_NAME='manga_store_reports_test_20261122');nonce=secrets.token_hex(6);emails=[f'auth-test-{nonce}-admin@example.test',f'auth-test-{nonce}@example.test'];password=secrets.token_urlsafe(24);checks=[]
def cli(script,data=None,args=()):
 r=subprocess.run([PHP,'backend/'+script,*args],input='' if data is None else json.dumps(data),text=True,encoding="utf-8",capture_output=True,env=env,check=True);return r.stdout
def snapshot():return json.loads(cli('scripts/catalog_snapshot.php'))['tables']
def same_rows(a,b):
 assert a.keys()==b.keys()
 for t in a:assert (a[t]['count'],a[t]['sha256'])==(b[t]['count'],b[t]['sha256']),t
class Client:
 def __init__(self):self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()));self.csrf=''
 def req(self,path,status=200,body=None,csv_=False):
  headers={'Accept':'text/csv' if csv_ else 'application/json'}
  if body is not None:headers.update({'Content-Type':'application/json','X-CSRF-Token':self.csrf})
  req=urllib.request.Request(BASE+path,data=None if body is None else json.dumps(body).encode(),headers=headers)
  try:r=self.opener.open(req,timeout=20)
  except urllib.error.HTTPError as e:r=e
  raw=r.read();assert r.status==status,(path,r.status,raw[:500]);assert b'password_hash' not in raw and b'SQLSTATE' not in raw
  if csv_ and status==200:
   assert r.headers['Content-Type'].startswith('text/csv') and raw.startswith(b'\xef\xbb\xbf');return raw
  d=json.loads(raw);self.csrf=d.get('meta',{}).get('csrf_token') or self.csrf;return d
 def login(self,email):self.req('auth/me.php',401);self.req('auth/login.php',body={'email':email,'password':password})
def ok(s):checks.append(s);print('PASS',s,flush=True)
q='preset=custom&start=2026-01-01&end=2026-01-31&group=day'
seeded=False
try:
 for i,email in enumerate(emails):
  cli('scripts/admin_account.php',{'action':'create','email':email,'full_name':'Reports Test','password':password})
  if i:cli('tests/auth_fixture.php',{'action':'demote','email':email})
 guest=Client();admin=Client();customer=Client();admin.login(emails[0]);customer.login(emails[1])
 for ep in ['overview','revenue','orders','products','categories','export']:
  guest.req('admin/reports/'+ep+'.php?'+q,401);customer.req('admin/reports/'+ep+'.php?'+q,403)
 admin.req('admin/reports/overview.php',405,{})
 ok('all six report endpoints enforce Admin session and GET-only methods')
 empty=admin.req('admin/reports/overview.php?'+q)['data'];assert empty['overview']['total_orders']==0 and empty['overview']['collected_cod_vnd']=='0' and empty['products']==[] and len(empty['revenue'])==31
 assert len(empty['categories'])==7 and all(x['sold_quantity']==0 for x in empty['categories']);ok('empty period returns zeros, zero-filled trend and no invented sales')
 for bad in ['preset=custom&start=2026-02-30&end=2026-03-01','preset=custom&start=2026-02-01&end=2026-01-01','preset=custom&start=2025-01-01&end=2026-01-31','group=day%27%3BDROP','preset=oops','preset[]=today','unknown=1','preset=today&start=2026-01-01']:
  admin.req('admin/reports/overview.php?'+bad,422)
 for typ in ['bad','../orders'] : admin.req('admin/reports/export.php?type='+typ,422)
 ok('invalid dates/order/range, array parameters, SQL-like grouping and unknown filters rejected')
 cli('scripts/seed_reports_demo.php',args=('--apply',));seeded=True
 assert json.loads(cli('scripts/seed_reports_demo.php',args=('--apply',)))['already_seeded'];before=snapshot()
 d=admin.req('admin/reports/overview.php?'+q)['data'];o=d['overview']
 assert {k:o[k] for k in ['total_orders','pending_orders','processing_orders','completed_orders','cancelled_orders','sold_quantity']}=={'total_orders':10,'pending_orders':1,'processing_orders':3,'completed_orders':5,'cancelled_orders':1,'sold_quantity':8},o
 assert o['created_order_value_vnd']=='3000000' and o['average_order_vnd']=='300000' and o['collected_cod_vnd']=='560000' and o['collected_orders']==2 and o['average_collected_vnd']=='280000',o
 assert o['total_customers']==empty['overview']['total_customers']+1 and o['active_products']==empty['overview']['active_products']+3
 ok('exact KPI oracle: multi-item order counted once, cancelled value separate, delivered unpaid/invalid receipt/bank transfer excluded from COD')
 assert sum(x['total_orders'] for x in d['statuses'])==10
 products=d['products'];assert [x['sku'] for x in products]==['RPTSIM-MANGA','RPTSIM-FIGURE','RPTSIM-NOVEL']
 assert [x['sold_quantity'] for x in products]==[4,3,1] and [x['sales_value_vnd'] for x in products]==['400000','900000','200000']
 cats={x['slug']:x for x in d['categories']};assert [cats[k]['sold_quantity'] for k in ['manga','novels','figures']]==[4,1,3]
 assert sum(int(x['sales_value_vnd']) for x in d['categories'])==1500000
 ok('delivered-only Top 10 and category snapshot sales exclude cancelled/pending and preserve item prices')
 assert d['revenue'][0]['total_orders']==1 and d['revenue'][0]['collected_cod_vnd']=='130000'
 assert d['revenue'][-1]['total_orders']==1 and d['revenue'][-1]['collected_cod_vnd']=='0'
 assert sum(int(x['collected_cod_vnd']) for x in d['revenue'])==560000
 assert d['period']['end_exclusive']=='2026-02-01 00:00:00' and d['period']['timezone']=='Asia/Ho_Chi_Minh'
 for group in ['month','year']:
  part=admin.req('admin/reports/revenue.php?'+q.replace('group=day','group='+group))['data']['items'];assert len(part)==1 and part[0]['collected_cod_vnd']=='560000' and part[0]['total_orders']==10
 for preset in ['today','7days','30days','month','year']:
  result=admin.req('admin/reports/overview.php?preset='+preset)['data'];assert result['period']['preset']==preset
 leap=admin.req('admin/reports/revenue.php?preset=custom&start=2024-01-01&end=2024-12-31')['data'];assert len(leap['items'])==366
 ok('UTC+7 half-open boundaries, paid_at independent from creation, day/month/year, presets and leap-year bounds')
 for ep,key in [('orders','statuses'),('products','products'),('categories','categories')]:assert admin.req('admin/reports/'+ep+'.php?'+q)['data']['items']==d[key]
 for typ in ['revenue','orders','products','inventory']:
  raw=admin.req('admin/reports/export.php?'+q+'&type='+typ+'&language=vi',csv_=True);text=raw.decode('utf-8-sig');rows=list(csv.reader(io.StringIO(text)));assert len(rows)>1 and '\ufffd' not in text and all(r[0]=='SIMULATED' for r in rows[1:])
  if typ=='revenue':assert 'COD đã thu (VND)' in rows[0] and sum(int(r[-1]) for r in rows[1:])==560000
  if typ=='orders':assert len(rows)==11 and sum(int(r[4]) for r in rows[1:])==3000000
  if typ in ['products','inventory']:
   assert '\'=HYPERLINK' in text and '\'+SIMULATED Novel' in text
   for row in rows[1:]:
    for cell in row:assert not cell.startswith(('=','+','@','-','\t','\r','\n')),repr(cell)
 raw=admin.req('admin/reports/export.php?'+q+'&type=revenue&language=en',csv_=True);assert b'collected_cod_vnd' in raw
 ok('all CSV types UTF-8 BOM/Excel, Vietnamese headers, exact integer money, same applied filters and formula escaping')
 after=snapshot();same_rows(before,after);ok('all 17 table row hashes unchanged after report and CSV reads')
 # Unit exercise formula hiding behind whitespace, control characters, BOM and ordinary text.
 php="require 'backend/src/reports_bootstrap.php'; foreach(['=1',' +1',chr(9).'@x',chr(239).chr(187).chr(191).'-1','Normal'] as $x) echo json_encode(report_csv_cell($x)),PHP_EOL;"
 r=subprocess.run([PHP,'-r',php],env=env,capture_output=True,text=True,encoding="utf-8",check=True);cells=[json.loads(v) for v in r.stdout.splitlines()];assert all(c.startswith("'") for c in cells[:4]) and cells[-1]=='Normal'
 ok('formula injection guard handles hidden prefixes including BOM without altering normal text')
 # Exact aggregate beyond JavaScript Number.MAX_SAFE_INTEGER, still returned/exported as decimal strings.
 code = """<?php require 'backend/src/Database.php';$p=Database::connect();if($p->query('SELECT DATABASE()')->fetchColumn()!=='manga_store_reports_test_20261122')throw new RuntimeException('Wrong DB');$u=$p->query("SELECT id FROM users WHERE email='reports-simulation@example.test'")->fetchColumn();$p->beginTransaction();try{for($i=0;$i<100;$i++){$s=$p->prepare("INSERT INTO orders(order_code,user_id,recipient_name,recipient_phone,province,ward,address_line,status,subtotal_vnd,total_vnd,created_at) VALUES(?,?,'SIMULATION','0900000000','SIMULATION','SIMULATION','SIMULATION','delivered',99999999999999,99999999999999,'2026-03-15 12:00:00')");$s->execute(['RPTSIM-PRECISION-'.$i,$u]);$id=$p->lastInsertId();$s=$p->prepare("INSERT INTO payments(order_id,method,status,amount_vnd,transaction_ref,paid_at) VALUES(?,'cod','paid',99999999999999,'SIMULATION-PRECISION','2026-03-15 12:00:00')");$s->execute([$id]);}$p->commit();}catch(Throwable $e){$p->rollBack();throw $e;}"""
 subprocess.run([PHP],input=code,text=True,encoding='utf-8',capture_output=True,env=env,check=True)
 precision='preset=custom&start=2026-03-01&end=2026-03-31'
 big=admin.req('admin/reports/overview.php?'+precision)['data']['overview'];assert big['collected_cod_vnd']=='9999999999999900' and big['created_order_value_vnd']=='9999999999999900'
 raw=admin.req('admin/reports/export.php?'+precision+'&type=revenue&group=month&language=en',csv_=True)
 assert b'9999999999999900' in raw and b'e+15' not in raw
 ok('decimal-string totals and CSV remain exact above JavaScript safe-integer limit')
 # Live read-only smoke: no credentials or test orders created on live.
 r=urllib.request.urlopen('http://localhost/manga-store/backend/public/api/products.php');assert len(json.loads(r.read())['data'])==23
 print('PASS existing live Products API still returns 23',flush=True)
finally:
 if seeded:cli('scripts/seed_reports_demo.php',args=('--cleanup',))
 for email in emails:cli('tests/auth_fixture.php',{'action':'delete','email':email})
 Path('frontend/.artifacts/reports-api.json').write_text(json.dumps({'checks':checks,'result':'PASS' if len(checks)==10 else 'INCOMPLETE'},indent=2),encoding='utf-8')
 print('Reports fixture cleaned in isolated DB; no live writes.',flush=True)
