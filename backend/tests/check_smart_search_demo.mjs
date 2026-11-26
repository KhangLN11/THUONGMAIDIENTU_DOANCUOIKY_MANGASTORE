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



 const report={mode:'demo',viewports:[],checks:[],exceptions};
 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');await cdp('Page.navigate',{url:'http://localhost:8443/#shop'});await waitFor("document.querySelectorAll('[data-shop-product]').length>0");await language('en');
 const expected=await evaluate("[...document.querySelectorAll('[data-shop-product]')].find(p=>p.querySelector('.shop-product-name').textContent.includes('Ronin')).dataset.shopProduct");
 const field=async(name,value)=>evaluate(`(()=>{let e=document.querySelector('[name=${name}]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const search=async q=>{await evaluate("document.querySelector('[name=shop_search]').focus()");await field('shop_search',q);await pause(500);};
 for(const width of [320,360,390,430,900,1440]){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});
  for(const lang of ['vi','en']){
   await language(lang);await search('ronni');assert.equal(await evaluate("document.querySelector('[data-smart-search] a')?.hash"),'#product/demo/'+expected);
   assert.equal(await evaluate("document.querySelectorAll('[data-shop-product]').length"),1);assert(await evaluate("document.documentElement.scrollWidth<=innerWidth"));await screenshot(`17a-demo-${lang}-${width}`);report.viewports.push({width,lang});
  }
 }
 await search('aot');assert.equal(await evaluate("document.querySelectorAll('[data-smart-search] a').length"),0);await search('manga dưới 50k');assert(await evaluate("document.querySelector('[data-smart-search]').textContent.includes('Demo prices use USD')"));assert.equal(await evaluate("document.querySelectorAll('[data-shop-product]').length"),0);
 await search('ronni');await evaluate("document.querySelector('[data-smart-search] a').click()");await waitFor("!!document.querySelector('.product-page')");assert.equal(await evaluate('location.hash'),'#product/demo/'+expected);await evaluate('history.back()');await waitFor("!!document.querySelector('.shop-catalog')");
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await evaluate("document.querySelector('.header-actions>button:first-of-type').click()");await waitFor("!!document.querySelector('[name=global_search]')");await field('global_search','ronni');await pause(500);assert.equal(await evaluate("document.querySelector('[data-smart-search] a').hash"),'#product/demo/'+expected);await screenshot('17a-demo-global');
 assert(!requests.some(u=>/\/api\/(?:products\.php|orders\/|cart\/|wishlist\/)/.test(u)));assert.equal(exceptions.length,0);report.result='PASS';report.checks=['local Demo normalized/fuzzy labels VI/EN; correct Demo ID route; no Live catalog/commerce calls; missing AOT alias target yields empty; VND queries never compare against USD demo prices'];await writeFile(path.join(artifacts,'17a-demo-tests.json'),JSON.stringify(report,null,2));console.log('PASS Demo Smart Search six widths VI/EN, route and no Live catalog calls');
}finally{socket?.close();browser.kill();}
