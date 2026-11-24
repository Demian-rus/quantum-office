import {ql2Validate,ql2Parse,ql2Serialize,ql2Timeline,ql2Svg,ql2Visual,QL2_COLORS} from '../src/core/lecture-project.js';
import {QL2_RADIATION,ql2Graph} from '../src/core/lecture-radiation-visuals.js';
let project=structuredClone(QL2_RADIATION),open=new Set(['intro']),dirty=false;
let counter=0;const uid=()=> 'u'+Date.now().toString(36)+'_'+(++counter);
const $=id=>document.getElementById(id),root=$('scenes'),status=$('status');
function elem(tag,attrs={},...children){const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='class')n.className=v;else if(k==='text')n.textContent=v;else if(k==='on')n.addEventListener('click',v);else if(k==='value')n.value=v;else n.setAttribute(k,String(v));}for(const c of children)if(c!==null&&c!==undefined)n.append(c);return n;}
function btn(t,on){return elem('button',{type:'button',on,text:t});}
function note(t){return elem('p',{class:'note',text:t});}
function say(t){status.textContent=t;}
function edit(fn,refresh=true){try{const v=structuredClone(project);fn(v);project=ql2Validate(v);dirty=true;say('Есть несохранённые изменения. Сохраните QLECTURE.');if(refresh)render();return true;}catch(e){say(e.message);return false;}}
function fmt(n){const m=Math.floor(n/60),s=Math.floor(n%60);return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
function field(label,value,change,type='text',opts={}){const input=elem(type==='textarea'?'textarea':'input',type==='textarea'?{rows:5}:{type,...opts});input.value=value;let last=value;input.addEventListener('change',()=>{const next=type==='number'?Number(input.value):input.value;if(change(next))last=next;else input.value=last;});return elem('label',{class:'field'},elem('span',{text:label}),input);}
function saveBlob(blob,name){const url=URL.createObjectURL(blob),a=elem('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function safe(s){return s.replace(/[^\p{L}\p{N}_-]+/gu,'-').slice(0,70)||'illustration';}
function svgBlob(v,p){return new Blob([ql2Svg(v,p)],{type:'image/svg+xml;charset=utf-8'});}
async function png(v,p){const url=URL.createObjectURL(svgBlob(v,p));try{const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=1440;c.height=800;c.getContext('2d').drawImage(im,0,0,1440,800);const b=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(!b)throw Error('Не удалось получить PNG');saveBlob(b,safe(v.title)+'.png');}finally{URL.revokeObjectURL(url);}}
async function webm(v){
 const c=document.createElement('canvas');c.width=1440;c.height=800;
 if(typeof MediaRecorder==='undefined'||!c.captureStream)throw Error('Этот браузер не поддерживает экспорт WebM.');
 const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));
 if(!mime)throw Error('Кодек WebM недоступен.');
 const ctx=c.getContext('2d');
 const frame=async p=>{const url=URL.createObjectURL(svgBlob(v,p));try{const im=new Image();im.src=url;await im.decode();ctx.drawImage(im,0,0,c.width,c.height);}finally{URL.revokeObjectURL(url);}};
 await frame(0);const stream=c.captureStream(30);
 let rec;
 try{
  rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:4000000});
  const chunks=[];rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  const done=new Promise((resolve,reject)=>{rec.onstop=()=>resolve(new Blob(chunks,{type:'video/webm'}));rec.onerror=e=>reject(e.error||Error('Ошибка записи WebM'));});done.catch(()=>{});
  rec.start();const start=performance.now();
  while(true){const p=Math.min(1,(performance.now()-start)/6000);await frame(p);if(p>=1)break;await new Promise(r=>setTimeout(r,28));}
  await new Promise(r=>setTimeout(r,100));if(rec.state!=='inactive')rec.stop();
  const blob=await done;if(!blob.size)throw Error('Получен пустой WebM');saveBlob(blob,safe(v.title)+'.webm');
 }finally{if(rec&&rec.state!=='inactive')rec.stop();for(const t of stream.getTracks())t.stop();}
}
function graphEditor(v,change,draw){
 const box=elem('div',{class:'fields'});box.append(field('Подпись X',v.xLabel,x=>change(o=>o.xLabel=x,false)),field('Подпись Y',v.yLabel,x=>change(o=>o.yLabel=x,false)),field('Цвет',v.color,x=>change(o=>o.color=x,false),'color'));
 for(const [k,label] of Object.entries(v.demo.kind==='decay'?{n0:'Начальное число ядер',halfLife:'Период полураспада, с'}:{halfLayer:'Толщина слоя (усл. ед.)'}))box.append(field(label,v.demo.params[k],x=>change(o=>o.demo.params[k]=x,false),'number',{step:'any'}));
 return box;
}
function diagramEditor(v,change){
 const wrap=elem('div',{class:'editor'}),sel=elem('select',{'aria-label':'Объект схемы'});
 for(const s of v.shapes)sel.append(elem('option',{value:s.id,text:s.kind+' · '+(s.text??s.id)}));
 const panel=elem('div',{class:'fields'});
 function populate(){panel.replaceChildren();const s=v.shapes.find(a=>a.id===sel.value);if(!s)return;
  const f=(k,label,type='number')=>field(label,s[k],x=>change(o=>o.shapes.find(a=>a.id===s.id)[k]=x,false)?(s[k]=x,true):false,type,type==='number'?{step:'any'}:{});
  panel.append(f('x','X'),f('y','Y'),f('color','Цвет','color'));
  if(s.kind==='rect')panel.append(f('w','Ширина'),f('h','Высота'));
  if(s.kind==='circle')panel.append(f('r','Радиус'));
  if(s.kind==='line')panel.append(f('x2','X₂'),f('y2','Y₂'),f('width','Толщина'));
  if(s.kind==='text')panel.append(f('text','Текст','text'),f('size','Размер'));
  panel.append(btn('Удалить объект',()=>change(o=>o.shapes=o.shapes.filter(a=>a.id!==s.id))));
 }
 sel.addEventListener('change',populate);wrap.append(sel,panel);
 const add=elem('div',{class:'actions'});
 for(const [k,t,extra] of [['rect','Прямоугольник',{w:100,h:60}],['circle','Круг',{r:20}],['line','Линия',{x2:220,y2:150,width:2,arrow:false}],['text','Надпись',{text:'Подпись',size:20,align:'start'}]])add.append(btn('+ '+t,()=>change(o=>o.shapes.push({id:uid(),kind:k,x:100,y:100,color:QL2_COLORS.ink,...extra}))));
 wrap.append(add);populate();return wrap;
}
function visualCard(scene,v){
 const card=elem('article',{class:'visual','data-visual':v.id}),title=elem('h4',{text:v.title}),preview=elem('div',{class:'picture'}),caption=note(v.caption);
 let progress=v.kind==='graph'?v.progress:0,raf=0;
 function current(){return project.scenes.find(s=>s.id===scene.id).visuals.find(o=>o.id===v.id);}
 function draw(){preview.innerHTML=ql2Svg(current(),progress);}
 function change(fn,refresh=true){const ok=edit(p=>fn(p.scenes.find(s=>s.id===scene.id).visuals.find(o=>o.id===v.id)),refresh);if(ok&&!refresh){title.textContent=current().title;caption.textContent=current().caption;draw();}return ok;}
 const tools=elem('div',{class:'actions'},btn('SVG',()=>saveBlob(svgBlob(current(),progress),safe(current().title)+'.svg')),btn('PNG',()=>png(current(),progress).catch(e=>say(e.message))),btn('Удалить рисунок',()=>{if(confirm('Удалить иллюстрацию?'))edit(p=>{const s=p.scenes.find(x=>x.id===scene.id);s.visuals=s.visuals.filter(x=>x.id!==v.id);});}));
 const props=elem('details',{class:'properties'},elem('summary',{text:'Редактировать иллюстрацию'}),field('Название',v.title,x=>change(o=>o.title=x,false)),field('Пояснение',v.caption,x=>change(o=>o.caption=x,false),'textarea'));
 props.append(v.kind==='graph'?graphEditor(v,change,draw):diagramEditor(v,change));
 if(v.kind==='diagram'){preview.addEventListener('click',e=>{const g=e.target.closest('[data-shape]');if(!g)return;props.open=true;const sel=props.querySelector('select');sel.value=g.dataset.shape;sel.dispatchEvent(new Event('change'));});preview.classList.add('editable-picture');}
 card.append(title,preview,caption,tools);
 if(v.kind==='graph'){
  const range=elem('input',{type:'range',min:0,max:1,step:.005,'aria-label':'Положение на графике'});range.value=progress;
  const stop=()=>{cancelAnimationFrame(raf);raf=0;};
  range.addEventListener('input',()=>{stop();progress=Number(range.value);draw();});
  range.addEventListener('change',()=>change(o=>o.progress=progress,false));
  const exportClip=btn('Скачать WebM (6 с)',async()=>{exportClip.disabled=true;say('Экспорт отдельной демонстрации…');try{await webm(structuredClone(current()));say('WebM передан браузеру для скачивания.');}catch(e){say(e.message);}finally{exportClip.disabled=false;}});
  card.append(elem('div',{class:'actions'},exportClip,btn('Воспроизвести',()=>{stop();const start=performance.now();progress=0;const tick=now=>{if(!card.isConnected)return;progress=Math.min(1,(now-start)/6000);range.value=progress;draw();if(progress<1)raf=requestAnimationFrame(tick);else{raf=0;change(o=>o.progress=progress,false);}};raf=requestAnimationFrame(tick);}),btn('Пауза',()=>{stop();change(o=>o.progress=progress,false);}),btn('Сброс',()=>{stop();progress=0;range.value=0;change(o=>o.progress=0,false);}),range));
 }
 card.append(props);draw();return card;
}
function newScene(){return {id:uid(),title:'Новый раздел',durationSec:60,narration:'Текст раздела',board:[],figures:[],visuals:[]};}
function render(){
 $('mode').value=project.mode;$('project-title').value=project.title;root.replaceChildren();const times=ql2Timeline(project);
 project.scenes.forEach((s,i)=>{
  const time=times[i],block=elem('details',{class:'scene','data-scene':s.id});block.open=project.mode==='lecture'||open.has(s.id);
  block.addEventListener('toggle',()=>{if(block.isConnected&&project.mode==='script'){if(block.open)open.add(s.id);else open.delete(s.id);}});
  const summary=elem('summary',{},elem('span',{class:'time',text:project.mode==='script'?fmt(time.start)+' — '+fmt(time.end):String(i+1).padStart(2,'0')}),elem('strong',{text:s.title}));
  const body=elem('div',{class:'scene-body'}),mut=(fn,refresh=true)=>edit(p=>fn(p.scenes.find(x=>x.id===s.id)),refresh);
  body.append(elem('div',{class:'fields'},field('Подзаголовок',s.title,x=>mut(o=>o.title=x)),project.mode==='script'?field('Длительность блока, с',s.durationSec,x=>mut(o=>o.durationSec=x),'number',{min:1,max:7200,step:1}):null));
  body.append(field(project.mode==='script'?'Текст озвучки':'Текст лекции',s.narration,x=>mut(o=>o.narration=x,false),'textarea'));
  body.append(field('На доске / формулы (по строкам)',s.board.join('\n'),x=>mut(o=>o.board=x.split('\n').filter(a=>a.trim()),false),'textarea'));
  const actions=elem('div',{class:'actions'},btn('Выше',()=>{if(i>0)edit(p=>{[p.scenes[i-1],p.scenes[i]]=[p.scenes[i],p.scenes[i-1]];});}),btn('Ниже',()=>{if(i<project.scenes.length-1)edit(p=>{[p.scenes[i+1],p.scenes[i]]=[p.scenes[i],p.scenes[i+1]];});}),btn('Удалить блок',()=>{if(project.scenes.length>1&&confirm('Удалить блок?'))edit(p=>p.scenes.splice(i,1));}));
  body.append(actions,elem('h3',{text:'Иллюстрации и демонстрации'}));
  for(const v of s.visuals)body.append(visualCard(s,v));
  const missing=s.figures.filter(f=>!s.visuals.some(v=>v.title===f));if(missing.length){const plan=elem('details',{},elem('summary',{text:'Исходный план иллюстраций (справка)'}));for(const f of s.figures)plan.append(note(f));body.append(plan);}
  body.append(elem('div',{class:'actions'},btn('+ Схема',()=>mut(o=>o.visuals.push({id:uid(),kind:'diagram',title:'Новая схема',caption:'',shapes:[]}))),btn('+ График распада',()=>mut(o=>o.visuals.push(ql2Graph(uid(),'График распада',{kind:'decay',params:{n0:64,halfLife:10}})))),btn('+ График ослабления',()=>mut(o=>o.visuals.push(ql2Graph(uid(),'График ослабления',{kind:'attenuation',params:{halfLayer:1}}))))));
  block.append(summary,body);root.append(block);
 });$('total').textContent=project.mode==='script'?'План: '+fmt(times.at(-1).end)+' · '+project.scenes.length+' блоков':project.scenes.length+' разделов';
}
$('mode').addEventListener('change',e=>edit(p=>p.mode=e.target.value));
$('project-title').addEventListener('change',e=>edit(p=>p.title=e.target.value));
$('add').addEventListener('click',()=>{const s=newScene();open.add(s.id);edit(p=>p.scenes.push(s));});
$('save').addEventListener('click',()=>{try{saveBlob(new Blob([ql2Serialize(project)],{type:'application/json'}),safe(project.title)+'.qlecture');say('Файл передан браузеру для скачивания. Проверьте сохранение.');}catch(e){say(e.message);}});
$('load').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>16000000)throw Error('Файл слишком большой');const v=ql2Parse(await f.text());if(dirty&&!confirm('Заменить текущий проект? Несохранённые изменения будут потеряны.'))return;project=v;dirty=false;open=new Set([v.scenes[0].id]);render();say('Проект открыт.');}catch(err){say(err.message);}finally{e.target.value='';}});
$('example').addEventListener('click',()=>{if(dirty&&!confirm('Заменить текущий проект?'))return;project=structuredClone(QL2_RADIATION);dirty=false;open=new Set(['intro']);render();say('Пример открыт.');});
$('new').addEventListener('click',()=>{if(dirty&&!confirm('Заменить текущий проект?'))return;const s=newScene();project=ql2Validate({format:'QLECTURE',version:2,mode:project.mode,title:'Новый материал',subject:'Физика',audience:'Школьники',scenes:[s]});dirty=true;open=new Set([s.id]);render();say('Новый проект. Сохраните QLECTURE.');});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
render();
