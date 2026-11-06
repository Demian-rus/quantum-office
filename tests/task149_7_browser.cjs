/* TASK149.7: real pointer coverage for the bounds used by marquee and movement. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task149.7');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true}),p=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true}),errors=[],checks=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 const action=k=>p.locator('[data-qw-action="'+k+'"]'),stage=p.locator('#qw-visual-stage svg');
 const tool=k=>p.locator('[data-tool="'+k+'"]').click();
 async function drag(x,y,x2,y2){const b=await stage.boundingBox(),at=(x,y)=>({x:b.x+x*b.width/520,y:b.y+y*b.height/320}),a=at(x,y),z=at(x2,y2);await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(z.x,z.y,{steps:8});await p.mouse.up();}
 const selected=()=>stage.locator('.qw-visual-selected[data-qw-object]').evaluateAll(es=>es.map(e=>+e.dataset.qwObject));
 const geometry=()=>stage.locator('[data-qw-extended]').evaluateAll(es=>es.map(e=>Object.fromEntries(['x1','y1','x2','y2'].map(k=>[k,+e.getAttribute(k)]))));
 try{
  await p.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);await p.evaluate(()=>route('writer'));await p.locator('[data-editor="writer"][data-tab="work"]').click();
  for(const kind of ['ray','infiniteLine']){
   await p.locator('[data-action="work-new"]').click();await p.locator('[data-qw-action="quick-add"][data-type="diagram"]').click();await action('diagram').click();await p.locator('#qw-snap-geometry').uncheck();
   await tool(kind);await drag(160,120,260,120);await tool('select');
   const line=(await geometry())[0];
   // Containment semantics: enclosing the whole visible segment selects it.
   await drag(2,90,518,150);assert.deepEqual(await selected(),[0],kind+' visible segment must be selected');
   await p.keyboard.press('Escape');
   // The anchor is not the bounds of the extended visible geometry.
   await drag(140,100,180,140);assert.deepEqual(await selected(),[],kind+' anchor-only box must not select the whole line');
   await p.keyboard.press('Escape');
   // A small box intersecting only the middle is not full containment either.
   await drag(300,100,350,140);assert.deepEqual(await selected(),[]);
   await tool('rect');await drag(220,170,280,210);await tool('select');await drag(2,90,518,230);assert.deepEqual(await selected(),[0,1]);
   await drag(300,120,310,140);const moved=(await geometry())[0];assert.ok(Math.abs(moved.y1-line.y1-20)<.01,kind+' group movement is not pinned by clipped bounds');
   await p.locator('#qw-visual-undo').click();assert.deepEqual((await geometry())[0],line);await action('visual-apply').click();
   const before=await p.evaluate(()=>structuredClone(qwCurrent().diagram));await action('diagram').click();await p.locator('#qw-snap-geometry').uncheck();await tool('select');await drag(2,90,518,230);await drag(300,120,310,140);await action('visual-apply').click();
   const after=await p.evaluate(()=>structuredClone(qwCurrent().diagram));for(let i=0;i<2;i++){assert.ok(Math.abs(after[i].x-before[i].x-10)<.01);assert.ok(Math.abs(after[i].y-before[i].y-20)<.01);}
   await action('undo').click();assert.deepEqual(await p.evaluate(()=>qwCurrent().diagram),before);await action('redo').click();assert.deepEqual(await p.evaluate(()=>qwCurrent().diagram),after);
   checks.push({kind,visibleContainment:true,anchorOnlyExcluded:true,groupMove:true,undoRedo:true});
  }
  // A real support line, then linked parallel and perpendicular, edit and Undo.
  await p.locator('[data-action="work-new"]').click();await p.locator('[data-qw-action="quick-add"][data-type="diagram"]').click();await action('diagram').click();await p.locator('#qw-snap-geometry').uncheck();
  await tool('line');await drag(100,100,300,140);await tool('parallel');
  const b=await stage.boundingBox();await p.mouse.click(b.x+120*b.width/520,b.y+220*b.height/320);
  await tool('select');await p.locator('[data-object-select="0"]').click();await tool('perpendicular');await p.mouse.click(b.x+350*b.width/520,b.y+200*b.height/320);
  const prior=await geometry();await p.locator('[data-object-select="0"]').click();await p.locator('[data-diagram-field="y2"]').fill('180');await p.locator('[data-diagram-field="y2"]').press('Tab');
  const linked=await geometry(),u={x:200,y:80};assert.ok(Math.abs(u.x*(linked[0].y2-linked[0].y1)-u.y*(linked[0].x2-linked[0].x1))<.01);assert.ok(Math.abs(u.x*(linked[1].x2-linked[1].x1)+u.y*(linked[1].y2-linked[1].y1))<.01);
  await p.locator('#qw-visual-undo').click();assert.deepEqual(await geometry(),prior);await action('visual-apply').click();
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'marquee-result.json'),JSON.stringify({status:'PASS',checks,linkedEdit:true,errors},null,2));
  console.log('PASS TASK149.7: visible line containment, anchor-only exclusion, group movement, Undo/Redo, linked direction edit');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
