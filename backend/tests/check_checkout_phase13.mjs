import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
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
const nonce=randomBytes(6).toString('hex');const emails=['auth-test-'+nonce+'@example.test','auth-test-'+nonce+'-other@example.test'];const password=randomBytes(24).toString('base64url');
function cli(script,input){const r=spawnSync('C:/xampp/php/php.exe',['backend/'+script],{input:JSON.stringify(input),encoding:'utf8',env:{...process.env,DB_NAME:'manga_store_orders_test_20261120'},windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout;}
for(const [i,email] of emails.entries()){assert(!JSON.parse(cli('tests/auth_fixture.php',{email,action:'inspect'})).exists);cli('scripts/admin_account.php',{action:'create',email,full_name:'Order GUI '+(i===0?'A':'B'),password});if(i===0)cli('tests/auth_fixture.php',{email,action:'demote'});}

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
    await waitFor("!window.__testReload && !!document.querySelector('.site-header,[data-checkout-api]')");
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



 const report={checks:[],viewports:[1440,900,390]};let lose=false;
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Fetch.requestPaused'){if(lose){lose=false;void cdp('Fetch.failRequest',{requestId:m.params.requestId,errorReason:'Aborted'}).catch(()=>{});}else void cdp('Fetch.continueRequest',{requestId:m.params.requestId}).catch(()=>{});}});
 const field=async(selector,value)=>evaluate(`(()=>{const i=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 const account=async()=>{await evaluate("window.location.hash='#account'");await waitFor("!!document.querySelector('.account-page')");};
 const login=async n=>{await account();await waitFor("!!document.querySelector('.account-page form button[type=submit]:not(:disabled)')");await field('input[name=email]',emails[n]);await field('input[name=password]',password);await evaluate("document.querySelector('.account-page form').requestSubmit()");try{await waitFor(`document.querySelector('.account-layout aside h3')?.textContent==='Order GUI ${n===0?'A':'B'}'`);}catch(e){await screenshot('orders-login-diagnostic');console.log('Login diagnostic',await evaluate("({heading:document.querySelector('.account-layout aside h3')?.textContent,email:document.querySelector('[name=email]')?.value,passwordLength:document.querySelector('[name=password]')?.value.length,alerts:Array.from(document.querySelectorAll('.account-page [role=alert]')).map(n=>n.textContent),buttons:Array.from(document.querySelectorAll('.account-page form button')).map(n=>({text:n.textContent,disabled:n.disabled}))})"));throw e;}};
 const activeRequests=new Set();let lastNetwork=Date.now();socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Network.requestWillBeSent'&&m.params.request.url.includes('/api/')){activeRequests.add(m.params.requestId);lastNetwork=Date.now();}if(['Network.loadingFinished','Network.loadingFailed'].includes(m.method)&&activeRequests.delete(m.params.requestId))lastNetwork=Date.now();});
 const settled=async()=>{for(let i=0;i<100;i++){if(activeRequests.size===0&&Date.now()-lastNetwork>=250)return;await pause(50);}throw new Error('Background API did not settle before account switch');};
 const logout=async()=>{await account();await settled();await evaluate("Array.from(document.querySelectorAll('.account-page button')).find(b=>['SIGN OUT','LOG OUT','ĐĂNG XUẤT'].includes(b.textContent)&&b.getClientRects().length).click()");await waitFor("!!document.querySelector('.account-page form')");};
 const openCart=async()=>{await evaluate("document.querySelector('.cart-icon').click()");await waitFor("!!document.querySelector('.cart-page')");};
 const inspect=()=>JSON.parse(cli('tests/orders_fixture.php',{action:'inspect',email:emails[0],product_id:9}));

 const fill=async()=>{await waitFor("!!document.querySelector('[data-checkout-api] form')");for(const [name,value] of Object.entries({recipient_name:'Nguyễn Khách Sandbox',recipient_phone:'0900000000',province:'Thành phố Demo',district:'Quận Demo',ward:'Phường Demo',address_line:'123 Đường Demo',customer_note:'Sandbox test only'})){await evaluate(`(()=>{const i=document.querySelector('[name=${name}]');Object.getOwnPropertyDescriptor(i.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`);}};
 const stock=id=>JSON.parse(cli('tests/orders_fixture.php',{action:'inspect',email:emails[0],product_id:id})).stock;
 const hash=async value=>{await evaluate('location.hash='+JSON.stringify(value));await pause(150);};
 const click=async selector=>evaluate('document.querySelector('+JSON.stringify(selector)+').click()');
 const submit=async()=>evaluate("document.querySelector('[data-checkout-api] form').requestSubmit()");
 const step=()=>evaluate("Array.from(document.querySelectorAll('.checkout-progress li')).findIndex(i=>i.classList.contains('current'))+1");
 const capture=async label=>{for(const width of [1440,900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await evaluate('window.scrollTo({top:0,behavior:"instant"})');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'),label+' overflow '+width);await screenshot('13-'+label+'-'+width);}};
 const payment=async(method='cod')=>{await fill();await submit();await waitFor("!!document.querySelector('[name=payment_choice]')");assert.equal(await step(),2);await click('[name=payment_choice][value='+method+']');};
 await login(0);await navigate('shop');await waitFor("document.querySelectorAll('.shop-grid .product-card').length===23");
 await evaluate("document.querySelectorAll('.shop-grid .shop-card-actions button')[3].click()");await waitFor("document.querySelector('.cart-icon b')?.textContent==='1'");await evaluate("document.querySelectorAll('.shop-grid .shop-card-actions button')[5].click()");await waitFor("document.querySelector('.cart-icon b')?.textContent==='2'");
 const stocks=[stock(10),stock(11)];await openCart();await click('.summary .ink-btn');await waitFor("!!document.querySelector('[data-checkout-api] form')");assert.equal(await evaluate("document.querySelectorAll('.checkout-progress li').length"),3);assert.equal(await step(),1);await submit();await waitFor("document.querySelectorAll('.checkout-field-error').length>0");assert.equal(inspect().orders.length,0);await screenshot('13-information-validation');await fill();await capture('information-en');
 await submit();await waitFor("!!document.querySelector('[name=payment_choice]')");assert.equal(await step(),2);assert.equal(inspect().orders.length,0);assert.equal(await evaluate("document.querySelectorAll('[data-order-qr]').length"),0);await capture('payment-cod-en');
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 lose=true;await cdp('Fetch.enable',{patterns:[{urlPattern:'*orders/create.php*',requestStage:'Response'}]});await evaluate("document.querySelector('[data-checkout-api] form').requestSubmit();document.querySelector('[data-checkout-api] form').requestSubmit()");await waitFor("!!document.querySelector('[data-checkout-api] [role=alert]')");assert.equal(inspect().orders.length,1);assert.equal(stock(10),stocks[0]-1);assert.equal(stock(11),stocks[1]-1);await cdp('Fetch.disable');await submit();await waitFor("location.hash.startsWith('#checkout/complete/') && !!document.querySelector('[data-order-code]')");
 const cartOrderId=await evaluate("Number(location.hash.split('/').at(-1))");assert.equal(await step(),3);assert((await evaluate("document.querySelector('.checkout-receipt').textContent")).includes('unpaid'));await capture('complete-cod-en');
 const posts=requests.filter(u=>u.includes('orders/create.php')).length;await evaluate('window.__phase13reload=true');await cdp('Page.reload');await waitFor("!window.__phase13reload && !!document.querySelector('[data-order-code]')");assert.equal(requests.filter(u=>u.includes('orders/create.php')).length,posts);assert.equal(inspect().orders.length,1);
 await click('.checkout-actions .primary');await waitFor("!!document.querySelector('[data-order-detail]')");assert((await evaluate("document.querySelector('[data-order-detail]').textContent")).includes('Nguyễn Khách Sandbox'));await capture('order-detail-cod-en');await click('[data-order-detail] .ink-btn');await waitFor("document.querySelector('[data-order-detail]')?.textContent.includes('Cancelled')");assert.equal(stock(10),stocks[0]);assert.equal(stock(11),stocks[1]);await click('.history-detail>.checkout-button');await capture('history-en');
 report.checks.push('exactly 3 steps; per-field validation; Cart two items; COD unpaid; no order on Continue; lost response/double click retry once; completion refresh read-only; snapshots/history/cancel and no overflow at 1440/900/390');
 await navigate('shop');await waitFor("!!document.querySelector('.shop-grid')");await evaluate("document.querySelectorAll('.shop-grid .shop-card-actions button')[7].click()");await waitFor("document.querySelector('.cart-icon b')?.textContent==='1'");const cartRows=await evaluate("fetch('/api/cart.php').then(r=>r.json()).then(r=>r.data.items.map(i=>({product_id:i.product_id,quantity:i.quantity,id:i.id})))");
 await click('.shop-grid .shop-card-actions button');await payment('cod');const buyCodStock=stock(9);await submit();await waitFor("location.hash.startsWith('#checkout/complete/') && !!document.querySelector('[data-order-code]')");const buyCod=await evaluate("fetch('/api/orders/detail.php?id='+location.hash.split('/').at(-1)).then(r=>r.json()).then(r=>r.data)");assert.equal(buyCod.payment_method,'cod');assert.equal(buyCod.payment_status,'pending');assert.equal(buyCod.items.length,1);assert.equal(buyCod.items[0].product_id,9);assert.equal(stock(9),buyCodStock-1);await capture('buy-now-cod-en');await click('.checkout-actions .primary');await waitFor("!!document.querySelector('[data-order-detail]')");await click('[data-order-detail] .ink-btn');await waitFor("document.querySelector('[data-order-detail]')?.textContent.includes('Cancelled')");assert.equal(stock(9),buyCodStock);report.checks.push('Buy Now COD creates exactly one selected item, unpaid, stock once; cancellation restores inventory; existing cart retained');
 await hash('#product/9');await waitFor("!!document.querySelector('.product-info .qty')");await click('.qty button:last-child');await click('.product-info .buy');await payment('vietqr');assert.equal(await evaluate("document.querySelectorAll('.checkout-item').length"),1);assert((await evaluate("document.querySelector('.checkout-item small').textContent")).includes('2'));await capture('payment-vietqr-en');
 const oldStock=stock(9);lose=true;await cdp('Fetch.enable',{patterns:[{urlPattern:'*orders/create.php*',requestStage:'Response'}]});await submit();await waitFor("!!document.querySelector('[data-checkout-api] [role=alert]')");assert.equal(stock(9),oldStock-2);await cdp('Fetch.disable');const postCount=requests.filter(u=>u.includes('orders/create.php')).length;await evaluate('window.__phase13recover=true');await cdp('Page.reload');await waitFor("!window.__phase13recover && location.hash.startsWith('#checkout/complete/') && !!document.querySelector('[data-order-qr]')");assert.equal(requests.filter(u=>u.includes('orders/create.php')).length,postCount);assert.equal(stock(9),oldStock-2);
 const bankId=await evaluate("Number(location.hash.split('/').at(-1))");const raw=await evaluate('fetch("/api/orders/detail.php?id='+bankId+'").then(r=>r.json()).then(r=>r.data)');assert.equal(raw.payment_method,'bank_transfer');assert.equal(raw.payment_status,'pending');assert.equal(raw.payment_instructions.account_number,null);assert.equal(raw.payment_instructions.bank_bin,null);assert(raw.payment_instructions.simulation);assert(raw.payment_instructions.qr_payload.includes('NOT-A-PAYMENT'));
 await evaluate(await readFile('C:/xampp/manga-store-backups/2026-11-25-checkout/jsQR.js','utf8'));
 const decoded=await evaluate(`new Promise(resolve=>{const svg=document.querySelector('[data-order-qr]'),img=new Image(),blob=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}),url=URL.createObjectURL(blob);img.onload=()=>{const c=document.createElement('canvas');c.width=c.height=800;const x=c.getContext('2d');x.drawImage(img,0,0,800,800);const pixels=x.getImageData(0,0,800,800);const result=jsQR(pixels.data,800,800);URL.revokeObjectURL(url);resolve(result?.data??null);};img.onerror=()=>resolve(null);img.src=url;})`);assert.equal(decoded,raw.payment_instructions.qr_payload);assert(!decoded.startsWith('000201'));
 await capture('complete-sandbox-en');await evaluate("document.querySelector('[data-payment-instructions]').scrollIntoView({block:'center',behavior:'instant'})");await screenshot('13-qr-sandbox-mobile');
 await cdp('Browser.grantPermissions',{origin:'http://localhost:8443',permissions:['clipboardReadWrite','clipboardSanitizedWrite']});await cdp('Page.bringToFront');await evaluate("document.querySelector('.checkout-qr-layout dd:last-child button').scrollIntoView({block:'center',behavior:'instant'})");const copyBox=await evaluate("(()=>{const r=document.querySelector('.checkout-qr-layout dd:last-child button').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...copyBox,button:'left',clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...copyBox,button:'left',clickCount:1});await waitFor("document.querySelector('[data-payment-instructions] [role=status]')?.textContent.includes('Copied')");assert.equal(await evaluate('navigator.clipboard.readText()'),raw.payment_instructions.reference);
 await cdp('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:'C:/xampp/manga-store-backups/2026-11-25-checkout/downloads'});await click('.checkout-qr-layout .checkout-button');await pause(500);
 assert.deepEqual(await evaluate("fetch('/api/cart.php').then(r=>r.json()).then(r=>r.data.items.map(i=>({product_id:i.product_id,quantity:i.quantity,id:i.id})))"),cartRows);assert.equal(await evaluate("document.querySelector('.cart-icon b').textContent"),'1');await language('vi');assert((await evaluate("document.querySelector('.checkout-heading').textContent")).includes('HOÀN TẤT'));await capture('complete-sandbox-vi');
 await click('.checkout-actions .primary');await waitFor("!!document.querySelector('[data-order-detail] [data-order-qr]')");await capture('order-detail-sandbox-vi');await click('[data-order-detail] .ink-btn');await waitFor("!document.querySelector('[data-order-qr]')");assert.equal(stock(9),oldStock);
 report.checks.push('Buy Now quantity2 bank/VietQR Sandbox pending; actual SVG independently decoded with jsQR: no EMV payment/BIN/account; copy/download; loss-response refresh one order/stock; Cart retained; VI/EN success/history and cancellation');
 await language('en');await navigate('shop');await waitFor("!!document.querySelector('.shop-grid')");await click('.shop-grid .shop-card-actions button');await payment('bank_transfer');await submit();await waitFor("location.hash.startsWith('#checkout/complete/') && !!document.querySelector('[data-order-qr]')");const manualId=await evaluate("Number(location.hash.split('/').at(-1))");await click('.checkout-actions .primary');await waitFor("!!document.querySelector('[data-order-detail]')");await logout();await login(1);await hash('#admin/orders');await waitFor("!!document.querySelector('.admin-table-wrap tbody tr')");await evaluate('Array.from(document.querySelectorAll(".admin-table-wrap tbody tr")).find(r=>r.textContent.includes('+JSON.stringify('MS-')+')).querySelector("button").click()');await waitFor("!!document.querySelector('[name=received_amount]')");assert.equal(await evaluate("Number(document.querySelector('[data-admin-order]').dataset.adminOrder)"),manualId);
 await field('[name=received_amount]','250000');await field('[name=received_payment_reference]','MU'+manualId);await field('[name=payment_reference]','SANDBOX-GUI-'+nonce);await click('[name=received]');
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Page.javascriptDialogOpening')void cdp('Page.handleJavaScriptDialog',{accept:true});});await evaluate("Array.from(document.querySelectorAll('[data-admin-order] button')).find(b=>b.textContent.includes('CONFIRM BANK RECEIPT')).click()");await waitFor("document.querySelector('[data-admin-order]')?.textContent.includes('Paid') && !document.querySelector('[name=received_amount]')");await screenshot('13-admin-sandbox-reconciled');
 await hash('#admin/reports');await waitFor("!!document.querySelector('[data-report-metric=collected_bank_vnd]')");assert((await evaluate("document.querySelector('[data-report-metric=collected_bank_vnd]').textContent")).includes('250,000'));await screenshot('13-reports-sandbox-bank');report.checks.push('manual bank Sandbox order; actual Admin UI amount/reference/receipt reconciliation; paid state only after admin; Reports bank total separate from COD');
 assert.equal(exceptions.length,0,JSON.stringify(exceptions));report.result='PASS';report.exceptions=exceptions;report.qrDecoded=decoded;await writeFile(path.join(artifacts,'13-checkout-browser.json'),JSON.stringify(report,null,2));console.log('PASS Phase13 actual Chrome: three steps, Cart/Buy Now COD and bank Sandbox, SVG decode/copy/download, retry/refresh, Admin/Reports, VI/EN responsive');
}finally{cli('tests/orders_fixture.php',{action:'cleanup',emails});if(socket)socket.close();browser.kill();}
