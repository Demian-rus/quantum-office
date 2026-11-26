'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/exam-01'),source=path.join(out,'content');
 const bankFile=path.join(source,'physics-ege-2019-variant-1.qwbank'),workFile=path.join(source,'physics-ege-2019-variant-1.qwork');
 const demo=JSON.parse(await fs.readFile(workFile,'utf8'));
 const browser=await chromium.launch();try{
 const context=await browser.newContext({offline:true,acceptDownloads:true,viewport:{width:1600,height:1000},colorScheme:'light'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);await page.evaluate(()=>route('work'));
 const seed=await page.evaluate(async()=>{
  const bank=await qwBankOpen();const ids=[];
  for(let i=0;i<5;i++){const id='existing-'+i;await bank.createTask({id,subject:'physics',task:{...qwTask(),prompt:'Existing distinct task '+i}});ids.push(id);}
  return Promise.all(ids.map(id=>bank.getTask(id)));
 });
 const open=async()=>{await page.locator('[data-action="work-bank"]').click();await page.locator('#qw-bank-import-file').waitFor({state:'attached'});};
 const upload=async(expected)=>{await page.locator('#qw-bank-import-file').setInputFiles(bankFile);await page.waitForFunction(expected=>document.querySelector('#qw-bank-save-status')?.textContent.includes(expected),expected);};
 await open();await upload('Сохранено: 32');
 const real=await page.evaluate(async ids=>Promise.all(ids.map(id=>qwBankRepository.getTask(id))),demo.tasks.map(q=>q.source.id));
 assert.equal(real.length,32);assert.ok(real.every(x=>x&&x.bankNumber>5));assert.equal(new Set(real.map(x=>x.bankNumber)).size,32);
 const ids=new Set(real.map(x=>x.id)),selected=[];
 for(let i=0;i<3;i++){
  const rows=await page.locator('[data-bank-select]').evaluateAll(es=>es.map(e=>e.dataset.bankSelect));
  for(const id of rows)if(ids.has(id)&&!selected.includes(id)){await page.locator('[data-bank-select="'+id+'"]').check();selected.push(id);}
  const next=page.locator('[data-bank-page=next]');if(await next.isDisabled())break;
  const old=await page.locator('#qw-bank-page').innerText();await next.click();await page.waitForFunction(old=>document.querySelector('#qw-bank-page')?.textContent!==old,old);
 }
 assert.equal(selected.length,32);await page.locator('[data-qw-action=bank-assemble]').click();
 await page.waitForFunction(()=>qwDoc.tasks.length===32&&!!document.querySelector('#qw-print-preview-frame')?.dataset.ready);
 assert.equal(await page.evaluate(()=>qwDoc.printSettings.profile),'exam');
 await page.locator('#qw-dialog [data-qw-close]').click();
 const assembled=await page.evaluate(()=>structuredClone(qwDoc));
 const records=new Map(real.map(e=>[e.id,e]));
 for(const task of assembled.tasks){const e=records.get(task.source.id);assert.ok(e);assert.equal(task.source.number,e.bankNumber);assert.equal(task.prompt,e.task.prompt);assert.equal(task.source.createdAt,e.createdAt);}
 const event=page.waitForEvent('download');await page.locator('[data-action=work-save]').click();const downloaded=await event;
 const saved=path.join(out,'filled-bank-roundtrip.qwork');await downloaded.saveAs(saved);
 await page.locator('#qw-file').setInputFiles(saved);await page.waitForFunction(()=>document.querySelector('#toast.active')?.textContent.includes('Работа открыта'));
 assert.deepEqual(await page.evaluate(()=>qwDoc),assembled);
 const exportProof=async(project,label)=>{
  for(const [name,opts] of [['student',{format:'booklet'}],['brief',{format:'answers',keyMode:'brief'}],['detailed',{format:'answers',keyMode:'detailed',includeCriteria:true}],['full',{format:'answers',keyMode:'detailed',includePrompt:true,includeCriteria:true}]]){
   const html=await page.evaluate(({project,opts})=>qwPrintDocumentHTML(project,false,opts),{project,opts});
   const print=await context.newPage();await print.setContent(html);await print.evaluate(()=>window.qwPrintReady);
   assert.equal(await print.evaluate(()=>window.__qwPrintError),undefined);
   const actual=await print.locator('.qw-print-section:not([data-continuation=true]) .qw-exam-number-line').evaluateAll(es=>es.map(e=>[e.textContent,Number(e.dataset.qwBankNumber)||0]));
   assert.deepEqual(actual,project.tasks.map((t,i)=>['№ '+(i+1)+(t.source.kind==='bank'?' ('+String(t.source.number).padStart(5,'0')+')':'')+'.',t.source.kind==='bank'?t.source.number:0]));
   if(label==='filled')await print.pdf({path:path.join(out,'filled-'+name+'.pdf'),preferCSSPageSize:true,printBackground:true});
   await print.close();
  }
 };
 await exportProof(assembled,'filled');
 await open();await upload('Сохранено: 0 · пропущено совпадений: 32');await page.locator('#qw-dialog [data-qw-close]').click();
 const existing=await page.evaluate(async ids=>Promise.all(ids.map(id=>qwBankRepository.getTask(id))),seed.map(x=>x.id));assert.deepEqual(existing,seed);
 await page.locator('#qw-file').setInputFiles(workFile);await page.waitForFunction(id=>qwDoc.id===id&&document.querySelector('#toast.active')?.textContent.includes('Работа открыта'),demo.id);
 const rebound=await page.evaluate(()=>qwDoc);assert.ok(rebound.tasks.every(t=>t.source.kind==='bank'&&t.source.number===records.get(t.source.id).bankNumber));await exportProof(rebound,'rebound');
 const foreign=structuredClone(demo);foreign.id='foreign-unrelated';foreign.tasks=foreign.tasks.slice(0,1);foreign.tasks[0].source={kind:'bank',id:'not-in-local-bank',number:seed[0].bankNumber};
 await page.locator('#qw-file').setInputFiles({name:'foreign.qwork',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(foreign))});await page.waitForFunction(()=>qwDoc.id==='foreign-unrelated');
 const unresolved=await page.evaluate(()=>qwDoc);assert.equal(unresolved.tasks[0].source.kind,'external-bank');assert.equal(unresolved.tasks[0].source.number,seed[0].bankNumber);await exportProof(unresolved,'external');
 assert.equal(await page.evaluate(async()=> (await qwBankRepository.getStatistics()).count),37);assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(out,'filled-bank-report.json'),JSON.stringify({seed:seed.map(e=>[e.id,e.bankNumber]),records:real.map(e=>[e.id,e.bankNumber]),assembled:assembled.tasks.map(t=>t.source),rebound:rebound.tasks.map(t=>t.source),unresolved:unresolved.tasks[0].source,duplicates:0},null,2));
 await context.close();console.log('PASS EXAM-01 filled bank: actual UI import/assemble/save/reopen, 4 PDFs, repeat import, foreign IDs');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
