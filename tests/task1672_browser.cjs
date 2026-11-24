/* TASK167.2: real offline UI, local bank copy, print geometry and QWORK roundtrip. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task1672');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({acceptDownloads:true,offline:true,viewport:{width:1440,height:900}});
 const p=await context.newPage(),errors=[],report=[];
 p.on('pageerror',e=>errors.push(String(e)));p.on('dialog',d=>d.accept());
 const route=async target=>{await p.locator('.global-bar .modules [data-target="'+target+'"]').click();};
 const snapshot=()=>p.evaluate(()=>JSON.stringify(qwDoc));
 const ready=()=>p.waitForFunction(()=>{const f=document.querySelector('#qw-print-preview-frame');return f?.dataset.ready&&f.dataset.ready===f.contentDocument?.documentElement.dataset.qwRender&&f.contentWindow?.__qwPrintLayout&&!f.contentWindow.__qwPrintError;});
 const revision=()=>p.locator('#qw-print-preview-frame').getAttribute('data-ready');
 async function changed(action){const previous=await revision();await action();await p.waitForFunction(old=>{const f=document.querySelector('#qw-print-preview-frame');return f?.dataset.ready&&f.dataset.ready!==old&&f.dataset.ready===f.contentDocument?.documentElement.dataset.qwRender&&!f.contentWindow?.__qwPrintError;},previous);await ready();}
 const widthControl=p.locator('#qw-layout-figure-width'),mode=p.locator('#qw-layout-figure-mode'),tasks=p.locator('#qw-layout-figure-task');
 const format=p.locator('select[name="qw-pdf-layout"]'),orientation=p.locator('[data-print-setting="orientation"]');
 const bounds=()=>p.evaluate(()=>[...document.querySelector('#qw-print-preview-frame').contentDocument.querySelectorAll('.qw-print-section figure')].map(f=>{const b=f.getBoundingClientRect(),flow=f.closest('.qw-task-flow').getBoundingClientRect();return {task:Number(f.closest('[data-task]').dataset.task),w:b.width,h:b.height,within:b.left>=flow.left-1&&b.right<=flow.right+1,mode:f.dataset.widthMode};}));
 const width=async mm=>changed(async()=>{await widthControl.fill(String(mm));await widthControl.press('Tab');});
 try{
  await p.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  await route('work');
  const fixture=await p.evaluate(async()=>{
   const d=qwProject(),g=qwTask('graph'),s=qwTask('diagram'),r=qwTask('short');
   d.layout='booklet';d.title='TASK167.2 layout';g.prompt='Определите скорость по графику.';g.graph.points=[{x:1,y:1,label:'A'},{x:8,y:5,label:'B'}];g.graph.xlabel='t, с';g.graph.ylabel='v, м/с';g.position='below';
   s.prompt='Определите величину сопротивления.';s.position='below';s.diagram=[{kind:'line',x:40,y:150,x2:140,y2:150,label:''},{kind:'resistor',x:140,y:150,x2:260,y2:150,label:'R'},{kind:'line',x:260,y:150,x2:360,y2:150,label:''}];
   r.prompt='Определите размеры изображённой фигуры.';r.figure='image';r.position='below';
   const canvas=document.createElement('canvas');canvas.width=400;canvas.height=200;const c=canvas.getContext('2d');c.fillStyle='#f4f4f4';c.fillRect(0,0,400,200);c.fillStyle='#333';c.fillRect(20,20,360,160);r.image=canvas.toDataURL('image/png');
   d.tasks=[g,s];qwDoc=qwValidate(d);qwSelected=g.id;qwPersist();qwRender();
   await qwBankOpen();await qwBankRepository.createTask({id:'task1672-raster',subject:'physics',task:r});
   const source=JSON.stringify((await qwBankRepository.getTask('task1672-raster')).task);
   return {g:g.id,s:s.id,source};
  });
  await p.evaluate(()=>qwBank({__view:'task1672-raster'}));
  await p.locator('[data-bank-add="task1672-raster"]').click();
  await p.waitForFunction(()=>qwDoc.tasks.length===3);
  const original=JSON.parse(await snapshot()),raster=original.tasks[2].id;
  assert.equal(await p.locator('[data-qw-action="up"] svg').count(),1);
  assert.equal(await p.locator('[data-qw-action="down"] svg').count(),1);
  await p.locator('[data-qw-action="preview"]').click();await ready();
  assert.deepEqual(await format.locator('option').evaluateAll(es=>es.map(e=>e.value)),['booklet','compact','practice','worksheet','exam']);
  for(const value of ['compact','practice','worksheet','exam','booklet']){await changed(()=>format.selectOption(value));assert.equal(await p.evaluate(()=>qwDoc.layout),value);}
  await tasks.selectOption(raster);assert.equal(await mode.inputValue(),'auto');assert.equal(await widthControl.isDisabled(),true);
  const auto=await bounds();await p.screenshot({path:path.join(out,'auto.png')});
  await changed(()=>mode.selectOption('manual'));await width(35);const small=await bounds();await p.screenshot({path:path.join(out,'manual-small.png')});
  await width(90);const big=await bounds();await p.screenshot({path:path.join(out,'manual-large.png')});
  const item=a=>a.find(f=>f.task===3);
  assert.ok(item(small).w<item(big).w-30,'manual sizes must change actual ink box');
  assert.ok(Math.abs(item(small).w/item(small).h-2)<.03&&Math.abs(item(big).w/item(big).h-2)<.03,'raster ratio');
  assert.ok(Math.abs(item(small).w*25.4/96-35)<.2&&Math.abs(item(big).w*25.4/96-90)<.2,'requested millimetres');
  assert.deepEqual(small.filter(f=>f.task!==3),big.filter(f=>f.task!==3),'other illustrations must not resize');
  await tasks.selectOption(fixture.g);await changed(()=>mode.selectOption('manual'));await width(80);
  await tasks.selectOption(fixture.s);await changed(()=>mode.selectOption('manual'));await width(65);
  await tasks.selectOption(raster);
  const preserved=await snapshot();const now=JSON.parse(preserved);
  for(let i=0;i<3;i++){assert.deepEqual(now.tasks[i].graph,original.tasks[i].graph);assert.deepEqual(now.tasks[i].diagram,original.tasks[i].diagram);assert.equal(now.tasks[i].image,original.tasks[i].image);}
  assert.equal(await p.evaluate(async()=>JSON.stringify((await qwBankRepository.getTask('task1672-raster')).task)),fixture.source);
  for(const value of ['portrait','landscape']){
   if(await orientation.inputValue()!==value)await changed(()=>orientation.selectOption(value));
   const preview=await bounds();assert.ok(preview.every(f=>f.within&&f.w>0&&f.h>0),JSON.stringify(preview));
   const html=await p.evaluate(()=>qwPrintDocumentHTML(qwDoc,false,{format:qwDoc.layout}));
   const pdfPage=await context.newPage();pdfPage.on('pageerror',e=>errors.push(String(e)));
   await pdfPage.setContent(html);await pdfPage.evaluate(()=>window.qwPrintReady);assert.equal(await pdfPage.evaluate(()=>window.__qwPrintError),undefined);
   await pdfPage.emulateMedia({media:'print'});
   const actual=await pdfPage.evaluate(()=>[...document.querySelectorAll('.qw-print-section figure')].map(f=>{const b=f.getBoundingClientRect();return {task:Number(f.closest('[data-task]').dataset.task),w:b.width,h:b.height};}));
   for(const f of preview){const a=actual.find(x=>x.task===f.task);assert.ok(a&&Math.abs(a.w-f.w)<1&&Math.abs(a.h-f.h)<1,'preview/print size mismatch');}
   await pdfPage.pdf({path:path.join(out,value+'.pdf'),preferCSSPageSize:true,printBackground:true});
   await pdfPage.screenshot({path:path.join(out,value+'.png'),fullPage:true});await pdfPage.close();report.push({orientation:value,preview,actual});
  }
  assert.equal((await p.evaluate(()=>qwDoc.tasks[2].figureWidth)),now.tasks[2].figureWidth,'orientation must retain stored width');
  for(const [w,h] of [[1440,900],[1024,768]])for(const theme of ['light','dark']){
   await p.setViewportSize({width:w,height:h});await p.evaluate(t=>{qoThemePreference=t;qoApplyAppearance();},theme);
   assert.ok(await format.isVisible());assert.ok(await mode.isVisible());
   assert.ok(await mode.evaluate(e=>{const b=e.getBoundingClientRect(),panel=e.closest('.qw-pdf-design').getBoundingClientRect();return b.left>=panel.left-1&&b.right<=panel.right+1;}));
   await p.screenshot({path:path.join(out,'controls-'+w+'-'+theme+'.png')});
  }
  await changed(()=>p.locator('#qw-layout-figure-reset').click());assert.equal(await mode.inputValue(),'auto');assert.ok(await widthControl.isDisabled());
  assert.equal(await p.evaluate(()=>qwDoc.tasks[2].figureWidthMode),undefined);
  await p.locator('[data-qw-close]').click();
  const saved=await snapshot(),download=p.waitForEvent('download');await p.locator('[data-qw-action="save"]').click();
  const file=path.join(out,'roundtrip.qwork');await (await download).saveAs(file);
  await p.locator('#qw-file').setInputFiles(file);await p.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Работа открыта'));assert.equal(await snapshot(),saved);
  await p.reload();await route('work');assert.equal(await snapshot(),saved);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({auto,small,big,report},null,2));
  console.log('PASS TASK167.2: offline controls, five formats, independent sizes, bank, geometry, both PDF orientations, QWORK/reload and themes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
