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




 const demo=process.argv.includes('--demo');const report={mode:demo?'demo':'live',checks:[],screenshots:[]};
 const before=JSON.parse(await readFile(path.join(artifacts,'11d-before.json'),'utf8'));
 const nav=async page=>{await evaluate(`document.querySelector('.site-header nav button[aria-current="page"]')?.blur();[...document.querySelectorAll('.site-header nav button')].find(b=>b.textContent.trim()===${JSON.stringify(page)}).click()`);await pause(250);};
 const hash=async value=>{await evaluate(`location.hash=${JSON.stringify(value)}`);await pause(250);};
 await language('vi');await waitFor("!!document.querySelector('.hero')&&!document.querySelector('[data-manga-loader]')");
 assert.deepEqual(await evaluate("[...document.querySelectorAll('.site-header nav button')].map(b=>b.textContent.trim())"),['TRANG CHỦ','CỬA HÀNG','BỘ TRUYỆN','PHỤ KIỆN','VỀ CHÚNG TÔI']);
 for(const width of [1440,900,390]){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await evaluate('window.scrollTo(0,0)');
  const actual=await evaluate(`(()=>{const h=document.querySelector('.site-header'),b=h.querySelector('.brand'),r=b.getBoundingClientRect();return {height:h.getBoundingClientRect().height,brand:{width:r.width,height:r.height},icons:[...h.querySelectorAll('.header-actions svg')].map(e=>e.outerHTML),hero:document.querySelector('.hero').outerHTML}})()`);
  assert.equal(actual.height,before[width].height,'Header height');assert.equal(actual.brand.height,before[width].brand.height,'Logo height');assert(Math.abs(actual.brand.width-before[width].brand.width)<4,'Only natural flex space released by removed menu');assert.deepEqual(actual.icons,before[width].icons,'Original icons');assert.equal(actual.hero,before[width].hero,'Home hero DOM unchanged');
  await screenshot('11d-'+report.mode+'-home-'+width);if(width<=900){await evaluate("document.querySelector('.header-actions .menu').click()");await screenshot('11d-'+report.mode+'-navbar-open-'+width);await evaluate("document.querySelector('.header-actions .menu').click()");}
 }
 report.checks.push('Home hero DOM, logo size, Navbar height/icons unchanged at all widths; five nav items');
 await nav('CỬA HÀNG');await waitFor("!!document.querySelector('.shop-grid .product-card')");assert.equal(await evaluate('location.hash'),'#shop');
 if(!demo)assert.equal(await evaluate("document.querySelectorAll('.shop-grid .product-card').length"),23);
 await nav('PHỤ KIỆN');await waitFor("!!document.querySelector('[data-figure-collections] .product-card')");assert.equal(await evaluate('location.hash'),'#collections');assert.equal(await evaluate("!!document.querySelector('.shop-grid')"),false);
 if(!demo){assert.equal(await evaluate("document.querySelectorAll('[data-figure-group]').length"),5);assert.equal(await evaluate("document.querySelectorAll('[data-discovery-product]').length"),6);
 await evaluate("const s=document.querySelector('[name=figure_category]');s.value='accessories';s.dispatchEvent(new Event('change',{bubbles:true}))"); // native controlled select uses input event setter
 await evaluate("document.querySelector('[name=figure_category]').dispatchEvent(new Event('input',{bubbles:true}))");
 await waitFor("!!document.querySelector('.discovery-empty')");assert.equal(await evaluate("document.querySelectorAll('[data-discovery-product]').length"),0);
 await evaluate("[...document.querySelectorAll('.discovery-text-button')].find(b=>b.textContent.includes('ĐẶT LẠI')).click()");await waitFor("document.querySelectorAll('[data-discovery-product]').length===6");
 }
 await nav('VỀ CHÚNG TÔI');await waitFor("!!document.querySelector('[data-about-page]')");assert.equal(await evaluate('location.hash'),'#about');assert((await evaluate("document.querySelector('[data-about-page]').innerText")).includes('đồ án'));assert.equal(await evaluate("!!document.querySelector('.hero')"),false);
 await reload();await waitFor("!!document.querySelector('[data-about-page]')");await language('en');assert.equal(await evaluate('location.hash'),'#about');assert((await evaluate("document.querySelector('[data-about-page]').innerText")).includes('course project'));
 assert.deepEqual(await evaluate("[...document.querySelectorAll('.site-header nav button')].map(b=>b.textContent.trim())"),['HOME','SHOP','SERIES','ACCESSORIES','ABOUT US']);
 await nav('ACCESSORIES');await waitFor("!!document.querySelector('[data-figure-collections]')");await evaluate('history.back()');await waitFor("!!document.querySelector('[data-about-page]')");await evaluate('history.forward()');await waitFor("!!document.querySelector('[data-figure-collections]')");await reload();await waitFor("!!document.querySelector('[data-figure-collections] .product-card')");
 await nav('SERIES');if(!demo){await waitFor("document.querySelectorAll('[data-series-card]').length===7");assert.equal(await evaluate("document.querySelectorAll('[data-figure-collections]').length"),0);assert.equal(await evaluate("document.querySelectorAll('[data-live-hero]').length"),1);await evaluate("[...document.querySelectorAll('.discovery-text-button')].find(b=>b.textContent.includes('FIGURE')).click()");await waitFor("!!document.querySelector('[data-figure-collections]')");}
 for(const width of [1440,900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});for(const page of ['shop','series','collections','about']){
 await hash('#'+page);await waitFor("!!document.querySelector('main')");await evaluate('window.scrollTo(0,0)');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'No overflow '+page+' '+width);assert.equal(await evaluate("document.querySelectorAll('.site-header nav button[aria-current=page]').length"),1);await screenshot('11d-'+report.mode+'-'+page+'-'+width);report.screenshots.push('11d-'+report.mode+'-'+page+'-'+width+'.png');
 }}
 await hash('#about');await evaluate("[...document.querySelectorAll('.about-ending button')][0].click()");assert.equal(await evaluate('location.hash'),'#series');
 report.checks.push('Shop/Collections distinct; About/refresh/Back/Forward; VI/EN; CTA; Series excludes Figures; page screenshots/no horizontal overflow 1440/900/390');
 if(demo)assert.equal(requests.filter(u=>/\/api\/(products|product)\.php/.test(u)).length,0,'No live product requests in Demo');
 assert.equal(exceptions.length,0,JSON.stringify(exceptions));assert.equal(consoleErrors.length,0,JSON.stringify(consoleErrors));report.result='PASS';await writeFile(path.join(artifacts,'11d-navigation-'+report.mode+'.json'),JSON.stringify(report,null,2));console.log('PASS '+report.mode+' Navbar/routes/About/Collections/Series/responsive/VI-EN; Home hero and original header preserved');
}finally{if(socket)socket.close();browser.kill();}
