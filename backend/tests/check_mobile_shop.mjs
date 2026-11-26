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


 const before=process.argv.includes('--before');const demo=process.argv.includes('--demo');
 const report={mode:demo?'demo':'live',before,viewports:[],exceptions};
 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');
 await cdp('Page.navigate',{url:'http://localhost:8443/#shop'});await waitFor("document.querySelectorAll('[data-shop-product]').length>0");await language('vi');await evaluate('document.fonts.ready.then(()=>true)');await pause(600);
 const baselineData=before?null:JSON.parse(await readFile(path.join(artifacts,'16c-before.json'),'utf8'));
 for(const width of before?[390,900,1440]:[320,360,375,390,430,480,900,1440]){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await evaluate('window.scrollTo({top:0,behavior:"instant"})');await pause(200);
  const stats=await evaluate(`(()=>{const selectors=['.page-hero','.page-hero h1','.shop-toolbar','.shop-sidebar','.shop-grid','.shop-grid .product-card','.shop-grid .product-img','.shop-grid .shop-card-actions'];return Object.fromEntries(selectors.map(sel=>{const e=document.querySelector(sel);if(!e)return[sel,null];const s=getComputedStyle(e),r=e.getBoundingClientRect();return[sel,{x:r.x,y:r.y,width:r.width,height:r.height,font:s.font,grid:s.gridTemplateColumns,padding:s.padding,gap:s.gap}]}))})()`);
  await screenshot(`16c-${before?'before':report.mode+'-after'}-${width}`);
  await evaluate("document.querySelector('.shop-grid').scrollIntoView({block:'start',behavior:'instant'})");await screenshot(`16c-${before?'before':report.mode+'-after'}-cards-${width}`);
  if(!before){
   const columns=await evaluate("getComputedStyle(document.querySelector('.shop-grid')).gridTemplateColumns.split(' ').length");assert.equal(columns,width===1440?4:2);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
   assert(await evaluate("[...document.querySelectorAll('.shop-card-actions button')].every(b=>b.getBoundingClientRect().height>=44)"));
   assert(await evaluate("[...document.querySelectorAll('.shop-grid .product-img>img')].every(i=>getComputedStyle(i).objectFit==='contain')"));
   if(width>=900&&!demo)assert.deepEqual(stats,baselineData.viewports.find(v=>v.width===width).stats);
   await language('en');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await screenshot(`16c-${report.mode}-en-cards-${width}`);await language('vi');
  }
  report.viewports.push({width,stats});
 }
 assert.equal(exceptions.length,0);report.result='PASS';await writeFile(path.join(artifacts,`16c-${before?'before':report.mode+'-visual'}.json`),JSON.stringify(report,null,2));console.log('PASS '+(before?'baseline':'mobile grid/VI-EN/contain/touch targets/desktop styles'));
}finally{socket?.close();browser.kill();}
