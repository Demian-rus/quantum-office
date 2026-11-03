const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1366,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../Quantum-Office.html')).href);
  await page.evaluate(()=>{
   route('writer');
   const e=document.getElementById('qo-writer-page');e.innerHTML='<p>F=</p>';
   const t=e.querySelector('p').firstChild,r=document.createRange();
   r.setStart(t,2);r.collapse(true);
   const s=window.getSelection();s.removeAllRanges();s.addRange(r);qoWriterRememberSelection();
  });
  await page.locator('[data-editor="writer"][data-tab="insert"]').click();
  await page.locator('[data-action="writer-symbols"]').click();
  assert.equal(await page.locator('#qo-writer-symbols-dialog [role="tab"]').count(),5);
  await page.locator('#qo-writer-symbols-dialog button[aria-label="Вставить α"]').click();
  assert.match(await page.locator('#qo-writer-page').innerText(),/F=α/);
  await page.locator('[data-action="writer-symbols"]').click();
  await page.locator('#qo-writer-symbols-dialog [data-symbol-category="Математика"]').click();
  assert.equal(await page.locator('#qo-writer-symbols-dialog button[aria-label="Вставить √"]').count(),1);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#qo-writer-symbols-dialog').count(),0);
  const connected=await page.evaluate(()=>{
   const b=newWorkbook(),s=b.sheets[0];s.name='Ученики';
   setCell(s,'A1','Ученики');setCell(s,'A2','Пробный ученик');
   workspace.books.unshift(b);workspace.active=b.id;
   page='sheet';activeCell='A2';render();
   const ok=qoHubAttachCurrent();
   return {ok,source:qoHubSource(),enabled:document.querySelectorAll('[data-hub-action="connect"]:not(:disabled)').length};
  });
  assert.equal(connected.ok,true);
  assert.ok(connected.source?.bookId);
  assert.equal(connected.enabled,0,'direct linking refreshes the panel immediately');
  for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:844});
   for(const kind of ['sheet','writer','slides','photo']){
    await page.evaluate(kind=>route(kind),kind);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),kind+' width '+width);
   }
  }
  assert.deepEqual(errors,[]);
  console.log('PASS TASK137: symbols, panel Escape, student link refresh and responsive UI');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exit(1);});
