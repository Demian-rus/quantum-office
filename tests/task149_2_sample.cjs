/* Export actual app previews/print documents; never draw a separate PDF. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=process.env.QW_TASK1492_EVIDENCE||path.join(root,'evidence/task149.2');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const {task149Sample}=await import('./fixtures/task149_2_sample.js');const sample=task149Sample();
 const browser=await chromium.launch({headless:true}),p=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{window.print=()=>{window.top.__qwPrintCalled=true;};});
 try{
  await p.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);await p.evaluate(()=>route('writer'));await p.locator('[data-editor="writer"][data-tab="work"]').click();
  await p.evaluate(project=>qwChange(()=>{qwDoc=qwValidate(project);qwSelected=qwDoc.tasks[0].id;}),sample);
  const event=p.waitForEvent('download');await p.locator('[data-qw-action="save"]').click();const file=path.join(out,'Quantum-Office-Sample.qwork');await(await event).saveAs(file);
  assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),sample);
  for(const teacher of [false,true]){
   let html;
   if(teacher)html=await p.evaluate(()=>qwPrintDocumentHTML(qwDoc,true,{answers:true,criteria:false,comments:false}));
   else{await p.locator('[data-qw-action="preview"]').click();await p.locator('[data-qw-action="preview-pdf"]:enabled').waitFor();const preview=await(await p.locator('#qw-print-preview-frame').elementHandle()).contentFrame();await preview.evaluate(()=>window.qwPrintReady);html=await preview.content();}
   assert.doesNotMatch(html,/data-qw-(?:vertex|object|editor)/);
   await p.evaluate(()=>window.__qwPrintCalled=false);if(teacher)await p.evaluate(()=>qwPrintTextPDF(true,{answers:true,criteria:false,comments:false}));else await p.locator('[data-qw-action="preview-pdf"]').click();await p.waitForFunction(()=>window.__qwPrintCalled===true);
   const print=await browser.newPage();await print.setContent(html,{waitUntil:'load'});await print.evaluate(()=>window.qwPrintReady);await print.emulateMedia({media:'print'});await print.evaluate(()=>document.fonts.ready);
   assert.equal(await print.locator('figure svg').count(),teacher?0:4);assert.equal(await print.locator('.qw-teacher-notes').count(),0);
   if(!teacher)assert.ok(await print.locator('.qw-task-flow').evaluateAll(es=>es.every(e=>e.querySelector('.qw-task-text').getBoundingClientRect().bottom<=e.querySelector('figure').getBoundingClientRect().top)),'below figures follow the actual task text');
   const name='Quantum-Office-Sample-'+(teacher?'Answers':'Student');
   fs.writeFileSync(path.join(out,name+'.html'),html);
   await print.pdf({path:path.join(out,name+'.pdf'),preferCSSPageSize:true,printBackground:true});
   await print.close();if(!teacher)await p.locator('[data-qw-close]').click();
  }
  // Keep a direct raster-path regression for every new figure as well.
  const raster=await p.evaluate(async()=>Array.from(await qwPDFBytes(qwDoc,false)));fs.writeFileSync(path.join(out,'sample-raster-regression.pdf'),Buffer.from(raster));
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'sample-result.json'),JSON.stringify({status:'GENERATED',tasks:4,printInvoked:true,qworkRoundtrip:true,errors},null,2));
  console.log('Generated student PDF and separate answer key through Quantum Office preview and native print HTML; QWORK saved through app UI');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
