/* TASK161: real offline editor + QWORK roundtrip + vector PDF evidence. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'evidence/task161');
const obj=(kind,x,y,x2,y2,label='',extra={})=>({kind,x,y,x2,y2,label,...extra});
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1600,height:1050},offline:true,acceptDownloads:true});
 const page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 page.on('dialog',d=>d.accept());
 const stage=()=>page.locator('#qw-visual-stage svg');
 const at=async(x,y)=>{const box=await stage().boundingBox();return {x:box.x+x/520*box.width,y:box.y+y/320*box.height};};
 const drag=async(x,y,x2,y2)=>{const a=await at(x,y),b=await at(x2,y2);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();};
 const tool=kind=>page.locator('.qw-visual-diagram [data-tool="'+kind+'"]').click();
 try{
  await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  await page.evaluate(()=>route('writer'));
  await page.locator('[data-editor="writer"][data-tab="work"]').click();
  await page.locator('[data-qw-action="quick-add"][data-type="diagram"]').click();
  await page.locator('#qw-prompt').fill('Исследуйте электрическую цепь.');
  await page.locator('[data-qw-action="diagram"]').click();
  await page.locator('#qw-snap-geometry').uncheck();
  for(const kind of ['resistor','rheostat','cell','battery','lamp','switchOpen','switchClosed','ammeter','voltmeter','wireOrth','junction',
    'forceVector','velocityVector','accelerationVector','torque','dynamometer','weightSet']){
   assert.equal(await page.locator('.qw-visual-diagram [data-tool="'+kind+'"]').count(),1,kind);
  }
  await tool('resistor');await drag(70,105,200,153);
  assert.equal(await stage().locator('[data-qw-object="0"] rect').count(),1);
  await page.locator('#qw-object-label').fill('R₁');
  await page.locator('#qw-object-label').press('Tab');
  await page.locator('#qw-visual-copy').click();
  assert.equal(await stage().locator('[data-qw-object]').count(),2);
  await page.locator('#qw-visual-undo').click();
  assert.equal(await stage().locator('[data-qw-object]').count(),1);
  await page.locator('#qw-visual-redo').click();
  assert.equal(await stage().locator('[data-qw-object]').count(),2);
  await tool('battery');await drag(250,105,365,153);
  assert.equal(await stage().locator('[data-qw-object]').count(),3);
  await page.locator('#qw-block-rotation').fill('90');
  await page.locator('#qw-block-rotation').press('Tab');
  assert.match(await stage().locator('[data-qw-object="2"]').getAttribute('transform'),/rotate\(90/);
  // Draw a wire directly between the rendered contact handles, not by
  // manually inserting links into the editor's state.
  const port1=await stage().locator('[data-qw-object="0"] [data-qw-port="R"]').boundingBox();
  const port2=await stage().locator('[data-qw-object="2"] [data-qw-port="L"]').boundingBox();
  assert.ok(port1&&port2);
  await tool('wireOrth');
  await page.mouse.move(port1.x+port1.width/2,port1.y+port1.height/2);
  await page.mouse.down();
  await page.mouse.move(port2.x+port2.width/2,port2.y+port2.height/2,{steps:15});
  await page.mouse.up();
  assert.equal(await stage().locator('[data-qw-object]').count(),4);
  await page.screenshot({path:path.join(dir,'editor-circuit-tools.png')});
  await page.locator('[data-qw-action="visual-apply"]').click();
  const edited=await page.evaluate(()=>structuredClone(qwCurrent().diagram));
  assert.equal(edited.length,4);
  assert.equal(edited[3].kind,'wireOrth');
  assert.equal(edited[3].links?.start?.id,edited[0].id);
  assert.equal(edited[3].links?.end?.id,edited[2].id);
  const qwork=await page.evaluate(()=>{
   const d=qwProject();d.subject='physics';d.grade='11';d.exam='ege';
   d.title='Редактируемые физические и электрические схемы — TASK161';
   d.topic='Схемы для физических задач';d.variant='1';d.layout='booklet';
   d.printSettings={orientation:'portrait',fontPt:10,theme:'academic',showMeta:false,figurePosition:'below'};
   const item=(name,diagram)=>{
    const q=qwTask('diagram');q.prompt=name;q.figure='diagram';q.position='below';q.figureWidth=440;
    q.answerVisible=false;q.solutionVisible=false;q.diagram=qwValidateDiagram(diagram);
    return q;
   };
   const O=(kind,x,y,x2,y2,label='',extra={})=>({kind,x,y,x2,y2,label,...extra});
   const W=(id,from,to,position={})=>O('wireOrth',from.x,from.y,to.x,to.y,'',{id,...position});
   d.tasks=[
    item('1. Тело на наклонной плоскости. Определите направления сил.',[
     O('incline',95,100,440,255),O('block',225,138,310,188,'m',{rotation:-24}),
     O('forceVector',270,170,270,75,'N'),O('forceVector',270,170,270,260,'mg'),O('velocityVector',270,170,390,112,'v')]),
    item('2. Грузы и подвижный блок. Сравните натяжения нитей.',[
     O('fixedPulley',160,70,235,145),O('movablePulley',285,137,360,212),
     O('rope',197,80,197,240),O('rope',323,78,323,208),
     O('weightSet',86,206,245,297,'m₁, m₂',{count:2})]),
    item('3. Динамометр с подвешенными грузами. Найдите показание.',[
     O('dynamometer',205,24,304,208,'',{reading:47}),
     O('rope',254,208,254,234),O('weightSet',198,229,315,307,'',{count:2})]),
    item('4. Плечо силы и момент силы относительно опоры.',[
     O('line',70,210,442,210),O('point',255,210,255,210,'O'),
     O('forceVector',383,210,383,86,'F'),O('torque',190,84,310,200,'M',{direction:'cw'})]),
    item('5. Последовательная цепь: батарея, лампа, выключатель.',[
     O('battery',65,111,158,175,'ε',{id:'bat'}),
     O('lamp',238,111,326,175,'L',{id:'lamp'}),
     O('switchClosed',361,111,470,175,'K',{id:'sw'}),
     O('wireOrth',0,0,0,0,'',{id:'w1',links:{start:{id:'bat',port:'R'},end:{id:'lamp',port:'L'}}}),
     O('wireOrth',0,0,0,0,'',{id:'w2',links:{start:{id:'lamp',port:'R'},end:{id:'sw',port:'L'}}}),
     O('wireOrth',110,217,420,245)]),
    item('6. Измерение силы тока амперметром.',[
     O('cell',55,120,155,180,'',{id:'cell'}),
     O('ammeter',204,120,294,180,'',{id:'amp'}),
     O('resistor',350,120,461,180,'R',{id:'load'}),
     O('wireOrth',0,0,0,0,'',{links:{start:{id:'cell',port:'R'},end:{id:'amp',port:'L'}}}),
     O('wireOrth',0,0,0,0,'',{links:{start:{id:'amp',port:'R'},end:{id:'load',port:'L'}}})]),
    item('7. Параллельное соединение резисторов.',[
     O('junction',85,75,85,75,'',{id:'j1'}),O('junction',435,75,435,75,'',{id:'j2'}),
     O('junction',85,246,85,246,'',{id:'j3'}),O('junction',435,246,435,246,'',{id:'j4'}),
     O('resistor',197,75,312,135,'R₁',{id:'r1'}),
     O('resistor',197,215,312,275,'R₂',{id:'r2'}),
     W('p1',{x:85,y:75},{x:197,y:105}),W('p2',{x:312,y:105},{x:435,y:75}),
     W('p3',{x:85,y:246},{x:197,y:245}),W('p4',{x:312,y:245},{x:435,y:246}),
     W('p5',{x:85,y:75},{x:85,y:246}),W('p6',{x:435,y:75},{x:435,y:246})]),
    item('8. Вольтметр параллельно сопротивлению.',[
     O('cell',75,60,172,120,'',{id:'src'}),O('resistor',236,60,357,120,'R',{id:'r'}),
     O('voltmeter',242,214,347,281,'',{id:'voltm'}),
     W('a',{x:172,y:90},{x:236,y:90}),
     W('b',{x:275,y:90},{x:242,y:250}),
     W('c',{x:347,y:250},{x:345,y:90})]),
    item('9. Реостат и разомкнутый ключ в цепи.',[
     O('battery',60,121,154,183,'',{id:'bat2'}),
     O('rheostat',195,121,328,183,'R',{id:'rh'}),
     O('switchOpen',366,121,469,183,'K',{id:'open'}),
     O('wireOrth',0,0,0,0,'',{links:{start:{id:'bat2',port:'R'},end:{id:'rh',port:'L'}}}),
     O('wireOrth',0,0,0,0,'',{links:{start:{id:'rh',port:'R'},end:{id:'open',port:'L'}}})])
   ];
   return qwValidate(d);
  });
  assert.equal(qwork.tasks.length,9);
  fs.writeFileSync(path.join(dir,'TASK161_schemes.qwork'),JSON.stringify(qwork,null,2));
  const printHtml=await page.evaluate(d=>qwPrintDocumentHTML(d,false,{format:'booklet'}),qwork);
  const print=await context.newPage();print.on('pageerror',e=>errors.push(e.message));
  await print.setContent(printHtml);await print.evaluate(()=>window.qwPrintReady);
  const state=await print.evaluate(()=>{
   const sections=[...document.querySelectorAll('.qw-print-section')];
   return {error:window.__qwPrintError||null,tasks:sections.map(e=>Number(e.dataset.task)),pages:window.__qwPrintLayout.pages.length,
    svgCount:sections.filter(s=>s.querySelector('figure svg')).length,
    brokenLinks:sections.filter(s=>s.querySelector('figure svg')?.outerHTML.includes('NaN')).length};
  });
  assert.equal(state.error,null);
  assert.deepEqual([...new Set(state.tasks)],Array.from({length:9},(_,i)=>i+1));
  assert.equal(state.svgCount,9);assert.equal(state.brokenLinks,0);
  await print.emulateMedia({media:'print'});
  await print.pdf({path:path.join(dir,'TASK161_schemes.pdf'),preferCSSPageSize:true,printBackground:true});
  await print.screenshot({path:path.join(dir,'TASK161_print.png'),fullPage:true});
  assert.ok(fs.statSync(path.join(dir,'TASK161_schemes.pdf')).size>12000);
  await print.close();
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({status:'PASS',offline:true,roundtrip:true,editor:true,schemes:9,printed:state,errors,requests},null,2));
  console.log('PASS TASK161: 17 tools, editor duplicate/undo/redo/rotation, nine printable editable schemes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
