/* UX-03: exercise the exact user-facing preview paths, both Chromium and installed WebView2. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{pathToFileURL}=require('node:url');
function loadContent(directory){
 return {bank:JSON.parse(fs.readFileSync(path.join(directory,'physics-ege-2019-variant-1.qwbank'),'utf8')),work:JSON.parse(fs.readFileSync(path.join(directory,'physics-ege-2019-variant-1.qwork'),'utf8'))};
}
async function seed(page,content){
 return page.evaluate(async({bank,work})=>{
  const repo=await qwBankOpen(),result=await repo.importBank(bank);
  if(result.imported!==32||result.skipped!==0)throw Error('Author variant import: '+JSON.stringify(result));
  const records=await Promise.all(work.tasks.map(t=>repo.getTask(t.source.id)));
  if(records.some(r=>!r?.bankNumber))throw Error('Missing real bank number');
  qwDoc=qwValidate({...work,tasks:work.tasks.map((t,i)=>({...t,source:qwBankSource(records[i])}))});
  qwSelected=qwDoc.tasks[0].id;qwPersist();route('work');qwRender();
  return structuredClone(qwDoc);
 },content);
}
async function runPreview(page,out,project){
 fs.mkdirSync(out,{recursive:true});
 const report={status:'RUNNING',version:await page.evaluate(()=>QO_RELEASE_VERSION),viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio})),geometry:[]};
 const save=()=>fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify(report,null,2));
 const screenshot=name=>page.screenshot({path:path.join(out,name+'.png')});
 const first=project.tasks[0],expected='№ 1 ('+String(first.source.number).padStart(5,'0')+').';
 const editor=page.locator('#qw-task-editor'),single='[data-bank-publish-frame]',full='#qw-print-preview-frame';
 const ready=selector=>page.waitForFunction(selector=>{
  const f=document.querySelector(selector);return !!f?.dataset.ready&&f.dataset.ready===f.contentDocument?.documentElement?.dataset.qwRender&&!f.contentWindow?.__qwPrintError&&f.contentDocument?.body?.dataset.qwLayoutReady==='true';
 },selector,{timeout:60000});
 const number=async(scope,expected)=>{
  const head=scope.locator('.qw-exam-number-line:visible').first();
  await head.waitFor();assert.equal(await head.textContent(),expected);
  assert.equal(await scope.locator('.qw-task-marker:visible').count(),0);
 };
 async function measure(selector){
  return page.locator(selector).evaluate(f=>{
   const d=f.contentDocument,w=f.contentWindow,root=d.scrollingElement,v=f.parentElement,s=d.querySelector('.qw-print-document>:is(.qw-print-page,.qw-print-sheet)'),r=f.getBoundingClientRect(),vr=v.getBoundingClientRect();
   const center=(vr.left+v.clientLeft+v.clientWidth/2);
   return {orientation:d.body.dataset.qwOrientation,profile:d.body.dataset.qwExamStandard,pages:w.__qwPrintLayout.sheets,physical:[s.offsetWidth,s.offsetHeight],zoom:Number(f.style.zoom),frame:[r.width,r.height],viewport:[v.clientWidth,v.clientHeight],outerScroll:[v.scrollWidth,v.scrollHeight],inner:[root.scrollWidth-root.clientWidth,root.scrollHeight-root.clientHeight],innerPosition:[root.scrollLeft,root.scrollTop],centerDelta:Math.abs(r.left+r.width/2-center),outerLeft:v.scrollLeft,outerTop:v.scrollTop};
  });
 }
 async function matrix(selector,scope,label,orientationControl,panelToggle){
  for(const orientation of ['portrait','landscape']){
   if(panelToggle&&await panelToggle.getAttribute('aria-expanded')==='false')await panelToggle.click();
   await orientationControl.selectOption(orientation);await ready(selector);
   const fit=scope.locator('[data-publish-fit=page]'),scale=scope.locator('[data-publish-zoom]');
   let physical;
   for(const collapsed of [false,true]){
    if(panelToggle&&((await panelToggle.getAttribute('aria-expanded'))==='false')!==collapsed)await panelToggle.click();
    for(const percent of [75,100,125,150]){
     await scale.selectOption(String(percent));
     const g=await measure(selector);report.geometry.push({label,orientation,collapsed,percent,...g});save();
     assert.equal(g.orientation,orientation);assert.equal(g.profile,'true');assert.equal(g.zoom,percent/100);
     assert.ok(g.inner.every(n=>n<=1),'Nested scrolling: '+JSON.stringify(g));
     if(!physical)physical=g.physical;assert.deepEqual(g.physical,physical,'Zoom changed physical A4');
     assert.ok(Math.abs(g.physical[0]-(orientation==='portrait'?794:1123))<=2,'Wrong physical width');
     assert.ok(Math.abs(g.physical[1]-(orientation==='portrait'?1123:794))<=2,'Wrong physical height');
     if(g.frame[0]<=g.viewport[0]+1)assert.ok(g.centerDelta<=3,'Sheet not centered: '+JSON.stringify(g));
     else {
      const reachable=await page.locator(selector).evaluate(f=>{const v=f.parentElement;v.scrollLeft=0;const start=v.scrollLeft;v.scrollLeft=v.scrollWidth;const end=v.scrollLeft;v.scrollLeft=0;return {start,end};});
      assert.equal(reachable.start,0);assert.ok(reachable.end>0,'Oversized A4 right edge unreachable');
     }
     await screenshot(label+'-'+orientation+'-'+percent+'-'+(collapsed?'closed':'open'));
    }
    await fit.click();const g=await measure(selector);assert.ok(g.centerDelta<=3||g.frame[0]>g.viewport[0]);await scope.locator('[data-publish-fit=width]').click();
   }
   await scale.selectOption('150');
   const outer=page.locator(selector).locator('..');
   await outer.evaluate(v=>{v.scrollTop=0;v.scrollLeft=0;});
   const box=await outer.boundingBox();
   await page.mouse.move(box.x+box.width/2,box.y+Math.min(160,box.height/2));await page.mouse.wheel(0,420);
   await page.waitForFunction(selector=>document.querySelector(selector).parentElement.scrollTop>30,selector,{timeout:5000});
   const wheel=await measure(selector);assert.deepEqual(wheel.innerPosition,[0,0]);report.geometry.push({label,orientation,wheel});save();
   await outer.focus();await outer.evaluate(v=>v.scrollTop=0);await page.keyboard.press('PageDown');
   await page.waitForFunction(selector=>document.querySelector(selector).parentElement.scrollTop>30,selector,{timeout:5000});
  }
 }
 try{
  await page.evaluate(()=>{qoThemePreference='light';qoApplyAppearance();route('work');qwSelected=qwDoc.tasks[0].id;qwRender();});
  assert.equal(await page.locator('html').getAttribute('data-qo-theme'),'light');
  await number(editor,expected);await screenshot('constructor-visual-editor');
  await editor.locator('[data-bank-source]').click();await number(editor,expected);await screenshot('constructor-source-editor');await editor.locator('[data-bank-source]').click();
  const workToggles=page.locator('#qo-work-root [data-qw-dock-toggle]');
  for(const toggle of await workToggles.all())if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
  const editorCenter=await editor.locator('[data-bank-rich=prompt]').evaluate(e=>{const v=e.closest('.qw-edit-scroll'),r=e.getBoundingClientRect(),b=v.getBoundingClientRect();return Math.abs(r.left+r.width/2-(b.left+v.clientLeft+v.clientWidth/2));});
  assert.ok(editorCenter<=3,'Editor sheet not centered: '+editorCenter);await screenshot('constructor-panels-closed');
  for(const toggle of await workToggles.all())if(await toggle.isVisible()&&await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
  await editor.locator('[data-bank-publish-toggle]').click();await ready(single);await number(page.frameLocator(single),expected);
  const right=page.locator('#qo-work-root [data-qw-dock-toggle=right]');
  await matrix(single,editor,'single-task-a4',editor.locator('[data-bank-publish-orientation]'),await right.isVisible()?right:null);
  await editor.locator('[data-bank-publish-toggle]').click();
  await page.locator('[data-action=work-preview]').click();await ready(full);
  await number(page.frameLocator(full),expected);assert.ok((await measure(full)).pages>1,'Expected multi-page variant');
  assert.equal(await page.frameLocator(full).locator('.qw-print-title').textContent(),'Вариант 1');
  await matrix(full,page.locator('#qw-dialog'),'full-a4',page.locator('[data-print-setting=orientation]'),page.locator('#qw-dialog [data-qw-dock-toggle=left]'));
  await page.locator('#qw-dialog [data-qw-close]').click();
  await page.locator('[data-action=work-answers]').click();await ready(full);await number(page.frameLocator(full),expected);await screenshot('brief-key');
  await page.locator('[data-key-option=includeComments]').check();await ready(full);await number(page.frameLocator(full),expected);await screenshot('solutions');
  await page.locator('[data-key-option=includePrompt]').check();await ready(full);await number(page.frameLocator(full),expected);await screenshot('conditions-and-solutions');
  await page.locator('#qw-dialog [data-qw-close]').click();
  // Long real condition; no synthetic substitution in the evidence.
  const longest=project.tasks.reduce((a,b)=>a.prompt.length>=b.prompt.length?a:b);
  await page.locator('.qw-nav-task[data-id="'+longest.id+'"]').click();await editor.locator('[data-bank-publish-toggle]').click();await ready(single);
  await editor.locator('[data-publish-zoom]').selectOption('150');await screenshot('long-condition');
  assert.ok((await measure(single)).inner.every(n=>n<=1));await editor.locator('[data-bank-publish-toggle]').click();
  await page.evaluate(()=>route('bank'));await page.locator('.qw-bank-extra-filters summary').click();await page.locator('#qw-bank-slot').selectOption('1');
  await page.locator('[data-bank-view="'+first.source.id+'"]').click();
  const card=page.locator('#qw-bank-preview');await number(card,expected);await screenshot('bank-card');
  await card.locator('[data-bank-enlarge]').click();await number(card,expected);await screenshot('bank-expanded');await card.locator('[data-bank-enlarge]').click();
  await card.locator('[data-bank-edit]').click();const bankEditor=page.locator('#qw-dialog');await number(bankEditor,expected);await screenshot('bank-editor');
  await bankEditor.locator('[data-bank-publish-toggle]').click();await ready(single);await number(page.frameLocator(single),expected);await screenshot('bank-editor-a4');await bankEditor.locator('[data-qw-action=bank-edit-back]').click();
  // Single preview accepts only authenticated bank provenance; no positional ID.
  const fallback=await page.evaluate(()=>{
   const q={...qwTask(),prompt:'Условие',source:{kind:'external-bank',id:'unresolved',number:815}};
   const p={...qwProject(),layout:'booklet',printSettings:{profile:'exam'},tasks:[q]};
   const t=document.createElement('template');t.innerHTML=qwPrintDocumentHTML(p,false,{singleTaskPreview:true,examPublication:true,singleTaskIndex:2});
   return {number:t.content.querySelector('.qw-exam-number-line').textContent,markers:t.content.querySelectorAll('.qw-task-marker').length};
  });assert.deepEqual(fallback,{number:'№ 3.',markers:0});
  report.status='PASS';save();
 }catch(error){report.status='FAIL';report.error=String(error.stack||error);save();try{await screenshot('failure');}catch{}throw error;}
 return report;
}
module.exports={loadContent,seed,runPreview};
if(require.main===module)(async()=>{
 const content=loadContent(process.argv[2]||'evidence/exam-01/content'),out=process.argv[3]||'evidence/ux03/browser';
 const browser=await chromium.launch({ignoreDefaultArgs:['--hide-scrollbars']});
 try{
  const page=await browser.newPage({offline:true,colorScheme:'light',viewport:{width:1920,height:1080}});
  await page.goto(pathToFileURL(path.resolve('Quantum-Office.html')).href);
  const project=await seed(page,content);await runPreview(page,out,project);
  for(const [name,opts] of [['student',{format:'booklet'}],['brief',{format:'answers',keyMode:'brief'}],['solutions',{format:'answers',keyMode:'detailed',includeCriteria:true,includePrompt:true}]]){
   const html=await page.evaluate(({project,opts})=>qwPrintDocumentHTML(project,false,opts),{project,opts});
   const p=await browser.newPage();await p.setContent(html);await p.evaluate(()=>window.qwPrintReady);assert.equal(await p.evaluate(()=>window.__qwPrintError),undefined);
   assert.equal(await p.locator('.qw-task-marker').count(),0);
   await p.pdf({path:path.join(out,name+'.pdf'),preferCSSPageSize:true,printBackground:true});await p.close();
  }
  console.log('PASS UX-03 Chromium preview matrix and PDF');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
