/* Inspect actual prepared editor/print geometry; independent PDF raster audit follows. */
const assert=require('node:assert/strict');
async function makeTechnicalFixture(page){
 return page.evaluate(()=>{
  const d=qwProject();d.id='task1664-graphics';d.title='Quantum Office — контроль стрелок, формул и подписей';d.layout='booklet';d.printSettings={fontPt:10,theme:'academic',showTitle:true,showMeta:false,figurePosition:'auto'};
  const O=(kind,x,y,x2,y2,width=3,extra={})=>({kind,x,y,x2,y2,label:'',style:{stroke:'#2563eb',width},...extra});
  const diagram=(prompt,objects)=>{const q=qwTask('diagram');q.prompt=prompt;q.figure='diagram';q.position='below';q.figureWidth=430;q.answerVisible=false;q.solutionVisible=false;q.diagram=objects;return q;};
  const graph=(prompt,coords,closed=false,manual=false)=>{const q=qwTask('graph');q.prompt=prompt;q.figure='graph';q.position='below';q.figureWidth=300;q.answerVisible=false;q.solutionVisible=false;q.graph=qwGraphDefault();q.graph.points=coords.map(([x,y],i)=>({x,y,label:String.fromCharCode(65+i),...(manual&&i===0?{labelPosition:{mode:'manual',dx:18,dy:-22}}:{})}));if(closed)q.graph.points.push({...q.graph.points[0],label:''});return q;};
  d.tasks=[
   diagram('Горизонтальные стрелки в обоих направлениях: толщина 1, 3, 8.',[O('arrow',30,60,220,60,1),O('arrow',450,60,270,60,3),O('arrow',40,140,220,140,8),O('arrow',450,140,260,140,8)]),
   diagram('Вертикальные и наклонные стрелки, короткие и двусторонние.',[O('arrow',60,40,60,230,4),O('arrow',140,230,140,40,4),O('arrow',200,200,300,60,3),O('doubleArrow',320,70,470,220,4),O('doubleArrow',235,235,250,235,3)]),
   diagram('Силы, скорость, ускорение и размерная линия с засечками.',[O('forceVector',60,220,60,60,4),O('velocityVector',110,220,250,220,3),O('accelerationVector',275,220,440,60,3),O('dimension',100,270,440,270,2)]),
   diagram('Момент силы в обоих направлениях, реостат.',[O('torque',25,25,170,170,3,{direction:'cw'}),O('torque',190,25,335,170,3,{direction:'ccw'}),O('rheostat',350,75,495,175,3)]),
   graph('Замкнутый прямоугольный цикл.',[[2,7],[7,7],[7,3],[2,3]],true),
   graph('Треугольный цикл.',[[4,8],[8,2],[2,2]],true),
   graph('Вогнутый многоугольник.',[[2,8],[8,8],[5,5],[8,2],[2,2]],true),
   graph('Незамкнутый график: близкие точки и оси.',[[.8,2],[2,4],[3,4.7],[8,8]],false),
   graph('Ручное положение первой подписи сохраняется.',[[2,7],[7,7],[7,3],[2,3]],true,true),
   graph('Оси графика и независимые стрелки.',[[2,2],[4,5],[8,7]],false)
  ];
  d.tasks[9].graph.elements=[{kind:'arrow',x:1,y:7,x2:3,y2:8,label:'',style:{stroke:'#2563eb',width:3}},{kind:'arrow',x:8,y:2,x2:5,y2:1,label:'',style:{stroke:'#2563eb',width:4}}];
  const plain=qwTask('short');plain.prompt='Обычный текст: h=6,6·10⁻³⁴ Дж·с; c=3·10⁸ м/с; e=1,6·10⁻¹⁹ Кл. A→B→C→D→A. x≤−2; a+b; 2×3; a−b; 6÷2. 12,5 °C.';plain.answerVisible=false;
  const rich=qwTask('short');rich.prompt='**Markdown:** h=2; x≥−3; A→B. Формула: \\(x = -2\\). Код: '+String.fromCharCode(96)+'a=2'+String.fromCharCode(96)+'.';rich.answerVisible=false;
  d.tasks.push(plain,rich);
  const axes=(prompt,config,coords,width)=>{
   const q=graph(prompt,coords);q.graph={...q.graph,...config,points:coords.map(([x,y])=>({x,y,label:''}))};q.figureWidth=width;return q;
  };
  d.tasks.push(
   axes('Оси в первом квадранте, длинные физические подписи.',{xlabel:'Время наблюдения t, с',ylabel:'Скорость vₓ, м/с'},[[0,1],[3,4],[9,6]],180),
   axes('Оси пересекаются внутри сетки, индексы и единицы.',{xmin:-5,xmax:5,ymin:-5,ymax:5,coordinateMode:'math',xlabel:'Координата x₀, м',ylabel:'Ускорение aᵧ, м/с²'},[[-4,-2],[0,1],[4,3]],300),
   axes('Положительное время, отрицательная проекция скорости.',{xmin:0,xmax:10,ymin:-6,ymax:6,coordinateMode:'positiveX',xlabel:'t, мс',ylabel:'Проекция скорости vₓ, м/с'},[[0,2],[3,5],[8,-4]],470),
   axes('Оси на краях диапазона, длинные единицы.',{xmin:2,xmax:12,ymin:2,ymax:12,coordinateMode:'custom',xlabel:'Перемещение Δx, см',ylabel:'Температура T₀, °C'},[[2,3],[5,6],[10,11]],240)
  );
  d.tasks[4].pageBreak=true;return qwValidate(d);
 });
}
function inspectGraphics(){
 const physical=[...document.querySelectorAll('.qw-print-sheet')];const pages=physical.length?physical:[...document.querySelectorAll('.qw-print-page')];
 const arrows=[],labels=[],operators=[],axisTitles=[],errors=[];
 const xy=s=>s.trim().split(/[ ,]+/).map(Number);
 const pt=(e,p)=>{const m=e.getScreenCTM(),page=e.closest('.qw-print-sheet')||e.closest('.qw-print-page'),b=page.getBoundingClientRect();return {x:(m.a*p[0]+m.c*p[1]+m.e-b.left)*.75,y:(m.b*p[0]+m.d*p[1]+m.f-b.top)*.75};};
 for(const section of document.querySelectorAll('.qw-print-section')){
  const task=Number(section.dataset.task),page=section.closest('.qw-print-sheet')||section.closest('.qw-print-page'),index=pages.indexOf(page);
  for(const e of section.querySelectorAll('[data-qw-arrow-head]')){
   const shaft=e.parentElement.querySelector('[data-qw-arrow-shaft]'),tip=xy(e.dataset.qwTip),base=xy(e.dataset.qwBase),ps=xy(shaft.getAttribute('points')),vertices=xy(e.getAttribute('points')),dx=tip[0]-base[0],dy=tip[1]-base[1],len=Math.hypot(dx,dy),projection=(x,y)=>((x-tip[0])*dx+(y-tip[1])*dy)/len;
   const ends=[ps.slice(0,2),ps.slice(-2)];if(!ends.some(p=>Math.hypot(p[0]-base[0],p[1]-base[1])<.002)||getComputedStyle(shaft).strokeLinecap!=='butt'||getComputedStyle(e).stroke!=='none')errors.push('shaft/head joint task '+task);
   if(Math.hypot(vertices[0]-tip[0],vertices[1]-tip[1])>.002||projection(vertices[2],vertices[3])>.002||projection(vertices[4],vertices[5])>.002)errors.push('head projects beyond tip task '+task);
   // Check local terminal segment including cap width, not an unrelated part of a curved arrow.
   const first=Math.hypot(ends[0][0]-base[0],ends[0][1]-base[1])<.002,prev=first?ps.slice(2,4):ps.slice(-4,-2),sw=parseFloat(getComputedStyle(shaft).strokeWidth),vx=base[0]-prev[0],vy=base[1]-prev[1],L=Math.hypot(vx,vy)||1;
   for(const sign of [-1,1])if(projection(base[0]-sign*vy/L*sw/2,base[1]+sign*vx/L*sw/2)>.01)errors.push('shaft cap beyond tip task '+task);
   arrows.push({task,page:index,tip:pt(e,tip),base:pt(e,base),color:getComputedStyle(e).fill});
  }
  for(const e of section.querySelectorAll('.qw-axis-title[data-axis-tip-x]')){
   const svg=e.closest('svg'),axis=e.dataset.axis,head=svg.querySelector('[data-qw-axis-head="'+axis+'"]');
   const tip=xy(head.getAttribute('d').match(/^M([^L]+)/)[1]);
   const getBox=node=>{const b=node.getBBox(),m=svg.getCTM().inverse().multiply(node.getCTM()),ps=[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]].map(([x,y])=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f}));return {left:Math.min(...ps.map(p=>p.x)),top:Math.min(...ps.map(p=>p.y)),right:Math.max(...ps.map(p=>p.x)),bottom:Math.max(...ps.map(p=>p.y))};};
   const b=getBox(e),vb=svg.viewBox.baseVal;
   const centerDelta=axis==='y'?(b.left+b.right)/2-tip[0]:(b.top+b.bottom)/2-tip[1],gap=axis==='y'?tip[1]-b.bottom:b.left-tip[0];
   const collisions=[...svg.querySelectorAll('.qw-axis-number')].filter(n=>{const q=getBox(n);return Math.min(q.right,b.right)-Math.max(q.left,b.left)>.01&&Math.min(q.bottom,b.bottom)-Math.max(q.top,b.top)>.01;}).map(n=>n.textContent);
   const outside=b.left<vb.x-.05||b.top<vb.y-.05||b.right>vb.x+vb.width+.05||b.bottom>vb.y+vb.height+.05;
   const scaled=pt(svg,[b.left,b.top]),scaledEnd=pt(svg,[b.right,b.bottom]);
   axisTitles.push({task,page:index,axis,text:e.textContent,centerDelta,gap,outside,collisions,compressed:e.hasAttribute('textLength')||e.hasAttribute('lengthAdjust'),box:[scaled.x,scaled.y,scaledEnd.x,scaledEnd.y],tip:pt(svg,tip),viewBox:[vb.x,vb.y,vb.width,vb.height]});
  }
  for(const e of section.querySelectorAll('[data-qw-label^="g:p:"]')){
   const b=e.getBBox(),m=e.getCTM(),svg=e.closest('svg'),inv=svg.getCTM().inverse(),T=inv.multiply(m),center={x:T.a*(b.x+b.width/2)+T.c*(b.y+b.height/2)+T.e,y:T.b*(b.x+b.width/2)+T.d*(b.y+b.height/2)+T.f},anchor={x:Number(e.dataset.labelWorldX),y:Number(e.dataset.labelWorldY)};
   labels.push({task,text:e.textContent,dx:center.x-anchor.x,dy:center.y-anchor.y,mode:e.dataset.labelMode,storedDx:Number(e.dataset.labelOffsetX),storedDy:Number(e.dataset.labelOffsetY),conflict:e.dataset.labelConflict,closed:!!e.dataset.labelContour});
  }
  for(const math of section.querySelectorAll('math')){
   for(const op of math.querySelectorAll('mo[lspace="0.28em"]')){
    const r=op.getBoundingClientRect(),p=page.getBoundingClientRect();
    operators.push({task,text:op.textContent,source:math.getAttribute('aria-label'),left:op.getAttribute('lspace'),right:op.getAttribute('rspace'),page:index,box:[(r.left-p.left)*.75,(r.top-p.top)*.75,(r.right-p.left)*.75,(r.bottom-p.top)*.75]});
   }
  }
 }
 return {arrows,labels,operators,axisTitles,errors};
}
function checkAxisTitles(proof){
 assert.ok(proof.axisTitles.length>=2,'no editable axis titles checked');
 for(const a of proof.axisTitles){
  assert.ok(Math.abs(a.centerDelta)<.2&&Math.abs(a.gap-6)<.2&&!a.outside&&!a.compressed&&!a.collisions.length,'axis title alignment/visibility '+JSON.stringify(a));
 }
}
async function checkAxisSurfaces(page,fixture,out){
 // Use the production interactive renderer and the same task-preview markup
 // used by both bank viewers. No bank/draft writes during this geometry test.
 const fs=require('node:fs'),path=require('node:path');
 await page.evaluate(fixture=>{
  const host=document.createElement('div');host.id='task1664-axis-surface-proof';host.style.cssText='position:fixed;left:-18000px;top:0;background:white;pointer-events:none;visibility:hidden';
  const wrapper=document.createElement('div');wrapper.className='qw-print-page';host.append(wrapper);
  for(const q of fixture.tasks.slice(12))for(const width of [220,500])for(const mode of ['editor','bank']){
   const section=document.createElement('section');section.className='qw-print-section';section.dataset.task=String(wrapper.children.length+1);section.style.width=width+'px';
   section.innerHTML=mode==='editor'?qwGraphSVG(q.graph,true):qwTaskPreview(q,0,'worksheet',false,null,true);
   for(const svg of section.querySelectorAll('svg')){svg.style.width='100%';svg.style.height='auto';}
   wrapper.append(section);
  }
  document.body.append(host);qwRefreshLiveGraphText(host);
 },fixture);
 try{
  const proof=await page.evaluate(inspectGraphics);fs.writeFileSync(path.join(out,'axis-live-surfaces.json'),JSON.stringify(proof.axisTitles,null,2));
  assert.equal(proof.axisTitles.length,32);checkAxisTitles(proof);
 }finally{await page.evaluate(()=>document.getElementById('task1664-axis-surface-proof')?.remove());}
}
function checkGraphics(proof,prefix){
 assert.deepEqual(proof.errors,[]);checkAxisTitles(proof);
 if(prefix==='ege2018'){
  const labels=proof.labels.filter(x=>x.task===11);
  for(const [letter,x,y] of [['A',-1,-1],['B',1,-1],['C',1,1],['D',-1,1]]){
   const l=labels.find(l=>l.text===letter);assert.ok(l&&l.closed&&l.dx*x>0&&l.dy*y>0&&l.conflict==='false',letter+' exterior '+JSON.stringify(l));
  }
  assert.equal(proof.operators.filter(x=>x.task===11&&x.text==='→').length,4);
  assert.equal(proof.operators.filter(x=>x.task===32&&x.text==='=').length,3);
 }
 if(prefix==='graphics'){
  assert.equal(proof.axisTitles.length,20);assert.ok(proof.arrows.length>=15);assert.ok(proof.operators.length>=12);
  for(const [letter,x,y] of [['A',-1,-1],['B',1,-1],['C',1,1],['D',-1,1]]){
   const l=proof.labels.find(l=>l.task===5&&l.text===letter);assert.ok(l&&l.dx*x>0&&l.dy*y>0);
  }
  assert.ok(proof.labels.filter(l=>[5,6,7,8].includes(l.task)).every(l=>l.conflict==='false'),JSON.stringify(proof.labels));
  const manual=proof.labels.find(l=>l.task===9&&l.text==='A');assert.equal(manual.mode,'manual');assert.ok(Math.abs(manual.storedDx-18)<.05&&Math.abs(manual.storedDy+22)<.05,'saved manual offset changed');assert.ok(Math.abs(manual.dx-18)<.5&&Math.abs(manual.dy+22)<.5,'actual print glyph center differs by more than half a source SVG unit '+JSON.stringify(manual));
 }
 assert.ok(proof.operators.every(x=>x.left===x.right));
}
module.exports={makeTechnicalFixture,inspectGraphics,checkGraphics,checkAxisSurfaces};
