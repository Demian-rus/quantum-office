/* TASK166.2: measured SHA-256 backup/restore at 1k, 5k, 10k in offline Chromium. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task1662');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const errors=[];
 try{
  const ctx=await browser.newContext({offline:true});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  const results=await page.evaluate(async()=>{
   await qwBankOpen();
   const checkpoints=[1000,5000,10000],runs=[];
   for(let start=0;start<10000;start+=500){
    const items=Array.from({length:500},(_,i)=>{
     const j=start+i,task=qwTask(j%3?'short':'graph');
     task.prompt='Контроль сохранности данных '+j;
     task.answer='Ответ '+j;
     task.comment='### Письменное решение\nТеория и вычисления '+j;
     task.criteria='|Критерий|Балл|\n|---|---|\n|Формула|1|';
     task.diagram=[{kind:'line',x:0,y:5,x2:80,y2:90}];
     task.image='data:image/png;base64,cHJvYmE=';
     return {id:'task1662-'+j,subject:'physics',grade:'11',exam:'ege',
      year:'2018',part:'1',slot:String(j%32+1),topic:'Динамика',task};
    });
    const imported=await qwBankRepository.importBank({format:'quantum-work-bank',version:1,items});
    if(imported.imported!==500)throw Error('Import partial');
    const count=start+500;
    if(!checkpoints.includes(count))continue;
    const t0=performance.now();
    const backup=await qwBankRepository.createVerifiedBackup();
    const backupMs=performance.now()-t0;
    const serialized=JSON.stringify(backup);
    const bytes=new TextEncoder().encode(serialized).byteLength;
    const checkStart=performance.now();
    const verified=await verifyBankBackupV3(serialized);
    const verifyMs=performance.now()-checkStart;
    const target=new BankRepository({dbName:'task1662-scale-'+count,
     legacyStorage:{getItem(){return null}},normalize:qwBankNormalize});
    await target.open();
    const prepStart=performance.now();
    const inspected=await target.inspectRestore(serialized);
    const inspectionMs=performance.now()-prepStart;
    const restoreStart=performance.now();
    const outcome=await target.restoreVerifiedBackup({token:inspected.token,mode:'empty'});
    const restoreMs=performance.now()-restoreStart;
    await target.close();
    const reopenStart=performance.now();
    await target.open();
    const reopened=await target.getStatistics();
    const last=await target.getTask('task1662-'+(count-1));
    const reopenMs=performance.now()-reopenStart;
    const source=await qwBankRepository.getTask('task1662-'+(count-1));
    if(verified.count!==count||outcome.restored!==count||reopened.count!==count||
     bankStableJSON(last)!==bankStableJSON(source))
     throw Error('Unmatched recovered records after reopen');
    runs.push({count,bytes,backupMs:Math.round(backupMs*100)/100,
     verifyMs:Math.round(verifyMs*100)/100,inspectionMs:Math.round(inspectionMs*100)/100,
     restoreMs:Math.round(restoreMs*100)/100,reopenMs:Math.round(reopenMs*100)/100,
     firstId:(await target.listTasks({},{limit:1,offset:0})).items[0].id,
     lastId:last.id,sha256:backup.manifest.sha256,verified:outcome.verified});
    await target.close();
   }
   await qwBankRepository.close();await qwBankOpen();
   return {runs,count:(await qwBankRepository.getStatistics()).count};
  });
  assert.equal(results.count,10000);assert.deepEqual(results.runs.map(x=>x.count),[1000,5000,10000]);
  assert.ok(results.runs.every(x=>x.verified&&x.bytes>1000));
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'scale-report.json'),JSON.stringify({status:'PASS',
   environment:'Chromium offline',...results,errors},null,2));
  console.log('TASK166.2 1k/5k/10k PASS '+JSON.stringify(results.runs));
  await ctx.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
