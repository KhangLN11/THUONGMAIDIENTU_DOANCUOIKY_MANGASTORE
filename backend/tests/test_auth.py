"""Actual XAMPP/MySQL integration; only generated auth-test-...@example.test accounts are deleted."""
import json, secrets, subprocess, urllib.request, urllib.error, http.cookiejar
from pathlib import Path
PHP='C:/xampp/php/php.exe'
BASE='http://localhost/manga-store/backend/public/api/'
nonce=secrets.token_hex(6)
email=f'auth-test-{nonce}@example.test'
admin=f'auth-test-{nonce}-admin@example.test'
password=secrets.token_urlsafe(24)
report={'checks':[]}
def fixture(email,action='inspect',**kwargs):
 result=subprocess.run([PHP,'backend/tests/auth_fixture.php'],input=json.dumps(dict(email=email,action=action,**kwargs)),text=True,capture_output=True,check=True)
 return json.loads(result.stdout)
def cli(input):
 return subprocess.run([PHP,'backend/scripts/admin_account.php'],input=json.dumps(input),text=True,capture_output=True,check=True)
class Client:
 def __init__(self,base=BASE):
  self.base=base;self.jar=http.cookiejar.CookieJar();self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar));self.csrf=''
 def request(self,path,status,body=None,method=None,csrf=True):
  headers={'Accept':'application/json'}
  if body is not None:
   headers['Content-Type']='application/json'
   if csrf:headers['X-CSRF-Token']=self.csrf
  request=urllib.request.Request(self.base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
  try:r=self.opener.open(request,timeout=15)
  except urllib.error.HTTPError as e:r=e
  raw=r.read().decode();assert r.status==status,(path,r.status,raw)
  assert r.headers.get_content_type()=='application/json'
  data=json.loads(raw)
  assert 'password_hash' not in raw and 'SQLSTATE' not in raw and 'DB_PASSWORD' not in raw
  token=data.get('meta',{}).get('csrf_token')
  if isinstance(token,str):self.csrf=token
  return data,r.headers
 def sid(self):return next((x.value for x in self.jar if x.name=='MANGA_STORE_SESSION'),None)
def passed(name):report['checks'].append(name);print('PASS',name)
assert not fixture(email)["exists"] and not fixture(admin)["exists"], "Generated test identity already exists"
try:
 c=Client();payload,headers=c.request('auth/me.php',401);assert payload['error']['code']=='UNAUTHENTICATED' and len(c.csrf)==64
 cookie=headers.get('Set-Cookie','');assert 'HttpOnly' in cookie and 'SameSite=Lax' in cookie and 'path=/' in cookie
 passed('guest 401; CSRF bootstrap; HttpOnly/SameSite=Lax/path=/ cookie')
 c.request('auth/register.php',403,{'full_name':'Auth Tester','email':email,'password':password},csrf=False)
 c.request('auth/register.php',400,{'full_name':'Auth Tester','email':email,'password':password,'role':'admin'})
 assert not fixture(email)['exists'];passed('CSRF enforced; public admin registration rejected without insert')
 c.request('auth/register.php',422,{'full_name':'Auth Tester','email':'invalid','password':password})
 c.request('auth/register.php',422,{'full_name':'Auth Tester','email':email,'password':'short'})
 c.request('auth/register.php',422,{'full_name':'X','email':email,'password':password})
 passed('invalid email/name/short password rejected')
 data,_=c.request('auth/register.php',201,{'full_name':'Người Dùng Thử','email':email.upper(),'password':password})
 assert data['data']['role']=='user' and data['data']['email']==email
 inspect=fixture(email,password=password);assert inspect['role']=='customer' and inspect['hashed'] and inspect['password_valid']
 c.request('auth/me.php',401);passed('registration 201; DB customer maps to user; password hash verified; explicit login required')
 c.request('auth/register.php',409,{'full_name':'Auth Tester','email':email,'password':password});passed('duplicate email 409')
 c.request('auth/login.php',401,{'email':email,'password':'incorrect'});passed('wrong password 401')
 old_sid=c.sid();data,_=c.request('auth/login.php',200,{'email':email,'password':password});assert c.sid()!=old_sid
 assert data['data']['full_name']=='Người Dùng Thử';passed('login 200; Vietnamese name; session ID regenerated')
 c.request('auth/me.php',200);c.request('admin/access.php',403);passed('session persists; user denied admin API')
 cli({'action':'promote','email':email,'confirm_email':email})
 data,_=c.request('auth/me.php',200);assert data['data']['role']=='admin';c.request('admin/access.php',200)
 fixture(email,'demote');c.request('admin/access.php',403);passed('CLI promotion; admin allowed; demotion rechecked server-side immediately')
 fixture(email,'block');c.request('auth/me.php',401);fixture(email,'unblock')
 c.request('auth/me.php',401);passed('blocked account invalidates session; unblocking does not restore old authentication')
 c.request('auth/login.php',200,{'email':email,'password':password});sid=c.sid()
 c.request('auth/logout.php',403,{},csrf=False)
 _,headers=c.request('auth/logout.php',200,{});assert c.sid() is None
 c.request('auth/me.php',401)
 forged=Client();forged.opener.addheaders=[('Cookie','MANGA_STORE_SESSION='+sid)];forged.request('auth/me.php',401)
 fake=Client();fake.opener.addheaders=[('Cookie','MANGA_STORE_SESSION=attacker-selected-invalid-session')];fake.request('auth/me.php',401)
 assert fake.sid()!='attacker-selected-invalid-session'
 passed('logout CSRF; cookie removed; old/forged sessions rejected')
 cli({'action':'create','email':admin,'full_name':'CLI Demo Admin','password':password})
 a=Client();a.request('auth/me.php',401);a.request('auth/login.php',200,{'email':admin,'password':password});a.request('admin/access.php',200);a.request('auth/logout.php',200,{})
 passed('CLI admin creation with random runtime password; admin login/guard/logout')
 # Fresh sessions cannot bypass the shared email throttle.
 throttle=f'auth-test-{nonce}-missing@example.test'
 for _ in range(5):
  r=Client();r.request('auth/me.php',401);r.request('auth/login.php',401,{'email':throttle,'password':'incorrect'})
 r=Client();r.request('auth/me.php',401);data,headers=r.request('auth/login.php',429,{'email':throttle,'password':'incorrect'});assert int(headers['Retry-After'])>0
 passed('server-wide email login limit across fresh cookies; 429 Retry-After')
 c.request('auth/login.php',405);c.request('auth/logout.php',405)
 proxy=Client('http://localhost:8443/api/');proxy.request('auth/me.php',401);proxy.request('auth/login.php',200,{'email':email,'password':password});proxy.request('auth/me.php',200);proxy.request('auth/logout.php',200,{})
 data,_=c.request('products.php',200);assert len(data['data'])==23
 passed('method guards; Vite proxy session/CSRF; product API 23 intact')
 report['result']='PASS'
finally:
 report['cleanup']={email:fixture(email,'delete')['deleted'],admin:fixture(admin,'delete')['deleted']}
 assert not fixture(email)['exists'] and not fixture(admin)['exists']
 Path('frontend/.artifacts/auth-api.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print('Temporary auth test accounts removed.')
