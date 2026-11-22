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


 const report={checks:[],viewports:[1440,900,390],homeAssets:[]};
 await language('vi');await waitFor("!!document.querySelector('.hero') && !document.querySelector('[data-manga-loader]')");
 assert.equal(await evaluate("document.querySelectorAll('[data-live-hero]').length"),0);
 const text=await evaluate("document.querySelector('.hero h1').innerText.replace(/\\s+/g,' ').trim()");assert(/BƯỚC VÀO/.test(text)&&/THẾ GIỚI/.test(text)&&/MANGA/.test(text));
 assert.equal(await evaluate("document.querySelectorAll('.hero-ctas button').length"),2);assert(await evaluate("getComputedStyle(document.querySelector('.hero')).backgroundImage.includes('radial-gradient')"));assert(await evaluate("!!document.querySelector('.character-art .head') && !!document.querySelector('.speech')"));assert((await evaluate("getComputedStyle(document.querySelector('.character-art')).animationName")).includes('float'));
 await pause(500);report.homeAssets=await evaluate("Array.from(document.querySelectorAll('.hero-stage .panel img')).map(i=>({src:i.src,loaded:i.complete&&i.naturalWidth>0}))");
 for(const width of [1896,1440,900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:width===1896?982:1000,deviceScaleFactor:1,mobile:width===390});await evaluate('window.scrollTo(0,0)');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await screenshot('11c-home-'+width+'-vi');}
 await btnHomeSeries();
 async function btnHomeSeries(){await evaluate("document.querySelectorAll('.hero-ctas button')[0].click()");await waitFor("document.querySelectorAll('[data-hero-series]').length===4");}
 assert.equal(await evaluate("location.hash"),'#series');assert.equal(await evaluate("document.querySelectorAll('[data-live-hero]').length"),1);assert.equal(await evaluate("!!document.querySelector('.hero')"),false);assert.equal(await evaluate("document.querySelectorAll('[data-series-card]').length"),7);
 assert(await evaluate("document.querySelector('[data-series-hero-slot]').compareDocumentPosition(document.querySelector('.discovery-header')) & Node.DOCUMENT_POSITION_FOLLOWING"));
 for(const width of [1440,900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await evaluate('window.scrollTo(0,0)');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));for(let i=0;i<4;i++){await evaluate("document.querySelector('.hero-live-controls > button:nth-of-type(2)').click()");const fit=await evaluate("(()=>{const a=document.querySelector('.hero-live-slide.active'),h=a.querySelector('h1').getBoundingClientRect(),b=a.querySelector('.ink-btn').getBoundingClientRect(),image=a.querySelector('.hero-live-art').getBoundingClientRect(),r=a.getBoundingClientRect();return h.right<=innerWidth&&b.bottom<=image.top+15||innerWidth>600&&b.bottom<r.bottom-48;})()");assert(fit,'Series title/CTA must fit without covering artwork at '+width);}await screenshot('11c-series-'+width+'-vi');}
 await evaluate("document.querySelector('.hero-live-slide.active .ink-btn').click()");await waitFor("!!document.querySelector('[data-series-detail]')");assert.equal(await evaluate("document.querySelectorAll('[data-live-hero]').length"),0);assert.equal(await evaluate("document.querySelectorAll('[data-volume-number]').length"),2);
 await language('en');await evaluate("document.querySelectorAll('.site-header nav button')[0].click()");await waitFor("!!document.querySelector('.hero')");assert((await evaluate("document.querySelector('.hero h1').innerText")).includes('ENTER THE'));await screenshot('11c-home-390-en');await evaluate("document.querySelectorAll('.hero-ctas button')[1].click()");await waitFor("document.querySelectorAll('.shop-grid .product-card').length===23");
 report.checks=['original Home hero/mascot/halftone/CTA/animation restored in VI/EN; no dynamic Home slider; one slider before Series Explorer; 4 slides and 7 cards; CTA to 2 real volumes; no slider on Detail; Home Shop CTA; responsive and no overflow'];report.result='PASS';report.exceptions=exceptions;report.consoleErrors=consoleErrors;assert.equal(exceptions.length,0,JSON.stringify(exceptions));assert.equal(consoleErrors.length,0,JSON.stringify(consoleErrors));await writeFile(path.join(artifacts,'hero-placement-browser.json'),JSON.stringify(report,null,2));console.log('PASS Home and Series hero placement separately, original assets/VI-EN/CTAs, 1440/900/390 and reference-size 1896');
}finally{if(socket)socket.close();browser.kill();}
