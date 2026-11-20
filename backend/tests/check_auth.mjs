import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '../../frontend');
const artifacts = path.join(root, '.artifacts');
await mkdir(artifacts, { recursive: true });
const profile = await mkdtemp(path.join(tmpdir(), 'manga-browser-'));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9229', '--remote-allow-origins=*', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
const email='auth-test-'+randomBytes(6).toString('hex')+'@example.test';
// Eight random CJK characters = 24 UTF-8 bytes; exercises byte-based password validation.
const password=String.fromCodePoint(...Array.from(randomBytes(8),n=>0x4e00+n));
const fixture=(action)=>{const r=spawnSync('C:/xampp/php/php.exe',['backend/tests/auth_fixture.php'],{input:JSON.stringify({action,email,password}),encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
assert.equal(fixture('inspect').exists,false,'Generated test identity already exists');
try {
  let target;
  for (let attempt = 0; attempt < 80; attempt++) {
    try { target = await (await fetch('http://127.0.0.1:9229/json/new?about:blank', { method: 'PUT' })).json(); break; } catch { await pause(200); }
  }
  assert(target, 'Chrome CDP unavailable');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, {once:true}); socket.addEventListener('error', reject, {once:true}); });
  let sequence = 0;
  const pending = new Map();
  const exceptions = [];
  const consoleErrors = [];
  const requests = [];
  const failures = [];
  const requestIds = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) { const job = pending.get(message.id); pending.delete(message.id); message.error ? job.reject(message.error) : job.resolve(message.result); }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') consoleErrors.push(message.params.args);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    if (message.method === 'Network.requestWillBeSent') { requests.push(message.params.request.url); requestIds.set(message.params.requestId,message.params.request.url); }
    if (message.method === 'Network.loadingFailed') failures.push({url:requestIds.get(message.params.requestId),error:message.params.errorText});
  });
  const cdp = (method, params={}) => new Promise((resolve,reject) => { const id=++sequence; pending.set(id,{resolve,reject}); socket.send(JSON.stringify({id,method,params})); });
  const evaluate = async expression => { const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  const waitFor = async expression => { for(let i=0;i<100;i++){ if(await evaluate(expression)) return; await pause(100); } throw new Error('Timeout: '+expression); };
  const reload = async () => {
    await evaluate('window.__testReload = true');
    await cdp('Page.reload');
    await waitFor("!window.__testReload && document.querySelectorAll('.site-header nav button').length >= 2");
  };
  const language = async value => { await evaluate(`document.querySelectorAll('.language-switcher button')[${value==='vi'?0:1}].click()`); await pause(150); };
  const navigate = async page => { await evaluate(`document.querySelectorAll('.site-header nav button')[${page==='shop'?1:0}].click()`); await pause(150); };
  const screenshot = async name => { await pause(300); const r=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}); await writeFile(path.join(artifacts,name+'.png'),Buffer.from(r.data,'base64')); };
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await cdp('Page.navigate',{url:'http://localhost:8443/'});
  await waitFor("!!document.querySelector('.site-header')");
  await language('en');
  await evaluate('document.fonts.ready.then(()=>true)');
  await pause(500);



  const report={checks:[],screenshots:[],exceptions:[],consoleErrors:[]};
  const account=async()=>{await evaluate("document.querySelector('.header-actions button[aria-label=\"Account\"],.header-actions button[aria-label=\"Tài khoản\"]').click()");await waitFor("!!document.querySelector('.account-page')");};
  const setField=async(name,value)=>{await evaluate(`(() => {const i=document.querySelector('.account-page input[name="${name}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`);};
  const submit=()=>evaluate("document.querySelector('.account-page form').requestSubmit()");
  const visibleClick=async(text)=>{
    await evaluate(`(() => {const b=Array.from(document.querySelectorAll('.account-layout section button')).find(b=>b.textContent===${JSON.stringify(text)}&&b.getClientRects().length);if(!b)throw new Error('Visible button missing');b.scrollIntoView({block:'center'});})()`);
    await pause(650);
    const r=await evaluate(`(() => {const b=Array.from(document.querySelectorAll('.account-layout section button')).find(b=>b.textContent===${JSON.stringify(text)}&&b.getClientRects().length);const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...r});
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...r});
  };

  await waitFor("document.querySelectorAll('.arrivals .product-card').length===4");
  await account();await waitFor("!!document.querySelector('.account-page form')");
  await screenshot('auth-login-desktop');
  await evaluate("Array.from(document.querySelectorAll('.account-layout aside button')).find(b=>b.textContent==='CREATE ACCOUNT').click()");
  await setField('full_name','Người Dùng GUI');await setField('email',email);await setField('password','short');
  await submit();
  await waitFor("document.querySelector('.account-page [role=alert]')?.textContent.includes('Password must be 12')");
  assert.equal(fixture('inspect').exists,false);
  await setField('password',password);await submit();
  await waitFor("document.querySelector('[role=status]')?.textContent==='Account created. Please sign in.'");
  const inspected=fixture('inspect');assert(inspected.hashed&&inspected.password_valid&&inspected.role==='customer');
  report.checks.push('UI registration; validation; password hash; default user role');
  await setField('password','wrong-password');await submit();
  await waitFor("document.querySelector('.account-page [role=alert]')?.textContent.includes('Email or password is incorrect')");
  await language('vi');assert((await evaluate("document.querySelector('.account-page [role=alert]').textContent")).includes('Email hoặc mật khẩu'));
  await language('en');
  await setField('password',password);await submit();
  await waitFor(`document.querySelector('.account-layout aside h3')?.textContent==='Người Dùng GUI' && !document.querySelector('.account-page form')`);
  assert.equal(await evaluate("fetch('/api/admin/access.php').then(r=>r.status)"),403);
  assert.equal(await evaluate("Array.from(document.querySelectorAll('.account-layout aside button')).filter(b=>b.textContent==='ADMIN ACCESS').length"),0);
  await screenshot('auth-user-desktop');
  const cookies=(await cdp('Network.getCookies')).cookies;
  const session=cookies.find(c=>c.name==='MANGA_STORE_SESSION');assert(session?.httpOnly&&session.sameSite==='Lax'&&session.path==='/');
  assert(await evaluate("Object.keys(localStorage).every(k=>!/auth|token|session|password/i.test(k)) && Object.keys(sessionStorage).every(k=>!/auth|token|session|password/i.test(k))"));
  report.cookie={httpOnly:session.httpOnly,sameSite:session.sameSite,secure:session.secure,path:session.path};
  await reload();await language('en');await account();
  await waitFor("document.querySelector('.account-layout aside h3')?.textContent==='Người Dùng GUI'");
  await language('vi');assert((await evaluate("document.querySelector('.account-layout section').textContent")).includes('NGƯỜI DÙNG'));
  await language('en');
  report.checks.push('wrong password localized VI/EN; user denied admin; no auth storage; session persists on reload');
  const promoted=spawnSync('C:/xampp/php/php.exe',['backend/scripts/admin_account.php'],{input:JSON.stringify({action:'promote',email,confirm_email:email}),encoding:'utf8',windowsHide:true});assert.equal(promoted.status,0,promoted.stderr);
  await reload();await language('en');await account();
  await waitFor("Array.from(document.querySelectorAll('.account-layout aside button')).some(b=>b.textContent==='ADMIN ACCESS')");
  await evaluate("Array.from(document.querySelectorAll('.account-layout aside button')).find(b=>b.textContent==='ADMIN ACCESS').click()");
  await waitFor("Array.from(document.querySelectorAll('.account-page [role=status]')).some(e=>e.textContent.includes('Admin access verified by the server'))");
  await screenshot('auth-admin-desktop');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await screenshot('auth-admin-mobile');
  await visibleClick('SIGN OUT');
  await waitFor("!!document.querySelector('.account-page form')");
  assert(!(await cdp('Network.getCookies')).cookies.some(c=>c.name==='MANGA_STORE_SESSION'));
  await screenshot('auth-login-mobile');
  await language('vi');assert((await evaluate("document.querySelector('.account-page h2').textContent")).includes('ĐĂNG NHẬP'));
  await visibleClick('ĐĂNG KÝ');
  await waitFor("!!document.querySelector('.account-page input[name=full_name]')");
  await screenshot('auth-register-mobile');
  await reload();
  await waitFor("!!document.querySelector('.account-page form')");
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  report.checks.push('admin gate verified by PHP; logout clears cookie; mobile forms and account; VI/EN');
  const live=await(await fetch('http://localhost:8443/api/products.php')).json();assert.equal(live.data.length,23);
  assert.equal(exceptions.length,0,JSON.stringify(exceptions));assert.equal(consoleErrors.length,0,JSON.stringify(consoleErrors));
  report.exceptions=exceptions;report.consoleErrors=consoleErrors;report.productCount=23;report.result='PASS';
  await writeFile(path.join(artifacts,'auth-browser.json'),JSON.stringify(report,null,2));
  console.log('PASS actual auth GUI: registration/login/validation/VI-EN/refresh/admin/logout, desktop/mobile, no JS exceptions or console.error');
} finally {
  fixture('delete');
  if(socket)socket.close();browser.kill();
}
