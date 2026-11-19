/* TASK153.1 / TASK152.1: real Chromium PDF + geometry acceptance. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task1531');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const app=await browser.newPage(),errors=[];
 app.on('pageerror',e=>errors.push(e.message));
 try{
  await app.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  const doc=await app.evaluate(()=>{
   const d=qwProject();d.title='Тренировочный сборник по физике и математике';d.subject='mixed';d.grade='11';d.variant='1';d.topic='';d.layout='booklet';
   d.printSettings={fontPt:10.5,figurePosition:'auto',topicHeadings:true};
   const samples=[
    'Мяч брошен вертикально вверх со скоростью 20 м/с. Найдите высоту подъёма.',
    'Тело перемещается согласно закону \\(x(t)=2t^{2}+3t\\). Найдите скорость через 4 секунды.',
    'В правильной пирамиде сторона основания равна 6 см, высота равна 4 см. Найдите площадь.',
    'На рисунке показана зависимость координаты от времени. Найдите среднюю скорость от 0 до 6 с.',
    'Найдите значение выражения \\(\\frac{3^{4}\\cdot 9^{2}}{27^{2}}\\).',
    'Автомобиль разгоняется от 0 до 15 м/с за 10 с. Найдите ускорение.',
    'По рисунку определите равнодействующую сил, действующих на брусок.',
    'Найдите общее сопротивление двух последовательно соединённых резисторов.',
    'Тело находится под действием взаимно перпендикулярных сил 6 Н и 8 Н.',
    'Решите уравнение \\(\\sqrt{x+5}=4\\).',
    'График функции \\(y=ax^{2}+bx+c\\) пересекает Oy в точке 3. Найдите коэффициент \\(c\\).',
    'Найдите количество теплоты, необходимое для нагревания воды.',
    'На рисунке изображён идеальный подвижный блок. Найдите натяжение нитей.',
    'Решите неравенство \\(x^{2}-9>0\\).',
    'Найдите путь при равномерном движении за 2 минуты.',
    'Найдите корни уравнения \\(x^{2}-6x+5=0\\).'
   ];
   d.tasks=samples.map((prompt,i)=>{
    const q=qwTask(i===10?'extended':'short');q.prompt=prompt;q.answerVisible=i!==10;
    if(i===3){q.figure='graph';q.graph=qwGraphDefault();q.graph.xmin=0;q.graph.xmax=6;q.graph.ymax=8;q.graph.points=[{x:0,y:1,label:'A'},{x:2,y:3,label:'B'},{x:4,y:4,label:'C'},{x:6,y:7,label:'D'}];}
    if(i===6){q.figure='diagram';q.diagram=[{kind:'ground',x:90,y:240,x2:450,y2:240,label:''},{kind:'block',x:200,y:170,x2:300,y2:240,label:'m'},{kind:'arrow',x:250,y:170,x2:250,y2:90,label:'N'}];}
    if(i===12){q.figure='diagram';q.diagram=[{kind:'ground',x:90,y:40,x2:430,y2:40,label:''},{kind:'movablePulley',x:220,y:150,x2:292,y2:222,label:''},{kind:'rope',x:220,y:40,x2:220,y2:118,label:''},{kind:'rope',x:292,y:40,x2:292,y2:118,label:''},{kind:'block',x:232,y:235,x2:280,y2:280,label:'m'}];}
    return q;
   });
   return qwValidate(d);
  });
  const original=JSON.stringify(doc);
  const render=async(name,theme='')=>{
   const html=await app.evaluate(({doc,theme})=>qwPrintDocumentHTML(doc,false,{format:'booklet',theme}),{doc,theme});
   const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));await page.setContent(html);await page.evaluate(()=>window.qwPrintReady);
   assert.equal(await page.evaluate(()=>window.__qwPrintError),undefined);
   const data=await page.evaluate(()=>{
    const pages=[...document.querySelectorAll('.qw-print-page')],tasks=[...document.querySelectorAll('.qw-print-section')];
    const bounds=e=>e.getBoundingClientRect(),figure=document.querySelector('[data-task="4"] figure'),answer=document.querySelector('[data-task="4"] .qw-booklet-answer'),body=document.querySelector('[data-task="4"] .qw-task-text');
    const collisions=[];for(const section of tasks){const f=section.querySelector('figure'),t=section.querySelector('.qw-task-text');if(!f||!t)continue;
      const fr=bounds(f),walker=document.createTreeWalker(t,NodeFilter.SHOW_TEXT);let node;
      while(node=walker.nextNode()){if(!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);
       for(const r of range.getClientRects())if(Math.min(r.right,fr.right)-Math.max(r.left,fr.left)>.5&&Math.min(r.bottom,fr.bottom)-Math.max(r.top,fr.top)>.5)collisions.push(section.dataset.task);}
    }
    return {pages:pages.length,taskIds:tasks.map(x=>Number(x.dataset.task)),headers:pages.map(p=>p.querySelector('.qw-running-header')?.textContent||''),meta:pages.map(p=>p.querySelector('.qw-print-meta')?.textContent||''),brands:pages.map(p=>p.querySelector('.qw-booklet-brand svg[aria-label]')?.getAttribute('aria-label')||''),collisions,answer:{left:bounds(answer).left,bottom:bounds(answer).bottom},figure:{left:bounds(figure).left,bottom:bounds(figure).bottom},text:{bottom:bounds(body).bottom},mathPads:document.querySelectorAll('math msup mpadded').length,
     sqrt:document.querySelectorAll('math msqrt').length,figures:document.querySelectorAll('.qw-print-section svg').length,
     footer:pages.map(p=>p.querySelector('.qw-page-footer')?.textContent||''),report:window.__qwPrintLayout};
   });
   assert.ok(data.pages>=2&&data.pages<=3);
   assert.deepEqual(data.taskIds,Array.from({length:16},(_,i)=>i+1));
   assert.deepEqual(data.headers,Array(data.pages).fill(''));
   assert.deepEqual(data.meta,Array(data.pages).fill(''));
   assert.deepEqual(data.collisions,[]);
   assert.ok(data.answer.left<data.figure.left&&Math.abs(data.answer.bottom-data.figure.bottom)<10);
   assert.ok(data.answer.left>0&&data.text.bottom<data.answer.bottom);
   assert.ok(data.mathPads>=2&&data.sqrt===1&&data.figures>=3);
   assert.equal(data.brands.filter(Boolean).length,theme?data.pages:0);
   for(const p of data.report.pages)assert.ok(p.freeMm>=-.7,'page overflow');
   await page.emulateMedia({media:'print'});
   const pdf=path.join(out,name+'.pdf');await page.pdf({path:pdf,preferCSSPageSize:true,printBackground:true});
   assert.ok(fs.statSync(pdf).size>10000);
   await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
   await page.close();return {name,pages:data.pages,answers:data.taskIds.length,fonts:'MathML',brands:data.brands,pdfBytes:fs.statSync(pdf).size};
  };
  const plain=await render('booklet-clean'),academic=await render('booklet-qx-academic','academic');
  assert.equal(JSON.stringify(doc),original,'print must not change QWORK');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'PASS',plain,academic,errors},null,2));
  fs.writeFileSync(path.join(out,'booklet.qwork'),original);
  console.log('PASS TASK153.1: PDF vector, MathML, answer beside figure, no repeated metadata, QX theme, no collisions');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
