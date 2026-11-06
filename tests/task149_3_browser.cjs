/* Real A4 DOM measurements, application preview/print export and QWORK isolation. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=process.env.QW_TASK1493_EVIDENCE||path.join(root,'evidence/task149.3');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const {task149CompactSamples}=await import('./fixtures/task149_3_samples.js');
 const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});
 const errors=[],reports=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.addInitScript(()=>{window.print=()=>{window.top.__qwPrintCalled=true;};});
 const ready=async frame=>{await frame.waitForFunction(()=>!!window.qwPrintReady);await frame.evaluate(()=>window.qwPrintReady);assert.equal(await frame.evaluate(()=>window.__qwPrintError),undefined);};
 async function measure(frame){return frame.evaluate(()=>{
  const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  const sections=[...document.querySelectorAll('.qw-print-section')].map(s=>{
   const text=s.querySelector('.qw-task-text'),figure=s.querySelector('figure'),t=text?.getBoundingClientRect(),f=figure?.getBoundingClientRect();
   const svg=figure?.querySelector('svg'),ink=svg?.getBBox(),vb=svg?.viewBox.baseVal;
   return {task:+s.dataset.task,overlap:t&&f?overlap(t,f):0,right:!f||s.querySelector('.qw-figure-below')||f.left>=t.right+10,
    bodyPt:text?parseFloat(getComputedStyle(text).fontSize)*.75:0,height:s.getBoundingClientRect().height,
    inkClipped:ink?ink.x<vb.x-.1||ink.y<vb.y-.1||ink.x+ink.width>vb.x+vb.width+.1||ink.y+ink.height>vb.y+vb.height+.1:false,
    axisPt:svg?[...svg.querySelectorAll('.qw-axis-number')].map(e=>parseFloat(e.getAttribute('font-size'))*f.width/vb.width*.75):[]};
  });
  const clipped=[...document.querySelectorAll('.qw-page-content')].flatMap(content=>{
   const bounds=content.getBoundingClientRect();return [...content.querySelectorAll('figure,.qw-task-text,math,.qw-answer-preview,.qw-solution-preview')].filter(e=>getComputedStyle(e).display!=='none').filter(e=>{const b=e.getBoundingClientRect();return b.left<bounds.left-1||b.right>bounds.right+1||b.top<bounds.top-1||b.bottom>bounds.bottom+1;}).map(e=>e.className?.baseVal||e.className||e.tagName);
  });
  return {layout:window.__qwPrintLayout,sections,clipped,technical:!!document.querySelector('.qw-paper-task>header span'),bodyFontPt:parseFloat(getComputedStyle(document.body).fontSize)*.75};
 });}
 try{
  await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);await page.evaluate(()=>route('writer'));await page.locator('[data-editor="writer"][data-tab="work"]').click();
  const untouched=await page.evaluate(()=>({writer:qoWriter.html,diagnostic:JSON.stringify(qdWorkingDoc())}));
  for(const {name,project} of task149CompactSamples()){
   await page.evaluate(d=>qwChange(()=>{qwDoc=qwValidate(d);qwSelected=qwDoc.tasks[0].id;}),project);
   const before=await page.evaluate(()=>JSON.stringify(qwDoc));
   const dl=page.waitForEvent('download');await page.locator('[data-qw-action="save"]').click();const qwork=path.join(out,name+'.qwork');await(await dl).saveAs(qwork);
   assert.deepEqual(JSON.parse(fs.readFileSync(qwork,'utf8')),project);
   await page.locator('[data-action="work-new"]').click();await page.locator('#qw-file').setInputFiles(qwork);await page.waitForFunction(count=>qwDoc.tasks.length===count,project.tasks.length);
   assert.equal(await page.evaluate(()=>JSON.stringify(qwDoc)),before,'QWORK roundtrip');
   for(const teacher of [false,true]){
    // The old boolean export call now requests a separate key, never answers under conditions.
    let frame;
    if(teacher){frame=await browser.newPage();await frame.setContent(await page.evaluate(()=>qwPrintDocumentHTML(qwDoc,true,{answers:true,criteria:false,comments:false})));}
    else{await page.locator('[data-qw-action="preview"]').click();await page.locator('[data-qw-action="preview-pdf"]:enabled').waitFor();frame=await(await page.locator('#qw-print-preview-frame').elementHandle()).contentFrame();}
    await ready(frame);
    const report=await measure(frame),suffix=teacher?'-Answers':'',file=name+suffix;
    const html=await frame.content();fs.writeFileSync(path.join(out,file+'.html'),html);
    await (teacher?frame:page).screenshot({path:path.join(out,file+'-preview.png')});
    await page.evaluate(()=>window.__qwPrintCalled=false);if(teacher)await page.evaluate(()=>qwPrintTextPDF(true,{answers:true,criteria:false,comments:false}));else await page.locator('[data-qw-action="preview-pdf"]').click();await page.waitForFunction(()=>window.__qwPrintCalled===true);
    const print=await browser.newPage();await print.setContent(html,{waitUntil:'load'});await ready(print);await print.emulateMedia({media:'print'});await print.evaluate(()=>document.fonts.ready);
    await print.pdf({path:path.join(out,file+'.pdf'),preferCSSPageSize:true,printBackground:true});await print.close();
    const repeat=await browser.newPage();const raw=await page.evaluate(({d,t})=>qwPrintDocumentHTML(d,t,{answers:true,criteria:false,comments:false}),{d:project,t:teacher});await repeat.setContent(raw);await ready(repeat);
    assert.deepEqual(await repeat.evaluate(()=>window.__qwPrintLayout),report.layout,'deterministic pagination');await repeat.close();
    assert.equal(await page.evaluate(()=>JSON.stringify(qwDoc)),before,'printing never mutates the project');
    reports.push({file,tasks:project.tasks.length,teacher,...report});
    if(teacher)await frame.close();else await page.locator('[data-qw-close]').click();
   }
  }
  fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(reports,null,2));
  for(const report of reports){
   assert.equal(report.layout.pages.length,1,report.file+' one A4 page');assert.deepEqual(report.clipped,[],report.file+' content bounds');assert.equal(report.technical,false);
   assert.ok(report.bodyFontPt>=(report.teacher?9.9:10.7),'ordinary text is not shrunk');
   for(const s of report.sections){assert.ok(s.overlap<1,report.file+' text/figure overlap');assert.ok(s.right,report.file+' right illustration');assert.equal(s.inkClipped,false);assert.ok(s.axisPt.every(n=>n>=6.5),'readable graph numbers');}
  }
  const math=reports.find(r=>r.file==='Math-Examples');assert.ok(math.sections.every(s=>s.height<85),'no tall reserved area for short examples');
  assert.deepEqual(await page.evaluate(()=>({writer:qoWriter.html,diagnostic:JSON.stringify(qdWorkingDoc())})),untouched);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({status:'PASS',reports,errors},null,2));
  console.log('PASS TASK149.3: six one-page exports, measured columns/ink/fonts/heights, deterministic pagination, application print and QWORK roundtrip');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
