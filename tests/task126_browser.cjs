const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../Quantum-Office.html')).href);
  await page.evaluate(()=>{createBook();setCell(sheet(),'A1','ID');setCell(sheet(),'A2','QX-001');setStyle(sheet(),'A1',{bold:true});render();});
  assert.deepEqual(await page.locator('.sheet-tab').allTextContents(),['Лист 1']);
  await page.locator('[data-action="sheet-more"]').click();
  assert.equal(await page.locator('#qo-sheet-context [data-sheet-op]').count(),5);
  await page.locator('[data-sheet-op="duplicate"]').click();
  assert.deepEqual(await page.locator('.sheet-tab').allTextContents(),['Лист 1','Лист 1 — копия']);
  const copied=await page.evaluate(()=>({value:getCell(sheet(),'A2').value,bold:getCell(sheet(),'A1').style.bold}));
  assert.deepEqual(copied,{value:'QX-001',bold:true});
  await page.locator('.sheet-tab').last().click({button:'right'});
  await page.locator('[data-sheet-op="left"]').click();
  assert.deepEqual(await page.locator('.sheet-tab').allTextContents(),['Лист 1 — копия','Лист 1']);
  await page.evaluate(()=>undo());
  assert.deepEqual(await page.locator('.sheet-tab').allTextContents(),['Лист 1','Лист 1 — копия']);
  await page.locator('.sheet-tab').last().click({button:'right'});
  await page.locator('[data-sheet-op="right"]').isDisabled().then(v=>assert.equal(v,true));
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#qo-sheet-context').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS TASK126: duplicate, context menu, move and undo');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
