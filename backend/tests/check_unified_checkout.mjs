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



 const report={checks:[],viewports:[1440,900,390]};let lose=false;
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Fetch.requestPaused'){if(lose){lose=false;void cdp('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'Aborted'}).catch(()=>{});}else void cdp('Fetch.continueRequest',{requestId:m.params.requestId}).catch(()=>{});}});
 const field=async(selector,value)=>evaluate(`(()=>{const i=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const account=async()=>{await evaluate("window.location.hash='#account'");await waitFor("!!document.querySelector('.account-page')");};
 const login=async n=>{await account();await waitFor("!!document.querySelector('.account-page form button[type=submit]:not(:disabled)')");await field('input[name=email]',emails[n]);await field('input[name=password]',password);await evaluate("document.querySelector('.account-page form').requestSubmit()");try{await waitFor(`document.querySelector('.account-layout aside h3')?.textContent==='Order GUI ${n===0?'A':'B'}'`);}catch(e){await screenshot('orders-login-diagnostic');console.log('Login diagnostic',await evaluate("({heading:document.querySelector('.account-layout aside h3')?.textContent,email:document.querySelector('[name=email]')?.value,passwordLength:document.querySelector('[name=password]')?.value.length,alerts:Array.from(document.querySelectorAll('.account-page [role=alert]')).map(n=>n.textContent),buttons:Array.from(document.querySelectorAll('.account-page form button')).map(n=>({text:n.textContent,disabled:n.disabled}))})"));throw e;}};
 const activeRequests=new Set();let lastNetwork=Date.now();socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Network.requestWillBeSent'&&m.params.request.url.includes('/api/')){activeRequests.add(m.params.requestId);lastNetwork=Date.now();}if(['Network.loadingFinished','Network.loadingFailed'].includes(m.method)&&activeRequests.delete(m.params.requestId))lastNetwork=Date.now();});
 const settled=async()=>{for(let i=0;i<100;i++){if(activeRequests.size===0&&Date.now()-lastNetwork>=250)return;await pause(50);}throw new Error('Background API did not settle before account switch');};
 const logout=async()=>{await account();await settled();await evaluate("Array.from(document.querySelectorAll('.account-page button')).find(b=>['SIGN OUT','LOG OUT','ĐĂNG XUẤT'].includes(b.textContent)&&b.getClientRects().length).click()");await waitFor("!!document.querySelector('.account-page form')");};
 const openCart=async()=>{await evaluate("document.querySelector('.cart-icon').click()");await waitFor("!!document.querySelector('.cart-page')");};
 const inspect=()=>JSON.parse(cli('tests/orders_fixture.php',{action:'inspect',email:emails[0],product_id:9}));
 const fill=async()=>{await waitFor("!!document.querySelector('[data-checkout-api] form')");for(const [name,value] of Object.entries({recipient_name:'Nguyễn Khách Demo',recipient_phone:'0900000000',province:'Thành phố Demo',ward:'Phường Demo',address_line:'123 Đường Demo',customer_note:'COD GUI test'}))await field(`[data-checkout-api] input[name=${name}]`,value);};

 const hash=async h=>{await evaluate('location.hash='+JSON.stringify(h));await pause(180);};
 const noOverflow=async()=>assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'horizontal overflow');
 await navigate('shop');await waitFor("document.querySelectorAll('.shop-grid .product-card').length===23");
 await evaluate("document.querySelectorAll('.shop-grid .shop-card-actions button')[3].click()");await waitFor("document.querySelector('.cart-icon b')?.textContent==='1'");
 await evaluate("document.querySelector('.shop-grid .shop-card-actions button').click()");await waitFor("!!document.querySelector('.account-page form')");
 assert.equal(await evaluate("JSON.parse(sessionStorage.getItem('manga-buy-now-api')).productId"),9);
 await field('input[name=email]',emails[0]);await field('input[name=password]',password);await evaluate("document.querySelector('.account-page form').requestSubmit()");
 await fill();await waitFor("document.querySelectorAll('[data-checkout-api] .checkout-item').length===1");
 assert.equal(await evaluate('location.hash'),'#checkout/buy-now/9');
 assert((await evaluate("document.querySelector('.checkout-item').textContent")).includes('Attack on Titan'));
 assert.equal(await evaluate("document.querySelector('.checkout-total b').textContent"),new Intl.NumberFormat('en-US',{style:'currency',currency:'VND'}).format(250000));
 const cartRead=()=>evaluate("fetch('/api/cart.php').then(r=>r.json()).then(r=>r.data.items.map(i=>({id:i.id,product_id:i.product_id,quantity:i.quantity})))");
 const retained=await cartRead();assert.equal(retained.length,1);assert.equal(retained[0].product_id,10);
 for(const width of [1440,900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await noOverflow();await screenshot('12c-buy-checkout-'+width+'-en');}
 await evaluate("window.__reload12c=true");await cdp('Page.reload');await waitFor("!window.__reload12c && !!document.querySelector('[data-checkout-api] form')");assert.equal(await evaluate('location.hash'),'#checkout/buy-now/9');assert.deepEqual(await cartRead(),retained);
 await evaluate("document.querySelector('.buy-now-cancel').click()");await waitFor("!!document.querySelector('.shop-grid')");assert.equal(await evaluate("document.querySelector('.cart-icon b')?.textContent"),'1');
 report.checks.push('guest Buy Now -> login -> automatic resume; one item; server shipping/total; reload; cancel preserves guest/account cart; shared form at all widths');
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 for(const [label,h,selector] of [['series','#series/one-piece','.discovery-product-item .product-card'],['figures','#collections','[data-figure-collections] .product-card'],['related','#product/9','.related .product-card'],['home','#home','.new-section .product-card']]){
 await hash(h);const sel=label==='home'?'.product-card':selector;await waitFor('!!document.querySelector('+JSON.stringify(sel)+')');
 assert.equal(await evaluate('document.querySelectorAll(".discovery-card-actions").length'),0);
 const labels=await evaluate('Array.from(document.querySelector('+JSON.stringify(sel)+').querySelectorAll(".quick-actions button")).map(b=>b.textContent.trim())');assert.deepEqual(labels,['BUY NOW','ADD TO CART']);
 await evaluate('document.querySelector('+JSON.stringify(sel)+').scrollIntoView({block:"center",behavior:"instant"})');
 const box=await evaluate('(()=>{const r=document.querySelector('+JSON.stringify(sel)+').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+90}})()');await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...box});await pause(400);await screenshot('12c-'+label+'-hover');
 await evaluate('document.querySelector('+JSON.stringify(sel)+').querySelector(".shop-image-open").focus()');assert.equal(await evaluate('getComputedStyle(document.querySelector('+JSON.stringify(sel)+').querySelector(".quick-actions")).transform'),'matrix(1, 0, 0, 1, 0, 0)');
 await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});
 await evaluate('document.querySelector('+JSON.stringify(sel)+').querySelector(".quick-actions button").click()');await fill();assert.equal(await evaluate("document.querySelectorAll('[data-checkout-api] .checkout-item').length"),1);assert.deepEqual(await cartRead(),retained);
 await evaluate("document.querySelector('.buy-now-cancel').click()");await waitFor("!!document.querySelector('.shop-grid')");
 }
 report.checks.push('Series/Figure/Related/Home action pair, no duplicate bar, hover/focus, Buy Now routes to one-item real checkout without cart mutation');
 await hash('#product/9');await waitFor("!!document.querySelector('.product-info .qty')");await evaluate("document.querySelectorAll('.qty button')[1].click()");await pause(60);await evaluate("document.querySelectorAll('.qty button')[1].click()");await pause(60);await evaluate("document.querySelector('.product-info .buy').click()");await fill();
 assert.equal(await evaluate("JSON.parse(sessionStorage.getItem('manga-buy-now-api')).quantity"),3);
 assert((await evaluate("document.querySelector('.checkout-item small').textContent")).includes('3'));
 assert.equal(await evaluate("document.querySelector('.checkout-total b').textContent"),new Intl.NumberFormat('en-US',{style:'currency',currency:'VND'}).format(690000));
 const oldStock=inspect().stock;const cartWriteStart=requests.filter(u=>/cart\/(add|update|remove|clear|merge)\.php/.test(u)).length;
 lose=true;await cdp('Fetch.enable',{patterns:[{urlPattern:'*orders/create.php*',requestStage:'Response'}]});await evaluate("document.querySelector('[data-checkout-api] form').requestSubmit();document.querySelector('[data-checkout-api] form').requestSubmit()");await waitFor("!!document.querySelector('[data-checkout-api] [role=alert]')");assert.equal(inspect().stock,oldStock-3);
 await cdp('Fetch.disable');const posts=requests.filter(u=>u.includes('orders/create.php')).length;await evaluate('window.__recover12c=true');await cdp('Page.reload');await waitFor("!window.__recover12c && !!document.querySelector('[data-order-code]')");assert.equal(requests.filter(u=>u.includes('orders/create.php')).length,posts);assert.equal(inspect().stock,oldStock-3);assert.deepEqual(await cartRead(),retained);
 assert.equal(requests.filter(u=>/cart\/(add|update|remove|clear|merge)\.php/.test(u)).length,cartWriteStart);assert.equal(inspect().orders.length,1);
 assert((await evaluate("document.querySelector('[data-order-code]').textContent")).includes('unpaid'));
 assert.equal(await evaluate("sessionStorage.getItem('manga-buy-now-api')"),null);await screenshot('12c-buy-success-recovered');await evaluate("document.querySelector('[data-order-code] button').click()");await waitFor("!!document.querySelector('[data-order-history] .order button')");assert.equal(await evaluate("document.querySelector('.cart-icon b')?.textContent"),'1');
 await evaluate("document.querySelector('[data-order-history] .order button').click()");await waitFor("!!document.querySelector('[data-order-detail]')");assert((await evaluate("document.querySelector('[data-order-detail]').textContent")).includes('Nguyễn Khách Demo'));await screenshot('12c-buy-order-detail');
 await evaluate("document.querySelector('[data-order-detail] .ink-btn').click()");await waitFor("document.querySelector('[data-order-detail]')?.textContent.includes('Cancelled')");assert.equal(inspect().stock,oldStock);assert.deepEqual(await cartRead(),retained);
 report.checks.push('PDP quantity3; committed Buy Now with lost response; reload recovery no extra POST/deduction; cart badge/rows unchanged; COD unpaid; history/address snapshot; cancellation restock');
 await language('vi');await hash('#collections');await waitFor("!!document.querySelector('[data-figure-collections] .product-card')");await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});
 await evaluate("document.querySelector('[data-figure-collections] .product-card').scrollIntoView({block:'center',behavior:'instant'})");await pause(400);await noOverflow();
 assert.deepEqual(await evaluate("Array.from(document.querySelector('[data-figure-collections] .quick-actions').children).map(b=>b.textContent.trim())"),['MUA NGAY','THÊM VÀO GIỎ']);
 const touch=await evaluate("(()=>{const r=document.querySelector('[data-figure-collections] .quick-actions button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await fill();await noOverflow();await screenshot('12c-buy-checkout-390-vi');
 await evaluate("document.querySelector('.buy-now-cancel').click()");await waitFor("!!document.querySelector('.shop-grid')");assert.deepEqual(await cartRead(),retained);
 report.checks.push('VI actions/form, mobile real touch Buy Now, no hover requirement/overflow');
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await language('en');await hash('#series/one-piece');await waitFor("!!document.querySelector('.discovery-product-item .quick-actions button')");
 await evaluate("document.querySelector('.discovery-product-item .quick-actions button').focus()");await pause(350);await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter'});await fill();
 await evaluate("document.querySelector('.buy-now-cancel').click()");await waitFor("!!document.querySelector('.shop-grid')");await hash('#collections');await waitFor("!!document.querySelector('[data-figure-collections] .product-card')");
 const beforeHash=await evaluate('location.hash');await evaluate("document.querySelector('[data-figure-collections] .wish').click()");await pause(350);assert.equal(await evaluate('location.hash'),beforeHash);
 await evaluate("document.querySelector('[data-figure-collections] .quick-actions button:last-child').click()");await waitFor("document.querySelector('.cart-icon b')?.textContent==='2'");assert.equal(await evaluate('location.hash'),beforeHash);
 await evaluate("document.querySelector('[data-figure-collections] .shop-product-name').click()");await waitFor("!!document.querySelector('[data-product-id]')");
 report.checks.push('keyboard Enter activates Buy Now; Wishlist/Add events do not open Detail/Checkout; name opens correct Detail');

 assert.equal(exceptions.length,0,JSON.stringify(exceptions));report.result='PASS';report.exceptions=exceptions;
 await writeFile(path.join(artifacts,'12c-unified-browser.json'),JSON.stringify(report,null,2));console.log('PASS 12C unified real Checkout, origins, guest/login, quantity, lost response/reload, unchanged cart, history/cancel, responsive VI/EN');
}finally{cli('tests/orders_fixture.php',{action:'cleanup',emails});if(socket)socket.close();browser.kill();}
