/* TASK149: desktop toolbar organization, axis label bounds and Ctrl+Z. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task149');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const errors=[],page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept('A'));
 try{
  await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  await page.evaluate(()=>route('writer'));
  await page.locator('[data-editor="writer"][data-tab="work"]').click();
  await page.locator('#qw-add-type').selectOption('graph');
  await page.locator('.qw-left [data-qw-action="add"]').click();
  await page.locator('[data-qw-action="graph"]').click();
  assert.equal(await page.locator('.qw-drawing-group [data-tool]').count(),9);
  assert.equal(await page.locator('.qw-graph-range [data-graph-field]').count(),4);
  assert.equal(await page.locator('.qw-graph-flags input').count(),4);
  assert.equal(await page.locator('#qw-coordinate-mode').inputValue(),'first');
  const left=await page.locator('#qw-visual-tools').boundingBox();
  assert.ok(left.width>=230,'graph toolbar has desktop width');
  assert.ok(await page.locator('#qw-coordinate-mode').evaluate(e=>e.scrollWidth<=e.clientWidth+2),'coordinate mode text does not overflow');
  const labels=async()=>page.locator('#qw-visual-stage svg text.qw-axis-number').evaluateAll(es=>es.map(e=>{
   const b=e.getBBox();return {axis:e.dataset.axis,value:e.dataset.value,box:{x:b.x,y:b.y,w:b.width,h:b.height}};
  }));
  for(const [mode,name] of [['first','first'],['positiveX','positive'],['math','math']]){
   await page.locator('#qw-coordinate-mode').selectOption(mode);
   assert.equal(await page.locator('#qw-coordinate-mode').inputValue(),mode);
   const items=await labels();
   assert.equal(items.filter(x=>x.value==='0').length,1);
   for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
    const a=items[i].box,b=items[j].box;
    const overlap=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
    assert.ok(overlap<.5,'overlapping axis numbers '+name+': '+items[i].value+'/'+items[j].value);
   }
   await page.screenshot({path:path.join(out,'graph-'+name+'.png')});
  }
  await page.locator('#qw-coordinate-mode').selectOption('custom');
  assert.equal(await page.locator('#qw-coordinate-mode').inputValue(),'custom');
  await page.locator('[data-graph-field="xmin"]').fill('-12');
  await page.locator('[data-graph-field="xmin"]').dispatchEvent('change');
  assert.equal(await page.locator('#qw-coordinate-mode').inputValue(),'custom');
  await page.locator('[data-tool="line"]').click();
  const stage=page.locator('#qw-visual-stage svg'),b=await stage.boundingBox();
  const at=(x,y)=>({x:b.x+b.width*x/520,y:b.y+b.height*y/320});
  const from=at(180,110),to=at(310,180);
  await page.mouse.move(from.x,from.y);await page.mouse.down();
  await page.mouse.move(to.x,to.y,{steps:5});await page.mouse.up();
  assert.equal(await stage.locator('[data-qw-element]').count(),1);
  await page.locator('[data-tool="select"]').click();
  await page.keyboard.press('Control+z');
  assert.equal(await stage.locator('[data-qw-element]').count(),0,'Ctrl+Z works with focus on toolbar button');
  await page.locator('[data-qw-action="visual-apply"]').click();
  await page.locator('[data-qw-action="diagram"]').click();
  const grid=await page.locator('.qw-visual-tools .qw-tool-group:first-of-type>div').evaluate(e=>getComputedStyle(e).gridTemplateColumns);
  assert.equal(grid.trim().split(/\s+/).length,2,'diagram tools use two columns');
  await page.screenshot({path:path.join(out,'diagram-two-columns.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS TASK149: desktop layout, mathematical tick typography, persisted mode and Ctrl+Z');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
