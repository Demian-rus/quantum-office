/* TASK166.1 FINAL: startup on opaque origin, full-content import, post-migration denial. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),url=pathToFileURL(path.join(root,'Quantum-Office.html')).href;
const out=path.join(root,'evidence/task166');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const report={opaque:{},import:{},migration:{}};
 try{
  const opaque=await browser.newPage({viewport:{width:1440,height:900}});
  const pageerrors=[],consoleErrors=[];
  opaque.on('pageerror',e=>pageerrors.push(String(e)));
  opaque.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await opaque.setContent(fs.readFileSync(path.join(root,'dist/index.html'),'utf8'),{waitUntil:'load'});
  const tiles=await opaque.locator('.launcher-tile').count();
  assert.equal(tiles,4,'shared Office launcher must initialize even when localStorage and IndexedDB are blocked');
  assert.ok((await opaque.locator('#app').innerText()).length>120);
  const blocked=await opaque.evaluate(async()=>{
   try{await qwBankOpen();return 'bad-success';}catch(e){return e.code;}
  });
  assert.equal(blocked,'IDB_UNAVAILABLE','bank must report its unavailable storage, not create an in-memory bank');
  assert.deepEqual(pageerrors,[],'opaque document must have no uncaught page errors');
  await opaque.screenshot({path:path.join(out,'opaque-launcher.png')});
  report.opaque={tiles,bankError:blocked,pageerrors,consoleErrors};
  await opaque.close();

  const ctx=await browser.newContext({offline:true});
  const page=await ctx.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url);
  const imported=await page.evaluate(async()=>{
   await qwBankOpen();
   const original=qwTask('short');
   original.prompt='Условия, тема и метаданные совпадают. Найдите силу.';
   original.answer='6 Н';
   original.comment='### Решение A\nF=ma=6';
   original.criteria='Первый критерий';
   original.figure='diagram';
   original.diagram=[{kind:'rect',x:140,y:110,x2:300,y2:230,label:'Груз A'}];
   const other=structuredClone(original);
   other.answer='12 Н';other.comment='### Решение B\nF=ma=12';
   other.criteria='Другие критерии';
   other.diagram=[{kind:'circle',x:180,y:110,x2:270,y2:210,label:'Груз B'}];
   const metadata={subject:'physics',grade:'11',exam:'ege',year:'2018',
    part:'1',slot:'7',topic:'Динамика',subtopic:'Второй закон Ньютона',origin:'original'};
   const itemA={...metadata,id:'different-answer-A',bankNumber:7777,task:original};
   const itemB={...metadata,id:'different-answer-B',bankNumber:7777,task:other};
   const one=await qwBankRepository.importBank({format:'quantum-work-bank',version:1,items:[itemA,itemB]});
   const twice=await qwBankRepository.importBank({format:'quantum-work-bank',version:1,items:[itemA,itemB]});
   const sameIdDifferent=structuredClone(itemA);
   sameIdDifferent.task.answer='18 Н';
   sameIdDifferent.task.comment='### Третье самостоятельное решение';
   sameIdDifferent.task.diagram=[{kind:'arrow',x:100,y:200,x2:330,y2:100,label:'F'}];
   const collision=await qwBankRepository.importBank({format:'quantum-work-bank',version:1,items:[sameIdDifferent]});
   const repeatedCollision=await qwBankRepository.importBank({format:'quantum-work-bank',version:1,items:[sameIdDifferent]});
   const all=(await qwBankRepository.exportBank()).items;
   const filtered=await qwBankRepository.listTasks({topic:'Динамика',search:'условия, тема'},{offset:0,limit:30});
   const importedRecord=all.find(x=>x.task.answer==='18 Н');
   const changed=await qwBankRepository.getTask(importedRecord.id); // QWBANK export omits internal revision.
   const saved=await qwBankRepository.updateTask(changed.id,{...changed,task:{...changed.task,comment:'Исправленная третья схема и решение'}},changed.revision);
   await qwBankRepository.close();await qwBankRepository.open();
   const reopened=(await qwBankRepository.exportBank()).items;
   return {one,twice,collision,repeatedCollision,filtered:filtered.total,all:reopened,
    updated:(await qwBankRepository.getTask(saved.id)).task.comment};
  });
  assert.equal(imported.one.imported,2);
  assert.equal(imported.twice.imported,0);
  assert.equal(imported.twice.skipped,2);
  assert.equal(imported.collision.imported,1);
  assert.equal(imported.repeatedCollision.imported,0);
  assert.equal(imported.filtered,3);
  assert.equal(imported.all.length,3);
  assert.equal(new Set(imported.all.map(x=>x.id)).size,3);
  assert.equal(new Set(imported.all.map(x=>x.bankNumber)).size,3);
  assert.deepEqual(imported.all.map(x=>x.task.answer).sort(),['12 Н','18 Н','6 Н']);
  for(const a of imported.all){
   assert.ok(a.task.comment&&a.task.criteria&&a.task.diagram?.length,
    'each distinct answer/solution/rubric/scheme must survive import');
  }
  assert.equal(imported.updated,'Исправленная третья схема и решение');
  const payload=await page.evaluate(()=>qwBankRepository.exportBank());
  assert.equal(payload.version,1);
  report.import={samePromptDistinctSaved:3,repeatIdenticalSkipped:2,
   idCollisionReallocated:true,numberCollisionReallocated:true,
   editedAfterReopen:true,qwbankV1:true};
  await ctx.close();

  const v2ctx=await browser.newContext({offline:true});const v2page=await v2ctx.newPage();
  await v2page.goto(url);
  const v2=await v2page.evaluate(async()=>{
   await qwBankOpen();
   const task=qwTask('short');task.prompt='Проверка расширенного формата QWBANK';task.answer='1';
   const items=[{id:'v2-a',bankNumber:8101,subject:'physics',task},
    {id:'v2-b',bankNumber:8102,subject:'physics',task:{...task,answer:'2'}}];
   const data={format:'quantum-work-bank',version:2,count:items.length,items,
    checksum:bankHash(JSON.stringify(items))};
   const first=await qwBankRepository.importBank(data);
   const second=await qwBankRepository.importBank(data);
   let checksumRejected=false;
   try{await qwBankRepository.importBank({...data,checksum:'1234'});}
   catch(e){checksumRejected=e.code==='BAD_CHECKSUM';}
   return {first,second,checksumRejected,items:(await qwBankRepository.exportBank()).items};
  });
  assert.equal(v2.first.imported,2);assert.equal(v2.second.skipped,2);
  assert.equal(v2.items.length,2);assert.equal(v2.checksumRejected,true);
  report.import.qwbankV2=true;report.import.badChecksumRejected=true;
  await v2ctx.close();

  const legacyctx=await browser.newContext({offline:true});const legacy=await legacyctx.newPage();
  await legacy.goto(url);
  const first=await legacy.evaluate(async()=>{
   const task=qwTask('short');task.prompt='Сохранить данные после отключения localStorage';
   task.answer='42';task.comment='Обоснованное решение';
   const records=[{id:'guard-old-A',bankNumber:9001,subject:'physics',task},
    {id:'guard-old-B',bankNumber:9002,subject:'physics',task:{...task,answer:'43'}}];
   localStorage.setItem(QW_BANK_KEY,JSON.stringify(records));
   await qwBankOpen();
   const marker=await qwBankRepository._meta('legacyMigration');
   await qwBankRepository.close();
   return {marker,records};
  });
  assert.equal(first.marker.state,'complete');
  // On navigation a fresh BankRepository is constructed while getItem throws.
  await legacy.addInitScript(()=>{
   Storage.prototype.getItem=function(){throw new DOMException('denied for regression test','SecurityError');};
  });
  await legacy.reload();
  const recovered=await legacy.evaluate(async()=>{
   await qwBankOpen();
   const items=(await qwBankRepository.exportBank()).items;
   await qwBankRepository.close();await qwBankOpen();
   return {items,again:(await qwBankRepository.exportBank()).items};
  });
  assert.equal(recovered.items.length,2);
  for(const items of [recovered.items,recovered.again]){
   assert.deepEqual(items.map(x=>x.id).sort(),['guard-old-A','guard-old-B']);
   assert.deepEqual(items.map(x=>x.bankNumber).sort(),[9001,9002]);
   assert.deepEqual(items.map(x=>x.task.answer).sort(),['42','43']);
  }
  report.migration={reopenedWithDeniedGetItem:true,count:2,idsPreserved:true,numbersPreserved:true,
   answersAndSolutionsPreserved:true};
  await legacyctx.close();

  const unconfirmedCtx=await browser.newContext({offline:true});
  const unconfirmed=await unconfirmedCtx.newPage();await unconfirmed.goto(url);
  const blockedFirst=await unconfirmed.evaluate(async()=>{
   Storage.prototype.getItem=function(){throw new DOMException('denied','SecurityError');};
   try{await qwBankOpen();return 'bad-success';}catch(e){return e.code;}
  });
  assert.equal(blockedFirst,'LEGACY_READ','initial migration must not silently discard inaccessible old bank');
  await unconfirmedCtx.close();

  const orphanCtx=await browser.newContext({offline:true});
  const orphan=await orphanCtx.newPage();await orphan.goto(url);
  const orphanResult=await orphan.evaluate(async()=>{
   await qwBankOpen();
   const task=qwTask('short');task.prompt='No confirmed legacy marker';
   await qwBankRepository.createTask({id:'orphan',subject:'physics',task});
   await new Promise((resolve,reject)=>{
    const tx=qwBankRepository.db.transaction('meta','readwrite');
    tx.objectStore('meta').delete('legacyMigration');
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
   });
   await qwBankRepository.close();
   try{await qwBankOpen();return 'bad-success';}catch(e){return e.code;}
  });
  assert.equal(orphanResult,'LEGACY_CONFLICT','unconfirmed existing records must fail closed');
  report.migration.initialDenialFailsClosed=true;report.migration.orphanedRecordsRejected=true;
  await orphanCtx.close();
  assert.deepEqual(errors,[]);
  report.status='PASS';report.pageerrors=errors;
  fs.writeFileSync(path.join(out,'task166-final-report.json'),JSON.stringify(report,null,2));
  console.log('TASK166 FINAL PASS: opaque launcher, full-content import, QWBANK v1/v2, durable restart after localStorage denial, unconfirmed DB fail-closed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
