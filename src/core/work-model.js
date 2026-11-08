/* TASK144: independent, portable work projects. No diagnostic/student mutations. */
const QW_TYPES={short:'Краткий ответ',extended:'Развёрнутый ответ',choice:'Тест',graph:'Задание с графиком',diagram:'Рисунок / схема',blanks:'Пустые вставки',combined:'Комбинированное'};
const QW_SUBJECTS={math:'Математика',geometry:'Геометрия',algebra:'Алгебра',physics:'Физика',mixed:'Математика и физика',other:'Авторская подборка'};
const QW_PLOT={left:82,right:451,top:46,bottom:262};
function qwPlotXY(g,p){return {x:QW_PLOT.left+(p.x-g.xmin)/(g.xmax-g.xmin)*(QW_PLOT.right-QW_PLOT.left),y:QW_PLOT.bottom-(p.y-g.ymin)/(g.ymax-g.ymin)*(QW_PLOT.bottom-QW_PLOT.top)};}
const QW_LIMITS={tasks:80,text:16000,points:40,objects:60,pages:80,bytes:18000000};
function qwId(){return 'w'+Date.now().toString(36)+Math.random().toString(36).slice(2,9);}
function qwText(v,max=16000){return typeof v==='string'?v.slice(0,max):'';}
function qwLabelPosition(raw){
 if(!raw||typeof raw!=='object'||!['auto','manual'].includes(raw.mode))throw Error('Некорректное положение подписи');
 const dx=raw.dx??0,dy=raw.dy??0;if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.abs(dx)>1040||Math.abs(dy)>1040)throw Error('Некорректное смещение подписи');
 return {mode:raw.mode,dx,dy};
}
function qwPrintSettings(raw={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Некорректные параметры печати');
 const fontPt=raw.fontPt??10,figurePosition=raw.figurePosition??'auto',topicHeadings=raw.topicHeadings??true;
 if(!Number.isFinite(fontPt)||fontPt<9||fontPt>12||!['auto','right','below'].includes(figurePosition)||typeof topicHeadings!=='boolean')throw Error('Проверьте параметры печати');
 return {fontPt,figurePosition,topicHeadings};
}
function qwNum(v,min,max,fallback){return Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;}
function qwGraphDefault(){return {xmin:0,xmax:10,ymin:0,ymax:10,step:1,xlabel:'t, с',ylabel:'v, м/с',coordinateMode:'first',grid:true,connected:true,smooth:false,snapToGrid:true,curveFamily:'points',curve:{a:1,b:0,c:0,amplitude:3,frequency:1,phase:0,offset:0,trig:'sin'},points:[],elements:[]};}
function qwTask(type='short'){
 return {id:qwId(),type:Object.hasOwn(QW_TYPES,type)?type:'short',...(type==='choice'?{choices:['Вариант 1','Вариант 2','Вариант 3','Вариант 4']}:{}),part:'Часть 1',prompt:'',answer:'',criteria:'',comment:'',grade:'',exam:'general',topic:'',subtopic:'',origin:'original',points:2,answerVisible:true,answerStyle:'line',boxes:6,solutionVisible:['extended','combined'].includes(type),solutionHeight:110,solutionStyle:'lines',figure:['graph','diagram','combined'].includes(type)?type==='diagram'?'diagram':'graph':'none',position:'auto',figureWidth:220,pageBreak:false,graph:qwGraphDefault(),diagram:[],image:''};
}
function qwQuickTask(preset){const q=qwTask(preset==='text'?'short':preset==='test'?'choice':preset);if(preset==='text')q.answerVisible=false;return q;}
function qwProject(){return {format:'quantum-work',version:1,id:qwId(),title:'Новая работа',subject:'physics',grade:'8',topic:'',variant:'1',instructions:'',identity:false,layout:'worksheet',exam:'ege',tasks:[]};}
function qwValidate(raw){
 if(!raw||raw.format!=='quantum-work'||raw.version!==1||!Array.isArray(raw.tasks)||raw.tasks.length>QW_LIMITS.tasks)throw Error('Неподдерживаемый проект QWORK');
 const d=qwProject(),ids=new Set();
 for(const key of ['title','grade','topic','variant','instructions'])d[key]=qwText(raw[key],key==='instructions'?4000:key==='title'||key==='topic'?160:24);
 d.title=d.title.trim()||'Новая работа';d.id=qwText(raw.id,80)||qwId();d.subject=Object.hasOwn(QW_SUBJECTS,raw.subject)?raw.subject:'physics';d.identity=raw.identity===true;d.layout=['compact','practice','exam'].includes(raw.layout)?raw.layout:'worksheet';d.exam=raw.exam==='oge'?'oge':'ege';
 if(raw.practice!==undefined){
  const p=raw.practice;if(!p||typeof p!=='object'||![1,2,3,4].includes(p.perPage)||!['none','fine','normal'].includes(p.grid))throw Error('Некорректные параметры листа для решения');
  d.practice={perPage:p.perPage,grid:p.grid};
 }
 if(raw.printSettings!==undefined)d.printSettings=qwPrintSettings(raw.printSettings);
 d.tasks=raw.tasks.map(raw=>{
  if(!raw||typeof raw!=='object'||!Object.hasOwn(QW_TYPES,raw.type)||typeof raw.prompt!=='string'||raw.prompt.length>QW_LIMITS.text)throw Error('Повреждено задание');
  const q=qwTask(raw.type);q.id=qwText(raw.id,80)||qwId();if(ids.has(q.id))throw Error('Повторяющийся ID задания');ids.add(q.id);
  if(q.type==='choice'){if(!Array.isArray(raw.choices)||raw.choices.length<2||raw.choices.length>12||raw.choices.some(s=>typeof s!=='string'||!s.trim()||s.length>300))throw Error('Тест: от 2 до 12 непустых вариантов, до 300 символов');q.choices=raw.choices.map(s=>s.trim());}
  for(const key of ['part','prompt','answer','criteria','comment'])q[key]=qwText(raw[key],key==='part'?120:QW_LIMITS.text);
   for(const key of ['grade','topic','subtopic'])q[key]=qwText(raw[key],key==='grade'?24:120).trim();
   q.exam=['general','oge','ege'].includes(raw.exam)?raw.exam:'general';q.origin=['original','adapted','generated'].includes(raw.origin)?raw.origin:'original';
  q.points=qwNum(raw.points,0,100,2);q.answerVisible=raw.answerVisible!==false;q.solutionVisible=raw.solutionVisible===true;q.pageBreak=raw.pageBreak===true;
  q.answerStyle=['line','box','boxes'].includes(raw.answerStyle)?raw.answerStyle:'line';q.boxes=Math.round(qwNum(raw.boxes,1,30,6));q.solutionHeight=qwNum(raw.solutionHeight,24,500,110);q.solutionStyle=['lines','grid','blank'].includes(raw.solutionStyle)?raw.solutionStyle:'lines';
  q.figure=['none','graph','diagram','image'].includes(raw.figure)?raw.figure:'none';q.position=['auto','left','right','below'].includes(raw.position)?raw.position:'right';q.figureWidth=qwNum(raw.figureWidth,120,470,220);
  const g=raw.graph||qwGraphDefault();q.graph=qwValidateGraph(g);q.diagram=qwValidateDiagram(raw.diagram||[]);
  if(raw.image){if(typeof raw.image!=='string'||raw.image.length>6000000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw.image))throw Error('Недопустимое изображение');q.image=raw.image;}
  if(raw.source&&typeof raw.source==='object')q.source={kind:qwText(raw.source.kind,30),id:qwText(raw.source.id,80)};
  return q;
 });
 if(new TextEncoder().encode(JSON.stringify(d)).length>QW_LIMITS.bytes)throw Error('Проект больше 18 МБ');return d;
}
function qwValidateGraph(raw){
 const g=qwGraphDefault();
 for(const k of ['xmin','xmax','ymin','ymax','step']){const n=Number(raw[k]);if(!Number.isFinite(n)||Math.abs(n)>1000000)throw Error('Некорректный диапазон графика');g[k]=n;}
 if(g.xmax<=g.xmin||g.ymax<=g.ymin||g.step<=0)throw Error('Проверьте диапазоны и шаг сетки');
 g.coordinateMode=['first','positiveX','math','custom'].includes(raw.coordinateMode)?raw.coordinateMode:(g.xmin===0&&g.ymin===0?'first':'custom');
 g.xlabel=qwText(raw.xlabel,30);g.ylabel=qwText(raw.ylabel,30);g.grid=raw.grid!==false;g.connected=raw.connected!==false;g.smooth=raw.smooth===true;g.snapToGrid=raw.snapToGrid!==false;g.curveFamily=['points','quadratic','trigonometric'].includes(raw.curveFamily)?raw.curveFamily:'points';
 const c=raw.curve&&typeof raw.curve==='object'?raw.curve:{};
 for(const k of ['a','b','c','amplitude','frequency','phase','offset']){
  const value=c[k]===undefined?g.curve[k]:Number(c[k]);
  if(!Number.isFinite(value)||Math.abs(value)>1000)throw Error('Некорректный параметр функции');
  g.curve[k]=value;
 }
 g.curve.trig=c.trig==='cos'?'cos':'sin';
 if(!Array.isArray(raw.points)||raw.points.length>QW_LIMITS.points)throw Error('Максимум 40 точек');
 g.points=raw.points.map(p=>{if(!p||!Number.isFinite(Number(p.x))||!Number.isFinite(Number(p.y))||Number(p.x)<g.xmin||Number(p.x)>g.xmax||Number(p.y)<g.ymin||Number(p.y)>g.ymax)throw Error('Точка вне диапазона графика');return {x:Number(p.x),y:Number(p.y),label:qwText(p.label,30),...(p.style!==undefined?{style:qwValidateStyle(p.style)}:{}),...(p.labelPosition!==undefined?{labelPosition:qwLabelPosition(p.labelPosition)}:{})};});
 g.elements=qwValidateGraphElements(raw.elements||[]);
 for(const k of ['curveStyle','lineStyle'])if(raw[k]!==undefined)g[k]=qwValidateStyle(raw[k]);
 return g;
}
function qwValidateGraphElements(raw){
 if(!Array.isArray(raw)||raw.length>QW_LIMITS.objects)throw Error('Максимум 60 объектов графика');
 const coord=n=>{if(!Number.isFinite(n)||Math.abs(n)>1000000)throw Error('Некорректная координата объекта графика');return n;};
 return raw.map(o=>{
  if(!o||!['point','line','arrow','polyline','text','function'].includes(o.kind))throw Error('Неизвестный объект графика');
  const result={kind:o.kind,label:qwText(o.label,80)};
  if(o.kind==='function'){
   if(!['quadratic','trigonometric'].includes(o.family))throw Error('Неизвестная функция');
   const base=qwGraphDefault(),g=qwValidateGraph({...base,curveFamily:o.family,curve:o.curve});result.family=o.family;result.curve=g.curve;
  }else if(o.kind==='polyline'){
   if(!Array.isArray(o.vertices)||o.vertices.length<2||o.vertices.length>40)throw Error('Ломаная: 2–40 вершин');
   result.vertices=o.vertices.map(p=>({x:coord(p.x),y:coord(p.y)}));
  }else{
   result.x=coord(o.x);result.y=coord(o.y);
   if(['line','arrow'].includes(o.kind)){result.x2=coord(o.x2);result.y2=coord(o.y2);if(Math.hypot(o.x2-o.x,o.y2-o.y)<1e-9)throw Error('Отрезок должен иметь длину');}
  }
  if(o.labelPosition!==undefined)result.labelPosition=qwLabelPosition(o.labelPosition);
  if(o.style!==undefined)result.style=qwValidateStyle(o.style);return result;
 });
}
function qwCoordinatePreset(mode){
 return mode==='first'?{xmin:0,xmax:10,ymin:0,ymax:10}:mode==='positiveX'?{xmin:0,xmax:10,ymin:-5,ymax:5}:mode==='math'?{xmin:-5,xmax:5,ymin:-5,ymax:5}:null;
}
function qwGraphGridStep(g,axis){const span=g[axis+'max']-g[axis+'min'];return Math.max(g.step,span/20);}
function qwSnapGraphPoint(g,x,y){
 const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
 const snap=(v,axis)=>{
  const lo=g[axis+'min'],hi=g[axis+'max'],step=qwGraphGridStep(g,axis);
  const value=clamp(Number(v),lo,hi);
  if(!g.snapToGrid)return Number(value.toFixed(6));
  // Grid lines are anchored at multiples of the visible tick spacing.
  const first=Math.ceil((lo-1e-9)/step),last=Math.floor((hi+1e-9)/step);
  if(first>last)return Number(value.toFixed(6));
  const snapped=Math.min(last,Math.max(first,Math.round(value/step)))*step;
  return Number(clamp(snapped,lo,hi).toFixed(6));
 };
 return {x:snap(x,'x'),y:snap(y,'y')};
}
function qwEvaluateCurve(graph,x){
 const p=graph.curve;
 if(graph.curveFamily==='quadratic')return p.a*x*x+p.b*x+p.c;
 if(graph.curveFamily==='trigonometric')return p.amplitude*Math[p.trig==='cos'?'cos':'sin'](p.frequency*x+p.phase)+p.offset;
 return NaN;
}
function qwRegularPolygonVertices(object){
 const x=Math.min(object.x,object.x2),x2=Math.max(object.x,object.x2),y=Math.min(object.y,object.y2),y2=Math.max(object.y,object.y2);
 const n=object.sides||6,cx=(x+x2)/2,cy=(y+y2)/2,r=Math.min(x2-x,y2-y)/2;
 return Array.from({length:n},(_,i)=>{const a=-Math.PI/2+2*Math.PI*i/n;return {x:cx+r*Math.cos(a),y:cy+r*Math.sin(a),label:''};});
}
function qwGeometryVertices(object){
 if(object.kind==='regularPolygon')return qwRegularPolygonVertices(object);
 if(Array.isArray(object.vertices)&&object.vertices.length>=3)return object.vertices;
 const x=Math.min(object.x,object.x2),x2=Math.max(object.x,object.x2),
  y=Math.min(object.y,object.y2),y2=Math.max(object.y,object.y2);
 if(object.kind==='triangle')return [{x,y:y2,label:'A'},{x:x2,y:y2,label:'B'},{x:(x+x2)/2,y,label:'C'}];
 if(object.kind==='rightTriangle')return [{x,y:y2,label:'A'},{x:x2,y:y2,label:'B'},{x,y,label:'C'}];
 return [{x,y:y2,label:'A'},{x:x2,y:y2,label:'B'},{x:x2,y,label:'C'},{x,y,label:'D'}];
}
/** Exact median/altitude from a triangle vertex to the opposite side. Returns a static
 * auxiliary dashed line; subsequent vertex moves do not automatically mutate it. */
