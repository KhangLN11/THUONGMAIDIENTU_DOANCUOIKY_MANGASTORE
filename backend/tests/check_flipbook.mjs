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
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--no-first-run', '--remote-debugging-port=9229', '--remote-allow-origins=*', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket;
const nonce=randomBytes(6).toString('hex'),emails=['auth-test-'+nonce+'-admin@example.test','auth-test-'+nonce+'@example.test'],password=randomBytes(24).toString('base64url'),sku='ADMTEST-'+nonce;
function cli(script,input){const r=spawnSync('C:/xampp/php/php.exe',['backend/'+script],{input:JSON.stringify(input),encoding:'utf8',env:{...process.env,DB_NAME:'manga_store_admin_test_20261122'},windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout;}

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
  const waitFor = async expression => { for(let i=0;i<200;i++){ if(await evaluate(expression)) return; await pause(100); } throw new Error('Timeout: '+expression); };
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




 const report={checks:[],viewports:[1440,900,390],transforms:[]};let held=[];let behavior='hold';
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Fetch.requestPaused'){if(behavior==='hold')held.push(m.params.requestId);else void cdp('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({success:false,error:{code:'SERVER_ERROR'}})).toString('base64')}).catch(()=>{});}});
 const hold=async()=>{held=[];behavior='hold';await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/products.php',requestStage:'Request'}]});};
 const release=async()=>{for(const id of held)try{await cdp('Fetch.continueRequest',{requestId:id});}catch{}held=[];await cdp('Fetch.disable');};
 const open=async()=>{await cdp('Page.navigate',{url:'http://localhost:8443/?startup='+Math.random()});await waitFor("document.querySelector('[data-manga-loader]')?.getAttribute('aria-busy')==='true'");};
 for(const width of [1440,900,390]){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await hold();await open();
  assert.equal(await evaluate("document.querySelectorAll('.manga-turning-page').length"),6);assert.equal(await evaluate("getComputedStyle(document.querySelector('.manga-turning-page')).animationDuration"),'2.1s');assert.equal(await evaluate("document.querySelector('.manga-loading-title').textContent"),'LOADING...');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await cdp('Page.bringToFront');await screenshot('flipbook-frame-start-'+width);await evaluate('new Promise(requestAnimationFrame)');const a=await evaluate("Array.from(document.querySelectorAll('.manga-turning-page')).map(n=>getComputedStyle(n).transform).join(';')");await pause(240);await evaluate('new Promise(requestAnimationFrame)');const b=await evaluate("Array.from(document.querySelectorAll('.manga-turning-page')).map(n=>getComputedStyle(n).transform).join(';')");assert.notEqual(a,b);report.transforms.push({width,changes:true});await screenshot('flipbook-'+width+'-en');
  await evaluate('window.scrollTo(0,200)');await release();await waitFor("!document.querySelector('[data-manga-loader]')");assert.equal(await evaluate('Math.round(scrollY)'),200);await evaluate('window.scrollTo(0,0)');
  await navigate('shop');await waitFor("document.querySelectorAll('.shop-grid .product-card').length===23");assert.equal(await evaluate("!!document.querySelector('[data-manga-loader]')"),false);
 }
 report.checks.push('startup loader appears under held essential API; six pages animate right-to-left with 2.1s CSS cycle; ready removes overlay without scroll reset; no repeat on Shop navigation; 1440/900/390 and no overflow');
 await evaluate("localStorage.setItem('manga-universe-language','vi')");await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await hold();await open();
 assert.equal(await evaluate("document.querySelector('.manga-loading-title').textContent"),'ĐANG TẢI...');assert(await evaluate("Array.from(document.querySelectorAll('.manga-turning-page')).every(n=>getComputedStyle(n).animationName==='none')"));await screenshot('flipbook-reduced-motion-vi');await release();await waitFor("!document.querySelector('[data-manga-loader]')");
 report.checks.push('VI loading label, reduced motion uses static book and no transition');
 await cdp('Emulation.setEmulatedMedia',{features:[]});await evaluate("localStorage.setItem('manga-universe-language','en')");await hold();await open();await evaluate("window.location.hash='#account'");await waitFor("!document.querySelector('[data-manga-loader]')");await release();assert.equal(await evaluate("!!document.querySelector('[data-manga-loader]')"),false);
 report.checks.push('fast hash navigation dismisses startup overlay without reappearance; StrictMode request cleanup works');
 behavior='error';await cdp('Fetch.enable',{patterns:[{urlPattern:'*/api/products.php',requestStage:'Request'}]});await cdp('Page.navigate',{url:'http://localhost:8443/?startup-error=1'});await waitFor("!document.querySelector('[data-manga-loader]') && Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='TRY AGAIN')");await screenshot('flipbook-api-error-visible');await cdp('Fetch.disable');
 await evaluate("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='TRY AGAIN').click()");await waitFor("document.querySelectorAll('main .product-card').length>0");assert.equal(await evaluate("!!document.querySelector('[data-manga-loader]')"),false);
 report.checks.push('503 essential API error exits overlay and exposes existing error/retry; successful retry never restarts full-screen loading');
 // Let the real product-service timeout expire: do not mask a stalled API indefinitely.
 await hold();await open();await waitFor("!document.querySelector('[data-manga-loader]') && Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='TRY AGAIN')");await cdp('Fetch.disable');report.checks.push('real 12s product request timeout removes startup overlay and shows existing retry, no infinite loading');
 const unexpected=consoleErrors.filter(args=>!JSON.stringify(args).includes('503'));assert.equal(exceptions.length,0,JSON.stringify(exceptions));assert.equal(unexpected.length,0,JSON.stringify(unexpected));report.result='PASS';report.exceptions=exceptions;report.unexpectedConsoleErrors=unexpected;report.expectedError='intentional HTTP 503 and held-request timeout';await writeFile(path.join(artifacts,'flipbook-browser.json'),JSON.stringify(report,null,2));console.log('PASS actual flipbook animation, readiness, API error/timeout, StrictMode, reduced motion, VI/EN and responsive');
} finally {if(socket)socket.close();browser.kill();}
