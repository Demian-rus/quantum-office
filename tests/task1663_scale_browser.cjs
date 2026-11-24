/* Compare the exact TASK166.2 baseline with TASK166.3 in actual offline Chromium. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task1663');
const base=process.env.QW_TASK1662_HTML||path.join(root,'task1662-baseline','Quantum-Office.html');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const results=[];
 try{
  for(const [version,file] of [['166.2',base],['166.3',path.join(root,'Quantum-Office.html')]]){
   const context=await browser.newContext({offline:true});const page=await context.newPage();await page.goto(pathToFileURL(file).href);
   try{
    for(const count of [1000,5000,10000])for(const scenario of ['text','repeated','distinct','mixed']){
     const result=await page.evaluate(async({count,scenario,version})=>{
      const options={normalize:qwBankNormalize,legacyStorage:{getItem(){return null;}}},name='bench-'+scenario+'-'+count;
      const source=new BankRepository({...options,dbName:name}),target=new BankRepository({...options,dbName:name+'-restore'});
      const ms=x=>Math.round(x*10)/10,timed=async fn=>{const t=performance.now(),value=await fn();return {value,ms:ms(performance.now()-t)};};
      const canvas=document.createElement('canvas');canvas.width=canvas.height=16;const ctx=canvas.getContext('2d');
      function img(i){ctx.fillStyle='rgb('+(i&255)+','+((i>>8)&255)+','+((i>>16)&255)+')';ctx.fillRect(0,0,16,16);return canvas.toDataURL('image/png');}
      const repeat=img(0),items=Array.from({length:count},(_,i)=>{
       const task=qwTask('short');task.id='q'+i;task.prompt='Benchmark '+i;task.answer='Answer '+i;task.comment='Solution '+i;
       task.image=scenario==='text'?'':scenario==='repeated'?repeat:scenario==='distinct'?img(i):i%2?repeat:i%4===0?img(i):'';
       task.figure=task.image?'image':'none';return {id:'b'+String(i).padStart(5,'0'),subject:'physics',topic:i%2?'Odd':'Even',task};
      });
      await source.open();
      const imported=await timed(()=>source.importBank({format:'quantum-work-bank',version:2,items,count,checksum:bankHash(JSON.stringify(items))}));
      if(imported.value.imported!==count)throw Error('count mismatch');
      await source.close();const reopened=await timed(()=>source.open());
      const page=await timed(()=>source.listTasks({},{limit:30,includeImages:false}));
      const search=await timed(()=>source.listTasks({topic:'Odd',search:'Benchmark'},{limit:30,includeImages:false}));
      const id='b'+String(count-1).padStart(5,'0'),one=await timed(()=>source.getTask(id));
      const edit=await timed(()=>source.updateTask(id,{...one.value,task:{...one.value.task,answer:'edited'}},one.value.revision));
      const logical=await timed(()=>source.exportBank());
      const archive=await timed(()=>source.createVerifiedBackup());
      const text=JSON.stringify(archive.value);
      await target.open();const inspect=await timed(()=>target.inspectRestore(text));
      const recovery=await timed(()=>target.restoreVerifiedBackup({token:inspect.value.token,mode:'empty'}));
      await target.close();await target.open();
      const last=await target.getTask(id);
      if(page.value.items.length!==30||search.value.total!==count/2||last.task.image!==edit.value.task.image||last.task.answer!=='edited'||last.bankNumber!==edit.value.bankNumber||!recovery.value.verified)throw Error('round trip mismatch');
      // Measurement only: JSON bytes in task rows and binary bytes, not JS heap or physical disk.
      const rows=await new Promise((resolve,reject)=>{const q=source.db.transaction('tasks').objectStore('tasks').getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
      const taskBytes=new TextEncoder().encode(JSON.stringify(rows)).length;
      const diagnostic=source.assetDiagnostics?await source.assetDiagnostics():null;
      let cleanupMs=null,cleanupDeleted=null;
      if(source.assetDiagnostics){
       const extra=qwTask('short');extra.prompt='orphan test';extra.image=img(1000001);extra.figure='image';
       const created=await source.createTask({id:'orphan-test',subject:'physics',task:extra});await source.deleteTask(created.id,created.revision);
       const clean=await timed(()=>source.assetDiagnostics({clean:true}));cleanupMs=clean.ms;cleanupDeleted=clean.value.deleted;
       if(cleanupDeleted!==1)throw Error('cleanup failed');
      }
      const usage=await source.getStatistics();
      await source.close();await target.close();
      for(const db of [name,name+'-restore'])await new Promise((resolve,reject)=>{const q=indexedDB.deleteDatabase(db);q.onsuccess=resolve;q.onerror=()=>reject(q.error);q.onblocked=()=>reject(Error('delete blocked'));});
      return {version,count,scenario,importMs:imported.ms,openMs:reopened.ms,pageMs:page.ms,searchMs:search.ms,taskMs:one.ms,editMs:edit.ms,taskBytes,assetBytes:diagnostic?.bytes??0,uniqueAssets:diagnostic?.count??null,originUsage:usage.estimatedBytes,exportMs:logical.ms,backupMs:archive.ms,archiveBytes:new TextEncoder().encode(text).length,inspectMs:inspect.ms,restoreMs:recovery.ms,cleanupMs,cleanupDeleted};
     },{count,scenario,version});
     results.push(result);console.log('TASK1663_SCALE '+JSON.stringify(result));
     fs.writeFileSync(path.join(out,'scale-report.json'),JSON.stringify({status:'RUNNING',results},null,2));
    }
   }finally{await context.close();}
  }
  assert.equal(results.length,24);
  fs.writeFileSync(path.join(out,'scale-report.json'),JSON.stringify({status:'PASS',results},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
