/* TASK160.1: synthetic P0 fixtures for both A4 orientations. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task1601');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const errors=[];
 try{
  const app=await browser.newPage({viewport:{width:1550,height:960}});
  app.on('pageerror',e=>errors.push(e.message));
  await app.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  const makeProject=await app.evaluate(()=>{
   const p=qwProject();p.layout='booklet';p.subject='physics';p.exam='ege';
   p.title='ЕГЭ. Физика';p.variant='1';p.grade='11';
   p.printSettings={fontPt:10,figurePosition:'auto',topicHeadings:false,
    orientation:'landscape',showTitle:true,titleText:'ЕГЭ. Физика',
    showMeta:false,showVariant:true,theme:'academic'};
   p.tasks=Array.from({length:32},(_,i)=>{
    const t=qwTask(i===4?'choice':i>=27?'extended':'short');
    t.prompt='Задание '+(i+1)+'. Рассмотрите физическую ситуацию и укажите ответ.';
    t.answerVisible=i<27;t.answer=String(i+1);
    if(i===0||i===1||i===3){
     t.figure='diagram';t.diagram=[
      {kind:'ground',x:90,y:240,x2:440,y2:240,label:''},
      {kind:'block',x:200,y:174,x2:295,y2:240,label:'m'}];
    }
    if(i===3)t.prompt='К однородному рычагу приложены силы. '+
     'Рассмотрите условие равновесия и объясните направление вращающего момента. '.repeat(4)+
     'Укажите итоговое значение без округления.';
    if(i===4){
     t.prompt='Сопоставьте физические величины с результатами измерений. TASK160_TABLE_MARKER';
     t.choices=['Первое утверждение','Второе утверждение','Третье утверждение','Четвёртое утверждение'];
    }
    if(i===6){t.figure='graph';t.prompt='Изучите зависимости на координатном графике. Запишите результат.';t.graph.points=[{x:1,y:2,label:'A'},{x:3,y:7,label:'B'}];}
    return t;
   });
   return qwValidate(p);
  });
  const results=[];
  for(const orientation of ['portrait','landscape']){
   const project=structuredClone(makeProject);
   project.printSettings.orientation=orientation;
   let html=await app.evaluate(p=>qwPrintDocumentHTML(p,false,{format:'booklet'}),project);
   // Deliberately inject a native table into the generated print DOM: the
   // QWORK editor has no first-class table model yet.
   const table='<table aria-label="Таблица измерений" style="border:1px solid #222"><thead>'+
    '<tr><th>Величина</th><th>Опыт A</th><th>Опыт Б</th></tr></thead><tbody>'+
    '<tr><td>Время, с</td><td>2</td><td>4</td></tr>'+
    '<tr><td>Скорость, м/с</td><td>3</td><td>6</td></tr></tbody></table>';
   assert.ok(html.includes('TASK160_TABLE_MARKER'));
   html=html.replace('TASK160_TABLE_MARKER',table);
   const p=await browser.newPage({viewport:{width:1500,height:980}});
   p.on('pageerror',e=>errors.push(e.message));
   await p.setContent(html);await p.evaluate(()=>window.qwPrintReady);
   const data=await p.evaluate(()=>{
    const sections=[...document.querySelectorAll('.qw-print-section')];
    const n=(sel)=>document.querySelector('[data-task="'+sel+'"]');
    const box=e=>e?.getBoundingClientRect();
    const overlaps=(a,b)=>a&&b&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>.8&&
     Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.8;
    const violations=[];
    for(const s of sections){
     const task=s.dataset.task;
     const text=box(s.querySelector('.qw-task-text')),answer=box(s.querySelector('.qw-booklet-answer'));
     const figure=box(s.querySelector('figure')),table=box(s.querySelector('table'));
     const flow=box(s.querySelector('.qw-task-flow'));
     if(answer&&(overlaps(answer,text)||overlaps(answer,figure)||overlaps(answer,table)||
      Math.abs(answer.left-flow.left)>1.5))violations.push({task,type:'answer overlap or offset'});
     if(table&&text&&!text.contains(table))
      violations.push({task,type:'table before condition ends'});
    }
    const graph=n(7)?.querySelector('figure');
    const ax=graph?.querySelector('svg [data-qw-axis-shaft="x"]');
    const yx=graph?.querySelector('svg [data-qw-axis-shaft="y"]');
    const table=n(5)?.querySelector('table');
    const tb=box(table),tf=box(n(5)?.querySelector('.qw-task-flow'));
    const stamp=document.querySelector('.qw-print-brand .qw-qx-lettering');
    return {orientation:document.body.dataset.qwOrientation,layout:window.__qwPrintLayout?.layout,
     error:window.__qwPrintError||null,sections:sections.length,taskIds:sections.map(s=>Number(s.dataset.task)),
     violations,tableUnderText:!!n(5)?.querySelector('.qw-task-tables table'),
     tableCentered:tb&&tf?Math.abs((tb.left+tb.right-tf.left-tf.right)/2)<2:false,
     graphPosition:graph?.dataset.printPosition,arrowShafts:!!ax&&!!yx,
     stampColor:stamp?getComputedStyle(stamp).color:null,
     stampFont:stamp?getComputedStyle(stamp).fontFamily:null};
   });
   assert.equal(data.error,null,'print layout must succeed: '+orientation);
   assert.deepEqual([...new Set(data.taskIds)],Array.from({length:32},(_,i)=>i+1));
   assert.deepEqual(data.violations,[]);
   assert.equal(data.tableUnderText,true);
   assert.equal(data.tableCentered,true);
   assert.ok(['right','below'].includes(data.graphPosition));
   assert.equal(data.arrowShafts,true);
   assert.equal(data.stampColor,'rgb(17, 17, 17)');
   assert.match(data.stampFont,/QX Handwritten/);
   await p.emulateMedia({media:'print'});
   const pdf=path.join(out,'synthetic-'+orientation+'.pdf');
   await p.pdf({path:pdf,preferCSSPageSize:true,printBackground:true});
   await p.screenshot({path:path.join(out,'synthetic-'+orientation+'.png'),fullPage:true});
   assert.ok(fs.statSync(pdf).size>10000);
   results.push({...data,pdfBytes:fs.statSync(pdf).size});
   await p.close();
  }
  const bankProof=await app.evaluate(()=>{
   const original=localStorage.getItem(QW_BANK_KEY);
   const counter=localStorage.getItem(QW_BANK_NUMBER_KEY);
   try{
    const t1=qwTask('short'),t2=qwTask('choice'),t3=qwTask('short');
    t1.prompt='Укажите время';t2.prompt='Найдите ускорение';
    t3.prompt='Определите давление';
    localStorage.setItem(QW_BANK_KEY,JSON.stringify([
     {id:'legacy1',slot:'7',subject:'physics',exam:'ege',task:t1},
     {id:'legacy2',slot:'8',subject:'physics',exam:'ege',bankNumber:1807,task:t2},
     {id:'legacy3',slot:'9',subject:'physics',exam:'ege',bankNumber:1807,task:t3}
    ]));
    const entries=qwBankRead();const n=entries.map(x=>x.bankNumber);
    if(new Set(n).size!==3||n.some(x=>!Number.isInteger(x)||x<1))throw Error('duplicate or missing bank numbers');
    if(qwBankRead().map(x=>x.bankNumber).join()!==n.join())throw Error('unstable bank number');
    const doc=qwProject();doc.layout='booklet';doc.tasks=[qwTask('short')];
    doc.tasks[0].prompt='Укажите скорость';
    doc.tasks[0].source={kind:'bank',id:'legacy2',number:1807,slot:'7'};
    const page=qwPrintDocumentHTML(qwValidate(doc),false,{format:'booklet'});
    if(!page.includes('Тип 7 № 01807'))throw Error('missing printed bank identity');
    return {numbers:n,printedIdentity:true,legacyPreserved:true};
   }finally{
    if(original===null)localStorage.removeItem(QW_BANK_KEY);else localStorage.setItem(QW_BANK_KEY,original);
    if(counter===null)localStorage.removeItem(QW_BANK_NUMBER_KEY);else localStorage.setItem(QW_BANK_NUMBER_KEY,counter);
   }
  });
  // A real QWBANK-v1 upload colliding with an existing bank number must
  // assign new entry IDs and new display numbers, not make false references.
  const importSetup=await app.evaluate(()=>{
   const backup={bank:localStorage.getItem(QW_BANK_KEY),counter:localStorage.getItem(QW_BANK_NUMBER_KEY)};
   const originalTask=qwTask('short');originalTask.prompt='Исходная задача о напряжении';
   originalTask.answer='12';
   const incomingTask=qwTask('short');incomingTask.prompt='Импортированная задача о токе';incomingTask.answer='3';
   const legacyTask=qwTask('short');legacyTask.prompt='Импортированная задача о давлении';legacyTask.answer='25';
   const base={subject:'physics',grade:'11',exam:'ege',year:'2018',part:'1',slot:'7',topic:'Электричество',origin:'original'};
   localStorage.setItem(QW_BANK_KEY,JSON.stringify([{...base,id:'original-local',bankNumber:1807,task:originalTask}]));
   localStorage.setItem(QW_BANK_NUMBER_KEY,'1807');
   qwBank();
   return {backup,imported:{format:'quantum-work-bank',version:1,items:[
    {...base,id:'same-name-remote',bankNumber:1807,task:incomingTask},
    {...base,id:'legacy-no-number',task:legacyTask}
   ]}};
  });
  let importProof;
  try{
   await app.locator('#qw-bank-import-file').setInputFiles({
    name:'collision-test.qwbank',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(importSetup.imported),'utf8')
   });
   await app.waitForFunction(()=>qwBankRead().length===3);
   importProof=await app.evaluate(()=>{
    const entries=qwBankRead(),numbers=entries.map(x=>x.bankNumber);
    const original=entries.find(x=>x.id==='original-local');
    const imported=entries.find(x=>x.task.prompt==='Импортированная задача о токе');
    const legacy=entries.find(x=>x.task.prompt==='Импортированная задача о давлении');
    if(!original||!imported||!legacy)throw Error('an item disappeared during bank merge');
    if(new Set(numbers).size!==3||new Set(entries.map(x=>x.id)).size!==3)throw Error('duplicate id after merge');
    if(original.bankNumber!==1807||imported.bankNumber===1807||legacy.bankNumber===1807)
     throw Error('collision overwrote local task identity');
    if(imported.id!=='same-name-remote'||legacy.id!=='legacy-no-number'||
     imported.id===original.id||legacy.id===original.id)
     throw Error('free imported QWBANK IDs must be preserved without aliasing local records');
    const task=qwTask('short');task.prompt=imported.task.prompt;
    task.source={kind:'bank',id:imported.id,number:imported.bankNumber,slot:imported.slot};
    const q=qwProject();q.tasks=[task];
    const saved=qwValidate(JSON.parse(JSON.stringify(q)));
    if(saved.tasks[0].source.id!==imported.id||
     saved.tasks[0].source.number!==imported.bankNumber)throw Error('false QWORK bank link after import');
    const again=qwBankRead();
    if(again.map(x=>x.bankNumber).join()!==numbers.join())throw Error('numbers changed on reopen');
    return {numbers,originalId:original.id,importedId:imported.id,legacyId:legacy.id,
     qworkLink:task.source,stableOnReopen:true};
   });
  }finally{
   await app.evaluate(backup=>{
    if(backup.bank===null)localStorage.removeItem(QW_BANK_KEY);
    else localStorage.setItem(QW_BANK_KEY,backup.bank);
    if(backup.counter===null)localStorage.removeItem(QW_BANK_NUMBER_KEY);
    else localStorage.setItem(QW_BANK_NUMBER_KEY,backup.counter);
   },importSetup.backup);
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'PASS',synthetic:true,results,bankProof,importProof},null,2));
  console.log('PASS TASK160.1: 32 synthetic tasks, flow, axes, tables, portrait and landscape');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
