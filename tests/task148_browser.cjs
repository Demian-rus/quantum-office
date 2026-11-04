/* TASK148: user input only for editing; read model solely to verify persisted results. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task148');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const p=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept('A'));
 try{
  await p.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  await p.evaluate(()=>route('writer'));await p.locator('[data-editor="writer"][data-tab="work"]').click();
  await p.locator('#qw-add-type').selectOption('diagram');await p.locator('.qw-left [data-qw-action="add"]').click();
  await p.locator('#qw-prompt').fill('TASK148: физические и математические иллюстрации');
  await p.locator('[data-qw-action="diagram"]').click();
  const stage=p.locator('#qw-visual-stage svg'),count=()=>stage.locator('[data-qw-object]').count();
  const at=async(x,y)=>{const b=await stage.boundingBox();return {x:b.x+b.width*x/520,y:b.y+b.height*y/320};};
  const click=async(x,y)=>{const a=await at(x,y);await p.mouse.click(a.x,a.y);};
  const drag=async(x,y,x2,y2)=>{const a=await at(x,y),b=await at(x2,y2);await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(b.x,b.y,{steps:5});await p.mouse.up();};
  for(const snap of [true,false]){
   await p.locator('#qw-snap-geometry').setChecked(snap);await p.locator('[data-tool="line"]').click();
   for(let i=0;i<20;i++)await click(120+i*3,80+i);
   assert.equal(await count(),0,'20 clicks do not add lines');assert.equal(await p.locator('#qw-visual-undo').isDisabled(),true);
  }
  for(const [width,height] of [[1366,768],[1093,614],[1280,720]]){
   await p.setViewportSize({width,height});for(let i=0;i<20;i++)await click(130+i*2,90);assert.equal(await count(),0);assert.equal(await p.locator('#qw-visual-undo').isDisabled(),true);
  }
  await p.setViewportSize({width:1440,height:900});
  for(const key of ['arrow','rope','dashed','spring','rect','circle','triangle','block','pulley','movablePulley']){await p.locator('[data-tool="'+key+'"]').click();await click(160,100);assert.equal(await count(),0,key+' click is not a construction');}
  await p.locator('[data-tool="line"]').click();
  await drag(70,70,160,170);assert.equal(await count(),1);
  await p.locator('#qw-visual-undo').click();assert.equal(await count(),0);
  const start=await at(60,60),end=await at(160,100);await p.mouse.move(start.x,start.y);await p.mouse.down();await p.mouse.move(end.x,end.y);
  await p.locator('#qw-visual-stage').dispatchEvent('pointercancel');await p.mouse.up();assert.equal(await count(),0);
  await p.mouse.move(start.x,start.y);await p.mouse.down();await p.mouse.move(end.x,end.y);await p.locator('#qw-visual-stage').evaluate(e=>e.releasePointerCapture(1));await p.mouse.up();assert.equal(await count(),0,'lost capture rolls back the draft');
  await p.locator('[data-tool="incline"]').click();await drag(60,60,450,280);
  await p.locator('[data-tool="block"]').click();await drag(170,90,250,140);
  await p.locator('[data-tool="select"]').click();await click(200,115);
  assert.equal(await stage.locator('[data-qw-object="1"]').evaluate(e=>e.classList.contains('qw-visual-selected')),true,'block is selected on incline');
  await drag(200,115,220,125);assert.ok(Math.abs(Number(await stage.locator('[data-qw-object="1"] rect').getAttribute('x'))-190)<.01);
  await click(80,70);assert.equal(await p.locator('#qw-visual-delete').isDisabled(),true,'empty triangular region is empty');
  await p.locator('[data-object-select="1"]').click();
  await p.locator('#qw-block-rotation').fill('-30');await p.locator('#qw-block-rotation').dispatchEvent('change');
  assert.match(await stage.locator('[data-qw-object="1"]').getAttribute('transform'),/rotate\(-30 /);
  await p.locator('#qw-align-block').click();
  const angle=Number(await p.locator('#qw-block-rotation').inputValue());assert.ok(angle<0&&angle> -40);
  await p.locator('[data-style-key="stroke"][data-style-color="#dc2626"]').click();
  assert.equal(await stage.locator('[data-qw-object="1"] rect').getAttribute('stroke'),'#dc2626');
  await p.locator('#qw-visual-stage').focus();await p.keyboard.press('Control+a');
  assert.equal(await stage.locator('.qw-visual-selected').count(),2);
  await p.locator('[data-style-key="stroke"][data-style-color="#2563eb"]').click();
  assert.equal(await stage.locator('[data-qw-object="0"] polygon').getAttribute('stroke'),'#2563eb');
  await p.locator('#qw-visual-undo').click();
  assert.equal(await stage.locator('[data-qw-object="1"] rect').getAttribute('stroke'),'#dc2626');
  await p.locator('#qw-visual-stage').focus();await p.keyboard.press('Control+a');await p.keyboard.press('Delete');assert.equal(await count(),0);
  await p.locator('#qw-visual-undo').click();assert.equal(await count(),2);
  await p.locator('[data-tool="line"]').click();await drag(60,200,440,200);await drag(250,80,250,280);
  await p.locator('[data-tool="select"]').click();await click(250,200);
  assert.equal(await stage.locator('[data-qw-object="3"]').evaluate(e=>e.classList.contains('qw-visual-selected')),true,'upper of crossing lines is selected by the mouse');
  await p.locator('[data-layer="back"]').click();await click(250,200);
  assert.equal(await stage.locator('[data-qw-object="3"]').evaluate(e=>e.classList.contains('qw-visual-selected')),true,'layer order changes the visible selection');
  await p.locator('[data-tool="point"]').click();await click(250,200);await p.locator('[data-tool="select"]').click();await click(250,200);
  assert.equal(await stage.locator('[data-qw-object="4"]').evaluate(e=>e.classList.contains('qw-visual-selected')),true,'small foreground point remains selectable');
  assert.deepEqual(errors,[]);await p.screenshot({path:path.join(out,'stage-a.png')});console.log('TASK148 stage A PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
