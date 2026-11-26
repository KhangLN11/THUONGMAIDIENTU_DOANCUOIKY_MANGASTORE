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



  const address='Số 3 đường Lê Thị Riêng, phường Tân Thành, tỉnh Cà Mau, Cà Mau, Vietnam, 79000.';
  const coordinates='9.1859680957964,105.16684055328';
  const responses=[];
  socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Network.responseReceived'&&m.params.type==='Document'&&m.params.response.url.includes('/maps/embed'))responses.push({url:m.params.response.url,status:m.params.response.status});});
  await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');
  await cdp('Page.navigate',{url:'http://localhost:8443/#about'});await waitFor("!!document.querySelector('.about-map')");await evaluate('document.fonts.ready.then(()=>true)');
  for(const width of [1440,390]){
   await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
   for(const lang of ['vi','en']){
    await language(lang);await evaluate("document.querySelector('.about-map').scrollIntoView({block:'start',behavior:'instant'})");await pause(1000);
    const result=await evaluate("(()=>{const m=document.querySelector('.about-map');return {text:m.textContent,iframe:m.querySelector('iframe').src,href:m.querySelector('a').href,height:m.querySelector('iframe').getBoundingClientRect().height}})()");
    assert(result.text.includes(address));assert(result.text.includes(coordinates.replace(',',', ')));assert.equal(new URL(result.iframe).searchParams.get('q'),coordinates);assert.equal(new URL(result.iframe).searchParams.get('z'),'16');assert.equal(new URL(result.href).searchParams.get('query'),coordinates);assert.equal(result.height,width===390?320:380);assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    await screenshot(`16b-address-${lang}-${width}`);
   }
  }
  await pause(1500);assert(responses.some(r=>r.status===200));
  const maps=await evaluate("document.querySelector('.about-map a').href");await cdp('Page.navigate',{url:maps});await pause(5000);
  const mapsTitle=await evaluate('document.title');assert(mapsTitle.includes('Google Maps'));assert((await evaluate('location.href')).includes('9.1859681,105.1668406'));
  assert.equal(exceptions.length,0);await writeFile(path.join(artifacts,'16b-address-tests.json'),JSON.stringify({result:'PASS',viewports:[1440,390],languages:['vi','en'],address,coordinates,iframeResponses:responses,mapsTitle},null,2));console.log('PASS address VI/EN, exact coordinates, embed HTTP200, Google Maps pin/link, sizes and no overflow');
}finally{socket?.close();browser.kill();}
