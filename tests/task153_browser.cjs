/* TASK153: genuine vector PDF acceptance of exam-style booklet. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task153');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const app=await browser.newPage(),errors=[];
 app.on('pageerror',e=>errors.push(e.message));
 try{
  await app.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  const prepared=await app.evaluate(()=>{
   const d=qwProject();d.title='Тренировочный сборник: математика и физика';
   d.subject='mixed';d.grade='11';d.variant='1';d.layout='booklet';d.topic='';
   d.printSettings={fontPt:10.5,figurePosition:'auto',topicHeadings:true};
   const prompts=[
    'Мяч брошен вертикально вверх со скоростью 20 м/с. Найдите максимальную высоту подъёма.',
    'Тело перемещается по закону \\(x(t)=2t^{2}+3t\\). Определите скорость через 4 секунды.',
    'В правильной четырёхугольной пирамиде ребро основания равно 6 см, высота 4 см. Найдите площадь боковой поверхности.',
    'На рисунке показана зависимость координаты от времени. Определите среднюю скорость от 0 до 6 с.',
    'Найдите значение выражения \\(\\frac{3^{4}\\cdot9^{2}}{27^{2}}\\).',
    'Автомобиль массой 1200 кг разогнался до 15 м/с за 10 с. Определите равнодействующую силу.',
    'По рисунку определите направление равнодействующей двух сил.',
    'В цепи последовательно соединены резисторы с сопротивлениями 4 Ом и 6 Ом. Найдите общее сопротивление.',
    'Тело находится под действием взаимно перпендикулярных сил 6 Н и 8 Н. Найдите их равнодействующую.',
    'Решите уравнение \\(\\sqrt{x+5}=4\\).',
    'График \\(y=ax^{2}+bx+c\\) пересекает ось y при 3. Найдите \\(c\\).',
    'Найдите количество теплоты для нагревания 2 кг воды на 15 градусов. Удельная теплоёмкость 4200 Дж/(кг·°C).',
    'По схеме определите, какова натяжение каждой ветви нити идеального подвижного блока.',
    'Решите неравенство \\(x^{2}-9>0\\).',
    'Тело движется со скоростью 12 м/с. Какой путь оно пройдёт за 2 минуты?',
    'Найдите корни уравнения \\(x^{2}-6x+5=0\\).'
   ];
   d.tasks=prompts.map((prompt,i)=>{
    const q=qwTask([2,10].includes(i)?'extended':'short');q.prompt=prompt;q.answerVisible=q.type!=='extended';q.part='Часть 1';
    q.figure='none';
    if(i===3){q.figure='graph';q.graph=qwGraphDefault();q.graph.xmin=0;q.graph.xmax=6;q.graph.ymax=8;q.graph.points=[{x:0,y:1,label:'A'},{x:2,y:3,label:'B'},{x:4,y:4,label:'C'},{x:6,y:7,label:'D'}];}
    if(i===6){q.figure='diagram';q.diagram=[{kind:'block',x:200,y:150,x2:300,y2:240,label:'m'},{kind:'ground',x:110,y:240,x2:420,y2:240,label:''},{kind:'arrow',x:250,y:150,x2:250,y2:80,label:'N'}];}
    return q;
   });
   const before=JSON.stringify(d),normalized=qwValidate(d),html=qwPrintDocumentHTML(normalized,false,{format:'booklet',theme:''});
   const old=qwPrintDocumentHTML({...normalized,layout:'compact'},false,{format:'compact'});
   return {html,qwork:JSON.stringify(normalized,null,2),unchanged:before===JSON.stringify(d),
    legacy:old.includes('data-qw-format="compact"'),printedTasks:d.tasks.length};
  });
  assert.ok(prepared.unchanged,'the print preview cannot mutate QWORK data');
  assert.ok(prepared.legacy,'existing compact mode is still available');
  assert.equal(prepared.printedTasks,16);
  fs.writeFileSync(path.join(out,'booklet.qwork'),prepared.qwork);
  const print=await browser.newPage();print.on('pageerror',e=>errors.push(e.message));
  await print.setContent(prepared.html);await print.evaluate(()=>window.qwPrintReady);
  assert.equal(await print.evaluate(()=>window.__qwPrintError),undefined);
  const data=await print.evaluate(()=>{
   const pages=[...document.querySelectorAll('.qw-print-page')],report=window.__qwPrintLayout,all=[...document.querySelectorAll('.qw-print-section')];
   const collisions=[];const overflow=[];
   for(const section of all){
    const figure=section.querySelector('figure'),text=section.querySelector('.qw-task-text');
    if(figure&&text){
     const fb=figure.getBoundingClientRect(),walk=document.createTreeWalker(text,NodeFilter.SHOW_TEXT);let node;
     while(node=walk.nextNode()){if(!node.textContent.trim())continue;const r=document.createRange();r.selectNodeContents(node);
      for(const b of r.getClientRects())if(Math.min(b.right,fb.right)-Math.max(b.left,fb.left)>.5&&Math.min(b.bottom,fb.bottom)-Math.max(b.top,fb.top)>.5)collisions.push(section.dataset.task);
     }
    }
    const page=section.closest('.qw-print-page'),b=section.getBoundingClientRect(),c=page.querySelector('.qw-page-content').getBoundingClientRect();
    if(b.left<c.left-1||b.right>c.right+1||b.bottom>c.bottom+1)overflow.push(section.dataset.task);
   }
   return {pages:report.pages.length,taskIds:all.map(x=>Number(x.dataset.task)),fragments:report.pages,boxCount:document.querySelectorAll('.qw-booklet-entry>header').length,
    answers:document.querySelectorAll('.qw-booklet-answer').length,brand:document.querySelectorAll('.qw-print-brand').length,
    topics:document.querySelectorAll('.qw-topic-title').length,figures:document.querySelectorAll('.qw-print-section svg').length,
    collisions,overflow};
  });
  assert.ok(data.pages>=1&&data.pages<=3,JSON.stringify(data.fragments.map(x=>x.tasks)));
  assert.equal(data.taskIds.length,16);assert.deepEqual(data.taskIds,Array.from({length:16},(_,i)=>i+1));
  assert.equal(data.boxCount,16);assert.equal(data.answers,14);
  assert.ok(data.figures>=2);assert.equal(data.brand,data.pages);assert.equal(data.topics,0);
  assert.deepEqual(data.collisions,[]);assert.deepEqual(data.overflow,[]);
  for(const p of data.fragments)assert.ok(p.freeMm>=-.5,'page overflow '+p.page);
  await print.emulateMedia({media:'print'});
  const pdf=path.join(out,'booklet.pdf');await print.pdf({path:pdf,preferCSSPageSize:true,printBackground:true});
  assert.ok(fs.statSync(pdf).size>8000);
  await print.screenshot({path:path.join(out,'last-page.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'PASS',pages:data.pages,tasks:data.taskIds.length,figures:data.figures,pdfBytes:fs.statSync(pdf).size,freeMm:data.fragments.map(x=>x.freeMm)},null,2));
  console.log('PASS TASK153: 16 boxed tasks, SVG figures, PDF, no clipping, old compact preserved');
  await print.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
