/* TASK148: full user workflows, export/import, desktop/scaling matrix and real PDF. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task148');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const p=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept('A'));
 try{
  const action=k=>p.locator('[data-qw-action="'+k+'"]'),stage=p.locator('#qw-visual-stage svg');
  const change=async(sel,v)=>{await p.locator(sel).fill(String(v));await p.locator(sel).dispatchEvent('change');};
  const at=async(x,y)=>{const b=await stage.boundingBox();return {x:b.x+b.width*x/520,y:b.y+b.height*y/320};};
  const click=async(x,y)=>{const a=await at(x,y);await p.mouse.click(a.x,a.y);};
  const drag=async(x,y,x2,y2)=>{const a=await at(x,y),b=await at(x2,y2);await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(b.x,b.y,{steps:6});await p.mouse.up();};
  const math=(x,y)=>({x:82+(x+10)/20*369,y:262-(y+10)/20*216});
  const mClick=async(x,y)=>{const a=math(x,y);await click(a.x,a.y);};
  const mDrag=async(x,y,x2,y2)=>{const a=math(x,y),b=math(x2,y2);await drag(a.x,a.y,b.x,b.y);};
  const tool=async key=>p.locator('[data-tool="'+key+'"]').click();
  const color=async hex=>p.locator('[data-style-key="stroke"][data-style-color="'+hex+'"]').click();
  const newTask=async(kind,prompt)=>{await p.locator('#qw-add-type').selectOption(kind);await p.locator('.qw-left [data-qw-action="add"]').click();await p.locator('#qw-prompt').fill(prompt);await action(kind).click();};
  await p.addInitScript(()=>{window.print=()=>{window.top.__qwPrintCalled=true;};});
  await p.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);await p.evaluate(()=>route('writer'));await p.locator('[data-editor="writer"][data-tab="work"]').click();
  const untouched=await p.evaluate(()=>({writer:qoWriter.html,diagnostic:JSON.stringify(qdWorkingDoc())}));
  await newTask('diagram','Брусок на наклонной плоскости: поворот и перемещение');
  await p.locator('#qw-snap-geometry').uncheck();await tool('incline');await drag(80,90,426.41,290);
  await tool('block');await drag(225,140,305,184);await tool('select');await click(260,160);
  await change('#qw-block-rotation',-30);await p.locator('#qw-align-block').click();
  assert.ok(Math.abs(Number(await p.locator('#qw-block-rotation').inputValue())+30)<.1);
  const bounds0=await stage.locator('[data-qw-object="1"] rect').getAttribute('width');
  const handle=await stage.locator('[data-rotation-handle]').boundingBox(),center=await at(265,162),to=await at(310,150);
  await p.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await p.mouse.down();await p.mouse.move(to.x,to.y,{steps:6});await p.mouse.up();
  assert.notEqual(Number(await p.locator('#qw-block-rotation').inputValue()),-30);
  assert.equal(await stage.locator('[data-qw-object="1"] rect').getAttribute('width'),bounds0,'rotation preserves dimensions');
  await p.locator('#qw-align-block').click();await drag(265,162,285,150.453);
  await p.screenshot({path:path.join(out,'incline-block.png')});await action('visual-apply').click();
  await newTask('diagram','Подвижный блок: две ветви нити и подвешенный груз');await p.locator('#qw-diagram-preset').selectOption('movable');
  assert.equal(await stage.locator('[data-qw-object]').count(),5);await p.screenshot({path:path.join(out,'movable-pulley.png')});await action('visual-apply').click();
  await newTask('diagram','Разноцветные векторы сил F₁, F₂, F₃');await p.locator('#qw-snap-geometry').uncheck();
  for(const [x,y,label,hex] of [[420,160,'F₁','#dc2626'],[260,50,'F₂','#16a34a'],[100,260,'F₃','#2563eb']]){
   await tool('arrow');await drag(260,160,x,y);await change('#qw-object-label',label);await color(hex);
  }
  await tool('select');await drag(50,20,470,300);assert.equal(await stage.locator('.qw-visual-selected').count(),3,'marquee selects three vectors');
  await p.keyboard.down('Shift');await click(340,160);await p.keyboard.up('Shift');assert.equal(await stage.locator('.qw-visual-selected').count(),2);
  await p.keyboard.down('Shift');await click(340,160);await p.keyboard.up('Shift');assert.equal(await stage.locator('.qw-visual-selected').count(),3);
  const paths=await stage.locator('[data-qw-object] line').evaluateAll(es=>es.map(e=>e.getAttribute('x1')));
  await drag(340,160,360,170);assert.notDeepEqual(await stage.locator('[data-qw-object] line').evaluateAll(es=>es.map(e=>e.getAttribute('x1'))),paths,'group pointer move');
  await p.locator('#qw-visual-undo').click();assert.deepEqual(await stage.locator('[data-qw-object] line').evaluateAll(es=>es.map(e=>e.getAttribute('x1'))),paths,'group move is one undo');
  await p.locator('[data-object-select="0"]').click();await p.locator('[data-layer="front"]').click();
  assert.match(await p.locator('[data-object-select="2"]').textContent(),/F₁/);await p.locator('[data-layer="back"]').click();
  await p.screenshot({path:path.join(out,'colored-forces.png')});await action('visual-apply').click();
  await newTask('graph','Отрицательные координаты, независимые отрезки, ломаная и функции');
  await p.locator('#qw-coordinate-mode').selectOption('positiveX');assert.equal(await p.locator('[data-graph-field="ymin"]').inputValue(),'-10');
  await p.locator('#qw-coordinate-mode').selectOption('math');assert.equal(await p.locator('[data-graph-field="xmin"]').inputValue(),'-10');
  const canvasBox=await stage.boundingBox();
  await tool('line');for(let i=0;i<20;i++)await mClick(-8+i*.3,-8);assert.equal(await stage.locator('[data-qw-element]').count(),0);
  assert.equal(await p.locator('#qw-visual-undo').isDisabled(),false,'coordinate preset is the only prior undo');
  await mDrag(-8,-6,-2,0);await color('#dc2626');await tool('line');await mDrag(2,0,8,6);await color('#16a34a');
  assert.equal(await stage.locator('[data-qw-element]').count(),2);
  await p.locator('#qw-coordinate-mode').selectOption('first');assert.match(await p.locator('#qw-visual-state').textContent(),/Координаты сохранены/);assert.equal(await stage.locator('[data-qw-element]').count(),2);await p.locator('#qw-coordinate-mode').selectOption('math');
  assert.notEqual(await stage.locator('[data-qw-element="0"] path').getAttribute('stroke'),await stage.locator('[data-qw-element="1"] path').getAttribute('stroke'));
  await tool('select');await mDrag(-9,-7,9,7);assert.equal(await stage.locator('.qw-visual-selected').count(),2,'graph marquee');
  const original=await stage.locator('[data-qw-element="0"] path').getAttribute('d');await mDrag(-5,-3,-4,-2);
  assert.notEqual(await stage.locator('[data-qw-element="0"] path').getAttribute('d'),original);await p.locator('#qw-visual-undo').click();assert.equal(await stage.locator('[data-qw-element="0"] path').getAttribute('d'),original);
  await tool('arrow');await mDrag(-7,7,-3,3);await color('#2563eb');
  await tool('polyline');for(const [x,y] of [[-5,-8],[0,-5],[5,-8]])await mClick(x,y);await p.locator('#qw-finish-polyline').click();
  assert.equal(await stage.locator('[data-qw-element]').count(),4);await tool('point');await mClick(5,-6);await p.locator('#qw-add-point').click();
  await tool('text');await mClick(-8,5);
  await tool('quadratic');await mClick(0,0);await change('[data-element-curve="a"]',.05);await color('#9333ea');
  await tool('sin');await mClick(0,0);await change('[data-element-curve="amplitude"]',2);await color('#ea580c');
  await tool('cos');await mClick(0,0);await change('[data-element-curve="amplitude"]',3);await color('#16a34a');
  await tool('select');await p.locator('[data-graph-object="1"]').click();await p.locator('[data-graph-object="2"]').click({modifiers:['Shift']});
  assert.equal(await stage.locator('.qw-visual-selected').count(),2);await change('[data-style="width"]',4);
  assert.equal(await stage.locator('[data-qw-element="0"] path').getAttribute('stroke-width'),'4');await p.locator('#qw-visual-undo').click();
  await p.locator('#qw-visual-stage').focus();await p.keyboard.press('Control+a');const n=await stage.locator('.qw-visual-selected').count();assert.equal(n,10);
  await p.keyboard.press('Delete');assert.equal(await stage.locator('[data-qw-element],[data-qw-point]').count(),0);await p.locator('#qw-visual-undo').click();assert.equal(await stage.locator('[data-qw-element],[data-qw-point]').count(),10);
  for(const k of ['x','y','width','height'])assert.ok(Math.abs((await stage.boundingBox())[k]-canvasBox[k])<1,'canvas stable');
  await p.screenshot({path:path.join(out,'negative-coordinate-graph.png')});await action('visual-apply').click();
  const expected=await p.evaluate(()=>JSON.parse(JSON.stringify(qwDoc)));
  assert.equal(expected.version,1);assert.equal(expected.tasks[3].graph.elements.length,9);
  assert.deepEqual(expected.tasks[2].diagram.map(o=>o.style.stroke),['#dc2626','#16a34a','#2563eb']);
  const dl=p.waitForEvent('download');await action('save').click();const file=path.join(out,'task148-demonstration.qwork');await(await dl).saveAs(file);
  await p.locator('[data-action="work-new"]').click();await p.locator('#qw-file').setInputFiles(file);await p.waitForFunction(()=>qwDoc.tasks.length===4);
  assert.deepEqual(await p.evaluate(()=>JSON.parse(JSON.stringify(qwDoc))),expected,'QWORK geometry and style roundtrip');
  const invalid=structuredClone(expected);invalid.tasks[2].diagram[0].style.stroke='url(#injection)';const badFile=path.join(out,'rejected-style.qwork');fs.writeFileSync(badFile,JSON.stringify(invalid));
  await p.locator('#qw-file').setInputFiles(badFile);await p.waitForFunction(()=>document.body.textContent.includes('Не удалось открыть QWORK'));assert.deepEqual(await p.evaluate(()=>JSON.parse(JSON.stringify(qwDoc))),expected,'bad style import is atomic');
  assert.deepEqual(await p.evaluate(()=>({writer:qoWriter.html,diagnostic:JSON.stringify(qdWorkingDoc())})),untouched);
  await p.reload();assert.deepEqual(await p.evaluate(()=>JSON.parse(JSON.stringify(qwDoc))),expected,'reopen persisted QWORK');
  await p.evaluate(()=>route('writer'));await p.locator('[data-editor="writer"][data-tab="work"]').click();
  // Use the actual exported document for both PDF paths, with no test-generated illustration model.
  const raster=await p.evaluate(async()=>Array.from(await qwPDFBytes(qwDoc,false)));fs.writeFileSync(path.join(out,'task148-raster.pdf'),Buffer.from(raster));
  await action('preview').click();await p.frameLocator('#qw-print-preview-frame').locator('.qw-paper-task').first().waitFor();
  const previewFrame=await p.locator('#qw-print-preview-frame').elementHandle();const printed=await (await previewFrame.contentFrame()).content();
  await action('preview-pdf').click();await p.waitForFunction(()=>window.__qwPrintCalled===true);await p.locator('[data-qw-close]').click();assert.doesNotMatch(printed,/data-qw-(?:vertex|object|element|editor|marquee)/);
  const printPage=await browser.newPage({viewport:{width:1000,height:1400}});await printPage.setContent(printed);
  assert.equal(await printPage.locator('figure svg').count(),4);await printPage.pdf({path:path.join(out,'task148-vector.pdf'),preferCSSPageSize:true,printBackground:true});
  await printPage.screenshot({path:path.join(out,'pdf-source.png'),fullPage:true});await printPage.close();
  const matrix=[];
  for(const [width,height,scale] of [[1366,768,1],[1440,900,1],[1920,1080,1],[2560,1440,1],[1093,614,1.25],[1280,720,1.5]])for(const theme of ['light','dark']){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:scale});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);await page.evaluate(theme=>{qoThemePreference=theme;qoApplyAppearance();route('writer');},theme);await page.locator('[data-editor="writer"][data-tab="work"]').click();
   await page.locator('#qw-file').setInputFiles(file);await page.waitForFunction(()=>qwDoc.tasks.length===4);
   for(const [index,kind] of [[0,'diagram'],[3,'graph']]){
    if(width<1200)await page.locator('[data-qw-action="left"]').click();await page.locator('.qw-nav-task').nth(index).click();await page.locator('[data-qw-action="'+kind+'"]').click();
    const before=await page.locator('#qw-visual-stage svg').boundingBox();
    await page.locator(kind==='diagram'?'[data-object-select="1"]':'[data-graph-object="1"]').click();
    const after=await page.locator('#qw-visual-stage svg').boundingBox();for(const k of ['x','y','width','height'])assert.ok(Math.abs(before[k]-after[k])<1);
    assert.ok(await page.locator('#qw-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1));
    assert.ok(await page.locator('[data-qw-action="visual-apply"]').isVisible());
    await page.screenshot({path:path.join(out,kind+'_'+width+'x'+height+'_'+scale+'_'+theme+'.png')});await page.locator('[data-qw-close]').click();
    matrix.push({width,height,scale,theme,kind,status:'PASS'});
   }
   await context.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',matrix,errors,project:expected,pdf:{rasterBytes:raster.length,illustrations:4}},null,2));
  console.log('PASS TASK148: real diagrams, rotation, forces, pulleys, independent graph primitives, groups, QWORK, PDF and 24 desktop/scaling layouts');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
