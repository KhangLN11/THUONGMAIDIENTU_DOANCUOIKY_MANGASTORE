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


 const raw=await(await fetch('http://localhost:8443/api/products.php')).json();const original=raw.data;let variant='error';const report={checks:[]};
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method!=='Fetch.requestPaused')return;let rows=structuredClone(original);if(variant==='missing-image')for(const p of rows.filter(p=>p.series?.slug==='one-piece')){p.image_url=null;p.images=[];}if(variant==='refetch')rows=rows.filter(p=>!(p.series?.slug==='one-piece'&&p.name_en.includes('Vol. 1')));if(variant==='out-of-stock')rows.find(p=>p.series?.slug==='one-piece'&&p.name_en.includes('Vol. 1')).stock_quantity=0;if(variant==='image-refetch'){const p=rows.find(p=>p.sku==='CAT-FG-FRI-PUP');p.image_url=p.images[1].image_url;for(const [i,image] of p.images.entries())image.is_primary=i===1;}
 const body=variant==='error'?{success:false,error:{code:'SERVER_ERROR'}}:{success:true,data:rows,meta:{total:rows.length}};void cdp('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:variant==='error'?503:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(body)).toString('base64')}).catch(()=>{});});
 const enable=()=>cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/products.php',requestStage:'Request'}]});const refresh=()=>evaluate("window.dispatchEvent(new CustomEvent('manga-products-updated',{detail:{productId:11}}))");
 await enable();await cdp('Page.navigate',{url:'http://localhost:8443/?discovery-error=1#series'});await waitFor("!!document.querySelector('.hero-live [role=alert]') && !document.querySelector('[data-manga-loader]')");assert(!/VOID RUNNER|Neo Tokyo|Blade Zero/.test(await evaluate("document.querySelector('.hero-live').textContent")));await screenshot('11b-hero-api-error');await cdp('Fetch.disable');await evaluate("document.querySelector('.hero-live .ink-btn').click()");await waitFor("document.querySelectorAll('[data-hero-series]').length===4");assert.equal(await evaluate("!!document.querySelector('[data-manga-loader]')"),false);report.checks.push('essential API 503 exits original loader, shows Hero error/retry and never falls back to fictional Demo');
 variant='missing-image';await enable();await refresh();await waitFor("document.querySelector('[data-hero-series=one-piece] img')?.getAttribute('src')==='/product-placeholder.svg'");assert((await evaluate("document.querySelector('[data-hero-series=one-piece]').textContent")).includes('Cover image unavailable'));await screenshot('11b-hero-no-image');
 variant='refetch';await evaluate("window.location.hash='#admin'");await waitFor("!!document.querySelector('.admin-auth')");await evaluate("window.location.hash='#series/one-piece'");const volume2=original.find(p=>p.series?.slug==='one-piece'&&p.name_en.includes('Vol. 2'));await waitFor("document.querySelectorAll('[data-volume-number]').length===1");await evaluate("document.querySelectorAll('.site-header nav button')[2].click()");await waitFor(`document.querySelector('[data-hero-series=one-piece] img')?.getAttribute('src')===${JSON.stringify(volume2.image_url)}`);assert((await evaluate("document.querySelector('[data-hero-series=one-piece]').textContent")).includes('1 volumes in store'));await evaluate("window.location.hash='#series/one-piece'");await waitFor("document.querySelectorAll('[data-volume-number]').length===1");assert.equal(await evaluate("document.querySelector('[data-volume-number]').dataset.volumeNumber"),'2');
 variant='out-of-stock';await refresh();await waitFor("document.querySelector('[data-volume-number=\"1\"] .discovery-card-actions button:last-child')?.disabled===true");await evaluate("document.querySelector('[name=volume_in_stock]').click()");await waitFor("document.querySelectorAll('[data-volume-number]').length===1");assert.equal(await evaluate("document.querySelector('[data-volume-number]').dataset.volumeNumber"),'2');
 await cdp('Fetch.disable');await refresh();await waitFor("document.querySelectorAll('[data-volume-number]').length===2");report.checks.push('response-only fixtures: missing image placeholder; refetch updates Hero cover/count and Series volumes; restored real API returns both volumes without full-screen loader');
 variant='image-refetch';await enable();await evaluate("window.location.hash='#collections/frieren-beyond-journeys-end'");await refresh();const frieren=original.find(p=>p.sku==='CAT-FG-FRI-PUP');await waitFor(`document.querySelector('[data-discovery-product="${frieren.id}"] img')?.getAttribute('src')===${JSON.stringify(frieren.images[1].image_url)}`);await cdp('Fetch.disable');await refresh();await waitFor(`document.querySelector('[data-discovery-product="${frieren.id}"] img')?.getAttribute('src')===${JSON.stringify(frieren.image_url)}`);assert.equal(await evaluate("!!document.querySelector('[data-manga-loader]')"),false);report.checks.push('response-only primary-photo refetch uses another real photo of the same figure, then returns to database primary without cache reset');
 await evaluate("window.location.hash='#series/not-a-real-series'");await waitFor("document.querySelector('.discovery-header h1')?.textContent.includes('no available manga')");await screenshot('11b-series-not-found');report.checks.push('unknown series does not navigate to an unrelated product');
 const unexpected=consoleErrors.filter(args=>!JSON.stringify(args).includes('503'));assert.equal(exceptions.length,0,JSON.stringify(exceptions));assert.equal(unexpected.length,0,JSON.stringify(unexpected));report.result='PASS';report.exceptions=exceptions;report.unexpectedConsoleErrors=unexpected;await writeFile(path.join(artifacts,'discovery-resilience.json'),JSON.stringify(report,null,2));console.log('PASS Discovery API-error/placeholder/not-found and response-only refetch probes; no database or file writes');
}finally{if(socket)socket.close();browser.kill();}
