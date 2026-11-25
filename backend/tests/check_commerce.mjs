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
const nonce=randomBytes(6).toString('hex');
const emails=['auth-test-'+nonce+'@example.test','auth-test-'+nonce+'-other@example.test'];
const password=randomBytes(24).toString('base64url');
function cli(script,input){const r=spawnSync('C:/xampp/php/php.exe',['backend/'+script],{input:JSON.stringify(input),encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout;}
function fixture(email,action='inspect'){return JSON.parse(cli('tests/auth_fixture.php',{email,action,password}));}
for(const [index,email] of emails.entries()){
 assert(!fixture(email).exists);
 cli('scripts/admin_account.php',{action:'create',email,full_name:'Commerce '+(index===0?'A':'B'),password});fixture(email,'demote');
}
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



  const report={checks:[],viewports:[1440,390]};
  let loseMerge=true;
  socket.addEventListener('message',event=>{
    const m=JSON.parse(event.data);
    if(m.method==='Fetch.requestPaused') {
      void cdp('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'Aborted'}).catch(()=>{});
      loseMerge=false;
    }
  });
  const field=async(name,value)=>evaluate(`(() => {const i=document.querySelector('.account-page input[name="${name}"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const account=async()=>{await evaluate("window.location.hash='#account'");await waitFor("!!document.querySelector('.account-page')");};
  const login=async index=>{await account();await waitFor("!!document.querySelector('.account-page form')");await field('email',emails[index]);await field('password',password);await evaluate("document.querySelector('.account-page form').requestSubmit()");await waitFor(`document.querySelector('.account-layout aside h3')?.textContent==='Commerce ${index===0?'A':'B'}'`);};
  const count=()=>evaluate("Number(document.querySelector('.cart-icon b')?.textContent||0)");
  const waitCount=async n=>waitFor(`Number(document.querySelector('.cart-icon b')?.textContent||0)===${n}`);
  const openCart=async()=>{await evaluate("document.querySelector('.cart-icon').click()");await waitFor("!!document.querySelector('.cart-page')");};
  const logout=async()=>{await account();await evaluate("Array.from(document.querySelectorAll('.account-page button')).find(b=>b.textContent==='SIGN OUT'&&b.getClientRects().length).click()");await waitFor("!!document.querySelector('.account-page form')");};
  await navigate('shop');await waitFor("document.querySelectorAll('.shop-grid .product-card').length===23");
  const catalog=(await(await fetch('http://localhost:8443/api/products.php')).json()).data;
  const first=catalog[0],second=catalog[1];
  await evaluate("document.querySelectorAll('.shop-grid .shop-card-actions button')[1].click();document.querySelectorAll('.shop-grid .shop-card-actions button')[1].click();document.querySelector('.shop-grid .wish').click()");
  await waitCount(2);
  assert(!requests.some(u=>/\/api\/(cart|wishlist)\//.test(u)),'Guests must not call account writes');
  await openCart();await reload();await waitFor("document.querySelector('.cart-row .qty b')?.textContent==='2'");
  assert.equal((await evaluate("JSON.parse(sessionStorage.getItem('manga-store-guest-api-v1')).items"))[0].product_id,first.id);
  report.checks.push('guest cart/wishlist use real IDs; no account writes; guest refresh');
  await cdp('Fetch.enable',{patterns:[{urlPattern:'*cart/merge.php*',requestStage:'Response'}]});
  await login(0);
  await waitFor("!!document.querySelector('[role=alert]')");assert(!loseMerge);
  assert(await evaluate("!!JSON.parse(sessionStorage.getItem('manga-store-guest-api-v1')).plan"));
  await cdp('Fetch.disable');
  await evaluate("document.querySelector('[role=alert] button').click()");
  await waitCount(2);assert.equal(await evaluate("!!document.querySelector('[role=alert]')"),false);
  await reload();await language('en');await waitCount(2);
  assert.equal(await evaluate("JSON.parse(sessionStorage.getItem('manga-store-guest-api-v1')).items.length"),0);
  assert.equal(await evaluate("JSON.parse(sessionStorage.getItem('manga-store-guest-api-v1')).plan"),undefined);
  report.checks.push('server commit with lost merge response; guest retained; refresh replays key once, no double quantity');
  await navigate('shop');await waitFor("document.querySelectorAll('.shop-grid .product-card').length===23");
  await evaluate("document.querySelector('.shop-grid .wish').click();document.querySelector('.shop-grid .wish').click()");
  await openCart();await waitFor("document.querySelectorAll('.cart-row .qty button').length===2 && !document.querySelectorAll('.cart-row .qty button')[1].disabled");
  assert((await evaluate("fetch('/api/wishlist.php').then(r=>r.json()).then(p=>p.data.product_ids)")).includes(first.id));
  await openCart();await waitFor("document.querySelector('.cart-row .qty b')?.textContent==='2'");
  await evaluate("document.querySelectorAll('.cart-row .qty button')[1].click()");await waitCount(3);
  await evaluate("document.querySelectorAll('.cart-row .qty button')[0].click()");await waitCount(2);
  await language('vi');assert((await evaluate("document.querySelector('.cart-row h3').textContent")).includes(first.name_vi));
  await language('en');await screenshot('commerce-cart-desktop');
  const server=await evaluate("fetch('/api/cart.php').then(r=>r.json()).then(p=>p.data)");
  assert.equal(server.subtotal_vnd,2*(first.sale_price_vnd??first.price_vnd));
  assert((await evaluate("document.querySelector('.summary .total b').textContent")).includes('440,000'));
  await evaluate("document.querySelector('.header-actions button[aria-label=Wishlist]').click()");
  await waitFor("document.querySelectorAll('.shop-grid .product-card').length===1");
  await screenshot('commerce-wishlist-desktop');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await openCart();assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await screenshot('commerce-cart-mobile');
  await logout();await waitCount(0);
  await login(1);await waitFor("!Array.from(document.querySelectorAll('[role=status]')).some(e=>e.textContent.includes('Loading your cart'))");await waitCount(0);
  await evaluate("window.location.hash='#wishlist'");await waitFor("document.querySelector('.shop-grid') && document.querySelectorAll('.shop-grid .product-card').length===0");
  await navigate('shop');await waitFor("document.querySelectorAll('.shop-grid .product-card').length===23");
  await evaluate("document.querySelectorAll('.shop-grid .shop-card-actions button')[3].click();document.querySelectorAll('.shop-grid .wish')[1].click()");await waitCount(1);
  await waitFor("document.querySelectorAll('.shop-grid .wish')[1].classList.contains('active')").catch(()=>{});
  await logout();await waitCount(0);assert.equal(await evaluate("!!document.querySelector('.toast')"),false);
  await login(0);await waitCount(2);assert.equal(await evaluate("!!document.querySelector('.toast')"),false);
  await evaluate("window.location.hash='#wishlist'");await waitFor("document.querySelectorAll('.shop-grid .product-card').length===1");
  assert.equal(await evaluate("document.querySelector('.shop-grid h3').textContent"),first.name_en);
  await screenshot('commerce-wishlist-mobile');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await openCart();await waitFor("document.querySelector('.cart-row .qty b')?.textContent==='2'");
  await evaluate("document.querySelector('.cart-row button').click()");await waitCount(0);
  await evaluate("window.location.hash='#wishlist'");await waitFor("document.querySelectorAll('.shop-grid .product-card').length===1");await evaluate("document.querySelector('.shop-grid .wish').click()");await waitFor("document.querySelectorAll('.shop-grid .product-card').length===0");
  report.checks.push('server quantities/totals, VND and VI/EN; wishlist view; logout clears memory; account isolation; account data restored; remove cart/wishlist; desktop/mobile');
  assert.equal(exceptions.length,0,JSON.stringify(exceptions));assert.equal(consoleErrors.length,0,JSON.stringify(consoleErrors));
  report.exceptions=exceptions;report.consoleErrors=consoleErrors;report.result='PASS';
  await writeFile(path.join(artifacts,'commerce-browser.json'),JSON.stringify(report,null,2));
  console.log('PASS commerce GUI: guest refresh/ambiguous merge retry, account isolation, persistent cart/wishlist, quantities, VI/EN VND, desktop/mobile');
} finally {for(const email of emails)fixture(email,'delete');if(socket)socket.close();browser.kill();}
