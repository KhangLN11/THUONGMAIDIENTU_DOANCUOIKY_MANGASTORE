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




 const after=process.argv.includes('--after'),tag=after?'after':'before';const report={pages:{},home:{},buttons:{},fonts:{}};
 await cdp('DOM.enable');await cdp('CSS.enable');await language('vi');await waitFor("!!document.querySelector('.hero')&&!document.querySelector('[data-manga-loader]')");
 const styles=`(e)=>{if(!e)return null;const s=getComputedStyle(e);return Object.fromEntries(['fontFamily','fontWeight','fontSize','fontStretch','lineHeight','letterSpacing','textTransform','webkitTextStrokeWidth','color','backgroundColor','borderWidth','padding','height','transition','isolation','overflow','position','zIndex'].map(k=>[k,s[k]]))}`;
 report.home.styles=await evaluate(`Object.fromEntries(['.hero h1','.hero h1 em','.hero-lede','.hero-ctas .ink-btn','.section-title h2','.collection h3','.product-card h3'].map(q=>[q,(${styles})(document.querySelector(q))]))`);
 await evaluate('document.fonts.ready.then(()=>true)');const dom=await cdp('DOM.getDocument');for(const q of ['.hero h1','.hero-lede']){const {nodeId}=await cdp('DOM.querySelector',{nodeId:dom.root.nodeId,selector:q});if(nodeId)report.fonts[q]=(await cdp('CSS.getPlatformFontsForNode',{nodeId})).fonts;}
 for(const width of [1440,900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});for(const page of ['home','shop','series','collections','about']){
 await evaluate(`location.hash='#${page}'`);await pause(350);await waitFor("!!document.querySelector('main')");await evaluate('document.fonts.ready.then(()=>true)');await evaluate('window.scrollTo(0,0)');
 if(page==='home'||page==='shop')report.pages[page+'-'+width]=await evaluate("({main:document.querySelector('main').outerHTML,header:document.querySelector('.site-header').outerHTML,footer:document.querySelector('footer').outerHTML})");
 await screenshot('11e-'+tag+'-'+page+'-'+width);
 }}
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await evaluate("location.hash='#about'");await pause(300);
 const button=async()=>{await evaluate("document.documentElement.style.scrollBehavior='auto';document.querySelector('.about-worlds .ink-btn').scrollIntoView({block:'center',behavior:'instant'})");await pause(500);return await evaluate("(()=>{const r=document.querySelector('.about-worlds .ink-btn').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");};
 let pos=await button();await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:100});report.buttons.normal=await evaluate(`({button:(${styles})(document.querySelector('.about-worlds .ink-btn')),children:[...document.querySelector('.about-worlds .ink-btn').childNodes].map(n=>({type:n.nodeType,text:n.textContent})),before:(()=>{const s=getComputedStyle(document.querySelector('.about-worlds .ink-btn'),'::before');return {transform:s.transform,zIndex:s.zIndex,pointerEvents:s.pointerEvents,background:s.backgroundColor,position:s.position}})()})`);await screenshot('11e-'+tag+'-about-button-normal');
 await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:pos.x,y:pos.y});await pause(600);report.buttons.hover=await evaluate("(()=>{const b=document.querySelector('.about-worlds .ink-btn'),s=getComputedStyle(b,'::before');return {hover:b.matches(':hover'),transform:s.transform,zIndex:s.zIndex,color:getComputedStyle(b).color}})()");assert.equal(report.buttons.hover.hover,true,'Real mouse must reach CTA');await screenshot('11e-'+tag+'-about-button-hover');
 if(after){const baseline=JSON.parse(await readFile(path.join(artifacts,'11e-before.json'),'utf8'));assert.deepEqual(report.pages,baseline.pages,'Home/Shop/Navbar/Footer DOM must stay identical');for(const [key,value] of Object.entries(report.home.styles)){const expected=baseline.home.styles[key];if(!value||!expected){assert.equal(value,expected);continue;}const {height,...style}=value,{height:oldHeight,...oldStyle}=expected;assert.deepEqual(style,oldStyle,'Home computed CSS unchanged '+key);assert(height===oldHeight||Math.abs(parseFloat(height)-parseFloat(oldHeight))<=1,'Home height matches within font rasterization rounding '+key);}assert.equal(report.buttons.hover.hover,true);
 await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:100});await evaluate("document.querySelector('.about-worlds .ink-btn').focus()");await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});assert(await evaluate("document.activeElement.matches('.about-page button:focus-visible')"));await screenshot('11e-after-about-button-focus');
 }

 if(after){
  report.typography=[];
  for(const lang of ['vi','en']){await language(lang);for(const width of [1440,900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});for(const page of ['series','collections','about']){
   await evaluate(`location.hash='#${page}'`);await pause(300);await evaluate('document.fonts.ready.then(()=>true)');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),'No horizontal overflow '+page+' '+width+' '+lang);
   const q=page==='series'?'.discovery-header':page==='collections'?'.discovery-section-heading':'.about-hero';await evaluate(`document.querySelector(${JSON.stringify(q)}).scrollIntoView({block:'start',behavior:'instant'})`);
   const result=await evaluate(`(()=>{const root=document.querySelector('main'),head=root.querySelector('h1,h2'),style=getComputedStyle(head);const bounds=[...root.querySelectorAll('h1,h2,h3')].every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&getComputedStyle(e).overflow==='visible'});return {font:style.fontFamily,weight:style.fontWeight,bounds,labels:[...root.querySelectorAll('h1,h2,h3')].map(h=>h.textContent)}})()`);assert(result.font.includes('Barlow Condensed'));assert.equal(result.weight,'900');assert(result.bounds,'Headings must not be clipped '+page+' '+width+' '+lang);
   const d=await cdp('DOM.getDocument');const n=await cdp('DOM.querySelector',{nodeId:d.root.nodeId,selector:page==='series'?'.discovery-header h1':page==='collections'?'.discovery-section-heading h2':'.about-hero h1'});const fonts=(await cdp('CSS.getPlatformFontsForNode',{nodeId:n.nodeId})).fonts;assert(fonts.length&&fonts.every(f=>f.familyName.includes('Barlow')),'No unexpected heading fallback '+JSON.stringify(fonts));
   if(page==='collections'){assert.equal(await evaluate("document.querySelectorAll('[data-discovery-product]').length"),6);assert(await evaluate("[...document.querySelectorAll('.product-img>img')].every(i=>getComputedStyle(i).objectFit==='contain'&&i.naturalWidth>0)"));}
   report.typography.push({lang,width,page,...result,fonts});await screenshot('11e-after-'+page+'-content-'+width+'-'+lang);
  }}}
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await evaluate("location.hash='#about'");await pause(200);
  for(let index=0;index<5;index++){
   await evaluate(`document.querySelectorAll('.about-page .ink-btn')[${index}].scrollIntoView({block:'center',behavior:'instant'})`);await pause(100);
   const pos=await evaluate(`(()=>{const b=document.querySelectorAll('.about-page .ink-btn')[${index}],r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...pos});await pause(500);
   assert(await evaluate(`(()=>{const b=document.querySelectorAll('.about-page .ink-btn')[${index}];return b.matches(':hover')&&[...b.children].every(e=>getComputedStyle(e).zIndex==='1')&&getComputedStyle(b,'::before').pointerEvents==='none'})()`),'Label/arrow above moving background');
   await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...pos});await screenshot('11e-after-about-cta-'+index+'-active');await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...pos});assert(['#series','#shop','#collections'].includes(await evaluate('location.hash')),'Real mouse click CTA');await evaluate("location.hash='#about'");await pause(250);
  }
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert(parseFloat(await evaluate("getComputedStyle(document.querySelector('.about-page .ink-btn'),'::before').transitionDuration"))<=0.001,'Reduced-motion existing global rule permits only imperceptible transition');await cdp('Emulation.setEmulatedMedia',{features:[]});
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});await cdp('Emulation.setTouchEmulationEnabled',{enabled:true});await evaluate("document.querySelector('.about-ending button').scrollIntoView({block:'center',behavior:'instant'})");await pause(200);const touch=await evaluate("(()=>{const r=document.querySelector('.about-ending button').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");await cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});await cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await waitFor("location.hash==='#series'");
  report.interactions='PASS all five CTAs: real mouse hover/press/click, keyboard Tab focus-visible, mobile touch, reduced motion, VI/EN font glyphs and no overflow';
 }
 assert.equal(exceptions.length,0,JSON.stringify(exceptions));assert.equal(consoleErrors.length,0,JSON.stringify(consoleErrors));
 await writeFile(path.join(artifacts,'11e-'+tag+'.json'),JSON.stringify(report,null,2));console.log('PASS '+tag+' typography audit/screenshots 1440/900/390, real mouse hover'+(after?' and keyboard focus; Home/Shop/chrome preserved':''));
}finally{if(socket)socket.close();browser.kill();}
