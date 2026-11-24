/* TASK167.1: real independent surfaces, compatibility and navigation. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task1671');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({acceptDownloads:true,offline:true,viewport:{width:1440,height:900}});
 const p=await context.newPage(),errors=[],measurements=[];
 p.on('pageerror',e=>errors.push(String(e)));p.on('dialog',d=>d.accept());
 const url=pathToFileURL(path.join(root,'Quantum-Office.html')).href;
 const route=async target=>{await p.locator('.global-bar .modules [data-target="'+target+'"]').click();assert.equal(await p.evaluate(()=>page),target);};
 const ready=()=>p.locator('#qo-bank-root .qw-bank-filter-panel').waitFor();
 const snapshot=()=>p.evaluate(()=>JSON.stringify(qwDoc));
 try{
  await p.goto(url);
  assert.equal(await p.locator('.launcher-editor .launcher-tile').count(),4);
  assert.equal(await p.locator('.qo-education-launcher .launcher-tile').count(),3);
  await p.screenshot({path:path.join(out,'home.png'),fullPage:true});
  await route('diagnostics');
  await p.evaluate(()=>{const d=qdWorkingDoc();d.title='TASK167.1 saved diagnosis';d.sections=qdDefault().sections;d.sections[0].questions[0].prompt='Diagnostic transfer';qdStore();qdRefresh();});
  const diagnosis=await p.evaluate(()=>JSON.stringify(qdWorkingDoc()));
  await route('writer');assert.equal(await p.locator('#qo-diag-root,#qo-work-root,#qo-bank-root').count(),0);
  assert.equal(await p.locator('[data-editor="writer"][data-tab="diagnostic"],[data-editor="writer"][data-tab="work"]').count(),0);
  await p.locator('[data-editor="writer"][data-tab="file"]').click();
  await p.locator('[data-action="writer-new"]').click();
  assert.equal(await p.evaluate(()=>JSON.stringify(qdWorkingDoc())),diagnosis,'new Writer must not discard diagnostics');
  await p.locator('#qo-writer-page').fill('Independent Writer');
  await route('work');assert.equal(await p.locator('#qo-writer-page,#qo-diag-root').count(),0);
  await p.locator('[data-qw-action="from-diag"]').click();
  assert.ok(await p.evaluate(()=>qwDoc.tasks.some(t=>t.prompt.includes('Diagnostic transfer'))));
  await p.evaluate(async()=>{await qwBankOpen();const task=qwTask('short');task.prompt='TASK167.1 bank item';task.answer='42';await qwBankRepository.createTask({id:'task1671-bank',subject:'physics',task});});
  await route('bank');await ready();
  assert.equal(await p.locator('#qo-bank-root #qw-dialog').count(),1);
  assert.equal(await p.locator('#qo-bank-root #qw-dialog').evaluate(d=>d.matches(':modal')),false);
  await p.locator('[data-bank-view="task1671-bank"]').click();
  await p.locator('[data-bank-add="task1671-bank"]').waitFor();
  const before=await snapshot();
  await p.evaluate(()=>{
   const repo=qwBankRepository,original=repo.getTask;let release;
   const barrier=new Promise(r=>release=r);window.__eduGate={original,release,calls:0,dialog:document.querySelector('#qw-dialog')};
   repo.getTask=async function(id){if(id==='task1671-bank'){window.__eduGate.calls++;await barrier;}return original.call(this,id);};
  });
  await p.locator('[data-bank-add="task1671-bank"]').click();
  await p.waitForFunction(()=>__eduGate.calls>0&&__eduGate.dialog.getAttribute('aria-busy')==='true');
  await route('writer');await route('work');await route('bank');
  await p.evaluate(()=>__eduGate.release());
  await p.waitForFunction(()=>!__eduGate.dialog.hasAttribute('aria-busy'));
  await p.evaluate(()=>{qwBankRepository.getTask=__eduGate.original;});
  assert.equal(await snapshot(),before,'late bank response cannot mutate work after route changes');
  await ready();await p.locator('[data-bank-view="task1671-bank"]').click();await p.locator('[data-bank-add="task1671-bank"]').click();
  await p.waitForFunction(()=>page==='work'&&qwDoc.tasks.some(t=>t.prompt==='TASK167.1 bank item'));
  const saved=await snapshot(),event=p.waitForEvent('download');await p.locator('.global-bar [data-action="save"]').click();
  const dl=await event;assert.match(dl.suggestedFilename(),/\.qwork$/);
  const qwork=path.join(out,'roundtrip.qwork');await dl.saveAs(qwork);
  await p.locator('#qw-file').setInputFiles(qwork);await p.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Работа открыта'));
  assert.equal(await snapshot(),saved);
  const pdf=await p.evaluate(async()=>String.fromCharCode(...(await qwPDFBytes({...qwDoc,layout:'worksheet'},false)).slice(0,5)));
  assert.equal(pdf,'%PDF-');
  await p.reload();await route('work');assert.equal(await snapshot(),saved);
  await route('writer');assert.match(await p.locator('#qo-writer-page').innerText(),/Independent Writer/);
  await route('diagnostics');assert.equal(await p.evaluate(()=>JSON.stringify(qdWorkingDoc())),diagnosis);
  await route('bank');await ready();await p.locator('[data-bank-view="task1671-bank"]').waitFor();
  for(const [width,height] of [[1920,1080],[1440,900],[1024,768]])for(const theme of ['light','dark']){
   await p.setViewportSize({width,height});await p.evaluate(t=>{qoThemePreference=t;qoApplyAppearance();},theme);
   for(const target of ['home','writer','diagnostics','work','bank']){
    await route(target);if(target==='bank')await ready();
    const geometry=await p.evaluate(()=>{const h=document.querySelector('.global-bar').getBoundingClientRect(),main=document.querySelector('#app>main').getBoundingClientRect();return{header:[h.x,h.y,h.width,h.height],main:[main.x,main.y,main.width,main.height],overflow:document.documentElement.scrollWidth>innerWidth};});
    assert.ok(!geometry.overflow,'document overflows '+target+' '+width);assert.ok(geometry.main[2]>0&&geometry.main[3]>0,'empty workspace '+target);
    measurements.push({target,width,height,theme,geometry});
    if(width===1440)await p.screenshot({path:path.join(out,target+'-'+theme+'.png')});
   }
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',measurements},null,2));
  console.log('PASS TASK167.1: independent routes, new Writer isolation, diagnosis transfer, stale async bank guard, QWORK/PDF/reload, 30 theme/viewport routes');
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
