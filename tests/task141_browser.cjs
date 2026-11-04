const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task141');fs.mkdirSync(out,{recursive:true});
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAF0lEQVR4nGP8//8/AyHARFDFqKIBUAQAP6kDFQZDzEYAAAAASUVORK5CYII=','base64');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let promptAnswer='Тепловые явления — копия';page.on('dialog',d=>d.accept(d.type()==='prompt'?promptAnswer:undefined));
 const action=name=>page.locator('[data-qd-action="'+(name==='library-edit-content'?'library-open':name)+'"]');
 const mode=name=>page.locator('[data-qd-action="mode"][data-mode="'+name+'"]').first();
 async function open(){await page.evaluate(()=>route('writer'));await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();}
 async function download(actionFn,name){const event=page.waitForEvent('download');await actionFn();const file=await event;const target=path.join(out,name||file.suggestedFilename());await file.saveAs(target);assert.ok(fs.statSync(target).size>20);return target;}
 async function layout(width){
  await page.setViewportSize({width,height:950});
  const data=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,escaped:[...document.querySelectorAll('#qo-diag-root .qd-edit-card,#qo-diag-root .qd-run-card,#qo-diag-root .qd-library-card,#qo-diag-root textarea,#qo-diag-root .qd-builder-actionbar')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect()).filter(r=>r.right>innerWidth+1||r.left<0).length}));
  assert.ok(data.scroll<=width+2,'document overflow at '+width);assert.equal(data.escaped,0,'questions/inputs escape viewport at '+width);
 }
 await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);await open();
 await mode('library').click();await action('blank').click();
 assert.equal(await page.evaluate(()=>qdQuestionList().length),0);assert.equal(await page.locator('.qd-edit-card').count(),0);
 await page.locator('[data-qd-field="title"]').fill('Тепловые явления');await page.locator('[data-qd-field="grade"]').fill('8');
 await action('builder-quick-save').click();assert.equal(await page.evaluate(()=>qdLibraryRead().length),1,'empty template saves');
 await action('add-section').first().click();await page.locator('[data-qd-field="section"]').fill('Температура и энергия');
 await action('add-question').click();let card=page.locator('.qd-edit-card').first();
 await card.locator('[data-qd-field="prompt"]').fill('Как изменяется движение частиц при нагревании?');
 await card.locator('[data-qd-field="answer"]').fill('Средняя кинетическая энергия увеличивается.');
 await card.locator('[data-qd-field="criteria"]').fill('2 балла за объяснение через движение частиц.');
 await card.locator('[data-qd-media-file][data-kind="prompt"]').count();
 await card.locator('[data-qd-media-slot="prompt"] [data-qd-media-file]').setInputFiles({name:'diagram.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>!!qdWorkingDoc().sections[0].questions[0].promptMedia);
 // Use the visual rich editor, its actual table controls and formula insertion.
 await card.locator('[data-qd-action="rich-edit"][data-kind="prompt"]').click();
 await page.locator('[data-rich-table]').click();await page.locator('[data-rich-table-insert]').click();
 assert.equal(await page.locator('.qd-rich-editor table').count(),1);
 await page.locator('[data-rich-math]').click();await page.locator('[data-rich-expression]').fill('Q = cm(t₂ − t₁)');await page.locator('[data-rich-insert]').click();
 await page.locator('[data-rich-save]').click();assert.ok(await page.evaluate(()=>qdWorkingDoc().sections[0].questions[0].promptRich.includes('<table')));
 await action('duplicate-question').first().click();card=page.locator('.qd-edit-card').nth(1);
 await card.locator('[data-qd-field="prompt"]').fill('Чему равно количество теплоты, кДж?');
 await card.locator('[data-qd-field="type"]').selectOption('numeric');
 await card.locator('[data-qd-field="numericAnswer"]').fill('84');
 await action('add-section').first().click();await page.locator('[data-qd-field="section"]').nth(1).fill('Практика');
 await action('add-question').nth(1).click();card=page.locator('.qd-edit-card').nth(2);
 await card.locator('[data-qd-field="prompt"]').fill('Запишите ход решения задачи о нагревании воды.');await card.locator('[data-qd-field="type"]').selectOption('practice');
 await card.locator('[data-qd-field="points"]').fill('4');await card.locator('[data-qd-field="points"]').dispatchEvent('change');
 await action('question-up').nth(1).click();await action('question-down').first().click();
 await action('duplicate-section').nth(1).click();assert.equal(await page.locator('.qd-editor-section').count(),3);
 await action('delete-section').last().click();assert.equal(await page.locator('.qd-editor-section').count(),2);
 await action('builder-quick-save').click();assert.equal(await page.evaluate(()=>qdLibraryRead()[0].sections.length),2);
 assert.match(await page.locator('#qd-builder-save-state').innerText(),/Все изменения сохранены/);
 const original=await page.evaluate(()=>JSON.stringify(qdLibraryRead()[0]));
 await action('preview').click();assert.equal(await page.locator('dialog table').count(),1);await page.locator('dialog [data-close]').click();
 await layout(1440);await page.evaluate(()=>qdJumpToEdit(qdQuestionList()[0].id));await page.locator('#toast.active').waitFor({state:'hidden'});await page.screenshot({path:path.join(out,'QuantumOffice_TASK141_builder.png')});
 await page.reload();await open();assert.match(await page.locator('#qd-builder-save-state').innerText(),/Все изменения сохранены/);
 await mode('library').click();await page.locator('#qd-library-source').selectOption('custom');assert.equal(await page.locator('.qd-library-card').count(),1);
 await action('library-edit-content').click();await page.locator('[data-qd-field="title"]').fill('Тепловые явления · редакция 2');await action('builder-quick-save').click();
 assert.equal(await page.evaluate(()=>qdLibraryRead().length),1,'rename updates the linked ID');
 await action('save-copy').click();assert.equal(await page.evaluate(()=>qdLibraryRead().length),2);
 assert.equal(await page.evaluate(()=>qdLibraryRead().find(t=>t.title==='Тепловые явления · редакция 2').sections[0].questions[0].promptRich.includes('<table')),true);
 await page.locator('[data-qd-field="prompt"]').first().fill('Изменение только в копии');await action('builder-quick-save').click();
 assert.notEqual(await page.evaluate(()=>qdLibraryRead().find(t=>t.title==='Тепловые явления · редакция 2').sections[0].questions[0].prompt),'Изменение только в копии');
 // Restore the original's rich question for the conduct snapshot and media exchange.
 await mode('library').click();await action('library-edit-content').nth(1).click();
 await page.locator('#toast.active').waitFor({state:'hidden'});await page.screenshot({path:path.join(out,'QuantumOffice_TASK141_builder_full.png')});
 // Bind a synthetic pupils workbook through the existing hub API; exercise result saving through UI.
 await page.evaluate(()=>{const b=newWorkbook('Синтетическая книга TASK141');b.sheets[0].name='Ученики';setCell(b.sheets[0],'A1','Ученик');setCell(b.sheets[0],'A2','Пробный ученик TASK141');workspace.books.push(b);workspace.active=b.id;persist();qoHubWrite(QO_HUB_SOURCE_KEY,{bookId:b.id,sheetId:b.sheets[0].id});});
 await mode('run').click();await page.locator('.qd-session-drawer summary').click();
 await page.locator('[data-qd-field="student"]').fill('Пробный ученик TASK141');await action('remember-student').click();
 await page.locator('[data-qd-field="text-response"]').fill('При нагревании частицы движутся быстрее.');
 await page.locator('[data-qd-field="comment"]').fill('Верно, нужен пример.');await page.locator('[data-qd-field="score"]').fill('1.5');await page.locator('[data-qd-field="score"]').dispatchEvent('change');
 assert.equal(await page.evaluate(()=>qdDoc().session.scores[qdQuestionList()[0].id]),1.5);
 await action('run-checkpoint').click();await page.reload();await open();
 assert.equal(await page.locator('[data-qd-field="text-response"]').inputValue(),'При нагревании частицы движутся быстрее.');assert.equal(await page.locator('[data-qd-field="comment"]').inputValue(),'Верно, нужен пример.');
 const snapshotPrompt=await page.evaluate(()=>qdDoc().sections[0].questions[0].prompt);
 await mode('builder').click();await page.locator('[data-qd-field="prompt"]').first().fill('Позднее изменение черновика');await mode('run').click();
 assert.equal(await page.evaluate(()=>qdDoc().sections[0].questions[0].prompt),snapshotPrompt,'builder cannot mutate the run snapshot');
 await action('nav-next').click();await page.locator('[data-qd-field="numeric-response"]').fill('84');await action('auto-check').click();
 await action('nav-next').click();await page.locator('[data-qd-field="text-response"]').fill('Q = cmΔt = 84 кДж');await page.locator('[data-qd-field="score"]').fill('3');await page.locator('[data-qd-field="score"]').dispatchEvent('change');
 await layout(1440);await page.locator('#qo-diag-workspace').evaluate(el=>el.scrollTop=230);await page.screenshot({path:path.join(out,'QuantumOffice_TASK141_run.png')});
 const qdiag=await download(()=>page.evaluate(()=>qdExport()),'roundtrip.qdiagx');
 await action('save-result').first().click();assert.equal(await page.evaluate(()=>qdWorkingDoc().history.length),1);
 assert.equal(await page.evaluate(()=>qoHubResults().filter(x=>x.studentName==='Пробный ученик TASK141'||x.title.includes('Тепловые')).length),1);
 const saved=await page.evaluate(()=>qdWorkingDoc().history[0]);assert.equal(saved.summary.earned,6.5);assert.equal(Object.values(saved.comments)[0],'Верно, нужен пример.');
 assert.equal(await page.evaluate(()=>qdReportHTML(qdWorkingDoc().history[0]).includes('Верно, нужен пример.')),true);
 await page.reload();await open();assert.equal(await page.evaluate(()=>qdWorkingDoc().history.length),1);assert.equal(await page.evaluate(()=>qoHubResults().length),1);
 // Import/export actual portable files with image bytes and the independent run snapshot.
 await page.locator('#qo-diag-file').setInputFiles(qdiag);await page.waitForFunction(()=>Object.keys(qdDoc().session.responses).length===3);
 assert.equal(await page.evaluate(async()=>!!await qdMediaGet(qdDoc().sections[0].questions[0].promptMedia.id)),true);
 const library=await download(()=>page.evaluate(()=>qdLibraryExport()),'roundtrip.qtplx');
 await page.evaluate(()=>localStorage.removeItem(QD_LIBRARY_KEY));await page.locator('#qd-library-file').setInputFiles(library);await page.waitForFunction(()=>qdLibraryRead().length===2);
 assert.equal(await page.evaluate(()=>qdLibraryRead().find(t=>t.title.includes('редакция')).sections[0].questions[0].promptRich.includes('<table')),true);
 await page.evaluate(()=>qdBankSaveQuestion(qdWorkingDoc(),qdWorkingDoc().sections[0].questions[0].id,'physics','8'));
 const bank=await download(()=>page.evaluate(()=>qdBankExport()),'roundtrip.qbankx');
 await page.evaluate(()=>localStorage.removeItem(QD_BANK_KEY));await page.locator('#qd-bank-file').setInputFiles(bank);await page.waitForFunction(()=>qdBankRead().length===1);
 for(const view of ['builder','library','run']){
  await mode(view).click();for(const width of [1440,768,390])await layout(width);
  await page.locator('#toast.active').waitFor({state:'hidden'});
  if(view==='library'){await page.locator('#qd-library-source').selectOption('custom');await page.screenshot({path:path.join(out,'QuantumOffice_TASK141_library_mobile.png')});await layout(1440);await page.screenshot({path:path.join(out,'QuantumOffice_TASK141_library.png')});}
  if(view==='run'){await page.evaluate(()=>qdScrollToQuestion());await page.screenshot({path:path.join(out,'QuantumOffice_TASK141_mobile.png')});}
 }
 if(!(await page.locator('.qd-run-setup').evaluate(el=>el.open)))await page.locator('.qd-run-setup>summary').click();
 await page.locator('#qd-run-template').selectOption('built-in:math7');await action('run-start').click();
 assert.match(await page.evaluate(()=>qdDoc().title),/Математика/);assert.match(await page.evaluate(()=>qdWorkingDoc().title),/Тепловые/);
 assert.equal(await page.evaluate(()=>Object.keys(qdDoc().session.responses).length),0);
 // Untrusted rich text is sanitized through Writer's existing whitelist.
 assert.equal(await page.evaluate(()=>qdRichSafe('<script>window.evil=1</script><table><tr><td onclick="evil()">Safe</td></tr></table>').includes('onclick')),false);
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',scenarios:9,viewports:[1440,768,390],jsErrors:errors},null,2));
 console.log('PASS TASK141: 9 end-to-end scenarios, rich table/math, snapshots, exact scoring, pupil hub, QDIAGX/QTPLX/QBANKX and mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1)});
