/* TASK166.1: actual Chromium storage, migration, concurrent revisions and UI. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task166');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1540,height:960},offline:true,acceptDownloads:true});
 const errors=[],external=[];
 const page=await context.newPage();
 const listen=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());p.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});};
 listen(page);
 const url=pathToFileURL(path.join(root,'Quantum-Office.html')).href;
 try{
  await page.goto(url);
  await page.evaluate(()=>{
   const entries=Array.from({length:32},(_,i)=>{
    const task=qwTask('short');task.prompt='Задача '+(i+1)+' о механике';
    task.answer=String(i+1);task.comment='### Решение\nИспользуйте второй закон Ньютона.';
    return {id:'legacy'+(i+1),bankNumber:1801+i,subject:'physics',grade:'11',exam:'ege',
     year:'2018',part:'1',slot:String(i%32+1),topic:'Механика',subtopic:'Динамика',origin:'original',task};
   });
   localStorage.setItem(QW_BANK_KEY,JSON.stringify(entries));
   localStorage.setItem(QW_BANK_NUMBER_KEY,'1832');
  });
  const before=await page.evaluate(()=>localStorage.getItem(QW_BANK_KEY));
  const migration=await page.evaluate(async()=>{
   await qwBankOpen();await qwBankSnapshotSmall();
   const stats=await qwBankRepository.getStatistics();
   const raw=await qwBankRepository._meta('legacyBackup');
   const items=await qwBankRepository.exportBank();
   // IndexedDB object-store cursors are key-sorted, not insertion-sorted.
   const bySourceOrder=items.items.sort((a,b)=>Number(a.id.slice(6))-Number(b.id.slice(6)));
   return {stats,hasBackup:raw?.raw===localStorage.getItem(QW_BANK_KEY),
    count:items.items.length,ids:bySourceOrder.map(e=>e.id),numbers:bySourceOrder.map(e=>e.bankNumber)};
  });
  assert.equal(migration.stats.migration,'complete');
  assert.equal(migration.count,32);
  assert.equal(migration.hasBackup,true);
  assert.deepEqual(migration.ids,Array.from({length:32},(_,i)=>'legacy'+(i+1)));
  assert.deepEqual(migration.numbers,Array.from({length:32},(_,i)=>1801+i));
  assert.equal(await page.evaluate(()=>localStorage.getItem(QW_BANK_KEY)),before,'legacy data must remain untouched');
  await page.evaluate(()=>qwBank());
  const dialog=page.locator('#qw-dialog');
  await page.waitForFunction(()=>document.querySelectorAll('#qw-bank-list [data-bank-entry]').length===30);
  assert.match(await dialog.locator('#qw-bank-page').innerText(),/1–30 из 32/);
  await dialog.locator('[data-bank-page="next"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#qw-bank-list [data-bank-entry]').length===2);
  await dialog.locator('[data-bank-page="prev"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#qw-bank-list [data-bank-entry]').length===30);
  await dialog.locator('#qw-bank-search').fill('Задача 31');
  await page.waitForFunction(()=>document.querySelector('#qw-bank-count')?.textContent==='Найдено: 1 / 32');
  assert.equal(await dialog.locator('#qw-bank-list [data-bank-entry]').count(),1);
  await dialog.locator('#qw-bank-search').fill('');
  await page.waitForFunction(()=>document.querySelector('#qw-bank-count')?.textContent==='Найдено: 32 / 32');
  await page.screenshot({path:path.join(out,'indexeddb-catalogue.png')});
  await page.locator('#qw-dialog [data-qw-close]').click();
  const beforeEdit=await page.evaluate(()=>qwBankRepository.getTask('legacy1'));
  const revised=await page.evaluate(async()=>{
   const entry=await qwBankRepository.getTask('legacy1');
   return qwBankRepository.updateTask(entry.id,{...entry,task:{...entry.task,
    prompt:'Изменённое условие',answer:'42',comment:'Решение сохранено'}},entry.revision);
  });
  assert.equal(revised.revision,beforeEdit.revision+1);
  assert.equal(revised.bankNumber,beforeEdit.bankNumber);
  await assert.rejects(page.evaluate(async record=>{
   await qwBankRepository.updateTask(record.id,{...record,task:{...record.task,prompt:'Устаревшее окно'}},record.revision);
  },beforeEdit),/REVISION_CONFLICT|изменено в другом окне/);
  const imported=await page.evaluate(async()=>{
   const items=Array.from({length:2},(_,i)=>{
    const task=qwTask('short');task.prompt='Новая электрическая задача '+i;
    return {id:'remote'+i,bankNumber:1801,subject:'physics',grade:'11',
     exam:'ege',year:'2018',part:'1',slot:'6',topic:'Электричество',task};
   });
   return qwBankRepository.importBank({format:'quantum-work-bank',version:1,items});
  });
  assert.equal(imported.imported,2);
  const afterImport=await page.evaluate(async()=>qwBankRepository.exportBank());
  assert.equal(afterImport.items.length,34);
  assert.equal(new Set(afterImport.items.map(e=>e.bankNumber)).size,34);
  const badImport=await page.evaluate(async()=>{
   try{await qwBankRepository.importBank({format:'quantum-work-bank',version:1,items:[{id:'bad',task:null}]});return false;}
   catch{return true;}
  });
  assert.equal(badImport,true);
  assert.equal((await page.evaluate(()=>qwBankRepository.getStatistics())).count,34);
  const removed=await page.evaluate(async()=>{
   const e=await qwBankRepository.getTask('legacy2');
   return qwBankRepository.deleteTask(e.id,e.revision);
  });
  assert.equal(removed.id,'legacy2');
  await page.close();
  const reopened=await context.newPage();listen(reopened);await reopened.goto(url);
  const durable=await reopened.evaluate(async()=>{
   await qwBankOpen();
   const stats=await qwBankRepository.getStatistics();
   const edited=await qwBankRepository.getTask('legacy1');
   return {stats,edited,deleted:await qwBankRepository.getTask('legacy2'),
    rawStillPresent:localStorage.getItem(QW_BANK_KEY)!==null};
  });
  assert.equal(durable.stats.count,33);
  assert.equal(durable.edited.task.answer,'42');
  assert.equal(durable.deleted,undefined);
  assert.equal(durable.rawStillPresent,true);
  const second=await context.newPage();listen(second);await second.goto(url);
  const stale=await second.evaluate(async()=>{await qwBankOpen();return qwBankRepository.getTask('legacy3');});
  await reopened.evaluate(async()=>{
   const e=await qwBankRepository.getTask('legacy3');
   await qwBankRepository.updateTask(e.id,{...e,task:{...e.task,answer:'from-window-1'}},e.revision);
  });
  const collision=await second.evaluate(async old=>{
   try{await qwBankRepository.updateTask(old.id,old,old.revision);return 'bad-success';}
   catch(e){return e.code;}
  },stale);
  assert.equal(collision,'REVISION_CONFLICT');
  await second.close();await reopened.close();
  const corruptContext=await browser.newContext({offline:true});
  const corrupt=await corruptContext.newPage();await corrupt.goto(url);
  const broken=await corrupt.evaluate(async()=>{
   localStorage.setItem(QW_BANK_KEY,'{ incomplete JSON');
   try{await qwBankOpen();return {ok:true};}
   catch(error){return {ok:false,code:error.code,source:localStorage.getItem(QW_BANK_KEY)};}
  });
  assert.equal(broken.ok,false);
  assert.equal(broken.code,'LEGACY_CORRUPT');
  assert.equal(broken.source,'{ incomplete JSON');
  await corruptContext.close();
  // Two windows may open the same unconverted localStorage bank at once.
  // Exactly one IndexedDB write transaction must migrate the shared source.
  const parallelContext=await browser.newContext({offline:true});
  const a=await parallelContext.newPage(),b=await parallelContext.newPage();
  await a.goto(url);await a.evaluate(()=>{
   const make=id=>{
    const task=qwTask('short');task.prompt='Параллельная миграция '+id;
    return {id,bankNumber:id==='sim1'?7001:7002,subject:'physics',task};
   };
   localStorage.setItem(QW_BANK_KEY,JSON.stringify([make('sim1'),make('sim2')]));
  });
  await b.goto(url);
  const [left,right]=await Promise.all([
   a.evaluate(async()=>{await qwBankOpen();return (await qwBankRepository.getStatistics()).count;}),
   b.evaluate(async()=>{await qwBankOpen();return (await qwBankRepository.getStatistics()).count;})
  ]);
  assert.deepEqual([left,right],[2,2],'parallel migration must be idempotent');
  const afterParallel=await b.evaluate(async()=>qwBankRepository.exportBank());
  assert.deepEqual(afterParallel.items.map(e=>e.id).sort(),['sim1','sim2']);
  await parallelContext.close();
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  const report={status:'PASS',environment:'Chromium offline file HTML',migration:{count:32,backup:true},
   pagination:30,roundtrip:true,revisionConflicts:true,importCollisions:true,deletedPersisted:true,
   closeReopen:true,parallelMigration:true,corruptMigrationBlocked:true,errors,external};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log('PASS TASK166: migration(32), read-only legacy backup, indexed catalogue pagination, revisions, import, restart, corruption');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
