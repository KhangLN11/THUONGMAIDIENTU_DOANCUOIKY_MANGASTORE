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
const nonce=randomBytes(6).toString('hex'),emails=['auth-test-'+nonce+'-admin@example.test','auth-test-'+nonce+'@example.test'],password=randomBytes(24).toString('base64url'),sku='ADMTEST-'+nonce;
function cli(script,input){const r=spawnSync('C:/xampp/php/php.exe',['backend/'+script],{input:JSON.stringify(input),encoding:'utf8',env:{...process.env,DB_NAME:'manga_store_admin_test_20261122'},windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout;}
for(const [i,email] of emails.entries()){assert(!JSON.parse(cli('tests/auth_fixture.php',{email,action:'inspect'})).exists);cli('scripts/admin_account.php',{action:'create',email,full_name:i===0?'Admin GUI Operator':'Admin GUI Customer',password});if(i)cli('tests/auth_fixture.php',{email,action:'demote'});}

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



 const report={checks:[],viewports:[1440,900,390],dialogs:[]};
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Page.javascriptDialogOpening'){report.dialogs.push(m.params.message);void cdp('Page.handleJavaScriptDialog',{accept:true}).catch(()=>{});}});
 const field=async(selector,value)=>evaluate(`(()=>{const i=document.querySelector(${JSON.stringify(selector)});const proto=i.tagName==='SELECT'?HTMLSelectElement.prototype:i.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event(i.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
 const account=async()=>{await evaluate("window.location.hash='#account'");await waitFor("!!document.querySelector('.account-page')");};
 const login=async n=>{await account();await waitFor("!!document.querySelector('.account-page form')");await field('input[name=email]',emails[n]);await field('input[name=password]',password);await evaluate("document.querySelector('.account-page form').requestSubmit()");await waitFor(`document.querySelector('.account-layout aside h3')?.textContent===${JSON.stringify(n===0?'Admin GUI Operator':'Admin GUI Customer')}`);};
 const nav=async name=>{await evaluate(`window.location.hash='#admin/${name}'`);await waitFor(`document.querySelector('.admin-sidebar nav button[aria-current=page]')?.textContent===${JSON.stringify(name.toUpperCase())}`);};
 const button=async(text,scope='.admin-main')=>evaluate(`(()=>{const b=Array.from(document.querySelectorAll(${JSON.stringify(scope+' button')})).find(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled);if(!b)throw new Error('Button not found: '+${JSON.stringify(text)});b.click();})()`);
 const adminLanguage=async(lang)=>{await evaluate(`Array.from(document.querySelectorAll('.admin-topbar button')).find(b=>b.textContent==='${lang}').click()`);await pause(150);};

 const demo=process.argv.includes('--demo'),mode=demo?'demo':'live';
 const home=await evaluate("document.querySelector('main').outerHTML");await navigate('shop');await waitFor("document.querySelectorAll('[data-shop-product]').length>0");
 const ids=()=>evaluate("[...document.querySelectorAll('[data-shop-product]')].map(c=>Number(c.dataset.shopProduct))");
 const initial=await ids();const catalog=demo?null:await evaluate("fetch('/api/products.php').then(r=>r.json()).then(v=>v.data)");
 assert.equal(initial.length,demo?initial.length:catalog.length);
 for(const width of [1440,900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await evaluate('window.scrollTo({top:0,behavior:"instant"})');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));const cols=await evaluate("getComputedStyle(document.querySelector('.shop-grid')).gridTemplateColumns.split(' ').length");assert.equal(cols,width===1440?4:width===900?2:1);await screenshot('12b-after-shop-'+mode+'-'+width);await evaluate("document.querySelector('.shop-grid').scrollIntoView({block:'center',behavior:'instant'})");await screenshot('12b-after-cards-'+mode+'-'+width);assert(await evaluate("[...document.querySelectorAll('.shop-card-actions button')].every(b=>b.getBoundingClientRect().height>=44&&getComputedStyle(b).visibility==='visible')"));}
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await pause(150);
 const reset=async()=>{await evaluate("document.querySelector('.shop-sidebar .shop-reset').click()");await pause(120);};
 await field('[name=shop_sort]','price_asc');if(!demo){const values=(await ids()).map(id=>{const p=catalog.find(p=>p.id===id);return p.sale_price_vnd??p.price_vnd});assert.deepEqual(values,[...values].sort((a,b)=>a-b));}
 await field('[name=shop_search]',demo?'ronin':'dai chien titan');await waitFor("document.querySelectorAll('[data-shop-product]').length>0");if(!demo)assert((await ids()).every(id=>catalog.find(p=>p.id===id).series.slug==='attack-on-titan'));
 await reset();const firstId=(await ids())[0],secondId=(await ids())[1];assert(firstId!==secondId);
 await field('[name=shop_series]',demo?'demo:VOID RUNNER':'one-piece');if(!demo)assert.deepEqual(new Set(await ids()),new Set(catalog.filter(p=>p.series?.slug==='one-piece').map(p=>p.id)));
 await field('[name=shop_min]','999999999999');await waitFor("!!document.querySelector('.shop-empty')");await field('[name=shop_max]','1');assert(await evaluate("!!document.querySelector('#shop-price-error')"));await reset();
 if(!demo){await field('[name=shop_stock]','out');assert.equal((await ids()).length,catalog.filter(p=>p.stock_quantity===0).length);await reset();}
 await field('[name=shop_search]',demo?'ronin':'naruto');const filteredIds=await ids();assert(filteredIds.length);await evaluate("document.querySelector('.shop-image-open').click()");await waitFor("!!document.querySelector('.product-page[data-product-id]')");assert.equal(await evaluate("Number(document.querySelector('.product-page').dataset.productId)"),filteredIds[0]);await evaluate('history.back()');await waitFor("!!document.querySelector('[data-shop-catalog]')");assert.equal(await evaluate("document.querySelector('[name=shop_search]').value"),demo?'ronin':'naruto');await evaluate("document.querySelector('.shop-product-name').click()");await waitFor("!!document.querySelector('.product-page[data-product-id]')");assert.equal(await evaluate("Number(document.querySelector('.product-page').dataset.productId)"),filteredIds[0]);await evaluate('history.back()');await waitFor("!!document.querySelector('[data-shop-catalog]')");await reset();

 await evaluate("document.querySelector('.shop-card-actions button:first-child').scrollIntoView({block:'center',behavior:'instant'})");await pause(150);const hover=await evaluate("(()=>{const r=document.querySelector('.shop-card-actions button:first-child').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:100});await screenshot('12b-actions-normal-'+mode);await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...hover});await pause(250);assert(await evaluate("(()=>{const b=document.querySelector('.shop-card-actions button:first-child'),s=getComputedStyle(b);return b.matches(':hover')&&s.color!==s.backgroundColor&&getComputedStyle(b,'::before').content==='none';})()"));await screenshot('12b-actions-hover-'+mode);
 await evaluate("document.querySelector('.shop-product-name').focus()");await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',unmodifiedText:'\r',windowsVirtualKeyCode:13});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await waitFor("!!document.querySelector('.product-page[data-product-id]')");await evaluate('history.back()');await waitFor("!!document.querySelector('[data-shop-catalog]')");
 await navigate('home');assert.equal(await evaluate("document.querySelector('main').outerHTML"),home,'Default Home DOM unchanged after filters and routing');await navigate('shop');await waitFor("document.querySelectorAll('[data-shop-product]').length>0");
 await evaluate(`document.querySelector('[data-shop-product="${firstId}"] .wish').click()`);assert.equal(await evaluate('location.hash'),'#shop');
 const cartBefore=await evaluate("sessionStorage.getItem('manga-store-guest-api-v1')");await evaluate(`document.querySelector('[data-shop-product="${firstId}"] .shop-card-actions button:last-child').click()`);await pause(200);assert.equal(await evaluate('location.hash'),'#shop');if(!demo)assert.notEqual(await evaluate("sessionStorage.getItem('manga-store-guest-api-v1')"),cartBefore);
 const guestCart=await evaluate("sessionStorage.getItem('manga-store-guest-api-v1')"),requestStart=requests.length;
 await evaluate(`document.querySelector('[data-shop-product="${secondId}"] .shop-card-actions button:first-child').click()`);await waitFor(`!!document.querySelector('[data-buy-now-product="${secondId}"]')`);assert.equal(await evaluate("document.querySelectorAll('.checkout-item').length"),1);assert.equal(await evaluate("document.querySelector('[data-buy-now-checkout] .ink-btn').disabled"),true);assert.equal(await evaluate("sessionStorage.getItem('manga-store-guest-api-v1')"),guestCart);assert.equal(await evaluate('location.hash'),'#checkout/buy-now/'+secondId);await screenshot('12b-buy-now-'+mode+'-desktop');
 const stored=await evaluate(`JSON.parse(sessionStorage.getItem('manga-buy-now-${demo?'demo':'api'}'))`);assert.deepEqual(Object.keys(stored).sort(),['mode','productId','quantity']);assert.equal(stored.productId,secondId);assert.equal(stored.quantity,1);
 await evaluate('window.__buyReload=true');await cdp('Page.reload');await waitFor(`!window.__buyReload&&!!document.querySelector('[data-buy-now-product="${secondId}"]')`);if(!demo)assert.equal(await evaluate("sessionStorage.getItem('manga-store-guest-api-v1')"),guestCart);
 assert.equal(requests.slice(requestStart).filter(u=>/orders\/(quote|create)\.php/.test(u)).length,0,'Buy Now must never call cart quote or create');
 if(!demo){await waitFor("!!document.querySelector('[data-buy-now-checkout] .ink-btn-ghost')");await evaluate("document.querySelector('[data-buy-now-checkout] .ink-btn-ghost').click()");await waitFor("!!document.querySelector('.account-page form')");await field('input[name=email]',emails[1]);await field('input[name=password]',password);await evaluate("document.querySelector('.account-page form').requestSubmit()");await waitFor("!!document.querySelector('[data-buy-now-resume]')");await pause(350);const before=await evaluate("fetch('/api/cart.php').then(r=>r.json()).then(v=>v.data.items)");assert(before.some(i=>i.product_id===firstId));assert(!before.some(i=>i.product_id===secondId));await evaluate("document.querySelector('[data-buy-now-resume] button').click()");await waitFor(`!!document.querySelector('[data-buy-now-product="${secondId}"]')`);const after=await evaluate("fetch('/api/cart.php').then(r=>r.json()).then(v=>v.data.items)");assert.deepEqual(after,before);assert.equal(requests.slice(requestStart).filter(u=>/orders\/(quote|create)\.php/.test(u)).length,0);}
 await evaluate("document.querySelector('.buy-now-cancel').click()");await waitFor("!!document.querySelector('[data-shop-catalog]')");assert.equal(await evaluate(`sessionStorage.getItem('manga-buy-now-${demo?'demo':'api'}')`),null);await evaluate('history.back()');await waitFor("!!document.querySelector('[data-buy-now-checkout]')");assert.equal(await evaluate("document.querySelectorAll('[data-buy-now-product]').length"),0,'Cancelled history must never pick another product');await evaluate("document.querySelector('.buy-now-cancel').click()");await waitFor("!!document.querySelector('[data-shop-catalog]')");
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});await pause(200);await evaluate("document.querySelector('.shop-filter-toggle').click()");await waitFor("!!document.querySelector('dialog[open]')");await screenshot('12b-filter-drawer-'+mode+'-390');assert(await evaluate("(()=>{const r=document.querySelector('dialog').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})()"));await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await waitFor("!document.querySelector('dialog[open]')");assert(await evaluate("document.activeElement===document.querySelector('.shop-filter-toggle')"));
 await language('vi');assert((await evaluate("document.querySelector('.shop-toolbar').textContent")).includes('Sắp xếp'));assert.equal(await evaluate("document.querySelector('.shop-card-actions button').textContent"),'MUA NGAY');await language('en');

 await evaluate("document.querySelector('.shop-card-actions button:first-child').scrollIntoView({block:'center',behavior:'instant'})");await pause(200);const touchId=(await ids())[0],point=await evaluate("(()=>{const r=document.querySelector('.shop-card-actions button:first-child').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");await cdp('Emulation.setTouchEmulationEnabled',{enabled:true});await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await waitFor(`!!document.querySelector('[data-buy-now-product="${touchId}"]')`);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await screenshot('12b-buy-now-'+mode+'-390');assert.equal(requests.slice(requestStart).filter(u=>/orders\/(quote|create)\.php/.test(u)).length,0);await evaluate("document.querySelector('.buy-now-cancel').click()");
 if(demo)assert.equal(requests.filter(u=>/\/api\/products?\.php/.test(u)).length,0);
 assert.equal(exceptions.length,0,JSON.stringify(exceptions));assert.equal(consoleErrors.length,0,JSON.stringify(consoleErrors));report.result='PASS';report.checks=['4/2/1 grid, original editorial cards, search without accents, series/price/stock/sort/reset, name/image detail and back preserves filters, wishlist/add independent, Buy Now one product no cart/quote/order mutation, reload/cancel/history safe, guest login resume (Live), mobile drawer and VI/EN'];await writeFile(path.join(artifacts,'12b-shop-'+mode+'.json'),JSON.stringify(report,null,2));console.log('PASS '+mode+' Shop/Buy Now real GUI, filters/grid/actions/cart preservation/checkout isolation/reload/login/cancel/responsive');
}finally{cli('tests/admin_fixture.php',{action:'cleanup',emails,skus:[sku]});if(socket)socket.close();browser.kill();}
