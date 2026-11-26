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



 const report={checks:[],viewports:[],exceptions};
 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 const raw=(await(await fetch('http://localhost:8443/api/products.php')).json()).data;
 const idSet=slug=>raw.filter(p=>p.series?.slug===slug).map(p=>p.id);
 const field=async(name,value)=>evaluate(`(()=>{let e=document.querySelector('[name=${name}]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const key=async(k,code,number)=>{await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:k,code,windowsVirtualKeyCode:number});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:k,code,windowsVirtualKeyCode:number});};
 const click=async(selector,touch=false)=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'nearest',behavior:'instant'})`);const r=await evaluate(`(()=>{let r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);if(touch){await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[r]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}else {await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...r,button:'left',clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...r,button:'left',clickCount:1});}};
 const go=async hash=>{await cdp('Page.navigate',{url:'http://localhost:8443/'+hash});await evaluate('window.__searchReload=true');await cdp('Page.reload');await waitFor("!window.__searchReload&&!!document.querySelector('.site-header')");await pause(200);};
 const ids=()=>evaluate("[...document.querySelectorAll('[data-smart-search] a')].map(a=>Number(a.hash.split('/').at(-1)))");
 const gridIds=()=>evaluate("[...document.querySelectorAll('[data-shop-product]')].map(a=>Number(a.dataset.shopProduct))");
 const search=async q=>{await evaluate("document.querySelector('[name=shop_search]').focus()");await field('shop_search',q);await pause(500);};
 // Idle comparison uses the exact same viewport/language/state as the pre-edit baseline.
 for(const route of ['home','shop']){
  await go('#'+route);await waitFor("document.querySelectorAll('.product-card').length>0");await pause(500);await language('vi');
  for(const width of [320,360,390,430,900,1440]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await evaluate('window.scrollTo(0,0)');await screenshot(`17a-after-${route}-${width}`);}
 }
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await search('one pice');assert.deepEqual(await ids(),idSet('one-piece'));assert.deepEqual(await gridIds(),idSet('one-piece'));await screenshot('17a-fuzzy-suggestions-desktop');
 await key('ArrowDown','ArrowDown',40);assert(await evaluate("!!document.querySelector('[aria-activedescendant]')"));await key('Enter','Enter',13);await waitFor("!!document.querySelector('.product-page')");assert.equal(await evaluate('location.hash'),'#product/'+idSet('one-piece')[0]);
 await evaluate('history.back()');await waitFor("!!document.querySelector('[name=shop_search]')");assert.equal(await evaluate("document.querySelector('[name=shop_search]').value"),'one pice');await pause(400);assert.deepEqual(await gridIds(),idSet('one-piece'));
 await search('aot');await key('Enter','Enter',13);assert.equal(await evaluate('location.hash'),'#shop?q=aot');await cdp('Page.reload');await waitFor("document.querySelectorAll('[data-shop-product]').length===2");assert.equal(await evaluate("document.querySelector('[name=shop_search]').value"),'aot');
 await evaluate("[...document.querySelectorAll('.shop-sidebar .shop-filter-choice')].find(b=>b.textContent.includes('Mô hình')).click()");await pause(350);assert.equal((await gridIds()).length,0);await evaluate("document.querySelector('.shop-reset').click()");await pause(350);
 await search('manga dưới 50k');const priceIds=await gridIds();assert(priceIds.length>0);assert(priceIds.every(id=>{let p=raw.find(p=>p.id===id);return p.category.slug==='manga'&&(p.sale_price_vnd??p.price_vnd)<50000;}));await screenshot('17a-price-query');
 await search('naruto tập 2');assert.equal((await gridIds()).length,1);assert.equal((await ids()).length,1);
 await search('naruto tập 999');assert.equal((await gridIds()).length,0);assert.equal((await ids()).length,0);await screenshot('17a-empty-search');
 const requestsBefore=requests.filter(u=>u.includes('/api/products.php')).length;
 await field('shop_search','narto');await pause(50);await field('shop_search','one pice');await pause(50);await field('shop_search','');await pause(500);assert.equal(await evaluate("!!document.querySelector('[data-smart-search]')"),false);assert.equal(requests.filter(u=>u.includes('/api/products.php')).length,requestsBefore);
 await search('narto');await key('Escape','Escape',27);assert.equal(await evaluate("!!document.querySelector('[data-smart-search]')"),false);await evaluate("document.querySelector('[name=shop_search]').blur();document.querySelector('[name=shop_search]').focus()");await waitFor("!!document.querySelector('[data-smart-search]')");await click('.page-hero');assert.equal(await evaluate("!!document.querySelector('[data-smart-search]')"),false);
 report.checks.push('Shop fuzzy/alias/ranking; Arrow+Enter Product Detail; Back/query retained; query deep link refresh; category AND query; real price/volume constraints; empty; fast input/clear no stale result and no per-query API; Escape/outside');
 await go('#home');await waitFor("!!document.querySelector('.hero')");await click('.header-actions>button:first-of-type');await waitFor("!!document.querySelector('.manga-search-dialog[open]')");await field('global_search','aot');await pause(500);assert.deepEqual(await ids(),idSet('attack-on-titan'));assert(await evaluate("!!document.querySelector('.manga-search-dialog [data-smart-search]')"));await screenshot('17a-navbar-search-desktop');
 await click('[data-smart-search] a');await waitFor("!!document.querySelector('.product-page')");assert.equal(await evaluate('location.hash'),'#product/'+idSet('attack-on-titan')[0]);
 await go('#home');await waitFor("!!document.querySelector('.hero')");await click('.header-actions>button:first-of-type');await waitFor("!!document.querySelector('[name=global_search]')");await field('global_search','narto');await pause(450);await key('Enter','Enter',13);await waitFor("!!document.querySelector('[data-shop-catalog]')");assert.equal(await evaluate('location.hash'),'#shop?q=narto');await pause(400);assert.deepEqual(await gridIds(),idSet('naruto'));
 report.checks.push('existing Navbar icon opens search only; native mouse inside modal dropdown; suggestions not inert/behind Hero; Enter to Shop query');
 for(const width of [320,360,390,430,900,1440]){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await search('one pice');
  for(const lang of ['vi','en']){await language(lang);await pause(350);const fit=await evaluate("(()=>{let p=document.querySelector('[data-smart-search]'),r=p.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom,overflow:document.documentElement.scrollWidth>innerWidth,columns:getComputedStyle(document.querySelector('.shop-grid')).gridTemplateColumns.split(' ').length,touch:[...p.querySelectorAll('a,button')].every(e=>e.getBoundingClientRect().height>=44)}})()");assert(!fit.overflow&&fit.left>=0&&fit.right<=width&&fit.bottom<=1000&&fit.touch);assert.equal(fit.columns,width===1440?4:2);report.viewports.push({width,lang,...fit});await screenshot(`17a-shop-dropdown-${lang}-${width}`);}
  await evaluate("document.querySelector('[name=shop_search]').blur()");
 }
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:700,deviceScaleFactor:1,mobile:true});await go('#home');await waitFor("!!document.querySelector('.hero')");await click('.menu',true);await waitFor("document.querySelector('.menu').getAttribute('aria-expanded')==='true'");await click('.mobile-nav-tools a:first-child',true);await waitFor("!!document.querySelector('.manga-search-dialog[open]')");await field('global_search','onepiece');await pause(500);await screenshot('17a-navbar-search-mobile');await click('[data-smart-search] a',true);await waitFor("!!document.querySelector('.product-page')");assert.equal(await evaluate('location.hash'),'#product/'+idSet('one-piece')[0]);report.checks.push('six viewports VI/EN; original grid4/2; mobile menu shortcut, native touch result in top-layer modal; scroll bounded');
 // A timed-out catalog read must end with retry, never silently switch to Demo.
 let fail=true;await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/products.php*'}]});
 socket.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.method==='Fetch.requestPaused')void cdp(fail?'Fetch.failRequest':'Fetch.continueRequest',fail?{requestId:m.params.requestId,errorReason:'TimedOut'}:{requestId:m.params.requestId}).catch(()=>{});});
 await go('#shop');await waitFor("!!document.querySelector('[name=shop_search]')");await search('naruto');await waitFor("document.querySelector('[data-smart-search]')?.textContent.includes('Catalog unavailable')||document.querySelector('[data-smart-search]')?.textContent.includes('Không tải được')");assert.equal((await ids()).length,0);await screenshot('17a-search-api-error');fail=false;await evaluate("document.querySelector('[data-smart-search] button').click()");await waitFor("document.querySelectorAll('[data-smart-search] a').length===2");await cdp('Fetch.disable');report.checks.push('simulated catalog timeout ends loading, honest error/retry, no Demo fallback; retry restores real matches');
 assert.equal(exceptions.length,0,JSON.stringify(exceptions));report.result='PASS';await writeFile(path.join(artifacts,'17a-browser-tests.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({result:report.result,checks:report.checks,viewports:report.viewports.length}));
}finally{socket?.close();browser.kill();}
