/* TASK166.2 — real offline Chromium, atomic rollback, quota/abort, conflict,
   SHA-256 corruption rejection and end-to-end bank UI. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task1662');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const errors=[],url=pathToFileURL(path.join(root,'Quantum-Office.html')).href;
 const listen=p=>p.on('pageerror',e=>errors.push(e.message));
 try{
  const ctx=await browser.newContext({offline:true,acceptDownloads:true});
  const p=await ctx.newPage();listen(p);await p.goto(url);
  const setup=await p.evaluate(async()=>{
   await qwBankOpen();
   const items=Array.from({length:8},(_,i)=>{
    const task=qwTask(i%2?'graph':'short');
    task.prompt='Физика. Сохранить задачу '+i;
    task.answer='Ответ '+i;
    task.comment='### Решение\nПодстановка № '+i;
    task.criteria='| Критерий | Баллы |\n|---|---|\n|Формула|2|';
    task.diagram=[{kind:'rect',x:10+i,y:20,x2:30,y2:90}];
    task.image='data:image/png;base64,YWJj';
    return {id:'backup-'+i,bankNumber:8000+i,subject:'physics',grade:'11',
     exam:'ege',year:'2018',part:'1',slot:String(i+1),topic:'Механика',
     subtopic:'Движение',task};
   });
   const imported=await qwBankRepository.importBank({format:'quantum-work-bank',version:1,items});
   const backup=await qwBankRepository.createVerifiedBackup();
   const inspected=await qwBankRepository.inspectRestore(backup);
   const before=bankStableJSON(await qwBankRepository._captureBackupSnapshot());
   return {imported,backup,inspected,before};
  });
  assert.equal(setup.imported.imported,8);
  assert.equal(setup.inspected.count,8);assert.equal(setup.inspected.currentCount,8);
  assert.equal(setup.backup.records.length,8);assert.equal(setup.backup.manifest.sha256.length,64);
  assert.ok(setup.backup.records.every(r=>r.task.answer&&r.task.comment&&r.task.criteria&&r.task.diagram?.length&&r.task.image));
  const raw=JSON.stringify(setup.backup);
  const negatives=await p.evaluate(async raw=>{
   const payload=JSON.parse(raw),errors={};
   async function check(name,input){
    try{await qwBankRepository.inspectRestore(input);errors[name]='bad-success';}
    catch(e){errors[name]=e.code||e.name;}
   }
   await check('json','{ badly');
   let changed=structuredClone(payload);changed.records[0].task.answer='Altered';
   await check('byte',changed);
   changed=structuredClone(payload);changed.manifest.sha256='f'.repeat(64);
   await check('sha',changed);
   const resign=async b=>{
    const {manifest,...body}=b;
    const bytes=new TextEncoder().encode(bankStableJSON(body));
    const sha=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
    return {...body,manifest:{algorithm:'SHA-256',serialization:'sorted-json-utf8-v1',
     bytes:bytes.byteLength,sha256:[...sha].map(x=>x.toString(16).padStart(2,'0')).join('')}};
   };
   changed=structuredClone(payload);changed.count++;
   await check('count',await resign(changed));
   changed=structuredClone(payload);changed.records[1].id=changed.records[0].id;
   await check('id',await resign(changed));
   changed=structuredClone(payload);changed.records[1].bankNumber=changed.records[0].bankNumber;
   await check('number',await resign(changed));
   changed=structuredClone(payload);changed.version=4;
   await check('version',await resign(changed));
   changed=structuredClone(payload);changed.meta.sequence=1;
   await check('sequence',await resign(changed));
   return errors;
  },raw);
  assert.deepEqual(negatives,{json:'BACKUP_JSON',byte:'BACKUP_CHECKSUM',
   sha:'BACKUP_CHECKSUM',count:'BACKUP_COUNT',id:'BACKUP_DUPLICATE_ID',
   number:'BACKUP_DUPLICATE_NUMBER',version:'BACKUP_VERSION',sequence:'BACKUP_SEQUENCE'});
  const failures=await p.evaluate(async raw=>{
   const before=bankStableJSON(await qwBankRepository._captureBackupSnapshot());
   const failures={};
   async function snapshotEqual(){return bankStableJSON(await qwBankRepository._captureBackupSnapshot())===before;}
   await qwBankRepository.inspectRestore(raw);
   try{await qwBankRepository.restoreVerifiedBackup({token:qwBankRepository._restorePlan.token,
    mode:'replace',_injectAfterWrites:3});failures.mid='bad-success';}
   catch(e){failures.mid=e.code||e.name;}
   failures.midUnchanged=await snapshotEqual();
   await qwBankRepository.inspectRestore(raw);
   const original=IDBObjectStore.prototype.add;let count=0;
   IDBObjectStore.prototype.add=function(v){
    if(this.name==='tasks'&&++count===3)throw new DOMException('Quota limit reached','QuotaExceededError');
    return original.call(this,v);
   };
   try{
    try{await qwBankRepository.restoreVerifiedBackup({token:qwBankRepository._restorePlan.token,
     mode:'replace'});failures.quota='bad-success';}
    catch(e){failures.quota=e.name;}
   }finally{IDBObjectStore.prototype.add=original;}
   failures.quotaUnchanged=await snapshotEqual();
   await qwBankRepository.inspectRestore(raw);
   const ctrl=new AbortController();count=0;
   IDBObjectStore.prototype.add=function(v){
    const request=original.call(this,v);
    if(this.name==='tasks'&&++count===2)ctrl.abort();
    return request;
   };
   try{
    try{await qwBankRepository.restoreVerifiedBackup({token:qwBankRepository._restorePlan.token,
     mode:'replace',signal:ctrl.signal});failures.abort='bad-success';}
    catch(e){failures.abort=e.code||e.name;}
   }finally{IDBObjectStore.prototype.add=original;}
   failures.abortUnchanged=await snapshotEqual();
   const noPreview=new BankRepository({dbName:qwBankRepository.dbName,normalize:qwBankNormalize});
   await noPreview.open();
   try{await noPreview.restoreVerifiedBackup({token:'invalid',mode:'replace'});}
   catch(e){failures.preview=e.code;}
   await noPreview.close();
   return failures;
  },raw);
  assert.equal(failures.mid,'RESTORE_INJECTED');
  assert.equal(failures.midUnchanged,true);
  assert.equal(failures.quota,'QuotaExceededError');
  assert.equal(failures.quotaUnchanged,true);
  assert.equal(failures.abort,'RESTORE_CANCELLED');
  assert.equal(failures.abortUnchanged,true);
  assert.equal(failures.preview,'RESTORE_NOT_INSPECTED');
  const second=await ctx.newPage();listen(second);await second.goto(url);
  const plan=await second.evaluate(async raw=>{await qwBankOpen();return qwBankRepository.inspectRestore(raw);},raw);
  await p.evaluate(async()=>{
   const old=await qwBankRepository.getTask('backup-1');
   await qwBankRepository.updateTask(old.id,{...old,task:{...old.task,answer:'Edited in other tab'}},old.revision);
  });
  const concurrent=await second.evaluate(async token=>{
   try{await qwBankRepository.restoreVerifiedBackup({token,mode:'replace'});return 'bad-success';}
   catch(e){return e.code;}
  },plan.token);
  assert.equal(concurrent,'RESTORE_CONFLICT');
  assert.equal((await p.evaluate(async()=>qwBankRepository.getTask('backup-1'))).task.answer,'Edited in other tab');
  const originalEdited=await p.evaluate(()=>qwBankRepository._captureBackupSnapshot());
  // A successful replacement restores exact original entries atomically.
  const restored=await p.evaluate(async raw=>{
   const preview=await qwBankRepository.inspectRestore(raw);
   const outcome=await qwBankRepository.restoreVerifiedBackup({token:preview.token,mode:'replace'});
   await qwBankRepository.close();await qwBankOpen();
   return {outcome,snapshot:await qwBankRepository._captureBackupSnapshot()};
  },raw);
  assert.equal(restored.outcome.verified,true);
  assert.equal(restored.outcome.restored,8);
  assert.equal(restored.snapshot.records.find(x=>x.id==='backup-1').task.answer,'Ответ 1');
  assert.deepEqual(restored.snapshot.records.map(x=>x.id).sort(),setup.backup.records.map(x=>x.id).sort());
  assert.deepEqual(restored.snapshot.records.map(x=>x.bankNumber).sort(),setup.backup.records.map(x=>x.bankNumber).sort());
  assert.ok(restored.snapshot.records.every(x=>x.task.image==='data:image/png;base64,YWJj'));
  const empty=await browser.newContext({offline:true,acceptDownloads:true});
  const ep=await empty.newPage();listen(ep);await ep.goto(url);
  const inEmpty=await ep.evaluate(async raw=>{
   await qwBankOpen();const p=await qwBankRepository.inspectRestore(raw);
   const result=await qwBankRepository.restoreVerifiedBackup({token:p.token,mode:'empty'});
   await qwBankRepository.close();await qwBankOpen();
   const snapshot=await qwBankRepository._captureBackupSnapshot();
   const t=qwTask('short');t.prompt='Продолжение нумерации';
   const created=await qwBankRepository.createTask({id:'after-recovery',subject:'physics',task:t});
   return {result,snapshot,created:created.bankNumber};
  },raw);
  assert.equal(inEmpty.result.restored,8);
  assert.deepEqual(inEmpty.snapshot.records.map(x=>x.task),setup.backup.records.map(x=>x.task));
  assert.equal(inEmpty.created,setup.backup.meta.sequence+1);

  // Real UI path in a nonempty bank: SHA-256 export, file selection, review.
  await ep.evaluate(()=>qwBank());
  await ep.locator('#qw-bank-search').waitFor({state:'visible'});
  const [download]=await Promise.all([
   ep.waitForEvent('download'),ep.locator('[data-qw-action="bank-backup"]').click()
  ]);
  assert.match(download.suggestedFilename(),/\.qwbank$/);
  const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  assert.equal(exported.version,3);assert.equal(exported.manifest.sha256.length,64);
  await ep.locator('[data-qw-action="bank-restore"]').click();
  await ep.locator('#qw-bank-restore-file').setInputFiles({
   name:'verified.qwbank',mimeType:'application/json',buffer:Buffer.from(raw)});
  await ep.locator('#qw-bank-restore-review').waitFor({state:'visible'});
  assert.match(await ep.locator('#qw-bank-restore-detail').innerText(),/SHA-256 проверен/);
  assert.equal(await ep.locator('#qw-bank-restore-confirm').isDisabled(),true);
  const [protect]=await Promise.all([
   ep.waitForEvent('download'),ep.locator('#qw-bank-backup-current').click()
  ]);
  assert.match(protect.suggestedFilename(),/защитная_копия/);
  await ep.locator('#qw-bank-restore-accept').check();
  ep.on('dialog',d=>d.accept());
  await ep.locator('#qw-bank-restore-confirm').click();
  await ep.waitForFunction(()=>document.querySelector('#qw-bank-save-status')?.textContent.includes('Восстановлено и повторно проверено'));
  assert.equal((await ep.evaluate(()=>qwBankRepository.getStatistics())).count,8);

  // Combined Office v3: verify both SHA-256 manifests; legacy v2 stays readable.
  const office=await ep.evaluate(async raw=>{
   const bank=JSON.parse(raw);
   const text=await encodeOfficeBackupWithBank(workspace,qoWriter,qoSlides,qoPhotoState(),bank);
   const read=await decodeOfficeBackupWithBank(text);
   const old=decodeOfficeBackup(encodeOfficeBackup(workspace,qoWriter,qoSlides,qoPhotoState()));
   return {len:text.length,count:read.bankSummary.count,format:read.bank.format,legacy:old.legacy,
    combined:JSON.parse(text)};
  },raw);
  assert.equal(office.format,'quantum-work-bank-backup');assert.equal(office.legacy,false);
  assert.equal(office.count,8);
  const tampered=structuredClone(office.combined);tampered.office.writer.name='tampered';
  const officeErr=await ep.evaluate(async json=>{
   try{await decodeOfficeBackupWithBank(JSON.stringify(json));return 'bad-success';}
   catch(e){return e.message;}
  },tampered);
  assert.match(officeErr,/SHA-256/);
  assert.deepEqual(errors,[]);
  const report={status:'PASS',browser:'offline Chromium',
   format:'QWBANK v3 SHA-256',backupCount:8,
   negative:negatives,rollback:failures,twoWindowConflict:concurrent,
   emptyRestore:inEmpty.result,sequenceAfterRestore:inEmpty.created,
   originalModelPreserved:true,restoreAfterReopen:true,
   uiBackupAndRestore:true,officeV3:true,officeTamperRejected:true,legacyOfficeV2:true,
   errors};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  await ep.screenshot({path:path.join(out,'bank-after-recovery.png')});
  console.log('TASK166.2 Chromium PASS: full content, SHA-256 validation, atomic rollback, quota, abort, conflict, UI & Office v3');
  await second.close();await ctx.close();await empty.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
