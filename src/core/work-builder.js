/* TASK144: standalone mathematics/physics workbench, reusing Office shell/symbols. */
const QW_KEY='quantum-office.work-builder.v1',QW_BANK_KEY='quantum-office.work-bank.v1',
 QW_BANK_NUMBER_KEY='quantum-office.work-bank.number-sequence.v1';
let qwDoc=qwProject(),qwSelected='',qwLeft=false,qwRight=false,qwStorageError='',qwCorrupt='',qwUndo=[],qwRedo=[],qwExported='',qwBusy=false,qwRecentWork=null,qwWorkZoom={percent:100,fit:''};
qwDoc.layout='compact';
try{const raw=localStorage.getItem(QW_KEY);if(raw)try{qwDoc=qwValidate(JSON.parse(raw));}catch(e){qwCorrupt=raw;qwStorageError='Не удалось открыть черновик. Скачайте исходные данные.';}}catch(e){qwStorageError='Хранилище недоступно. Сохраняйте QWORK.';}

// TASK167.3: view preferences only; never include these in QWORK/QWBANK.
const QW_PANELS_KEY='quantum-office.education-panels.v1';
const qwPanelDefaults={work:{left:228,right:260,hideLeft:false,hideRight:false},visual:{left:254,right:278,hideLeft:false,hideRight:false},pdf:{left:254,hideLeft:false},diagnostics:{left:208,right:260,hideLeft:false,hideRight:false},bank:{left:208,right:350,hideLeft:false,hideRight:false},bankEdit:{right:282,hideRight:false}};
function qwPanelPreference(key){let saved={};try{saved=JSON.parse(localStorage.getItem(QW_PANELS_KEY)||'{}')[key]||{};}catch{}const result={...qwPanelDefaults[key]};for(const side of ['left','right'])if(side in result){const n=saved[side];if(typeof n==='number'&&Number.isFinite(n))result[side]=Math.max(180,Math.min(440,n));result[side==='left'?'hideLeft':'hideRight']=saved[side==='left'?'hideLeft':'hideRight']===true;}return result;}
function qwSavePanelPreference(key,value){
 try{
  const all=JSON.parse(localStorage.getItem(QW_PANELS_KEY)||'{}');
  if(!all||typeof all!=='object'||Array.isArray(all))throw Error('Некорректные сохранённые настройки панелей');
  all[key]=value;localStorage.setItem(QW_PANELS_KEY,JSON.stringify(all));return true;
 }catch(error){
  // Async native failures are reported by the durable storage retry/recovery UI.
  console.warn('Настройки панелей не записаны:',error);
  status('Не удалось сохранить настройки панелей. Изменения действуют до закрытия рабочей области.',true);return false;
 }
}
function qwInstallPanels(root,key,toolbar,panels){
 if(!root||!toolbar)return;let pref=qwPanelPreference(key);
 root.dataset.qwPanelKind=key;root.classList.add('qw-dock-layout');
 const tools=document.createElement('div');tools.className='qw-dock-controls';toolbar.append(tools);
 const entries=Object.entries(panels).map(([side,[selector,label,direction=side==='left'?1:-1]])=>{
  const panel=root.querySelector(selector),button=document.createElement('button'),handle=document.createElement('div');
  button.type='button';button.dataset.qwDockToggle=side;button.textContent=label;button.setAttribute('aria-controls',panel.id||(panel.id='qw-dock-'+key+'-'+side));
  handle.className='qw-dock-divider qw-dock-'+side;handle.dataset.qwDockResize=side;handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-label','Ширина: '+label);handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-valuemin','180');handle.setAttribute('aria-valuemax','440');handle.setAttribute('aria-controls',panel.id);
  tools.append(button);root.append(handle);
  const hide=side==='left'?'hideLeft':'hideRight';
  button.onclick=()=>{pref[hide]=!pref[hide];apply();qwSavePanelPreference(key,pref);};
  const resize=n=>{pref[side]=Math.round(Math.max(180,Math.min(440,n)));apply();};
  handle.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();resize(e.key==='Home'?180:e.key==='End'?440:panel.getBoundingClientRect().width+(e.key==='ArrowRight'?1:-1)*direction*(e.shiftKey?32:8));qwSavePanelPreference(key,pref);});
  let start=null;
  handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();start={x:e.clientX,w:panel.getBoundingClientRect().width};handle.setPointerCapture(e.pointerId);});
  handle.addEventListener('pointermove',e=>{if(start)resize(start.w+(e.clientX-start.x)*direction);});
  const finish=()=>{if(start){start=null;qwSavePanelPreference(key,pref);}};
  handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);handle.addEventListener('lostpointercapture',finish);
  return{side,hide,button,handle};
 });
 const reset=document.createElement('button');reset.type='button';reset.dataset.qwDockReset=key;reset.textContent='Сброс панелей';reset.onclick=()=>{pref={...qwPanelDefaults[key]};apply();qwSavePanelPreference(key,pref);};tools.append(reset);
 function apply(){for(const {side,hide,button,handle} of entries){root.style.setProperty('--qw-dock-'+side,pref[side]+'px');root.classList.toggle('qw-dock-hide-'+side,pref[hide]);button.setAttribute('aria-expanded',String(!pref[hide]));handle.setAttribute('aria-valuenow',String(pref[side]));handle.hidden=pref[hide];}}
 apply();
}
// An internal mode occupies the same shell body; no modal top layer, no second route.
// Keep the underlying document DOM mounted (including scroll and selection).
function qwReleaseMode(d){const host=d?.closest('.qw-mode-host');if(!host)return;const body=host.parentElement;if(!body)return;host.remove();body.classList.remove('qw-mode-active');for(const el of body.children){el.inert=false;}if(host.qwReturnScroll!==undefined){const center=body.querySelector('.qw-center');if(center)center.scrollTop=host.qwReturnScroll;}}
// Local child cancellation and global abandonment are different decisions.
function qwActiveEditorDirty(){const d=document.getElementById('qw-dialog')||document.getElementById('qw-task-editor');return !!(d?.qwDirty?.()||d?.qwParentDirty?.());}
function qwCanNavigate(){const d=document.getElementById('qw-dialog')||document.getElementById('qw-task-editor');if(d?.qwParentDirty?.())return confirm('Отменить несохранённые изменения задания и рисунка?');return !d?.qwCanLeave||d.qwCanLeave();}
globalThis.qoCanCloseEditors=qwCanNavigate;
if(typeof window!=='undefined')window.addEventListener('beforeunload',e=>{if(!globalThis.__TAURI__&&qwActiveEditorDirty()){e.preventDefault();e.returnValue='';}});
function qwEnsureEducationMode(){if(!document.querySelector('.qo-education-workspace>.qo-education-body'))route('work');return !!document.querySelector('.qo-education-workspace>.qo-education-body');}
function qwOpenMode(d,mode){
 const body=document.querySelector('.qo-education-workspace>.qo-education-body');if(!body)throw Error('Рабочая область недоступна');
 const host=document.createElement('section');host.className='qw-mode-host';host.dataset.qwMode=mode;host.setAttribute('aria-label',d.querySelector('header strong').textContent);
 host.qwReturnScroll=body.querySelector('.qw-center')?.scrollTop;for(const el of body.children)el.inert=true;body.classList.add('qw-mode-active');body.append(host);host.append(d);d.classList.add('qw-workspace-mode');
 d.querySelector('[data-qw-close]').setAttribute('aria-label','Вернуться');d.querySelector('[data-qw-close]').title='Вернуться';
 const close=d.close.bind(d),remove=d.remove.bind(d);d.close=(...args)=>{close(...args);qwReleaseMode(d);};d.remove=()=>{qwReleaseMode(d);remove();};
 const leave=()=>{if(!d.qwCanLeave||d.qwCanLeave())d.close();};
 d.querySelector('[data-qw-close]').onclick=leave;
 d.addEventListener('keydown',e=>{if(e.key==='Escape')queueMicrotask(()=>{if(!e.defaultPrevented&&d.isConnected&&d.open)leave();});});
 d.show();
}

