const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve('evidence/release044'),stage=process.argv[2];fs.mkdirSync(out,{recursive:true});
const pack=JSON.parse(fs.readFileSync('content/authoring-examples.qwbank','utf8'));
let connection;
(async()=>{
 connection=await require('./task1664_cdp.cjs').connectNative('release044-'+stage);const {page}=connection;
 await page.waitForFunction(()=>typeof qwBankRepository!=='undefined'&&qwBankRepository instanceof SQLiteBankRepository&&qwBankRepository.db===true,{},{timeout:60000});
 const result=await page.evaluate(async({stage,pack,expected})=>{
  const check=(v,m)=>{if(!v)throw Error(m);},repo=await qwBankOpen();
  const snapshot=async()=>({bank:await repo._captureBackupSnapshot(),drafts:await __TAURI__.core.invoke('draft_load')});
  if(stage==='old'){
   check((await repo.listTasks({})).total===0,'not empty disposable database');
   const task=qwTask('short');task.id='release044-old-task';task.prompt='Тело прошло 30 м за 5 с. Найдите скорость.';task.answer='6';task.comment='30/5=6 м/с';task.criteria='1 балл.';
   const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const g=canvas.getContext('2d');g.fillStyle='#336699';g.fillRect(0,0,32,32);task.image=canvas.toDataURL();task.figure='image';
   const old=await repo.createTask({id:'release044-old',subject:'physics',grade:'9',exam:'oge',year:'2019',task});
   qwDoc=qwValidate({...qwProject(),title:'0.4.3 upgrade draft',tasks:[old.task]});check(qwPersist(),'old persist');
   qoDraftStorage.setItem(QW_PANELS_KEY,JSON.stringify({pdf:{left:254,hideLeft:false}}));await qoDraftStorage.flush();
   return snapshot();
  }
  check(QO_RELEASE_VERSION==='0.4.4'&&document.querySelector('meta[name=quantum-office-version]').content==='0.4.4','version');
  if(stage==='new'){
   const now=await snapshot(),old=expected.bank.records.find(x=>x.id==='release044-old'),actual=now.bank.records.find(x=>x.id===old.id);
   check(bankStableJSON(actual)===bankStableJSON(old),'exact old record, number, raster, revision');
   check(bankStableJSON(now.bank.meta)===bankStableJSON(expected.bank.meta),'bank meta');
   for(const key of [QW_KEY,QW_PANELS_KEY])check(now.drafts[key]?.value===expected.drafts[key]?.value,'draft/settings '+key);
   check(qwDoc.title==='0.4.3 upgrade draft','visible draft');
   const imported=await repo.importBank(pack);check(imported.imported===5,'import');
   check((await repo.importBank(pack)).skipped===5,'dedup');
   const before=await repo.getTask(pack.items[0].id);await repo.updateExamYears([{id:before.id,revision:before.revision}],'add',[2027]);
   const tagged=await repo.getTask(before.id);check(tagged.examYears[0]===2027,'tag');
   const updated=await repo.updateTask(tagged.id,{...tagged,task:{...tagged.task,comment:tagged.task.comment+'\nПроверено в CI.'}},tagged.revision);
   check(updated.bankNumber===before.bankNumber,'stable number');
   qwDoc=qwValidate({...qwProject(),title:'Release upgrade proof',exam:'oge',examYear:2027,layout:'booklet',tasks:[{...updated.task,source:qwBankSource(updated)}]});qwPersist();await qoDraftStorage.flush();
   return {oldExact:true,imported,record:updated,drafts:(await snapshot()).drafts};
  }
  const current=await repo.getTask(pack.items[0].id);check(bankStableJSON(current)===bankStableJSON(expected.record),'restart record');check(qwDoc.title==='Release upgrade proof'&&qwDoc.examYear===2027,'restart work');
  return {restart:true,record:current};
 },{stage,pack,expected:stage==='old'?null:JSON.parse(fs.readFileSync(path.join(out,stage==='new'?'old.json':'new.json'),'utf8'))});
 if(stage!=='old'){
  await page.evaluate(()=>route('home'));
  await page.locator('#qo-about-version').waitFor();
  assert.match(await page.locator('#qo-about-version').getAttribute('aria-label'),/0\.4\.4/);
  await page.evaluate(()=>route('bank'));
  await page.locator('[data-bank-entry]').first().waitFor();
  await page.locator('#qw-bank-examYear').selectOption('2027');
  await page.locator('[data-bank-view="'+pack.items[0].id+'"]').waitFor();
  await page.screenshot({path:path.join(out,stage+'-bank.png')});
  await page.evaluate(()=>{route('work');});
  // Real native print renderer and actual generated PDF bytes via WebView CDP, not OS save dialog.
  const frame=await page.evaluate(async()=>{
   const f=document.createElement('iframe');f.style.cssText='width:830px;height:1160px;position:fixed;inset:0;background:white;z-index:10000';document.body.append(f);
   f.srcdoc=qwPrintDocumentHTML(qwDoc,false,{format:'booklet'});const start=performance.now();while(!f.contentWindow.qwPrintReady){if(performance.now()-start>30000)throw Error('Native print script unavailable');await new Promise(r=>setTimeout(r,50));}await f.contentWindow.qwPrintReady;
   if(f.contentWindow.__qwPrintError||f.contentDocument.body.dataset.qwLayoutReady!=='true')throw Error('preview not ready');
   return f.contentDocument.querySelector('.qw-print-title')?.textContent;
  });assert.match(frame,/Вариант 1/);
  await page.screenshot({path:path.join(out,stage+'-preview.png')});
  // Native legacy PDF byte renderer; exam profile checked separately in the actual preview.
  const pdf=await page.evaluate(async()=>{const f=[...document.querySelectorAll('iframe')].at(-1);const text=f.contentDocument.body.innerText;const ready=f.contentDocument.body.dataset.qwLayoutReady;f.remove();const bytes=await qwPDFBytes({...qwDoc,layout:'worksheet'},false);return {text,ready,bytes:Array.from(bytes)};});
  assert.equal(pdf.ready,'true');assert.ok(pdf.text.includes('Вариант 1'));const bytes=Buffer.from(pdf.bytes);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');fs.writeFileSync(path.join(out,stage+'-native-pdf.pdf'),bytes);
 }
 fs.writeFileSync(path.join(out,stage+'.json'),JSON.stringify(result,null,2));await connection.browser.close();connection=null;
})().catch(async e=>{console.error(e);process.exitCode=1;if(connection?.browser.isConnected())await connection.browser.close();});
