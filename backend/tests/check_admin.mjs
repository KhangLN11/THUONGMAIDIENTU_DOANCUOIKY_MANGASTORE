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
const nonce=randomBytes(6).toString('hex'),emails=['auth-test-'+nonce+'-admin@example.test','auth-test-'+nonce+'@example.test'],password=randomBytes(24).toString('base64url'),sku='ADMTEST-'+nonce;
function cli(script,input){const r=spawnSync('C:/xampp/php/php.exe',['backend/'+script],{input:JSON.stringify(input),encoding:'utf8',env:{...process.env,DB_NAME:'manga_store_admin_test_20261122'},windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout;}
for(const [i,email] of emails.entries()){assert(!JSON.parse(cli('tests/auth_fixture.php',{email,action:'inspect'})).exists);cli('scripts/admin_account.php',{action:'create',email,full_name:i===0?'Admin GUI Operator':'Admin GUI Customer',password});if(i)cli('tests/auth_fixture.php',{email,action:'demote'});}

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



 const report={checks:[],viewports:[1440,900,390],dialogs:[]};
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Page.javascriptDialogOpening'){report.dialogs.push(m.params.message);void cdp('Page.handleJavaScriptDialog',{accept:true}).catch(()=>{});}});
 const field=async(selector,value)=>evaluate(`(()=>{const i=document.querySelector(${JSON.stringify(selector)});const proto=i.tagName==='SELECT'?HTMLSelectElement.prototype:i.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event(i.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
 const account=async()=>{await evaluate("window.location.hash='#account'");await waitFor("!!document.querySelector('.account-page')");};
 const login=async n=>{await account();await waitFor("!!document.querySelector('.account-page form')");await field('input[name=email]',emails[n]);await field('input[name=password]',password);await evaluate("document.querySelector('.account-page form').requestSubmit()");await waitFor(`document.querySelector('.account-layout aside h3')?.textContent===${JSON.stringify(n===0?'Admin GUI Operator':'Admin GUI Customer')}`);};
 const nav=async name=>{await evaluate(`window.location.hash='#admin/${name}'`);await waitFor(`document.querySelector('.admin-sidebar nav button[aria-current=page]')?.textContent===${JSON.stringify(name.toUpperCase())}`);};
 const button=async(text,scope='.admin-main')=>evaluate(`(()=>{const b=Array.from(document.querySelectorAll(${JSON.stringify(scope+' button')})).find(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled);if(!b)throw new Error('Button not found: '+${JSON.stringify(text)});b.click();})()`);
 const adminLanguage=async(lang)=>{await evaluate(`Array.from(document.querySelectorAll('.admin-topbar button')).find(b=>b.textContent==='${lang}').click()`);await pause(150);};
 await evaluate("window.location.hash='#admin'");await waitFor("document.querySelector('.admin-auth [role=alert]')?.textContent.includes('Sign in')");assert.equal(await evaluate("!!document.querySelector('.admin-main')"),false);
 await login(1);await evaluate("window.location.hash='#admin'");await waitFor("document.querySelector('.admin-auth [role=alert]')?.textContent.includes('permission')");assert.equal(await evaluate("fetch('/api/admin/dashboard.php').then(r=>r.status)"),403);
 await account();await evaluate("Array.from(document.querySelectorAll('.account-page button')).find(b=>b.textContent==='SIGN OUT'&&b.getClientRects().length).click()");await waitFor("!!document.querySelector('.account-page form')");
 await login(0);await evaluate("Array.from(document.querySelectorAll('.account-page button')).find(b=>b.textContent==='ADMIN ACCESS').click()");await waitFor("document.querySelector('[data-metric=active_products]')?.textContent==='23'");
 assert.equal(await evaluate("document.querySelector('[data-metric=collected_cod_vnd]').textContent"),new Intl.NumberFormat('en-US',{style:'currency',currency:'VND'}).format(0));await screenshot('admin-dashboard-desktop');
 await nav('products');await waitFor("document.querySelectorAll('.admin-table-wrap tbody tr').length>0");await button('+ ADD PRODUCT');
 await waitFor("!!document.querySelector('[data-admin-product-form] form')");
 for(const [name,value] of Object.entries({sku,slug:'admin-gui-'+nonce,name_vi:'Sản phẩm Admin GUI',name_en:'Admin GUI Product',description_vi:'Mô tả quản trị',description_en:'Admin description',price_vnd:'50000',sale_price_vnd:'45000',stock_quantity:'3'}))await field(`[data-admin-product-form] [name=${name}]`,value);
 await waitFor("document.querySelector('[name=category_id]')?.options.length>1");
 const category=await evaluate("document.querySelector('[name=category_id]').options[1].value");await field('[name=category_id]',category);await field('[name=product_status]','active');
 await evaluate("document.querySelector('[data-admin-product-form] form').requestSubmit()");await waitFor("!!document.querySelector('[data-admin-product-form] input[name=image]')");
 const pid=JSON.parse(cli('tests/admin_fixture.php',{action:'find-product',sku})).id;assert(pid>31);
 const manifest=JSON.parse(await readFile(path.resolve(root,'../database/catalog/demo-products/manifest.json'),'utf8'));const file=path.resolve(root,'../database/catalog/demo-products',manifest.products[0].images[0].local_path);
 await cdp('DOM.enable');const doc=await cdp('DOM.getDocument');const input=await cdp('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'input[name=image]'});await cdp('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[file]});
 await waitFor("Array.from(document.querySelectorAll('.admin-main button')).some(b=>b.textContent==='UPLOAD IMAGE'&&!b.disabled)");await button('UPLOAD IMAGE');await waitFor("document.querySelectorAll('.admin-gallery img').length===1 && document.querySelector('.admin-gallery img').naturalWidth>0");
 await field('[name=name_en]','Admin GUI Product Updated');await evaluate("document.querySelector('[data-admin-product-form] form').requestSubmit()");await waitFor("document.querySelector('[role=status]')?.textContent==='Saved successfully.'");await screenshot('admin-product-form-desktop');
 await button('CLOSE');await waitFor("!!document.querySelector('[name=product_search]')");await field('[name=product_search]',sku);await waitFor("document.querySelectorAll('.admin-table-wrap tbody tr').length===1");await button('ARCHIVE');await waitFor("document.querySelector('.admin-table-wrap tbody tr')?.textContent.includes('Archived')");await button('ACTIVATE');await waitFor("document.querySelector('.admin-table-wrap tbody tr')?.textContent.includes('Active')");
 await nav('inventory');await field('[name=inventory_search]',sku);await waitFor("document.querySelectorAll('.admin-table-wrap tbody tr').length===1");await button('ADJUST STOCK');await waitFor("!!document.querySelector('[data-admin-inventory-form]')");
 await field('[name=quantity_delta]','2');await field('[name=reason]','GUI stock check');await evaluate("document.querySelector('[data-admin-inventory-form] form').requestSubmit()");await waitFor("document.querySelector('[data-current-stock]')?.textContent==='5'");
 await field('[name=quantity_delta]','-9');await field('[name=reason]','Invalid negative stock');await evaluate("document.querySelector('[data-admin-inventory-form] form').requestSubmit()");await waitFor("document.querySelector('.admin-main [role=alert]')?.textContent.includes('cannot be negative')");assert.equal(await evaluate("document.querySelector('[data-current-stock]').textContent"),'5');await screenshot('admin-inventory-desktop');
 report.checks.push('guest/customer UI and HTTP denied; admin dashboard; create/edit/archive/activate; real file upload; inventory validation/reason/history');
 const order=JSON.parse(cli('tests/admin_fixture.php',{action:'order',email:emails[1],product_id:pid}));await nav('orders');await field('[name=order_search]',order.order_code);await field('[name=order_status_filter]','pending');await waitFor("document.querySelectorAll('.admin-table-wrap tbody tr').length===1");await button('VIEW DETAILS');await waitFor(`Number(document.querySelector('[data-admin-order]')?.dataset.adminOrder)===${order.id}`);
 for(const [state,label] of [['confirmed','Confirmed'],['processing','Processing'],['shipping','Shipping'],['delivered','Delivered']]){
  await evaluate("Array.from(document.querySelectorAll('.admin-detail button')).find(b=>b.textContent.startsWith('ADVANCE STATUS')).click()");await waitFor(`document.querySelector('.admin-detail p')?.textContent.startsWith(${JSON.stringify(label)})`);
 }
 assert((await evaluate("document.querySelector('.admin-detail').textContent")).includes('Unpaid'));
 await nav('dashboard');await waitFor("!!document.querySelector('[data-metric=collected_cod_vnd]')");assert.equal(await evaluate("document.querySelector('[data-metric=collected_cod_vnd]').textContent"),new Intl.NumberFormat('en-US',{style:'currency',currency:'VND'}).format(0));
 await nav('orders');await waitFor("document.querySelectorAll('.admin-table-wrap tbody tr').length===1");await button('VIEW DETAILS');await waitFor("!!document.querySelector('[name=payment_reference]')");await field('[name=payment_reference]','GUI-RECEIPT-'+nonce);assert(await evaluate("Array.from(document.querySelectorAll('.admin-main button')).find(b=>b.textContent==='CONFIRM COD COLLECTED').disabled"));
 await evaluate("document.querySelector('[name=received]').click()");await button('CONFIRM COD COLLECTED');await waitFor("!document.querySelector('[name=payment_reference]') && document.querySelector('.admin-detail')?.textContent.includes('Paid')");await screenshot('admin-order-delivered-desktop');
 await nav('dashboard');await waitFor("document.querySelector('[data-metric=collected_cod_vnd]')?.textContent.includes('75,000')");
 const pendingOrder=JSON.parse(cli('tests/admin_fixture.php',{action:'order',email:emails[1],product_id:pid}));await nav('orders');await waitFor("document.querySelectorAll('.admin-table-wrap tbody tr').length===2");await button('VIEW DETAILS');await waitFor(`Number(document.querySelector('[data-admin-order]')?.dataset.adminOrder)===${pendingOrder.id}`);await button('CANCEL ORDER');await waitFor("document.querySelector('.admin-detail p')?.textContent.startsWith('Cancelled')");
 await nav('customers');await field('[name=customer_search]',nonce);await waitFor("document.querySelectorAll('.admin-table-wrap tbody tr').length===1");assert((await evaluate("document.querySelector('.admin-table-wrap tbody').textContent")).includes(emails[1]));assert(!(await evaluate("document.querySelector('.admin-main').textContent")).includes('password_hash'));
 report.checks.push('order search/filter/detail; valid workflow; delivered remains unpaid; explicit receipt/checkbox payment; dashboard actual confirmed COD; pending cancel; customer search read-only');
 await adminLanguage('VI');assert.equal(await evaluate("document.querySelector('.admin-topbar h1').textContent"),'KHÁCH HÀNG');await screenshot('admin-customers-vi-desktop');
 for(const width of [900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await screenshot('admin-customers-'+width);}
 await evaluate("window.location.hash='#admin/dashboard'");await waitFor("!!document.querySelector('[data-metric=active_products]')");await screenshot('admin-dashboard-mobile-vi');
 await adminLanguage('EN');await evaluate("document.querySelector('.admin-menu-button').click()");assert(await evaluate("document.querySelector('.admin-sidebar').classList.contains('open')"));
 await button('PRODUCTS','.admin-sidebar');await waitFor("!!document.querySelector('[name=product_search]')");await screenshot('admin-products-mobile-en');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
 cli('tests/auth_fixture.php',{email:emails[0],action:'demote'});await button('RELOAD');await waitFor("!!document.querySelector('.admin-auth [role=alert]')");assert.equal(await evaluate("!!document.querySelector('.admin-main')"),false);
 report.checks.push('VI/EN preserves admin route; desktop/tablet/mobile local table scroll; sidebar mobile; revoked admin loses UI/data access');assert.equal(exceptions.length,0,JSON.stringify(exceptions));assert.equal(consoleErrors.length,0,JSON.stringify(consoleErrors));report.exceptions=exceptions;report.consoleErrors=consoleErrors;report.result='PASS';await writeFile(path.join(artifacts,'admin-browser.json'),JSON.stringify(report,null,2));console.log('PASS actual Admin GUI on isolated XAMPP/MariaDB: roles, dashboard, products/upload, inventory, orders/COD, customers, VI/EN, 1440/900/390');
}finally{cli('tests/admin_fixture.php',{action:'cleanup',emails,skus:[sku]});if(socket)socket.close();browser.kill();}
