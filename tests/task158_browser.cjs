/* TASK158: first physical sheet title, symmetrical columns, one QX badge, two modes only. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task158');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const errors=[];
 try{
  const app=await browser.newPage({viewport:{width:1520,height:950}});
  app.on('pageerror',e=>errors.push(e.message));
  await app.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  const project=await app.evaluate(()=>{
   const d=qwProject();d.layout='booklet';d.title='Физика. Авторские задания';
   d.variant='1';d.grade='11';
   d.printSettings={fontPt:10,figurePosition:'auto',topicHeadings:false,orientation:'landscape',
    landscapeLayout:'wide',showTitle:true,titleText:'Физика. Тренировочный вариант — модель 2018',
    showMeta:false,showVariant:true,showPageNumbers:true,theme:'academic',monochrome:false};
   d.tasks=Array.from({length:32},(_,i)=>{
    const q=qwTask(i>=27?'extended':'short');
    q.prompt='Задание '+(i+1)+'. На рисунке показана модель физического процесса. '+(
     'Исследуйте изменение величин, установите характер зависимости и укажите результаты анализа. ');
    q.answer=String(i+1);q.answerVisible=i<27;
    if(i%6===0){q.figure='graph';q.graph=qwGraphDefault();q.graph.points=[{x:0,y:1,label:'A'},{x:2,y:3,label:'B'},{x:4,y:6,label:'C'}];}
    if(i%6===3){q.figure='diagram';q.diagram=[{kind:'ground',x:90,y:240,x2:440,y2:240,label:''},{kind:'block',x:200,y:170,x2:300,y2:240,label:'m'}];}
    return q;
   });
   return qwValidate(d);
  });
  const html=await app.evaluate(p=>qwPrintDocumentHTML(p,false,{format:'booklet'}),project);
  const p=await browser.newPage({viewport:{width:1520,height:1000}});
  p.on('pageerror',e=>errors.push(e.message));
  await p.setContent(html);await p.evaluate(()=>window.qwPrintReady);
  const data=await p.evaluate(()=>{
   const sheets=[...document.querySelectorAll('.qw-print-sheet')],pages=[...document.querySelectorAll('.qw-print-page')],
    tasks=[...document.querySelectorAll('.qw-print-section')],brand=sheets[0].querySelector(':scope > .qw-print-brand'),
    head=sheets[0].querySelector(':scope > .qw-shared-sheet-header'),spans=[...document.querySelectorAll('.qw-running-header')],violations=[];
   for(const task of tasks){
    const b=task.getBoundingClientRect(),area=task.closest('.qw-print-page').querySelector('.qw-page-content').getBoundingClientRect();
    if(b.left<area.left-1||b.right>area.right+1||b.bottom>area.bottom+1)violations.push(task.dataset.task);
   }
   const sheet=sheets[0].getBoundingClientRect(),h=head?.getBoundingClientRect(),first=pages[0],second=pages[1],
    f1=first.querySelector('.qw-print-section')?.getBoundingClientRect(),
    f2=second.querySelector('.qw-print-section')?.getBoundingClientRect();
   return {layout:window.__qwPrintLayout.layout,physical:window.__qwPrintLayout.sheets,logical:window.__qwPrintLayout.pages.length,
    sheets:sheets.length,pages:pages.length,taskIds:tasks.map(t=>Number(t.dataset.task)),violations,
    headingCount:document.querySelectorAll('.qw-shared-sheet-header').length,headerOnFirstSheet:!!head,
    headerOnLaterSheets:sheets.slice(1).some(s=>s.querySelector('.qw-shared-sheet-header')),
    headerHorizontalMargins:h?[h.left-sheet.left,sheet.right-h.right]:null,
    headerBottom:h?.bottom,firstTaskTop:f1?.top,secondTaskTop:f2?.top,firstColumnsPadding:[
      getComputedStyle(first.querySelector('.qw-page-content')).paddingTop,
      getComputedStyle(second.querySelector('.qw-page-content')).paddingTop],
    brandCounts:sheets.map(s=>s.querySelectorAll(':scope > .qw-print-brand').length),
    brandText:brand?.querySelector('svg[aria-label]')?.getAttribute('aria-label'),brandColor:brand?getComputedStyle(brand.querySelector('path')).fill:'',
    brandBg:brand?getComputedStyle(brand).backgroundColor:'',
    brandClip:brand?getComputedStyle(brand).clipPath:'',
    badgeFlush:brand?{top:brand.getBoundingClientRect().top-sheet.top,right:sheet.right-brand.getBoundingClientRect().right}:null,
    duplicatedBrandInColumn:!!document.querySelector('.qw-print-page .qw-print-brand'),
    stripes:[...pages].some(page=>getComputedStyle(page,'::before').display!=='none'),
    runningHeaders:spans.length,sheetWidth:sheet.width,sheetHeight:sheet.height,err:window.__qwPrintError||null};
  });
  assert.equal(data.err,null);assert.equal(data.layout,'spread');
  assert.ok(data.sheets>=2,'should exercise the first and later sheets');
  assert.equal(data.physical,data.sheets);assert.equal(data.pages,data.logical);
  assert.deepEqual([...new Set(data.taskIds)],Array.from({length:32},(_,i)=>i+1));
  assert.deepEqual(data.violations,[]);
  assert.equal(data.headingCount,1);assert.equal(data.headerOnFirstSheet,true);assert.equal(data.headerOnLaterSheets,false);
  assert.ok(Math.abs(data.headerHorizontalMargins[0]-data.headerHorizontalMargins[1])<1.5,'heading must be centered on physical A4');
  assert.ok(data.firstTaskTop>=data.headerBottom-1&&data.secondTaskTop>=data.headerBottom-1,'both columns start below shared heading');
  assert.ok(Math.abs(data.firstTaskTop-data.secondTaskTop)<2,'first sheet columns must share top baseline');
  assert.equal(data.firstColumnsPadding[0],data.firstColumnsPadding[1]);
  assert.ok(data.brandCounts.every(count=>count===1),'one QX brand per physical A4 sheet');
  assert.equal(data.duplicatedBrandInColumn,false);
  assert.equal(data.brandText,'QX | Квант Икс');
  assert.equal(data.brandColor,'rgb(156, 255, 0)');
  assert.equal(data.brandBg,'rgba(0, 0, 0, 0)');
  assert.equal(data.brandClip,'none','handwritten signature has no geometric badge');
  assert.ok(data.badgeFlush.top>0&&data.badgeFlush.right>0,'handwritten signature is inset at bottom-right');
  assert.equal(data.stripes,false);assert.equal(data.runningHeaders,0);
  assert.ok(data.sheetWidth>data.sheetHeight);
  await p.emulateMedia({media:'print'});
  const pdf=path.join(out,'canonical-spread.pdf');
  await p.pdf({path:pdf,preferCSSPageSize:true,printBackground:true});
  assert.ok(fs.statSync(pdf).size>10000);
  await p.screenshot({path:path.join(out,'canonical-spread.png'),fullPage:true});
  await p.close();

  await app.evaluate(d=>{qwDoc=d;qwPersist();qwRender();qwPreview();},project);
  assert.equal(await app.locator('[data-print-setting="landscapeLayout"]').count(),0,'deprecated wide selector must not exist');
  assert.equal(await app.locator('[data-print-setting="orientation"]').inputValue(),'landscape');
  await app.locator('[data-print-setting="orientation"]').selectOption('portrait');
  await app.waitForFunction(()=>{
   const f=document.querySelector('#qw-print-preview-frame');
   return f?.contentDocument?.body?.dataset.qwOrientation==='portrait'&&f.dataset.ready;
  });
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'PASS',...data,pdfBytes:fs.statSync(pdf).size},null,2));
  console.log('PASS TASK158: shared title and equal columns, one physical QX, portrait toggle, no wide selector');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
