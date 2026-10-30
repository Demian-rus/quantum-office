/** Offline, data-linked charts. No third-party scripts or remote services. */
import {uid,rectangle,cellName,LIMITS,formulaContext,resultOf,gridGeometry} from './workbook.js';
export const CHART_TYPES=['bar','line','pie'];
export const CHART_MIN_WIDTH=280,CHART_MIN_HEIGHT=190;
const COLORS=['#277c58','#397eb9','#e5a43b','#8a60b7','#dc7775','#42a8aa','#7e9e4a','#d58e4b'];
const escapeSVG=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric=s=>{const v=String(s??'').trim();return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v)&&Number.isFinite(+v)?+v:null;};
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
export function chartRect(chart){
 const rect=chart?.from&&chart?.to?rectangle(chart.from,chart.to):null;
 if(!rect||rect.c2-rect.c1!==1||rect.r2-rect.r1<1||rect.r2-rect.r1>50||
    rect.r2>=LIMITS.rows||rect.c2>=LIMITS.columns||
    chart.from!==cellName(rect.r1,rect.c1)||chart.to!==cellName(rect.r2,rect.c2))
  throw Error('Нужны два столбца и от 2 до 51 строки данных');
 return rect;
}
/** A chart owns its visual position separately from its data source. The coordinates
 * are scrollable sheet pixels (not viewport coordinates), so pan/zoom and virtualization
 * do not move it away from its cells. Old QBOOK chart records are supported. */
export function chartLayout(sheet,chart,index=0){
 if(chart.layout)return {...chart.layout};
 const r=chartRect(chart),{x,y}=gridGeometry(sheet),width=480,height=292;
 const left=Math.max(54,Math.min(x.at(-1)-width,x[Math.min(LIMITS.columns,r.c2+2)]));
 const top=Math.max(40,Math.min(y.at(-1)-31-height,y[r.r1]-31+40+index*330));
 return {x:Math.round(left),y:Math.round(top),width,height};
}
export function validateChartLayout(sheet,layout){
 if(!layout||typeof layout!=='object'||Array.isArray(layout)||
    Object.keys(layout).sort().join(',')!=='height,width,x,y'||
    Object.values(layout).some(x=>!Number.isSafeInteger(x))||
    layout.x<54||layout.y<0||
    layout.width<CHART_MIN_WIDTH||layout.width>1000||
    layout.height<CHART_MIN_HEIGHT||layout.height>700)
  throw Error('Неверное положение или размер диаграммы');
 const {x,y}=gridGeometry(sheet);
 if(layout.x+layout.width>x.at(-1)||layout.y+layout.height>y.at(-1)-31)
  throw Error('Диаграмма выходит за пределы листа');
 return layout;
}
export function validateCharts(sheet){
 if(sheet.charts===undefined)return;
 if(!Array.isArray(sheet.charts)||sheet.charts.length>30)throw Error('Повреждён список диаграмм');
 const seen=new Set();
 for(const chart of sheet.charts){
  if(!chart||typeof chart!=='object'||Array.isArray(chart)||
    typeof chart.id!=='string'||!chart.id||chart.id.length>100||seen.has(chart.id)||
    !CHART_TYPES.includes(chart.type)||typeof chart.title!=='string'||
    !chart.title.trim()||chart.title.length>120||
    Object.keys(chart).some(k=>!['id','type','title','from','to','layout'].includes(k)))
    throw Error('Повреждена диаграмма');
  chartRect(chart);if(chart.layout!==undefined)validateChartLayout(sheet,chart.layout);seen.add(chart.id);
 }
}
/** Find a useful nearby table when the user clicks Insert Chart without selecting a range.
 * A blank workbook still yields a valid, editable A1:B6 source; no sample cells are written. */
