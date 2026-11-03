const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 const errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../Quantum-Office.html')).href);
  await page.evaluate(()=>route('writer'));
  const layout=await page.evaluate(()=>{
   const box=selector=>{
    const r=document.querySelector(selector).getBoundingClientRect();
    return {x:r.x,y:r.y,w:r.width,h:r.height};
   };
   return {
    font:box('#qo-writer-font'),size:box('#qo-writer-size'),
    bold:box('[data-command="bold"]'),italic:box('[data-command="italic"]'),
    underline:box('[data-command="underline"]'),strike:box('[data-command="strikeThrough"]'),
    textColor:box('#qo-writer-text-color'),highlight:box('#qo-writer-highlight'),
    group:box('.qo-writer-font-layout')
   };
  });
  assert.equal(layout.font.y,layout.size.y,'font and size are on the same upper row');
  assert.ok(layout.font.w>=195&&layout.font.w<=225,'wide font picker as in Sheets');
  assert.ok(layout.size.w>=52&&layout.size.w<=62,'compact font size picker');
  assert.equal(layout.bold.y,layout.italic.y);
  assert.equal(layout.italic.y,layout.underline.y);
  assert.equal(layout.underline.y,layout.strike.y);
  assert.ok(layout.bold.y>layout.font.y+layout.font.h,'formatting commands below font');
  assert.ok(layout.bold.x<layout.italic.x&&layout.italic.x<layout.underline.x&&
    layout.underline.x<layout.strike.x&&layout.strike.x<layout.textColor.x&&
    layout.textColor.x<layout.highlight.x,'formatting actions in spreadsheet order');
  assert.ok(layout.textColor.y>layout.font.y,'colors in lower row');
  assert.equal(await page.locator('.qo-work-group-caption').filter({hasText:'Цвет'}).count(),0,'no duplicate color group');
  assert.equal(await page.locator('#qo-writer-text-color').count(),1);
  assert.equal(await page.locator('#qo-writer-highlight').count(),1);
  assert.equal(await page.locator('[data-command="superscript"]').count(),1);
  assert.equal(await page.locator('[data-command="subscript"]').count(),1);
  await page.locator('#qo-writer-size').fill('21');
  await page.locator('#qo-writer-size').dispatchEvent('change');
  assert.equal(await page.evaluate(()=>qoWriterLayout().size),21);
  await page.locator('#qo-writer-font').selectOption('Arial');
  assert.equal(await page.evaluate(()=>qoWriterLayout().font),'Arial');
  await page.evaluate(()=>{
   const e=document.getElementById('qo-writer-page');e.innerHTML='<p>Проверка текста</p>';
   const text=e.querySelector('p').firstChild,r=document.createRange();
   r.setStart(text,0);r.setEnd(text,8);
   const s=window.getSelection();s.removeAllRanges();s.addRange(r);qoWriterRememberSelection();
  });
  await page.locator('[data-command="bold"]').click();
  assert.match(await page.locator('#qo-writer-page').innerHTML(),/<(b|strong)>/i);
  for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:844});
   for(const kind of ['sheet','writer','slides','photo']){
    await page.evaluate(kind=>route(kind),kind);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert.ok(overflow<=1,kind+' must not overflow whole page at '+width);
   }
  }
  assert.deepEqual(errors,[]);
  console.log('PASS TASK136: Sheets font layout, order, edit commands, 390/768/1440 and JS errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});
