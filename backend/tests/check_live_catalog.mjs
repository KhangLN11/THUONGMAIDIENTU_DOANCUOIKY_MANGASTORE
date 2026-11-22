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

  const live=await (await fetch('http://localhost:8443/api/products.php')).json();
  const catalog=live.data;
  assert.equal(catalog.length,23);
  assert(catalog.every(p=>p.sku.startsWith('CAT-')));
  const report={productCount:23,detailIds:[],gallerySelections:0,languages:['en','vi'],viewports:[],errors:[]};
  const setQuery=async value=>{
    await evaluate(`(() => { const input=document.querySelector('.shop-tools input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)}); input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  };
  const names=()=>evaluate("Array.from(document.querySelectorAll('.shop-grid .product-meta h3')).map(n=>n.textContent)");
  await waitFor("document.querySelectorAll('.arrivals .product-card').length===4");
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.arrivals .product-meta h3')).map(n=>n.textContent)"),catalog.slice(0,4).map(p=>p.name_en));
  assert.equal(await evaluate("document.querySelectorAll('.best .product-card').length"),19);
  assert(await evaluate("Array.from(document.querySelectorAll('main .product-card img')).every(i=>!i.getAttribute('src').includes('placeholder'))"));
  await screenshot('catalog-live-home-desktop');
  await evaluate("document.querySelectorAll('.site-header nav button')[2].click()");
  await waitFor("document.querySelectorAll('.series-page [data-series-card]').length===7");
  assert.equal(await evaluate("document.querySelectorAll('[data-series-card]').length"),7);
  await navigate('shop');
  await waitFor("document.querySelectorAll('.shop-grid .product-card').length===23");
  await waitFor("Array.from(document.querySelectorAll('.shop-grid img')).every(i=>i.complete&&i.naturalWidth>0)");
  assert.deepEqual(await names(),catalog.map(p=>p.name_en));
  assert(await evaluate("Array.from(document.querySelectorAll('.shop-grid img')).every(i=>i.getAttribute('src').startsWith('/manga-store/backend/public/uploads/products/'))"));
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.shop-grid')).gridTemplateColumns.split(' ').length"),3);
  await screenshot('catalog-live-shop-desktop');
  const rect=await evaluate("(() => {const r=document.querySelector('.shop-grid .product-img').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x,y:rect.y});
  await pause(550);
  assert.notEqual(await evaluate("getComputedStyle(document.querySelector('.shop-grid img')).transform"),'none');
  report.hoverEffect='passed';
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:2,y:2});
  for(const [label,total] of [['Manga Books',14],['Japanese Novels',3],['Figures',6]]) {
    await evaluate(`Array.from(document.querySelectorAll('.shop-layout aside button')).find(b=>b.textContent.includes(${JSON.stringify(label)})).click()`);
    await waitFor(`document.querySelectorAll('.shop-grid .product-card').length===${total}`);
  }
  await evaluate("document.querySelector('.shop-layout aside button').click()");
  await setQuery('Naruto');
  await waitFor("document.querySelectorAll('.shop-grid .product-card').length===2");
  assert((await names()).every(name=>name.includes('Naruto')));
  await setQuery('');
  await waitFor("document.querySelectorAll('.shop-grid .product-card').length===23");
  report.filters={manga:14,novels:3,figures:6,searchNaruto:2};
  for(const product of catalog) {
    const index=catalog.findIndex(p=>p.sku===product.sku);
    await evaluate(`document.querySelectorAll('.shop-grid .product-img')[${index}].click()`);
    await waitFor(`Number(document.querySelector('[data-product-id]')?.dataset.productId)===${product.id}`);
    await waitFor(`document.querySelectorAll('.thumbs button').length===${product.images.length}`);
    assert.equal(await evaluate("document.querySelector('.product-info h1').textContent"),product.name_en);
    assert((await evaluate("document.querySelector('.product-info > p').textContent")).includes(product.description_en));
    assert.equal(await evaluate("document.querySelector('.main-image img').getAttribute('src')"),product.image_url);
    assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.thumbs img')).map(i=>i.getAttribute('src'))"),product.images.map(i=>i.image_url));
    for(let imageIndex=0;imageIndex<product.images.length;imageIndex++) {
      await evaluate(`document.querySelectorAll('.thumbs button')[${imageIndex}].click()`);
      await waitFor(`document.querySelector('.main-image img')?.getAttribute('src')===${JSON.stringify(product.images[imageIndex].image_url)}`);
      await waitFor("document.querySelector('.main-image img')?.complete && document.querySelector('.main-image img')?.naturalWidth>0");
      report.gallerySelections++;
    }
    const last=product.images.at(-1);
    const detailRequests=requests.filter(url=>url.includes('/api/product.php')).length;
    await language('vi');
    await waitFor(`document.querySelector('.product-info h1')?.textContent===${JSON.stringify(product.name_vi)}`);
    assert.equal(await evaluate("document.querySelector('.main-image img').getAttribute('src')"),last.image_url);
    assert.equal(await evaluate("document.querySelector('.main-image img').getAttribute('alt')"),last.alt_vi);
    assert((await evaluate("document.querySelector('.product-info > p').textContent")).includes(product.description_vi));
    const price=product.sale_price_vnd??product.price_vnd;
    assert(await evaluate(`document.querySelector('.product-info h2').textContent.startsWith(new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',currencyDisplay:'code'}).format(${price}))`));
    assert.equal(requests.filter(url=>url.includes('/api/product.php')).length,detailRequests);
    await language('en');
    await waitFor(`document.querySelector('.product-info h1')?.textContent===${JSON.stringify(product.name_en)}`);
    assert.equal(await evaluate("document.querySelector('.main-image img').getAttribute('alt')"),last.alt_en);
    assert(await evaluate(`document.querySelector('.product-info h2').textContent.startsWith(new Intl.NumberFormat('en-US',{style:'currency',currency:'VND',currencyDisplay:'symbol'}).format(${price}))`));
    if(product.sku==='CAT-NV-WWY-VI') await evaluate("document.querySelector('.purchase .ink-btn').click()");
    if(product.sku==='CAT-FG-FRI-PUP') await screenshot('catalog-live-figure-desktop');
    report.detailIds.push(product.id);
    await navigate('shop');
    await waitFor("document.querySelectorAll('.shop-grid .product-card').length===23");
  }
  console.log('PASS actual GUI: all 23 details, all '+report.gallerySelections+' gallery selections, VI/EN names/descriptions/alts, VND, real images, category filters/search and hover');
  await evaluate("document.querySelector('.header-actions .cart-icon').click()");
  await waitFor("document.querySelectorAll('.cart-row').length===1");
  const cartProduct=catalog.find(p=>p.sku==='CAT-NV-WWY-VI');
  assert.equal(await evaluate("document.querySelector('.cart-row h3').textContent"),cartProduct.name_en);
  await language('vi');
  await waitFor(`document.querySelector('.cart-row h3')?.textContent===${JSON.stringify(cartProduct.name_vi)}`);
  assert((await evaluate("document.querySelector('.cart-row').textContent")).includes('85.000'));
  assert.equal(await evaluate("document.querySelector('.summary .ink-btn').disabled"),false);
  report.cart='item retained while navigating all products and switching languages; checkout disabled';
  await language('en');
  await navigate('shop');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await waitFor("getComputedStyle(document.querySelector('.shop-grid')).gridTemplateColumns.split(' ').length===2");
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await pause(2600); // Wait for the existing cart toast to disappear before the screenshot.
  await screenshot('catalog-live-shop-mobile');
  const figure=catalog.find(p=>p.sku==='CAT-FG-MAR-PUP');
  await evaluate(`document.querySelectorAll('.shop-grid .product-img')[${catalog.findIndex(p=>p.id===figure.id)}].click()`);
  await waitFor(`Number(document.querySelector('[data-product-id]')?.dataset.productId)===${figure.id}`);
  await waitFor("document.querySelector('.main-image img')?.naturalWidth>0");
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
  assert.equal(await evaluate("document.querySelectorAll('.thumbs button').length"),3);
  await evaluate("document.querySelectorAll('.thumbs button')[1].click()");
  await waitFor(`document.querySelector('.main-image img')?.getAttribute('src')===${JSON.stringify(figure.images[1].image_url)}`);
  await screenshot('catalog-live-figure-mobile');
  report.viewports=[{width:1440,height:1000,shopColumns:3},{width:390,height:844,shopColumns:2,horizontalOverflow:false}];
  assert.equal(exceptions.length,0,JSON.stringify(exceptions));
  assert.equal(consoleErrors.length,0,JSON.stringify(consoleErrors));
  report.uncaughtExceptions=exceptions;report.consoleErrors=consoleErrors;
  report.actualApiRequests=requests.filter(url=>url.includes('/api/'));
  report.failedProductImageRequests=failures.filter(f=>f.url?.includes('/uploads/products/'));
  assert.equal(report.failedProductImageRequests.length,0);
  await writeFile(path.join(artifacts,'catalog-live-browser.json'),JSON.stringify(report,null,2));
  console.log('PASS actual GUI: desktop/mobile, cart identity retained, no uncaught exceptions or console.error, no failed product image requests');
} finally {
  if(socket) socket.close();
  browser.kill();
}
