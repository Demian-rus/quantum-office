import {QW_PRINT_FONT_CSS} from './work-print-fonts.js';
import {qwPrintThemeStyles} from './work-print-theme.js';
/* Print-only layout. Fonts and SVG ink are measured before any pagination.
   QWORK and editor geometry are never mutated by this document. */
/* Measure in the destination SVG coordinate system. Browser text metrics can
   change after viewBox/viewport sizing or when importing into WebView2 print.
   Only text is repositioned; model points, grid and endpoints stay untouched. */
function qwAlignSVGText(svg,options={}){
 const root=svg.getCTM();if(!root)return;
 const inverse=root.inverse();
 const matrix=e=>inverse.multiply(e.getCTM());
 const point=(m,x,y)=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f});
 const box=e=>{
  const b=e.getBBox(),m=matrix(e),ps=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>point(m,x,y));
  const x=Math.min(...ps.map(p=>p.x)),y=Math.min(...ps.map(p=>p.y));
  return {x,y,w:Math.max(...ps.map(p=>p.x))-x,h:Math.max(...ps.map(p=>p.y))-y};
 };
 const shift=(e,dx,dy)=>{
  if(Math.abs(dx)<.0001&&Math.abs(dy)<.0001)return;
  const m=matrix(e.parentElement),det=m.a*m.d-m.b*m.c;
  if(Math.abs(det)<1e-12)return;
  const x=(m.d*dx-m.c*dy)/det,y=(-m.b*dx+m.a*dy)/det;
  e.setAttribute('transform','translate('+x+' '+y+') '+(e.getAttribute('transform')||''));
 };
 for(const e of svg.querySelectorAll('.qw-axis-title[data-axis-tip-x]')){
  if(!e.textContent.trim())continue;
  const tx=Number(e.dataset.axisTipX),ty=Number(e.dataset.axisTipY),vertical=e.dataset.axis==='y';
  for(let i=0;i<3;i++){const b=box(e);shift(e,vertical?tx-b.x-b.w/2:tx+6-b.x,vertical?ty-6-b.y-b.h:ty-b.y-b.h/2);}
 }
 if(options.manual!==false)for(const e of svg.querySelectorAll('[data-qw-label][data-label-mode="manual"]')){
  const owner=e.closest('[data-qw-label-owner]')||svg;
  const a=point(matrix(owner),Number(e.dataset.labelAnchorX),Number(e.dataset.labelAnchorY));
  const x=a.x+Number(e.dataset.labelDx),y=a.y+Number(e.dataset.labelDy);
  for(let i=0;i<3;i++){const b=box(e);shift(e,x-b.x-b.w/2,y-b.y-b.h/2);}
 }
 if(options.expand){
  // Keep the original editor viewport as minimum. Only expand for actual
  // title bounds, so ordinary graphs retain the same on-screen coordinates.
  const bounds=[...svg.querySelectorAll('.qw-axis-title[data-axis-tip-x]')].filter(e=>e.textContent.trim()).map(box);
  const left=Math.min(0,...bounds.map(b=>b.x-4)),top=Math.min(0,...bounds.map(b=>b.y-4));
  const right=Math.max(520,...bounds.map(b=>b.x+b.w+4)),bottom=Math.max(320,...bounds.map(b=>b.y+b.h+4));
  svg.setAttribute('viewBox',[left,top,right-left,bottom-top].join(' '));
 }
}
function qwMeasureSVGInk(svg){
 qwAlignSVGText(svg);
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
// Retain MathML sizing and semantics. Paint the hook and rule together because
// the native glyph and the separately snapped rule can leave a seam in PDF.
const QW_RADICAL_CSS=`
@media (forced-colors:none){
 @supports (clip-path:polygon(0 0,100% 0,100% 100%)){
  .qw-radical{color:transparent}
  .qw-radicand{position:relative;padding-block-start:.22em;padding-inline-end:.1em;color:var(--qw-math-ink,var(--qw-bank-ink,var(--qo-text,#111)))}
  .qw-radical-ink{--qw-root-rule:max(1px,.067em);position:absolute;left:-.52em;top:0;width:calc(100% + .52em);height:100%;background:currentColor;outline:1px solid currentColor;print-color-adjust:exact;pointer-events:none;
   clip-path:polygon(0 67.5%,.12em 63.5%,.25em 95%,.46em 0,100% 0,100% var(--qw-root-rule),.52em var(--qw-root-rule),.32em 100%,.24em 100%,.09em 69%,.02em 71.5%)}
 }
}
`;
const QW_PUBLISH_CSS=QW_RADICAL_CSS+`
:root{--qw-math-family:"QO Math","DejaVu Math TeX Gyre","Cambria Math",serif;--qw-task-marker:7mm;--qw-task-indent:2mm;--qw-task-text-leading:1.27;--qw-task-heading-gap:.8mm;--qw-task-paragraph-gap:.9mm}
.qw-paper-task.qw-standard-task{display:grid;grid-template-columns:var(--qw-task-marker) minmax(0,1fr);column-gap:var(--qw-task-indent);row-gap:0;align-items:start}
.qw-paper-task.qw-standard-task>.qw-task-heading{display:grid;grid-column:1/-1;grid-row:1;grid-template-columns:var(--qw-task-marker) minmax(0,1fr);column-gap:var(--qw-task-indent);align-items:center;margin:0 0 var(--qw-task-heading-gap);padding:0;width:auto;height:auto;border:0;min-width:0}
.qw-task-heading>.qw-task-marker{display:grid;place-items:center;box-sizing:border-box;width:var(--qw-task-marker);height:var(--qw-task-marker);padding:0;border:.22mm solid currentColor;font:700 10pt/1 "QO Print Serif",Georgia,serif;text-align:center}
.qw-booklet-bank-id{font:700 9.5pt/1.2 "QO Print Serif",Georgia,serif;white-space:nowrap}
.qw-task-heading>.qw-booklet-bank-id{display:block;justify-self:start;margin:0;color:inherit;text-box:trim-both cap alphabetic}
@supports not (text-box:trim-both cap alphabetic){.qw-task-heading>.qw-booklet-bank-id{padding-block-start:1.1pt}}
.qw-paper-task.qw-standard-task>:not(.qw-task-heading){grid-column:2;grid-row:auto;min-width:0}
.qw-standard-task :is(.qw-task-text,.qw-key-solutions){line-height:var(--qw-task-text-leading)}
.qw-standard-task :is(.qw-task-text,.qw-key-solutions) p:not(:last-child){margin:0 0 var(--qw-task-paragraph-gap)}
.qw-standard-task :is(.qw-task-text,.qw-key-solutions)>:first-child{margin-top:0}
.qw-standard-task :is(.qw-task-text,.qw-key-solutions)>p:last-child{margin-bottom:0}
.qw-standard-task :is(.qw-study-answer,.qw-booklet-answer){font-size:inherit;line-height:1.2}
:is(.qw-study-text,.qw-bank-solution-body,.qw-bank-rich-render,.qw-bank-equation-preview,.qw-paper-task,#qw-formula-preview) math{font-family:var(--qw-math-family);font-weight:400;font-synthesis:none;vertical-align:baseline}
.qw-answer-columns .qw-answer-item{grid-template-columns:6mm minmax(0,1fr);column-gap:1.2mm;align-items:baseline}
.qw-answer-item>.qw-print-number{font-weight:700;text-align:right;font-variant-numeric:lining-nums tabular-nums}
.qw-answer-item>.qw-answer-text{min-width:0;font-weight:400;font-synthesis:none;overflow-wrap:anywhere}
.qw-answer-item .qw-answer-text :is(b,strong,math,mi,mn,mo,mtext,.qw-booklet-bank-id){font-weight:400;font-synthesis:none}
.qw-answer-item .qw-answer-text>.qw-booklet-bank-id{margin-inline-end:1mm}
.qw-answer-item .qw-answer-text p{margin:0}
.qw-rich-table-scroll[data-publish-fluid]{width:100%}
.qw-rich-table-scroll[data-publish-fluid]>table{margin-inline:auto}
:is(.qw-rich,.qw-print-rich,.qw-task-tables,.qw-teacher-notes) table[data-publish-header]{font-size:var(--qw-table-font);max-width:100%;overflow-wrap:anywhere}
:is(.qw-rich,.qw-print-rich,.qw-task-tables,.qw-teacher-notes) table[data-publish-header] :is(td,th){text-align:var(--qw-table-align);padding:var(--qw-table-pad);border-width:var(--qw-table-border)}
:is(.qw-rich,.qw-print-rich,.qw-task-tables,.qw-teacher-notes) table[data-publish-header]:not([data-publish-header="shade"]) th{background:transparent}
:is(.qw-rich,.qw-print-rich,.qw-task-tables,.qw-teacher-notes) table[data-publish-header="plain"] th{font-weight:400}
`;
function qwPrintStyles(orientation='portrait',landscapeLayout='spread',mathFont=typeof QW_MATH_FONT_CSS==='string'?QW_MATH_FONT_CSS:''){return QW_PRINT_FONT_CSS+mathFont+`
@page{size:${orientation==='landscape'?'A4 landscape':'A4 portrait'};margin:0}
:root{--qw-print-family:"QO Print Sans",Arial,"Liberation Sans",sans-serif}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font:var(--qw-print-size,10.8pt)/1.35 var(--qw-print-family)}
.qw-print-document{margin:0;padding:0}
.qw-print-page{position:relative;width:210mm;height:297mm;padding:14mm 15mm 20mm;break-after:page;background:white}
.qw-print-page:last-child{break-after:auto}
.qw-page-content{display:flow-root;width:180mm;height:263mm}
.qw-page-footer{position:absolute;bottom:7mm;left:0;right:0;text-align:center;font:8pt/1.2 var(--qw-print-family);color:#000}
.qw-print-header{margin:0 0 4mm}
.qw-print-title{font-size:15pt;line-height:1.2;margin:0 0 2mm;font-weight:700}
.qw-print-topic{font-size:11pt;line-height:1.3;margin:0 0 1.5mm;font-weight:400}
.qw-print-meta{font-size:9pt;line-height:1.3;margin:0 0 3mm;color:#444}
.qw-print-intro{font-size:10pt;line-height:1.35;margin:0;white-space:pre-wrap}
.qw-print-section{display:flow-root;margin:0 0 2.2mm;break-inside:avoid}
.qw-paper-task{border:0;margin:0;padding:0;background:white;color:#000;overflow-wrap:anywhere}
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
math{font-family:var(--qw-math-family);font-size:1em;font-weight:400;font-synthesis:none;line-height:normal;vertical-align:baseline;margin:0;white-space:nowrap}
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
.qw-topic-title{font-size:12pt;line-height:1.25;margin:3mm 0 1.5mm;font-weight:700;break-after:avoid}
body[data-qw-format="compact"]{line-height:1.25}
body[data-qw-format="compact"] .qw-print-header{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:4mm;row-gap:.7mm;align-items:baseline;margin-bottom:1.2mm}
body[data-qw-format="compact"] .qw-print-title{font-size:12pt;line-height:1.2;margin:0;grid-column:1;grid-row:1}
body[data-qw-format="compact"] .qw-print-topic{font-size:10.5pt;line-height:1.2;font-weight:700;margin:0;grid-column:1/-1;grid-row:2}
body[data-qw-format="compact"] .qw-print-meta{font-size:8.5pt;line-height:1.2;margin:0;grid-column:2;grid-row:1}
body[data-qw-format="compact"] .qw-print-section{margin-bottom:.2mm;position:relative}
body[data-qw-format="compact"] .qw-page-content>.qw-print-section~.qw-print-section{padding-top:.4mm}
body[data-qw-format="compact"] .qw-page-content>.qw-print-section~.qw-print-section:before{content:"";position:absolute;top:0;left:0;right:0;height:1px;background:#e0e4e8;transform:scaleY(.4);transform-origin:top}
body[data-qw-format="compact"] .qw-topic-title{font-size:10.5pt;line-height:1.2;margin-top:1.2mm;margin-bottom:.7mm}
body[data-qw-format="compact"] .qw-print-header+.qw-print-section>.qw-topic-title{margin-top:0}
body[data-qw-format="compact"] .qw-compact-entry .qw-task-flow figure{margin-bottom:.35mm}
body[data-qw-format="compact"] math{math-style:normal}
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

/* TASK153: professional print booklet, using bundled OFL fonts. */
body[data-qw-format="booklet"]{--qw-print-family:"QO Print Serif",Georgia,serif;font-size:var(--qw-print-size,10pt);line-height:1.23}
body[data-qw-format="booklet"] .qw-print-page{padding:13mm 13mm 17mm}
body[data-qw-format="booklet"] .qw-page-content{width:184mm;height:267mm}
body[data-qw-format="booklet"] .qw-print-header{text-align:center;margin:0 0 6mm}
body[data-qw-format="booklet"] .qw-print-title{font:700 14pt/1.2 "QO Print Sans",Arial,sans-serif;margin:0 0 2mm}
body[data-qw-format="booklet"] .qw-print-topic{font-size:11pt;line-height:1.25;margin:1mm 0 0}
body[data-qw-format="booklet"] .qw-print-meta{font:9pt/1.3 "QO Print Sans",Arial,sans-serif;color:#444;margin:0 0 2.5mm}
.qw-booklet-variant{font:700 13pt/1.25 "QO Print Serif",Georgia,serif;margin:1mm 0 0}
body[data-qw-format="booklet"] .qw-print-section{margin:0 0 5mm;break-inside:avoid}
body[data-qw-format="booklet"] .qw-print-section:before{content:none}
body[data-qw-format="booklet"] .qw-compact-entry{grid-template-columns:8mm minmax(0,1fr);column-gap:3mm;row-gap:0}
body[data-qw-format="booklet"] .qw-booklet-entry .qw-task-flow{line-height:var(--qw-task-text-leading);min-height:0}
body[data-qw-format="booklet"] .qw-task-text{overflow-wrap:normal;word-break:normal;hyphens:none;text-align:left}
body[data-qw-format="booklet"] .qw-booklet-entry .qw-task-flow figure{margin:0 0 1.2mm 4mm}
body[data-qw-format="booklet"] .qw-booklet-entry .qw-figure-below figure{float:none!important;display:block;margin:2mm auto 0!important;max-width:100%}
body[data-qw-format="booklet"] .qw-booklet-answer{display:flex;align-items:baseline;gap:1mm;margin:1.5mm 0 0;font:inherit;break-inside:avoid}
body[data-qw-format="booklet"] .qw-booklet-answer span{display:inline-block;width:52mm;border-bottom:.22mm solid #555;min-width:20mm;height:4.5mm}
body[data-qw-format="booklet"] .qw-booklet-answer{white-space:nowrap}
body[data-qw-format="booklet"] .qw-booklet-answer-by-figure .qw-booklet-answer{min-width:0;align-items:baseline}
body[data-qw-format="booklet"] .qw-booklet-answer-by-figure .qw-booklet-answer span{width:auto;min-width:12mm;max-width:52mm;flex:1 1 auto}
body[data-qw-format="booklet"] math{math-style:normal}
body[data-qw-format="booklet"] math :is(mi,mn,mo,mtext){font-weight:400}
/* The default answer stays in normal flow after the condition and figure.
   Only measured-safe short text uses a two-column grid, allowing the answer
   to align to the lower figure edge without overlapping the condition. */
body[data-qw-format="booklet"] .qw-booklet-entry .qw-task-flow.qw-booklet-answer-by-figure{
 display:grid!important;grid-template-columns:minmax(0,1fr) auto;
 grid-template-rows:auto minmax(0,1fr);column-gap:4mm;row-gap:0;align-items:start
}
body[data-qw-format="booklet"] .qw-booklet-answer-by-figure .qw-task-text{
 grid-column:1;grid-row:1;min-width:0
}
body[data-qw-format="booklet"] .qw-booklet-answer-by-figure figure{
 grid-column:2;grid-row:1 / span 2;justify-self:center;align-self:start;
 float:none!important;margin:0!important
}
body[data-qw-format="booklet"] .qw-booklet-answer-by-figure .qw-booklet-answer{
 grid-column:1;grid-row:2;align-self:end;margin:0!important;padding-bottom:.5mm
}

body[data-qw-format="booklet"] .qw-booklet-entry .qw-booklet-answer{justify-self:start;min-width:0}
.qw-task-tables{clear:both;display:flex;flex-direction:column;align-items:center;gap:1.5mm;width:100%;margin:1.5mm auto 0}
.qw-task-tables table{border-collapse:collapse;max-width:100%;width:auto;table-layout:auto;font:inherit;overflow-wrap:anywhere}
.qw-task-tables :is(th,td){padding:.8mm 1.8mm;vertical-align:middle}


/* TASK165: author text formatting is shared by bank preview and printed PDF.
   Compact plain-text exercises do not get these rules. */
.qw-task-text.qw-print-rich {min-width:0;line-height:1.36}
.qw-print-rich p{margin:0 0 1.25mm;orphans:2;widows:2}
.qw-print-rich p:last-child{margin-bottom:0}
.qw-print-rich :is(h3,h4,h5,h6){font:700 1em/1.25 var(--qw-print-family);margin:2mm 0 .8mm;break-after:avoid}
.qw-print-rich :is(h3,h4,h5,h6):first-child{margin-top:0}
.qw-print-rich :is(ul,ol){padding-left:5mm;margin:1mm 0 1.7mm;line-height:1.3}
.qw-print-rich li{padding-left:.2mm;margin:.4mm 0}
.qw-print-rich blockquote{border-left:.55mm solid #8d969d;padding:.7mm 2mm;margin:1.3mm 0 1.7mm;break-inside:avoid}
.qw-print-rich blockquote p{margin:0}
.qw-print-rich code{font-family:'Courier New',monospace;font-size:.9em;background:#f2f2f2;overflow-wrap:anywhere}
.qw-print-rich pre{white-space:pre-wrap;overflow-wrap:anywhere;font:9pt/1.3 'Courier New',monospace;margin:1.2mm 0 2mm;padding:2mm;background:#f5f5f5;break-inside:avoid}
.qw-print-rich hr{border:0;border-top:.2mm solid #aaa;margin:2mm 0}
.qw-print-rich .qw-rich-equation{text-align:center;max-width:100%;margin:1.3mm 0;break-inside:avoid}
.qw-print-rich .qw-rich-equation math{max-width:100%}
.qw-print-rich .qw-rich-table-scroll{max-width:100%;overflow:visible;margin:1.2mm auto}
body[data-qw-format="answers"] .qw-print-rich .qw-rich-table-scroll{display:flex;justify-content:center;break-inside:avoid}
.qw-print-rich table,.qw-task-tables table{border-collapse:collapse;max-width:100%;width:auto;table-layout:auto;font:inherit;break-inside:avoid}
.qw-print-rich :is(th,td),.qw-task-tables :is(th,td){border:.2mm solid #888;padding:.7mm 1.5mm;text-align:left;vertical-align:middle;overflow-wrap:anywhere}
.qw-print-rich th,.qw-task-tables th{font-weight:700;background:#f1f1f1}
.qw-answer-long .qw-print-answer-heading{font:700 1em/1.25 var(--qw-print-family);margin:2.3mm 0 1mm;break-after:avoid}
.qw-answer-long .qw-print-answer-heading:first-child{margin-top:0}
body:is([data-qw-format="compact"],[data-qw-format="booklet"],[data-qw-format="answers"]) .qw-print-rich p{margin-bottom:.75mm}
body:is([data-qw-format="compact"],[data-qw-format="booklet"],[data-qw-format="answers"]) .qw-print-rich :is(ul,ol){margin:.5mm 0 .9mm}
body[data-qw-format="answers"] .qw-answer-long{font:var(--qw-print-size,10pt)/1.25 var(--qw-print-family)}
.qw-answer-caption{margin:1mm 0;overflow-wrap:anywhere}
.qw-answer-caption p{display:inline;margin:0}
.qw-answer-caption .qw-rich-equation{display:inline-block;vertical-align:middle;margin:0 .5mm}
.qw-answer-caption .qw-rich-equation math{display:inline-math}
.qw-key-solutions{grid-column:2;clear:both;margin:1.4mm 0 0;padding:0;border:0;background:transparent;font:inherit}
/* TASK154 — one typographic system for all exported document formats. */
body{--qw-print-family:"QO Print Serif",Georgia,serif;--qw-title-family:"QO Print Sans",Arial,sans-serif;--qw-math-ink:var(--qw-body-color,#000);color:var(--qw-math-ink)}
body[data-qw-font="sans"]{--qw-print-family:"QO Print Sans",Arial,sans-serif}
body[data-qw-font="serif"]{--qw-print-family:"QO Print Serif",Georgia,serif}
body[data-qw-title-font="serif"]{--qw-title-family:"QO Print Serif",Georgia,serif}
body[data-qw-title-font="sans"]{--qw-title-family:"QO Print Sans",Arial,sans-serif}
body[data-qw-title-custom="true"] .qw-print-title{font-family:var(--qw-title-family);font-size:var(--qw-title-size,14pt);font-weight:700;color:var(--qw-title-color,#000);text-align:var(--qw-title-align,center);line-height:1.23;max-width:100%;overflow-wrap:break-word}
body[data-qw-title-custom="true"] .qw-print-header{text-align:var(--qw-title-align,center)}
body[data-qw-format] .qw-paper-task{color:var(--qw-math-ink)}
body[data-qw-math-custom="true"] math{math-style:normal}
body[data-qw-math-custom="true"] math :is(mi,mn,mo,mtext){font-weight:400}
body[data-qw-show-pages="false"] .qw-page-footer{display:none}
body:not([data-qw-format="booklet"]) .qw-page-footer{font-family:"QO Print Sans",Arial,sans-serif}
body[data-qw-format="compact"] .qw-print-header{grid-template-columns:minmax(0,1fr) auto;align-items:center}
body[data-qw-format="worksheet"] .qw-print-section{margin-bottom:3mm}

/* TASK155: physical A4 geometry; preserve consistent margins in either orientation. */
body[data-qw-orientation="landscape"] .qw-print-page{width:297mm;height:210mm}
body[data-qw-orientation="landscape"] .qw-page-content{width:267mm;height:176mm}
body[data-qw-format="booklet"][data-qw-orientation="landscape"] .qw-print-page{width:297mm;height:210mm;padding:13mm 13mm 17mm}
body[data-qw-format="booklet"][data-qw-orientation="landscape"] .qw-page-content{width:271mm;height:180mm}

/* TASK156: A4 landscape spread is two independent, portrait-proportioned pages.
   One physical 297x210mm sheet contains two logical 148.5x210mm pages. */
body[data-qw-orientation="landscape"][data-qw-landscape-layout="spread"] .qw-print-sheet{
 display:flex;flex-direction:row;align-items:stretch;width:297mm;height:210mm;
 margin:0;padding:0;break-after:page;page-break-after:always;background:#fff;
}
body[data-qw-orientation="landscape"][data-qw-landscape-layout="spread"] .qw-print-sheet:last-child{
 break-after:auto;page-break-after:auto;
}
body[data-qw-orientation="landscape"][data-qw-landscape-layout="spread"] .qw-print-page,
body[data-qw-orientation="landscape"][data-qw-landscape-layout="spread"][data-qw-format="booklet"] .qw-print-page{
 box-sizing:border-box;flex:0 0 148.5mm;width:148.5mm;height:210mm;
 padding:12mm 9mm 15mm;margin:0;break-after:auto;page-break-after:auto;box-shadow:none;
}
body[data-qw-orientation="landscape"][data-qw-landscape-layout="spread"] .qw-page-content,
body[data-qw-orientation="landscape"][data-qw-landscape-layout="spread"][data-qw-format="booklet"] .qw-page-content{
 box-sizing:border-box;width:130.5mm;height:183mm;
}
body[data-qw-orientation="landscape"][data-qw-landscape-layout="spread"] .qw-page-footer{
 bottom:5mm;left:9mm;right:9mm;
}
body[data-qw-orientation="landscape"][data-qw-landscape-layout="spread"] .qw-print-header{
 margin:0 0 4mm;
}
@media screen{
 body[data-qw-orientation="landscape"][data-qw-landscape-layout="spread"] .qw-print-sheet{
  margin:0 auto 12px;box-shadow:0 2px 8px #1f2b3740;
 }
}
@media print{
 body[data-qw-orientation="landscape"][data-qw-landscape-layout="spread"] .qw-print-sheet{
  margin:0;box-shadow:none;
 }
}

/* TASK158: shared first-sheet heading, centered over BOTH independent columns. */
body[data-qw-orientation="landscape"][data-qw-landscape-layout="spread"] .qw-print-sheet{position:relative}
body[data-qw-orientation="landscape"][data-qw-landscape-layout="spread"] .qw-print-sheet.qw-first-sheet .qw-page-content{
 padding-top:var(--qw-shared-heading-clearance,0px);
}
body[data-qw-orientation="landscape"][data-qw-landscape-layout="spread"] .qw-shared-sheet-header{
 position:absolute;z-index:2;box-sizing:border-box;
 left:42mm;right:42mm;top:10mm;width:auto;margin:0;
 text-align:center;pointer-events:none;
}
body[data-qw-orientation="landscape"][data-qw-landscape-layout="spread"] .qw-shared-sheet-header .qw-print-title{
 margin:0 0 1.5mm;line-height:1.15;
}

/* Final print design: portrait one column; landscape two columns with one physical footer. */
body[data-qw-format="booklet"] .qw-print-page{padding:10mm 9mm 10mm}
body[data-qw-format="booklet"] .qw-page-content{width:192mm;height:277mm}
body[data-qw-format="booklet"] .qw-print-header{margin-bottom:4.5mm}
body[data-qw-format="booklet"] .qw-print-section{margin-bottom:5.25mm}
body[data-qw-format="booklet"] .qw-compact-entry{grid-template-columns:7mm minmax(0,1fr);column-gap:2mm}
body[data-qw-format="booklet"] .qw-task-text.qw-print-rich{line-height:var(--qw-task-text-leading)}
body[data-qw-format="booklet"] .qw-booklet-entry .qw-task-flow figure{margin:0 0 1mm 3mm}
body[data-qw-format="booklet"] .qw-booklet-entry .qw-figure-left figure{margin:0 3mm 1mm 0}
body[data-qw-format="booklet"] .qw-booklet-entry .qw-figure-below figure{margin:1.5mm auto 0!important}
body[data-qw-format="booklet"] .qw-booklet-answer{margin:.8mm 0 0;font-size:inherit;line-height:1.2}
body[data-qw-format="booklet"] .qw-booklet-answer span{height:3.3mm}
body[data-qw-format="booklet"] .qw-booklet-answer-by-figure .qw-booklet-answer{justify-self:stretch;min-width:0}
body[data-qw-format="booklet"] .qw-booklet-answer-by-figure.qw-booklet-answer-near .qw-booklet-answer{align-self:start;margin:.8mm 0 0!important}
.qw-task-tables{clear:both;margin:1.2mm auto;break-inside:avoid}
.qw-task-tables :is(th,td),.qw-print-rich :is(th,td){padding:.5mm 1.2mm;border:.18mm solid #555}
.qw-print-rich .qw-rich-table-scroll{clear:both;break-inside:avoid}
body[data-qw-orientation="landscape"][data-qw-landscape-layout="spread"][data-qw-format="booklet"] .qw-print-sheet>.qw-print-page{padding:10mm 3mm 10mm 9mm}
body[data-qw-orientation="landscape"][data-qw-landscape-layout="spread"][data-qw-format="booklet"] .qw-print-sheet>.qw-print-page+.qw-print-page{padding:10mm 9mm 10mm 3mm}
body[data-qw-orientation="landscape"][data-qw-landscape-layout="spread"][data-qw-format="booklet"] .qw-page-content{width:136.5mm;height:190mm}
body[data-qw-orientation="landscape"][data-qw-landscape-layout="spread"] .qw-shared-sheet-header{left:9mm;right:9mm}
.qw-print-sheet>.qw-page-footer,body[data-qw-format="booklet"] .qw-page-footer{bottom:3mm;left:0;right:0;font:7.5pt/1.2 var(--qw-print-family)}
.qw-print-error{margin:12mm;color:#981b1b;font-size:11pt}
@media screen{html{background:#e8edf2}body{padding:12px}.qw-print-page{margin:0 auto 12px;box-shadow:0 2px 8px #1f2b3740}}
@media print{.qw-print-page{margin:0;box-shadow:none}}
`+qwPrintThemeStyles()+QW_PUBLISH_CSS;}
async function qwPreparePrintDocument(){
 // A blocked stylesheet must never produce a seemingly successful unstyled PDF.
 const printBody=document.body;
 if(!getComputedStyle(printBody).getPropertyValue('--qw-print-family').trim())throw Error('Не загружены стили печатного макета');
 await document.fonts.ready;
 const existing=document.getElementById('qw-print-layout-report');
 if(existing){window.__qwPrintLayout=JSON.parse(existing.textContent);return window.__qwPrintLayout;}
 // Include task identity in image failures; never silently drop a bad asset.
 await Promise.all([...document.images].map(async(img,index)=>{
  try{await img.decode();if(!img.naturalWidth||!img.naturalHeight)throw Error('zero dimensions');}
  catch(error){const task=img.closest('[data-task]')?.dataset.task||'?';throw Error('Иллюстрация задания '+task+' (#'+(index+1)+', '+(img.getAttribute('src')||'').slice(0,40)+'): '+error.message);}
 }));
 const host=document.querySelector('.qw-print-document'),source=host.querySelector('.qw-print-source');
 const header=source.querySelector('.qw-print-header'),originals=[...source.querySelectorAll(':scope>.qw-print-section')];
 const hasObjectStyles=!!source.querySelector('figure[data-publish-width],table[data-publish-header]');
 const MM=96/25.4,pages=[],fragments=[],format=document.body.dataset.qwFormat||'worksheet',modern=['compact','practice','answers','booklet'].includes(format),landscape=document.body.dataset.qwOrientation==='landscape',spread=landscape&&document.body.dataset.qwLandscapeLayout!=='wide';
 // display="block" MathML occupies its entire parent box even when the ink is narrow.
 // Measure the mathematical child, not the full-width display container.
 const mathInkWidth=math=>((math.getAttribute('display')==='block'?math.firstElementChild:null)||math).getBoundingClientRect().width;
 // Figure geometry follows the actual A4 printable width, not a portrait-only ruler.
 source.style.width=spread?(format==='booklet'?'136.5mm':'130.5mm'):landscape?(format==='booklet'?'271mm':'267mm'):(format==='booklet'?'192mm':modern?'186mm':'180mm');const contentWidth=source.getBoundingClientRect().width;
 for(const section of originals){
  // Attribute colours keep monochrome diagrams vector; CSS filters rasterise in Chromium.
  if(document.body.dataset.qwMonochrome==='true')for(const e of section.querySelectorAll('svg [stroke],svg [fill]'))for(const key of ['stroke','fill']){
   const value=e.getAttribute(key);if(!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value||''))continue;
   const hex=value.length===4?value.slice(1).split('').map(c=>c+c).join(''):value.slice(1),rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
   const gray=Math.round(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722);e.setAttribute(key,'#'+gray.toString(16).padStart(2,'0').repeat(3));
  }

  const flow=section.querySelector('.qw-task-flow'),figure=flow.querySelector('figure');
  const text=section.querySelector('.qw-task-text');
  // Tables are atomic blocks in the original condition, not extracted tails.
  const tables=[...text.querySelectorAll('table')];
  if(tables.length&&(format!=='answers'||section.hasAttribute('data-qw-key-condition'))){
   for(const table of tables){
    const node=table.closest('.qw-rich-table-scroll')||table;
    const group=document.createElement('div');group.className='qw-task-tables';
    node.before(group);group.append(node);
   }
   if(figure)flow.classList.add('qw-figure-below');
  }
  flow.classList.toggle('qw-print-has-figure',!!figure);
  if(figure){
   const svg=figure.querySelector('svg');let w,h;
   if(svg){const box=qwMeasureSVGInk(svg);svg.setAttribute('viewBox',[box.x,box.y,box.width,box.height].join(' '));w=box.width;h=box.height;figure.dataset.inkBox=JSON.stringify(box);}
   else {const img=figure.querySelector('img');w=img.naturalWidth;h=img.naturalHeight;}
   let wide=flow.classList.contains('qw-figure-below');
   const custom=figure.hasAttribute('data-publish-width');
   const available=flow.getBoundingClientRect().width;
   const requested=custom?Math.min(available*Number(figure.dataset.publishWidth)/100,Number(figure.dataset.publishMax)*MM):Number(figure.dataset.requestedWidth)||220;
   const manual=figure.dataset.widthMode==='manual';
   const graph=figure.dataset.figureKind==='graph',auto=flow.classList.contains('qw-figure-auto');
   // Booklet uses requested width as a ceiling, with proportionate automatic
   // limits. Never enlarge an ordinary graph to a fixed 85 mm below the text.
   const compactBooklet=format==='booklet';
   const widthLimit=below=>custom?Math.max(1,Math.min(requested,below?available:available*.50-2*MM)):manual?
    Math.max(1,Math.min(requested,below?available-2*MM:modern?available-Math.max(38*MM,available*.48)-3*MM:65*MM)):
    compactBooklet?
    Math.min(requested,available*(below?1:(graph?.45:.35))-(below?1*MM:0)):
    modern?(below?Math.min(available-2*MM,graph?Math.max(requested,85*MM):requested):
    (format==='practice'?55:graph?55:40)*MM):
    below?(requested>=470?180*MM:Math.min(requested,180*MM)):Math.min(requested,65*MM);
   const heightLimit=below=>custom?(below?125:60)*MM:manual?(below?160:60)*MM:compactBooklet?
    Math.min(requested, (below?95:60)*MM):
    modern?(below?70:format==='practice'?35:34)*MM:
    below?(requested>=470?160*MM:requested*320/520):38*MM;
   const fontSizes=(modern||manual)&&svg?[...svg.querySelectorAll('text:not([data-qw-axis-art] text),[data-qw-axis-art]')].filter(e=>e.textContent.trim())
    .map(e=>parseFloat(getComputedStyle(e).fontSize)).filter(n=>n>0):[];
   const minLabelScale=fontSizes.length?(graph?8.8:7.4)/Math.min(...fontSizes):0;
   const calculate=below=>Math.min(widthLimit(below)/w,heightLimit(below)/h);
   let scale=calculate(wide);
   if(!custom&&!manual&&modern&&graph&&!wide&&!compactBooklet&&svg)scale=48*MM/369;
   if(custom&&auto&&requested>widthLimit(false))wide=true;
   if(!custom&&manual&&!wide&&(requested>widthLimit(false)||scale<minLabelScale))wide=true;
   if(compactBooklet&&!wide){
    const minimumText=Math.max(38*MM,available*.48);
    const sideWidth=w*scale;
    const insufficientLabels=!custom&&scale<minLabelScale;
    const tooWide=available-sideWidth-3*MM<minimumText;
    if(tooWide||insufficientLabels||(auto&&w/h>2.5))wide=true;
   }
   if(modern&&auto&&!wide&&!compactBooklet)wide=w/h>3.2||w*scale>contentWidth*.45;
   if(wide)scale=calculate(true);
   if(!custom&&(modern||manual)&&svg&&fontSizes.length){
    // Readability can require a wider below-text rendering, never a new
    // geometry in QWORK. The original requested size remains unchanged.
    scale=Math.max(scale,minLabelScale);
    if(w*scale>available-2*MM)throw Error('Подписи рисунка не помещаются: сократите подписи или разделите рисунок.');
   }
   const position=wide?'below':flow.classList.contains('qw-figure-left')?'left':'right';
   flow.classList.remove('qw-figure-auto','qw-figure-left','qw-figure-right','qw-figure-below');flow.classList.add('qw-figure-'+position);
   if(modern&&!wide)flow.prepend(figure);
   figure.style.width=w*scale+'px';figure.style.height=h*scale+'px';
   figure.dataset.printPosition=position;
   if(custom){
    const gap=figure.dataset.publishGap+'mm';
    const alignment=figure.dataset.publishAlign;
    figure.style.setProperty('margin',position==='below'?gap+' '+(alignment==='right'?'0':'auto')+' 0 '+(alignment==='left'?'0':'auto'):'0 0 0 '+gap,'important');
    figure.style.justifySelf=position==='below'?({left:'start',right:'end',center:'center'}[alignment]):'end';
   }
   if(custom&&graph&&svg)for(const item of svg.querySelectorAll('[stroke-width]:not(text)')){
    const design=Number(item.getAttribute('stroke-width'));if(!design)continue;
    const grid=item.hasAttribute('data-qw-grid-line'),min=grid?.25:.7,max=grid?.45:1.9;
    item.setAttribute('stroke-width',Math.max(min,Math.min(max,design*scale))/scale);
   }
   if(graph&&svg)for(const label of svg.querySelectorAll('.qw-axis-title,.qw-axis-number')){
    const artworkSize=Number(label.getAttribute('font-size'));
    const min=label.classList.contains('qw-axis-title')?9:8,max=label.classList.contains('qw-axis-title')?13:11;
    const target=Math.max(min,Math.min(max,artworkSize*scale));
    const art=label.querySelector('[data-qw-axis-art]');
    if(art)art.setAttribute('transform','scale('+target/(scale*artworkSize)+')');
    else label.setAttribute('font-size',target/scale);
    if(custom||artworkSize*scale>max)label.dataset.qwDisplayFont=target.toFixed(1);
   }
  }
  if(format==='answers'&&text.classList.contains('qw-answer-columns')&&[...text.querySelectorAll('.qw-answer-item math')].some(m=>m.getBoundingClientRect().width>m.closest('.qw-answer-item').getBoundingClientRect().width))text.style.gridTemplateColumns='1fr';
  if(!modern&&!figure&&!section.querySelector('.qw-solution-preview')&&text.getBoundingClientRect().height<=parseFloat(getComputedStyle(text).lineHeight)*2+1)section.classList.add('qw-compact-task');
  // A wide indivisible expression gets the whole text width, without modifying QWORK.
  if(figure&&!flow.classList.contains('qw-figure-below')&&[...text.querySelectorAll('math')].some(m=>mathInkWidth(m)>(format==='booklet'?flow.getBoundingClientRect().width-figure.getBoundingClientRect().width-3*MM:modern?contentWidth-7*MM-figure.getBoundingClientRect().width-3*MM:text.getBoundingClientRect().width))){
   flow.classList.remove('qw-figure-right','qw-figure-left');flow.classList.add('qw-figure-below');section.dataset.layoutReason='wide-formula';
   if(modern)flow.append(figure);
  }
  // Reuse figure's lower level only when the rendered text plus answer
  // fits safely inside the *actual* narrowed left column. Long text and all
  // below-figure layouts retain the normal answer-after-flow fallback.
  if(format==='booklet'&&figure&&flow.classList.contains('qw-figure-right')&&!tables.length){
   const answer=section.querySelector('.qw-booklet-answer');
   if(answer){
    const available=flow.getBoundingClientRect().width-figure.getBoundingClientRect().width-4*MM;
    if(available>37*MM){
     const probe=text.cloneNode(true);
     probe.style.cssText='position:absolute;visibility:hidden;float:none;width:'+available+'px;height:auto;max-width:none;';
     flow.append(probe);
     const textHeight=probe.getBoundingClientRect().height;probe.remove();
     const answerHeight=answer.getBoundingClientRect().height;
     const figureHeight=figure.getBoundingClientRect().height;
     if(textHeight+answerHeight+2*MM<=figureHeight-2){
      flow.append(answer);flow.classList.add('qw-booklet-answer-by-figure');
      // Align near the figure's bottom only if the gap after the condition is small.
      flow.classList.toggle('qw-booklet-answer-near',!figure.hasAttribute('data-publish-width')&&figureHeight-textHeight-answerHeight>5*MM);
      // If font metrics changed on activation, do not retain an unsafe layout.
      const textBottom=text.getBoundingClientRect().bottom,answerTop=answer.getBoundingClientRect().top;
      if(answerTop<textBottom+.5*MM){
       flow.classList.remove('qw-booklet-answer-by-figure','qw-booklet-answer-near');
       section.querySelector('.qw-booklet-entry').append(answer);
      }
     }
    }
   }
  }
  if(figure&&!flow.classList.contains('qw-figure-below')){
   const answer=section.querySelector('.qw-answer-preview'),notes=section.querySelector('.qw-teacher-notes');
   if(answer)text.append(answer);if(notes&&format!=='answers')text.append(notes);
  }
  if([...text.querySelectorAll('math')].some(m=>mathInkWidth(m)>contentWidth-(modern?7*MM:0)))throw Error('Формула шире страницы: разделите выражение.');
 }
 const brand=header.querySelector('.qw-print-brand');brand?.remove();
 function newPage(){
  if(pages.length>=80)throw Error('Работа превышает 80 страниц');
  const page=document.createElement('section');page.className='qw-print-page';
  const content=document.createElement('div');content.className='qw-page-content';page.append(content);
  if(spread){
   // Paginate into logical columns, but decorate the physical A4 sheet exactly once.
   let sheet=host.querySelector(':scope > .qw-print-sheet:last-of-type');
   const isNew=!sheet||sheet.querySelectorAll(':scope > .qw-print-page').length>=2;
   if(isNew){
    sheet=document.createElement('section');sheet.className='qw-print-sheet';host.append(sheet);
    if(brand)sheet.append(brand.cloneNode(true));
    if(!pages.length){
     sheet.classList.add('qw-first-sheet');
     if(header.childElementCount){
      header.classList.add('qw-shared-sheet-header');
      sheet.append(header);
     }
    }
   }
   sheet.append(page);
   // Both columns on the first sheet reserve the SAME header height.
   if(!pages.length&&sheet.contains(header)&&header.childElementCount){
    const headerBottom=header.getBoundingClientRect().bottom;
    const contentTop=content.getBoundingClientRect().top;
    const clearance=Math.max(0,Math.ceil(headerBottom-contentTop+(format==='booklet'?4.5:2)*MM));
    sheet.style.setProperty('--qw-shared-heading-clearance',clearance+'px');
   }
  }else{
   if(!pages.length)content.append(header);
   if(brand)page.append(brand.cloneNode(true));
   host.append(page);
  }
  pages.push({page,content});return pages.at(-1);
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
  const answer=original.querySelector('.qw-answer-preview,.qw-booklet-answer'),teacher=original.querySelector('.qw-teacher-notes');
  answer?.remove();teacher?.remove();flow.classList.remove('qw-booklet-answer-by-figure','qw-booklet-answer-near');const items=tokens(text);
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
 // Balance an unpaired final column without changing order, page count,
 // explicit breaks or the historical pagination of legacy QWORK files.
 if(spread&&format==='booklet'&&hasObjectStyles){
  const last=pages.at(-1),sheet=last?.page.parentElement;
  const tasks=last?[...last.content.querySelectorAll(':scope>.qw-print-section')]:[];
  if(sheet?.querySelectorAll(':scope>.qw-print-page').length===1&&tasks.length>=4&&
     tasks.every(task=>task.dataset.explicitBreak!=='true'&&task.dataset.continuation!=='true'&&!task.classList.contains('qw-long-fragment'))){
   const heights=tasks.map(task=>task.getBoundingClientRect().height+parseFloat(getComputedStyle(task).marginBottom));
   const half=heights.reduce((total,height)=>total+height,0)/2;
   let usedHeight=0,cut=1,difference=Infinity;
   for(let i=0;i<tasks.length-1;i++){
    usedHeight+=heights[i];const distance=Math.abs(usedHeight-half);
    if(distance<difference){difference=distance;cut=i+1;}
   }
   newPage().content.append(...tasks.slice(cut));
  }
 }
 source.remove();
 const physical=spread?[...host.querySelectorAll(':scope>.qw-print-sheet')]:pages.map(p=>p.page);
 for(const [i,sheet] of physical.entries()){
  const footer=document.createElement('footer');footer.className='qw-page-footer';
  footer.textContent=format==='booklet'?String(i+1):(i+1)+' / '+physical.length;
  sheet.append(footer);
 }
 // Recenter manually placed text and axis titles in their actual final print
 // viewport, after figure sizing, column moves, and font activation.
 for(const svg of host.querySelectorAll('.qw-print-section figure svg'))qwAlignSVGText(svg);
 const report={layout:spread?'spread':landscape?'wide':'portrait',sheets:physical.length,
 pages:pages.map(({page,content},i)=>{
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
export {qwAlignSVGText,qwMeasureSVGInk,qwPrintStyles,qwPreparePrintDocument,QW_PUBLISH_CSS};
