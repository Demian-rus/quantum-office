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
  assert.deepEqual(await format.locator('option').evaluateAll(es=>es.map(e=>e.value)),['booklet','compact','practice','worksheet']);
  for(const value of ['compact','practice','worksheet','booklet']){await changed(()=>format.selectOption(value));assert.equal(await p.evaluate(()=>qwDoc.layout),value);}
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
  // All real task formats, including reopening a legacy exam document. Exercise the actual controls.
  await p.locator('[data-qw-close]').click();
  await p.evaluate(()=>qwChange(()=>{qwDoc.layout='exam';}));
  await p.locator('[data-qw-action="settings"]').click();
  const legacyOptions=await p.locator('[data-meta="layout"] option').evaluateAll(es=>es.map(e=>[e.value,e.textContent]));
  assert.equal(legacyOptions.find(x=>x[0]==='exam')[1],'Прежний компактный макет (без проверки ФИПИ)');
  await p.locator('[data-qw-close]').click();
  await p.locator('[data-qw-action="preview"]').click();await ready();
  assert.deepEqual(await format.locator('option').evaluateAll(es=>es.map(e=>[e.value,e.textContent])),legacyOptions);
  assert.equal(await format.inputValue(),'exam');
  const measure=()=>p.evaluate(()=>{
   const doc=document.querySelector('#qw-print-preview-frame').contentDocument;
   return [...doc.querySelectorAll('.qw-print-section figure')].map(f=>{
    const b=f.getBoundingClientRect(),flow=f.closest('.qw-task-flow').getBoundingClientRect(),page=f.closest('.qw-page-content').getBoundingClientRect();
    const svg=f.querySelector('svg'),img=f.querySelector('img'),vb=svg?.viewBox.baseVal;
    const ratio=vb?vb.width/vb.height:img.naturalWidth/img.naturalHeight;
    const labels=svg?[...svg.querySelectorAll('text')].filter(e=>e.textContent.trim()).map(e=>parseFloat(doc.defaultView.getComputedStyle(e).fontSize)*svg.getBoundingClientRect().width/vb.width*.75):[];
    return {task:Number(f.closest('[data-task]').dataset.task),kind:f.dataset.figureKind,position:f.dataset.printPosition,w:b.width,h:b.height,ratio,labels,within:b.left>=Math.max(flow.left,page.left)-1&&b.right<=Math.min(flow.right,page.right)+1&&b.top>=page.top-1&&b.bottom<=page.bottom+1};
   });
  });
  const verifyFigure=(f,context)=>{assert.ok(f.within&&f.w>0&&f.h>0,context+' bounds '+JSON.stringify(f));assert.ok(Math.abs(f.w/f.h-f.ratio)/f.ratio<.025,context+' aspect ratio '+JSON.stringify(f));assert.ok(f.labels.every(pt=>pt>=(f.kind==='graph'?6.6:5.55)-.06),context+' readable labels '+JSON.stringify(f));};
  const effective=async(f,requested)=>{const txt=await p.locator('#qw-layout-figure-effective').innerText();const mm=f.w*25.4/96;assert.ok(txt.includes(mm.toFixed(1)+' мм'),txt);if(Math.abs(mm-requested)>.15)assert.match(txt,/ограничение/);};
  const matrix=[];
  for(const layout of ['exam','compact','practice','worksheet','booklet']){
   if(await format.inputValue()!==layout)await changed(()=>format.selectOption(layout));
   assert.equal(await format.inputValue(),layout);
   if(layout!=='exam')assert.equal(await format.locator('option[value="exam"]').count(),0);
   if(layout==='practice'&&await p.locator('[data-practice="perPage"]').inputValue()!=='1')await changed(()=>p.locator('[data-practice="perPage"]').selectOption('1'));
   if(await orientation.inputValue()!=='portrait')await changed(()=>orientation.selectOption('portrait'));
   await tasks.selectOption(raster);
   await width(35);const narrow=(await measure()).find(f=>f.task===3);verifyFigure(narrow,layout);await effective(narrow,35);
   await width(90);const wide=(await measure()).find(f=>f.task===3);verifyFigure(wide,layout);await effective(wide,90);
   assert.ok(wide.w-narrow.w>30,layout+' raster width must change');assert.ok(Math.abs(narrow.w*25.4/96-35)<.2&&Math.abs(wide.w*25.4/96-90)<.2,layout+' requested width');
   // A very small scientific graph is enlarged only as needed for readable labels.
   await tasks.selectOption(fixture.g);await width(31.75);
   const smallGraph=(await measure()).find(f=>f.task===1);verifyFigure(smallGraph,layout);await effective(smallGraph,31.75);
   assert.ok(smallGraph.w*25.4/96>31.9,layout+' minimum readable size should limit the requested graph');
   await width(100);const largeGraph=(await measure()).find(f=>f.task===1);verifyFigure(largeGraph,layout);assert.ok(largeGraph.w>smallGraph.w+2,layout+' graph resize');
   await tasks.selectOption(fixture.s);await width(90);const diagram=(await measure()).find(f=>f.task===2);verifyFigure(diagram,layout);
   // Largest supported width + side placement on a narrow landscape column.
   await tasks.selectOption(raster);await width(124.35);
   await changed(()=>p.locator('[data-print-setting="figurePosition"]').selectOption('right'));
   const requested=await p.evaluate(()=>qwDoc.tasks.map(q=>q.figureWidth));
   for(const direction of ['portrait','landscape']){
    if(await orientation.inputValue()!==direction)await changed(()=>orientation.selectOption(direction));
    const figures=await measure();assert.equal(figures.length,3);
    for(const fig of figures)verifyFigure(fig,layout+' '+direction);
    const rasterFig=figures.find(f=>f.task===3);await effective(rasterFig,124.35);
    assert.equal(rasterFig.position,'below',layout+' wide figure must move below text');
    assert.ok(rasterFig.w*25.4/96<=124.55,layout+' column cap');
    assert.deepEqual(await p.evaluate(()=>qwDoc.tasks.map(q=>q.figureWidth)),requested,'orientation cannot alter requests');
    const html=await p.evaluate(()=>qwPrintDocumentHTML(qwDoc,false,{format:qwDoc.layout}));
    const print=await context.newPage();print.on('pageerror',e=>errors.push(String(e)));
    await print.setContent(html);await print.evaluate(()=>window.qwPrintReady);assert.equal(await print.evaluate(()=>window.__qwPrintError),undefined);
    await print.emulateMedia({media:'print'});
    const actual=await print.evaluate(()=>[...document.querySelectorAll('.qw-print-section figure')].map(f=>{const b=f.getBoundingClientRect();return {task:Number(f.closest('[data-task]').dataset.task),w:b.width,h:b.height};}));
    for(const fig of figures){const a=actual.find(x=>x.task===fig.task);assert.ok(a&&Math.abs(a.w-fig.w)<1&&Math.abs(a.h-fig.h)<1,layout+' '+direction+' preview/print mismatch');}
    await print.pdf({path:path.join(out,layout+'-'+direction+'.pdf'),preferCSSPageSize:true,printBackground:true});
    await print.close();await p.screenshot({path:path.join(out,layout+'-'+direction+'-preview.png')});matrix.push({layout,orientation:direction,requested,figures,actual,narrow,wide,smallGraph,largeGraph,diagram});
   }
   await changed(()=>p.locator('[data-print-setting="figurePosition"]').selectOption('auto'));
  }
  const finalGeometry=JSON.parse(await snapshot());
  for(let i=0;i<3;i++){assert.deepEqual(finalGeometry.tasks[i].graph,original.tasks[i].graph);assert.deepEqual(finalGeometry.tasks[i].diagram,original.tasks[i].diagram);assert.equal(finalGeometry.tasks[i].image,original.tasks[i].image);}
  assert.equal(await p.evaluate(async()=>JSON.stringify((await qwBankRepository.getTask('task1672-raster')).task)),fixture.source);
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
  await p.locator('#qw-file').setInputFiles(file);await p.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('Работа открыта'));assert.deepStrictEqual(JSON.parse(await snapshot()),JSON.parse(saved));
  await p.reload();await route('work');assert.deepStrictEqual(JSON.parse(await snapshot()),JSON.parse(saved));
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({auto,small,big,report,matrix},null,2));
  console.log('PASS TASK167.2: offline controls, four current formats and reopened legacy exam, ten format/orientation cases, independent sizes, bank, geometry, both PDF orientations, QWORK/reload and themes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
