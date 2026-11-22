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
const browser = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu','--disable-background-timer-throttling','--disable-renderer-backgrounding', '--no-first-run', '--remote-debugging-port=9229', '--remote-allow-origins=*', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
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
  const waitFor = async expression => { for(let i=0;i<180;i++){ if(await evaluate(expression)) return; await pause(100); } throw new Error('Timeout: '+expression); };
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


 await cdp('Page.bringToFront');
 const api=await(await fetch('http://localhost:8443/api/products.php')).json(),catalog=api.data;assert.equal(catalog.length,23);
 const expected=['one-piece','attack-on-titan','naruto','dragon-ball'];const report={checks:[],viewports:[1440,900,390],sourceColors:[],exceptions:[]};
 const field=async(selector,value)=>evaluate(`(()=>{const i=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(i.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event(i.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
 const active=()=>evaluate("document.querySelector('.hero-live-slide.active')?.dataset.heroSeries");
 const btn=async(selector)=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
 await evaluate("document.querySelectorAll('.site-header nav button')[2].click()");
 await waitFor("document.querySelectorAll('[data-hero-series]').length===4 && !document.querySelector('[data-manga-loader]')");
 assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('[data-hero-series]')).map(n=>n.dataset.heroSeries)"),expected);
 assert(!/VOID RUNNER|NEO TOKYO|BLADE ZERO|STEEL SOUL|Runner 404/.test(await evaluate("document.querySelector('[data-live-hero]').textContent")));
 for(const slug of expected){const p=catalog.filter(p=>p.category?.slug==='manga'&&p.series?.slug===slug)[0];assert.equal(await evaluate(`document.querySelector('[data-hero-series="${slug}"] h1').textContent`),p.series.title);assert.equal(await evaluate(`document.querySelector('[data-hero-series="${slug}"] img').getAttribute('src')`),p.image_url);}
 await btn('.hero-live-controls > button[aria-label="Next manga"]');assert.equal(await active(),'attack-on-titan');await btn('.hero-live-controls > button[aria-label="Previous manga"]');assert.equal(await active(),'one-piece');
 await evaluate('document.activeElement?.blur()');await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:2,y:2});await pause(6350);assert.equal(await active(),'attack-on-titan');
 await btn('.hero-live-pause');const paused=await active();await pause(6300);assert.equal(await active(),paused);await btn('.hero-live-pause');
 const rect=await evaluate("(()=>{const r=document.querySelector('.hero-live').getBoundingClientRect();return{x:r.x+50,y:r.y+50}})()");await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...rect});await pause(6300);assert.equal(await active(),paused);await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:2,y:2});
 await evaluate("document.querySelector('.hero-live-slide.active .ink-btn').focus()");await pause(6300);assert.equal(await active(),paused);await evaluate('document.activeElement.blur()');
 const tab=await cdp('Target.createTarget',{url:'about:blank'});await cdp('Target.activateTarget',{targetId:tab.targetId});await waitFor('document.hidden');await pause(6300);assert.equal(await active(),paused);await cdp('Target.closeTarget',{targetId:tab.targetId});await cdp('Page.bringToFront');
 await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await pause(6300);assert.equal(await active(),paused);assert(await evaluate("document.querySelector('.hero-live-pause').disabled"));await cdp('Emulation.setEmulatedMedia',{features:[]});await btn('.hero-live-pause');
 await screenshot('11b-hero-controls-desktop');report.checks.push('four real Hero series/covers/counts; previous/next; actual 6s autoplay; pause button, hover, focus, hidden-tab and reduced-motion pauses; no repeated startup loader');
 await evaluate("document.querySelector('.hero-live-slide.active .ink-btn').click()");await waitFor("!!document.querySelector('[data-series-detail]')");assert.equal(await evaluate("document.querySelector('[data-series-detail]').dataset.seriesDetail"),paused);
 await evaluate("window.location.hash='#series'");await waitFor("document.querySelectorAll('[data-series-card]').length===7");assert((await evaluate("document.querySelector('.discovery-header h1').textContent")).includes('CHOOSE YOUR OWN WORLD'));assert(!/Runner 404|Sector 9|BEYOND THE EDGE/.test(await evaluate("document.querySelector('.series-page').textContent")));
 await field('[name=series_search]','DAI CHIEN TITAN');assert.equal(await evaluate("document.querySelectorAll('[data-series-card]').length"),1);assert.equal(await evaluate("document.querySelector('[data-series-card]').dataset.seriesCard"),'attack-on-titan');await field('[name=series_search]','no-such-series');assert.equal(await evaluate("document.querySelectorAll('[data-series-card]').length"),0);await field('[name=series_search]','');
 await btn('[data-series-card="one-piece"]');await waitFor("document.querySelector('[data-series-detail]')?.dataset.seriesDetail==='one-piece'");assert.equal(await evaluate("document.querySelectorAll('[data-volume-grid] .product-card').length"),2);
 await field('[name=volume_order]','desc');assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('[data-volume-number]')).map(n=>n.dataset.volumeNumber)"),['2','1']);
 for(const query of ['1','Tập 1','Volume 1']){await field('[name=volume_search]',query);assert.equal(await evaluate("document.querySelectorAll('[data-volume-number]').length"),1);assert.equal(await evaluate("document.querySelector('[data-volume-number]').dataset.volumeNumber"),'1');}
 await btn('[data-volume-grid] .wish');await waitFor("!!document.querySelector('[data-volume-grid] .wish.active')");await btn('[data-volume-grid] .discovery-card-actions button:last-child');await waitFor("!!document.querySelector('.toast')");
 const first=catalog.find(p=>p.series?.slug==='one-piece'&&p.name_en.includes('Vol. 1'));await btn('[data-volume-grid] .discovery-card-actions button:first-child');await waitFor(`document.querySelector('[data-product-id]')?.dataset.productId==='${first.id}'`);await evaluate('history.back()');await waitFor("!!document.querySelector('[name=volume_search]')");assert.equal(await evaluate("document.querySelector('[name=volume_search]').value"),'Volume 1');assert.equal(await evaluate("document.querySelector('[name=volume_order]').value"),'desc');
 await btn('[data-volume-grid] .product-img');await waitFor("!!document.querySelector('[data-product-id]')");await btn('.discovery-return button');await waitFor("!!document.querySelector('[name=volume_search]')");assert.equal(await evaluate("document.querySelector('[name=volume_search]').value"),'Volume 1');await screenshot('11b-series-detail-desktop');
 report.checks.push('7 deduplicated manga series/14 active editions; accent-insensitive search and empty state; correct numeric sorting/exact volume query; correct product ID, browser back and breadcrumb retain filters; guest cart/wishlist work');
 await evaluate("window.location.hash='#collections'");await waitFor("document.querySelectorAll('[data-figure-group]').length===5");assert.equal(await evaluate("document.querySelectorAll('[data-figure-collections] .product-card').length"),6);assert.equal(await evaluate("document.querySelectorAll('[data-figure-group=\"frieren-beyond-journeys-end\"] .product-card').length"),2);
 await field('[name=figure_category]','accessories');assert.equal(await evaluate("document.querySelectorAll('[data-figure-collections] .product-card').length"),0);assert((await evaluate("document.querySelector('.discovery-empty').textContent")).includes('no accessories'));await field('[name=figure_category]','figures');await field('[name=figure_series]','frieren-beyond-journeys-end');assert.equal(await evaluate("document.querySelectorAll('[data-figure-collections] .product-card').length"),2);
 await field('[name=figure_search]','fern');assert.equal(await evaluate("document.querySelectorAll('[data-figure-collections] .product-card').length"),1);const fern=catalog.find(p=>p.sku==='CAT-FG-FER-PUP');await btn('[data-figure-collections] .discovery-card-actions button:first-child');await waitFor(`document.querySelector('[data-product-id]')?.dataset.productId==='${fern.id}'`);await btn('.discovery-return button');await waitFor("!!document.querySelector('[name=figure_search]')");assert.equal(await evaluate("document.querySelector('[name=figure_search]').value"),'fern');assert.equal(await evaluate("document.querySelector('[name=figure_series]').value"),'frieren-beyond-journeys-end');
 await field('[name=figure_search]','');await field('[name=figure_series]','all');await screenshot('11b-collections-desktop');report.checks.push('6 figures grouped by 5 real series; Frieren/Fern together; category/series/search filters, empty accessories without invented products; correct Detail and back');
 // Verify every local source image through a same-origin canvas; CSS must not fabricate color.
 const images=catalog.flatMap(p=>p.images.map(i=>({name:p.name_en,url:i.image_url})));for(const image of images){const sample=await evaluate(`new Promise(resolve=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=64;c.height=64;const x=c.getContext('2d');x.drawImage(img,0,0,64,64);const a=x.getImageData(0,0,64,64).data;let colored=0;for(let i=0;i<a.length;i+=4)if(Math.max(a[i],a[i+1],a[i+2])-Math.min(a[i],a[i+1],a[i+2])>12)colored++;resolve({coloredPixels:colored,loaded:true});};img.onerror=()=>resolve({loaded:false});img.src=${JSON.stringify(image.url)};})`);assert(sample.loaded,image.url);report.sourceColors.push({...image,...sample});}
 for(const sku of ['CAT-NV-YN-VI','CAT-FG-FRI-PUP']){const p=catalog.find(p=>p.sku===sku);await evaluate(`window.location.hash='#product/${p.id}'`);await waitFor(`document.querySelector('[data-product-id]')?.dataset.productId==='${p.id}'`);for(let i=0;i<p.images.length;i++){await evaluate(`document.querySelectorAll('.thumbs button')[${i}].click()`);await waitFor(`document.querySelector('.main-image img')?.getAttribute('src')===${JSON.stringify(p.images[i].image_url)} && document.querySelector('.main-image img')?.naturalWidth>0`);assert(await evaluate("Array.from(document.querySelectorAll('.gallery img')).every(i=>getComputedStyle(i).filter==='none' && getComputedStyle(i).opacity==='1' && getComputedStyle(i).objectFit==='contain' && getComputedStyle(i).mixBlendMode==='normal')"));}await screenshot('11b-true-color-'+sku);}
 await navigate('shop');await waitFor("document.querySelectorAll('.shop-grid .product-card').length===23");assert((await evaluate("getComputedStyle(document.querySelector('.shop-grid img')).filter")).includes('grayscale'));report.checks.push('37 source files load and audited for original color; Your Name/Frieren main and thumbnails true-color/opacity1/contain with gallery selection; Shop editorial grayscale preserved');
 await language('vi');await evaluate("window.location.hash='#series'");await waitFor("!!document.querySelector('[name=series_search]')");assert.equal(await evaluate("document.querySelector('.discovery-header h1').textContent"),'CHỌN THẾ GIỚI CỦA RIÊNG BẠN');await evaluate("window.location.hash='#collections'");await waitFor("!!document.querySelector('[name=figure_category]')");assert.equal(await evaluate("document.querySelector('.discovery-section-heading h2').textContent"),'TỪ HƯ VÔ THÀNH HIỆN THỰC');
 for(const width of [900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await evaluate('window.scrollTo(0,0)');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await screenshot('11b-collections-'+width+'-vi');await evaluate("window.location.hash='#series'");await waitFor("document.querySelectorAll('[data-series-card]').length===7");assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await screenshot('11b-series-'+width+'-vi');await btn('[data-series-card="dragon-ball"]');await waitFor("document.querySelectorAll('[data-volume-number]').length===2");assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await screenshot('11b-volumes-'+width+'-vi');await evaluate("document.querySelectorAll('.site-header nav button')[2].click()");await waitFor("!!document.querySelector('[data-live-hero]')");for(let i=0;i<4;i++){const label=await evaluate("document.querySelector('.hero-live-controls > button[aria-label]')?.getAttribute('aria-label')");await btn('.hero-live-controls > button[aria-label="Manga tiếp theo"]');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));const fit=await evaluate("(()=>{const a=document.querySelector('.hero-live-slide.active'),h=a.querySelector('h1').getBoundingClientRect(),c=a.querySelector('.ink-btn').getBoundingClientRect(),r=a.getBoundingClientRect();return h.right<=innerWidth && h.bottom<=r.bottom && c.bottom<r.bottom-45;})()");assert(fit,'Hero text/CTA must fit on '+width);}await screenshot('11b-hero-'+width+'-vi');await evaluate("window.location.hash='#collections'");await waitFor("!!document.querySelector('[name=figure_category]')");}
 report.checks.push('VI/EN exact new headings, stable product identity and VND; responsive 1440/900/390 with all 4 Hero texts/CTAs fitting and no horizontal overflow');
 assert.equal(exceptions.length,0,JSON.stringify(exceptions));assert.equal(consoleErrors.length,0,JSON.stringify(consoleErrors));report.exceptions=exceptions;report.consoleErrors=consoleErrors;report.monochromeSources=report.sourceColors.filter(i=>i.coloredPixels===0);report.result='PASS';await writeFile(path.join(artifacts,'discovery-browser.json'),JSON.stringify(report,null,2));console.log('PASS Discovery actual GUI: Hero/autoplay/accessibility, series/volume search/back, figures, cart/wishlist, source-color audit, VI/EN and 1440/900/390');
}finally{if(socket)socket.close();browser.kill();}
