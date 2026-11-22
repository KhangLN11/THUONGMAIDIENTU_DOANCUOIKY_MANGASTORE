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
const nonce=randomBytes(6).toString('hex'),emails=['auth-test-'+nonce+'-admin@example.test','auth-test-'+nonce+'@example.test'],password=randomBytes(24).toString('base64url'),sku='IMGTEST-'+nonce;
function cli(script,input){const r=spawnSync('C:/xampp/php/php.exe',['backend/'+script],{input:JSON.stringify(input),encoding:'utf8',env:{...process.env,DB_NAME:'manga_store_images_test_20261122'},windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout;}
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

 await login(0);await evaluate("window.location.hash='#admin/products'");await waitFor("!!document.querySelector('[name=product_search]')");await button('+ ADD PRODUCT');
 const fill=async(suffix='')=>{for(const [name,value] of Object.entries({sku:sku+suffix,slug:'image-gui-'+nonce+suffix.toLowerCase(),name_vi:'Sản phẩm thử ảnh'+suffix,name_en:'Image GUI Product'+suffix,price_vnd:'50000',sale_price_vnd:'45000',stock_quantity:'3'}))await field(`[data-admin-product-form] [name=${name}]`,value);await waitFor("document.querySelector('[name=category_id]')?.options.length>1");await field('[name=category_id]',await evaluate("document.querySelector('[name=category_id]').options[1].value"));await field('[name=product_status]','active');};
 const manifest=JSON.parse(await readFile(path.resolve(root,'../database/catalog/demo-products/manifest.json'),'utf8'));const files=manifest.products.filter(p=>p.images[0].local_path.endsWith('.jpg')).slice(0,2).map(p=>path.resolve(root,'../database/catalog/demo-products',p.images[0].local_path));
 await cdp('DOM.enable');const choose=async(selector,file)=>{const doc=await cdp('DOM.getDocument');const input=await cdp('DOM.querySelector',{nodeId:doc.root.nodeId,selector});await cdp('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[file]});};
 const save=()=>evaluate("document.querySelector('[data-admin-product-form] form').requestSubmit()");
 await fill();await choose('[name=creation_image]',files[0]);await waitFor("document.querySelector('.admin-image-preview img')?.naturalWidth>0");await screenshot('images-create-preview');await button('CANCEL SELECTION');await waitFor("!document.querySelector('.admin-image-preview')");await choose('[name=creation_image]',files[0]);await save();await waitFor("document.querySelectorAll('[data-managed-image]').length===1 && !document.querySelector('[data-creation-partial]') && document.querySelector('[data-admin-product-form] [role=status]')?.textContent==='Saved successfully.'");
 const pid=JSON.parse(cli('tests/images_fixture.php',{action:'find',sku})).id;assert(pid>31);let first=await evaluate("Number(document.querySelector('[data-managed-image]').dataset.managedImage)");
 assert.equal(await evaluate("document.querySelector('[data-managed-image]').dataset.primary"),'true');
 await choose('[name=image]',files[1]);await waitFor("document.querySelector('.admin-image-preview img')?.naturalWidth>0");await button('UPLOAD IMAGE');await waitFor("document.querySelectorAll('[data-managed-image]').length===2 && !document.querySelector('.admin-image-preview')");
 let second=await evaluate("Number(document.querySelectorAll('[data-managed-image]')[1].dataset.managedImage)");await button('SET AS PRIMARY');await waitFor(`document.querySelector('[data-managed-image="${second}"]').dataset.primary==='true'`);
 const publicProduct=()=>evaluate(`fetch('/api/product.php?id=${pid}').then(r=>r.json()).then(r=>r.data)`);let pub=await publicProduct();const prior=pub.image_url;assert.equal(pub.images.find(i=>i.id===second).is_primary,true);
 await evaluate(`Array.from(document.querySelector('[data-managed-image="${second}"]').querySelectorAll('button')).find(b=>b.textContent==='REPLACE IMAGE').click()`);await choose('[name=replacement_image]',files[0]);await waitFor("document.querySelector('.admin-image-preview img')?.naturalWidth>0");await button('CONFIRM REPLACEMENT');await waitFor(`document.querySelector('[data-managed-image="${second}"] img')?.getAttribute('src')!==${JSON.stringify(prior)} && !document.querySelector('.admin-image-preview')`);
 pub=await publicProduct();assert.equal(pub.images.find(i=>i.id===second).is_primary,true);const replacement=pub.image_url;assert.notEqual(replacement,prior);
 await screenshot('images-manager-desktop');
 // A failing replacement keeps the original thumbnail and file link.
 await cdp('Fetch.enable',{patterns:[{urlPattern:'*admin/image-replace.php',requestStage:'Request'}]});
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Fetch.requestPaused')void cdp('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({success:false,error:{code:'INTERNAL_ERROR'}})).toString('base64')}).catch(()=>{});});
 await evaluate(`Array.from(document.querySelector('[data-managed-image="${second}"]').querySelectorAll('button')).find(b=>b.textContent==='REPLACE IMAGE').click()`);await choose('[name=replacement_image]',files[1]);await button('CONFIRM REPLACEMENT');await waitFor("!!document.querySelector('[data-admin-image-manager] [role=alert]')");assert.equal((await publicProduct()).image_url,replacement);await cdp('Fetch.disable');await button('CANCEL SELECTION');
 // Remove the primary, elect the remaining image, block removal of the final active image.
 await evaluate(`Array.from(document.querySelector('[data-managed-image="${second}"]').querySelectorAll('button')).find(b=>b.textContent==='DELETE IMAGE').click()`);await waitFor("document.querySelectorAll('[data-managed-image]').length===1");assert.equal(await evaluate("document.querySelector('[data-managed-image]').dataset.primary"),'true');await button('DELETE IMAGE');await waitFor("document.querySelector('[data-admin-image-manager] [role=alert]')?.textContent.includes('last image')");assert.equal((await publicProduct()).images.length,1);
 // Changing image updates the already mounted storefront catalog without a full reload.
 await evaluate("window.location.hash='#account'");await waitFor("!!document.querySelector('.site-header')");await navigate('shop');await waitFor("Array.from(document.querySelectorAll('.shop-grid .product-card')).some(n=>n.textContent.includes('Image GUI Product'))");
 const expected=(await publicProduct()).image_url;assert.equal(await evaluate("Array.from(document.querySelectorAll('.shop-grid .product-card')).find(n=>n.textContent.includes('Image GUI Product')).querySelector('img').getAttribute('src')"),expected);
 await evaluate("Array.from(document.querySelectorAll('.shop-grid .product-card')).find(n=>n.textContent.includes('Image GUI Product')).querySelector('.product-img').click()");await waitFor(`document.querySelector('[data-product-id]')?.dataset.productId==='${pid}'`);await waitFor("document.querySelector('.main-image img')?.naturalWidth>0");assert.equal(await evaluate("document.querySelector('.main-image img').getAttribute('src')"),expected);assert.equal(await evaluate("document.querySelectorAll('.thumbs button').length"),1);
 assert.equal(await evaluate("!!document.querySelector('[data-manga-loader]')"),false);
 // Preserve the form after duplicate validation; creation + upload failure leaves one draft ID and can continue.
 await evaluate("window.location.hash='#admin/products'");await waitFor("!!document.querySelector('[name=product_search]')");await button('+ ADD PRODUCT');await fill('-PARTIAL');await field('[name=slug]','image-gui-'+nonce);await save();await waitFor("document.querySelector('[data-admin-product-form] [role=alert]')?.textContent.includes('SKU or slug')");assert.equal(await evaluate("document.querySelector('[name=name_en]').value"),'Image GUI Product-PARTIAL');
 await field('[name=slug]','image-gui-'+nonce+'-partial');await choose('[name=creation_image]',files[1]);await cdp('Fetch.enable',{patterns:[{urlPattern:'*admin/image-upload.php',requestStage:'Request'}]});await save();await waitFor("!!document.querySelector('[data-creation-partial]') && !!document.querySelector('[data-admin-product-form] [role=alert]')");const partialId=JSON.parse(cli('tests/images_fixture.php',{action:'find',sku:sku+'-PARTIAL'})).id;assert(partialId>0);let draft=await evaluate(`fetch('/api/admin/product.php?id=${partialId}').then(r=>r.json()).then(r=>r.data)`);assert.equal(draft.status,'draft');assert.equal(draft.images.length,0);assert.equal(await evaluate("!!document.querySelector('[data-admin-product-form] > [role=status]')"),false);
 await cdp('Fetch.disable');await save();await waitFor("document.querySelectorAll('[data-managed-image]').length===1 && !document.querySelector('[data-creation-partial]')");assert.equal(JSON.parse(cli('tests/images_fixture.php',{action:'find',sku:sku+'-PARTIAL'})).id,partialId);assert((await evaluate(`fetch('/api/product.php?id=${partialId}').then(r=>r.json()).then(r=>r.success)`)));
 await adminLanguage('VI');assert((await evaluate("document.querySelector('[data-admin-image-manager]').textContent")).includes('THAY ẢNH'));await screenshot('images-manager-vi');
 for(const width of [900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await evaluate("document.querySelector('[data-admin-image-manager]').scrollIntoView({block:'center'})");await screenshot('images-manager-'+width);}
 // Refresh confirms persistence in the database, not only React state.
 await cdp('Page.reload');await waitFor("!!document.querySelector('[name=product_search]')");await field('[name=product_search]',sku+'-PARTIAL');await waitFor("document.querySelectorAll('.admin-table-wrap tbody tr').length===1");
 const unexpected=consoleErrors.filter(args=>!JSON.stringify(args).includes('503'));assert.equal(exceptions.length,0,JSON.stringify(exceptions));assert.equal(unexpected.length,0,JSON.stringify(unexpected));
 report.result='PASS';report.checks=['create with image and preview; duplicate validation retains form; partial upload keeps one draft and retries same ID; append/replace/delete/set primary; failed replacement preserves image; active last image blocked; Shop/Detail update without reload; database persistence; VI/EN and 1440/900/390'];report.exceptions=exceptions;report.unexpectedConsoleErrors=unexpected;await writeFile(path.join(artifacts,'images-browser.json'),JSON.stringify(report,null,2));console.log('PASS Admin images actual GUI, partial workflow, Shop/Detail synchronization, responsive and persistence');
}finally{cli('tests/images_fixture.php',{action:'cleanup',skus:[sku,sku+'-PARTIAL']});for(const email of emails)cli('tests/auth_fixture.php',{action:'delete',email});if(socket)socket.close();browser.kill();}
