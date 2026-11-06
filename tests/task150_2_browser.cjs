/* Same QWORK input, exact baseline HTML and real native PDF before/after. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),before=process.argv.includes('--before'),base=path.join(root,'evidence/task1502'),out=path.join(base,before?'before':'after');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true}),app=await browser.newPage(),errors=[];app.on('pageerror',e=>errors.push(e.message));
 try{
  await app.goto(pathToFileURL(process.env.QW_TASK1502_HTML||path.join(root,'Quantum-Office.html')).href);await app.evaluate(()=>route('writer'));
  const {task149PrintSamples}=await import('./fixtures/task149_4_samples.js');
  let d;if(before){d=task149PrintSamples()[0].project;d.title='Геометрия и координаты';d.topic='Углы, площади и координаты';d.tasks[15].prompt+=' Используйте формулу \\(S=\\frac{d_{1}d_{2}}{2}\\).';fs.writeFileSync(path.join(base,'input.qwork'),JSON.stringify(d,null,2));}else d=JSON.parse(fs.readFileSync(path.join(base,'input.qwork'),'utf8'));
  const reports=[];
  async function render(name,project,options={}){
   const generated=await app.evaluate(({project,options})=>{const state=JSON.stringify(project),html=qwPrintDocumentHTML(project,false,{format:'compact',...options});return{html,unchanged:state===JSON.stringify(project)};},{project,options});assert.ok(generated.unchanged);
   const p=await browser.newPage();p.on('pageerror',e=>errors.push(e.message));await p.setContent(generated.html);await p.evaluate(()=>window.qwPrintReady);assert.equal(await p.evaluate(()=>window.__qwPrintError),undefined,name);
   const measurement=await p.evaluate(()=>{
    const mm=96/25.4,pages=[...document.querySelectorAll('.qw-print-page')],rect=(e,p)=>{const a=e.getBoundingClientRect(),b=p.getBoundingClientRect();return{x:(a.x-b.x)/mm,y:(a.y-b.y)/mm,w:a.width/mm,h:a.height/mm};};
    const boxes=[],collisions=[],outside=[];
    for(const page of pages){const content=page.querySelector('.qw-page-content'),cb=content.getBoundingClientRect();
     for(const section of content.querySelectorAll(':scope>.qw-print-section')){
      const text=section.querySelector('.qw-task-text'),figure=section.querySelector('figure'),fb=figure?.getBoundingClientRect(),walker=document.createTreeWalker(text,NodeFilter.SHOW_TEXT);let node;
      while(node=walker.nextNode()){if(!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);if(fb)for(const r of range.getClientRects())if(Math.min(r.right,fb.right)-Math.max(r.left,fb.left)>.5&&Math.min(r.bottom,fb.bottom)-Math.max(r.top,fb.top)>.5)collisions.push(section.dataset.task);}
      for(const e of section.querySelectorAll('math,figure')){const r=e.getBoundingClientRect();if(r.left<cb.left-.8||r.right>cb.right+.8||r.top<cb.top-.8||r.bottom>cb.bottom+.8)outside.push(section.dataset.task);}
      boxes.push({task:+section.dataset.task,page:pages.indexOf(page)+1,box:rect(section,page),figure:figure?rect(figure,page):null});
     }
    }
    return {layout:window.__qwPrintLayout,boxes,collisions,outside,bodyPt:parseFloat(getComputedStyle(document.body).fontSize)*.75,
     headers:pages.map(p=>({page:pages.indexOf(p)+1,box:rect(p.querySelector('.qw-print-header,.qw-running-header'),p)})),
     brands:[...document.querySelectorAll('.qw-print-brand')].map(e=>({text:e.textContent,position:getComputedStyle(e).position,box:rect(e,e.closest('.qw-print-page'))})),
     topicColor:document.querySelector('.qw-print-topic')?getComputedStyle(document.querySelector('.qw-print-topic')).color:null,
     math:[...document.querySelectorAll('.qw-task-text math')].map(e=>({task:+e.closest('[data-task]').dataset.task,size:parseFloat(getComputedStyle(e).fontSize)*.75,box:rect(e,e.closest('.qw-print-page')),fraction:[...e.querySelectorAll('mfrac>mi,mfrac>mn,mfrac>mrow>mi')].map(n=>parseFloat(getComputedStyle(n).fontSize)*.75)})),
     english:[...document.querySelectorAll('.qw-print-page')].map(e=>e.innerText).join('\n').match(/Academic|Tech|Scientific|Minimal/g)||[],brandIcons:document.querySelectorAll('.qw-print-brand svg').length};
   });
   assert.deepEqual(measurement.collisions,[],name+' ink collision');assert.deepEqual(measurement.outside,[],name+' bounds');
   if(!before){
    assert.ok(Math.abs(measurement.bodyPt-10)<.001);assert.deepEqual(measurement.english,[]);assert.equal(measurement.brandIcons,0);
    if(project.topic)assert.equal(measurement.topicColor,options.monochrome?'rgb(34, 34, 34)':'rgb(180, 35, 24)');
    for(const b of measurement.brands){assert.equal(b.position,'absolute');assert.ok(b.box.y+b.box.h<=11,'brand outside 12mm content top');}
    assert.ok(measurement.math.every(m=>m.size>=measurement.bodyPt&&m.fraction.every(s=>s>=measurement.bodyPt-.01)),'full-size main fraction operands');
    if(options.theme){assert.equal(measurement.brands.length,measurement.layout.pages.length);assert.ok(measurement.brands.every(b=>b.text==='Квант Икс | QX'));}
   }
   await p.emulateMedia({media:'print'});await p.pdf({path:path.join(out,name+'.pdf'),preferCSSPageSize:true,printBackground:true});
   fs.writeFileSync(path.join(out,name+'.html'),await p.content());fs.writeFileSync(path.join(out,name+'.qwork'),JSON.stringify(project,null,2));reports.push({name,...measurement});await p.close();return measurement;
  }
  const standard=structuredClone(d);standard.topic='';await render('Compact',standard);await render('Unbranded',d);
  for(const theme of ['academic','scientific','minimal']){await render('QX-'+theme,d,{theme});await render('QX-'+theme+'-Answers',d,{theme,format:'answers'});}
  await render('QX-academic-BW',d,{theme:'academic',monochrome:true});
  const dense=structuredClone(d);dense.tasks=[...d.tasks,...structuredClone(d.tasks)];dense.tasks.forEach((q,i)=>q.id='density-'+i);await render('Dense-48',dense);
  // Owner's earlier review specimen deliberately had synthetic 8-task breaks.
  // Show it separately; the canonical same-input comparison above has none.
  const old=structuredClone(d);if(before)old.tasks.forEach((q,i)=>q.pageBreak=i===8||i===16);await render('Owner-Concept',old,{theme:'academic'});
  if(!before){
   const control=JSON.parse(fs.readFileSync(path.join(base,'before/report.json'),'utf8'));
   const current=reports.find(r=>r.name==='Compact'),previous=control.reports.find(r=>r.name==='Compact');
   assert.ok(current.layout.pages[0].tasks.length>previous.layout.pages[0].tasks.length,'more tasks on first compact page');
   assert.ok(current.layout.pages.length<=previous.layout.pages.length);assert.ok(current.layout.pages[0].freeMm<previous.layout.pages[0].freeMm);
   const plain=reports.find(r=>r.name==='Unbranded'),brand=reports.find(r=>r.name==='QX-academic');assert.deepEqual(plain.boxes,brand.boxes,'brand consumes zero task height');
   const explicit=structuredClone(d);explicit.tasks[8].pageBreak=true;
   const html=await app.evaluate(d=>qwPrintDocumentHTML(d,false,{format:'compact',theme:'academic'}),explicit),p=await browser.newPage();await p.setContent(html);await p.evaluate(()=>window.qwPrintReady);assert.equal(await p.locator('.qw-print-page').nth(1).locator('.qw-print-section').first().getAttribute('data-task'),'9','user-authored page break preserved');await p.close();
   assert.ok(reports.find(r=>r.name==='Owner-Concept').layout.pages.length<control.reports.find(r=>r.name==='Owner-Concept').layout.pages.length);
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'PASS',before,reports},null,2));console.log('PASS TASK150.2 '+(before?'baseline':'polish')+': '+reports.map(r=>r.name+' '+r.layout.pages.map(p=>p.tasks.length).join('+')).join(', '));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
