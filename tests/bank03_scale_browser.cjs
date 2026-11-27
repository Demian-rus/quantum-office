/* Matched synthetic data, actual accepted/current browser repositories, no production bank. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/bank-03.1');
(async()=>{
 await fs.mkdir(out,{recursive:true});assert.ok(process.env.QW_BANK03_BASE_HTML);
 const browser=await chromium.launch();const results=[];
 try{
 for(const current of [false,true]){
  const context=await browser.newContext({offline:true}),p=await context.newPage();
  await p.goto(pathToFileURL(current?path.join(root,'Quantum-Office.html'):process.env.QW_BANK03_BASE_HTML).href);
  for(const count of [1000,5000,10000]){
   const result=await p.evaluate(async({count,current})=>{
    const repo=new BankRepository({dbName:'scale-'+count,normalize:qwBankNormalize,legacyStorage:{getItem(){return null;}}});
    const timed=async fn=>{const start=performance.now(),value=await fn();return {value,ms:Math.round((performance.now()-start)*100)/100};};
    await repo.open();
    const items=Array.from({length:count},(_,i)=>{
     const task=qwTask('short');task.id='q'+i;task.prompt='Синтетическая задача '+i;task.answer=String(i);task.comment='Решение '+i;task.criteria='1 балл';
     return {id:'b'+String(i).padStart(5,'0'),subject:'physics',exam:'ege',grade:'11',year:i%2?'2027':'2026',topic:i%4?'Механика':'Электричество',task,...(current?{examYears:i%2?[2026,2027]:[2026]}:{})};
    });
    const data={format:'quantum-work-bank',version:2,schema:1,count,items,checksum:bankHash(JSON.stringify(items))};
    const imp=await repo.importBank(data);if(imp.imported!==count)throw Error('import count');
    await repo.close();
    const open=await timed(async()=>{await repo.open();await repo.listFacets(current?['grade','topic','subtopic','year','examYear']:['grade','topic','subtopic','year']);return repo.listTasks({},{limit:30,includeImages:false});});
    const origin=await timed(()=>repo.listTasks({year:'2027'},{limit:30,includeImages:false}));
    const filter=current?{examYear:'2027'}:{year:'2027'};
    const yr=await timed(()=>repo.listTasks(filter,{limit:30,includeImages:false}));
    const combined=await timed(()=>repo.listTasks({...filter,subject:'physics',exam:'ege',topic:'Механика'},{limit:30,includeImages:false}));
    const page=await timed(()=>repo.listTasks(filter,{offset:30,limit:30,includeImages:false}));
    if(open.value.total!==count||yr.value.total!==count/2||combined.value.total!==count/2||page.value.items[0].bankNumber!==62)throw Error('scale filter/pagination');
    let bulk100Ms=null,bulk1000Ms=null,targetsMs=null;
    if(current){
     const targets=await timed(()=>repo.listYearTargets({exam:'ege'}));targetsMs=targets.ms;
     const a=await timed(()=>repo.updateExamYears(targets.value.slice(0,100),'add',[2028,2029]));if(a.value.changed!==100)throw Error('100 update');bulk100Ms=a.ms;
     const next=await repo.listYearTargets({exam:'ege'});const b=await timed(()=>repo.updateExamYears(next.slice(0,1000),'add',[2030]));if(b.value.changed!==1000)throw Error('1000 update');bulk1000Ms=b.ms;
    }
    await repo.close();const reopen=await timed(()=>repo.open());const last=await repo.getTask('b00000');
    if(current&&(!last.examYears.includes(2030)||last.bankNumber!==1))throw Error('reopen years');
    await repo.close();return {count,current,catalogueOpenMs:open.ms,originFilterMs:origin.ms,matchedYearFilterMs:yr.ms,combinedFilterMs:combined.ms,pageMs:page.ms,targetsMs,bulk100Ms,bulk1000Ms,reopenMs:reopen.ms};
   },{count,current});
   results.push(result);console.log('BANK03_SCALE '+JSON.stringify(result));await fs.writeFile(path.join(out,'indexeddb-scale.json'),JSON.stringify({results,method:'Current year-membership vs matched origin filter in accepted version; old version has no bulk operation.'},null,2));
  }await context.close();
 }
 assert.equal(results.length,6);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
