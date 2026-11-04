const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'..'),browser=await chromium.launch({
   headless:true,args:['--no-sandbox','--disable-dev-shm-usage']
 });
 const page=await browser.newPage({viewport:{width:1600,height:940},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
 await page.evaluate(()=>route('writer'));
 await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
 await page.locator('#qd-template-pick').selectOption('physics8');
 await page.locator('[data-qd-action="use-template"]').click();
 assert.equal(await page.locator('.qd-builder-actionbar').count(),1);
 await page.locator('[data-qd-action="bank-open"]').click();
 assert.equal(await page.locator('.qd-bank-item').count(),20);
 await page.locator('#qd-bank-subject').selectOption('informatics');
 await page.locator('#qd-bank-grade').selectOption('8');
 await page.locator('#qd-bank-search').fill('двоичной');
 assert.ok(await page.locator('.qd-bank-item').count()>=1);
 const oldCount=await page.evaluate(()=>qdQuestionList().length);
 await page.locator('[data-qd-action="bank-add"]').first().click();
 assert.equal(await page.evaluate(()=>qdQuestionList().length),oldCount+1);
 assert.ok(await page.locator('.qd-bank-item [data-qd-action="bank-add"]:disabled').count()>=1);
 await page.locator('.qd-edit-card').first().locator('[data-qd-action="bank-save-question"]').click();
 assert.equal(await page.evaluate(()=>qdBankRead().length),1);
 await page.locator('[data-qd-action="builder-quick-save"]').click();
 assert.equal(await page.evaluate(()=>qdLibraryRead().length),1);
 assert.match(await page.locator('#qd-builder-save-state').textContent(),/Все изменения сохранены/);
 const question=page.locator('.qd-edit-card').first().locator('[data-qd-field="prompt"]');
 await question.fill('Новая редакция вопроса по тепловым явлениям.');
 assert.match(await page.locator('#qd-builder-save-state').textContent(),/Черновик/);
 await page.locator('[data-qd-action="builder-quick-save"]').click();
 const versions=await page.evaluate(()=>{
   const id=qdLibraryRead()[0].id;
   return (qdTemplateVersionsRead()[id]||[]).length;
 });
 assert.equal(versions,1);
 const answer=await page.evaluate(()=>qdLibraryRead()[0].sections[0].questions[0].prompt);
 assert.equal(answer,'Новая редакция вопроса по тепловым явлениям.');
 await page.locator('.qd-builder-save>summary').click();
 await page.locator('#qd-builder-template-revision').selectOption({index:1});
 await page.locator('[data-qd-action="builder-template-restore"]').click();
 assert.notEqual(await page.evaluate(()=>qdLibraryRead()[0].sections[0].questions[0].prompt),answer);
 assert.equal(await page.evaluate(()=>qdQuestionList()[0].prompt),answer,'restore never overwrites current working draft');
 const dlPromise=page.waitForEvent('download');
 await page.locator('[data-qd-action="bank-open"]').click();
 await page.locator('.qd-bank-portable [data-qd-action="bank-export"]').click();
 const dl=await dlPromise;
 assert.match(dl.suggestedFilename(),/\.qbank$/);
 const output=path.join(root,'task120-smoke.qbank');await dl.saveAs(output);
 const payload=JSON.parse(fs.readFileSync(output,'utf8'));fs.rmSync(output,{force:true});
 assert.equal(payload.format,'quantum-question-bank');
 assert.equal(payload.questions.length,1);
 assert.ok(!JSON.stringify(payload).includes('"students"'));
 for(const width of [1600,1100,650,390]){
   await page.setViewportSize({width,height:900});
   const geom=await page.evaluate(()=>{
     const a=document.querySelector('#qo-diag-root').getBoundingClientRect();
     const b=document.querySelector('.qd-bank').getBoundingClientRect();
     return {viewport:document.documentElement.clientWidth,documentWidth:document.documentElement.scrollWidth,
       bankRight:b.right,rootRight:a.right};
   });
   assert.ok(geom.documentWidth<=geom.viewport+4,'page overflow at '+width);
   assert.ok(geom.bankRight<=geom.rootRight+1,'bank exceeds workbench at '+width);
 }
 await page.reload();
 await page.evaluate(()=>route('writer'));
 await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
 assert.equal(await page.evaluate(()=>qdBankRead().length),1);
 assert.equal(await page.evaluate(()=>qdLibraryRead().length),1);
 assert.deepEqual(errors,[]);
 console.log('PASS TASK120: search, insert, save into bank, quick save, dirty state, version restore, export, mobile');
 await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1);});