function qwTriangleConstruction(object,kind,vertexIndex=0){
 if(!object||!['triangle','rightTriangle'].includes(object.kind))throw Error('Сначала выберите треугольник');
 if(!['median','altitude'].includes(kind)||![0,1,2].includes(vertexIndex))throw Error('Неизвестное построение');
 const vs=qwGeometryVertices(object),a=vs[vertexIndex],b=vs[(vertexIndex+1)%3],c=vs[(vertexIndex+2)%3];
 const dx=c.x-b.x,dy=c.y-b.y,length2=dx*dx+dy*dy;
 if(length2<1e-8)throw Error('Противоположная сторона должна иметь ненулевую длину');
 const t=kind==='median'?.5:((a.x-b.x)*dx+(a.y-b.y)*dy)/length2;
 const x=b.x+t*dx,y=b.y+t*dy;
 if(x<0||x>520||y<0||y>320)throw Error('Основание высоты вне холста — измените расположение фигуры');
 return {kind:'dashed',x:a.x,y:a.y,x2:Number(x.toFixed(4)),y2:Number(y.toFixed(4)),label:''};
}
/* Anchor drawing endpoints to nearby vertices/edges before falling back to the grid. */
function qwSnapDiagramPoint(point,objects,step=20,excludeIndex=-1){
 const target={x:qwNum(point.x,0,520,0),y:qwNum(point.y,0,320,0)};
 const anchors=[];
 (Array.isArray(objects)?objects:[]).forEach((o,i)=>{
  if(i===excludeIndex||!o)return;
  const x=Math.min(o.x,o.x2),x2=Math.max(o.x,o.x2),
   y=Math.min(o.y,o.y2),y2=Math.max(o.y,o.y2);
  let local=[];
  if(o.kind==='regularPolygon')local.push(...qwGeometryVertices(o),{x:(x+x2)/2,y:(y+y2)/2});
  else if(Array.isArray(o.vertices))local.push(...o.vertices);
  else if(['block','rect','incline'].includes(o.kind)){
   local.push(...(o.kind==='incline'?[{x,y:y2},{x:x2,y:y2},{x:x2,y}]:[{x,y},{x:x2,y},{x,y:y2},{x:x2,y:y2}]),
    {x:(x+x2)/2,y:y2},{x:x2,y:(y+y2)/2});
   if(o.kind==='incline')local.push({x:(x+x2)/2,y:(y+y2)/2});
   else local.push({x:(x+x2)/2,y},{x,y:(y+y2)/2});
  }else if(['circle','ellipse','pulley','fixedPulley','movablePulley'].includes(o.kind)){
   const cx=(x+x2)/2,cy=(y+y2)/2,r=Math.max(8,Math.min(x2-x,y2-y)/2);
   local.push({x:cx,y:cy},{x:cx,y:['circle','ellipse'].includes(o.kind)?y:cy-r},{x:cx,y:['circle','ellipse'].includes(o.kind)?y2:cy+r},{x:['circle','ellipse'].includes(o.kind)?x:cx-r,y:cy},{x:['circle','ellipse'].includes(o.kind)?x2:cx+r,y:cy});
   if(o.kind==='movablePulley')local.push({x:cx-r,y:cy-r-32},{x:cx+r,y:cy-r-32},{x:cx,y:cy+r+18});
   else if(!['circle','ellipse'].includes(o.kind))local.push({x:cx,y:cy-r-14});
  }else local.push({x:o.x,y:o.y},{x:o.x2,y:o.y2});
  const cx=(x+x2)/2,cy=(y+y2)/2,a=(o.rotation||0)*Math.PI/180;
  anchors.push(...local.map(p=>({x:cx+(p.x-cx)*Math.cos(a)-(p.y-cy)*Math.sin(a),y:cy+(p.x-cx)*Math.sin(a)+(p.y-cy)*Math.cos(a)})));
 });
 let best=null,distance=Infinity;
 for(const a of anchors){
  const n=Math.hypot(target.x-a.x,target.y-a.y);
  if(n<distance){distance=n;best=a;}
 }
 if(best&&distance<=Math.min(step*.9,16))
  return {x:qwNum(best.x,0,520,0),y:qwNum(best.y,0,320,0)};
 return {x:Math.round(target.x/step)*step,y:Math.round(target.y/step)*step};
}
function qwValidateStyle(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Некорректное оформление');
 const style={};
 for(const k of ['stroke','fill','text'])if(raw[k]!==undefined){
  if(typeof raw[k]!=='string'||!/^#[0-9a-f]{6}$/i.test(raw[k])&&!(k==='fill'&&raw[k]==='none'))throw Error('Цвет должен быть в формате #RRGGBB');
  style[k]=raw[k].toLowerCase();
 }
 if(raw.width!==undefined){if(!Number.isFinite(raw.width)||raw.width<.5||raw.width>12)throw Error('Толщина линии: 0,5–12');style.width=raw.width;}
 return style;
}
function qwValidateDiagram(raw){
 if(!Array.isArray(raw)||raw.length>QW_LIMITS.objects)throw Error('Максимум 60 фигур');
 const ids=new Set(),result=raw.map(o=>{
  if(!o||!['ray','infiniteLine','line','arrow','doubleArrow','dimension','polyline','arc','dashed','rect','circle','ellipse','regularPolygon','point','text','angle','triangle','rightTriangle','quadrilateral','block','incline','pulley','fixedPulley','movablePulley','spring','ground','rope'].includes(o.kind))throw Error('Неизвестная фигура');
  for(const k of ['x','y','x2','y2'])if(!Number.isFinite(o[k]))throw Error('Повреждены координаты фигуры');
  const value={kind:o.kind,x:qwNum(o.x,0,520,0),y:qwNum(o.y,0,320,0),x2:qwNum(o.x2,0,520,0),y2:qwNum(o.y2,0,320,0),label:qwText(o.label,80)};
  if(o.kind==='regularPolygon'){
   if(!Number.isInteger(o.sides)||o.sides<3||o.sides>12)throw Error('Правильный многоугольник: 3–12 сторон');
   value.sides=o.sides;
  }
  if(o.id!==undefined){if(typeof o.id!=='string'||!o.id||o.id.length>80||ids.has(o.id))throw Error('Некорректный или повторный ID фигуры');value.id=o.id;ids.add(o.id);}
  if(['ray','infiniteLine'].includes(o.kind)){if(Math.abs(o.x2)>1040||Math.abs(o.y2)>1040||Math.hypot(o.x2-o.x,o.y2-o.y)<.01)throw Error('Построение: задайте ненулевое направление');value.x2=o.x2;value.y2=o.y2;}
  if(o.construction!==undefined){const c=o.construction;if(!c||!['parallel','perpendicular','midpoint','angleBisector','perpendicularBisector'].includes(c.kind)
   ||typeof c.reference!=='string'||!c.reference
   ||(['parallel','perpendicular','perpendicularBisector'].includes(c.kind)&&o.kind!=='infiniteLine')
   ||(c.kind==='midpoint'&&o.kind!=='point')||(c.kind==='angleBisector'&&o.kind!=='ray'))
   throw Error('Некорректная связь построения');value.construction={kind:c.kind,reference:c.reference};}
  if(o.ticks!==undefined){if(!['line','arrow','dashed','dimension','doubleArrow','ray','infiniteLine'].includes(o.kind)||![0,1,2,3].includes(o.ticks))throw Error('Засечки: от 0 до 3 на линейном объекте');value.ticks=o.ticks;}
  if(o.kind==='block'||o.rotation!==undefined){if(o.rotation!==undefined&&!Number.isFinite(o.rotation))throw Error('Некорректный угол');value.rotation=qwNum(o.rotation,-180,180,0);}
  if(o.style!==undefined)value.style=qwValidateStyle(o.style);
  if(o.labelPosition!==undefined)value.labelPosition=qwLabelPosition(o.labelPosition);
  if(['polyline','arc','dimension','doubleArrow'].includes(o.kind)){
   if(o.x<0||o.x>520||o.x2<0||o.x2>520||o.y<0||o.y>320||o.y2<0||o.y2>320)throw Error('Фигура вне холста');
   if(o.kind==='polyline'){
    if(!Array.isArray(o.vertices)||o.vertices.length<2||o.vertices.length>40)throw Error('Ломаная: 2–40 вершин');
    value.vertices=o.vertices.map(p=>{
     if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>520||p.y<0||p.y>320)throw Error('Некорректная вершина ломаной');
     return {x:p.x,y:p.y,label:qwText(p.label,20),...(p.labelPosition!==undefined?{labelPosition:qwLabelPosition(p.labelPosition)}:{})};
    });
    if(!value.vertices.some(p=>Math.hypot(p.x-value.vertices[0].x,p.y-value.vertices[0].y)>.01))throw Error('Ломаная должна иметь длину');
    value.x=Math.min(...value.vertices.map(p=>p.x));value.y=Math.min(...value.vertices.map(p=>p.y));
    value.x2=Math.max(...value.vertices.map(p=>p.x));value.y2=Math.max(...value.vertices.map(p=>p.y));
   }else if(o.kind==='arc'){
    const w=o.x2-o.x,h=o.y2-o.y;
    if(w<2||Math.abs(w-h)>.001)throw Error('Дуга: задайте окружность с радиусом от 1');
    for(const k of ['startAngle','endAngle'])if(!Number.isFinite(o[k])||Math.abs(o[k])>360)throw Error('Углы дуги: от −360 до 360°');
    if(Math.abs(o.endAngle-o.startAngle)<.01||Math.abs(o.endAngle-o.startAngle)>360)throw Error('Дуга должна иметь ненулевой угол до 360°');
    value.startAngle=o.startAngle;value.endAngle=o.endAngle;
   }else{
    if(Math.hypot(o.x2-o.x,o.y2-o.y)<.01)throw Error('Линия должна иметь длину');
    if(o.kind==='dimension'&&o.labelOffset!==undefined){
     if(!Number.isFinite(o.labelOffset)||Math.abs(o.labelOffset)<12||Math.abs(o.labelOffset)>80)throw Error('Отступ подписи: от 12 до 80 по модулю');
     value.labelOffset=o.labelOffset;
    }
   }
  }
  if(['triangle','rightTriangle','quadrilateral'].includes(o.kind)){
   if(o.vertices!==undefined&&(!Array.isArray(o.vertices)||o.vertices.length!==(o.kind==='quadrilateral'?4:3)))throw Error('Некорректные вершины геометрической фигуры');
   const vertices=qwGeometryVertices(o);
   value.vertices=vertices.map(p=>{
    if(!p||!Number.isFinite(Number(p.x))||!Number.isFinite(Number(p.y)))throw Error('Неверные координаты вершины');
    return {x:qwNum(p.x,0,520,0),y:qwNum(p.y,0,320,0),label:qwText(p.label,20),...(p.labelPosition!==undefined?{labelPosition:qwLabelPosition(p.labelPosition)}:{})};
   });
   if(o.edgeLabels!==undefined&&(!Array.isArray(o.edgeLabels)||o.edgeLabels.length!==vertices.length))throw Error('Некорректные подписи сторон');
   value.edgeLabels=vertices.map((_,i)=>qwText(o.edgeLabels?.[i],40));
   if(o.edgeLabelPositions!==undefined){if(!Array.isArray(o.edgeLabelPositions)||o.edgeLabelPositions.length!==vertices.length)throw Error('Некорректные положения подписей сторон');value.edgeLabelPositions=o.edgeLabelPositions.map(p=>p===null?null:qwLabelPosition(p));}
  }
  return value;
 });return qwResolveDiagram(result);
}
function qwResolveDiagram(objects){
 const result=objects.map(o=>({...o})),byId=new Map(result.filter(o=>o.id).map(o=>[o.id,o])),done=new Set(),active=new Set();
 function resolve(o){if(done.has(o))return;if(active.has(o))throw Error('Циклическая связь построений');active.add(o);
  if(o.construction){
   const c=o.construction,ref=byId.get(c.reference);
   if(!ref)throw Error('Не найдена исходная фигура построения');
   resolve(ref);
   const theta=(ref.rotation||0)*Math.PI/180,cs=Math.cos(theta),sn=Math.sin(theta);
   const center={x:(Math.min(ref.x,ref.x2)+Math.max(ref.x,ref.x2))/2,y:(Math.min(ref.y,ref.y2)+Math.max(ref.y,ref.y2))/2};
   const rotate=p=>({x:center.x+(p.x-center.x)*cs-(p.y-center.y)*sn,y:center.y+(p.x-center.x)*sn+(p.y-center.y)*cs});
   if(c.kind==='angleBisector'){
    if(ref.kind!=='angle')throw Error('Для биссектрисы нужен угол');
    const v=rotate({x:ref.x,y:ref.y}),b=rotate({x:ref.x2,y:ref.y}),d=rotate({x:ref.x2,y:ref.y2});
    const u={x:b.x-v.x,y:b.y-v.y},w={x:d.x-v.x,y:d.y-v.y},lu=Math.hypot(u.x,u.y),lw=Math.hypot(w.x,w.y);
    if(lu<.01||lw<.01)throw Error('Стороны угла должны иметь длину');
    const direction={x:u.x/lu+w.x/lw,y:u.y/lu+w.y/lw},length=Math.hypot(direction.x,direction.y);
    if(length<.01)throw Error('Нельзя построить биссектрису развёрнутого угла');
    o.x=v.x;o.y=v.y;o.x2=v.x+direction.x/length*40;o.y2=v.y+direction.y/length*40;o.rotation=0;
   }else{
    if(!['line','dashed','arrow','dimension','doubleArrow','ray','infiniteLine'].includes(ref.kind))
     throw Error('Не найдена опорная линия построения');
    if(['midpoint','perpendicularBisector'].includes(c.kind)&&!['line','dashed','arrow','dimension','doubleArrow'].includes(ref.kind))
     throw Error('Для середины или серединного перпендикуляра нужен конечный отрезок');
    const p=rotate({x:ref.x,y:ref.y}),q=rotate({x:ref.x2,y:ref.y2});
    const dx=q.x-p.x,dy=q.y-p.y,length=Math.hypot(dx,dy);
    if(length<.01)throw Error('Опорная линия должна иметь длину');
    if(c.kind==='midpoint'){o.x=(p.x+q.x)/2;o.y=(p.y+q.y)/2;o.x2=o.x;o.y2=o.y;}
    else if(c.kind==='perpendicularBisector'){
     o.x=(p.x+q.x)/2;o.y=(p.y+q.y)/2;o.x2=o.x-dy/length*40;o.y2=o.y+dx/length*40;
    }else{
     const perpendicular=c.kind==='perpendicular';
     o.x2=o.x+(perpendicular?-dy:dx)/length*40;o.y2=o.y+(perpendicular?dx:dy)/length*40;
    }
    o.rotation=0;
   }
  }active.delete(o);done.add(o);
 }result.forEach(resolve);return result;
}
function qwReorder(d,id,gap,part){const i=d.tasks.findIndex(q=>q.id===id);if(i<0||!Number.isInteger(gap)||gap<0||gap>d.tasks.length)return false;const j=gap>i?gap-1:gap,q=d.tasks[i],nextPart=part===undefined?q.part:qwText(part,120);if(i===j&&q.part===nextPart)return false;d.tasks.splice(i,1);q.part=nextPart;d.tasks.splice(j,0,q);return true;}
function qwMove(d,id,delta){const i=d.tasks.findIndex(q=>q.id===id),j=i+delta;if(i<0||j<0||j>=d.tasks.length)return false;return qwReorder(d,id,delta>0?j+1:j,d.tasks[j].part);}
function qwDuplicate(d,id){if(d.tasks.length>=QW_LIMITS.tasks)return null;const i=d.tasks.findIndex(q=>q.id===id);if(i<0)return null;const q=structuredClone(d.tasks[i]);q.id=qwId();d.tasks.splice(i+1,0,q);return q;}
function qwFromDiagnostic(q){const t=qwTask(q.type==='practice'?'extended':q.type==='numeric'?'short':'short');t.prompt=qwText(q.prompt);t.answer=qwText(q.answer);t.criteria=qwText(q.criteria);t.points=qwNum(q.points,0,100,2);t.source={kind:'diagnostic',id:qwText(q.id,80)};return t;}
export {qwLabelPosition,qwPrintSettings,QW_TYPES,QW_SUBJECTS,QW_LIMITS,qwProject,qwTask,qwQuickTask,qwValidate,qwValidateGraph,qwValidateDiagram,qwMove,qwReorder,qwResolveDiagram,qwDuplicate,qwFromDiagnostic,qwGraphGridStep,qwSnapGraphPoint,qwEvaluateCurve,qwGeometryVertices,qwRegularPolygonVertices,qwTriangleConstruction,qwSnapDiagramPoint,qwValidateStyle,qwValidateGraphElements,qwCoordinatePreset,QW_PLOT,qwPlotXY};
