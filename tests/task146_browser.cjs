/* TASK146: verify fixed dialog geometry and legible mathematical drawings in Chromium. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task146');
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:720},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  await page.evaluate(()=>route('writer'));await page.locator('[data-editor="writer"][data-tab="work"]').click();
  const action=k=>page.locator('[data-qw-action="'+k+'"]');
  await page.locator('#qw-add-type').selectOption('diagram');
  await page.locator('.qw-left [data-qw-action="add"]').click();
  await page.locator('#qw-prompt').fill('В треугольнике ABC определите неизвестную сторону и проведите высоту.');
  await action('diagram').click();
  const modal=page.locator('#qw-dialog'),stage=page.locator('#qw-visual-stage svg');
  assert.equal(await modal.evaluate(x=>x.classList.contains('qw-visual-dialog')),true);
  const before=await modal.boundingBox(),stageBefore=await stage.boundingBox();
  const snap=page.locator('.qw-visual-canvas-footer #qw-snap-geometry');
  assert.equal(await snap.count(),1);
  assert.equal(await page.locator('.qw-visual-tools #qw-snap-geometry').count(),0);
  await page.locator('#qw-grid-step-geometry').selectOption('10');
  assert.match(await stage.locator('#qw-geometry-guide').getAttribute('width'),/^10$/);
  await page.locator('[data-tool="triangle"]').click();
  const b=await stage.boundingBox();
  await page.mouse.move(b.x+b.width*.23,b.y+b.height*.22);
  await page.mouse.down();await page.mouse.move(b.x+b.width*.74,b.y+b.height*.76,{steps:4});await page.mouse.up();
  assert.equal(await stage.locator('polygon').count(),1);
  await page.locator('[data-tool="select"]').click();
  const v=await stage.locator('[data-qw-vertex="0"]').boundingBox();
  const previous=await page.locator('[data-vertex-index="0"][data-vertex-field="x"]').inputValue();
  await page.mouse.move(v.x+v.width/2,v.y+v.height/2);await page.mouse.down();
  await page.mouse.move(v.x+v.width/2+36,v.y+v.height/2+11,{steps:4});await page.mouse.up();
  const current=await page.locator('[data-vertex-index="0"][data-vertex-field="x"]').inputValue();
  assert.notEqual(current,previous,'vertex drag must persist rather than reset on pointerup');
  await page.locator('[data-construction="median"]').click();
  assert.equal(await stage.locator('[data-qw-object]').count(),2);
  await page.locator('[data-object-select="0"]').click();
  await page.locator('[data-construction="altitude"]').click();
  assert.equal(await stage.locator('[data-qw-object]').count(),3);
  await page.screenshot({path:path.join(out,'geometry_labels.png')});
  await page.locator('[data-tool="line"]').click();
  for(let i=0;i<54;i++){
   const b=await stage.boundingBox(),x=b.x+b.width*(.08+(i%11)*.074),y=b.y+b.height*(.18+Math.floor(i/11)*.12);
   await page.mouse.move(x,y);await page.mouse.down();
   await page.mouse.move(x+b.width*.025,y+b.height*.04,{steps:2});await page.mouse.up();
  }
  const after=await modal.boundingBox(),stageAfter=await stage.boundingBox();
  assert.ok(Math.abs(after.height-before.height)<2,'modal must not grow with object list');
  assert.ok(Math.abs(after.y-before.y)<2,'modal must not jump vertically');
  assert.ok(Math.abs(stageAfter.y-stageBefore.y)<2,'canvas must stay in place');
  const scroll=await page.locator('#qw-visual-properties').evaluate(x=>({
    height:x.clientHeight,content:x.scrollHeight,overflow:getComputedStyle(x).overflowY
  }));
  assert.ok(scroll.content>scroll.height+5,'inspector should scroll independently after adding objects');
  assert.equal(scroll.overflow,'auto');
  await page.locator('#qw-visual-properties').evaluate(x=>x.scrollTop=x.scrollHeight);
  await page.screenshot({path:path.join(out,'fixed_dialog_many_objects.png')});
  await action('visual-apply').click();
  await page.locator('#qw-add-type').selectOption('graph');
  await page.locator('.qw-left [data-qw-action="add"]').click();
  await page.locator('#qw-prompt').fill('Определите значение скорости по графику.');
  await action('graph').click();
  const svg=await stage.evaluate(x=>x.outerHTML);
  const yLabels=[...svg.matchAll(/<text class="qw-axis-number" data-axis="y" data-value="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(yLabels,['1','2','3','4','5','6','7','8','9','10']);
  assert.equal((svg.match(/data-value="0"/g)||[]).length,1,'axis zero is printed only once');
  await page.screenshot({path:path.join(out,'graph_axis_ticks.png')});
  await action('visual-apply').click();
  await page.setViewportSize({width:390,height:844});
  await action('diagram').click();
  const mobile=await modal.boundingBox();
  assert.ok(mobile.y>=0&&mobile.y+mobile.height<=844+2);
  assert.ok(mobile.width<=390);
  await page.screenshot({path:path.join(out,'mobile_dialog.png')});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',before,after,scroll,yLabels,errors},null,2));
  console.log('PASS TASK146: fixed modal, independent inspector, geometry captions, 10px snap, persistent vertex drag, graph ticks and mobile sizing');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
