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


 const seriesPrefix='12a-test-'+nonce;
 await login(0);await nav('products');await waitFor("!!document.querySelector('[data-admin-products] table')");
 const reset=()=>button('RESET FILTERS');
 const waitRows=()=>waitFor("!document.querySelector('[data-admin-products]>p[role=status]:first-child')&&document.querySelectorAll('[data-admin-product-row]').length>0");
 const dialogSubmit=()=>evaluate("document.querySelector('.admin-series-dialog form').requestSubmit()");
 const seriesOpen=async()=>{await evaluate("[...document.querySelectorAll('[data-admin-product-form] button')].find(b=>b.textContent.trim()==='+ NEW SERIES').focus()");await button('+ NEW SERIES');await waitFor("!!document.querySelector('dialog[open]')");};
 for(const width of [1440,900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await screenshot('12a-after-products-'+width);}
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await button('+ ADD PRODUCT');await waitFor("!!document.querySelector('[data-admin-product-form] form')");
 const fields={sku,slug:seriesPrefix+'-manga',name_vi:'Truyện GUI - Tập 1',name_en:'GUI Manga - Volume 1',description_vi:'Mô tả GUI',description_en:'GUI description',price_vnd:'50000',sale_price_vnd:'45000',stock_quantity:'3'};
 for(const [key,value] of Object.entries(fields))await field('[data-admin-product-form] [name='+key+']',value);
 await waitFor("document.querySelector('[name=category_id]').options.length>1");const category=await evaluate("fetch('/api/admin/metadata.php').then(r=>r.json()).then(v=>String(v.data.categories.find(c=>c.slug==='manga').id))");await field('[name=category_id]',category);await field('[name=product_status]','active');
 const manifest=JSON.parse(await readFile(path.resolve(root,'../database/catalog/demo-products/manifest.json'),'utf8'));const image=path.resolve(root,'../database/catalog/demo-products',manifest.products[0].images[0].local_path);
 const doc=await cdp('DOM.getDocument');const node=await cdp('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'[name=creation_image]'});await cdp('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[image]});
 const kept=await evaluate("({fields:[...document.querySelectorAll('#admin-product-editor input,#admin-product-editor textarea,#admin-product-editor select')].map(i=>[i.name,i.value]),file:document.querySelector('[name=creation_image]').files[0].name})");
 await seriesOpen();assert.equal(await evaluate('document.activeElement.name'),'series_title');for(let tab=0;tab<12;tab++){await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});assert(await evaluate("!!document.activeElement.closest('dialog')"),'Native dialog traps keyboard focus');}await dialogSubmit();await waitFor("!!document.querySelector('dialog [role=alert]')");
 for(const width of [1440,900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await screenshot('12a-series-validation-'+width);assert(await evaluate("(()=>{const r=document.querySelector('dialog').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()"));}
 await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await waitFor("!document.querySelector('dialog')");assert((await evaluate('document.activeElement.textContent')).includes('NEW SERIES'));
 await seriesOpen();await field('[name=series_title]','One Piece');await field('[name=series_slug]','one-piece');await dialogSubmit();await waitFor("!!document.querySelector('.admin-product-existing')");assert.equal(await evaluate("document.querySelector('[name=series_title]').value"),'One Piece');const existingId=await evaluate("fetch('/api/admin/metadata.php').then(r=>r.json()).then(v=>String(v.data.series.find(s=>s.title==='One Piece').id))");await field('.admin-product-existing select',existingId);await button('USE THIS SERIES','.admin-series-dialog');await waitFor("!document.querySelector('dialog')");assert.equal(await evaluate("document.querySelector('[name=series_id]').value"),existingId);await seriesOpen();
 await field('[name=series_title]','GUI Series '+nonce);await field('[name=series_slug]',seriesPrefix);await field('[name=series_original_title]','Original GUI');
 for(const width of [1440,900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await screenshot('12a-after-series-dialog-'+width);}

 let paused=null;const pauseSeries=event=>{const m=JSON.parse(event.data);if(m.method==='Fetch.requestPaused')paused=m.params.requestId;};socket.addEventListener('message',pauseSeries);await cdp('Fetch.enable',{patterns:[{urlPattern:'*admin/series-create.php',requestStage:'Request'}]});
 await evaluate("document.querySelector('.admin-series-dialog form').requestSubmit();document.querySelector('.admin-series-dialog form')?.requestSubmit()");for(let n=0;n<50&&!paused;n++)await pause(50);assert(paused);assert(await evaluate("document.querySelector('.admin-series-dialog form').getAttribute('aria-busy')==='true'"));await screenshot('12a-series-saving-390');await cdp('Fetch.continueRequest',{requestId:paused});await cdp('Fetch.disable');socket.removeEventListener('message',pauseSeries);await waitFor("!document.querySelector('dialog')");

 const chosen=await evaluate("document.querySelector('[name=series_id]').value");assert(Number(chosen)>18);
 const preserved=await evaluate("({fields:[...document.querySelectorAll('#admin-product-editor input,#admin-product-editor textarea,#admin-product-editor select')].map(i=>[i.name,i.value]),file:document.querySelector('[name=creation_image]').files[0].name})");assert.equal(preserved.file,kept.file);assert.deepEqual(preserved.fields.filter(([key])=>key!=='series_id'),kept.fields.filter(([key])=>key!=='series_id'));
 assert.equal(JSON.parse(cli('tests/series_fixture.php',{prefix:seriesPrefix})).length,1,'Double-submit produces one series');
 for(const width of [1440,900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await evaluate('window.scrollTo({top:0,behavior:"instant"})');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await screenshot('12a-after-create-'+width);}
 await evaluate("document.querySelector('#admin-product-editor').requestSubmit()");await waitFor("!!document.querySelector('[data-admin-image-manager] img')&&[...document.querySelectorAll('[data-admin-product-form] [role=status]')].some(p=>p.textContent==='Saved successfully.')");
 const pid=JSON.parse(cli('tests/admin_fixture.php',{action:'find-product',sku})).id;assert(pid>31);let saved=await evaluate(`fetch('/api/admin/product.php?id=${pid}').then(r=>r.json()).then(v=>v.data)`);assert.equal(saved.status,'active');assert.equal(saved.series_id,Number(chosen));assert.equal(saved.images.length,1);assert(saved.images[0].is_primary);assert(await evaluate("document.querySelector('[name=stock_quantity]').readOnly"));
 await seriesOpen();await field('[name=series_title]','GUI Edit Series '+nonce);await field('[name=series_slug]',seriesPrefix+'-edit');await dialogSubmit();await waitFor("!document.querySelector('dialog')");await field('[name=name_en]','GUI Manga Updated - Volume 1');await evaluate("document.querySelector('#admin-product-editor').requestSubmit()");await waitFor("[...document.querySelectorAll('[data-admin-product-form] [role=status]')].some(p=>p.textContent==='Saved successfully.')");await pause(200);
 saved=await evaluate(`fetch('/api/admin/product.php?id=${pid}').then(r=>r.json()).then(v=>v.data)`);assert.equal(saved.price_vnd,50000);assert.equal(saved.stock_quantity,3);assert.equal(saved.images.length,1);assert.equal(saved.name_en,'GUI Manga Updated - Volume 1');
 for(const width of [1440,900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await evaluate('window.scrollTo({top:0,behavior:"instant"})');await screenshot('12a-after-edit-'+width);assert(await evaluate("document.querySelector('[name=category_id]').getBoundingClientRect().height<=60"),'Category field must keep a normal control height');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));}
 await evaluate("document.querySelector('[data-admin-product-form]>button').click()");await waitFor("!!document.querySelector('[name=product_search]')");await field('[name=product_search]',sku);await waitFor("document.querySelectorAll('[data-admin-product-row]').length===1");await field('[name=series_filter]',String(saved.series_id));await field('[name=product_status_filter]','active');await waitFor("document.querySelectorAll('[data-admin-product-row]').length===1");await button('EDIT');await waitFor("!!document.querySelector('[name=series_id]')");assert.equal(await evaluate("document.querySelector('[name=series_id]').value"),String(saved.series_id));await evaluate("document.querySelector('[data-admin-product-form]>button').click()");await waitFor("!!document.querySelector('[name=product_search]')");assert.equal(await evaluate("document.querySelector('[name=product_search]').value"),sku);
 await reset();await waitRows();await field('[name=product_search]','no-such-'+nonce);await waitFor("!!document.querySelector('.admin-product-empty')");await reset();await waitRows();await adminLanguage('VI');assert((await evaluate("document.querySelector('[data-admin-products]').textContent")).includes('QUẢN LÝ SẢN PHẨM'));await adminLanguage('EN');

 const figure=await evaluate(`import('/src/admin/adminService.ts').then(async m=>{const meta=await fetch('/api/admin/metadata.php').then(r=>r.json());const category=Number(meta.data.categories.find(c=>c.slug==='figures').id);const p=await m.createProduct({sku:${JSON.stringify(sku+'-FIG')},slug:${JSON.stringify(seriesPrefix+'-figure')},name_vi:'Figure kiểm thử',name_en:'GUI Test Figure',description_vi:'Kiểm thử',description_en:'Test',category_id:category,series_id:${chosen},price_vnd:500000,sale_price_vnd:null,stock_quantity:2,status:'active'});m.catalogChanged(p.id);return p;})`);
 await evaluate("location.hash='#collections'");await waitFor(`!!document.querySelector('[data-figure-group="${seriesPrefix}"] [data-discovery-product="${figure.id}"]')`);assert.equal(await evaluate(`!!document.querySelector('[data-figure-group] [data-discovery-product="${pid}"]')`),false);
 await evaluate(`location.hash='#series/${seriesPrefix}-edit'`);
await waitFor("!!document.querySelector('[data-series-detail]')");await waitFor("document.querySelectorAll('[data-volume-number]').length===1");assert.equal(await evaluate("document.querySelector('[data-volume-number]').dataset.volumeNumber"),'1');

 await evaluate("location.hash='#admin/products'");await waitFor("!!document.querySelector('[data-admin-products]')");await button('+ ADD PRODUCT');await waitFor("!!document.querySelector('[data-admin-product-form]')");await seriesOpen();await field('[name=series_title]','Unlinked '+nonce);await field('[name=series_slug]',seriesPrefix+'-orphan');await dialogSubmit();await waitFor("!document.querySelector('dialog')");await evaluate("document.querySelector('[data-admin-product-form]>button').click()");await waitFor("!!document.querySelector('[data-admin-products]')");assert.equal(JSON.parse(cli('tests/series_fixture.php',{prefix:seriesPrefix})).length,3,'Cancelling an unsaved product keeps the independently saved series');
 report.checks=['new series modal from create/edit; validation and duplicate retained; Escape/focus returns; viewport/dialog fit 1440/900/390; native double submit; parent fields/File preserved; real product+image upload; series FK; update retains price/stock/image; filters retain on return; empty/reset; VI/EN; new active manga appears in Series Explorer; new Figure grouped by actual series in Collections; loading state'];assert.equal(exceptions.length,0,JSON.stringify(exceptions));assert.equal(consoleErrors.length,0,JSON.stringify(consoleErrors));report.result='PASS';await writeFile(path.join(artifacts,'12a-products-browser.json'),JSON.stringify(report,null,2));console.log('PASS 12A actual Admin Products/create/edit/series/upload/filters/keyboard/VI-EN/responsive and new manga Explorer');
}finally{cli('tests/admin_fixture.php',{action:'cleanup',emails,skus:[sku,sku+'-FIG']});cli('tests/series_fixture.php',{action:'cleanup',prefix:'12a-test-'+nonce});if(socket)socket.close();browser.kill();}
