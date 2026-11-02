const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');

(async()=>{
  const root=path.resolve(__dirname,'..'),browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  const open=async()=>{
    await page.evaluate(()=>route('writer'));
    await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
  };
  await open();
  await page.locator('[data-qd-action="sample"]').click();
  await page.locator('[data-qd-action="mode"][data-mode="run"]').first().click();
  assert.equal(await page.locator('[data-qd-action="view"][data-view="focus"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.qd-guided .qd-run-card').count(),1);
  assert.equal(await page.locator('.qd-guided-topline strong').textContent(),'Вопрос 1 из 8');
  assert.equal(await page.locator('.qd-answer').count(),0);
  await page.locator('.qd-guided [data-qd-action="reveal"]').click();
  assert.equal(await page.locator('.qd-guided .qd-answer').count(),1);
  await page.locator('.qd-guided [data-qd-action="mark"][data-mark="yes"]').click();
  assert.equal(await page.locator('.qd-guided-topline strong').textContent(),'Вопрос 2 из 8');
  assert.match(await page.locator('.qd-guided-measures').textContent(),/1 \/ 8/);
  assert.equal(await page.locator('.qd-guided .qd-answer').count(),0);

  await page.locator('[data-qd-action="nav-prev"]').click();
  assert.equal(await page.locator('.qd-guided-topline strong').textContent(),'Вопрос 1 из 8');
  await page.locator('[data-qd-action="nav-next"]').click();
  assert.equal(await page.locator('.qd-guided-topline strong').textContent(),'Вопрос 2 из 8');
  await page.locator('[data-qd-action="nav-unrated"]').click();
  assert.equal(await page.locator('.qd-guided-topline strong').textContent(),'Вопрос 3 из 8');
  await page.locator('.qd-question-map summary').click();
  await page.locator('[data-qd-action="nav-index"][data-index="6"]').click();
  assert.equal(await page.locator('.qd-guided-topline strong').textContent(),'Вопрос 7 из 8');

  const id=await page.evaluate(()=>qdDoc().display.activeId);
  await page.reload();await open();
  assert.equal(await page.evaluate(()=>qdDoc().display.activeId),id);
  assert.equal(await page.locator('.qd-guided-topline strong').textContent(),'Вопрос 7 из 8');
  await page.locator('[data-qd-action="view"][data-view="list"]').click();
  assert.equal(await page.locator('.qd-run-card').count(),8);
  assert.equal(await page.locator('[data-qd-action="view"][data-view="list"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-qd-action="view"][data-view="focus"]').click();
  assert.equal(await page.locator('.qd-guided .qd-run-card').count(),1);
  assert.equal(await page.locator('.qd-guided-topline strong').textContent(),'Вопрос 7 из 8');
  await page.locator('[data-qd-action="nav-prev"]').click();
  await page.locator('#qo-diag-root h1').click();
  await page.keyboard.press('2');
  assert.equal(await page.locator('.qd-guided-topline strong').textContent(),'Вопрос 7 из 8');
  assert.equal(await page.evaluate(()=>Object.values(qdDoc().session.marks).filter(x=>x==='partial').length),1);

  const pending=page.waitForEvent('download');
  await page.locator('[data-qd-action="export"]').click();
  const dl=await pending,local=path.join(root,'task102-guide.qdiag');await dl.saveAs(local);
  const data=JSON.parse(fs.readFileSync(local,'utf8'));
  assert.equal(data.display.mode,'focus');
  assert.equal(data.display.activeId,await page.evaluate(()=>qdDoc().display.activeId));
  fs.rmSync(local,{force:true});
  assert.deepEqual(errors,[]);
  console.log('PASS TASK102: focus, reveal, auto-advance, progress, map, reload, list mode, keyboard and QDIAG');
  await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1);});