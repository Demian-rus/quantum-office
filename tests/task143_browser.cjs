/* TASK143: actual three-zone layout and existing teacher workflows. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const seed=require('./task142_fixture.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task143');fs.mkdirSync(out,{recursive:true});
 const b=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
 const p=await b.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const errors=[],metrics=[];p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
 const action=a=>p.locator('[data-qd-action="'+a+'"]');const mode=async v=>p.locator('[data-qd-action="mode"][data-mode="'+v+'"]').first().click();
 const snapshot=async name=>{await p.locator('#toast.active').waitFor({state:'hidden'});await p.screenshot({path:path.join(out,name+'.png')});};
 await p.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);await p.evaluate(()=>{route('writer');qoWorkspaceTab.writer='diagnostic';render();});
 assert.equal(await p.locator('.qd-eyebrow,.qo-diag-guide-group').count(),0,'obsolete copy removed from DOM');
 assert.equal(await p.locator('.qd-top p').count(),0);assert.equal(await p.locator('.qd-workbench-main .qd-top [data-qd-action="mode"]').count(),3);
 // Empty authoring, navigation, real inspector controls, save/reopen and copy.
 await action('blank').first().click();assert.equal(await p.evaluate(()=>qdQuestionList().length),0);
 await p.locator('.qd-topic-navigator [data-qd-action="add-section"]').click();await p.locator('.qd-topic-navigator [data-qd-action="quick-question"]').click();
 await p.locator('[data-qd-field="title"]').fill('Собственная TASK143');assert.equal(await p.locator('.qd-top h1').innerText(),'Собственная TASK143');
 await p.locator('[data-qd-field="prompt"]').fill('Что переносится при теплопроводности?');await p.locator('[data-qd-field="answer"]').fill('Энергия');
 await p.locator('#qd-question-properties [data-qd-field="points"]').fill('4');await p.locator('#qd-question-properties [data-qd-field="points"]').dispatchEvent('change');
 await p.locator('#qd-question-properties [data-qd-field="criteria"]').fill('Указать передачу энергии');assert.equal(await p.locator('[data-qd-field="points"]').count(),1);
 await p.keyboard.press('Control+s');assert.match(await p.locator('#qd-builder-save-state').innerText(),/Все изменения сохранены/);
 const original=await p.evaluate(()=>JSON.stringify(qdLibraryRead()[0]));await mode('library');
 await p.locator('.qd-library-nav #qd-library-source').selectOption('custom');await p.locator('.qd-library-nav #qd-library-search').fill('теплопроводности');assert.equal(await p.locator('.qd-library-card').count(),1);
 await action('library-open').click();assert.equal(await p.locator('[data-qd-field="answer"]').inputValue(),'Энергия');
 await p.locator('[data-qd-field="answer"]').fill('Передача внутренней энергии');await p.keyboard.press('Control+s');assert.match(await p.evaluate(()=>qdLibraryRead()[0].sections[0].questions[0].answer),/внутренней/);
 await mode('library');await p.locator('.qd-library-menu>summary').click();await action('library-clone').click();assert.equal(await p.evaluate(()=>qdLibraryRead().length),2);
 assert.equal(await p.evaluate(id=>qdLibraryRead().find(x=>x.id===id)?.title,JSON.parse(original).id),JSON.parse(original).title,'copy preserves original identity');
 // Same synthetic diagnosis as baseline: bounded center and pinned independent rails.
 await seed(p);await mode('builder');await p.locator('.qd-outline-question').first().click();
 const geometry=async()=>p.evaluate(()=>{const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,right:b.right,bottom:b.bottom};};return {width:innerWidth,left:r('.qd-topic-navigator'),main:r('.qd-workbench-main'),right:r('.qd-side-insights'),head:r('.qd-top')};});
 const before=await geometry();assert.ok(before.left.right<before.main.x&&before.main.right<before.right.x);assert.ok(before.main.width>=800&&before.main.width<=960);
 await p.locator('.qd-workbench-main').evaluate(el=>el.scrollTop+=300);const after=await geometry();assert.equal(after.left.y,before.left.y);assert.equal(after.right.y,before.right.y);assert.equal(after.head.y,before.head.y,'central tools stay available during editing');
 const scrollBefore=await p.locator('.qd-workbench-main').evaluate(el=>el.scrollTop);await p.locator('#qd-question-properties [data-qd-field="points"]').fill('3');await p.locator('#qd-question-properties [data-qd-field="points"]').dispatchEvent('change');assert.equal(await p.locator('.qd-workbench-main').evaluate(el=>el.scrollTop),scrollBefore,'property edit preserves center scroll');
 await action('panels').click();assert.ok((await geometry()).main.width>before.main.width+100);await action('panels').click();
 await p.locator('.qd-outline-question').first().click();await snapshot('after_builder');
 await p.setViewportSize({width:1920,height:1000});assert.ok((await geometry()).main.width<=960);await p.setViewportSize({width:1440,height:1000});
 await mode('library');await p.locator('#qd-library-search').fill('');await p.locator('#qd-library-source').selectOption('all');await snapshot('after_library');
 // Conduct remains an independent snapshot; scoring does not consume the next click.
 await mode('run');await p.locator('.qd-session-drawer>summary').click();await p.locator('[data-qd-field="student"]').fill('Синтетический ученик TASK143');await action('remember-student').click();
 await p.locator('[data-qd-field="text-response"]').fill('Энергия передаётся вдоль ложки.');await p.locator('[data-qd-field="score"]').fill('1.5');await p.locator('[data-qd-field="comment"]').click();assert.equal(await p.evaluate(()=>document.activeElement.dataset.qdField),'comment');await p.keyboard.type('Нужно уточнение');
 await p.evaluate(()=>qdScrollToQuestion());await snapshot('after_run');await action('save-result').first().click();assert.equal(await p.evaluate(()=>qdWorkingDoc().history.length),1);
 await p.reload();await p.evaluate(()=>{route('writer');qoWorkspaceTab.writer='diagnostic';render();});assert.equal(await p.evaluate(()=>qdWorkingDoc().history.length),1);
 await mode('builder');await p.locator('[data-qd-field="prompt"]').first().fill('Изменён только черновик');await mode('run');assert.match(await p.evaluate(()=>qdDoc().sections[0].questions[0].prompt),/металлическая/);
 // Desktop + tablet + phone, every mode. Both drawers remain reachable on small screens.
 for(const width of [1440,768,390])for(const view of ['builder','library','run']){
  await p.setViewportSize({width,height:1000});await p.keyboard.press('Escape');await mode(view);
  if(width<1200){
   await action('navigation').click();assert.equal(await p.locator('.qd-topic-navigator').isVisible(),true);
   if(view==='library')assert.equal(await p.locator('.qd-library-nav #qd-library-search').isVisible(),true);
   await p.keyboard.press('Escape');assert.equal(await p.locator('.qd-topic-navigator').isVisible(),false);
   await action('inspector').click();assert.equal(await p.locator('.qd-side-insights').isVisible(),true);
   if(view==='builder')assert.equal(await p.locator('#qd-question-properties [data-qd-field="points"]').isVisible(),true);
   await snapshot('after_'+view+'_'+width);await p.locator('.qd-side-insights .qd-drawer-close').click();assert.equal(await p.locator('.qd-side-insights').isVisible(),false);
  }
  if(width===390&&view==='run'){await p.evaluate(()=>qdScrollToQuestion());const y=await p.evaluate(()=>document.querySelector('.qd-guided').getBoundingClientRect().top-document.querySelector('.qd-workbench-main').getBoundingClientRect().top);assert.ok(y>=0&&y<=15,'phone question navigation must not reserve space for a nonsticky header');}
  const m=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth,escaped:[...document.querySelectorAll('#qo-diag-root textarea,#qo-diag-root input,#qo-diag-root select,#qo-diag-root .qd-card,#qo-diag-root .qd-library-card')].filter(e=>e.getClientRects().length).filter(e=>{const b=e.getBoundingClientRect();return b.left<0||b.right>innerWidth+2;}).length}));assert.ok(m.scroll<=width+2);assert.equal(m.escaped,0,view+' controls outside '+width);metrics.push({view,width,...m});
 }
 await p.setViewportSize({width:1440,height:1000});await mode('builder');await p.locator('.qd-outline-question').first().click();await p.evaluate(async()=>{qoThemePreference='dark';qoApplyAppearance();await new Promise(requestAnimationFrame);await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));});await snapshot('after_dark');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',metrics,jsErrors:errors},null,2));console.log('PASS TASK143: three pinned zones, bounded center, scroll/focus, clean copy, authoring/save/copy, library filters, isolated conduct/reload and 9 responsive layouts');
 }finally{await b.close();}
})().catch(e=>{console.error(e.stack);process.exit(1)});
