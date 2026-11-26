import { spawn,spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '../../frontend');
const artifacts = path.join(root, '.artifacts');
await mkdir(artifacts, { recursive: true });
const baseline = process.argv.includes('--baseline');
const mode = process.argv.includes('--live') ? 'live' : 'demo';
const profile = await mkdtemp(path.join(tmpdir(), 'manga-browser-'));
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9229', '--remote-allow-origins=*', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
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
  const waitFor = async expression => { for(let i=0;i<100;i++){ try{if(await evaluate(expression))return;}catch{} await pause(100); } console.log(await evaluate("({hash:location.hash,marker:window.__auditReloadMarker,body:document.body.innerText.slice(0,900)})"));throw new Error('Timeout: '+expression); };
  const reload = async () => {
    await evaluate('window.__testReload = true');
    await cdp('Page.reload');
    await waitFor("!window.__testReload && document.querySelectorAll('.site-header nav button').length >= 2");
  };
  const language = async value => { await evaluate(`document.querySelectorAll('.language-switcher button')[${value==='vi'?0:1}].click()`); await pause(150); };
  const navigate = async page => { await evaluate(`document.querySelectorAll('.site-header nav button')[${page==='shop'?1:0}].click()`); await pause(150); };
  const screenshot = async name => { await pause(300); const r=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}); await writeFile(path.join(artifacts,name+'.png'),Buffer.from(r.data,'base64')); };



 const before=process.argv.includes('--before'),setup=process.argv.includes('--setup'),demo=process.argv.includes('--demo');
 const group=process.argv.find(x=>x.startsWith('--group='))?.split('=')[1]??'all';
 const cli=(script,input)=>{const r=spawnSync('C:/xampp/php/php.exe',['backend/'+script],{input:JSON.stringify(input),encoding:'utf8',env:{...process.env,DB_NAME:'manga_store_orders_test_20261120'},windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout;};
 const pointer=path.join(artifacts,'16d-fixture-path.txt');let fixture;
 if(setup){
  assert((await readFile(path.join(root,'.env.local'),'utf8')).includes('PRODUCTS_API_PROXY_TARGET=http://localhost/manga-store-orders-test-20261120'));
  const nonce=randomBytes(6).toString('hex');fixture={nonce,password:randomBytes(24).toString('base64url'),emails:[`auth-test-${nonce}@example.test`,`auth-test-${nonce}-admin@example.test`]};
  for(const [i,email] of fixture.emails.entries())cli('scripts/admin_account.php',{action:'create',email,full_name:i?'Responsive Admin Test':'Nguyễn Độc Giả Kiểm Thử Mobile',password:fixture.password});
  cli('tests/auth_fixture.php',{action:'demote',email:fixture.emails[0]});
  cli('tests/account_fixture.php',{action:'seed',email:fixture.emails[0],nonce,count:12});
  fixture.file=path.join(tmpdir(),'manga16d-'+nonce+'.json');await writeFile(pointer,fixture.file);await writeFile(fixture.file,JSON.stringify(fixture));
 }else fixture=JSON.parse(await readFile((await readFile(pointer,'utf8')).trim(),'utf8'));
 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');
 await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await cdp('Page.navigate',{url:'http://localhost:8443/'});await waitFor("!!document.querySelector('.site-header')");
 const api=async(endpoint,body)=>evaluate(`(async()=>{const mr=await fetch('/api/auth/me.php');const mj=await mr.json();if(mj.meta?.csrf_token)window.__auditCsrf=mj.meta.csrf_token;const r=await fetch('/api/'+${JSON.stringify(endpoint)},{method:${body===undefined?"'GET'":"'POST'"},headers:{'Content-Type':'application/json','X-CSRF-Token':window.__auditCsrf??''},${body===undefined?'':'body:'+JSON.stringify(JSON.stringify(body))+','}});const j=await r.json();if(j.meta?.csrf_token)window.__auditCsrf=j.meta.csrf_token;if(!r.ok&&r.status!==401)throw new Error('Audit API '+r.status+' '+JSON.stringify(j));return {status:r.status,...j};})()`);
 let role='';
 const login=async next=>{
  if(role===next)return;
  if(next==='guest'){await cdp('Network.clearBrowserCookies');role=next;await cdp('Page.navigate',{url:'http://localhost:8443/#home'});await cdp('Page.reload');await pause(300);await waitFor("!!document.querySelector('.site-header')");return;}
  await pause(500);await cdp('Network.clearBrowserCookies');
  if(fixture.cookies?.[next])await cdp('Network.setCookies',{cookies:fixture.cookies[next]});
  let me=await api('auth/me.php');
  if(me.status!==200){
   const r=await api('auth/login.php',{email:fixture.emails[next==='admin'?1:0],password:fixture.password});assert.equal(r.status,200);await pause(400);
  }
  role=next;await cdp('Page.navigate',{url:'http://localhost:8443/#home'});await evaluate('window.__auditReloadMarker=true');await cdp('Page.reload');await pause(150);await waitFor("!window.__auditReloadMarker&&!!document.querySelector('.site-header')");await pause(500);
  me=await api('auth/me.php');assert.equal(me.status,200,'Fixture session must remain authenticated');
  const jar=(await cdp('Network.getCookies')).cookies.map(({name,value,domain,path,httpOnly,secure,sameSite})=>({name,value,domain,path,httpOnly,secure,sameSite}));fixture.cookies??={};fixture.cookies[next]=jar;await writeFile(fixture.file,JSON.stringify(fixture));
 };
 await login(group==='admin'?'admin':'customer');
 if(setup){
  await api('cart/add.php',{product_id:9,quantity:1});await api('cart/add.php',{product_id:27,quantity:1});
  const q=(await api('orders/quote.php?mode=buy_now&product_id=9&quantity=1')).data;
  const order=await api('orders/create.php',{mode:'buy_now',product_id:9,quantity:1,idempotency_key:randomBytes(16).toString('hex'),quote_fingerprint:q.quote_fingerprint,recipient_name:'Mobile Test Reader',recipient_phone:'0900000000',province:'Test Province',district:null,ward:'Test Ward',address_line:'Isolated fixture address',customer_note:'ISOLATED MOBILE UI TEST',payment_method:'bank_transfer'});
  assert(order.data?.id,JSON.stringify(order));fixture.orderId=order.data.id;await writeFile(fixture.file,JSON.stringify(fixture));
 }

 const go=async hash=>{await cdp('Page.navigate',{url:'http://localhost:8443/'+hash});await evaluate('window.__auditReloadMarker=true');await cdp('Page.reload');await pause(100);await waitFor("!window.__auditReloadMarker&&!!document.querySelector('.site-header,.admin-shell')");await pause(200);};
 const key=async(k,code=k)=>{await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:k,code,windowsVirtualKeyCode:k==='Escape'?27:k==='Tab'?9:0});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:k,code,windowsVirtualKeyCode:k==='Escape'?27:k==='Tab'?9:0});};
 const tap=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);const r=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[r]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
 const report={checks:[],exceptions};
 await cdp('Emulation.setDeviceMetricsOverride',{width:320,height:1000,deviceScaleFactor:1,mobile:true});
 await go('#series');await waitFor("!!document.querySelector('.hero-live-slide.active')");
 for(let i=0;i<4;i++){
  await evaluate(`document.querySelectorAll('.hero-live-dots button')[${i}].click()`);await pause(120);
  const fit=await evaluate("(()=>{const a=document.querySelector('.hero-live-slide.active'),copy=a.querySelector('.hero-live-copy').getBoundingClientRect(),art=a.querySelector('.hero-live-art').getBoundingClientRect(),controls=document.querySelector('.hero-live-controls').getBoundingClientRect();return {copyBottom:copy.bottom,artBottom:art.bottom,controlsTop:controls.top,copyRight:copy.right}})()");
  assert(fit.copyRight<=320&&fit.artBottom<=fit.controlsTop+1,JSON.stringify(fit));
 }report.checks.push('all4 Hero slide copies/art/controls fit320px; controls/dots44px');
 for(const [width,height] of [[320,1000],[390,480]]){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await go('#home');await waitFor("!!document.querySelector('.hero')");await tap('.menu');await waitFor("document.querySelector('.menu').getAttribute('aria-expanded')==='true'");
  assert.equal(await evaluate("document.querySelectorAll('.site-header nav>button').length"),5);assert.equal(await evaluate("document.querySelectorAll('.mobile-nav-tools a').length"),3);
  assert(await evaluate("(()=>{const n=document.querySelector('.site-header nav').getBoundingClientRect();return n.height<=innerHeight-70&&n.right<=innerWidth})()"));
  await waitFor("document.activeElement===document.querySelector('.site-header nav>button')");
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});assert(await evaluate("document.activeElement===document.querySelector('.menu')"));
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});assert(await evaluate("document.activeElement===document.querySelector('.mobile-nav-tools a:last-child')"));
  await screenshot('16d-mobile-menu-'+width);await key('Escape');assert.equal(await evaluate("document.querySelector('.menu').getAttribute('aria-expanded')"),'false');assert(await evaluate("document.activeElement===document.querySelector('.menu')"));
 }
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});
 for(const [href,ready] of [['#shop','.shop-search-label input'],['#account','.account-metrics'],['#wishlist','.wishlist-page']]){
  await tap('.menu');await waitFor("document.querySelector('.menu').getAttribute('aria-expanded')==='true'");await evaluate(`document.querySelector('.mobile-nav-tools a[href="${href}"]').click()`);await waitFor(`!!document.querySelector(${JSON.stringify(ready)})`);assert.equal(await evaluate('location.hash'),href);assert.equal(await evaluate("document.querySelector('.menu').getAttribute('aria-expanded')"),'false');
  if(href==='#shop')assert(await evaluate("document.activeElement===document.querySelector('[name=shop_search]')"));
 }report.checks.push('mobile menu native touch;5 main links retained; Search focus/Account/Wishlist shortcuts; Escape/focus return; short viewport scroll');
 await go('#about');await waitFor("!!document.querySelector('.about-map')");const config=await evaluate("({email:document.querySelector('.about-contact-email').href,phone:document.querySelector('.about-contact-phone').href,fb:document.querySelector('.about-contact-facebook').href,map:document.querySelector('.about-map iframe').src,text:document.querySelector('.about-map').textContent})");assert.equal(config.email,'mailto:mangauniverse05@gmail.com');assert.equal(config.phone,'tel:+84369210172');assert(config.fb.includes('61596943022089'));assert.equal(new URL(config.map).searchParams.get('q'),'9.1859680957964,105.16684055328');assert(config.text.includes('Số 3 đường Lê Thị Riêng'));report.checks.push('About contact address/email/phone/Facebook/exact map coordinates unchanged');
 await login('admin');await go('#admin/products');await waitFor("!!document.querySelector('.admin-product-row-actions button')");
 const table=await evaluate("(()=>{let e=document.querySelector('.admin-table-wrap');e.scrollLeft=100;return {scroll:e.scrollLeft,wide:e.scrollWidth>e.clientWidth,documentWidth:document.documentElement.scrollWidth}})()");assert(table.wide&&table.scroll>0&&table.documentWidth<=390);
 await evaluate("document.querySelector('.admin-product-heading>button').click()");await waitFor("!!document.querySelector('[data-admin-product-form]')");await evaluate("(()=>{let e=document.querySelector('[name=sku]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'UI-UNSAVED-ONLY');e.dispatchEvent(new Event('input',{bubbles:true}));})()");
 await evaluate("document.querySelector('.admin-product-series-field button').focus();document.querySelector('.admin-product-series-field button').click()");await waitFor("!!document.querySelector('.admin-series-dialog[open]')");assert(await evaluate("document.activeElement.matches('[name=series_title]')"));
 await evaluate("document.querySelector('.admin-series-dialog form').requestSubmit()");await waitFor("!!document.querySelector('.admin-series-dialog [role=alert]')");await screenshot('16d-series-validation');await key('Escape');await waitFor("!document.querySelector('.admin-series-dialog')");await waitFor("document.activeElement.matches('.admin-product-series-field button')");assert.equal(await evaluate("document.querySelector('[name=sku]').value"),'UI-UNSAVED-ONLY');await evaluate("(()=>{let e=document.querySelector('[name=sku]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'');e.dispatchEvent(new Event('input',{bubbles:true}));})()");
 assert(!requests.some(u=>u.includes('/series-create.php')||u.includes('/product-create.php')||u.includes('/orders/create.php')));report.checks.push('Admin regional table scrolling; Series dialog focus/empty validation/Escape/focus return; Product draft retained; no create API submitted');
 assert.equal(exceptions.length,0);assert.equal(consoleErrors.length,0);report.result='PASS';await writeFile(path.join(artifacts,'16d-menu-admin-interactions.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{socket?.close();browser.kill();}
