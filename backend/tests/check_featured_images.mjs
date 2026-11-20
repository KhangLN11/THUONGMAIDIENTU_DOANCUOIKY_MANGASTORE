import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '../../frontend');
const artifacts = path.join(root, '.artifacts');
await mkdir(artifacts, { recursive: true });
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


  if(process.argv.includes('--demo')) {
    await waitFor("document.querySelectorAll('.arrivals .product-card').length===4");
    const originalHome=await readFile(path.join(artifacts,'baseline-home.html'),'utf8');
    assert.equal(await evaluate(`(() => { const current=document.querySelector('main').cloneNode(true); current.querySelector('.collections').remove(); const old=new DOMParser().parseFromString(${JSON.stringify(originalHome)},'text/html').querySelector('main');old.querySelector('.collections').remove();return current.outerHTML===old.outerHTML;})()`),true,'Demo outside Featured changed');
    assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.collection h3')).map(e=>e.textContent)"),['NEOTOKYO','VOIDRUNNER','BLADEZERO','STEELSOUL']);
    assert(await evaluate("Array.from(document.querySelectorAll('.collection')).every(e=>e.tagName==='BUTTON'&&e.getAttribute('aria-disabled')==='true'&&!e.onclick&&!e.querySelector('a'))"));
    for(const width of [1440,390]) {
      await cdp('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390});
      await evaluate("document.querySelector('.collections').scrollIntoView()");
      await waitFor("Array.from(document.querySelectorAll('.collection img')).every(i=>i.complete&&i.naturalWidth>0)");
      await screenshot('demo-featured-restored-'+width);
      await evaluate("document.querySelector('.collection').click()");
      assert.equal(await evaluate("document.querySelectorAll('.collections .collection').length"),4,'Static panel must not open an empty shop');
    }
    await language('vi');
    assert(await evaluate("Array.from(document.querySelectorAll('.collection h3,.collection p')).every(e=>e.textContent.trim().length>0)"));
    await language('en');
    await navigate('shop');
    assert.equal(await evaluate("document.querySelector('main').outerHTML"),await readFile(path.join(artifacts,'baseline-shop.html'),'utf8'),'Demo Shop differs');
    assert(await evaluate("Array.from(document.querySelectorAll('.shop-grid img')).every(i=>getComputedStyle(i).objectFit==='cover')"));
    await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await screenshot('5c-demo-shop-desktop');
    await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    await screenshot('5c-demo-shop-mobile');
    assert.equal(requests.filter(u=>/\/api\/products?\.php(?:\?|$)/.test(u)).length,0);
    assert.equal(exceptions.length,0);assert.equal(consoleErrors.length,0);
    await writeFile(path.join(artifacts,'5c-demo.json'),JSON.stringify({shopDOMIdentical:true,homeOutsideFeaturedIdentical:true,originalCoverStyles:true,productApiRequests:0,exceptions,consoleErrors},null,2));
    console.log('PASS 5C Demo: original Shop DOM, unchanged Home outside Featured, original cover style, no product API/mixed IDs, desktop/mobile');
  } else {
  const phase=process.argv.includes('--after')?'after':'before';
  const report={phase,panels:[],viewports:[]};
  for(const width of [1440,390]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390});
    await navigate('home');
    await evaluate("document.querySelector('.collections').scrollIntoView()");
    await pause(700);
    report.panels.push({width,items:await evaluate("Array.from(document.querySelectorAll('.collection')).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {width:r.width,height:r.height,gridColumn:s.gridColumn,gridRow:s.gridRow,font:getComputedStyle(e.querySelector('h3')).font,border:s.border,gap:getComputedStyle(e.parentElement).gap};})")});
    await screenshot('5c-'+phase+'-featured-'+width);
    await navigate('shop');
    await waitFor("document.querySelectorAll('.shop-grid .product-card').length===23");
    await waitFor("Array.from(document.querySelectorAll('.shop-grid img')).every(i=>i.complete&&i.naturalWidth>0)");
    await evaluate("document.querySelector('.shop-grid').scrollIntoView()");
    await pause(600);
    await screenshot('5c-'+phase+'-shop-'+width);
    if(phase==='after') {
      assert(await evaluate("Array.from(document.querySelectorAll('.shop-grid img')).every(i=>getComputedStyle(i).objectFit==='contain')"));
      assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
    }
    report.viewports.push(width);
  }
  if(phase==='after') {
    const old=JSON.parse(await readFile(path.join(artifacts,'5c-before.json'),'utf8'));
    assert.deepEqual(report.panels,old.panels,'Featured panel geometry/style changed');
    for(const [index,slug,title] of [[0,'one-piece','ONE PIECE'],[1,'attack-on-titan','ATTACK ON TITAN'],[2,'naruto','NARUTO'],[3,'dragon-ball','DRAGON BALL']]) {
      await navigate('home');await language('en');
      assert.equal(await evaluate(`document.querySelectorAll('.collection h3')[${index}].textContent.replace(/\\s+/g,' ').trim()`),title);
      await evaluate(`document.querySelectorAll('.collection')[${index}].click()`);
      await waitFor("document.querySelectorAll('.shop-grid .product-card').length===2");
      const live=await(await fetch('http://localhost:8443/api/products.php')).json();
      assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.shop-grid h3')).map(e=>e.textContent)"),live.data.filter(p=>p.series?.slug===slug).map(p=>p.name_en));
      await language('vi');
      assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.shop-grid h3')).map(e=>e.textContent)"),live.data.filter(p=>p.series?.slug===slug).map(p=>p.name_vi));
    }
    await navigate('shop');await waitFor("document.querySelectorAll('.shop-grid .product-card').length===23");

    const catalog=(await(await fetch('http://localhost:8443/api/products.php')).json()).data;
    report.imageFits=[];
    for(const product of catalog) {
      await evaluate(`document.querySelectorAll('.shop-grid .product-img')[${catalog.findIndex(p=>p.id===product.id)}].click()`);
      await waitFor(`Number(document.querySelector('[data-product-id]')?.dataset.productId)===${product.id}`);
      await waitFor("document.querySelector('.main-image img')?.complete && document.querySelector('.main-image img')?.naturalWidth>0");
      assert(await evaluate("Array.from(document.querySelectorAll('.main-image img,.thumbs img')).every(i=>getComputedStyle(i).objectFit==='contain' && getComputedStyle(i).objectPosition==='50% 50%')"));
      report.imageFits.push({id:product.id,gallery:product.images.length,fit:'contain',position:'center'});
      await navigate('shop');
      await waitFor("document.querySelectorAll('.shop-grid .product-card').length===23");
    }
    await navigate('home');
    for(const lang of ['vi','en']) {
      await language(lang);
      const expected=lang==='vi'?["C\u00f9ng Luffy chinh ph\u1ee5c \u0110\u1ea1i H\u1ea3i Tr\u00ecnh.", "Kh\u00e1m ph\u00e1 s\u1ef1 th\u1eadt b\u00ean kia nh\u1eefng b\u1ee9c t\u01b0\u1eddng.", "Theo \u0111u\u1ed5i \u01b0\u1edbc m\u01a1 tr\u1edf th\u00e0nh Hokage.", "H\u00e0nh tr\u00ecnh t\u00ecm ki\u1ebfm b\u1ea3y vi\u00ean ng\u1ecdc r\u1ed3ng."]:["Join Luffy on his journey across the Grand Line.", "Discover the truth beyond the walls.", "Follow the dream of becoming Hokage.", "The quest for the seven Dragon Balls."];
      assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.collection p')).map(e=>e.textContent)"),expected);
      assert(await evaluate("Array.from(document.querySelectorAll('.collection img')).every(i=>i.complete&&i.naturalWidth>0&&getComputedStyle(i).objectFit==='cover')"));
      await evaluate("document.querySelector('.collections').scrollIntoView()");await pause(600);
      await screenshot('5c-after-featured-'+lang+'-390');
    }
    await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1500,deviceScaleFactor:1,mobile:false});
    await evaluate(`(() => { const photos=${JSON.stringify(catalog.flatMap(p=>p.images.map((image,index)=>({src:image.image_url,label:p.sku+' / '+(index+1)}))))};document.body.innerHTML='<main id="source-audit" style="display:grid;grid-template-columns:repeat(7,1fr);gap:12px;padding:12px;background:white;color:black"></main>';const grid=document.querySelector('#source-audit');for(const photo of photos){const figure=document.createElement('figure');const img=document.createElement('img');img.src=photo.src;img.style.cssText='height:245px;width:100%;object-fit:contain;background:#eee';const label=document.createElement('figcaption');label.textContent=photo.label;label.style.cssText='font:10px sans-serif';figure.append(img,label);grid.append(figure);}window.scrollTo(0,0);})()`);
    await waitFor("Array.from(document.querySelectorAll('#source-audit img')).every(i=>i.complete&&i.naturalWidth>0)");
    await screenshot('5c-source-audit-35');
    report.featuredLinks='4 real series, 2 products each; EN/VI; shop reset 23';

    assert.equal(exceptions.length,0,JSON.stringify(exceptions));
    assert.equal(consoleErrors.length,0,JSON.stringify(consoleErrors));
  }
  report.exceptions=exceptions;report.consoleErrors=consoleErrors;
  await writeFile(path.join(artifacts,'5c-'+phase+'.json'),JSON.stringify(report,null,2));
  console.log('PASS 5C '+phase);
  }
} finally {if(socket)socket.close();browser.kill();}
