const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
 const root=path.resolve(__dirname,'..');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:2048,height:980},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
 await page.evaluate(()=>route('writer'));
 await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
 await page.locator('[data-qd-action="mode"][data-mode="library"]').click();
 await page.locator('.qd-library-card').filter({hasText:'Молекулы и температура'})
   .locator('[data-qd-action="library-open"]').click();
 await page.locator('[data-qd-action="view"][data-view="focus"]').click();
 const geometry=await page.evaluate(()=>{
   const rect=s=>{const x=document.querySelector(s).getBoundingClientRect();
     return {x:x.x,y:x.y,width:x.width,height:x.height,right:x.right};};
   return {viewport:document.documentElement.clientWidth,overflow:document.documentElement.scrollWidth,
    root:rect('#qo-diag-root'),left:rect('.qd-topic-navigator'),middle:rect('.qd-workbench-main'),
    right:rect('.qd-side-insights'),ribbon:rect('[data-panel-tab="diagnostic"]'),
    tile:rect('[data-action="writer-diag-export"]'),
    card:rect('.qd-guided>.qd-chat-card')};
 });
 console.log('TASK112 desktop geometry',JSON.stringify(geometry));
 assert.ok(geometry.root.width>=geometry.viewport-100,'diagnostic must occupy available viewport width');
 assert.ok(geometry.left.x<=75,'topic panel must occupy real left edge instead of being centered');
 assert.ok(geometry.right.right>=geometry.viewport-75,'statistics must occupy real right edge');
 assert.ok(geometry.middle.width>=700&&geometry.middle.width<=1000,'question column proportional');
 assert.ok(geometry.middle.x-geometry.left.right>=60,'left rail needs breathing room');
 assert.ok(geometry.right.x-geometry.middle.right>=60,'right rail needs breathing room');
 assert.ok(geometry.card.height<250,'single-question card should not reserve huge blank area');
 assert.ok(geometry.ribbon.height>=100,'large tiled ribbon must fit');
 assert.ok(geometry.tile.width>=120&&geometry.tile.height>=37,'file controls must be readable tiles');
 assert.ok(geometry.overflow<=geometry.viewport+3,'no overflow on desktop');
 assert.equal(await page.locator('[data-panel-tab="diagnostic"] .qo-work-btn').count(),6);
 assert.equal(await page.locator('[data-panel-tab="diagnostic"] [data-action^="writer-diag-library"]').count(),0);
 assert.equal(await page.locator('[data-qd-action="mode"]').count(),3,'mode switching only in one toolbar');
 assert.equal(await page.locator('.qd-filebar:visible').count(),0,'duplicate filebar removed');
 const pending=page.waitForEvent('download');
 await page.locator('[data-action="writer-diag-export"]').click();
 const dl=await pending;assert.match(dl.suggestedFilename(),/\.qdiag$/);
 await page.locator('[data-qd-action="mode"][data-mode="library"]').click();
 const pendingLib=page.waitForEvent('download');
 await page.locator('[data-action="writer-diag-templates-export"]').click();
 const lib=await pendingLib;assert.match(lib.suggestedFilename(),/\.qtpl$/);
 // Empty/new requires explicit confirmation and switches to the builder.
 await page.locator('[data-action="writer-diag-new"]').click();
 assert.equal(await page.evaluate(()=>qdQuestionList().length),1);
 assert.equal(await page.locator('[data-qd-action="mode"][data-mode="builder"]').getAttribute('aria-pressed'),'true');
 await page.setViewportSize({width:1150,height:820});
 const mid=await page.evaluate(()=>({
   sidebar:!!document.querySelector('.qd-side-insights')?.getBoundingClientRect().height,
   left:document.querySelector('.qd-topic-navigator').getBoundingClientRect(),
   main:document.querySelector('.qd-workbench-main').getBoundingClientRect(),
   overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
 }));
 assert.ok(mid.sidebar,'middle widths still show statistical panel');
 assert.ok(mid.main.x>=mid.left.right,'central authoring column not overlapping nav');
 assert.ok(mid.overflow<=4);
 await page.setViewportSize({width:390,height:840});
 const phone=await page.evaluate(()=>({
   overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
   nav:document.querySelector('.qd-topic-navigator').getBoundingClientRect().width,
   main:document.querySelector('.qd-workbench-main').getBoundingClientRect().width,
   viewport:document.documentElement.clientWidth
 }));
 assert.ok(phone.overflow<=4,'mobile UI must not grow page horizontally');
 assert.ok(phone.main<=phone.viewport&&phone.nav<=phone.viewport);
 assert.deepEqual(errors,[]);
 console.log('PASS TASK112: edge-anchored balanced layout, larger tiled ribbon, no duplicate controls, file actions, desktop/tablet/mobile');
 await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1);});