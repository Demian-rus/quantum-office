const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
 const root=path.resolve(__dirname,'..');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1600,height:940},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
 await page.evaluate(()=>route('writer'));
 await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
 await page.locator('[data-qd-action="sample"]').click();
 const sizes=await page.evaluate(()=>{
   const el=s=>document.querySelector(s).getBoundingClientRect();
   return {root:el('#qo-diag-root').width,main:el('.qd-workbench-main').width,
    left:el('.qd-topic-navigator').width,right:el('.qd-side-insights').width,
    gap:el('.qd-workbench-main').left-el('.qd-topic-navigator').right,
    screen:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth};
 });
 console.log('TASK110 actual proportions',JSON.stringify(sizes));
 assert.ok(sizes.main>=600&&sizes.main<=900,'central authoring column must be moderate and readable');
 assert.ok(sizes.left>=170&&sizes.left<=240,'topic rail should not fill the screen');
 assert.ok(sizes.right>=170&&sizes.right<=240,'insights rail should be restrained');
 assert.ok(sizes.gap>=8&&sizes.gap<=28,'consistent gaps');
 assert.ok(sizes.screen<=sizes.viewport+4,'no horizontal overflow at desktop');
 assert.equal(await page.locator('.qd-side-topic').count(),3);
 assert.equal(await page.locator('.qd-side-insights').getByText('Всего баллов').count(),1);
 await page.locator('[data-qd-action="toggle-all-sections"]').click();
 assert.equal(await page.locator('.qd-editor-section.qd-section-collapsed').count(),3);
 await page.locator('.qd-side-topic').nth(1).click();
 assert.equal(await page.locator('.qd-editor-section.qd-section-collapsed').count(),2);
 await page.locator('[data-qd-pane="variants"] summary').click();
 await page.locator('#qd-var-count').selectOption('3');
 await page.locator('#qd-var-per-section').selectOption('2');
 await page.locator('#qd-var-seed').fill('вариантная-физика');
 assert.equal(await page.locator('.qd-variant-card').count(),3);
 assert.match(await page.locator('.qd-variant-card').first().textContent(),/6 вопросов/);
 const source=await page.evaluate(()=>({
   questions:qdQuestionList().length,
   sections:qdDoc().sections.length,
   history:qdDoc().history.length
 }));
 const dlPromise=page.waitForEvent('download');
 await page.locator('[data-qd-action="variant-download"]').nth(1).click();
 const dl=await dlPromise;
 assert.match(dl.suggestedFilename(),/variant-Б\.qdiag$/);
 const output=path.join(root,'task110-variant.qdiag');await dl.saveAs(output);
 const doc=JSON.parse(fs.readFileSync(output,'utf8'));
 assert.equal(doc.sections.length,3);
 assert.equal(doc.sections.flatMap(s=>s.questions).length,6);
 assert.equal(doc.students.length,0);assert.equal(doc.history.length,0);
 assert.equal(Object.keys(doc.session.marks).length,0);
 fs.rmSync(output,{force:true});
 assert.deepEqual(await page.evaluate(()=>({
   questions:qdQuestionList().length,
   sections:qdDoc().sections.length,
   history:qdDoc().history.length
 })),source);
 await page.locator('[data-qd-action="preview-chat"]').click();
 assert.equal(await page.locator('.qd-side-insights').getByText('Ход проверки').count(),1);
 assert.equal(await page.locator('.qd-chat-card').count(),8);
 await page.locator('.qd-side-topic').nth(2).click();
 await page.setViewportSize({width:390,height:840});
 const mobile=await page.evaluate(()=>({
   viewport:document.documentElement.clientWidth,
   scroll:document.documentElement.scrollWidth,
   main:document.querySelector('.qd-workbench-main').getBoundingClientRect().width,
   nav:document.querySelector('.qd-topic-navigator').getBoundingClientRect().width
 }));
 console.log('TASK110 mobile geometry',JSON.stringify(mobile));
 assert.ok(mobile.scroll<=mobile.viewport+4,'mobile viewport must have no horizontal overflow');
 assert.ok(mobile.main<=mobile.viewport,'central view must fit mobile');
 assert.ok(mobile.nav<=mobile.viewport,'topic navigator must fit mobile');
 assert.deepEqual(errors,[]);
 console.log('PASS TASK110: proportional workspace, functional topic navigation, collapsible sections, variants and phone layout');
 await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1);});