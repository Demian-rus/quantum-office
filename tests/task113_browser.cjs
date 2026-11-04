const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
 const root=path.resolve(__dirname,'..');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:2048,height:980},acceptDownloads:true});
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 page.on('dialog',dialog=>dialog.accept());
 await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
 await page.evaluate(()=>route('writer'));
 await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
 await page.locator('[data-qd-action="sample"]').click();
 await page.locator('[data-qd-action="mode"][data-mode="run"]').first().click();
 await page.locator('[data-qd-action="view"][data-view="focus"]').click();
 const pending=page.locator('.qd-review-sidebar [data-qd-action="sidebar-question"]');
 assert.equal(await pending.count(),5,'pending queue should show first five tasks');
 assert.equal(await page.locator('.qd-review-sidebar .qd-side-big-number').count(),0,'do not duplicate main progress percent');
 await page.locator('.qd-guided [data-qd-action="mark"][data-mark="yes"]').click();
 await page.locator('.qd-guided [data-qd-action="mark"][data-mark="partial"]').click();
 const ratedId=await page.evaluate(()=>qdQuestionList()[1].id);
 assert.equal(await page.evaluate(()=>qdReviewQueues(qdDoc()).pending.length),6);
 assert.equal(await page.evaluate(()=>qdReviewQueues(qdDoc()).review.length),1);
 const weak=page.locator('.qd-review-sidebar [data-qd-action="sidebar-question"][data-qid="'+ratedId+'"]');
 assert.equal(await weak.count(),1);
 await weak.click();
 assert.equal(await page.evaluate(()=>qdDisplay(qdDoc()).activeId),ratedId);
 assert.equal(await page.locator('.qd-guided .qd-chat-card').getAttribute('data-qid'),ratedId);
 const desk=await page.evaluate(()=>{
  const r=q=>document.querySelector(q).getBoundingClientRect();
  return {viewport:document.documentElement.clientWidth,overflow:document.documentElement.scrollWidth,
    left:r('.qd-topic-navigator').left,right:r('.qd-side-insights').right,mainWidth:r('.qd-workbench-main').width};
 });
 assert.ok(desk.left<70&&desk.right>desk.viewport-70);
 assert.ok(desk.mainWidth>=800&&desk.mainWidth<desk.viewport-450,'TASK119 uses available desktop width');
 assert.ok(desk.overflow<=desk.viewport+4);
 await page.locator('[data-qd-action="mode"][data-mode="builder"]').click();
 const first=page.locator('.qd-edit-card').first();
 await first.locator('[data-qd-field="prompt"]').fill('');
 assert.ok(await page.locator('.qd-side-insights [data-qd-action="sidebar-issue"]').count()>0);
 const audit=page.locator('.qd-side-insights [data-qd-action="sidebar-issue"]').first();
 assert.match(await audit.textContent(),/Вопрос не заполнен/);
 await audit.click();
 assert.equal(await page.evaluate(()=>document.activeElement?.dataset?.qdField),'prompt');
 await page.locator('.qd-edit-card').first().locator('[data-qd-field="prompt"]').fill('Что такое теплопередача?');
 assert.equal(await page.locator('.qd-side-insights').getByText('Вопрос не заполнен').count(),0);
 await page.locator('[data-action="writer-diag-new"]').click();
 assert.equal(await page.evaluate(()=>qdQuestionList().length),0);
 await page.locator('[data-qd-action="add-section"]').first().click();
 await page.locator('[data-qd-action="add-question"]').click();
 await page.locator('[data-qd-action="mode"][data-mode="run"]').first().click();
 if(!await page.locator('.qd-run-setup').evaluate(el=>el.open))await page.locator('.qd-run-setup>summary').click();
 await page.locator('[data-qd-action="run-start"]').click();
 await page.locator('[data-qd-action="view"][data-view="focus"]').click();
 assert.equal(await page.locator('.qd-guided [data-qd-action="mark"]:disabled').count(),3);
 assert.match(await page.locator('.qd-guided .qd-card-unfilled').textContent(),/пустую карточку нельзя оценить/);
 assert.equal(await page.evaluate(()=>Object.keys(qdDoc().session.marks).length),0);
 await page.setViewportSize({width:390,height:820});
 const mobile=await page.evaluate(()=>({
   viewport:document.documentElement.clientWidth,overflow:document.documentElement.scrollWidth,
   main:document.querySelector('.qd-workbench-main').getBoundingClientRect().width
 }));
 assert.ok(mobile.overflow<=mobile.viewport+4);
 assert.ok(mobile.main<=mobile.viewport);
 assert.deepEqual(errors,[]);
 console.log('PASS TASK113: meaningful live review queue, weak-answer navigation, audit issue jump, blank-card grading safety and mobile');
 await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1);});