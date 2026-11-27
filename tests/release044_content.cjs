const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const out=path.resolve('evidence/release044');await fs.mkdir(out,{recursive:true});
 const pack=JSON.parse(await fs.readFile('content/authoring-examples.qwbank','utf8'));
 const browser=await chromium.launch();
 try{
  const ctx=await browser.newContext({offline:true,colorScheme:'light'}),p=await ctx.newPage();await p.goto(pathToFileURL(path.resolve('Quantum-Office.html')).href);
  const proof=await p.evaluate(async pack=>{
   const check=(v,m)=>{if(!v)throw Error(m);};
   check(QO_RELEASE_VERSION==='0.4.4','version');
   const repo=await qwBankOpen(),first=await repo.importBank(pack),repeat=await repo.importBank(pack);
   check(first.imported===5&&repeat.skipped===5&&repeat.imported===0,'import/dedup');
   const saved=await Promise.all(pack.items.map(x=>repo.getTask(x.id)));check(new Set(saved.map(x=>x.bankNumber)).size===5&&saved.every(x=>x.bankNumber>0),'local numbers');
   const work=qwValidate({...qwProject(),layout:'booklet',tasks:saved.map(x=>({...x.task,source:qwBankSource(x)}))});
   for(const t of work.tasks){check(t.prompt&&t.answer&&t.comment&&t.criteria,'fields');for(const k of ['prompt','answer','comment','criteria'])for(const m of t[k].matchAll(/\\\(([\s\S]+?)\\\)/g))qwMath(m[1]);if(t.figure==='graph')check(qwGraphSVG(t.graph).includes('<svg'),'graph');if(t.figure==='diagram')check(qwDiagramSVG(t.diagram).includes('<svg'),'diagram');}
   const v2={...pack,version:2,schema:1,count:pack.items.length,checksum:bankHash(JSON.stringify(pack.items))};check((await repo.importBank(v2)).skipped===5,'v2');
   const legacy=saved[0],targets=[{id:legacy.id,revision:legacy.revision}];await repo.updateExamYears(targets,'add',[2027]);check((await repo.listTasks({examYear:'2027'})).total===1,'years on isolated example');
   return {work,first,repeat,bankNumbers:saved.map(x=>x.bankNumber)};
  },pack);
  for(const [name,opts] of [['variant',{format:'booklet'}],['key',{format:'answers',keyMode:'detailed',includeCriteria:true}]]){
   const html=await p.evaluate(({work,opts})=>qwPrintDocumentHTML(work,false,opts),{work:proof.work,opts});
   const print=await ctx.newPage();await print.setContent(html);await print.evaluate(()=>window.qwPrintReady);assert.equal(await print.evaluate(()=>window.__qwPrintError),undefined);
   assert.equal(await print.locator('.qw-formula-error').count(),0);
   await print.pdf({path:path.join(out,'authoring-'+name+'.pdf'),preferCSSPageSize:true,printBackground:true});await print.close();
  }
  await fs.writeFile(path.join(out,'content-report.json'),JSON.stringify({status:'PASS',...proof},null,2));await ctx.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
