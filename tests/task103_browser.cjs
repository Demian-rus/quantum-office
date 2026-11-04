const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const root=path.resolve(__dirname,'..');
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1366,height:900},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  await page.evaluate(()=>route('writer'));
  assert.equal(await page.locator('#qo-writer-page').count(),1);
  const dimensions=await page.evaluate(()=>{
    const rect=s=>document.querySelector(s)?.getBoundingClientRect();
    const styles=s=>getComputedStyle(document.querySelector(s));
    return {font:rect('#qo-writer-font')?.width,size:rect('#qo-writer-size')?.height,
      block:rect('#qo-writer-block')?.height,button:rect('.qo-style-line button')?.height,
      group:rect('.qo-document-workspace .qo-work-group')?.height,
      ribbon:rect('.qo-document-workspace .qo-work-ribbon')?.height,
      separators:styles('.qo-document-workspace .qo-work-group').borderRightWidth};
  });
  console.log('TASK103 computed Writer ribbon',JSON.stringify(dimensions));
  assert.ok(dimensions.font>=185,'font picker must be at Sheets scale');
  assert.ok(dimensions.size>=27&&dimensions.block>=27,'form controls must not be tiny');
  assert.ok(dimensions.button>=26,'text formatting controls must match Sheets');
  assert.ok(dimensions.group>=70&&dimensions.ribbon>=78,'ribbon size must match Sheets');
  assert.equal(dimensions.separators,'1px');
  await page.locator('#qo-writer-size').fill('21');
  await page.locator('#qo-writer-size').dispatchEvent('change');
  assert.equal(await page.evaluate(()=>qoWriterLayout().size),21);
  await page.locator('#qo-writer-font').selectOption('Comic Sans MS');
  assert.equal(await page.evaluate(()=>qoWriterLayout().font),'Comic Sans MS');
  await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
  await page.locator('#qd-template-pick').selectOption('math56');
  await page.locator('[data-qd-action="use-template"]').click();
  assert.match(await page.locator('#qo-diag-root h1').textContent(),/Математика/);
  const templateCount=await page.locator('.qd-edit-card').count();
  assert.ok(templateCount>=18,'TASK118 expanded math56 is available');
  await page.locator('[data-qd-action="mode"][data-mode="run"]').first().click();
  await page.locator('[data-qd-action="view"][data-view="focus"]').click();
  assert.equal(await page.locator('.qd-guided .qd-run-card').count(),1);
  await page.locator('.qd-guided [data-qd-action="mark"][data-mark="no"]').click();
  const count=await page.evaluate(()=>qdReviewItems(qdDoc()).length);
  assert.equal(count,1);
  await page.locator('.qd-guided-insights summary').click();
  assert.match(await page.locator('.qd-review-plan').textContent(),/На повторение/);
  await page.locator('[data-qd-action="review-jump"]').click();
  assert.equal(await page.locator('.qd-guided-topline strong').textContent(),'Вопрос 1 из '+templateCount);
  await page.reload();
  await page.evaluate(()=>route('writer'));
  assert.equal(await page.locator('#qo-writer-size').inputValue(),'21');
  assert.equal(await page.locator('#qo-writer-font').inputValue(),'Comic Sans MS');
  await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
  assert.match(await page.locator('#qo-diag-root h1').textContent(),/Математика/);
  assert.equal(await page.evaluate(()=>qdReviewItems(qdDoc()).length),1);
  const pending=page.waitForEvent('download');
  await page.locator('[data-action="writer-diag-export"]').click();
  const dl=await pending,local=path.join(root,'task103-test.qdiag');await dl.saveAs(local);
  const diag=JSON.parse(fs.readFileSync(local,'utf8'));
  assert.ok(diag.sections.length>=5,'TASK118 enriched sections persist in QDIAG');
  assert.equal(diag.run.document.session.marks[diag.run.document.sections[0].questions[0].id],'no');
  fs.rmSync(local,{force:true});
  assert.deepEqual(errors,[]);
  console.log('PASS TASK103: Sheets-scale Writer ribbon, editable size, font, template, review, reload and export');
  await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1);});
