/* TASK166.3 final: deterministic delayed reads and realistic-sized image round trips. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task1663');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({offline:true,acceptDownloads:true,viewport:{width:1440,height:1000}});
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(String(e)));p.on('dialog',d=>d.accept());
 try{
  await p.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  await p.evaluate(()=>route('writer'));await p.locator('.global-bar [data-target="work"]').click();
  const fixtures=await p.evaluate(async()=>{
   await qwBankOpen();
   const canvas=document.createElement('canvas');canvas.width=32;canvas.height=24;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#5199ab';ctx.fillRect(0,0,32,24);
   const image=canvas.toDataURL('image/png');
   for(const id of ['plain','picture','second','broken','missing']){
    const task=qwTask('short');task.id='task-'+id;task.prompt='Bank '+id;task.answer='Answer '+id;task.comment='Solution '+id;
    if(id==='picture'||id==='broken'){task.figure='image';task.image=image;}
    if(id==='broken'){ctx.fillStyle='#fed123';ctx.fillRect(0,0,32,24);task.image=canvas.toDataURL('image/png');}
    await qwBankRepository.createTask({id,subject:'physics',task});
   }
   return {image};
  });
  const button=id=>p.locator('[data-bank-add="'+id+'"]');
  const bank=async()=>{await p.evaluate(()=>qwBank({__view:'plain'}));await p.locator('#qw-bank-preview .qw-bank-preview-toolbar').waitFor();};
  const count=()=>p.evaluate(()=>qwDoc.tasks.length);
  const snapshot=()=>p.evaluate(()=>JSON.stringify(qwDoc));
  const gate=async(ids)=>p.evaluate(ids=>{
   const repo=qwBankRepository,original=repo.getTask;
   let resolve;const barrier=new Promise(r=>resolve=r);
   window.__finalGate={calls:0,resolve,dialog:document.querySelector('#qw-dialog'),original};
   repo.getTask=async function(id){if(ids.includes(id)){window.__finalGate.calls++;await barrier;}return original.call(this,id);};
  },ids);
  const pending=()=>p.waitForFunction(()=>window.__finalGate.calls>0&&window.__finalGate.dialog.getAttribute('aria-busy')==='true');
  const release=async()=>{await p.evaluate(()=>window.__finalGate.resolve());await p.waitForFunction(()=>!window.__finalGate.dialog.hasAttribute('aria-busy'));await p.evaluate(()=>{qwBankRepository.getTask=window.__finalGate.original;});};
  await bank();await gate(['plain']);await button('plain').click();await pending();
  assert.equal(await count(),0);assert.equal(await button('plain').isDisabled(),true);
  // A second delivered event, even if an input device bypasses native disabled handling.
  await button('plain').dispatchEvent('click');assert.equal(await p.evaluate(()=>window.__finalGate.calls),1);
  await release();assert.equal(await count(),1);assert.equal(await p.evaluate(()=>qwDoc.tasks[0].prompt),'Bank plain');
  await bank();await button('picture').click();await p.waitForFunction(()=>qwDoc.tasks.length===2&&!document.querySelector('#qw-dialog[open]'));
  assert.equal(await p.evaluate(()=>qwDoc.tasks.at(-1).image),fixtures.image);
  assert.ok(await p.locator('#qw-task-preview img').evaluate(img=>img.complete&&img.naturalWidth===32));
  // Actual QWORK download and reopen, with the active picture included.
  const event=p.waitForEvent('download');await p.evaluate(()=>qwSaveFile());const download=await event;
  const file=path.join(out,'final-image-roundtrip.qwork');await download.saveAs(file);
  const exported=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(exported.tasks.at(-1).image,fixtures.image);
  await p.locator('#qw-file').setInputFiles(file);await p.waitForFunction(()=>document.querySelector('#toast.active')?.textContent.includes('Работа открыта'));
  assert.equal(await p.evaluate(()=>qwDoc.tasks.at(-1).image),fixtures.image);
  const pdf=await p.evaluate(async()=>{const doc={...qwDoc,layout:'worksheet'};const pdf=await qwPDFBytes(doc,false);return {magic:String.fromCharCode(...pdf.slice(0,5)),print:qwPrintDocumentHTML(doc,false).includes(qwDoc.tasks.at(-1).image)};});
  assert.deepEqual(pdf,{magic:'%PDF-',print:true});
  await bank();await p.locator('[data-bank-select="picture"]').check();await p.locator('[data-bank-select="second"]').check();
  await gate(['picture','second']);await p.locator('[data-qw-action="bank-add-selection"]').click();await pending();
  assert.equal(await count(),2);await p.locator('[data-qw-action="bank-assemble"]').dispatchEvent('click');await release();
  assert.equal(await count(),4);assert.equal(await p.evaluate(()=>qwDoc.tasks[2].image),fixtures.image);
  assert.deepEqual(await p.evaluate(()=>qwDoc.tasks.slice(2).map(x=>x.source.id)),['picture','second']);
  // Cancel pending single and multi loads by closing or replacing the dialog.
  await bank();let before=await snapshot();await gate(['picture']);await button('picture').click();await pending();
  await p.locator('#qw-dialog [data-qw-close]').click();await release();assert.equal(await snapshot(),before);
  await bank();await p.locator('[data-bank-select="picture"]').check();await gate(['picture']);
  await p.locator('[data-qw-action="bank-add-selection"]').click();await pending();await p.evaluate(()=>qwDialog('Другой диалог','<p>Замена</p>'));
  await release();assert.equal(await snapshot(),before);await p.locator('#qw-dialog [data-qw-close]').click();
  // Actually load a different QWORK while a bank read is pending.
  await bank();await gate(['picture']);await button('picture').click();await pending();
  const other=await p.evaluate(()=>({...qwProject(),title:'Other document',tasks:[{...qwTask('short'),prompt:'Other task'}]}));
  await p.locator('#qw-file').setInputFiles({name:'other.qwork',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(other))});
  await p.waitForFunction(()=>qwDoc.title==='Other document');const replaced=await snapshot();await release();assert.equal(await snapshot(),replaced);
  if(await p.locator('#qw-dialog[open]').count())await p.locator('#qw-dialog [data-qw-close]').click();
  // Real corruption: change bytes in the binary store without changing digest.
  await p.evaluate(async()=>{
   const b=qwBankRepository;
   await new Promise((resolve,reject)=>{const tx=b.db.transaction(['tasks','assets'],'readwrite'),q=tx.objectStore('tasks').get('broken');
    q.onsuccess=()=>{const store=tx.objectStore('assets'),a=store.get(q.result.imageAsset.key);a.onsuccess=()=>{const value=a.result;new Uint8Array(value.bytes)[0]^=1;store.put(value);};};
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
  });
  await bank();before=await snapshot();await button('broken').click();
  await p.waitForFunction(()=>document.querySelector('#qw-bank-save-status.qw-error')?.textContent.startsWith('Добавление не выполнено:'));
  assert.equal(await snapshot(),before);
  await p.locator('[data-bank-select="picture"]').check();await p.locator('[data-bank-select="missing"]').check();
  await gate(['missing']);await p.locator('[data-qw-action="bank-add-selection"]').click();await pending();
  await p.evaluate(async()=>{const r=await window.__finalGate.original.call(qwBankRepository,'missing');await qwBankRepository.deleteTask(r.id,r.revision);});
  await release();assert.equal(await snapshot(),before);
  assert.match(await p.locator('#qw-bank-save-status').innerText(),/недоступно/);
  await p.locator('#qw-dialog [data-qw-close]').click();
  // Bounded larger actual compressed raster test; no fake payloads or random runner selection.
  const large=await p.evaluate(async()=>{
   const check=(v,m)=>{if(!v)throw Error(m);};
   const options={normalize:qwBankNormalize,legacyStorage:{getItem(){return null;}}};
   const source=new BankRepository({...options,dbName:'large-real-assets'}),target=new BankRepository({...options,dbName:'large-real-assets-restore'});
   const c=document.createElement('canvas');c.width=1024;c.height=768;const x=c.getContext('2d'),pixels=x.createImageData(c.width,c.height);let seed=18791;
   for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels.data[i]=seed>>>24;seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels.data[i+1]=seed>>>24;seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels.data[i+2]=seed>>>24;pixels.data[i+3]=255;}
   x.putImageData(pixels,0,0);
   const images=['image/png','image/jpeg','image/webp'].map(mime=>c.toDataURL(mime,.93));
   const sizes=images.map(url=>({mime:url.slice(5,url.indexOf(';')),bytes:atob(url.split(',')[1]).length}));
   check(sizes.every(a=>a.bytes>=100000&&a.bytes<=4000000),'real compressed raster size outside bounds');
   check(new Set(sizes.map(a=>a.mime)).size===3,'three real MIME types required');
   const timing={},start=performance.now();await source.open();
   for(let i=0;i<images.length;i++)for(let j=0;j<2;j++){
    const task=qwTask('short');task.prompt='Large '+i+'-'+j;task.figure='image';task.image=images[i];
    await source.createTask({id:'large-'+i+'-'+j,subject:'physics',task});
   }
   timing.createMs=performance.now()-start;const initial=await source.assetDiagnostics();
   check(initial.count===3&&initial.references===6&&initial.bytes===sizes.reduce((s,a)=>s+a.bytes,0),'large deduplication failed');
   const old=await source.getTask('large-0-0'),t=performance.now();
   await source.updateTask(old.id,{...old,task:{...old.task,image:images[1],answer:'edited'}},old.revision);
   timing.editMs=performance.now()-t;
   check((await source.getTask('large-0-1')).task.image===images[0],'shared PNG changed');
   const bs=performance.now(),archive=await source.createVerifiedBackup();timing.backupMs=performance.now()-bs;
   await target.open();const rs=performance.now(),plan=await target.inspectRestore(JSON.stringify(archive));const restored=await target.restoreVerifiedBackup({token:plan.token,mode:'empty'});timing.inspectRestoreMs=performance.now()-rs;
   await target.close();await target.open();
   const snapshot=await target._captureBackupSnapshot(),sort=rows=>rows.slice().sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
   check(restored.verified&&bankStableJSON(sort(snapshot.records))===bankStableJSON(sort(archive.records)),'large archive byte/metadata roundtrip mismatch');
   const final=await target.assetDiagnostics();check(final.count===3&&final.references===6,'large restored references');
   const archiveBytes=new TextEncoder().encode(JSON.stringify(archive)).length;
   await source.close();await target.close();
   return {dimensions:[1024,768],sizes,initial,final,archiveBytes,timing,byteExact:true};
  });
  assert.deepEqual(errors,[]);
  const report={status:'PASS',single:true,doubleClick:true,selected:true,dialogClose:true,dialogReplace:true,documentSwitch:true,corruptAsset:true,missingSelection:true,qworkPreviewPdf:true,large};
  fs.writeFileSync(path.join(out,'final-report.json'),JSON.stringify(report,null,2));console.log('TASK1663_FINAL '+JSON.stringify(report));
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
