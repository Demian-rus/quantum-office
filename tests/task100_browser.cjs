
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const root=path.resolve(__dirname,'..');
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  await page.evaluate(()=>route('writer'));
  await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
  await page.locator('[data-qd-action="sample"]').click();
  assert.equal(await page.locator('.qd-edit-card').count(),8);

  const ids=await page.evaluate(()=>qdQuestionList().map(q=>q.id));
  await page.locator('[data-qd-action="duplicate-question"]').first().click();
  assert.equal(await page.locator('.qd-edit-card').count(),9);
  const copies=await page.evaluate(()=>qdQuestionList().map(q=>q.id));
  assert.equal(copies[0],ids[0]);assert.notEqual(copies[1],ids[0]);
  await page.locator('[data-qd-action="question-down"]').first().click();
  assert.equal(await page.evaluate(()=>qdDoc().sections[0].questions[1].id),ids[0]);

  await page.locator('.qd-edit-card').first().locator('[data-qd-field="points"]').fill('10');
  await page.locator('.qd-edit-card').first().locator('[data-qd-field="points"]').dispatchEvent('change');
  await page.locator('.qd-edit-card').first().locator('[data-qd-field="partialCredit"]').fill('25');
  await page.locator('.qd-edit-card').first().locator('[data-qd-field="partialCredit"]').dispatchEvent('change');
  assert.equal(await page.evaluate(()=>qdQuestionList()[0].points),10);
  assert.equal(await page.evaluate(()=>qdQuestionList()[0].partialCredit),25);

  const before=await page.evaluate(()=>qdDoc().sections[0].questions.map(q=>q.id));
  await page.evaluate(()=>{window._qdDragTrace=[];for(const type of ['pointerdown','pointermove','pointerup','dragstart','dragenter','dragover','drop','dragend'])document.getElementById('qo-diag-root').addEventListener(type,e=>window._qdDragTrace.push({type,tag:e.target.tagName,cls:e.target.className,inside:!!e.target.closest?.('[data-qd-drop-section]'),active:qdDraggedQuestion}),true);});
  const targetBox=await page.locator('.qd-edit-card').nth(1).boundingBox();
  await page.locator('.qd-drag-handle').first().dragTo(page.locator('.qd-edit-card').nth(1),{targetPosition:{x:15,y:targetBox.height-12}});
  const after=await page.evaluate(()=>qdDoc().sections[0].questions.map(q=>q.id));
  console.log('TASK100 drag trace',JSON.stringify(await page.evaluate(()=>({events:window._qdDragTrace,before:qdDoc().sections[0].questions.map(q=>q.id)}))));
  assert.notDeepEqual(before,after,'drag and drop must reorder actual model');

  const moved=after[0];
  await page.locator('.qd-edit-card').first().locator('[data-qd-field="move-section"]').selectOption(
    await page.evaluate(()=>qdDoc().sections[1].id));
  assert.equal(await page.evaluate(q=>qdDoc().sections[1].questions.some(x=>x.id===q),moved),true);

  await page.locator('#qd-student-new').fill('Ученица А');
  await page.locator('[data-qd-action="add-student"]').click();
  assert.equal(await page.locator('.qd-student-row').count(),1);
  await page.locator('[data-qd-action="mode"][data-mode="run"]').first().click();
  await page.locator('[data-qd-field="student-select"]').selectOption(await page.evaluate(()=>qdDoc().students[0].id));
  assert.equal(await page.locator('[data-qd-field="student"]').inputValue(),'Ученица А');

  const firstQ=await page.evaluate(()=>qdQuestionList()[0]);
  await page.locator('[data-qd-action="mark"][data-mark="partial"]').first().click();
  const percentage=await page.evaluate(()=>qdScores(qdQuestionList(),qdDoc().session.marks).percent);
  assert.ok(percentage>=0&&percentage<=100);
  assert.match(await page.locator('.qd-percent').textContent(),new RegExp(percentage+'%'));
  await page.locator('[data-qd-action="save-result"]').click();
  assert.equal(await page.evaluate(()=>qdDoc().history.length),1);
  await page.locator('[data-qd-field="history-filter"]').selectOption(await page.evaluate(()=>qdDoc().students[0].id));
  assert.match(await page.locator('.qd-profile-insight').textContent(),/1/);
  await page.reload();
  await page.evaluate(()=>route('writer'));
  await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
  assert.equal(await page.evaluate(()=>qdDoc().students.length),1);
  assert.equal(await page.evaluate(()=>qdDoc().history.length),1);
  assert.equal(await page.locator('.qd-card[data-qid]').count(),9);

  const pending=page.waitForEvent('download');
  await page.locator('[data-qd-action="export"]').click();
  const dl=await pending;
  const dest=path.join(root,'task100-smoke.qdiag');await dl.saveAs(dest);
  const data=JSON.parse(fs.readFileSync(dest,'utf8'));
  assert.equal(data.history.length,1);
  assert.equal(data.students.length,1);
  assert.equal(data.sections.flatMap(s=>s.questions).length,9);
  assert.ok(data.sections.flatMap(s=>s.questions).some(q=>q.points===10&&q.partialCredit===25));
  assert.ok(Number.isFinite(data.history[0].summary.earned));
  fs.rmSync(dest,{force:true});
  assert.deepEqual(errors,[]);
  console.log('PASS TASK100: duplicate, arrows, drag/drop, transfer, weights, roster, reporting, persistence and export');
  await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1);});
