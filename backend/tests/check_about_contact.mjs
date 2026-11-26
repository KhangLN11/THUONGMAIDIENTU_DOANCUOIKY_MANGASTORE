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


  const demo=process.argv.includes('--demo');
  const report={mode:demo?'demo':'live',viewports:[],links:{},exceptions,mapResponses:[]};
  socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Network.responseReceived'&&m.params.type==='Document'&&m.params.response.url.includes('google.com/maps'))report.mapResponses.push({url:m.params.response.url,status:m.params.response.status});});
  const baselineData=JSON.parse(await readFile(path.join(artifacts,'16b-before.json'),'utf8'));
  const fullShot=async name=>{await pause(350);const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(path.join(artifacts,name+'.png'),Buffer.from(shot.data,'base64'));};
  const at=async (selector,name)=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'start',behavior:'instant'})`);await screenshot(name);};
  await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');await cdp('Network.setCacheDisabled',{cacheDisabled:true});
  await cdp('Page.navigate',{url:'http://localhost:8443/#about'});await waitFor("!!document.querySelector('.about-contact')");await evaluate('document.fonts.ready.then(()=>true)');
  for(const width of [1440,900,390]){
   await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
   for(const lang of ['vi','en']){
    await language(lang);assert.equal(await evaluate('location.hash'),'#about');
    assert(await evaluate("document.querySelector('.about-story').textContent.includes('Manga Universe')"),await evaluate("document.querySelector('.about-story').textContent"));
    assert.equal(await evaluate("document.querySelectorAll('.about-story-columns p').length"),5);assert(!await evaluate("document.querySelector('.about-page').textContent.includes('about16b.')"));
    assert.equal(await evaluate("document.querySelectorAll('.about-contact-channels a').length"),3);
    assert(await evaluate("document.documentElement.scrollWidth<=innerWidth"));
    await evaluate('window.scrollTo(0,0)');await fullShot(`16b-${report.mode}-about-${lang}-${width}`);
    await at('.about-contact',`16b-${report.mode}-contact-${lang}-${width}`);
    await at('.about-map',`16b-${report.mode}-map-${lang}-${width}`);await pause(1200);
    const iframe=await evaluate("(()=>{const f=document.querySelector('.about-map iframe');return {src:f.src,title:f.title,loading:f.loading,width:f.getBoundingClientRect().width}})()");
    assert.equal(new URL(iframe.src).searchParams.get('q'),'9.1859680957964,105.16684055328');assert.equal(iframe.loading,'lazy');assert(iframe.title&&iframe.width<=width);
    const links=await evaluate("Array.from(document.querySelectorAll('.about-contact a,.about-map a')).map(a=>({href:a.href,target:a.target,rel:a.rel,text:a.textContent}))");
    assert.equal(links[0].href,'mailto:mangauniverse05@gmail.com');assert.equal(links[1].href,'tel:+84369210172');assert.equal(links[2].href,'https://www.facebook.com/profile.php?id=61596943022089');assert(links[2].rel.includes('noopener')&&links[2].rel.includes('noreferrer'));assert.equal(links[2].target,'_blank');
    assert.equal(new URL(links[3].href).searchParams.get('query'),'9.1859680957964,105.16684055328');
    report.links=links;
    if(lang==='vi'){
     const current=await evaluate("(()=>{let e=document.querySelector('.about-hero'),h=e.querySelector('h1'),s=getComputedStyle(h);return {html:e.innerHTML,font:s.fontFamily,size:s.fontSize,weight:s.fontWeight,height:e.getBoundingClientRect().height}})()");
     assert.deepEqual(current,baselineData.viewports.find(x=>x.width===width).hero);
    }
   }
   report.viewports.push(width);
  }
  // Native keyboard/focus and hover; do not launch an email client or dial a phone.
  await at('.about-ending','16b-ending');await evaluate("document.querySelector('.about-ending button').focus()");
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});
  assert(await evaluate("document.activeElement.matches('.about-ending button:focus-visible')"));
  await screenshot('16b-focus');
  const rect=await evaluate("(()=>{const r=document.querySelector('.about-ending button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...rect});await pause(500);await screenshot('16b-hover');
  const stacking=await evaluate("(()=>{const b=document.querySelector('.about-ending button');return {text:getComputedStyle(b.querySelector('span')).zIndex,overlay:getComputedStyle(b,'::before').zIndex,color:getComputedStyle(b).color}})()");assert(+stacking.text>+stacking.overlay);
  for(const [selector,destination] of [['.about-ending button','#series'],['.about-worlds article:nth-child(2) button','#shop'],['.about-worlds article:nth-child(3) button','#collections']]){
   await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await waitFor(`location.hash===${JSON.stringify(destination)}`);
   await cdp('Page.navigate',{url:'http://localhost:8443/#about'});await waitFor("!!document.querySelector('.about-contact')");
  }
  await cdp('Page.navigate',{url:'http://localhost:8443/#home'});await waitFor("!!document.querySelector('.hero')");await language('vi');await pause(700);
  if(!demo)assert.equal(await evaluate("document.querySelector('main').innerHTML"),baselineData.home);
  assert.equal(await evaluate("document.querySelector('.site-header').outerHTML"),baselineData.header);
  assert.equal(await evaluate("document.querySelector('footer').outerHTML"),baselineData.footer);
  await screenshot('16b-'+report.mode+'-home-after');
  await evaluate("Array.from(document.querySelectorAll('footer button')).find(b=>/^(CONTACT|LIÊN HỆ)$/.test(b.textContent.trim())).click()");
  await waitFor("location.hash==='#about/contact'&&!!document.querySelector('.about-contact')");await pause(400);
  assert(await evaluate("Math.abs(document.querySelector('.about-contact').getBoundingClientRect().top-100)<4"));
  await evaluate("document.querySelector('footer').scrollIntoView({behavior:'instant'});Array.from(document.querySelectorAll('footer button')).find(b=>/^(CONTACT|LIÊN HỆ)$/.test(b.textContent.trim())).click()");await pause(400);assert(await evaluate("Math.abs(document.querySelector('.about-contact').getBoundingClientRect().top-100)<4"));
  await reload();await waitFor("!!document.querySelector('.about-contact')");await pause(500);assert.equal(await evaluate('location.hash'),'#about/contact');
  await language('en');assert.equal(await evaluate('location.hash'),'#about/contact');
  await evaluate('history.back()');await waitFor("location.hash==='#home'");await evaluate('history.forward()');await waitFor("location.hash==='#about/contact'");
  await at('.about-map','16b-'+report.mode+'-map-loaded');await pause(3000);
  report.frameTree=await cdp('Page.getFrameTree');
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  assert(parseFloat(await evaluate("getComputedStyle(document.querySelector('.about-contact-channel')).transitionDuration"))<=.00001);
  if(!demo){
   const maps=await evaluate("document.querySelector('.about-map a').href");
   await cdp('Page.navigate',{url:maps});await pause(5000);
   report.actualMaps={url:await evaluate('location.href'),title:await evaluate('document.title'),text:(await evaluate('document.body.innerText')).slice(0,2500)};
   await screenshot('16b-google-maps-external');
   assert(report.actualMaps.title.includes('Google Maps'));assert(report.actualMaps.url.includes('9.1859681')&&report.actualMaps.url.includes('105.1668406'));
   assert(report.mapResponses.some(r=>r.url.includes('/maps/embed')&&r.status===200));
   await cdp('Page.navigate',{url:'http://localhost:8443/#about/contact'});await waitFor("!!document.querySelector('.about-contact')");
   const previous=(await cdp('Target.getTargets')).targetInfos.map(t=>t.targetId);
   await cdp('Runtime.evaluate',{expression:"document.querySelector('.about-contact-facebook').click()",userGesture:true});await pause(4000);
   const added=(await cdp('Target.getTargets')).targetInfos.filter(t=>t.type==='page'&&!previous.includes(t.targetId));
   assert(added.some(t=>t.url.includes('facebook.com')),JSON.stringify(added));report.facebookOpened=added.map(t=>({url:t.url,title:t.title}));
   for(const t of added)await cdp('Target.closeTarget',{targetId:t.targetId});
  }
  if(demo)assert(!requests.some(u=>u.includes('/api/products')||u.includes('/api/orders')));
  assert.equal(exceptions.length,0);report.result='PASS';await writeFile(path.join(artifacts,'16b-'+report.mode+'-browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({result:report.result,mode:report.mode,mapEmbedLoaded:report.mapResponses.some(r=>r.url.includes('/maps/embed')&&r.status===200),actualMaps:report.actualMaps,facebookOpened:report.facebookOpened,viewports:report.viewports}));
}finally{socket?.close();browser.kill();}
