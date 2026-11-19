/* TASK155: native offline Chromium A4 rotation and PDF preview regression. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task155');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 const app=await browser.newPage({viewport:{width:1500,height:960}}),errors=[];
 app.on('pageerror',e=>errors.push(e.message));
 try{
  await app.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  const project=await app.evaluate(()=>{
   const d=qwProject();d.layout='booklet';d.grade='11';d.title='Авторский набор';d.printSettings={
    ...qwPrintSettings(),fontPt:10,orientation:'portrait',showTitle:true,titleText:'Физика — модель 2018',theme:'minimal'};
   d.tasks=Array.from({length:16},(_,i)=>{
    const t=qwTask('short');t.prompt='Авторская проверочная задача '+(i+1)+'. На поверхности без трения тело движется равномерно. Определите путь за 12 с при скорости 4 м/с. Расчёт выполните в СИ.';
    t.answer='48';t.answerVisible=true;
    if(i%4===0){t.figure='graph';t.graph=qwGraphDefault();t.graph.points=[{x:0,y:1,label:''},{x:5,y:4,label:''},{x:10,y:7,label:''}];}
    if(i%4===1){t.figure='diagram';t.diagram=[{kind:'ground',x:90,y:240,x2:450,y2:240,label:''},{kind:'block',x:200,y:170,x2:300,y2:240,label:'m'}];}
    return t;
   });
   return qwValidate(d);
  });
  const render=async orientation=>{
   const input=JSON.parse(JSON.stringify(project));input.printSettings.orientation=orientation;
   const html=await app.evaluate(p=>qwPrintDocumentHTML(p,false,{format:'booklet'}),input);
   const p=await browser.newPage();
   p.on('pageerror',e=>errors.push(e.message));
   await p.setContent(html);await p.evaluate(()=>window.qwPrintReady);
   const info=await p.evaluate(()=>{
    const pages=[...document.querySelectorAll('.qw-print-page')],parts=[...document.querySelectorAll('.qw-print-section')],first=pages[0].getBoundingClientRect(),overflow=[];
    for(const part of parts){
      const bb=part.getBoundingClientRect(),cc=part.closest('.qw-print-page').querySelector('.qw-page-content').getBoundingClientRect();
      if(bb.right>cc.right+1||bb.left<cc.left-1||bb.bottom>cc.bottom+1)overflow.push(part.dataset.task);
    }
    return {pages:pages.length,taskIds:parts.map(x=>x.dataset.task),width:first.width,height:first.height,mode:document.body.dataset.qwOrientation,
     overflow,ready:!window.__qwPrintError,images:[...document.images].filter(i=>!i.complete).length};
   });
   assert.equal(info.mode,orientation);
   assert.equal(info.ready,true);assert.equal(info.taskIds.length,16);assert.deepEqual(info.overflow,[]);
   assert.equal(info.width>info.height,orientation==='landscape');
   assert.equal(info.images,0);
   await p.emulateMedia({media:'print'});
   const pdf=path.join(out,orientation+'.pdf');await p.pdf({path:pdf,preferCSSPageSize:true,printBackground:true});
   assert.ok(fs.statSync(pdf).size>10000);
   await p.screenshot({path:path.join(out,orientation+'.png'),fullPage:true});
   await p.close();
   return {...info,pdfBytes:fs.statSync(pdf).size};
  };
  const portrait=await render('portrait'),landscape=await render('landscape');
  await app.evaluate(p=>{qwDoc=p;qwPersist();qwRender();qwPreview();},project);
  assert.equal(await app.locator('[data-print-setting="orientation"]').inputValue(),'portrait');
  await app.locator('[data-print-setting="orientation"]').selectOption('landscape');
  const actual=await app.evaluate(()=>qwDoc.printSettings.orientation);
  assert.equal(actual,'landscape','selection must persist');
  await app.waitForFunction(()=>{
   const frame=document.querySelector('#qw-print-preview-frame');
   return frame?.contentDocument?.body?.dataset.qwOrientation==='landscape'&&frame.dataset.ready;
  });
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'PASS',portrait,landscape,ui:actual},null,2));
  console.log('PASS TASK155: A4 portrait+landscape, CSS page sizes, 16 tasks and live UI setting');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
