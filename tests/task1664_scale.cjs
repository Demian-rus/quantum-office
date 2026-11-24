/* Compare real SQLite IPC and IndexedDB in the same release WebView2 on disposable Windows CI. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 if(process.env.GITHUB_ACTIONS!=='true'||process.platform!=='win32')throw Error('Disposable CI only');
 const out=path.join(__dirname,'..','evidence','native','scale-report.json');
 const {page}=await require('./task1664_cdp.cjs').connectNative('scale');
 const results=[];const save=status=>fs.writeFileSync(out,JSON.stringify({status,results,method:'Actual WebView2; same generated fixtures; SQLite IPC end-to-end vs IndexedDB; origin usage is not physical SQLite file size.'},null,2));
 // A separate archive preserves the smoke fixtures while the CI-only bank is reused.
 const initial=await page.evaluate(async()=>JSON.stringify(await qwBankRepository.createVerifiedBackup()));
 for(const count of [1000,5000,10000])for(const scenario of ['text','repeated','distinct','mixed'])for(const storage of ['IndexedDB','SQLite']){
  const result=await page.evaluate(async({count,scenario,storage})=>{
   const options={normalize:qwBankNormalize,legacyStorage:{getItem(){return null;}}},name='native-scale-'+count+'-'+scenario;
   const source=storage==='SQLite'?qwBankRepository:new BankRepository({...options,dbName:name});
   const check=(v,m)=>{if(!v)throw Error(m);};
   const timed=async fn=>{const t=performance.now(),value=await fn();return {value,ms:Math.round((performance.now()-t)*10)/10};};
   const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');
   function img(i){for(let j=0;j<16;j++){ctx.fillStyle='rgb('+((i*7+j*41)&255)+','+((i*13+j*53)&255)+','+((i*19+j*67)&255)+')';ctx.fillRect(j%4*16,Math.floor(j/4)*16,16,16);}ctx.fillStyle='rgb('+(i&255)+','+((i>>8)&255)+','+((i>>16)&255)+')';ctx.fillRect(0,0,8,8);return canvas.toDataURL('image/png');}
   const repeat=img(0),items=Array.from({length:count},(_,i)=>{const task=qwTask('short');task.id='q'+i;task.prompt='Benchmark '+i;task.answer='Answer '+i;task.comment='Solution '+i;task.image=scenario==='text'?'':scenario==='repeated'?repeat:scenario==='distinct'?img(i):i%2?repeat:i%4===0?img(i):'';task.figure=task.image?'image':'none';return {id:'b'+String(i).padStart(5,'0'),subject:'physics',topic:i%2?'Odd':'Even',task};});
   await source.close();const opened=await timed(()=>source.open());
   const empty=await createBankBackupV3({records:[],meta:{sequence:0,legacyMigration:null,legacyBackup:null}});
   const clear=async()=>{const plan=await source.inspectRestore(JSON.stringify(empty));if(plan.currentCount)await source.restoreVerifiedBackup({token:plan.token,mode:'replace'});};
   await clear();
   const imp=await timed(()=>source.importBank({format:'quantum-work-bank',version:2,items,count,checksum:bankHash(JSON.stringify(items))}));check(imp.value.imported===count,'import count');
   const page=await timed(()=>source.listTasks({},{limit:30,includeImages:false}));
   const search=await timed(()=>source.listTasks({search:'Benchmark'},{limit:30,includeImages:false}));
   const filter=await timed(()=>source.listTasks({topic:'Odd'},{limit:30,includeImages:false}));
   const id='b'+String(count-1).padStart(5,'0'),one=await timed(()=>source.getTask(id));
   const edit=await timed(()=>source.updateTask(id,{...one.value,task:{...one.value.task,answer:'edited'}},one.value.revision));
   const exp=await timed(()=>source.exportBank()),backup=await timed(()=>source.createVerifiedBackup());
   const diagnostics=await source.assetDiagnostics(),stats=await source.getStatistics(),text=JSON.stringify(backup.value);
   check(page.value.items.length===30&&page.value.items.every(x=>!x.task.image)&&search.value.total===count&&filter.value.total===count/2,'page/search/filter');
   await clear();const inspect=await timed(()=>source.inspectRestore(text));const restore=await timed(()=>source.restoreVerifiedBackup({token:inspect.value.token,mode:'empty'}));
   const last=await source.getTask(id);check(restore.value.verified&&last.task.image===edit.value.task.image&&last.task.answer==='edited'&&last.bankNumber===edit.value.bankNumber,'restore verification');
   await source.close();if(storage==='IndexedDB')await new Promise((resolve,reject)=>{let q=indexedDB.deleteDatabase(name);q.onsuccess=resolve;q.onerror=()=>reject(q.error);q.onblocked=()=>reject(Error('delete blocked'));});
   return {count,scenario,storage,openMs:opened.ms,importMs:imp.ms,pageMs:page.ms,searchMs:search.ms,filterMs:filter.ms,taskMs:one.ms,saveMs:edit.ms,exportMs:exp.ms,backupMs:backup.ms,inspectMs:inspect.ms,restoreMs:restore.ms,archiveBytes:new TextEncoder().encode(text).length,assetBytes:diagnostics.bytes,uniqueAssets:diagnostics.count,storageBytes:stats.estimatedBytes};
  },{count,scenario,storage});
  results.push(result);console.log('TASK1664_SCALE '+JSON.stringify(result));save('RUNNING');
 }
 await page.evaluate(async text=>{const plan=await qwBankRepository.inspectRestore(text);const result=await qwBankRepository.restoreVerifiedBackup({token:plan.token,mode:plan.currentCount?'replace':'empty'});if(!result.verified)throw Error('fixture restore');},initial);
 if(results.length!==24)throw Error('missing benchmark results');save('PASS');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
