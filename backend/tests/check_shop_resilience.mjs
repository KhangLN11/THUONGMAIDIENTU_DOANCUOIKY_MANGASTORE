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
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await cdp('Page.navigate',{url:'http://localhost:8443/'});
  await waitFor("!!document.querySelector('.site-header')");
  await language('en');
  await evaluate('document.fonts.ready.then(()=>true)');
  await pause(500);




 await language('en');await evaluate("location.hash='#shop'");await waitFor("document.querySelectorAll('[data-shop-product]').length>0");const original=await evaluate("fetch('/api/products.php').then(r=>r.json()).then(v=>v.data)");
 let mode='page',held=null;const synthetic=Array.from({length:53},(_,i)=>({...original[0],id:10000+i,sku:'TEST-PAGE-'+i,slug:'test-page-'+i,name_vi:'Trang kiểm thử '+i,name_en:'Pagination Test '+i}));
 const fulfill=params=>{void cdp('Fetch.fulfillRequest',params).catch(()=>{});};
 const handler=event=>{const m=JSON.parse(event.data);if(m.method!=='Fetch.requestPaused')return;const p=m.params;
  if(mode==='hold'){held=p.requestId;return;}
  if(mode==='stock-detail'&&/\/product\.php/.test(p.request.url)){const id=Number(new URL(p.request.url).searchParams.get('id'));const product=original.find(i=>i.id===id);fulfill({requestId:p.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({success:true,data:{...product,stock_quantity:0}})).toString('base64')});return;}
  const data=mode==='page'?synthetic:mode==='stock'?original.map((p,i)=>i===0?{...p,stock_quantity:0}:p):original;
  fulfill({requestId:p.requestId,responseCode:mode==='error'?503:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(mode==='error'?{success:false,error:{code:'TEST_ERROR',message:'Test unavailable'}}:{success:true,data,meta:{total:data.length}})).toString('base64')});
 };socket.addEventListener('message',handler);
 const intercept=()=>cdp('Fetch.enable',{patterns:[{urlPattern:'*api/products.php*',requestStage:'Request'}]});
 const refresh=()=>evaluate("window.dispatchEvent(new CustomEvent('manga-products-updated'))");
 await intercept();await refresh();await waitFor("document.querySelectorAll('[data-shop-product]').length===24");const first=await evaluate("[...document.querySelectorAll('[data-shop-product]')].map(e=>e.dataset.shopProduct)");assert((await evaluate("document.querySelector('.shop-result-count').textContent")).includes('53'));await evaluate("document.querySelector('.shop-pagination button:last-child').click()");await waitFor("document.querySelector('[data-shop-product]')?.dataset.shopProduct==='10024'");const second=await evaluate("[...document.querySelectorAll('[data-shop-product]')].map(e=>e.dataset.shopProduct)");assert(!first.some(id=>second.includes(id)));await evaluate("document.querySelector('.shop-pagination button:last-child').click()");await waitFor("document.querySelectorAll('[data-shop-product]').length===5");await screenshot('12b-pagination-response-only');
 const field=async(selector,value)=>evaluate(`(()=>{const i=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await field('[name=shop_search]','Pagination Test 52');await waitFor("document.querySelectorAll('[data-shop-product]').length===1");assert((await evaluate("document.querySelector('.shop-pagination span').textContent")).includes('1 / 1'));await evaluate("document.querySelector('.shop-sidebar .shop-reset').click()");
 mode='hold';await refresh();for(let i=0;i<40&&!held;i++)await pause(50);assert(held);await waitFor("!!document.querySelector('.shop-grid [aria-busy=true]')");assert.equal(await evaluate("!!document.querySelector('[data-manga-loader]')"),false,'No full loader for filter/refetch');await screenshot('12b-shop-loading');mode='error';await cdp('Fetch.fulfillRequest',{requestId:held,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({success:false,error:{code:'TEST_ERROR',message:'Test'}})).toString('base64')});await waitFor("!!document.querySelector('.shop-grid [role=alert]')");assert.equal(await evaluate("document.querySelectorAll('[data-shop-product]').length"),0);await screenshot('12b-shop-error');
 mode='stock';await evaluate("document.querySelector('.shop-grid .empty button').click()");await waitFor(`document.querySelectorAll('[data-shop-product]').length===${original.length}`);assert(await evaluate("[...document.querySelector('[data-shop-product] .shop-card-actions').children].every(b=>b.disabled)"));
 mode='normal';await refresh();await waitFor("!document.querySelector('[data-shop-product] .shop-card-actions button').disabled");mode='stock-detail';await cdp('Fetch.enable',{patterns:[{urlPattern:'*api/product.php*',requestStage:'Request'}]});const selected=await evaluate("Number(document.querySelector('[data-shop-product]').dataset.shopProduct)");const start=requests.length;await evaluate("document.querySelector('.shop-card-actions button:first-child').click()");await waitFor(`!!document.querySelector('[data-buy-now-product="${selected}"]')`);assert((await evaluate("document.querySelector('[data-buy-now-checkout]').innerText")).includes('OUT OF STOCK'));assert(await evaluate("document.querySelector('[data-buy-now-checkout] .ink-btn').disabled"));assert.equal(requests.slice(start).filter(u=>/orders\/(create|quote)\.php/.test(u)).length,0);await screenshot('12b-buy-now-stock-changed');
 await cdp('Fetch.disable');socket.removeEventListener('message',handler);await evaluate("document.querySelector('.buy-now-cancel').click()");await waitFor("!!document.querySelector('[data-shop-catalog]')");

 await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await evaluate("document.querySelector('.shop-card-actions button:first-child').scrollIntoView({block:'center',behavior:'instant'})");const pos=await evaluate("(()=>{const r=document.querySelector('.shop-card-actions button:first-child').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...pos});assert.equal(await evaluate("getComputedStyle(document.querySelector('.shop-card-actions button:first-child')).transform"),'none');await cdp('Emulation.setEmulatedMedia',{features:[]});
 await evaluate(`sessionStorage.setItem('manga-buy-now-api',JSON.stringify({productId:${selected},quantity:1,mode:'api',price_vnd:1}));location.hash='#checkout/buy-now/${selected}';window.__invalidBuyReload=true;`);await cdp('Page.reload');await waitFor("!window.__invalidBuyReload&&!!document.querySelector('[data-buy-now-checkout]')");assert.equal(await evaluate("document.querySelectorAll('[data-buy-now-product]').length"),0,'Extra client price is rejected, not used as an order price');
 assert.equal(exceptions.length,0,JSON.stringify(exceptions));await writeFile(path.join(artifacts,'12b-resilience.json'),JSON.stringify({result:'PASS',checks:['53 response-only products: 24/24/5 pagination with no repeated IDs, search resets page; local loading without fullscreen; 503 error/no Demo fallback/retry; out-of-stock disables buttons; fresh detail stock0 safe; tampered price intent rejected; zero quote/create calls'],databaseWrites:false},null,2));console.log('PASS response-only Shop pagination/loading/error/retry/stock/intent-tamper safety; no database changes');
}finally{if(socket)socket.close();browser.kill();}
