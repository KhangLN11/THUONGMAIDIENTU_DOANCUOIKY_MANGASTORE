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
 const routes=[
  ['discovery','home','#home','.hero'],['discovery','series','#series','.hero-live'],['discovery','volumes','#series/one-piece','[data-volume-grid]'],['discovery','collections','#collections','.discovery-figure-group'],
  ['shopping','product','#product/9','.accordions'],['shopping','figure','#product/27','.accordions'],['shopping','cart','#cart','.cart-row'],['shopping','wishlist','#wishlist','.product-card'],
  ['account','login','#account','.account-page form'],['account','checkout','#checkout','.checkout-fields'],['account','payment','#checkout','.checkout-fields'],['account','success','#checkout/complete/'+fixture.orderId,'[data-order-code]'],['account','account','#account','.account-metrics'],['account','orders','#account/orders','.history-row'],['account','order','#account/orders/'+fixture.orderId,'[data-order-detail]'],
  ['information','about','#about','.about-contact'],['information','maps','#about/contact','.about-map'],
  ['admin','dashboard','#admin/dashboard','.admin-cards'],['admin','admin-orders','#admin/orders','.admin-table-wrap'],['admin','products','#admin/products','[data-admin-products]'],['admin','create','#admin/products','[data-admin-products]'],['admin','edit','#admin/products','[data-admin-products]'],['admin','series-dialog','#admin/products','[data-admin-products]'],['admin','inventory','#admin/inventory','.admin-table-wrap'],['admin','customers','#admin/customers','.admin-table-wrap'],['admin','reports','#admin/reports','.admin-reports'],
 ];
 const only=process.argv.find(x=>x.startsWith('--only='))?.split('=')[1];
 const report={before,mode:demo?'demo':'live',group,pages:[],exceptions};
 const field=async(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 for(const [g,name,hash,ready] of routes.filter(r=>(group==='all'||r[0]===group)&&(!only||r[1]===only))){
  await login(g==='admin'?'admin':name==='login'?'guest':'customer');
  await cdp('Page.navigate',{url:'http://localhost:8443/'+hash});await evaluate('window.__auditReloadMarker=true');await cdp('Page.reload');await pause(100);await waitFor(`!window.__auditReloadMarker&&!!document.querySelector(${JSON.stringify(ready)})`);await pause(250);
  if(name==='payment'){
   for(const [key,value] of Object.entries({recipient_name:'Mobile Reader',recipient_phone:'0900000000',province:'Test',ward:'Test',address_line:'Test address'}))await field(`[name=${key}]`,value);
   await evaluate("document.querySelector('.checkout-content form').requestSubmit()");await waitFor("!!document.querySelector('.checkout-methods')");
  }
  if(['create','series-dialog'].includes(name)){await evaluate("document.querySelector('.admin-product-heading>button').click()");await waitFor("!!document.querySelector('[data-admin-product-form]')");}
  if(name==='edit'){await waitFor("!!document.querySelector('.admin-product-row-actions button')");await evaluate("document.querySelector('.admin-product-row-actions button').click()");await waitFor("!!document.querySelector('[data-admin-product-form]')");}
  if(name==='series-dialog'){await evaluate("document.querySelector('.admin-product-series-field button').click()");await waitFor("!!document.querySelector('.admin-series-dialog[open]')");}
  await pause(400);
  const samples=[];
  for(const width of before?[390,900,1440]:[320,360,375,390,430,480,768,900,1440]){
   await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<=600});
   for(const lang of before?['vi']:['vi','en']){
    if(g==='admin')await evaluate(`Array.from(document.querySelectorAll('.admin-topbar button')).find(b=>b.textContent.trim()==='${lang.toUpperCase()}')?.click()`);else await language(lang);
    await evaluate('document.fonts.ready.then(()=>true)');await pause(180);await evaluate('window.scrollTo({top:0,behavior:"instant"})');
    if(name==='maps')await evaluate("document.querySelector('.about-map').scrollIntoView({block:'start',behavior:'instant'})");
    const metrics=await evaluate(`(()=>{
     const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility==='visible'&&s.display!=='none'};
     const clipped=e=>{for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement)if(/hidden|clip|auto|scroll/.test(getComputedStyle(p).overflowX))return true;return false};
     const overflow=[...document.querySelectorAll('main *, .admin-main *,footer *')].filter(e=>visible(e)&&!clipped(e)&&(e.getBoundingClientRect().right>innerWidth+2||e.getBoundingClientRect().left< -2)).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,55)}));
     const small=[...document.querySelectorAll('.ink-btn,.quick-actions button,.hero-live-controls button,.qty button,.checkout-button,.admin-button,.wish,.account-sidebar nav button,.thumbs button')].filter(visible).filter(e=>e.getBoundingClientRect().height<43).slice(0,12).map(e=>({cls:e.className,text:e.textContent.slice(0,35),h:e.getBoundingClientRect().height}));
     return {overflow:document.documentElement.scrollWidth>innerWidth,scrollWidth:document.documentElement.scrollWidth,offenders:overflow,smallTargets:small,font:document.fonts.check('700 20px "Barlow Condensed"')};
    })()`);
    if(true){await screenshot(`16d-${before?'before':'after'}-${name}-${lang}-${width}`);}
    samples.push({width,lang,...metrics});
   }
  }
  report.pages.push({name,hash,samples});await writeFile(path.join(artifacts,`16d-${before?'before':'after'}-${group}${only?'-'+only:''}.json`),JSON.stringify(report,null,2));console.log(name+': '+samples.filter(s=>s.overflow).map(s=>s.width+'/'+s.lang).join(',')+' overflow; small='+samples[0].smallTargets.length);
 }
 report.consoleErrors=consoleErrors;assert.equal(consoleErrors.length,0);assert.equal(exceptions.length,0);assert(report.pages.every(p=>p.samples.every(s=>!s.overflow)), 'Document overflow in matrix');report.result='PASS';await writeFile(path.join(artifacts,`16d-${before?'before':'after'}-${group}${only?'-'+only:''}.json`),JSON.stringify(report,null,2));
}finally{socket?.close();browser.kill();}
