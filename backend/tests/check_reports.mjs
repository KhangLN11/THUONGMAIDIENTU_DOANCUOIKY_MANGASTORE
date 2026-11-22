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
function cli(script,input){const r=spawnSync('C:/xampp/php/php.exe',['backend/'+script],{input:JSON.stringify(input),encoding:'utf8',env:{...process.env,DB_NAME:'manga_store_reports_test_20261122'},windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout;}
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

 const seed = action => { const r=spawnSync('C:/xampp/php/php.exe',['backend/scripts/seed_reports_demo.php',action],{encoding:'utf8',env:{...process.env,DB_NAME:'manga_store_reports_test_20261122'},windowsHide:true});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout); };
 seed('--apply');
 await login(0);await evaluate("window.location.hash='#admin/reports'");await waitFor("!!document.querySelector('[data-report-empty]')");
 assert.equal(await evaluate("document.querySelector('[data-report-metric=total_orders]').textContent"),'0');assert((await evaluate("document.querySelector('[data-report-simulation]').textContent")).includes('SIMULATED DATA'));assert.equal(await evaluate("document.querySelector('.admin-topbar h1').textContent"),'REPORTS & ANALYTICS');
 await field('[name=report_preset]','custom');await field('[name=report_start]','2026-01-01');await field('[name=report_end]','2026-01-31');
 await evaluate("document.querySelector('.report-filters').requestSubmit()");await waitFor("document.querySelector('[data-report-metric=total_orders]')?.textContent==='10'");
 assert((await evaluate("document.querySelector('[data-report-metric=collected_cod_vnd]').textContent")).includes('560,000'));
 assert((await evaluate("document.querySelector('[data-report-metric=created_order_value_vnd]').textContent")).includes('3,000,000'));
 assert.equal(await evaluate("document.querySelector('[data-report-metric=sold_quantity]').textContent"),'8');
 assert.equal(await evaluate("document.querySelectorAll('.report-chart svg rect').length"),62);
 await screenshot('reports-desktop-en');await evaluate("document.querySelector('.report-chart').scrollIntoView({block:'center'})");await screenshot('reports-trend-desktop');
 await evaluate("document.querySelector('.admin-reports details').open=true");assert.equal(await evaluate("document.querySelector('.admin-reports details tbody').children.length"),31);
 for(const group of ['month','year','day']){await field('[name=report_group]',group);await evaluate("document.querySelector('.report-filters').requestSubmit()");await waitFor(`document.querySelectorAll('.report-chart svg rect').length===${group==='day'?62:2}`);}
 await field('[name=report_start]','2025-01-01');await evaluate("document.querySelector('.report-filters').requestSubmit()");await waitFor("document.querySelector('.admin-reports [role=alert]')?.textContent.includes('366')");
 await field('[name=report_start]','2026-01-01');await evaluate("document.querySelector('.report-filters').requestSubmit()");await waitFor("document.querySelector('[data-report-metric=total_orders]')?.textContent==='10'");
 const dir=path.join(artifacts,'reports-downloads');await mkdir(dir,{recursive:true});await cdp('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:dir});
 for(const type of ['revenue','orders','products','inventory']){
  await field('[name=report_export_type]',type);await button('DOWNLOAD CSV');await waitFor("document.querySelector('.admin-reports [role=status]')?.textContent.includes('CSV file')");
  let content;for(let n=0;n<50;n++){try{content=await readFile(path.join(dir,`manga-${type}-custom.csv`));if(content.length>3)break;}catch{}await pause(100);}assert(content?.subarray(0,3).equals(Buffer.from([239,187,191])));
  if(type==='products'){assert(content.toString('utf8').includes("'=HYPERLINK"));}
 }
 await adminLanguage('VI');assert.equal(await evaluate("document.querySelector('.admin-topbar h1').textContent"),'BÁO CÁO & THỐNG KÊ');assert.equal(await evaluate("document.querySelector('[name=report_preset]').value"),'custom');assert.equal(await evaluate("document.querySelector('[name=report_start]').value"),'2026-01-01');assert((await evaluate("document.querySelector('[data-report-metric=collected_cod_vnd]').textContent")).includes('560.000'));
 await evaluate('window.scrollTo(0,0)');await screenshot('reports-desktop-vi');
 for(const width of [900,390]){await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});await evaluate('window.scrollTo(0,0)');assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await screenshot('reports-'+width+'-vi');await evaluate("document.querySelector('.report-chart').scrollIntoView({block:'center'})");assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));await screenshot('reports-chart-'+width);}
 await adminLanguage('EN');
 // Simulate server error, then retry the same report without changing the applied filter.
 await cdp('Fetch.enable',{patterns:[{urlPattern:'*reports/overview.php*',requestStage:'Request'}]});
 socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.method==='Fetch.requestPaused'){void cdp('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({success:false,error:{code:'INTERNAL_ERROR'}})).toString('base64')}).catch(()=>{});}});
 await evaluate("document.querySelector('.report-filters').requestSubmit()");await waitFor("!!document.querySelector('.admin-reports [role=alert]')");await cdp('Fetch.disable');await button('TRY AGAIN');await waitFor("document.querySelector('[data-report-metric=total_orders]')?.textContent==='10'");
 await cdp('Fetch.enable',{patterns:[{urlPattern:'*reports/export.php*',requestStage:'Request'}]});await button('DOWNLOAD CSV');await waitFor("!!document.querySelector('.admin-reports [role=alert]')");await cdp('Fetch.disable');await button('TRY AGAIN');await waitFor("document.querySelector('.admin-reports [role=status]')?.textContent.includes('CSV file')");
 // Simulated 503 deliberately generates a browser console resource error; all other errors must be absent.
 const unexpected=consoleErrors.filter(args=>!JSON.stringify(args).includes('503'));
 assert.equal(exceptions.length,0,JSON.stringify(exceptions));assert.equal(unexpected.length,0,JSON.stringify(unexpected));
 report.checks=['Admin Reports entry and empty state; exact simulated KPI and charts; custom/day/month/year filters and invalid range error; CSV downloaded through UI in all four types; VI/EN preserves filter and VND; 1440/900/390 without viewport overflow; simulated HTTP 503 and retry'];report.result='PASS';report.exceptions=exceptions;report.unexpectedConsoleErrors=unexpected;report.expectedConsoleError='Intentionally simulated HTTP 503 for overview and CSV';await writeFile(path.join(artifacts,'reports-browser.json'),JSON.stringify(report,null,2));console.log('PASS Reports GUI, real XAMPP clone, screenshots and CSV downloads, VI/EN and responsive');
} finally {
 const clean=spawnSync('C:/xampp/php/php.exe',['backend/scripts/seed_reports_demo.php','--cleanup'],{encoding:'utf8',env:{...process.env,DB_NAME:'manga_store_reports_test_20261122'},windowsHide:true});
 for(const email of emails)cli('tests/auth_fixture.php',{action:'delete',email});if(socket)socket.close();browser.kill();assert.equal(clean.status,0,clean.stderr);
}
