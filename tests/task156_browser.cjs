/* TASK156 browser acceptance: bank editing + 2-column landscape PDF in actual Chromium. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task156');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1480,height:940},offline:true});
 const app=await context.newPage(),errors=[],external=[];
 app.on('pageerror',e=>errors.push(e.message));
 app.on('dialog',d=>d.accept());
 app.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
 try{
  await app.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  const initial=await app.evaluate(()=>{
   const bank=qwTask('short');bank.prompt='Исходная авторская задача: найдите ускорение';bank.answer='2';
   bank.figure='diagram';bank.diagram=[{kind:'block',x:200,y:140,x2:300,y2:230,label:'m'},{kind:'ground',x:100,y:230,x2:420,y2:230,label:''}];
   localStorage.setItem(QW_BANK_KEY,JSON.stringify([{id:'task156-one',subject:'physics',grade:'11',exam:'ege',year:'2018',part:'1',slot:'1',difficulty:'basic',topic:'Механика',subtopic:'Динамика',origin:'original',task:bank}]));
   return {work:JSON.stringify(qwDoc),bank:JSON.stringify(qwBankRead()[0])};
  });
  await app.evaluate(()=>qwBank());
  assert.equal(await app.locator('.qw-bank-catalogue-list [data-bank-edit="task156-one"]').count(),1);
  assert.equal(await app.locator('.qw-bank-catalogue-preview [data-bank-edit="task156-one"]').count(),1,'preview has its own edit action');
  await app.locator('.qw-bank-catalogue-list [data-bank-edit="task156-one"]').click();
  await app.locator('.qw-bank-edit-dialog').waitFor();
  await app.locator('[data-bank-task-field="prompt"]').fill('Переработанная авторская задача: рассчитайте ускорение тела массой 2 кг');
  await app.locator('[data-bank-task-field="answer"]').fill('3');
  await app.locator('[data-bank-edit-field="topic"]').fill('Динамика');
  assert.equal((await app.evaluate(()=>qwBankRead()[0].task.prompt)).startsWith('Исходная'),true,'changes must stay in the draft before Save');
  await app.locator('[data-bank-visual="diagram"]').click();
  assert.ok(await app.locator('.qw-visual-dialog').count(),'shared vector diagram editor must open');
  await app.locator('[data-qw-close]').click();
  await app.locator('.qw-bank-edit-dialog').waitFor();
  assert.match(await app.locator('[data-bank-task-field="prompt"]').inputValue(),/^Переработанная/,'diagram cancel must preserve bank editing draft');
  await app.locator('[data-bank-visual="diagram"]').click();
  await app.locator('[data-qw-action="visual-apply"]').click();
  await app.locator('.qw-bank-edit-dialog').waitFor();
  assert.match(await app.locator('[data-bank-task-field="prompt"]').inputValue(),/^Переработанная/,'diagram commit retains rest of draft');
  await app.locator('[data-qw-action="bank-edit-save"]').click();
  await app.locator('.qw-bank-catalogue-list [data-bank-edit="task156-one"]').waitFor();
  const saved=await app.evaluate(()=>({item:qwBankRead()[0],work:JSON.stringify(qwDoc)}));
  assert.equal(saved.item.id,'task156-one');
  assert.equal(saved.item.task.answer,'3');
  assert.equal(saved.item.topic,'Динамика');
  assert.ok(saved.item.task.diagram.length>=2);
  assert.equal(saved.work,initial.work,'editing bank item must not mutate the open project');
  await app.locator('.qw-bank-catalogue-list [data-bank-edit="task156-one"]').click();
  await app.locator('[data-bank-task-field="answer"]').fill('999');
  await app.locator('[data-qw-action="bank-edit-back"]').click();
  assert.equal(await app.evaluate(()=>qwBankRead()[0].task.answer),'3','Back must discard unsaved modifications');

  const tasks=await app.evaluate(()=>{
   const d=qwProject();d.title='Авторский сборник • 2018';d.layout='booklet';d.grade='11';
   d.printSettings={fontPt:9.5,figurePosition:'auto',topicHeadings:false,showMeta:false,
    showTitle:true,titleText:'Авторские задачи • механика и физика',orientation:'landscape',landscapeLayout:'spread'};
   d.tasks=Array.from({length:32},(_,i)=>{
    const q=qwTask(i>=27?'extended':'short');
    q.prompt=(i+1)+'. На схеме представлена физическая установка. Найдите искомую величину, используя указанные данные. '+(i%3===0?'Проанализируйте изображённый процесс и приведите основные соотношения.':'');
    q.answer=String(i+1);q.answerVisible=i<27;
    if(i%7===0){q.figure='diagram';q.diagram=[{kind:'ground',x:95,y:241,x2:425,y2:241,label:''},{kind:'block',x:202,y:165,x2:305,y2:240,label:'m'}];}
    if(i%9===2){q.figure='graph';q.graph=qwGraphDefault();q.graph.points=[{x:0,y:1,label:'A'},{x:2,y:3,label:'B'},{x:4,y:5,label:'C'}];}
    return q;
   });
   return qwValidate(d);
  });
  assert.equal(tasks.tasks.length,32);
  const cases=[['portrait','spread'],['landscape','spread']];
  const reports=[];
  for(const [orientation,landscapeLayout] of cases){
   const doc=structuredClone(tasks);doc.printSettings.orientation=orientation;doc.printSettings.landscapeLayout=landscapeLayout;
   const html=await app.evaluate(data=>qwPrintDocumentHTML(data,false,{format:'booklet'}),doc);
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.setContent(html);await page.evaluate(()=>window.qwPrintReady);
   const info=await page.evaluate(()=>{
    const r=window.__qwPrintLayout,pages=[...document.querySelectorAll('.qw-print-page')],
      sheets=[...document.querySelectorAll('.qw-print-sheet')],sections=[...document.querySelectorAll('.qw-print-section')],overflow=[];
    for(const section of sections){
      const b=section.getBoundingClientRect(),c=section.closest('.qw-print-page').querySelector('.qw-page-content').getBoundingClientRect();
      if(b.left<c.left-1||b.right>c.right+1||b.bottom>c.bottom+1)overflow.push(Number(section.dataset.task));
    }
    const sz=pages.map(p=>{const b=p.getBoundingClientRect();return [Math.round(b.width),Math.round(b.height)]});
    const sheetSize=sheets.map(p=>{const b=p.getBoundingClientRect();return [Math.round(b.width),Math.round(b.height)]});
    return {mode:r.layout,sheets:r.sheets,logicalPages:r.pages.length,pageBoxes:sz.slice(0,3),sheetBoxes:sheetSize.slice(0,2),
     pagesDOM:pages.length,sheetsDOM:sheets.length,taskIds:sections.map(s=>Number(s.dataset.task)),
     overflow,err:window.__qwPrintError||null,headers:[...document.querySelectorAll('.qw-print-title')].map(x=>x.textContent)};
   });
   assert.equal(info.err,null,JSON.stringify(info));
   assert.equal(info.pagesDOM,info.logicalPages);
   assert.deepEqual(info.taskIds,Array.from({length:32},(_,i)=>i+1));
   assert.deepEqual(info.overflow,[]);
   {
    assert.equal(info.mode,'spread');
    assert.equal(info.sheetsDOM,Math.ceil(info.logicalPages/2));
    assert.equal(info.sheets,info.sheetsDOM);
    assert.ok(info.pageBoxes[0][0]<info.pageBoxes[0][1],'logical page should be portrait-proportioned');
    assert.equal(info.sheetBoxes[0][0]>info.sheetBoxes[0][1],orientation==='landscape','physical sheet orientation');
    assert.ok(Math.abs(info.sheetBoxes[0][0]-(orientation==='landscape'?297:210)*96/25.4)<2);
    assert.ok(Math.abs(info.sheetBoxes[0][1]-(orientation==='landscape'?210:297)*96/25.4)<2);
    assert.ok(Math.abs(info.sheetBoxes[0][0]-info.pageBoxes[0][0]*2)<=2,'subpixel rounding of a half-sheet column must not look like clipped sheet');
   }
   await page.emulateMedia({media:'print'});
   const name=orientation+'-'+landscapeLayout,pdf=path.join(out,name+'.pdf');
   await page.pdf({path:pdf,preferCSSPageSize:true,printBackground:true});
   assert.ok(fs.statSync(pdf).size>9000);
   await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
   reports.push({name,...info,pdfBytes:fs.statSync(pdf).size});
   await page.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'PASS',bankEntryId:saved.item.id,bankPrompt:saved.item.task.prompt,reports},null,2));
  fs.writeFileSync(path.join(out,'example.qwork'),JSON.stringify(tasks,null,2));
  console.log('PASS TASK156: original bank entry editing, diagram cancel/apply, no draft leakage, 3 A4 modes, 32 tasks');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
