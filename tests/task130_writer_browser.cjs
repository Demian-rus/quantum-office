const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1365,height:900},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 try{
  const root=path.resolve(__dirname,'..');
  await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  await page.evaluate(()=>{
   route('writer');
   const e=document.getElementById('qo-writer-page');
   e.innerHTML='<h1>Исследование</h1><p>Логика и <b>рациональное</b> мышление.</p>'+
    '<h2>Результаты</h2><p>Логика важна; логика полезна.</p>';
   qoPersistWriter();
  });
  await page.locator('[data-editor="writer"][data-tab="view"]').click();
  await page.locator('[data-action="writer-nav-outline"]').click();
  assert.equal(await page.locator('.qo-writer-heading-link').count(),2);
  await page.locator('.qo-writer-heading-link').nth(1).click();
  assert.equal(await page.evaluate(()=>window.getSelection().anchorNode?.textContent),'Результаты');
  await page.keyboard.press('Control+f');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'qo-writer-nav-query');
  await page.locator('#qo-writer-nav-query').fill('рациональное мышление');
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>qoWriterNavMatches().items.length),1);
  await page.locator('[data-qwn-next]').click();
  assert.equal(await page.evaluate(()=>window.getSelection().toString()),'рациональное мышление');
  await page.keyboard.press('Control+h');
  await page.locator('#qo-writer-nav-replacement').fill('разумный подход');
  await page.locator('[data-qwn-replace-one]').click();
  assert.match(await page.locator('#qo-writer-page').innerText(),/разумный подход/);
  await page.locator('#qo-writer-nav-query').fill('Логика');
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>qoWriterNavMatches().items.length),3);
  await page.locator('[data-qwn-replace-all]').click();
  assert.equal(await page.evaluate(()=>qoWriterNavMatches().items.length),0);
  assert.equal(await page.locator('#qo-writer-nav-undo-replace').isVisible(),true);
  await page.locator('[data-qwn-undo-replace]').click();
  assert.match(await page.locator('#qo-writer-page').innerText(),/Логика важна/);
  await page.locator('[data-editor="writer"][data-tab="file"]').click();
  const wait=page.waitForEvent('download');
  await page.locator('[data-action="writer-export-qdoc"]').click();
  const download=await wait;
  assert.ok(download.suggestedFilename().endsWith('.qdoc'));
  const saved=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  assert.match(saved.html,/Логика важна/);
  assert.ok(!saved.html.includes('qo-writer-navigation'));
  await page.setViewportSize({width:390,height:844});
  await page.keyboard.press('Control+f');
  const bounds=await page.locator('#qo-writer-navigation').boundingBox();
  assert.ok(bounds.x>=0&&bounds.x+bounds.width<=391,'navigation fits mobile width');
  assert.deepEqual(errors,[]);
  console.log('PASS TASK130: outline, formatted search, replace, undo, QDOC and 390px');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exit(1);});
