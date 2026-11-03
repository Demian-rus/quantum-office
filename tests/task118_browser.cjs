const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
 const root=path.resolve(__dirname,'..');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1600,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
 await page.evaluate(()=>route('writer'));
 await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
 await page.locator('[data-qd-action="mode"][data-mode="library"]').click();
 assert.equal(await page.locator('.qd-library-card').count(),14);
 assert.match(await page.locator('.qd-library-total').textContent(),/14 шаблонов/);
 await page.locator('#qd-library-subject').selectOption('physics');
 assert.equal(await page.locator('.qd-library-card').count(),5);
 assert.match(await page.locator('.qd-library-card').textContent(),/Электричество и цепи/);
 await page.locator('#qd-library-subject').selectOption('all');
 await page.locator('#qd-library-grade').selectOption('8');
 assert.ok((await page.locator('.qd-library-card').count())>=5);
 await page.locator('#qd-library-grade').selectOption('all');
 const chemistry=page.locator('.qd-library-card[data-template-id="physics8electric"]');
 await chemistry.locator('[data-qd-action="library-preview"]').click();
 const preview=page.locator('.qd-library-preview');
 assert.equal(await preview.count(),1);
 assert.match(await preview.textContent(),/Электризация и ток/);
 const expected=await page.evaluate(()=>qdTemplate('physics8electric').sections.reduce((n,s)=>n+s.questions.length,0));
 assert.equal(expected,15);
 await page.locator('[data-qd-action="library-preview-close"]').click();
 await chemistry.locator('[data-qd-action="library-open"]').click();
 assert.equal(await page.evaluate(()=>qdDoc().sections.reduce((n,s)=>n+s.questions.length,0)),15);
 assert.equal(await page.evaluate(()=>qdDoc().history.length),0);
 await page.locator('[data-qd-action="mode"][data-mode="builder"]').click();
 const selector=page.locator('#qd-template-pick');
 assert.equal(await selector.locator('option').count(),14);
 await selector.selectOption('physics8');
 await page.locator('[data-qd-action="use-template"]').click();
 const expanded=await page.evaluate(()=>({
  count:qdQuestionList().length,
  topics:qdDoc().sections.length,
  automatic:qdQuestionList().filter(q=>['single','multiple','numeric'].includes(q.type)).length
 }));
 assert.ok(expanded.count>=18);
 assert.ok(expanded.topics>=4);
 assert.ok(expanded.automatic>=2);
 await page.setViewportSize({width:390,height:840});
 const width=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
 assert.ok(width[0]<=width[1]+4,'new template selector must not expand mobile page');
 assert.deepEqual(errors,[]);
 console.log('PASS TASK118/TASK122: 14 relevant templates, subject filters, preview, opening, builder selector, rich content and phone');
 await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1);});
