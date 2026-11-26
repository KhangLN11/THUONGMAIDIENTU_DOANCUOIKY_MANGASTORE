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
for(const [i,email] of emails.entries()){assert(!JSON.parse(cli('tests/auth_fixture.php',{email,action:'inspect'})).exists);cli('scripts/admin_account.php',{action:'create',email,full_name:i===0?'Trần Minh Anh':'Nguyễn Khách Hàng Với Tên Dài Để Kiểm Tra Giao Diện Di Động',password});cli('tests/auth_fixture.php',{email,action:'demote'});}

cli('tests/account_fixture.php',{action:'seed',email:emails[0],nonce,count:18});
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
 const login=async n=>{await account();await waitFor("!!document.querySelector('.account-page form button[type=submit]:not(:disabled)')");await field('input[name=email]',emails[n]);await field('input[name=password]',password);await evaluate("document.querySelector('.account-page form').requestSubmit()");try{await waitFor(`document.querySelector('.account-layout aside h3')?.textContent==='${n===0?'Trần Minh Anh':'Nguyễn Khách Hàng Với Tên Dài Để Kiểm Tra Giao Diện Di Động'}'`);}catch(e){await screenshot('orders-login-diagnostic');console.log('Login diagnostic',await evaluate("({heading:document.querySelector('.account-layout aside h3')?.textContent,email:document.querySelector('[name=email]')?.value,passwordLength:document.querySelector('[name=password]')?.value.length,alerts:Array.from(document.querySelectorAll('.account-page [role=alert]')).map(n=>n.textContent),buttons:Array.from(document.querySelectorAll('.account-page form button')).map(n=>({text:n.textContent,disabled:n.disabled}))})"));throw e;}};
 const activeRequests=new Set();let lastNetwork=Date.now();socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Network.requestWillBeSent'&&m.params.request.url.includes('/api/')){activeRequests.add(m.params.requestId);lastNetwork=Date.now();}if(['Network.loadingFinished','Network.loadingFailed'].includes(m.method)&&activeRequests.delete(m.params.requestId))lastNetwork=Date.now();});
 const settled=async()=>{for(let i=0;i<100;i++){if(activeRequests.size===0&&Date.now()-lastNetwork>=250)return;await pause(50);}throw new Error('Background API did not settle before account switch');};
 const logout=async()=>{await account();await settled();await evaluate("Array.from(document.querySelectorAll('.account-page button')).find(b=>['SIGN OUT','LOG OUT','ĐĂNG XUẤT'].includes(b.textContent)&&b.getClientRects().length).click()");await waitFor("!!document.querySelector('.account-page form')");};
 const openCart=async()=>{await evaluate("document.querySelector('.cart-icon').click()");await waitFor("!!document.querySelector('.cart-page')");};
 const inspect=()=>JSON.parse(cli('tests/orders_fixture.php',{action:'inspect',email:emails[0],product_id:9}));

 const click=async selector=>evaluate('document.querySelector('+JSON.stringify(selector)+').click()');
 const hash=async h=>{await evaluate('location.hash='+JSON.stringify(h));await pause(100);};
 const read=()=>evaluate("fetch('/api/orders/index.php?view=account').then(r=>r.json()).then(r=>r.data)");
 const loaded=async()=>waitFor("document.querySelector('[data-account-metric=orders] b')?.textContent!=='…' && !!document.querySelector('[data-order-history]:not([aria-busy=true])')");
 const capture=async label=>{for(const width of [1440,900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await evaluate('scrollTo({top:0,behavior:"instant"})');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),label+' '+width);const metrics=await cdp('Page.getLayoutMetrics');const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:Math.ceil(metrics.cssContentSize.height),scale:1}});await writeFile(path.join(artifacts,'14-'+label+'-'+width+'.png'),Buffer.from(shot.data,'base64'));}};
 const stats=async()=>{const data=await read();const actual=await evaluate("Object.fromEntries(Array.from(document.querySelectorAll('[data-account-metric]')).map(n=>[n.dataset.accountMetric,Number(n.querySelector('b').textContent)]))");assert.equal(actual.orders,data.total_orders);assert.equal(actual.processing,data.counts.pending+data.counts.confirmed+data.counts.processing+data.counts.shipping);assert.equal(actual.delivered,data.counts.delivered);const wish=await evaluate("fetch('/api/wishlist.php').then(r=>r.json()).then(r=>r.data.product_ids.length)");assert.equal(actual.wishlist,wish);return data;};
 await login(0);await loaded();let data=await stats();assert.equal(data.total_orders,18);assert.equal(await evaluate("document.querySelector('.account-avatar').textContent"),'TM');assert((await evaluate("document.querySelector('.account-welcome').textContent")).includes(emails[0]));assert(!(await evaluate("document.querySelector('[data-customer-account]').textContent")).includes('MEMBER POINTS'));
 const initialStock=inspect().stock;
 const created=await evaluate(`(async()=>{const session=await(await fetch('/api/auth/me.php')).json();const q=await(await fetch('/api/orders/quote.php?mode=buy_now&product_id=9&quantity=1')).json();const key=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');const r=await fetch('/api/orders/create.php',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.meta.csrf_token},body:JSON.stringify({mode:'buy_now',product_id:9,quantity:1,idempotency_key:key,quote_fingerprint:q.data.quote_fingerprint,recipient_name:'Account Sandbox',recipient_phone:'0900000000',province:'Test City',district:null,ward:'Test Ward',address_line:'Test address',customer_note:'Account UI isolated test',payment_method:'bank_transfer'})});const result=await r.json();if(!r.ok)throw new Error(JSON.stringify(result));return result.data;})()`);
 await reload();await loaded();data=await stats();assert.equal(data.total_orders,19);await language('vi');await capture('account-overview-vi');
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await click('.account-pagination button:last-child');await waitFor("location.hash.includes('page=2') && !document.querySelector('[data-order-history]').getAttribute('aria-busy').includes('true')");assert.equal(await evaluate("document.querySelectorAll('.history-row').length"),9);await reload();await loaded();assert((await evaluate('location.hash')).includes('page=2'));await stats();
 await evaluate('history.back()');await waitFor("!location.hash.includes('page=2') && document.querySelectorAll('.history-row').length===10");await evaluate('history.forward()');await waitFor("location.hash.includes('page=2') && document.querySelectorAll('.history-row').length===9");
 await click('.account-sidebar nav button:nth-child(2)');await waitFor("location.hash==='#account/orders' && document.querySelectorAll('.history-row').length===10");await capture('orders-vi');
 await click('.history-filters button:nth-child(2)');await waitFor("location.hash.includes('status=pending') && document.querySelectorAll('.history-row').length===4");assert(await evaluate("Array.from(document.querySelectorAll('.history-row')).every(n=>n.dataset.orderStatus==='pending')"));await capture('pending-filter-vi');await click('.history-row button');await waitFor(`document.querySelector('[data-order-detail]')?.dataset.orderDetail==='${created.id}'`);assert((await evaluate("document.querySelector('[data-order-detail]').textContent")).includes('Account Sandbox'));assert(await evaluate("!!document.querySelector('[data-order-qr]')"));
 await reload();await waitFor(`document.querySelector('[data-order-detail]')?.dataset.orderDetail==='${created.id}'`);await capture('order-detail-vi');await click('[data-order-detail]>.checkout-button');await waitFor("!document.querySelector('[data-order-detail]') && document.querySelectorAll('.history-row').length===4");assert((await evaluate('location.hash')).includes('status=pending'));await click('.history-row button');await waitFor("!!document.querySelector('[data-order-detail] .ink-btn')");await click('[data-order-detail] .ink-btn');await waitFor("document.querySelector('[data-order-detail]')?.textContent.includes('Đã hủy')");assert.equal(inspect().stock,initialStock);const movements=JSON.parse(cli('tests/orders_fixture.php',{action:'inspect',email:emails[0],product_id:9,order_id:created.id})).movements;assert.equal(movements.length,2);assert(movements.every(m=>Number(m.n)===1));
 await click('[data-order-detail]>.checkout-button');await waitFor("document.querySelectorAll('.history-row').length===3");assert((await evaluate("document.querySelector('.history-filters button:nth-child(2)').textContent")).includes('(3)'));
 report.checks.push('actual auth/profile/initials; exact whole-account order/open/delivered/wishlist stats; no loyalty points; pagination/refresh/back-forward; status counts/filter; existing bank Sandbox Detail/QR; filter retained; real cancellation restocks once');
 await click('.account-sidebar nav button:nth-child(4)');await waitFor("!!document.querySelector('.account-information')");assert((await evaluate("document.querySelector('.account-information').textContent")).includes(emails[0]));assert.equal(await evaluate("document.querySelectorAll('.account-information input,.account-information button').length"),0);await capture('profile-vi');
 await click('.account-sidebar nav button:nth-child(3)');await waitFor("location.hash==='#wishlist' && document.querySelectorAll('.product-card').length===3");await click('.product-card .quick-actions button:last-child');await waitFor("document.querySelector('.cart-icon b')?.textContent==='1'");await click('.product-card .wish');await waitFor("document.querySelectorAll('.product-card').length===2");await evaluate('history.back()');await waitFor("!!document.querySelector('.account-information')");await click('.account-sidebar nav button');await loaded();await stats();assert.equal(await evaluate("Number(document.querySelector('[data-account-metric=wishlist] b').textContent)"),2);
 await language('en');assert((await evaluate("document.querySelector('.account-universe-hero h1').textContent")).includes('UNIVERSE'));await capture('account-overview-en');
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await evaluate("document.querySelector('.account-shop-cta button').scrollIntoView({block:'center',behavior:'instant'})");let box=await evaluate("(()=>{const r=document.querySelector('.account-shop-cta button').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...box});await pause(300);assert.equal(await evaluate("getComputedStyle(document.querySelector('.account-shop-cta button')).color"),'rgb(17, 17, 17)');await screenshot('14-cta-hover');
 await evaluate("document.querySelectorAll('.account-sidebar nav button')[1].focus()");await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter'});await waitFor("location.hash==='#account/orders'");await evaluate("document.querySelector('.history-filters button').focus()");await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});assert(await evaluate("document.activeElement.matches('button:focus-visible')"));await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter'});await waitFor("location.hash.includes('status=pending')");
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});await evaluate("document.querySelector('.account-sidebar nav button').scrollIntoView({block:'center',behavior:'instant'})");box=await evaluate("(()=>{const r=document.querySelector('.account-sidebar nav button').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[box]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await waitFor("location.hash==='#account'");
 await click('.account-sidebar nav button:last-child');await waitFor("!!document.querySelector('.account-page form')");assert.equal(await evaluate("document.querySelector('[name=email]').value"),'');assert(!(await evaluate('document.body.textContent')).includes(emails[0]));await login(1);await loaded();data=await stats();assert.equal(data.total_orders,0);assert.equal(await evaluate("document.querySelectorAll('.history-row').length"),0);assert(!(await evaluate('document.body.textContent')).includes(emails[0]));await capture('empty-account-long-name-en');
 await hash('#account/orders/'+created.id);await waitFor("document.querySelector('[data-order-history] [role=alert]')?.textContent.includes('not found')");assert.equal(await evaluate("!!document.querySelector('[data-order-detail]')"),false);await hash('#account');await loaded();await click('.account-sidebar nav button:nth-child(3)');await waitFor("location.hash==='#wishlist' && !!document.querySelector('.empty')");assert.equal(await evaluate("document.querySelectorAll('.product-card').length"),0);await evaluate('history.back()');await loaded();
 await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert(Number.parseFloat(await evaluate("getComputedStyle(document.querySelector('.account-button')).transitionDuration"))<.001);assert.equal(exceptions.length,0,JSON.stringify(exceptions));report.checks.push('read-only profile; existing Wishlist/cart actions and count refetch; VI/EN; hover/keyboard/touch; logout clears private name/email; account B empty/long name; owner denial; reduced motion and 1440/900/390 no overflow');report.result='PASS';report.viewports=[1440,900,390];report.exceptions=exceptions;await writeFile(path.join(artifacts,'14-account-browser.json'),JSON.stringify(report,null,2));console.log('PASS Account GUI, real counts/routes/orders/wishlist/isolation/cancel, VI/EN, 1440/900/390 and accessibility');
}finally{cli('tests/orders_fixture.php',{action:'cleanup',emails});if(socket)socket.close();browser.kill();}
