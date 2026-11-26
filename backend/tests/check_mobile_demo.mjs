import { spawn,spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
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
  const waitFor = async expression => { for(let i=0;i<100;i++){ try{if(await evaluate(expression))return;}catch{} await pause(100); } console.log(await evaluate("({hash:location.hash,marker:window.__auditReloadMarker,body:document.body.innerText.slice(0,900)})"));throw new Error('Timeout: '+expression); };
  const reload = async () => {
    await evaluate('window.__testReload = true');
    await cdp('Page.reload');
    await waitFor("!window.__testReload && document.querySelectorAll('.site-header nav button').length >= 2");
  };
  const language = async value => { await evaluate(`document.querySelectorAll('.language-switcher button')[${value==='vi'?0:1}].click()`); await pause(80); };
  const navigate = async page => { await evaluate(`document.querySelectorAll('.site-header nav button')[${page==='shop'?1:0}].click()`); await pause(80); };
  const screenshot = async name => { await pause(80); const r=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}); await writeFile(path.join(artifacts,name+'.png'),Buffer.from(r.data,'base64')); };




 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');
 await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await cdp('Page.navigate',{url:'http://localhost:8443/#home'});await waitFor("!!document.querySelector('.hero')");
 if(!process.argv.includes('--account'))await evaluate("document.querySelector('.arrivals .quick-actions button:last-child').click();document.querySelector('.arrivals .wish').click()");
 const report={mode:'demo',pages:[],exceptions};
 const routes=process.argv.includes('--account')?[['account','#account','.account-metrics'],['orders','#account/orders','.customer-account']]:[['home','#home','.hero'],['series','#series','.series-hero'],['collections','#collections','.discovery-collections-page'],['product','#product/demo/1','.accordions'],['cart','#cart','.cart-row'],['wishlist','#wishlist','.product-card'],['checkout','#checkout','.checkout-fields'],['payment','#checkout','.checkout-fields'],['success','#checkout','[data-checkout-demo]'],['login','#account','.account-page form'],['about','#about','.about-contact'],['maps','#about/contact','.about-map']];
 if(process.argv.includes('--account')){const f=JSON.parse(await readFile((await readFile(path.join(artifacts,'16d-fixture-path.txt'),'utf8')).trim(),'utf8'));await cdp('Network.setCookies',{cookies:f.cookies.customer});await reload();}
 const field=async(name,value)=>evaluate(`(()=>{let e=document.querySelector('[name=${name}]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 for(const [name,hash,ready] of routes){
  await cdp('Page.navigate',{url:'http://localhost:8443/'+hash});await waitFor(`!!document.querySelector(${JSON.stringify(ready)})`);
  if(['payment','success'].includes(name)){
   if(await evaluate("!!document.querySelector('.checkout-fields')")){
    for(const [k,v] of Object.entries({recipient_name:'Demo Reader',recipient_phone:'0900000000',province:'Test',ward:'Test',address_line:'Demo address'}))await field(k,v);
    await evaluate("document.querySelector('.checkout-content form').requestSubmit()");await waitFor("!!document.querySelector('.checkout-methods')");
   }
   if(name==='success'){await evaluate("document.querySelector('.checkout-content form').requestSubmit()");await waitFor("!document.querySelector('.checkout-content form')");}
  }
  const samples=[];
  for(const width of [320,360,375,390,430,480,768,900,1440]){
   await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<=600});
   for(const lang of ['vi','en']){
    await language(lang);await pause(150);await evaluate('window.scrollTo(0,0)');
    if(name==='maps')await evaluate("document.querySelector('.about-map').scrollIntoView()");
    const metrics=await evaluate("({overflow:document.documentElement.scrollWidth>innerWidth,width:document.documentElement.scrollWidth})");
    samples.push({width,lang,...metrics});
    if(width===390||width===900||width===1440)await screenshot(`16d-demo-${name}-${lang}-${width}`);
   }
  }
  report.pages.push({name,samples});console.log(name+': overflow='+samples.filter(s=>s.overflow).length);
 }
 assert(!requests.some(u=>/\/api\/(products|orders|cart|wishlist)/.test(u)),'Demo must not call commerce Live APIs');
 assert.equal(exceptions.length,0);assert.equal(consoleErrors.length,0);report.result=report.pages.every(p=>p.samples.every(s=>!s.overflow))?'PASS':'OVERFLOW';await writeFile(path.join(artifacts,process.argv.includes('--account')?'16d-demo-account.json':'16d-demo-matrix.json'),JSON.stringify(report,null,2));assert.equal(report.result,'PASS');
}finally{socket?.close();browser.kill();}
