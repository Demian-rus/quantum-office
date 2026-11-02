const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1720,height:950},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
 await page.evaluate(()=>route('writer'));
 await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
 await page.locator('[data-qd-action="sample"]').click();
 await page.evaluate(()=>{
   const d=qdDoc();
   d.students=[{id:'st-one',name:'Тестовый ученик'},{id:'st-two',name:'Другой ученик'}];
   const make=(id,studentId,date,percentage,topic)=>{
     const q=qdQuestionList(d),marks={};
     marks[q[0].id]='yes';
     return {id,studentId,date,student:studentId==='st-one'?'Тестовый ученик':'Другой ученик',
       title:d.title,marks,responses:{},
       summary:{rated:4,total:4,yes:2,no:2,partial:0,earned:percentage/25,possible:4,percent:percentage},
       topics:[{name:d.sections[0].title,rated:4,total:4,percent:topic},
         {name:d.sections[1].title,rated:3,total:3,percent:percentage}]
     };
   };
   d.history=[make('test-old','st-one','2026-10-01T10:00:00Z',50,25),
     make('other-pupil','st-two','2026-10-03T10:00:00Z',100,100),
     make('test-new','st-one','2026-11-01T10:00:00Z',75,75)];
   qdStore();qdRefresh();
 });
 await page.locator('[data-qd-action="mode"][data-mode="run"]').first().click();
 await page.locator('[data-qd-action="view"][data-view="list"]').click();
 await page.locator('[data-qd-field="history-filter"]').selectOption('st-one');
 const progress=page.locator('#qd-history-progress');
 assert.equal(await progress.count(),1);
 assert.match(await progress.textContent(),/Динамика занятий/);
 assert.match(await progress.textContent(),/50% → 75%/);
 assert.match(await progress.textContent(),/\+25 п.п./);
 assert.equal(await progress.locator('.qd-progress-trend-item').count(),2);
 assert.equal(await progress.getByText('Другой ученик').count(),0);
 await progress.locator('[data-qd-field="history-compare-from"]').selectOption('test-new');
 const comparison=await page.evaluate(()=>({
   from:document.querySelector('[data-qd-field="history-compare-from"]')?.value,
   to:document.querySelector('[data-qd-field="history-compare-to"]')?.value,
   text:document.getElementById('qd-history-progress').textContent
 }));
 assert.notEqual(comparison.from,comparison.to,'comparison should not pair an entry with itself');
 assert.match(comparison.text,/п.п./);
 const promise=page.waitForEvent('download');
 await progress.locator('[data-qd-action="progress-export"]').click();
 const download=await promise;assert.match(download.suggestedFilename(),/динамика\.csv$/);
 const filename=path.join(root,'task114-student-history.csv');await download.saveAs(filename);
 const csv=fs.readFileSync(filename,'utf8');
 assert.match(csv,/Молекулы/);
 assert.ok(!csv.includes('Другой ученик'));
 fs.rmSync(filename,{force:true});
 await page.reload();await page.evaluate(()=>route('writer'));
 await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
 await page.locator('[data-qd-action="mode"][data-mode="run"]').first().click();
 await page.locator('[data-qd-action="view"][data-view="list"]').click();
 await page.locator('[data-qd-field="history-filter"]').selectOption('st-one');
 assert.equal(await page.locator('.qd-progress-trend-item').count(),2,'history persists in saved Writer document');
 await page.setViewportSize({width:390,height:820});
 const mobile=await page.evaluate(()=>({
   viewport:document.documentElement.clientWidth,
   width:document.documentElement.scrollWidth
 }));
 assert.ok(mobile.width<=mobile.viewport+4,'history must fit phone viewport');
 assert.deepEqual(errors,[]);
 console.log('PASS TASK114: distinct student history, selectable comparison, CSV export, persistence and responsive chart');
 await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1);});