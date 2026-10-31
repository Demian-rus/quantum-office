import {uid,rectangle,cellName,LIMITS,formulaContext,resultOf,gridGeometry} from './workbook.js';
/** Offline, data-linked charts. No third-party scripts or remote services. */

export const CHART_TYPES=['bar','line','pie','stacked','stacked100','scatter'];
export const STACKED_TYPES=['stacked','stacked100'];
export const CHART_MIN_WIDTH=280,CHART_MIN_HEIGHT=190;
export const CHART_MAX_SERIES=4;
const COLORS=['#277c58','#397eb9','#e5a43b','#8a60b7','#dc7775','#42a8aa','#7e9e4a','#d58e4b'];
export const CHART_COLORS=Object.freeze([...COLORS]);
const STYLE_KEYS=['labels','legend','grid','colors','min','max','trendline','trendEquation','trendR2','trendType'];
export function chartOptions(chart){
 const o=chart?.options||{};
 return {labels:o.labels??false,legend:o.legend??(chart?.type==='pie'?'right':chart?.from&&chart?.to&&chartRect(chart).c2-chartRect(chart).c1===1?'none':'bottom'),
   grid:o.grid??true,colors:o.colors??[],min:o.min??null,max:o.max??null,
   ...(o.trendline!==undefined||o.trendEquation!==undefined||o.trendR2!==undefined||o.trendType!==undefined?
    {trendline:o.trendline??false,trendEquation:o.trendEquation??false,trendR2:o.trendR2??false,trendType:o.trendType??'linear'}:{})};
}
export function validateChartOptions(o){
 if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!STYLE_KEYS.includes(k))||
    (o.labels!==undefined&&typeof o.labels!=='boolean')||
    (o.grid!==undefined&&typeof o.grid!=='boolean')||
    ['trendline','trendEquation','trendR2'].some(k=>o[k]!==undefined&&typeof o[k]!=='boolean')||
    (o.trendType!==undefined&&!['linear','quadratic'].includes(o.trendType))||
    (o.legend!==undefined&&!['bottom','right','none'].includes(o.legend))||
    (o.colors!==undefined&&(!Array.isArray(o.colors)||o.colors.length>CHART_MAX_SERIES||
       o.colors.some(c=>typeof c!=='string'||!/^#[0-9a-f]{6}$/i.test(c))))||
    ['min','max'].some(k=>o[k]!==undefined&&o[k]!==null&&
       (typeof o[k]!=='number'||!Number.isFinite(o[k])||Math.abs(o[k])>1e12))||
    o.min!=null&&o.max!=null&&o.min>=o.max)
  throw Error('Недопустимые параметры оформления диаграммы');
 return o;
}
/** Centered least-squares fit. Null is an explicit degenerate-X result, not a fake horizontal trend. */
export function linearRegression(points){
 if(!Array.isArray(points)||points.length<2||points.length>50||
    points.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.value)||Math.abs(p.x)>1e12||Math.abs(p.value)>1e12))
  return null;
 const n=points.length,meanX=points.reduce((v,p)=>v+p.x,0)/n,
  meanY=points.reduce((v,p)=>v+p.value,0)/n;
 let sxx=0,sxy=0,syy=0;
 for(const p of points){
  const dx=p.x-meanX,dy=p.value-meanY;
  sxx+=dx*dx;sxy+=dx*dy;syy+=dy*dy;
 }
 if(sxx<=0||!Number.isFinite(sxx)||!Number.isFinite(sxy)||!Number.isFinite(syy))return null;
 const slope=sxy/sxx,intercept=meanY-slope*meanX;
 if(!Number.isFinite(slope)||!Number.isFinite(intercept))return null;
 let sse=0;
 for(const p of points){
  const error=(meanY+slope*(p.x-meanX))-p.value;
  sse+=error*error;
 }
 if(!Number.isFinite(sse))return null;
 const r2=syy===0?1:Math.min(1,Math.max(0,1-sse/syy));
 return {slope,intercept,r2,n};
}
/** Clip fitted y=m*x+b to the visible numeric plot rectangle. */
/** Centered/scaled least squares for y=a*x²+b*x+c; rank-deficient fits return null. */
export function quadraticRegression(points){
 if(!Array.isArray(points)||points.length<3||points.length>50||
    points.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.value)||
      Math.abs(p.x)>1e12||Math.abs(p.value)>1e12))return null;
 const n=points.length,meanX=points.reduce((a,p)=>a+p.x,0)/n,
  meanY=points.reduce((a,p)=>a+p.value,0)/n,
  scale=Math.max(...points.map(p=>Math.abs(p.x-meanX)));
 if(!(scale>0))return null;
 const z=points.map(p=>(p.x-meanX)/scale),meanZ=z.reduce((a,v)=>a+v,0)/n,
  meanZ2=z.reduce((a,v)=>a+v*v,0)/n;
 let s11=0,s12=0,s22=0,t1=0,t2=0,syy=0;
 for(let i=0;i<n;i++){
  const u=z[i]-meanZ,v=z[i]*z[i]-meanZ2,dy=points[i].value-meanY;
  s11+=u*u;s12+=u*v;s22+=v*v;t1+=u*dy;t2+=v*dy;syy+=dy*dy;
 }
 const det=s11*s22-s12*s12;
 if(!Number.isFinite(det)||det<=1e-12*s11*s22||s11===0||s22===0)return null;
 const bz=(t1*s22-t2*s12)/det,az=(s11*t2-s12*t1)/det,
  cz=meanY-bz*meanZ-az*meanZ2,
  a=az/(scale*scale),b=bz/scale-2*a*meanX,
  c=cz-bz*meanX/scale+a*meanX*meanX;
 if(![a,b,c,az,bz,cz].every(Number.isFinite))return null;
 let sse=0;
 for(let i=0;i<n;i++){
  const e=(az*z[i]*z[i]+bz*z[i]+cz)-points[i].value;
  sse+=e*e;
 }
 if(!Number.isFinite(sse))return null;
 return {a,b,c,r2:syy===0?1:Math.max(0,Math.min(1,1-sse/syy)),n,
  center:meanX,scale,normalizedA:az,normalizedB:bz,normalizedC:cz};
}
export function predictQuadratic(fit,x){
 const z=(x-fit.center)/fit.scale;
 return (fit.normalizedA*z+fit.normalizedB)*z+fit.normalizedC;
}
export function quadraticLabel(fit){
 const n=v=>{
  if(v!==0&&(Math.abs(v)>=1e7||Math.abs(v)<1e-4))return v.toExponential(3);
  return new Intl.NumberFormat('ru-RU',{maximumSignificantDigits:5}).format(v);
 };
 return 'y = '+n(fit.a)+'x² '+(fit.b<0?'− ':'+ ')+n(Math.abs(fit.b))+
  'x '+(fit.c<0?'− ':'+ ')+n(Math.abs(fit.c));
}
/** Liang–Barsky clipping for an XY segment to a plot rectangle. */
function clipTrendLine(xa,ya,xb,yb,x0,x1,y0,y1){
 let lo=0,hi=1;
 const dx=xb-xa,dy=yb-ya;
 for(const [p,q] of [[-dx,xa-x0],[dx,x1-xa],[-dy,ya-y0],[dy,y1-ya]]){
  if(p===0){if(q<0)return null;continue;}
  const r=q/p;
  if(p<0)lo=Math.max(lo,r);else hi=Math.min(hi,r);
  if(lo>hi)return null;
 }
 return [xa+lo*dx,ya+lo*dy,xa+hi*dx,ya+hi*dy];
}
function clippedTrendSegment(fit,xMin,xMax,yMin,yMax){
 const {slope,intercept}=fit;
 let a=xMin,b=xMax;
 if(slope===0){
  if(intercept<yMin||intercept>yMax)return null;
 }else{
  const cross1=(yMin-intercept)/slope,cross2=(yMax-intercept)/slope;
  a=Math.max(a,Math.min(cross1,cross2));b=Math.min(b,Math.max(cross1,cross2));
 }
 if(!(b>a))return null;
 return [{x:a,y:slope*a+intercept},{x:b,y:slope*b+intercept}];
}
export function regressionLabel(fit){
 const n=v=>new Intl.NumberFormat('ru-RU',{maximumSignificantDigits:5}).format(v);
 return 'y = '+n(fit.slope)+'x '+(fit.intercept<0?'− ':'+ ')+n(Math.abs(fit.intercept));
}
const escapeSVG=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric=s=>{const v=String(s??'').trim();return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v)&&Number.isFinite(+v)?+v:null;};
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
export function chartRect(chart){
 const rect=chart?.from&&chart?.to?rectangle(chart.from,chart.to):null;
 if(!rect||rect.c2-rect.c1<1||rect.c2-rect.c1>CHART_MAX_SERIES||
    chart.type==='pie'&&rect.c2-rect.c1!==1||rect.r2-rect.r1<1||rect.r2-rect.r1>50||
    rect.r2>=LIMITS.rows||rect.c2>=LIMITS.columns||
    chart.from!==cellName(rect.r1,rect.c1)||chart.to!==cellName(rect.r2,rect.c2))
  throw Error(chart?.type==='pie'?'Круговая диаграмма: нужны два столбца и от 2 до 51 строки':'Нужны 2–5 столбцов (до 4 рядов данных) и от 2 до 51 строки');
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
    Object.keys(chart).some(k=>!['id','type','title','from','to','layout','options'].includes(k)))
    throw Error('Повреждена диаграмма');
  const rect=chartRect(chart);if(chart.layout!==undefined)validateChartLayout(sheet,chart.layout);if(chart.options!==undefined){validateChartOptions(chart.options);
   if(chart.type==='stacked100'&&(chart.options.min!=null||chart.options.max!=null))throw Error('У процентной диаграммы ось всегда 0–100%');
   if(chart.type!=='scatter'&&(chart.options.trendline||chart.options.trendEquation||chart.options.trendR2||chart.options.trendType==='quadratic'))
    throw Error('Линейная регрессия доступна только для XY-диаграмм');if(chart.options.colors?.length>rect.c2-rect.c1)throw Error('Слишком много цветов для текущих рядов диаграммы');}seen.add(chart.id);
 }
}
/** Find a useful nearby table when the user clicks Insert Chart without selecting a range.
 * A blank workbook still yields a valid, editable A1:B6 source; no sample cells are written. */
