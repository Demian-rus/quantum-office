const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1320,height:860}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../Quantum-Office.html')).href);
  await page.evaluate(()=>{
   createBook();const b=book();
   b.sheets[0].name='Контент';const second=newSheet('Сценарии');b.sheets.push(second);
   setCell(b.sheets[0],'A2','QX-001');setCell(b.sheets[0],'A3','=CONCAT("QX",A2)');
   setCell(second,'B4','QX-002');setCell(second,'B5','QX-003');
   render();
  });
  await page.keyboard.press('Control+f');
  await page.locator('#find-term').fill('QX');
  await page.locator('#replace-term').fill('VID');
  await page.locator('#find-scope').selectOption('book');
  await page.locator('[data-action="replace-preview"]').click();
  assert.equal(await page.locator('.qo-bulk-replace-row').count(),3);
  assert.match(await page.locator('.qo-bulk-replace-summary').innerText(),/вся книга/);
  await page.locator('.qo-bulk-replace-row input').nth(1).uncheck();
  assert.match(await page.locator('.qo-bulk-replace-selected').innerText(),/2 из 3/);
  await page.locator('[data-qbr-apply]').click();
  assert.equal(await page.locator('#qo-bulk-replace').count(),0);
  const values=await page.evaluate(()=>[
   getCell(book().sheets[0],'A2').value,
   getCell(book().sheets[0],'A3').value,
   getCell(book().sheets[1],'B4').value,
   getCell(book().sheets[1],'B5').value
  ]);
  assert.deepEqual(values,['VID-001','=CONCAT("QX",A2)','QX-002','VID-003']);
  await page.evaluate(()=>undo());
  assert.deepEqual(await page.evaluate(()=>[
   getCell(book().sheets[0],'A2').value,
   getCell(book().sheets[1],'B4').value,
   getCell(book().sheets[1],'B5').value
  ]),['QX-001','QX-002','QX-003']);
  await page.setViewportSize({width:390,height:844});
  await page.keyboard.press('Control+f');
  await page.locator('#find-term').fill('QX');
  await page.locator('#replace-term').fill('VID');
  await page.locator('#find-scope').selectOption('book');
  await page.locator('[data-action="replace-preview"]').click();
  assert.equal(await page.locator('.qo-bulk-replace-panel').isVisible(),true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#qo-bulk-replace').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS TASK129: selective workbook replace, formulas untouched, undo and mobile');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exit(1);});
