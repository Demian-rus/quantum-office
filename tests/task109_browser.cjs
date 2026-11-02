const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
 const root=path.resolve(__dirname,'..');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1450,height:925},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const open=async()=>{
   await page.evaluate(()=>route('writer'));
   await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
 };
 await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
 await open();
 await page.locator('[data-qd-action="sample"]').click();
 const oldCount=await page.locator('.qd-edit-card').count();
 assert.equal(oldCount,8);
 let quick=page.locator('[data-qd-quick-sid]').first();
 await quick.locator('[data-qd-quick="prompt"]').fill('Какое движение частиц называют диффузией?');
 await quick.locator('[data-qd-quick="answer"]').fill('Самопроизвольное перемешивание частиц');
 await quick.locator('[data-qd-quick="type"]').selectOption('practice');
 await quick.locator('[data-qd-action="quick-add"]').click();
 assert.equal(await page.locator('.qd-edit-card').count(),9);
 assert.equal(await page.evaluate(()=>qdQuestionList().at(-1).prompt.includes('диффузией')),false);
 assert.equal(await page.evaluate(()=>qdDoc().sections[0].questions.at(-1).type),'practice');
 quick=page.locator('[data-qd-quick-sid]').first();
 await quick.locator('[data-qd-quick="prompt"]').fill('Сколько килоджоулей в 84000 Дж?');
 await quick.locator('[data-qd-quick="answer"]').fill('84');
 await quick.locator('[data-qd-quick="type"]').selectOption('numeric');
 await quick.locator('[data-qd-quick="answer"]').press('Control+Enter');
 assert.equal(await page.locator('.qd-edit-card').count(),10);
 assert.equal(await page.evaluate(()=>qdDoc().sections[0].questions.at(-1).numericAnswer),'84');

 const firstSection=page.locator('.qd-editor-section').first();
 await firstSection.locator('[data-qd-action="section-collapse"]').click();
 assert.equal(await page.locator('.qd-editor-section').first().getAttribute('class').then(s=>s.includes('qd-section-collapsed')),true);
 assert.equal(await firstSection.locator('.qd-edit-card').first().isVisible(),false);
 await firstSection.locator('[data-qd-action="section-collapse"]').click();
 assert.equal(await firstSection.locator('.qd-edit-card').first().isVisible(),true);
 const before=await page.evaluate(()=>({sections:qdDoc().sections.length,total:qdQuestionList().length,marks:Object.keys(qdDoc().session.marks).length}));
 await firstSection.locator('[data-qd-action="duplicate-section"]').click();
 const after=await page.evaluate(()=>({sections:qdDoc().sections.length,total:qdQuestionList().length}));
 assert.equal(after.sections,before.sections+1);
 assert.equal(after.total,before.total+await page.evaluate(()=>qdDoc().sections[0].questions.length));
 const duplicates=await page.evaluate(()=>({
   original:qdDoc().sections[0].questions.map(q=>q.id),
   copy:qdDoc().sections[1].questions.map(q=>q.id)
 }));
 assert.ok(duplicates.original.every((v,i)=>v!==duplicates.copy[i]));

 const pending=page.waitForEvent('download');
 await page.locator('[data-qd-action="export"]').click();
 const download=await pending;const local=path.join(root,'task109-smoke.qdiag');
 await download.saveAs(local);
 const data=JSON.parse(fs.readFileSync(local,'utf8'));
 assert.equal(data.sections.length,4);
 assert.equal(data.sections.flatMap(s=>s.questions).length,after.total);
 fs.rmSync(local,{force:true});
 await page.reload();await open();
 assert.equal(await page.evaluate(()=>qdDoc().sections.length),4);
 assert.equal(await page.evaluate(()=>qdQuestionList().length),after.total);
 await page.setViewportSize({width:390,height:840});
 const geometry=await page.locator('[data-qd-quick-sid]').first().evaluate(el=>({
   viewport:document.documentElement.clientWidth,
   content:document.documentElement.scrollWidth,
   panel:el.getBoundingClientRect().width
 }));
 assert.ok(geometry.panel<=geometry.viewport);
 assert.ok(geometry.content<=geometry.viewport+4);
 assert.deepEqual(errors,[]);
 console.log('PASS TASK109: inline quick add, Ctrl+Enter, fold, independent section duplication, QDIAG, reload and mobile');
 await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1);});