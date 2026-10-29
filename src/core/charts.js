/** Offline, data-linked charts. No third-party scripts or remote services. */
import {uid,rectangle,cellName,LIMITS,formulaContext,resultOf} from './workbook.js';
export const CHART_TYPES=['bar','line','pie'];
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
export function validateCharts(sheet){
 if(sheet.charts===undefined)return;
 if(!Array.isArray(sheet.charts)||sheet.charts.length>30)throw Error('Повреждён список диаграмм');
 const seen=new Set();
 for(const chart of sheet.charts){
  if(!chart||typeof chart!=='object'||Array.isArray(chart)||
    typeof chart.id!=='string'||!chart.id||chart.id.length>100||seen.has(chart.id)||
    !CHART_TYPES.includes(chart.type)||typeof chart.title!=='string'||
    !chart.title.trim()||chart.title.length>120||
    Object.keys(chart).some(k=>!['id','type','title','from','to'].includes(k)))
    throw Error('Повреждена диаграмма');
  chartRect(chart);seen.add(chart.id);
 }
}
export function chartData(book,sheet,chart){
 const rect=chartRect(chart),raw=Object.fromEntries(Object.entries(sheet.cells).map(([key,v])=>[key,v.value]));
 const ctx=formulaContext(book,sheet,raw),rows=[];
 for(let r=rect.r1;r<=rect.r2;r++)rows.push({
  label:String(resultOf(sheet,cellName(r,rect.c1),raw,ctx)),
  raw:String(resultOf(sheet,cellName(r,rect.c2),raw,ctx))
 });
 const header=numeric(rows[0].raw)===null,body=rows.slice(header?1:0);
 if(body.length<2)throw Error('Диаграмме нужны минимум два числовых значения');
 const points=body.map(item=>{
  const value=numeric(item.raw);
  if(!item.label.trim()||item.label.length>120||value===null)throw Error('Для диаграммы нужны названия категорий и числа');
  return {label:item.label,value};
 });
 if(chart.type==='pie'&&(points.some(p=>p.value<0)||points.reduce((n,p)=>n+p.value,0)<=0))
  throw Error('Круговая диаграмма: значения должны быть неотрицательными и сумма больше нуля');
 return {points,axis:header?rows[0].raw:'Значение'};
}
export function addChart(book,sheet,type,from,to){
 if(!CHART_TYPES.includes(type))throw Error('Неизвестный тип диаграммы');
 const rect=rectangle(from,to);
 if(!rect)throw Error('Выделите диапазон с категориями и числами');
 const chart={id:uid(),type,title:'Диаграмма '+((sheet.charts?.length||0)+1),
   from:cellName(rect.r1,rect.c1),to:cellName(rect.r2,rect.c2)};
 chartData(book,sheet,chart);
 if((sheet.charts?.length||0)>=30)throw Error('Лимит: 30 диаграмм на лист');
 (sheet.charts??=[]).push(chart);
 return chart;
}
export function changeChart(sheet,id,patch){
 const chart=(sheet.charts||[]).find(c=>c.id===id);if(!chart)throw Error('Диаграмма не найдена');
 if(patch.type!==undefined){if(!CHART_TYPES.includes(patch.type))throw Error('Неизвестный тип');chart.type=patch.type;}
 if(patch.title!==undefined){const title=String(patch.title).trim();if(!title||title.length>120)throw Error('Введите название до 120 символов');chart.title=title;}
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
