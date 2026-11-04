/* TASK144: independent, portable work projects. No diagnostic/student mutations. */
const QW_TYPES={short:'Краткий ответ',extended:'Развёрнутый ответ',graph:'Задание с графиком',diagram:'Рисунок / схема',blanks:'Пустые вставки',combined:'Комбинированное'};
const QW_LIMITS={tasks:80,text:16000,points:40,objects:60,pages:80,bytes:18000000};
function qwId(){return 'w'+Date.now().toString(36)+Math.random().toString(36).slice(2,9);}
function qwText(v,max=16000){return typeof v==='string'?v.slice(0,max):'';}
function qwNum(v,min,max,fallback){return Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;}
function qwGraphDefault(){return {xmin:0,xmax:10,ymin:0,ymax:10,step:1,xlabel:'t, с',ylabel:'v, м/с',grid:true,connected:true,smooth:false,snapToGrid:true,curveFamily:'points',points:[]};}
function qwTask(type='short'){
 return {id:qwId(),type:Object.hasOwn(QW_TYPES,type)?type:'short',part:'Часть 1',prompt:'',answer:'',criteria:'',comment:'',grade:'',exam:'general',topic:'',subtopic:'',origin:'original',points:2,answerVisible:true,answerStyle:'line',boxes:6,solutionVisible:['extended','combined'].includes(type),solutionHeight:110,solutionStyle:'lines',figure:['graph','diagram','combined'].includes(type)?type==='diagram'?'diagram':'graph':'none',position:'right',figureWidth:220,pageBreak:false,graph:qwGraphDefault(),diagram:[],image:''};
}
function qwProject(){return {format:'quantum-work',version:1,id:qwId(),title:'Новая работа',subject:'physics',grade:'8',topic:'',variant:'1',instructions:'',identity:false,tasks:[]};}
function qwValidate(raw){
 if(!raw||raw.format!=='quantum-work'||raw.version!==1||!Array.isArray(raw.tasks)||raw.tasks.length>QW_LIMITS.tasks)throw Error('Неподдерживаемый проект QWORK');
 const d=qwProject(),ids=new Set();
 for(const key of ['title','grade','topic','variant','instructions'])d[key]=qwText(raw[key],key==='instructions'?4000:key==='title'||key==='topic'?160:24);
 d.title=d.title.trim()||'Новая работа';d.id=qwText(raw.id,80)||qwId();d.subject=raw.subject==='math'?'math':'physics';d.identity=raw.identity!==false;
 d.tasks=raw.tasks.map(raw=>{
  if(!raw||typeof raw!=='object'||!Object.hasOwn(QW_TYPES,raw.type)||typeof raw.prompt!=='string'||raw.prompt.length>QW_LIMITS.text)throw Error('Повреждено задание');
  const q=qwTask(raw.type);q.id=qwText(raw.id,80)||qwId();if(ids.has(q.id))throw Error('Повторяющийся ID задания');ids.add(q.id);
  for(const key of ['part','prompt','answer','criteria','comment'])q[key]=qwText(raw[key],key==='part'?120:QW_LIMITS.text);
   for(const key of ['grade','topic','subtopic'])q[key]=qwText(raw[key],key==='grade'?24:120).trim();
   q.exam=['general','oge','ege'].includes(raw.exam)?raw.exam:'general';q.origin=['original','adapted','generated'].includes(raw.origin)?raw.origin:'original';
  q.points=qwNum(raw.points,0,100,2);q.answerVisible=raw.answerVisible!==false;q.solutionVisible=raw.solutionVisible===true;q.pageBreak=raw.pageBreak===true;
  q.answerStyle=['line','box','boxes'].includes(raw.answerStyle)?raw.answerStyle:'line';q.boxes=Math.round(qwNum(raw.boxes,1,30,6));q.solutionHeight=qwNum(raw.solutionHeight,24,500,110);q.solutionStyle=['lines','grid','blank'].includes(raw.solutionStyle)?raw.solutionStyle:'lines';
  q.figure=['none','graph','diagram','image'].includes(raw.figure)?raw.figure:'none';q.position=['left','right','below'].includes(raw.position)?raw.position:'right';q.figureWidth=qwNum(raw.figureWidth,120,470,220);
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
 g.xlabel=qwText(raw.xlabel,30);g.ylabel=qwText(raw.ylabel,30);g.grid=raw.grid!==false;g.connected=raw.connected!==false;g.smooth=raw.smooth===true;g.snapToGrid=raw.snapToGrid!==false;g.curveFamily=['points','quadratic','trigonometric'].includes(raw.curveFamily)?raw.curveFamily:'points';
 if(!Array.isArray(raw.points)||raw.points.length>QW_LIMITS.points)throw Error('Максимум 40 точек');
 g.points=raw.points.map(p=>{if(!p||!Number.isFinite(Number(p.x))||!Number.isFinite(Number(p.y))||Number(p.x)<g.xmin||Number(p.x)>g.xmax||Number(p.y)<g.ymin||Number(p.y)>g.ymax)throw Error('Точка вне диапазона графика');return {x:Number(p.x),y:Number(p.y),label:qwText(p.label,30)};});return g;
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
function qwValidateDiagram(raw){
 if(!Array.isArray(raw)||raw.length>QW_LIMITS.objects)throw Error('Максимум 60 фигур');
 return raw.map(o=>{if(!o||!['line','arrow','rect','circle','point','text','angle'].includes(o.kind))throw Error('Неизвестная фигура');for(const k of ['x','y','x2','y2'])if(!Number.isFinite(o[k]))throw Error('Повреждены координаты фигуры');return {kind:o.kind,x:qwNum(o.x,0,520,0),y:qwNum(o.y,0,320,0),x2:qwNum(o.x2,0,520,0),y2:qwNum(o.y2,0,320,0),label:qwText(o.label,80)};});
}
function qwMove(d,id,delta){const i=d.tasks.findIndex(q=>q.id===id),j=i+delta;if(i<0||j<0||j>=d.tasks.length)return false;[d.tasks[i],d.tasks[j]]=[d.tasks[j],d.tasks[i]];return true;}
function qwDuplicate(d,id){if(d.tasks.length>=QW_LIMITS.tasks)return null;const i=d.tasks.findIndex(q=>q.id===id);if(i<0)return null;const q=structuredClone(d.tasks[i]);q.id=qwId();d.tasks.splice(i+1,0,q);return q;}
function qwFromDiagnostic(q){const t=qwTask(q.type==='practice'?'extended':q.type==='numeric'?'short':'short');t.prompt=qwText(q.prompt);t.answer=qwText(q.answer);t.criteria=qwText(q.criteria);t.points=qwNum(q.points,0,100,2);t.source={kind:'diagnostic',id:qwText(q.id,80)};return t;}
export {QW_TYPES,QW_LIMITS,qwProject,qwTask,qwValidate,qwValidateGraph,qwValidateDiagram,qwMove,qwDuplicate,qwFromDiagnostic,qwGraphGridStep,qwSnapGraphPoint};
