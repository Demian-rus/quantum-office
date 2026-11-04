const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const seed=require('./task142_fixture.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task142');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const action=n=>page.locator('[data-qd-action="'+n+'"]');const mode=n=>page.locator('[data-qd-action="mode"][data-mode="'+n+'"]').first();
 await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);await page.evaluate(()=>route('writer'));await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
 // Actual empty start and keyboard authoring, not a pre-filled sample.
 await action('blank').first().click();await page.keyboard.press('Control+Enter');assert.equal(await page.locator('.qd-edit-card').count(),1);
 await page.locator('[data-qd-field="title"]').fill('Создано с нуля TASK142');await page.locator('[data-qd-field="prompt"]').fill('Почему нагреваются тела?');
 assert.equal(await page.locator('#qd-question-properties [data-qd-field="points"]').count(),1,'settings moved to inspector');
 assert.equal(await page.locator('.qd-edit-card [data-qd-field="points"]').count(),0,'one actual control per property');
 await page.locator('#qd-question-properties [data-qd-field="points"]').fill('3');await page.locator('#qd-question-properties [data-qd-field="points"]').dispatchEvent('change');
 await page.locator('#qd-question-properties [data-qd-field="criteria"]').fill('Связь с передачей энергии');await page.keyboard.press('Control+s');
 assert.equal(await page.evaluate(()=>qdLibraryRead().length),1);assert.match(await page.locator('#qd-builder-save-state').innerText(),/Все изменения сохранены/);
 // Context menu duplicates the real model and closes; keyboard movement reorders it.
 await page.locator('.qd-edit-card').click({button:'right'});await page.locator('#qd-context-menu [data-qd-action="duplicate-question"]').click();
 assert.equal(await page.locator('.qd-edit-card').count(),2);assert.equal(await page.locator('#qd-context-menu').count(),0);
 await page.locator('.qd-outline-question').last().click();const selected=await page.evaluate(()=>qdDesk.question);await page.keyboard.press('Alt+ArrowUp');assert.equal(await page.evaluate(()=>qdQuestionList()[0].id),selected);
 await page.locator('.qd-select-question').first().click();await action('panels').click();assert.equal(await page.locator('.qd-question-inspector').isVisible(),false);await action('panels').click();
 // Same fixture as before screenshots, then edit through the real inspector.
 await seed(page);await page.locator('.qd-outline-question[data-qid="q1"]').click();
 await page.locator('#qd-question-properties [data-qd-field="hint"]').fill('Вспомните, как передаётся энергия вдоль твёрдого тела.');
 await page.keyboard.press('Control+s');assert.equal(await page.evaluate(()=>qdWorkingDoc().sections[0].questions[0].hint.length>0),true);
 await page.locator('#toast.active').waitFor({state:'hidden'});await page.screenshot({path:path.join(out,'after_builder.png')});
 await page.locator('.qd-media-fold').first().locator('summary').click();assert.equal(await page.locator('.qd-media-fold').first().evaluate(el=>el.open),true);await page.locator('.qd-media-fold').first().locator('summary').click();
 await mode('library').click();await page.locator('#qd-library-search').fill('ложка');assert.ok(await page.locator('.qd-library-card').count()>=1,'content search');await page.locator('#qd-library-search').fill('несуществующий запрос 142');assert.match(await page.locator('.qd-library-empty').innerText(),/Шаблоны не найдены/);await action('library-clear-filters').click();
 await page.locator('#qd-library-source').selectOption('custom');await page.locator('#toast.active').waitFor({state:'hidden'});await page.screenshot({path:path.join(out,'after_library.png')});
 const own=page.locator('.qd-library-card').filter({hasText:'Тепловые явления'});await own.locator('.qd-library-menu>summary').click();await own.locator('[data-qd-action="library-clone"]').click();assert.equal(await page.evaluate(()=>qdLibraryRead().length),3);
 await page.locator('.qd-library-card').filter({hasText:'Тепловые явления'}).last().locator('[data-qd-action="library-open"]').click();
 // One ongoing snapshot, written answers and exact scoring without losing comment focus.
 await mode('run').click();const runIds=await page.evaluate(()=>qdQuestionList().map(q=>q.id));const [firstId,secondId,thirdId]=runIds;await page.locator('.qd-session-drawer>summary').click();await page.locator('[data-qd-field="student"]').fill('Синтетический ученик TASK142');await action('remember-student').click();
 assert.equal(await page.locator('.qd-pupil-hint p').count(),0);await action('hint').click();assert.match(await page.locator('.qd-pupil-hint p').innerText(),/вдоль твёрдого/);
 await page.locator('[data-qd-field="text-response"]').fill('Энергия передаётся благодаря теплопроводности.');await page.locator('[data-qd-field="score"]').fill('1.5');await page.locator('[data-qd-field="comment"]').click();
 assert.equal(await page.evaluate(()=>document.activeElement.dataset.qdField),'comment','grading must not detach clicked comment field');await page.keyboard.type('Верное объяснение, нужен пример.');
 assert.equal(await page.evaluate(id=>qdDoc().session.scores[id],firstId),1.5);assert.match(await page.locator('.qd-guided-measures').innerText(),/1.5/);
 await action('nav-next').click();await page.locator('[data-qd-field="numeric-response"]').fill('84');await action('auto-check').click();await action('nav-next').click();
 if(!(await page.locator('.qd-run-setup').evaluate(el=>el.open)))await page.locator('.qd-run-setup>summary').click();await action('run-checkpoint').click();
 await page.reload();await page.evaluate(()=>{route('writer');qoWorkspaceTab.writer='diagnostic';render();});
 assert.equal(await page.evaluate(id=>qdDoc().session.comments[id],firstId),'Верное объяснение, нужен пример.');assert.equal(await page.evaluate(()=>qdDisplay().activeId),thirdId);
 await mode('builder').click();await page.locator('[data-qd-field="prompt"][data-qid="'+firstId+'"]').fill('Изменённый черновик, снимок неизменен');await mode('run').click();assert.match(await page.evaluate(()=>qdDoc().sections[0].questions[0].prompt),/металлическая/);
 await page.locator('[data-qd-field="text-response"]').fill('Сравнить передачу энергии в одинаковых условиях.');await page.locator('[data-qd-field="score"]').fill('3');await page.locator('[data-qd-field="comment"]').click();
 assert.match(await page.locator('.qd-topic-navigator [data-sid]').last().innerText(),/1 оценено/);
 await page.evaluate(()=>qdScrollToQuestion());
 const rails=await page.evaluate(()=>{const a=document.querySelector('.qd-topic-navigator').getBoundingClientRect(),b=document.querySelector('.qd-review-sidebar').getBoundingClientRect();return {aBottom:a.bottom,bTop:b.top};});assert.ok(rails.aBottom<=rails.bTop+1,'conduct rails must never overlap while scrolled');
 await page.locator('#toast.active').waitFor({state:'hidden'});await page.screenshot({path:path.join(out,'after_run.png')});
 await page.locator('[data-qd-field="score"]').fill('2.5');
 await action('save-result').first().click();assert.equal(await page.evaluate(()=>qdWorkingDoc().history.length),1);assert.equal(await page.evaluate(()=>qdWorkingDoc().history[0].summary.earned),8);
 // Responsive screens and browser-zoom-equivalent CSS viewports at a 1440 px surface.
 const viewports=[{width:1440,zoom:100},{width:768,zoom:100},{width:390,zoom:100},{width:1152,zoom:125},{width:960,zoom:150},{width:720,zoom:200}],metrics=[];
 for(const view of ['builder','library','run']){await mode(view).click();for(const v of viewports){await page.setViewportSize({width:v.width,height:950});
  if(view==='builder'){if(v.width<1200)await page.keyboard.press('Escape');if(!await page.locator('.qd-desk-outline').evaluate(el=>el.open))await page.locator('.qd-desk-outline>summary').click();await page.locator('.qd-outline-question').first().click();if(v.width<1200)assert.equal(await page.locator('.qd-question-inspector').isVisible(),true);}
  const m=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth,escaped:[...document.querySelectorAll('#qo-diag-root textarea,#qo-diag-root .qd-edit-card,#qo-diag-root .qd-library-card,#qo-diag-root .qd-run-card,#qd-question-properties input,#qd-question-properties select')].filter(e=>e.getClientRects().length).filter(e=>{const b=e.getBoundingClientRect();return b.right>innerWidth+2||b.left<0;}).length}));
  assert.ok(m.scroll<=v.width+2,view+' overflow at '+JSON.stringify(v));assert.equal(m.escaped,0,view+' escaped controls at '+v.width);metrics.push({view,...v,...m});
  if(view==='builder'&&v.width===390){await page.locator('#toast.active').waitFor({state:'hidden'});await page.screenshot({path:path.join(out,'after_mobile_inspector.png')});await page.keyboard.press('Escape');}
  if(view==='run'&&v.width===390){await page.locator('#toast.active').waitFor({state:'hidden'});await page.evaluate(()=>qdScrollToQuestion());await page.screenshot({path:path.join(out,'after_mobile_run.png')});}
 }}
 await page.setViewportSize({width:1440,height:1000});await mode('builder').click();await page.locator('.qd-outline-question').first().click();await page.evaluate(async()=>{qoThemePreference='dark';qoApplyAppearance();await new Promise(requestAnimationFrame);await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));});
 const colors=await page.locator('[data-qd-action="blank"]').evaluate(el=>{const c=getComputedStyle(el);return {background:c.backgroundColor,surface:c.getPropertyValue('--qo-surface')};});assert.notEqual(colors.background,'rgb(255, 255, 255)','dark controls must finish transitioning before capture');await page.screenshot({path:path.join(out,'after_dark.png')});
 // Unrecognized or corrupted binaries must never overwrite the current Writer document.
 await page.evaluate(()=>{qoWorkspaceTab.writer='home';render();});const before=await page.evaluate(()=>qoWriter.html);
 for(const name of ['unknown.bin','archive.txt','broken.docx']){
  await page.locator('#qo-writer-file').setInputFiles({name,mimeType:'application/octet-stream',buffer:Buffer.from('PK\x03\x04\x00broken')});await page.waitForFunction(()=>document.querySelector('#toast')?.classList.contains('bad'));assert.equal(await page.evaluate(()=>qoWriter.html),before);
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',metrics,jsErrors:errors},null,2));console.log('PASS TASK142: real authoring, inspector, shortcuts/context menu, search, snapshots, exact scoring focus, reload, 18 responsive/zoom layouts and import preservation');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1)});
