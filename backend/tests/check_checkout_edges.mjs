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
const configPath='C:/xampp/htdocs/manga-store-orders-test-20261120/manga-store/backend/config/payment.local.php';
const quotePath='C:/xampp/htdocs/manga-store-orders-test-20261120/manga-store/backend/public/api/orders/quote.php';const oldQuote=await readFile(quotePath);
const oldConfig=await readFile(configPath);await writeFile(configPath,"<?php return ['enabled'=>false];");
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
 const logout=async()=>{await account();await settled();await evaluate("Array.from(document.querySelectorAll('.account-page button')).find(b=>['SIGN OUT','LOG OUT','ĐĂNG XUẤT'].includes(b.textContent)&&b.getClientRects().length).click()");await waitFor("!!document.querySelector('.account-page form')");};
 const openCart=async()=>{await evaluate("document.querySelector('.cart-icon').click()");await waitFor("!!document.querySelector('.cart-page')");};
 const inspect=()=>JSON.parse(cli('tests/orders_fixture.php',{action:'inspect',email:emails[0],product_id:9}));

 await login(0);await navigate('shop');await waitFor("!!document.querySelector('.shop-grid')");await evaluate("document.querySelector('.shop-card-actions button').click()");await waitFor("!!document.querySelector('[data-checkout-api] form')");
 for(const [name,value] of Object.entries({recipient_name:'Draft Kept',recipient_phone:'0900000000',province:'City Test',ward:'Ward Test',address_line:'Memory-only address'}))await field('[name='+name+']',value);
 await evaluate("document.querySelector('[data-checkout-api] form').requestSubmit()");await waitFor("!!document.querySelector('[name=payment_choice]')");assert(await evaluate("document.querySelector('[value=bank_transfer]').disabled && document.querySelector('[value=vietqr]').disabled"));assert.equal(inspect().orders.length,0);assert.equal(await evaluate("document.querySelectorAll('.checkout-progress li').length"),3);
 for(const width of [1440,900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await screenshot('13-live-unconfigured-'+width);}
 await evaluate("document.querySelectorAll('.checkout-progress button')[2].click()");assert.equal(await evaluate("document.querySelector('.checkout-progress .current').textContent.includes('PAYMENT')"),true);assert.equal(inspect().orders.length,0);
 await cdp('Page.bringToFront');await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await evaluate("document.querySelector('.checkout-progress button').focus()");await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter'});await waitFor("!!document.querySelector('[name=recipient_name]')");assert.equal(await evaluate("document.querySelector('[name=recipient_name]').value"),'Draft Kept');await evaluate("document.querySelector('[name=recipient_phone]').focus()");await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});assert(await evaluate("document.activeElement.matches('input:focus-visible')"));
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});await evaluate("document.querySelector('form button[type=submit]').scrollIntoView({block:'center',behavior:'instant'})");const tap=await evaluate("(()=>{const r=document.querySelector('form button[type=submit]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[tap]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await waitFor("!!document.querySelector('[name=payment_choice]')");assert.equal(inspect().orders.length,0);
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await evaluate("document.querySelector('form button[type=submit]').scrollIntoView({block:'center',behavior:'instant'})");await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:2,y:2});await pause(250);await screenshot('13-cta-normal');const hover=await evaluate("(()=>{const r=document.querySelector('form button[type=submit]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...hover});await pause(300);assert.equal(await evaluate("getComputedStyle(document.querySelector('form button[type=submit]')).color"),'rgb(0, 0, 0)');await screenshot('13-cta-hover');
 await evaluate("fetch('/api/auth/me.php').then(r=>r.json()).then(r=>fetch('/api/auth/logout.php',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':r.meta.csrf_token},body:'{}'}))");
 await evaluate("document.querySelector('[data-checkout-api] form').requestSubmit()");await waitFor("document.querySelector('[data-checkout-api] [role=alert]')?.textContent.includes('sign in')");assert.equal(inspect().orders.length,0);await evaluate("document.querySelector('[data-checkout-api] [role=alert] button').click()");await waitFor("!!document.querySelector('.account-page form')");await field('[name=email]',emails[0]);await field('[name=password]',password);await evaluate("document.querySelector('.account-page form').requestSubmit()");await waitFor("document.querySelector('[name=recipient_name]')?.value==='Draft Kept'");assert.equal(await evaluate('location.hash'),'#checkout/buy-now/9');assert.equal(await evaluate("document.querySelector('[name=address_line]').value"),'Memory-only address');assert.equal(await evaluate("Object.values(sessionStorage).some(v=>v.includes('Memory-only address'))"),false);
 await evaluate("document.querySelector('.checkout-cancel').click()");await waitFor("!!document.querySelector('.shop-grid')");
 await cdp('Page.bringToFront');await writeFile(quotePath,oldQuote.toString().replace('declare(strict_types=1);','declare(strict_types=1);sleep(20);'));await evaluate("document.querySelector('.shop-card-actions button').click()");await waitFor("!!document.querySelector('[data-checkout-api] [role=status]')");await pause(15800);await waitFor("document.querySelector('[data-checkout-api] [role=alert]')?.textContent.includes('Connection lost')");await writeFile(quotePath,oldQuote);await evaluate("document.querySelector('[data-checkout-api] [role=alert] button').click()");await waitFor("!!document.querySelector('[name=recipient_name]')");assert.equal(inspect().orders.length,0);
 await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert(Number.parseFloat(await evaluate("getComputedStyle(document.querySelector('.checkout-button')).transitionDuration"))<=0.001);await screenshot('13-session-timeout-recovered');assert.equal(exceptions.length,0,JSON.stringify(exceptions));await writeFile(path.join(artifacts,'13-checkout-edge.json'),JSON.stringify({result:'PASS',liveBankDisabled:true,sessionExpired:true,memoryOnlyDraft:true,keyboard:true,touch:true,hover:true,quoteTimeoutRetry:true,noOrdersCreated:true,viewports:[1440,900,390],exceptions},null,2));console.log('PASS missing bank config, expired session/intent/private draft, 15s quote timeout/retry, reduced motion, no order creation');
}finally{await writeFile(quotePath,oldQuote);await writeFile(configPath,oldConfig);cli('tests/orders_fixture.php',{action:'cleanup',emails});if(socket)socket.close();browser.kill();}
