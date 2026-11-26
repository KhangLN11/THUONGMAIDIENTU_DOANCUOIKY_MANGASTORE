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
  const screenshot = async name => { await evaluate("document.querySelector('.accordions')?.scrollIntoView({block:'center'})"); await pause(300); const r=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}); await writeFile(path.join(artifacts,name+'.png'),Buffer.from(r.data,'base64')); };
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await cdp('Page.navigate',{url:'http://localhost:8443/'});
  await waitFor("!!document.querySelector('.site-header')");
  await language('en');
  await evaluate('document.fonts.ready.then(()=>true)');
  await pause(500);


  const before=process.argv.includes('--before');
  const catalog=(await (await fetch('http://localhost:8443/api/products.php')).json()).data;
  const skus=['CAT-MG-OP-VI-01','CAT-MG-AOT-EN-01','CAT-MG-NAR-VI-01','CAT-NV-YN-VI','CAT-NV-SUZ-VI','CAT-FG-FRI-PUP','CAT-FG-FER-PUP','CAT-FG-YOR-PUP'];
  const report={mode:before?'before':'after',products:[],viewports:[],exceptions};
  for(const width of [1440,900,390]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
    await cdp('Page.navigate',{url:'http://localhost:8443/#product/'+catalog.find(p=>p.sku===skus[0]).id});
    await waitFor(before?"!!document.querySelector('.accordions')":"!!document.querySelector('.product-information')");
    await language('vi');await screenshot('15-'+(before?'before':'after')+'-closed-'+width);
    if(!before){
      assert.equal(await evaluate("document.querySelectorAll('.product-information button[aria-expanded=false]').length"),3);
      await evaluate("document.querySelectorAll('.product-information button')[0].click()");
      await pause(250);await screenshot('15-open-'+width);
      assert(await evaluate("document.documentElement.scrollWidth<=innerWidth"));
      await evaluate("document.querySelectorAll('.product-information button')[1].click();document.querySelectorAll('.product-information button')[2].click()");
      assert.equal(await evaluate("document.querySelectorAll('.product-information button[aria-expanded=true]').length"),3);
      await screenshot('15-policies-'+width);
      await evaluate("document.querySelectorAll('.product-information button[aria-expanded=true]').forEach(b=>b.click())");
    }
    report.viewports.push(width);
  }
  if(!before){
    for(const sku of skus){
      const p=catalog.find(p=>p.sku===sku);assert(p,sku);
      await cdp('Page.navigate',{url:'http://localhost:8443/#product/'+p.id});
      await waitFor("!!document.querySelector('.product-information')");
      await language('en');
      await evaluate("document.querySelector('.product-information button').click()");
      await evaluate("document.querySelector('.qty button:last-child').click()");
      const qty=await evaluate("document.querySelector('.qty b').textContent");
      const content=await evaluate("document.querySelector('.product-information').textContent");
      assert(content.includes(p.name_en));assert(!content.includes('undefined'));assert(!content.includes('null'));
      if(sku.includes('-FG-'))assert(!content.includes('ISBN'));
      if(sku==='CAT-NV-SUZ-VI')assert(!content.includes('hardcover'));
      await language('vi');assert.equal(await evaluate("document.querySelector('.product-information button').getAttribute('aria-expanded')"),'true');
      assert.equal(await evaluate("document.querySelector('.qty b').textContent"),qty);
      await screenshot('15-details-'+sku);report.products.push(sku);
    }
    await evaluate("document.querySelector('.product-information button').focus()");
    await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
    await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
    await waitFor("document.querySelector('.product-information button').getAttribute('aria-expanded')==='false'");
    await evaluate("document.querySelector('.product-information button').scrollIntoView({block:'center'})");
    await screenshot('15-hover');
    const rect=await evaluate("(()=>{const r=document.querySelector('.product-information button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
    await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...rect});
    {const shot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(path.join(artifacts,'15-hover.png'),Buffer.from(shot.data,'base64'));}
    await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[rect]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await waitFor("document.querySelector('.product-information button').getAttribute('aria-expanded')==='true'");
    await evaluate("document.querySelector('.product-information button').focus()");
    await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',text:' ',windowsVirtualKeyCode:32});
    await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
    await waitFor("document.querySelector('.product-information button').getAttribute('aria-expanded')==='false'");
    await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    assert(parseFloat(await evaluate("getComputedStyle(document.querySelector('.product-info-panel')).transitionDuration"))<=0.00001);
  }
  assert.equal(exceptions.length,0);report.result='PASS';await writeFile(path.join(artifacts,'15-'+report.mode+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{socket?.close();browser.kill();}
