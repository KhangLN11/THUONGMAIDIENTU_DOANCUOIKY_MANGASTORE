import { spawn } from 'node:child_process';
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
  const waitFor = async expression => { for(let i=0;i<100;i++){ if(await evaluate(expression)) return; await pause(100); } throw new Error('Timeout: '+expression); };
  const reload = async () => {
    await evaluate('window.__testReload = true');
    await cdp('Page.reload');
    await waitFor("!window.__testReload && document.querySelectorAll('.site-header nav button').length >= 2");
  };
  const language = async value => { await evaluate(`document.querySelectorAll('.language-switcher button')[${value==='vi'?0:1}].click()`); await pause(150); };
  const navigate = async page => { await evaluate(`document.querySelectorAll('.site-header nav button')[${page==='shop'?1:0}].click()`); await pause(150); };
  const screenshot = async name => { await pause(300); const r=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}); await writeFile(path.join(artifacts,name+'.png'),Buffer.from(r.data,'base64')); };



 const demo=process.argv.includes('--demo'),report={mode:demo?'demo':'live',checks:[],exceptions};
 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});
 await cdp('Page.navigate',{url:'http://localhost:8443/#shop'});await waitFor("document.querySelectorAll('[data-shop-product]').length>0");await language('vi');
 const catalog=demo?null:(await(await fetch('http://localhost:8443/api/products.php')).json()).data;
 const ids=()=>evaluate("[...document.querySelectorAll('[data-shop-product]')].map(p=>+p.dataset.shopProduct)");
 const field=async(selector,value)=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await pause(100);};
 const open=async()=>{await evaluate("document.querySelector('.shop-filter-toggle').scrollIntoView({block:'center',behavior:'instant'})");const r=await evaluate("(()=>{const r=document.querySelector('.shop-filter-toggle').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[r]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await waitFor("document.querySelector('dialog').open");};
 const close=async()=>{await evaluate("document.querySelector('.shop-filter-close').click()");await waitFor("!document.querySelector('dialog').open");};
 const reset=async()=>{await evaluate("document.querySelector('dialog .shop-reset').click()");await pause(100);};
 for(let i=0;i<3;i++){await open();await close();assert(await evaluate("document.activeElement===document.querySelector('.shop-filter-toggle')"));}
 await open();await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await waitFor("!document.querySelector('dialog').open");report.checks.push('drawer reopen/close/Escape/focus return');
 const total=(await ids()).length;
 for(const query of demo?['ronin']:['\u0110\u1ea1i Chi\u1ebfn Titan','dai chien titan']){await field('[name=shop_search]',query);assert((await ids()).length>0);if(!demo)assert((await ids()).every(id=>catalog.find(p=>p.id===id).series.slug==='attack-on-titan'));}
 await open();await reset();
 await evaluate("document.querySelectorAll('dialog details:first-of-type .shop-filter-choice')[1].click()");assert((await ids()).length>0);await reset();
 await field('[name=shop_series]',demo?'demo:VOID RUNNER':'one-piece');assert((await ids()).length>0);await close();await open();assert.equal(await evaluate("document.querySelector('[name=shop_series]').value"),demo?'demo:VOID RUNNER':'one-piece');await reset();
 await field('[name=shop_min]',demo?'25':'100000');await field('[name=shop_max]',demo?'75':'500000');if(!demo)assert((await ids()).every(id=>{const p=catalog.find(x=>x.id===id),price=p.sale_price_vnd??p.price_vnd;return price>=100000&&price<=500000}));
 await field('[name=shop_min]','9999999');await field('[name=shop_max]','1');assert(await evaluate("!!document.querySelector('#shop-price-error')"));await reset();
 if(!demo){await field('[name=shop_stock]','out');assert.equal((await ids()).length,catalog.filter(p=>p.stock_quantity===0).length);await reset();await field('[name=shop_stock]','in');assert((await ids()).every(id=>catalog.find(p=>p.id===id).stock_quantity>0));await reset();}
 await evaluate("document.querySelector('dialog').scrollTop=10000");assert(await evaluate("(()=>{const d=document.querySelector('dialog'),r=d.getBoundingClientRect();return r.height<=innerHeight&&d.scrollHeight>d.clientHeight})()"));await screenshot('16c-drawer-'+report.mode);await close();
 await field('[name=shop_sort]','price_asc');if(!demo){const p=(await ids()).map(id=>{let x=catalog.find(p=>p.id===id);return x.sale_price_vnd??x.price_vnd});assert.deepEqual(p,[...p].sort((a,b)=>a-b));}
 await open();await reset();await close();assert.equal((await ids()).length,total);report.checks.push('search VI accents/folding; category/series/price/stock/sort/reset/count preserved');
 const first=(await ids())[0];
 for(const sel of ['.shop-image-open','.shop-product-name']){await evaluate(`document.querySelector('[data-shop-product="${first}"] ${sel}').click()`);await waitFor("!!document.querySelector('.product-page')");await evaluate('history.back()');await waitFor("!!document.querySelector('.shop-catalog')");}
 await evaluate(`document.querySelector('[data-shop-product="${first}"] .wish').click()`);await waitFor(`document.querySelector('[data-shop-product="${first}"] .wish').classList.contains('active')`);assert.equal(await evaluate('location.hash'),'#shop');
 const badge=await evaluate("document.querySelector('.cart-icon').textContent");await evaluate(`document.querySelector('[data-shop-product="${first}"] .shop-card-actions button:last-child').click()`);await pause(500);assert.equal(await evaluate('location.hash'),'#shop');assert.notEqual(await evaluate("document.querySelector('.cart-icon').textContent"),badge);
 const afterAdd=await evaluate("document.querySelector('.cart-icon').textContent");await evaluate(`document.querySelector('[data-shop-product="${first}"] .shop-card-actions button:first-child').click()`);await waitFor(demo?"location.hash.startsWith('#checkout/buy-now/')":"location.hash==='#account'");const intent=await evaluate(`JSON.parse(sessionStorage.getItem('manga-buy-now-${demo?'demo':'api'}'))`);assert.equal(intent.productId,first);assert.equal(intent.quantity,1);if(demo)assert(await evaluate(`location.hash.endsWith('/${first}')`));assert.equal(await evaluate("document.querySelector('.cart-icon').textContent"),afterAdd);
 report.checks.push('image/name detail+Back; wishlist isolated; guest Cart badge; Buy Now correct ID and Cart unchanged');
 assert.equal(exceptions.length,0);report.result='PASS';await writeFile(path.join(artifacts,'16c-'+report.mode+'-actions.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{socket?.close();browser.kill();}
