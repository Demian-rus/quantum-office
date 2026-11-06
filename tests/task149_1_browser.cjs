/* TASK149.1: real SVG bounds, local screenshots and editor history under focus changes. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(process.env.QW_REGRESSION_ROOT||path.join(root,'evidence'),'task149.1');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true}),errors=[],report=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  const stage=page.locator('#qw-visual-stage svg');
  const shot=name=>page.screenshot({path:path.join(out,'after-'+name+'.png')});
  const change=async(selector,value)=>{await page.locator(selector).fill(String(value));await page.locator(selector).press('Tab');};
  const tool=key=>page.locator('[data-tool="'+key+'"]').click();
  const drag=async()=>{const b=await stage.boundingBox();await page.mouse.move(b.x+b.width*.3,b.y+b.height*.45);await page.mouse.down();await page.mouse.move(b.x+b.width*.6,b.y+b.height*.3,{steps:5});await page.mouse.up();};
  const checkAxes=async(name,zero)=>{
   const data=await stage.evaluate(svg=>{
    const box=e=>{const b=e.getBBox();return {x:b.x,y:b.y,w:b.width,h:b.height};};
    return {labels:[...svg.querySelectorAll('.qw-axis-number,.qw-axis-title')].map(e=>({axis:e.dataset.axis,value:e.dataset.value,box:box(e)})),
     arrows:[...svg.querySelectorAll('line[marker-end]')].map(e=>({x:+e.getAttribute('x2'),y:+e.getAttribute('y2')})),
     grid:svg.querySelectorAll('line[stroke="#d9dee4"]').length};
   });
   const labels=data.labels;
   assert.equal(labels.filter(x=>x.value==='0').length,zero,name+' origin count');
   for(let i=0;i<labels.length;i++){
    const a=labels[i].box;
    assert.ok(a.x>=0&&a.y>=0&&a.x+a.w<=520.5&&a.y+a.h<=320.5,name+' label clipped '+JSON.stringify(labels[i]));
    if(labels[i].value!==undefined){
     const vertical=data.arrows[1].x,horizontal=data.arrows[0].y;
     assert.ok(!(a.x<vertical+1&&a.x+a.w>vertical-1&&a.y<262&&a.y+a.h>30),name+' number crosses vertical axis');
     assert.ok(!(a.y<horizontal+1&&a.y+a.h>horizontal-1&&a.x<467&&a.x+a.w>82),name+' number crosses horizontal axis');
    }
    for(let j=i+1;j<labels.length;j++){
     const b=labels[j].box;
     const area=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
     assert.ok(area<.5,name+' overlapping labels '+JSON.stringify([labels[i],labels[j]]));
    }
   }
   const xt=labels.find(x=>x.axis==='x'&&x.value===undefined).box,yt=labels.find(x=>x.axis==='y'&&x.value===undefined).box;
   assert.ok(Math.abs(xt.y+xt.h-data.arrows[0].y)<25,'X title follows X arrow');
   assert.ok(Math.min(Math.abs(yt.x-data.arrows[1].x),Math.abs(yt.x+yt.w-data.arrows[1].x))<25,'Y title follows Y arrow');
   assert.ok(data.arrows[0].x>451&&data.arrows[1].y<46,'arrows extend beyond grid');
   report.push({name,...data});
  };
  await page.goto(process.env.QW_TEST_URL||pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  await page.evaluate(()=>route('writer'));
  await page.locator('[data-editor="writer"][data-tab="work"]').click();
  await page.locator('[data-qw-action="quick-add"][data-type="'+'graph'+'"]').click();
  await page.locator('[data-qw-action="graph"]').click();
  for(const mode of ['first','positiveX','math']){
   await page.locator('#qw-coordinate-mode').selectOption(mode);await checkAxes('graph-'+mode,1);await shot('graph-'+mode);
  }
  assert.equal(report.at(-1).grid,22,'default math preset retains every unit line in −5…5');
  const grid=page.locator('[data-graph-field="grid"]');await grid.uncheck();await page.keyboard.press('Control+z');
  assert.equal(await grid.isChecked(),true,'Ctrl+Z with checkbox focus restores grid');
  for(const [name,xmin,xmax,ymin,ymax,step] of [['negative',-12,-2,-9,-1,1],['positive',3,12,2,8,1],['decimal',-.3,.7,-.4,.6,.1]]){
   await page.locator('#qw-coordinate-mode').selectOption('math');
   for(const [k,v] of Object.entries({xmin,xmax,ymin,ymax,step}))await change('[data-graph-field="'+k+'"]',v);
   assert.equal(await page.locator('#qw-coordinate-mode').inputValue(),'custom');
   await checkAxes('graph-'+name,name==='decimal'?1:0);await shot('graph-'+name);
  }
  await page.locator('#qw-coordinate-mode').selectOption('math');
  await tool('line');await drag();
  const original=await stage.locator('[data-qw-element="0"] path').getAttribute('stroke');
  assert.equal(await page.locator('[data-style="stroke"]').inputValue(),original,'color control shows rendered default');
  assert.equal(await page.locator('[data-style="width"]').inputValue(),'2.5','width control shows rendered default');
  const swatch=page.locator('[data-style-key="stroke"][data-style-color="#ea580c"]');await swatch.hover();
  assert.equal(await swatch.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(234, 88, 12)','hover keeps actual swatch color');
  await page.locator('[data-style-key="stroke"][data-style-color="#dc2626"]').click();
  await page.keyboard.press('Control+z');assert.equal(await stage.locator('[data-qw-element="0"] path').getAttribute('stroke'),original,'palette redraw/lost focus undo');
  await tool('select');
  await page.locator('[data-tool="select"]').dispatchEvent('keydown',{key:'я',code:'KeyZ',ctrlKey:true,bubbles:true,cancelable:true});
  assert.equal(await stage.locator('[data-qw-element]').count(),0,'Russian physical Ctrl+Z from tool button');
  await tool('line');await drag();
  const x=await page.locator('[data-element-field="x"]').inputValue();
  await change('[data-element-field="x"]',Number(x)+1);
  await page.locator('[data-element-field="x"]').focus();await page.keyboard.press('Control+z');
  await page.locator('[data-graph-object="0"]').click();
  assert.equal(await page.locator('[data-element-field="x"]').inputValue(),x,'committed numeric input uses editor history');
  await page.locator('[data-element-field="label"]').focus();await page.locator('[data-element-field="label"]').pressSequentially('ABC');
  await page.keyboard.press('Control+z');
  assert.equal(await stage.locator('[data-qw-element]').count(),1,'dirty text undo leaves object intact');
  assert.equal(await page.locator('[data-element-field="label"]').inputValue(),'','dirty text retains native undo');
  await change('[data-element-field="label"]','Отрезок');
  await page.locator('[data-element-field="label"]').focus();await page.keyboard.press('Control+z');
  await page.locator('[data-graph-object="0"]').click();
  assert.equal(await page.locator('[data-element-field="label"]').inputValue(),'','committed label uses editor history');
  await page.locator('[data-style="stroke"]').fill('#16a34a');await page.keyboard.press('Control+z');
  assert.equal(await stage.locator('[data-qw-element="0"] path').getAttribute('stroke'),original,'native color field redraw uses editor history');
  await page.locator('[data-graph-object="0"]').click();
  await page.locator('[data-tool="select"]').click();
  await page.locator('#qw-visual-stage').focus();await page.keyboard.press('Escape');
  await page.locator('[data-graph-object="0"]').click();
  assert.equal(await page.locator('#qw-visual-properties').evaluate(e=>e.scrollTop),0,'choosing an object reveals its properties at the top');
  await shot('graph-selected');
  for(const [width,height] of [[1093,614],[768,720]]){
   await page.setViewportSize({width,height});
   if(width<1001)await page.locator('[data-visual-panel="properties"]').click();
   await shot('graph-selected-'+width);
   assert.ok(await page.locator('#qw-visual-properties').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
   if(width<1001)await page.locator('[data-visual-panel="properties"]').click();
  }
  await page.setViewportSize({width:1440,height:900});await page.locator('[data-qw-action="visual-apply"]').click();
  await page.locator('[data-qw-action="diagram"]').click();await page.locator('#qw-diagram-preset').selectOption('incline');await shot('diagram');
  await page.locator('[data-object-select="1"]').click();
  await page.locator('[data-style-key="stroke"][data-style-color="#dc2626"]').click();await page.keyboard.press('Control+z');
  assert.equal(await stage.locator('[data-qw-object="1"] rect').getAttribute('stroke'),'#162735','diagram style undo after redraw');
  await page.locator('[data-object-select="1"]').click();
  await page.locator('#qw-object-label').focus();await page.locator('#qw-object-label').pressSequentially('AB');await page.keyboard.press('Control+z');
  assert.equal(await page.locator('#qw-object-label').inputValue(),'m','diagram dirty text retains native undo');
  await change('#qw-object-label','Брусок');await page.locator('#qw-object-label').focus();await page.keyboard.press('Control+z');
  await page.locator('[data-object-select="1"]').click();
  assert.equal(await page.locator('#qw-object-label').inputValue(),'m','diagram committed text uses editor history');
  await shot('diagram-selected');
  for(const [width,height] of [[1093,614],[768,720]]){
   await page.setViewportSize({width,height});
   if(width<1001)await page.locator('[data-visual-panel="tools"]').click();
   await shot('diagram-tools-'+width);
   const cols=await page.locator('.qw-tool-group>div').first().evaluate(e=>getComputedStyle(e).gridTemplateColumns);
   assert.equal(cols.split(' ').length,2);
   if(width<1001)await page.locator('[data-visual-panel="properties"]').click();
   await shot('diagram-properties-'+width);
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',report},null,2));
  console.log('PASS TASK149.1: six coordinate ranges, real SVG bounds, editor/native undo, Russian layout, desktop and narrow screenshots');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
