/* New diagram tools exercised through actual pointers, forms and QWORK UI. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(process.env.QW_REGRESSION_ROOT||path.join(root,'evidence'),'task149.2');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true});
 const p=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true}),errors=[],matrix=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 const stage=p.locator('#qw-visual-stage svg');
 const action=key=>p.locator('[data-qw-action="'+key+'"]');
 const tool=key=>p.locator('[data-tool="'+key+'"]').click();
 const at=async(x,y)=>{const b=await stage.boundingBox();return {x:b.x+b.width*x/520,y:b.y+b.height*y/320};};
 const click=async(x,y)=>{const a=await at(x,y);await p.mouse.click(a.x,a.y);};
 const drag=async(x,y,x2,y2)=>{const a=await at(x,y),b=await at(x2,y2);await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(b.x,b.y,{steps:6});await p.mouse.up();};
 const change=async(sel,value)=>{await p.locator(sel).fill(String(value));await p.locator(sel).press('Tab');};
 try{
  await p.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);await p.evaluate(()=>route('writer'));await p.locator('[data-editor="writer"][data-tab="work"]').click();
  const untouched=await p.evaluate(()=>({writer:qoWriter.html,diagnostic:JSON.stringify(qdWorkingDoc())}));
  await p.locator('[data-qw-action="quick-add"][data-type="'+'diagram'+'"]').click();await p.locator('#qw-prompt').fill('Постройте и отредактируйте геометрическую схему.');await action('diagram').click();
  assert.deepEqual(await p.locator('.qw-tool-group').first().locator('[data-tool]').evaluateAll(es=>es.map(e=>e.dataset.tool)),['select','point','line','dashed','arrow','text']);
  assert.equal(await p.locator('[data-tool="dashed"]').count(),1);assert.equal(await p.locator('#qw-object-label').count(),0,'no empty selected-object form');
  await p.locator('#qw-snap-geometry').uncheck();
  await tool('polyline');for(const a of [[100,110],[180,70],[230,150]])await click(...a);await p.keyboard.press('Escape');
  assert.equal(await stage.locator('[data-qw-object]').count(),0,'Escape cancels unfinished polyline');assert.equal(await p.locator('#qw-visual-undo').isDisabled(),true);
  await tool('polyline');for(const a of [[100,110],[180,70],[230,150]])await click(...a);await p.locator('#qw-finish-polyline').click();
  assert.equal(await stage.locator('polyline').count(),1);const points=await stage.locator('polyline').getAttribute('points');
  await tool('polyline');await click(50,50);await click(80,60);await p.keyboard.press('Enter');assert.equal(await stage.locator('polyline').count(),2,'Enter commits a polyline');
  await p.keyboard.press('Control+z');assert.equal(await stage.locator('polyline').count(),1);await p.locator('[data-object-select="0"]').click();
  await tool('select');await drag(180,70,195,90);assert.notEqual(await stage.locator('polyline').getAttribute('points'),points,'pointer moves one vertex');
  await p.keyboard.press('Control+z');assert.equal(await stage.locator('polyline').getAttribute('points'),points);
  await p.locator('[data-object-select="0"]').click();await p.locator('[data-style-key="stroke"][data-style-color="#dc2626"]').click();await change('[data-style="width"]',4);
  await change('#qw-object-label','Ломаная с тремя вершинами и индивидуальным цветом');
  await tool('arc');await drag(350,90,400,90);await tool('select');await click(325,115);
  assert.equal(await stage.locator('.qw-visual-selected').count(),0,'empty arc quadrant is not selectable');
  await click(385.35,54.65);assert.equal(await p.locator('[data-arc-field="radius"]').inputValue(),'50');
  await change('[data-arc-field="startAngle"]',-30);await change('[data-arc-field="endAngle"]',150);await change('[data-arc-field="radius"]',45);
  await p.locator('[data-style-key="stroke"][data-style-color="#16a34a"]').click();await change('#qw-object-label','Дуга');
  await tool('dimension');await drag(100,240,240,240);await change('#qw-object-label','5 см');await change('[data-diagram-field="labelOffset"]',24);
  const dim=stage.locator('[data-qw-object="2"]');assert.equal(await dim.locator('line').count(),3);
  const text=await dim.locator('text').boundingBox(),line=await dim.locator('line').first().boundingBox();assert.ok(text.y>line.y+5,'dimension text is clear of line');
  await tool('doubleArrow');await drag(325,215,435,265);await change('#qw-object-label','a');await p.locator('[data-style-key="stroke"][data-style-color="#2563eb"]').click();await change('[data-style="width"]',4);await change('#qw-block-rotation',20);
  const arrow=stage.locator('[data-qw-object="3"]');assert.equal(await arrow.locator('line[marker-start][marker-end]').count(),1);assert.match(await arrow.getAttribute('transform'),/rotate\(20/);assert.equal(await arrow.locator('marker path').getAttribute('stroke'),'#2563eb');
  await tool('select');
  for(const [i,x,y] of [[0,140,90],[1,372.5,51.03],[2,170,240],[3,380,240]]){
   await p.locator('[data-object-select="'+i+'"]').click();
   const shape=stage.locator('[data-qw-object="'+i+'"]'),before=await shape.evaluate(e=>e.innerHTML+e.getAttribute('transform'));
   await drag(x,y,x+5,y+5);assert.notEqual(await shape.evaluate(e=>e.innerHTML+e.getAttribute('transform')),before,'individual pointer move '+i);
   await p.keyboard.press('Control+z');assert.equal(await shape.evaluate(e=>e.innerHTML+e.getAttribute('transform')),before,'individual move undo '+i);
  }
  await tool('select');await p.locator('#qw-visual-stage').focus();await p.keyboard.press('Control+a');assert.equal(await stage.locator('.qw-visual-selected').count(),4);
  const original=await stage.locator('polyline').getAttribute('points');await drag(140,90,150,100);assert.notEqual(await stage.locator('polyline').getAttribute('points'),original,'group pointer movement');
  await p.keyboard.press('Control+z');assert.equal(await stage.locator('polyline').getAttribute('points'),original);
  await p.locator('#qw-visual-stage').focus();await p.keyboard.press('Control+a');await p.keyboard.press('Delete');assert.equal(await stage.locator('[data-qw-object]').count(),0);
  await p.keyboard.press('Control+z');assert.equal(await stage.locator('[data-qw-object]').count(),4,'group delete is one undo');
  await p.screenshot({path:path.join(out,'editor-new-tools.png')});await action('visual-apply').click();
  const expected=await p.evaluate(()=>JSON.parse(JSON.stringify(qwDoc)));assert.deepEqual(expected.tasks[0].diagram.map(o=>o.kind),['polyline','arc','dimension','doubleArrow']);
  const dl=p.waitForEvent('download');await action('save').click();const file=path.join(out,'tool-roundtrip.qwork');await(await dl).saveAs(file);
  await p.locator('[data-action="work-new"]').click();await p.locator('#qw-file').setInputFiles(file);await p.waitForFunction(()=>qwDoc.tasks.length===1);assert.deepEqual(await p.evaluate(()=>JSON.parse(JSON.stringify(qwDoc))),expected);
  const bad=structuredClone(expected);bad.tasks[0].diagram[1].endAngle=null;const badFile=path.join(out,'rejected-arc.qwork');fs.writeFileSync(badFile,JSON.stringify(bad));
  await p.locator('#qw-file').setInputFiles(badFile);await p.waitForFunction(()=>document.body.textContent.includes('Не удалось открыть QWORK'));assert.deepEqual(await p.evaluate(()=>JSON.parse(JSON.stringify(qwDoc))),expected,'corrupt import is atomic');
  assert.deepEqual(await p.evaluate(()=>({writer:qoWriter.html,diagnostic:JSON.stringify(qdWorkingDoc())})),untouched);
  await p.reload();assert.deepEqual(await p.evaluate(()=>JSON.parse(JSON.stringify(qwDoc))),expected,'reload preserves new figures');
  for(const [width,height,dpr] of [[1366,768,1],[1440,900,1],[1920,1080,1],[2560,1440,1],[1093,614,1.25],[1280,720,1.5]])for(const theme of ['light','dark']){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);await page.evaluate(theme=>{qoThemePreference=theme;qoApplyAppearance();route('writer');},theme);await page.locator('[data-editor="writer"][data-tab="work"]').click();await page.locator('#qw-file').setInputFiles(file);await page.waitForFunction(()=>qwDoc.tasks.length===1);await page.locator('[data-qw-action="diagram"]').click();
   for(const selected of [false,true]){
    if(selected)await page.locator('[data-object-select="0"]').click();
    const geometry=await page.locator('#qw-visual-properties').evaluate(e=>{
     const inputs=[...e.querySelectorAll('input')].filter(x=>x.getClientRects().length).map(x=>x.getBoundingClientRect());
     const titles=[...e.querySelectorAll('h2,summary')].filter(x=>x.getClientRects().length).map(x=>x.getBoundingClientRect());
     return {overflow:e.scrollWidth>e.clientWidth+1,overlap:titles.some(a=>inputs.some(b=>Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top)))};
    });
    assert.deepEqual(geometry,{overflow:false,overlap:false},'inspector sections '+width+'/'+theme+'/'+selected);
    const apply=await page.locator('[data-qw-action="visual-apply"]').boundingBox();assert.ok(apply.y+apply.height<=height,'apply remains visible');
    await page.screenshot({path:path.join(out,'diagram-'+width+'x'+height+'-'+dpr+'-'+theme+'-'+(selected?'selected':'idle')+'.png')});matrix.push({width,height,dpr,theme,selected,status:'PASS'});
   }
   await context.close();
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({status:'PASS',matrix,errors,workflows:8},null,2));
  console.log('PASS TASK149.2: four real pointer tools, vertices/arcs/styles/rotation, group movement/delete/undo, QWORK and 24 desktop inspector layouts');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
