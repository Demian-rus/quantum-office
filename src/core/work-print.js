/* Portable PDF: paginated A4 canvases rendered at 180 dpi, embedded by pdf-lib.
   Student output never traverses answer/criteria/comment strings. */
function qwMathBox(ctx,n,size=12){
 const text=v=>{ctx.font=size+'px "Times New Roman",serif';const w=ctx.measureText(v).width;return {w,a:size*.8,d:size*.24,draw:(x,y)=>{ctx.font=size+'px "Times New Roman",serif';ctx.fillText(v,x,y);}};};
 if(n.t==='text')return text(n.v);
 if(n.t==='row'){const bs=n.list.map(v=>qwMathBox(ctx,v,size));return {w:bs.reduce((s,b)=>s+b.w,0),a:Math.max(size*.8,...bs.map(b=>b.a)),d:Math.max(size*.24,...bs.map(b=>b.d)),draw:(x,y)=>{for(const b of bs){b.draw(x,y);x+=b.w;}}};}
 if(n.t==='frac'){const a=qwMathBox(ctx,n.a,size*.84),b=qwMathBox(ctx,n.b,size*.84),w=Math.max(a.w,b.w)+8;return {w,a:a.a+a.d+size*.35,d:b.a+b.d+size*.25,draw:(x,y)=>{a.draw(x+(w-a.w)/2,y-size*.35-a.d);ctx.beginPath();ctx.lineWidth=.7;ctx.moveTo(x,y-size*.18);ctx.lineTo(x+w,y-size*.18);ctx.stroke();b.draw(x+(w-b.w)/2,y+b.a+2);}};}
 if(n.t==='sqrt'){const a=qwMathBox(ctx,n.a,size);return {w:a.w+size*.8,a:a.a+3,d:a.d,draw:(x,y)=>{ctx.font=(size*1.2)+'px "Times New Roman",serif';ctx.fillText('√',x,y+1);a.draw(x+size*.8,y);ctx.beginPath();ctx.lineWidth=.6;ctx.moveTo(x+size*.7,y-a.a-1);ctx.lineTo(x+a.w+size*.8,y-a.a-1);ctx.stroke();}};}
 const a=qwMathBox(ctx,n.a,size),b=qwMathBox(ctx,n.b,size*.66),dy=n.t==='sup'?-size*.58:size*.34;return {w:a.w+b.w,a:Math.max(a.a,b.a-dy),d:Math.max(a.d,b.d+dy),draw:(x,y)=>{a.draw(x,y);b.draw(x+a.w,y+dy);}};
}
async function qwImage(source){const img=new Image();img.src=source;await img.decode();return img;}
async function qwFigureImage(q){if(q.figure==='image'&&q.image)return qwImage(q.image);const svg=q.figure==='graph'?qwGraphSVG(q.graph):q.figure==='diagram'?qwDiagramSVG(q.diagram):'';if(!svg)return null;const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));try{return await qwImage(url);}finally{URL.revokeObjectURL(url);}}
async function qwRenderPages(project,teacher=false,options={answers:true,criteria:true,comments:true}){
 const d=qwValidate(project);if(!d.tasks.length)throw Error('Добавьте задания в работу');const pages=[],W=595.28,H=841.89,M=43,bottom=H-40;let ctx,y=0,page,activeTask=0;
 function newPage(){if(pages.length>=QW_LIMITS.pages)throw Error('Работа превышает 80 страниц');page=document.createElement('canvas');page.width=Math.round(W*2.5);page.height=Math.round(H*2.5);ctx=page.getContext('2d');ctx.scale(2.5,2.5);ctx.fillStyle='white';ctx.fillRect(0,0,W,H);ctx.fillStyle='#111';ctx.strokeStyle='#222';ctx.font='bold 13px Arial';const titleLines=[];let line='';for(const word of d.title.split(/\s+/)){if(ctx.measureText(line+' '+word).width>W-2*M&&line){titleLines.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)titleLines.push(line);titleLines.forEach((l,i)=>ctx.fillText(l,M,28+i*16));const header=28+(titleLines.length-1)*16;ctx.font='9px Arial';ctx.fillText((d.subject==='math'?'Математика':'Физика')+' · '+d.grade+' класс · Вариант '+d.variant+(teacher?' · Для преподавателя':''),M,header+17);ctx.strokeStyle='#aaa';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(M,header+25);ctx.lineTo(W-M,header+25);ctx.stroke();ctx.strokeStyle='#222';y=header+43;if(activeTask){ctx.font='bold 9px Arial';ctx.fillText('Задание '+activeTask+' (продолжение)',M,y+9);y+=23;}pages.push(page);}
 function ensure(h){if(y+h>bottom)newPage();}
 function textWidth(s,size=11,bold=false){ctx.font=(bold?'bold ':'')+size+'px Arial';return ctx.measureText(s).width;}
 function text(s,x,baseline,size=11,bold=false){ctx.fillStyle='#111';ctx.font=(bold?'bold ':'')+size+'px Arial';ctx.fillText(s,x,baseline);}
 function flow(source,figure=null,size=11,bold=false){
  const parts=[];for(const token of qwTokens(source)){if(token.t==='error')throw Error('Формула: '+token.error);if(token.t==='text')for(const t of token.v.split(/(\n|[ \t]+)/).filter(Boolean))parts.push({t:'text',v:t});else parts.push(token);}
  let row=[],rowWidth=0;
  const bounds=()=>{const around=figure&&figure.page===pages.length&&y<figure.end&&y>=figure.start;return {x:around&&figure.position==='left'?M+figure.w+12:M,width:W-2*M-(around?figure.w+12:0)};};
  function flush(){if(!row.length){y+=size*1.5;return;}const metrics=row.map(t=>t.t==='math'?qwMathBox(ctx,t.ast,size+1):{w:t.t==='blank'?t.size*6:textWidth(t.v,size,bold),a:size*.8,d:size*.24}),a=Math.max(...metrics.map(m=>m.a)),desc=Math.max(...metrics.map(m=>m.d));ensure(a+desc+6);const b=bounds();let x=b.x;row.forEach((t,i)=>{const m=metrics[i];if(t.t==='math'){ctx.fillStyle='#111';qwMathBox(ctx,t.ast,size+1).draw(x,y+a);}else if(t.t==='blank'){ctx.beginPath();ctx.lineWidth=.65;ctx.moveTo(x,y+a+2);ctx.lineTo(x+m.w,y+a+2);ctx.stroke();}else text(t.v,x,y+a,size,bold);x+=m.w;});y+=Math.max(size*1.5,a+desc+5);row=[];rowWidth=0;}
  for(let t of parts){if(t.t==='text'&&t.v==='\n'){flush();continue;}let w=t.t==='math'?qwMathBox(ctx,t.ast,size+1).w:t.t==='blank'?t.size*6:textWidth(t.v,size,bold);if(t.t==='text'&&/^\s+$/.test(t.v)&&!row.length)continue;
   if(w>bounds().width&&t.t==='text'){for(const char of t.v){const cw=textWidth(char,size,bold);if(rowWidth+cw>bounds().width)flush();row.push({t:'text',v:char});rowWidth+=cw;}continue;}
   if(w>W-2*M&&t.t==='math')throw Error('Слишком широкая формула: разделите выражение');
   if(rowWidth+w>bounds().width&&row.length)flush();row.push(t);rowWidth+=w;
  }if(row.length)flush();
 }
 function area(height,style){let remaining=height;while(remaining>0){ensure(28);const h=Math.min(remaining,bottom-y);ctx.strokeStyle='#ccc';ctx.lineWidth=.4;if(style==='blank')ctx.strokeRect(M,y,W-2*M,h);else{for(let yy=y+12;yy<=y+h;yy+=style==='grid'?12:18){ctx.beginPath();ctx.moveTo(M,yy);ctx.lineTo(W-M,yy);ctx.stroke();}if(style==='grid')for(let xx=M;xx<=W-M;xx+=12){ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx,y+h);ctx.stroke();}}ctx.strokeStyle='#222';y+=h;remaining-=h;if(remaining>0)newPage();}}
 newPage();if(d.topic){flow(d.topic,null,11,true);y+=6;}if(d.identity){text('ФИО: ____________________________________    Дата: ______________',M,y+10,10);y+=28;}if(d.instructions){flow(d.instructions,null,10);y+=12;}
 let part='';for(let i=0;i<d.tasks.length;i++){
  activeTask=0;const q=d.tasks[i];if(!q.prompt.trim())throw Error('Заполните условие задания '+(i+1));const image=q.figure!=='none'?await qwFigureImage(q):null;let imageW=Math.min(q.figureWidth,W-2*M),imageH=image?imageW*image.height/image.width:0;if(imageH>300){imageW*=300/imageH;imageH=300;}if(q.pageBreak&&i>0)newPage();ensure(70+imageH);if(q.part&&q.part!==part){flow(q.part,null,12,true);y+=7;part=q.part;}
  text('Задание '+(i+1)+' · '+QW_TYPES[q.type],M,y+11,10,true);text(q.points+' б.',W-M-34,y+11,10);y+=27;activeTask=i+1;
  let fig=null;if(q.figure!=='none'){if(image){const w=imageW,h=imageH;if(q.position!=='below'){const x=q.position==='left'?M:W-M-w;ctx.drawImage(image,x,y,w,h);fig={position:q.position,w,start:y,end:y+h,page:pages.length};}else fig={position:'below',image,w,h};}}
  flow(q.prompt||'Условие не заполнено',fig?.position==='below'?null:fig);if(fig){if(fig.position==='below'){ensure(fig.h+10);ctx.drawImage(fig.image,M,y,fig.w,fig.h);y+=fig.h+8;}else if(fig.page===pages.length)y=Math.max(y,fig.end+8);}y+=6;
  if(q.answerVisible){ensure(32);text('Ответ:',M,y+12,10);if(q.answerStyle==='line'){ctx.beginPath();ctx.moveTo(M+43,y+14);ctx.lineTo(W-M,y+14);ctx.stroke();}else{const count=q.answerStyle==='box'?1:q.boxes,sz=q.answerStyle==='box'?Math.min(180,W-2*M-50):Math.min(22,(W-2*M-50)/count);for(let j=0;j<count;j++)ctx.strokeRect(M+44+j*sz,y,sz,22);}y+=33;}
  if(q.solutionVisible){ensure(34);text('Решение:',M,y+11,10);y+=20;area(q.solutionHeight,q.solutionStyle);y+=8;}
  if(teacher){for(const [key,label,on] of [['answer','Ответ преподавателя',options.answers],['criteria','Критерии',options.criteria],['comment','Комментарий',options.comments]])if(on&&q[key]){ensure(32);flow(label+':',null,10,true);flow(q[key],null,10);y+=7;}}
  activeTask=0;ensure(12);ctx.strokeStyle='#ccc';ctx.beginPath();ctx.moveTo(M,y);ctx.lineTo(W-M,y);ctx.stroke();ctx.strokeStyle='#222';y+=18;
 }
 pages.forEach((c,i)=>{const x=c.getContext('2d');x.save();x.font='9px Arial';x.fillStyle='#555';x.fillText((i+1)+' / '+pages.length,W-M-32,H-19);x.restore();});return pages;
}
async function qwPDFBytes(project,teacher=false,options){
 const pages=await qwRenderPages(project,teacher,options),pdf=await PDFLib.PDFDocument.create();pdf.setTitle(project.title);pdf.setSubject(teacher?'Вариант для преподавателя':'Вариант для ученика');pdf.setCreator('Quantum Office TASK144');
 for(const canvas of pages){const image=await pdf.embedJpg(canvas.toDataURL('image/jpeg',.95));const p=pdf.addPage([595.28,841.89]);p.drawImage(image,{x:0,y:0,width:595.28,height:841.89});}
 return pdf.save();
}
