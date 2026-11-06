/* Offline standalone HTML: exact saved projects and native print preparation. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task149.7');
(async()=>{
 const browser=await chromium.launch({headless:true}),context=await browser.newContext({offline:true,acceptDownloads:true}),p=await context.newPage(),errors=[],requests=[],roundtrips=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});p.on('dialog',d=>d.accept());
 await p.addInitScript(()=>{window.print=function(){window.top.__printedHTML=document.documentElement.outerHTML;window.dispatchEvent(new Event('afterprint'));};});
 const action=k=>p.locator('[data-qw-action="'+k+'"]');
 try{
  await p.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);await p.evaluate(()=>route('writer'));await p.locator('[data-editor="writer"][data-tab="work"]').click();
  const files=['User-Workflow','Reorder-Workflow','Construction-Tools','Compact-Geometry-Improved','Practice-One-Per-Page-Three-Tasks','Practice-Multiple-Tasks-Improved','Physics-Graph-Comparison'];
  for(const name of files){
   const file=path.join(root,'evidence/task149.6',name+'.qwork'),source=JSON.parse(fs.readFileSync(file,'utf8'));
   await p.locator('#qw-file').setInputFiles(file);await p.waitForFunction(id=>qwDoc.id===id,source.id);assert.deepEqual(await p.evaluate(()=>structuredClone(qwDoc)),source);
   const dl=p.waitForEvent('download');await action('save').click();const saved=path.join(out,'offline-'+name+'.qwork');await(await dl).saveAs(saved);assert.deepEqual(JSON.parse(fs.readFileSync(saved,'utf8')),source);
   await p.locator('[data-action="work-new"]').click();await p.locator('#qw-file').setInputFiles(saved);await p.waitForFunction(id=>qwDoc.id===id,source.id);assert.deepEqual(await p.evaluate(()=>structuredClone(qwDoc)),source);roundtrips.push({file:name+'.qwork',exactDocument:true});
  }
  const before=await p.evaluate(()=>structuredClone(qwDoc));await p.locator('#qw-file').setInputFiles({name:'corrupt.qwork',mimeType:'application/json',buffer:Buffer.from('{"format":"quantum-work","version":1,"tasks":[')});await p.waitForFunction(()=>document.getElementById('toast').textContent.includes('Не удалось открыть QWORK'));assert.deepEqual(await p.evaluate(()=>qwDoc),before);
  await p.locator('.qw-center-head [data-qw-action="preview"]').click();await p.locator('[data-qw-action="preview-pdf"]:enabled').waitFor();const f=await(await p.locator('#qw-print-preview-frame').elementHandle()).contentFrame();await f.evaluate(()=>window.qwPrintReady);assert.equal(await f.evaluate(()=>window.__qwPrintError),undefined);
  await action('preview-pdf').click();await p.waitForFunction(()=>!!window.__printedHTML);const html=await p.evaluate(()=>window.__printedHTML);const print=await context.newPage();await print.setContent(html);await print.evaluate(()=>window.qwPrintReady);await print.emulateMedia({media:'print'});await print.pdf({path:path.join(out,'offline-student.pdf'),preferCSSPageSize:true,printBackground:true});
  await p.screenshot({path:path.join(out,'offline-preview.png')});assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);fs.writeFileSync(path.join(out,'offline-result.json'),JSON.stringify({status:'PASS',roundtrips,corruptImportAtomic:true,printReady:true,networkRequests:requests,errors},null,2));console.log('PASS TASK149.7 offline: seven exact QWORK save/import/reopen cycles, corrupt import preserved document, native PDF, zero network requests');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
