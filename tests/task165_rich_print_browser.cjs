/* TASK165: real vector PDF layout parity for bank-authored Markdown problems. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task165-rich-print');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const app=await browser.newPage({viewport:{width:1480,height:920}}),errors=[];
  app.on('pageerror',e=>errors.push(e.message));
  await app.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  const project=await app.evaluate(()=>{
   const d=qwProject();d.title='Физика. ЕГЭ — задания и решения';d.grade='11';d.exam='ege';d.layout='booklet';d.variant='1';
   d.printSettings={fontPt:10,showTitle:true,titleText:'Физика. ЕГЭ',showMeta:false,showVariant:true,figurePosition:'auto',theme:'academic'};
   d.tasks=Array.from({length:6},(_,i)=>{
    const q=qwTask('short');q.prompt='Определите скорость тела в опыте '+(i+1)+'.';q.answer=String(i+2)+' м/с';return q;
   });
   const plain=d.tasks[0];plain.prompt='Изучите **условия** и выберите выражение.';plain.answer='3';
   const rich=d.tasks[4];rich.type='graph';rich.figure='graph';rich.position='auto';rich.figureWidth=220;
   rich.graph.points=[{x:0,y:1,label:''},{x:4,y:5,label:''}];
   rich.prompt='### Задание на график\nСкорость тела описана **графиком**. Найдите путь по зависимости \\(v(t)\\).\n\n| Время, с | 0 | 4 |\n| --- | --- | --- |\n| Скорость, м/с | 1 | 5 |';
   rich.answer='12 м';
   rich.comment='### Обоснование\nИспользуем закон движения.\n\n### Решение\n1. Используем **площадь** под графиком скорости.\n2. Вычисляем путь по формуле \\(S=(v_0+v_1)t/2\\).\n\n\\[\n\\frac{(1+5)\\cdot4}{2}=12\n\\]';
   rich.criteria='### Критерии оценивания\n| Шаг | Баллы |\n| --- | --- |\n| Физическая модель | 1 |\n| Вычисления | 1 |\n| Ответ с единицами | 1 |';
   return qwValidate(d);
  });
  async function rendered(orientation,format,extras={}){
   const d=structuredClone(project);d.printSettings.orientation=orientation;
   const html=await app.evaluate(({d,format,extras})=>qwPrintDocumentHTML(d,false,{format,...extras}),{d,format,extras});
   const page=await browser.newPage({viewport:{width:1500,height:960}});page.on('pageerror',e=>errors.push(e.message));
   await page.setContent(html);await page.evaluate(()=>window.qwPrintReady);
   assert.equal(await page.evaluate(()=>window.__qwPrintError||null),null,'print preparation '+orientation+'/'+format);
   return page;
  }
  for(const orientation of ['portrait','landscape']){
   const p=await rendered(orientation,'booklet');
   const data=await p.evaluate(()=>{
    const sections=[...document.querySelectorAll('.qw-print-section')],source=sections.find(s=>s.dataset.task==='5');
    const tb=source?.querySelector('.qw-task-tables table'),fb=source?.querySelector('figure'),text=source?.querySelector('.qw-task-text');
    const bb=e=>e?.getBoundingClientRect();const table=bb(tb),body=bb(text),figure=bb(fb);
    return {error:window.__qwPrintError||null,layout:window.__qwPrintLayout?.layout,ids:[...new Set(sections.map(s=>Number(s.dataset.task)))],
     rich:!!source?.querySelector('.qw-print-rich h5'),math:!!source?.querySelector('.qw-print-rich math'),
     table:!!tb,tableUnder:!!tb&&!!text&&text.contains(tb)&&tb.closest('.qw-task-tables').previousElementSibling!==null,tableCentered:table?Math.abs((table.left+table.right-(bb(source.querySelector('.qw-task-flow')).left+bb(source.querySelector('.qw-task-flow')).right))/2)<4:false,
     figureBelow:fb?.dataset.printPosition==='below',figureVisible:!!figure&&figure.width>15&&figure.height>15,
     plainStillLegacy:!sections.find(s=>s.dataset.task==='2')?.querySelector('.qw-print-rich'),
     pageOverflow:[...document.querySelectorAll('.qw-print-page')].some(x=>x.scrollWidth>x.clientWidth+3)};
   });
   assert.deepEqual(data.ids,[1,2,3,4,5,6]);
   assert.equal(data.rich,true,'rich task print');assert.equal(data.math,true,'MathML in task');
   assert.equal(data.table,true,'Markdown table');assert.equal(data.tableUnder,true,'table below text');assert.equal(data.tableCentered,true,'table centered');
   assert.equal(data.figureBelow,true,'table forces figure below');assert.equal(data.figureVisible,true);
   assert.equal(data.plainStillLegacy,true);assert.equal(data.pageOverflow,false);
   await p.screenshot({path:path.join(out,'tasks-'+orientation+'.png'),fullPage:true});
   await p.close();
   const a=await rendered(orientation,'answers',{includeComments:true,includeCriteria:true});
   const detail=await a.evaluate(()=>{
    const sections=[...document.querySelectorAll('.qw-print-section')],s=sections.find(x=>x.dataset.task==='5');
    const table=s?.querySelector('.qw-task-text .qw-rich-table-scroll table');
    const h=[...s.querySelectorAll('h3,h4,h5')].find(x=>x.textContent.includes('Критерии'));
    const tb=table?.getBoundingClientRect(),title=h?.getBoundingClientRect(),region=s?.querySelector('.qw-task-text')?.getBoundingClientRect();
    return {rich:!!s?.querySelector('.qw-print-rich'),math:!!s?.querySelector('math'),table:!!table,
     solution:s?.textContent?.includes('Решение'),criteria:s?.textContent?.includes('Критерии оценивания'),
     duplicatedHeading:[...s.querySelectorAll('.qw-print-answer-heading')].filter(h=>h.textContent.trim()==='Решение').length,
     tableAfterCriteria:!!tb&&!!title&&tb.top>=title.bottom-1,
     tableCentered:!!tb&&!!region&&Math.abs((tb.left+tb.right-region.left-region.right)/2)<4,
     count:window.__qwPrintLayout?.pages?.length||0};
   });
   assert.equal(detail.rich,true);assert.equal(detail.math,true);assert.equal(detail.table,true);
   assert.equal(detail.solution,true);assert.equal(detail.criteria,true);assert.equal(detail.tableAfterCriteria,true);assert.equal(detail.tableCentered,true);
   assert.equal(detail.duplicatedHeading,0,'do not duplicate Markdown solution heading');
   assert.ok(detail.count>=1);
   await a.screenshot({path:path.join(out,'answers-'+orientation+'.png'),fullPage:true});
   await a.close();
  }
  const without=await rendered('portrait','answers',{includeComments:false,includeCriteria:false});
  const minimal=await without.evaluate(()=>{const s=[...document.querySelectorAll('.qw-print-section')].find(x=>x.dataset.task==='5');return {text:s?.innerText||'',table:!!s?.querySelector('table')};});
  assert.equal(minimal.table,false,'teacher details optional');
  assert.doesNotMatch(minimal.text,/Физическая модель/);
  await without.close();
  assert.deepEqual(errors,[]);
  console.log('PASS TASK165: author Markdown, formulas and tables in print; teacher PDF solutions; 2 A4 orientations; legacy flow untouched');
  await app.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
