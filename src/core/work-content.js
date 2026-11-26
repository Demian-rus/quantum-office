/* A bounded mathematical syntax shared by MathML preview and PDF canvas layout. */
import {qwGraphGridStep,qwEvaluateCurve,qwGeometryVertices,qwValidateStyle,qwResolveDiagram,QW_PLOT,qwPlotXY} from './work-model.js';
import {qwArcPoints,qwLinearSegments,qwExtendedSegment} from './work-geometry.js';
import {QW_MECHANICS,QW_ELECTRICS,qwPhysicsShape,qwArrowSVG} from './work-physics.js';
import {qwLabelSVG,qwPlaceSVGLabels,qwClosedContour,qwContourOutward} from './work-labels.js';
import {qwReadTextStyle,qwTextStyleAttrs,qwCalloutOptions,qwCalloutOptionSource,qwCalloutLook} from './work-text-style.js';
const QW_GREEK={alpha:'α',beta:'β',gamma:'γ',delta:'δ',epsilon:'ε',zeta:'ζ',eta:'η',iota:'ι',kappa:'κ',nu:'ν',xi:'ξ',tau:'τ',upsilon:'υ',chi:'χ',psi:'ψ',Gamma:'Γ',Theta:'Θ',Lambda:'Λ',Pi:'Π',Sigma:'Σ',Phi:'Φ',Psi:'Ψ',Delta:'Δ',theta:'θ',lambda:'λ',mu:'μ',pi:'π',rho:'ρ',sigma:'σ',phi:'φ',omega:'ω',Omega:'Ω',cdot:'·',times:'×',pm:'±',le:'≤',ge:'≥',neq:'≠',infty:'∞'};
function qwEsc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function qwMath(source){
 const s=String(source);if(!s.trim()||s.length>600)throw Error('Формула должна содержать 1–600 символов');let i=0;
 if(s.trimStart().startsWith('\\begin{cases}')){
  const body=s.trim().match(/^\\begin\{cases\}([\s\S]+)\\end\{cases\}$/)?.[1];
  const rows=body?.split(/\\\\/).map(row=>row.trim());
  if(!rows||rows.length<2||rows.length>8||rows.some(row=>!row||/\\(?:begin|end)\b/.test(row)))
   throw Error('Система должна содержать от 2 до 8 строк');
  return {t:'cases',rows:rows.map(row=>qwMath(row.replace(/&/g,'')))};
 }
 const plain=n=>n.t==='text'?n.v:n.t==='row'?n.list.map(plain).join(''):'';
 function command(depth){
  const match=s.slice(i).match(/^[A-Za-z]+/);if(!match)return {t:'text',v:s[i++]||''};
  i+=match[0].length;const key=match[0];
  if(key==='frac')return {t:'frac',a:atom(depth),b:atom(depth)};
  if(key==='sqrt')return {t:'sqrt',a:atom(depth)};
  if(key==='vec')return {t:'vec',a:atom(depth)};
  if(key==='mathrm'||key==='text')return {t:'upright',a:atom(depth)};
  return {t:'text',v:key==='circ'?'°':key==='varepsilon'?'ε':QW_GREEK[key]||key};
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
 if(n.t==='row'){
  const operator=v=>v?.t==='text'&&/^[=+−\-×÷·±<>≤≥≠→←↔]$/.test(v.v);
  return tag('mrow',n.list.map((v,i)=>{
   if(!upright&&v.t==='text'&&/^\s+$/.test(v.v)){
    let a=i-1,b=i+1;while(a>=0&&n.list[a].t==='text'&&/^\s+$/.test(n.list[a].v))a--;while(b<n.list.length&&n.list[b].t==='text'&&/^\s+$/.test(n.list[b].v))b++;
    if(operator(n.list[a])||operator(n.list[b]))return '';
   }
   return qwMathML(v,upright,qwMathIsUnary(n.list,i));
  }).join(''));
 }
 if(n.t==='upright')return '<mstyle mathvariant="normal">'+qwMathML(n.a,true)+'</mstyle>';
 if(n.t==='frac')return tag('mfrac',qwMathML(n.a,upright)+qwMathML(n.b,upright));
 // Keep MathML semantics and use the measured radicand for the outline.
 if(n.t==='sqrt')return '<msqrt class="qw-radical"><mrow class="qw-radicand"><mrow>'+qwMathML(n.a,upright)+'</mrow><mspace class="qw-radical-ink" aria-hidden="true"></mspace></mrow></msqrt>';
 if(n.t==='vec')return '<mover accent="true">'+qwMathML(n.a,upright)+'<mo stretchy="true">→</mo></mover>';
 if(n.t==='cases')return tag('mrow','<mo fence="true" stretchy="true">{</mo><mtable columnalign="left">'+
  n.rows.map(row=>tag('mtr',tag('mtd',qwMathML(row,upright)))).join('')+'</mtable>');
 if(n.t==='sup'||n.t==='sub')return tag(n.t==='sup'?'msup':'msub',qwMathML(n.a,upright)+qwMathML(n.b,upright));
 const value=n.v==='-'?'−':n.v;
 if(upright)return tag('mtext',qwEsc(value));
 if(value==='°'||/^[()[\]{},.]$/.test(value)||unary)return '<mo lspace="0" rspace="0">'+qwEsc(value)+'</mo>';
 if(/[=+−\-×÷·±<>≤≥≠→←↔]/.test(value))return '<mo lspace="0.28em" rspace="0.28em">'+qwEsc(value)+'</mo>';
 if(/^\s+$/.test(value))return '<mspace width="0.18em"/>';
 return tag(/[0-9]/.test(value)?'mn':/[A-Za-zα-ωΑ-Ω]/.test(value)?'mi':'mo',qwEsc(value));
}
function qwMathBox(ctx,n,size=12,upright=false,unary=false){
 const text=source=>{const v=source==='-'?'−':source,font=(!upright&&/^[A-Za-zα-ωΑ-Ω]$/.test(v)?'italic ':'')+size+'px "Times New Roman",serif',pad=!upright&&!unary&&/^[=+−×÷·±<>≤≥≠]$/.test(v)?size*.28:0;ctx.font=font;const m=ctx.measureText(v);return {w:m.width+pad*2,a:Math.max(size*.7,m.actualBoundingBoxAscent||0),d:Math.max(size*.2,m.actualBoundingBoxDescent||0),draw:(x,y)=>{ctx.font=font;ctx.fillText(v,x+pad,y);}};};
 if(n.t==='text')return text(n.v);
 if(n.t==='upright')return qwMathBox(ctx,n.a,size,true);
 if(n.t==='row'){const bs=n.list.map((v,i)=>qwMathBox(ctx,v,size,upright,qwMathIsUnary(n.list,i)));return {w:bs.reduce((s,b)=>s+b.w,0),a:Math.max(size*.8,...bs.map(b=>b.a)),d:Math.max(size*.24,...bs.map(b=>b.d)),draw:(x,y)=>{for(const b of bs){b.draw(x,y);x+=b.w;}}};}
 if(n.t==='vec'){
  const base=qwMathBox(ctx,n.a,size,upright),width=Math.max(base.w+.08*size,.55*size),arrowY=base.a+.09*size;
  return {w:width,a:arrowY+.16*size,d:base.d,draw:(x,y)=>{
   base.draw(x+(width-base.w)/2,y);
   const start=x+.07*size,end=x+width-.04*size,top=y-arrowY,head=Math.min(.16*size,(end-start)/3);
   ctx.save();ctx.beginPath();ctx.lineWidth=Math.max(.7,size*.055);
   ctx.moveTo(start,top);ctx.lineTo(end,top);ctx.moveTo(end-head,top-head*.65);ctx.lineTo(end,top);ctx.lineTo(end-head,top+head*.65);
   ctx.stroke();ctx.restore();
  }};
 }
 if(n.t==='frac'){const a=qwMathBox(ctx,n.a,size*.78,upright),b=qwMathBox(ctx,n.b,size*.78,upright),w=Math.max(a.w,b.w)+8;return {w,a:a.a+a.d+size*.35,d:b.a+b.d+size*.25,draw:(x,y)=>{a.draw(x+(w-a.w)/2,y-size*.35-a.d);ctx.beginPath();ctx.lineWidth=.7;ctx.moveTo(x,y-size*.18);ctx.lineTo(x+w,y-size*.18);ctx.stroke();b.draw(x+(w-b.w)/2,y+b.a+2);}};}
 if(n.t==='sqrt'){
  const radicand=qwMathBox(ctx,n.a,size,upright),rule=Math.max(.55,size*.055),lead=size*.79;
  const bar=radicand.a+size*.12+rule/2,depth=Math.max(size*.14,radicand.d),width=lead+radicand.w+size*.09;
  return {w:width,a:bar+rule,d:depth+rule,draw:(x,y)=>{
   radicand.draw(x+lead,y);
   ctx.save();ctx.beginPath();ctx.lineWidth=rule;ctx.lineJoin='round';ctx.lineCap='butt';
   ctx.moveTo(x+rule/2,y-size*.08);ctx.lineTo(x+size*.16,y-size*.16);
   ctx.lineTo(x+size*.35,y+depth);ctx.lineTo(x+size*.67,y-bar);ctx.lineTo(x+width,y-bar);
   ctx.stroke();ctx.restore();
  }};
 }
 if(n.t==='cases'){
  const rows=n.rows.map(row=>qwMathBox(ctx,row,size,upright));
  const gap=size*.15,height=rows.reduce((sum,row)=>sum+row.a+row.d+gap,-gap);
  const a=height/2+size*.25,d=height-a,brace=size*.8;
  return {w:brace+Math.max(...rows.map(row=>row.w)),a,d,draw:(x,y)=>{
   ctx.font=height+'px "Times New Roman",serif';
   ctx.save();ctx.translate(x,y+(d-a)/2);ctx.scale(brace/Math.max(1,ctx.measureText('{').width),1);
   ctx.textBaseline='middle';ctx.fillText('{',0,0);ctx.restore();
   let top=y-a;
   for(const row of rows){row.draw(x+brace,top+row.a);top+=row.a+row.d+gap;}
  }};
 }
 const a=qwMathBox(ctx,n.a,size,upright),b=qwMathBox(ctx,n.b,size*.66,upright),dy=n.t==='sup'?-size*.58:size*.34;return {w:a.w+b.w,a:Math.max(a.a,b.a-dy),d:Math.max(a.d,b.d+dy),draw:(x,y)=>{a.draw(x,y);b.draw(x+a.w,y+dy);}};
}
function qwMathSVG(node,x,y,size,align='middle'){
 const canvas=typeof document!=='undefined'?document.createElement('canvas').getContext('2d'):null;
 const parts=[],stack=[];
 let path='',tx=0,ty=0,sx=1,sy=1;
 const round=n=>Number(n.toFixed(3));
 const point=(px,py)=>round(tx+px*sx)+' '+round(ty+py*sy);
 const ink={
  font:'16px serif',lineWidth:1,lineJoin:'miter',lineCap:'butt',textBaseline:'alphabetic',
  measureText(value){if(canvas){canvas.font=this.font;return canvas.measureText(value);}
   return {width:Array.from(value).length*(parseFloat(this.font.match(/[\d.]+px/)?.[0])||size)*.55};},
  fillText(value,px,py){
   const [,n]=this.font.match(/([\d.]+)px/)||[];
   const middle=this.textBaseline==='middle'?' dominant-baseline="central"':'';
   parts.push('<text x="'+round(px)+'" y="'+round(py)+'" transform="translate('+round(tx)+' '+round(ty)+') scale('+round(sx)+' '+round(sy)+')" fill="#000" font-family="Times New Roman,serif" font-size="'+n+'"'+(this.font.startsWith('italic ')?' font-style="italic"':'')+middle+'>'+qwEsc(value)+'</text>');
  },
  beginPath(){path='';},moveTo(px,py){path+='M'+point(px,py);},lineTo(px,py){path+='L'+point(px,py);},
  stroke(){parts.push('<path data-qw-math-rule d="'+path+'" fill="none" stroke="#000" stroke-width="'+round(this.lineWidth)+'" stroke-linejoin="'+this.lineJoin+'" stroke-linecap="'+this.lineCap+'"/>');},
  save(){stack.push([tx,ty,sx,sy,this.font,this.lineWidth,this.lineJoin,this.lineCap,this.textBaseline]);},
  restore(){[tx,ty,sx,sy,this.font,this.lineWidth,this.lineJoin,this.lineCap,this.textBaseline]=stack.pop();},
  translate(px,py){tx+=px*sx;ty+=py*sy;},scale(px,py){sx*=px;sy*=py;}
 };
 const box=qwMathBox(ink,node,size);
 box.draw(x-(align==='middle'?box.w/2:align==='end'?box.w:0),y);
 return parts.join('');
}
function qwScienceExpression(value,vector=false){
 const text=String(value??'').trim();
 const explicit=[...text.matchAll(/\\\((.+?)\\\)/g)];
 try{
  if(explicit.length){
   if(explicit.length===1&&explicit[0][0]===text)return {ast:qwMath(explicit[0][1]),source:explicit[0][1]};
   const list=[];let offset=0;
   for(const match of explicit){
    if(match.index>offset)list.push({t:'upright',a:{t:'text',v:text.slice(offset,match.index)}});
    list.push(qwMath(match[1]));offset=match.index+match[0].length;
   }
   if(offset<text.length)list.push({t:'upright',a:{t:'text',v:text.slice(offset)}});
   return {ast:{t:'row',list},source:text};
  }
  const match=text.match(/^(.+?)(,\s+[^,]+)?$/),formula=match?.[1],units=match?.[2];
  const notation=/^(?:[A-Za-zα-ωΑ-Ω]|\\[A-Za-z]+)(?:[_^](?:\{[^{}]+\}|[A-Za-zα-ωΑ-Ω0-9]))+$/u;
  let source=notation.test(formula)||/^(?:\|?\s*\\(?:vec|frac|sqrt|mathrm|varepsilon|[a-z]{2,7}(?=$))\b)/i.test(formula)?formula:'';
  if(!source&&vector&&/^[A-Za-zα-ωΑ-Ω]$/.test(formula))source='\\vec{'+formula+'}';
  if(!source&&vector&&formula==='Fтр')source='\\vec{F}_{\\mathrm{тр}}';
  if(!source)return null;
  const ast=qwMath(source);
  return units?{ast:{t:'row',list:[ast,{t:'upright',a:{t:'text',v:units}}]},source:source+units}:{ast,source};
 }catch{return null;}
}
function qwScienceLabel(value,x,y,size=18,anchor='middle',vector=false,ink='#000'){
 const math=qwScienceExpression(value,vector);
 if(math)return '<g data-qw-science-math="'+qwEsc(math.source)+'" aria-label="'+qwEsc(math.source)+'">'+
  qwMathSVG(math.ast,x,y,size,anchor).replace(/(fill|stroke)="#000"/g,'$1="'+ink+'"')+'</g>';
 return '<text x="'+x+'" y="'+y+'" text-anchor="'+anchor+'" font-size="'+size+
  '" fill="'+ink+'" stroke="white" stroke-width="4" paint-order="stroke" stroke-linejoin="round">'+qwEsc(value)+'</text>';
}
function qwTokens(text){const tokens=[];let start=0;const re=/\\\(([\s\S]*?)\\\)|\[\[blank:(\d{1,2})\]\]/g;let m;while((m=re.exec(text))){if(m.index>start)tokens.push({t:'text',v:text.slice(start,m.index)});if(m[1]!==undefined){try{tokens.push({t:'math',v:m[1],ast:qwMath(m[1])});}catch(e){tokens.push({t:'error',v:m[1],error:e.message});}}else tokens.push({t:'blank',size:Math.max(1,Math.min(30,Number(m[2])))});start=re.lastIndex;}if(start<text.length)tokens.push({t:'text',v:text.slice(start)});return tokens;}
// Only standalone, unambiguous numeric and single-symbol mathematical
// expressions are typeset. Original user text and code/URL tokens stay intact.
function qwPlainMathHTML(value){
 const text=String(value??'');
 const operand='(?:[A-Za-zα-ωΑ-Ω][₀-₉ₐ-ₜ⁰¹²³⁴⁵⁶⁷⁸⁹⁻]*|[+\\-−]?\\d+(?:[.,]\\d+)?(?:[·×]10[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+)?[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]*)';
 const pattern=new RegExp('(?<![\\p{L}\\p{N}_./:@-])(?:'+operand+')(?:[ \\t]*[=<>≤≥≠+−×÷±→←↔][ \\t]*'+operand+')+(?![\\p{L}\\p{N}_/:@-]|\\.\\d)','gu');
 const split=new RegExp('^('+operand+')([ \\t]*)([=<>≤≥≠+−×÷±→←↔])([ \\t]*)','u');
 const atom=v=>/^[A-Za-zα-ωΑ-Ω]/u.test(v)?'<mi mathvariant="normal">'+qwEsc(v)+'</mi>':'<mtext>'+qwEsc(v)+'</mtext>';
 const render=chunk=>{
  let out='',last=0,m;pattern.lastIndex=0;
  while((m=pattern.exec(chunk))){
   let expr=m[0],parts='',step;
   while((step=split.exec(expr))){
    parts+=atom(step[1])+'<mo lspace="0.28em" rspace="0.28em">'+qwEsc(step[3])+'</mo>';
    expr=expr.slice(step[0].length);
   }
   if(!parts)continue;
   out+=qwEsc(chunk.slice(last,m.index))+'<math class="qw-plain-math" xmlns="http://www.w3.org/1998/Math/MathML" aria-label="'+qwEsc(m[0])+'"><mrow>'+parts+atom(expr)+'</mrow></math>';
   last=pattern.lastIndex;
  }
  return out+qwEsc(chunk.slice(last));
 };
 return text.split(/(\b(?:https?:\/\/|www\.)[^\s]+|\x60[^\x60]*\x60)/gi).map((s,i)=>i%2?qwEsc(s):render(s)).join('');
}
function qwContentHTML(text){return qwTokens(text).map(t=>t.t==='math'?'<math xmlns="http://www.w3.org/1998/Math/MathML" aria-label="'+qwEsc(t.v)+'">'+qwMathML(t.ast)+'</math>':t.t==='blank'?'<span class="qw-inline-blank" style="width:'+t.size+'ch" aria-label="Место для ответа"></span>':t.t==='error'?'<span class="qw-formula-error" title="'+qwEsc(t.error)+'">'+qwEsc(t.v)+'</span>':qwPlainMathHTML(t.v).replace(/\n/g,'<br>')).join('');}
/* Safe, bounded Markdown-style rendering shared by the bank and print.
   Explicit syntax is rendered as known elements. User HTML is escaped. */
function qwRichInlineText(input,depth=0){
 const source=String(input||'');
 if(depth>4)return qwEsc(source);
 const pattern=/(\*\*([^*\n]+)\*\*|__([^_\n]+)__|~~([^~\n]+)~~|`([^`\n]+)`|\*([^*\n]+)\*|(^|[^\w])_([^_\n]+)_|\+\+([^+\n]+)\+\+|\^\{([^{}\n]+)\}|~\{([^{}\n]+)\})/g;
 let html='',pos=0,m;
 while((m=pattern.exec(source))){
  html+=qwPlainMathHTML(source.slice(pos,m.index));
  if(m[2]!==undefined||m[3]!==undefined)html+='<strong>'+qwRichInlineText(m[2]??m[3],depth+1)+'</strong>';
  else if(m[4]!==undefined)html+='<del>'+qwEsc(m[4])+'</del>';
  else if(m[5]!==undefined)html+='<code>'+qwEsc(m[5])+'</code>';
  else if(m[6]!==undefined)html+='<em>'+qwRichInlineText(m[6],depth+1)+'</em>';
  else if(m[8]!==undefined)html+=qwEsc(m[7])+'<em>'+qwRichInlineText(m[8],depth+1)+'</em>';
  else {
   const tag=m[9]!==undefined?'u':m[10]!==undefined?'sup':'sub';
   html+='<'+tag+'>'+qwRichInlineText(m[9]??m[10]??m[11],depth+1)+'</'+tag+'>';
  }
  pos=pattern.lastIndex;
 }
 return html+qwPlainMathHTML(source.slice(pos));
}
function qwRichMath(value,display=false){
 try{
  return '<math xmlns="http://www.w3.org/1998/Math/MathML" display="'+(display?'block':'inline')+'" aria-label="'+qwEsc(value)+'">'+qwMathML(qwMath(value))+'</math>';
 }catch(error){
  return '<span class="qw-formula-error" title="'+qwEsc(error.message)+'">'+qwEsc(value)+'</span>';
 }
}
function qwRichInline(source){
 // Keep formulas and blanks atomic inside styles such as **F = \(ma\)**.
 // Literal NUL would be replaced by the HTML parser anyway.
 const atoms=[];
 const marker=html=>'\0'+(atoms.push(html)-1)+'\0';
 const render=text=>qwRichInlineText(text).replace(/\0(\d+)\0/g,(_,index)=>atoms[Number(index)]);
 const text=String(source||'').replace(/\0/g,'�').replace(
  /(\x60[^\x60\n]+\x60)|\\\(([\s\S]*?)\\\)|\[\[blank:(\d{1,2})\]\]|\$([^$\n]{1,600})\$|\\([\\*_~^+\x60$|#>[\].!:()-])/g,
  (match,code,formula,blank,alternate,escaped)=>{
   if(code)return marker(qwRichInlineText(code));
   const html=escaped!==undefined?qwEsc(escaped):blank!==undefined?
    '<span class="qw-inline-blank" style="width:'+Math.max(1,Math.min(30,Number(blank)))+'ch" aria-label="Место для ответа"></span>':
    qwRichMath(formula??alternate);
   return marker(html);
  });
 const stack=[{text:''}];let offset=0;
 for(const tag of text.matchAll(/\[\[(?:style ([^\]\n]{1,180})|(\/style))\]\]/g)){
  const top=stack.at(-1);top.text+=text.slice(offset,tag.index);offset=tag.index+tag[0].length;
  const style=tag[1]&&qwReadTextStyle(tag[1]);
  if(style&&stack.length<13)stack.push({text:'',style,original:tag[0]});
  else if(tag[2]&&stack.length>1){
   const frame=stack.pop();
   stack.at(-1).text+=marker('<span'+qwTextStyleAttrs(frame.style)+'>'+render(frame.text)+'</span>');
  }else top.text+=tag[0];
 }
 stack.at(-1).text+=text.slice(offset);
 while(stack.length>1){const frame=stack.pop();stack.at(-1).text+=frame.original+frame.text;}
 return render(stack[0].text);
}
/* TASK165: leave ordinary legacy exercises byte-for-byte on the original PDF
   text path. Only explicit Markdown syntax opts an individual field in. */
function qwHasRichSyntax(value){
 const text=String(value??'');
 return /\[\[style |^::format /m.test(text)||/(^|\n)\s{0,3}(?:#{1,4}\s+|[-*+]\s+|\d{1,3}[.)]\s+|>\s?|`{3}|(?:-{3,}|\*{3,}|_{3,})[ \t]*$|\${2}\s*$|\\\[\s*$|::(?:left|center|right|justify)[ \t]+)/m.test(text)||
  /\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|(^|[^\w])(?:\*[^*\n]+\*|_[^_\n]+_)|`[^`\n]+`|\$[^$\n]{1,600}\$/.test(text)||
  /\\\\/.test(text)||(/[\\+^~]/.test(text)&&qwTokens(text).some(token=>token.t==='text'&&/\\[\\*_~^+\x60$|#>[\].!:-]|\+\+[^+\n]+\+\+|[\^~]\{[^{}\n]+\}/.test(token.v)))||
  /(^|\n)\s*\|?[^\n]*\|[^\n]*\n\s*\|?\s*:?-{3,}/.test(text);
}
function qwPrintFieldHTML(value){
 return qwHasRichSyntax(value)?qwRichMarkdownHTML(value):qwContentHTML(value);
}
function qwRichMarkdownHTML(value,onBlock,depth=0){
 const lines=String(value??'').replace(/\r\n?/g,'\n').split('\n');
 const result=[];
 const bullet=line=>/^\s{0,3}[-*+]\s+/.test(line);
 const numbered=line=>/^\s{0,3}\d{1,3}[.)]\s+/.test(line);
 const heading=line=>/^\s{0,3}#{1,4}\s+/.test(line);
 const alignment=line=>line.match(/^\s{0,3}::(left|center|right|justify)[ \t]+(.+)$/);
 const quote=line=>/^\s{0,3}>\s?/.test(line);
 const formatted=line=>line.match(/^::format ([^\n]{1,180})$/);
 const fence=line=>/^\s{0,3}```/.test(line);
 const ruler=line=>/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
 const cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split(/(?<!\\)\|/).map(x=>x.trim());
 const tableSep=line=>/^\s*\|?[\s:|-]+\|?\s*$/.test(line)&&line.includes('-')&&line.includes('|');
 const startBlock=line=>bullet(line)||numbered(line)||heading(line)||alignment(line)||quote(line)||fence(line)||ruler(line)||formatted(line)||/^\s*(?:\$\$|\\\[)\s*$/.test(line);
 let i=0,blockStart=0,pending=null;
 const emit=html=>{
  result.push(pending?'<div class="qw-format-block qw-local-format"'+qwTextStyleAttrs(pending.style)+'>'+html+'</div>':html);
  if(onBlock)onBlock(lines.slice(pending?.start??blockStart,i).join('\n'));pending=null;
 };
 while(i<lines.length){
  const line=lines[i];
  if(!line.trim()){i++;continue;}
  blockStart=i;
  const format=formatted(line),style=format&&qwReadTextStyle(format[1]);
  if(style&&!pending&&lines[i+1]?.trim()){pending={start:i++,style};continue;}
  if(fence(line)){
   const lang=line.trim().slice(3).trim().slice(0,30);
   i++;const code=[];
   while(i<lines.length&&!fence(lines[i]))code.push(lines[i++]);
   if(i<lines.length)i++;
   emit('<pre><code'+(lang?' data-language="'+qwEsc(lang)+'"':'')+'>'+qwEsc(code.join('\n'))+'</code></pre>');
   continue;
  }
  if(/^\s*(?:\$\$|\\\[)\s*$/.test(line)){
   const end=line.trim().charCodeAt(0)===36?String.fromCharCode(36,36):'\\]',body=[];
   i++;while(i<lines.length&&lines[i].trim()!==end)body.push(lines[i++]);
   if(i<lines.length)i++;
   emit('<div class="qw-rich-equation">'+qwRichMath(body.join(' ').trim(),true)+'</div>');
   continue;
  }
  if(heading(line)){
   const m=line.match(/^\s{0,3}(#{1,4})\s+(.*)$/),level=m[1].length+2;
   i++;emit('<h'+level+'>'+qwRichInline(m[2])+'</h'+level+'>');continue;
  }
  const aligned=alignment(line);
  if(aligned){
   i++;emit('<p style="text-align:'+aligned[1]+'">'+qwRichInline(aligned[2])+'</p>');continue;
  }
  if(ruler(line)){i++;emit('<hr>');continue;}
  if(quote(line)){
   const chunk=[];
   while(i<lines.length&&quote(lines[i]))chunk.push(lines[i++].replace(/^\s{0,3}>\s?/,''));
   const callout=depth<4&&chunk[0].match(/^\[!([a-z]+)(?: ([^\]]{1,180}))?\](?:[ \t]+(.*))?$/);
   const options=callout&&qwCalloutOptions(callout[1],callout[2]);
   if(options){
    const type=callout[1],look=qwCalloutLook(type,options);
    emit('<aside class="qw-callout" data-qw-callout="'+type+'" data-qw-callout-options="'+qwCalloutOptionSource(options)+'" style="'+look.css+'">'+
     '<div class="qw-callout-title">'+(look.icon?'<span class="qw-callout-icon" aria-hidden="true" contenteditable="false">'+look.icon+'</span>':'')+
     '<span data-qw-callout-title>'+qwRichInline(callout[3]||look.label)+'</span></div><div class="qw-callout-body">'+
     (qwRichMarkdownHTML(chunk.slice(1).join('\n'),null,depth+1)||'<p><br></p>')+'</div></aside>');
   }else emit('<blockquote><p>'+chunk.map(qwRichInline).join('<br>')+'</p></blockquote>');
   continue;
  }
  if(bullet(line)||numbered(line)){
   const ordered=numbered(line),items=[],regex=ordered?/^\s{0,3}\d{1,3}[.)]\s+/:/^\s{0,3}[-*+]\s+/;
   while(i<lines.length&&regex.test(lines[i]))items.push('<li>'+qwRichInline(lines[i++].replace(regex,''))+'</li>');
   emit((ordered?'<ol>':'<ul>')+items.join('')+(ordered?'</ol>':'</ul>'));continue;
  }
  if(i+1<lines.length&&line.includes('|')&&tableSep(lines[i+1])){
   const head=cells(line);i+=2;const rows=[];
   while(i<lines.length&&lines[i].trim()&&lines[i].includes('|')&&!startBlock(lines[i])){
    const row=cells(lines[i++]);rows.push('<tr>'+head.map((_,j)=>'<td>'+qwRichInline(row[j]||'')+'</td>').join('')+'</tr>');
   }
   if(head.length<=12)emit('<div class="qw-rich-table-scroll"><table><thead><tr>'+head.map(c=>'<th>'+qwRichInline(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>');
   else emit('<p>'+qwRichInline(lines.slice(blockStart,i).join(' '))+'</p>');
   continue;
  }
  const paragraph=[line];i++;
  while(i<lines.length&&lines[i].trim()&&!startBlock(lines[i])&&!(lines[i].includes('|')&&tableSep(lines[i+1]||''))){
   paragraph.push(lines[i++]);
  }
  emit('<p>'+paragraph.map(qwRichInline).join('<br>')+'</p>');
 }
 return result.join('');
}

/* Axes use true coordinate positions. Tick marks and labels have independent
   density: labels never determine the grid spacing or collide at the origin. */
const QW_GRAPH_STANDARD={axis:1.7,line:2.4,tick:3,head:11,headHalf:4.2,point:3.5,grid:'#dddddd',gridWeight:.8,title:16};
function qwAxisLayout(g,axisFont,russian=false){
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
  const format=value=>russian?String(value===0?0:value).replace('.',',').replace(/^-/,'−'):String(value===0?0:value);
  const longest=Math.max(format(Number(min.toPrecision(6))).length,format(Number(max.toPrecision(6))).length);
  const gap=pixels*step/span;
  const desired=axis==='x'?Math.max(17,longest*font*.59+5):font+6;
  const minimum=Math.max(1,Math.ceil(desired/Math.max(1,gap)));
  const decade=10**Math.floor(Math.log10(minimum*step));
  const nice=[1,2,2.5,5,10].map(n=>n*decade/step).find(n=>n>=minimum-1e-8&&Math.abs(n-Math.round(n))<1e-8);
  const stride=russian&&axisFont&&nice?Math.round(nice):minimum;
  let count=0;
  for(let n=Math.ceil((min-1e-8)/step);n*step<=max+step*.00001&&count++<30;n++){
   const v=Number((n*step).toPrecision(9));
   const p=qwPlotXY(g,{x:v,y:v});
   const isZero=Math.abs(v)<step*1e-7;
   let numbered=n%stride===0;
   // The shared origin receives exactly one 0, on X.
   if(axis==='y'&&isZero&&zeroX)numbered=false;
   if(axis==='x'&&isZero&&zeroY)numbered=true;
   const label=format(v);
   const w=Math.max(8,label.length*font*.63);
   if(axisFont&&!russian&&!isZero){
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
 const b=QW_PLOT,style=QW_GRAPH_STANDARD,parts=[],occupied=[],layout=qwAxisLayout(g,typography.axisFont,typography.publishing===true),
  {axisX,axisY,font,ticks}=layout;
 const line=(x,y,x2,y2,extra='')=>'<line x1="'+x+'" y1="'+y+'" x2="'+x2+'" y2="'+y2+'" '+extra+'/>';
 const overlap=(a,v)=>Math.max(0,Math.min(a.x+a.w,v.x+v.w)-Math.max(a.x,v.x))*Math.max(0,Math.min(a.y+a.h,v.y+v.h)-Math.max(a.y,v.y));
 parts.push('<rect x="'+b.left+'" y="'+b.top+'" width="'+(b.right-b.left)+'" height="'+(b.bottom-b.top)+'" fill="white"/>');
 // Every grid line and small tick is retained even when a number is omitted.
 for(const t of ticks.x){
  if(g.grid)parts.push(line(t.pos,b.top,t.pos,b.bottom,'data-qw-grid-line="true" stroke="'+style.grid+'" stroke-width="'+style.gridWeight+'"'));
  parts.push(line(t.pos,axisY-style.tick,t.pos,axisY+style.tick,'stroke="#000"'));
 }
 for(const t of ticks.y){
  if(g.grid)parts.push(line(b.left,t.pos,b.right,t.pos,'data-qw-grid-line="true" stroke="'+style.grid+'" stroke-width="'+style.gridWeight+'"'));
  parts.push(line(axisX-style.tick,t.pos,axisX+style.tick,t.pos,'stroke="#000"'));
 }
 if(typography.publishing&&g.grid&&g.connected&&g.points.length>2){
  const guide='data-qw-grid-line="true" data-qw-reference="true" stroke="#888" stroke-width="1" stroke-dasharray="4 3"';
  const marked=(axis,value)=>ticks[axis].some(t=>t.numbered&&Math.abs(t.value-value)<1e-8);
  g.points.slice(1,-1).forEach((point,i)=>{
   const before=g.points[i],after=g.points[i+2];
   if(Math.abs((point.x-before.x)*(after.y-point.y)-(point.y-before.y)*(after.x-point.x))<1e-8)return;
   const p=qwPlotXY(g,point);
   if(p.x<b.left||p.x>b.right||p.y<b.top||p.y>b.bottom)return;
   if(!marked('x',point.x))parts.push(line(p.x,p.y,p.x,axisY,guide));
   if(!marked('y',point.y))parts.push(line(p.x,p.y,axisX,p.y,guide));
  });
 }
 // Draw arrowheads separately: the visible shaft ends at the head's base,
 // not at the tip (marker-end used to leave a line through the arrowhead).
 const xTip=b.right+16,xBase=xTip-style.head,yTip=b.top-16,yBase=yTip+style.head;
 const shaft='stroke="#000" stroke-width="'+style.axis+'" stroke-linecap="butt" ';
 parts.push(line(b.left,axisY,xBase,axisY,shaft+'data-qw-axis-shaft="x"'),
  '<path data-qw-axis-head="x" d="M'+xTip+' '+axisY+' L'+xBase+' '+(axisY-style.headHalf)+' L'+xBase+' '+(axisY+style.headHalf)+' Z" fill="#000"/>',
  line(axisX,b.bottom,axisX,yBase,shaft+'data-qw-axis-shaft="y"'),
  '<path data-qw-axis-head="y" d="M'+axisX+' '+yTip+' L'+(axisX-style.headHalf)+' '+yBase+' L'+(axisX+style.headHalf)+' '+yBase+' Z" fill="#000"/>');
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
  parts.push('<text class="qw-axis-number" data-axis="x" data-value="'+t.value+'" x="'+x+'" y="'+xBaseline+'" font-size="'+font+'" text-anchor="middle" fill="#000">'+t.label+'</text>');
 }
 for(const t of ticks.y){
  if(!t.numbered)continue;
  let y=t.pos+font*.34;
  if(y-font<axisY+3&&y+2>axisY-3)y=axisY-5;
  const box={x:yLabelX-t.w,y:y-font,w:t.w,h:font+2};
  if(numberBoxes.some(v=>overlap(v,box)>0))continue;
  numberBoxes.push(box);occupied.push(box);
  parts.push('<text class="qw-axis-number" data-axis="y" data-value="'+t.value+'" x="'+yLabelX+'" y="'+y+'" font-size="'+font+'" text-anchor="end" fill="#000">'+t.label+'</text>');
 }
 const titleFont=typography.titleFont||style.title,gap=6;
 const title=(axis,x,y,anchor,value,tipX,tipY)=>{
  const attrs=' class="qw-axis-title" data-axis="'+axis+'" data-axis-tip-x="'+tipX+'" data-axis-tip-y="'+tipY+'"';
  if(qwScienceExpression(value))return '<g'+attrs+' font-size="'+titleFont+'" transform="translate('+x+' '+y+')"><g data-qw-axis-art>'+qwScienceLabel(value,0,0,titleFont,anchor)+'</g></g>';
  return '<text'+attrs+' x="'+x+'" y="'+y+'" font-size="'+titleFont+'" text-anchor="'+anchor+'" fill="#000">'+qwEsc(value)+'</text>';
 };
 // Final placement uses actual glyph bounds (including descenders and subscripts).
 parts.push(title('x',xTip+gap,axisY+titleFont*.35,'start',g.xlabel,xTip,axisY),
  title('y',axisX,yTip-gap,'middle',g.ylabel,axisX,yTip));
 if(g.curveFamily!=='points'){
  let d='',drawing=false;
  for(let i=0;i<=300;i++){
   const x=g.xmin+(g.xmax-g.xmin)*i/300,y=qwEvaluateCurve(g,x);
   if(!Number.isFinite(y)||y<g.ymin||y>g.ymax){drawing=false;continue;}
   const p=qwPlotXY(g,{x,y});
   d+=(drawing?' L':' M')+p.x.toFixed(2)+','+p.y.toFixed(2);drawing=true;
  }
  if(d)parts.push('<path d="'+d.trim()+'" fill="none" stroke="'+qwGraphTemplateStroke(g,'curveStyle',typography.publishing)+'" stroke-width="'+(g.curveStyle?.width||style.line)+'" stroke-linecap="round"/>');
 }
 const ps=g.points.map(p=>qwPlotXY(g,p));
 if(g.curveFamily==='points'&&g.connected&&ps.length>1){
  let d='M'+ps[0].x+','+ps[0].y;
  for(let i=1;i<ps.length;i++){
   const a=ps[i-1],p=ps[i];
   d+=g.smooth?' C'+((a.x+p.x)/2)+','+a.y+' '+((a.x+p.x)/2)+','+p.y+' '+p.x+','+p.y:' L'+p.x+','+p.y;
  }
  parts.push('<path d="'+d+'" fill="none" stroke="'+qwGraphTemplateStroke(g,'lineStyle')+'" stroke-width="'+(g.lineStyle?.width||style.line)+'"/>');
 }
 ps.forEach((p,i)=>{
  parts.push('<g '+(interactive?'data-qw-point="'+i+'"':'')+'><circle cx="'+p.x+'" cy="'+p.y+'" r="'+(interactive?5:style.point)+'" fill="'+qwEffectiveObjectPaint(g.points[i],'graph-point').stroke+'"/></g>');
 });
 const contour=g.connected&&g.curveFamily==='points'&&!g.smooth?qwClosedContour(ps):null;
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
  const outward=contour?qwContourOutward(contour,i%contour.length):null;
  if(outward&&g.points[i].labelPosition?.mode!=='manual'){
   const gap=10;best={x:p.x+(outward.x<-.1?-w-gap:outward.x>.1?gap:-w/2),y:p.y+(outward.y<-.1?-h-gap/2:outward.y>.1?gap:-h/2),w,h};
  }
  occupied.push(best);
  parts.push(qwLabelSVG('g:p:'+i,p,g.points[i].labelPosition,qwScienceLabel(label,best.x,best.y+17,19,'start',false,g.points[i].style?.text||'#000'),{plot:true,contour,outward}));
 });
 parts.push(qwGraphElementsSVG(g,interactive));
 return qwPlaceSVGLabels(qwSVG(parts.join(''),'Координатный график'));
}
function qwSVGKey(value){let hash=2166136261;for(const c of JSON.stringify(value)){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(36);}
// Effective visual defaults are shared with the object inspector, not stored in QWORK.
function qwEffectiveObjectPaint(object,kind){
 const paint=object?.style?qwValidateStyle(object.style):{};
 const stroke=paint.stroke||'#222222';
 return {...paint,stroke,width:paint.width||(kind==='graph-element'?2.5:2),
  text:paint.text||(kind==='graph-element'?stroke:'#000000')};
}
function qwGraphTemplateStroke(graph,key,publishing=false){
 return graph[key]?.stroke||(key==='curveStyle'&&!publishing?'#186ba3':'#222222');
}
function qwGraphElementsSVG(g,interactive=false){
 const key=qwSVGKey(g),b=QW_PLOT,clip='<defs><clipPath id="qw-plot-clip"><rect x="'+b.left+'" y="'+b.top+'" width="'+(b.right-b.left)+'" height="'+(b.bottom-b.top)+'"/></clipPath></defs>';
 return clip+(g.elements||[]).map((o,i)=>{
  const {stroke:color,width,text}=qwEffectiveObjectPaint(o,'graph-element');
  let shape='',label='',ps=[];
  if(o.kind==='function'){
   for(let n=0;n<=400;n++){const x=g.xmin+(g.xmax-g.xmin)*n/400,y=qwEvaluateCurve({curveFamily:o.family,curve:o.curve},x);ps.push(qwPlotXY(g,{x,y}));}
  }else ps=(o.vertices||[{x:o.x,y:o.y},...(['line','arrow'].includes(o.kind)?[{x:o.x2,y:o.y2}]:[])]).map(p=>qwPlotXY(g,p));
  if(o.kind==='arrow')shape=qwArrowSVG(ps,color,width);
  else if(['line','polyline','function'].includes(o.kind)){
   shape='<path d="'+ps.map((p,n)=>(n?'L':'M')+p.x.toFixed(3)+' '+p.y.toFixed(3)).join(' ')+'" fill="none" stroke="'+color+'" stroke-width="'+width+'" stroke-linecap="round" stroke-linejoin="round"/>';
  }else if(o.kind==='point')shape='<circle cx="'+ps[0].x+'" cy="'+ps[0].y+'" r="4" fill="'+color+'"/>';
  if(o.label&&ps.length){const p=ps[Math.floor((ps.length-1)/2)];label=qwLabelSVG('g:e:'+i,p,o.labelPosition,qwScienceLabel(o.label,p.x+(o.kind==='text'?0:8),p.y+(o.kind==='text'?0:-10),18,'start',false,text),{plot:true,free:o.kind==='text'});}
  return '<g '+(interactive?'data-qw-element="'+i+'"':'')+' clip-path="url(#qw-plot-clip)">'+shape+label+'</g>';
 }).join('');
}
function qwSVG(body,label='Учебная схема'){return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 320" role="img" aria-label="'+qwEsc(label)+'" style="font:18px Arial,sans-serif;background:white;color:black"> '+body+'</svg>';}

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
 const label=(value,x,y,size=18,anchor='middle',vector=false)=>qwScienceLabel(value,numeric(x),numeric(y),size,anchor,vector);
 return qwPlaceSVGLabels(qwSVG(guides+objects.map((o,i)=>{
  const paint=o.style?qwValidateStyle(o.style):{}, {stroke,width}=qwEffectiveObjectPaint(o,'diagram'),fill=paint.fill||'none';
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
   shape=['arrow','doubleArrow'].includes(o.kind)?qwArrowSVG([{x:o.x,y:o.y},{x:o.x2,y:o.y2}],stroke,width,{start:o.kind==='doubleArrow'}):
    '<line x1="'+o.x+'" y1="'+o.y+'" x2="'+o.x2+'" y2="'+o.y2+'"'+a+(o.kind==='dashed'?' stroke-dasharray="6 4"':'')+'/>';
   if(o.kind==='ground'){
    const dx=o.x2-o.x,dy=o.y2-o.y,length=Math.hypot(dx,dy)||1;
    for(let distance=10;distance<=length-8;distance+=14){
     const ux=dx/length,uy=dy/length,x=o.x+ux*distance,y=o.y+uy*distance;
     shape+='<line x1="'+numeric(x)+'" y1="'+numeric(y)+'" x2="'+numeric(x-ux*6-uy*9)+'" y2="'+numeric(y-uy*6+ux*9)+'" stroke="#777777" stroke-width="1.1" stroke-linecap="round"/>';
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
  if(QW_MECHANICS.includes(o.kind)||QW_ELECTRICS.includes(o.kind)){
   shape=qwPhysicsShape(o,interactive);
  }
  if(o.kind==='block'){
   shape='<rect x="'+minX+'" y="'+minY+'" width="'+Math.max(w,3)+'" height="'+Math.max(h,3)+'" fill="#f2f2f2" stroke="#222222" stroke-width="2"/>';
  }
  if(o.kind==='incline')shape='<polygon points="'+minX+','+maxY+' '+maxX+','+maxY+' '+maxX+','+minY+'" fill="#eeeeee" stroke="#222222" stroke-width="2"/>';
  if(['pulley','fixedPulley','movablePulley'].includes(o.kind)){
   const rad=Math.max(8,Math.min(w,h)/2),cx=minX+w/2,cy=minY+h/2;
   shape='<circle cx="'+numeric(cx)+'" cy="'+numeric(cy)+'" r="'+numeric(rad)+'" fill="white" stroke="#222222" stroke-width="2"/>'+
    '<circle cx="'+numeric(cx)+'" cy="'+numeric(cy)+'" r="3.5" fill="#222222"/>'+
    (o.kind==='movablePulley'?
     '<path d="M'+numeric(cx-rad)+' '+numeric(cy-rad-32)+'V'+numeric(cy)+' A'+rad+' '+rad+' 0 0 0 '+numeric(cx+rad)+' '+numeric(cy)+'V'+numeric(cy-rad-32)+'" fill="none" stroke="#222222" stroke-width="2"/>'+
     '<path d="M'+numeric(cx)+' '+numeric(cy)+'V'+numeric(cy+rad+14)+'q0 8 7 4" fill="none" stroke="#222222" stroke-width="2"/>':
     '<line x1="'+numeric(cx)+'" y1="'+numeric(cy)+'" x2="'+numeric(cx)+'" y2="'+numeric(cy-rad-14)+'" stroke="#222222" stroke-width="2"/>');
  }
  if(o.kind==='rect')shape='<rect x="'+minX+'" y="'+minY+'" width="'+Math.max(w,1)+'" height="'+Math.max(h,1)+'"'+a+'/>';
  if(o.kind==='circle'||o.kind==='ellipse')shape='<ellipse cx="'+(minX+w/2)+'" cy="'+(minY+h/2)+'" rx="'+Math.max(w/2,1)+'" ry="'+Math.max(h/2,1)+'"'+a+'/>';
  if(o.kind==='point')shape='<circle cx="'+o.x+'" cy="'+o.y+'" r="3" fill="#222222"/>';
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
    shape+='<circle cx="'+p.x+'" cy="'+p.y+'" r="2.5" fill="#222222"/>';
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
   else if(['forceVector','velocityVector','accelerationVector'].includes(o.kind)){
    const dx=o.x2-o.x,dy=o.y2-o.y,length=Math.hypot(dx,dy)||1;
    // Use the upper normal in both directions, or the right side for a vertical vector.
    const nx=dx===0?1:dy*Math.sign(dx)/length,ny=-Math.abs(dx)/length;
    captions+=objectLabel(o.label,labelAnchor.x+nx*19,labelAnchor.y+ny*17+(dx===0?6:0),18,'middle',true);
   }
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
  if(paint.stroke||paint.width)shape=shape.replace(/stroke="#222222"/g,'stroke="'+stroke+'"').replace(/stroke-width="2"/g,'stroke-width="'+width+'"').replace(/fill="#222222"/g,'fill="'+stroke+'"');
  if(paint.fill)shape=shape.replace(/fill="(?:none|#f2f2f2|#eeeeee|white)"/g,'fill="'+fill+'"');
  if(paint.text)captions=captions.replace(/(fill|stroke)="#000"/g,'$1="'+paint.text+'"');

  const center=o.kind==='regularPolygon'?{x:(o.x+o.x2)/2,y:(o.y+o.y2)/2}:{x:minX+w/2,y:minY+h/2},transform=o.rotation?' transform="rotate('+o.rotation+' '+numeric(center.x)+' '+numeric(center.y)+')"':'';
  return '<g data-qw-label-owner="d:'+i+'" '+(interactive?'data-qw-object="'+i+'"':'')+transform+'>'+shape+captions+'</g>';
 }).join('')));
}
export {qwEffectiveObjectPaint,qwGraphTemplateStroke,qwMath,qwMathML,qwMathBox,qwTokens,qwContentHTML,qwHasRichSyntax,qwPrintFieldHTML,qwRichMarkdownHTML,qwAxisLayout,qwGraphSVG,qwDiagramSVG,qwPlotXY,qwEsc};
