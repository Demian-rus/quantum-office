const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',d=>d.accept());
 await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
 const library=async()=>{
   await page.evaluate(()=>route('writer'));
   await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
   await page.locator('[data-qd-action="mode"][data-mode="library"]').click();
 };
 await library();
 assert.equal(await page.locator('.qd-library-card').count(),14);
 await page.locator('.qd-library-card').filter({hasText:'Молекулы и температура'})
    .locator('[data-qd-action="library-open"]').click();
 await page.locator('[data-qd-action="mode"][data-mode="run"]').first().click();
 await page.locator('[data-qd-action="view"][data-view="list"]').click();
 assert.ok((await page.locator('.qd-chat-card').count())>=20,'expanded physics8');
 await page.locator('.qd-chat-card [data-mark="partial"]').first().click();
 assert.equal(await page.evaluate(()=>Object.keys(qdDoc().session.marks).length),1);
 await library();
 await page.locator('#qd-library-save-subject').selectOption('physics');
 await page.locator('#qd-library-save-grade').fill('8');
 await page.locator('[data-qd-action="library-save"]').click();
 assert.equal(await page.locator('.qd-library-card').count(),15);
 let card=page.locator('.qd-library-card').filter({has:page.locator('[data-qd-action="library-edit"]')}).first();
 await card.locator('[data-qd-action="library-edit"]').click();
 assert.equal(await page.locator('.qd-library-editor').count(),1);
 assert.equal(await page.locator('#qd-library-edit-replace').isChecked(),false);
 await page.locator('#qd-library-edit-title').fill('Молекулы: авторская диагностика');
 await page.locator('#qd-library-edit-description').fill('Устные вопросы для вводной проверки');
 await page.locator('#qd-library-edit-subject').selectOption('physics');
 await page.locator('#qd-library-edit-grade').fill('9');
 await page.locator('#qd-library-edit-purpose').selectOption('review');
 await page.locator('[data-qd-action="library-edit-save"]').click();
 assert.equal(await page.locator('.qd-library-editor').count(),0);
 assert.equal(await page.locator('.qd-library-card').count(),15);
 card=page.locator('.qd-library-card').filter({hasText:'Молекулы: авторская диагностика'});
 assert.match(await card.textContent(),/9 класс/);
 await card.locator('[data-qd-action="library-clone"]').click();
 assert.equal(await page.locator('.qd-library-card').count(),16);
 assert.equal(await page.locator('.qd-library-card').filter({hasText:'Молекулы: авторская диагностика — копия'}).count(),1);
 await page.locator('.qd-library-card').filter({hasText:'Алгебра: уравнения и функции'})
   .locator('[data-qd-action="library-open"]').click();
 assert.ok((await page.locator('.qd-edit-card').count())>=18,'math7 opens for authoring in TASK141');
 await library();
 card=page.locator('.qd-library-card').filter({hasText:'Молекулы: авторская диагностика'})
   .filter({has:page.locator('[data-qd-action="library-edit"]')}).last();
 await card.locator('[data-qd-action="library-edit"]').click();
 assert.equal(await page.locator('#qd-library-edit-title').inputValue(),'Молекулы: авторская диагностика');
 await page.locator('#qd-library-edit-replace').check();
 await page.locator('[data-qd-action="library-edit-save"]').click();
 const state=await page.evaluate(()=>({
   templates:qdLibraryRead().map(x=>({title:x.title,count:x.sections.flatMap(s=>s.questions).length})),
   current:qdQuestionList().length
 }));
 assert.ok(state.current>=18);
 assert.equal(state.templates.find(x=>x.title==='Молекулы: авторская диагностика').count,state.current);
 assert.ok(state.templates.find(x=>x.title.includes('копия')).count>=20);
 assert.equal(await page.locator('.qd-library-card').count(),16);
 const wait=page.waitForEvent('download');
 await page.locator('[data-action="writer-diag-templates-export"]').click();
 const dl=await wait,output=path.join(root,'task108-library.qtpl');
 await dl.saveAs(output);
 const json=JSON.parse(fs.readFileSync(output,'utf8'));
 assert.equal(json.templates.length,2);
 assert.ok(!JSON.stringify(json).includes('"session"'));
 assert.ok(!JSON.stringify(json).includes('"history"'));
 assert.ok(!JSON.stringify(json).includes('"marks"'));
 fs.rmSync(output,{force:true});
 await page.reload();await library();
 assert.equal(await page.locator('.qd-library-card').count(),16);
 await page.setViewportSize({width:390,height:830});
 await page.locator('.qd-library-card').filter({hasText:'Молекулы: авторская диагностика'})
   .filter({has:page.locator('[data-qd-action="library-edit"]')}).last()
   .locator('[data-qd-action="library-edit"]').click();
 const width=await page.locator('.qd-library-editor').evaluate(el=>({
   viewport:document.documentElement.clientWidth,
   content:document.documentElement.scrollWidth,
   panel:el.getBoundingClientRect().width
 }));
 assert.ok(width.panel<=width.viewport,'editor must fit phone width');
 assert.ok(width.content<=width.viewport+4,'editor must not introduce horizontal overflow');
 assert.deepEqual(errors,[]);
 console.log('PASS TASK108: template metadata editing, clone, question refresh, personal-data exclusion, persistence and mobile');
 await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1);});