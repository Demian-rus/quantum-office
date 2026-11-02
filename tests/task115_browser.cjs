const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
 const root=path.resolve(__dirname,'..');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1800,height:960},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
 await page.evaluate(()=>route('writer'));
 await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
 await page.locator('[data-qd-action="sample"]').click();
 await page.evaluate(()=>{
   const d=qdDoc(),make=(id,studentId,date,percent,topicPct,total)=>({
     id,studentId,date,student:studentId==='one'?'Первый ученик':'Второй ученик',
     title:'Диагностика',marks:{},responses:{},
     summary:{yes:1,partial:0,no:0,rated:total,total,percent},
     topics:[{name:'Температура и внутренняя энергия',rated:3,total:3,percent:topicPct},
             {name:'Теплопередача и теплоёмкость',rated:3,total:3,percent}]
   });
   d.students=[{id:'one',name:'Первый ученик'},{id:'two',name:'Второй ученик'},
     {id:'three',name:'Третий без результатов'}];
   d.history=[
     make('late','one','2026-11-01T12:00:00Z',85,50,8),
     make('early','one','2026-10-01T12:00:00Z',55,35,8),
     make('other','two','2026-10-25T12:00:00Z',45,20,8)
   ];
   qdStore();qdRefresh();
 });
 await page.locator('[data-qd-action="mode"][data-mode="run"]').first().click();
 await page.locator('[data-qd-action="view"][data-view="list"]').click();
 const panel=page.locator('#qd-group-journal');
 assert.equal(await panel.count(),1);
 assert.equal(await panel.locator('tbody tr').count(),3);
 assert.match(await panel.textContent(),/Сводка по ученикам/);
 assert.match(await panel.textContent(),/85%/);
 assert.match(await panel.textContent(),/\+30 п.п./);
 assert.match(await panel.textContent(),/Температура и внутренняя энергия/);
 assert.match(await panel.textContent(),/Третий без результатов/);
 await panel.locator('[data-qd-action="group-filter"][data-filter="attention"]').click();
 assert.equal(await panel.locator('tbody tr').count(),2,'attention should show two flagged pupils');
 const promise=page.waitForEvent('download');
 await panel.locator('[data-qd-action="group-export"]').click();
 const download=await promise;
 assert.match(download.suggestedFilename(),/ученики\.csv$/);
 const filename=path.join(root,'task115-group.csv');await download.saveAs(filename);
 const csv=fs.readFileSync(filename,'utf8');
 assert.match(csv,/Первый ученик/);
 assert.match(csv,/Второй ученик/);
 assert.ok(!csv.includes('Третий без результатов'),'CSV respects active group filter');
 fs.rmSync(filename,{force:true});
 await panel.locator('[data-qd-action="group-open-student"][data-student="one"]').click();
 assert.equal(await page.locator('#qd-group-journal').count(),0);
 assert.equal(await page.locator('#qd-history-progress').count(),1,'personal history opens from group');
 assert.equal(await page.locator('[data-qd-field="history-filter"]').inputValue(),'one');
 await page.locator('[data-qd-field="history-filter"]').selectOption('');
 assert.equal(await page.locator('#qd-group-journal').count(),1);
 await page.reload();await page.evaluate(()=>route('writer'));
 await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
 await page.locator('[data-qd-action="mode"][data-mode="run"]').first().click();
 await page.locator('[data-qd-action="view"][data-view="list"]').click();
 assert.equal(await page.locator('#qd-group-journal tbody tr').count(),3,'saved group data survives reload');
 await page.setViewportSize({width:390,height:820});
 const mobile=await page.evaluate(()=>({
   viewport:document.documentElement.clientWidth,
   width:document.documentElement.scrollWidth
 }));
 assert.ok(mobile.width<=mobile.viewport+4,'journal must not overflow page on phones');
 assert.deepEqual(errors,[]);
 console.log('PASS TASK115: group snapshot, active filter, CSV, personal history, persistence and mobile');
 await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1);});