function qwFocusCondition(surface){const start={path:[],offset:0};qwLiveRestore(surface,[start,start]);}
function qwCurrent(){return qwDoc.tasks.find(q=>q.id===qwSelected)||null;}
function qwActive(){return typeof page!=='undefined'&&page==='work';}
function qwRemember(){const value=JSON.stringify(qwDoc);if(qwUndo.at(-1)!==value)qwUndo.push(value);qwUndo=qwUndo.slice(-20);qwRedo=[];}
function qwPersist(){
 if(qwCorrupt)return false;
 try{localStorage.setItem(QW_KEY,JSON.stringify(qwDoc));qwStorageError='';}catch(e){qwStorageError='Черновик не записан. Скачайте QWORK.';}
 if(typeof page!=='undefined')qwFooter(qwActive());
 const el=document.getElementById('qw-save-state');if(el)el.textContent=qwStorageError|| (qoNativeDesktop&&globalThis.qoDraftStatus?(globalThis.qoDraftStatusSummary?.()||globalThis.qoDraftStatus()):qwExported===JSON.stringify(qwDoc)?(qoNativeDesktop?'Экспортирован QWORK':'Скачивание QWORK запрошено'):'Черновик на устройстве');return !qwStorageError;
}
function qwChange(fn){qwRemember();fn();qwPersist();qwRender();}
function qwButton(action,label,extra=''){return '<button type="button" data-qw-action="'+action+'" '+extra+'>'+label+'</button>';}
function qwOptions(values,current){return values.map(([k,v])=>'<option value="'+qwEsc(k)+'" '+(String(k)===String(current)?'selected':'')+'>'+qwEsc(v)+'</option>').join('');}
function qwField(key,label,value,type='text',extra=''){return '<label>'+label+'<input data-qw-field="'+key+'" type="'+type+'" value="'+qwEsc(value)+'" '+extra+'></label>';}
function qwSelect(key,label,values,value){return '<label>'+label+'<select data-qw-field="'+key+'">'+qwOptions(values,value)+'</select></label>';}
function qwCheck(key,label,on){return '<label class="qw-check"><input type="checkbox" data-qw-field="'+key+'" '+(on?'checked':'')+'>'+label+'</label>';}
function qwQuickButtons(){return '<div class="qw-quick-add" aria-label="Добавить задание">'+[['short','Краткий ответ','line'],['extended','Развёрнутый ответ','text'],['test','Тест','rect'],['diagram','Рисунок / схема','triangle'],['graph','График','quadratic'],['text','Текстовое задание','text']].map(([type,title,icon])=>qwButton('quick-add',qwVisualIcon(icon)+'<span>'+title+'</span>','data-type="'+type+'"')).join('')+'</div>';}
function qwTaskSummary(value){
 return String(value||'').slice(0,1600)
  .replace(/^\s{0,3}(?:>[ \t]?)+/gm,'')
  .replace(/^[ \t]*::format [^\r\n]*(?:\r?\n|$)/gm,'')
  .replace(/^[ \t]*\[\![a-z]+(?: [^\]\r\n]*)?\][ \t]*/gm,'')
  .replace(/\[\[(?:style [^\]\r\n]{1,180}|\/style)\]\]/g,'')
  .replace(/^[ \t]*(?:#{1,4}|::(?:left|center|right|justify))\s+/gm,'')
  .replace(/\\\((.*?)\\\)|\$([^$\n]{1,600})\$/g,(_,explicit,dollar)=>{
   const formula=explicit??dollar;return /[\\{}]/.test(formula)?'…':formula;
  })
  .replace(/(\*\*|__|~~|\+\+|\x60)([^\n]+?)\1/g,'$2')
  .replace(/(^|[\s(])([*_])([^*_\n]+)\2/g,'$1$3')
  .replace(/\s+/g,' ').trim().slice(0,185);
}
function qwTaskLabel(task){
 return task.title||qwTaskSummary(task.prompt)||(!task.answerVisible&&task.type==='short'?'Текстовое задание':QW_TYPES[task.type]);
}
function qwTaskNavigation(){return qwDoc.tasks.map((t,i)=>((!i||qwDoc.tasks[i-1].part!==t.part)?'<h3 data-task-part="'+qwEsc(t.part)+'" data-task-gap="'+i+'">'+qwEsc(t.part||'Без части')+'</h3>':'')+'<div class="qw-nav-row" data-task-row="'+i+'" data-task-id="'+qwEsc(t.id)+'"><button type="button" draggable="true" class="qw-task-drag" data-drag-id="'+qwEsc(t.id)+'" aria-label="Перетащить задание '+(i+1)+'" title="Перетащите для изменения порядка"><svg viewBox="0 0 12 20" aria-hidden="true"><path d="M4 4h0m4 0h0M4 10h0m4 0h0M4 16h0m4 0h0" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg></button><button type="button" class="qw-nav-task" data-qw-action="select" data-id="'+qwEsc(t.id)+'" aria-current="'+(t.id===qwSelected)+'" title="'+qwEsc(qwTaskLabel(t))+'"><b>'+(i+1)+'</b><span>'+qwEsc(qwTaskLabel(t))+'</span></button></div>').join('');}
function qwToolbar(){
 const tool=(action,title,icon)=>qoWorkButton(action,title,icon,'','qw-ribbon-icon');
 const group=buttons=>'<div class="qw-ribbon-group">'+buttons.join('')+'</div>';
 return group([tool('work-new','Создать работу','new'),tool('work-open','Открыть QWORK','folder'),tool('work-save','Сохранить QWORK','save')])+
  group([tool('work-preview','Предпросмотр A4','eye'),tool('work-pdf','Скачать PDF','download'),tool('work-answers','Скачать ответы PDF','file-text')])+
  group([tool('work-bank','Собрать работу из банка','folder')]);
}
function qwLayoutSelect(current){
 return '<label class="qw-pdf-format-field" id="qw-pdf-format"><span>Формат PDF</span><select name="qw-pdf-layout">'+qwFormatOptions(current)+'</select></label>';
}
function qwFigureLayoutControls(){
 const figures=qwDoc.tasks.filter(q=>q.figure!=='none'&&(q.figure!=='image'||q.image));
 if(!figures.length)return '';
 const q=figures.find(q=>q.id===qwSelected)||figures[0],manual=q.figureWidthMode==='manual';
 return '<section class="qw-figure-layout"><h3>Иллюстрация</h3><label class="qw-pdf-field"><span>Задание</span><select id="qw-layout-figure-task">'+qwOptions(figures.map(q=>[q.id,'№ '+(qwDoc.tasks.indexOf(q)+1)+' — '+({graph:'График',diagram:'Схема',image:'Изображение'}[q.figure])]),q.id)+'</select></label>'+
 '<label class="qw-pdf-field"><span>Размер</span><select id="qw-layout-figure-mode">'+qwOptions([['auto','Автоматически'],['manual','Вручную']],manual?'manual':'auto')+'</select></label>'+
 '<label class="qw-pdf-field"><span>Ширина, мм</span><input id="qw-layout-figure-width" type="number" min="31.75" max="124.35" step="any" value="'+(q.figureWidth*25.4/96).toFixed(2)+'" '+(manual?'':'disabled')+'></label>'+
 '<button type="button" id="qw-layout-figure-reset" '+(manual?'':'disabled')+'>Автоматический размер</button><output id="qw-layout-figure-effective" aria-live="polite"></output></section>';
}
const QW_PUBLISH_SECTIONS={prompt:'Условие',comment:'Решение',answer:'Ответ',criteria:'Критерии'};
function qwPublishObjects(task){
 const objects=[];
 if(task.figure!=='none'&&(task.figure!=='image'||task.image))objects.push({id:'figure',kind:'figure',label:{graph:'График',diagram:'Схема',image:'Изображение'}[task.figure]});
 for(const [field,name] of Object.entries(QW_PUBLISH_SECTIONS)){
  if(!task[field]?.includes('|'))continue;
  const template=document.createElement('template');template.innerHTML=qwPrintFieldHTML(task[field]);
  [...template.content.querySelectorAll('table')].slice(0,40).forEach((table,index)=>objects.push({id:field+':'+index,kind:'table',field,index,columns:table.rows[0].cells.length,label:name+' · таблица '+(index+1)}));
 }
 return objects;
}
function qwPublishInspector(){
 return '<section class="qw-publish-inspector" data-qw-publish><h3>Объекты задания</h3><label data-publish-task-label>Задание<select data-publish-task></select></label>'+
  '<label>Объект<select data-publish-object></select></label><div class="qw-design-fields" data-publish-fields></div><p data-publish-message role="status" hidden></p></section>';
}
function qwBindPublishInspector(host,getTasks,onApply,selectedTask=()=>null){
 const taskPicker=host.querySelector('[data-publish-task]'),objectPicker=host.querySelector('[data-publish-object]'),fields=host.querySelector('[data-publish-fields]'),message=host.querySelector('[data-publish-message]');
 let tasks=[],objects=[];
 const selected=()=>tasks.find(task=>task.id===taskPicker.value);
 const current=()=>objects.find(object=>object.id===objectPicker.value);
 const warning=text=>{message.textContent=text;message.hidden=!text;};
 const styleOf=(task,object)=>object.kind==='figure'?task.publishing?.figure:task.publishing?.tables?.[object.field]?.[object.index];
 const field=(name,caption,control)=>'<label class="qw-pdf-field"><span>'+caption+'</span>'+control.replace(' DATA',' data-style-field="'+name+'"')+'</label>';
 const number=(name,caption,value,min,max,step=1)=>field(name,caption,'<input DATA type="number" min="'+min+'" max="'+max+'" step="'+step+'" value="'+value+'">');
 const choice=(name,caption,value,options)=>field(name,caption,'<select DATA>'+qwOptions(options,value)+'</select>');
 function showFields(){
  const task=selected(),object=current();warning('');
  if(!object){fields.innerHTML='';return;}
  const settings=qwPublishStyle(styleOf(task,object)??{},object.kind),figure=object.kind==='figure';
  const align=[['left','Слева'],['center','По центру'],['right','Справа']];
  fields.innerHTML=(figure?
   number('width','Ширина, %',settings.width,15,100)+number('maxMm','Максимум, мм',settings.maxMm,20,190)+
   choice('position','Размещение',settings.position,[['auto','Автоматически'],['right','Справа'],['below','Под условием']])+
   choice('align','Выравнивание рисунка под условием',settings.align,align)+number('gapMm','Внешний отступ, мм',settings.gapMm,0,8,.5):
   number('width','Ширина, % (0 — по содержимому)',settings.width,0,100)+
   field('columns','Доли столбцов через пробел','<input DATA type="text" inputmode="numeric" maxlength="48" value="'+settings.columns.join(' ')+'" placeholder="Автоматически">')+
   choice('align','Выравнивание ячеек',settings.align,align)+number('fontPt','Шрифт, пт',settings.fontPt,7,14,.5)+
   number('padMm','Отступ в ячейках, мм',settings.padMm,0,4,.25)+number('borderPt','Границы, пт',settings.borderPt,.25,2,.25)+
   choice('header','Заголовочная строка',settings.header,[['plain','Обычная'],['bold','Жирный текст'],['shade','Жирный текст с заливкой']]))+
   '<button type="button" data-publish-reset>Сбросить оформление</button>';
 }
 function chooseObjects(){
  const task=selected(),previous=objectPicker.value;objects=task?qwPublishObjects(task):[];
  objectPicker.innerHTML=qwOptions(objects.length?objects.map(o=>[o.id,o.label]):[['','Нет иллюстраций и таблиц']],previous);
  objectPicker.disabled=!objects.length;showFields();
 }
 function sync(){
  const previous=taskPicker.value||selectedTask();tasks=getTasks();
  taskPicker.innerHTML=qwOptions(tasks.map((task,index)=>[task.id,'№ '+(index+1)+(task.title?' · '+task.title:'')]),previous);
  host.querySelector('[data-publish-task-label]').hidden=tasks.length<=1;chooseObjects();
 }
 function apply(reset=false){
  const task=selected(),object=current();if(!task||!object)return;
  try{
   let style=null;
   if(!reset){
    const values={};
    for(const input of fields.querySelectorAll('[data-style-field]')){
     if(input.type==='number'&&(!input.value||!input.checkValidity()))return;
     values[input.dataset.styleField]=input.type==='number'?input.valueAsNumber:input.value;
    }
    if(typeof values.columns==='string'){
     values.columns=values.columns.trim()?values.columns.trim().split(/\s+/).map(Number):[];
     if(values.columns.length&&values.columns.length!==object.columns)throw Error('Укажите '+object.columns+' долей или оставьте поле пустым для автоширины');
    }
    style=qwPublishStyle(values,object.kind);
   }
   const publishing=structuredClone(task.publishing||{});
   if(object.kind==='figure'){if(style)publishing.figure=style;else delete publishing.figure;}
   else{
    publishing.tables??={};const table=publishing.tables[object.field]??=[];
    while(table.length<=object.index)table.push(null);
    table[object.index]=style;
   }
   const normalized=qwPublishSettings(publishing);
   if(JSON.stringify(normalized)!==JSON.stringify(task.publishing||{}))onApply(task,normalized);
   warning('');if(reset)showFields();
  }catch(error){warning(error.message);}
 }
 taskPicker.onchange=chooseObjects;objectPicker.onchange=showFields;
 fields.addEventListener('input',e=>{if(e.target.type==='number'||e.target.tagName==='SELECT')apply();});
 fields.addEventListener('change',()=>apply());
 fields.addEventListener('click',e=>{if(e.target.closest('[data-publish-reset]'))apply(true);});
 sync();return sync;
}
function qwUsePublishing(task,publishing){
 if(Object.keys(publishing).length)task.publishing=publishing;else delete task.publishing;
}
const QW_ZOOM_STEPS=[50,75,100,125,150,175,200];
function qwPublishZoomControls(){
 return '<div class="qw-zoom" role="group" aria-label="Масштаб просмотра">'+
  '<button type="button" data-zoom-step="-1" title="Уменьшить масштаб" aria-label="Уменьшить масштаб">−</button>'+
  '<select data-publish-zoom aria-label="Масштаб">'+qwOptions(QW_ZOOM_STEPS.map(n=>[n,n+'%']),100)+'</select>'+
  '<button type="button" data-zoom-step="1" title="Увеличить масштаб" aria-label="Увеличить масштаб">+</button>'+
  '<button type="button" data-publish-fit="width" aria-pressed="false">По ширине</button>'+
  '<button type="button" data-publish-fit="page" aria-pressed="false">Целая страница</button></div>';
}
function qwBindZoom(control,state,viewports,measure,paint){
 const select=control.querySelector('select'),steps=[...control.querySelectorAll('[data-zoom-step]')],
  modes=[...control.querySelectorAll('[data-publish-fit]')];
 const apply=()=>{
  const geometry=measure();
  if(state.fit&&geometry?.width&&geometry.view.clientWidth){
   const across=(geometry.view.clientWidth-8)/geometry.width;
   const down=(geometry.view.clientHeight-16)/geometry.height;
   state.percent=Math.max(50,Math.min(200,Math.floor(100*Math.min(across,state.fit==='page'?down:2))));
  }
  select.querySelector('[data-zoom-computed]')?.remove();
  if(!QW_ZOOM_STEPS.includes(state.percent)){
   const option=new Option(state.percent+'%',state.percent);option.dataset.zoomComputed='';select.add(option);
  }
  select.value=state.percent;
  steps[0].disabled=state.percent<=50;steps[1].disabled=state.percent>=200;
  for(const button of modes)button.setAttribute('aria-pressed',String(button.dataset.publishFit===state.fit));
  paint(state.percent/100);
 };
 const set=percent=>{state.percent=percent;state.fit='';apply();};
 select.onchange=()=>set(Number(select.value));
 steps[0].onclick=()=>set(QW_ZOOM_STEPS.findLast(n=>n<state.percent)??50);
 steps[1].onclick=()=>set(QW_ZOOM_STEPS.find(n=>n>state.percent)??200);
 for(const button of modes)button.onclick=()=>{state.fit=button.dataset.publishFit;apply();};
 const resize=new ResizeObserver(()=>{if(control.isConnected)apply();else resize.disconnect();});
 viewports.forEach(view=>resize.observe(view));
 apply();return apply;
}
function qwFrameZoomGeometry(frame){
 const doc=frame.contentDocument,sheet=doc?.querySelector('.qw-print-document>:is(.qw-print-sheet,.qw-print-page)');
 if(!sheet)return null;
 const width=sheet.offsetWidth+24, height=sheet.offsetHeight;
 const tail=sheet.parentElement.lastElementChild.getBoundingClientRect().bottom-doc.body.getBoundingClientRect().top;
 frame.style.width=width+'px';frame.style.height=(Math.ceil(tail)+12)+'px';
 return {view:frame.parentElement,width,height};
}
function qwBindPublishZoom(host,frame){
 return qwBindZoom(host.querySelector('.qw-zoom'),{percent:100,fit:''},[frame.parentElement],
  ()=>qwFrameZoomGeometry(frame),scale=>{frame.style.zoom=scale;});
}
function qwStudyFigureHTML(q,printing=false){
 const visual=q.figure==='graph'?qwGraphSVG(q.graph,false,{publishing:true,...(printing?{axisFont:21,titleFont:22}:{})}):q.figure==='diagram'?qwDiagramSVG(q.diagram):q.figure==='image'&&q.image?'<img alt="Иллюстрация задания" src="'+q.image+'">':'';
 const settings=q.publishing?.figure,legacy=Math.min(q.figureWidth,470);
 const attributes=settings?' data-publish-width="'+settings.width+'" data-publish-max="'+settings.maxMm+'" data-publish-align="'+settings.align+'" data-publish-gap="'+settings.gapMm+'"':'';
 const width=settings?'min('+settings.width+'cqw,'+settings.maxMm+'mm)':legacy+'px';
 return visual?'<figure data-figure-kind="'+q.figure+'" data-requested-width="'+legacy+'" data-width-mode="'+(q.figureWidthMode==='manual'?'manual':'auto')+'"'+attributes+' style="width:'+width+(settings?';--qw-figure-gap:'+settings.gapMm+'mm':'')+'">'+visual+'</figure>':'';
}
function qwPublishedFieldHTML(q,field,renderer=qwPrintFieldHTML){
 const html=renderer(q[field]||''),settings=q.publishing?.tables?.[field];
 const style=qwTextStyleAttrs(q.publishing?.text,true);
 const decorate=markup=>style?'<div class="qw-format-block"'+style+'>'+markup+'</div>':markup;
 if(!settings?.length)return decorate(html);
 const template=document.createElement('template');template.innerHTML=html;
 qwStylePublishedTables(template.content,settings);
 return decorate(template.innerHTML);
}
function qwStylePublishedTables(scope,settings){
 if(!settings?.length)return;
 [...scope.querySelectorAll('table')].forEach((table,index)=>{
  const style=settings[index];if(!style)return;
  const values={'--qw-table-font':style.fontPt+'pt','--qw-table-pad':style.padMm+'mm','--qw-table-border':style.borderPt+'pt','--qw-table-align':style.align};
  for(const [key,value] of Object.entries(values))table.style.setProperty(key,value);
  if(style.width){table.style.width=style.width+'%';table.parentElement.dataset.publishFluid='';}
  table.dataset.publishHeader=style.header;
  if(style.columns.length===table.rows[0]?.cells.length){
   const group=document.createElement('colgroup'),total=style.columns.reduce((sum,n)=>sum+n,0);
   for(const width of style.columns){const col=document.createElement('col');col.style.width=width/total*100+'%';group.append(col);}
   table.prepend(group);
   if(style.width)table.style.tableLayout='fixed';
  }
 });
}
function qwStudyFonts(){
 if(qoNativeDesktop||document.getElementById('qw-study-fonts'))return;
 const style=document.createElement('style');style.id='qw-study-fonts';style.textContent=QW_PRINT_FONT_CSS+QW_MATH_FONT_CSS;
 document.head.append(style);
}
function qwStudySolution(q){
 const solutionTitle=/(^|\n)\s*#{1,4}\s*Решение(?=\s|$)/i.test(q.comment||'')?'':'<h3>Решение</h3>';
 const field=(key,placeholder)=>q[key]?.trim()?qwPublishedFieldHTML(q,key):'<p>'+placeholder+'</p>';
 return '<details class="qw-bank-solution"><summary>Ответ и решение</summary><div class="qw-bank-solution-body qw-rich">'+
  '<section>'+solutionTitle+field('comment','Решение ещё не записано.')+'</section>'+
  '<section><h3>Ответ</h3>'+field('answer','Ответ не указан.')+'</section>'+
  '<section><h3>Критерии оценивания</h3>'+field('criteria','Критерии ещё не указаны.')+'</section></div></details>';
}
function qwConstructorStudyTask(q,index){
 return qwTaskPreview(q,index)+([q.comment,q.answer,q.criteria].some(value=>value?.trim())?qwStudySolution(q):'');
}
function qwPrintBankLabel(number){
 if(!qwBankNumber(number))return '';
 return '<span class="qw-booklet-bank-id qw-study-id" data-qw-bank-number="'+number+'">№ '+String(number).padStart(5,'0')+'.</span>';
}
function qwExamNumberHTML(index,bankNumber){
 const number=qwBankNumber(bankNumber);
 return '<b class="qw-task-number qw-print-number qw-exam-number-line"'+(number?' data-qw-bank-number="'+number+'"':'')+'>'+qwExamNumberText(index,number)+'</b>';
}
function qwTaskHeading(index,bankNumber,exam=false){
 return '<header class="qw-task-heading">'+(exam?qwExamNumberHTML(index,bankNumber):'<b class="qw-task-number qw-print-number qw-task-marker">'+(index+1)+'</b>'+qwPrintBankLabel(bankNumber))+'</header>';
}
function qwStudyTask(q,index,preferences,bankNumber,showWritingSpace,exam=false){
 qwStudyFonts();
 const rich=q.prompt?qwPublishedFieldHTML(q,'prompt',qwRichMarkdownHTML):'<p>Условие не заполнено</p>';
 const template=document.createElement('template');template.innerHTML=rich;
 const tables=[...template.content.querySelectorAll('.qw-rich-table-scroll')];
 tables.forEach(table=>table.remove());
 const figure=qwStudyFigureHTML(q);
 const settings=q.publishing?.figure;
 const position=settings?.position||(preferences?.figurePosition&&preferences.figurePosition!=='auto'?preferences.figurePosition:q.position);
 const placement=!figure?'none':position==='below'||position==='left'||tables.length||position==='auto'&&(settings?settings.width>46:q.figureWidth>300)?'below':'right';
 const permanent=bankNumber||(q.source?.kind==='external-bank'||exam&&q.source?.kind!=='bank'?0:q.source?.number);
 const answer=q.answerVisible?'<div class="qw-study-answer">Ответ: '+(q.answerStyle==='boxes'?
  '<span class="qw-study-boxes">'+Array.from({length:q.boxes},()=>'<i></i>').join('')+'</span>':
  '<span class="'+(q.answerStyle==='box'?'qw-study-box':'qw-study-line')+'"></span>')+'</div>':'';
 return '<article class="qw-paper-task qw-study-task qw-standard-task'+(exam?' qw-exam-publication':'')+'" data-qw-study-figure="'+placement+'">'+
  qwTaskHeading(Number.isInteger(index)?index:0,permanent,exam)+
  '<div class="qw-study-flow"><div class="qw-study-condition qw-study-text qw-task-text qw-rich">'+template.innerHTML+
  (q.type==='choice'?'<ol class="qw-choice-list">'+q.choices.map(c=>'<li>'+qwPrintFieldHTML(c)+'</li>').join('')+'</ol>':'')+'</div>'+
  figure+(tables.length?'<div class="qw-study-tables qw-study-text qw-rich">'+tables.map(table=>table.outerHTML).join('')+'</div>':'')+
  answer+'</div>'+(showWritingSpace&&q.solutionVisible?'<div aria-label="Место для решения" class="qw-solution-preview qw-solution-'+q.solutionStyle+'" style="height:'+q.solutionHeight+'px"></div>':'')+'</article>';
}
function qwTaskPreview(q,index=0,layout=qwDoc.layout,printing=false,preferences=null,rich=false,bankNumber=null,exam=false){
 if(!printing)return qwStudyTask(q,index,preferences||(rich?null:qwDoc.printSettings),bankNumber,!rich&&layout==='worksheet',!rich&&qwExamPublication(qwDoc,layout));
 const figure=qwStudyFigureHTML(q,true);
 const permanent=q.source?.kind==='bank'?qwBankNumber(q.source.number):0;
 const standardized=exam||layout==='booklet'||!!permanent;
 const richText=rich||qwHasRichSyntax(q.prompt||'');
 const format=richText?qwRichMarkdownHTML:qwContentHTML;
 const text='<div class="qw-task-text'+(richText?' qw-rich qw-print-rich':'')+'">'+(q.prompt?qwPublishedFieldHTML(q,'prompt',format):format('Условие не заполнено'))+(q.type==='choice'?'<ol class="qw-choice-list">'+q.choices.map(c=>'<li>'+qwPrintFieldHTML(c)+'</li>').join('')+'</ol>':'')+'</div>';
 const position=q.publishing?.figure?.position||(preferences?.figurePosition&&preferences.figurePosition!=='auto'?preferences.figurePosition:q.position);
 const flow='<div class="qw-task-flow qw-figure-'+(standardized&&position==='left'?'below':position)+'">'+text+figure+'</div>';
 const heading=standardized?qwTaskHeading(index,permanent,exam):'';
 if(layout==='booklet'||exam)return '<article class="qw-paper-task qw-compact-entry qw-booklet-entry qw-standard-task'+(exam?' qw-exam-publication':'')+'">'+heading+flow+
  (q.answerVisible?'<div class="qw-booklet-answer">Ответ: <span></span></div>':'')+'</article>';
 const standardClass=standardized?' qw-standard-task':'';
 if(layout==='compact'||layout==='practice')return '<article class="qw-paper-task qw-compact-entry'+standardClass+'">'+(heading||'<header><b class="qw-task-number qw-print-number">'+(index+1)+'.</b></header>')+flow+'</article>';
 if(layout==='exam')return standardized?'<article class="qw-paper-task qw-exam-task qw-standard-task">'+heading+flow+'</article>':'<article class="qw-paper-task qw-exam-task"><div class="qw-exam-grid"><b class="qw-exam-number qw-print-number">'+(index+1)+'.</b><div class="qw-exam-body">'+flow+'</div></div></article>';
 return '<article class="qw-paper-task qw-worksheet-task'+standardClass+'">'+(heading||'<header><b class="qw-print-number">'+(preferences?.numbering==='continuous'?(index+1)+'.':'Задание '+(index+1))+'</b></header>')+flow+
  (q.answerVisible?'<div class="qw-answer-preview">Ответ: '+(q.answerStyle==='boxes'?Array.from({length:q.boxes},()=>'<i></i>').join(''):q.answerStyle==='box'?'<i class="qw-answer-box"></i>':'<span></span>')+'</div>':'')+
  (q.solutionVisible?'<div class="qw-solution-preview qw-solution-'+q.solutionStyle+'" style="height:'+q.solutionHeight+'px"></div>':'')+'</article>';
}
function qwRender(){
 const host=document.getElementById('qo-work-root');if(!host)return;
 if(!qwDoc.tasks.some(q=>q.id===qwSelected))qwSelected=qwDoc.tasks[0]?.id||'';
 qwFooter(qwActive());
 const q=qwCurrent(),navScroll=host.querySelector('.qw-left')?.scrollTop||0;
 const actions=q?'<div class="qw-row qw-task-order">'+
  qwButton('up',qoWorkIcon('arrow-up'),'aria-label="Переместить выше" title="Переместить выше" '+(!qwDoc.tasks.indexOf(q)?'disabled':''))+
  qwButton('down',qoWorkIcon('arrow-down'),'aria-label="Переместить ниже" title="Переместить ниже" '+(qwDoc.tasks.indexOf(q)===qwDoc.tasks.length-1?'disabled':''))+
  qwButton('duplicate',qoWorkIcon('copy'),'aria-label="Копировать задание" title="Копировать задание"')+
  qwButton('delete',qoWorkIcon('trash-2'),'aria-label="Удалить задание" title="Удалить задание"')+'</div>':'';
 host.className='qw-frame qw-author-workspace'+(qwLeft?' qw-left-open':'')+(qwRight?' qw-right-open':'');
 host.innerHTML='<aside class="qw-left" aria-label="Структура работы">'+qwButton('close-panels','Закрыть','class="qw-drawer-close"')+
  '<header><strong>Задания</strong><span>'+qwDoc.tasks.length+' / 80</span></header>'+qwQuickButtons()+
  '<div class="qw-row">'+qwButton('part',qoWorkIcon('plus')+'<span>Часть</span>')+'</div>'+
  '<nav aria-label="Порядок заданий">'+qwTaskNavigation()+'</nav>'+actions+
  '<div class="qw-row">'+qwButton('from-diag','Из диагностики')+'</div></aside>'+
  '<main class="qw-center"><div class="qw-center-head"><h1>'+qwEsc(qwDoc.title)+'</h1><div class="qw-row">'+
  qwButton('left','Задания','class="qw-mobile"')+qwButton('right','Свойства','class="qw-mobile"')+
  qwButton('settings',qoWorkIcon('settings')+'<span>Параметры</span>','title="Параметры работы"')+
  qwButton('undo',qoWorkIcon('undo'),'aria-label="Отменить изменение работы" title="Отменить изменение работы" '+(qwUndo.length?'':'disabled'))+
  qwButton('redo',qoWorkIcon('redo'),'aria-label="Повторить изменение работы" title="Повторить изменение работы" '+(qwRedo.length?'':'disabled'))+
  '<span id="qw-save-state" role="status">'+qwEsc(qwStorageError||(qoNativeDesktop&&globalThis.qoDraftStatus?(globalThis.qoDraftStatusSummary?.()||globalThis.qoDraftStatus()):'Черновик на устройстве'))+
  '</span></div></div>'+
  (qwCorrupt?'<div class="qw-error" role="alert">'+qwEsc(qwStorageError)+qwButton('recovery','Скачать исходные данные')+qwButton('new','Новая работа')+'</div>':'')+
  (q?'<div id="qw-work-task-mount"></div>':'<section class="qw-empty qw-start-work"><h2>'+(!qwDoc.tasks.length&&qwDoc.title==='Новая работа'?'Конструктор заданий':'Задания')+'</h2><div class="qw-row">'+
    qwButton('add',qoWorkIcon('plus')+'<span>Добавить задание</span>','class="qw-primary"')+qwButton('new','Создать работу')+qwButton('open','Открыть QWORK')+
    qwButton('bank','Собрать работу из банка')+(qwRecentWork?qwButton('recent','Открыть недавнюю работу','title="'+qwEsc(qwRecentWork.title)+'"'):'')+
    '</div>'+qwButton('example','Открыть демонстрационный пример','class="qw-example"')+'</section><aside class="qw-bank-edit-side qw-empty-work-side" hidden></aside>')+
  '</main><input type="file" id="qw-file" accept=".qwork,application/json" hidden>';
 if(q)qwTaskEditor({task:structuredClone(q)},{work:{id:q.id,mount:host.querySelector('#qw-work-task-mount')}});
 qwInstallPanels(host,'work',host.querySelector('.qw-center-head>.qw-row'),{left:['.qw-left','Задания'],right:['.qw-bank-edit-side','Свойства']});
 host.querySelector('.qw-left').scrollTop=navScroll;
}
// Remeasure the text at the actual live viewport, not only the detached
// SVG generation size. Keep viewBox and model positions stable on resize.
function qwRefreshLiveGraphText(scope){
 if(!scope)return;
 for(const svg of scope.querySelectorAll('svg:has(.qw-axis-title[data-axis-tip-x])'))if(svg.getCTM())qwAlignSVGText(svg);
}
function qwPreviewSelected(){const p=document.getElementById('qw-task-preview'),q=qwCurrent();if(p&&q){const open=p.querySelector('.qw-bank-solution')?.open;p.innerHTML=qwConstructorStudyTask(q,qwDoc.tasks.indexOf(q));const solution=p.querySelector('.qw-bank-solution');if(solution)solution.open=!!open;qwRefreshLiveGraphText(p);}const t=document.querySelector('.qw-nav-task[aria-current="true"] span');if(t&&q){const label=qwTaskLabel(q);t.textContent=label;t.parentElement.title=label;}}
function qwDialog(title,body,footer='',inline=false){const old=document.getElementById('qw-dialog');qwReleaseMode(old);old?.remove();const d=document.createElement('dialog');d.id='qw-dialog';d.className='qw-dialog';d.innerHTML='<header><strong>'+title+'</strong><button type="button" data-qw-close aria-label="Закрыть">'+qoWorkIcon('x')+'</button></header><div class="qw-dialog-body">'+body+'</div>'+(footer?'<footer>'+footer+'</footer>':'');d.addEventListener('close',()=>d.remove());d.querySelector('[data-qw-close]').onclick=()=>d.close();if(typeof inline==='string'){qwOpenMode(d,inline);}else if(inline){const host=document.getElementById('qo-bank-root');if(!host)throw Error('Bank workspace unavailable');d.classList.add('qw-bank-inline');host.append(d);d.show();d.querySelector('[data-qw-close]').onclick=()=>route(qoBankReturnPage);}else{document.body.append(d);d.showModal();}return d;}
function qwFormatOptions(current){return qwOptions([['booklet','Экзаменационный сборник'],['compact','Компактный сборник'],['practice','Лист для решения'],['worksheet','Обычная контрольная работа'],...(current==='exam'?[['exam','Прежний компактный макет (без проверки ФИПИ)']]:[])],current);}
function qwPracticeControls(settings={},attribute='data-practice'){
 return '<label>Задач на странице<select '+attribute+'="perPage">'+qwOptions([[1,'Одна'],[2,'Две'],[3,'Три'],[4,'Четыре']],settings.perPage||2)+'</select></label><label>Пространство для решения<select '+attribute+'="grid">'+qwOptions([['none','Без разлиновки'],['fine','Мелкая светлая клетка'],['normal','Обычная клетка']],settings.grid||'fine')+'</select></label>';
}
function qwSettings(){
 const d=qwDialog('Параметры работы','<div class="qw-settings">'+['title','grade','topic','variant'].map((k,i)=>'<label>'+['Название','Класс','Тема','Вариант №'][i]+'<input data-meta="'+k+'" value="'+qwEsc(qwDoc[k])+'" maxlength="160"></label>').join('')+'<label>Предмет<select data-meta="subject">'+qwOptions(Object.entries(QW_SUBJECTS),qwDoc.subject)+'</select></label><label>Формат PDF<select data-meta="layout">'+qwFormatOptions(qwDoc.layout)+'</select></label><div class="qw-settings-wide qw-row" data-practice-controls>'+qwPracticeControls(qwDoc.practice)+'</div><label class="qw-settings-wide">Инструкция для обычной контрольной<textarea data-meta="instructions" rows="4" maxlength="4000">'+qwEsc(qwDoc.instructions)+'</textarea></label></div>',qwButton('meta-apply','Применить','class="qw-primary"'));
 const format=d.querySelector('[data-meta="layout"]'),toggle=()=>d.querySelector('[data-practice-controls]').hidden=format.value!=='practice';format.onchange=toggle;toggle();
 const existing=qwDoc.printSettings||{};
 const profileField=document.createElement('label');profileField.textContent='Профиль оформления';
 const profile=document.createElement('select');profile.dataset.workProfile='';
 profile.innerHTML=qwOptions([['','Текущие настройки'],...Object.entries(QW_PUBLISH_PROFILES).map(([key,[title]])=>[key,title])],existing.profile||'');
 profileField.append(profile);format.closest('label').before(profileField);
 profile.onchange=()=>{if(profile.value){format.value=QW_PUBLISH_PROFILES[profile.value][1];toggle();}};
 d.querySelector('[data-qw-action="meta-apply"]').onclick=()=>{qwChange(()=>{
  for(const e of d.querySelectorAll('[data-meta]'))qwDoc[e.dataset.meta]=qwText(e.value,e.dataset.meta==='instructions'?4000:160);
  if(profile.value!==(existing.profile||'')){
   const settings={...existing};
   if(profile.value){settings.profile=profile.value;settings.monochrome=profile.value==='exam';delete settings.numbering;}
   else delete settings.profile;
   qwDoc.printSettings=qwPrintSettings(settings);
  }
  if(format.value==='practice')qwDoc.practice={perPage:Number(d.querySelector('[data-practice="perPage"]').value),grid:d.querySelector('[data-practice="grid"]').value};
  qwDoc.title=qwDoc.title.trim()||'Новая работа';
 });d.close();};
}
/* Online publishing: browser's native print-to-PDF preserves selectable text and vector SVG.
   The older one-click raster PDF exporter remains available as a compatibility fallback. */
/* Unified high-quality browser PDF. Native font shaping and vector SVG are kept. */
function qwAnswerSections(d,options={},exam=false){
 const mode=options.keyMode,detailed=mode==='detailed'||(!mode&&(options.includeComments===true||options.includeCriteria===true));
 const permanent=q=>(exam||options.includeNumbers!==false)&&q.source?.kind==='bank'?qwBankNumber(q.source.number):0;
 const answerSource=q=>q.answer.trim().replace(/^\s*(?:\*\*|__)?Ответ\s*:\s*(?:\*\*|__)?\s*/i,'');
 const field=(q,key,value)=>qwPublishedFieldHTML({...q,[key]:value},key);
 if(!detailed){
  const columns=d.tasks.length>=12?3:d.tasks.length>=6?2:1,rows=[];
  for(let i=0;i<d.tasks.length;i+=columns){
   const entries=d.tasks.slice(i,i+columns).map((q,j)=>{
    const number=i+j+1;
    return '<div class="qw-answer-item'+(exam?' qw-exam-brief-item':'')+'" data-answer-number="'+number+'">'+(exam?qwExamNumberHTML(i+j,permanent(q)):'<b class="qw-print-number">'+number+'.</b>')+'<div class="qw-answer-text qw-print-rich">'+(exam?'':qwPrintBankLabel(permanent(q)))+field(q,'answer',answerSource(q)||'—')+'</div></div>';
   }).join('');
   rows.push('<section class="qw-print-section qw-answer-row" data-task="'+(i+1)+'"><article class="qw-paper-task"><div class="qw-task-flow"><div class="qw-task-text qw-answer-columns" style="--qw-answer-columns:'+columns+'">'+entries+'</div></div></article></section>');
  }
  return rows.join('');
 }
 const showPrompt=options.includePrompt===true,sections=[];
 const section=(q,key,title,source)=>{
  const heading=new RegExp('(^|\\n)\\s*#{1,4}\\s+'+title+'\\s*:?\\s*(?=\\n|$)','i');
  if(heading.test(source))return field(q,key,source);
  const inlineHeading=new RegExp('^\\s*(?:\\*\\*|__)?'+title+'\\s*:?(?:\\*\\*|__)?[ \\t]*(?:\\n|$)','i');
  return '<h3 class="qw-print-answer-heading">'+title+'</h3>'+field(q,key,source.replace(inlineHeading,''));
 };
 d.tasks.forEach((q,i)=>{
  const number=i+1,value=answerSource(q);
  const answer=field(q,'answer',value||'—').replace(/<br\s*\/?>/g,' ');
  const lines=q.comment.trimEnd().split('\n'),last=lines.at(-1)?.match(/^\s*(?:\*\*|__)?Ответ\s*:\s*(?:\*\*|__)?\s*(.+)$/i);
  const withoutEnding=text=>text.replace(/(?:\*\*|__)?[.\s]*$/,'').trim();
  if(last&&value&&withoutEnding(last[1])===withoutEnding(value))lines.pop();
  const solution=lines.join('\n').trim();
  const showSolution=(mode==='detailed'||options.includeComments===true)&&!!solution;
  const showCriteria=(exam?options.includeCriteria!==false:options.includeCriteria===true)&&!!q.criteria.trim();
  const body=(showSolution?section(q,'comment','Решение',solution):'')+
   '<div class="qw-answer-caption"><b>Ответ:</b> '+answer+'</div>'+
   (showCriteria?section(q,'criteria','Критерии оценивания',q.criteria):'');
  if(showPrompt){
   const condition=qwTaskPreview({...q,answerVisible:false,source:!exam&&options.includeNumbers===false?null:q.source},i,'booklet',true,d.printSettings,false,null,exam)
    .replace('</article>','<div class="qw-teacher-notes qw-key-solutions qw-print-rich" data-answer-number="'+number+'">'+body+'</div></article>');
   sections.push('<section class="qw-print-section qw-answer-long" data-qw-key-condition data-task="'+number+'">'+condition+'</section>');
  }else sections.push('<section class="qw-print-section qw-answer-long" data-task="'+number+'"><article class="qw-paper-task qw-compact-entry qw-standard-task'+(exam?' qw-exam-publication':'')+'">'+qwTaskHeading(i,permanent(q),exam)+'<div class="qw-task-flow"><div class="qw-task-text qw-print-rich" data-answer-number="'+number+'">'+body+'</div></div></article></section>');
 });return sections.join('');
}
function qwPrintDocumentHTML(project,teacher=false,options={answers:true,criteria:true,comments:true}){
 const d=qwValidate(project),requested=options.format||(teacher?'answers':d.layout),
  examStandard=!options.singleTaskPreview&&qwExamPublication(d,requested),
  format=examStandard&&requested==='exam'?'booklet':requested,exam=format==='exam',subject=QW_SUBJECTS[d.subject];
 if(!['worksheet','exam','compact','practice','answers','booklet'].includes(format))throw Error('Неизвестный формат PDF');
 if(!d.tasks.length)throw Error('Добавьте задания в работу');
 const p=qwPrintSettings(d.printSettings||{}),showTitle=p.showTitle??(d.title!=='Новая работа'),showMeta=p.showMeta??format!=='booklet',showVariant=p.showVariant!==false;
 if(p.text)for(const task of d.tasks)task.publishing={...task.publishing,text:{...p.text,...task.publishing?.text}};
 const numbering=examStandard?'auto':p.numbering||(p.profile==='notes'?'none':'auto');
 const heading=p.titleText===undefined?d.title:p.titleText;
 const sectionTitle=q=>q.part&&!/^Часть \d+$/.test(q.part)?q.part:q.topic||q.part;
 let previousTopic='';const topics=new Set(d.tasks.map(sectionTitle).filter(Boolean));
 const tasks=format==='answers'?qwAnswerSections(d,options,examStandard):d.tasks.map((q,i)=>{
  if(!q.prompt.trim())throw Error('Заполните условие задания '+(i+1));
  const topic=sectionTitle(q),showTopic=(format==='compact'||p.profile==='practice')&&p.topicHeadings&&topic!==previousTopic&&(topics.size>1||topic&&!/^Часть \d+$/.test(topic));previousTopic=topic;
  const partHeading=format==='booklet'&&p.partHeadings&&q.part&&q.part!==d.tasks[i-1]?.part?q.part:'';
  const heading=examStandard?
   (p.examPartHeadings&&q.part&&q.part!==d.tasks[i-1]?.part?q.part:
    p.examTopicHeadings&&q.topic&&q.topic!==d.tasks[i-1]?.topic?q.topic:''):
   partHeading||(showTopic?topic:'');
  return '<section class="qw-print-section" data-task="'+(i+1)+'" data-explicit-break="'+(q.pageBreak&&i>0)+'">'+(heading?'<h2 class="qw-topic-title">'+qwEsc(heading)+'</h2>':'')+qwTaskPreview(q,i,format,true,d.printSettings,false,null,examStandard)+'</section>';
 }).join('');
 const printTheme=qwPrintTheme({theme:p.theme??(['booklet','answers'].includes(format)?'academic':''),monochrome:p.monochrome??false,...options}),styles=qwPrintStyles(p.orientation??'portrait','spread');
 const meta=showMeta?(qwEsc(subject)+(d.grade?' · '+qwEsc(d.grade)+' класс':'')+(format!=='booklet'&&showVariant&&d.variant?' · Вариант '+qwEsc(d.variant):'')+(format==='answers'?' · Ключ ответов':'')):'';
 const detailed=options.keyMode==='detailed'||(!options.keyMode&&(options.includeComments===true||options.includeCriteria===true));
 const examTitle='Вариант '+qwExamVariant(d.variant)+(format==='answers'?
  detailed?(options.includePrompt===true?' — условия и решения':' — решения и критерии'):' — ответы':'');
 const header=qwPrintBrand()+(examStandard?'<h1 class="qw-print-title">'+qwEsc(examTitle)+'</h1>':
  (showTitle&&heading.trim()?'<h1 class="qw-print-title">'+(format==='answers'?'Ответы — ':'')+qwEsc(heading)+'</h1>':'')+
  (showMeta&&d.topic&&d.topic!==heading?'<p class="qw-print-topic">'+qwEsc(d.topic)+'</p>':'')+
  (format==='booklet'&&showVariant&&d.variant?'<p class="qw-booklet-variant">Вариант №'+qwEsc(d.variant)+'</p>':'')+
  (meta?'<div class="qw-print-meta">'+meta+'</div>':'')+
  (format==='worksheet'&&d.instructions?'<p class="qw-print-intro">'+qwContentHTML(d.instructions)+'</p>':''));
 const css=(d.printSettings?'--qw-print-size:'+p.fontPt+'pt;':'')+'--qw-title-size:'+(p.titlePt??14)+'pt;--qw-title-color:'+(examStandard?'#000000':p.titleColor??'#000000')+
  ';--qw-body-color:'+(examStandard?'#000000':p.bodyColor??'#000000')+';--qw-title-align:'+(p.titleAlign??'center')+';';
 return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>'+qwEsc(d.title)+
  '</title>'+(qoNativeDesktop?'<link rel="stylesheet" href="'+qwEsc(new URL('print-'+(p.orientation??'portrait')+'.css',location.href).href)+'">':'<style>'+styles+'</style>')+'</head><body style="'+css+'" data-qw-font="'+(p.bodyFont??(['booklet','answers'].includes(format)?'serif':'sans'))+'" data-qw-title-custom="'+(['titlePt','titleFont','titleColor','titleAlign'].some(k=>p[k]!==undefined))+'" data-qw-math-custom="'+(p.bodyFont!==undefined)+'" data-qw-title-font="'+(p.titleFont??'sans')+
  '" data-qw-show-pages="'+(p.showPageNumbers!==false)+'" data-qw-orientation="'+(p.orientation??'portrait')+'" data-qw-landscape-layout="spread" '+(printTheme.id?'data-qw-theme="'+printTheme.id+'" ':'')+'data-qw-monochrome="'+printTheme.monochrome+
  '" data-qw-exam-standard="'+examStandard+'" data-qw-profile="'+(p.profile||'')+'" data-qw-format="'+format+'" data-practice-count="'+(d.practice?.perPage||2)+'" data-practice-grid="'+(d.practice?.grid||'fine')+'" class="'+(exam?'qw-print-exam':'qw-print-worksheet')+
  '"><main class="qw-print-document" data-qw-numbering="'+(format==='answers'?'auto':numbering)+'"><div class="qw-print-source"><header class="qw-print-header">'+header+'</header>'+tasks+'</div></main>'+(qoNativeDesktop?'<script src="'+qwEsc(new URL('print.js',location.href).href)+'"></script>':'<script>'+qwAlignSVGText.toString()+';'+qwMeasureSVGInk.toString()+';'+qwPreparePrintDocument.toString()+';window.qwPrintReady=qwPreparePrintDocument().catch(error=>{window.__qwPrintError=error.message;document.body.textContent=error.message;document.body.className="qw-print-error";return null;});</script>')+'</body></html>';
}
function qwPrintTextPDF(teacher=false,options){
 let html;try{html=qwPrintDocumentHTML(qwDoc,teacher,options);}catch(e){status('PDF: '+e.message,true);return;}
 const frame=document.createElement('iframe');frame.title='Подготовка PDF';
 const landscape=qwPrintSettings(qwDoc.printSettings||{}).orientation==='landscape';
 frame.style.cssText='position:fixed;left:-9999px;top:0;width:'+(landscape?1160:830)+'px;height:'+(landscape?830:1160)+'px;opacity:0;pointer-events:none';
 document.body.append(frame);
 frame.onload=async()=>{
  try{const win=frame.contentWindow,prepared=win.document;if(!prepared.body?.dataset.qwFormat)return; // Ignore initial about:blank load.
   if(!win.qwPrintReady)throw Error('Не загружен модуль печати');await win.qwPrintReady;if(frame.contentDocument!==prepared)return;if(win.__qwPrintError||prepared.body.dataset.qwLayoutReady!=='true')throw Error(win.__qwPrintError||'Макет PDF не готов');win.addEventListener('afterprint',()=>frame.remove(),{once:true});
   win.focus();win.print();status('В окне печати выберите «Сохранить как PDF»');}
  catch(e){status('PDF: '+e.message,true);frame.remove();}
 };
 frame.srcdoc=html;
}
async function qwSaveFile(){try{const data=qwValidate(qwDoc),snapshot=JSON.stringify(qwDoc);const saved=await download((typeof safeFile==='function'?safeFile(data.title):'Работа')+'.qwork',JSON.stringify(data,null,2),'application/json');if(qoNativeDesktop&&!saved)return;if(JSON.stringify(qwDoc)===snapshot){qwExported=snapshot;qwPersist();}if(!qoNativeDesktop)status('QWORK подготовлен для скачивания');}catch(e){status(e.message,true);}}
async function qwExportPDF(teacher=false,options){if(teacher||['compact','practice','booklet','worksheet','exam'].includes(qwDoc.layout)){qwPrintTextPDF(teacher,options);return;}if(qwBusy)return;qwBusy=true;try{status('Подготовка страниц PDF…');const bytes=await qwPDFBytes(qwDoc,false,options);await download(safeFile(qwDoc.title)+'_ученик.pdf',bytes,'application/pdf');if(!qoNativeDesktop)status('PDF подготовлен для скачивания');}catch(e){status('PDF: '+e.message,true);}finally{qwBusy=false;}}
async function qwPreview(output='tasks'){
 if(!qwEnsureEducationMode())return;
 const key=output==='answers',prefs=qwPrintSettings(qwDoc.printSettings||{}),hasAnswers=qwDoc.tasks.some(q=>q.answer.trim()||q.comment.trim()||q.criteria.trim());
 const selected=(name,on)=>'<label class="qw-check"><input type="checkbox" data-print-setting="'+name+'" '+(on?'checked':'')+'>'+({
  showTitle:'Добавить заголовок',showMeta:'Предмет и класс',showVariant:'Номер варианта',
  showPageNumbers:'Номера страниц',topicHeadings:'Заголовки тем',partHeadings:'Заголовки частей',examTopicHeadings:'Заголовки тем',examPartHeadings:'Заголовки частей',monochrome:'Чёрно-белый PDF'
 }[name]||name)+'</label>';
 const label=(title,control)=>'<label class="qw-pdf-field"><span>'+title+'</span>'+control+'</label>';
 const opt=(items,current)=>qwOptions(items,current);
 const design='<aside class="qw-pdf-design" aria-label="Оформление PDF">'+
  '<h3>Заголовок</h3>'+label('Номер варианта','<input type="number" data-exam-variant min="1" max="999999999" step="1" value="'+qwExamVariant(qwDoc.variant)+'">')+selected('showTitle',prefs.showTitle??qwDoc.title!=='Новая работа')+
  '<div id="qw-title-controls" class="qw-design-fields">'+
   label('Текст заголовка','<input type="text" data-print-setting="titleText" maxlength="160" placeholder="Введите заголовок" value="'+qwEsc(prefs.titleText??(qwDoc.title==='Новая работа'?'':qwDoc.title))+'">')+
   label('Шрифт заголовка','<select data-print-setting="titleFont">'+opt([['sans','Без засечек'],['serif','Книжный']],prefs.titleFont??'sans')+'</select>')+
   label('Размер заголовка, пт','<input type="number" data-print-setting="titlePt" min="11" max="26" step="1" value="'+(prefs.titlePt??14)+'">')+
   label('Выравнивание','<select data-print-setting="titleAlign">'+opt([['left','Слева'],['center','По центру'],['right','Справа']],prefs.titleAlign??'center')+'</select>')+
   label('Цвет заголовка','<input type="color" data-print-setting="titleColor" value="'+(prefs.titleColor??'#000000')+'">')+
  '</div><h3>Текст и страница</h3>'+
  label('Шрифт заданий','<select data-print-setting="bodyFont">'+opt([['serif','Книжный'],['sans','Без засечек']],prefs.bodyFont??(qwDoc.layout==='booklet'?'serif':'sans'))+'</select>')+
  label('Размер текста, пт','<input type="number" data-print-setting="fontPt" min="9" max="12" step="0.5" value="'+prefs.fontPt+'">')+
  label('Ориентация A4','<select data-print-setting="orientation">'+opt([['portrait','Книжная (вертикальная)'],['landscape','Альбомная (горизонтальная)']],prefs.orientation??'portrait')+'</select>')+

  label('Цвет текста','<input type="color" data-print-setting="bodyColor" value="'+(prefs.bodyColor??'#000000')+'">')+
  label('Рисунки','<select data-print-setting="figurePosition">'+opt([['auto','Автоматически'],['right','Справа'],['below','Под условием']],prefs.figurePosition)+'</select>')+
  selected('showMeta',prefs.showMeta??qwDoc.layout!=='booklet')+
  selected('showVariant',prefs.showVariant!==false)+selected('showPageNumbers',prefs.showPageNumbers!==false)+
  selected('topicHeadings',prefs.topicHeadings)+(!key?selected('examPartHeadings',prefs.examPartHeadings===true)+selected('examTopicHeadings',prefs.examTopicHeadings===true):'')+
  (!key?label('Нумерация заданий','<select data-print-setting="numbering">'+opt([['auto','По формату'],['none','Без номера'],['continuous','Порядковый номер']],prefs.numbering??(prefs.profile==='notes'?'none':'auto'))+'</select>'):'')+
  (!key&&qwDoc.layout==='booklet'&&new Set(qwDoc.tasks.map(q=>q.part).filter(Boolean)).size>1?selected('partHeadings',prefs.partHeadings===true):'')+
  '<div data-practice-controls>'+qwPracticeControls(qwDoc.practice)+'</div>'+
  (key?'':qwFigureLayoutControls())+qwPublishInspector()+'<h3>Оформление QX</h3>'+
  label('Фирменный уголок','<select data-print-setting="theme">'+opt([['','Без бренда'],['academic','QX | Квант Икс']],prefs.theme===undefined?(qwDoc.layout==='booklet'?'academic':''):prefs.theme?'academic':'')+'</select>')+
  selected('monochrome',prefs.monochrome===true)+
  '</aside>';
 const answers='<div class="qw-row qw-preview-options">'+
  ['includeComments','includePrompt','includeCriteria','includeNumbers'].map((k,i)=>'<label class="qw-check"><input type="checkbox" data-key-option="'+k+'" '+(i===3?'checked':'')+'>'+['Подробный ключ','Условия','Критерии оценивания','Постоянные номера'][i]+'</label>').join('')+'</div>';
 const d=qwDialog(key?'Отдельные ответы PDF':'Макет и экспорт PDF',
  '<div class="qw-pdf-controls">'+(key?answers:qwLayoutSelect(qwDoc.layout))+qwPublishZoomControls()+'</div>'+
  '<div class="qw-pdf-workspace">'+design+
  '<div id="qw-pages"><iframe id="qw-print-preview-frame" title="Макет PDF" loading="eager"></iframe></div></div>'+
  '<p id="qw-label-warnings" class="qw-error" hidden></p>',
  '<output id="qw-page-count" role="status">Расчёт страниц…</output>'+
  (key?qwButton('preview-tasks','К макету'):qwButton('preview-answers','Скачать ответы PDF',hasAnswers?'':'disabled'))+
  qwButton('preview-pdf',key?'Скачать ответы PDF':'Скачать PDF','class="qw-primary"'),'pdf');
 d.classList.add('qw-print-preview-dialog','qw-print-design-dialog');qwInstallPanels(d.querySelector('.qw-pdf-workspace'),'pdf',d.querySelector('.qw-pdf-controls'),{left:['.qw-pdf-design','Оформление']});
 const preview=d.querySelector('#qw-print-preview-frame'),printButton=d.querySelector('[data-qw-action="preview-pdf"]');
 const options=()=>{
  const flags=Object.fromEntries([...d.querySelectorAll('[data-key-option]')].map(e=>[e.dataset.keyOption,e.checked]));
  return {format:key?'answers':qwDoc.layout,...flags,...(key?{keyMode:flags.includeComments?'detailed':'brief'}:{})};
 };
 const rezoom=qwBindPublishZoom(d,preview);
 let renderRevision=0,typingTimer=0;
 const refresh=()=>{
  const revision=++renderRevision;
  printButton.disabled=true;d.querySelector('#qw-pages').setAttribute('aria-busy','true');const effective=d.querySelector('#qw-layout-figure-effective');if(effective)effective.textContent='';
  d.querySelector('#qw-page-count').textContent='Расчёт страниц…';
  const practice=d.querySelector('[data-practice-controls]');if(practice)practice.hidden=qwDoc.layout!=='practice';

  const title=d.querySelector('#qw-title-controls'),standard=qwExamPublication(qwDoc,key?'answers':qwDoc.layout);
  if(title)title.hidden=!standard&&!d.querySelector('[data-print-setting="showTitle"]').checked;
  for(const name of ['showTitle','titleText','titleAlign','titleColor','bodyColor','showMeta','showVariant','topicHeadings','partHeadings','numbering']){
   const control=d.querySelector('[data-print-setting="'+name+'"]');if(control)control.closest('label').hidden=standard;
  }
  for(const name of ['examPartHeadings','examTopicHeadings']){
   const control=d.querySelector('[data-print-setting="'+name+'"]');if(control)control.closest('label').hidden=!standard;
  }
  d.querySelector('[data-exam-variant]').closest('label').hidden=!standard;
  const includeNumbers=d.querySelector('[data-key-option="includeNumbers"]');if(includeNumbers){includeNumbers.disabled=standard;if(standard)includeNumbers.checked=true;}
  preview.onload=async()=>{
   const win=preview.contentWindow,atLoad=win.document;
   if(atLoad.documentElement.dataset.qwRender!==String(revision)||!win.qwPrintReady)return;
   await win.qwPrintReady;
   if(revision!==renderRevision||preview.contentDocument!==atLoad)return;
   preview.dataset.ready=String(revision);d.querySelector('#qw-pages').setAttribute('aria-busy','false');rezoom();
   printButton.disabled=!!win.__qwPrintError;
   d.querySelector('#qw-page-count').textContent=win.__qwPrintError?'Ошибка: '+win.__qwPrintError:win.__qwPrintLayout.layout==='spread'?'Листов A4: '+win.__qwPrintLayout.sheets+' · полос: '+win.__qwPrintLayout.pages.length:'Страниц: '+win.__qwPrintLayout.pages.length;
   updateEffectiveWidth();
   const n=win.document.querySelectorAll('[data-label-conflict="true"]').length,w=d.querySelector('#qw-label-warnings');
   w.hidden=!n;w.textContent=n?'Пересечение подписей на рисунке: '+n:'';
  };
  try{preview.srcdoc=qwPrintDocumentHTML(qwDoc,false,options()).replace('<html lang="ru">','<html lang="ru" data-qw-render="'+revision+'">');}
  catch(error){preview.srcdoc='<p role="alert">'+qwEsc(error.message)+'</p>';d.querySelector('#qw-page-count').textContent=error.message;d.querySelector('#qw-pages').setAttribute('aria-busy','false');}
 };
 function commit(e){
  const layout=d.querySelector('select[name="qw-pdf-layout"]');
  const next=qwPrintSettings(qwDoc.printSettings||{});
  if(e?.dataset?.printSetting){
   const field=e.dataset.printSetting;
   next[field]=e.type==='checkbox'?e.checked:e.type==='number'?Number(e.value):e.value;
   if(field==='titleText'&&e.value.trim()){next.showTitle=true;d.querySelector('[data-print-setting="showTitle"]').checked=true;}
  }
  try{
   const normalized=qwPrintSettings(next);
   qwRemember();
   if(layout){qwDoc.layout=layout.value;layout.innerHTML=qwFormatOptions(qwDoc.layout);}
   if(e?.dataset?.practice)qwDoc.practice={perPage:Number(d.querySelector('[data-practice="perPage"]').value),grid:d.querySelector('[data-practice="grid"]').value};
   qwDoc.printSettings=normalized;qwPersist();qwRender();refresh();
  }catch(error){d.querySelector('#qw-page-count').textContent=error.message;}
 }
 d.querySelectorAll('[name="qw-pdf-layout"],[data-practice],[data-print-setting]').forEach(e=>{
  e.addEventListener('change',()=>{clearTimeout(typingTimer);commit(e);});
  if(e.matches('[data-print-setting="titleText"]'))e.addEventListener('input',()=>{clearTimeout(typingTimer);typingTimer=setTimeout(()=>commit(e),280);});
 });
 d.querySelector('[data-exam-variant]').addEventListener('change',e=>{
  const value=e.target.value;
  if(!e.target.checkValidity()||!value){e.target.value=qwExamVariant(qwDoc.variant);return;}
  qwRemember();qwDoc.variant=qwExamVariant(value);qwPersist();qwRender();refresh();
 });
 const taskControl=d.querySelector('#qw-layout-figure-task'),modeControl=d.querySelector('#qw-layout-figure-mode'),widthControl=d.querySelector('#qw-layout-figure-width'),resetControl=d.querySelector('#qw-layout-figure-reset');
 function updateEffectiveWidth(){
  const output=d.querySelector('#qw-layout-figure-effective');if(!output||!taskControl)return;
  const number=qwDoc.tasks.findIndex(q=>q.id===taskControl.value)+1;
  const figure=preview.contentDocument?.querySelector('.qw-print-section[data-task="'+number+'"] figure');
  const width=figure?.getBoundingClientRect().width;
  const task=qwDoc.tasks[number-1],mm=width*25.4/96,requested=task?.figureWidth*25.4/96;
  output.textContent=width>0?'На странице: '+mm.toFixed(1)+' мм'+(task?.figureWidthMode==='manual'&&Math.abs(mm-requested)>.15?' (ограничение макета или читаемости)':''):'';
 }
 if(taskControl){
  const selectedFigure=()=>qwDoc.tasks.find(q=>q.id===taskControl.value);
  const syncFigure=()=>{const q=selectedFigure();if(!q)return;const manual=q.figureWidthMode==='manual';modeControl.value=manual?'manual':'auto';widthControl.value=(q.figureWidth*25.4/96).toFixed(2);widthControl.disabled=resetControl.disabled=!manual;};
  const changeFigure=(mode,width)=>{const q=selectedFigure();if(!q)return;const next={...q};if(!qwSetFigureWidth(next,mode,width)){syncFigure();return;}qwRemember();q.figureWidth=next.figureWidth;if(next.figureWidthMode)q.figureWidthMode=next.figureWidthMode;else delete q.figureWidthMode;const publishing={...q.publishing};delete publishing.figure;qwUsePublishing(q,publishing);qwPersist();qwRender();syncFigure();syncPublishing();refresh();};
  taskControl.addEventListener('change',()=>{qwSelected=taskControl.value;qwRender();syncFigure();updateEffectiveWidth();});
  modeControl.addEventListener('change',()=>changeFigure(modeControl.value,selectedFigure()?.figureWidth));
  widthControl.addEventListener('change',()=>{const raw=widthControl.value;changeFigure('manual',raw.trim()===''?NaN:Number(raw)*96/25.4);});
  resetControl.addEventListener('click',()=>changeFigure('auto'));
 }
 const syncPublishing=qwBindPublishInspector(d.querySelector('[data-qw-publish]'),()=>qwDoc.tasks,(task,publishing)=>{
  qwRemember();qwUsePublishing(task,publishing);qwPersist();qwRender();
  clearTimeout(typingTimer);typingTimer=setTimeout(refresh,140);
 },()=>qwSelected);
 function keyOptionsChanged(){
  const detailed=d.querySelector('[data-key-option="includeComments"]')?.checked;
  d.querySelectorAll('[data-key-option="includePrompt"],[data-key-option="includeCriteria"]').forEach(e=>{e.disabled=!detailed;});
  refresh();
 }
 d.querySelectorAll('[data-key-option]').forEach(e=>e.addEventListener('change',()=>{
  if(e.dataset.keyOption==='includeComments'&&e.checked&&qwExamPublication(qwDoc,'answers'))d.querySelector('[data-key-option="includeCriteria"]').checked=true;
  keyOptionsChanged();
 }));
 const answersBtn=d.querySelector('[data-qw-action="preview-answers"]');if(answersBtn)answersBtn.onclick=()=>{d.close();qwPreview('answers');};
 const tasksBtn=d.querySelector('[data-qw-action="preview-tasks"]');if(tasksBtn)tasksBtn.onclick=()=>{d.close();qwPreview();};
 printButton.onclick=()=>qwPrintTextPDF(false,options());
 keyOptionsChanged();
}
/* TASK166.1: IndexedDB is the only live bank. These short-lived snapshots only
   support older UI/tests at <=500 items; never act as a persistence backend. */
let qwBankSnapshot=[];
function qwBankNumber(value){return Number.isInteger(value)&&value>0&&value<=99999?value:0;}
function qwBankNormalize(x){
 if(!x||typeof x!=='object'||!x.task)throw Error('Некорректная запись банка');
 const task=qwValidate({...qwProject(),tasks:[x.task]}).tasks[0];
 return {id:qwText(x.id,80)||qwId(),bankNumber:qwBankNumber(x.bankNumber),subject:['physics','math','geometry','algebra'].includes(x.subject)?x.subject:'physics',
  grade:qwText(x.grade??task.grade,24).trim(),exam:['general','oge','ege'].includes(x.exam)?x.exam:task.exam,
  topic:qwText(x.topic??task.topic,120).trim(),subtopic:qwText(x.subtopic??task.subtopic,120).trim(),
  origin:['original','adapted','generated'].includes(x.origin)?x.origin:task.origin,
  year:/^(19|20)\d{2}$/.test(String(x.year??''))?String(x.year):'',
  part:['1','2'].includes(String(x.part??''))?String(x.part):'',
  slot:/^([1-9]|[1-3]\d|40)$/.test(String(x.slot??''))?String(x.slot):'',
  difficulty:['basic','advanced','high'].includes(x.difficulty)?x.difficulty:'',...(x.examYears!==undefined?{examYears:bankValidateExamYears({...x,exam:['general','oge','ege'].includes(x.exam)?x.exam:task.exam})}:{}),task};
}
const qwBankRepository=createOfficeBankRepository({normalize:qwBankNormalize});
const qwBankStorageName=qoNativeDesktop?'SQLite':'IndexedDB';
async function qwBankOpen(){await qwBankRepository.open({onProgress:count=>status('Перенос изображений банка: '+count+' заданий…')});return qwBankRepository;}
// EXAM-01: verify portable bank references by record identity, not display number.
function qwBankSource(entry){
 return {kind:'bank',id:entry.id,number:entry.bankNumber,...(entry.slot?{slot:entry.slot}:{}),...(entry.createdAt?{createdAt:entry.createdAt}:{})};
}
function qwSameBankContent(a,b){
 return ['type','prompt','answer','comment','criteria','choices','points','figure','graph','diagram','image'].every(key=>JSON.stringify(a[key])===JSON.stringify(b[key]));
}
async function qwCheckWorkBankLinks(project){
 const candidates=project.tasks.filter(q=>['bank','external-bank'].includes(q.source?.kind));
 if(!candidates.length)return {rebound:0,external:0};
 // A damaged/unavailable bank must not prevent access to independent QWORK content.
 let repository;try{repository=await qwBankOpen();}catch(error){console.warn('Не удалось проверить ссылки QWORK:',error);}
 const records=new Map();
 let rebound=0,external=0;
 for(const task of candidates){
  const source=task.source;
  if(!records.has(source.id)){
   let record;try{record=await repository?.getTask(source.id);}catch(error){console.warn('Не удалось проверить запись QWORK:',source.id,error);}
   records.set(source.id,record);
  }
  const entry=records.get(source.id);
  if(entry&&entry.id===source.id&&qwBankNumber(entry.bankNumber)&&
   ((source.createdAt&&source.createdAt===entry.createdAt)||qwSameBankContent(task,entry.task))){
   if(source.kind!=='bank'||source.number!==entry.bankNumber)rebound++;
   task.source={...source,kind:'bank',number:entry.bankNumber};
   if(source.createdAt&&entry.createdAt)task.source.createdAt=entry.createdAt;
  }else{
   task.source={...source,kind:'external-bank'};external++;
  }
 }
 return {rebound,external};
}
async function qwBankSnapshotSmall(){
 const stats=await qwBankRepository.getStatistics();
 qwBankSnapshot=stats.count<=500?await qwBankRepository.snapshotMetadata():[];
 return stats;
}
function qwBankRead(){
 // Read-only compatibility for historical QWBANK test fixtures before the
 // first IndexedDB migration. UI never writes to or lists this legacy store.
 if(!qwBankRepository.db){
  let raw;try{raw=qwBankRepository.legacyStorage?.getItem(BANK_LEGACY_KEY);}catch{}
  if(raw){
   const entries=JSON.parse(raw).map(qwBankNormalize),used=new Set();
   let next=Math.max(0,...entries.map(e=>e.bankNumber));
   for(const item of entries){
    if(!item.bankNumber||used.has(item.bankNumber)){
     item.bankNumber=++next;
    }
    used.add(item.bankNumber);
   }
   return entries;
  }
 }
 return structuredClone(qwBankSnapshot);
}
function qwBankSave(){
 const q=qwCurrent();if(!q)return;
 if(!q.prompt.trim()){status('Заполните условие задания перед сохранением в банк',true);return;}
 const fields='<div class="qw-settings">'+
  '<label>Предмет<select id="qw-bank-new-subject">'+qwOptions(Object.entries(QW_SUBJECTS),qwDoc.subject)+'</select></label>'+
  '<label>Класс<input id="qw-bank-new-grade" maxlength="24" value="'+qwEsc(q.grade||qwDoc.grade)+'"></label>'+
  '<label>Назначение<select id="qw-bank-new-exam">'+qwOptions([['general','Практика'],['oge','ОГЭ'],['ege','ЕГЭ']],q.exam)+'</select></label>'+
  '<label>Год<input id="qw-bank-new-year" type="number" min="1900" max="2099" step="1" placeholder="2018" value=""></label>'+
  '<label>Часть<select id="qw-bank-new-part">'+qwOptions([['','Без части'],['1','Часть 1'],['2','Часть 2']],'')+'</select></label>'+
  '<label>Номер задания<input id="qw-bank-new-slot" type="number" min="1" max="40" step="1" placeholder="1–40"></label>'+
  '<label>Уровень<select id="qw-bank-new-difficulty">'+qwOptions([['','Без уровня'],['basic','Базовый'],['advanced','Повышенный'],['high','Высокий']],'')+'</select></label>'+
  '<label>Тема<input id="qw-bank-new-topic" maxlength="120" placeholder="Механика" value="'+qwEsc(q.topic||qwDoc.topic)+'"></label>'+
  '<label>Подтема<input id="qw-bank-new-subtopic" maxlength="120" placeholder="Кинематика" value="'+qwEsc(q.subtopic)+'"></label>'+
  '<label>Происхождение<select id="qw-bank-new-origin">'+qwOptions([['original','Авторская задача'],['adapted','Самостоятельный аналог'],['generated','С помощью ИИ']],q.origin)+'</select></label></div>';
 const d=qwDialog('Сохранить задание в банк',fields,qwButton('confirm-bank-save','Добавить','class="qw-primary"'));
 d.querySelector('[data-qw-action="confirm-bank-save"]').onclick=async()=>{
  try{
   await qwBankOpen();
   const get=k=>d.querySelector('#qw-bank-new-'+k).value;
   const metadata={subject:get('subject'),grade:get('grade').trim().slice(0,24),exam:get('exam'),
    topic:get('topic').trim().slice(0,120),subtopic:get('subtopic').trim().slice(0,120),origin:get('origin'),
    year:get('year').trim(),part:get('part'),slot:get('slot').trim(),difficulty:get('difficulty')};
   if(metadata.year&&!/^(19|20)\d{2}$/.test(metadata.year))throw Error('Год должен быть четырёхзначным');
   if(metadata.slot&&!/^([1-9]|[1-3]\d|40)$/.test(metadata.slot))throw Error('Номер задания: 1–40');
   const task=structuredClone(q);Object.assign(task,{grade:metadata.grade,exam:metadata.exam,
    topic:metadata.topic,subtopic:metadata.subtopic,origin:metadata.origin});
   await qwBankRepository.createTask(qwBankNormalize({id:qwId(),bankNumber:0,...metadata,task}));
   await qwBankSnapshotSmall();
   d.close();status('Задание сохранено в '+qwBankStorageName);
  }catch(e){status('Банк: '+e.message,true);}
 };
}
/* TASK164: Markdown editing of existing bank fields; QWBANK schema stays unchanged. */
const QW_BANK_SECTIONS=[
 ['prompt','Условие'],['answer','Ответ'],['comment','Подробное решение'],['criteria','Критерии оценивания']
];
function qwBankFormatButton(kind,label,title=label){
 return '<button type="button" data-bank-format="'+kind+'" aria-label="'+title+'" title="'+title+'">'+label+'</button>';
}
function qwBankFormatSelect(kind,title,options){
 return '<select data-bank-format-select="'+kind+'" aria-label="'+title+'" title="'+title+'"><option value="" selected>'+title+'</option>'+
  options.map(([value,label])=>'<option value="'+qwEsc(value)+'">'+qwEsc(label)+'</option>').join('')+'</select>';
}
function qwBankRichField(key,title,value,extra='',work=false){
 return '<section id="qw-bank-field-'+key+'" class="qw-bank-rich-editor" role="tabpanel" aria-labelledby="qw-bank-tab-'+key+'" data-bank-rich="'+key+'" hidden>'+
  '<textarea '+(work&&key==='prompt'?'id="qw-prompt" ':'')+'data-bank-task-field="'+key+'" maxlength="'+QW_LIMITS.text+'" spellcheck="true" aria-label="'+title+'">'+qwEsc(value)+'</textarea>'+
  '<div class="qw-bank-live qw-study-text qw-rich" data-bank-live="'+key+'" contenteditable="true" role="textbox" aria-multiline="true" aria-label="'+title+'" spellcheck="true" hidden></div>'+
  (key==='prompt'?'<div class="qw-bank-live-figure" data-bank-live-figure hidden></div>':'')+
  extra+'<div '+(key==='prompt'?'id="qw-bank-edit-preview" ':'')+'class="qw-bank-rich-render qw-rich'+(key==='prompt'?'':' qw-study-text')+'" data-bank-render="'+key+'" aria-label="Предпросмотр: '+title+'" hidden></div></section>';
}
function qwBankMarkup(source,start,end,kind,argument=''){
 const selected=source.slice(start,end);
 const inline={
  bold:['**','**','текст'],italic:['*','*','текст'],underline:['++','++','текст'],
  strike:['~~','~~','текст'],
  sup:['^{','}','2'],sub:['~{','}','0'],math:['\\(','\\)','F=ma'],
  fraction:['\\(\\frac{','}{b}\\)','a'],root:['\\(\\sqrt{','}\\)','x'],
  power:['\\(','^{2}\\)','x']
 };
 if(Object.hasOwn(inline,kind)){
  const [left,right,fallback]=inline[kind];
  const wrapped=line=>line.startsWith(left)&&line.endsWith(right)&&line.length>left.length+right.length;
  if(selected.includes('\n')&&['bold','italic','underline'].includes(kind)){
   const lines=selected.split('\n');
   const remove=lines.filter(line=>line.trim()).every(wrapped);
   const formatted=lines.map(line=>{
    if(!line.trim())return line;
    if(remove)return line.slice(left.length,-right.length);
    return wrapped(line)?line:left+line+right;
   }).join('\n');
   return {start,end,text:formatted,select:[0,formatted.length]};
  }
  if(wrapped(selected))
   return {start,end,text:selected.slice(left.length,-right.length),select:[0,selected.length-left.length-right.length]};
  if(selected&&start>=left.length&&source.slice(start-left.length,start)===left&&source.slice(end,end+right.length)===right)
   return {start:start-left.length,end:end+right.length,text:selected,select:[0,selected.length]};
  const text=selected||fallback;
  return {start,end,text:left+text+right,select:[left.length,left.length+text.length]};
 }
 if(kind==='symbol')return {start,end,text:argument};
 if(kind==='blank')return {start,end,text:'[[blank:4]]'};
 if(kind==='clear')return {start,end,text:selected.replace(/\[\[(?:style [^\]\n]+|\/style)\]\]|^::format [^\n]+\n|(\*\*|__|~~|\+\+)([^\n]+?)\1/gm,(_,marker,text)=>text||'')};
 if(['heading','align','list','numbered','quote'].includes(kind)){
  const first=start?source.lastIndexOf('\n',start-1)+1:0;
  const last=source.indexOf('\n',Math.max(start,end-1));
  const stop=last===-1?source.length:last;
  const text=source.slice(first,stop).split('\n').map((line,i)=>{
   if(kind==='align')return '::'+argument+' '+(line.replace(/^\s{0,3}::(?:left|center|right|justify)[ \t]+/,'')||'Текст');
   if(kind==='heading')return '#'.repeat(Number(argument)||3)+' '+(line.replace(/^\s{0,3}#{1,4}\s+/,'')||'Название раздела');
   if(kind==='quote')return '> '+(line.replace(/^\s{0,3}>\s?/,'')||'Пояснение');
   return (kind==='list'?'- ':(i+1)+'. ')+(line.replace(/^\s{0,3}(?:[-*+]|\d{1,3}[.)])\s+/,'')||'Пункт');
  }).join('\n');
  return {start:first,end:stop,text,select:[0,text.length]};
 }
 const snippets={
  rule:'---',
  callout:Object.hasOwn(QW_CALLOUTS,argument)?'> [!'+argument+'] '+QW_CALLOUTS[argument][0]+'\n'+(selected?selected.split('\n').map(line=>'> '+line).join('\n'):'>'):'',
  table:'| Величина | Значение |\n| --- | --- |\n| '+(selected.trim()||'Название').replace(/[\n|]/g,' ')+' | Значение |',
  cases:'$$\n\\begin{cases}\nx+y=5 \\\\\nx-y=1\n\\end{cases}\n$$',
  ege:'### Физическая модель и обоснование\n[Объясните применимость физических законов.]\n\n### Решение\n1. [Запишите законы и формулы.]\n2. [Выполните преобразования.]\n3. [Подставьте значения с единицами.]',
  rubric:'### Критерии для этой задачи\n| Элемент решения | Баллы |\n| --- | --- |\n| Обоснование физических законов | — |\n| Преобразования и вычисления | — |\n| Результат и единица измерения | — |\n\n> Сверьте с критериями конкретного задания ЕГЭ.'
 };
 if(!Object.hasOwn(snippets,kind))return null;
 const before=source.slice(0,start),after=source.slice(end);
 return {start,end,text:(before&&!before.endsWith('\n\n')?(before.endsWith('\n')?'\n':'\n\n'):'')+
  snippets[kind]+(after&&!after.startsWith('\n\n')?(after.startsWith('\n')?'\n':'\n\n'):'')};
}
function qwBankTextState(input){
 return {value:input.value,start:input.selectionStart,end:input.selectionEnd};
}
function qwEditorTextTools(){
 const fontChoices=Object.entries(QW_TEXT_FONTS).map(([id,[title]])=>[id,title]);
 const sizes=[8,9,10,11,12,14,16,18,20,24,28,32,36,48];
 const picker=(key,caption,options)=>'<label>'+caption+' <select data-editor-style="'+key+'"><option value="">—</option>'+qwOptions(options,'')+'</select></label>';
 const color=(key,caption,style='editor-style',value='#16202a')=>'<label title="'+caption+'"><span>'+caption+'</span><input type="color" aria-label="'+caption+'" data-'+style+'="'+key+'" value="'+value+'"></label>';
 return '<div class="qw-editor-text-tools" role="group" aria-label="Шрифт и абзац">'+
  picker('font','Шрифт',fontChoices)+picker('size','Размер',sizes.map(n=>[n,n+' пт']))+
  color('color','Текст')+color('highlight','Маркер','editor-style','#ffe396')+
  '<label>Применить к <select data-editor-scope>'+qwOptions([['selection','Выделению'],['document','Всему документу']],'selection')+'</select></label>'+
  '<details class="qw-editor-popover"><summary>Абзац</summary><div>'+
  picker('line','Интервал строки',[1,1.15,1.3,1.5,1.75,2,2.5,3].map(n=>[n,n]))+
  ['before','after'].map((key,i)=>'<label>'+['До абзаца','После абзаца'][i]+' <input data-editor-style="'+key+'" type="number" min="0" max="48" step=".5" aria-label="'+['До абзаца, пт','После абзаца, пт'][i]+'"></label>').join('')+
  '</div></details>'+
  qwBankFormatSelect('callout','Блок',Object.entries(QW_CALLOUTS).map(([key,[title]])=>[key,title]))+
  '<details class="qw-editor-popover" data-editor-callout hidden><summary>Свойства блока</summary><div>'+
  '<label>Тип <select data-callout-setting="type">'+qwOptions(Object.entries(QW_CALLOUTS).map(([key,[title]])=>[key,title]),'info')+'</select></label>'+
  '<label>Схема <select data-callout-setting="tone">'+qwOptions([['','По типу'],['blue','Синяя'],['green','Зелёная'],['purple','Фиолетовая'],['amber','Янтарная'],['red','Красная'],['gray','Серая']],'')+'</select></label>'+
  '<label><input type="checkbox" data-callout-setting="icon" checked> Иконка</label>'+
  '<label><input type="checkbox" data-callout-setting="borderVisible" checked> Граница</label>'+
  color('color','Акцент','callout-setting')+color('background','Фон','callout-setting','#edf5fc')+color('border','Цвет границы','callout-setting','#1d4f91')+
  '<label>Внутренний отступ <input type="number" data-callout-setting="pad" min="2" max="24" value="9"></label>'+
  '</div></details></div>';
}
function qwEditorContextTools(){
 const tools=[['bold','<b>Ж</b>','Жирный'],['italic','<i>К</i>','Курсив'],
  ['strike','<s>З</s>','Зачёркивание'],['underline','<u>Ч</u>','Подчёркивание'],
  ['highlight','▨','Выделить маркером'],['sup','x²','Верхний индекс'],['sub','x₀','Нижний индекс'],
  ['math','∑','Формула'],['quote','❝','Цитата']];
 return '<div class="qw-editor-context" role="toolbar" aria-label="Форматирование выделения" hidden>'+
  tools.map(([id,icon,title])=>'<button type="button" data-editor-context="'+id+'" title="'+title+'" aria-label="'+title+'">'+icon+'</button>').join('')+'</div>';
}
/* TASK156: transactional editing of a bank item, independent of the open QWORK. */
async function qwBankEdit(id,draft=null,returnFilters={},transaction=null){
 if(!qwEnsureEducationMode())return;
 qwStudyFonts();
 const originPage=page,originRevision=qoRouteRevision;
 const active=()=>page===originPage&&qoRouteRevision===originRevision;
 const creating=id===null;
 let stored;
 if(!creating){
  try{if(transaction)stored=transaction.stored;else{await qwBankOpen();stored=await qwBankRepository.getTask(id);}}catch(error){status(error.message,true);return;}
  if(!active())return;
  if(!stored){status('Задание больше не найдено в банке',true);return;}
 }
 draft??=creating
  ?{id:qwId(),bankNumber:0,subject:'physics',grade:'11',exam:'ege',year:'',part:'1',slot:'',
    difficulty:'',topic:'',subtopic:'',origin:'adapted',task:qwTask('short')}
  :structuredClone(stored);
 return qwTaskEditor(draft,{id,stored,creating,active,originPage,returnFilters,transaction});
}
function qwTaskEditor(draft,{id=null,stored,creating=false,active=()=>true,originPage,returnFilters={},transaction=null,work=null}={}){
 qwStudyFonts();
 const titles={subject:'Предмет',exam:'Экзамен',part:'Часть',difficulty:'Сложность',origin:'Происхождение'};
 const opts=(k,items)=>'<label>'+(titles[k]||k)+'<select data-bank-edit-field="'+k+'">'+qwOptions(items,draft[k])+'</select></label>';
 const field=(k,title,max=120)=>'<label>'+title+'<input data-bank-edit-field="'+k+'" maxlength="'+max+'" value="'+qwEsc(draft[k]||'')+'"></label>';
 const task=draft.task;
 const choices='<label data-bank-choices-wrap>Варианты ответа, по одному в строке<textarea data-bank-choices rows="4" maxlength="3600">'+qwEsc((task.choices||[]).join('\n'))+'</textarea></label>';
 const fields=QW_BANK_SECTIONS.map(([key,title])=>qwBankRichField(key,title,task[key],key==='prompt'?choices:'',!!work)).join('');
 const tabs='<div class="qw-bank-edit-tabs" role="tablist" aria-label="Содержание задания">'+
  QW_BANK_SECTIONS.map(([key,title])=>'<button type="button" role="tab" id="qw-bank-tab-'+key+'" data-bank-tab="'+key+'" aria-controls="qw-bank-field-'+key+'">'+title+'</button>').join('')+'</div>';
 const formatButtons=[
  ['bold','<b>Ж</b>','Жирный (Ctrl+B)'],['italic','<i>К</i>','Курсив (Ctrl+I)'],
  ['underline','<u>Ч</u>','Подчёркивание (Ctrl+U)'],['list','•','Маркированный список'],['numbered','1.','Нумерованный список'],
  ['sup','x²','Верхний индекс'],['sub','x₀','Нижний индекс'],['table','Таблица','Вставить таблицу']
 ];
 const textTools='<div class="qw-bank-rich-tools" role="group" aria-label="Форматирование">'+
  '<div class="qw-bank-tool-group">'+qwBankFormatButton('undo',qoWorkIcon('undo'),'Отменить (Ctrl+Z)')+
  qwBankFormatButton('redo',qoWorkIcon('redo'),'Повторить (Ctrl+Y)')+'</div>'+
  qwBankFormatSelect('heading','Заголовок',[['1','Заголовок 1'],['2','Заголовок 2'],['3','Заголовок 3'],['4','Заголовок 4']])+
  '<div class="qw-bank-tool-group">'+formatButtons.slice(0,5).map(item=>qwBankFormatButton(...item)).join('')+'</div>'+
  qwBankFormatSelect('align','Выравнивание',[['left','Слева'],['center','По центру'],['right','Справа'],['justify','По ширине']])+
  '<div class="qw-bank-tool-group">'+formatButtons.slice(5,7).map(item=>qwBankFormatButton(...item)).join('')+'</div>'+
  qwBankFormatSelect('formula','Формула',[['math','Выражение'],['fraction','Дробь'],['power','Степень'],['root','Корень'],['cases','Система уравнений']])+
  qwBankFormatSelect('symbol','Символы',['α','β','γ','Δ','θ','λ','μ','π','ρ','σ','φ','ω','Ω','±','×','·','÷','≤','≥','≠','≈','∞','→','∠','°','√','∑','∫'].map(symbol=>[symbol,symbol]))+
  qwBankFormatButton(...formatButtons[7])+qwBankFormatButton('quote','❝','Цитата')+
  qwBankFormatButton('strike','<s>З</s>','Зачёркивание')+
  qwBankFormatButton('rule','—','Горизонтальный разделитель')+
  qwBankFormatButton('clear',qoWorkIcon('eraser'),'Очистить форматирование')+
  qwBankFormatButton('blank','Поле','Вставить поле для записи')+
  '<span data-bank-template="comment" hidden>'+qwBankFormatButton('ege','Шаблон решения')+'</span>'+
  '<span data-bank-template="criteria" hidden>'+qwBankFormatButton('rubric','Шаблон критериев')+'</span>'+
  '</div>';
 const visualTools='<div class="qw-bank-edit-visual-actions" role="group" aria-label="Иллюстрации">'+
  '<button type="button" data-bank-visual="graph">График</button>'+
  '<button type="button" data-bank-visual="diagram">Схема</button>'+
  '<button type="button" data-bank-visual="image">Изображение</button>'+
  '<input type="file" id="qw-bank-edit-image" accept="image/png,image/jpeg,image/webp" hidden>'+
  '</div>';
 const equationBox='<div class="qw-bank-equation-box" hidden><label>Формула'+
  '<textarea data-bank-equation-source rows="2" maxlength="600"></textarea></label>'+
  '<div class="qw-bank-equation-preview" aria-live="polite"></div>'+
  '<button type="button" data-bank-equation-apply>Применить</button>'+
  '<button type="button" data-bank-equation-cancel>Отмена</button></div>';
 const workFields=work?
  qwField('part','Часть',task.part,'text','maxlength="120"')+qwField('points','Баллы',task.points,'number','min="0" max="100"')+
  ['grade','topic','subtopic'].map((k,i)=>'<label>'+['Класс','Тема','Подтема'][i]+
   '<input data-bank-task-field="'+k+'" maxlength="'+(k==='grade'?24:120)+'" value="'+qwEsc(task[k]||'')+'"></label>').join('')+
  '<label>Экзамен<select data-bank-task-field="exam">'+qwOptions([['general','Практика'],['oge','ОГЭ'],['ege','ЕГЭ']],task.exam)+'</select></label>'+
  qwSelect('position','Расположение рисунка',[['auto','Автоматически'],['right','Справа'],['below','Под условием'],...(task.position==='left'?[['left','Слева']]:[])],task.position)+
  qwSelect('answerStyle','Формат ответа',[['line','Строка'],['box','Рамка'],['boxes','Ячейки']],task.answerStyle)+
  (task.answerStyle==='boxes'?qwField('boxes','Количество ячеек',task.boxes,'number','min="1" max="30"'):'')+
  qwCheck('solutionVisible','Место для решения',task.solutionVisible)+(task.solutionVisible?qwField('solutionHeight','Высота, пт',task.solutionHeight,'number','min="24" max="500"')+
  qwSelect('solutionStyle','Разлиновка',[['lines','Строки'],['grid','Клетка'],['blank','Без разлиновки']],task.solutionStyle):'')+
  qwCheck('pageBreak','С новой страницы',task.pageBreak)+qwButton('bank-save','Сохранить задание в банк','class="qw-bank-publish-meta"'):'';
 const category='<div class="qw-bank-edit-categories">'+
  '<label class="qw-bank-publish-meta">Название для каталога<input data-bank-task-field="title" maxlength="120" value="'+qwEsc(task.title||'')+'"></label>'+
  '<button type="button" class="qw-bank-publish-meta" data-bank-move-title>Перенести первый заголовок</button>'+
  '<label class="qw-bank-publish-meta">Теги через запятую<input data-bank-tags maxlength="419" value="'+qwEsc((task.tags||[]).join(', '))+'"></label>'+
  '<label>Тип<select data-bank-task-field="type">'+qwOptions(Object.entries(QW_TYPES),task.type)+'</select></label>'+
  '<label>Иллюстрация<select data-bank-task-field="figure">'+qwOptions([['none','Без рисунка'],['graph','График'],['diagram','Схема'],['image','Изображение']],task.figure)+'</select></label>'+
  '<label class="qw-check"><input type="checkbox" data-bank-task-field="answerVisible" '+(task.answerVisible?'checked':'')+'>Поле ответа в PDF</label>'+
  (work?workFields:opts('subject',Object.entries(QW_SUBJECTS).filter(([key])=>['physics','math','geometry','algebra'].includes(key)))+
  field('grade','Класс',24)+
  opts('exam',[['general','Практика'],['oge','ОГЭ'],['ege','ЕГЭ']])+
  field('year','Год',4)+
  opts('part',[['','Без части'],['1','Часть 1'],['2','Часть 2']])+
  field('slot','Номер задания',2)+
  opts('difficulty',[['','Без уровня'],['basic','Базовый'],['advanced','Повышенный'],['high','Высокий']])+
  field('topic','Тема')+field('subtopic','Подтема')+
  opts('origin',[['original','Авторская'],['adapted','Авторский аналог'],['generated','С помощью ИИ']]))+
 '</div>';
 const inspector=qwPublishInspector();
 const publishing='<section class="qw-bank-publishing" data-bank-publishing hidden>'+(work?'':inspector)+
  '<div class="qw-bank-publish-main"><div class="qw-bank-publish-toolbar">'+
  '<label>Ориентация A4 <select data-bank-publish-orientation><option value="portrait">Книжная</option><option value="landscape">Альбомная · две колонки</option></select></label></div>'+
  '<p class="qw-error" data-bank-publish-error role="status" hidden></p>'+
  '<div class="qw-bank-publish-paper"><iframe data-bank-publish-frame title="Макет задания A4"></iframe></div></div></section>';
 const markup='<div class="qw-bank-edit-top">'+tabs+
   '<button type="button" data-bank-preview-toggle="prompt" data-bank-publish-toggle aria-pressed="false">'+qoWorkIcon('eye')+'<span>'+(work?'Лист задания':'Предпросмотр')+'</span></button>'+
   '<button type="button" data-bank-source aria-pressed="false">Исходный текст</button>'+
   qwPublishZoomControls()+'</div>'+
   '<div class="qw-bank-edit-layout">'+
   '<section class="qw-bank-edit-main"><div class="qw-bank-edit-commandbar">'+textTools+visualTools+qwEditorTextTools()+'</div>'+equationBox+
   '<div class="qw-edit-scroll">'+fields+'</div>'+publishing+qwEditorContextTools()+'</section>'+
   '<aside class="qw-bank-edit-side" aria-label="'+(work?'Свойства задания':'Метаданные задания')+'">'+(work?qwButton('close-panels','Закрыть','class="qw-drawer-close"'):'')+category+
   (work?'<details class="qw-work-publishing"><summary>Рисунки и таблицы</summary>'+inspector+'</details>':'')+'</aside>'+
   '</div><p id="qw-bank-edit-error" role="alert" class="qw-error" hidden></p>';
 let d;
 if(work){
  d=work.mount;d.id='qw-task-editor';d.className='qw-inline-task-editor';d.innerHTML=markup;
 }else{
  d=qwDialog(creating?'Новое задание':'Задание № '+String(draft.bankNumber).padStart(5,'0'),markup,
   qwButton('bank-edit-back','В банк')+qwButton('bank-edit-save','Сохранить изменения','class="qw-primary"'),originPage==='bank'?true:'bank-edit');
  d.classList.add('qw-bank-edit-dialog');
 }
 const layout=d.querySelector('.qw-bank-edit-layout'),top=d.querySelector('.qw-bank-edit-top');
 if(!work)qwInstallPanels(layout,'bankEdit',top,{right:['.qw-bank-edit-side','Метаданные']});
 const error=d.querySelector('#qw-bank-edit-error');
 const save=d.querySelector('[data-qw-action="bank-edit-save"]');
 const previewButton=top.querySelector('[data-bank-preview-toggle]');
 const editors=[...d.querySelectorAll('[data-bank-rich]')];
 const tabsList=[...d.querySelectorAll('[data-bank-tab]')];
 let saving=false,imagePending=false;
 const live=key=>d.querySelector('[data-bank-live="'+key+'"]');
 const equation=d.querySelector('.qw-bank-equation-box');
 const equationSource=equation.querySelector('textarea');
 const equationPreview=equation.querySelector('.qw-bank-equation-preview');
 const sourceButton=top.querySelector('[data-bank-source]');
 const publishingPane=d.querySelector('[data-bank-publishing]'),publishFrame=publishingPane.querySelector('[data-bank-publish-frame]');
 const publishToggle=top.querySelector('[data-bank-publish-toggle]'),orientation=publishingPane.querySelector('[data-bank-publish-orientation]');
 const moveTitle=d.querySelector('[data-bank-move-title]');
 const catalogName=d.querySelector('[data-bank-task-field="title"]'),tags=d.querySelector('[data-bank-tags]');
 const bookmarks=new WeakMap(),contextBar=d.querySelector('.qw-editor-context'),calloutPanel=d.querySelector('[data-editor-callout]');
 let currentCallout=null;
 let formula=null,composing=false;
 let publishRevision=0,publishTimer=0,rezoom=()=>{};
 function refreshPublishing(){
  if(!d.isConnected||transaction.view.mode!=='publish')return;
  const revision=++publishRevision,notice=publishingPane.querySelector('[data-bank-publish-error]');
  transaction.view.orientation=orientation.value;
  const options={orientation:orientation.value,showTitle:false,showVariant:false,showMeta:false};
  const q={...task,...(draft.bankNumber?{source:{kind:'bank',id:draft.id,number:draft.bankNumber}}:{})};
  const setError=text=>{notice.hidden=!text;notice.textContent=text;};
  setError('');
  publishFrame.style.width=(orientation.value==='landscape'?1150:820)+'px';
  try{
   const teacher=transaction.view.tab!=='prompt';
   const project={...qwProject(),layout:'booklet',tasks:[q],printSettings:options};
   const html=teacher?qwPrintDocumentHTML(project,true,{format:'answers',keyMode:'detailed',includePrompt:true,includeCriteria:true,singleTaskPreview:true}):qwPrintDocumentHTML(project,false,{singleTaskPreview:true});
   publishFrame.onload=async()=>{
    const win=publishFrame.contentWindow,doc=publishFrame.contentDocument;
    if(doc.documentElement.dataset.qwRender!==String(revision)||!win.qwPrintReady)return;
    await win.qwPrintReady;
    if(revision!==publishRevision||doc!==publishFrame.contentDocument)return;
    if(win.__qwPrintError){setError(win.__qwPrintError);return;}
    publishFrame.dataset.ready=String(revision);rezoom();
   };
   publishFrame.srcdoc=html.replace('<html lang="ru">','<html lang="ru" data-qw-render="'+revision+'">');
  }catch(error){publishFrame.srcdoc='';setError(error.message);}
 }
 orientation.onchange=refreshPublishing;
 const syncPublishing=qwBindPublishInspector(d.querySelector('[data-qw-publish]'),()=>[task],(edited,settings)=>{
  qwUsePublishing(edited,settings);saveWorking();
  for(const surface of d.querySelectorAll('[data-bank-live]'))delete surface.qwRenderedSource;
  clearTimeout(publishTimer);publishTimer=setTimeout(refreshPublishing,110);
 });
 function mountLive(surface,input){
  qwLiveMount(surface,input.value);
  styleSurface(surface);
  qwStylePublishedTables(surface,task.publishing?.tables?.[surface.dataset.bankLive]);
  for(const node of surface.children){const source=surface.qwSourceBlocks.get(node);if(source)source.html=node.outerHTML;}
  surface.qwRenderedSource=input.value;
 }
 function authorStyle(){return {...(work?qwDoc.printSettings?.text:null),...task.publishing?.text};}
 function styleSurface(surface){
  const style=authorStyle();
  qwLiveApplyStyle(surface,style,true);
 }
 function syncTextControls(){
  const defaults=authorStyle();
  const scope=d.querySelector('[data-editor-scope]').value;
  const surface=live(transaction.view.tab),range=qwLiveRange(surface);
  const node=range?.startContainer.nodeType===1?range.startContainer:range?.startContainer.parentElement;
  const styled=node?.closest('[data-qw-text-style]'),local=styled&&styled!==surface?qwReadTextStyle(styled.dataset.qwTextStyle):null;
  const selected=scope==='document'?defaults:{...defaults,...local};
  for(const control of d.querySelectorAll('[data-editor-style]')){
   if(control===document.activeElement)continue;
   const key=control.dataset.editorStyle,value=selected[key];
   if(control.type==='color'){if(value)control.value=value;}else control.value=value??'';
  }
 }
 function changeDocText(key,value){
  const current=work?qwDoc.printSettings?.text:task.publishing?.text;
  const requested=key?{...current,version:1}:{version:1};
  if(key){if(value===undefined)delete requested[key];else requested[key]=value;}
  const format=qwTextStyle(requested);
  const next=qwStyleSource(format)?format:null;
  if(work){
   const settings={...qwDoc.printSettings};
   if(next)settings.text=next;else delete settings.text;
   qwRemember();qwDoc.printSettings=qwPrintSettings(settings);qwPersist();
  }else{
   const settings={...task.publishing};
   if(next)settings.text=next;else delete settings.text;
   qwUsePublishing(task,settings);
  }
  for(const [section] of QW_BANK_SECTIONS)styleSurface(live(section));
  syncTextControls();refreshPublishing();
 }
 function changeTextStyle(key,argument,scope){
  const value=QW_TEXT_RULES[key].min===undefined?argument:Number(argument);
  try{qwTextStyle({version:1,[key]:value});}catch(error){showError(error.message);return;}
  if(scope==='document'){changeDocText(key,value);return;}
  const input=fieldInput(transaction.view.tab),surface=live(transaction.view.tab);
  if(transaction.view.mode==='source'){
   const before=qwBankTextState(input),{start,end}=before, spec=key+'='+value;
   if(QW_PARAGRAPH_STYLES.has(key)){
    const first=start?input.value.lastIndexOf('\n',start-1)+1:0;
    const previous=first?input.value.lastIndexOf('\n',first-2)+1:0;
    const prior=input.value.slice(previous,first).match(/^::format ([^\n]+)\n$/);
    const existing=prior&&qwReadTextStyle(prior[1]);
    const next=qwStyleSource({...existing,version:1,[key]:value});
    input.setRangeText('::format '+next+'\n',existing?previous:first,first,'preserve');
   }else if(start!==end)input.setRangeText('[[style '+spec+']]'+input.value.slice(start,end)+'[[/style]]',start,end,'select');
   recordText(input,before);return;
  }
  qwLiveRestore(surface,qwLiveBookmark(surface)||bookmarks.get(surface));
  const before=currentSnapshot(input,surface),range=qwLiveRange(surface);
  const changed=QW_PARAGRAPH_STYLES.has(key)?qwLiveParagraphStyle(surface,range,key,value):
   qwLiveTextSelection(surface,range,key,value);
  if(changed){historyFor(input).before=before;commitLive(surface);showError('');}
 }
 function syncCallout(block){
  if(block===currentCallout)return;
  currentCallout=block;
  calloutPanel.hidden=!block;
  if(!block){calloutPanel.open=false;return;}
  const type=block.dataset.qwCallout,options=qwCalloutOptions(type,block.dataset.qwCalloutOptions)||{};
  const look=qwCalloutLook(type,options),[ink,paper]=QW_CALLOUT_TONES[look.tone];
  const values={type,tone:options.tone||'',icon:options.icon!=='0',borderVisible:options.border!=='none',color:options.color||ink,
   background:options.background||paper,border:options.border&&options.border!=='none'?options.border:ink,pad:options.pad||9};
  for(const control of calloutPanel.querySelectorAll('[data-callout-setting]')){
   const value=values[control.dataset.calloutSetting];
   if(control.type==='checkbox')control.checked=value;else control.value=value;
  }
 }
 function changeCallout(control){
  if(!currentCallout?.isConnected)return;
  const block=currentCallout,type=block.dataset.qwCallout,key=control.dataset.calloutSetting;
  const input=fieldInput(transaction.view.tab),surface=live(transaction.view.tab);
  const options=qwCalloutOptions(type,block.dataset.qwCalloutOptions)||{};
  const nextType=key==='type'?control.value:type;
  if(key==='icon')options.icon=control.checked?'1':'0';
  else if(key==='borderVisible'){if(control.checked)delete options.border;else options.border='none';}
  else if(key==='tone'&&!control.value)delete options.tone;
  else if(key!=='type')options[key]=control.value;
  const spec=qwCalloutOptionSource(options),valid=qwCalloutOptions(nextType,spec);
  if(!valid){showError('Проверьте настройки блока');return;}
  const before=currentSnapshot(input,surface),look=qwCalloutLook(nextType,valid);
  block.dataset.qwCallout=nextType;block.dataset.qwCalloutOptions=spec;block.style.cssText=look.css;
  const heading=block.querySelector('.qw-callout-title');
  heading.querySelector('.qw-callout-icon')?.remove();
  if(look.icon){const icon=document.createElement('span');icon.className='qw-callout-icon';icon.contentEditable='false';
   icon.setAttribute('aria-hidden','true');icon.textContent=look.icon;heading.prepend(icon);}
  historyFor(input).before=before;commitLive(surface);currentCallout=null;syncCallout(block);
 }
 function updateEducationSelection(){
  if(transaction.view.mode!=='visual'||formula||d.closest('[inert]')){contextBar.hidden=true;syncCallout(null);return;}
  const surface=live(transaction.view.tab),range=qwLiveRange(surface);
  const anchor=range?.startContainer.nodeType===1?range.startContainer:range?.startContainer.parentElement;
  if(!calloutPanel.open&&range&&surface.contains(document.activeElement))syncCallout(anchor?.closest('[data-qw-callout]')||null);
  syncTextControls();
  if(!range||range.collapsed||!range.toString().trim()){contextBar.hidden=true;return;}
  const selected=range.getBoundingClientRect(),viewport=surface.closest('.qw-edit-scroll').getBoundingClientRect();
  if(selected.top<viewport.top||selected.bottom>viewport.bottom){contextBar.hidden=true;return;}
  contextBar.hidden=false;
  const area=contextBar.getBoundingClientRect(),above=selected.top-8-area.height;
  const top=above>=viewport.top?above:selected.bottom+8;
  if(top+area.height>viewport.bottom){contextBar.hidden=true;return;}
  contextBar.style.left=Math.max(viewport.left+6,Math.min(viewport.right-area.width-6,(selected.left+selected.right-area.width)/2))+'px';
  contextBar.style.top=top+'px';
 }
 function currentSnapshot(input,surface){
  const state=qwBankTextState(input);
  if(surface)state.bookmark=qwLiveBookmark(surface)||bookmarks.get(surface);
  return state;
 }
 function rememberLive(surface){
  const mark=qwLiveBookmark(surface);
  if(mark)bookmarks.set(surface,mark);
 }
 function recordText(input,before){
  const history=historyFor(input),current=qwBankTextState(input);
  before??=history.before||history.current;
  if(current.value!==before.value){
   history.undo.push(before);if(history.undo.length>60)history.undo.shift();
   history.redo.length=0;
  }
  history.current=current;history.before=null;
  collect();updateHistoryButtons();preview();
 }
 function commitLive(surface){
  const input=fieldInput(surface.dataset.bankLive),history=historyFor(input);
  const before=history.before||history.current,next=qwLiveSource(surface);
  if(next.length>input.maxLength){
   mountLive(surface,input);qwLiveRestore(surface,before.bookmark);
   history.before=null;showError('Превышена допустимая длина поля');return;
  }
  input.value=next;surface.qwRenderedSource=next;
  surface.toggleAttribute('data-empty',!next.trim());
  if(surface.dataset.bankLive==='prompt')updateFigurePlacement(surface);
  if(transaction.view.zoom?.fit==='page'||work&&qwWorkZoom.fit==='page')rezoom();
  rememberLive(surface);recordText(input,before);
 }
 function renderEquation(){
  try{
   qwMath(equationSource.value);
   equationPreview.innerHTML=qwRichMath(equationSource.value,formula.display);
   return true;
  }catch(error){equationPreview.textContent=error.message;return false;}
 }
 function openEquation(surface,value,display=false,atom=null){
  rememberLive(surface);
  formula={surface,display,atom,initial:value};
  equationSource.value=value;equation.hidden=false;
  renderEquation();equationSource.focus();equationSource.select();
 }
 function finishEquation(apply){
  if(!formula||apply&&!renderEquation())return;
  const {surface,display,atom}=formula,value=equationSource.value;
  equation.hidden=true;formula=null;
  qwLiveRestore(surface,bookmarks.get(surface));
  if(!apply)return;
  const input=fieldInput(surface.dataset.bankLive),history=historyFor(input);
  history.before=currentSnapshot(input,surface);
  if(atom){
   const replacement=document.createElement('template');
   replacement.innerHTML=qwLiveHTML(display?'$$\n'+value+'\n$$':'\\('+value+'\\)');
   const next=replacement.content.querySelector('[data-qw-live-atom]');
   atom.replaceWith(next);
   const cursor=document.createRange();
   cursor.setStartAfter(next);cursor.collapse(true);
   window.getSelection().removeAllRanges();window.getSelection().addRange(cursor);
   commitLive(surface);
  }else{
   const html=qwLiveHTML(display?'$$\n'+value+'\n$$':'\\('+value+'\\)');
   document.execCommand('insertHTML',false,display?html+'<p><br></p>':html.replace(/^<p>|<\/p>$/g,''));
   if(history.before)commitLive(surface);
  }
 }
 equationSource.addEventListener('input',renderEquation);
 equation.querySelector('[data-bank-equation-apply]').onclick=()=>finishEquation(true);
 equation.querySelector('[data-bank-equation-cancel]').onclick=()=>finishEquation(false);
 function showError(message){error.hidden=!message;error.textContent=message||'';}
 function collect(){
  for(const el of d.querySelectorAll('[data-bank-edit-field]'))draft[el.dataset.bankEditField]=el.value.trim();
  for(const el of d.querySelectorAll('[data-bank-task-field]')){
   const k=el.dataset.bankTaskField;
   task[k]=el.type==='checkbox'?el.checked:el.value;
  }
  const tagValues=tags.value.split(',').map(tag=>tag.trim()).filter(Boolean);
  if(tagValues.length)task.tags=[...new Set(tagValues)];else delete task.tags;
  moveTitle.disabled=!!task.title.trim()||!/^\s*#{1,4}\s+[^\n]+(?:\n|$)/.test(task.prompt);
  const choicesControl=d.querySelector('[data-bank-choices]'),choicesWrap=d.querySelector('[data-bank-choices-wrap]');
  const isChoice=task.type==='choice';
  choicesWrap.hidden=!isChoice||transaction?.view.mode==='preview';
  if(isChoice)task.choices=choicesControl.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(work){saveWorking();return;}
  task.grade=draft.grade;task.exam=draft.exam;task.topic=draft.topic;
  task.subtopic=draft.subtopic;task.origin=draft.origin;
  if(draft.part)task.part='Часть '+draft.part;
 }
 function preview(){
  if(transaction.view.mode!=='preview')return;
  const key=transaction.view.tab,area=d.querySelector('[data-bank-render="'+key+'"]');
  try{
   area.innerHTML=key==='prompt'?
    qwTaskPreview(task,draft.slot?Number(draft.slot)-1:null,'worksheet',false,null,true,draft.bankNumber):
    qwPublishedFieldHTML(task,key);
   if(key==='prompt')qwRefreshLiveGraphText(area);
  }catch(e){area.textContent='Предпросмотр: '+e.message;}
 }
 function saveWorking(){
  if(!work||!transaction)return;
  const fingerprint=JSON.stringify(task);
  if(fingerprint===transaction.workSource)return;
  transaction.workSource=fingerprint;
  const current=qwCurrent();
  if(!current||current.id!==work.id)return;
  let next={...task};
  for(const key of ['part','points','position','answerStyle','boxes','solutionVisible','solutionHeight','solutionStyle','pageBreak'])next[key]=current[key];
  try{next=qwValidate({...qwProject(),tasks:[next]}).tasks[0];transaction.workInvalid=false;showError('');}
  catch(error){transaction.workInvalid=true;showError(error.message);return;}
  if(JSON.stringify(current)===JSON.stringify(next))return;
  if(!transaction.recorded){qwRemember();transaction.recorded=true;}
  qwDoc.tasks[qwDoc.tasks.indexOf(current)]=next;
  qwPersist();qwPreviewSelected();
  const toolbar=d.closest('#qo-work-root').querySelector('.qw-center-head');
  toolbar.querySelector('[data-qw-action="undo"]').disabled=!qwUndo.length;
  toolbar.querySelector('[data-qw-action="redo"]').disabled=!qwRedo.length;
 }
 const fieldInput=key=>d.querySelector('[data-bank-task-field="'+key+'"]');
 const historyFor=input=>transaction.history[input.dataset.bankTaskField];
 function updateHistoryButtons(){
  const history=historyFor(fieldInput(transaction.view.tab));
  d.querySelector('[data-bank-format="undo"]').disabled=!history.undo.length;
  d.querySelector('[data-bank-format="redo"]').disabled=!history.redo.length;
 }
 function selectSection(key,focus=false){
  transaction.view.tab=key;
  for(const btn of tabsList){
   const selected=btn.dataset.bankTab===key;
   btn.setAttribute('aria-selected',String(selected));btn.tabIndex=selected?0:-1;
   if(selected&&focus)btn.focus();
  }
  renderEditor();
 }
 function updateFigurePlacement(surface){
  const picture=task.publishing?.figure,position=picture?.position||task.position;
  const wide=position==='below'||position==='auto'&&(picture?picture.width>46:task.figureWidth>300);
  const figure=d.querySelector('[data-bank-live-figure]');
  figure.toggleAttribute('data-wide',wide||!!surface.querySelector('table'));
  figure.dataset.align=picture?.align||'center';
  figure.dataset.position=position;
  figure.style.setProperty('--qw-editor-figure-gap',(picture?.gapMm??2)+'mm');
  figure.parentElement.style.setProperty('--qw-editor-figure-width',picture?'min('+picture.width+'%,'+picture.maxMm+'mm)':Math.min(task.figureWidth,470)+'px');
 }
 function renderEditor(){
  const {tab,mode}=transaction.view,show=mode==='preview',publish=mode==='publish';
  publishToggle.setAttribute('aria-pressed',String(publish));
  publishingPane.hidden=!publish;
  d.querySelector('.qw-bank-edit-commandbar').hidden=publish;
  sourceButton.disabled=previewButton.disabled=publish;
  previewButton.dataset.bankPreviewToggle=tab;
  previewButton.innerHTML=qoWorkIcon(publish?'eye-off':'eye')+'<span>'+(publish?'Редактировать':work?'Лист задания':'Предпросмотр')+'</span>';
  previewButton.disabled=false;
  previewButton.setAttribute('aria-pressed',String(publish));d.querySelector('.qw-edit-scroll').hidden=publish;
  sourceButton.setAttribute('aria-pressed',String(mode==='source'));
  sourceButton.textContent=mode==='source'?'Визуальный режим':'Исходный текст';
  d.querySelector('.qw-bank-rich-tools').hidden=show;
  d.querySelectorAll('[data-bank-template]').forEach(el=>{el.hidden=el.dataset.bankTemplate!==tab;});
  for(const pane of editors){
   const key=pane.dataset.bankRich;
   pane.hidden=publish||key!==tab;
   const input=fieldInput(key),surface=live(key);
   input.hidden=mode!=='source';surface.hidden=mode!=='visual';
   if(mode==='visual'&&key===tab&&surface.qwRenderedSource!==input.value)mountLive(surface,input);
   surface.toggleAttribute('data-empty',!input.value.trim());
   pane.querySelector('[data-bank-render]').hidden=!show;
  }
  d.querySelector('[data-bank-choices-wrap]').hidden=show||task.type!=='choice';
  const graphic=d.querySelector('[data-bank-live-figure]');
  graphic.hidden=mode!=='visual'||tab!=='prompt'||task.figure==='none';
  if(!graphic.hidden){
   updateFigurePlacement(live(tab));
   graphic.innerHTML=qwStudyFigureHTML(task);qwRefreshLiveGraphText(graphic);
  }
  updateHistoryButtons();preview();updateEducationSelection();
  if(work||publish)syncPublishing();
  rezoom();
  if(publish){if(transaction.view.orientation)orientation.value=transaction.view.orientation;refreshPublishing();}
 }
 function historyStep(input,redo,surface=null){
  const history=historyFor(input);
  const from=redo?history.redo:history.undo,to=redo?history.undo:history.redo;
  if(!from.length)return;
  to.push(currentSnapshot(input,surface));
  const restored=from.pop();
  input.value=restored.value;
  if(surface){mountLive(surface,input);qwLiveRestore(surface,restored.bookmark);}
  else{input.focus();input.setSelectionRange(restored.start,restored.end);}
  history.current=restored;history.before=null;
  collect();updateHistoryButtons();preview();
 }
 function visualFormat(kind,argument){
  const input=fieldInput(transaction.view.tab),surface=live(transaction.view.tab);
  const history=historyFor(input);
  qwLiveRestore(surface,qwLiveBookmark(surface)||bookmarks.get(surface));
  if(kind==='undo'||kind==='redo'){historyStep(input,kind==='redo',surface);return;}
  const commands={bold:'bold',italic:'italic',underline:'underline',strike:'strikeThrough',clear:'removeFormat',sup:'superscript',sub:'subscript',
   list:'insertUnorderedList',numbered:'insertOrderedList'};
  const align={left:'justifyLeft',center:'justifyCenter',right:'justifyRight',justify:'justifyFull'};
  const templates={math:'F=ma',fraction:'\\frac{a}{b}',power:'x^{2}',root:'\\sqrt{x}',cases:'\\begin{cases}\nx+y=5 \\\\\nx-y=1\n\\end{cases}'};
  if(Object.hasOwn(templates,kind)){
   const selected=window.getSelection().toString().trim();
   openEquation(surface,kind==='math'&&selected?selected:templates[kind],kind==='cases');return;
  }
  const originalHTML=surface.innerHTML;
  history.before=currentSnapshot(input,surface);
  if(kind==='clear'&&d.querySelector('[data-editor-scope]').value==='document'){changeDocText('');history.before=null;return;}
  if(commands[kind])document.execCommand(commands[kind],false,null);
  else if(kind==='align'&&align[argument])document.execCommand(align[argument],false,null);
  else if(kind==='heading'||kind==='quote')document.execCommand('formatBlock',false,kind==='quote'?'blockquote':'h'+(2+Number(argument)));
  else if(kind==='callout'||kind==='rule'){
   const range=qwLiveRange(surface),selected=range&&!range.collapsed?qwLiveSource(range.cloneContents()):'';
   const snippet=qwBankMarkup(selected,0,selected.length,kind,argument);
   if(snippet)qwLiveInsertBlock(surface,qwLiveHTML(snippet.text));
  }
  else if(kind==='symbol'||kind==='blank'){
   const range=qwLiveRange(surface);
   if(range){
    const template=document.createElement('template');
    if(kind==='blank')template.innerHTML=qwLiveHTML('[[blank:4]]');
    const insert=kind==='symbol'?document.createTextNode(argument):template.content.querySelector('[data-qw-live-atom]');
    range.deleteContents();range.insertNode(insert);range.setStartAfter(insert);range.collapse(true);
    const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
   }
  }
  else {
   const snippet=qwBankMarkup('',0,0,kind,argument);
   if(snippet)document.execCommand('insertHTML',false,qwLiveHTML(snippet.text)+'<p><br></p>');
  }
  if(history.before&&surface.innerHTML!==originalHTML)commitLive(surface);
  history.before=null;
 }
 function format(kind,argument){
  const input=fieldInput(transaction.view.tab);
  if(formula||transaction.view.mode==='preview'||saving)return;
  if(d.querySelector('[data-editor-scope]').value==='document'){
   if(kind==='clear'){changeDocText('');return;}
   const defaults=work?qwDoc.printSettings?.text:task.publishing?.text;
   if(kind==='align'){changeDocText('align',argument);return;}
   if(kind==='bold'||kind==='italic'){
    const key=kind==='bold'?'weight':'slant';changeDocText(key,defaults?.[key]?undefined:kind);return;
   }
   if(kind==='underline'||kind==='strike'){
    const line=kind==='underline'?'underline':'line-through',existing=defaults?.decoration||'';
    const active=['underline','line-through'].filter(decoration=>existing.includes(decoration)!==(decoration===line));
    changeDocText('decoration',active.length?active.join('-'):undefined);return;
   }
  }
  if(transaction.view.mode==='visual'){visualFormat(kind,argument);return;}
  if(kind==='undo'||kind==='redo'){historyStep(input,kind==='redo');return;}
  const before=qwBankTextState(input);
  const change=qwBankMarkup(before.value,before.start,before.end,kind,argument);
  if(!change)return;
  if(before.value.length-change.end+change.start+change.text.length>input.maxLength){
   showError('Форматирование превышает допустимую длину поля');return;
  }
  historyFor(input).before=before;
  input.setRangeText(change.text,change.start,change.end,'end');input.focus();
  if(change.select)input.setSelectionRange(change.start+change.select[0],change.start+change.select[1]);
  input.dispatchEvent(new Event('input',{bubbles:true}));
  showError('');
 }
 for(const surface of d.querySelectorAll('[data-bank-live]')){
  const input=fieldInput(surface.dataset.bankLive);
  surface.addEventListener('pointerup',()=>rememberLive(surface));
  surface.addEventListener('keyup',()=>rememberLive(surface));
  surface.addEventListener('compositionstart',()=>{composing=true;historyFor(input).before=currentSnapshot(input,surface);});
  surface.addEventListener('compositionend',()=>{composing=false;commitLive(surface);});
  surface.addEventListener('beforeinput',event=>{
   if(event.inputType==='historyUndo'||event.inputType==='historyRedo'){
    if(event.cancelable){event.preventDefault();historyStep(input,event.inputType==='historyRedo',surface);}
   }else if(!composing)historyFor(input).before=currentSnapshot(input,surface);
  });
  surface.addEventListener('input',event=>{if(!composing&&!event.isComposing)commitLive(surface);});
  surface.addEventListener('paste',event=>{
   event.preventDefault();
   const source=event.clipboardData.getData('application/x-quantum-task-markdown');
   historyFor(input).before=currentSnapshot(input,surface);
   if(source&&source.length<=input.maxLength)document.execCommand('insertHTML',false,qwLiveHTML(source));
   else document.execCommand('insertText',false,event.clipboardData.getData('text/plain').slice(0,input.maxLength));
  });
  surface.addEventListener('drop',event=>{
   event.preventDefault();
   const range=document.caretRangeFromPoint(event.clientX,event.clientY);
   if(!range||!surface.contains(range.startContainer))return;
   const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
   historyFor(input).before=currentSnapshot(input,surface);
   document.execCommand('insertText',false,event.dataTransfer.getData('text/plain').slice(0,input.maxLength));
  });
  function copy(event,cut){
   const range=qwLiveRange(surface);
   if(!range||range.collapsed)return;
   const fragment=range.cloneContents(),source=qwLiveSource(fragment);
   event.clipboardData.setData('text/plain',window.getSelection().toString());
   event.clipboardData.setData('application/x-quantum-task-markdown',source);
   event.preventDefault();
   if(cut){
    historyFor(input).before=currentSnapshot(input,surface);
    document.execCommand('delete');
   }
  }
  surface.addEventListener('copy',event=>copy(event,false));
  surface.addEventListener('cut',event=>copy(event,true));
  function editAtom(event){
   const atom=event.target.closest('[data-qw-live-atom]:not([data-qw-live-atom=blank])');
   if(!atom)return;
   event.preventDefault();
   openEquation(surface,atom.dataset.qwLiveValue,atom.dataset.qwLiveAtom==='display',atom);
  }
  surface.addEventListener('click',editAtom);
  surface.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target!==surface)editAtom(event);});
 }
 d.querySelector('.qw-bank-rich-tools').addEventListener('pointerdown',()=>{
  if(transaction.view.mode==='visual')rememberLive(live(transaction.view.tab));
 });
 d.addEventListener('beforeinput',event=>{
  const history=historyFor(event.target);
  if(!history)return;
  if(event.inputType==='historyUndo'||event.inputType==='historyRedo'){
   if(event.cancelable){event.preventDefault();historyStep(event.target,event.inputType==='historyRedo');}
  }else history.before=qwBankTextState(event.target);
 });
 d.addEventListener('input',event=>{
  const input=event.target,history=historyFor(input);
  if(history){recordText(input);return;}
  if(input.matches('[data-bank-edit-field],[data-bank-task-field],[data-bank-choices],[data-bank-tags]')){collect();preview();}
 });
 d.addEventListener('change',event=>{
  if(event.target.matches('[data-editor-scope]')){syncTextControls();return;}
  if(event.target.matches('[data-editor-style]')){
   if(event.target.value!=='')changeTextStyle(event.target.dataset.editorStyle,event.target.value,d.querySelector('[data-editor-scope]').value);
   return;
  }
  if(event.target.matches('[data-callout-setting]')){changeCallout(event.target);return;}
  const select=event.target.closest('[data-bank-format-select]');
  if(select&&select.value){
   format(select.dataset.bankFormatSelect==='formula'?select.value:select.dataset.bankFormatSelect,select.value);
   select.value='';return;
  }
  if(['type','figure'].includes(event.target.dataset.bankTaskField)){
   if(event.target.dataset.bankTaskField==='type'&&['graph','diagram'].includes(event.target.value)){
    fieldInput('figure').value=event.target.value;
   }
   collect();renderEditor();return;
  }
  if(event.target.matches('[data-bank-edit-field],[data-bank-task-field],[data-bank-choices]')){collect();preview();}
 });
 d.addEventListener('click',event=>{
  const context=event.target.closest('[data-editor-context]');
  if(context){
   const key=context.dataset.editorContext;
   if(key==='highlight')changeTextStyle(key,d.querySelector('[data-editor-style=highlight]').value,'selection');
   else format(key);
   return;
  }
  const tab=event.target.closest('[data-bank-tab]');
  if(tab){if(formula)equationSource.focus();else{if(transaction.view.mode==='publish')transaction.view.mode=transaction.view.beforePublishing;selectSection(tab.dataset.bankTab);}return;}
  if(event.target.closest('[data-bank-publish-toggle]')){
   if(formula){equationSource.focus();return;}
   collect();const view=transaction.view;
   if(view.mode==='publish')view.mode=view.beforePublishing;
   else{view.beforePublishing=view.mode;view.mode='publish';}
   renderEditor();return;
  }
  if(event.target.closest('[data-bank-move-title]')&&!moveTitle.disabled){
   const input=fieldInput('prompt'),heading=input.value.match(/^\s*#{1,4}\s+([^\n]+)(?:\n|$)/);
   if(!heading||heading[1].trim().length>120){showError('Название задания: до 120 символов');return;}
   const before=qwBankTextState(input);catalogName.value=heading[1].trim();input.value=input.value.slice(heading[0].length).trimStart();
   recordText(input,before);renderEditor();return;
  }
  const action=event.target.closest('[data-bank-format]');
  if(action){format(action.dataset.bankFormat);return;}
  if(event.target.closest('[data-bank-source]')){
   if(formula){equationSource.focus();return;}
   transaction.view.mode=transaction.view.mode==='source'?'visual':'source';renderEditor();
  }
 });
 d.addEventListener('keydown',event=>{
  const tab=event.target.closest('[data-bank-tab]');
  if(!formula&&tab&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
   event.preventDefault();
   const index=tabsList.indexOf(tab),last=tabsList.length-1;
   const next=event.key==='Home'?0:event.key==='End'?last:(index+(event.key==='ArrowLeft'?last:1))%tabsList.length;
   selectSection(tabsList[next].dataset.bankTab,true);return;
  }
  if(!(event.ctrlKey||event.metaKey)||event.altKey||event.isComposing)return;
  if(event.code==='KeyS'){event.preventDefault();if(work){if(formula)equationSource.focus();else void qwSaveFile();}else save.click();return;}
  if(!event.target.closest('.qw-bank-rich-editor textarea[data-bank-task-field],[data-bank-live],.qw-bank-rich-tools'))return;
  const commands={KeyB:'bold',KeyI:'italic',KeyU:'underline',KeyZ:event.shiftKey?'redo':'undo',KeyY:'redo'};
  if(commands[event.code]){event.preventDefault();format(commands[event.code]);}
 });
 d.querySelectorAll('[data-bank-visual]').forEach(button=>button.onclick=()=>{
  collect();
  const kind=button.dataset.bankVisual;
  if(formula){equationSource.focus();return;}
  if(saving||imagePending)return;
  if(kind==='image'){d.querySelector('#qw-bank-edit-image').click();return;}
  qwVisualEditor(kind,task,(updatedKind,validated)=>{
   if(!active())return;
   task[updatedKind]=validated;task.figure=updatedKind;
   if(work){
     // Each accepted modal edit is a separate project undo transaction.
     transaction.recorded=false;fieldInput('figure').value=updatedKind;saveWorking();transaction.recorded=false;renderEditor();
    }
   else qwBankEdit(id,draft,returnFilters,transaction);
  },()=>{if(!work&&active())qwBankEdit(id,draft,returnFilters,transaction);},()=>!work&&JSON.stringify(draft)!==transaction.initialDraft);
 });
 d.querySelector('#qw-bank-edit-image').onchange=async(event)=>{
  const file=event.target.files?.[0];event.target.value='';if(!file||saving||imagePending)return;
  imagePending=true;if(save)save.disabled=true;
  try{
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>4_000_000)throw Error('Изображение: PNG/JPEG/WebP, не более 4 МБ');
   const data=await new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Файл не прочитан'));reader.readAsDataURL(file);
   });
   if(typeof data!=='string'||data.length>6_000_000)throw Error('Изображение слишком велико');
   await qwImage(data);if(!active()||!d.isConnected)return;
   task.image=data;task.figure='image';fieldInput('figure').value='image';saveWorking();renderEditor();showError('');
  }catch(e){showError(e.message);}
  finally{imagePending=false;if(save)save.disabled=false;}
 };
 collect();
 transaction??={initialDraft:JSON.stringify(draft),stored,view:{tab:'prompt',mode:'visual',previousMode:'visual'},
  history:Object.fromEntries(QW_BANK_SECTIONS.map(([key])=>[key,{undo:[],redo:[],before:null,current:qwBankTextState(fieldInput(key))}]))};
 if(work)transaction.workSource=JSON.stringify(task);
 d.qwDirty=()=>{collect();return transaction.workInvalid||(formula&&equationSource.value!==formula.initial)||!work&&JSON.stringify(draft)!==transaction.initialDraft;};
 d.qwCanLeave=()=>!saving&&!imagePending&&(!d.qwDirty()||confirm('Отменить несохранённые изменения задания?'));
 const scroll=d.querySelector('.qw-edit-scroll'),sheetView=publishFrame.parentElement;
 const zoom=work?qwWorkZoom:(transaction.view.zoom??={percent:100,fit:''});
 rezoom=qwBindZoom(top.querySelector('.qw-zoom'),zoom,[scroll,sheetView],()=>{
  if(transaction.view.mode==='publish')return qwFrameZoomGeometry(publishFrame);
  const width=Math.max(160,Math.min(820,scroll.clientWidth-32));
  scroll.style.setProperty('--qw-editor-width',width+'px');
  return {view:scroll,width:width+32,height:Math.max(360,editors.find(surface=>!surface.hidden)?.offsetHeight||0)+32};
 },scale=>{scroll.style.setProperty('--qw-edit-scale',scale);publishFrame.style.zoom=scale;});
 contextBar.addEventListener('pointerdown',event=>event.preventDefault());
 const caretEvents=new AbortController();
 document.addEventListener('selectionchange',updateEducationSelection,{signal:caretEvents.signal});
 scroll.addEventListener('scroll',updateEducationSelection,{signal:caretEvents.signal});
 const detach=new MutationObserver(()=>{
  if(!d.isConnected){caretEvents.abort();detach.disconnect();}
 });
 detach.observe(document.getElementById('app'),{childList:true,subtree:true});
 scroll.addEventListener('click',event=>{
  if(!event.target.matches('[data-bank-rich]')||transaction.view.mode!=='visual')return;
  const input=live(transaction.view.tab);
  if(fieldInput(transaction.view.tab).value)qwLiveRestore(input,bookmarks.get(input));else qwFocusCondition(input);
 });
 selectSection(transaction.view.tab);
 if(creating&&!task.prompt&&transaction.view.mode==='visual'){
  requestAnimationFrame(()=>{if(d.isConnected&&!live('prompt').hidden)qwFocusCondition(live('prompt'));});
 }
 if(work){
  d.addEventListener('keydown',e=>{if(e.key==='Escape'&&formula){e.stopPropagation();e.preventDefault();finishEquation(false);}});
  return;
 }
 const back=()=>{if(!d.qwCanLeave())return;d.close();if(active())void qwBank(returnFilters);};
 d.addEventListener('cancel',event=>{event.preventDefault();back();});
 d.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();if(formula)finishEquation(false);else back();}});
 d.querySelector('[data-qw-close]').onclick=back;
 d.querySelector('[data-qw-action="bank-edit-back"]').onclick=back;
 save.onclick=async()=>{
  if(formula){equationSource.focus();return;}
  if(!active()||!d.isConnected||saving||imagePending)return;
  saving=true;save.disabled=true;layout.inert=true;top.inert=true;
  try{
   collect();if(!task.prompt.trim())throw Error('Условие задания не может быть пустым');
   if(draft.year&&!/^(19|20)\d{2}$/.test(draft.year))throw Error('Введите год из четырёх цифр');
   if(draft.slot&&!/^([1-9]|[1-3]\d|40)$/.test(draft.slot))throw Error('Номер задания: от 1 до 40');
   const candidate=qwBankNormalize({...draft,id:creating?draft.id:id,task});
   await qwBankOpen();
   if(!active()||!d.isConnected)return;
   const saved=creating?
    await qwBankRepository.createTask(candidate):
    await qwBankRepository.updateTask(id,candidate,stored.revision);
   await qwBankSnapshotSmall();
   if(!active()||!d.isConnected)return;
   d.close();qwBank({...returnFilters,__view:saved.id});
   status(creating?'Задание добавлено в '+qwBankStorageName:'Изменения сохранены в '+qwBankStorageName);
  }catch(e){showError('Не удалось сохранить: '+e.message);}
  finally{saving=false;save.disabled=false;layout.inert=false;top.inert=false;}
 };
}
let qwBankRequest=0;
async function qwBank(previousFilters={}){
 if(!qwEnsureEducationMode())return;
 const bankDocument=qwDoc,bankPage=page,routeRevision=qoRouteRevision,ticket=++qwBankRequest;
 const sameWorkspace=()=>qwDoc===bankDocument&&page===bankPage&&qoRouteRevision===routeRevision&&ticket===qwBankRequest;
 let xs=[],facets,totalCount=0,assetMigrationError=null;
 const facetKeys=['grade','topic','subtopic','year'];
 try{
  await qwBankOpen();
  const stats=await qwBankSnapshotSmall();
  totalCount=stats.count;assetMigrationError=stats.assetMigrationError;facets=await qwBankRepository.listFacets(facetKeys);
 }catch(e){
  if(!sameWorkspace())return;
  status('Банк не открыт: '+e.message,true);
  const raw=qwBankRepository.getLegacyRecovery();
  if(raw!==null){
   const recovery=qwDialog('Ошибка открытия банка',
    '<p class="qw-error">IndexedDB не подтвердила сохранность данных. Автоматического переключения нет.</p>'+
    '<p>'+qwEsc(e.message)+'</p><p>Исходный localStorage сохранён без изменений. Скачайте его перед дальнейшими действиями.</p>',
    qwButton('bank-recover-raw','Скачать старые данные','class="qw-primary"'));
   recovery.querySelector('[data-qw-action="bank-recover-raw"]').onclick=()=>
    download('QuantumOffice_старый_банк_восстановление.json',raw,'application/json');
  }
  return;
 }
 if(!sameWorkspace())return;
 const filterKeys=['subject','grade','exam','topic','subtopic','year','part','slot','difficulty','type','origin'];
 const advancedKeys=['year','part','slot','difficulty','type','origin'];
 const bankExams={general:'Практика',oge:'ОГЭ',ege:'ЕГЭ'};
 const bankSubjects=Object.entries(QW_SUBJECTS).filter(([key])=>!['mixed','other'].includes(key));
 const pageSize=30;
 const selected=new Map((previousFilters.__selected||[]).map(id=>[id,true]));
 const diagnostic=typeof qdBankRead==='function'?qdBankRead():[];
 let activeId=previousFilters.__view||'',pageOffset=previousFilters.__offset||0,requestSequence=0,addPending=false;
 const filter=(key,title,options=[])=>'<label>'+title+'<select id="qw-bank-'+key+'">'+qwOptions([['all','Все'],...options],'all')+'</select></label>';
 const catalogue='<div class="qw-bank-catalogue">'+
  '<nav id="qw-bank-filters" class="qw-bank-navigation" aria-label="Категории заданий">'+
   '<button type="button" data-bank-reset>Все задания</button>'+
   '<details class="qw-bank-subjects" open><summary>Предметы</summary><div>'+
    [['all','Все предметы'],...bankSubjects].map(([key,label])=>'<button type="button" data-bank-subject="'+key+'" aria-pressed="false">'+label+'</button>').join('')+
   '</div></details><input type="hidden" id="qw-bank-subject" value="all">'+
   filter('grade','Классы')+filter('exam','Экзамены',Object.entries(bankExams))+
   filter('topic','Разделы и темы')+filter('subtopic','Подтемы')+
   '<details class="qw-bank-extra-filters"><summary>Дополнительные фильтры</summary><div class="qw-bank-extra-grid">'+
    filter('year','Год')+filter('part','Часть',[['1','Часть 1'],['2','Часть 2']])+
    filter('slot','№ задания',Array.from({length:40},(_,i)=>[String(i+1),String(i+1)]))+
    filter('difficulty','Сложность',[['basic','Базовый'],['advanced','Повышенный'],['high','Высокий']])+
    filter('type','Тип',Object.entries(QW_TYPES))+
    filter('origin','Происхождение',[['original','Авторская'],['adapted','Аналог'],['generated','С помощью ИИ']])+
   '</div></details></nav>'+
  '<section class="qw-bank-catalogue-results" aria-label="Список заданий">'+
   '<div class="qw-bank-selection-line"><output id="qw-bank-count" role="status"></output><span id="qw-bank-selected-count">Выбрано: 0</span></div>'+
   '<div id="qw-bank-list" class="qw-bank-catalogue-list"></div>'+
   '<nav class="qw-bank-pages" aria-label="Страницы банка"><button type="button" data-bank-page="prev" aria-label="Назад" disabled>'+qoWorkIcon('arrow-left')+'</button><output id="qw-bank-page"></output><button type="button" data-bank-page="next" aria-label="Вперёд" disabled>'+qoWorkIcon('arrow-right')+'</button></nav></section>'+
  '<section class="qw-bank-catalogue-preview" aria-label="Подробный просмотр задания"><div id="qw-bank-preview"></div></section></div>';
 const operations='<details class="qw-bank-operations"><summary>'+qoWorkIcon('folder')+' Файлы и данные</summary><div>'+
  qwButton('bank-import','Импорт QWBANK')+qwButton('bank-export','Экспорт QWBANK v1/v2')+
  qwButton('bank-backup','Создать резервную копию')+qwButton('bank-restore','Восстановить из копии')+
  qwButton('bank-clean-assets','Очистить вложения')+(qoNativeDesktop?
   '<button type="button" id="qw-native-folder">Открыть папку данных</button><button type="button" id="qw-native-snapshot">Снимок SQLite</button>':'')+
  '</div></details>';
 const d=qwDialog('Банк заданий',catalogue+
  '<input type="file" id="qw-bank-import-file" accept=".qwbank,application/json" hidden>'+
  '<input type="file" id="qw-bank-restore-file" accept=".qwbank,.json,application/json" hidden>',
  '<div class="qw-bank-storage-bar"><span id="qw-bank-storage-count">'+qwBankStorageName+' · '+totalCount+'</span>'+
  '<span id="qw-bank-save-status" role="status"></span>'+qwButton('bank-cancel-backup','Отмена','hidden')+'</div>',bankPage==='bank'?true:'bank');
 d.classList.add('qw-bank-assemble-dialog');
 const toolbar=document.createElement('div');
 toolbar.className='qw-bank-toolbar';
 toolbar.innerHTML='<input id="qw-bank-search" type="search" aria-label="Поиск по банку" placeholder="Номер, условие, ответ или тема">'+
  qwButton('bank-new',qoWorkIcon('plus')+'<span>Задание</span>','class="qw-primary" aria-label="Новое задание" title="Новое задание"')+
  qwButton('bank-add-selection','Добавить выбранные','disabled')+
  qwButton('bank-assemble','Собрать вариант → PDF','disabled')+operations;
 const header=d.querySelector('header');
 d.setAttribute('aria-label','Банк заданий');
 header.querySelector('strong').hidden=true;
 header.prepend(toolbar);
 const workspace=d.querySelector('.qw-bank-catalogue');
 qwInstallPanels(workspace,'bank',toolbar,{
  left:['.qw-bank-navigation','Категории'],right:['.qw-bank-catalogue-results','Каталог',1]
 });
 const menu=toolbar.querySelector('.qw-bank-operations');
 toolbar.addEventListener('focusout',event=>{
  if(menu.open&&!menu.contains(event.relatedTarget))menu.open=false;
 });
 d.querySelector('.qw-dialog-body').insertAdjacentHTML('afterbegin',
  '<section id="qw-bank-restore-review" class="qw-bank-restore-review" hidden aria-label="Проверенная резервная копия">'+
   '<h3>Проверка резервной копии</h3><p id="qw-bank-restore-detail"></p>'+
   '<p id="qw-bank-restore-warning"></p>'+
   '<button type="button" id="qw-bank-backup-current" hidden>Скачать защитную копию текущего банка</button>'+
   '<label id="qw-bank-restore-accept-label" hidden><input type="checkbox" id="qw-bank-restore-accept"> Подтверждаю замену заданий после сохранения защитной копии</label>'+
   '<button type="button" id="qw-bank-restore-confirm" class="qw-primary">Восстановить в пустой банк</button>'+
   '<button type="button" id="qw-bank-restore-dismiss">Отмена</button></section>');
 const get=k=>d.querySelector('#qw-bank-'+k),pick=k=>get(k).value;
 const state=d.querySelector('#qw-bank-save-status');
 if(qoNativeDesktop){d.querySelector('#qw-native-folder').onclick=()=>qwBankRepository.openDataFolder().catch(e=>status(e.message,true));d.querySelector('#qw-native-snapshot').onclick=()=>qwBankRepository.nativeSnapshot().then(x=>status('Снимок SQLite: '+x.path)).catch(e=>status(e.message,true));}
 const reportStatus=(message,bad=false)=>{state.textContent=message;state.classList.toggle('qw-error',bad);};
 if(assetMigrationError)reportStatus('Перенос изображений не завершён: '+assetMigrationError,true);
 const list=get('list');
 const preview=get('preview');
 const previewPane=preview.parentElement;
 const results=list.parentElement;
 const previousPage=d.querySelector('[data-bank-page="prev"]');
 const nextPage=d.querySelector('[data-bank-page="next"]');
 let previewSequence=0,previewId='',catalogueScroll=0,searchTimer,queryError='',paperView=false,rezoomPreview=()=>{};
 const previewZoom={percent:100,fit:''};
 function setQueryPending(on){
  results.setAttribute('aria-busy',String(on));
  workspace.classList.toggle('qw-bank-query-pending',on);
  list.inert=on;
  if(on){
   previousPage.disabled=true;nextPage.disabled=true;
   get('count').textContent='Загрузка…';
  }
 }
 function fillCategories(saved={}){
  for(const key of facetKeys){
   const control=get(key),value=saved[key]||control.value||'all';
   const names=new Set(facets[key]||[]);
   if(value!=='all')names.add(value);
   const sorted=[...names].sort((a,b)=>key==='year'?Number(b)-Number(a):a.localeCompare(b,'ru',{numeric:true}));
   control.innerHTML=qwOptions([['all','Все'],...sorted.map(name=>[name,name])],value);
  }
 }
 const summary=qwTaskSummary;
 const readFilters=()=>Object.fromEntries(filterKeys.map(key=>[key,pick(key)]));
 const viewState=()=>({...readFilters(),search:pick('search'),__view:activeId,__offset:pageOffset,
  __scroll:list.scrollTop,__navScroll:get('filters').scrollTop,__selected:[...selected.keys()],
  __advanced:d.querySelector('.qw-bank-extra-filters').open});
 const markSelection=()=>{
  get('selected-count').textContent='Выбрано: '+selected.size;
  for(const key of ['bank-add-selection','bank-assemble'])d.querySelector('[data-qw-action="'+key+'"]').disabled=addPending||!selected.size;
  for(const button of d.querySelectorAll('[data-bank-add],[data-diag-bank]'))button.disabled=addPending;
 };
 function setEnlarged(on){
  if(on)catalogueScroll=list.scrollTop;
  d.classList.toggle('qw-bank-expanded',on);
  const button=d.querySelector('[data-bank-enlarge]');
  if(button){
   button.textContent=on?'Свернуть':'Увеличить';
   button.setAttribute('aria-pressed',String(on));
   button.focus({preventScroll:true});
  }
  if(!on)list.scrollTop=catalogueScroll;
  rezoomPreview();
  qwRefreshLiveGraphText(preview);
 }
 function setPaperView(on){
  paperView=on;
  previewPane.classList.toggle('qw-bank-paper-view',on);
  const button=preview.querySelector('[data-bank-paper]');
  if(button)button.setAttribute('aria-pressed',String(on));
 }
 async function showPreview(){
  const token=++previewSequence,id=activeId;
  for(const row of list.querySelectorAll('[data-bank-entry]')){
   const current=row.dataset.bankEntry===id;
   row.classList.toggle('is-active',current);
   row.querySelector('[data-bank-view]').setAttribute('aria-current',String(current));
  }
  if(id&&id===previewId)return;
  previewId='';
  if(!id){preview.textContent='';return;}
  previewPane.scrollTop=0;
  preview.textContent='';
  let entry;
  try{entry=await qwBankRepository.getTask(id);}
  catch(error){
   if(token===previewSequence&&d.isConnected){preview.textContent='Не удалось открыть задание: '+error.message;reportStatus(error.message,true);}
   return;
  }
  if(token!==previewSequence||id!==activeId||!d.isConnected||!sameWorkspace())return;
  if(!entry)return;
  previewId=id;
  const task=entry.task;
  const subject=QW_SUBJECTS[entry.subject]||entry.subject;
  const designation=(entry.exam==='ege'?'ЕГЭ':entry.exam==='oge'?'ОГЭ':'Практика')+
   (entry.grade?' · '+entry.grade+' класс':'')+(entry.year?' · '+entry.year:'')+(entry.slot?' · № '+entry.slot:'');
  const paper=qwTaskPreview(task,entry.slot?Number(entry.slot)-1:pageOffset+Math.max(0,xs.findIndex(item=>item.id===entry.id)),'worksheet',false,null,true,entry.bankNumber);
  preview.innerHTML='<div class="qw-bank-preview-toolbar"><div class="qw-bank-preview-meta">'+
   (task.title?'<strong>'+qwEsc(task.title)+'</strong>':'')+'<span>'+qwEsc(subject+' · '+designation)+'</span>'+
   (entry.topic?'<small>'+qwEsc(entry.topic+(entry.subtopic?' / '+entry.subtopic:''))+'</small>':'')+'</div>'+
   '<div class="qw-bank-preview-actions"><button type="button" class="qw-primary" data-bank-add="'+qwEsc(entry.id)+'">Добавить в работу</button>'+
   '<button type="button" data-bank-edit="'+qwEsc(entry.id)+'">Редактировать</button>'+
   '<button type="button" data-bank-paper aria-pressed="false">Белый лист</button>'+
   '<button type="button" data-bank-enlarge aria-pressed="false">Увеличить</button>'+
   '<div class="qw-bank-zoom">'+qwPublishZoomControls()+'</div>'+
   '<button type="button" data-bank-delete="'+qwEsc(entry.id)+'" aria-label="Удалить из банка" title="Удалить из банка">'+qoWorkIcon('trash-2')+'</button></div></div>'+
   '<div class="qw-bank-study-page"><div class="qw-bank-video-canvas" aria-label="Просмотр условия задачи">'+paper+'</div>'+qwStudySolution(task)+'</div>';
  setPaperView(paperView);
  const sheet=preview.querySelector('.qw-bank-study-page');
  rezoomPreview=qwBindZoom(preview.querySelector('.qw-zoom'),previewZoom,[previewPane],()=>{
   const width=Math.min(760,previewPane.clientWidth-28);
   sheet.style.setProperty('--qw-bank-preview-width',width+'px');
   return {view:previewPane,width,height:sheet.offsetHeight+44};
  },scale=>{sheet.style.setProperty('--qw-bank-preview-zoom',scale);qwRefreshLiveGraphText(sheet);});
  qwRefreshLiveGraphText(preview);
  const illustration=preview.querySelector('img[alt="Иллюстрация задания"]');
  if(illustration){const failed=()=>{if(token===previewSequence&&d.isConnected)reportStatus('Изображение повреждено. Исходные данные сохранены; можно заменить рисунок через редактирование.',true);};illustration.addEventListener('error',failed,{once:true});if(illustration.complete&&!illustration.naturalWidth)failed();}
 }
 const refresh=async(listScroll=null)=>{
  if(!d.isConnected||!sameWorkspace())return;
  const token=++requestSequence;
  const query=readFilters();
  query.search=pick('search').toLocaleLowerCase('ru-RU').trim();
  setQueryPending(true);
  let result;
  try{result=await qwBankRepository.listTasks(query,{offset:pageOffset,limit:pageSize,includeImages:false});}
  catch(e){if(token===requestSequence&&d.isConnected&&sameWorkspace()){
   ++previewSequence;previewId='';activeId='';xs=[];
   list.replaceChildren();preview.replaceChildren();
   get('page').textContent='';get('count').textContent='Ошибка чтения';
   setQueryPending(false);
   queryError=e.message;reportStatus(queryError,true);
  }return;}
  if(token!==requestSequence||!d.isConnected||!sameWorkspace())return;
  const lastOffset=Math.max(0,Math.floor((result.total-1)/pageSize)*pageSize);
  if(pageOffset>lastOffset){pageOffset=lastOffset;return refresh(listScroll);}
  if(queryError&&state.textContent===queryError)reportStatus('');
  queryError='';
  xs=result.items;
  get('count').textContent='Найдено: '+result.total+' / '+totalCount;
  d.querySelector('#qw-bank-page').textContent=result.total?String(pageOffset+1)+'–'+String(pageOffset+xs.length)+' из '+result.total:'0';
  previousPage.disabled=pageOffset===0;
  nextPage.disabled=!result.hasMore;
  const advanced=advancedKeys.filter(key=>query[key]!=='all');
  d.querySelector('[data-bank-reset]').setAttribute('aria-pressed',String(!query.search&&filterKeys.every(key=>query[key]==='all')));
  for(const key of filterKeys)get(key).classList.toggle('is-filtered',query[key]!=='all');
  d.querySelector('.qw-bank-extra-filters summary').textContent='Дополнительные фильтры'+(advanced.length?' · применено: '+advanced.length:'');
  const scroll=list.scrollTop;
  const items=xs.map(x=>{
   const id=qwEsc(x.id);
   const number=String(x.bankNumber).padStart(5,'0');
   const label=summary(x.task.title||x.task.prompt)||QW_TYPES[x.task.type];
   const tags=[QW_SUBJECTS[x.subject]||x.subject,x.grade?x.grade+' кл.':'',bankExams[x.exam],x.year,x.topic,x.subtopic].filter(Boolean).join(' · ');
   return '<div class="qw-bank-item qw-bank-choice" data-bank-entry="'+id+'">'+
    '<input type="checkbox" data-bank-select="'+id+'" '+(selected.has(x.id)?'checked':'')+' aria-label="Выбрать задание № '+number+'">'+
    '<button type="button" data-bank-view="'+id+'" title="'+qwEsc(label)+'">'+
     '<span class="qw-bank-row-main"><b class="qw-bank-number">№ '+number+'</b><span class="qw-bank-summary">'+qwEsc(label)+'</span></span><small>'+qwEsc(tags)+'</small></button></div>';
  }).join('');
  const applicable=['subject','grade','topic','type'];
  const diagnosticExtra=['exam','year','part','slot','difficulty','subtopic','origin'];
  const diag=diagnostic.filter(x=>{
   if(diagnosticExtra.some(key=>query[key]!=='all'))return false;
   const taskType=x.question?.type==='practice'?'extended':'short';
   const values={...x,type:taskType};
   return applicable.every(key=>query[key]==='all'||values[key]===query[key])&&
    [x.question?.prompt,x.question?.answer,x.topic].some(value=>String(value||'').toLocaleLowerCase('ru-RU').includes(query.search));
  }).slice(0,pageSize);
  const other=!pageOffset&&diag.length?'<h3>Из диагностики</h3>'+diag.map(x=>
   '<div class="qw-bank-item qw-bank-diagnostic"><span>'+qwEsc(summary(x.question?.prompt))+'</span>'+
   '<button type="button" data-diag-bank="'+qwEsc(x.id)+'">Добавить</button></div>').join(''):'';
  list.innerHTML=items+other||'<p class="qw-muted">Заданий не найдено</p>';
  if(!xs.some(x=>x.id===activeId))activeId=xs[0]?.id||'';
  if(listScroll!==null)list.scrollTop=listScroll;
  else list.scrollTop=scroll;
  markSelection();
  const rendering=showPreview();
  setQueryPending(false);
  await rendering;markSelection();
 };

 let backupController=null,restoreController=null,restorePlan=null,protectionRequested=false,restoreBusy=false;
 const backupButton=d.querySelector('[data-qw-action="bank-backup"]');
 const restoreButton=d.querySelector('[data-qw-action="bank-restore"]');
 const cancelBackup=d.querySelector('[data-qw-action="bank-cancel-backup"]');
 const restoreFile=d.querySelector('#qw-bank-restore-file');
 const review=d.querySelector('#qw-bank-restore-review');
 const accept=d.querySelector('#qw-bank-restore-accept');
 const confirmRestore=d.querySelector('#qw-bank-restore-confirm');
 const protectButton=d.querySelector('#qw-bank-backup-current');
 const acceptLabel=d.querySelector('#qw-bank-restore-accept-label');
 const details=d.querySelector('#qw-bank-restore-detail');
 const warning=d.querySelector('#qw-bank-restore-warning');
 d.addEventListener('close',()=>{clearTimeout(searchTimer);backupController?.abort();restoreController?.abort();qwBankRepository.cancelRestore();});
 cancelBackup.onclick=()=>{backupController?.abort();};
 async function bankMakeCopy(protect=false){
  if(backupController)throw Error('Операция резервного копирования уже выполняется');
  const ctrl=new AbortController();backupController=ctrl;
  backupButton.disabled=true;restoreButton.disabled=true;cancelBackup.hidden=false;
  try{
   const archive=await qwBankRepository.createVerifiedBackup({
    signal:ctrl.signal,onProgress:message=>reportStatus(message)
   });
   if(ctrl.signal.aborted)throw Error('Операция отменена');
   reportStatus('Проверен SHA-256. Подготовка скачивания…');
   await new Promise(resolve=>setTimeout(resolve,0));
   const text=JSON.stringify(archive);
   if(ctrl.signal.aborted)throw Error('Операция отменена');
   const saved=await download((protect?'QuantumOffice_банк_защитная_копия_':'QuantumOffice_банк_SHA256_')+
    new Date().toISOString().slice(0,10)+'.qwbank',text,'application/json;charset=utf-8');
   if(qoNativeDesktop&&saved!==true)throw Error('Файл не сохранён');
   reportStatus(qoNativeDesktop?'Архив проверен SHA-256 и сохранён.':'Архив проверен SHA-256, скачивание запрошено. Проверьте, что файл появился на диске.');
   return archive;
  }finally{
   backupController=null;backupButton.disabled=false;restoreButton.disabled=false;cancelBackup.hidden=true;
  }
 }
 backupButton.onclick=async()=>{
  try{await bankMakeCopy();}
  catch(e){reportStatus('Копия не создана: '+e.message,true);}
 };
 function dismissRestore(){
  if(restoreBusy){restoreController?.abort();reportStatus('Прерывание восстановления…');return;}
  review.hidden=true;restorePlan=null;protectionRequested=false;accept.checked=false;
  qwBankRepository.cancelRestore();
 }
 d.querySelector('#qw-bank-restore-dismiss').onclick=dismissRestore;
 restoreButton.onclick=()=>{dismissRestore();restoreFile.click();};
 restoreFile.onchange=async()=>{
  const file=restoreFile.files?.[0];restoreFile.value='';if(!file)return;
  restoreButton.disabled=true;
  try{
   if(file.size>260_000_000)throw Error('Архив слишком большой (максимум 260 МБ)');
   reportStatus('Чтение файла, проверка структуры и SHA-256…');
   const inspected=await qwBankRepository.inspectRestore(await file.text());
   if(!d.isConnected){qwBankRepository.cancelRestore();return;}
   restorePlan=inspected;protectionRequested=false;accept.checked=false;
   details.textContent='Создан: '+new Date(inspected.createdAt).toLocaleString('ru-RU')+
    ' · заданий: '+inspected.count+' · формат v'+inspected.version+
    ' · SHA-256 проверен · '+Math.ceil(inspected.bytes/1024)+' КБ';
   const hasOld=inspected.currentCount>0;
   warning.textContent=hasOld?
    'В банке уже есть '+inspected.currentCount+' заданий. Замена необратима без отдельной копии. Перед заменой скачайте защитную копию и проверьте её на диске.':
    'Банк пуст. Записи и постоянные номера будут восстановлены из проверенного архива.';
   protectButton.hidden=!hasOld;
   acceptLabel.hidden=!hasOld;
   confirmRestore.textContent=hasOld?'Заменить существующий банк':'Восстановить в пустой банк';
   confirmRestore.disabled=hasOld;
   review.hidden=false;
   reportStatus('Архив проверен, данные не изменены. Выберите действие.');
  }catch(e){dismissRestore();reportStatus('Восстановление запрещено: '+e.message,true);}
  finally{restoreButton.disabled=false;}
 };
 protectButton.onclick=async()=>{
  try{
   await bankMakeCopy(true);
   protectionRequested=true;
   warning.textContent='Защитный файл запрошен на скачивание. Убедитесь, что он сохранён и открывается, прежде чем продолжать.';
   confirmRestore.disabled=!accept.checked;
  }catch(e){reportStatus('Не удалось подготовить защитную копию: '+e.message,true);}
 };
 accept.onchange=()=>{confirmRestore.disabled=!protectionRequested||!accept.checked;};
 confirmRestore.onclick=async()=>{
  if(restoreBusy||!restorePlan)return;
  const plan=restorePlan,mode=plan.currentCount?'replace':'empty';
  if(mode==='replace'&&(!protectionRequested||!accept.checked))return;
  if(mode==='replace'&&!confirm('Заменить '+plan.currentCount+
   ' существующих заданий на '+plan.count+
   ' из проверенной копии? Отмена после записи невозможна.'))return;
  restoreBusy=true;confirmRestore.disabled=true;restoreButton.disabled=true;
  restoreController=new AbortController();
  try{
   reportStatus('Атомарное восстановление '+qwBankStorageName+'. Можно нажать «Отмена», чтобы прервать незавершённую транзакцию.');
   const outcome=await qwBankRepository.restoreVerifiedBackup({token:plan.token,mode,signal:restoreController.signal});
   totalCount=(await qwBankSnapshotSmall()).count;
   facets=await qwBankRepository.listFacets(facetKeys);
   d.querySelector('#qw-bank-storage-count').textContent=qwBankStorageName+' · '+totalCount;
   fillCategories();pageOffset=0;previewId='';await refresh(0);
   dismissRestore();
   reportStatus('Восстановлено и повторно проверено: '+outcome.restored+' заданий. Счётчик номеров сохранён.');
  }catch(e){
   reportStatus('Восстановление не подтверждено: '+e.message,true);
  }finally{restoreController=null;restoreBusy=false;restoreButton.disabled=false;if(restorePlan)confirmRestore.disabled=false;}
 };

 d.querySelector('[data-qw-action="bank-export"]').onclick=async()=>{
  try{
   reportStatus('Подготовка экспорта…');
   const payload=await qwBankRepository.exportBank();
   const saved=await download('QuantumOffice_банк_заданий.qwbank',JSON.stringify(payload,null,2),'application/json');
   if(qoNativeDesktop&&saved!==true){reportStatus('QWBANK не сохранён: отмена или ошибка записи.',true);return;}
   reportStatus(qoNativeDesktop?'QWBANK сохранён. Это отдельная копия данных.':'Скачивание QWBANK запрошено. Проверьте файл на диске.');
  }catch(e){reportStatus('Экспорт не выполнен: '+e.message,true);status('Банк: '+e.message,true);}
 };
 d.querySelector('[data-qw-action="bank-clean-assets"]').onclick=async()=>{
  try{
   const before=await qwBankRepository.assetDiagnostics();
   if(!before.orphans){reportStatus('Неиспользуемых изображений нет.');return;}
   if(!confirm('Удалить '+before.orphans+' неиспользуемых изображений? Используемые задания останутся без изменений.'))return;
   const result=await qwBankRepository.assetDiagnostics({clean:true});reportStatus('Удалено неиспользуемых изображений: '+result.deleted);
  }catch(error){reportStatus('Очистка не выполнена: '+error.message,true);}
 };
 const fileInput=d.querySelector('#qw-bank-import-file');
 d.querySelector('[data-qw-action="bank-import"]').onclick=()=>fileInput.click();
 fileInput.onchange=async()=>{
  const file=fileInput.files?.[0];fileInput.value='';if(!file)return;
  try{
   if(file.size>240_000_000)throw Error('Файл больше 240 МБ — проверьте тип архива');
   reportStatus('Проверка файла и импорт…');
   const imported=await qwBankRepository.importBank(JSON.parse(await file.text()));
   totalCount=(await qwBankSnapshotSmall()).count;
   facets=await qwBankRepository.listFacets(facetKeys);
   d.querySelector('#qw-bank-storage-count').textContent=qwBankStorageName+' · '+totalCount;
   fillCategories();pageOffset=0;previewId='';await refresh(0);
   reportStatus('Сохранено: '+imported.imported+' · пропущено совпадений: '+imported.skipped);
  }catch(error){
   reportStatus('Импорт не выполнен: '+error.message,true);
   status('Импорт банка: '+error.message,true);
  }
 };
 // TASK166.3 final: one in-flight hydration per dialog. Capture document identity,
 // not just its ID (reopening the same file also creates a different model).
 const canAdd=()=>d.isConnected&&d.open&&sameWorkspace();
 async function loadAndAdd(ids,{replace=false,single=false}={}){
  if(addPending||!canAdd()||!ids.length)return;
  addPending=true;d.setAttribute('aria-busy','true');markSelection();
  reportStatus('Загрузка выбранных заданий и изображений…');
  try{
   const found=await Promise.all(ids.map(id=>qwBankRepository.getTask(id)));
   if(!canAdd())return;
   if(found.some((entry,i)=>!entry||entry.id!==ids[i]||!entry.task))
    throw Error('Выбранное задание недоступно. Ничего не добавлено.');
   // Unmigrated legacy rows may still contain invalid raster data. Do not
   // append an incomplete task even if its database read was successful.
   for(const image of new Set(found.filter(e=>e.task.figure==='image').map(e=>e.task.image))){
    if(!image)throw Error('Изображение недоступно. Ничего не добавлено.');
    await qwImage(image);
    if(!canAdd())return;
   }
   if(canAdd())addTasks(found,replace,single);
  }catch(error){
   if(canAdd())reportStatus('Добавление не выполнено: '+error.message,true);
  }finally{
   addPending=false;d.removeAttribute('aria-busy');
   if(d.isConnected&&d.open)markSelection();
  }
 }
 function addTasks(choices,replace=false,single=false){
  if(!canAdd())return;
  if(!choices.length)return;
  if(choices.length+(replace?0:qwDoc.tasks.length)>80){status('В одной работе не более 80 заданий',true);return;}
  if(replace&&qwDoc.tasks.length&&!confirm('Заменить текущую работу выбранными заданиями? Сначала сохраните QWORK при необходимости.'))return;
  const copies=choices.map(entry=>{
   const t=structuredClone(entry.task);t.id=qwId();
   if(single)return t; // Preserve the historical single-copy QWORK semantics.
   t.source=qwBankSource(entry);
   t.grade=entry.grade;t.exam=entry.exam;t.topic=entry.topic;t.subtopic=entry.subtopic;
   t.part=entry.part?'Часть '+entry.part:'';
   return t;
  });
  qwChange(()=>{
   if(replace){
    const result=qwProject();result.layout='booklet';
    const subject=choices.every(x=>x.subject===choices[0].subject)?choices[0].subject:'mixed';
    result.subject=Object.hasOwn(QW_SUBJECTS,subject)?subject:'mixed';
    const year=choices.every(x=>x.year&&x.year===choices[0].year)?choices[0].year:'';
    const exam=choices.every(x=>x.exam===choices[0].exam)?choices[0].exam:'general';
    result.exam=exam==='oge'?'oge':'ege';
    result.grade=choices.every(x=>x.grade===choices[0].grade)?choices[0].grade:'11';
    result.title=(exam==='ege'?'Аналоги ЕГЭ':exam==='oge'?'Аналоги ОГЭ':'Сборник заданий')+(year?' '+year:'');
    result.printSettings={...qwPrintSettings(),profile:'exam',fontPt:10.5,showTitle:true,titleText:result.title,
      showMeta:false,showVariant:false,bodyFont:'serif',titleFont:'sans'};
    result.tasks=copies;qwDoc=result;
   }else qwDoc.tasks.push(...copies);
   qwSelected=copies[0].id;
  });
  d.close();
  if(bankPage==='bank')route('work');
  if(replace)qwPreview();
 }
 function filterChanged(delay=0){
  clearTimeout(searchTimer);
  // Invalidate both outstanding queries and preview loads at input time, even
  // while the replacement search is still waiting for its debounce interval.
  ++requestSequence;++previewSequence;
  previewId='';pageOffset=0;
  setQueryPending(true);
  if(delay)searchTimer=setTimeout(()=>void refresh(0),delay);
  else void refresh(0);
 }
 const searchInput=get('search');
 searchInput.addEventListener('input',event=>{if(!event.isComposing)filterChanged(180);});
 searchInput.addEventListener('compositionend',()=>filterChanged(180));
 get('filters').addEventListener('change',event=>{if(event.target.matches('select'))filterChanged();});
 const subjectButtons=[...d.querySelectorAll('[data-bank-subject]')];
 function setSubject(subject){
  get('subject').value=subject;
  for(const button of subjectButtons)button.setAttribute('aria-pressed',String(button.dataset.bankSubject===subject));
 }
 for(const button of subjectButtons)button.onclick=()=>{
  if(pick('subject')===button.dataset.bankSubject)return;
  setSubject(button.dataset.bankSubject);filterChanged();
 };
 d.querySelector('[data-bank-reset]').onclick=()=>{
  const query=readFilters();
  if(!searchInput.value&&filterKeys.every(key=>query[key]==='all'))return;
  for(const key of filterKeys)get(key).value='all';
  setSubject('all');searchInput.value='';filterChanged();
 };
 d.querySelectorAll('[data-bank-page]').forEach(button=>button.onclick=()=>{
  if(workspace.classList.contains('qw-bank-query-pending'))return;
  clearTimeout(searchTimer);
  ++previewSequence;
  pageOffset=Math.max(0,pageOffset+(button.dataset.bankPage==='next'?pageSize:-pageSize));
  void refresh(0);
 });
 d.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  if(d.classList.contains('qw-bank-expanded')){
   event.preventDefault();event.stopPropagation();setEnlarged(false);
  }else if(menu.open){
   event.preventDefault();menu.open=false;menu.querySelector('summary').focus();
  }
 });
 d.addEventListener('change',e=>{
  const checkbox=e.target.closest('[data-bank-select]');
  if(!checkbox)return;
  const id=checkbox.dataset.bankSelect;
  if(checkbox.checked){if(selected.size>=80){checkbox.checked=false;status('Для одного варианта можно выбрать до 80 заданий',true);return;}selected.set(id,true);}
  else selected.delete(id);
  markSelection();
 });
 d.onclick=e=>{
  const action=e.target.closest('[data-qw-action]')?.dataset.qwAction;
  if(menu.open&&!e.target.closest('summary'))menu.open=false;
  if(workspace.classList.contains('qw-bank-query-pending')&&e.target.closest('.qw-bank-catalogue-results,.qw-bank-catalogue-preview'))return;
  if(action==='bank-new'){qwBankEdit(null,null,viewState());return;}
  const row=e.target.closest('[data-bank-entry]');
  if(row&&(!e.target.closest('button,input')||e.target.closest('[data-bank-view]'))){
   activeId=row.dataset.bankEntry;void showPreview();return;
  }
  if(e.target.closest('[data-bank-enlarge]')){setEnlarged(!d.classList.contains('qw-bank-expanded'));return;}
  if(e.target.closest('[data-bank-paper]')){setPaperView(!paperView);return;}
  if(action==='bank-assemble'){void loadAndAdd([...selected.keys()],{replace:true});return;}
  if(action==='bank-add-selection'){void loadAndAdd([...selected.keys()]);return;}
  const edit=e.target.closest('[data-bank-edit]');
  if(edit){qwBankEdit(edit.dataset.bankEdit,null,viewState());return;}
  const add=e.target.closest('[data-bank-add],[data-diag-bank]'),del=e.target.closest('[data-bank-delete]');
  if(add){
   if(addPending||!canAdd())return;
   const bankId=add.dataset.bankAdd;
   if(bankId){void loadAndAdd([bankId],{single:true});return;}
   const item=diagnostic.find(x=>x.id===add.dataset.diagBank);
   const task=item?qwFromDiagnostic(item.question||item):null;
   if(task&&qwDoc.tasks.length<80){qwChange(()=>{const copy=structuredClone(task);copy.id=qwId();qwDoc.tasks.push(copy);qwSelected=copy.id;});d.close();if(bankPage==='bank')route('work');}
   else status('Не удалось добавить задание',true);
  }
  if(del&&confirm('Удалить задание из личного банка?')){
   const entry=xs.find(x=>x.id===del.dataset.bankDelete);
   if(!entry)return;
   void (async()=>{
    try{
     await qwBankRepository.deleteTask(entry.id,entry.revision);
     totalCount=(await qwBankSnapshotSmall()).count;
     facets=await qwBankRepository.listFacets(facetKeys);
     d.querySelector('#qw-bank-storage-count').textContent=qwBankStorageName+' · '+totalCount;
     selected.delete(entry.id);if(activeId===entry.id)activeId='';
     fillCategories();previewId='';await refresh();
     reportStatus('Удаление подтверждено базой данных.');
    }catch(e){reportStatus('Удаление не выполнено: '+e.message,true);status(e.message,true);}
   })();
  }
 };
 fillCategories(previousFilters);
 setSubject(subjectButtons.some(button=>button.dataset.bankSubject===previousFilters.subject)?previousFilters.subject:'all');
 for(const key of filterKeys){
  if(key==='subject')continue;
  const input=get(key),value=previousFilters[key];
  if([...input.options].some(option=>option.value===value))input.value=value;
 }
 searchInput.value=previousFilters.search||'';
 d.querySelector('.qw-bank-extra-filters').open=!!previousFilters.__advanced||advancedKeys.some(key=>pick(key)!=='all');
 get('filters').scrollTop=previousFilters.__navScroll||0;
 void refresh(previousFilters.__scroll??0);
}
function qwExample(subject='physics'){
 const d=qwProject();d.title=subject==='math'?'Математика · тренировочная работа':'Физика · движение и тепловые явления';d.subject=subject;d.topic='Тренировочный вариант';d.instructions='Запишите краткие ответы и оформите решения. Графики и схемы используйте для обоснования.';
 const data=subject==='math'?[['short','Вычислите \\(\\frac{3}{4}+\\frac{1}{8}\\).','7/8'],['extended','Решите уравнение \\(x^{2}-5x+6=0\\). Обоснуйте ответ.','2; 3'],['graph','По графику определите значение y при x = 4.','6'],['diagram','На рисунке изображён прямоугольный треугольник ABC. Катеты AB = 6 см и AC = 4 см. Найдите его площадь.','12 см²'],['blanks','Заполните: \\(\\sqrt{81}\\) = [[blank:3]], \\(2^{5}\\) = [[blank:4]].','9; 32'],['combined','По графику функции определите промежутки возрастания и убывания, найдите наибольшее значение. Обоснуйте ответ.','Возрастает на [0; 2], убывает на [6; 9], наибольшее значение — 6.']]:[['short','Тело прошло 120 м за 15 с. Найдите среднюю скорость \\(v=\\frac{s}{t}\\), м/с.','8'],['extended','Воду массой 2 кг нагрели от 20 °C до 30 °C. Удельная теплоёмкость воды 4200 Дж/(кг·°C). Найдите количество теплоты и запишите формулу \\(Q=cm\\Delta t\\).','84 000 Дж'],['graph','На рисунке приведена зависимость скорости от времени. Найдите путь за первые 6 с.','30 м'],['diagram','На тело действуют две силы. Изобразите и опишите направление равнодействующей.','Вдоль большей силы'],['blanks','Заполните обозначения: сила — [[blank:3]], энергия — [[blank:3]], единица давления — [[blank:4]].','F; E; Па'],['combined','Ученик исследовал движение тележки по горизонтальной дорожке. Датчик регистрировал скорость через равные промежутки времени, а программа построила график зависимости v(t). Направление движения тележки приняли за положительное. Во время опыта тележка разгонялась, затем некоторое время двигалась с постоянной скоростью и наконец тормозила. Масса тележки и состояние поверхности дорожки не менялись.\n\nПеред началом работы ученик проверил показания датчика на неподвижной тележке. Опыт повторили три раза при одинаковых настройках привода. Полученные графики имели одинаковую форму, однако отдельные показания скорости немного различались. На рисунке приведён один из результатов измерений; значения времени указаны в секундах, скорости — в метрах в секунду.\n\nа) Укажите интервал равномерного движения и значение скорости на нём. б) Сравните модули ускорения при разгоне и торможении. в) Найдите путь тележки за весь показанный промежуток времени и объясните геометрический смысл расчёта. г) Предложите способ оценки погрешности результата по повторным измерениям.','Равномерное движение от 2 до 6 с; скорость 6 м/с. Модули ускорения: 3 м/с² при разгоне и 2 м/с² при торможении. Площадь под графиком — путь; за 9 с путь равен 39 м. Погрешность можно оценить по разбросу повторных измерений.']];
 d.tasks=data.map(([type,prompt,answer],i)=>{const q=qwTask(type);q.prompt=prompt;q.answer=answer;q.criteria='1 балл — правильная зависимость; 1 балл — обоснование.';q.comment='Допустим другой обоснованный способ решения.';q.graph.points=[{x:0,y:0,label:'A'},{x:2,y:6,label:'B'},{x:6,y:6,label:'C'},{x:9,y:0,label:'D'}];if(subject==='math'){q.graph.xlabel='x';q.graph.ylabel='y';}q.diagram=[{kind:'rect',x:180,y:120,x2:330,y2:220,label:'Тело'},{kind:'arrow',x:330,y:170,x2:470,y2:170,label:'F₁'},{kind:'arrow',x:180,y:170,x2:80,y2:170,label:'F₂'}];if(subject==='math'){q.diagram=qwValidateDiagram([{kind:'rightTriangle',x:130,y:70,x2:390,y2:260,label:'',vertices:[{x:130,y:260,label:'A'},{x:390,y:260,label:'B'},{x:130,y:70,label:'C'}],edgeLabels:['6 см','','4 см']}]);if(type==='graph'){Object.assign(q.graph,{xmin:-5,xmax:5,ymin:0,ymax:10,curveFamily:'quadratic',xlabel:'x',ylabel:'y',points:[]});q.graph.curve={...q.graph.curve,a:.375,b:0,c:0};}}if(i>3)q.part='Часть 2';if(type==='combined'){q.position='below';q.figureWidth=360;q.solutionHeight=170;}return q;});return d;
}
const QW_VISUAL_TOOLS=[
 ['ray','Луч'],['infiniteLine','Прямая'],['parallel','Параллельная прямая'],['perpendicular','Перпендикуляр'],['midpoint','Середина отрезка'],['angleBisector','Биссектриса угла'],['perpendicularBisector','Серединный перпендикуляр'],['equalMarks','Равные отрезки'],
 ['select','Выбрать и переместить'],['point','Точка'],['line','Отрезок'],
 ['polyline','Ломаная'],['arc','Дуга окружности'],['dimension','Размерная линия'],['doubleArrow','Двусторонняя стрелка'],
 ['arrow','Вектор / стрелка'],['dashed','Пунктир'],['rope','Нить / верёвка'],
 ['rect','Прямоугольник'],['circle','Окружность'],['ellipse','Эллипс'],['regularPolygon','Правильный многоугольник'],['text','Текстовая подпись'],
 ['angle','Угол'],['triangle','Треугольник'],['rightTriangle','Прямоугольный треугольник'],
 ['quadrilateral','Четырёхугольник'],['block','Брусок'],['incline','Наклонная плоскость'],
 ['pulley','Неподвижный блок'],['movablePulley','Подвижный блок'],['spring','Пружина'],['ground','Опора'],
 ['forceVector','Вектор силы'],['velocityVector','Вектор скорости'],['accelerationVector','Вектор ускорения'],['torque','Момент силы'],['dynamometer','Динамометр'],['weightSet','Система грузов'],
 ['resistor','Резистор'],['rheostat','Реостат'],['cell','Элемент питания'],['battery','Батарея'],['lamp','Лампа'],['switchOpen','Выключатель разомкнут'],['switchClosed','Выключатель замкнут'],
 ['ammeter','Амперметр'],['voltmeter','Вольтметр'],['wireOrth','Проводник'],['junction','Узел']
];
function qwVisualIcon(kind){
 const paths={
 ray:'<circle cx="4" cy="18" r="2"/><path d="M4 18L23 2"/>',
 infiniteLine:'<path d="M1 22L23 2"/>',parallel:'<path d="M2 15L15 2M9 22L22 9"/>',
 perpendicular:'<path d="M2 20h20M12 20V2M12 15h5v5"/>',equalMarks:'<path d="M2 16h20M10 11l-3 10m10-10l-3 10"/>',
 select:'<path d="M4 3l2 16 4-4 4 6 3-2-4-6 6-1z"/>',
 polyline:'<path d="M3 18L9 6l6 11 6-13"/>',
 quadratic:'<path d="M3 3Q12 38 21 3"/>',
 sin:'<path d="M2 12C5-1 9-1 12 12s7 13 10 0"/>',
 cos:'<path d="M2 5C8 5 7 19 12 19s5-14 10-14"/>',
 point:'<circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/>',
 line:'<path d="M4 19L20 5"/><circle cx="4" cy="19" r="1.5"/><circle cx="20" cy="5" r="1.5"/>',
 arrow:'<path d="M4 19L20 5m-8 0h8v8"/>',
 doubleArrow:'<path d="M3 18L21 6m-6 0h6v6M3 12v6h6"/>',
 dimension:'<path d="M3 12h18M3 7v10M21 7v10M8 5h8"/>',
 arc:'<path d="M4 20A16 16 0 0120 4"/><circle cx="4" cy="4" r="1"/>',
 dashed:'<path stroke-dasharray="4 3" d="M3 18L21 6"/>',
 rope:'<path d="M3 7q5-5 10 2t8 8"/>',
 rect:'<rect x="3" y="6" width="18" height="12" rx="1"/>',
 circle:'<circle cx="12" cy="12" r="9"/>',
 ellipse:'<ellipse cx="12" cy="12" rx="10" ry="6"/>',
 regularPolygon:'<path d="M12 2L21.5 9L18 20H6L2.5 9Z"/>',
 midpoint:'<path d="M2 17L22 7"/><circle cx="12" cy="12" r="2.8" fill="currentColor" stroke="none"/>',
 angleBisector:'<path d="M3 21L20 21L3 3M3 21l13-8"/>',
 perpendicularBisector:'<path d="M3 12H21M12 2V22M12 8h4v4"/>',
 text:'<path d="M4 6h16M12 6v14M9 20h6"/>',
 angle:'<path d="M3 20l9-16 9 16"/><path d="M8 20a5 5 0 013.1-4.6"/>',
 triangle:'<path d="M12 3L22 21H2z"/>',
 rightTriangle:'<path d="M3 3v18h18zM3 16h5v5"/>',
 quadrilateral:'<path d="M6 4l15 3-2 14-16-3z"/>',
 block:'<rect x="4" y="7" width="16" height="14"/><path d="M4 7l4-4h13l-1 4"/>',
 incline:'<path d="M3 20h18V5z"/>',
 movablePulley:'<circle cx="12" cy="10" r="7"/><path d="M12 10v12m-7-12V1m14 9V1"/>',
 pulley:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4V1"/>',
 spring:'<path d="M2 12h3l2-7 3 14 3-14 3 14 3-7h3"/>',
 ground:'<path d="M2 12h20M5 12l-3 5m9-5l-3 5m9-5l-3 5"/>',
 forceVector:'<path d="M3 19L20 4m-7 1l7-1-1 7"/><circle cx="3" cy="19" r="2"/>',
 velocityVector:'<path d="M2 19L22 6m-8 0h8v8"/>',
 accelerationVector:'<path d="M4 20L20 5m-9 0h9v9"/>',
 torque:'<path d="M7 19a9 9 0 1 1 12-8m-6-1h6V4"/>',
 dynamometer:'<rect x="7" y="3" width="10" height="15"/><path d="M11 7h3m-3 3h3m-3 3h3M12 18v3"/>',
 weightSet:'<path d="M2 5h20M7 5v8m10-8v8"/><rect x="4" y="13" width="6" height="8"/><rect x="14" y="13" width="6" height="8"/>',
 resistor:'<path d="M1 12h5m12 0h5"/><rect x="6" y="8" width="12" height="8"/>',
 rheostat:'<path d="M1 12h5m12 0h5"/><rect x="6" y="8" width="12" height="8"/><path d="M6 19L18 5m-5 0h5v5"/>',
 cell:'<path d="M2 12h7m4 0h9M9 5v14M13 8v8"/>',
 battery:'<path d="M2 12h4m12 0h4M6 5v14m3-11v8m4-11v14m4-11v8"/>',
 lamp:'<circle cx="12" cy="12" r="8"/><path d="M6 6l12 12M18 6L6 18M1 12h3m16 0h3"/>',
 switchOpen:'<path d="M2 12h5m10 0h5M7 12l10-7"/><circle cx="7" cy="12" r="2"/><circle cx="17" cy="12" r="2"/>',
 switchClosed:'<path d="M2 12h5l10 0h5"/><circle cx="7" cy="12" r="2"/><circle cx="17" cy="12" r="2"/>',
 ammeter:'<circle cx="12" cy="12" r="9"/><text x="12" y="16" font-size="12" text-anchor="middle" stroke="none" fill="currentColor">A</text>',
 voltmeter:'<circle cx="12" cy="12" r="9"/><text x="12" y="16" font-size="12" text-anchor="middle" stroke="none" fill="currentColor">V</text>',
 wireOrth:'<path d="M2 4h10v16h10"/>',
 junction:'<path d="M2 12h20M12 2v20"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>',
 undo:'<path d="M9 4L4 9l5 5M4 9h10a6 6 0 010 12"/>',
 up:'<path d="M12 20V4m-6 6l6-6 6 6"/>',
 trash:'<path d="M4 6h16M9 3h6M7 6l1 15h8l1-15M10 9v8m4-8v8"/>'
 };
 return '<svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(paths[kind]||paths.line)+'</svg>';
}
function qwPhysicsPreset(kind){
 const list={
  surface:[
   {kind:'ground',x:70,y:246,x2:450,y2:246,label:''},
   {kind:'block',x:220,y:178,x2:320,y2:246,label:'m',rotation:0},
   {kind:'arrow',x:270,y:178,x2:270,y2:100,label:'N'},
   {kind:'arrow',x:270,y:212,x2:270,y2:295,label:'mg'}
  ],
  incline:[
   {kind:'incline',x:80,y:90,x2:450,y2:260,label:''},
   {kind:'block',x:230,y:135,x2:300,y2:175,label:'m',rotation:-25},
   {kind:'arrow',x:272,y:145,x2:272,y2:235,label:'mg'}
  ],
  pulley:[
   {kind:'ground',x:195,y:42,x2:327,y2:42,label:''},
   {kind:'pulley',x:220,y:56,x2:300,y2:136,label:''},
   {kind:'rope',x:220,y:96,x2:220,y2:211,label:''},
   {kind:'rope',x:300,y:96,x2:300,y2:211,label:''},
   {kind:'block',x:189,y:211,x2:251,y2:271,label:'m₁'},
   {kind:'block',x:269,y:211,x2:331,y2:271,label:'m₂'}
  ],
  movable:[
   {kind:'ground',x:160,y:42,x2:260,y2:42,label:''},
   {kind:'movablePulley',x:224,y:154,x2:296,y2:226,label:''},
   {kind:'rope',x:224,y:42,x2:224,y2:122,label:''},
   {kind:'rope',x:296,y:60,x2:296,y2:122,label:''},
   {kind:'arrow',x:296,y:60,x2:296,y2:20,label:'F'},
   {kind:'block',x:226,y:244,x2:294,y2:298,label:'m'}
  ],
  spring:[
   {kind:'ground',x:68,y:245,x2:450,y2:245,label:''},
   {kind:'rect',x:68,y:150,x2:84,y2:245,label:''},
   {kind:'spring',x:84,y:209,x2:287,y2:209,label:'k'},
   {kind:'block',x:287,y:166,x2:372,y2:245,label:'m'}
  ]
 };
 if(!Object.hasOwn(list,kind))throw Error('Неизвестная готовая схема');
 if(kind==='incline'){const block=list.incline[1],angle=qwInclineAngle(list.incline[0]),a=angle*Math.PI/180,center={x:265-Math.sin(-a)*20,y:175-Math.cos(a)*20};Object.assign(block,{x:center.x-35,y:center.y-20,x2:center.x+35,y2:center.y+20,rotation:angle});}
 return qwValidateDiagram(list[kind]);
}
function qwVisualPalette(selected){
 const titles={select:'Выделение',point:'Точка',line:'Отрезок',arrow:'Стрелка',text:'Подпись',rightTriangle:'Прям. треугольник',quadrilateral:'4-угольник',dashed:'Вспом. линия',pulley:'Неподвижный блок',movablePulley:'Подвижный блок',rope:'Нить'};
 return [['Основные',['select','point','line','dashed','arrow','text']],['Геометрия',['rect','circle','ellipse','regularPolygon','polyline','arc','dimension','doubleArrow','angle','triangle','rightTriangle','quadrilateral','ray','infiniteLine','parallel','perpendicular','midpoint','angleBisector','perpendicularBisector','equalMarks']],['Механика',['block','incline','pulley','movablePulley','rope','spring','ground','forceVector','velocityVector','accelerationVector','torque','dynamometer','weightSet']],['Электричество',['resistor','rheostat','cell','battery','lamp','switchOpen','switchClosed','ammeter','voltmeter','wireOrth','junction']]].map(([title,keys])=>
  '<details class="qw-tool-group" open><summary>'+title+'</summary><div>'+keys.map(kind=>{
   const title=titles[kind]||Object.fromEntries(QW_VISUAL_TOOLS)[kind];
   return '<button type="button" class="qw-tool-tile" data-tool="'+kind+'" title="'+qwEsc(title)+'" aria-label="'+qwEsc(title)+'" aria-pressed="'+(selected===kind)+'">'+qwVisualIcon(kind)+'<span>'+qwEsc(kind==='rect'?'Прямоуг.':title)+'</span></button>';
  }).join('')+'</div>'+(title==='Геометрия'?'<button type="button" id="qw-finish-polyline" disabled>Завершить ломаную (Enter)</button>':'')+'</details>').join('');
}
/* Desktop-first graph tools: drawing, axes and templates have distinct purposes. */
function qwGraphSidebar(tool,coordinateMode){
 const drawing=[['select','Выделение'],['point','Точка'],['line','Отрезок'],['polyline','Ломаная'],['arrow','Вектор'],['text','Подпись'],['quadratic','Парабола'],['sin','Синус'],['cos','Косинус']];
 return '<details class="qw-tool-group qw-drawing-group" open><summary>Рисование</summary><div class="qw-tool-grid">'+drawing.map(([key,title])=>'<button type="button" class="qw-tool-tile" data-tool="'+key+'" aria-label="'+title+'" title="'+title+'" aria-pressed="'+(tool===key)+'">'+qwVisualIcon(key)+'<span>'+title+'</span></button>').join('')+'</div>'+
  '<button type="button" id="qw-finish-polyline" disabled>Завершить ломаную (Enter)</button></details>'+
  '<details class="qw-tool-group qw-coordinate-group" open><summary>Координатная система</summary><label>Режим осей<select id="qw-coordinate-mode" aria-label="Координатная система" title="Координатная система">'+qwOptions([['first','Первая четверть'],['positiveX','X ≥ 0, Y ±'],['math','X ±, Y ±'],['custom','Свой диапазон']],coordinateMode||'first')+'</select></label><p class="qw-muted" id="qw-coordinate-hint"></p></details>'+
  '<details class="qw-tool-group qw-template-group" open><summary>Шаблоны</summary><label>Готовый график<select id="qw-graph-preset">'+qwOptions([['custom','Свой график'],['v','v(t)'],['x','x(t)'],['a','a(t)'],['p','p(V)'],['i','I(U)'],['parabola','Парабола'],['sin','Синус'],['cos','Косинус']],'custom')+'</select></label><div id="qw-graph-mode"></div><button type="button" id="qw-add-point" data-tool="legacyPoint" aria-label="Добавить точку шаблона">'+qwVisualIcon('point')+'<span>Точка шаблона</span></button></details>';
}
function qwVisualEditor(kind,bankTask=null,onCommit=null,onCancel=null,parentDirty=null){
 if(!qwEnsureEducationMode())return;
 const q=bankTask||qwCurrent();if(!q)return;let value=structuredClone(kind==='graph'?q.graph:q.diagram),selected=-1,labelSelected='',tool='select',drag=null,history=[],future=[],snapGeometry=true,geometryStep=20,multi=new Set(),polyline=[],constructionReference=-1;
 const linear=o=>o&&['line','dashed','arrow','dimension','doubleArrow','ray','infiniteLine'].includes(o.kind);
 const panelButton=(panel,title)=>'<button type="button" data-visual-panel="'+panel+'" aria-controls="qw-visual-'+panel+'" aria-expanded="false">'+title+'</button>';
 const d=qwDialog(kind==='graph'?'Редактор графика':'Редактор схемы',
  '<nav class="qw-visual-panel-nav" aria-label="Панели редактора">'+panelButton('tools','Инструменты')+panelButton('properties','Свойства')+'</nav>'+
  '<aside class="qw-visual-tools" id="qw-visual-tools" aria-label="Инструменты">'+
  (kind==='graph'?qwGraphSidebar(tool,value.coordinateMode):qwVisualPalette(tool))+'</aside>'+
  '<section class="qw-visual-canvas" aria-label="Рабочий холст"><div class="qw-visual-stage-space"><div id="qw-visual-stage" tabindex="0" aria-label="Поле редактирования '+(kind==='graph'?'графика':'схемы')+'"></div></div>'+
  (kind==='diagram'?'<div class="qw-visual-canvas-footer"><label class="qw-check"><input id="qw-snap-geometry" type="checkbox" checked>Сетка и привязка</label><label class="qw-grid-step-label">Шаг<select id="qw-grid-step-geometry" aria-label="Шаг сетки">'+qwOptions([['10','10 px'],['20','20 px'],['40','40 px']],'20')+'</select></label></div>':'')+'</section>'+
  '<aside class="qw-visual-inspector" aria-label="Свойства и действия"><div id="qw-visual-properties" aria-label="Свойства выбранного объекта" tabindex="0"></div><div class="qw-visual-actions" aria-label="Действия с выделением"><button type="button" id="qw-visual-undo" aria-label="Отменить" title="Отменить последнее изменение" disabled>'+qwVisualIcon('undo')+'<span>Отменить</span></button><button type="button" id="qw-visual-redo" aria-label="Повторить" title="Повторить отменённое" disabled>'+qwVisualIcon('undo')+'<span>Повторить</span></button><button type="button" id="qw-visual-copy" aria-label="Копировать выбранное" title="Дублировать выделение" disabled>'+qwVisualIcon('rect')+'<span>Копия</span></button><button type="button" id="qw-visual-delete" aria-label="Удалить выбранное" title="Удалить выбранный объект" disabled>'+qwVisualIcon('trash')+'<span>Удалить</span></button></div></aside>',
  '<span id="qw-visual-state" role="status"></span>'+qwButton('visual-cancel','Отменить редактирование')+qwButton('visual-apply','Применить','class="qw-primary"'),'visual');
 d.classList.add('qw-visual-dialog','qw-visual-'+kind);d.querySelector('.qw-dialog-body').classList.add('qw-visual-body');
 qwInstallPanels(d.querySelector('.qw-visual-body'),'visual',d.querySelector('header'),{left:['.qw-visual-tools','Инструменты'],right:['.qw-visual-inspector','Свойства']});
 let visualCommitted=false;const initialVisual=JSON.stringify(value);d.qwDirty=()=>!visualCommitted&&(JSON.stringify(value)!==initialVisual||polyline.length>0||!!drag);d.qwCanLeave=()=>!d.qwDirty()||confirm('Отменить несохранённые изменения рисунка?');d.qwParentDirty=parentDirty;
 d.querySelector('[data-qw-action="visual-cancel"]').onclick=()=>{if(d.qwCanLeave())d.close();};
 if(onCancel)d.addEventListener('close',()=>{if(!visualCommitted)onCancel();});
 const stage=d.querySelector('#qw-visual-stage'),props=d.querySelector('#qw-visual-properties'),hint=d.querySelector('#qw-visual-state');
 let inspectorSelection='';
 const point=e=>{const svg=stage.querySelector('svg'),box=svg.getBoundingClientRect(),v=svg.viewBox.baseVal,expanded=v.x!==0||v.y!==0||v.width!==520||v.height!==320,p=expanded?new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse()):{x:(e.clientX-box.left)/box.width*520,y:(e.clientY-box.top)/box.height*320},x=qwNum(p.x,0,520,0),y=qwNum(p.y,0,320,0);return kind==='diagram'&&tool!=='select'&&snapGeometry&&!e.shiftKey?(tool==='select'&&!drag?{x:Math.round(x/geometryStep)*geometryStep,y:Math.round(y/geometryStep)*geometryStep}:qwSnapDiagramPoint({x,y},value,geometryStep,drag?selected:-1)):{x,y};};
  const gridPoint=p=>{const b=QW_PLOT;return qwSnapGraphPoint(value,value.xmin+(p.x-b.left)/(b.right-b.left)*(value.xmax-value.xmin),value.ymin+(b.bottom-p.y)/(b.bottom-b.top)*(value.ymax-value.ymin));};
 function selectOnly(index){selected=index;labelSelected='';multi=new Set(index<0?[]:[index]);}
 function selectedIndices(){return [...multi].sort((a,b)=>a-b);}
 function objects(){return kind==='diagram'?value:[...value.points,...(value.elements||[])];}
 function objectAt(i,source=value){return kind==='diagram'?source[i]:i<source.points.length?source.points[i]:source.elements[i-source.points.length];}
 function setObject(i,o){if(kind==='diagram')value[i]=o;else if(i<value.points.length)value.points[i]=o;else value.elements[i-value.points.length]=o;}
 function labelInfo(id,source=value){
  const s=id.split(':'),index=Number(s[kind==='graph'?2:1]);let object,target,ownerIndex;
  if(kind==='graph'){object=s[1]==='p'?source.points[index]:source.elements[index];ownerIndex=s[1]==='p'?index:source.points.length+index;target=object;}
  else{object=source[index];ownerIndex=index;target=s[2]==='v'?object?.vertices?.[Number(s[3])]:object;}
  if(!object||!target)return null;const edge=kind==='diagram'&&s[2]==='e',edgeIndex=Number(s[3]);
  return {object,ownerIndex,free:object.kind==='text',get:()=>edge?object.edgeLabelPositions?.[edgeIndex]:target.labelPosition,clear:()=>{if(edge)object.edgeLabels[edgeIndex]='';else target.label='';},set:p=>{if(edge){object.edgeLabelPositions??=object.vertices.map(()=>null);object.edgeLabelPositions[edgeIndex]=p;}else target.labelPosition=p;}};
 }
 function labelNode(){return labelSelected?stage.querySelector('[data-qw-label="'+labelSelected+'"]'):null;}
 function labelBox(node){const r=node.getBoundingClientRect(),svg=stage.querySelector('svg'),v=svg.viewBox.baseVal;if(v.x===0&&v.y===0&&v.width===520&&v.height===320){const s=svg.getBoundingClientRect();return {x:(r.left-s.left)/s.width*520,y:(r.top-s.top)/s.height*320,w:r.width/s.width*520,h:r.height/s.height*320};}const m=svg.getScreenCTM().inverse(),a=new DOMPoint(r.left,r.top).matrixTransform(m),z=new DOMPoint(r.right,r.bottom).matrixTransform(m);return {x:a.x,y:a.y,w:z.x-a.x,h:z.y-a.y};}
 function labelProperties(){
  const node=labelNode(),info=labelSelected&&labelInfo(labelSelected);if(!node||!info)return '';
  const conflict=node.dataset.labelConflict==='true'?'<p class="qw-error">Подпись пересекает рисунок или выходит за границы. Перетащите её или сбросьте положение.</p>':'';
  if(info.free)return '<section class="qw-inspector-section qw-label-settings"><h2>Свободная подпись</h2><p class="qw-muted">Положение фиксировано. Другие объекты не сдвигают этот текст.</p><div class="qw-primitive-settings">'+['x','y'].map(k=>'<label>'+k.toUpperCase()+'<input type="number" step="any" data-free-label="'+k+'" value="'+info.object[k]+'"></label>').join('')+'</div>'+conflict+'</section>';
  const pos=info.get(),dx=pos?.mode==='manual'?pos.dx:Number(node.dataset.labelOffsetX),dy=pos?.mode==='manual'?pos.dy:Number(node.dataset.labelOffsetY);
  return '<section class="qw-inspector-section qw-label-settings"><h2>Подпись '+qwEsc(node.textContent)+'</h2><label>Положение<select id="qw-label-mode">'+qwOptions([['auto','Автоматически'],['manual','Вручную']],pos?.mode||'auto')+'</select></label><div class="qw-primitive-settings">'+[['dx','Смещение X',dx],['dy','Смещение Y',dy]].map(([k,title,v])=>'<label>'+title+'<input type="number" step="1" min="-1040" max="1040" data-label-offset="'+k+'" value="'+Number(v.toFixed(3))+'"></label>').join('')+'</div><button type="button" id="qw-label-reset">Сбросить положение</button>'+conflict+'</section>';
 }
 function graphObjectBounds(o){const ps=qwGraphObjectPoints(value,o).map(p=>qwPlotXY(value,p));return {x:Math.min(...ps.map(p=>p.x)),x2:Math.max(...ps.map(p=>p.x)),y:Math.min(...ps.map(p=>p.y)),y2:Math.max(...ps.map(p=>p.y))};}
 function diagramPolyline(vertices){return {kind:'polyline',vertices:vertices.map(p=>({...p,label:p.label||''})),x:Math.min(...vertices.map(p=>p.x)),y:Math.min(...vertices.map(p=>p.y)),x2:Math.max(...vertices.map(p=>p.x)),y2:Math.max(...vertices.map(p=>p.y)),label:''};}
 function finishPolyline(){
  if(polyline.length<2)return;
  const next=kind==='graph'?qwValidateGraph({...value,elements:[...value.elements,{kind:'polyline',vertices:polyline,label:''}]}):qwValidateDiagram([...value,diagramPolyline(polyline)]);
  remember();value=next;polyline=[];selectOnly(objects().length-1);tool='select';draw();
 }
 function graphProperties(){
  const o=objectAt(selected),index=selected-value.points.length;
  const selectedPanel=index>=0&&o?'<section class="qw-inspector-section qw-selected-settings"><h2>Выбранный объект</h2><div class="qw-function-settings">'+
   ['x','y','x2','y2','label'].filter(k=>k==='label'||o[k]!==undefined).map(k=>'<label>'+({x:'Начало X',y:'Начало Y',x2:'Конец X',y2:'Конец Y',label:'Подпись'}[k])+'<input data-element-field="'+k+'" type="'+(k==='label'?'text':'number')+'" step="any" value="'+qwEsc(o[k])+'"></label>').join('')+
   (o.kind==='function'?Object.entries(o.curve).map(([key,n])=>key==='trig'?'<label>Функция<select data-element-curve="trig">'+qwOptions([['sin','sin'],['cos','cos']],n)+'</select></label>':'<label>'+key+'<input type="number" step="any" data-element-curve="'+key+'" value="'+n+'"></label>').join(''):'')+
   (o.vertices?o.vertices.map((p,i)=>'<div class="qw-row">'+['x','y'].map(k=>'<label>'+k+(i+1)+'<input type="number" step="any" data-polyline-vertex="'+i+'" data-coordinate="'+k+'" value="'+p[k]+'"></label>').join('')+'</div>').join(''):'')+
   '</div></section>':'';
  const independent=value.elements.length?'<details class="qw-inspector-section" open><summary>Независимые объекты ('+value.elements.length+')</summary><div class="qw-graph-objects">'+
   value.elements.map((item,i)=>'<button type="button" data-graph-object="'+(i+value.points.length)+'" aria-pressed="'+multi.has(i+value.points.length)+'">'+(i+1)+'. '+qwEsc(({point:'Точка',line:'Отрезок',arrow:'Вектор',polyline:'Ломаная',text:'Подпись',function:item.family==='quadratic'?'Парабола':item.curve?.trig||'Функция'})[item.kind])+' '+qwEsc(item.label)+'</button>').join('')+'</div></details>':'';
  const templateColor=value.points.length||value.curveFamily!=='points'?'<details class="qw-inspector-section qw-template-color" open><summary>Цвет построения по точкам</summary>'+
   '<label>Линия шаблона<input type="color" data-legacy-paint="lineStyle" value="'+qwGraphTemplateStroke(value,'lineStyle')+'"></label>'+
   (value.curveFamily!=='points'?'<label>Функция шаблона<input type="color" data-legacy-paint="curveStyle" value="'+qwGraphTemplateStroke(value,'curveStyle')+'"></label>':'')+'</details>':'';
  return {selectedPanel,independent,templateColor};
 }
 function stylePanel(){
  if(!multi.size)return '';
  const o=objectAt(selected),graphElement=kind==='graph'&&selected>=value.points.length;
  const paint=qwEffectiveObjectPaint(o,kind==='diagram'?'diagram':graphElement?'graph-element':'graph-point');
  const defaultStroke=paint.stroke;
  return '<section class="qw-object-style"><h2>Оформление'+(multi.size>1?' · '+multi.size+' объектов':'')+'</h2>'+[['stroke','Цвет линии / контура',defaultStroke],['fill','Цвет заливки','#ffffff'],['text','Цвет подписи',kind==='graph'?(paint.stroke||defaultStroke):'#162735']].filter(([key])=>key!=='fill'||kind==='diagram'&&selectedIndices().some(i=>['rect','circle','ellipse','regularPolygon','triangle','rightTriangle','quadrilateral','block','incline','pulley','movablePulley'].includes(objectAt(i)?.kind))).map(([key,title,fallback])=>'<div class="qw-paint-row"><label>'+title+'<input type="color" data-style="'+key+'" value="'+(paint[key]&&paint[key]!=='none'?paint[key]:fallback)+'"></label><div class="qw-palette">'+['#162735','#dc2626','#16a34a','#2563eb','#9333ea','#ea580c'].map(color=>'<button type="button" data-style-key="'+key+'" data-style-color="'+color+'" style="--qw-swatch:'+color+'" aria-label="'+title+' '+color+'" title="'+title+' '+color+'"></button>').join('')+(key==='fill'?'<button type="button" data-style-key="fill" data-style-color="none" aria-label="Без заливки" title="Без заливки">'+qoWorkIcon('x')+'</button>':'')+'</div></div>').join('')+'<label>Толщина линии<input data-style="width" type="number" min="0.5" max="12" step="0.5" value="'+paint.width+'"></label></section>';
 }
 function rotationPanel(){
  const o=value[selected];if(!o||multi.size!==1||['point','ray','infiniteLine'].includes(o.kind))return '';
  return '<section class="qw-object-rotation"><label>'+(o.kind==='block'?'Поворот бруска, °':'Поворот, °')+'<input id="qw-block-rotation" type="number" min="-180" max="180" step="1" value="'+Number((o.rotation||0).toFixed(2))+'"></label><div class="qw-row">'+[15,45,90,-90].map(n=>'<button type="button" data-rotate="'+n+'">+'+n+'°</button>').join('')+'</div>'+(o.kind==='block'&&value.some(p=>p.kind==='incline')?'<label>Наклонная плоскость<select id="qw-align-plane">'+value.map((p,i)=>p.kind==='incline'?'<option value="'+i+'">Плоскость '+(i+1)+'</option>':'').join('')+'</select></label><button type="button" id="qw-align-block">Выровнять брусок по плоскости</button>':'')+'</section>';
 }
 function diagramProperties(){
  const o=multi.size===1?value[selected]:null;
  const presets='<section class="qw-inspector-section qw-diagram-presets"><label>Готовые физические схемы<select id="qw-diagram-preset">'+qwOptions([['none','Выбрать схему'],['surface','Брусок на опоре'],['incline','Брусок на наклонной плоскости'],['pulley','Система с неподвижным блоком'],['movable','Система с подвижным блоком'],['spring','Брусок и пружина']],'none')+'</select></label></section>';
  let parameters='';
  if(o?.kind==='regularPolygon'){
   parameters='<label>Количество сторон<select data-polygon-sides>'+qwOptions(Array.from({length:10},(_,i)=>[String(i+3),String(i+3)]),o.sides)+'</select></label>'+
    '<div class="qw-primitive-settings">'+['x','y','x2','y2'].map((key,i)=>'<label>'+['Граница X1','Граница Y1','Граница X2','Граница Y2'][i]+'<input data-diagram-field="'+key+'" type="number" min="0" max="'+(key[0]==='x'?520:320)+'" step="any" value="'+o[key]+'"></label>').join('')+'</div>'+
    '<p class="qw-muted">Все стороны равны. Изменяйте размеры, положение и количество сторон.</p>';
  }else if(o?.kind==='ellipse'){
   parameters='<div class="qw-primitive-settings">'+['x','y','x2','y2'].map((key,i)=>'<label>'+['Граница X1','Граница Y1','Граница X2','Граница Y2'][i]+'<input data-diagram-field="'+key+'" type="number" min="0" max="'+(key[0]==='x'?520:320)+'" step="any" value="'+o[key]+'"></label>').join('')+'</div>';
  }else if(o?.construction&&['midpoint','angleBisector','perpendicularBisector'].includes(o.construction.kind)){
   parameters='<p class="qw-muted">Зависимое построение: геометрия пересчитывается при изменении исходной фигуры. Настройте подпись и оформление здесь.</p>';
  }else if(o&&(QW_MECHANICS.includes(o.kind)||QW_ELECTRICS.includes(o.kind))){
   const coords='<div class="qw-primitive-settings">'+['x','y','x2','y2'].map(k=>
    '<label>'+k.toUpperCase()+'<input data-diagram-field="'+k+'" type="number" min="0" max="'+(k[0]==='x'?520:320)+'" step="any" value="'+o[k]+'"></label>').join('')+'</div>';
   const options=o.kind==='torque'?'<label>Направление<select data-physics-field="direction">'+qwOptions([['cw','По часовой'],['ccw','Против часовой']],o.direction||'cw')+'</select></label>':
    o.kind==='weightSet'?'<label>Количество грузов<input data-physics-field="count" type="number" min="2" max="6" step="1" value="'+(o.count||2)+'"></label>':
    o.kind==='dynamometer'?'<label>Показание, Н<input data-physics-field="reading" type="number" min="0" max="100" step="any" value="'+(o.reading||0)+'"></label>':
    o.kind==='wireOrth'?'<label>X изгиба<input data-physics-field="bend" type="number" min="0" max="520" step="1" value="'+(o.bend??(o.x+o.x2)/2)+'"></label>'+
     (o.links&&Object.keys(o.links).length?'<button type="button" id="qw-unlink-wire">Отключить привязки</button>':''):'';
   parameters=coords+options;
  }else if(o?.kind==='arc'){
   const values={cx:(o.x+o.x2)/2,cy:(o.y+o.y2)/2,radius:(o.x2-o.x)/2,startAngle:o.startAngle,endAngle:o.endAngle};
   const labels={cx:'Центр X',cy:'Центр Y',radius:'Радиус',startAngle:'Начало, °',endAngle:'Конец, °'};
   parameters='<div class="qw-primitive-settings">'+Object.entries(values).map(([key,n])=>'<label>'+labels[key]+'<input type="number" step="any" data-arc-field="'+key+'" value="'+Number(n.toFixed(3))+'"></label>').join('')+'</div><p class="qw-muted">Углы от оси X, положительные — против часовой стрелки. Протяните от центра, чтобы задать радиус.</p>';
  }else if(linear(o)){
   parameters='<div class="qw-primitive-settings">'+['x','y','x2','y2'].map((key,i)=>'<label>'+['Начало X','Начало Y','Конец X','Конец Y'][i]+'<input type="number" step="any" data-diagram-field="'+key+'" value="'+o[key]+'"'+(o.construction&&['x2','y2'].includes(key)?' readonly aria-readonly="true"':'')+'></label>').join('')+'</div>'+
    (o.kind==='dimension'?'<label>Отступ подписи<input type="number" step="1" data-diagram-field="labelOffset" value="'+(o.labelOffset??18)+'"></label>':'')+
    '<label>Отметки равных отрезков<select data-diagram-field="ticks">'+qwOptions([[0,'Без засечек'],[1,'Одна'],[2,'Две'],[3,'Три']],o.ticks||0)+'</select></label>'+
    (o.construction?'<p class="qw-muted">Связь: '+(o.construction.kind==='parallel'?'параллельно':'перпендикулярно')+' опорной линии. X/Y задают точку; направление вычисляется автоматически.</p>':'');
  }
  const selectedPanel=o?'<section class="qw-inspector-section qw-selected-settings"><h2>Выбранный объект</h2><label>Подпись выбранной фигуры<input id="qw-object-label" title="Поддерживаются формулы, например \\vec{v}_0 или v_x" maxlength="80" value="'+qwEsc(o.label)+'"></label>'+parameters+'</section>':'';
  const vertexPanel=o?.vertices?'<details class="qw-inspector-section" open><summary>Вершины и обозначения</summary><div class="qw-vertex-list">'+o.vertices.map((p,i)=>'<div><label>Вершина '+(i+1)+'<input data-vertex-index="'+i+'" data-vertex-field="label" maxlength="20" value="'+qwEsc(p.label)+'"></label><label>X<input data-vertex-index="'+i+'" data-vertex-field="x" type="number" min="0" max="520" step="any" value="'+p.x+'"></label><label>Y<input data-vertex-index="'+i+'" data-vertex-field="y" type="number" min="0" max="320" step="any" value="'+p.y+'"></label></div>').join('')+'</div>'+
   (o.kind!=='polyline'?'<div class="qw-edge-list">'+o.vertices.map((p,i)=>'<label>Сторона '+qwEsc(p.label||String(i+1))+'–'+qwEsc(o.vertices[(i+1)%o.vertices.length].label||String((i+1)%o.vertices.length+1))+'<input data-edge-index="'+i+'" maxlength="40" placeholder="Длина / обозначение" value="'+qwEsc(o.edgeLabels?.[i]||'')+'"></label>').join('')+'</div>':'')+'</details>':'';
  const constructions=o&&['triangle','rightTriangle'].includes(o.kind)?'<section class="qw-inspector-section qw-constructions"><label>Из вершины<select id="qw-construction-vertex">'+qwOptions(o.vertices.map((p,i)=>[String(i),p.label||'Вершина '+(i+1)]),'0')+'</select></label><button type="button" data-construction="median">Провести медиану</button><button type="button" data-construction="altitude">Провести высоту</button></section>':'';
  const layers=multi.size?'<section class="qw-inspector-section qw-row"><button type="button" data-layer="front">На передний план</button><button type="button" data-layer="back">На задний план</button></section>':'';
  const list='<section class="qw-inspector-section qw-objects-section"><h2>Объекты ('+value.length+')</h2><div class="qw-object-list">'+value.map((item,i)=>'<button type="button" aria-pressed="'+multi.has(i)+'" data-object-select="'+i+'">'+(i+1)+'. '+qwEsc(Object.fromEntries(QW_VISUAL_TOOLS)[item.kind]||item.kind)+' '+qwEsc(item.label)+'</button>').join('')+'</div>'+(value.length?'':'<p class="qw-muted">Нарисуйте фигуру или выберите готовую схему.</p>')+'</section>';
  return labelProperties()+presets+selectedPanel+stylePanel()+rotationPanel()+vertexPanel+constructions+layers+list;
 }
 function decorateSelection(){
  if(selected<0)multi.clear();else if(!multi.has(selected))multi=new Set([selected]);
  const svg=stage.querySelector('svg');
  for(const i of multi){const selector=kind==='diagram'?'[data-qw-object="'+i+'"]':i<value.points.length?'[data-qw-point="'+i+'"]':'[data-qw-element="'+(i-value.points.length)+'"]';svg.querySelector(selector)?.classList.add('qw-visual-selected');}
  if(drag?.marquee){
   const a=drag.start,b=drag.end||a;svg.insertAdjacentHTML('beforeend','<rect data-qw-marquee x="'+Math.min(a.x,b.x)+'" y="'+Math.min(a.y,b.y)+'" width="'+Math.abs(a.x-b.x)+'" height="'+Math.abs(a.y-b.y)+'" fill="#1686ed18" stroke="#136bb1" stroke-dasharray="5 3" pointer-events="none"/>');
  }else if(kind==='diagram'&&!labelSelected&&multi.size===1&&value[selected]&&tool==='select'){
   const o=value[selected],c=qwObjectCenter(o),b=qwObjectBounds(o),p={x:c.x,y:b.y-22};
   svg.insertAdjacentHTML('beforeend','<g data-qw-editor-only><line x1="'+c.x+'" y1="'+c.y+'" x2="'+p.x+'" y2="'+p.y+'" stroke="#136bb1" stroke-dasharray="3 3" pointer-events="none"/><circle data-rotation-handle cx="'+p.x+'" cy="'+p.y+'" r="7" fill="white" stroke="#136bb1" stroke-width="2" style="cursor:grab" aria-label="Повернуть объект"/></g>');
  }
  if(labelNode()){const r=labelBox(labelNode());svg.insertAdjacentHTML('beforeend','<rect data-qw-editor-only x="'+(r.x-2)+'" y="'+(r.y-2)+'" width="'+(r.w+4)+'" height="'+(r.h+4)+'" fill="none" stroke="#136bb1" stroke-width="1" stroke-dasharray="3 2" pointer-events="none"/>');}
 }
 function applyStyle(key,next,indices=selectedIndices()){
  const style=qwValidateStyle({[key]:next});if(!indices.length)return;
  remember();for(const i of indices){const o=objectAt(i);if(o&&(key!=='fill'||['rect','circle','ellipse','regularPolygon','triangle','rightTriangle','quadrilateral','block','incline','pulley','movablePulley'].includes(o.kind)))o.style={...o.style,...style};}draw();
 }
 function rotateSelected(angle){if(selected<0)return;remember();value[selected].rotation=((angle+180)%360+360)%360-180;draw();}
 function remember(){history.push(structuredClone(value));history=history.slice(-30);future=[];}
 function copySelection(){
  if(!multi.size)return;
  const originals=selectedIndices().map(i=>objectAt(i));
  if(kind==='diagram'&&value.length+originals.length>60){hint.textContent='Максимум 60 фигур';return;}
  if(kind==='graph'&&value.elements.length+originals.length>60){hint.textContent='Максимум 60 объектов';return;}
  const copies=originals.map(o=>kind==='diagram'?qwTranslateObject(o,16,16):
   qwTranslateGraphObject(o,(value.xmax-value.xmin)*.03,(value.ymax-value.ymin)*.03));
  const idMap=new Map();
  for(let i=0;i<copies.length;i++)if(kind==='diagram'&&originals[i].id){
   idMap.set(originals[i].id,qwId());copies[i].id=idMap.get(originals[i].id);
  }
  if(kind==='diagram')for(const c of copies){
   if(c.construction?.reference&&idMap.has(c.construction.reference))c.construction.reference=idMap.get(c.construction.reference);
   if(c.links)for(const p of Object.values(c.links))if(idMap.has(p.id))p.id=idMap.get(p.id);
  }
  const next=structuredClone(value);
  if(kind==='diagram')next.push(...copies);
  else{
   selectedIndices().forEach((index,j)=>{
    if(index<value.points.length)next.points.push(copies[j]);
    else next.elements.push(copies[j]);
   });
  }
  try{const validated=kind==='diagram'?qwValidateDiagram(next):qwValidateGraph(next);
   remember();value=validated;selected=objects().length-1;multi=new Set(copies.map((_,i)=>selected-copies.length+1+i));draw();
  }catch(e){hint.textContent=e.message;hint.className='qw-error';}
 }
 function draw(full=true){if(kind==='diagram')value=qwResolveDiagram(value);if(labelSelected&&labelInfo(labelSelected)?.ownerIndex!==selected)labelSelected='';const scroll=props.scrollTop;stage.innerHTML=kind==='graph'?qwGraphSVG(drag?.creating||polyline.length?{...value,elements:[...value.elements,...(drag?.creating?[drag.draft]:[]),...(polyline.length?[{kind:'polyline',vertices:polyline,label:''}]:[])]}:value,true):qwDiagramSVG([...value,...(drag?.creating?[drag.draft]:[]),...(polyline.length>1?[diagramPolyline(polyline)]:[])],true,snapGeometry?geometryStep:false);qwRefreshLiveGraphText(stage);decorateSelection();if(selected>=0){const el=stage.querySelector('[data-qw-'+(kind==='graph'?'point':'object')+'="'+selected+'"]');if(el)el.classList.add('qw-visual-selected');}hint.className='';hint.textContent=kind==='graph'?value.points.length+' / 40 точек · '+value.elements.length+' / 60 объектов'+(polyline.length?' · Ломаная: '+polyline.length+' вершин':''):value.length+' / 60 фигур'+(polyline.length?' · Ломаная: '+polyline.length+' вершин':'');if(['parallel','perpendicular'].includes(tool))hint.textContent+=' · '+(constructionReference<0?'Выберите опорную линию, затем точку.':'Укажите точку для построения.');if(tool==='equalMarks')hint.textContent+=' · Нажмите отрезок: одна, две или три засечки.';if(['midpoint','perpendicularBisector'].includes(tool))hint.textContent+=' · Нажмите исходный отрезок.';if(tool==='angleBisector')hint.textContent+=' · Нажмите исходный угол.';d.querySelector('#qw-visual-undo').disabled=!history.length;d.querySelector('#qw-visual-redo').disabled=!future.length;d.querySelector('#qw-visual-delete').disabled=selected<0;d.querySelector('#qw-visual-copy').disabled=selected<0;d.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));d.querySelector('#qw-finish-polyline').disabled=polyline.length<2;if(kind==='graph'){d.querySelector('#qw-coordinate-mode').value=value.coordinateMode||'custom';d.querySelector('#qw-coordinate-hint').textContent=({first:'X и Y начинаются с нуля. Изменить границы можно справа.',positiveX:'X ≥ 0, а Y имеет положительные и отрицательные значения.',math:'Обе оси проходят через нуль, деления подписаны возле осей.',custom:'Свободные числовые диапазоны X и Y задаются справа.'})[value.coordinateMode]||'Свободные диапазоны задаются справа.';}
  const conflicts=stage.querySelectorAll('[data-label-conflict="true"]').length;if(conflicts){hint.className='qw-error';hint.textContent+=' · Подписей с пересечениями: '+conflicts+'. Выберите подпись и перетащите её.';}
  if(!labelSelected)props.querySelector('.qw-label-settings')?.remove();
  if(!full)return;
  if(kind==='graph'){
   const range=['xmin','xmax','ymin','ymax'].map((k,i)=>'<label>'+['X от','X до','Y от','Y до'][i]+'<input data-graph-field="'+k+'" type="number" step="any" value="'+qwEsc(value[k])+'"></label>').join('');
   const toggles=[['snapToGrid','Привязка'],['grid','Сетка'],['connected','Соединять точки'],['smooth','Сглаживание']].map(([k,title])=>'<label class="qw-check"><input data-graph-field="'+k+'" type="checkbox" '+(value[k]?'checked':'')+'>'+title+'</label>').join('');
   const curve=value.curveFamily==='quadratic'?['a','b','c'].map(k=>'<label>Коэффициент '+k+'<input data-curve-param="'+k+'" type="number" step="any" value="'+qwEsc(value.curve[k])+'"></label>').join(''):
    value.curveFamily==='trigonometric'?'<label>Функция<select id="qw-curve-trig">'+qwOptions([['sin','sin'],['cos','cos']],value.curve.trig)+'</select></label>'+['amplitude','frequency','phase','offset'].map((k,i)=>'<label>'+['Амплитуда','Частота','Фаза','Смещение'][i]+'<input data-curve-param="'+k+'" type="number" step="any" value="'+qwEsc(value.curve[k])+'"></label>').join(''):'';
   const points=value.points.map((p,i)=>'<div data-point-row="'+i+'"><b>'+(i+1)+'</b>'+['x','y','label'].map(k=>'<input aria-label="'+k+' точки '+(i+1)+'" data-point-index="'+i+'" data-point-field="'+k+'" type="'+(k==='label'?'text':'number')+'" '+(k==='label'?'maxlength="30"':'step="any"')+' value="'+qwEsc(p[k])+'">').join('')+'<button type="button" data-point-up="'+i+'" '+(!i?'disabled':'')+' title="Раньше в ломаной" aria-label="Переместить точку '+(i+1)+' раньше">'+qwVisualIcon('up')+'</button><button type="button" data-point-delete="'+i+'" aria-label="Удалить точку '+(i+1)+'" title="Удалить точку '+(i+1)+'">'+qwVisualIcon('trash')+'</button></div>').join('');
   const extra=graphProperties();
   props.innerHTML=labelProperties()+extra.selectedPanel+stylePanel()+
    '<section class="qw-inspector-section"><h2>Оси и масштаб</h2><div class="qw-graph-range">'+range+'</div><div class="qw-grid-quick"><label>Шаг делений<input data-graph-field="step" type="number" min="0.001" step="any" value="'+qwEsc(value.step)+'"></label></div></section>'+
    '<section class="qw-inspector-section"><h2>Сетка и линии</h2><div class="qw-graph-flags">'+toggles+'</div></section>'+
    '<details class="qw-inspector-section" open><summary>Подписи осей</summary><div class="qw-axis-titles">'+['xlabel','ylabel'].map((k,i)=>'<label>'+['Подпись X','Подпись Y'][i]+'<input data-graph-field="' + k + '" type="text" maxlength="120" value="'+qwEsc(value[k])+'"></label>').join('')+'</div></details>'+
    (curve?'<details class="qw-inspector-section" open><summary>Параметры функции</summary><div class="qw-function-settings">'+curve+'</div></details>':'')+
    (value.points.length?'<details class="qw-inspector-section" open><summary>Точки шаблона ('+value.points.length+')</summary><div class="qw-point-list">'+points+'</div></details>':'')+extra.templateColor+extra.independent;
  }
  else props.innerHTML=diagramProperties();
  if(kind==='graph')d.querySelector('#qw-graph-mode').innerHTML='<label>Тип графика<select id="qw-curve-family">'+qwOptions([['points','По точкам'],['quadratic','Парабола'],['trigonometric','Тригонометрия']],value.curveFamily)+'</select></label>';
  const signature=selectedIndices().join(',');
  props.scrollTop=signature===inspectorSelection?scroll:0;inspectorSelection=signature;
 }
 function showRangeWarning(){
  const outside=value.elements.filter(o=>o.kind!=='function'&&qwGraphObjectPoints(value,o).some(p=>p.x<value.xmin||p.x>value.xmax||p.y<value.ymin||p.y>value.ymax)).length;
  if(outside){hint.className='qw-error';hint.textContent=outside+' объектов выходят за диапазон. Координаты сохранены; расширьте диапазон, чтобы увидеть их целиком.';}
 }
 function showPanel(panel){
  d.dataset.panel=panel;
  d.querySelectorAll('[data-visual-panel]').forEach(b=>b.setAttribute('aria-expanded',String(b.dataset.visualPanel===panel)));
 }
 d.querySelectorAll('[data-visual-panel]').forEach(b=>b.onclick=()=>showPanel(d.dataset.panel===b.dataset.visualPanel?'':b.dataset.visualPanel));
 // Capture at the document level: property forms are rebuilt after editing and may
 // lose focus, but Ctrl+Z must still undo the active visual editor transaction.
 const qwUndoHotkey=e=>{
  if(!d.isConnected||!d.open){document.removeEventListener('keydown',qwUndoHotkey,true);return;}
  if(!(e.ctrlKey||e.metaKey)||e.shiftKey||!(e.code==='KeyZ'||e.key.toLowerCase()==='z')||e.defaultPrevented)return;
  const editable=e.target instanceof Element&&e.target.closest('textarea,[contenteditable="true"],input:not([type="checkbox"]):not([type="radio"]):not([type="color"])');
  if(editable&&(editable.isContentEditable||editable.value!==editable.defaultValue))return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  d.querySelector('#qw-visual-undo').click();
 };
 document.addEventListener('keydown',qwUndoHotkey,true);
 d.addEventListener('close',()=>document.removeEventListener('keydown',qwUndoHotkey,true),{once:true});
 d.addEventListener('keydown',e=>{if(e.key==='Escape'&&(polyline.length||drag||multi.size)){e.preventDefault();cancelDrag();polyline=[];selectOnly(-1);draw();return;}if(e.key==='Escape'&&d.dataset.panel&&matchMedia('(max-width:1000px)').matches){e.preventDefault();e.stopPropagation();showPanel('');d.querySelector('[data-visual-panel]').focus();}});
 props.addEventListener('focusin',e=>{if(kind==='graph'&&e.target.dataset.pointIndex!==undefined){selectOnly(Number(e.target.dataset.pointIndex));draw(false);}});
 stage.onpointerdown=e=>{
  if(e.button!==0||drag)return;e.preventDefault();stage.focus();
  const p=point(e),before=structuredClone(value),previous=selected,scale=Math.hypot(stage.querySelector('svg').getScreenCTM().a,stage.querySelector('svg').getScreenCTM().b);
  const prior=new Set(multi),coordinate=kind==='graph'?gridPoint(p):p;
  const caption=tool==='select'?e.target.closest('[data-qw-label]'):null;
  if(caption){const info=labelInfo(caption.dataset.qwLabel);if(info){const box=labelBox(caption),initial={dx:Number(caption.dataset.labelOffsetX),dy:Number(caption.dataset.labelOffsetY)};selectOnly(info.ownerIndex);labelSelected=caption.dataset.qwLabel;drag={label:labelSelected,free:info.free,before,previous,selection:prior,start:p,box,initial,screen:{x:e.clientX,y:e.clientY},pixels:0};stage.setPointerCapture(e.pointerId);draw();return;}}
  let creating=false,draft=null;
  if(kind==='graph'){
   if(tool!=='select'&&(p.x<QW_PLOT.left||p.x>QW_PLOT.right||p.y<QW_PLOT.top||p.y>QW_PLOT.bottom))return;
   const hit=qwHitGraph(value,p,5/scale);
   if(tool==='select'||(['point','legacyPoint'].includes(tool)&&hit>=0&&(hit<value.points.length||objectAt(hit)?.kind==='point'))){
    if(hit<0){if(!e.shiftKey)selectOnly(-1);drag={marquee:true,before,previous,selection:prior,start:p,prior:e.shiftKey?prior:new Set()};stage.setPointerCapture(e.pointerId);draw();return;}
    if(e.shiftKey){if(multi.has(hit))multi.delete(hit);else multi.add(hit);selected=[...multi].at(-1)??-1;draw();return;}
    if(!multi.has(hit))selectOnly(hit);else selected=hit;
   }else if(tool==='legacyPoint'){
    if(value.points.length>=40)return;remember();value.points.push({...coordinate,label:''});selectOnly(value.points.length-1);draw();return;
   }else if(tool==='point'){
    if(value.elements.length>=60)return;remember();value.elements.push({kind:'point',...coordinate,label:''});selectOnly(objects().length-1);draw();return;
   }else if(tool==='polyline'){
    if(value.elements.length>=60)return;if(polyline.length<40){if(!polyline.length||Math.hypot(polyline.at(-1).x-coordinate.x,polyline.at(-1).y-coordinate.y)>1e-9)polyline.push(coordinate);}draw(false);return;
   }else if(['text','quadratic','sin','cos'].includes(tool)){
    if(value.elements.length>=60)return;
    let o={kind:'text',...coordinate,label:''};
    if(tool==='text'){o.label=prompt('Подпись','')||'';if(!o.label)return;}
    else {const family=tool==='quadratic'?'quadratic':'trigonometric',curve={...qwGraphDefault().curve,trig:tool==='cos'?'cos':'sin'};o={kind:'function',family,curve,label:''};}
    remember();value.elements.push(o);selectOnly(objects().length-1);draw();return;
   }else{
    if(value.elements.length>=60)return;creating=true;draft={kind:tool,...coordinate,x2:coordinate.x,y2:coordinate.y,label:''};
   }
  }else if(['midpoint','angleBisector','perpendicularBisector'].includes(tool)){
   const hit=qwHitDiagram(value,p,5/scale),ref=value[hit];
   const compatible=tool==='angleBisector'?ref?.kind==='angle':
    ref&&['line','dashed','arrow','dimension','doubleArrow'].includes(ref.kind);
   if(!compatible){hint.className='qw-error';hint.textContent=tool==='angleBisector'?'Нажмите существующий угол.':'Нажмите конечный отрезок.';return;}
   if(value.length>=60){hint.className='qw-error';hint.textContent='Максимум 60 фигур';return;}
   try{
    const next=structuredClone(value);next[hit].id??=qwId();const source=next[hit];
    const nextKind=tool==='midpoint'?'point':tool==='angleBisector'?'ray':'infiniteLine';
    next.push({kind:nextKind,id:qwId(),x:source.x,y:source.y,x2:source.x+1,y2:source.y+1,label:'',
     construction:{kind:tool,reference:source.id}});
    const result=qwValidateDiagram(next);remember();value=result;selectOnly(value.length-1);tool='select';draw();
   }catch(error){hint.className='qw-error';hint.textContent=error.message;}
   return;
  }else if(['parallel','perpendicular','equalMarks'].includes(tool)){
   const hit=qwHitDiagram(value,p,5/scale);
   if(tool==='equalMarks'){if(hit>=0&&linear(value[hit])){remember();value[hit].ticks=(value[hit].ticks||0)%3+1;selectOnly(hit);draw();}return;}
   if(constructionReference<0){if(hit>=0&&linear(value[hit])){constructionReference=hit;selectOnly(hit);draw();}return;}
   if(value.length>=60)return;remember();const base=value[constructionReference];base.id??=qwId();
   value=qwValidateDiagram([...value,{kind:'infiniteLine',id:qwId(),x:p.x,y:p.y,x2:p.x+1,y2:p.y+1,label:'',construction:{kind:tool,reference:base.id}}]);selectOnly(value.length-1);tool='select';constructionReference=-1;draw();return;
  }else if(tool==='polyline'){
   if(value.length>=60)return;if(polyline.length<40&&(!polyline.length||Math.hypot(polyline.at(-1).x-p.x,polyline.at(-1).y-p.y)>.01))polyline.push(p);draw(false);return;
  }else if(tool==='select'){
   if(e.target.closest('[data-rotation-handle]')&&selected>=0){
    const c=qwObjectCenter(value[selected]);drag={before,previous,selection:prior,rotating:true,startAngle:Math.atan2(p.y-c.y,p.x-c.x),center:c,angle:value[selected].rotation||0};stage.setPointerCapture(e.pointerId);return;
   }
   const text=e.target.closest('text')?.closest('[data-qw-object]'),hit=text?Number(text.dataset.qwObject):qwHitDiagram(value,p,5/scale);
   if(hit<0){if(!e.shiftKey)selectOnly(-1);drag={marquee:true,before,previous,selection:prior,start:p,prior:e.shiftKey?prior:new Set()};stage.setPointerCapture(e.pointerId);draw();return;}
   if(e.shiftKey){if(multi.has(hit))multi.delete(hit);else multi.add(hit);selected=[...multi].at(-1)??-1;draw();return;}
   if(!multi.has(hit))selectOnly(hit);else selected=hit;
  }else{
   if(value.length>=60)return;let label='';if(tool==='text'){label=prompt('Подпись','')||'';if(!label)return;}
   if(['point','text','junction'].includes(tool)){
    remember();value.push({kind:tool,x:p.x,y:p.y,x2:p.x,y2:p.y,label,...(tool==='junction'?{id:qwId()}: {})});
    selectOnly(value.length-1);draw();return;
   }
   creating=true;draft={kind:tool,x:p.x,y:p.y,x2:p.x,y2:p.y,label:'',...(tool==='arc'?{startAngle:0,endAngle:90}:tool==='regularPolygon'?{sides:6}:{})};
  }
  let handle=kind==='diagram'&&multi.size===1&&tool==='select'?e.target.closest('[data-qw-vertex]'):null;
  if(handle&&Number(handle.closest('[data-qw-object]').dataset.qwObject)!==selected)handle=null;
  drag={creating,draft,before,previous,selection:prior,start:coordinate,screen:{x:e.clientX,y:e.clientY},pixels:0,indices:selectedIndices(),vertexIndex:handle?Number(handle.dataset.qwVertex):-1};
  stage.setPointerCapture(e.pointerId);draw(false);
 };
 stage.onpointermove=e=>{
  if(!drag)return;const p=point(e),coordinate=kind==='graph'?gridPoint(p):p;
  if(kind==='diagram'&&drag.creating&&drag.draft?.kind==='rope'&&snapGeometry&&!e.shiftKey){
   if(Math.abs(coordinate.x-drag.start.x)<=7)coordinate.x=drag.start.x;
   if(Math.abs(coordinate.y-drag.start.y)<=7)coordinate.y=drag.start.y;
  }
  if(drag.label){
   let dx=p.x-drag.start.x,dy=p.y-drag.start.y;const bounds=kind==='graph'?{x:84,y:48,x2:449,y2:260}:{x:3,y:3,x2:517,y2:317};
   dx=qwNum(dx,bounds.x-drag.box.x,bounds.x2-drag.box.x-drag.box.w,0);dy=qwNum(dy,bounds.y-drag.box.y,bounds.y2-drag.box.y-drag.box.h,0);
   const info=labelInfo(drag.label);if(info){if(info.free){const original=labelInfo(drag.label,drag.before);setObject(info.ownerIndex,kind==='graph'?qwTranslateGraphObject(original.object,dx/(QW_PLOT.right-QW_PLOT.left)*(value.xmax-value.xmin),-dy/(QW_PLOT.bottom-QW_PLOT.top)*(value.ymax-value.ymin)):qwTranslateObject(original.object,dx,dy));}else info.set({mode:'manual',dx:Number((drag.initial.dx+dx).toFixed(3)),dy:Number((drag.initial.dy+dy).toFixed(3))});}
   draw(false);return;
  }
  if(drag.marquee){drag.end=p;draw(false);return;}
  if(drag.rotating){const angle=Math.atan2(p.y-drag.center.y,p.x-drag.center.x);value[selected].rotation=((drag.angle+(angle-drag.startAngle)*180/Math.PI+180)%360+360)%360-180;draw(false);return;}
  drag.pixels=Math.hypot(e.clientX-drag.screen.x,e.clientY-drag.screen.y);
  if(drag.creating){
   if(kind==='diagram'&&drag.draft.kind==='arc'){
    const c=drag.start,r=Math.min(Math.hypot(p.x-c.x,p.y-c.y),c.x,520-c.x,c.y,320-c.y);
    Object.assign(drag.draft,{x:c.x-r,y:c.y-r,x2:c.x+r,y2:c.y+r});
   }else{drag.draft.x2=coordinate.x;drag.draft.y2=coordinate.y;}
  }
  else if(kind==='graph'){
   let dx=coordinate.x-drag.start.x,dy=coordinate.y-drag.start.y;
   const legacy=drag.indices.filter(i=>i<value.points.length).map(i=>drag.before.points[i]);
   if(legacy.length){dx=qwNum(dx,value.xmin-Math.min(...legacy.map(p=>p.x)),value.xmax-Math.max(...legacy.map(p=>p.x)),0);dy=qwNum(dy,value.ymin-Math.min(...legacy.map(p=>p.y)),value.ymax-Math.max(...legacy.map(p=>p.y)),0);}
   for(const i of drag.indices)setObject(i,qwTranslateGraphObject(objectAt(i,drag.before),dx,dy));
  }else{
   if(drag.indices.some(i=>['midpoint','angleBisector','perpendicularBisector'].includes(value[i]?.construction?.kind))){
    hint.textContent='Зависимое построение следует за исходной фигурой';return;
   }
   const o=value[selected];
   if(drag.vertexIndex>=0&&o.vertices?.[drag.vertexIndex]){
    const initial=drag.before[selected];
    if(initial.rotation){o.vertices=initial.vertices.map(v=>qwRotatePoint(v,qwObjectCenter(initial),initial.rotation));o.rotation=0;}
    const location=snapGeometry&&!e.shiftKey?qwSnapDiagramPoint(p,value,geometryStep,selected):p;
    const at=qwRotatePoint(location,qwObjectCenter(o),-(o.rotation||0));o.vertices[drag.vertexIndex].x=qwNum(at.x,0,520,0);o.vertices[drag.vertexIndex].y=qwNum(at.y,0,320,0);
    const v=o.vertices;o.x=Math.min(...v.map(q=>q.x));o.y=Math.min(...v.map(q=>q.y));o.x2=Math.max(...v.map(q=>q.x));o.y2=Math.max(...v.map(q=>q.y));
   }else{
    // Extended geometry is clipped to the stage for selection, but movement is
    // bounded by its stored anchor: clipping endpoints must not pin the line.
    const bounds=drag.indices.map(i=>{const o=drag.before[i];return ['ray','infiniteLine'].includes(o.kind)?{x:o.x,y:o.y,x2:o.x,y2:o.y}:o.kind==='arc'?{x:o.x,y:o.y,x2:o.x2,y2:o.y2}:qwObjectBounds(o);});let dx=p.x-drag.start.x,dy=p.y-drag.start.y;
    if(snapGeometry&&!e.shiftKey){dx=Math.round(dx/geometryStep)*geometryStep;dy=Math.round(dy/geometryStep)*geometryStep;}
    dx=qwNum(dx,-Math.min(...bounds.map(b=>b.x)),520-Math.max(...bounds.map(b=>b.x2)),0);dy=qwNum(dy,-Math.min(...bounds.map(b=>b.y)),320-Math.max(...bounds.map(b=>b.y2)),0);
    for(const i of drag.indices)value[i]=qwTranslateObject(drag.before[i],dx,dy);
   }
  }
  draw(false);
 };
 stage.onpointerup=()=>{
  if(!drag)return;const pending=drag;drag=null;
  if(pending.marquee){
   const a=pending.start,b=pending.end||a,r={x:Math.min(a.x,b.x),x2:Math.max(a.x,b.x),y:Math.min(a.y,b.y),y2:Math.max(a.y,b.y)};
   multi=new Set(pending.prior);objects().forEach((o,i)=>{const b=kind==='graph'?graphObjectBounds(o):qwObjectBounds(o);if(b.x>=r.x&&b.x2<=r.x2&&b.y>=r.y&&b.y2<=r.y2)multi.add(i);});selected=[...multi].at(-1)??-1;
  }
  if(pending.creating&&(kind==='graph'?pending.pixels>=4&&Math.hypot(pending.draft.x2-pending.draft.x,pending.draft.y2-pending.draft.y)>1e-9:qwValidDrag(pending.draft,pending.pixels))){
   const o=pending.draft;
   if(kind==='diagram'){
    if(['triangle','rightTriangle','quadrilateral'].includes(o.kind))o.vertices=qwGeometryVertices(o);
    if(QW_ELECTRICS.includes(o.kind)){
     o.id=qwId();
     if(o.kind!=='wireOrth'&&Math.abs(o.y2-o.y)<22){
      const cy=(o.y+o.y2)/2;o.y=Math.max(0,cy-24);o.y2=Math.min(320,cy+24);
     }
     if(o.kind==='wireOrth'){
      const start=qwNearestDiagramPort(value,{x:o.x,y:o.y},19),
       end=qwNearestDiagramPort(value,{x:o.x2,y:o.y2},19);
      if(start||end)o.links={...(start?{start:{id:start.id,port:start.port}}:{}),
       ...(end?{end:{id:end.id,port:end.port}}:{})};
     }
    }
    if(o.kind==='forceVector')o.label='F';
    if(o.kind==='velocityVector')o.label='v';
    if(o.kind==='accelerationVector')o.label='a';
    if(o.kind==='torque'){o.label='M';o.direction='cw';}
    if(o.kind==='weightSet')o.count=2;
    if(o.kind==='dynamometer')o.reading=0;
    value.push(o);
   }else value.elements.push(o);
   selectOnly(objects().length-1);
  }
  if(JSON.stringify(value)!==JSON.stringify(pending.before)){
   try{value=kind==='graph'?qwValidateGraph(value):qwValidateDiagram(value);history.push(pending.before);history=history.slice(-30);future=[];}
   catch(error){value=pending.before;selectOnly(-1);draw();hint.textContent=error.message;return;}
  }
  draw();
 };
 function cancelDrag(){if(!drag)return;value=drag.before;selected=drag.previous;multi=drag.selection||new Set();drag=null;draw();}
 stage.onpointercancel=cancelDrag;stage.onlostpointercapture=cancelDrag;
 d.addEventListener('cancel',e=>{if(polyline.length||drag||multi.size){e.preventDefault();cancelDrag();polyline=[];selectOnly(-1);draw();}});
 function remove(){if(selected<0)return;const caption=labelSelected&&labelInfo(labelSelected);if(caption&&!caption.free){remember();caption.clear();labelSelected='';draw();return;}remember();if(kind==='graph'){const count=value.points.length;value.points=value.points.filter((_,i)=>!multi.has(i));value.elements=value.elements.filter((_,i)=>!multi.has(i+count));}else{const removed=new Set(value.filter((_,i)=>multi.has(i)).map(o=>o.id).filter(Boolean));value=qwResolveDiagram(value).filter((_,i)=>!multi.has(i)).map(o=>{const copy={...o};
   if(copy.construction&&removed.has(copy.construction.reference))delete copy.construction;
   if(copy.kind==='wireOrth'&&copy.links){
    copy.links={...copy.links};
    for(const [end,link] of Object.entries(copy.links))if(removed.has(link.id))delete copy.links[end];
    if(!Object.keys(copy.links).length)delete copy.links;
   }
   return copy;});}selectOnly(-1);draw();}
 stage.onkeydown=e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();multi=new Set(objects().map((_,i)=>i));selected=objects().length-1;draw();}
  else if(e.key==='Escape'){e.preventDefault();cancelDrag();polyline=[];selectOnly(-1);draw();}
  else if(e.key==='Enter'&&polyline.length){e.preventDefault();finishPolyline();}
  else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();d.querySelector(e.shiftKey?'#qw-visual-redo':'#qw-visual-undo').click();}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();d.querySelector('#qw-visual-redo').click();}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();copySelection();}
 };
 d.querySelector('#qw-visual-undo').onclick=()=>{
  cancelDrag();polyline=[];if(history.length){
   future.push(structuredClone(value));value=history.pop();selectOnly(-1);draw();
  }
 };
 d.querySelector('#qw-visual-redo').onclick=()=>{
  cancelDrag();polyline=[];if(future.length){
   history.push(structuredClone(value));value=future.pop();selectOnly(-1);draw();
  }
 };
 d.querySelector('#qw-visual-copy').onclick=copySelection;
 d.querySelector('#qw-visual-delete').onclick=remove;
 d.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;if(t.dataset.tool){polyline=[];tool=t.dataset.tool;constructionReference=kind==='diagram'&&['parallel','perpendicular'].includes(tool)&&linear(value[selected])?selected:-1;for(const b of d.querySelectorAll('[data-tool]'))b.setAttribute('aria-pressed',String(b===t));if(matchMedia('(max-width:1000px)').matches)showPanel('');draw();}
  if(t.id==='qw-label-reset'&&labelSelected){const info=labelInfo(labelSelected);if(info&&!info.free){remember();info.set({mode:'auto',dx:0,dy:0});draw();}return;}
  if(t.id==='qw-finish-polyline'){finishPolyline();return;}
  if(t.dataset.graphObject!==undefined){const i=Number(t.dataset.graphObject);if(e.shiftKey){if(multi.has(i))multi.delete(i);else multi.add(i);selected=[...multi].at(-1)??-1;}else selectOnly(i);tool='select';draw();return;}
  if(t.dataset.styleColor){applyStyle(t.dataset.styleKey,t.dataset.styleColor);return;}
  if(t.dataset.rotate){rotateSelected((value[selected]?.rotation||0)+Number(t.dataset.rotate));return;}
  if(t.id==='qw-unlink-wire'&&kind==='diagram'&&value[selected]?.kind==='wireOrth'){
   remember();delete value[selected].links;draw();return;
  }
  if(t.id==='qw-align-block'){const plane=value[Number(d.querySelector('#qw-align-plane').value)];rotateSelected(qwInclineAngle(plane));return;}
  if(t.dataset.layer&&multi.size){labelSelected='';remember();const picked=value.filter((_,i)=>multi.has(i)),rest=value.filter((_,i)=>!multi.has(i));value=t.dataset.layer==='front'?[...rest,...picked]:[...picked,...rest];multi=new Set(picked.map((_,i)=>t.dataset.layer==='front'?rest.length+i:i));selected=[...multi].at(-1);draw();return;}
  if(t.dataset.construction){
   try{
    if(value.length>=60)throw Error('Максимум 60 фигур');
    const index=Number(d.querySelector('#qw-construction-vertex')?.value||0);
    const result=qwTriangleConstruction(value[selected],t.dataset.construction,index);
    remember();value.push(result);selected=value.length-1;tool='select';draw();
    d.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool==='select')));
   }catch(error){hint.textContent=error.message;hint.className='qw-error';}
   return;
  }if(t.id==='qw-add-point'&&kind==='graph'&&value.points.length<40){remember();value.points.push({...qwSnapGraphPoint(value,(value.xmin+value.xmax)/2,(value.ymin+value.ymax)/2),label:''});selected=value.points.length-1;draw();}if(t.dataset.pointDelete!==undefined){selectOnly(Number(t.dataset.pointDelete));remove();}if(t.dataset.pointUp!==undefined){const i=Number(t.dataset.pointUp);if(i>0){remember();[value.points[i-1],value.points[i]]=[value.points[i],value.points[i-1]];draw();}}if(t.dataset.objectSelect!==undefined){const i=Number(t.dataset.objectSelect);if(e.shiftKey){if(multi.has(i))multi.delete(i);else multi.add(i);selected=[...multi].at(-1)??-1;}else selectOnly(i);tool='select';draw();}});
 for(const event of ['pointerdown','focusin'])d.addEventListener(event,e=>{if(e.target.dataset.style)e.target._qwTargets=selectedIndices();});
 d.addEventListener('change',e=>{const t=e.target;try{if(t.id==='qw-snap-geometry'){snapGeometry=t.checked;draw(false);return;}if(t.id==='qw-grid-step-geometry'){geometryStep=Number(t.value);draw(false);return;}
   if(t.id==='qw-label-mode'||t.dataset.labelOffset||t.dataset.freeLabel){
    const info=labelInfo(labelSelected),node=labelNode();if(!info||!node)return;
    if(t.dataset.freeLabel){const n=Number(t.value);if(!Number.isFinite(n))throw Error('Проверьте координату');remember();const delta=n-info.object[t.dataset.freeLabel];setObject(info.ownerIndex,kind==='graph'?qwTranslateGraphObject(info.object,t.dataset.freeLabel==='x'?delta:0,t.dataset.freeLabel==='y'?delta:0):qwTranslateObject(info.object,t.dataset.freeLabel==='x'?delta:0,t.dataset.freeLabel==='y'?delta:0));}
    else{const pos={mode:t.id==='qw-label-mode'?t.value:'manual',dx:Number(node.dataset.labelOffsetX),dy:Number(node.dataset.labelOffsetY)};if(t.dataset.labelOffset)pos[t.dataset.labelOffset]=Number(t.value);const valid=qwLabelPosition(pos);remember();info.set(valid);}
    draw();return;
   }
   if(t.id==='qw-coordinate-mode'){
    const range=qwCoordinatePreset(t.value);const next=qwValidateGraph({...value,...(range||{}),coordinateMode:t.value});remember();value=next;draw();showRangeWarning();return;
   }
   if(t.dataset.elementField||t.dataset.elementCurve||t.dataset.polylineVertex!==undefined){
    const next=structuredClone(value),o=next.elements[selected-next.points.length];if(!o)return;
    if(t.dataset.elementField){const k=t.dataset.elementField;o[k]=k==='label'?t.value:Number(t.value);}
    else if(t.dataset.elementCurve){const k=t.dataset.elementCurve;o.curve[k]=k==='trig'?t.value:Number(t.value);}
    else o.vertices[Number(t.dataset.polylineVertex)][t.dataset.coordinate]=Number(t.value);
    const validated=qwValidateGraph(next);remember();value=validated;t.defaultValue=t.value;draw();return;
   }
   if(t.dataset.physicsField!==undefined){
    const next=structuredClone(value),o=next[selected];if(!o)return;
    const key=t.dataset.physicsField;o[key]=key==='direction'?t.value:Number(t.value);
    const validated=qwValidateDiagram(next);remember();value=validated;t.defaultValue=t.value;draw();return;
   }
   if(t.dataset.arcField!==undefined||t.dataset.diagramField!==undefined||t.dataset.polygonSides!==undefined){
    const next=structuredClone(value),o=next[selected];if(!o)return;
    if(t.dataset.polygonSides!==undefined)o.sides=Number(t.value);
    else if(t.dataset.arcField){
     const fields={cx:(o.x+o.x2)/2,cy:(o.y+o.y2)/2,radius:(o.x2-o.x)/2,startAngle:o.startAngle,endAngle:o.endAngle};fields[t.dataset.arcField]=Number(t.value);
     Object.assign(o,{x:fields.cx-fields.radius,y:fields.cy-fields.radius,x2:fields.cx+fields.radius,y2:fields.cy+fields.radius,startAngle:fields.startAngle,endAngle:fields.endAngle});
    }else o[t.dataset.diagramField]=Number(t.value);
    const validated=qwValidateDiagram(next);remember();value=validated;t.defaultValue=t.value;draw();return;
   }
   if(t.dataset.legacyPaint){const style=qwValidateStyle({stroke:t.value});remember();value[t.dataset.legacyPaint]={...value[t.dataset.legacyPaint],...style};draw(false);return;}
   if(t.id==='qw-diagram-preset'&&t.value!=='none'){
    remember();value=qwPhysicsPreset(t.value);selected=-1;tool='select';draw();
    d.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool==='select')));return;
   }
   if(t.dataset.style){applyStyle(t.dataset.style,t.type==='number'?Number(t.value):t.value,t._qwTargets||selectedIndices());return;}
   if(t.id==='qw-block-rotation'&&value[selected]){
    const next=structuredClone(value);next[selected].rotation=Number(t.value);
    const validated=qwValidateDiagram(next);remember();value=validated;draw();return;
   }if(t.dataset.graphField){const next=structuredClone(value),k=t.dataset.graphField;next[k]=t.type==='checkbox'?t.checked:t.type==='number'?Number(t.value):t.value;if(['xmin','xmax','ymin','ymax'].includes(k))next.coordinateMode='custom';const validated=qwValidateGraph(next);remember();value=validated;draw(false);showRangeWarning();}if(t.dataset.pointField){const next=structuredClone(value),k=t.dataset.pointField;next.points[Number(t.dataset.pointIndex)][k]=k==='label'?t.value:Number(t.value);const validated=qwValidateGraph(next);remember();value=validated;draw(false);}if(t.id==='qw-object-label'&&value[selected]){remember();value[selected].label=t.value;draw(false);}
   if(t.dataset.edgeIndex!==undefined&&value[selected]?.vertices){
    const next=structuredClone(value),index=Number(t.dataset.edgeIndex);
    if(!next[selected].edgeLabels)next[selected].edgeLabels=next[selected].vertices.map(()=>'');
    next[selected].edgeLabels[index]=t.value.slice(0,40);
    const validated=qwValidateDiagram(next);remember();value=validated;draw();
   }
   if(t.dataset.vertexIndex!==undefined&&value[selected]?.vertices){
    const next=structuredClone(value),vertex=next[selected].vertices[Number(t.dataset.vertexIndex)],
     key=t.dataset.vertexField;
    if(!vertex||!['label','x','y'].includes(key))throw Error('Неизвестный параметр вершины');
    vertex[key]=key==='label'?t.value:Number(t.value);
    const v=next[selected].vertices;next[selected].x=Math.min(...v.map(p=>p.x));next[selected].y=Math.min(...v.map(p=>p.y));next[selected].x2=Math.max(...v.map(p=>p.x));next[selected].y2=Math.max(...v.map(p=>p.y));
    const validated=qwValidateDiagram(next);remember();value=validated;draw();
   }
   if(t.id==='qw-curve-family'){
    const next=structuredClone(value);next.curveFamily=t.value;
    const validated=qwValidateGraph(next);remember();value=validated;draw();
   }
   if(t.dataset.curveParam||t.id==='qw-curve-trig'){
    const next=structuredClone(value);
    if(t.dataset.curveParam)next.curve[t.dataset.curveParam]=Number(t.value);
    else next.curve.trig=t.value;
    const validated=qwValidateGraph(next);remember();value=validated;draw(false);
   }if(t.id==='qw-graph-preset'&&t.value!=='custom'){
    remember();value=qwGraphDefault();
    const ps={v:[[0,0],[2,6],[6,6],[9,0]],x:[[0,2],[4,8],[9,8]],a:[[0,4],[5,4],[5,0],[9,0]],p:[[1,9],[2,5],[4,2.5],[9,1]],i:[[0,0],[3,3],[8,8]]};
    if(ps[t.value]){
     value.points=ps[t.value].map(([x,y])=>({x,y,label:''}));
     value.xlabel={v:'t, с',x:'t, с',a:'t, с',p:'V, л',i:'U, В'}[t.value];
     value.ylabel={v:'v, м/с',x:'x, м',a:'a, м/с²',p:'p, кПа',i:'I, А'}[t.value];
     value.smooth=t.value==='p';
    }else if(t.value==='parabola'){
     Object.assign(value,{xmin:-5,xmax:5,ymin:-2,ymax:10,xlabel:'x',ylabel:'y',curveFamily:'quadratic'});
     value.curve={...value.curve,a:0.4,b:0,c:0};
    }else if(t.value==='sin'||t.value==='cos'){
     Object.assign(value,{xmin:-6,xmax:6,ymin:-4,ymax:4,xlabel:'x',ylabel:'y',step:1,curveFamily:'trigonometric'});
     value.curve={...value.curve,trig:t.value,amplitude:3,frequency:1,phase:0,offset:0};
    }
    value.coordinateMode=value.xmin<0&&value.ymin<0?'math':value.xmin===0&&value.ymin<0?'positiveX':'first';
    selected=-1;draw();
   }if(t instanceof HTMLInputElement)t.defaultValue=t.value;}catch(error){draw();hint.textContent=error.message;hint.className='qw-error';}});
 d.querySelector('[data-qw-action="visual-apply"]').onclick=()=>{try{if(polyline.length){hint.textContent='Завершите ломаную или отмените её клавишей Escape';return;}const validated=kind==='graph'?qwValidateGraph(value):qwValidateDiagram(value);if(onCommit){visualCommitted=true;d.close();onCommit(kind,validated);}else{visualCommitted=true;qwChange(()=>{q[kind]=validated;q.figure=kind;});d.close();}}catch(e){hint.textContent=e.message;}};draw();
}
function qwNew(){if((qwDoc.tasks.length||qwCorrupt)&&!confirm('Создать новую работу? Для резервной копии сохраните QWORK.'))return;qwRemember();if(qwDoc.tasks.length)qwRecentWork=structuredClone(qwDoc);qwCorrupt='';qwDoc=qwProject();qwDoc.layout='booklet';qwDoc.printSettings=qwPrintSettings({profile:'exam'});qwSelected='';qwPersist();qwRender();}
function qwAction(action,button){
 const q=qwCurrent();
 if(!qwCanNavigate())return;
 if(action==='new'){qwNew();return;}if(action==='open'){document.getElementById('qw-file')?.click();return;}if(action==='save'){qwSaveFile();return;}if(action==='settings'){qwSettings();return;}if(action==='preview'){qwPreview();return;}if(action==='answers'){qwPreview('answers');return;}if(action==='pdf'||action==='pdf-text'){qwPrintTextPDF();return;}if(action==='pdf-student'||action==='pdf-teacher'){if(action==='pdf-teacher')qwPreview('answers');else qwPrintTextPDF();return;}
 if(action==='left'||action==='right'||action==='close-panels'){qwLeft=action==='left'?!qwLeft:false;qwRight=action==='right'?!qwRight:false;qwRender();return;}
 if(action==='quick-add'||action==='add'||action==='part'){if(qwDoc.tasks.length>=80){status('Максимум 80 заданий',true);return;}const name=action==='part'?prompt('Название части','Часть '+(new Set(qwDoc.tasks.map(q=>q.part)).size+1)):null;if(action==='part'&&name===null)return;qwChange(()=>{const t=qwQuickTask(button?.dataset.type||'short');t.part=name||q?.part||'Часть 1';if(['math','geometry','algebra'].includes(qwDoc.subject)&&t.figure==='graph')Object.assign(t.graph,qwCoordinatePreset('math'),{coordinateMode:'math',xlabel:'x',ylabel:'y'});let at=qwDoc.tasks.length;if(action!=='part'&&q){at=qwDoc.tasks.map(t=>t.part).lastIndexOf(q.part)+1;}qwDoc.tasks.splice(at,0,t);qwSelected=t.id;qwLeft=false;});const surface=document.querySelector('#qw-task-editor [data-bank-live=prompt]');if(surface)qwFocusCondition(surface);return;}
 if(action==='recent'&&qwRecentWork){qwChange(()=>{qwDoc=structuredClone(qwRecentWork);qwSelected='';});return;}
 if(action==='select'){qwSelected=button.dataset.id;qwLeft=false;qwRender();return;}
 if(action==='undo'||action==='redo'){const from=action==='undo'?qwUndo:qwRedo,to=action==='undo'?qwRedo:qwUndo;while(from.length&&from.at(-1)===JSON.stringify(qwDoc))from.pop();if(from.length){to.push(JSON.stringify(qwDoc));qwDoc=qwValidate(JSON.parse(from.pop()));qwPersist();qwRender();}return;}
 if(action==='example'){if(qwDoc.tasks.length&&!confirm('Заменить текущую работу примером? Сохраните QWORK для резервной копии.'))return;qwChange(()=>{qwDoc=qwExample(qwDoc.subject);qwSelected=qwDoc.tasks[0].id;});return;}
 if(action==='recovery'){download('QuantumOffice-work-recovery.json',qwCorrupt||JSON.stringify(qwDoc),'application/json');return;}
 if(action==='bank'){qwBank();return;}if(action==='from-diag'){const tasks=typeof qdWorkingDoc==='function'?qdWorkingDoc().sections.flatMap(s=>s.questions.map(q=>({...qwFromDiagnostic(q),part:s.title}))):[];if(!tasks.length){status('В диагностике нет заданий',true);return;}if(tasks.length+qwDoc.tasks.length>80){status('В работе может быть не более 80 заданий',true);return;}qwChange(()=>{qwDoc.tasks.push(...tasks);qwSelected=tasks[0].id;});return;}
 if(!q)return;
 if(action==='up'||action==='down'){qwChange(()=>qwMove(qwDoc,q.id,action==='up'?-1:1));return;}
 if(action==='duplicate'){qwChange(()=>{const copy=qwDuplicate(qwDoc,q.id);if(copy)qwSelected=copy.id;});return;}
 if(action==='delete'){if(!confirm('Удалить задание '+(qwDoc.tasks.indexOf(q)+1)+'?'))return;qwChange(()=>{qwDoc.tasks=qwDoc.tasks.filter(t=>t.id!==q.id);qwSelected='';});return;}
 if(action==='bank-save'){qwBankSave();return;}
}
let qwDragging='',qwDropTarget=null,qwDragPanel=null,qwDragY=0,qwDragFrame=0;
function qwScrollDrag(){if(!qwDragging||!qwDragPanel?.isConnected)return;const b=qwDragPanel.getBoundingClientRect(),direction=qwDragY<b.top+40?-1:qwDragY>b.bottom-40?1:0;if(direction)qwDragPanel.scrollTop+=direction*14;qwDragFrame=requestAnimationFrame(qwScrollDrag);}
function qwClearDrop(){document.querySelectorAll('.qw-drop-before,.qw-drop-after').forEach(e=>e.classList.remove('qw-drop-before','qw-drop-after'));qwDropTarget=null;}
if(typeof document!=='undefined'){
 document.addEventListener('dragstart',e=>{const h=e.target.closest('[data-drag-id]');if(!qwActive()||!h)return;qwDragging=h.dataset.dragId;qwDragPanel=h.closest('.qw-left');qwDragY=e.clientY;cancelAnimationFrame(qwDragFrame);qwDragFrame=requestAnimationFrame(qwScrollDrag);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/x-qwork-task',qwDragging);});
 document.addEventListener('dragover',e=>{if(!qwActive()||!qwDragging)return;qwDragY=e.clientY;if(e.target.closest('.qw-left'))e.preventDefault();const target=e.target.closest('[data-task-row],[data-task-part]');if(!target)return;e.preventDefault();e.dataTransfer.dropEffect='move';qwClearDrop();const row=target.dataset.taskRow,b=target.getBoundingClientRect(),after=row!==undefined&&e.clientY>b.top+b.height/2,gap=row!==undefined?Number(row)+(after?1:0):Number(target.dataset.taskGap),part=row!==undefined?qwDoc.tasks[Number(row)].part:target.dataset.taskPart;qwDropTarget={gap,part};target.classList.add(after?'qw-drop-after':'qw-drop-before');const panel=target.closest('.qw-left'),r=panel.getBoundingClientRect();if(e.clientY<r.top+45)panel.scrollTop-=15;if(e.clientY>r.bottom-45)panel.scrollTop+=15;});
 document.addEventListener('drop',e=>{if(!qwActive()||!qwDragging||!qwDropTarget)return;e.preventDefault();const id=qwDragging,target=qwDropTarget;qwDragging='';cancelAnimationFrame(qwDragFrame);qwClearDrop();if(e.dataTransfer.getData('application/x-qwork-task')!==id)return;const next=structuredClone(qwDoc);if(qwReorder(next,id,target.gap,target.part))qwChange(()=>{qwDoc=next;qwSelected=id;});});
 document.addEventListener('dragend',()=>{qwDragging='';cancelAnimationFrame(qwDragFrame);qwClearDrop();});
 document.addEventListener('click',e=>{if(!qwActive()||e.target.closest('#qw-dialog'))return;const b=e.target.closest('[data-qw-action],[data-action^="work-"]');if(!b)return;e.preventDefault();e.stopPropagation();qwAction(b.dataset.qwAction||b.dataset.action.slice(5),b);},true);
 document.addEventListener('focusin',e=>{if(qwActive()&&e.target.matches('#qo-work-root textarea,#qo-work-root input[data-qw-field]'))qwRemember();});
 document.addEventListener('input',e=>{if(!qwActive())return;const t=e.target,k=t.dataset.qwField,q=qwCurrent();if(!q||!['prompt','answer','criteria','comment','part','title'].includes(k))return;q[k]=qwText(t.value,k==='part'||k==='title'?120:16000);qwPersist();qwPreviewSelected();});
 document.addEventListener('change',async e=>{if(!qwActive())return;const t=e.target;
  if(t.id==='qw-file'){const file=t.files?.[0];t.value='';if(!file)return;try{if(file.size>QW_LIMITS.bytes)throw Error('Файл больше 18 МБ');const next=qwValidate(JSON.parse(await file.text()));for(const image of new Set(next.tasks.map(q=>q.image).filter(Boolean)))await qwImage(image);if((qwDoc.tasks.length||qwCorrupt)&&!confirm('Открыть работу вместо текущей? Сохраните текущую в QWORK.'))return;const links=await qwCheckWorkBankLinks(next);qwRemember();qwDoc=next;qwRecentWork=structuredClone(next);qwCorrupt='';qwSelected='';qwPersist();qwRender();status('Работа открыта'+(links.rebound?' · Уточнены номера банка: '+links.rebound:'')+(links.external?' · Внешние ссылки без локального подтверждения: '+links.external:''));}catch(e){status('Не удалось открыть QWORK: '+e.message,true);}return;}

  const k=t.dataset.qwField,q=qwCurrent();if(!q||!k||['prompt','answer','criteria','comment','part','title'].includes(k))return;if(k==='choices'){try{const choices=t.value.split(/\n/).map(s=>s.trim()).filter(Boolean);qwValidate({...qwDoc,tasks:qwDoc.tasks.map(a=>a===q?{...q,choices}:a)});qwRemember();q.choices=choices;t.defaultValue=t.value;qwPersist();qwPreviewSelected();}catch(error){status(error.message,true);}return;}qwRemember();if(t.type==='checkbox')q[k]=t.checked;else if(t.type==='number'){const ranges={points:[0,100],boxes:[1,30],solutionHeight:[24,500],figureWidth:[120,470]};const [min,max]=ranges[k]||[0,100];q[k]=qwNum(t.value,min,max,min);t.value=q[k];}else q[k]=t.value;
  if(k==='type'){if(q.type==='choice')q.choices??=qwTask('choice').choices;if(['extended','combined'].includes(q.type))q.solutionVisible=true;if(q.type==='graph')q.figure='graph';if(q.type==='diagram')q.figure='diagram';}
  qwPersist();if(t.tagName==='SELECT'||t.type==='checkbox')qwRender();else qwPreviewSelected();
 });
 window.addEventListener('keydown',e=>{if(page==='bank'&&(e.ctrlKey||e.metaKey)&&(e.code==='KeyS'||e.key.toLowerCase()==='s')&&!document.querySelector('dialog[open]:not(.qw-bank-inline)')){e.preventDefault();e.stopImmediatePropagation();(document.querySelector('[data-qw-action="bank-edit-save"]')||document.querySelector('[data-qw-action="bank-export"]'))?.click();return;}if(!qwActive()||e.target.closest?.('#qw-task-editor'))return;if((e.ctrlKey||e.metaKey)&&!document.querySelector('dialog[open]')&&(e.code==='KeyZ'||e.key.toLowerCase()==='z')&&!e.target.closest('textarea,input,[contenteditable="true"]')){e.preventDefault();e.stopImmediatePropagation();qwAction(e.shiftKey?'redo':'undo');return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&!document.querySelector('dialog[open]')){e.preventDefault();e.stopImmediatePropagation();qwSaveFile();}if(e.key==='Escape'&&!document.querySelector('dialog[open]')){qwLeft=qwRight=false;qwRender();}},true);
}

function qwFooter(active){
 const spans=document.querySelectorAll('.qo-document-workspace>.qo-editor-foot>span');
 spans.forEach((e,i)=>{if(active){if(e.dataset.qwOriginal===undefined)e.dataset.qwOriginal=e.textContent;e.textContent=i===0?'A4 · PDF':i===1?qwDoc.tasks.length+' заданий · '+qwDoc.tasks.reduce((s,q)=>s+q.points,0)+' баллов':'QWORK / PDF';}else if(e.dataset.qwOriginal!==undefined){e.textContent=e.dataset.qwOriginal;delete e.dataset.qwOriginal;}});
}
