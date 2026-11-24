/* Visual parity gates on real Windows WebView2 + independent browser. No production debug IPC. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
async function browserReference(){
 try{return await chromium.launch({channel:'msedge',headless:true});}
 catch(e){console.log('Edge reference unavailable; using installed Chromium:',e.message);return chromium.launch({headless:true});}
}
async function viewport(page){return page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));}
async function gridMetrics(page){
 await page.waitForFunction(()=>document.querySelector('.grid-cell[data-ref="A2"]')?.getBoundingClientRect().width>500);
 return page.evaluate(()=>{
  const view=document.querySelector('#grid-scroll'),canvas=document.querySelector('#grid-canvas'),c=canvas.getBoundingClientRect(),v=view.getBoundingClientRect(),{x,y}=gridGeometry(sheet());
  const refs=['A1','B1','C1','A2','A3','B3','C3','D3','E3','E4','F3'];
  const cells=Object.fromEntries(refs.map(ref=>{
   const e=canvas.querySelector('[data-ref="'+ref+'"]'),b=e?.getBoundingClientRect(),style=e&&getComputedStyle(e),pos=parseCell(ref),m=mergeAt(sheet(),ref),r=m?rectangle(m.from,m.to):null;
   return [ref,b?{x:b.left-c.left,y:b.top-c.top,w:b.width,h:b.height,text:e.textContent,bg:style.backgroundColor,color:style.color,font:style.fontFamily,bold:style.fontWeight,check:e.querySelector('[role=checkbox]')?.getAttribute('aria-checked')??null,expected:[x[pos.col],y[pos.row]-headerH,x[(r?.c2??pos.col)+1]-x[pos.col],y[(r?.r2??pos.row)+1]-y[pos.row]]}:null];
  }));
  const visible=[...canvas.querySelectorAll('.grid-cell')].filter(e=>{const b=e.getBoundingClientRect();return b.width>1&&b.height>1&&b.right>v.left&&b.left<v.right&&b.bottom>v.top&&b.top<v.bottom;});
  const colHeads=[...document.querySelectorAll('#grid-col-overlay .colhead')].filter(e=>{const b=e.getBoundingClientRect();return b.width>10&&b.right>v.left&&b.left<v.right;});
  const rowHeads=[...document.querySelectorAll('#grid-row-overlay .rowhead')].filter(e=>{const b=e.getBoundingClientRect();return b.height>10&&b.bottom>v.top&&b.top<v.bottom;});
  return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},scroll:{x:view.scrollLeft,y:view.scrollTop,w:view.clientWidth,h:view.clientHeight},grid:{w:c.width,h:c.height},visible:visible.length,rows:rowHeads.length,cols:colHeads.length,cells,model:bankStableJSON(book())};
 });
}
function checkGrid(g){
 assert.ok(g.scroll.w>500&&g.scroll.h>300&&g.rows>=10&&g.cols>=4&&g.visible>=35,'viewport or virtual grid collapsed');
 assert.equal(g.scroll.x,0);assert.equal(g.scroll.y,0);
 for(const [ref,v] of Object.entries(g.cells)){assert.ok(v,'missing '+ref);[v.x,v.y,v.w,v.h].forEach((n,i)=>assert.ok(Math.abs(n-v.expected[i])<1.6,ref+' geometry '+JSON.stringify(v)));}
 assert.equal(g.cells.A2.bg,'rgb(22, 122, 64)');assert.equal(g.cells.A3.bg,'rgb(242, 140, 0)');
 assert.match(g.cells.A2.font,/Comic Sans MS/);assert.equal(g.cells.E3.check,'false');assert.equal(g.cells.E4.check,'true');
 assert.equal(g.cells.C1.text,'42');assert.ok(g.cells.A3.h>120&&g.cells.A2.w>700);
}
async function resizeNative(page,width,height){
 const pid=Number(process.env.QO_NATIVE_PID);assert.ok(Number.isInteger(pid)&&pid>0);
 const before=await viewport(page);
 const ps=`Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class QOResize { [DllImport("user32.dll",SetLastError=true)] public static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int cx,int cy,uint flags); }'; $p=Get-Process -Id ${pid}; if(![QOResize]::SetWindowPos($p.MainWindowHandle,[IntPtr]::Zero,0,0,${width},${height},0x16)){throw "SetWindowPos failed"}`;
 // Windows PowerShell command string is built only from checked PID and fixed dimensions.
 execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{timeout:15000});
 await page.waitForFunction(b=>Math.abs(innerWidth-b.width)>25||Math.abs(innerHeight-b.height)>25,before,{timeout:15000});
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}
async function compareSheet(page,stage,out,resize){
 const original=await page.evaluate(()=>{const b=workspace.books.find(b=>b.name==='TASK1664 Sheets');if(!b)throw Error('Visual fixture not restored');openBook(b.id);return JSON.parse(JSON.stringify(book()));});
 const browser=await browserReference(),reports=[];
 try{
  const capture=async label=>{
   const n=await gridMetrics(page);checkGrid(n);
   const p=await browser.newPage({viewport:{width:n.viewport.width,height:n.viewport.height},deviceScaleFactor:n.viewport.dpr});
   try{
    await p.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
    await p.evaluate(b=>{workspace.books=[b];workspace.active=b.id;openBook(b.id);},original);
    const b=await gridMetrics(p);checkGrid(b);assert.equal(n.model,b.model,'same workbook model differs');
    for(const ref of Object.keys(n.cells)){const a=n.cells[ref],c=b.cells[ref];for(const k of ['x','y','w','h'])assert.ok(Math.abs(a[k]-c[k])<1.6,ref+' '+k+' differs');for(const k of ['bg','color','font','bold','text','check'])assert.equal(a[k],c[k],ref+' '+k);}
    await page.screenshot({path:path.join(out,'sheets-'+stage+'-'+label+'-windows.png')});
    await p.screenshot({path:path.join(out,'sheets-'+stage+'-'+label+'-browser.png')});
    const {model:_,...native}=n,{model:__,...reference}=b;reports.push({label,native,reference});
   }finally{await p.close();}
  };
  await capture('initial');
  // Exercise actual scroll events and virtualized rows, then restore the exact original position.
  const scrolled=await page.evaluate(async()=>{const e=document.querySelector('#grid-scroll');e.scrollTo(180,280);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const cell=document.querySelector('#grid-canvas [data-ref="C14"]');return {x:e.scrollLeft,y:e.scrollTop,cell:cell?.getBoundingClientRect().toJSON()};});
  assert.ok(scrolled.x>100&&scrolled.y>200&&scrolled.cell?.width>50&&scrolled.cell?.height>10,'virtual cells after scroll');
  await page.screenshot({path:path.join(out,'sheets-'+stage+'-scrolled-windows.png')});
  await page.evaluate(async()=>{document.querySelector('#grid-scroll').scrollTo(0,0);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  await capture('scroll-restored');
  if(resize){await resizeNative(page,1000,740);await capture('smaller');await resizeNative(page,1400,900);await capture('larger');}
  fs.writeFileSync(path.join(out,'sheets-'+stage+'-visual.json'),JSON.stringify({status:'PASS',reports},null,2));
 }finally{await browser.close();await page.evaluate(()=>route('home'));}
}
const {inspectGraphics,checkGraphics}=require('./task1664_graphics.cjs');
function printMetrics(){
 const doc=document,report=window.__qwPrintLayout,physical=[...doc.querySelectorAll('.qw-print-sheet')],pages=[...doc.querySelectorAll('.qw-print-page')],sections=[...doc.querySelectorAll('.qw-print-section')];
 const sheets=physical.length?physical:pages,mm=96/25.4,box=e=>e.getBoundingClientRect(),bounds=[],overlap=[];
 const intersects=(a,b)=>a&&b&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>.8&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.8;
 for(const section of sections){
  const b=box(section),c=box(section.closest('.qw-page-content'));
  if(b.left<c.left-1||b.right>c.right+1||b.bottom>c.bottom+1)bounds.push(section.dataset.task);
  const text=section.querySelector('.qw-task-text'),fig=section.querySelector('figure'),answer=section.querySelector('.qw-booklet-answer'),table=section.querySelector('table');
  if(answer&&[text,fig,table].some(e=>e&&intersects(box(answer),box(e))))overlap.push(section.dataset.task);
  if(table&&text&&!text.contains(table))overlap.push('table moved out of condition:'+section.dataset.task);
 }
 return {error:window.__qwPrintError||null,ready:doc.body.dataset.qwLayoutReady,orientation:doc.body.dataset.qwOrientation,report,bodyFont:getComputedStyle(doc.body).fontFamily,
  taskIds:sections.map(s=>Number(s.dataset.task)),math:doc.querySelectorAll('math').length,figures:doc.querySelectorAll('figure svg,figure img').length,images:[...doc.images].map(i=>({task:i.closest('[data-task]')?.dataset.task,width:i.naturalWidth,height:i.naturalHeight})),bounds,overlap,
  sheets:sheets.map(s=>{const b=box(s),brand=s.querySelector('.qw-qx-lettering'),c=brand&&box(brand);return {w:b.width/mm,h:b.height/mm,columns:s.matches('.qw-print-sheet')?s.querySelectorAll(':scope>.qw-print-page').length:1,brand:s.querySelectorAll('.qw-qx-lettering').length,brandFont:brand?getComputedStyle(brand).fontFamily:null,brandSize:brand?getComputedStyle(brand).fontSize:null,brandColor:brand?getComputedStyle(brand).color:null,brandRight:c?(b.right-c.right)/mm:null,brandBottom:c?(b.bottom-c.bottom)/mm:null,footers:s.querySelectorAll('.qw-page-footer').length,pageNumber:s.querySelector('.qw-page-footer span:last-child')?.textContent};})};
}
function checkPrint(m,orientation,fixture){
 assert.equal(m.error,null);assert.equal(m.ready,'true');assert.equal(m.orientation,orientation);
 assert.match(m.bodyFont,/QO Print/);assert.deepEqual([...new Set(m.taskIds)],Array.from({length:fixture.tasks.length},(_,i)=>i+1));assert.equal(m.figures,fixture.tasks.filter(t=>t.figure!=='none').length);assert.equal(m.images.length,fixture.tasks.filter(t=>t.figure==='image').length);assert.ok(m.images.every(i=>i.width>0&&i.height>0));assert.deepEqual(m.images.map(i=>Number(i.task)),fixture.tasks.flatMap((t,i)=>t.figure==='image'?[i+1]:[]));if(fixture.id!=='qx-original-physics-2018-01')assert.ok(m.math>=3);
 assert.deepEqual(m.bounds,[]);assert.deepEqual(m.overlap,[]);assert.ok(m.sheets.length>=2,'need multiple physical pages');
 for(const [i,s] of m.sheets.entries()){
  assert.ok(Math.abs(s.w-(orientation==='landscape'?297:210))<.5&&Math.abs(s.h-(orientation==='landscape'?210:297))<.5,'not A4');
  if(orientation==='portrait')assert.equal(s.columns,1);else if(i<m.sheets.length-1)assert.equal(s.columns,2);
  assert.equal(s.footers,1);assert.equal(s.pageNumber,String(i+1));assert.equal(s.brand,1);assert.match(s.brandFont,/QX Handwritten/);assert.equal(s.brandColor,'rgb(17, 17, 17)');assert.equal(s.brandSize,'20px');
  assert.ok(s.brandRight>=0&&s.brandRight<4&&s.brandBottom>=0&&s.brandBottom<4,'brand not bottom right');
 }
 assert.ok(m.report.pages.every(p=>p.capacityMm>150&&p.freeMm>=-.7),'invalid physical pagination');
}
async function makePrintFixture(page){
 return page.evaluate(()=>{
  const d=qwProject();d.title='Физика. Проверка Windows PDF';d.layout='booklet';d.grade='11';d.printSettings={fontPt:10,theme:'academic',showTitle:true,titleText:d.title,showMeta:false,showVariant:true,figurePosition:'auto'};
  d.tasks=Array.from({length:32},(_,i)=>{
   const q=qwTask('short');q.prompt='Условие '+(i+1)+'. Тело движется по горизонтальной поверхности. Определите скорость по формуле \\(v=\\frac{s}{t}\\). Запишите результат в СИ.';q.answer='12';q.answerVisible=true;
   if(i%4===0){q.figure='graph';q.graph=qwGraphDefault();q.graph.points=[{x:0,y:1,label:''},{x:2,y:3,label:''},{x:4,y:4,label:''}];}
   if(i%4===1){q.figure='diagram';q.diagram=[{kind:'ground',x:90,y:240,x2:450,y2:240,label:''},{kind:'block',x:200,y:170,x2:300,y2:240,label:'m'},{kind:'arrow',x:250,y:170,x2:250,y2:90,label:'N'}];}
   if(i===2){q.figure='image';const c=document.createElement('canvas');c.width=260;c.height=150;const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,260,150);ctx.strokeStyle='#172b37';ctx.lineWidth=3;ctx.strokeRect(20,40,220,80);ctx.fillStyle='#172b37';ctx.font='22px Arial';ctx.fillText('m = 2 kg',75,85);q.image=c.toDataURL('image/png');}
   if(i===4){q.prompt='Измерения выполнены через одинаковые интервалы времени.\n\n| t, с | 0 | 2 |\n| --- | --- | --- |\n| v, м/с | 1 | 3 |\n\nИспользуя таблицу, определите ускорение тела.';}
   if(i===5){q.figure='diagram';q.position='right';q.figureWidth=180;q.diagram=[{kind:'battery',x:65,y:110,x2:158,y2:175,label:'ε'},{kind:'resistor',x:240,y:110,x2:326,y2:175,label:'R'},{kind:'line',x:158,y:142,x2:240,y2:142,label:''},{kind:'line',x:326,y:142,x2:326,y2:240,label:''},{kind:'line',x:326,y:240,x2:65,y2:240,label:''},{kind:'line',x:65,y:240,x2:65,y2:142,label:''}];q.prompt='На схеме показана электрическая цепь. Сопротивление резистора 6 Ом, ЭДС источника 12 В. Внутренним сопротивлением пренебречь. Определите силу тока.';}
   if(i===6){q.type='choice';q.choices=['Скорость увеличивается.','Ускорение постоянно.','Сила трения равна нулю.','Энергия сохраняется.','Импульс уменьшается.'];q.prompt='Выберите два верных утверждения о равномерно ускоренном движении.';}
   if(i===7){q.prompt=('Тело движется по горизонтальной поверхности, затем по наклонной плоскости. На каждом участке измеряют скорость и время. ').repeat(5)+'Определите путь, объясните выбор модели и запишите ответ.';}
   if(i===8){q.position='below';q.figureWidth=320;q.prompt='На широком графике показана зависимость координаты от времени. Определите среднюю скорость.';}
   return q;
  });
  return qwValidate(d);
 });
}
async function comparePrint(page,out,fixture=null,prefix='print'){
 fixture??=await makePrintFixture(page);
 fs.writeFileSync(path.join(out,prefix+'.qwork'),JSON.stringify(fixture,null,2));
 const browser=await browserReference(),app=await browser.newPage(),report=[];
 try{
  await app.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  const table='<table><thead><tr><th>t, с</th><th>0</th><th>2</th></tr></thead><tbody><tr><td>v, м/с</td><td>1</td><td>3</td></tr></tbody></table>';
  for(const orientation of ['portrait','landscape']){
   const d=structuredClone(fixture);d.printSettings.orientation=orientation;
   const referenceHtml=(await app.evaluate(d=>qwPrintDocumentHTML(d,false,{format:'booklet'}),d)).replace('TASK1664_TABLE_MARKER',table);
   const nativeHtml=(await page.evaluate(d=>qwPrintDocumentHTML(d,false,{format:'booklet'}),d)).replace('TASK1664_TABLE_MARKER',table);
   const p=await browser.newPage({viewport:{width:1280,height:1200}});
   const id='task1664-visual-print';
   try{
    await p.setContent(referenceHtml);await p.evaluate(()=>window.qwPrintReady);
    const b=await p.evaluate(printMetrics);checkPrint(b,orientation,fixture);
    if(prefix!=='print'){const proof=await p.evaluate(inspectGraphics);checkGraphics(proof,prefix);fs.writeFileSync(path.join(out,prefix+'-'+orientation+'-browser-geometry.json'),JSON.stringify(proof,null,2));}
    await p.emulateMedia({media:'print'});await p.pdf({path:path.join(out,prefix+'-'+orientation+'-browser.pdf'),preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});
    await p.screenshot({path:path.join(out,prefix+'-'+orientation+'-browser.png'),fullPage:true});
    await page.evaluate(({html,id})=>{const f=document.createElement('iframe');f.id=id;f.style.cssText='position:fixed;inset:0;width:100%;height:100%;background:white;z-index:999999';f.srcdoc=html;document.body.append(f);},{html:nativeHtml,id});
    const handle=await page.waitForSelector('#'+id),frame=await handle.contentFrame();
    await frame.waitForFunction(()=>!!window.qwPrintReady,{},{timeout:30000});await frame.evaluate(()=>window.qwPrintReady);
    const n=await frame.evaluate(printMetrics);checkPrint(n,orientation,fixture);
    if(prefix!=='print'){const proof=await frame.evaluate(inspectGraphics);checkGraphics(proof,prefix);fs.writeFileSync(path.join(out,prefix+'-'+orientation+'-windows-geometry.json'),JSON.stringify(proof,null,2));}
    assert.deepEqual(n.taskIds,b.taskIds);assert.equal(n.sheets.length,b.sheets.length);assert.deepEqual(n.report.pages.map(x=>x.tasks.map(t=>t.task)),b.report.pages.map(x=>x.tasks.map(t=>t.task)));
    await page.screenshot({path:path.join(out,prefix+'-'+orientation+'-windows-preview.png')});
    // Print the same prepared, already measured srcdoc using the actual release
    // WebView2 CDP PDF engine. Temporarily promote its DOM to the top-level
    // document solely for this test; never print the surrounding application.
    const session=await page.context().newCDPSession(page);
    try{
     const images=await page.evaluate(async id=>{
      const f=document.getElementById(id),src=f.contentDocument;
      const sourceImages=[...src.images].map((img,index)=>({index,task:img.closest('[data-task]')?.dataset.task,src:img.getAttribute('src'),width:img.naturalWidth,height:img.naturalHeight}));
      if(sourceImages.some(i=>!i.width||!i.height))throw Error('Prepared frame already has undecoded image');
      const head=document.importNode(src.head,true),body=document.createElement('body');
      for(const attr of src.body.attributes)body.setAttribute(attr.name,attr.value);
      body.innerHTML=src.body.innerHTML;
      // Avoid adopting img elements from a document about to be destroyed.
      // Create each image in the destination document, assigning its exact source
      // only after attachment. Keep the source frame until decoding finishes.
      const targets=[...body.querySelectorAll('img')].map((old,index)=>{
       const img=document.createElement('img');for(const attr of old.attributes)if(attr.name!=='src')img.setAttribute(attr.name,attr.value);
       old.replaceWith(img);return {img,source:sourceImages[index]};
      });
      if(targets.length!==sourceImages.length)throw Error('Image count changed during print promotion');
      head.querySelectorAll('script').forEach(e=>e.remove());body.querySelectorAll('script').forEach(e=>e.remove());
      const saved={head:document.head,body:document.body,links:[...head.querySelectorAll('link[rel=stylesheet]')].map(l=>l.href)};
      window.__qoVisualSwap=saved;
      const links=[...head.querySelectorAll('link[rel=stylesheet]')];const loads=links.map(l=>new Promise((resolve,reject)=>{l.onload=resolve;l.onerror=()=>reject(Error('Print CSS reload failed'));}));
      document.head.replaceWith(head);document.body.replaceWith(body);await Promise.all(loads);
      const imageProof=await Promise.all(targets.map(async({img,source})=>{
       img.src=source.src;
       try{await img.decode();}catch(e){throw Error('Print promotion image #'+source.index+' task '+source.task+' '+source.src.slice(0,40)+' length '+source.src.length+': '+e.message);}
       if(img.naturalWidth!==source.width||img.naturalHeight!==source.height||img.getAttribute('src')!==source.src)throw Error('Image changed during print promotion: task '+source.task);
       return {task:source.task,index:source.index,width:source.width,height:source.height,length:source.src.length,mime:source.src.split(';')[0]};
      }));
      void body.offsetHeight;await document.fonts.ready;return imageProof;
     },id);
     fs.writeFileSync(path.join(out,prefix+'-'+orientation+'-image-decode.json'),JSON.stringify(images,null,2));
     await session.send('Emulation.setEmulatedMedia',{media:'print'});
     const pdf=await session.send('Page.printToPDF',{preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false,marginTop:0,marginBottom:0,marginLeft:0,marginRight:0,scale:1});
     fs.writeFileSync(path.join(out,prefix+'-'+orientation+'-windows.pdf'),Buffer.from(pdf.data,'base64'));
    }finally{
     await session.send('Emulation.setEmulatedMedia',{media:''}).catch(()=>{});
     await page.evaluate(()=>{const s=window.__qoVisualSwap;if(s){document.head.replaceWith(s.head);document.body.replaceWith(s.body);delete window.__qoVisualSwap;}});
     await session.detach();
    }
    report.push({orientation,native:n,browser:b,scope:'Actual WebView2 prepared srcdoc and CDP vector PDF; system dialog requires separate manual check'});
   }finally{await page.evaluate(id=>document.getElementById(id)?.remove(),id);await p.close();}
  }
  fs.writeFileSync(path.join(out,prefix+'-visual.json'),JSON.stringify({status:'PASS',report},null,2));
 }finally{await browser.close();}
}
module.exports={compareSheet,comparePrint,makePrintFixture,printMetrics,checkPrint};
