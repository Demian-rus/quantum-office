/* 0.4.4 -> 0.4.5 actual installer upgrade, bank/draft identity and WebView2 evidence. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {loadContent,seed,runPreview}=require('./ux03_preview.cjs');
const out=path.resolve('evidence/release045'),stage=process.argv[2];fs.mkdirSync(out,{recursive:true});
const content=loadContent('evidence/ux03/content');
let connection;
const write=(name,value)=>fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(value,null,2));
(async()=>{
 connection=await require('./task1664_cdp.cjs').connectNative('release045-'+stage);const {page}=connection;
 await page.waitForFunction(()=>typeof qwBankRepository!=='undefined'&&qwBankRepository instanceof SQLiteBankRepository&&qwBankRepository.db===true,{},{timeout:60000});
 if(stage==='old'){
  assert.equal(await page.evaluate(()=>QO_RELEASE_VERSION),'0.4.4');
  await seed(page,content);
  await page.evaluate(async()=>{
   const repo=await qwBankOpen(),first=await repo.getTask(qwDoc.tasks[0].source.id);
   await repo.updateExamYears([{id:first.id,revision:first.revision}],'add',[2027]);
   const task=qwTask('short');task.prompt='UX-03 upgrade raster preservation';task.answer='42';
   const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const ctx=canvas.getContext('2d');ctx.fillStyle='#336699';ctx.fillRect(0,0,32,32);task.image=canvas.toDataURL();task.figure='image';
   await repo.createTask({id:'ux03-upgrade-asset',subject:'physics',task});
   qoDraftStorage.setItem(QW_PANELS_KEY,JSON.stringify({work:{left:228,right:260,hideLeft:false,hideRight:false},pdf:{left:254,hideLeft:false}}));
   await qoDraftStorage.flush();
  });
 }else assert.equal(await page.evaluate(()=>QO_RELEASE_VERSION),'0.4.5');
 const snapshot=()=>page.evaluate(async()=>{const repo=await qwBankOpen();await qoDraftStorage.flush();return {bank:await repo._captureBackupSnapshot(),drafts:await __TAURI__.core.invoke('draft_load'),project:structuredClone(qwDoc)};});
 const actual=await snapshot();
 if(stage==='old'){assert.equal(actual.bank.records.length,33);write('old',actual);}
 else{
  const expected=JSON.parse(fs.readFileSync(path.join(out,'old.json'),'utf8'));
  const identity=await page.evaluate(({actual,expected})=>({records:bankStableJSON(actual.bank.records)===bankStableJSON(expected.bank.records),meta:bankStableJSON(actual.bank.meta)===bankStableJSON(expected.bank.meta),draft:actual.drafts[QW_KEY]?.value===expected.drafts[QW_KEY]?.value,panels:actual.drafts[QW_PANELS_KEY]?.value===expected.drafts[QW_PANELS_KEY]?.value,project:bankStableJSON(actual.project)===bankStableJSON(expected.project)}),{actual,expected});
  assert.ok(Object.values(identity).every(Boolean),JSON.stringify(identity));write(stage+'-identity',{status:'PASS',...identity});
  if(stage==='new'){
   await runPreview(page,path.join(out,'native-screenshots'),actual.project);
   // Restore only the disposable test project's draft and view preferences before restart.
   await page.evaluate(async({project,panels})=>{
    route('work');qwDoc=qwValidate(project);qwSelected=qwDoc.tasks[0].id;qwPersist();qoDraftStorage.setItem(QW_PANELS_KEY,panels);await qoDraftStorage.flush();qwRender();
   },{project:expected.project,panels:await page.evaluate(e=>e.drafts[QW_PANELS_KEY].value,expected)});
  }
 }
 await connection.browser.close();connection=null;
})().catch(async e=>{console.error(e);process.exitCode=1;if(connection?.browser.isConnected())await connection.browser.close();});
