const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1600,height:920},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(pathToFileURL(path.resolve(__dirname,'../Quantum-Office.html')).href);
 // Synthetic teacher book; no personal records are committed.
 const bookId=await page.evaluate(()=>{
   const b=newWorkbook(),s=b.sheets[0];
   b.name='Учебный график';s.name='Ученики';
   s.cells['A1']={value:'Ученик'};s.cells['B1']={value:'Ссылка'};s.cells['C1']={value:'Информация'};
   s.cells['D1']={value:'Родитель'};s.cells['E1']={value:'Ссылка'};
   s.hyperlinks={B2:'https://example.org/profile'};
   for(let n=2;n<=12;n++){
     s.cells['A'+n]={value:'Тестовый ученик '+n};
     s.cells['C'+n]={value:(n%2?'Физика':'Математика')+', 8 класс'};
   }
   workspace.books.unshift(b);workspace.active=b.id;page='sheet';activeCell='A2';
   persist();render();return b.id;
 });
 assert.equal(await page.locator('.qo-hub-sheet-trigger').count(),1);
 await page.locator('[data-hub-action="toggle"]').click();
 assert.match(await page.locator('#qo-hub-sheet-panel').textContent(),/Связать текущий лист/);
 await page.locator('[data-hub-action="connect"]').click();
 assert.match(await page.locator('#qo-hub-sheet-panel').textContent(),/11 учеников/);
 const summary=await page.evaluate(()=>({rows:qoHubRoster().length,bookId:qoHubSource()?.bookId,
   contacts:qoHubRoster()[0].studentUrl}));
 assert.equal(summary.rows,11,'must include A10–A12, not only A2–A9');
 assert.equal(summary.bookId,bookId);
 assert.ok(summary.contacts.includes('example.org'));
 // Do not create separate worksheets; link selected person into diagnostics.
 await page.locator('[data-hub-action="open-diagnostic"]').click();
 const selection=await page.evaluate(()=>({selected:qdDoc().session.student,
   profiles:qdDoc().students.length,sheets:workspace.books[0].sheets.length,
   mode:qdMode,tab:qoWorkspaceTab.writer}));
 assert.equal(selection.selected,'Тестовый ученик 2');
 assert.equal(selection.profiles,1);
 assert.equal(selection.sheets,1);
 assert.equal(selection.mode,'run');
 assert.equal(selection.tab,'diagnostic');
 assert.equal(await page.locator('.qo-hub-roster').count(),1);
 // Save a score, then return to the same workbook row and find global history.
 await page.evaluate(()=>{
   const d=qdDoc(),q=qdQuestionList(d)[0];
   d.sections[0].questions[0].prompt='Задача на тему';
   d.session.marks[q.id]='yes';
   qdRefresh();
 });
 await page.locator('[data-qd-action="view"][data-view="list"]').click();
 await page.locator('[data-qd-action="save-result"]').first().click();
 const entry=await page.evaluate(()=>({global:qoHubResults().length,
   source:qoHubResults()[0]?.studentKey,docHistory:qdDoc().history.length}));
 assert.equal(entry.global,1);
 assert.equal(entry.docHistory,1);
 await page.evaluate(()=>{page='sheet';workspace.active=bookId;activeCell='A2';render();});
 if(!(await page.locator('#qo-hub-sheet-panel').isVisible()))await page.locator('[data-hub-action="toggle"]').click();
 assert.match(await page.locator('#qo-hub-sheet-panel').textContent(),/История диагностик/);
 assert.match(await page.locator('#qo-hub-sheet-panel').textContent(),/100%/);
 assert.equal(await page.locator('.grid-cell[data-ref="A2"] .qo-hub-cell-badge').count(),1);
 const csvDownload=page.waitForEvent('download');
 await page.locator('[data-hub-action="export-csv"]').click();
 const download=await csvDownload;assert.match(download.suggestedFilename(),/\.csv$/);
 // A new diagnosis contributes to the same central journal, without any new sheet.
 await page.evaluate(()=>{
   qoWorkspaceTab.writer='diagnostic';route('writer');qdMode='run';
   const d=qdDoc(),student=qdAddStudent(d,'Тестовый ученик 2');
   d.session.studentId=student.id;d.session.student=student.name;
   d.title='Вторая диагностика';
   d.session.marks[qdQuestionList(d)[0].id]='partial';
   qdRefresh();
 });
 await page.locator('[data-qd-action="view"][data-view="list"]').click();
 await page.locator('[data-qd-action="save-result"]').first().click();
 const stats=await page.evaluate(()=>({
   count:qoHubStudentResults(qoHubRoster()[0].id).length,
   sheets:workspace.books.find(b=>b.id===qoHubSource().bookId).sheets.length
 }));
 assert.equal(stats.count,2);
 assert.equal(stats.sheets,1);
 // Check direct roster pick from a different student and search.
 await page.locator('[data-hub-action="roster-toggle"]').click();
 await page.locator('#qo-hub-search').fill('ученик 12');
 assert.equal(await page.locator('.qo-hub-roster-row').count(),1);
 await page.locator('.qo-hub-roster-row [data-hub-action="select"]').click();
 assert.equal(await page.evaluate(()=>qdDoc().session.student),'Тестовый ученик 12');
 await page.reload();await page.evaluate(()=>route('sheet'));
 assert.equal(await page.evaluate(()=>qoHubRoster().length),11,'source remains connected after reload');
 assert.equal(await page.evaluate(()=>qoHubResults().length),2,'global journal remains after reload');
 for(const width of [1600,1100,650,390]){
   await page.setViewportSize({width,height:850});
   await page.evaluate(()=>{qoHubOpen=true;qoHubDecorate();});
   const m=await page.evaluate(()=>{
     const panel=document.querySelector('#qo-hub-sheet-panel')?.getBoundingClientRect();
     return {scrollWidth:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,
       panel:panel?{left:panel.left,right:panel.right}:null};
   });
   assert.ok(m.scrollWidth<=m.viewport+4,'no horizontal overflow at '+width);
   assert.ok(m.panel.left>=0&&m.panel.right<=m.viewport+1,'sidebar fits screen at '+width);
 }
 assert.deepEqual(errors,[]);
 console.log('PASS TASK122: QBOOK roster 11 rows, contacts, diagnostic reuse, global ledger, sheet badges, CSV and reload');
 await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1);});
