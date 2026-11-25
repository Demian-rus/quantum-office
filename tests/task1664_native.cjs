/* Actual Tauri WebView2 via localhost CDP enabled ONLY on disposable CI runner. */
const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const out=path.join(__dirname,'..','evidence','native');
const visual=require('./task1664_visual.cjs');
const {makeTechnicalFixture,checkAxisSurfaces}=require('./task1664_graphics.cjs');
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
  const diagnosticMedia=[];
  for(const question of qdQuestionList(q))for(const kind of ['prompt','answer']){
   const ref=question[qdMediaKey(kind)];if(!ref)continue;
   const asset=await qdMediaGet(ref.id);
   if(!asset)throw Error('Missing real diagnostic image '+ref.id);
   const bytes=await asset.blob.arrayBuffer();
   const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
   diagnosticMedia.push({kind,id:ref.id,mime:asset.blob.type,bytes:bytes.byteLength,sha256});
  }
  const live={
   writer:{name:qoWriter.name,html:qoWriter.html},
   sheets:{name:b?.name??null,a1:sheetData?getCell(sheetData,'A1').value:null,b1:sheetData?getCell(sheetData,'B1').value:null,c1:sheetData?getCell(sheetData,'C1').value:null},
   slides:{name:qoSlides.name,items:qoSlides.slides[0]?.items},
   studio:{name:studio.name,width:studio.width,height:studio.height,bg:studio.bg,strokes:studio.strokes},
   diagnostics:{title:q.title,questions:qdQuestionList(q).map(x=>({id:x.id,prompt:x.prompt,answer:x.answer,points:x.points,promptMedia:x.promptMedia??null,answerMedia:x.answerMedia??null})),media:diagnosticMedia},
   qwork:{title:qwDoc.title,count:qwDoc.tasks.length}
  };
  const signatures={};for(const [name,value] of Object.entries(live))signatures[name]=await hash(bankStableJSON(value));
  return {rows,signatures,fixtures:{writer:live.writer.name==='TASK1664 Writer'&&live.writer.html.includes('Newton'),sheets:live.sheets.a1==='12'&&live.sheets.b1==='30'&&live.sheets.c1==='=A1+B1',slides:live.slides.name==='TASK1664 Slides'&&live.slides.items.some(x=>x.text==='TASK1664 slide body'),studio:live.studio.name==='TASK1664 Studio'&&live.studio.strokes.some(x=>x.id==='shape-1664'),diagnostics:live.diagnostics.title==='TASK1664 Diagnostics'&&live.diagnostics.questions.some(x=>x.prompt==='What is acceleration?'&&x.answer==='Change of velocity per time')&&diagnosticMedia.length===2&&diagnosticMedia.every(x=>x.bytes>100000)&&diagnosticMedia[0].sha256!==diagnosticMedia[1].sha256,qwork:live.qwork.title==='TASK166.4 persisted draft'&&live.qwork.count===3}};
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
  if(qoDraftStorage.getItem(QW_KEY)!==null||qoDraftStorage.getItem(QW_PANELS_KEY)!==null)throw Error('Migration test requires absent native QWORK and panel settings');
  const draft=qwProject();draft.title='TASK1664 legacy draft';const task=qwTask('short');task.prompt='Legacy migration question';task.answer='42';draft.tasks=[task];
  const raw=JSON.stringify(draft);localStorage.setItem(QW_KEY,raw);const panels=JSON.stringify({pdf:{left:254,hideLeft:false}});localStorage.setItem(QW_PANELS_KEY,panels);return {raw,panels};
 });
 await page.reload({waitUntil:'load'});
 await page.waitForFunction(()=>typeof qwBankRepository!=='undefined'&&qwBankRepository.db===true,{},{timeout:60000});
 const migration=await page.evaluate(async ({raw,panels})=>{
  const rows=await __TAURI__.core.invoke('draft_load'),disk=rows[QW_KEY],panel=rows[QW_PANELS_KEY];
  if(localStorage.getItem(QW_PANELS_KEY)!==panels||qoDraftStorage.getItem(QW_PANELS_KEY)!==panels||panel?.value!==panels||panel.revision!==1||panel.legacySha256!==panel.sha256||qwPanelPreference('pdf').left!==254||qwPanelPreference('pdf').hideLeft)throw Error('Panel preference migration not exact');
  if(localStorage.getItem(QW_KEY)!==raw||disk?.value!==raw||disk.legacySha256!==disk.sha256||qwDoc.title!=='TASK1664 legacy draft'||qwDoc.tasks[0]?.prompt!=='Legacy migration question')throw Error('Legacy migration not exact');
  qwDoc=qwProject();qwDoc.layout='compact';if(!qwPersist())throw Error('Reset disposable fixture failed');await qoDraftStorage.flush();
  if(localStorage.getItem(QW_KEY)!==raw)throw Error('Legacy source overwritten');
  return {status:'PASS',sourceRetained:true,migrationRevision:disk.revision,migrationSha256:disk.sha256,panelMigration:{revision:panel.revision,sha256:panel.sha256,value:panel.value}};
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
 const routes=await page.evaluate(()=>{const result=[];for(const target of ['home','sheet','writer','slides','photo','diagnostics','work','bank']){route(target);if(!document.querySelector('#app')?.innerText.trim())throw Error('Empty route '+target);result.push({target,visible:true});}route('home');return result;});
 fs.writeFileSync(path.join(out,'native-routes.json'),JSON.stringify(routes,null,2));
 const draftLayout=await page.evaluate(async()=>{
  route('writer');await qoDraftStorage.flush();
  const key='quantum-office-theme-v1',original=qoDraftStorage.getItem(key);
  const measure=()=>Object.fromEntries(['#app','.global-bar','.qo-office-toolbar','.qo-writer-body'].map(s=>{
   const box=document.querySelector(s).getBoundingClientRect();return [s,[box.x,box.y,box.width,box.height]];
  }));
  const baseline=measure();
  try{
   qoDraftStorage.setItem(key,original==='light'?'dark':'light');
   if(!qoDraftStorage.pending||!document.getElementById('qo-native-draft-notice').hidden)throw Error('Ordinary pending write is not quiet');
   const pending=measure();await qoDraftStorage.flush();const confirmed=measure();
   if(JSON.stringify(baseline)!==JSON.stringify(pending)||JSON.stringify(baseline)!==JSON.stringify(confirmed))throw Error('Draft status moves the workspace '+JSON.stringify({baseline,pending,confirmed}));
   return {baseline,pending,confirmed,status:'PASS'};
  }finally{if(original===null)qoDraftStorage.removeItem(key);else qoDraftStorage.setItem(key,original);await qoDraftStorage.flush();}
 });
 fs.writeFileSync(path.join(out,'native-draft-layout.json'),JSON.stringify(draftLayout,null,2));
 await page.locator('.global-bar [data-target="diagnostics"]').click();
 await page.locator('#qo-diag-workspace').waitFor({state:'visible'});await page.screenshot({path:path.join(out,'native-diagnostics.png')});
 await page.locator('.global-bar [data-target="work"]').click();
 await page.evaluate(()=>qwBank({__view:'native-0'}));await page.locator('[data-bank-add="native-0"]').click();
 await page.waitForFunction(()=>qwDoc.tasks.length===1&&!!qwDoc.tasks[0].image);
 // Original owner reproduction: real layout controls, pending writes, and an
 // actual SQLite transaction rejection in the disposable CI database.
 // Tauri's frozen JS API cannot be replaced reliably; do not mock or modify production IPC.
 const draftDb=path.join(process.env.APPDATA,'com.quantumoffice.desktop','drafts.sqlite3');
 assert.ok(fs.existsSync(draftDb),'Disposable native drafts database missing');
 const setDraftDenial=enabled=>{
  const sql=enabled?"CREATE TRIGGER qo_ci_task1671_denial BEFORE INSERT ON drafts WHEN NEW.key='quantum-office.work-builder.v1' BEGIN SELECT RAISE(ABORT,'TASK167.1 controlled write denial'); END;":"DROP TRIGGER IF EXISTS qo_ci_task1671_denial;";
  const result=require('node:child_process').spawnSync('python',['-c','import sqlite3,sys; c=sqlite3.connect(sys.argv[1],timeout=10); c.executescript(sys.argv[2]); c.commit(); c.close()',draftDb,sql],{encoding:'utf8'});
  if(result.status!==0)throw Error('CI SQLite fault control failed: '+(result.error||result.stderr));
 };
 const measure=()=>page.evaluate(()=>Object.fromEntries(['#app','.global-bar','.qo-office-toolbar','.qo-education-body','#qo-work-workspace'].map(s=>{
  const b=document.querySelector(s).getBoundingClientRect();return [s,[b.x,b.y,b.width,b.height]];
 })));
 const oldLayout=await page.evaluate(async()=>{await qoDraftStorage.flush();return qwDoc.layout;});
 const base=await measure();
 let educationDraftLayout;
 let session;
 try{
  await page.evaluate(()=>qwPreview());
  const modeBefore=await page.evaluate(()=>{const b=document.querySelector('.qw-mode-host').getBoundingClientRect(),h=document.querySelector('.global-bar').getBoundingClientRect(),d=document.getElementById('qw-dialog');return {body:[b.x,b.y,b.width,b.height],header:[h.x,h.y,h.width,h.height],modal:d.matches(':modal')};});
  await page.evaluate(layout=>{
   const select=document.querySelector('select[name="qw-pdf-layout"]'),alternate=[...select.options].find(x=>x.value!==layout&&!x.disabled);
   if(!alternate)throw Error('Missing actual layout control');
   select.value=alternate.value;select.dispatchEvent(new Event('change',{bubbles:true}));if(qwDoc.layout!==alternate.value)throw Error('Layout did not change');
   if(!qoDraftStorage.pending||!document.getElementById('qo-native-draft-notice').hidden)throw Error('Layout change not quiet');
  },oldLayout);
  const layoutMode=await page.evaluate(()=>{const b=document.querySelector('.qw-mode-host').getBoundingClientRect(),h=document.querySelector('.global-bar').getBoundingClientRect(),d=document.getElementById('qw-dialog');return {body:[b.x,b.y,b.width,b.height],header:[h.x,h.y,h.width,h.height],modal:d.matches(':modal')};});
  assert.deepEqual(layoutMode,modeBefore,'pending moves layout workspace');assert.deepEqual(layoutMode.header,base['.global-bar'],'opening PDF must not move shell header');assert.equal(layoutMode.modal,false);assert.ok(layoutMode.body[2]>0&&layoutMode.body[3]>0);
  await page.evaluate(()=>qoDraftStorage.flush());
  assert.deepEqual(await page.evaluate(()=>{const b=document.querySelector('.qw-mode-host').getBoundingClientRect(),h=document.querySelector('.global-bar').getBoundingClientRect(),d=document.getElementById('qw-dialog');return {body:[b.x,b.y,b.width,b.height],header:[h.x,h.y,h.width,h.height],modal:d.matches(':modal')};}),layoutMode,'ACK moves layout workspace');
  await page.evaluate(()=>document.getElementById('qw-dialog').close());assert.deepEqual(await measure(),base,'return from layout moves workspace');
  setDraftDenial(true);
  await page.evaluate(async layout=>{
   qwDoc.layout=layout;qwPersist();
   try{await qoDraftStorage.flush();throw Error('write unexpectedly succeeded');}catch(e){if(!String(e).includes('controlled write denial'))throw e;}
   const notice=document.getElementById('qo-native-draft-notice'),retry=document.getElementById('qo-native-draft-retry'),recovery=document.getElementById('qo-native-draft-recovery');
   if(notice.hidden||retry.hidden||recovery.hidden||!qoDraftStorage.pending)throw Error('Real-risk notice or action hidden');
  },oldLayout);
  assert.deepEqual(await measure(),base,'error moves workspace');
  const checkNotice=()=>page.evaluate(()=>{
   const bounds=id=>{const e=document.getElementById(id),b=e.getBoundingClientRect();return {visible:!e.hidden&&b.width>0&&b.height>0,left:b.left,top:b.top,right:b.right,bottom:b.bottom};};
   const boxes=['qo-native-draft-notice','qo-native-draft-retry','qo-native-draft-recovery'].map(bounds);
   if(boxes.some(b=>!b.visible||b.left<0||b.right>innerWidth||b.top<0||b.bottom>innerHeight))throw Error('Notice or action outside viewport '+JSON.stringify({width:innerWidth,height:innerHeight,boxes}));
   return {width:innerWidth,height:innerHeight,boxes};
  });
  const normalNotice=await checkNotice();
  await page.screenshot({path:path.join(out,'native-draft-error.png')});
  session=await page.context().newCDPSession(page);
  await session.send('Emulation.setDeviceMetricsOverride',{width:800,height:600,deviceScaleFactor:1,mobile:false});
  await page.waitForFunction(()=>innerWidth===800&&innerHeight===600);
  const narrowBase=await measure(),narrowNotice=await checkNotice();
  await page.screenshot({path:path.join(out,'native-draft-error-800x600.png')});
  setDraftDenial(false);
  await page.evaluate(async()=>{document.getElementById('qo-native-draft-retry').click();await qoDraftStorage.flush();if(!document.getElementById('qo-native-draft-notice').hidden||qoDraftStorage.pending||qoDraftStorage.error)throw Error('Retry did not recover');});
  assert.deepEqual(await measure(),narrowBase,'recovery moves narrow workspace');
  await session.send('Emulation.clearDeviceMetricsOverride');await session.detach();session=null;
  await page.waitForFunction(w=>innerWidth===w,normalNotice.width);
  assert.deepEqual(await measure(),base,'recovery moves workspace');
  await page.evaluate(layout=>{for(const target of ['diagnostics','writer','bank','work'])route(target);if(qwDoc.layout!==layout)throw Error('Layout did not persist');},oldLayout);
  assert.deepEqual(await measure(),base,'return to work moves workspace');
  educationDraftLayout={status:'PASS',base,actualSQLiteRejection:true,layoutSwitch:true,routeReturn:true,normalNotice,narrowNotice};
 }finally{
  setDraftDenial(false);
  if(session){await session.send('Emulation.clearDeviceMetricsOverride');await session.detach();}
  await page.evaluate(async layout=>{document.getElementById('qw-dialog')?.remove();if(qwDoc.layout!==layout){qwDoc.layout=layout;qwPersist();}await qoDraftStorage.flush();},oldLayout);
 }
 fs.writeFileSync(path.join(out,'native-education-draft-layout.json'),JSON.stringify(educationDraftLayout,null,2));
 await page.screenshot({path:path.join(out,'native-workspace.png')});
 await page.evaluate(()=>route('bank'));await page.locator('#qo-bank-root .qw-bank-filter-panel').waitFor();await page.screenshot({path:path.join(out,'native-bank.png')});
 await page.evaluate(()=>route('work'));
 // TASK167.2: exercise actual layout controls on the bank image, then retain the local width for restart stages.
 const originalBankFigure=await page.evaluate(async()=>JSON.stringify((await qwBankRepository.getTask('native-0')).task));
 await page.evaluate(()=>qwPreview());
 await page.locator('#qw-layout-figure-mode').selectOption('manual');
 await page.locator('#qw-layout-figure-width').fill('62');
 await page.locator('#qw-layout-figure-width').press('Tab');
 await page.waitForFunction(()=>qwDoc.tasks[0].figureWidthMode==='manual'&&Math.abs(qwDoc.tasks[0].figureWidth*25.4/96-62)<.02);
 await page.waitForFunction(()=>{const f=document.querySelector('#qw-print-preview-frame');return f?.dataset.ready===f?.contentDocument?.documentElement.dataset.qwRender&&!f?.contentWindow?.__qwPrintError&&!!f?.contentWindow?.__qwPrintLayout;});
 await page.screenshot({path:path.join(out,'native-manual-figure.png')});
 assert.equal(await page.evaluate(async()=>JSON.stringify((await qwBankRepository.getTask('native-0')).task)),originalBankFigure,'local layout must not alter bank');
 const manualFigure=await page.evaluate(async()=>{await qoDraftStorage.flush();return {id:qwDoc.tasks[0].id,width:qwDoc.tasks[0].figureWidth,mode:qwDoc.tasks[0].figureWidthMode};});
 fs.writeFileSync(path.join(out,'native-manual-figure.json'),JSON.stringify(manualFigure,null,2));
 await page.locator('[data-qw-close]').click();
 // TASK167.3: real installed WebView2 preference and shell mode acceptance.
 await page.evaluate(()=>qwPreview());
 const dock=await require('./task1673_native_dock.cjs').checkNativePdfDock(page,out);
 fs.writeFileSync(path.join(out,'native-dock-pref.json'),JSON.stringify(dock,null,2));
 await page.screenshot({path:path.join(out,'native-dock-layout.png')});
 await page.locator('[data-qw-close]').click();
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
 await page.evaluate(async()=>{
  // Real editor persistence functions and actual data structures.
  route('writer');
  const title=document.getElementById('qo-writer-title');title.value='TASK1664 Writer';
  document.getElementById('qo-writer-page').innerHTML='<h1>Newton</h1><p>Force equals mass times acceleration.</p>';qoPersistWriter();
  // The diagnostic workspace intentionally starts with zero sections (qdBlank on mount).
  // Create an actual section/question before attaching media; never assume a default card exists.
  const q=qdWorkingDoc();q.title='TASK1664 Diagnostics';q.sections=qdDefault().sections;
  const question=q.sections[0].questions[0];question.prompt='What is acceleration?';question.answer='Change of velocity per time';
  // Persist actual distinct diagnostic media, not merely document references.
  for(const [index,kind] of ['prompt','answer'].entries()){
   const url=qwDoc.tasks[index].image,[header,encoded]=url.split(',');
   const blob=new Blob([Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))],{type:header.slice(5).split(';')[0]});
   const id=qdMediaNewId();await qdMediaPut({id,blob,createdAt:Date.now()});
   question[qdMediaKey(kind)]={id,caption:'TASK1664 '+kind,display:'medium'};
  }
  qdStore();
  route('home');createBook();book().name='TASK1664 Sheets';setCell(sheet(),'A1','12');setCell(sheet(),'B1','30');setCell(sheet(),'C1','=A1+B1');
  const sh=sheet();for(const [index,width] of [[0,112],[1,138],[2,160],[3,96],[4,120],[5,310],[6,115]])setColumnWidth(sh,index,width);
  setRowHeight(sh,1,38);setRowHeight(sh,2,35);setRowHeight(sh,3,32);
  setCell(sh,'A2','График занятий');mergeCells(sh,'A2','G2');setStyle(sh,'A2',{bg:'#167a40',color:'#ffffff',bold:true,align:'center',fontFamily:'Comic Sans MS',fontSize:12});
  setCell(sh,'A3','Пн');mergeCells(sh,'A3','A7');setStyle(sh,'A3',{bg:'#f28c00',bold:true,align:'center',verticalAlign:'center',fontSize:14,border:'thin'});
  for(let row=3;row<=24;row++){setCell(sh,'B'+row,'Ученик '+row);setCell(sh,'C'+row,'Физика');setCell(sh,'D'+row,'12:00');setCell(sh,'E'+row,row%2?'☐':'☑');setCell(sh,'F'+row,'План занятия');setStyle(sh,'B'+row,{border:'thin',align:'center',fontFamily:'Comic Sans MS'});}
  // Fixture bypasses UI transactions: invalidate the old blank calculation session.
  recalculator.reset();persist();route('home');
  route('slides');document.getElementById('qo-slides-title').value='TASK1664 Slides';qoSlides.slides[0].items[1].text='TASK1664 slide body';qoPersistSlides();route('home');
  route('photo');qoPhotoApplyState({...qoPhotoState(),name:'TASK1664 Studio',width:640,height:480,bg:'#f0f0f0',strokes:[{id:'shape-1664',tool:'rect',points:[[20,30],[210,180]],color:'#225588',size:4,opacity:1}]});qoPhotoPersist();route('home');
 });
 await page.evaluate(()=>qoDraftStorage.flush());
 await visual.compareSheet(page,stage,out,true);
 await visual.comparePrint(page,out);
 await visual.comparePrint(page,out,JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','QuantumOffice_EGE2018_32.qwork'),'utf8')),'ege2018');
 const technical=await makeTechnicalFixture(page);await checkAxisSurfaces(page,technical,out);
 await visual.comparePrint(page,out,technical,'graphics');
 await page.evaluate(()=>qoDraftStorage.flush());
 const before=await inspectDraft(page);recordDraft('before-close',before);assert.equal(before.marker,true);assert.equal(before.rawPresent,true);assert.equal(before.parse?.ok,true);assert.equal(before.validate?.ok,true);assert.equal(before.live.title,'TASK166.4 persisted draft');assert.equal(before.live.count,3);assert.equal(before.live.imagePresent,true);assert.equal(before.diskMatches,true);assert.ok(before.rawBytes>5*1024*1024,'large QWORK exceeds 5 MiB');assert.equal(before.pending,false);assert.equal(before.legacyRawPresent,true);
 const editors=await inspectEditors(page);recordDraft('editors-before-close',editors);assert.ok(Object.values(editors.fixtures).every(Boolean),'Meaningful editor fixtures missing: '+JSON.stringify(editors.fixtures));
 // Stage a real final edit without waiting for the debounce. OS close must flush it.
 // TASK167.3: verify actual Windows CloseRequested leaves a dirty child intact.
 const decision={accept:false,count:0};const onDialog=dialog=>{decision.count++;return decision.accept?dialog.accept():dialog.dismiss();};page.on('dialog',onDialog);
 const requestClose=()=>{const r=require('node:child_process').spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"(Get-Process -Id "+Number(process.env.QO_NATIVE_PID)+").CloseMainWindow()"],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/True/i);};
 const declineClose=async()=>{decision.accept=false;const count=decision.count,dialog=page.waitForEvent('dialog',{timeout:15000});requestClose();await dialog;await page.waitForFunction(()=>!document.getElementById('app').inert&&qwActiveEditorDirty()&&!qoDraftStorage.error);assert.equal(decision.count,count+1,'actual CloseRequested must ask before discarding');};
 await page.evaluate(()=>{route('work');qwSelected=qwDoc.tasks[0].id;qwRender();qwVisualEditor('graph');});
 if(!await page.locator('#qw-graph-preset').isVisible())await page.locator('[data-visual-panel="tools"]').click();
 await page.locator('#qw-graph-preset').selectOption('v');
 assert.ok(await page.evaluate(()=>qwActiveEditorDirty()));const originalGraph=await page.evaluate(()=>JSON.stringify(qwDoc.tasks[0].graph));
 await declineClose();assert.equal(await page.evaluate(()=>JSON.stringify(qwDoc.tasks[0].graph)),originalGraph);
 await page.screenshot({path:path.join(out,'native-close-declined-graph.png')});
 // A second edit and undo prove the editor still works after decline.
 await page.locator('#qw-graph-preset').selectOption('x');await page.locator('#qw-visual-undo').click();
 decision.accept=true;await page.locator('[data-qw-action="visual-cancel"]').click();await page.locator('#qw-dialog').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>JSON.stringify(qwDoc.tasks[0].graph)),originalGraph);
 // A separate record avoids changing the historical native-0 revision fixture.
 await page.evaluate(async()=>{await qwBankOpen();const task=qwTask('graph');task.prompt='Native lifecycle fixture';await qwBankRepository.createTask({id:'task1673-native-lifecycle',subject:'physics',task});});
 const bankLifecycle=await require('./task1673_bank_lifecycle.cjs').checkBankLifecycle(page,'task1673-native-lifecycle',decision);
 await page.evaluate(()=>route('work'));await page.evaluate(()=>{qwSelected=qwDoc.tasks[0].id;qwVisualEditor('diagram');});
 if(!await page.locator('#qw-diagram-preset').isVisible())await page.locator('[data-visual-panel="properties"]').click();
 await page.locator('#qw-diagram-preset').selectOption('surface');assert.ok(await page.evaluate(()=>qwActiveEditorDirty()));
 await declineClose();
 await page.screenshot({path:path.join(out,'native-close-declined-diagram.png')});
 decision.accept=true;await page.locator('[data-qw-action="visual-cancel"]').click();await page.locator('#qw-dialog').waitFor({state:'detached'});
 // Native close with an unchanged child and dirty parent must also ask.
 await page.evaluate(()=>route('bank'));await page.locator('[data-bank-view="task1673-native-lifecycle"]').click();await page.locator('.qw-bank-preview-actions [data-bank-edit="task1673-native-lifecycle"]').click();await page.locator('[data-bank-task-field="prompt"]').fill('Native unsaved parent');await page.locator('[data-bank-visual="graph"]').click();await page.locator('#qw-visual-stage').waitFor();
 await declineClose();await page.screenshot({path:path.join(out,'native-close-declined-bank.png')});
 assert.equal(await page.evaluate(async()=>(await qwBankRepository.getTask('task1673-native-lifecycle')).task.prompt),'TASK167.3 explicitly saved bank condition');
 await page.locator('[data-qw-action="visual-cancel"]').click();assert.equal(await page.locator('[data-bank-task-field="prompt"]').inputValue(),'Native unsaved parent');
 decision.accept=true;await page.locator('[data-qw-action="bank-edit-back"]').click();await page.locator('[data-bank-view="task1673-native-lifecycle"]').waitFor();await page.evaluate(()=>route('work'));
 fs.writeFileSync(path.join(out,'native-editor-close.json'),JSON.stringify({status:'PASS',actualCloseRequested:true,graph:true,diagram:true,bank:true,bankLifecycle},null,2));
 // Prepare the local graphic before staging the final durable edit.
 await page.evaluate(()=>qwVisualEditor('graph'));if(!await page.locator('#qw-graph-preset').isVisible())await page.locator('[data-visual-panel="tools"]').click();
 await page.locator('#qw-graph-preset').selectOption('v');assert.ok(await page.evaluate(()=>qwActiveEditorDirty()));
 const pending=await page.evaluate(async()=>{qwDoc.instructions='TASK1664 final edit before ordinary close';if(!qwPersist())throw Error('Pending draft not queued');const queued=qoDraftStorage.pending;const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(qoDraftStorage.getItem(QW_KEY)))),b=>b.toString(16).padStart(2,'0')).join('');return {queued,sha256:hash};});
 assert.equal(pending.queued,true);
 fs.writeFileSync(path.join(out,'draft-close-pending.json'),JSON.stringify(pending,null,2));
 // Confirm a real close while a local graphic is dirty. The PowerShell
 // parent waits for actual process exit; restart checks verify the durable hash.
 decision.accept=true;const closingDialog=page.waitForEvent('dialog',{timeout:15000});requestClose();await closingDialog;
 fs.writeFileSync(path.join(out,'native-editor-close-confirmed.json'),JSON.stringify({status:'confirmation received',actualCloseRequested:true},null,2));
 }else if(['ordinary','reinstall','portable'].includes(stage)){
 const draft=await inspectDraft(page);recordDraft(stage,draft);
 const before=JSON.parse(fs.readFileSync(path.join(out,'draft-before-close.json'),'utf8'));
 const checks={rawPresent:draft.rawPresent,parse:draft.parse?.ok===true,validate:draft.validate?.ok===true,title:draft.live.title===before.live.title,count:draft.live.count===before.live.count,image:JSON.stringify(draft.live.images)===JSON.stringify(before.live.images),diskMatches:draft.diskMatches===true,storageError:!draft.storageError,notCorrupt:!draft.corrupt,noPending:!draft.pending&&!draft.nativeError,finalEdit:await page.evaluate(()=>qwDoc.instructions==='TASK1664 final edit before ordinary close')};
 const manualFigure=JSON.parse(fs.readFileSync(path.join(out,'native-manual-figure.json'),'utf8'));
 checks.manualFigure=await page.evaluate(expected=>{const q=qwDoc.tasks.find(t=>t.id===expected.id);return q?.figureWidth===expected.width&&q.figureWidthMode===expected.mode;},manualFigure);
 // Native preferences are now in SQLite, independent of browser profile.
 const dock=JSON.parse(fs.readFileSync(path.join(out,'native-dock-pref.json'),'utf8')),dockEvidence=JSON.parse(fs.readFileSync(path.join(out,'native-dock-keyboard.json'),'utf8')).keyboardDisk;
 const restoredDock=await page.evaluate(async()=>({preference:qwPanelPreference('pdf'),value:qoDraftStorage.getItem(QW_PANELS_KEY),row:(await __TAURI__.core.invoke('draft_load'))[QW_PANELS_KEY],pending:qoDraftStorage.pending,error:qoDraftStorage.error}));
 checks.dockPreference=Object.keys(dock).every(k=>restoredDock.preference[k]===dock[k])&&restoredDock.value===dockEvidence.value&&restoredDock.row?.value===dockEvidence.value&&restoredDock.row?.revision===dockEvidence.revision&&restoredDock.row?.sha256===dockEvidence.sha256&&!restoredDock.pending&&!restoredDock.error;
 fs.writeFileSync(path.join(out,'native-dock-restart-'+stage+'.json'),JSON.stringify(restoredDock,null,2));
 const editors=await inspectEditors(page);recordDraft('editors-'+stage,editors);
 const oldEditors=JSON.parse(fs.readFileSync(path.join(out,'draft-editors-before-close.json'),'utf8'));
 for(const name of Object.keys(oldEditors.signatures))checks['editor_'+name]=editors.fixtures[name]&&editors.signatures[name]===oldEditors.signatures[name];
 for(const name of Object.keys(oldEditors.rows))if(name!=='qwork')checks['hash_'+name]=editors.rows[name].sha256===oldEditors.rows[name].sha256;
 if(stage==='ordinary'){const pending=JSON.parse(fs.readFileSync(path.join(out,'draft-close-pending.json'),'utf8'));checks.finalRawHash=draft.rawSha256===pending.sha256;assert.notEqual(draft.rawSha256,before.rawSha256,'final edit must change raw hash');fs.writeFileSync(path.join(out,'draft-after-ordinary.json'),JSON.stringify(draft,null,2));}
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
 await visual.compareSheet(page,stage,out,false);
 }else throw Error('Unknown stage');
 assert.deepEqual(errors,[]);assert.deepEqual(messages.filter(m=>/Applying inline style violates|Refused to apply.*style|Loading the stylesheet.*violates/i.test(m.text)),[],'CSP must not block styles');console.log('TASK1664_NATIVE '+stage+' PASS');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
