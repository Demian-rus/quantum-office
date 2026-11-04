const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1280,height:820}});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../Quantum-Office.html')).href);
  await page.evaluate(()=>{createBook();render();});
  const bounds=async ref=>page.locator('.grid-cell[data-ref="'+ref+'"]').first().boundingBox();

  const a=await bounds('B5'),z=await bounds('D7');
  await page.mouse.move(a.x+25,a.y+15);await page.mouse.down();
  await page.mouse.move(z.x+40,z.y+15,{steps:10});await page.mouse.up();

  assert.deepEqual(await page.evaluate(()=>[activeCell,rangeEnd]),['B5','D7']);
  const bar=page.locator('#qo-mini-sheet-toolbar');
  assert.equal(await bar.count(),1);
  assert.ok((await bar.boundingBox()).y<a.y,'toolbar appears above the selected range');
  for(const key of ['bold','italic','underline','strike'])
   assert.equal(await bar.locator('[data-mini-style="'+key+'"]').count(),1);
  assert.equal(await bar.locator('[data-mini-font]').count(),1);
  assert.equal(await bar.locator('[data-mini-size]').count(),1);
  assert.equal(await bar.locator('[data-mini-color]').count(),1);
  assert.equal(await bar.locator('[data-mini-bg]').count(),1);

  await bar.locator('[data-mini-style="italic"]').click();
  assert.deepEqual(await page.evaluate(()=>[
   !!getEffectiveStyle(sheet(),'B5').italic,
   !!getEffectiveStyle(sheet(),'C6').italic,
   !!getEffectiveStyle(sheet(),'D7').italic,
   !!getEffectiveStyle(sheet(),'A1').italic
  ]),[true,true,true,false]);

  await bar.locator('[data-mini-bg]').fill('#ffe599');
  assert.deepEqual(await page.evaluate(()=>[
   getEffectiveStyle(sheet(),'B5').bg,
   getEffectiveStyle(sheet(),'D7').bg
  ]),['#ffe599','#ffe599']);
  await page.evaluate(()=>undo());
  assert.deepEqual(await page.evaluate(()=>[
   !!getEffectiveStyle(sheet(),'B5').italic,
   !!getEffectiveStyle(sheet(),'B5').bg
  ]),[true,false]);

  await page.mouse.move(1200,700);
  assert.equal(await bar.count(),0,'toolbar disappears after moving far away');
  await page.locator('.grid-cell[data-ref="B5"]').first().click();
  assert.equal(await bar.count(),1,'single-cell selection also shows toolbar');
  await page.locator('#grid-scroll').focus();
  await page.keyboard.press('F2');
  assert.equal(await bar.count(),0,'editing hides the toolbar');
  await page.keyboard.press('Escape');

  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>render());
  await page.locator('.grid-cell[data-ref="B4"]').first().click();
  const mobile=await bar.boundingBox();
  assert.ok(mobile.x>=0&&mobile.x+mobile.width<=391,'toolbar fits mobile viewport');
  assert.deepEqual(errors,[]);
  console.log('PASS TASK139: range and cell popup, 8 format inputs, all-cell styles, colors, Undo, proximity hide, editing, mobile');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exit(1);});