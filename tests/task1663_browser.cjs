/* TASK166.3 — actual offline Chromium, v1 upgrade, binary roundtrip and failure invariants. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),url=pathToFileURL(path.join(root,'Quantum-Office.html')).href;
const out=path.join(root,'evidence/task1663');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({offline:true,viewport:{width:1440,height:900}});
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));
 try{
  await p.goto(url);
  const result=await p.evaluate(async()=>{
   const check=(v,msg)=>{if(!v)throw Error(msg);};
   const options={normalize:qwBankNormalize,legacyStorage:{getItem(){return null;}}};
   const png=color=>{const c=document.createElement('canvas');c.width=c.height=12;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,12,12);return c.toDataURL('image/png');};
   const imageA=png('#123456'),imageB=png('#aabbcc'),imageC=png('#ff0000');
   const task=(id,image)=>{const t=qwTask('short');t.id='task-'+id;t.prompt='Условие '+id;t.answer='Ответ '+id;t.comment='Решение '+id;t.criteria='Критерии '+id;t.figure=image?'image':'none';t.image=image;return {id,subject:'physics',task:t};};
   const read=(db,name,key)=>new Promise((resolve,reject)=>{const q=db.transaction(name).objectStore(name).get(key);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
   const rawRows=db=>new Promise((resolve,reject)=>{const q=db.transaction('tasks').objectStore('tasks').getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
   const put=(db,name,value)=>new Promise((resolve,reject)=>{const tx=db.transaction(name,'readwrite');tx.objectStore(name).put(value);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
   const seedV1=async(name,count,bad=false)=>{
    const db=await new Promise((resolve,reject)=>{const q=indexedDB.open(name,1);
     q.onupgradeneeded=()=>{const store=q.result.createObjectStore('tasks',{keyPath:'id'});for(const field of BANK_INDEX_FIELDS)store.createIndex(field,field,{unique:field==='bankNumber'});q.result.createObjectStore('meta',{keyPath:'key'});};
     q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);
    });
    const records=Array.from({length:count},(_,i)=>({...qwBankNormalize(task('v1-'+String(i).padStart(3,'0'),bad&&i===0?'data:image/png;base64,A':i%2?imageA:imageB)),bankNumber:100+i,revision:1,createdAt:'2026-11-01T00:00:00.000Z',updatedAt:'2026-11-01T00:00:00.000Z'}));
    for(const r of records)r.type=r.task.type;
    await new Promise((resolve,reject)=>{const tx=db.transaction(['tasks','meta'],'readwrite');for(const row of records)tx.objectStore('tasks').add(row);tx.objectStore('meta').put({key:'legacyMigration',state:'none',createdAt:'2026-11-01T00:00:00.000Z'});tx.objectStore('meta').put({key:'sequence',value:100+count});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
    return {db,records};
   };
   const before=await seedV1('asset-v1-upgrade',36);
   const repo=new BankRepository({...options,dbName:'asset-v1-upgrade'});
   let blocked=false;try{await repo.open();}catch(e){blocked=e.code==='IDB_BLOCKED';}
   check(blocked,'v1 upgrade must not silently replace blocked DB');before.db.close();
   const oldPut=IDBObjectStore.prototype.put;let writes=0;
   IDBObjectStore.prototype.put=function(v){if(this.name==='tasks'&&++writes===17)throw Error('injected migration interruption');return oldPut.call(this,v);};
   try{await repo.open();}finally{IDBObjectStore.prototype.put=oldPut;}
   check(!!repo.assetMigrationError,'migration error reported');
   const partial=await rawRows(repo.db);
   check(partial.length===36&&partial.filter(r=>r.imageAsset).length===16,'only completed migration batch committed');
   check(!(await repo._meta('assetMigration')),'interrupted migration cannot mark complete');
   for(const original of before.records){const item=await repo.getTask(original.id);check(bankStableJSON(item)===bankStableJSON(original),'old content lost: '+original.id);}
   await repo.close();await repo.open();
   check(!repo.assetMigrationError&&(await repo._meta('assetMigration')).state==='complete','migration retries');
   const migrated=await rawRows(repo.db),migrationStats=await repo.assetDiagnostics();
   check(migrated.every(r=>r.imageAsset&&!r.task.image)&&migrationStats.count===2&&migrationStats.references===36,'v1 converted and deduplicated');
   for(const original of before.records)check(bankStableJSON(await repo.getTask(original.id))===bankStableJSON(original),'migration changed content');
   await repo.close();
   const malformed=await seedV1('asset-v1-malformed',1,true);malformed.db.close();
   const badRepo=new BankRepository({...options,dbName:'asset-v1-malformed'});await badRepo.open();
   check(!!badRepo.assetMigrationError&&(await badRepo.getTask('v1-000')).task.image==='data:image/png;base64,A','malformed legacy image not retained');
   check(!(await badRepo._meta('assetMigration')),'malformed migration marked completed');
   await badRepo.close();
   const b=qwBankRepository;await b.open();
   const one=await b.createTask(task('shared-a',imageA)),two=await b.createTask(task('shared-b',imageA)),three=await b.createTask(task('shared-c',imageB));
   const first=await b.assetDiagnostics();check(first.count===2&&first.references===3,'dedup failed');
   const raw=await rawRows(b.db);check(raw.every(r=>!r.task.image&&r.imageAsset),'raw stores inline images');
   const original=bankStableJSON(await b._captureBackupSnapshot());
   const origAdd=IDBObjectStore.prototype.add;
   let quota=false;IDBObjectStore.prototype.add=function(v){if(this.name==='assets')throw new DOMException('injected quota','QuotaExceededError');return origAdd.call(this,v);};
   try{await b.createTask(task('quota-failed',imageC));}catch(e){quota=e.name==='QuotaExceededError';}finally{IDBObjectStore.prototype.add=origAdd;}
   check(bankStableJSON(await b._captureBackupSnapshot())===original,'quota rollback changed source');
   check(quota,'original quota error must survive abort of pending requests');
   let invalid=false,mime=false;
   try{await b.createTask(task('bad','data:image/png;base64,A'));}catch(e){invalid=true;}
   try{await b.createTask(task('bad-mime','data:image/svg+xml;base64,YQ=='));}catch(e){mime=true;}
   check(invalid&&mime&&bankStableJSON(await b._captureBackupSnapshot())===original,'invalid inputs changed bank');
   const sharedKey=raw.find(r=>r.id==='shared-a').imageAsset.key;
   const good=await read(b.db,'assets',sharedKey),corrupt=structuredClone(good);new Uint8Array(corrupt.bytes)[0]^=1;await put(b.db,'assets',corrupt);
   let checksum=false,collision=false,backupRejected=false;
   try{await b.getTask('shared-a');}catch(e){checksum=e.code==='ASSET_CHECKSUM';}
   try{await b.createTask(task('collision',imageA));}catch(e){collision=e.code==='ASSET_COLLISION';}
   try{await b.createVerifiedBackup();}catch(e){backupRejected=e.code==='ASSET_CHECKSUM';}
   check(checksum&&collision&&backupRejected,'corrupt binary not detected');
   await put(b.db,'assets',good);
   check(bankStableJSON(await b._captureBackupSnapshot())===original,'collision wrote a task');
   const changed=await b.updateTask(one.id,task(one.id,imageC),one.revision);
   check((await b.getTask(two.id)).task.image===imageA&&changed.task.image===imageC,'editing shared data mutated another row');
   await b.deleteTask(two.id,two.revision);await b.deleteTask(three.id,three.revision);
   const orphans=await b.assetDiagnostics();check(orphans.orphans===2&&orphans.references===1,'orphan detection');
   let cleanupFailed=false,deletes=0;const origDelete=IDBObjectStore.prototype.delete;
   IDBObjectStore.prototype.delete=function(key){if(this.name==='assets'&&++deletes===2)throw Error('injected cleanup failure');return origDelete.call(this,key);};
   try{await b.assetDiagnostics({clean:true});}catch(e){cleanupFailed=true;}finally{IDBObjectStore.prototype.delete=origDelete;}
   check(cleanupFailed&&(await b.assetDiagnostics()).orphans===2,'partial cleanup committed');
   const cleaned=await b.assetDiagnostics({clean:true});check(cleaned.deleted===2&&(await b.getTask(one.id)).task.image===imageC,'cleanup removed used data');
   const v1={format:'quantum-work-bank',version:1,items:[task('import-a',imageA),task('import-b',imageA)]};
   check((await b.importBank(v1)).imported===2,'old v1 import');
   check((await b.importBank(v1)).skipped===2,'repeat import not skipped');
   const v2items=[task('import-c',imageB)],v2={format:'quantum-work-bank',version:2,items:v2items,count:v2items.length,checksum:bankHash(JSON.stringify(v2items))};
   check((await b.importBank(v2)).imported===1,'old v2 import');
   const beforeCancel=bankStableJSON(await b._captureBackupSnapshot()),ctrl=new AbortController();
   IDBObjectStore.prototype.add=function(v){if(this.name==='tasks'){ctrl.abort();}return origAdd.call(this,v);};
   let cancelled=false;try{await b.importBank({format:'quantum-work-bank',version:1,items:[task('cancelled',imageA)]},{signal:ctrl.signal});}catch(e){cancelled=e.code==='ASSET_CANCELLED';}finally{IDBObjectStore.prototype.add=origAdd;}
   check(bankStableJSON(await b._captureBackupSnapshot())===beforeCancel,'cancelled import changed bank');
   check(cancelled,'cancelled import lost the original failure reason');
   const archive=await b.createVerifiedBackup();
   check((await verifyBankBackupV3(archive)).count===4&&archive.records.every(r=>r.task.image&&!r.imageAsset),'portable archive leaked internal references');
   const target=new BankRepository({...options,dbName:'asset-restore'});await target.open();
   await target.createTask(task('old',imageB));const prior=bankStableJSON(await target._captureBackupSnapshot());
   const inspected=await target.inspectRestore(JSON.stringify(archive));let failed=false;
   IDBObjectStore.prototype.add=function(v){if(this.name==='assets')throw Error('injected asset write failure');return origAdd.call(this,v);};
   try{await target.restoreVerifiedBackup({token:inspected.token,mode:'replace'});}catch(e){failed=true;}finally{IDBObjectStore.prototype.add=origAdd;}
   check(failed&&bankStableJSON(await target._captureBackupSnapshot())===prior,'restore asset failure damaged previous bank');
   const ok=await target.inspectRestore(archive);await target.restoreVerifiedBackup({token:ok.token,mode:'replace'});
   await target.close();await target.open();
   const final=await target._captureBackupSnapshot(),sort=x=>x.slice().sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
   check(bankStableJSON(sort(final.records))===bankStableJSON(sort(archive.records)),'restored bytes/IDs/numbers mismatch');
   const combined=await encodeOfficeBackupWithBank(workspace,qoWriter,qoSlides,qoPhotoState(),archive),decoded=await decodeOfficeBackupWithBank(combined);
   check(bankStableJSON(decoded.bank)===bankStableJSON(archive),'.qbackup v3 lost bank images');
   const exported=await b.exportBank();check(exported.items.every(r=>r.task.image&&!r.imageAsset),'QWBANK interchange missing image');
   const portable=await b.getTask(one.id);
   const rendered=await qwFigureImage(portable.task);check(rendered.naturalWidth===12,'print image failed decode');
   const qw=qwValidate({...qwProject(),tasks:[portable.task]});check(qw.tasks[0].image===imageC&&!qw.tasks[0].imageAsset,'QWORK v1 image mismatch');
   let assetReads=0;const oldGet=IDBObjectStore.prototype.get;
   IDBObjectStore.prototype.get=function(k){if(this.name==='assets')assetReads++;return oldGet.call(this,k);};
   try{await b.listTasks({},{limit:30,includeImages:false});check(assetReads===0,'catalogue loads images');await b.getTask(one.id);check(assetReads===1,'selected image not loaded on demand');}finally{IDBObjectStore.prototype.get=oldGet;}
   await target.close();
   return {migration:{blocked,interrupted:partial.filter(r=>r.imageAsset).length,completed:migrated.length,assets:migrationStats.count,malformedRetained:true},shared:first,quota,invalid,mime,checksum,collision,backupRejected,cleanupFailed,cleaned,cancelled,restoreRollback:failed,byteExact:true,officeV3:true,qworkV1:true,lazyReads:assetReads,archiveCount:archive.count};
  });
  await p.evaluate(()=>qwBank({__view:'shared-a'}));
  await p.locator('#qw-bank-preview img').waitFor({state:'visible'});
  assert.ok(await p.locator('#qw-bank-preview img').evaluate(img=>img.naturalWidth>0));
  await p.screenshot({path:path.join(out,'asset-bank-preview.png')});
  // Same origin, another tab: revision conflict must not overwrite an image.
  const second=await context.newPage();await second.goto(url);
  const stale=await second.evaluate(async()=>{await qwBankOpen();return qwBankRepository.getTask('shared-a');});
  const fresh=await p.evaluate(async()=>{const row=await qwBankRepository.getTask('shared-a');return qwBankRepository.updateTask(row.id,{...row,task:{...row.task,answer:'fresh'}},row.revision);});
  const conflict=await second.evaluate(async old=>{try{await qwBankRepository.updateTask(old.id,old,old.revision);return false;}catch(e){return e.code==='REVISION_CONFLICT';}},stale);
  assert.equal(conflict,true);assert.equal((await p.evaluate(()=>qwBankRepository.getTask('shared-a'))).task.image,fresh.task.image);
  assert.deepEqual(errors,[]);
  const report={status:'PASS',...result,conflict,uiPreview:true};
  fs.writeFileSync(path.join(out,'asset-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
