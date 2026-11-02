const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const root=path.resolve(__dirname,'..');
 for(const width of [2048,1280,900,390]){
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  const height=async selector=>Math.round((await page.locator(selector).first().boundingBox()).height);
  await page.evaluate(()=>route('sheet'));
  const sheetHeight=await height('.ribbon');
  assert.equal(sheetHeight,109,'Sheets reference header height');
  await page.locator('[data-action="ribbon"][data-target="formula"]').click();
  assert.equal(await height('.ribbon'),sheetHeight,'formulas must not expand the ribbon');
  const formulaFit=await page.evaluate(()=>{
   const host=document.querySelector('.ribbon-controls').getBoundingClientRect();
   const buttons=[...document.querySelectorAll('.ribbon-group-content button')];
   return [buttons.length,buttons.filter(b=>{
    const r=b.getBoundingClientRect();
    return r.top>=host.top-1&&r.bottom<=host.bottom+1;
   }).length];
  });
  assert.ok(formulaFit[0]>=10,'formula tools exist');
  assert.equal(formulaFit[0],formulaFit[1],'formula buttons fit inside fixed header');
  await page.evaluate(()=>route('writer'));
  for(const tab of ['home','insert','layout','file','diagnostic']){
   await page.locator('[data-editor="writer"][data-tab="'+tab+'"]').click();
   assert.equal(await height('.qo-office-toolbar'),sheetHeight,'Writer '+tab+' same height as Sheets');
  }
  const bottoms=await page.evaluate(()=>{
   return [...document.querySelector('.qd-builder-tools').children]
    .filter(e=>e.tagName==='BUTTON'||e.tagName==='LABEL')
    .map(e=>Math.round((e.tagName==='LABEL'?e.querySelector('select'):e).getBoundingClientRect().bottom));
  });
  if(width>=1280)
   assert.ok(Math.max(...bottoms)-Math.min(...bottoms)<=1,'builder actions aligned');
  await page.locator('[data-qd-action="mode"][data-mode="run"]').first().click();
  await page.locator('.qd-session-drawer summary').click();
  const controls=await page.evaluate(()=>{
   return ['.qd-student-chooser select','.qd-student-chooser input',
    '.qd-student-chooser button','[data-qd-action="reset"]']
     .map(s=>Math.round(document.querySelector(s).getBoundingClientRect().bottom));
  });
  if(width>=1280)
   assert.ok(Math.max(...controls)-Math.min(...controls)<=1,'session reset aligned with inputs');
  await page.evaluate(()=>route('slides'));
  for(const tab of ['home','insert','design','show','file']){
   await page.locator('[data-editor="slides"][data-tab="'+tab+'"]').click();
   assert.equal(await height('.qo-office-toolbar'),sheetHeight,'Slides '+tab+' same height as Sheets');
  }
  assert.deepEqual(errors,[],'browser must not report errors at '+width);
  await page.close();
 }
 console.log('PASS TASK117: 109px headers, formulas unchanged, aligned builder/session, responsive tabs');
 await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1);});
