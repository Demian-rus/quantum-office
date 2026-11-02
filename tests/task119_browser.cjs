const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const file=pathToFileURL(path.resolve(__dirname,'../Quantum-Office.html')).href;
 const page=await browser.newPage({viewport:{width:1600,height:950},acceptDownloads:true});
 const errors=[];page.on('pageerror',err=>errors.push(err.message));page.on('dialog',dialog=>dialog.accept());
 await page.goto(file);
 await page.evaluate(()=>route('writer'));
 await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
 await page.locator('#qd-template-pick').selectOption('physics8');
 await page.locator('[data-qd-action="use-template"]').click();
 const count=await page.evaluate(()=>qdQuestionList().length);
 assert.ok(count>=20);
 await page.locator('[data-qd-action="compact-mode"]').click();
 assert.equal(await page.locator('.qd-edit-card.is-compact').count(),count);
 const bounds=async()=>page.evaluate(()=>{
   const cards=[...document.querySelectorAll('.qd-edit-card.is-compact')];
   const details=cards.map((card,index)=>{
     const r=card.getBoundingClientRect();
     const head=card.querySelector('.qd-card-head').getBoundingClientRect();
     const overflow=[...card.querySelector('.qd-card-head').children].filter(el=>{
       const b=el.getBoundingClientRect();return b.width>0&&
         (b.left<r.left-1||b.right>r.right+1||b.top<head.top-1||b.bottom>head.bottom+1);
     }).map(el=>el.outerHTML.slice(0,100));
     return {index,right:r.right,headRight:head.right,overflow};
   });
   const left=document.querySelector('.qd-topic-navigator').getBoundingClientRect();
   const right=document.querySelector('.qd-side-insights').getBoundingClientRect();
   const main=document.querySelector('.qd-workbench-main').getBoundingClientRect();
   return {viewport:document.documentElement.clientWidth,documentWidth:document.documentElement.scrollWidth,
     details,leftWidth:left.width,rightWidth:right.width,mainWidth:main.width,
     nonOverlap:left.right<=main.left+1&&main.right<=right.left+1};
 });
 for(const width of [2048,1600,1440,1280,1100,900,650,390]){
   await page.setViewportSize({width,height:930});
   const x=await bounds();
   assert.ok(x.documentWidth<=x.viewport+4,'document overflow at '+width);
   for(const item of x.details)assert.deepEqual(item.overflow,[],'card '+item.index+' overflows at '+width);
   if(width>1330){
     assert.ok(x.rightWidth>=290&&x.rightWidth<=356,'wider right sidebar '+width);
     assert.ok(x.nonOverlap,'workbench columns may not overlap at '+width);
   }
 }
 await page.setViewportSize({width:1600,height:950});
 const save=page.locator('.qd-builder-save');
 assert.equal(await save.count(),1);
 assert.equal(await save.locator('[data-qd-action="builder-template-save"]').count(),1);
 assert.equal(await save.locator('[data-qd-action="builder-template-update"]').isDisabled(),true);
 const prompt=page.locator('.qd-edit-card').first();
 await prompt.locator('[data-qd-action="card-expand"]').click();
 await prompt.locator('[data-qd-field="prompt"]').fill('Почему сахар быстрее растворяется при повышенной температуре? Исправленная редакция.');
 await save.locator('#qd-builder-template-subject').selectOption('physics');
 await save.locator('#qd-builder-template-grade').fill('8');
 await save.locator('[data-qd-action="builder-template-save"]').click();
 assert.equal(await page.evaluate(()=>qdLibraryRead().length),1);
 assert.equal(await save.locator('[data-qd-action="builder-template-update"]').isDisabled(),false);
 assert.equal(await page.evaluate(()=>qdDoc().history.length),0);
 await prompt.locator('[data-qd-field="answer"]').fill('Исправленный развёрнутый ответ по диффузии.');
 const storedBefore=await page.evaluate(()=>qdLibraryRead()[0].sections[0].questions[0].answer);
 assert.notEqual(storedBefore,'Исправленный развёрнутый ответ по диффузии.');
 await save.locator('[data-qd-action="builder-template-update"]').click();
 assert.equal(await page.evaluate(()=>qdLibraryRead()[0].sections[0].questions[0].answer),'Исправленный развёрнутый ответ по диффузии.');
 const dlPromise=page.waitForEvent('download');
 await save.locator('[data-qd-action="builder-template-export"]').click();
 const dl=await dlPromise;
 assert.match(dl.suggestedFilename(),/\.qtpl$/);
 const out=path.resolve(__dirname,'../task119-templates.qtpl');await dl.saveAs(out);
 const library=JSON.parse(fs.readFileSync(out,'utf8'));
 fs.rmSync(out,{force:true});
 assert.equal(library.templates.length,1);
 assert.doesNotMatch(JSON.stringify(library),/"history"|"session"|"students"/);
 await page.reload();await page.evaluate(()=>route('writer'));
 await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
 assert.equal(await page.evaluate(()=>qdLibraryRead().length),1,'local template survives browser reload');
 assert.equal(await page.locator('.qd-builder-save #qd-builder-template-target option').count(),2);
 assert.deepEqual(errors,[]);
 console.log('PASS TASK119: 8 responsive widths, all compact cards contained, wider sidebar, new/update/export template and reload');
 await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1);});
