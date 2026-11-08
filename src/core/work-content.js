/* A bounded mathematical syntax shared by MathML preview and PDF canvas layout. */
import {qwGraphGridStep,qwEvaluateCurve,qwGeometryVertices,qwValidateStyle,qwResolveDiagram,QW_PLOT,qwPlotXY} from './work-model.js';
import {qwArcPoints,qwLinearSegments,qwExtendedSegment} from './work-geometry.js';
import {qwLabelSVG,qwPlaceSVGLabels} from './work-labels.js';
const QW_GREEK={alpha:'α',beta:'β',gamma:'γ',delta:'δ',epsilon:'ε',zeta:'ζ',eta:'η',iota:'ι',kappa:'κ',nu:'ν',xi:'ξ',tau:'τ',upsilon:'υ',chi:'χ',psi:'ψ',Gamma:'Γ',Theta:'Θ',Lambda:'Λ',Pi:'Π',Sigma:'Σ',Phi:'Φ',Psi:'Ψ',Delta:'Δ',theta:'θ',lambda:'λ',mu:'μ',pi:'π',rho:'ρ',sigma:'σ',phi:'φ',omega:'ω',Omega:'Ω',cdot:'·',times:'×',pm:'±',le:'≤',ge:'≥',neq:'≠',infty:'∞'};
function qwEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function qwMath(source){
 const s=String(source);if(!s.trim()||s.length>600)throw Error('Формула должна содержать 1–600 символов');let i=0;
 const plain=n=>n.t==='text'?n.v:n.t==='row'?n.list.map(plain).join(''):'';
 function command(depth){
  const match=s.slice(i).match(/^[A-Za-z]+/);if(!match)return {t:'text',v:s[i++]||''};
  i+=match[0].length;const key=match[0];
  if(key==='frac')return {t:'frac',a:atom(depth),b:atom(depth)};
  if(key==='sqrt')return {t:'sqrt',a:atom(depth)};
  if(key==='mathrm'||key==='text')return {t:'upright',a:atom(depth)};
  return {t:'text',v:key==='circ'?'°':QW_GREEK[key]||key};
 }
 function group(depth=0,end=''){
  if(depth>12)throw Error('Слишком глубокая формула');const list=[];
  while(i<s.length&&s[i]!==end){let node;const c=s[i++];
   if(c==='{'){node=group(depth+1,'}');if(s[i++]!=='}')throw Error('Закройте скобку формулы');}
   else if(c==='\\')node=command(depth+1);
   else if(c==='^'||c==='_'){
    const prior=list.pop()||{t:'text',v:''},arg=atom(depth+1);
    node=c==='^'&&plain(arg)==='°'?{t:'row',list:[prior,{t:'text',v:'°'}]}:{t:c==='^'?'sup':'sub',a:prior,b:arg};
   }else if(c==='}')throw Error('Лишняя скобка формулы');else node={t:'text',v:c};list.push(node);
  }return {t:'row',list};
 }
 function atom(depth){
  if(depth>12)throw Error('Слишком глубокая формула');while(s[i]===' ')i++;
  if(s[i]==='{'){i++;const n=group(depth,'}');if(s[i++]!=='}')throw Error('Закройте скобку формулы');return n;}
  if(i>=s.length)throw Error('Заполните аргумент формулы');if(s[i]==='\\'){i++;return command(depth+1);}return {t:'text',v:s[i++]};
 }
 const result=group();if(i<s.length)throw Error('Некорректная формула');return result;
}
function qwMathIsUnary(list,index){
 const node=list[index];if(node.t!=='text'||!/^[-−+±]$/.test(node.v))return false;
 let previous=index-1;while(previous>=0&&list[previous].t==='text'&&/^\s+$/.test(list[previous].v))previous--;
 return previous<0||(list[previous].t==='text'&&/^[([{=+−\-×÷·<>≤≥≠,;:]$/.test(list[previous].v));
}
function qwMathML(n,upright=false,unary=false){
 const tag=(k,v)=>'<'+k+'>'+v+'</'+k+'>';
 if(n.t==='row')return tag('mrow',n.list.map((v,i)=>qwMathML(v,upright,qwMathIsUnary(n.list,i))).join(''));
 if(n.t==='upright')return '<mstyle mathvariant="normal">'+qwMathML(n.a,true)+'</mstyle>';
 if(n.t==='frac')return tag('mfrac',qwMathML(n.a,upright)+qwMathML(n.b,upright));
 if(n.t==='sqrt')return tag('msqrt',qwMathML(n.a,upright));
 if(n.t==='sup'||n.t==='sub')return tag(n.t==='sup'?'msup':'msub',qwMathML(n.a,upright)+qwMathML(n.b,upright));
 const value=n.v==='-'?'−':n.v;
 if(upright)return tag('mtext',qwEsc(value));
 if(value==='°'||/^[()[\]{},.]$/.test(value)||unary)return '<mo lspace="0" rspace="0">'+qwEsc(value)+'</mo>';
 if(/[=+−\-×÷·±<>≤≥≠]/.test(value))return '<mo lspace="0.28em" rspace="0.28em">'+qwEsc(value)+'</mo>';
 if(/^\s+$/.test(value))return '<mspace width="0.18em"/>';
 return tag(/[0-9]/.test(value)?'mn':/[A-Za-zα-ωΑ-Ω]/.test(value)?'mi':'mo',qwEsc(value));
}
function qwTokens(text){const tokens=[];let start=0;const re=/\\\(([\s\S]*?)\\\)|\[\[blank:(\d{1,2})\]\]/g;let m;while((m=re.exec(text))){if(m.index>start)tokens.push({t:'text',v:text.slice(start,m.index)});if(m[1]!==undefined){try{tokens.push({t:'math',v:m[1],ast:qwMath(m[1])});}catch(e){tokens.push({t:'error',v:m[1],error:e.message});}}else tokens.push({t:'blank',size:Math.max(1,Math.min(30,Number(m[2])))});start=re.lastIndex;}if(start<text.length)tokens.push({t:'text',v:text.slice(start)});return tokens;}
function qwContentHTML(text){return qwTokens(text).map(t=>t.t==='math'?'<math xmlns="http://www.w3.org/1998/Math/MathML" aria-label="'+qwEsc(t.v)+'">'+qwMathML(t.ast)+'</math>':t.t==='blank'?'<span class="qw-inline-blank" style="width:'+t.size+'ch" aria-label="Место для ответа"></span>':t.t==='error'?'<span class="qw-formula-error" title="'+qwEsc(t.error)+'">'+qwEsc(t.v)+'</span>':qwEsc(t.v).replace(/\n/g,'<br>')).join('');}
/* Axes use true coordinate positions. Tick marks and labels have independent
   density: labels never determine the grid spacing or collide at the origin. */
function qwAxisLayout(g,axisFont){
 const b=QW_PLOT;
 const axisX=qwPlotXY(g,{x:Math.max(g.xmin,Math.min(g.xmax,0)),y:0}).x;
 const axisY=qwPlotXY(g,{x:0,y:Math.max(g.ymin,Math.min(g.ymax,0))}).y;
 const math=g.xmin<0&&g.xmax>0&&g.ymin<0&&g.ymax>0;
 const font=axisFont||(math?12:13);
 const ticks={x:[],y:[]};
 const zeroX=g.xmin<=0&&g.xmax>=0,zeroY=g.ymin<=0&&g.ymax>=0;
 for(const axis of ['x','y']){
  const min=g[axis+'min'],max=g[axis+'max'],step=qwGraphGridStep(g,axis);
  const span=max-min,pixels=axis==='x'?b.right-b.left:b.bottom-b.top;
  const longest=Math.max(String(Number(min.toPrecision(6))).length,String(Number(max.toPrecision(6))).length);
  const gap=pixels*step/span;
  const desired=axis==='x'?Math.max(17,longest*font*.59+5):font+6;
  const stride=Math.max(1,Math.ceil(desired/Math.max(1,gap)));
  let count=0;
  for(let n=Math.ceil((min-1e-8)/step);n*step<=max+step*.00001&&count++<30;n++){
   const v=Number((n*step).toPrecision(9));
   const p=qwPlotXY(g,{x:v,y:v});
   const isZero=Math.abs(v)<step*1e-7;
   let numbered=n%stride===0;
   // The shared origin receives exactly one 0, on X.
   if(axis==='y'&&isZero&&zeroX)numbered=false;
   if(axis==='x'&&isZero&&zeroY)numbered=true;
   const label=Object.is(v,-0)?'0':String(v);
   const w=Math.max(8,label.length*font*.63);
   if(axisFont&&!isZero){
    const first=Math.ceil((min-1e-8)/step),last=Math.floor((max+step*.00001)/step),edge=n===first||n===last;
    const nearEdge=!edge&&Math.min(n-first,last-n)*gap<desired;
    const nearZero=(axis==='x'?zeroX:zeroY)&&Math.abs(v)/span*pixels<(w+font*.63)/2+5;
    numbered=!nearZero&&!nearEdge&&(edge||numbered);
   }
   ticks[axis].push({value:v,pos:axis==='x'?p.x:p.y,label,numbered,w});
  }
 }
 return {axisX,axisY,font,ticks,math};
}
function qwGraphSVG(g,interactive=false,typography={}){
 const b=QW_PLOT,parts=[],occupied=[],layout=qwAxisLayout(g,typography.axisFont),
  {axisX,axisY,font,ticks}=layout;
 const line=(x,y,x2,y2,extra='')=>'<line x1="'+x+'" y1="'+y+'" x2="'+x2+'" y2="'+y2+'" '+extra+'/>';
 const overlap=(a,v)=>Math.max(0,Math.min(a.x+a.w,v.x+v.w)-Math.max(a.x,v.x))*Math.max(0,Math.min(a.y+a.h,v.y+v.h)-Math.max(a.y,v.y));
 parts.push('<rect x="'+b.left+'" y="'+b.top+'" width="'+(b.right-b.left)+'" height="'+(b.bottom-b.top)+'" fill="white"/>');
 // Every grid line and small tick is retained even when a number is omitted.
 for(const t of ticks.x){
  if(g.grid)parts.push(line(t.pos,b.top,t.pos,b.bottom,'stroke="#d9dee4" stroke-width="0.8"'));
  parts.push(line(t.pos,axisY-3,t.pos,axisY+3,'stroke="#333"'));
 }
 for(const t of ticks.y){
  if(g.grid)parts.push(line(b.left,t.pos,b.right,t.pos,'stroke="#d9dee4" stroke-width="0.8"'));
  parts.push(line(axisX-3,t.pos,axisX+3,t.pos,'stroke="#333"'));
 }
 // Arrows deliberately extend beyond the rectangular grid.
 parts.push(line(b.left,axisY,b.right+16,axisY,'stroke="#111" stroke-width="1.7" marker-end="url(#qw-arrow)"'),
  line(axisX,b.bottom,axisX,b.top-16,'stroke="#111" stroke-width="1.7" marker-end="url(#qw-arrow)"'));
 const xBaseline=axisY>b.bottom-23?b.bottom+font+6:axisY+font+5;
 const yLabelX=axisX<b.left+30?b.left-12:axisX-10;
 const numberBoxes=[];
 for(const t of ticks.x){
  if(!t.numbered)continue;
  let x=t.pos;
  if(xBaseline-font<b.bottom&&Math.abs(x-axisX)<t.w/2+4){
   const right=axisX+t.w/2+5;
   x=right+t.w/2<515?right:axisX-t.w/2-5;
  }
  const box={x:x-t.w/2,y:xBaseline-font,w:t.w,h:font+2};
  if(numberBoxes.some(v=>overlap(v,box)>0))continue;
  numberBoxes.push(box);occupied.push(box);
  parts.push('<text class="qw-axis-number" data-axis="x" data-value="'+t.value+'" x="'+x+'" y="'+xBaseline+'" font-size="'+font+'" text-anchor="middle" fill="#263746">'+t.label+'</text>');
 }
 for(const t of ticks.y){
  if(!t.numbered)continue;
  let y=t.pos+font*.34;
  if(y-font<axisY+3&&y+2>axisY-3)y=axisY-5;
  const box={x:yLabelX-t.w,y:y-font,w:t.w,h:font+2};
  if(numberBoxes.some(v=>overlap(v,box)>0))continue;
  numberBoxes.push(box);occupied.push(box);
  parts.push('<text class="qw-axis-number" data-axis="y" data-value="'+t.value+'" x="'+yLabelX+'" y="'+y+'" font-size="'+font+'" text-anchor="end" fill="#263746">'+t.label+'</text>');
 }
 const titleFont=typography.titleFont||16,yTitleRight=axisX<(b.left+b.right)/2;
 const title=(axis,x,y,anchor,text,room)=>'<text class="qw-axis-title" data-axis="'+axis+'" x="'+x+'" y="'+y+'" font-size="'+titleFont+'" text-anchor="'+anchor+'"'+(text.length*titleFont*.6>room?' textLength="'+room+'" lengthAdjust="spacingAndGlyphs"':'')+' fill="#111">'+qwEsc(text)+'</text>';
 parts.push(title('x',b.right+30,axisY-12,'end',g.xlabel,b.right-b.left),
  title('y',axisX+(yTitleRight?12:-12),b.top-22,yTitleRight?'start':'end',g.ylabel,yTitleRight?508-axisX-12:axisX-24));
 if(g.curveFamily!=='points'){
  let d='',drawing=false;
  for(let i=0;i<=300;i++){
   const x=g.xmin+(g.xmax-g.xmin)*i/300,y=qwEvaluateCurve(g,x);
   if(!Number.isFinite(y)||y<g.ymin||y>g.ymax){drawing=false;continue;}
   const p=qwPlotXY(g,{x,y});
   d+=(drawing?' L':' M')+p.x.toFixed(2)+','+p.y.toFixed(2);drawing=true;
  }
  if(d)parts.push('<path d="'+d.trim()+'" fill="none" stroke="'+(g.curveStyle?.stroke||'#186ba3')+'" stroke-width="'+(g.curveStyle?.width||2.5)+'" stroke-linecap="round"/>');
 }
 const ps=g.points.map(p=>qwPlotXY(g,p));
 if(g.curveFamily==='points'&&g.connected&&ps.length>1){
  let d='M'+ps[0].x+','+ps[0].y;
  for(let i=1;i<ps.length;i++){
   const a=ps[i-1],p=ps[i];
   d+=g.smooth?' C'+((a.x+p.x)/2)+','+a.y+' '+((a.x+p.x)/2)+','+p.y+' '+p.x+','+p.y:' L'+p.x+','+p.y;
  }
  parts.push('<path d="'+d+'" fill="none" stroke="'+(g.lineStyle?.stroke||'#142b42')+'" stroke-width="'+(g.lineStyle?.width||2.4)+'"/>');
 }
 ps.forEach((p,i)=>{
  parts.push('<g '+(interactive?'data-qw-point="'+i+'"':'')+'><circle cx="'+p.x+'" cy="'+p.y+'" r="'+(interactive?5:3.5)+'" fill="'+(g.points[i].style?.stroke||'#142b42')+'"/></g>');
 });
 ps.forEach((p,i)=>{
  const label=g.points[i].label;if(!label)return;
  const w=Math.max(12,Array.from(label).length*10),h=20;
  const options=[
   {x:p.x+10,y:p.y-24,w,h},{x:p.x+10,y:p.y+8,w,h},
   {x:p.x-w-10,y:p.y-24,w,h},{x:p.x-w-10,y:p.y+8,w,h}
  ];
  let best=null,score=Infinity;
  for(const rect of options){
   const outside=Math.max(0,b.left-rect.x)+Math.max(0,rect.x+rect.w-b.right)+
    Math.max(0,b.top-rect.y)+Math.max(0,rect.y+rect.h-b.bottom);
   const conflict=occupied.reduce((sum,q)=>sum+overlap(rect,q),0);
   const crossingAxis=(rect.x<axisX+3&&rect.x+rect.w>axisX-3?2:0)+
    (rect.y<axisY+3&&rect.y+rect.h>axisY-3?2:0);
   const next=outside*90+conflict*9+crossingAxis*7;
   if(next<score){score=next;best=rect;}
  }
  if(!best)return;
  best={...best,x:Math.max(b.left,Math.min(best.x,b.right-w)),y:Math.max(b.top,Math.min(best.y,b.bottom-h))};
  occupied.push(best);
  parts.push(qwLabelSVG('g:p:'+i,p,g.points[i].labelPosition,'<text x="'+best.x+'" y="'+(best.y+17)+'" font-size="19" fill="'+(g.points[i].style?.text||'#142b42')+'" stroke="white" stroke-width="4" paint-order="stroke" stroke-linejoin="round">'+qwEsc(label)+'</text>',{plot:true}));
 });
 parts.push(qwGraphElementsSVG(g,interactive));
 return qwPlaceSVGLabels(qwSVG(parts.join(''),'Координатный график'));
}
function qwSVGKey(value){let hash=2166136261;for(const c of JSON.stringify(value)){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(36);}
function qwGraphElementsSVG(g,interactive=false){
 const key=qwSVGKey(g),b=QW_PLOT,clip='<defs><clipPath id="qw-plot-clip"><rect x="'+b.left+'" y="'+b.top+'" width="'+(b.right-b.left)+'" height="'+(b.bottom-b.top)+'"/></clipPath></defs>';
 return clip+(g.elements||[]).map((o,i)=>{
  const style=o.style?qwValidateStyle(o.style):{},color=style.stroke||'#186ba3',width=style.width||2.5,text=style.text||color;
  let shape='',label='',ps=[];
  if(o.kind==='function'){
   for(let n=0;n<=400;n++){const x=g.xmin+(g.xmax-g.xmin)*n/400,y=qwEvaluateCurve({curveFamily:o.family,curve:o.curve},x);ps.push(qwPlotXY(g,{x,y}));}
  }else ps=(o.vertices||[{x:o.x,y:o.y},...(['line','arrow'].includes(o.kind)?[{x:o.x2,y:o.y2}]:[])]).map(p=>qwPlotXY(g,p));
  if(['line','arrow','polyline','function'].includes(o.kind)){
   shape='<path d="'+ps.map((p,n)=>(n?'L':'M')+p.x.toFixed(3)+' '+p.y.toFixed(3)).join(' ')+'" fill="none" stroke="'+color+'" stroke-width="'+width+'" stroke-linecap="round" stroke-linejoin="round"'+(o.kind==='arrow'?' marker-end="url(#qw-graph-arrow-'+key+'-'+i+')"':'')+'/>';
  }else if(o.kind==='point')shape='<circle cx="'+ps[0].x+'" cy="'+ps[0].y+'" r="4" fill="'+color+'"/>';
  if(o.kind==='arrow')shape='<defs><marker id="qw-graph-arrow-'+key+'-'+i+'" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="'+color+'"/></marker></defs>'+shape;
  if(o.label&&ps.length){const p=ps[Math.floor((ps.length-1)/2)];label=qwLabelSVG('g:e:'+i,p,o.labelPosition,'<text x="'+(p.x+(o.kind==='text'?0:8))+'" y="'+(p.y+(o.kind==='text'?0:-10))+'" font-size="18" fill="'+text+'" stroke="white" stroke-width="3" paint-order="stroke">'+qwEsc(o.label)+'</text>',{plot:true,free:o.kind==='text'});}
  return '<g '+(interactive?'data-qw-element="'+i+'"':'')+' clip-path="url(#qw-plot-clip)">'+shape+label+'</g>';
 }).join('');
}
function qwSVG(body,label='Учебная схема'){return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 320" role="img" aria-label="'+qwEsc(label)+'" style="font:18px Arial,sans-serif;background:white;color:black"><defs><marker id="qw-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="none" stroke="#111"/></marker></defs>'+body+'</svg>';}

/* Position geometry captions outside edges and away from already placed captions.
   Uses SVG coordinates, so preview and exported documents have identical placement. */
function qwGeometrySegmentIntersectsBox(a,b,r){
 const dx=b.x-a.x,dy=b.y-a.y;
 let near=0,far=1;
 for(const [p,q] of [[-dx,a.x-r.x],[dx,r.x+r.w-a.x],[-dy,a.y-r.y],[dy,r.y+r.h-a.y]]){
  if(Math.abs(p)<1e-9){if(q<0)return false;continue;}
  const t=q/p;
  if(p<0){if(t>far)return false;near=Math.max(near,t);}
  else{if(t<near)return false;far=Math.min(far,t);}
 }
 return near<=far;
}
function qwGeometryCaptionLocation(value,base,away,segments,points,placed,size=20){
 const width=Math.max(18,[...String(value)].length*size*.65),height=size+4;
 const norm=Math.hypot(away.x,away.y)||1,theta=Math.atan2(away.y,away.x);
 const shifts=[0,-.35,.35,-.7,.7,-1.05,1.05,-1.45,1.45,Math.PI];
 let best={x:base.x,y:base.y,score:Infinity,box:null};
 for(const distance of [27,35,44,55,70]){
  for(const shift of shifts){
   const x=base.x+Math.cos(theta+shift)*distance,
    y=base.y+Math.sin(theta+shift)*distance,
    rect={x:x-width/2,y:y-height/2,w:width,h:height};
   const outside=Math.max(0,12-rect.x)+Math.max(0,rect.x+rect.w-508)+
    Math.max(0,14-rect.y)+Math.max(0,rect.y+rect.h-306);
   const cross=segments.reduce((n,[a,b])=>n+(qwGeometrySegmentIntersectsBox(a,b,{
    x:rect.x-3,y:rect.y-3,w:rect.w+6,h:rect.h+6})?1:0),0);
   const overlap=placed.reduce((n,r)=>{
    const x=Math.max(0,Math.min(rect.x+rect.w,r.x+r.w)-Math.max(rect.x,r.x)),
     y=Math.max(0,Math.min(rect.y+rect.h,r.y+r.h)-Math.max(rect.y,r.y));
    return n+x*y;
   },0);
   const nearPoint=points.reduce((n,p)=>n+(Math.max(0,14-Math.hypot(p.x-x,p.y-y))**2),0);
   const outward=(x-base.x)*away.x+(y-base.y)*away.y;
   const score=outside*1000+cross*8000+overlap*55+nearPoint*35+
    (outward<0?150:0)+distance*.5+Math.abs(shift)*12;
   if(score<best.score)best={x,y,score,box:rect};
  }
 }
 if(best.box)placed.push(best.box);
 return {x:best.x,y:best.y};
}
function qwDiagramSVG(objects,interactive=false,showGuides=interactive){
 objects=qwResolveDiagram(objects);
 const key=qwSVGKey(objects);
 const spacing=[10,20,40].includes(showGuides)?showGuides:20;
 const guides=interactive&&showGuides?
  '<defs><pattern id="qw-geometry-guide" width="'+spacing+'" height="'+spacing+'" patternUnits="userSpaceOnUse"><path d="M'+spacing+' 0L0 0 0 '+spacing+'" fill="none" stroke="#dce6ec" stroke-width="0.7"/></pattern></defs>'+
  '<rect x="0" y="0" width="520" height="320" fill="url(#qw-geometry-guide)" pointer-events="none"/>':'';
 const allSegments=[],allPoints=[],placedLabels=[];
 const addPolygon=pts=>{pts.forEach((p,i)=>{allSegments.push([p,pts[(i+1)%pts.length]]);allPoints.push(p);});};
 for(const item of objects){
  if(['triangle','rightTriangle','quadrilateral','regularPolygon'].includes(item.kind))addPolygon(qwGeometryVertices(item));
  else if(['polyline','arc'].includes(item.kind)){
   const ps=item.kind==='arc'?qwArcPoints(item):item.vertices;
   ps.slice(1).forEach((p,i)=>allSegments.push([ps[i],p]));allPoints.push(...ps);
  }else if(['dimension','doubleArrow'].includes(item.kind)){
   allSegments.push(...qwLinearSegments(item));allPoints.push({x:item.x,y:item.y},{x:item.x2,y:item.y2});
  }else if(['line','arrow','dashed','rope','spring','ground'].includes(item.kind)){
   allSegments.push([{x:item.x,y:item.y},{x:item.x2,y:item.y2}]);
   allPoints.push({x:item.x,y:item.y},{x:item.x2,y:item.y2});
  }else if(['rect','block','incline'].includes(item.kind)){
   const x=Math.min(item.x,item.x2),x2=Math.max(item.x,item.x2),y=Math.min(item.y,item.y2),y2=Math.max(item.y,item.y2);
   addPolygon(item.kind==='incline'?[{x,y:y2},{x:x2,y:y2},{x:x2,y}]:[{x,y},{x:x2,y},{x:x2,y:y2},{x,y:y2}]);
  }else if(item.kind==='point')allPoints.push({x:item.x,y:item.y});
 }
 const numeric=v=>Number(v.toFixed(3));
 const label=(value,x,y,size=18,anchor='middle')=>
  '<text x="'+numeric(x)+'" y="'+numeric(y)+'" text-anchor="'+anchor+'" font-size="'+size+
  '" fill="#162735" stroke="white" stroke-width="4" paint-order="stroke" stroke-linejoin="round">'+qwEsc(value)+'</text>';
 return qwPlaceSVGLabels(qwSVG(guides+objects.map((o,i)=>{
  const paint=o.style?qwValidateStyle(o.style):{},stroke=paint.stroke||'#162735',width=paint.width||2,fill=paint.fill||'none';
  const a=' stroke="'+stroke+'" stroke-width="'+width+'" fill="none"',
   vertices=['triangle','rightTriangle','quadrilateral','regularPolygon'].includes(o.kind)?qwGeometryVertices(o):null;
  const all=vertices||[{x:o.x,y:o.y},{x:o.x2,y:o.y2}];
  const minX=Math.min(...all.map(p=>p.x)),minY=Math.min(...all.map(p=>p.y)),
   maxX=Math.max(...all.map(p=>p.x)),maxY=Math.max(...all.map(p=>p.y)),
   w=maxX-minX,h=maxY-minY;
  let shape='',captions='';
  const labelAnchor={x:(minX+maxX)/2,y:(minY+maxY)/2};
  const labelOwnerIndex=i;
  const objectLabel=(...args)=>qwLabelSVG('d:'+i+':o',labelAnchor,o.labelPosition,label(...args),{free:o.kind==='text'});
  if(['ray','infiniteLine'].includes(o.kind)){const ps=qwExtendedSegment(o);if(ps.length===2)shape='<line data-qw-extended="'+o.kind+'" x1="'+ps[0].x+'" y1="'+ps[0].y+'" x2="'+ps[1].x+'" y2="'+ps[1].y+'"'+a+'/>';if(o.kind==='ray')shape+='<circle cx="'+o.x+'" cy="'+o.y+'" r="3" fill="'+stroke+'"/>';}
  if(['line','arrow','doubleArrow','dashed','rope','ground'].includes(o.kind)){
   shape='<line x1="'+o.x+'" y1="'+o.y+'" x2="'+o.x2+'" y2="'+o.y2+'"'+a+
    (['arrow','doubleArrow'].includes(o.kind)?' marker-end="url(#qw-arrow-'+key+'-'+i+')"':'')+
    (o.kind==='doubleArrow'?' marker-start="url(#qw-arrow-'+key+'-'+i+')"':'')+
    (o.kind==='dashed'?' stroke-dasharray="6 4"':'')+'/>';
   if(o.kind==='ground'){
    const dx=o.x2-o.x,dy=o.y2-o.y,length=Math.hypot(dx,dy)||1;
    for(let i=0;i<=Math.floor(length/14);i++){
     const t=i*14/length,x=o.x+dx*t,y=o.y+dy*t;
     shape+='<line x1="'+numeric(x)+'" y1="'+numeric(y)+'" x2="'+numeric(x-dy/length*10-dx/length*5)+'" y2="'+numeric(y+dx/length*10-dy/length*5)+'" stroke="#91a0ae" stroke-width="1"/>';
    }
   }
  }
  if(o.kind==='dimension')shape=qwLinearSegments(o).map(([a0,b0])=>'<line x1="'+a0.x+'" y1="'+a0.y+'" x2="'+b0.x+'" y2="'+b0.y+'"'+a+'/>').join('');
  if(o.kind==='arc'){
   const cx=(o.x+o.x2)/2,cy=(o.y+o.y2)/2,r=w/2,delta=o.endAngle-o.startAngle,n=Math.ceil(Math.abs(delta)/180)||1;
   let path='';for(let j=0;j<=n;j++){const angle=(o.startAngle+delta*j/n)*Math.PI/180,x=numeric(cx+r*Math.cos(angle)),y=numeric(cy-r*Math.sin(angle));path+=j?' A'+r+' '+r+' 0 0 '+(delta>0?0:1)+' '+x+' '+y:'M'+x+' '+y;}
   shape='<path d="'+path+'"'+a+' stroke-linecap="round"/>';
  }
  if(o.kind==='polyline'){
   shape='<polyline points="'+o.vertices.map(p=>p.x+','+p.y).join(' ')+'"'+a+' stroke-linejoin="round" stroke-linecap="round"/>';
   if(interactive)shape+=o.vertices.map((p,j)=>'<circle data-qw-vertex="'+j+'" cx="'+p.x+'" cy="'+p.y+'" r="7" fill="#fff" stroke="#136bb1" stroke-width="2"/>').join('');
   o.vertices.forEach((p,j)=>{if(p.label){const at=qwGeometryCaptionLocation(p.label,p,{x:p.x-(minX+maxX)/2,y:p.y-(minY+maxY)/2},allSegments,allPoints,placedLabels,18);captions+=qwLabelSVG('d:'+i+':v:'+j,p,p.labelPosition,label(p.label,at.x,at.y+6,18));}});
  }
  if(o.kind==='spring'){
   const dx=o.x2-o.x,dy=o.y2-o.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
   let path='M'+o.x+' '+o.y;
   for(let j=1;j<=19;j++){
    const t=j/20,offset=(j===1||j===19)?0:(j%2?8:-8);
    path+=' L'+numeric(o.x+dx*t-uy*offset)+' '+numeric(o.y+dy*t+ux*offset);
   }
   shape='<path d="'+path+' L'+o.x2+' '+o.y2+'"'+a+' stroke-linejoin="round"/>';
  }
  if(o.kind==='block'){
   const cx=minX+w/2,cy=minY+h/2;
   shape=
    '<rect x="'+minX+'" y="'+minY+'" width="'+Math.max(w,3)+'" height="'+Math.max(h,3)+'" fill="#f2f6f8" stroke="#162735" stroke-width="2"/>'+
    '<path d="M'+numeric(minX+w*.12)+' '+numeric(minY+h*.14)+'h'+numeric(w*.34)+'" stroke="#a1adba" stroke-width="1"/>'+
    '';
  }
  if(o.kind==='incline')shape='<polygon points="'+minX+','+maxY+' '+maxX+','+maxY+' '+maxX+','+minY+'" fill="#eef3f5" stroke="#162735" stroke-width="2"/>';
  if(['pulley','fixedPulley','movablePulley'].includes(o.kind)){
   const rad=Math.max(8,Math.min(w,h)/2),cx=minX+w/2,cy=minY+h/2;
   shape='<circle cx="'+numeric(cx)+'" cy="'+numeric(cy)+'" r="'+numeric(rad)+'" fill="white" stroke="#162735" stroke-width="2"/>'+
    '<circle cx="'+numeric(cx)+'" cy="'+numeric(cy)+'" r="3.5" fill="#162735"/>'+
    (o.kind==='movablePulley'?
     '<path d="M'+numeric(cx-rad)+' '+numeric(cy-rad-32)+'V'+numeric(cy)+' A'+rad+' '+rad+' 0 0 0 '+numeric(cx+rad)+' '+numeric(cy)+'V'+numeric(cy-rad-32)+'" fill="none" stroke="#162735" stroke-width="2"/>'+
     '<path d="M'+numeric(cx)+' '+numeric(cy)+'V'+numeric(cy+rad+14)+'q0 8 7 4" fill="none" stroke="#162735" stroke-width="2"/>':
     '<line x1="'+numeric(cx)+'" y1="'+numeric(cy)+'" x2="'+numeric(cx)+'" y2="'+numeric(cy-rad-14)+'" stroke="#162735" stroke-width="2"/>');
  }
  if(o.kind==='rect')shape='<rect x="'+minX+'" y="'+minY+'" width="'+Math.max(w,1)+'" height="'+Math.max(h,1)+'"'+a+'/>';
  if(o.kind==='circle'||o.kind==='ellipse')shape='<ellipse cx="'+(minX+w/2)+'" cy="'+(minY+h/2)+'" rx="'+Math.max(w/2,1)+'" ry="'+Math.max(h/2,1)+'"'+a+'/>';
  if(o.kind==='point')shape='<circle cx="'+o.x+'" cy="'+o.y+'" r="3" fill="#162735"/>';
  if(o.kind==='angle'){
   const angle=Math.atan2(o.y2-o.y,o.x2-o.x),start=o.x2>=o.x?0:Math.PI,r=25;
   let delta=angle-start;while(delta>Math.PI)delta-=2*Math.PI;while(delta< -Math.PI)delta+=2*Math.PI;
   shape='<path d="M'+o.x2+' '+o.y+'L'+o.x+' '+o.y+'L'+o.x2+' '+o.y2+'"'+a+'/>'+
    '<path d="M'+(o.x+r*Math.cos(start))+' '+(o.y+r*Math.sin(start))+
    'A'+r+' '+r+' 0 0 '+(delta>=0?1:0)+' '+(o.x+r*Math.cos(angle))+' '+(o.y+r*Math.sin(angle))+'"'+a+'/>';
  }
  if(vertices){
   shape='<polygon points="'+vertices.map(p=>p.x+','+p.y).join(' ')+'"'+a+'/>';
   const cx=vertices.reduce((v,p)=>v+p.x,0)/vertices.length,
    cy=vertices.reduce((v,p)=>v+p.y,0)/vertices.length;
   const polygonEdges=vertices.map((p,i)=>[p,vertices[(i+1)%vertices.length]]);
   vertices.forEach((p,j)=>{
    shape+='<circle cx="'+p.x+'" cy="'+p.y+'" r="2.5" fill="#162735"/>';
    if(interactive&&o.kind!=='regularPolygon')shape+='<circle data-qw-vertex="'+j+'" cx="'+p.x+'" cy="'+p.y+'" r="7" fill="#fff" stroke="#136bb1" stroke-width="2"/>';
    if(p.label){
     const at=qwGeometryCaptionLocation(p.label,p,{x:p.x-cx,y:p.y-cy},allSegments,allPoints,placedLabels,20);
     captions+=qwLabelSVG('d:'+i+':v:'+j,p,p.labelPosition,label(p.label,at.x,at.y+7,20));
    }
   });
   vertices.forEach((p,i)=>{
    const sideText=o.edgeLabels?.[i];if(!sideText)return;
    const other=vertices[(i+1)%vertices.length],mid={x:(p.x+other.x)/2,y:(p.y+other.y)/2};
    const at=qwGeometryCaptionLocation(sideText,mid,{x:mid.x-cx,y:mid.y-cy},allSegments,allPoints,placedLabels,17);
    captions+=qwLabelSVG('d:'+labelOwnerIndex+':e:'+i,mid,o.edgeLabelPositions?.[i],label(sideText,at.x,at.y+6,17));
   });
   if(o.kind==='rightTriangle'&&vertices.length===3){
    const origin=vertices[0],b=vertices[1],c=vertices[2],
     ux=b.x-origin.x,uy=b.y-origin.y,vx=c.x-origin.x,vy=c.y-origin.y;
    if(Math.abs(ux*vx+uy*vy) <= Math.max(1,Math.hypot(ux,uy)*Math.hypot(vx,vy)*.02)){
    const [p0,p1,p2]=vertices,
     unit=v=>{const l=Math.hypot(v.x,v.y)||1;return {x:v.x/l,y:v.y/l};},
     u=unit({x:p1.x-p0.x,y:p1.y-p0.y}),v=unit({x:p2.x-p0.x,y:p2.y-p0.y}),r=12;
    shape+='<path d="M'+numeric(p0.x+u.x*r)+' '+numeric(p0.y+u.y*r)+
     'L'+numeric(p0.x+(u.x+v.x)*r)+' '+numeric(p0.y+(u.y+v.y)*r)+
     'L'+numeric(p0.x+v.x*r)+' '+numeric(p0.y+v.y*r)+'"'+a+'/>';
    }
   }
   if(o.label)captions+=objectLabel(o.label,cx,cy+7,17);
  }else if(o.label){
   if(o.kind==='text')captions+=objectLabel(o.label,o.x,o.y,19,'start');
   else if(o.kind==='dimension'){
    const dx=o.x2-o.x,dy=o.y2-o.y,length=Math.hypot(dx,dy)||1,offset=o.labelOffset??18;
    const x=(o.x+o.x2)/2-dy/length*offset,y=(o.y+o.y2)/2+dx/length*offset;
    let angle=Math.atan2(dy,dx)*180/Math.PI+(o.rotation||0);angle=((angle+90)%180+180)%180-90;
    captions+='<g transform="rotate('+(angle-(o.rotation||0))+' '+numeric(x)+' '+numeric(y)+')">'+objectLabel(o.label,x,y+6,18)+'</g>';
   }
   else if(o.kind==='arc'){
    const angle=(o.startAngle+o.endAngle)/2*Math.PI/180,r=w/2,cx=(o.x+o.x2)/2,cy=(o.y+o.y2)/2;
    const at=qwGeometryCaptionLocation(o.label,{x:cx+r*Math.cos(angle),y:cy-r*Math.sin(angle)},{x:Math.cos(angle),y:-Math.sin(angle)},allSegments,allPoints,placedLabels,18);
    captions+=objectLabel(o.label,at.x,at.y+6,18);
   }
   else if(o.kind==='polyline'){
    const lines=[];let row='';
    for(const word of o.label.split(/\s+/))for(let n=0;n<word.length;n+=42){const chunk=word.slice(n,n+42);if(row&&row.length+chunk.length+1>42){lines.push(row);row='';}row+=(row?' ':'')+chunk;}if(row)lines.push(row);
    const labelWidth=Math.min(480,Math.max(...lines.map(s=>s.length))*10.8),x=Math.max(labelWidth/2+8,Math.min(512-labelWidth/2,(minX+maxX)/2));
    const y=maxY+24+(lines.length-1)*21<312?maxY+24:Math.max(22,minY-18-(lines.length-1)*21);
    captions+=qwLabelSVG('d:'+i+':o',labelAnchor,o.labelPosition,lines.map((s,j)=>label(s,x,y+j*21,18)).join(''));
   }
   else if(o.kind==='block'||['pulley','fixedPulley','movablePulley'].includes(o.kind))captions+=objectLabel(o.label,(o.x+o.x2)/2,(o.y+o.y2)/2+6,18);
   else if(o.kind==='point'){
    const at=qwGeometryCaptionLocation(o.label,{x:o.x,y:o.y},{x:o.x-260,y:o.y-160},allSegments,allPoints,placedLabels,19);
    captions+=objectLabel(o.label,at.x,at.y+7,19);
   }
   else{
    const midX=(o.x+o.x2)/2,midY=(o.y+o.y2)/2,
     dx=o.x2-o.x,dy=o.y2-o.y,mag=Math.hypot(dx,dy)||1;
    const pos=qwGeometryCaptionLocation(o.label,{x:midX,y:midY},{x:-dy/mag,y:dx/mag},allSegments,allPoints,placedLabels,18);
    captions+=objectLabel(o.label,pos.x,pos.y+7,18);
   }
  }
  // Styling applies only to the printable object; editor handles keep their own colors.
  if(o.ticks){const dx=o.x2-o.x,dy=o.y2-o.y,len=Math.hypot(dx,dy)||1;for(let n=0;n<o.ticks;n++){const shift=(n-(o.ticks-1)/2)*6,cx=(o.x+o.x2)/2+dx/len*shift,cy=(o.y+o.y2)/2+dy/len*shift;shape+='<line data-qw-equal-mark="'+(n+1)+'" x1="'+(cx-dy/len*6)+'" y1="'+(cy+dx/len*6)+'" x2="'+(cx+dy/len*6)+'" y2="'+(cy-dx/len*6)+'"'+a+'/>';}}
  if(paint.stroke||paint.width)shape=shape.replace(/stroke="#162735"/g,'stroke="'+stroke+'"').replace(/stroke-width="2"/g,'stroke-width="'+width+'"').replace(/fill="#162735"/g,'fill="'+stroke+'"');
  if(paint.fill)shape=shape.replace(/fill="(?:none|#f2f6f8|#eef3f5|white)"/g,'fill="'+fill+'"');
  if(paint.text)captions=captions.replace(/fill="#162735"/g,'fill="'+paint.text+'"');
  const marker=['arrow','doubleArrow'].includes(o.kind)?'<defs><marker id="qw-arrow-'+key+'-'+i+'" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="'+(o.kind==='doubleArrow'?'auto-start-reverse':'auto')+'"><path d="M0 0L6 3L0 6" fill="none" stroke="'+stroke+'" stroke-width="1"/></marker></defs>':'';
  const center=o.kind==='regularPolygon'?{x:(o.x+o.x2)/2,y:(o.y+o.y2)/2}:{x:minX+w/2,y:minY+h/2},transform=o.rotation?' transform="rotate('+o.rotation+' '+numeric(center.x)+' '+numeric(center.y)+')"':'';
  return '<g data-qw-label-owner="d:'+i+'" '+(interactive?'data-qw-object="'+i+'"':'')+transform+'>'+marker+shape+captions+'</g>';
 }).join('')));
}
export {qwMath,qwMathML,qwTokens,qwContentHTML,qwAxisLayout,qwGraphSVG,qwDiagramSVG,qwPlotXY,qwEsc};
