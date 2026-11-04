/* TASK144: teacher workflows, real pointer editors and native PDF/QWORK downloads. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task144');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
 const p=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[],metrics=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept('A'));
 const action=a=>p.locator('[data-qw-action="'+a+'"]');
 const open=async()=>{await p.evaluate(()=>route('writer'));await p.locator('[data-editor="writer"][data-tab="work"]').click();};
 const add=async(type,prompt)=>{await p.locator('#qw-add-type').selectOption(type);await p.locator('.qw-left [data-qw-action="add"]').click();await p.locator('#qw-prompt').fill(prompt);};
 const dl=async(fn,name)=>{const event=p.waitForEvent('download');await fn();const d=await event,target=path.join(out,name||d.suggestedFilename());await d.saveAs(target);assert.ok(fs.statSync(target).size>50);return target;};
 const shot=async name=>{await p.locator('#toast.active').waitFor({state:'hidden'});await p.screenshot({path:path.join(out,name+'.png')});};
 await p.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);await open();
 const untouched=await p.evaluate(()=>({writer:qoWriter.html,diagnostic:JSON.stringify(qdWorkingDoc())}));assert.equal(await p.evaluate(()=>qwDoc.tasks.length),0);
 await action('settings').click();await p.locator('[data-meta="title"]').fill('Физика и математика TASK144');await p.locator('[data-meta="topic"]').fill('Тренировочная работа');await p.locator('[data-qw-action="meta-apply"]').click();
 await add('short','Вычислите выражение. ');await action('math').click();await p.locator('#qw-formula-source').fill('\\frac{\\alpha x^{2}}{\\sqrt{y_{1}}}');await p.locator('[data-qw-action="formula-insert"]').click();await action('blank').click();await action('symbols').click();await p.locator('[data-symbol="Δ"]').click();
 assert.equal(await p.locator('#qw-task-preview math mfrac').count(),1);assert.equal(await p.locator('#qw-task-preview math msqrt').count(),1);assert.equal(await p.locator('.qw-inline-blank').count(),1);assert.match(await p.locator('#qw-task-preview').innerText(),/Δ/);
 await p.locator('[data-qw-field="points"]').fill('5');await p.locator('[data-qw-field="points"]').dispatchEvent('change');assert.match(await p.locator('.qo-office-footer').innerText(),/5 баллов/);
 await p.locator('[data-qw-field="type"]').selectOption('graph');assert.equal(await p.evaluate(()=>qwCurrent().figure),'graph');await p.locator('[data-qw-field="type"]').selectOption('short');
 // The graph dialog edits its own copy; a real drag changes coordinates only after Apply.
 await action('graph').click();await p.locator('#qw-graph-preset').selectOption('v');const temporary=await p.evaluate(()=>qwCurrent().graph.points.length);assert.equal(temporary,0);
 await p.locator('[data-point-index="0"][data-point-field="label"]').fill('Начало');await p.locator('[data-point-index="0"][data-point-field="label"]').dispatchEvent('change');
 const first=await p.locator('[data-qw-point="1"] circle').boundingBox();await p.mouse.move(first.x+first.width/2,first.y+first.height/2);await p.mouse.down();await p.mouse.move(first.x+35,first.y-18,{steps:5});await p.mouse.up();
 await p.locator('[data-graph-field="xmax"]').fill('-1');await p.locator('[data-graph-field="xmax"]').dispatchEvent('change');assert.match(await p.locator('#qw-visual-state').innerText(),/диапазон/);
 await shot('graph_editor');await p.locator('[data-qw-action="visual-apply"]').click();assert.equal(await p.evaluate(()=>qwCurrent().graph.points.length),4);assert.notEqual(await p.evaluate(()=>qwCurrent().graph.points[1].x),2);
 await p.locator('.qw-right details>summary').click();await p.locator('[data-qw-field="answer"]').fill('PRIVATE_TEACHER_ANSWER');await p.locator('[data-qw-field="criteria"]').fill('PRIVATE_CRITERIA');await p.locator('[data-qw-field="comment"]').fill('PRIVATE_COMMENT');await action('bank-save').click();await p.locator('#qw-bank-new-topic').fill('Механика');await p.locator('#qw-bank-new-subtopic').fill('Кинематика');await p.locator('[data-qw-action="confirm-bank-save"]').click();assert.equal(await p.evaluate(()=>qwBankRead().length),1);
 await add('extended',('Рассмотрите опыт нагревания воды. Измерения выполняли при одинаковых условиях. ').repeat(24)+' Запишите формулу \\(Q=cm\\Delta t\\), обоснуйте вывод и оцените погрешность.');assert.ok(await p.evaluate(()=>qwCurrent().prompt.length>1500));assert.equal(await p.evaluate(()=>qwCurrent().solutionVisible),true);
 await add('diagram','Постройте схему сил и подпишите геометрические элементы.');await action('diagram').click();
 for(const [i,tool] of ['line','arrow','rect','circle','point','text','angle'].entries()){
  await p.locator('[data-tool="'+tool+'"]').click();const box=await p.locator('#qw-visual-stage svg').boundingBox(),x=box.x+box.width*(.14+i*.09),y=box.y+box.height*(.25+(i%2)*.3);await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+box.width*.08,y+box.height*.12,{steps:3});await p.mouse.up();
 }
 assert.equal(await p.locator('#qw-visual-stage [data-qw-object]').count(),7);
 await p.locator('[data-tool="select"]').click();const object=await p.locator('[data-object-select="0"]').boundingBox();await p.locator('[data-object-select="0"]').click();await p.locator('#qw-visual-stage').focus();await p.keyboard.press('Delete');assert.equal(await p.locator('#qw-visual-stage [data-qw-object]').count(),6);await p.locator('#qw-visual-undo').click();assert.equal(await p.locator('#qw-visual-stage [data-qw-object]').count(),7);
 await shot('diagram_editor');await p.locator('[data-qw-action="visual-apply"]').click();assert.equal(await p.evaluate(()=>qwCurrent().diagram.length),7);
 await add('blanks','Заполните: сила — [[blank:4]], единица энергии — [[blank:6]].');await add('combined','Дано изображение. Запишите ответ и полное решение.');
 const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=','base64');
 await p.locator('#qw-image').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:PNG});await p.waitForFunction(()=>qwCurrent().figure==='image');await p.locator('[data-qw-field="position"]').selectOption('below');await p.locator('[data-qw-field="answerStyle"]').selectOption('boxes');await p.locator('[data-qw-field="boxes"]').fill('8');await p.locator('[data-qw-field="boxes"]').dispatchEvent('change');assert.equal(await p.locator('.qw-answer-preview i').count(),8);
 await add('graph','Определите значение по графику.');await action('graph').click();await p.locator('#qw-graph-preset').selectOption('i');await p.locator('[data-qw-action="visual-apply"]').click();assert.equal(await p.evaluate(()=>new Set(qwDoc.tasks.map(q=>q.type)).size),6);
 const originalId=await p.evaluate(()=>qwCurrent().id);await action('duplicate').click();assert.equal(await p.evaluate(()=>qwDoc.tasks.length),7);assert.notEqual(await p.evaluate(()=>qwCurrent().id),originalId);await action('up').click();await action('delete').click();assert.equal(await p.evaluate(()=>qwDoc.tasks.length),6);
 await action('bank').click();assert.equal(await p.locator('[data-bank-add]').count(),1);await p.locator('#qw-bank-search').fill('не существует');assert.equal(await p.locator('[data-bank-add]').count(),0);await p.locator('#qw-bank-search').fill('Вычислите');await p.locator('[data-bank-add]').click();assert.equal(await p.evaluate(()=>qwDoc.tasks.length),7);
 const saved=await dl(()=>action('save').click(),'roundtrip.qwork'),expected=await p.evaluate(()=>JSON.parse(JSON.stringify(qwDoc)));
 // Native corrupt imports are atomic, including a valid JSON envelope with broken bitmap bytes.
 for(const bad of ['{broken',JSON.stringify({...expected,version:99}),JSON.stringify({...expected,tasks:[{...expected.tasks[0],image:'data:image/png;base64,YmFk'}]})]){
  await p.evaluate(()=>document.getElementById('toast').classList.remove('active','bad'));await p.locator('#qw-file').setInputFiles({name:'bad.qwork',mimeType:'application/json',buffer:Buffer.from(bad)});await p.waitForFunction(()=>document.querySelector('#toast.bad.active'));assert.deepEqual(await p.evaluate(()=>JSON.parse(JSON.stringify(qwDoc))),expected);
 }
 await p.locator('[data-action="work-new"]').click();assert.equal(await p.evaluate(()=>qwDoc.tasks.length),0);await p.locator('#qw-file').setInputFiles(saved);await p.waitForFunction(()=>qwDoc.tasks.length===7);assert.deepEqual(await p.evaluate(()=>JSON.parse(JSON.stringify(qwDoc))),expected);
 await p.reload();await open();assert.deepEqual(await p.evaluate(()=>JSON.parse(JSON.stringify(qwDoc))),expected);
 // Student PDF never reads teacher-only strings; options control each teacher layer.
 const printed=await p.evaluate(async()=>{const captured=[],old=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...rest){captured.push(String(text));return old.call(this,text,...rest);};try{await qwRenderPages(qwDoc,false);const student=captured.join(' ');captured.length=0;await qwRenderPages(qwDoc,true);const teacher=captured.join(' ');captured.length=0;await qwRenderPages(qwDoc,true,{answers:false,criteria:false,comments:false});return {student,teacher,hidden:captured.join(' ')};}finally{CanvasRenderingContext2D.prototype.fillText=old;}});
 for(const value of ['PRIVATE_TEACHER_ANSWER','PRIVATE_CRITERIA','PRIVATE_COMMENT']){assert.ok(!printed.student.includes(value));assert.ok(printed.teacher.includes(value));assert.ok(!printed.hidden.includes(value));}
 await p.locator('[data-editor="writer"][data-tab="diagnostic"]').click();assert.deepEqual(await p.evaluate(()=>({writer:qoWriter.html,diagnostic:JSON.stringify(qdWorkingDoc())})),untouched);await p.locator('[data-editor="writer"][data-tab="work"]').click();
 // Deliverable fixture created through the real Example action, then actual native exports.
 await action('example').click();const example=await dl(()=>action('save').click(),'QuantumOffice_TASK144_example.qwork');
 const pdfHTML=await p.evaluate(()=>({student:qwPrintDocumentHTML(qwDoc,false),teacher:qwPrintDocumentHTML(qwDoc,true)}));
 assert.match(pdfHTML.student,/qw-print-worksheet/);
 assert.ok(!pdfHTML.student.includes('PRIVATE_TEACHER_ANSWER'));
 const pdfPage=await browser.newPage({viewport:{width:900,height:1100}});
 const files=[];
 for(const [name,html] of [['student',pdfHTML.student],['teacher',pdfHTML.teacher]]){
  await pdfPage.setContent(html,{waitUntil:'load'});
  const bytes=await pdfPage.pdf({format:'A4',printBackground:true,preferCSSPageSize:true});
  const file=path.join(out,'QuantumOffice_TASK144_'+name+'.pdf');
  fs.writeFileSync(file,bytes);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  files.push(file);
 }
 await pdfPage.close();
 assert.equal(await p.locator('[data-action="work-pdf"]').count(),1);
 assert.equal(await p.locator('[data-action="work-pdf-student"],[data-action="work-pdf-teacher"]').count(),0);
 const sizes=await p.evaluate(async()=>{const a=await PDFLib.PDFDocument.load(await qwPDFBytes(qwDoc,false));return {pages:a.getPageCount(),width:a.getPages()[0].getWidth(),height:a.getPages()[0].getHeight()};});assert.ok(sizes.pages>=2);assert.ok(Math.abs(sizes.width-595.28)<.1);
 await p.locator('.qw-nav-task').nth(2).click();await shot('workbench_desktop');await action('preview').click();await p.locator('#qw-print-preview-frame').waitFor();await p.frameLocator('#qw-print-preview-frame').locator('.qw-paper-task').first().waitFor();assert.equal(await p.locator('#qw-dialog [data-qw-action="preview-pdf"]').count(),1);await shot('page_preview');await p.locator('[data-qw-close]').click();
 for(const width of [1440,768,390]){
  await p.setViewportSize({width,height:1000});await p.keyboard.press('Escape');
  const tabs=await p.locator('.qo-work-tabs .qo-work-tab').evaluateAll(xs=>xs.every(e=>e.scrollWidth<=e.clientWidth+2));assert.equal(tabs,true,'Writer tab labels must never overlap after adding Work Builder');
  if(width<1200){await action('left').click();assert.equal(await p.locator('.qw-left').isVisible(),true);await p.locator('.qw-nav-task').nth(5).click();assert.equal(await p.locator('.qw-left').isVisible(),false);await action('right').click();assert.equal(await p.locator('.qw-right').isVisible(),true);await shot('properties_'+width);await p.locator('.qw-right [data-qw-action="close-panels"]').click();}
  const m=await p.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,escaped:[...document.querySelectorAll('#qo-work-root input,#qo-work-root textarea,#qo-work-root select,#qo-work-root .qw-editor,#qo-work-root .qw-paper-task')].filter(e=>e.getClientRects().length).filter(e=>{const b=e.getBoundingClientRect();return b.left<0||b.right>innerWidth+2;}).length}));assert.ok(m.scroll<=width+2);assert.equal(m.escaped,0);metrics.push({width,...m});await shot('workspace_'+width);
 }
 await p.setViewportSize({width:1440,height:1000});await p.evaluate(async()=>{qoThemePreference='dark';qoApplyAppearance();await new Promise(requestAnimationFrame);await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));});await shot('workbench_dark');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',scenarios:11,metrics,pdf:sizes,jsErrors:errors},null,2));console.log('PASS TASK144: 11 workflows, six kinds, formulas/blanks, real graph/scheme pointers, images, bank, atomic QWORK/reload, student/teacher PDF, isolation, 1440/768/390 and dark theme');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1)});
