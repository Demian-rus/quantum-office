/* Native Chromium print pipeline: baseline/final format audit and opt-in QX concepts. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),before=process.argv.includes('--before'),out=process.env.QW_TASK150_EVIDENCE||path.join(root,'evidence/task150',before?'before':'after');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const {task149PrintSamples}=await import('./fixtures/task149_4_samples.js'),{task149CompactSamples}=await import('./fixtures/task149_3_samples.js');
 const compact=task149PrintSamples()[0].project,worksheet=task149CompactSamples()[0].project;
 const browser=await chromium.launch({headless:true}),app=await browser.newPage({acceptDownloads:true}),errors=[];app.on('pageerror',e=>errors.push(e.message));
 await app.goto(pathToFileURL(process.env.QW_TASK150_HTML||path.join(root,'Quantum-Office.html')).href);await app.evaluate(()=>route('writer'));await app.locator('[data-editor="writer"][data-tab="work"]').click();
 const reports=[];
 async function render(name,d,options={}){
  const generated=await app.evaluate(({d,options})=>{const before=JSON.stringify(d),html=qwPrintDocumentHTML(d,false,options);return{html,unchanged:JSON.stringify(d)===before};},{d,options}),html=generated.html;assert.ok(generated.unchanged,'export must preserve the actual input document');
  const p=await browser.newPage();await p.setContent(html);await p.evaluate(()=>window.qwPrintReady);assert.equal(await p.evaluate(()=>window.__qwPrintError),undefined,name);
  const r=await p.evaluate(()=>{
   const bounds=[],overlaps=[],pages=[...document.querySelectorAll('.qw-print-page')];
   for(const content of document.querySelectorAll('.qw-page-content')){const b=content.getBoundingClientRect();let bottom=b.top;
    for(const s of content.querySelectorAll(':scope>.qw-print-section')){const a=s.getBoundingClientRect();if(a.top<bottom-.5)overlaps.push(s.dataset.task);bottom=a.bottom;
     for(const e of s.querySelectorAll('math,figure,.qw-task-text,.qw-practice-space')){const a=e.getBoundingClientRect();if(a.left<b.left-1||a.right>b.right+1||a.bottom>b.bottom+1)bounds.push({task:s.dataset.task,tag:e.tagName});}
    }
   }
   return {layout:window.__qwPrintLayout,bounds,overlaps,text:document.body.innerText,math:document.querySelectorAll('math').length,svg:document.querySelectorAll('figure svg').length,
    textBoxes:[...document.querySelectorAll('.qw-task-text')].flatMap(e=>{
     const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){if(n.textContent.trim()&&!n.parentElement.closest('math'))break;}if(!n)return [];
     const range=document.createRange();range.setStart(n,0);range.setEnd(n,Math.min(12,n.textContent.length));const b=range.getClientRects()[0],p=e.closest('.qw-print-page'),pb=p.getBoundingClientRect(),ctx=document.createElement('canvas').getContext('2d');ctx.font=getComputedStyle(n.parentElement).font;
     return [{page:pages.indexOf(p),text:n.textContent.slice(0,12),x:(b.x-pb.x)*.75,y:(b.y-pb.y+ctx.measureText(n.textContent).fontBoundingBoxAscent)*.75}];}),
    tasks:[...document.querySelectorAll('.qw-print-section')].map(e=>Number(e.dataset.task)),bodyPt:parseFloat(getComputedStyle(document.body).fontSize)*.75};
  });assert.deepEqual(r.bounds,[],name+' bounds');assert.deepEqual(r.overlaps,[],name+' overlaps');
  fs.writeFileSync(path.join(out,name+'.html'),await p.content());fs.writeFileSync(path.join(out,name+'.qwork'),JSON.stringify(d,null,2));
  await p.emulateMedia({media:'print'});await p.pdf({path:path.join(out,name+'.pdf'),preferCSSPageSize:true,printBackground:true});
  if(!before){assert.ok(r.layout.pages.every(x=>x.tasks.length),name+' no empty pages');
   if(options.theme){assert.ok(r.text.includes('Квант Икс | QX'));assert.equal(r.layout.pages.length,options.format==='answers'?1:3,'comparable concept pages');}else assert.ok(!r.text.includes('Квант Икс | QX'),'branding is opt-in');
   const repeat=await browser.newPage();await repeat.setContent(html);await repeat.evaluate(()=>window.qwPrintReady);assert.deepEqual(await repeat.evaluate(()=>window.__qwPrintLayout),r.layout);await repeat.close();
  }
  reports.push({name,...r});await p.close();return r;
 }
 try{
  await render('Worksheet',worksheet,{format:'worksheet'});await render('Compact-24',compact,{format:'compact'});
  await render('Practice',task149PrintSamples()[2].project,{format:'practice'});await render('Answers',compact,{format:'answers'});await render('Legacy-Exam',worksheet,{format:'exam'});
  if(!before){
   // Exactly the same real tasks and explicit page breaks in every concept.
   const sample=structuredClone(compact);sample.title='Геометрия и координаты';sample.topic='Углы, площади и координаты';sample.tasks=structuredClone(compact.tasks);
   sample.tasks.forEach((q,i)=>q.pageBreak=i===8||i===16);sample.tasks[15].prompt+=' Используйте формулу \\(S=\\frac{d_{1}d_{2}}{2}\\).';
   for(const theme of ['academic','scientific','minimal'])for(const monochrome of [false,true]){
    const name='QX-'+theme+(monochrome?'-BW':'');await render(name,sample,{format:'compact',theme,monochrome});await render(name+'-Answers',sample,{format:'answers',theme,monochrome});
   }
   const long=structuredClone(worksheet);long.tasks=long.tasks.slice(0,1);long.tasks[0].prompt=('Измерения повторяют через равные интервалы времени. Используйте формулу \\(s=vt\\). ').repeat(120);await render('Long-Flow',long,{format:'worksheet'});
   assert.equal(reports.find(x=>x.name==='Compact-24').tasks.length,24);assert.equal(reports.find(x=>x.name==='Compact-24').layout.pages.length,2,'no orphan last task in reference material');
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'PASS',before,reports},null,2));
  console.log('PASS TASK150 '+(before?'baseline':'layout/concepts')+': '+reports.map(r=>r.name+' '+r.layout.pages.map(p=>p.tasks.length).join('+')).join(', '));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
