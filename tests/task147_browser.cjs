/* TASK147: actual editing, stable canvas, responsive panels, data roundtrip and PDF. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(process.env.QW_REGRESSION_ROOT||path.join(root,'evidence'),'task147');
const before=process.argv.includes('--before');
const html=before?process.env.QW_BEFORE_HTML:path.join(root,'Quantum-Office.html');
const sameBox=(a,b,message)=>{for(const k of ['x','y','width','height'])assert.ok(Math.abs(a[k]-b[k])<1,message+' '+k);};
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const results=[],errors=[];
 try{
 for(const width of before?[1440]:[1440,768,390])for(const theme of before?['light']:['light','dark'])for(const kind of ['diagram','graph']){
  const p=await browser.newPage({viewport:{width,height:900},acceptDownloads:true});
  p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept('A'));
  const action=k=>p.locator('[data-qw-action="'+k+'"]'),stage=p.locator('#qw-visual-stage svg');
  await p.goto(pathToFileURL(html).href);
  await p.evaluate(theme=>{qoThemePreference=theme;qoApplyAppearance();route('writer');},theme);
  await p.locator('[data-editor="writer"][data-tab="work"]').click();
  const untouched=await p.evaluate(()=>({writer:qoWriter.html,diagnostic:JSON.stringify(qdWorkingDoc())}));
  if(width<1200)await action('left').click();
  if(await p.locator('[data-qw-action="quick-add"]').count()){await p.locator('[data-qw-action="quick-add"][data-type="'+kind+'"]').click();}else{await p.locator('#qw-add-type').selectOption(kind);await p.locator('.qw-left [data-qw-action="add"]').click();}
  await p.locator('#qw-prompt').fill('TASK147: '+kind+' — редактируемая иллюстрация');
  await action(kind).click();
  const panel=async name=>{if(width<=1000&&await p.locator('#qw-dialog').getAttribute('data-panel')!==name)await p.locator('[data-visual-panel="'+name+'"]').click();};
  const closePanel=async()=>{if(width<=1000){const name=await p.locator('#qw-dialog').getAttribute('data-panel');if(name)await p.locator('[data-visual-panel="'+name+'"]').click();}};
  const change=async(sel,value)=>{await p.locator(sel).fill(value);await p.locator(sel).dispatchEvent('change');};
  const drag=async(x,y,x2,y2)=>{const b=await stage.boundingBox();await p.mouse.move(b.x+b.width*x/520,b.y+b.height*y/320);await p.mouse.down();await p.mouse.move(b.x+b.width*x2/520,b.y+b.height*y2/320,{steps:5});await p.mouse.up();};
  const stable=await stage.boundingBox(),modal=await p.locator('#qw-dialog').boundingBox();
  if(!before){
   assert.equal(await p.locator('#qw-visual-undo').isDisabled(),true);
   assert.equal(await p.locator('#qw-visual-delete').isDisabled(),true);
   const actionBox=await p.locator('.qw-visual-actions').boundingBox();
   await panel('tools');sameBox(stable,await stage.boundingBox(),'tools must not resize canvas');
   await panel('properties');sameBox(stable,await stage.boundingBox(),'inspector must not resize canvas');
   await closePanel();sameBox(actionBox,await p.locator('.qw-visual-actions').boundingBox(),'actions fixed across panels');
  }
  if(kind==='diagram'){
   if(!before){
    await panel('tools');
    assert.deepEqual(await p.locator('.qw-tool-group summary').allTextContents(),['Основные','Геометрия','Построения','Физика']);
    assert.deepEqual(await p.locator('[data-tool]').evaluateAll(xs=>xs.map(x=>x.dataset.tool)),['select','point','line','dashed','arrow','text','rect','circle','polyline','arc','dimension','doubleArrow','angle','triangle','rightTriangle','quadrilateral','ray','infiniteLine','parallel','perpendicular','equalMarks','block','incline','pulley','movablePulley','rope','spring','ground']);
    assert.equal(await p.locator('[data-tool] span').count(),28);
    await p.locator('.qw-tool-group summary').first().click();sameBox(stable,await stage.boundingBox(),'collapse must not resize canvas');
    await p.locator('.qw-tool-group summary').first().click();
    await p.locator('#qw-visual-tools').evaluate(e=>e.scrollTop=e.scrollHeight);sameBox(stable,await stage.boundingBox(),'tools scroll independent');
    await p.locator('#qw-visual-tools').evaluate(e=>e.scrollTop=0);
    await closePanel();
    for(const step of ['10','20','40']){await p.locator('#qw-grid-step-geometry').selectOption(step);assert.equal(await stage.locator('#qw-geometry-guide').getAttribute('width'),step);}
    await p.locator('#qw-grid-step-geometry').selectOption('20');
   }
   await panel('tools');await p.locator('[data-tool="triangle"]').click();await drag(100,70,320,250);
   if(!before){
    assert.equal(await p.locator('[data-tool="triangle"]').getAttribute('aria-pressed'),'true');
    await panel('properties');await change('[data-vertex-index="0"][data-vertex-field="label"]','D');
    await change('[data-edge-index="0"]','6 см');await closePanel();
    await panel('tools');await p.locator('[data-tool="rect"]').click();await drag(380,100,470,160);
    await panel('properties');await change('#qw-object-label','Брусок');
    const count=await stage.locator('[data-qw-object]').count();
    const select=p.locator('#qw-diagram-preset');await select.focus();await p.keyboard.press('Delete');
    assert.equal(await stage.locator('[data-qw-object]').count(),count,'Delete in select must not remove objects');
    await panel('properties');await p.locator('[data-object-select="0"]').click();await closePanel();
    await p.locator('#qw-visual-delete').click();assert.equal(await stage.locator('[data-qw-object]').count(),1);
    assert.match(await stage.textContent(),/Брусок/);
    await p.locator('#qw-visual-undo').click();assert.equal(await stage.locator('[data-qw-object]').count(),2);
    await panel('properties');await p.locator('[data-object-select="0"]').click();await closePanel();
    const coords=await stage.locator('polygon').getAttribute('points');await drag(200,180,220,200);
    assert.notEqual(await stage.locator('polygon').getAttribute('points'),coords,'figure moves via pointer');
    await panel('properties');
   }
  }else{
   await panel('tools');await p.locator('#qw-graph-preset').selectOption('v');
   if(!before){
    await p.locator('#qw-graph-preset').focus();await p.keyboard.press('Delete');assert.equal(await stage.locator('[data-qw-point]').count(),4,'Delete in graph template must not remove a point');
    await p.locator('#qw-add-point').click();await closePanel();
    assert.equal(await stage.locator('[data-qw-point]').count(),5);
    const point=stage.locator('[data-qw-point="4"]');const b=await point.boundingBox();
    await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();const plane=await stage.boundingBox();await p.mouse.move(b.x+b.width/2+plane.width*.15,b.y+b.height/2-plane.height*.12,{steps:4});await p.mouse.up();
    await panel('properties');await change('[data-point-index="4"][data-point-field="label"]','P');await closePanel();
    await p.locator('#qw-visual-delete').click();assert.equal(await stage.locator('[data-qw-point]').count(),4);
    await p.locator('#qw-visual-undo').click();assert.equal(await stage.locator('[data-qw-point]').count(),5);
    assert.match(await stage.textContent(),/P/);
    await panel('tools');await p.locator('#qw-graph-preset').selectOption('parabola');await panel('properties');await change('[data-curve-param="a"]','0.75');
    await panel('tools');await p.locator('#qw-graph-preset').selectOption('sin');await panel('properties');assert.equal(await p.locator('#qw-curve-trig').inputValue(),'sin');
    await panel('tools');await p.locator('#qw-graph-preset').selectOption('cos');await panel('properties');assert.equal(await p.locator('#qw-curve-trig').inputValue(),'cos');
    await change('[data-curve-param="amplitude"]','2');
    await change('[data-graph-field="xlabel"]','x');
    await p.locator('[data-graph-field="snapToGrid"]').uncheck();
   }
  }
  if(!before){
   sameBox(stable,await stage.boundingBox(),'content must not resize canvas');sameBox(modal,await p.locator('#qw-dialog').boundingBox(),'modal must not jump');
   const metrics=await p.locator('#qw-dialog').evaluate(d=>({width:d.clientWidth,scroll:d.scrollWidth,overflow:[...d.querySelectorAll('input,select,button')].filter(e=>e.getClientRects().length).filter(e=>{const a=e.getBoundingClientRect(),b=d.getBoundingClientRect();return a.left<b.left||a.right>b.right;}).map(e=>e.id||e.outerHTML)}));
   assert.ok(metrics.scroll<=metrics.width+1);assert.deepEqual(metrics.overflow,[]);
   await p.locator('#qw-visual-properties').evaluate(e=>e.scrollTop=e.scrollHeight);
   assert.equal(await action('visual-apply').isVisible(),true);
   await p.screenshot({path:path.join(out,kind+'_'+width+'_'+theme+'_properties.png')});
   await p.locator('#qw-visual-properties').evaluate(e=>e.scrollTop=0);
   await panel('tools');
   await p.screenshot({path:path.join(out,kind+'_'+width+'_'+theme+'_tools.png')});
   await closePanel();
   await p.screenshot({path:path.join(out,kind+'_'+width+'_'+theme+'.png')});
   await action('visual-apply').click();
   const expected=await p.evaluate(()=>JSON.parse(JSON.stringify(qwDoc)));
   assert.equal(expected.tasks[0].figure,kind);
   if(kind==='diagram'){assert.equal(expected.tasks[0].diagram.length,2);assert.equal(expected.tasks[0].diagram[0].vertices[0].label,'D');}
   else{assert.equal(expected.tasks[0].graph.curve.trig,'cos');assert.equal(expected.tasks[0].graph.curve.amplitude,2);assert.equal(expected.tasks[0].graph.snapToGrid,false);}
   const dl=p.waitForEvent('download');await action('save').click();const file=path.join(out,kind+'_'+width+'_'+theme+'.qwork');await(await dl).saveAs(file);
   assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),expected);
   await p.locator('[data-action="work-new"]').click();assert.equal(await p.evaluate(()=>qwDoc.tasks.length),0);
   await p.locator('#qw-file').setInputFiles(file);await p.waitForFunction(()=>qwDoc.tasks.length===1);
   assert.deepEqual(await p.evaluate(()=>JSON.parse(JSON.stringify(qwDoc))),expected);
   assert.deepEqual(await p.evaluate(()=>({writer:qoWriter.html,diagnostic:JSON.stringify(qdWorkingDoc())})),untouched);
   results.push({kind,width,theme,status:'PASS',stage:stable,modal,metrics});
  }else await p.screenshot({path:path.join(out,kind+'_before.png')});
  await p.close();
 }
 assert.deepEqual(errors,[]);
 // Both old ready-made illustrations and edited illustrations share the PDF path.
 if(!before){
  const p=await browser.newPage({viewport:{width:1000,height:1300}});
  await p.goto(pathToFileURL(html).href);
  const doc=await p.evaluate(()=>{const d=qwExample('math');d.tasks=d.tasks.filter(q=>['graph','diagram'].includes(q.type));return d;});
  for(const name of ['diagram','graph'])doc.tasks.push(JSON.parse(fs.readFileSync(path.join(out,name+'_1440_light.qwork'),'utf8')).tasks[0]);
  const ready=await p.evaluate(()=>['surface','incline','pulley','spring'].map(kind=>({...qwTask('diagram'),prompt:'Готовая физическая схема: '+kind,diagram:qwPhysicsPreset(kind)})));
  doc.tasks.push(...ready);
  const printed=await p.evaluate(d=>qwPrintDocumentHTML(qwValidate(d),false),doc);
  await p.setContent(printed,{waitUntil:'load'});assert.equal(await p.locator('figure svg').count(),8);
  const pdf=await p.pdf({preferCSSPageSize:true,printBackground:true});fs.writeFileSync(path.join(out,'edited-and-presets.pdf'),pdf);
  assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  await p.screenshot({path:path.join(out,'pdf-source.png'),fullPage:true});
  await p.goto(pathToFileURL(html).href);
  const raster=await p.evaluate(async d=>Array.from(await qwPDFBytes(qwValidate(d),false)),doc);
  fs.writeFileSync(path.join(out,'edited-and-presets-raster.pdf'),Buffer.from(raster));
  assert.equal(Buffer.from(raster).subarray(0,5).toString(),'%PDF-');await p.close();
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',cases:results,errors,pdf:{illustrations:8,vectorBytes:pdf.length,rasterBytes:raster.length}},null,2));
 }
 console.log('PASS TASK147 '+(before?'baseline screenshots':'12 layouts, real editing/undo/delete/apply, QWORK roundtrips, PDF'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
