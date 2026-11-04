const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1366,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../Quantum-Office.html')).href);
  await page.evaluate(()=>{
   route('writer');
   const editor=document.getElementById('qo-writer-page');
   editor.innerHTML='<h1>Введение</h1><p>Тезис</p><h2>Механика</h2><p>Расчёт</p><h3>Результаты</h3>';
   qoPersistWriter();
  });
  await page.locator('[data-editor="writer"][data-tab="insert"]').click();
  await page.locator('[data-action="writer-toc-insert"]').click();
  const toc=page.locator('#qo-writer-page [data-qo-toc="true"]');
  assert.equal(await toc.count(),1);
  assert.deepEqual(await toc.locator('a').allTextContents(),['Введение','Механика','Результаты']);
  assert.match(await page.evaluate(()=>qoWriter.html),/href="#qo-toc-h-2"/);
  assert.match(await page.evaluate(()=>qoWriter.html),/<h2 id="qo-toc-h-2">/);
  assert.equal(await toc.getAttribute('contenteditable'),'false');
  await toc.locator('a').nth(1).click();
  assert.equal(await page.evaluate(()=>{
   const node=window.getSelection().anchorNode;
   return (node?.nodeType===1?node:node?.parentElement)?.closest('h1,h2,h3')?.textContent;
  }),'Механика');
  await page.evaluate(()=>{
   document.querySelector('#qo-writer-page h2').textContent='Новая механика';
   qoPersistWriter();
  });
  assert.deepEqual(await toc.locator('a').allTextContents(),['Введение','Новая механика','Результаты']);
  await page.evaluate(()=>{
   const editor=document.getElementById('qo-writer-page');
   editor.innerHTML=qoSafeRich(qoWriter.html);
  });
  assert.equal(await toc.locator('a').count(),3);
  await page.locator('[data-action="writer-toc-insert"]').click();
  assert.equal(await toc.count(),1,'second insert refreshes instead of duplicating');
  assert.match(await page.evaluate(()=>qoWriterHTMLDocument()),/data-qo-toc="true"/);
  await page.locator('[data-action="writer-toc-remove"]').click();
  assert.equal(await toc.count(),0);
  assert.equal(await page.locator('#qo-writer-page h2').count(),1);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.deepEqual(errors,[]);
  console.log('PASS TASK138: create, update, navigate, save, HTML export, remove and mobile TOC');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});
