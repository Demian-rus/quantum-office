const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),evidence=path.join(root,'evidence','ux-02');
const source=require('../content/physics-ege-2019-variant-1.cjs');

async function main(){
 const release=pathToFileURL(path.join(root,'Quantum-Office.html')).href;
 const shots=path.join(evidence,'screenshots');fs.mkdirSync(shots,{recursive:true});
 const browser=await chromium.launch({ignoreDefaultArgs:['--hide-scrollbars']}),errors=[];
 try{
  const page=await browser.newPage({offline:true,viewport:{width:1920,height:1080}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(release);
  await page.evaluate(row=>{
   route('work');
   const graph={...qwTask('graph'),title:row.title,prompt:row.prompt,comment:row.solution,publishing:{figure:{width:43,maxMm:75,position:'below',align:'center',gapMm:2}}};
   graph.graph={...graph.graph,...row.graph,points:row.graph.points.map(([x,y])=>({x,y}))};
   qwDoc=qwValidate({...qwProject(),layout:'booklet',tasks:[graph]});
   qwSelected=graph.id;qwRender();
  },source[0]);
  const editor=page.locator('#qw-task-editor'),scale=editor.locator('[data-publish-zoom]');
  const sheet=editor.locator('[data-bank-rich=prompt]'),condition=sheet.locator('[data-bank-live=prompt]');
  const checkGap=async()=>{
   const actual=await sheet.evaluate(el=>{
    const text=el.querySelector('[data-bank-live]'),figure=el.querySelector('.qw-bank-live-figure figure');
    return {paper:el.getBoundingClientRect().width,verticalGap:figure.getBoundingClientRect().top-text.getBoundingClientRect().bottom,
     text:text.getBoundingClientRect().height};
   });
   assert.ok(actual.verticalGap>=6&&actual.verticalGap<=9,JSON.stringify(actual));
   assert.ok(actual.text<90,JSON.stringify(actual));
   return actual;
  };
  const baseline=await checkGap();
  const math=sheet.locator('.qw-axis-title[data-axis=y] [data-qw-science-math]');
  assert.equal(await math.getAttribute('data-qw-science-math'),'v_x, м/с');
  assert.doesNotMatch(await math.textContent(),/_/);
  const subtype=await page.evaluate(()=>{
   const samples=['v_x','v_{0x}','F_{тр}','\\vec{F}_{тр}','\\vec{v}_0','a_y','B_x','\\vec{E}','t^2','\\varepsilon_1','\\frac{|\\vec{v}_0|}{t}', 'Скорость \\(v_x\\), м/с'];
   const markup=qwDiagramSVG(samples.map((label,i)=>({kind:'text',x:45+i%3*165,y:48+Math.floor(i/3)*57,x2:45,y2:48,label})));
   const svg=document.createElement('div');svg.innerHTML=markup;
   const unsafe=qwScienceExpression('notes_example');
   return {markup,count:svg.querySelectorAll('[data-qw-science-math]').length,unsafe};
  });
  assert.equal(subtype.count,12);assert.equal(subtype.unsafe,null);
  fs.writeFileSync(path.join(evidence,'math-labels.svg'),subtype.markup);
  const workBefore=await page.evaluate(()=>JSON.stringify(qwDoc));
  await scale.selectOption('200');
  const doubled=await sheet.evaluate(el=>({physical:el.getBoundingClientRect().width,width:getComputedStyle(el).width,zoom:getComputedStyle(el).zoom,scrollWidth:el.closest('.qw-edit-scroll').clientWidth,css:getComputedStyle(el).getPropertyValue('--qw-editor-width')}));
  assert.ok(Math.abs(doubled.physical/baseline.paper-2)<.005,JSON.stringify({baseline,doubled}));
  assert.equal(await condition.evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),16);
  const scroll=editor.locator('.qw-edit-scroll');
  assert.ok(await scroll.evaluate(el=>el.scrollWidth>el.clientWidth));
  await page.setViewportSize({width:1920,height:720});
  const paperArea=await scroll.boundingBox();
  await page.mouse.move(paperArea.x+paperArea.width/2,paperArea.y+paperArea.height/2);
  await page.mouse.wheel(0,520);
  await page.waitForFunction(()=>document.querySelector('.qw-edit-scroll').scrollTop>80);
  await scroll.evaluate(el=>{el.scrollTop=0;});
  const gripX=paperArea.x+paperArea.width-5;
  await page.mouse.move(gripX,paperArea.y+36);
  await page.mouse.down();
  await page.mouse.move(gripX,paperArea.y+180,{steps:8});
  await page.mouse.up();
  assert.ok(await scroll.evaluate(el=>el.scrollTop>25),'the resize divider must leave the scrollbar draggable');
  await page.setViewportSize({width:1920,height:1080});
  await editor.locator('[data-bank-source]').click();
  assert.equal(await scale.inputValue(),'200');
  assert.equal(await editor.locator('[data-publish-zoom]:visible').count(),1);
  await editor.locator('[data-bank-source]').click();
  await editor.locator('[data-bank-publish-toggle]').click();
  const frame=editor.locator('[data-bank-publish-frame]');
  const inner=frame.contentFrame();
  await inner.locator('.qw-print-page .qw-axis-title [data-qw-science-math]').waitFor();
  assert.equal(await frame.evaluate(el=>el.style.zoom),'2');
  assert.equal(await scale.inputValue(),'200');
  const geometry=()=>frame.evaluate(f=>{
   const p=f.contentDocument.querySelector('.qw-print-page'),img=p.querySelector('figure');
   return {sheet:p.offsetWidth,height:p.offsetHeight,figure:Math.round(img.getBoundingClientRect().width*10)/10,pages:f.contentWindow.__qwPrintLayout.sheets};
  });
  const unscaled=await geometry();
  await editor.locator('[data-zoom-step="-1"]').click();
  assert.equal(await scale.inputValue(),'175');
  await scale.selectOption('100');
  assert.deepEqual(await geometry(),unscaled);
  await editor.locator('[data-publish-fit=page]').click();
  assert.ok(+await scale.inputValue()<100);
  await page.screenshot({path:path.join(shots,'preview-fit.png')});
  await editor.locator('[data-bank-publish-toggle]').click();
  await scale.selectOption('100');
  await checkGap();
  assert.equal(await page.evaluate(()=>JSON.stringify(qwDoc)),workBefore);
  await editor.locator('.qw-zoom').screenshot({path:path.join(shots,'zoom.png')});
  await page.screenshot({path:path.join(shots,'editor.png')});
  await page.locator('[data-action=work-preview]').click();
  await page.locator('#qw-print-preview-frame').contentFrame().locator('.qw-print-page').waitFor();
  await page.locator('#qw-dialog [data-publish-fit=page]').click();
  await page.screenshot({path:path.join(shots,'export.png')});
  await page.locator('#qw-dialog [data-qw-close]').click();
  await page.mouse.move(4,4);
  for(const theme of ['light','dark']){
   await page.evaluate(t=>{qoThemePreference=t;qoApplyAppearance();},theme);
   for(const routeName of ['writer','sheet','slides','diagnostics','work']){
    await page.evaluate(r=>route(r),routeName);
    const paint=await page.evaluate(()=>({thumb:getComputedStyle(document.body,'::-webkit-scrollbar-thumb').backgroundColor,track:getComputedStyle(document.body,'::-webkit-scrollbar-track').backgroundColor,width:getComputedStyle(document.body,'::-webkit-scrollbar').width,normal:getComputedStyle(document.body).getPropertyValue('--qo-scrollbar').trim(),hover:getComputedStyle(document.body).getPropertyValue('--qo-muted').trim()}));
    assert.equal(paint.width,'11px');assert.equal(paint.track,'rgba(0, 0, 0, 0)');
    assert.equal(paint.normal,theme==='light'?'#9ca9bb':'#69798f');
    const rgb=hex=>'rgb('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')+')';
    assert.ok([paint.normal,paint.hover].map(rgb).includes(paint.thumb),paint.thumb);
   }
  }
  await page.evaluate(()=>{qoThemePreference='light';qoApplyAppearance();route('sheet');});
  const grid=page.locator('#grid-scroll');
  assert.ok(await grid.evaluate(el=>el.scrollHeight>el.clientHeight*2));
  const area=await grid.boundingBox();
  await page.mouse.move(area.x+area.width*.5,area.y+area.height*.5);
  await page.mouse.wheel(0,840);
  await page.waitForFunction(()=>document.querySelector('#grid-scroll').scrollTop>80);
  assert.ok(await page.locator('#grid-canvas [role=gridcell]').count()>10);
  assert.deepEqual(errors,[]);
  console.log('PASS 200% real size, one zoom through three modes, stable A4, figure gap, math captions and application scrollbars');
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
