/* TASK166.1: real 1k/5k/10k repository benchmarks, not fabricated metrics. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task166');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({offline:true,viewport:{width:1510,height:950}});
 const page=await ctx.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const url=pathToFileURL(path.join(root,'Quantum-Office.html')).href;
 try{
  await page.goto(url);
  const report=await page.evaluate(async()=>{
   await qwBankOpen();const batch=500,checkpoints=[1000,5000,10000],runs=[];
   const allStart=performance.now(),now=()=>Math.round(performance.now()*100)/100;
   for(let start=0;start<10000;start+=batch){
    const items=Array.from({length:batch},(_,j)=>{
     const i=start+j;
     const task=qwTask('short');
     task.prompt='БЕНЧМАРК Задача масштаба '+String(i+1).padStart(5,'0');
     task.answer=String((i*7)%1009);
     task.comment='### Решение\n1. Записываем закон.\n2. Вычисляем величину.\n3. Проверяем единицы измерения.';
     task.criteria='| Элемент | Баллы |\n| --- | --- |\n| Формула | 1 |\n| Результат | 1 |';
     return {id:'bench-'+(i+1),subject:'physics',grade:'11',exam:'ege',
      year:String(2016+i%9),part:i%2?'2':'1',slot:String(i%32+1),
      difficulty:i%3?'basic':'advanced',topic:i%4?'Механика':'Электричество',
      subtopic:i%2?'Кинематика':'Динамика',origin:'original',task};
    });
    const pre=performance.now();
    const outcome=await qwBankRepository.importBank({format:'quantum-work-bank',version:1,items});
    if(outcome.imported!==batch)throw Error('Incomplete 500-record import');
    const count=start+batch;
    if(checkpoints.includes(count)){
     const readStart=performance.now();
     const all=await qwBankRepository.listTasks({}, {offset:0,limit:30});
     const readMs=performance.now()-readStart;
     const searchStart=performance.now();
     const found=await qwBankRepository.listTasks({topic:'Механика',search:String(count).padStart(5,'0')},{offset:0,limit:30});
     const searchMs=performance.now()-searchStart;
     const info=await qwBankRepository.getStatistics();
     if(all.total!==count||all.items.length!==30||info.count!==count)
      throw Error('Count or pagination mismatched at '+count);
     runs.push({count,importLast500Ms:now()-pre,list30Ms:Math.round(readMs*100)/100,
      indexedSearchMs:Math.round(searchMs*100)/100,matchCount:found.total,
      originUsageBytes:info.estimatedBytes,
      jsHeapBytes:performance.memory?.usedJSHeapSize??null});
    }
   }
   const beforeClose=await qwBankRepository.getStatistics();
   const exported=await qwBankRepository.exportBank();
   if(exported.version!==2||exported.items.length!==10000)throw Error('Extended QWBANK v2 export mismatch');
   await qwBankRepository.close();
   const reopenStart=performance.now();await qwBankRepository.open();
   const reopened=await qwBankRepository.getStatistics();
   const last=await qwBankRepository.getTask('bench-10000');
   if(reopened.count!==10000||last?.task?.prompt!=='БЕНЧМАРК Задача масштаба 10000')
    throw Error('Durability check after close failed');
   return {runs,count:reopened.count,importTotalMs:Math.round((performance.now()-allStart)*100)/100,
    reopenMs:Math.round((performance.now()-reopenStart)*100)/100,
    exportVersion:exported.version,exportIntegrity:typeof exported.checksum==='string',
    persistedLastId:last.id,legacySourceStillUnused:localStorage.getItem(QW_BANK_KEY)===null,
    beforeClose:beforeClose.count};
  });
  assert.equal(report.count,10000);
  assert.equal(report.runs.length,3);
  assert.equal(report.legacySourceStillUnused,true);
  await page.evaluate(()=>qwBank());
  await page.waitForFunction(()=>document.querySelectorAll('#qw-bank-list [data-bank-entry]').length===30);
  assert.equal(await page.locator('#qw-bank-list [data-bank-entry]').count(),30,'10k catalogue must render one page only');
  await page.screenshot({path:path.join(out,'scale-10000-catalogue.png')});
  await page.locator('#qw-dialog [data-qw-close]').click();
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'scale-report.json'),JSON.stringify({status:'PASS',browser:'Chromium',
   sample:'10,000 QWORK-style tasks with text solutions and markdown rubric',...report,errors},null,2));
  console.log('PASS TASK166 scale: 1k/5k/10k, measured IndexedDB timings: '+JSON.stringify(report.runs));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
