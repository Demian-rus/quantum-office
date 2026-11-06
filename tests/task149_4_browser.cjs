/* Actual app format controls, save/open, prepared print DOM and native Chromium PDFs. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=process.env.QW_TASK1494_EVIDENCE||path.join(root,'evidence/task149.4');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const {task149PrintSamples}=await import('./fixtures/task149_4_samples.js'),samples=task149PrintSamples();
 const browser=await chromium.launch({headless:true}),app=await browser.newPage({viewport:{width:1440,height:1080},acceptDownloads:true}),errors=[],reports=[];
 app.on('pageerror',e=>errors.push(e.message));app.on('dialog',d=>d.accept());
 await app.addInitScript(()=>{window.print=()=>{window.top.__qwPrinted=true;};});
 const ready=async frame=>{await frame.waitForFunction(()=>!!window.qwPrintReady);await frame.evaluate(()=>window.qwPrintReady);assert.equal(await frame.evaluate(()=>window.__qwPrintError),undefined);};
 const frame=async()=>{await app.locator('[data-qw-action="preview-pdf"]:enabled').waitFor();const f=await(await app.locator('#qw-print-preview-frame').elementHandle()).contentFrame();await ready(f);return f;};
 async function inspect(f){return f.evaluate(()=>{
  const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  const sections=[...document.querySelectorAll('.qw-print-section')].map(section=>{
   const figure=section.querySelector('figure'),box=figure?.getBoundingClientRect(),svg=figure?.querySelector('svg'),vb=svg?.viewBox.baseVal,ink=svg?.getBBox();
   const text=section.querySelector('.qw-task-text'),walker=document.createTreeWalker(text,NodeFilter.SHOW_TEXT),space=section.querySelector('.qw-practice-space');let node,intersections=0;
   const sb=space?.getBoundingClientRect(),pb=section.closest('.qw-print-page').getBoundingClientRect();
   while(node=walker.nextNode()){if(!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);if(box)for(const r of range.getClientRects())if(overlap(r,box)>1)intersections++;}
   return {task:+section.dataset.task,heightMm:section.getBoundingClientRect().height*25.4/96,figure:box?{widthMm:box.width*25.4/96,heightMm:box.height*25.4/96,position:figure.dataset.printPosition}:null,intersections,
    clipped:ink?ink.x<vb.x-.2||ink.y<vb.y-.2||ink.x+ink.width>vb.x+vb.width+.2||ink.y+ink.height>vb.y+vb.height+.2:false,
    labelPt:svg?[...svg.querySelectorAll('text')].filter(e=>e.textContent.trim()).map(e=>parseFloat(getComputedStyle(e).fontSize)*box.width/vb.width*.75):[],
    solutionMm:sb?.height*25.4/96||0,solutionBoxMm:sb?{x:(sb.left-pb.left)*25.4/96,y:(sb.top-pb.top)*25.4/96,width:sb.width*25.4/96,height:sb.height*25.4/96}:null};
  });
  const bounds=[...document.querySelectorAll('.qw-page-content')].flatMap(p=>{const b=p.getBoundingClientRect();return [...p.querySelectorAll('.qw-paper-task,figure,math,.qw-practice-space,.qw-answer-item')].filter(e=>{const r=e.getBoundingClientRect();return r.left<b.left-.8||r.right>b.right+.8||r.top<b.top-.8||r.bottom>b.bottom+.8;}).map(e=>e.className?.baseVal||e.className||e.tagName);});
  return {layout:window.__qwPrintLayout,sections,bounds,bodyPt:parseFloat(getComputedStyle(document.body).fontSize)*.75,mathPt:[...document.querySelectorAll('.qw-task-text>math')].map(e=>parseFloat(getComputedStyle(e).fontSize)*.75),answerLines:document.querySelectorAll('.qw-answer-preview,.qw-solution-preview').length,text:document.body.innerText};
 });}
 async function exportPreview(name){
  const f=await frame(),measurement=await inspect(f);assert.deepEqual(measurement.bounds,[],name+' print bounds');assert.ok(measurement.sections.every(s=>!s.intersections&&!s.clipped),name+' no overlap or cropped ink');
  assert.ok(measurement.sections.every(s=>s.labelPt.every(pt=>pt>=6.49)),name+' readable diagram labels');assert.ok(measurement.mathPt.every(pt=>Math.abs(pt-measurement.bodyPt)<.01));
  const html=await f.content();fs.writeFileSync(path.join(out,name+'.html'),html);await app.screenshot({path:path.join(out,name+'-preview.png')});
  await app.evaluate(()=>window.__qwPrinted=false);await app.locator('[data-qw-action="preview-pdf"]').click();await app.waitForFunction(()=>window.__qwPrinted);
  const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));await p.setContent(html);await ready(p);await p.emulateMedia({media:'print'});await p.pdf({path:path.join(out,name+'.pdf'),preferCSSPageSize:true,printBackground:true});await p.close();
  reports.push({name,...measurement});return measurement;
 }
 async function render(d,format){const p=await browser.newPage();await p.setContent(await app.evaluate(({d,format})=>qwPrintDocumentHTML(d,false,{format}),{d,format}));await ready(p);return p;}
 try{
  await app.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);await app.evaluate(()=>route('writer'));await app.locator('[data-editor="writer"][data-tab="work"]').click();assert.equal(await app.evaluate(()=>qwDoc.layout),'compact');
  const untouched=await app.evaluate(()=>({writer:qoWriter.html,diagnostic:JSON.stringify(qdWorkingDoc())}));
  for(const {name,project} of samples){
   await app.evaluate(d=>qwChange(()=>{qwDoc=qwValidate(d);qwSelected=qwDoc.tasks[0].id;}),project);
   const before=await app.evaluate(()=>JSON.stringify(qwDoc)),event=app.waitForEvent('download');await app.locator('[data-qw-action="save"]').click();const file=path.join(out,name+'.qwork');await(await event).saveAs(file);assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),project);
   await app.locator('[data-action="work-new"]').click();await app.locator('#qw-file').setInputFiles(file);await app.waitForFunction(n=>qwDoc.tasks.length===n,project.tasks.length);assert.equal(await app.evaluate(()=>JSON.stringify(qwDoc)),before);
   await app.locator('[data-qw-action="preview"]').click();assert.equal(await app.locator('#qw-teacher').count(),0);assert.match(await app.locator('.qw-exam-unavailable').innerText(),/будущие/);
   const report=await exportPreview(name);assert.equal(report.answerLines,0);assert.doesNotMatch(report.text,/PRIVATE_|INTERNAL_|Задание \d+|Ответ:|Рисунок\s*\/\s*схема|\d+ б\./);for(const hidden of [project.instructions,project.tasks[0].criteria,project.tasks[0].comment])assert.ok(!report.text.includes(hidden));
   if(name==='Compact-Geometry'){
    assert.equal(report.sections.length,24);assert.ok(report.layout.pages.length<=3);assert.equal(await(await frame()).locator('.qw-topic-title').count(),3);
    const no=report.sections.filter(s=>!s.figure),yes=report.sections.filter(s=>s.figure);assert.ok(no.reduce((a,s)=>a+s.heightMm,0)/no.length<yes.reduce((a,s)=>a+s.heightMm,0)/yes.length*.65);
    await app.locator('[data-qw-action="preview-answers"]').click();const key=await exportPreview(name+'-Answers');assert.equal(await(await frame()).locator('figure').count(),0);assert.equal(await(await frame()).locator('[data-answer-number]').count(),24);assert.doesNotMatch(key.text,/PRIVATE_|INTERNAL_/);for(const hidden of [project.instructions,project.tasks[0].criteria,project.tasks[0].comment])assert.ok(!key.text.includes(hidden));
    const actual=await(await frame()).locator('[data-answer-number]').evaluateAll(es=>es.map(e=>({number:+e.dataset.answerNumber,text:e.textContent.replace(/^\d+\.\s*/,'').trim()})));
    const expected=await app.evaluate(()=>qwDoc.tasks.map((q,i)=>{const e=document.createElement('div');e.innerHTML=qwContentHTML(q.answer);return {number:i+1,text:e.textContent.trim()};}));assert.deepEqual(actual,expected,'key numbering and actual mathematical answers');
   }else{assert.equal(report.layout.pages.length,1);assert.ok(report.sections.every(s=>s.solutionMm>=30));}
   await app.locator('[data-qw-close]').click();assert.equal(await app.evaluate(()=>JSON.stringify(qwDoc)),before,'export does not mutate data');
  }
  // Real format/preset controls persist, undo and QWORK corruption is atomic.
  await app.locator('[data-qw-action="preview"]').click();await app.locator('.qw-layout-card').filter({has:app.locator('[value="practice"]')}).click();await frame();
  await app.locator('[data-practice="perPage"]').selectOption('2');await app.locator('[data-practice="grid"]').selectOption('none');await frame();assert.equal(await app.evaluate(()=>qwDoc.practice.perPage),2);
  assert.equal(await(await frame()).locator('.qw-practice-space svg').count(),0);
  await app.setViewportSize({width:800,height:900});await app.screenshot({path:path.join(out,'preview-narrow.png')});assert.ok(await app.locator('[data-qw-action="preview-pdf"]').isVisible());await app.locator('[data-qw-close]').click();await app.setViewportSize({width:1440,height:1080});
  const bad=structuredClone(samples[0].project);bad.practice={perPage:99,grid:'fine'};const beforeBad=await app.evaluate(()=>JSON.stringify(qwDoc));await app.locator('#qw-file').setInputFiles({name:'bad.qwork',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await app.waitForFunction(()=>document.getElementById('toast').textContent.includes('Не удалось открыть QWORK'));assert.equal(await app.evaluate(()=>JSON.stringify(qwDoc)),beforeBad);
  for(const perPage of [1,2,3,4])for(const grid of ['none','fine','normal']){
   const d=structuredClone(samples[0].project);d.layout='practice';d.practice={perPage,grid};d.tasks=d.tasks.slice(0,4);const p=await render(d,'practice'),r=await inspect(p);assert.deepEqual(r.bounds,[]);assert.ok(r.sections.every(s=>s.solutionMm>=20));assert.equal(await p.locator('.qw-practice-space svg').count(),grid==='none'?0:4);await p.close();
  }
  const wide=structuredClone(samples[0].project);wide.tasks=wide.tasks.slice(0,1);wide.tasks[0].diagram=[{kind:'line',x:20,y:80,x2:480,y2:80,label:'AB'}];const wp=await render(wide,'compact');assert.equal(await wp.locator('figure').getAttribute('data-print-position'),'below');await wp.close();
  const missing=structuredClone(samples[0].project);missing.tasks[0].answer='';const kp=await render(missing,'answers');assert.match(await kp.locator('[data-answer-number="1"]').innerText(),/—/);assert.equal(await kp.locator('figure').count(),0);await kp.close();
  const section=structuredClone(missing);section.tasks=section.tasks.slice(0,1);section.tasks[0].part='Новый раздел';section.tasks[0].topic='Старая тема банка';const sp=await render(section,'compact');assert.equal(await sp.locator('.qw-topic-title').innerText(),'Новый раздел');await sp.close();
  const alias=await browser.newPage();await alias.setContent(await app.evaluate(d=>qwPrintDocumentHTML(d,true),missing));await ready(alias);assert.equal(await alias.locator('body').getAttribute('data-qw-format'),'answers');assert.equal(await alias.locator('figure').count(),0);assert.doesNotMatch(await alias.locator('body').innerText(),/Два угла треугольника/);await alias.close();
  const criteria=await browser.newPage();await criteria.setContent(await app.evaluate(d=>qwPrintDocumentHTML(d,false,{format:'answers',includeCriteria:true}),missing));await ready(criteria);assert.ok((await criteria.locator('body').innerText()).includes(missing.tasks[0].criteria));await criteria.close();
  const long=structuredClone(missing);long.tasks=long.tasks.slice(0,1);long.tasks[0].answer=('Обоснование: используем сумму углов треугольника. ').repeat(240);long.tasks[0].criteria=('Критерий: вычисления объяснены. ').repeat(180);
  const lp=await browser.newPage();await lp.setContent(await app.evaluate(d=>qwPrintDocumentHTML(d,false,{format:'answers',includeCriteria:true}),long));await ready(lp);const longText=(await lp.locator('.qw-task-text').allTextContents()).join('');assert.equal(longText.split('Обоснование:').length-1,240);assert.equal(longText.split('Критерий:').length-1,180);assert.deepEqual((await inspect(lp)).bounds,[]);await lp.close();
  const cp=structuredClone(samples[0].project);cp.tasks=cp.tasks.slice(0,1);cp.tasks[0].prompt=('Докажите утверждение. Объясните каждый переход. ').repeat(250);const cl=await render(cp,'compact');assert.equal((await cl.locator('.qw-task-text').allTextContents()).join('').split('Докажите').length-1,250);assert.equal(await cl.locator('figure').count(),1);assert.deepEqual((await inspect(cl)).bounds,[]);await cl.close();
  assert.deepEqual(await app.evaluate(()=>({writer:qoWriter.html,diagnostic:JSON.stringify(qdWorkingDoc())})),untouched);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({status:'PASS',reports,errors},null,2));console.log('PASS TASK149.4: actual formats/keys, 24 original tasks, vector print pipeline, adaptive figures, practice presets, QWORK roundtrip/corruption, narrow preview');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
