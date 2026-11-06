import {QW_PRINT_FONT_CSS} from './work-print-fonts.js';
import {qwPrintThemeStyles} from './work-print-theme.js';
/* Print-only layout. Fonts and SVG ink are measured before any pagination.
   QWORK and editor geometry are never mutated by this document. */
function qwMeasureSVGInk(svg){
 // Independent graph objects are clipped to the grid, which already belongs to
 // the measured ink. getBBox itself includes their invisible off-range geometry.
 const clipped=[...svg.querySelectorAll('g[clip-path="url(#qw-plot-clip)"]')].map(e=>({e,style:e.getAttribute('style')}));
 for(const {e} of clipped)e.style.display='none';
 try{
  const box=svg.getBBox();
  const stroke=Math.max(2,...[...svg.querySelectorAll('[stroke-width]')].filter(e=>!e.closest('defs,g[clip-path="url(#qw-plot-clip)"]')).map(e=>Number(e.getAttribute('stroke-width'))||0));
  const markers=!!svg.querySelector('[marker-end],[marker-start]');
  const pad=Math.max(3,stroke/2+1,markers?Math.max(8,stroke*3):0);
  return {x:box.x-pad,y:box.y-pad,width:Math.max(1,box.width+pad*2),height:Math.max(1,box.height+pad*2)};
 }finally{for(const {e,style} of clipped)if(style===null)e.removeAttribute('style');else e.setAttribute('style',style);}
}
function qwPrintStyles(){return QW_PRINT_FONT_CSS+`
@page{size:A4;margin:0}
:root{--qw-print-family:"QO Print Sans",Arial,"Liberation Sans",sans-serif}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font:var(--qw-print-size,10.8pt)/1.35 var(--qw-print-family)}
.qw-print-document{margin:0;padding:0}
.qw-print-page{position:relative;width:210mm;height:297mm;padding:14mm 15mm 20mm;break-after:page;background:white}
.qw-print-page:last-child{break-after:auto}
.qw-page-content{display:flow-root;width:180mm;height:263mm}
.qw-page-footer>span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.qw-page-footer>span:last-child{flex:none}
.qw-page-footer{position:absolute;bottom:7mm;left:15mm;right:15mm;display:flex;justify-content:space-between;gap:5mm;font:8pt/1.2 var(--qw-print-family);color:#555}
.qw-print-header{margin:0 0 4mm}
.qw-print-title{font-size:15pt;line-height:1.2;margin:0 0 2mm;font-weight:700}
.qw-print-topic{font-size:11pt;line-height:1.3;margin:0 0 1.5mm;font-weight:400}
.qw-print-meta{font-size:9pt;line-height:1.3;margin:0 0 3mm;color:#444}
.qw-print-intro{font-size:10pt;line-height:1.35;margin:0;white-space:pre-wrap}
.qw-running-header{font-size:8.5pt;line-height:1.3;color:#555;margin:0 0 3mm;border-bottom:.2mm solid #ccc;padding-bottom:1.5mm}
.qw-print-section{display:flow-root;margin:0 0 2.2mm;break-inside:avoid}
.qw-paper-task{border:0;margin:0;padding:0;background:white;color:#111;overflow-wrap:anywhere}
.qw-paper-task>header{display:block;margin:0 0 1.2mm;font-size:10.5pt;line-height:1.2;break-after:avoid}
.qw-paper-task>header span{display:none}
.qw-task-flow{display:block;min-height:0}
.qw-task-text{min-width:0;overflow-wrap:anywhere;white-space:normal}
.qw-print-has-figure:not(.qw-figure-below){display:grid;grid-template-columns:minmax(0,1fr) 65mm;column-gap:5mm;align-items:start}
.qw-print-has-figure.qw-figure-right .qw-task-text{grid-column:1;grid-row:1}
.qw-print-has-figure.qw-figure-right figure{grid-column:2;grid-row:1;justify-self:center}
.qw-print-has-figure.qw-figure-left{grid-template-columns:65mm minmax(0,1fr)}
.qw-print-has-figure.qw-figure-left .qw-task-text{grid-column:2;grid-row:1}
.qw-print-has-figure.qw-figure-left figure{grid-column:1;grid-row:1;justify-self:center}
.qw-long-fragment .qw-print-has-figure:not(.qw-figure-below){display:flow-root}
.qw-long-fragment .qw-figure-right figure{float:right;margin:0 0 2mm 5mm}
.qw-long-fragment .qw-figure-left figure{float:left;margin:0 5mm 2mm 0}
.qw-task-flow figure{float:none;margin:0;max-width:100%;break-inside:avoid}
.qw-task-flow figure svg,.qw-task-flow figure img{display:block;width:100%;height:100%;object-fit:contain;max-width:100%}
.qw-print-has-figure.qw-figure-below{display:flex;flex-direction:column;gap:2mm}
.qw-figure-below .qw-task-text{order:0}
.qw-figure-below figure{order:1}
.qw-answer-preview{display:flex;align-items:center;gap:2mm;margin:1.2mm 0 0;font-size:9.5pt;line-height:1.2;break-inside:avoid}
.qw-answer-preview span{display:block;flex:1;border-bottom:.2mm solid #333;min-width:15mm;height:4mm}
.qw-answer-preview i{display:block;width:5mm;height:5mm;border:.2mm solid #555}
.qw-answer-preview .qw-answer-box{width:32mm}
.qw-inline-blank{display:inline-block;border-bottom:.2mm solid #333;height:1em;max-width:100%}
.qw-solution-preview{margin:2mm 0 0;break-inside:avoid}
.qw-solution-lines{background:repeating-linear-gradient(to bottom,transparent 0,transparent 6.2mm,#ddd 6.3mm)}
.qw-solution-grid{background-image:linear-gradient(#ddd 1px,transparent 1px),linear-gradient(90deg,#ddd 1px,transparent 1px);background-size:5mm 5mm}
.qw-solution-blank{border:.2mm solid #ccc}
.qw-teacher-notes{margin:1mm 0 0;padding:1mm 1.5mm;border-left:.5mm solid #777;background:#f7f7f7;font-size:9.3pt;line-height:1.3}
.qw-print-with-answers .qw-answer-preview{display:none}
.qw-teacher-notes p{margin:0 0 1mm}.qw-teacher-notes p:last-child{margin-bottom:0}
math{font-family:"Cambria Math","STIX Two Math","Times New Roman",serif;font-size:1em;line-height:normal;vertical-align:baseline;margin:0;white-space:nowrap}
math mfrac{font-size:1em}
.qw-compact-task .qw-paper-task>header,.qw-compact-task .qw-task-flow,.qw-compact-task .qw-task-text{display:inline}
.qw-compact-task .qw-paper-task>header{margin:0 2mm 0 0}
.qw-exam-grid{display:grid;grid-template-columns:6mm minmax(0,1fr);gap:1.5mm}
.qw-exam-body{min-width:0}.qw-exam-number{font-weight:bold}
.qw-print-header:empty{display:none}
body[data-qw-format="compact"],body[data-qw-format="practice"],body[data-qw-format="answers"]{font-size:var(--qw-print-size,10pt);line-height:1.3}
body:is([data-qw-format="compact"],[data-qw-format="practice"],[data-qw-format="answers"]) .qw-print-page{padding:12mm}
body:is([data-qw-format="compact"],[data-qw-format="practice"],[data-qw-format="answers"]) .qw-page-content{width:186mm;height:273mm}
body:is([data-qw-format="compact"],[data-qw-format="practice"],[data-qw-format="answers"]) .qw-print-title{font-size:14pt;margin:0 0 1.5mm;line-height:1.2}
body:is([data-qw-format="compact"],[data-qw-format="practice"],[data-qw-format="answers"]) .qw-print-section{margin-bottom:2mm}
.qw-topic-title{font-size:12pt;line-height:1.25;margin:3mm 0 1.5mm;font-weight:700;color:#b42318;break-after:avoid}
body[data-qw-format="compact"] .qw-print-section{margin-bottom:.5mm;position:relative}
body[data-qw-format="compact"] .qw-page-content>.qw-print-section~.qw-print-section{padding-top:.5mm}
body[data-qw-format="compact"] .qw-page-content>.qw-print-section~.qw-print-section:before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:#e0e4e8;transform:scaleY(.4);transform-origin:top}
body[data-qw-format="compact"] .qw-topic-title{margin-top:2mm;margin-bottom:1mm}
.qw-choice-list{margin:1.5mm 0 0;padding-left:6mm;line-height:1.3}
.qw-compact-entry{display:grid;grid-template-columns:6mm minmax(0,1fr);column-gap:1mm}
.qw-compact-entry>header{margin:0;font:700 1em/1.3 var(--qw-print-family)}
.qw-print-number{font-family:var(--qw-print-family);font-size:1em;font-weight:700;font-style:normal}
.qw-compact-entry>header,.qw-answer-item>.qw-print-number,.qw-exam-number{text-align:right}
.qw-compact-entry .qw-task-flow{display:flow-root!important;min-width:0}
.qw-compact-entry .qw-task-flow figure{float:right;margin:0 0 .8mm 3mm}
.qw-compact-entry .qw-figure-left figure{float:left;margin:0 3mm 1mm 0}
.qw-compact-entry .qw-figure-below figure{float:none;margin:1.5mm 0 0}
.qw-answer-columns{display:grid;grid-template-columns:repeat(var(--qw-answer-columns),minmax(0,1fr));gap:3mm 8mm}
.qw-answer-item{min-width:0;overflow-wrap:anywhere;display:grid;grid-template-columns:6mm minmax(0,1fr);column-gap:1mm;align-items:start}
.qw-answer-long p{margin:1.5mm 0 0}
body[data-qw-format="answers"] .qw-print-section{margin-bottom:3mm}
body[data-qw-format="practice"] .qw-print-section{margin-bottom:4mm}
.qw-practice-space{margin-top:3mm;width:100%}
.qw-practice-space svg{display:block;width:100%;height:100%}
.qw-print-error{margin:12mm;color:#981b1b;font-size:11pt}
@media screen{html{background:#e8edf2}body{padding:12px}.qw-print-page{margin:0 auto 12px;box-shadow:0 2px 8px #1f2b3740}}
@media print{.qw-print-page{margin:0;box-shadow:none}}
`+qwPrintThemeStyles();}
async function qwPreparePrintDocument(){
 await document.fonts.ready;
 const existing=document.getElementById('qw-print-layout-report');
 if(existing){window.__qwPrintLayout=JSON.parse(existing.textContent);return window.__qwPrintLayout;}
 await Promise.all([...document.images].map(img=>img.decode()));
 const host=document.querySelector('.qw-print-document'),source=host.querySelector('.qw-print-source');
 const header=source.querySelector('.qw-print-header'),originals=[...source.querySelectorAll(':scope>.qw-print-section')];
 const MM=96/25.4,pages=[],fragments=[],format=document.body.dataset.qwFormat||'worksheet',modern=['compact','practice','answers'].includes(format);
 // Figure geometry is calculated in an A4-width measurement surface.
 source.style.width=modern?'186mm':'180mm';const contentWidth=source.getBoundingClientRect().width;
 for(const section of originals){
  // Attribute colours keep monochrome diagrams vector; CSS filters rasterise in Chromium.
  if(document.body.dataset.qwMonochrome==='true')for(const e of section.querySelectorAll('svg [stroke],svg [fill]'))for(const key of ['stroke','fill']){
   const value=e.getAttribute(key);if(!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value||''))continue;
   const hex=value.length===4?value.slice(1).split('').map(c=>c+c).join(''):value.slice(1),rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
   const gray=Math.round(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722);e.setAttribute(key,'#'+gray.toString(16).padStart(2,'0').repeat(3));
  }

  const flow=section.querySelector('.qw-task-flow'),figure=flow.querySelector('figure');
  flow.classList.toggle('qw-print-has-figure',!!figure);
  if(figure){
   const svg=figure.querySelector('svg');let w,h;
   if(svg){const box=qwMeasureSVGInk(svg);svg.setAttribute('viewBox',[box.x,box.y,box.width,box.height].join(' '));w=box.width;h=box.height;figure.dataset.inkBox=JSON.stringify(box);}
   else {const img=figure.querySelector('img');w=img.naturalWidth;h=img.naturalHeight;}
   let wide=flow.classList.contains('qw-figure-below');
   const requested=Number(figure.dataset.requestedWidth)||220;
   const graph=figure.dataset.figureKind==='graph';
   const maxW=modern?(wide?Math.min(requested,contentWidth-7*MM):(format==='practice'?55:graph?55:40)*MM):wide?(requested>=470?180*MM:Math.min(requested,180*MM)):Math.min(requested,65*MM);
   const maxH=modern?(wide?50:format==='practice'?35:34)*MM:wide?(requested>=470?160*MM:requested*320/520):38*MM;let scale=Math.min(maxW/w,maxH/h);
   // A graph's grid has a common physical width, independent of labels around its origin.
   if(modern&&svg&&graph&&!wide)scale=48*MM/369;
   if(modern&&svg){
    const fonts=[...svg.querySelectorAll('text')].filter(e=>e.textContent.trim()).map(e=>parseFloat(getComputedStyle(e).fontSize)).filter(n=>n>0);
    if(fonts.length)scale=Math.max(scale,6.6/.75/Math.min(...fonts));
    if(w*scale>contentWidth-7*MM)throw Error('Подписи рисунка не помещаются: сократите подписи или разделите рисунок.');
   }
   if(modern&&flow.classList.contains('qw-figure-auto'))wide=w/h>3.2||w*scale>contentWidth*.45;
   const position=wide?'below':flow.classList.contains('qw-figure-left')?'left':'right';
   flow.classList.remove('qw-figure-auto','qw-figure-left','qw-figure-right','qw-figure-below');flow.classList.add('qw-figure-'+position);
   if(modern&&!wide)flow.prepend(figure);
   figure.style.width=w*scale+'px';figure.style.height=h*scale+'px';
   figure.dataset.printPosition=position;
  }
  const text=section.querySelector('.qw-task-text');
  if(format==='answers'&&text.classList.contains('qw-answer-columns')&&[...text.querySelectorAll('.qw-answer-item math')].some(m=>m.getBoundingClientRect().width>m.closest('.qw-answer-item').getBoundingClientRect().width))text.style.gridTemplateColumns='1fr';
  if(!modern&&!figure&&!section.querySelector('.qw-solution-preview')&&text.getBoundingClientRect().height<=parseFloat(getComputedStyle(text).lineHeight)*2+1)section.classList.add('qw-compact-task');
  // A wide indivisible expression gets the whole text width, without modifying QWORK.
  if(figure&&!flow.classList.contains('qw-figure-below')&&[...text.querySelectorAll('math')].some(m=>m.getBoundingClientRect().width>(modern?contentWidth-7*MM-figure.getBoundingClientRect().width-3*MM:text.getBoundingClientRect().width))){
   flow.classList.remove('qw-figure-right','qw-figure-left');flow.classList.add('qw-figure-below');section.dataset.layoutReason='wide-formula';
   if(modern)flow.append(figure);
  }
  if(figure&&!flow.classList.contains('qw-figure-below')){
   const answer=section.querySelector('.qw-answer-preview'),notes=section.querySelector('.qw-teacher-notes');
   if(answer)text.append(answer);if(notes)text.append(notes);
  }
  if([...text.querySelectorAll('math')].some(m=>m.getBoundingClientRect().width>contentWidth-(modern?7*MM:0)))throw Error('Формула шире страницы: разделите выражение.');
 }
 const title=header.querySelector('h1')?.textContent||(modern?'':document.title),meta=header.querySelector('.qw-print-meta')?.textContent||'';
 const footerLabel=[document.body.dataset.qwTheme?'Квант Икс | QX':'',meta].filter(Boolean).join(' · ');
 function newPage(){
  if(pages.length>=80)throw Error('Работа превышает 80 страниц');
  const page=document.createElement('section');page.className='qw-print-page';
  const content=document.createElement('div');content.className='qw-page-content';page.append(content);
  if(!pages.length)content.append(header);else if(title){const running=document.createElement('div');running.className='qw-running-header';running.textContent=title+(meta?' · '+meta:'');content.append(running);}
  host.append(page);pages.push({page,content});return pages.at(-1);
 }
 function used(page){const last=[...page.content.children].reverse().find(e=>getComputedStyle(e).display!=='none');if(!last)return 0;return last.getBoundingClientRect().bottom-page.content.getBoundingClientRect().top+parseFloat(getComputedStyle(last).marginBottom||0);}
 const fits=page=>used(page)<=page.content.getBoundingClientRect().height+.3;
 let current=newPage();
 function continuation(original){
  const copy=original.cloneNode(true);copy.classList.remove('qw-compact-task');copy.dataset.continuation='true';
  copy.querySelector('.qw-topic-title')?.remove();
  const article=copy.querySelector('.qw-paper-task'),heading=article.querySelector('header b')||article.querySelector('.qw-exam-number');
  if(heading&&!modern)heading.textContent=heading.textContent.replace(/ \(продолжение\)$/,'')+' (продолжение)';
  for(const child of [...article.children])if(child.tagName!=='HEADER'&&!child.classList.contains('qw-exam-grid'))child.remove();
  if(article.querySelector('.qw-exam-body'))article.querySelector('.qw-exam-body').replaceChildren();
  copy.querySelectorAll('.qw-teacher-notes').forEach(e=>e.remove());return copy;
 }
 function bodyOf(section){return section.querySelector('.qw-exam-body')||section.querySelector('.qw-paper-task');}
 function tokens(element){return [...element.childNodes].flatMap(node=>node.nodeType===3?(node.textContent.match(/\S+\s*|\s+/g)||[]).map(s=>document.createTextNode(s)):[node.cloneNode(true)]);}
 function replaceTokens(element,items,start,end){element.replaceChildren(...items.slice(start,end).map(n=>n.cloneNode(true)));}
 function boundary(items,start,end){
  const minimum=start+Math.floor((end-start)*.75);
  for(let i=end;i>minimum;i--)if(items[i-1].nodeName==='BR'||/[.!?;:]\s*$/.test(items[i-1].textContent))return i;
  return end;
 }
 function fitTextChunk(section,element,items,start,after){
  current.content.append(section);let lo=start+1,hi=items.length,best=start;
  while(lo<=hi){const mid=(lo+hi)>>1;replaceTokens(element,items,start,mid);after?.remove();if(mid===items.length&&after)bodyOf(section).append(after);
   if(fits(current)){best=mid;lo=mid+1;}else hi=mid-1;
  }
  after?.remove();
  if(best===start){section.remove();current=newPage();current.content.append(section);replaceTokens(element,items,start,start+1);if(!fits(current))throw Error('Блок не помещается на страницу; уменьшите иллюстрацию или разделите формулу.');return fitTextChunk(section,element,items,start,after);}
  let end=best===items.length?best:boundary(items,start,best);
  if(items.length-end<12&&end<items.length&&end-start>24)end=items.length-12;
  replaceTokens(element,items,start,end);if(end===items.length&&after)bodyOf(section).append(after);
  return end;
 }
 function appendTail(original,last,block){
  bodyOf(last).append(block);if(fits(current))return last;block.remove();
  current=newPage();const next=continuation(original);bodyOf(next).append(block);current.content.append(next);
  if(fits(current)){fragments.push(next);return next;}
  // Long teacher paragraphs are split as text atoms, never through a formula.
  const paragraphs=block.classList.contains('qw-teacher-notes')?[...block.children]:[];
  next.remove();if(!paragraphs.length)throw Error('Поле решения превышает страницу.');
  let result=last;
  for(const paragraph of paragraphs){let start=0,items=tokens(paragraph);
   while(start<items.length){const fragment=continuation(original),notes=block.cloneNode(false),p=paragraph.cloneNode(false);notes.append(p);bodyOf(fragment).append(notes);
    start=fitTextChunk(fragment,p,items,start);fragments.push(fragment);result=fragment;if(start<items.length)current=newPage();
   }
  }return result;
 }
 function splitLong(original){
  const text=original.querySelector('.qw-task-text'),article=bodyOf(original),flow=original.querySelector('.qw-task-flow');
  const answer=original.querySelector('.qw-answer-preview'),teacher=original.querySelector('.qw-teacher-notes');
  answer?.remove();teacher?.remove();const items=tokens(text);
  const tails=[...article.children].filter(e=>e!==flow&&e.tagName!=='HEADER'&&e!==answer&&!e.classList.contains('qw-exam-grid'));
  if(teacher)tails.push(teacher);
  let start=0,first=true,last;
  while(start<items.length){
   const fragment=first?original.cloneNode(true):continuation(original),target=bodyOf(fragment);
   if(first){[...target.children].filter(e=>e!==fragment.querySelector('.qw-task-flow')&&e.tagName!=='HEADER').forEach(e=>e.remove());fragment.querySelectorAll('.qw-teacher-notes').forEach(e=>e.remove());}
   else {const continuedFlow=flow.cloneNode(true);continuedFlow.querySelector('figure')?.remove();continuedFlow.classList.remove('qw-print-has-figure');target.append(continuedFlow);}
   fragment.classList.remove('qw-compact-task');fragment.classList.add('qw-long-fragment');
   const firstFigure=fragment.querySelector('figure');if(firstFigure&&!fragment.querySelector('.qw-figure-below'))fragment.querySelector('.qw-task-flow').prepend(firstFigure);
   const element=fragment.querySelector('.qw-task-text');
   const end=fitTextChunk(fragment,element,items,start,answer?.cloneNode(true));
   fragments.push(fragment);last=fragment;start=end;first=false;if(start<items.length)current=newPage();
  }
  for(const tail of tails)last=appendTail(original,last,tail.cloneNode(true));
 }
 function practicePages(){
  const perPage=Number(document.body.dataset.practiceCount)||2,grid=document.body.dataset.practiceGrid||'fine';let index=0;
  while(index<originals.length){
   const available=current.content.getBoundingClientRect().height-used(current);let count=Math.min(perPage,originals.length-index);
   for(let n=1;n<count;n++)if(originals[index+n].dataset.explicitBreak==='true'){count=n;break;}
   let group,slot;
   while(count>0){
    group=originals.slice(index,index+count);for(const section of group)current.content.append(section);
    const margin=parseFloat(getComputedStyle(group[0]).marginBottom);slot=Math.floor((available/count-margin)*100)/100;
    const fitsAll=group.every(section=>section.getBoundingClientRect().height+23*MM<=slot);
    if(fitsAll)break;group.forEach(section=>section.remove());count--;
   }
   if(!count)throw Error('Условие задания '+originals[index].dataset.task+' слишком длинное для листа с пространством для решения. Используйте обычную контрольную работу.');
   for(const section of group){
    section.style.height=slot+'px';const article=section.querySelector('.qw-paper-task'),space=document.createElement('div');space.className='qw-practice-space';
    const height=slot-(article.getBoundingClientRect().bottom-section.getBoundingClientRect().top)-3*MM;space.style.height=height+'px';section.append(space);
    if(grid!=='none'){
     const step=grid==='normal'?5:2.5,w=space.getBoundingClientRect().width,h=space.getBoundingClientRect().height,id='qw-grid-'+section.dataset.task;
     space.dataset.gridStepMm=String(step);space.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" aria-hidden="true"><defs><pattern id="'+id+'" width="'+step*MM+'" height="'+step*MM+'" patternUnits="userSpaceOnUse"><path d="M'+step*MM+' 0H0V'+step*MM+'" fill="none" stroke="'+(grid==='normal'?'#dbe1e7':'#e3e7eb')+'" stroke-width="'+(grid==='normal'?.45:.35)+'"/></pattern></defs><rect width="100%" height="100%" fill="url(#'+id+')"/></svg>';
    }
    fragments.push(section);
   }
   index+=count;if(index<originals.length)current=newPage();
  }
 }
 if(format==='practice')practicePages();else for(const section of originals){
  section.remove();if(section.dataset.explicitBreak==='true'&&current.content.querySelector('.qw-print-section'))current=newPage();
  current.content.append(section);
  if(fits(current)){fragments.push(section);continue;}
  section.remove();
  if(current.content.querySelector('.qw-print-section'))current=newPage();
  current.content.append(section);if(fits(current)){fragments.push(section);continue;}
  section.remove();splitLong(section);
 }
 source.remove();
 const report={pages:pages.map(({page,content},i)=>{
  const footer=document.createElement('footer');footer.className='qw-page-footer';const label=document.createElement('span'),number=document.createElement('span');label.textContent=footerLabel;number.textContent=(i+1)+' / '+pages.length;footer.append(label,number);page.append(footer);
  const sections=[...content.querySelectorAll(':scope>.qw-print-section')];
  return {page:i+1,capacityMm:content.getBoundingClientRect().height/MM,usedMm:used({content})/MM,freeMm:(content.getBoundingClientRect().height-used({content}))/MM,tasks:sections.map(section=>{
   const box=section.getBoundingClientRect(),figure=section.querySelector('figure'),f=figure?.getBoundingClientRect();
   const space=section.querySelector('.qw-practice-space');
   return {task:Number(section.dataset.task),continuation:section.dataset.continuation==='true',heightMm:box.height/MM,figure:f?{widthMm:f.width/MM,heightMm:f.height/MM,viewBox:figure.querySelector('svg')?.getAttribute('viewBox')}:null,...(space?{solutionHeightMm:space.getBoundingClientRect().height/MM}:{} )};
  })};
 })};
 const data=document.createElement('script');data.id='qw-print-layout-report';data.type='application/json';data.textContent=JSON.stringify(report);document.body.append(data);
 document.body.dataset.qwLayoutReady='true';window.__qwPrintLayout=report;return report;
}
export {qwMeasureSVGInk,qwPrintStyles,qwPreparePrintDocument};
