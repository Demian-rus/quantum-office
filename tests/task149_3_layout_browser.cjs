/* Pagination boundaries, manual layouts, mathematical baselines and raster parity. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=process.env.QW_TASK1493_EVIDENCE||path.join(root,'evidence/task149.3');
(async()=>{
 const browser=await chromium.launch({headless:true}),app=await browser.newPage(),errors=[],checks=[];
 app.on('pageerror',e=>errors.push(e.message));
 const {task149Sample}=await import('./fixtures/task149_2_sample.js');const {task149CompactSamples}=await import('./fixtures/task149_3_samples.js');
 try{
  await app.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  async function render(project,teacher=false){
   const html=await app.evaluate(({d,t})=>qwPrintDocumentHTML(d,t),{d:project,t:teacher}),p=await browser.newPage({viewport:{width:1000,height:1200}});p.on('pageerror',e=>errors.push(e.message));await p.setContent(html);await p.evaluate(()=>window.qwPrintReady);
   assert.equal(await p.evaluate(()=>window.__qwPrintError),undefined);return p;
  }
  const old=task149Sample(),before=JSON.stringify(old),manual=await render(old);
  const manualReport=await manual.evaluate(()=>window.__qwPrintLayout);
  const task3Page=manualReport.pages.find(p=>p.tasks.some(t=>t.task===3)).page;assert.ok(task3Page>=2,'explicit page break is honored');
  assert.ok(await manual.locator('.qw-print-has-figure').evaluateAll(es=>es.every(e=>e.classList.contains('qw-figure-below'))));assert.equal(JSON.stringify(old),before);
  checks.push({name:'manual placement and explicit page break',pages:manualReport.pages.length,status:'PASS'});await manual.close();

  const long=task149CompactSamples()[0].project;long.tasks=long.tasks.slice(0,2);long.tasks[0].prompt=('Тело движется вдоль прямой. Измерения повторяют через равные интервалы времени. Объясните, какие данные нужны для определения скорости. ').repeat(60)+'Заключение: приведите формулу \\(v=\\frac{s}{t}\\).';long.tasks[0].solutionVisible=true;long.tasks[0].solutionHeight=170;
  long.tasks[0].criteria=('Критерий: приведена формула и объяснён смысл каждой величины. ').repeat(70);
  const expected=await app.evaluate(d=>{const e=document.createElement('div');e.innerHTML=qwContentHTML(d.tasks[0].prompt);return e.textContent.replace(/\s+/g,' ').trim();},long);
  const stress=await render(long,false),stressReport=await stress.evaluate(()=>window.__qwPrintLayout);
  assert.ok(stressReport.pages.length>1);
  const actual=await stress.locator('.qw-print-section[data-task="1"] .qw-task-text').allTextContents();assert.equal(actual.join('').replace(/\s+/g,' ').trim(),expected,'long task text is not lost');
  assert.equal(await stress.locator('figure').count(),2,'an illustration is never repeated on continuation pages');
  assert.equal(await stress.locator('.qw-solution-preview').count(),1,'manual solution area stays intact');
  for(const p of stressReport.pages)assert.ok(p.freeMm>=-.2,'no long-task overflow');
  assert.ok(stressReport.pages.every(p=>p.tasks.length>0),'no empty pages');
  assert.equal(await stress.locator('.qw-teacher-notes').count(),0,'criteria are not printed on student pages');
  for(let i=0;i<stressReport.pages.length;i++)await stress.locator('.qw-print-page').nth(i).screenshot({path:path.join(out,'long-layout-page-'+(i+1)+'.png')});
  fs.mkdirSync(path.join(out,'stress'),{recursive:true});await stress.pdf({path:path.join(out,'stress/long-layout.pdf'),preferCSSPageSize:true,printBackground:true});
  checks.push({name:'long student conditions and manual solution area',pages:stressReport.pages.length,status:'PASS',layout:stressReport});await stress.close();

  const wide=task149CompactSamples()[0].project;wide.tasks=wide.tasks.slice(2,3);wide.tasks[0].position='below';wide.tasks[0].figureWidth=470;
  const full=await render(wide);const width=await full.locator('figure').evaluate(e=>e.getBoundingClientRect().width*25.4/96);assert.ok(width>170,'manual full width is available');await full.close();
  const left=task149CompactSamples()[0].project;left.tasks=left.tasks.slice(0,1);left.tasks[0].position='left';left.tasks[0].answerVisible=false;
  const lp=await render(left);assert.ok(await lp.locator('.qw-task-flow').evaluate(e=>e.querySelector('figure').getBoundingClientRect().right+10<=e.querySelector('.qw-task-text').getBoundingClientRect().left));assert.equal(await lp.locator('.qw-answer-preview').count(),0);await lp.close();checks.push({name:'left/full-width and disabled answer',status:'PASS'});

  const clipped=task149CompactSamples()[0].project;clipped.tasks=clipped.tasks.slice(2,3);clipped.tasks[0].graph.elements=[{kind:'point',x:1000,y:1000,label:'Вне диапазона'}];
  const cp=await render(clipped);assert.ok(await cp.locator('figure svg').evaluate(e=>e.viewBox.baseVal.width<600),'invisible out-of-range elements do not shrink the graph');await cp.close();
  const equation=task149CompactSamples()[0].project;equation.tasks=equation.tasks.slice(2,3);equation.tasks[0].prompt='Упростите \\('+'W'.repeat(42)+'\\).';
  const ep=await render(equation);assert.equal(await ep.locator('.qw-print-section').getAttribute('data-layout-reason'),'wide-formula');assert.ok(await ep.locator('.qw-task-flow').evaluate(e=>e.querySelector('.qw-task-text').getBoundingClientRect().bottom<=e.querySelector('figure').getBoundingClientRect().top));await ep.close();
  const rasterWide=await app.evaluate(async d=>{const words=[],figures=[],oldText=CanvasRenderingContext2D.prototype.fillText,oldImage=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.fillText=function(t,x,y,...rest){if(t==='W')words.push({x,y});return oldText.call(this,t,x,y,...rest);};CanvasRenderingContext2D.prototype.drawImage=function(image,x,y,...rest){figures.push({x,y});return oldImage.call(this,image,x,y,...rest);};try{await qwRenderPages(d,false);return {words,figures};}finally{CanvasRenderingContext2D.prototype.fillText=oldText;CanvasRenderingContext2D.prototype.drawImage=oldImage;}},equation);
  assert.equal(rasterWide.words.length,42);assert.ok(rasterWide.words.every(w=>w.y<rasterWide.figures[0].y),'raster wide formula precedes image');checks.push({name:'wide formula uses full text width without mutating placement',status:'PASS'});
  const tooWide=task149CompactSamples()[2].project;tooWide.tasks=tooWide.tasks.slice(0,1);tooWide.tasks[0].prompt='Вычислите \\('+'W'.repeat(150)+'\\).';
  const rejected=await browser.newPage();await rejected.setContent(await app.evaluate(d=>qwPrintDocumentHTML(d),tooWide));await rejected.evaluate(()=>window.qwPrintReady);
  assert.match(await rejected.evaluate(()=>window.__qwPrintError),/Формула шире страницы/);assert.equal(await rejected.locator('.qw-print-page').count(),0,'unbreakable oversized math is rejected rather than clipped');await rejected.close();
  assert.match(await app.evaluate(()=>{try{qwPrintDocumentHTML(qwProject());return '';}catch(e){return e.message;}}),/Добавьте задания/);checks.push({name:'empty/oversized document rejection',status:'PASS'});

  const probe=await browser.newPage({viewport:{width:1000,height:900}});const typography=await app.evaluate(()=>({styles:qwPrintStyles(),items:['30^{°}','g=10\\mathrm{м/с^{2}}','F=mg','x^{2}-4x+3','a_{1}','F_{1}','\\frac{3}{4}','\\sqrt{x}','0{,}25','(-3)^{2}'].map(s=>qwContentHTML('\\('+s+'\\)'))}));
  await probe.setContent('<style>'+typography.styles+'.probe{margin:12px;line-height:1.35}.mark{display:inline-block;width:0;height:0;vertical-align:baseline}</style>'+typography.items.map((h,i)=>'<p class="probe"><span class="plain">Обычный текст 30°</span><i class="mark"></i> '+h+' обычный текст</p>').join(''));await probe.evaluate(()=>document.fonts.ready);
  const metrics=await probe.locator('.probe').evaluateAll(ps=>ps.map(p=>{const m=p.querySelector('math'),s=p.querySelector('.plain'),a=m.getBoundingClientRect(),b=s.getBoundingClientRect(),r=p.getBoundingClientRect(),baseline=p.querySelector('.mark').getBoundingClientRect().top;return {font:parseFloat(getComputedStyle(m).fontSize),plainFont:parseFloat(getComputedStyle(s).fontSize),baselineDifference:a.bottom-b.bottom,height:r.height,mathHeight:a.height,mathBelowBaseline:a.bottom-baseline,plainBelowBaseline:b.bottom-baseline};}));
  fs.writeFileSync(path.join(out,'typography-metrics.json'),JSON.stringify(metrics,null,2));await probe.screenshot({path:path.join(out,'math-typography.png')});
  assert.ok(metrics.every(m=>Math.abs(m.font-m.plainFont)<.01),'inline math inherits ordinary font size');assert.ok(Math.abs(metrics[0].mathBelowBaseline)<.5,'degree and digits end at the native baseline');assert.ok(Math.abs(metrics[1].baselineDifference)<5,'upright units baseline');assert.ok(metrics[6].height>=metrics[6].mathHeight-1,'fraction gets sufficient line height');
  const decimal=await probe.locator('.probe').nth(8).evaluate(p=>{const es=[...p.querySelectorAll('mn,mo')].map(e=>e.getBoundingClientRect());return [es[1].left-es[0].right,es[2].left-es[1].right];});assert.ok(decimal.every(g=>Math.abs(g)<.5),'decimal comma is not separated from its digits');
  await probe.screenshot({path:path.join(out,'math-typography.png')});checks.push({name:'math typography',status:'PASS',metrics});await probe.close();
  const raster=await app.evaluate(async()=>{
   const captured=[],old=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...args){captured.push({text:String(t),font:this.font});return old.call(this,t,...args);};
   try{const c=document.createElement('canvas'),ctx=c.getContext('2d');qwMathBox(ctx,qwMath('g=10\\mathrm{м/с^{2}}'),11).draw(0,30);const degree=qwMathBox(ctx,qwMath('30^{°}'),11),plain=qwMathBox(ctx,qwMath('30°'),11);return {captured,degree:{a:degree.a,d:degree.d},plain:{a:plain.a,d:plain.d}};}finally{CanvasRenderingContext2D.prototype.fillText=old;}
  });
  assert.deepEqual(raster.degree,raster.plain);assert.ok(raster.captured.some(x=>x.text==='g'&&x.font.includes('italic')));assert.ok(raster.captured.some(x=>x.text==='м'&&!x.font.includes('italic')));checks.push({name:'raster math baseline and upright units',status:'PASS'});
  for(const {name,project} of task149CompactSamples())for(const teacher of [false]){
   const pngs=await app.evaluate(async({d,t})=>(await qwRenderPages(d,t,{answers:true,criteria:false,comments:false})).map(c=>c.toDataURL('image/png')),{d:project,t:teacher});
   assert.equal(pngs.length,1,'raster compact sample '+name);for(let i=0;i<pngs.length;i++)fs.writeFileSync(path.join(out,name+(teacher?'-Teacher':'')+'-raster-'+(i+1)+'.png'),Buffer.from(pngs[i].split(',')[1],'base64'));
   checks.push({name:name+(teacher?'-Teacher':'')+' raster',pages:pngs.length,status:'PASS'});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'layout-tests.json'),JSON.stringify({status:'PASS',checks,errors},null,2));console.log('PASS TASK149.3 layout: long fragments, manual layout, clipped geometry, formula baselines and raster math');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
