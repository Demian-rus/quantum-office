'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const entries = require('../content/physics-ege-2019-variant-1.cjs');

const root = path.resolve(__dirname, '..');
const directory = path.resolve(process.argv[2] || path.join(root, 'evidence/content-01/materials'));
const app = pathToFileURL(path.join(root, 'Quantum-Office.html')).href;

async function newSession(browser) {
 const context = await browser.newContext({offline:true,viewport:{width:1920,height:1080},colorScheme:'light'});
 const page = await context.newPage();
 await page.goto(app);
 return {context,page};
}

async function main() {
 assert.equal(entries.length,32);
 assert.equal(entries.reduce((sum,entry)=>sum+entry.points,0),52);
 assert.deepEqual(entries.reduce((counts,entry)=>({...counts,[entry.difficulty]:counts[entry.difficulty]+1}),{basic:0,advanced:0,high:0}),{basic:19,advanced:9,high:4});
 await fs.mkdir(directory,{recursive:true});
 const browser = await chromium.launch();
 try {
  const {context,page} = await newSession(browser);
  const errors = [];
  page.on('pageerror',error=>errors.push(error.message));
  const {work,bank,backup,numbers} = await page.evaluate(async rows=>{
   const collection = 'Физика · ЕГЭ-2019 · Вариант № 1';
   const items = rows.map(row=>{
    const code = String(row.slot).padStart(2,'0');
    const recordId = 'qo-physics-ege2019-v1-'+code;
    const task = {...qwTask(row.slot>=28?'extended':row.graph?'graph':'short'),
     id:recordId+'-task',title:row.title,subject:'physics',grade:'11',exam:'ege',
     part:'Часть '+row.part,prompt:row.prompt,answer:row.answer,comment:row.solution,criteria:row.criteria,
     origin:'original',topic:row.topic,subtopic:row.subtopic,points:row.points,
     tags:[collection,'Модель ЕГЭ 2019'],source:{kind:'author',id:recordId,slot:String(row.slot)},
     answerVisible:row.slot<28,solutionVisible:false};
    if (row.graph) {
     const points = row.graph.points.map(([x,y,label=''])=>({x,y,label}));
     task.graph = {...task.graph,...row.graph,points};
     task.publishing = {figure:{width:43,maxMm:75,position:'below',align:'center'}};
    }
    return qwBankNormalize({id:recordId,bankNumber:0,subject:'physics',grade:'11',exam:'ege',
      year:'',part:row.part,slot:row.slot,difficulty:row.difficulty,origin:'original',task});
   });
   const draft = {...qwProject(),id:'qo-physics-ege2019-v1',title:'Физика — авторский вариант № 1 по модели ЕГЭ-2019',
    subject:'physics',grade:'11',variant:'1',topic:'',layout:'booklet',exam:'ege',
    printSettings:{profile:'exam',fontPt:10.5,orientation:'portrait',theme:'academic',showPageNumbers:true,examPartHeadings:false,examTopicHeadings:false},
    tasks:items.map((item,i)=>({...item.task,pageBreak:i===24}))};
   let work = qwValidate(draft);
   for (const task of work.tasks) {
    if (!task.prompt || !task.answer || !task.comment || !task.criteria) throw new Error(task.id+' missing a section');
    for (const field of ['prompt','answer','comment','criteria']) for (const match of task[field].matchAll(/\\\((.+?)\\\)/g)) qwMath(match[1]);
   }
   if (JSON.stringify(qwValidate(JSON.parse(JSON.stringify(work))))!==JSON.stringify(work)) throw new Error('QWORK round trip');
   const repository = await qwBankOpen();
   const pack = {format:'quantum-work-bank',version:2,schema:1,count:items.length,
    checksum:bankHash(JSON.stringify(items)),items};
   const initial = await repository.importBank(pack),duplicate = await repository.importBank(pack);
   if (initial.imported!==32||initial.skipped!==0||duplicate.imported!==0||duplicate.skipped!==32)
    throw new Error('Unexpected import result '+JSON.stringify({initial,duplicate}));
   const assigned=await repository.exportBank();
   const numbers=assigned.items.map(item=>item.bankNumber);
   if (new Set(numbers).size!==32||numbers.some(number=>number<1)||assigned.items.some(item=>item.year))
    throw new Error('Invalid imported metadata');
   // QWORK references the actual assigned bank records, never position-derived IDs.
   const assignedById=new Map(await Promise.all(assigned.items.map(async item=>[item.id,await repository.getTask(item.id)])));
   work=qwValidate({...work,tasks:work.tasks.map(task=>{
    const record=assignedById.get(task.source.id);
    if(!record||!record.bankNumber)throw Error('Missing assigned bank number '+task.source.id);
    for(const key of ['prompt','answer','comment','criteria','part','points','figure','graph','diagram','image'])
     if(JSON.stringify(record.task[key])!==JSON.stringify(task[key]))throw Error('Bank task content mismatch '+task.source.id+' '+key);
    return {...task,source:qwBankSource(record)};
   })});
   if(JSON.stringify(qwValidate(JSON.parse(JSON.stringify(work))))!==JSON.stringify(work))throw Error('Linked QWORK round trip');
   const portableItems=assigned.items.map(item=>({...item,bankNumber:0}));
   const bank={...pack,checksum:bankHash(JSON.stringify(portableItems)),items:portableItems};
   const backup=await repository.createVerifiedBackup();
   return {work,bank,backup,numbers};
  },entries);
  assert.equal(numbers.length,32);
  assert.equal(bank.items.every(item=>item.task.tags.includes('Модель ЕГЭ 2019')&&!item.year),true);
  const restored = await newSession(browser);
  await restored.page.evaluate(async ({bank,backup})=>{
   const repository = await qwBankOpen();
   const plan = await repository.inspectRestore(backup);
   if (plan.count!==32||plan.mode!=='empty') throw new Error('Backup inspection');
   await repository.restoreVerifiedBackup({token:plan.token,mode:'empty'});
   const repeat = await repository.importBank(bank);
   if (repeat.skipped!==32||repeat.imported!==0) throw new Error('Duplicated restored records');
   const restored = await repository.exportBank();
   if (restored.items.length!==32 || restored.items.some(item=>{
    const expected=backup.records.find(record=>record.id===item.id);
    return !expected||item.bankNumber!==expected.bankNumber||JSON.stringify(item.task)!==JSON.stringify(expected.task);
   })) throw new Error('Changed contents after restore');
   const corrupted = structuredClone(backup);
   corrupted.records[0].task.answer='Повреждено';
   try { await repository.inspectRestore(corrupted);throw new Error('Accepted corrupt backup'); }
   catch(error) { if(error.message==='Accepted corrupt backup')throw error; }
   try { await repository.importBank({...bank,checksum:'00000000'});throw new Error('Accepted corrupt QWBANK'); }
   catch(error) { if(error.code!=='BAD_CHECKSUM')throw error; }
   if ((await repository.getStatistics()).count!==32) throw new Error('Atomicity');
  },{bank,backup});
  await restored.context.close();
  await fs.writeFile(path.join(directory,'physics-ege-2019-variant-1.qwork'),JSON.stringify(work,null,2)+'\n');
  await fs.writeFile(path.join(directory,'physics-ege-2019-variant-1.qwbank'),JSON.stringify(bank,null,2)+'\n');
  await page.evaluate(()=>route('work'));
  await page.locator('#qw-file').setInputFiles(path.join(directory,'physics-ege-2019-variant-1.qwork'));
  await page.waitForFunction(()=>qwDoc.tasks.length===32);
  assert.equal(await page.locator('.qw-nav-task').count(),32);
  const shots=path.join(directory,'screenshots');
  await fs.mkdir(shots,{recursive:true});
  assert.equal(await page.locator('html').getAttribute('data-qo-theme'),'light');
  await page.screenshot({path:path.join(shots,'variant-editor.png')});
  await page.locator('[data-action=work-preview]').click();
  await page.frameLocator('#qw-print-preview-frame').locator('.qw-print-page .qw-exam-number-line').first().waitFor();
  await page.locator('#qw-dialog [data-publish-fit=page]').click();
  await page.screenshot({path:path.join(shots,'variant-a4.png')});
  const variants = [
   {name:'student-portrait',orientation:'portrait',format:'booklet',parts:true},
   {name:'student-landscape',orientation:'landscape',format:'booklet',parts:true},
   {name:'brief-key',orientation:'portrait',format:'answers',keyMode:'brief'},
   {name:'solutions-and-rubrics',orientation:'portrait',format:'answers',keyMode:'detailed',includeCriteria:true},
   {name:'tasks-and-solutions',orientation:'portrait',format:'answers',keyMode:'detailed',includeCriteria:true,includePrompt:true}
  ];
  const artifacts=[];
  for (const {name,orientation,parts=false,...options} of variants) {
   const html = await page.evaluate(({work,orientation,options}) =>
    qwPrintDocumentHTML({...work,printSettings:{...work.printSettings,orientation}},options.format==='answers',options),
    {work,orientation,options});
   const print = await context.newPage();
   print.on('pageerror',error=>errors.push(error.message));
   await print.setContent(html);
   await print.evaluate(()=>window.qwPrintReady);
   const info = await print.evaluate(()=>{
    const first=document.querySelector('.qw-print-sheet, .qw-print-page')?.getBoundingClientRect();
    const all=selector=>[...document.querySelectorAll('.qw-print-page '+selector)];
    return {error:window.__qwPrintError,layout:window.__qwPrintLayout,width:first?.width,height:first?.height,
     sections:[...new Set(all('[data-task]').map(node=>Number(node.dataset.task)))],
     answers:[...new Set(all('[data-answer-number]').map(node=>Number(node.dataset.answerNumber)))],
     partHeadings:all('.qw-topic-title').map(node=>node.textContent),graphs:all('svg[viewBox]').length,
     criteria:all('.qw-print-answer-heading').filter(node=>node.textContent==='Критерии оценивания').length,
     title:document.querySelector('.qw-print-title')?.textContent,
     headings:[...document.querySelectorAll('.qw-print-section:not([data-continuation=true]) .qw-exam-number-line')].map(node=>({text:node.textContent,number:Number(node.dataset.qwBankNumber)})),
     squareCount:all('.qw-task-marker').length,
     geometry:[...document.querySelectorAll('.qw-exam-publication')].filter(node=>node.querySelector('.qw-task-text')).map(node=>{
      const header=node.querySelector('.qw-task-heading'),number=header.querySelector('b'),condition=node.querySelector('.qw-task-text');
      const h=header.getBoundingClientRect(),n=number.getBoundingClientRect(),c=condition.getBoundingClientRect();
      return {indent:Math.abs(n.left-c.left),next:c.top>=h.bottom-.5,weight:getComputedStyle(number).fontWeight,border:parseFloat(getComputedStyle(number).borderLeftWidth)};
     })};
   });
   assert.equal(info.error,undefined,name);
   const expectedTitle='Вариант 1'+({ 'brief-key':' — ответы','solutions-and-rubrics':' — решения и критерии','tasks-and-solutions':' — условия и решения'}[name]||'');
   assert.equal(info.title,expectedTitle,name);
   assert.equal(info.squareCount,0,name);
   assert.deepEqual(info.headings,work.tasks.map((task,i)=>({text:'№ '+(i+1)+' ('+String(task.source.number).padStart(5,'0')+').',number:task.source.number})),name);
   assert.ok(info.geometry.every(g=>g.indent<1&&g.next&&g.weight==='700'&&g.border===0),JSON.stringify(info.geometry));
   assert.ok(info.layout.sheets>=1,name);
   const ratio = orientation==='landscape'?297/210:210/297;
   assert.ok(Math.abs(info.width/info.height-ratio)<.001,name);
   if(parts){
    assert.deepEqual(info.sections,entries.map(entry=>entry.slot),name);
    assert.deepEqual(info.partHeadings,[],name);
    assert.deepEqual(info.answers,[],name);
   }else{
    assert.equal(info.answers.length,32,name);
    if(options.includeCriteria)assert.equal(info.criteria,32,name);
   }
   if(parts||options.includePrompt)assert.ok(info.graphs>=4,name);
   const file=path.join(directory,name+'.pdf');
   await print.pdf({path:file,preferCSSPageSize:true,printBackground:true});
   await print.locator('.qw-print-sheet, .qw-print-page').first().screenshot({path:path.join(shots,name+'.png')});
   const pdf=await fs.readFile(file);
   assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
   artifacts.push({name,orientation,sheets:info.layout.sheets,graphs:info.graphs,criteria:info.criteria});
   await print.close();
  }
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(directory,'export-check.json'),JSON.stringify({records:bank.items.length,initiallyAssigned:numbers,
   repeatImport:32,restore:32,corruption:'QWBANK and backup rejected',artifacts},null,2)+'\n');
  console.log('PASS 32 records, 52 points, QWORK round trip, QWBANK repeat import, verified backup and five A4 exports');
  console.table(artifacts);
 } finally {
  await browser.close();
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
