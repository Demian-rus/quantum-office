const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1360,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../Quantum-Office.html')).href);
  await page.evaluate(()=>{
   createBook();const b=book();b.sheets[0].name='Контент';
   const terms=newSheet('Термины');b.sheets.push(terms);
   setCell(b.sheets[0],'A2','QX-001');setCell(terms,'B6','QX-002');setCell(terms,'C8','=B6&"QX"');render();
  });
  await page.keyboard.press('Control+f');
  assert.equal(await page.locator('#find-term').isVisible(),true);
  await page.locator('#find-term').fill('QX');
  await page.locator('#find-scope').selectOption('book');
  await page.locator('[data-action="find-all"]').click();
  assert.equal(await page.locator('.qo-workbook-search-hit').count(),3);
  await page.locator('.qo-workbook-search-hit').nth(1).click();
  assert.deepEqual(await page.evaluate(()=>[sheet().name,activeCell]),['Термины','B6']);
  assert.equal(await page.locator('#qo-workbook-search-results').count(),0);
  await page.locator('[data-action="find-next"]').click();
  assert.deepEqual(await page.evaluate(()=>[sheet().name,activeCell]),['Термины','C8']);
  await page.locator('#find-scope').selectOption('sheet');
  await page.locator('[data-action="find-all"]').click();
  assert.equal(await page.locator('.qo-workbook-search-hit').count(),2);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#qo-workbook-search-results').count(),0);
  assert.equal(await page.evaluate(()=>getCell(book().sheets[0],'A2').value),'QX-001');
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-action="find-all"]').click();
  assert.equal(await page.locator('.qo-workbook-search-panel').isVisible(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS TASK128: whole-book search, navigation, scoped search, formulas, mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