export function suggestChartRange(sheet,from,to=from){
 const selection=rectangle(from,to);
 if(!selection)throw Error('Не удалось определить место для диаграммы');
 const startRow=selection.r1,startCol=selection.c1,rows=selection.r2-selection.r1+1,cols=selection.c2-selection.c1+1;
 const shape=(r1,c1,r2)=>({from:cellName(r1,c1),to:cellName(r2,c1+1)});
 if(rows>=2&&cols>=2&&startCol<LIMITS.columns-1)
  return {...shape(startRow,startCol,Math.min(selection.r2,startRow+50)),mode:'selection'};
 if(rows>=2&&cols===1){
  const c=startCol>0&&Array.from({length:Math.min(rows,51)},(_,i)=>sheet.cells[cellName(startRow+i,startCol-1)]?.value).some(v=>String(v??'').trim())?startCol-1:Math.min(startCol,LIMITS.columns-2);
  return {...shape(startRow,c,Math.min(selection.r2,startRow+50)),mode:'selection'};
 }
 let best=null;
 for(const col of [startCol-1,startCol,startCol+1]){
  if(col<0||col>=LIMITS.columns-1)continue;
  const low=Math.max(0,startRow-15),high=Math.min(LIMITS.rows-1,startRow+50);
  let first=Infinity,last=-1,score=0;
  for(let row=low;row<=high;row++){
   const label=String(sheet.cells[cellName(row,col)]?.value??'').trim();
   const value=String(sheet.cells[cellName(row,col+1)]?.value??'').trim();
   if(label||value){first=Math.min(first,row);last=Math.max(last,row);}
   if(label&&(numeric(value)!==null||value.startsWith('=')))score++;
  }
  if(score>=2){
   const candidate={score,first,last,col,distance:Math.abs(col-startCol)};
   if(!best||candidate.score>best.score||candidate.score===best.score&&candidate.distance<best.distance)best=candidate;
  }
 }
 if(best){
  const first=Math.max(0,Math.min(best.first,startRow));
  return {...shape(first,best.col,Math.min(LIMITS.rows-1,Math.max(best.last,first+1),first+50)),mode:'detected'};
 }
 return {...shape(startRow,Math.min(startCol,LIMITS.columns-2),Math.min(startRow+5,LIMITS.rows-1)),mode:'empty'};
}
export function chartData(book,sheet,chart,{allowEmpty=false}={}){
 const rect=chartRect(chart),raw=Object.fromEntries(Object.entries(sheet.cells).map(([key,v])=>[key,v.value]));
 const ctx=formulaContext(book,sheet,raw),rows=[];
 for(let r=rect.r1;r<=rect.r2;r++)rows.push({
  label:String(resultOf(sheet,cellName(r,rect.c1),raw,ctx)),
  raw:String(resultOf(sheet,cellName(r,rect.c2),raw,ctx))
 });
 const header=rows[0].raw.trim()!==''&&numeric(rows[0].raw)===null,body=rows.slice(header?1:0);
 if(allowEmpty&&body.every(p=>!p.label.trim()&&!p.raw.trim()))return {points:[],axis:header?rows[0].raw:'Значение',header,empty:true};
 if(body.length<2)throw Error('Диаграмме нужны минимум два числовых значения');
 const points=body.map(item=>{
  const value=numeric(item.raw);
  if(!item.label.trim()||item.label.length>120||value===null)throw Error('Для диаграммы нужны названия категорий и числа');
  return {label:item.label,value};
 });
 if(chart.type==='pie'&&(points.some(p=>p.value<0)||points.reduce((n,p)=>n+p.value,0)<=0))
  throw Error('Круговая диаграмма: значения должны быть неотрицательными и сумма больше нуля');
 return {points,axis:header?rows[0].raw:'Значение',header,empty:false};
}
export function addChart(book,sheet,type,from,to){
 if(!CHART_TYPES.includes(type))throw Error('Неизвестный тип диаграммы');
 const rect=rectangle(from,to);
 if(!rect)throw Error('Выделите диапазон с категориями и числами');
 const chart={id:uid(),type,title:'Диаграмма '+((sheet.charts?.length||0)+1),
   from:cellName(rect.r1,rect.c1),to:cellName(rect.r2,rect.c2)};
 chartRect(chart);chart.layout=chartLayout(sheet,chart,(sheet.charts||[]).length);
 if((sheet.charts?.length||0)>=30)throw Error('Лимит: 30 диаграмм на лист');
 (sheet.charts??=[]).push(chart);
 return chart;
}
export function changeChart(sheet,id,patch){
 const chart=(sheet.charts||[]).find(c=>c.id===id);if(!chart)throw Error('Диаграмма не найдена');
 const next={...chart};
 if(patch.type!==undefined){if(!CHART_TYPES.includes(patch.type))throw Error('Неизвестный тип');next.type=patch.type;}
 if(patch.title!==undefined){const title=String(patch.title).trim();if(!title||title.length>120)throw Error('Введите название до 120 символов');next.title=title;}
 if(patch.from!==undefined||patch.to!==undefined){
  if(typeof patch.from!=='string'||typeof patch.to!=='string')throw Error('Укажите диапазон, например A1:B6');
  next.from=patch.from.toUpperCase();next.to=patch.to.toUpperCase();
 }
 chartRect(next);
 if(patch.layout!==undefined){next.layout={...patch.layout};validateChartLayout(sheet,next.layout);}
 Object.assign(chart,next);
 return chart;
}
export function removeChart(sheet,id){
 const n=(sheet.charts||[]).findIndex(c=>c.id===id);
 if(n<0)throw Error('Диаграмма не найдена');sheet.charts.splice(n,1);
}
export function shiftCharts(sheet,axis,mode,index,count){
 return (sheet.charts||[]).map(chart=>{
  const r=chartRect(chart),start=axis==='row'?r.r1:r.c1,end=axis==='row'?r.r2:r.c2;
  const last=index+count-1;let a=start,b=end;
  if(mode==='insert'){if(index<=start){a+=count;b+=count;}else if(index<=end)b+=count;}
  else if(last<start){a-=count;b-=count;}
  else if(index<=end&&last>=start){
   const lost=Math.min(last,end)-Math.max(start,index)+1;
   if(axis==='col'||end-start+1-lost<2)throw Error('Удаление разрушит диапазон диаграммы');
   a=index<=start?index:start;b=end-lost;
  }
  if(a<0||b>=(axis==='row'?LIMITS.rows:LIMITS.columns)||
    axis==='col'&&b-a!==1||axis==='row'&&b-a>50)
    throw Error('Диаграмма выйдет за границы: операция отменена');
  const next={...chart,from:axis==='row'?cellName(a,r.c1):cellName(r.r1,a),
   to:axis==='row'?cellName(b,r.c2):cellName(r.r2,b)};
  chartRect(next);return next;
 });
}
export function chartSVG(data,type){
 const pts=data.points,esc=escapeSVG,txt=(x,y,s,attr='')=>'<text x="'+x+'" y="'+y+'" '+attr+'>'+esc(s)+'</text>';
 if(!pts.length)return '<svg class="qo-chart-svg" viewBox="0 0 640 320" role="img" aria-label="Пустая диаграмма">'+
  '<rect width="640" height="320" rx="10" fill="#fff"/>'+
  txt(320,140,'Диаграмма создана','font-size="22" text-anchor="middle" fill="#244b3e" font-weight="600"')+
  txt(320,177,'Добавьте категории и числовые значения','font-size="15" text-anchor="middle" fill="#6b8291"')+'</svg>';
 let svg='<rect width="640" height="320" rx="10" fill="#fff"/>';
 if(type==='pie'){
  const total=pts.reduce((n,p)=>n+p.value,0),cx=200,cy=154,r=99,c=2*Math.PI*r;let offset=0;
  pts.forEach((p,i)=>{
   const len=p.value/total*c;
   svg+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+COLORS[i%COLORS.length]+
     '" stroke-width="58" stroke-dasharray="'+len.toFixed(4)+' '+(c-len).toFixed(4)+
     '" stroke-dashoffset="'+(-offset).toFixed(4)+'" transform="rotate(-90 '+cx+' '+cy+')"/>';
   offset+=len;
  });
  pts.slice(0,12).forEach((p,i)=>{const y=52+21*i;svg+='<rect x="358" y="'+(y-9)+'" width="11" height="11" rx="2" fill="'+COLORS[i%COLORS.length]+'"/>'+
    txt(377,y,p.label.slice(0,16)+' · '+fmt(p.value/total*100)+'%','font-size="12" fill="#32465b"');});
  svg+=txt(cx,cy+5,fmt(total),'font-size="18" font-weight="700" text-anchor="middle" fill="#2d4152"');
 }else{
  const min=Math.min(0,...pts.map(p=>p.value)),max=Math.max(0,...pts.map(p=>p.value)),range=max-min||1,
    x0=64,x1=604,y0=35,y1=254,w=x1-x0,h=y1-y0;
  const y=v=>y1-(v-min)/range*h,x=i=>x0+(i+.5)*w/pts.length,baseline=y(0);
  for(let t=0;t<=4;t++){const value=min+range*t/4,Y=y(value);
   svg+='<line x1="'+x0+'" y1="'+Y+'" x2="'+x1+'" y2="'+Y+'" stroke="#e3eaf0"/>'+
      txt(x0-8,Y+4,fmt(value),'font-size="10" text-anchor="end" fill="#64748b"');}
  if(type==='bar'){pts.forEach((p,i)=>{
    const Y=y(p.value),bw=Math.max(3,Math.min(48,w/pts.length*.65));
    svg+='<rect x="'+(x(i)-bw/2)+'" y="'+Math.min(Y,baseline)+'" width="'+bw+
      '" height="'+Math.max(1,Math.abs(Y-baseline))+'" rx="2" fill="'+COLORS[i%COLORS.length]+'"/>';
   });}
  else{
   svg+='<polyline fill="none" stroke="#2e7f5b" stroke-width="3" points="'+pts.map((p,i)=>x(i)+','+y(p.value)).join(' ')+'"/>';
   pts.forEach((p,i)=>svg+='<circle cx="'+x(i)+'" cy="'+y(p.value)+'" r="4" fill="#fff" stroke="#2e7f5b" stroke-width="2"/>');
  }
  const skip=Math.max(1,Math.ceil(pts.length/9));
  for(let i=0;i<pts.length;i+=skip)svg+=txt(x(i),282,pts[i].label.slice(0,12),'font-size="11" text-anchor="middle" fill="#485c70"');
  svg+=txt(x0,19,data.axis,'font-size="12" font-weight="600" fill="#596a7e"');
 }
 return '<svg class="qo-chart-svg" viewBox="0 0 640 320" role="img" aria-label="'+(type==='pie'?'Круговая':type==='line'?'Линейная':'Столбчатая')+' диаграмма">'+svg+'</svg>';
}
