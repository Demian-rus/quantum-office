const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1920,height:960},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
 await page.evaluate(()=>route('writer'));
 await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
 await page.locator('[data-qd-action="sample"]').click();
 await page.evaluate(()=>{
   const d=qdDoc(),topic=(name,percent,rated=3)=>({name,percent,rated,total:3});
   const make=(id,studentId,date,percent,topics)=>({
     id,studentId,date,student:studentId==='a'?'Анна':studentId==='b'?'Борис':'Света',
     title:'Физика',marks:{},responses:{},
     summary:{yes:3,partial:0,no:1,rated:6,total:6,percent},topics
   });
   d.students=[{id:'a',name:'Анна'},{id:'b',name:'Борис'},{id:'c',name:'Света'}];
   d.history=[
     make('a','a','2026-11-02T10:00:00Z',65,[
       topic('Температура',40),topic('Теплопередача',80),
       ...Array.from({length:7},(_,i)=>topic('Дополнительная тема '+(i+1),55))]),
     make('b-old','b','2026-10-01T10:00:00Z',80,[topic('Температура',90)]),
     make('b','b','2026-11-02T09:00:00Z',55,[
       topic('Температура',30),topic('Теплопередача',20)]),
     make('c','c','2026-11-02T11:00:00Z',90,[
       topic('Температура',0,0),topic('Теплопередача',95)])
   ];
   qdStore();qdRefresh();
 });
 await page.locator('[data-qd-action="mode"][data-mode="run"]').first().click();
 await page.locator('[data-qd-action="view"][data-view="list"]').click();
 const panel=page.locator('#qd-group-journal');
 const plan=panel.locator('.qd-topic-plan');
 assert.equal(await plan.count(),1);
 assert.equal(await plan.locator('.qd-topic-plan-card').count(),6);
 await plan.locator('[data-qd-action="group-topics-expand"]').click();
 assert.equal(await plan.locator('.qd-topic-plan-card').count(),9);
 const heat=plan.locator('[data-qd-action="group-topic"]', {hasText:'Теплопередача'});
 await heat.click();
 assert.equal(await panel.locator('tbody tr').count(),1,'topic filters pupils with a weak last score');
 assert.match(await panel.locator('tbody').textContent(),/Борис/);
 assert.equal(await heat.getAttribute('aria-pressed'),'true');
 const promise=page.waitForEvent('download');
 await plan.locator('[data-qd-action="group-topics-export"]').click();
 const artifact=await promise;
 assert.match(artifact.suggestedFilename(),/темы-группы\.csv$/);
 const file=path.join(root,'task116-topic-plan.csv');await artifact.saveAs(file);
 const csv=fs.readFileSync(file,'utf8');
 assert.match(csv,/Температура/);assert.match(csv,/Теплопередача/);
 assert.match(csv,/Борис/);fs.rmSync(file,{force:true});
 await heat.click();
 assert.equal(await panel.locator('tbody tr').count(),3,'second click removes the topic filter');
 await plan.locator('[data-qd-action="group-topics-expand"]').click();
 assert.equal(await plan.locator('.qd-topic-plan-card').count(),6);
 await page.setViewportSize({width:390,height:820});
 const dimensions=await page.evaluate(()=>({
   viewport:document.documentElement.clientWidth,width:document.documentElement.scrollWidth
 }));
 assert.ok(dimensions.width<=dimensions.viewport+4,'topic cards may not stretch mobile page');
 assert.deepEqual(errors,[]);
 console.log('PASS TASK116: topic counts, expand, filter, CSV and mobile layout');
 await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1);});
