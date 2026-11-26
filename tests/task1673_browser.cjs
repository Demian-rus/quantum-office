/* TASK167.3: compare real baseline and candidate, full shell modes, view-only preferences. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task1673');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const errors=[],reports=[];let page,context,acceptDialog=true;const bankDecision={accept:true,count:0};let bankTesting=false;
 const modern={preview:'[data-action=work-preview]',graph:'[data-bank-visual=graph]',diagram:'[data-bank-visual=diagram]',save:'[data-action=work-save]'};let candidate=false;
 const action=a=>candidate&&modern[a]?page.locator(modern[a]):page.locator('[data-qw-action="'+a+'"]');
 const close=async()=>{await page.locator('[data-qw-close]').click();await page.locator('#qw-dialog').waitFor({state:'detached'});};
 const ready=()=>page.waitForFunction(()=>{const f=document.querySelector('#qw-print-preview-frame');return !!f?.dataset.ready&&f.dataset.ready===f.contentDocument?.documentElement?.dataset.qwRender&&!f.contentWindow?.__qwPrintError;});
 const setup=async(file)=>{context=await browser.newContext({offline:true,acceptDownloads:true,viewport:{width:1920,height:1080}});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{if(bankTesting){bankDecision.count++;return bankDecision.accept?d.accept():d.dismiss();}return acceptDialog?d.accept():d.dismiss();});await page.goto(pathToFileURL(file).href);await page.evaluate(()=>{route('work');const d=qwProject(),g=qwTask('graph'),s=qwTask('diagram');g.prompt='Скорость по графику';g.graph.points=[{x:1,y:1,label:'A'},{x:8,y:5,label:'B'}];s.prompt='Геометрия';s.diagram=[{kind:'line',x:40,y:80,x2:300,y2:80,label:'AB'}];d.tasks=[g,s];d.layout='booklet';qwDoc=qwValidate(d);qwSelected=g.id;qwPersist();qwRender();});await page.evaluate(async()=>{await qwBankOpen();const task=structuredClone(qwDoc.tasks[0]);await qwBankRepository.createTask({id:'task1673-baseline-view',subject:'physics',task});});};
 const snap=()=>page.evaluate(()=>JSON.stringify(qwDoc));
 const screenshot=name=>page.screenshot({path:path.join(out,name+'.png')});
 const geom=()=>page.evaluate(()=>{const rect=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return [b.x,b.y,b.width,b.height];};return {header:rect('.global-bar'),body:rect('.qo-education-body'),center:rect('.qw-center'),mode:rect('.qw-mode-host'),dialog:rect('#qw-dialog'),stage:rect('#qw-visual-stage'),overflow:document.documentElement.scrollWidth>innerWidth};});
 async function capture(label){await screenshot(label+'-work');await action('preview').click();await ready();await screenshot(label+'-pdf');await close();await action('graph').click();await screenshot(label+'-graph');await close();await page.locator('.qw-nav-task').nth(1).click();await action('diagram').click();await screenshot(label+'-diagram');await close();await page.locator('.qw-nav-task').first().click();await page.evaluate(()=>{route('diagnostics');qdMode='builder';qdRefresh();});await screenshot(label+'-diagnostics');await page.evaluate(()=>route('bank'));await page.locator('[data-bank-view="task1673-baseline-view"]').click();await page.locator('[data-bank-add="task1673-baseline-view"]').waitFor();await screenshot(label+'-bank');}
 try{
  const baseline=process.env.QO_TASK1673_BASELINE||path.join(root,'task1673-baseline','Quantum-Office.html');
  await setup(baseline);await capture('before');await context.close();candidate=true;candidate=true;
  await setup(path.join(root,'Quantum-Office.html'));await capture('after');await page.evaluate(()=>route('work'));
  const before=await snap(),center=await page.locator('.qw-center').boundingBox();
  const left=page.locator('#qo-work-root [data-qw-dock-toggle="left"]'),divider=page.locator('#qo-work-root [data-qw-dock-resize="left"]');
  await left.click();assert.equal(await page.locator('.qw-left').isVisible(),false);assert.ok((await page.locator('.qw-center').boundingBox()).width>center.width+100);await left.click();
  const prior=await page.locator('.qw-left').boundingBox();await divider.focus();await page.keyboard.press('Shift+ArrowRight');assert.ok((await page.locator('.qw-left').boundingBox()).width>prior.width+20);
  const point=await divider.boundingBox();await page.mouse.move(point.x+point.width/2,point.y+point.height/2);await page.mouse.down();await page.mouse.move(point.x+point.width/2+45,point.y+point.height/2,{steps:5});await page.mouse.up();
  const pref=await page.evaluate(()=>qwPanelPreference('work'));assert.ok(pref.left>270);assert.equal(await snap(),before,'dock preferences must not alter QWORK');
  await page.reload();await page.evaluate(()=>route('work'));assert.deepEqual(await page.evaluate(()=>qwPanelPreference('work')),pref);
  await page.locator('[data-qw-dock-reset="work"]').click();assert.equal(await page.evaluate(()=>qwPanelPreference('work').left),228);
  const selected=await page.evaluate(()=>qwSelected);await page.locator('[data-bank-live=prompt]').fill('Новая формулировка графика');await page.locator('[data-bank-live=prompt]').press('Tab');
  await action('preview').click();await ready();assert.equal(await page.locator('#qw-dialog').evaluate(d=>d.matches(':modal')),false);
  assert.ok(await page.locator('.qw-mode-host[data-qw-mode="pdf"]').isVisible());
  await page.locator('select[name="qw-pdf-layout"]').selectOption('compact');await page.locator('[data-print-setting="orientation"]').selectOption('landscape');await page.locator('#qw-layout-figure-mode').selectOption('manual');await page.locator('#qw-layout-figure-width').fill('80');await page.locator('#qw-layout-figure-width').press('Tab');await ready();await close();
  assert.equal(await page.evaluate(()=>qwSelected),selected);assert.equal(await page.evaluate(()=>qwDoc.layout),'compact');assert.equal(await page.evaluate(()=>qwDoc.tasks[0].figureWidthMode),'manual');
  await action('graph').click();assert.equal(await page.locator('#qw-dialog').evaluate(d=>d.matches(':modal')),false);
  await page.locator('#qw-graph-preset').selectOption('v');await action('visual-apply').click();await page.locator('#qw-dialog').waitFor({state:'detached'});
  assert.match(await page.evaluate(()=>qwDoc.tasks[0].graph.ylabel),/v/);
  await page.locator('.qw-nav-task').nth(1).click();const diagramBefore=await snap();await action('diagram').click();
  await page.locator('[data-tool="rect"]').click();const stage=await page.locator('#qw-visual-stage svg').boundingBox();await page.mouse.move(stage.x+stage.width*.2,stage.y+stage.height*.2);await page.mouse.down();await page.mouse.move(stage.x+stage.width*.5,stage.y+stage.height*.5,{steps:5});await page.mouse.up();
  acceptDialog=false;await page.evaluate(()=>route('bank'));assert.equal(await page.evaluate(()=>page),'work');assert.ok(await page.locator('.qw-mode-host[data-qw-mode="visual"]').isVisible());acceptDialog=true;
  await action('visual-cancel').click();await page.locator('#qw-dialog').waitFor({state:'detached'});assert.equal(await snap(),diagramBefore);
  await page.evaluate(async()=>{await qwBankOpen();const task=qwTask('short');task.prompt='TASK167.3 bank fixture';task.answer='42';await qwBankRepository.createTask({id:'task1673-fixture',subject:'physics',task});});
  await page.evaluate(()=>route('bank'));await page.locator('[data-bank-view="task1673-fixture"]').click();await page.locator('[data-bank-add="task1673-fixture"]').click();await page.waitForFunction(()=>page==='work'&&qwDoc.tasks.some(q=>q.prompt==='TASK167.3 bank fixture'));
  const saved=await snap();await page.evaluate(()=>route('diagnostics'));await page.evaluate(()=>route('work'));assert.equal(await snap(),saved);
  const dl=page.waitForEvent('download');await action('save').click();const file=path.join(out,'roundtrip.qwork');await(await dl).saveAs(file);await page.locator('#qw-file').setInputFiles(file);await page.waitForFunction(()=>document.getElementById('toast')?.textContent.includes('Работа открыта'));assert.deepStrictEqual(JSON.parse(await snap()),JSON.parse(saved));
  await page.reload();await page.evaluate(()=>route('work'));assert.deepStrictEqual(JSON.parse(await snap()),JSON.parse(saved));
  for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1024,768],[800,900]])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height});await page.evaluate(t=>{qoThemePreference=t;qoApplyAppearance();route('work');qwSelected=qwDoc.tasks[0].id;qwRender();},theme);
   const work=await geom();assert.ok(!work.overflow&&work.center[2]>0);
   await action('preview').click();await ready();const pdf=await geom();assert.deepEqual(pdf.header,work.header,'shell header changed');assert.ok(!pdf.overflow&&pdf.mode[2]===pdf.body[2]&&pdf.mode[3]===pdf.body[3]);assert.ok(await page.locator('[data-qw-action="preview-pdf"]').isVisible());assert.ok(await page.locator('#qw-layout-figure-mode').isVisible());await screenshot(width+'-'+height+'-'+theme+'-pdf');await close();
   await action('graph').click();const visual=await geom();assert.deepEqual(visual.header,work.header);assert.ok(!visual.overflow&&visual.stage[2]>100&&visual.stage[3]>80);if(width<=1000){await page.locator('[data-visual-panel="tools"]').click();assert.ok(await page.locator('#qw-graph-preset').isVisible());await page.locator('[data-visual-panel="tools"]').click();}await screenshot(width+'-'+height+'-'+theme+'-graph');await close();
   await page.evaluate(()=>route('diagnostics'));const diagnostic=await geom();assert.ok(!diagnostic.overflow);await page.evaluate(()=>route('bank'));await page.locator('#qw-bank-list').waitFor();const bank=await geom();assert.ok(!bank.overflow);reports.push({width,height,theme,work,pdf,visual,diagnostic,bank});
  }
  await page.setViewportSize({width:1440,height:900});bankTesting=true;const bankLifecycle=await require('./task1673_bank_lifecycle.cjs').checkBankLifecycle(page,'task1673-fixture',bankDecision);bankTesting=false;fs.writeFileSync(path.join(out,'bank-lifecycle.json'),JSON.stringify(bankLifecycle,null,2));
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'PASS',reports},null,2));console.log('PASS TASK167.3: baseline/candidate, shell modes, persistent dock, graph apply/diagram cancel, bank, QWORK, ten viewport/theme combinations');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
