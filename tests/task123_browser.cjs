const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1500,height:900},acceptDownloads:true});
 const errors=[];page.on('pageerror',err=>errors.push(err.message));
 page.on('dialog',d=>d.accept());
 await page.goto(pathToFileURL(path.resolve(__dirname,'../Quantum-Office.html')).href);
 const source=await page.evaluate(()=>{
   const b=newWorkbook(),s=b.sheets[0];
   b.name='Синтетическая книга';s.name='Ученики';s.cells.A1={value:'Ученики'};
   s.cells.A2={value:'Пробный ученик'};s.cells.C2={value:'8 класс. Физика'};
   s.hyperlinks={B2:'https://example.org/teacher'};
   workspace.books.unshift(b);workspace.active=b.id;page='sheet';activeCell='A2';persist();render();
   qoHubAttachCurrent();
   return {id:b.id,sheet:s.id};
 });
 assert.equal(await page.locator('[data-hub-action="connect"]:enabled').count(),0);
 assert.deepEqual(await page.evaluate(()=>Object.keys(QD_SUBJECTS)),
   ['physics','math','informatics'],'no unrelated subjects in shared selector source');
 const stats=await page.evaluate(()=>{
   const result=qoHubSaveOne({id:'test-exam-1',student:'Пробный ученик',title:'Механика',
     date:'2026-11-03T12:00:00Z',
     summary:{percent:80,earned:4,possible:5,rated:2,total:3},
     topics:[{name:'Силы',percent:80,rated:2,total:3}]});
   return {result,count:qoHubResults().length,book:workspace.books.length};
 });
 assert.equal(stats.result.ok,true);
 assert.equal(stats.count,1);
 await page.locator('[data-hub-action="toggle"]').click();
 assert.equal(await page.locator('[data-hub-action="project-export"]').count(),1);
 assert.equal(await page.locator('[data-hub-action="project-import"]').count(),1);
 assert.match(await page.locator('.qo-hub-overview').textContent(),/80%/);
 const downloadPromise=page.waitForEvent('download');
 await page.locator('[data-hub-action="project-export"]').click();
 const file=await downloadPromise;assert.match(file.suggestedFilename(),/\.qteacher$/);
 const filePath=path.resolve(__dirname,'../task123-test.qteacher');await file.saveAs(filePath);
 const fs=require('node:fs');
 const raw=fs.readFileSync(filePath,'utf8');
 const data=JSON.parse(raw);
 assert.equal(data.format,'quantum-office-teacher-project-v1');
 assert.equal(data.results.length,1);
 assert.equal(data.book.id,source.id);
 assert.ok(data.book.sheets[0].hyperlinks.B2.includes('example.org'));
 const bad=await page.evaluate(()=>{
   try{qoHubValidatedPackage(JSON.stringify({format:'evil',version:1}));return false;}
   catch(_){return true;}
 });
 assert.equal(bad,true);
 await page.locator('[data-hub-action="project-import"]').click();
 await page.locator('#qo-hub-project-file').setInputFiles(filePath);
 await page.waitForFunction(id=>qoHubSource()?.bookId!==id,source.id);
 const restoration=await page.evaluate(()=>({
    sheets:qoHubSourceSheet().book.sheets.length,
    students:qoHubRoster().length,
    results:qoHubScopedResults(qoHubSourceSheet()).length,
    names:workspace.books.map(x=>x.name),
    backupIsSeparate:workspace.books.some(x=>x.id!==qoHubSource().bookId&&x.name==='Синтетическая книга')
 }));
 assert.equal(restoration.students,1);
 assert.equal(restoration.results,1);
 assert.equal(restoration.backupIsSeparate,true);
 // The original source and journal also remain untouched.
 assert.equal(await page.evaluate(()=>qoHubResults().length),2);
 await page.reload();await page.evaluate(()=>route('sheet'));
 assert.equal(await page.evaluate(()=>qoHubRoster().length),1);
 assert.equal(await page.evaluate(()=>qoHubResults().length),2);
 // The three subjects are rendered consistently in library and bank.
 await page.evaluate(()=>route('writer'));
 await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
 await page.locator('[data-qd-action="mode"][data-mode="library"]').click();
 const choices=await page.locator('#qd-library-subject option').allTextContents();
 assert.deepEqual(choices,['Все предметы','Физика','Математика','Информатика']);
 await page.locator('[data-qd-action="mode"][data-mode="builder"]').click();
 await page.locator('[data-qd-action="bank-open"]').click();
 const bankChoices=await page.locator('#qd-bank-subject option').allTextContents();
 assert.deepEqual(bankChoices,['Все предметы','Физика','Математика','Информатика']);
 const builderChoices=await page.locator('#qd-builder-template-subject option').allTextContents();
 assert.deepEqual(builderChoices,['Физика','Математика','Информатика']);
 for(const width of [1500,900,390]){
   await page.setViewportSize({width,height:820});
   const w=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);
   assert.ok(w[0]<=w[1]+4,'horizontal overflow at '+width);
 }
 fs.rmSync(filePath,{force:true});
 assert.deepEqual(errors,[]);
 console.log('PASS TASK123: 3 subject choices, one-file QBOOK+journal backup, restore, reload and mobile');
 await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1);});