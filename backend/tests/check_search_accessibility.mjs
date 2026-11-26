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



 await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Page.navigate',{url:'http://localhost:8443/#home'});await waitFor("!!document.querySelector('.hero')");
 const key=async(k,code,n)=>{await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:k,code,windowsVirtualKeyCode:n});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:k,code,windowsVirtualKeyCode:n});};
 const field=async v=>evaluate(`(()=>{let e=document.querySelector('[name=global_search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(v)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await evaluate("document.querySelector('.header-actions>button:first-of-type').focus();document.querySelector('.header-actions>button:first-of-type').click()");await waitFor("document.activeElement.matches('[name=global_search]')");await field('onepiece');await waitFor("document.querySelectorAll('[data-smart-search] a').length===2");
 await key('Escape','Escape',27);assert(await evaluate("!!document.querySelector('.manga-search-dialog[open]') && !document.querySelector('[data-smart-search]')"));await key('Escape','Escape',27);await waitFor("!document.querySelector('.manga-search-dialog')");await waitFor("document.activeElement===document.querySelector('.header-actions>button:first-of-type')");
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:320,deviceScaleFactor:1,mobile:true});
 await evaluate("document.querySelector('.menu').click()");await waitFor("document.querySelector('.menu').getAttribute('aria-expanded')==='true'");await evaluate("document.querySelector('.mobile-nav-tools a').click()");await waitFor("!!document.querySelector('[name=global_search]')");await field('naruto');await waitFor("document.querySelectorAll('[data-smart-search] a').length===2");
 const fit=await evaluate("(()=>{let r=document.querySelector('[data-smart-search]').getBoundingClientRect();return {top:r.top,bottom:r.bottom,right:r.right,scroll:document.querySelector('[data-smart-search]').scrollHeight>r.height}})()");assert(fit.top>=0&&fit.bottom<=320&&fit.right<=390&&fit.scroll);await screenshot('17a-short-viewport-search');
 await key('ArrowUp','ArrowUp',38);assert.equal(await evaluate("document.querySelectorAll('[data-smart-search] a')[1].getAttribute('aria-selected')"),'true');await key('Enter','Enter',13);await waitFor("!!document.querySelector('.product-page')");assert.equal(exceptions.length,0);await writeFile(path.join(artifacts,'17a-accessibility.json'),JSON.stringify({result:'PASS',checks:['explicit focus only on open','Escape popup then native dialog; original trigger restored','ArrowUp wrap to last option and Enter','390x320 short viewport popup bounded and scrollable'],fit},null,2));console.log('PASS search focus/Escape/ArrowUp and short viewport');
}finally{socket?.close();browser.kill();}
