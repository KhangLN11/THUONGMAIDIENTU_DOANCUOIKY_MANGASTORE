import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
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
  if(baseline) {
    await writeFile(path.join(artifacts,'baseline-home.html'),await evaluate("document.querySelector('main').outerHTML"));
    await screenshot('baseline-home-desktop');
    await navigate('shop');
    await writeFile(path.join(artifacts,'baseline-shop.html'),await evaluate("document.querySelector('main').outerHTML"));
    await screenshot('baseline-shop-desktop');
    await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await screenshot('baseline-shop-mobile');
    console.log('PASS baseline saved: Home/Shop desktop, Shop mobile, DOM snapshots');
  } else if(mode==='demo') {
    assert.equal(await evaluate("document.querySelector('main').outerHTML"),await readFile(path.join(artifacts,'baseline-home.html'),'utf8'),'Demo Home DOM differs');
    await navigate('shop');
    assert.equal(await evaluate("document.querySelector('main').outerHTML"),await readFile(path.join(artifacts,'baseline-shop.html'),'utf8'),'Demo Shop DOM differs');
    assert.equal(requests.filter(url=>url.includes('/api/')).length,0,'Demo must not fetch API');
    await screenshot('demo-shop-desktop');
    await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await screenshot('demo-shop-mobile');
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'),'Mobile horizontal overflow');
    console.log('PASS demo: Home/Shop DOM identical to baseline; no API requests; mobile no overflow');
  } else {
    await navigate('shop');
    await waitFor("document.querySelectorAll('.shop-grid .product-card').length===8");
    assert((await evaluate("document.querySelector('.shop-grid').textContent")).includes('Night Rain Journey'));
    assert((await evaluate("document.querySelector('.shop-grid').textContent")).includes('45,000'));
    assert(await evaluate("Array.from(document.querySelectorAll('.shop-grid img')).every(i=>i.complete && i.naturalWidth>0)"));
    await screenshot('live-shop-desktop');
    await evaluate("document.querySelector('.shop-grid .product-img').click()");
    await waitFor("!!document.querySelector('[data-product-id=\"1\"]')");
    assert(requests.some(url=>url.includes('/api/product.php?id=1')));
    assert((await evaluate("document.querySelector('.product-info').textContent")).includes('Night Rain Journey'));
    const detailRequests = requests.filter(url=>url.includes('/api/product.php')).length;
    await language('vi');
    await waitFor("document.querySelector('.product-info h1')?.textContent.includes('Hành Trình Mưa Đêm')");
    assert.equal(await evaluate("document.querySelector('[data-product-id]')?.dataset.productId"),'1');
    assert.equal(requests.filter(url=>url.includes('/api/product.php')).length,detailRequests,'Language should not refetch detail');
    await screenshot('live-detail-vi-desktop');
    await evaluate("document.querySelector('.purchase .ink-btn').click()");
    await evaluate("document.querySelector('.header-actions .cart-icon').click()");
    await waitFor("!!document.querySelector('.cart-row')");
    assert((await evaluate("document.querySelector('.cart-page').textContent")).includes('45.000'));
    await language('en');
    await waitFor("document.querySelector('.cart-row h3')?.textContent.includes('Night Rain Journey')");
    await navigate('shop');
    await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    await screenshot('live-shop-mobile');
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'),'Mobile horizontal overflow');
    await evaluate("document.querySelector('.shop-grid .product-img').click()");
    await waitFor("!!document.querySelector('[data-product-id=\"1\"]')");
    await screenshot('live-detail-mobile');
    assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'),'Detail mobile horizontal overflow');
    // Intercept only browser requests; database and Apache remain untouched.
    await navigate('shop');
    await cdp('Fetch.enable',{patterns:[{urlPattern:'*api/product.php*',requestStage:'Request'}]});
    let interceptedReply = () => ({status:404,body:{success:false,error:{code:'PRODUCT_NOT_FOUND',message:'Not found'}}});
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Fetch.requestPaused') {
        void (async () => {
          const reply = await interceptedReply(message.params);
          await cdp('Fetch.fulfillRequest', {requestId:message.params.requestId,responseCode:reply.status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(reply.body)).toString('base64')});
        })().catch(error => {
          // React StrictMode/reloads can abort an intercepted request before fulfillment.
          if (!/Invalid InterceptionId|Invalid interceptionId|Invalid parameters|Session closed/.test(error.message || "")) console.error('CDP interception:', error);
        });
      }
    });
    await evaluate("document.querySelector('.shop-grid .product-img').click()");
    await waitFor("!!document.querySelector('[role=alert]')");
    assert((await evaluate("document.querySelector('[role=alert]').textContent")).includes('not found'));
    await cdp('Fetch.disable');
    await evaluate("document.querySelector('[role=alert] button').click()");
    await waitFor("!!document.querySelector('[data-product-id=\"1\"]')");
    // Offline list, explicit retry, then empty and loading states on full reload.
    await cdp('Network.setBlockedURLs',{urls:['*api/products.php*']});
    await reload();
    await navigate('shop');
    await waitFor("!!document.querySelector('[role=alert]')");
    assert.equal(await evaluate("document.querySelectorAll('.shop-grid .product-card').length"),0,'No demo fallback');
    await screenshot('live-api-error');
    await cdp('Network.setBlockedURLs',{urls:[]});
    await evaluate("document.querySelector('[role=alert] button').click()");
    await waitFor("document.querySelectorAll('.shop-grid .product-card').length===8");
    console.log('PASS detail, language, cart, mobile, 404/network retry');
    // Actual ID 8 must load its own detail, not a position-based default.
    await evaluate("document.querySelectorAll('.shop-grid .product-img')[7].click()");
    await waitFor("!!document.querySelector('[data-product-id=\"8\"]')");
    assert((await evaluate("document.querySelector('.product-info').textContent")).includes('Train Ticket Bookmark'));
    assert(requests.some(url => url.includes('/api/product.php?id=8')));
    await navigate('shop');
    const actual = await (await fetch('http://localhost:8443/api/products.php')).json();
    // Hold response while asserting skeleton dimensions; release as empty catalog.
    let release;
    let gate = new Promise(resolve => { release=resolve; });
    interceptedReply = async () => { await gate; return {status:200,body:{success:true,data:[],meta:{total:0}}}; };
    await cdp('Fetch.enable',{patterns:[{urlPattern:'*api/products.php*',requestStage:'Request'}]});
    await reload();
    await navigate('shop');
    await waitFor("document.querySelectorAll('.shop-grid [aria-busy=true]').length===6");
    const loadingHeight = await evaluate("document.querySelector('.shop-grid .product-img').getBoundingClientRect().height");
    await screenshot('live-loading-mobile');
    release();
    await waitFor("document.querySelector('.shop-grid [role=status]')?.textContent.includes('No products')");
    assert.equal(await evaluate("document.querySelectorAll('.shop-grid .product-card').length"),0);
    await screenshot('live-empty-mobile');
    console.log('PASS loading/empty skeleton');
    // Invalid JSON shape and success=false even with HTTP 200 must fail visibly.
    for (const body of [{success:true,data:[{id:1}],meta:{total:1}}, {success:false,error:{code:'DATABASE_ERROR',message:'private server message'}}]) {
      interceptedReply = () => ({status:200,body});
      await reload();
      await navigate('shop');
      await waitFor("!!document.querySelector('[role=alert]')");
      assert(!(await evaluate("document.body.textContent")).includes('private server message'));
    }
    console.log('PASS malformed and success=false responses');
    // Mock a nonsequential ID, zero stock, missing image URL target and a zero-price sale.
    const mocked = {...actual.data[0],id:71,stock_quantity:0,sale_price_vnd:0,image_url:'/missing-product-test-image.png'};
    interceptedReply = params => ({status:200,body:params.request.url.includes('products.php') ? {success:true,data:[mocked],meta:{total:1}} : {success:true,data:mocked}});
    await cdp('Fetch.enable',{patterns:[{urlPattern:'*api/products.php*',requestStage:'Request'},{urlPattern:'*api/product.php*',requestStage:'Request'}]});
    await reload();
    await navigate('shop');
    await waitFor("document.querySelectorAll('.shop-grid .product-card').length===1");
    await waitFor("document.querySelector('.shop-grid img')?.getAttribute('src') === '/product-placeholder.svg'");
    assert(await evaluate("document.querySelector('.shop-grid .quick-actions button:last-child').disabled"));
    assert(await evaluate("getComputedStyle(document.querySelector('.shop-grid .product-meta small')).display !== 'none'"));
    await evaluate("document.querySelector('.shop-grid .product-img').click()");
    await waitFor("!!document.querySelector('[data-product-id=\"71\"]')");
    assert(requests.some(url=>url.includes('/api/product.php?id=71')));
    assert(await evaluate("document.querySelector('.purchase .ink-btn').disabled"));
    assert((await evaluate("document.querySelector('.product-info h2').textContent")).includes('0'));
    await cdp('Fetch.disable');
    await reload();
    await navigate('shop');
    await waitFor("document.querySelectorAll('.shop-grid .product-card').length===8");
    assert.equal(await evaluate("document.querySelector('.shop-grid .product-img').getBoundingClientRect().height"),loadingHeight);
    await evaluate("window.scrollTo(0,0)");
    await screenshot('live-shop-mobile');
    await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    await screenshot('live-shop-desktop');
    console.log('PASS live: actual IDs 1/8, nonsequential mock 71, VND, VI/EN, cart, null/broken images, stock zero, zero-price sale, mobile, loading/empty, malformed/failed responses, 404/network error + retry, no fallback');
  }
  assert.equal(exceptions.length,0,JSON.stringify(exceptions));
  assert.equal(consoleErrors.length,0,JSON.stringify(consoleErrors));
  console.log('PASS: no uncaught browser exceptions');
  await writeFile(path.join(artifacts,baseline?'baseline-network.json':mode+'-network.json'),JSON.stringify({requests,failures,exceptions,consoleErrors},null,2));
} finally {
  if(socket) socket.close();
  browser.kill();
}
