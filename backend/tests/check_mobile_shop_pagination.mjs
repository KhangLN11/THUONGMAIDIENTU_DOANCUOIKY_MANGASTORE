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




 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');
 const raw=await(await fetch('http://localhost:8443/api/products.php')).json();
 const items=Array.from({length:40},(_,i)=>({...raw.data[i%raw.data.length],id:900000+i,sku:'UI-PAGINATION-TEST-'+i,name_vi:'UI TEST '+i+' | '+raw.data[i%raw.data.length].name_vi,name_en:'UI TEST '+i+' | '+raw.data[i%raw.data.length].name_en}));
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Fetch.requestPaused')void cdp('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({...raw,data:items,meta:{total:items.length}})).toString('base64')});});
 await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/products.php*',requestStage:'Request'}]});
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});await cdp('Page.navigate',{url:'http://localhost:8443/#shop'});await waitFor("document.querySelectorAll('[data-shop-product]').length===24");
 const ids=()=>evaluate("[...document.querySelectorAll('[data-shop-product]')].map(p=>p.dataset.shopProduct)");const first=await ids();await evaluate("document.querySelector('.shop-pagination button:last-child').click()");await waitFor("document.querySelectorAll('[data-shop-product]').length===16");const second=await ids();assert.equal(new Set([...first,...second]).size,40);
 await evaluate("(()=>{let e=document.querySelector('[name=shop_search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'UI TEST 3 |');e.dispatchEvent(new Event('input',{bubbles:true}));})()");await pause(150);assert.equal((await ids()).length,1);assert(await evaluate("document.querySelector('.shop-pagination span').textContent.startsWith('1 / 1')"));
 assert.equal(exceptions.length,0);await writeFile(path.join(artifacts,'16c-pagination.json'),JSON.stringify({result:'PASS',fixture:'40 synthetic API records intercepted in browser only; no database writes',unique:40,pageSizes:[24,16],filterResetsPage:true},null,2));console.log('PASS pagination browser-only fixture:24/16,40unique,filter resets page');
}finally{socket?.close();browser.kill();}
