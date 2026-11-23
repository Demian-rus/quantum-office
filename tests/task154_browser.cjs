/* TASK154: real offline Chromium acceptance for print design and 2018 question bank. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task154');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:1440,height:920},offline:true});
 const page=await ctx.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 try{
  await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  await page.evaluate(()=>route('writer'));
  const setup=await page.evaluate(()=>{
   const a=qwTask('short');a.prompt='Вычислите \\(2^{3}+4\\).';a.answer='12';a.grade='11';a.exam='ege';a.topic='Алгебра';
   const b=qwTask('short');b.prompt='Решите уравнение \\(x^{2}-5x+6=0\\).';b.answer='2; 3';b.grade='11';b.exam='ege';b.topic='Уравнения';
   const c=qwTask('short');c.prompt='Найдите среднюю скорость на участке 100 м за 5 с.';c.answer='20';c.grade='11';c.exam='ege';c.topic='Кинематика';
   localStorage.setItem(QW_BANK_KEY,JSON.stringify([
    {id:'task154-a',subject:'math',grade:'11',exam:'ege',year:'2018',part:'1',slot:'1',difficulty:'basic',topic:'Алгебра',subtopic:'Степени',origin:'adapted',task:a},
    {id:'task154-b',subject:'math',grade:'11',exam:'ege',year:'2018',part:'2',slot:'13',difficulty:'high',topic:'Уравнения',subtopic:'Квадратные',origin:'adapted',task:b},
    {id:'task154-c',subject:'physics',grade:'11',exam:'ege',year:'2020',part:'1',slot:'2',difficulty:'basic',topic:'Кинематика',subtopic:'Скорость',origin:'adapted',task:c}
   ]));
   return qwBankRead().map(x=>({id:x.id,year:x.year,part:x.part,slot:x.slot,difficulty:x.difficulty}));
  });
  assert.deepEqual(setup.map(x=>x.year),['2018','2018','2020']);
  await page.evaluate(()=>qwBank());
  await page.locator('.qw-bank-extra-filters summary').click();
  assert.ok(await page.locator('#qw-bank-year option[value="2018"]').count());
  await page.locator('#qw-bank-exam').selectOption('ege');
  await page.locator('#qw-bank-year').selectOption('2018');
  await page.locator('#qw-bank-grade').selectOption('11');
  assert.equal(await page.locator('[data-bank-select]').count(),2,'year filters bank entries');
  await page.locator('[data-bank-select="task154-a"]').check();
  await page.locator('[data-bank-select="task154-b"]').check();
  assert.match(await page.locator('#qw-bank-selected-count').innerText(),/2/);
  await page.locator('[data-qw-action="bank-assemble"]').click();
  await page.locator('.qw-print-design-dialog').waitFor();
  assert.ok(await page.locator('#qw-title-controls').count());
  const title=page.locator('[data-print-setting="titleText"]');
  assert.equal(await title.inputValue(),'Аналоги ЕГЭ 2018');
  await title.fill('Аналоги ЕГЭ 2018 — тренировочный вариант');
  await title.press('Tab');
  await page.locator('[data-print-setting="titleFont"]').selectOption('serif');
  await page.locator('[data-print-setting="titlePt"]').fill('18');
  await page.locator('[data-print-setting="titlePt"]').press('Tab');
  await page.locator('[data-print-setting="titleColor"]').fill('#17334f');
  await page.locator('[data-print-setting="bodyFont"]').selectOption('serif');
  await page.locator('[data-print-setting="showMeta"]').uncheck();
  await page.locator('[data-print-setting="showVariant"]').uncheck();
  await page.locator('[data-print-setting="theme"]').selectOption('academic');
  const ready=async()=>{await page.waitForFunction(()=>{
   const f=document.querySelector('#qw-print-preview-frame');
   return f?.contentWindow?.__qwPrintLayout&& !f.contentWindow.__qwPrintError && f.dataset.ready;
  },{timeout:20000});};
  await ready();
  const state=await page.evaluate(()=>{
   const settings=qwDoc.printSettings;
   return {layout:qwDoc.layout,title:qwDoc.title,n:qwDoc.tasks.length,sources:qwDoc.tasks.map(x=>x.source),
    settings,year:qwBankRead()[0].year,ids:qwDoc.tasks.map(x=>x.id)};
  });
  assert.equal(state.layout,'booklet');assert.equal(state.n,2);
  assert.equal(state.settings.titleText,'Аналоги ЕГЭ 2018 — тренировочный вариант');
  assert.equal(state.settings.titleFont,'serif');assert.equal(state.settings.titlePt,18);assert.equal(state.settings.showMeta,false);
  assert.equal(state.settings.theme,'academic');assert.equal(state.settings.titleColor,'#17334f');
  assert.deepEqual(state.sources.map(x=>x.kind),['bank','bank']);
  assert.equal(new Set(state.ids).size,2);
  const documentData=await page.evaluate(()=>{
   const f=document.querySelector('#qw-print-preview-frame'),doc=f.contentDocument;
   return {title:doc.querySelector('.qw-print-title')?.textContent,colors:getComputedStyle(doc.querySelector('.qw-print-title')).color,
    bodyFont:getComputedStyle(doc.body).fontFamily,
    brand:doc.querySelectorAll('.qw-booklet-brand').length,
    tasks:[...doc.querySelectorAll('.qw-print-section')].map(x=>x.dataset.task),
    meta:doc.querySelector('.qw-print-meta')?.textContent||'',
    warnings:[...doc.querySelectorAll('.qw-print-section')].some(x=>x.getBoundingClientRect().width<1)};
  });
  assert.equal(documentData.title,'Аналоги ЕГЭ 2018 — тренировочный вариант');
  assert.equal(documentData.meta,'');assert.equal(documentData.brand,1);
  assert.deepEqual(documentData.tasks,['1','2']);
  assert.equal(documentData.warnings,false);
  const formats=['booklet','compact','practice','worksheet'];
  const reports=[];
  for(const format of formats){
   const html=await page.evaluate(format=>qwPrintDocumentHTML({...qwDoc,layout:format},false,{format}),format);
   const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
   await p.setContent(html);await p.evaluate(()=>window.qwPrintReady);
   assert.equal(await p.evaluate(()=>window.__qwPrintError),undefined,format);
   const details=await p.evaluate(()=>({pages:window.__qwPrintLayout.pages.length,
    tasks:document.querySelectorAll('.qw-print-section').length,
    title:document.querySelector('.qw-print-title')?.textContent,
    mathFont:getComputedStyle(document.querySelector('math')).fontFamily,
    size:getComputedStyle(document.body).fontSize,
    remote:[...document.images].some(img=>img.src.startsWith('http'))}));
   assert.equal(details.tasks,2);assert.equal(details.title,state.settings.titleText);
   assert.ok(details.pages>=1&&details.pages<=3,format);
   assert.equal(details.remote,false);
   await p.emulateMedia({media:'print'});
   const pdf=path.join(out,format+'.pdf');await p.pdf({path:pdf,preferCSSPageSize:true,printBackground:true});
   assert.ok(fs.statSync(pdf).size>7000,format);
   if(format==='booklet')await p.screenshot({path:path.join(out,'booklet.png'),fullPage:true});
   reports.push({format,...details,pdfBytes:fs.statSync(pdf).size});await p.close();
  }
  const defaultTitle=await page.evaluate(()=>{
   const d=qwProject();d.tasks=[qwTask('short')];d.tasks[0].prompt='Найдите скорость';
   return qwPrintDocumentHTML(d,false,{format:'booklet'}).includes('class="qw-print-title">Новая работа');
  });
  assert.equal(defaultTitle,false,'placeholder title must not appear in PDF');
  const preserved=await page.evaluate(()=>{
   const data={format:'quantum-work-bank',version:1,items:qwBankRead()};
   return {years:data.items.map(x=>x.year),format:data.format,version:data.version,roundtrip:data.items.map(x=>qwBankNormalize(x).year)};
  });
  assert.deepEqual(preserved.roundtrip,['2018','2018','2020']);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  fs.writeFileSync(path.join(out,'bank-selection-report.json'),JSON.stringify({status:'PASS',reports,state,documentData,preserved},null,2));
  fs.writeFileSync(path.join(out,'selected.qwork'),JSON.stringify(await page.evaluate(()=>qwValidate(qwDoc)),null,2));
  console.log('PASS TASK154: 2018 bank filters, selected variant PDF, edited header, 4 print formats, offline');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
