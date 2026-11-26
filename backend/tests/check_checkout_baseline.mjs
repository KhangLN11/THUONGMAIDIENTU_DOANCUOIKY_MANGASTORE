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
const nonce=randomBytes(6).toString('hex');const emails=['auth-test-'+nonce+'@example.test','auth-test-'+nonce+'-other@example.test'];const password=randomBytes(24).toString('base64url');
function cli(script,input){const r=spawnSync('C:/xampp/php/php.exe',['backend/'+script],{input:JSON.stringify(input),encoding:'utf8',env:{...process.env,DB_NAME:'manga_store_orders_test_20261120'},windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout;}
for(const [i,email] of emails.entries()){assert(!JSON.parse(cli('tests/auth_fixture.php',{email,action:'inspect'})).exists);cli('scripts/admin_account.php',{action:'create',email,full_name:'Order GUI '+(i===0?'A':'B'),password});cli('tests/auth_fixture.php',{email,action:'demote'});}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
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
    await waitFor("!window.__testReload && !!document.querySelector('.site-header,[data-checkout-api]')");
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



 const report={checks:[],viewports:[1440,390]};let lose=false;
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Fetch.requestPaused'){if(lose){lose=false;void cdp('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'Aborted'}).catch(()=>{});}else void cdp('Fetch.continueRequest',{requestId:m.params.requestId}).catch(()=>{});}});
 const field=async(selector,value)=>evaluate(`(()=>{const i=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const account=async()=>{await evaluate("window.location.hash='#account'");await waitFor("!!document.querySelector('.account-page')");};
 const login=async n=>{await account();await waitFor("!!document.querySelector('.account-page form button[type=submit]:not(:disabled)')");await field('input[name=email]',emails[n]);await field('input[name=password]',password);await evaluate("document.querySelector('.account-page form').requestSubmit()");try{await waitFor(`document.querySelector('.account-layout aside h3')?.textContent==='Order GUI ${n===0?'A':'B'}'`);}catch(e){await screenshot('orders-login-diagnostic');console.log('Login diagnostic',await evaluate("({heading:document.querySelector('.account-layout aside h3')?.textContent,email:document.querySelector('[name=email]')?.value,passwordLength:document.querySelector('[name=password]')?.value.length,alerts:Array.from(document.querySelectorAll('.account-page [role=alert]')).map(n=>n.textContent),buttons:Array.from(document.querySelectorAll('.account-page form button')).map(n=>({text:n.textContent,disabled:n.disabled}))})"));throw e;}};
 const activeRequests=new Set();let lastNetwork=Date.now();socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Network.requestWillBeSent'&&m.params.request.url.includes('/api/')){activeRequests.add(m.params.requestId);lastNetwork=Date.now();}if(['Network.loadingFinished','Network.loadingFailed'].includes(m.method)&&activeRequests.delete(m.params.requestId))lastNetwork=Date.now();});
 const settled=async()=>{for(let i=0;i<100;i++){if(activeRequests.size===0&&Date.now()-lastNetwork>=250)return;await pause(50);}throw new Error('Background API did not settle before account switch');};
 const logout=async()=>{await account();await settled();await evaluate("Array.from(document.querySelectorAll('.account-page button')).find(b=>['SIGN OUT','ĐĂNG XUẤT'].includes(b.textContent)&&b.getClientRects().length).click()");await waitFor("!!document.querySelector('.account-page form')");};
 const openCart=async()=>{await evaluate("document.querySelector('.cart-icon').click()");await waitFor("!!document.querySelector('.cart-page')");};
 const inspect=()=>JSON.parse(cli('tests/orders_fixture.php',{action:'inspect',email:emails[0],product_id:9}));
 const fill=async()=>{await waitFor("!!document.querySelector('[data-checkout-api] form')");for(const [name,value] of Object.entries({recipient_name:'Nguyễn Khách Demo',recipient_phone:'0900000000',province:'Thành phố Demo',ward:'Phường Demo',address_line:'123 Đường Demo',customer_note:'COD GUI test'}))await field(`[data-checkout-api] input[name=${name}]`,value);};

 await login(0);await navigate('shop');await waitFor("document.querySelectorAll('.shop-grid .product-card').length===23");await evaluate("document.querySelector('.shop-grid .shop-card-actions button:last-child').click()");await waitFor("document.querySelector('.cart-icon b')?.textContent==='1'");await openCart();await evaluate("document.querySelector('.summary .ink-btn').click()");await fill();
 for(const width of [1440,900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await screenshot('13-before-checkout-'+width);}
 console.log('PASS Phase13 baseline checkout screenshots');
}finally{cli('tests/orders_fixture.php',{action:'cleanup',emails});if(socket)socket.close();browser.kill();}
