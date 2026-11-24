/* Actual Tauri WebView2 via localhost CDP enabled ONLY on disposable CI runner. */
const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const out=path.join(__dirname,'..','evidence','native');
(async()=>{
 if(process.env.GITHUB_ACTIONS!=='true'||process.platform!=='win32')throw Error('Disposable Windows CI only');
 const {page}=await require('./task1664_cdp.cjs').connectNative(process.argv[2]);
 const errors=[],messages=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))messages.push({type:m.type(),text:m.text()});});
 process.on('exit',()=>fs.writeFileSync(path.join(out,'console-'+process.argv[2]+'.json'),JSON.stringify({errors,messages},null,2)));
 await page.waitForFunction(()=>typeof qwBankRepository!=='undefined'&&qwBankRepository instanceof SQLiteBankRepository&&qwBankRepository.db===true,{},{timeout:60000});
 const stage=process.argv[2];
 if(stage==='first'){
 const result=await page.evaluate(async()=>{
  const check=(v,m)=>{if(!v)throw Error(m);},sort=rows=>rows.slice().sort((a,b)=>a.id.localeCompare(b.id));
  const native=qwBankRepository,options={normalize:qwBankNormalize,legacyStorage:{getItem(){return null;}}};
  check((await native.getStatistics()).count===0,'Test requires empty disposable bank');
  const browser=new BankRepository({...options,dbName:'task1664-source'});
  await browser.open();
  const c=document.createElement('canvas');c.width=1024;c.height=768;const ctx=c.getContext('2d'),image=ctx.createImageData(c.width,c.height);let seed=12345;
  for(let i=0;i<image.data.length;i+=4){for(let j=0;j<3;j++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;image.data[i+j]=seed>>>24;}image.data[i+3]=255;}
  ctx.putImageData(image,0,0);
  const urls=['image/png','image/jpeg','image/webp'].map(m=>c.toDataURL(m,.9));
  const sizes=urls.map(u=>atob(u.split(',')[1]).length);check(sizes.every(n=>n>100000&&n<4000000),'large asset fixtures');
  for(let i=0;i<6;i++){const task=qwTask('short');task.id='q-native-'+i;task.prompt='Native fixture '+i;task.answer='42';task.comment='Solution';task.image=urls[i%3];task.figure='image';await browser.createTask({id:'native-'+i,subject:'physics',topic:'Native',task});}
  const archive=await browser.createVerifiedBackup();const plan=await native.inspectRestore(JSON.stringify(archive));
  const restored=await native.restoreVerifiedBackup({token:plan.token,mode:'empty'});
  const after=await native._captureBackupSnapshot();
  check(restored.verified&&bankStableJSON(sort(after.records))===bankStableJSON(sort(archive.records))&&bankStableJSON(after.meta)===bankStableJSON(archive.meta),'IndexedDB -> SQLite exact');
  const d=await native.assetDiagnostics();check(d.count===3&&d.references===6,'dedup');
  const list=await native.listTasks({topic:'Native'},{limit:2,includeImages:false});check(list.total===6&&list.items.length===2&&list.items.every(x=>!x.task.image),'metadata paging');
  const extra=qwTask('short');extra.prompt='Native create';const made=await native.createTask({id:'native-created',subject:'physics',task:extra});check(made.bankNumber===7&&made.revision===1,'native create');await native.deleteTask(made.id,made.revision);
  const old=await native.getTask('native-0');await native.updateTask(old.id,{...old,task:{...old.task,answer:'edited'}},old.revision);
  let conflict=false;try{await native.updateTask(old.id,old,old.revision);}catch(e){conflict=e.code==='REVISION_CONFLICT';}check(conflict,'CAS');
  const second=await native.getTask('native-3');check(second.task.image===old.task.image,'shared bytes unchanged');
  const nativeArchive=await native.createVerifiedBackup();
  const target=new BankRepository({...options,dbName:'task1664-target'});await target.open();const reverse=await target.inspectRestore(JSON.stringify(nativeArchive));await target.restoreVerifiedBackup({token:reverse.token,mode:'empty'});
  const back=await target._captureBackupSnapshot();check(bankStableJSON(sort(back.records))===bankStableJSON(sort(nativeArchive.records)),'SQLite -> IndexedDB exact');
  await target.close();await browser.close();
  localStorage.setItem('task1664-ci-restart',nativeArchive.manifest.sha256);
  const snapshot=await native.nativeSnapshot();check(snapshot.path,'native backup path');
  return {status:'PASS',sizes,diagnostics:d,records:after.records.length,archiveHash:nativeArchive.manifest.sha256,stats:await native.getStatistics(),snapshot};
 });
 fs.writeFileSync(path.join(out,'native-first.json'),JSON.stringify(result,null,2));
 const routes=await page.evaluate(()=>{const result=[];for(const target of ['home','sheet','writer','slides','photo']){route(target);if(!document.querySelector('#app')?.innerText.trim())throw Error('Empty route '+target);result.push({target,visible:true});}route('home');return result;});
 fs.writeFileSync(path.join(out,'native-routes.json'),JSON.stringify(routes,null,2));
 await page.evaluate(()=>route('writer'));await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
 await page.locator('#qo-diag-workspace').waitFor({state:'visible'});await page.screenshot({path:path.join(out,'native-diagnostics.png')});
 await page.locator('[data-editor="writer"][data-tab="work"]').click();
 await page.evaluate(()=>qwBank({__view:'native-0'}));await page.locator('[data-bank-add="native-0"]').click();
 await page.waitForFunction(()=>qwDoc.tasks.length===1&&!!qwDoc.tasks[0].image);
 // Controlled response tests for save acknowledgement in actual WebView2.
 // SQLite IPC above remains real; this test only controls the save dialog result.
 const ack=await page.evaluate(async()=>{
  const original=qoNativeSave,previous=qwExported;
  const check=(v,m)=>{if(!v)throw Error(m);};
  try{
   let release;qoNativeSave=()=>new Promise(resolve=>{release=resolve;});
   const pending=qwSaveFile();await new Promise(r=>setTimeout(r,20));check(qwExported===previous,'marked saved before native result');
   release(false);await pending;check(qwExported===previous,'cancel marked saved');
   qoNativeSave=async()=>{throw Error('simulated write denied');};await qwSaveFile();check(qwExported===previous,'failure marked saved');
   qoNativeSave=async()=>true;await qwSaveFile();check(qwExported===JSON.stringify(qwDoc),'confirmed write not marked');
   return {status:'PASS',scope:'frontend response contract; not an OS dialog or physical write',pending:true,cancel:true,failure:true,success:true};
  }finally{qoNativeSave=original;qwExported=previous;qwPersist();}
 });
 fs.writeFileSync(path.join(out,'native-save-ack.json'),JSON.stringify(ack,null,2));
 await page.evaluate(()=>{qwDoc.title='TASK166.4 persisted draft';if(!qwPersist())throw Error('Draft write failed');});

 const print=await page.evaluate(async()=>{
  const bytes=await qwPDFBytes({...qwDoc,layout:'worksheet'},false);
  if(String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw Error('PDF signature');
  const frames=[];
  for(const orientation of ['portrait','landscape']){
   const iframe=document.createElement('iframe');iframe.style.cssText='width:1200px;height:1000px;position:fixed;left:0;top:0;z-index:100';document.body.append(iframe);
   iframe.srcdoc=qwPrintDocumentHTML({...qwDoc,layout:'booklet',printSettings:{...qwDoc.printSettings,orientation}},false);
   const start=performance.now();while(!iframe.contentWindow.qwPrintReady){if(performance.now()-start>30000)throw Error('Native print script did not execute');await new Promise(r=>setTimeout(r,50));}
   await iframe.contentWindow.qwPrintReady;if(iframe.contentWindow.__qwPrintError||!iframe.contentDocument.body.dataset.qwLayoutReady)throw Error('Native print layout failed');
   if(iframe.contentDocument.body.dataset.qwOrientation!==orientation)throw Error('Print orientation mismatch');
   frames.push({orientation,ready:true,images:iframe.contentDocument.querySelectorAll('img').length,report:iframe.contentWindow.__qwPrintLayout});iframe.remove();
  }
  return {pdfBytes:bytes.length,frames};
 });
 fs.writeFileSync(path.join(out,'native-print.json'),JSON.stringify(print,null,2));await page.screenshot({path:path.join(out,'native-window.png')});
 }else if(stage==='second'){
 const result=await page.evaluate(async()=>{
  const r=await qwBankRepository.getTask('native-0');if(r?.task.answer!=='edited'||!r.task.image||r.revision!==2)throw Error('SQLite restart mismatch');
  if(!localStorage.getItem('task1664-ci-restart')||qwDoc.title!=='TASK166.4 persisted draft'||qwDoc.tasks.length!==1||!qwDoc.tasks[0].image)throw Error('Real QWORK draft restart mismatch');
  return {status:'PASS',number:r.bankNumber,revision:r.revision,stats:await qwBankRepository.getStatistics()};
 });
 fs.writeFileSync(path.join(out,'native-restart.json'),JSON.stringify(result,null,2));
 }else throw Error('Unknown stage');
 assert.deepEqual(errors,[]);console.log('TASK1664_NATIVE '+stage+' PASS');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
