/* Actual Tauri WebView2 via localhost CDP enabled ONLY on disposable CI runner. */
const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const out=path.join(__dirname,'..','evidence','native');
async function inspectDraft(page){
 return page.evaluate(async()=>{
  const hashBytes=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',v)),b=>b.toString(16).padStart(2,'0')).join('');
  const digest=async v=>v===null||v===undefined?null:hashBytes(new TextEncoder().encode(v));
  const image=async q=>({title:q?.title??null,count:q?.tasks?.length??null,imagePresent:!!q?.tasks?.[0]?.image,imageSha256:await digest(q?.tasks?.[0]?.image),images:await Promise.all((q?.tasks||[]).map(async t=>t.image?hashBytes(Uint8Array.from(atob(t.image.split(',')[1]),c=>c.charCodeAt(0))):null))});
  const result={origin:location.origin,marker:false,legacyRawPresent:false,legacyRawBytes:null,legacyRawSha256:null,rawPresent:false,rawBytes:null,rawSha256:null,parse:null,validate:null,storageError:qwStorageError,corrupt:!!qwCorrupt,live:await image(qwDoc)};
  try{
   result.marker=!!localStorage.getItem('task1664-ci-restart');
   const legacy=localStorage.getItem(QW_KEY);result.legacyRawPresent=legacy!==null;result.legacyRawBytes=legacy===null?null:new TextEncoder().encode(legacy).length;result.legacyRawSha256=await digest(legacy);
  }catch(e){result.legacyReadError=e.message;}
  try{
   const raw=qoDraftStorage.getItem(QW_KEY),rows=await __TAURI__.core.invoke('draft_load'),disk=rows[QW_KEY];result.rawPresent=raw!==null;result.nativeRevision=disk?.revision??null;result.nativeSha256=disk?.sha256??null;result.pending=qoDraftStorage.pending;result.nativeError=qoDraftStorage.error;
   if(raw!==null){result.rawBytes=new TextEncoder().encode(raw).length;result.rawSha256=await digest(raw);result.diskMatches=raw===disk?.value&&result.rawSha256===disk.sha256;
    let parsed;try{parsed=JSON.parse(raw);result.parse={ok:true,...await image(parsed)};}catch(e){result.parse={ok:false,error:e.message};}
    if(result.parse.ok)try{result.validate={ok:true,...await image(qwValidate(parsed))};}catch(e){result.validate={ok:false,error:e.message};}
   }
   result.liveSha256=await digest(bankStableJSON(qwValidate(qwDoc)));
  }catch(e){result.readError=e.message;}
  return result;
 });
}
async function inspectEditors(page){
 return page.evaluate(async()=>{
  const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
  const disk=await __TAURI__.core.invoke('draft_load');
  const rows={};for(const [name,key] of Object.entries({writer:qoWriterKey,sheets:STORE_KEY,slides:qoSlidesKey,studio:qoPhotoStorageKey,qwork:QW_KEY})){
   const raw=qoDraftStorage.getItem(key);if(raw===null||disk[key]?.value!==raw||await hash(raw)!==disk[key]?.sha256)throw Error('Missing or unconfirmed native draft '+name);
   rows[name]={bytes:new TextEncoder().encode(raw).length,sha256:disk[key].sha256,revision:disk[key].revision};
  }
  const b=workspace.books.find(x=>x.name==='TASK1664 Sheets');
  const q=qdWorkingDoc(),studio=qoPhotoState(),sheetData=b?.sheets[0];
  const live={
   writer:{name:qoWriter.name,html:qoWriter.html},
   sheets:{name:b?.name??null,a1:sheetData?getCell(sheetData,'A1').value:null,b1:sheetData?getCell(sheetData,'B1').value:null,c1:sheetData?getCell(sheetData,'C1').value:null},
   slides:{name:qoSlides.name,items:qoSlides.slides[0]?.items},
   studio:{name:studio.name,width:studio.width,height:studio.height,bg:studio.bg,strokes:studio.strokes},
   diagnostics:{title:q.title,questions:qdQuestionList(q).map(x=>({id:x.id,prompt:x.prompt,answer:x.answer,points:x.points}))},
   qwork:{title:qwDoc.title,count:qwDoc.tasks.length}
  };
  const signatures={};for(const [name,value] of Object.entries(live))signatures[name]=await hash(bankStableJSON(value));
  return {rows,signatures,fixtures:{writer:live.writer.name==='TASK1664 Writer'&&live.writer.html.includes('Newton'),sheets:live.sheets.a1==='12'&&live.sheets.b1==='30'&&live.sheets.c1==='=A1+B1',slides:live.slides.name==='TASK1664 Slides'&&live.slides.items.some(x=>x.text==='TASK1664 slide body'),studio:live.studio.name==='TASK1664 Studio'&&live.studio.strokes.some(x=>x.id==='shape-1664'),diagnostics:live.diagnostics.title==='TASK1664 Diagnostics'&&live.diagnostics.questions.some(x=>x.prompt==='What is acceleration?'&&x.answer==='Change of velocity per time'),qwork:live.qwork.title==='TASK166.4 persisted draft'&&live.qwork.count===3}};
 });
}
function recordDraft(stage,d){fs.writeFileSync(path.join(out,'draft-'+stage+'.json'),JSON.stringify(d,null,2));console.log('TASK1664_DRAFT '+stage+' '+JSON.stringify(d));}
(async()=>{
  const digest=async v=>v===null||v===undefined?null:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),b=>b.toString(16).padStart(2,'0')).join('');
  const image=async q=>({title:q?.title??null,count:q?.tasks?.length??null,imagePresent:!!q?.tasks?.[0]?.image,imageSha256:await digest(q?.tasks?.[0]?.image)});
  const result={origin:location.origin,marker:false,rawPresent:false,rawBytes:null,rawSha256:null,parse:null,validate:null,storageError:qwStorageError,corrupt:!!qwCorrupt,live:await image(qwDoc)};
  try{
   result.marker=!!localStorage.getItem('task1664-ci-restart');
   const raw=localStorage.getItem(QW_KEY);result.rawPresent=raw!==null;
   if(raw!==null){result.rawBytes=new TextEncoder().encode(raw).length;result.rawSha256=await digest(raw);
    let parsed;try{parsed=JSON.parse(raw);result.parse={ok:true,...await image(parsed)};}catch(e){result.parse={ok:false,error:e.message};}
    if(result.parse.ok)try{result.validate={ok:true,...await image(qwValidate(parsed))};}catch(e){result.validate={ok:false,error:e.message};}
   }
  }catch(e){result.readError=e.message;}
  return result;
 });
}
function recordDraft(stage,d){fs.writeFileSync(path.join(out,'draft-'+stage+'.json'),JSON.stringify(d,null,2));console.log('TASK1664_DRAFT '+stage+' '+JSON.stringify(d));}
(async()=>{
 if(process.env.GITHUB_ACTIONS!=='true'||process.platform!=='win32')throw Error('Disposable Windows CI only');
 const {page}=await require('./task1664_cdp.cjs').connectNative(process.argv[2]);
 const errors=[],messages=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))messages.push({type:m.type(),text:m.text()});});
 process.on('exit',()=>fs.writeFileSync(path.join(out,'console-'+process.argv[2]+'.json'),JSON.stringify({errors,messages},null,2)));
 await page.waitForFunction(()=>typeof qwBankRepository!=='undefined'&&qwBankRepository instanceof SQLiteBankRepository&&qwBankRepository.db===true,{},{timeout:60000});
 const stage=process.argv[2];
 if(stage==='first'){
 // Exercise actual migration before any editor data is created. No mock IPC.
 const seed=await page.evaluate(()=>{
  if(qoDraftStorage.getItem(QW_KEY)!==null)throw Error('Migration test requires absent native QWORK');
  const draft=qwProject();draft.title='TASK1664 legacy draft';const task=qwTask('short');task.prompt='Legacy migration question';task.answer='42';draft.tasks=[task];
  const raw=JSON.stringify(draft);localStorage.setItem(QW_KEY,raw);return raw;
 });
 await page.reload({waitUntil:'load'});
 await page.waitForFunction(()=>typeof qwBankRepository!=='undefined'&&qwBankRepository.db===true,{},{timeout:60000});
 const migration=await page.evaluate(async raw=>{
  const disk=(await __TAURI__.core.invoke('draft_load'))[QW_KEY];
  if(localStorage.getItem(QW_KEY)!==raw||disk?.value!==raw||qwDoc.title!=='TASK1664 legacy draft'||qwDoc.tasks[0]?.prompt!=='Legacy migration question')throw Error('Legacy migration not exact');
  qwDoc=qwProject();qwDoc.layout='compact';if(!qwPersist())throw Error('Reset disposable fixture failed');await qoDraftStorage.flush();
  if(localStorage.getItem(QW_KEY)!==raw)throw Error('Legacy source overwritten');
  return {status:'PASS',sourceRetained:true,migrationRevision:disk.revision,migrationSha256:disk.sha256};
 },seed);
 fs.writeFileSync(path.join(out,'native-migration.json'),JSON.stringify(migration,null,2));
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
 // Keep the original one-task assertion above, then add two more real bank images
 // to exceed the browser localStorage quota while remaining within QWORK limits.
 for(let i=1;i<3;i++){
  await page.evaluate(i=>qwBank({__view:'native-'+i}),i);
  await page.locator('[data-bank-add="native-'+i+'"]').click();
  await page.waitForFunction(count=>qwDoc.tasks.length===count&&qwDoc.tasks.every(q=>q.image),i+1);
 }
 await page.evaluate(()=>{
  // Real editor persistence functions and actual data structures.
  route('writer');
  const title=document.getElementById('qo-writer-title');title.value='TASK1664 Writer';
  document.getElementById('qo-writer-page').innerHTML='<h1>Newton</h1><p>Force equals mass times acceleration.</p>';qoPersistWriter();
  const q=qdWorkingDoc();q.title='TASK1664 Diagnostics';q.sections[0].questions[0].prompt='What is acceleration?';q.sections[0].questions[0].answer='Change of velocity per time';qdStore();
  route('home');createBook();book().name='TASK1664 Sheets';setCell(sheet(),'A1','12');setCell(sheet(),'B1','30');setCell(sheet(),'C1','=A1+B1');persist();route('home');
  route('slides');document.getElementById('qo-slides-title').value='TASK1664 Slides';qoSlides.slides[0].items[1].text='TASK1664 slide body';qoPersistSlides();route('home');
  route('photo');qoPhotoApplyState({...qoPhotoState(),name:'TASK1664 Studio',width:640,height:480,bg:'#f0f0f0',strokes:[{id:'shape-1664',tool:'rect',points:[[20,30],[210,180]],color:'#225588',size:4,opacity:1}]});qoPhotoPersist();route('home');
 });
 await page.evaluate(()=>qoDraftStorage.flush());
 const before=await inspectDraft(page);recordDraft('before-close',before);assert.equal(before.marker,true);assert.equal(before.rawPresent,true);assert.equal(before.parse?.ok,true);assert.equal(before.validate?.ok,true);assert.equal(before.live.title,'TASK166.4 persisted draft');assert.equal(before.live.count,3);assert.equal(before.live.imagePresent,true);assert.equal(before.diskMatches,true);assert.ok(before.rawBytes>5*1024*1024,'large QWORK exceeds 5 MiB');assert.equal(before.pending,false);assert.equal(before.legacyRawPresent,true);
 const editors=await inspectEditors(page);recordDraft('editors-before-close',editors);assert.ok(Object.values(editors.fixtures).every(Boolean),'Meaningful editor fixtures missing: '+JSON.stringify(editors.fixtures));
 // Stage a real final edit without waiting for the debounce. OS close must flush it.
 const pending=await page.evaluate(()=>{qwDoc.instructions='TASK1664 final edit before ordinary close';if(!qwPersist())throw Error('Pending draft not queued');return {queued:qoDraftStorage.pending};});
 assert.equal(pending.queued,true);
 fs.writeFileSync(path.join(out,'draft-close-pending.json'),JSON.stringify(pending,null,2));
 }else if(['ordinary','reinstall','portable'].includes(stage)){
 const draft=await inspectDraft(page);recordDraft(stage,draft);
 const before=JSON.parse(fs.readFileSync(path.join(out,'draft-before-close.json'),'utf8'));
 const checks={rawPresent:draft.rawPresent,parse:draft.parse?.ok===true,validate:draft.validate?.ok===true,title:draft.live.title===before.live.title,count:draft.live.count===before.live.count,image:JSON.stringify(draft.live.images)===JSON.stringify(before.live.images),diskMatches:draft.diskMatches===true,storageError:!draft.storageError,notCorrupt:!draft.corrupt,noPending:!draft.pending&&!draft.nativeError,finalEdit:await page.evaluate(()=>qwDoc.instructions==='TASK1664 final edit before ordinary close')};
 const editors=await inspectEditors(page);recordDraft('editors-'+stage,editors);
 const oldEditors=JSON.parse(fs.readFileSync(path.join(out,'draft-editors-before-close.json'),'utf8'));
 for(const name of Object.keys(oldEditors.signatures))checks['editor_'+name]=editors.fixtures[name]&&editors.signatures[name]===oldEditors.signatures[name];
 for(const name of Object.keys(oldEditors.rows))if(name!=='qwork')checks['hash_'+name]=editors.rows[name].sha256===oldEditors.rows[name].sha256;
 if(stage==='ordinary'){assert.notEqual(draft.rawSha256,before.rawSha256,'final edit must change raw hash');fs.writeFileSync(path.join(out,'draft-after-ordinary.json'),JSON.stringify(draft,null,2));}
 else {const ordinary=JSON.parse(fs.readFileSync(path.join(out,'draft-after-ordinary.json'),'utf8'));checks.rawHash=draft.rawSha256===ordinary.rawSha256;checks.liveHash=draft.liveSha256===ordinary.liveSha256;}
 // Legacy marker is diagnostic only: SQLite is now authoritative. If present,
 // the original legacy document must remain byte-identical, never overwritten.
 checks.legacySourceNotOverwritten=!draft.legacyRawPresent||draft.legacyRawSha256===before.legacyRawSha256;
 fs.writeFileSync(path.join(out,'draft-checks-'+stage+'.json'),JSON.stringify(checks,null,2));
 const result=await page.evaluate(async()=>{
  const r=await qwBankRepository.getTask('native-0');if(r?.task.answer!=='edited'||!r.task.image||r.revision!==2)throw Error('SQLite restart mismatch');

  return {status:'PASS',number:r.bankNumber,revision:r.revision,stats:await qwBankRepository.getStatistics()};
 });
 fs.writeFileSync(path.join(out,'native-restart-'+stage+'.json'),JSON.stringify(result,null,2));
 assert.ok(Object.values(checks).every(Boolean),'Real QWORK draft restart mismatch: '+JSON.stringify(checks));
 }else throw Error('Unknown stage');
 assert.deepEqual(errors,[]);console.log('TASK1664_NATIVE '+stage+' PASS');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
