/* TASK152: offline Chromium acceptance of real editable geometric tools. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task152');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true}),ctx=await browser.newContext({viewport:{width:1440,height:900},offline:true,acceptDownloads:true});
 const page=await ctx.newPage(),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});page.on('dialog',d=>d.accept());
 await page.addInitScript(()=>{window.print=function(){window.top.__task152Print=document.documentElement.outerHTML;window.dispatchEvent(new Event('afterprint'));};});
 const action=k=>page.locator('[data-qw-action="'+k+'"]'),stage=()=>page.locator('#qw-visual-stage svg');
 async function at(x,y){const b=await stage().boundingBox();return {x:b.x+b.width*x/520,y:b.y+b.height*y/320};}
 async function click(x,y){const a=await at(x,y);await page.mouse.click(a.x,a.y);}
 async function drag(x,y,x2,y2){const a=await at(x,y),b=await at(x2,y2);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:10});await page.mouse.up();}
 async function tool(t){await page.locator('.qw-visual-diagram [data-tool="'+t+'"]').click();}
 function closeEnough(a,b){assert.ok(Math.abs(a-b)<.1,a+' ≠ '+b);}
 try{
  await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  await page.evaluate(()=>route('writer'));
  await page.locator('[data-editor="writer"][data-tab="work"]').click();
  await page.locator('[data-qw-action="quick-add"][data-type="diagram"]').click();
  await page.locator('#qw-prompt').fill('Постройте схему: эллипс, правильный многоугольник и зависимые геометрические построения.');
  await action('diagram').click();await page.locator('#qw-snap-geometry').uncheck();
  for(const k of ['ellipse','regularPolygon','midpoint','angleBisector','perpendicularBisector'])
   assert.equal(await page.locator('[data-tool="'+k+'"]').count(),1,'tool '+k);
  await tool('ellipse');await drag(65,40,185,100);
  assert.equal(await stage().locator('[data-qw-object="0"] ellipse').count(),1);
  await page.locator('[data-diagram-field="x2"]').fill('205');await page.locator('[data-diagram-field="x2"]').press('Tab');
  assert.equal(await stage().locator('[data-qw-object="0"] ellipse').getAttribute('rx'),'70');
  await tool('regularPolygon');await drag(260,40,400,180);
  assert.equal(await stage().locator('[data-qw-object="1"] polygon').count(),1);
  await page.locator('[data-polygon-sides]').selectOption('7');
  assert.equal((await stage().locator('[data-qw-object="1"] polygon').getAttribute('points')).trim().split(/\s+/).length,7);
  await tool('select');await drag(320,100,340,115);
  assert.equal(await page.locator('[data-object-select="1"]').getAttribute('aria-pressed'),'true');
  await page.locator('#qw-visual-undo').click();
  await page.screenshot({path:path.join(out,'geometry-desktop.png')});
  await tool('line');await drag(70,240,230,240);
  await tool('midpoint');await click(120,240);
  await tool('perpendicularBisector');await click(100,240);
  assert.equal(await stage().locator('[data-qw-object="3"] circle').count(),1);
  const mid=async()=>stage().locator('[data-qw-object="3"] circle').evaluate(e=>({x:+e.getAttribute('cx'),y:+e.getAttribute('cy')}));
  const m0=await mid();closeEnough(m0.x,150);closeEnough(m0.y,240);
  await tool('angle');await drag(300,220,420,290);
  await tool('angleBisector');await click(355,220);
  assert.equal(await stage().locator('[data-qw-object="6"] [data-qw-extended="ray"]').count(),1);
  await tool('select');await drag(90,240,100,270);
  const m1=await mid();closeEnough(m1.x,160);closeEnough(m1.y,270);
  await page.locator('#qw-visual-undo').click();
  const m2=await mid();closeEnough(m2.x,150);closeEnough(m2.y,240);
  const savedGeometry=await stage().locator('[data-qw-object]').count();assert.equal(savedGeometry,7);
  await page.setViewportSize({width:830,height:680});await page.locator('[data-visual-panel="tools"]').click();
  assert.equal(await page.locator('.qw-visual-diagram').getAttribute('data-panel'),'tools');
  await page.screenshot({path:path.join(out,'geometry-narrow.png')});
  await page.setViewportSize({width:1440,height:900});
  await action('visual-apply').click();
  const before=await page.evaluate(()=>structuredClone(qwCurrent().diagram));
  assert.equal(before.length,7);
  assert.equal(before[1].sides,7);
  assert.equal(before[3].construction.reference,before[2].id);
  assert.equal(before[4].construction.reference,before[2].id);
  assert.equal(before[6].construction.reference,before[5].id);
  // Project-wide undo/redo also covers the complete visual editor transaction.
  await action('undo').click();assert.equal(await page.evaluate(()=>qwCurrent().diagram.length),0);
  await action('redo').click();assert.deepEqual(await page.evaluate(()=>structuredClone(qwCurrent().diagram)),before);
  const download=page.waitForEvent('download');await action('save').click();
  const file=path.join(out,'task152.qwork');await(await download).saveAs(file);
  assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')).tasks[0].diagram,before);
  await page.locator('[data-action="work-new"]').click();await page.locator('#qw-file').setInputFiles(file);
  await page.waitForFunction(()=>qwDoc.tasks.length===1&&qwDoc.tasks[0].diagram.length===7);
  assert.deepEqual(await page.evaluate(()=>structuredClone(qwCurrent().diagram)),before);
  await page.locator('.qw-center-head [data-qw-action="preview"]').click();
  await page.locator('[data-qw-action="preview-pdf"]:enabled').waitFor();
  const frame=await(await page.locator('#qw-print-preview-frame').elementHandle()).contentFrame();
  await frame.evaluate(()=>window.qwPrintReady);
  assert.equal(await frame.evaluate(()=>window.__qwPrintError),undefined);
  const printable=await frame.locator('figure svg').first().evaluate(e=>e.outerHTML);
  assert.match(printable,/<ellipse/);
  assert.match(printable,/<polygon/);
  assert.match(printable,/data-qw-extended="ray"/);
  fs.writeFileSync(path.join(out,'print-figure.svg'),printable);
  await action('preview-pdf').click();await page.waitForFunction(()=>!!window.__task152Print);
  const printHTML=await page.evaluate(()=>window.__task152Print);
  const printPage=await ctx.newPage();await printPage.setContent(printHTML);await printPage.evaluate(()=>window.qwPrintReady);
  await printPage.emulateMedia({media:'print'});
  const pdf=path.join(out,'task152.pdf');await printPage.pdf({path:pdf,preferCSSPageSize:true,printBackground:true});
  assert.ok(fs.statSync(pdf).size>2000);await printPage.close();
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',objects:7,offline:true,undoRedo:true,qworkRoundtrip:true,svg:true,pdfBytes:fs.statSync(pdf).size,errors,network},null,2));
  console.log('PASS TASK152 offline: create, resize, drag, dependent geometry, undo/redo, QWORK, SVG, native PDF, narrow UI');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