/** Infer the widest useful adjacent dataset, bounded to four numeric series.
 * A pie chart still requires one numeric series. */
export function suggestChartRange(sheet,from,to=from,type='bar'){
 const selection=rectangle(from,to);
 if(!selection)throw Error('Не удалось определить место для диаграммы');
 const first=selection.r1,col=selection.c1,rows=selection.r2-first+1,cols=selection.c2-col+1,
  width=type==='pie'?1:CHART_MAX_SERIES;
 const shape=(r,c,h,w)=>({from:cellName(r,c),to:cellName(Math.min(r+h,LIMITS.rows-1),Math.min(c+w,LIMITS.columns-1))});
 if(rows>=2&&cols>=2&&col<LIMITS.columns-1)
  return {...shape(first,col,Math.min(rows-1,50),Math.min(cols-1,width)),mode:'selection'};
 if(rows>=2&&cols===1){
  const c=col>0&&Array.from({length:Math.min(rows,51)},(_,i)=>sheet.cells[cellName(first+i,col-1)]?.value).some(v=>String(v??'').trim())?col-1:Math.min(col,LIMITS.columns-2);
  let n=0;
  for(let k=1;k<=Math.min(width,LIMITS.columns-c-1);k++){
   const numericCells=Array.from({length:Math.min(rows,51)},(_,i)=>String(sheet.cells[cellName(first+i,c+k)]?.value??'').trim());
   if(numericCells.some(v=>numeric(v)!==null||v.startsWith('=')))n++;
   else break;
  }
  return {...shape(first,c,Math.min(rows-1,50),Math.max(1,n)),mode:'selection'};
 }
 let best=null;
 for(const c of [col-1,col,col+1]){
  if(c<0||c>=LIMITS.columns-1)continue;
  const low=Math.max(0,first-15),high=Math.min(LIMITS.rows-1,first+50),maxWidth=Math.min(width,LIMITS.columns-c-1);
  let start=Infinity,end=-1;
  const scores=[];
  for(let k=1;k<=maxWidth;k++)scores.push(0);
  for(let r=low;r<=high;r++){
   const label=String(sheet.cells[cellName(r,c)]?.value??'').trim();
   let nonEmpty=!!label;
   for(let k=1;k<=maxWidth;k++){
    const value=String(sheet.cells[cellName(r,c+k)]?.value??'').trim();
    if(value)nonEmpty=true;
    if(label&&(numeric(value)!==null||value.startsWith('=')))scores[k-1]++;
   }
   if(nonEmpty){start=Math.min(start,r);end=Math.max(end,r);}
  }
  if(scores[0]>=2){
   let n=1;for(let k=1;k<scores.length;k++){if(scores[k]>=2)n++;else break;}
   const candidate={c,n,score:scores.slice(0,n).reduce((a,b)=>a+b,0),start,end,distance:Math.abs(c-col)};
   if(!best||candidate.score>best.score||candidate.score===best.score&&candidate.distance<best.distance)best=candidate;
  }
 }
 if(best){
  const start=Math.max(0,Math.min(best.start,first));
  return {...shape(start,best.c,Math.min(50,Math.max(best.end,start+1)-start),best.n),mode:'detected'};
 }
 return {...shape(first,Math.min(col,LIMITS.columns-2),Math.min(5,LIMITS.rows-1-first),1),mode:'empty'};
}
export function chartData(book,sheet,chart,{allowEmpty=false}={}){
 const rect=chartRect(chart),raw=Object.fromEntries(Object.entries(sheet.cells).map(([key,v])=>[key,v.value]));
 const ctx=formulaContext(book,sheet,raw),rows=[];
 for(let r=rect.r1;r<=rect.r2;r++){
  const label=String(resultOf(sheet,cellName(r,rect.c1),raw,ctx));
  const values=Array.from({length:rect.c2-rect.c1},(_,i)=>String(resultOf(sheet,cellName(r,rect.c1+i+1),raw,ctx)));
  rows.push({label,values});
 }
 const count=rect.c2-rect.c1;
 const yearHeaders=count>1&&rows[0].label.trim()!==''&&rows[1]?.label.trim()!==''&&
  rows[0].values.every(v=>/^(?:19|20)\d{2}$/.test(v.trim()))&&
  rows[1].values.every(v=>numeric(v)!==null);
 const mixedHeaders=rows[0].values.every(v=>v.trim()!==''&&
   (numeric(v)===null||count>1&&/^(?:19|20)\d{2}$/.test(v.trim())))&&
  rows[0].values.some(v=>numeric(v)===null);
 const header=chart.type==='scatter'?
   (rows[0].label.trim()!==''&&numeric(rows[0].label)===null&&
    rows[0].values.every(v=>v.trim()!==''&&(numeric(v)===null||/^(?:19|20)\d{2}$/.test(v.trim())))):
   mixedHeaders||yearHeaders;
 const body=rows.slice(header?1:0);
 const names=Array.from({length:count},(_,k)=>header?rows[0].values[k]:'Ряд '+(k+1));
 const empty=body.every(p=>!p.label.trim()&&p.values.every(v=>!v.trim()));
 if(allowEmpty&&empty)return {points:[],series:names.map(name=>({name,points:[]})),axis:names[0],header,empty:true};
 if(body.length<2)throw Error('Диаграмме нужны минимум два числовых значения');
 const pointsBySeries=names.map((name,k)=>({
  name,points:body.map(item=>{
   const value=numeric(item.values[k]),x=chart.type==='scatter'?numeric(item.label):null;
   if(chart.type==='scatter'){
    if(x===null||value===null)throw Error('Для точечной диаграммы нужны числа по обеим осям X и Y');
    if(Math.abs(x)>1e12||Math.abs(value)>1e12)throw Error('Точечная диаграмма: слишком большие координаты X или Y');
    return {label:item.label,x,value};
   }
   if(!item.label.trim()||item.label.length>120||value===null)
    throw Error('Для диаграммы нужны названия категорий и числа');
   return {label:item.label,value};
  })
 }));
 if(STACKED_TYPES.includes(chart.type)){
  for(let i=0;i<pointsBySeries[0].points.length;i++){
   const values=pointsBySeries.map(s=>s.points[i].value),
    pos=values.filter(v=>v>0).reduce((a,b)=>a+b,0),
    neg=values.filter(v=>v<0).reduce((a,b)=>a+b,0);
   if(!Number.isFinite(pos)||!Number.isFinite(neg))throw Error('Слишком большие значения для накопительной диаграммы');
   if(chart.type==='stacked100'&&(values.some(v=>v<0)||pos<=0))
    throw Error('100% с накоплением: для каждой категории нужны неотрицательные числа с положительной суммой');
  }
 }
 if(chart.type==='pie'){
  const values=pointsBySeries[0].points.map(p=>p.value);
  if(values.some(v=>v<0)||values.reduce((a,b)=>a+b,0)<=0)
   throw Error('Круговая диаграмма: значения должны быть неотрицательными и сумма больше нуля');
 }
 return {points:pointsBySeries[0].points,series:pointsBySeries,axis:names[0],header,empty:false};
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
 const sourceRect=chartRect(next);
 if(next.type!=='scatter'&&next.options&&(next.options.trendline||next.options.trendEquation||next.options.trendR2||next.options.trendType==='quadratic'))
  next.options={...next.options,trendline:false,trendEquation:false,trendR2:false,trendType:'linear'};
 if(next.type==='stacked100'){
  const previous={...(next.options||{})};
  if(previous.min!=null||previous.max!=null)next.options={...previous,min:null,max:null};
 }
 if((patch.from!==undefined||patch.to!==undefined||patch.type!==undefined)&&next.options?.colors?.length>sourceRect.c2-sourceRect.c1)
  next.options={...next.options,colors:next.options.colors.slice(0,sourceRect.c2-sourceRect.c1)};
 if(patch.layout!==undefined){next.layout={...patch.layout};validateChartLayout(sheet,next.layout);}
 if(patch.options!==undefined){
  if(!patch.options||typeof patch.options!=='object'||Array.isArray(patch.options))throw Error('Недопустимые параметры оформления диаграммы');
  const opts={...(next.options||{}),...patch.options};
  if(patch.options.colors!==undefined)opts.colors=[...patch.options.colors];
  validateChartOptions(opts);
  if(next.type!=='scatter'&&(opts.trendline||opts.trendEquation||opts.trendR2||opts.trendType==='quadratic'))
   throw Error('Линейная регрессия доступна только для XY-диаграмм');
  if(next.type==='stacked100'&&(opts.min!=null||opts.max!=null))
   throw Error('У процентной диаграммы ось всегда 0–100%');
  next.options=opts;
 }
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
   if(axis==='col'&&index<=start||axis==='row'&&end-start+1-lost<2||axis==='col'&&end-start+1-lost<2)throw Error('Удаление разрушит диапазон диаграммы');
   a=index<=start?index:start;b=end-lost;
  }
  if(a<0||b>=(axis==='row'?LIMITS.rows:LIMITS.columns)||
    axis==='col'&&(b-a<1||b-a>CHART_MAX_SERIES||chart.type==='pie'&&b-a!==1)||axis==='row'&&b-a>50)
    throw Error('Диаграмма выйдет за границы: операция отменена');
  const next={...chart,from:axis==='row'?cellName(a,r.c1):cellName(r.r1,a),
   to:axis==='row'?cellName(b,r.c2):cellName(r.r2,b)};
  chartRect(next);return next;
 });
}
export function chartSVG(data,type,settings={}){
 validateChartOptions(settings);
 const pts=data.points,series=data.series||[{name:data.axis,points:pts}],esc=escapeSVG,
  showValues=settings.labels??false,legend=settings.legend??(type==='pie'?'right':series.length>1?'bottom':'none'),
  showGrid=settings.grid??true,colors=settings.colors||[],colorAt=i=>colors[i]||COLORS[i%COLORS.length],
  txt=(x,y,s,attr='')=>'<text x="'+x+'" y="'+y+'" '+attr+'>'+esc(s)+'</text>';
 if(!pts.length)return '<svg class="qo-chart-svg" viewBox="0 0 640 320" role="img" aria-label="Пустая диаграмма">'+
  '<rect width="640" height="320" rx="10" fill="#fff"/>'+
  txt(320,140,'Диаграмма создана','font-size="22" text-anchor="middle" fill="#244b3e" font-weight="600"')+
  txt(320,177,'Добавьте категории и числовые значения','font-size="15" text-anchor="middle" fill="#6b8291"')+'</svg>';
 let svg='<rect width="640" height="320" rx="10" fill="#fff"/>';
 if(type==='scatter'){
  const allPoints=series.flatMap(s=>s.points),xValues=allPoints.map(p=>p.x),
   yValues=allPoints.map(p=>p.value),xLo=Math.min(...xValues),xHi=Math.max(...xValues),
   xSpan=xHi-xLo||1,xMin=xHi===xLo?xLo-1:xLo,xMax=xHi===xLo?xHi+1:xHi,
   dataMin=Math.min(...yValues),dataMax=Math.max(...yValues),
   yLo=settings.min??(settings.max!=null?Math.min(dataMin,settings.max-1):dataMin),
   yHi=settings.max??Math.max(dataMax,yLo+1),
   yMin=yLo===yHi?yLo-1:yLo,yMax=yLo===yHi?yHi+1:yHi,
   legendRight=legend==='right',legendBottom=legend==='bottom',
   x0=74,x1=legendRight?445:601,y0=32,y1=legendBottom&&series.length>1?233:265;
  const sx=v=>x0+(v-xMin)/(xMax-xMin)*(x1-x0),sy=v=>y1-(v-yMin)/(yMax-yMin)*(y1-y0);
  for(let tick=0;tick<=4;tick++){
   const Y=y0+(y1-y0)*tick,X=x0+(x1-x0)*tick,
    yy=yMax-(yMax-yMin)*tick/4,xx=xMin+(xMax-xMin)*tick/4;
   svg+=(showGrid?'<line x1="'+x0+'" y1="'+Y+'" x2="'+x1+'" y2="'+Y+'" stroke="#e3eaf0"/>':'')+
    txt(x0-9,Y+4,fmt(yy),'font-size="10" text-anchor="end" fill="#64748b"');
   svg+=(showGrid?'<line x1="'+X+'" y1="'+y0+'" x2="'+X+'" y2="'+y1+'" stroke="#e3eaf0"/>':'')+
    txt(X,y1+17,fmt(xx),'font-size="10" text-anchor="middle" fill="#64748b"');
  }
  svg+=txt(x1,y1+35,'X','font-size="11" text-anchor="end" fill="#516578"')+
   txt(x0-26,y0+4,'Y','font-size="11" text-anchor="end" fill="#516578"');
  series.forEach((item,k)=>{
   const color=colorAt(k);
   if(settings.trendline){
    const quadratic=settings.trendType==='quadratic',
     fit=quadratic?quadraticRegression(item.points):linearRegression(item.points);
    if(fit){
     if(quadratic){
      let segments='',previous=null;
      for(let t=0;t<=96;t++){
       const X=xMin+(xMax-xMin)*t/96,Y=predictQuadratic(fit,X);
       if(previous){
        const visible=clipTrendLine(previous.x,previous.y,X,Y,xMin,xMax,yMin,yMax);
        if(visible)segments+='M'+sx(visible[0])+','+sy(visible[1])+
          'L'+sx(visible[2])+','+sy(visible[3])+' ';
       }
       previous={x:X,y:Y};
      }
      if(segments)svg+='<path class="qo-xy-trendline qo-xy-quadratic" data-series="'+k+
       '" d="'+segments.trim()+'" stroke="'+color+'" stroke-width="2.5" stroke-dasharray="7 4" fill="none"/>';
     }else{
      const visible=clippedTrendSegment(fit,xMin,xMax,yMin,yMax);
      if(visible)svg+='<line class="qo-xy-trendline" data-series="'+k+
       '" x1="'+sx(visible[0].x)+'" y1="'+sy(visible[0].y)+
       '" x2="'+sx(visible[1].x)+'" y2="'+sy(visible[1].y)+
       '" stroke="'+color+'" stroke-width="2.5" stroke-dasharray="7 4" />';
     }
     if(settings.trendEquation||settings.trendR2){
      const label=(settings.trendEquation?(quadratic?quadraticLabel(fit):regressionLabel(fit)):'')+
       (settings.trendR2?(settings.trendEquation?' · ':'')+'R² = '+fmt(fit.r2):'');
      svg+=txt(legendRight?466:350,legendRight?198+k*32:20+k*15,label.slice(0,67),
       'font-size="11" fill="'+color+'" text-anchor="'+(legendRight?'start':'middle')+'"');
     }
    }else svg+=txt(legendRight?466:350,legendRight?198+k*32:20+k*15,
     'Ряд '+(k+1)+(quadratic?': недостаточно разных X':': X одинаковы'),'font-size="11" fill="#a34b4b"');
   }
   item.points.forEach((p,i)=>{
    const X=sx(p.x),Y=sy(p.value);
    if(X<x0||X>x1||Y<y0||Y>y1)return;
    svg+='<circle class="qo-scatter-point" cx="'+X+'" cy="'+Y+'" r="4.5" fill="'+color+
     '" stroke="#fff" stroke-width="1"/>';
    if(showValues&&i%Math.max(1,Math.ceil(item.points.length/12))===0)
     svg+=txt(Math.round(X),Math.max(14,Y-9),fmt(p.value),
      'font-size="10" text-anchor="middle" fill="#30465b"');
   });
  });
  if(legend!=='none')series.forEach((item,k)=>{
   const col=k%2,row=Math.floor(k/2),X=legendRight?466:80+col*250,
    Y=legendRight?68+k*30:278+row*17;
   svg+='<circle cx="'+(X+5)+'" cy="'+(Y-4)+'" r="5" fill="'+colorAt(k)+'"/>'+
    txt(X+17,Y,item.name.slice(0,legendRight?17:28),
    'font-size="11" fill="#43536b"');
  });
 }else if(type==='pie'){
  const total=pts.reduce((n,p)=>n+p.value,0),cx=200,cy=154,r=99,c=2*Math.PI*r;let offset=0;
  pts.forEach((p,i)=>{
   const len=p.value/total*c;
   svg+='<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+colorAt(i)+
     '" stroke-width="58" stroke-dasharray="'+len.toFixed(4)+' '+(c-len).toFixed(4)+
     '" stroke-dashoffset="'+(-offset).toFixed(4)+'" transform="rotate(-90 '+cx+' '+cy+')"/>';
   if(showValues&&p.value>0&&i<12){
    const middle=(offset+len/2)/c*2*Math.PI-Math.PI/2;
    svg+=txt(Math.round(cx+78*Math.cos(middle)),Math.round(cy+78*Math.sin(middle)),fmt(p.value),
     'font-size="12" font-weight="700" text-anchor="middle" fill="#fff"');
   }
   offset+=len;
  });
  if(legend!=='none')pts.slice(0,legend==='bottom'?4:12).forEach((p,i)=>{
   const x=legend==='bottom'?70+(i%2)*260:358,y=legend==='bottom'?276+Math.floor(i/2)*19:52+21*i;
   svg+='<rect x="'+x+'" y="'+(y-9)+'" width="11" height="11" rx="2" fill="'+colorAt(i)+'"/>'+
    txt(x+19,y,p.label.slice(0,16)+' · '+fmt(p.value/total*100)+'%','font-size="12" fill="#32465b"');
  });
  if(legend==='bottom'&&pts.length>4)svg+=txt(575,306,'+'+(pts.length-4),'font-size="11" fill="#64748b"');
  svg+=txt(cx,cy+5,fmt(total),'font-size="18" font-weight="700" text-anchor="middle" fill="#2d4152"');
 }else{
  const isStacked=STACKED_TYPES.includes(type),isPercent=type==='stacked100',
   values=series.flatMap(s=>s.points.map(p=>p.value)),
   totals=pts.map((_,i)=>{
    const items=series.map(s=>s.points[i].value);
    return {positive:items.filter(v=>v>0).reduce((a,b)=>a+b,0),
      negative:items.filter(v=>v<0).reduce((a,b)=>a+b,0)};
   }),
   autoMin=isPercent?0:isStacked?Math.min(0,...totals.map(t=>t.negative)):Math.min(0,...values),
   autoMax=isPercent?100:isStacked?Math.max(0,...totals.map(t=>t.positive)):Math.max(0,...values),
   min=isPercent?0:settings.min??(settings.max!=null?Math.min(autoMin,settings.max-1):autoMin),
   max=isPercent?100:settings.max??Math.max(autoMax,min+1),range=max-min||1,
   x0=64,x1=legend==='right'?450:604,y0=35,y1=legend==='bottom'&&series.length>1?230:254,
   w=x1-x0,h=y1-y0;
  const y=v=>y1-(v-min)/range*h,x=i=>x0+(i+.5)*w/pts.length,baseline=y(0);
  for(let t=0;t<=4;t++){
   const value=min+range*t/4,Y=y(value);
   svg+=(showGrid?'<line x1="'+x0+'" y1="'+Y+'" x2="'+x1+'" y2="'+Y+'" stroke="#e3eaf0"/>':'')+
     txt(x0-8,Y+4,(isPercent?fmt(value)+'%':fmt(value)),'font-size="10" text-anchor="end" fill="#64748b"');
  }
  if(isStacked){
   const bw=Math.max(3,Math.min(50,w/pts.length*.64));
   pts.forEach((_,i)=>{
    let positive=0,negative=0;
    const total=totals[i].positive;
    series.forEach((entry,k)=>{
     const original=entry.points[i].value,value=isPercent?original/total*100:original,
      from=value>=0?positive:negative,to=from+value;
     if(value>=0)positive=to;else negative=to;
     const top=Math.min(y(from),y(to)),height=Math.abs(y(from)-y(to));
     if(height>0)svg+='<rect x="'+(x(i)-bw/2)+'" y="'+top+'" width="'+bw+
      '" height="'+Math.max(.2,height)+'" fill="'+colorAt(k)+'"/>';
     if(showValues&&height>=16&&i%Math.max(1,Math.ceil(pts.length/10))===0&&original!==0)
      svg+=txt(x(i),top+height/2+4,isPercent?fmt(value)+'%':fmt(original),
       'font-size="10" text-anchor="middle" fill="#fff" font-weight="600"');
    });
   });
  }else if(type==='bar'){
   const group=Math.min(66,w/pts.length*.75),bw=Math.max(2,Math.min(48,group/series.length));
   series.forEach((s,k)=>s.points.forEach((p,i)=>{
    const Y=y(p.value);
    svg+='<rect x="'+(x(i)-group/2+k*bw)+'" y="'+Math.min(Y,baseline)+'" width="'+Math.max(1,bw-2)+
      '" height="'+Math.max(1,Math.abs(Y-baseline))+'" rx="2" fill="'+colorAt(series.length===1&&!colors.length?i:k)+'"/>';
    if(showValues&&i%Math.max(1,Math.ceil(pts.length/12))===0)
     svg+=txt(Math.round(x(i)-group/2+k*bw+bw/2),Math.max(15,Math.min(Y,baseline)-5),fmt(p.value),
      'font-size="10" text-anchor="middle" fill="#30465b"');
   }));
  }else{
   series.forEach((s,k)=>{
    const color=colorAt(k);
    svg+='<polyline fill="none" stroke="'+color+'" stroke-width="3" points="'+s.points.map((p,i)=>x(i)+','+y(p.value)).join(' ')+'"/>';
    s.points.forEach((p,i)=>{
     svg+='<circle cx="'+x(i)+'" cy="'+y(p.value)+'" r="4" fill="#fff" stroke="'+color+'" stroke-width="2"/>';
     if(showValues&&i%Math.max(1,Math.ceil(pts.length/12))===0)
      svg+=txt(x(i),Math.max(15,y(p.value)-9),fmt(p.value),'font-size="10" text-anchor="middle" fill="#30465b"');
    });
   });
  }
  const skip=Math.max(1,Math.ceil(pts.length/9));
  for(let i=0;i<pts.length;i+=skip)svg+=txt(x(i),y1+28,pts[i].label.slice(0,12),
    'font-size="11" text-anchor="middle" fill="#485c70"');
  if(legend!=='none')series.forEach((s,k)=>{
   const col=k%2,row=Math.floor(k/2),xx=legend==='right'?475:80+col*265,
     yy=legend==='right'?69+k*31:277+row*18;
   svg+='<rect x="'+xx+'" y="'+(yy-10)+'" width="11" height="11" fill="'+colorAt(k)+'" rx="2"/>'+
    txt(xx+17,yy,s.name.slice(0,legend==='right'?16:29),'font-size="11" fill="#43536b"');
  });
 }
 return '<svg class="qo-chart-svg" viewBox="0 0 640 320" role="img" aria-label="'+
  (type==='pie'?'Круговая':type==='line'?'Линейная':type==='stacked100'?'Столбчатая 100% с накоплением':type==='stacked'?'Столбчатая с накоплением':type==='scatter'?'Точечная XY':'Столбчатая')+' диаграмма">'+svg+'</svg>';
}
