/* TASK144: standalone mathematics/physics workbench, reusing Office shell/symbols. */
const QW_KEY='quantum-office.work-builder.v1',QW_BANK_KEY='quantum-office.work-bank.v1';
let qwDoc=qwProject(),qwSelected='',qwLeft=false,qwRight=false,qwStorageError='',qwCorrupt='',qwUndo=[],qwRedo=[],qwExported='',qwBusy=false;
try{const raw=localStorage.getItem(QW_KEY);if(raw)try{qwDoc=qwValidate(JSON.parse(raw));}catch(e){qwCorrupt=raw;qwStorageError='Не удалось открыть черновик. Скачайте исходные данные.';}}catch(e){qwStorageError='Хранилище недоступно. Сохраняйте QWORK.';}
function qwCurrent(){return qwDoc.tasks.find(q=>q.id===qwSelected)||null;}
function qwActive(){return typeof page!=='undefined'&&page==='writer'&&qoWorkspaceTab.writer==='work';}
function qwRemember(){const value=JSON.stringify(qwDoc);if(qwUndo.at(-1)!==value)qwUndo.push(value);qwUndo=qwUndo.slice(-20);qwRedo=[];}
function qwPersist(){
 if(qwCorrupt)return false;
 try{localStorage.setItem(QW_KEY,JSON.stringify(qwDoc));qwStorageError='';}catch(e){qwStorageError='Черновик не записан. Скачайте QWORK.';}
 if(typeof page!=='undefined')qwFooter(qwActive());
 const el=document.getElementById('qw-save-state');if(el)el.textContent=qwStorageError|| (qwExported===JSON.stringify(qwDoc)?'Экспортирован QWORK':'Черновик на устройстве');return !qwStorageError;
}
function qwChange(fn){qwRemember();fn();qwPersist();qwRender();}
function qwButton(action,label,extra=''){return '<button type="button" data-qw-action="'+action+'" '+extra+'>'+label+'</button>';}
function qwOptions(values,current){return values.map(([k,v])=>'<option value="'+qwEsc(k)+'" '+(String(k)===String(current)?'selected':'')+'>'+qwEsc(v)+'</option>').join('');}
function qwField(key,label,value,type='text',extra=''){return '<label>'+label+'<input data-qw-field="'+key+'" type="'+type+'" value="'+qwEsc(value)+'" '+extra+'></label>';}
function qwSelect(key,label,values,value){return '<label>'+label+'<select data-qw-field="'+key+'">'+qwOptions(values,value)+'</select></label>';}
function qwCheck(key,label,on){return '<label class="qw-check"><input type="checkbox" data-qw-field="'+key+'" '+(on?'checked':'')+'>'+label+'</label>';}
function qwToolbar(){return qoWorkGroup('Работа',qoWorkButton('work-new','Создать работу','new')+qoWorkButton('work-open','Открыть QWORK','folder')+qoWorkButton('work-save','Сохранить QWORK','save'))+qoWorkGroup('Готовый вариант',qoWorkButton('work-preview','Предпросмотр страниц','file-text')+qoWorkButton('work-pdf-text','PDF с текстом','file-text')+qoWorkButton('work-pdf-student','PDF для ученика','download')+qoWorkButton('work-pdf-teacher','PDF для преподавателя','printer'));}
function qwTaskPreview(q,index=0){
 const visual=q.figure==='graph'?qwGraphSVG(q.graph):q.figure==='diagram'?qwDiagramSVG(q.diagram):q.figure==='image'&&q.image?'<img alt="Иллюстрация задания" src="'+q.image+'">':'';
 return '<article class="qw-paper-task"><header><b>Задание '+(index+1)+'</b><span>'+qwEsc(QW_TYPES[q.type])+' · '+q.points+' б.</span></header><div class="qw-task-flow qw-figure-'+q.position+'">'+(visual?'<figure style="width:'+Math.min(q.figureWidth,470)+'px">'+visual+'</figure>':'')+'<div>'+qwContentHTML(q.prompt||'Условие не заполнено')+'</div></div>'+(q.answerVisible?'<div class="qw-answer-preview">Ответ: '+(q.answerStyle==='boxes'?Array.from({length:q.boxes},()=>'<i></i>').join(''):q.answerStyle==='box'?'<i class="qw-answer-box"></i>':'<span></span>')+'</div>':'')+(q.solutionVisible?'<div class="qw-solution-preview qw-solution-'+q.solutionStyle+'" style="height:'+q.solutionHeight+'px"></div>':'')+'</article>';
}
function qwRender(){
 const host=document.getElementById('qo-work-root');if(!host)return;
 if(!qwDoc.tasks.some(q=>q.id===qwSelected))qwSelected=qwDoc.tasks[0]?.id||'';
 qwFooter(qwActive());
 const q=qwCurrent(),old=host.querySelector('.qw-center')?.scrollTop||0;
 host.className='qw-frame'+(qwLeft?' qw-left-open':'')+(qwRight?' qw-right-open':'');
 host.innerHTML='<aside class="qw-left" aria-label="Структура работы">'+qwButton('close-panels','Закрыть','class="qw-drawer-close"')+'<header><strong>Задания</strong><span>'+qwDoc.tasks.length+' / 80</span></header><label>Новое задание<select id="qw-add-type">'+qwOptions(Object.entries(QW_TYPES),'short')+'</select></label><div class="qw-row">'+qwButton('add','+ Задание','class="qw-primary"')+qwButton('part','+ Часть')+'</div><nav>'+qwDoc.tasks.map((t,i)=>((!i||qwDoc.tasks[i-1].part!==t.part)?'<h3>'+qwEsc(t.part||'Без части')+'</h3>':'')+'<button type="button" class="qw-nav-task" data-qw-action="select" data-id="'+qwEsc(t.id)+'" aria-current="'+(t.id===qwSelected)+'" title="'+qwEsc(t.prompt)+'"><b>'+(i+1)+'</b><span>'+qwEsc(t.prompt||QW_TYPES[t.type])+'</span></button>').join('')+'</nav><div class="qw-row">'+qwButton('bank','Банк заданий')+qwButton('from-diag','Из диагностики')+'</div></aside>'+
 '<main class="qw-center"><div class="qw-center-head"><h1>'+qwEsc(qwDoc.title)+'</h1><div class="qw-row">'+qwButton('left','Задания','class="qw-mobile"')+qwButton('right','Свойства','class="qw-mobile"')+qwButton('settings','Параметры работы')+qwButton('preview','Предпросмотр')+qwButton('pdf-text','PDF с текстом')+qwButton('save','Сохранить QWORK','class="qw-primary"')+'</div><div class="qw-row"><span id="qw-save-state" role="status">'+qwEsc(qwStorageError||'Черновик на устройстве')+'</span>'+qwButton('undo','Отменить',qwUndo.length?'':'disabled')+qwButton('redo','Повторить',qwRedo.length?'':'disabled')+qwButton('example','Пример работы')+'</div></div>'+
 (qwCorrupt?'<div class="qw-error" role="alert">'+qwEsc(qwStorageError)+qwButton('recovery','Скачать исходные данные')+qwButton('new','Новый проект')+'</div>':'')+
 (q?'<section class="qw-editor"><div class="qw-row"><strong>Задание '+(qwDoc.tasks.indexOf(q)+1)+'</strong>'+qwButton('up','↑','title="Переместить выше" '+(!qwDoc.tasks.indexOf(q)?'disabled':''))+qwButton('down','↓','title="Переместить ниже" '+(qwDoc.tasks.indexOf(q)===qwDoc.tasks.length-1?'disabled':''))+qwButton('duplicate','Копия')+qwButton('delete','Удалить')+'</div><label>Условие<textarea id="qw-prompt" data-qw-field="prompt" maxlength="16000" rows="7">'+qwEsc(q.prompt)+'</textarea></label><div class="qw-row qw-insert">'+qwButton('math','Формула')+qwButton('symbols','Символы')+qwButton('blank','Пустая вставка')+qwButton('graph','График')+qwButton('diagram','Схема')+qwButton('image','Изображение')+'</div></section><section class="qw-selected-preview" id="qw-task-preview" aria-label="Вид задания">'+qwTaskPreview(q,qwDoc.tasks.indexOf(q))+'</section>':'<div class="qw-empty"><h2>Нет заданий</h2>'+qwButton('add','Добавить задание','class="qw-primary"')+'</div>')+'</main>'+
 '<aside class="qw-right" aria-label="Свойства задания">'+qwButton('close-panels','Закрыть','class="qw-drawer-close"')+'<h2>Свойства задания'+(q?' № '+(qwDoc.tasks.indexOf(q)+1):'')+'</h2>'+(q?qwSelect('type','Тип',Object.entries(QW_TYPES),q.type)+qwField('part','Часть',q.part)+qwField('points','Баллы',q.points,'number','min="0" max="100"')+qwCheck('answerVisible','Поле ответа',q.answerVisible)+qwSelect('answerStyle','Формат ответа',[['line','Строка'],['box','Рамка'],['boxes','Ячейки']],q.answerStyle)+(q.answerStyle==='boxes'?qwField('boxes','Количество ячеек',q.boxes,'number','min="1" max="30"'):'')+qwCheck('solutionVisible','Место для решения',q.solutionVisible)+(q.solutionVisible?qwField('solutionHeight','Высота решения, пт',q.solutionHeight,'number','min="24" max="500"')+qwSelect('solutionStyle','Разлиновка',[['lines','Строки'],['grid','Клетка'],['blank','Без разлиновки']],q.solutionStyle):'')+qwSelect('figure','Иллюстрация',[['none','Нет'],['graph','График'],['diagram','Схема'],['image','Изображение']],q.figure)+(q.figure!=='none'?qwSelect('position','Расположение',[['left','Слева'],['right','Справа'],['below','Под условием']],q.position)+qwField('figureWidth','Ширина, пт',q.figureWidth,'number','min="120" max="470"'):'')+qwCheck('pageBreak','С новой страницы',q.pageBreak)+'<details><summary>Ответ и критерии</summary>'+['answer','criteria','comment'].map((k,i)=>'<label>'+['Ответ преподавателя','Критерии','Комментарий'][i]+'<textarea data-qw-field="'+k+'" rows="3" maxlength="16000">'+qwEsc(q[k])+'</textarea></label>').join('')+'</details>'+qwButton('bank-save','Сохранить задание в банк'):'<p>Нет выбранного задания</p>')+'</aside><input type="file" id="qw-file" accept=".qwork,application/json" hidden><input type="file" id="qw-image" accept="image/png,image/jpeg,image/webp" hidden>';
 host.querySelector('.qw-center').scrollTop=old;
}
function qwPreviewSelected(){const p=document.getElementById('qw-task-preview'),q=qwCurrent();if(p&&q)p.innerHTML=qwTaskPreview(q,qwDoc.tasks.indexOf(q));const t=document.querySelector('.qw-nav-task[aria-current="true"] span');if(t&&q){t.textContent=q.prompt||QW_TYPES[q.type];t.parentElement.title=q.prompt;}}
function qwDialog(title,body,footer=''){document.getElementById('qw-dialog')?.remove();const d=document.createElement('dialog');d.id='qw-dialog';d.className='qw-dialog';d.innerHTML='<header><strong>'+title+'</strong><button type="button" data-qw-close aria-label="Закрыть">×</button></header><div class="qw-dialog-body">'+body+'</div>'+(footer?'<footer>'+footer+'</footer>':'');d.addEventListener('close',()=>d.remove());d.querySelector('[data-qw-close]').onclick=()=>d.close();document.body.append(d);d.showModal();return d;}
function qwSettings(){const d=qwDialog('Параметры работы','<div class="qw-settings">'+['title','grade','topic','variant'].map((k,i)=>'<label>'+['Название','Класс','Тема','Вариант №'][i]+'<input data-meta="'+k+'" value="'+qwEsc(qwDoc[k])+'" maxlength="160"></label>').join('')+'<label>Предмет<select data-meta="subject">'+qwOptions([['physics','Физика'],['math','Математика']],qwDoc.subject)+'</select></label><label class="qw-settings-wide">Инструкция<textarea data-meta="instructions" rows="4" maxlength="4000">'+qwEsc(qwDoc.instructions)+'</textarea></label></div>',qwButton('meta-apply','Применить','class="qw-primary"'));d.querySelector('[data-qw-action="meta-apply"]').onclick=()=>{qwChange(()=>{for(const e of d.querySelectorAll('[data-meta]'))qwDoc[e.dataset.meta]=e.type==='checkbox'?e.checked:qwText(e.value,e.dataset.meta==='instructions'?4000:160);qwDoc.title=qwDoc.title.trim()||'Новая работа';});d.close();};}
function qwInsert(text){const el=document.getElementById('qw-prompt'),q=qwCurrent();if(!el||!q)return;qwRemember();const a=el.selectionStart??el.value.length,b=el.selectionEnd??a;el.setRangeText(text,a,b,'end');q.prompt=el.value.slice(0,16000);qwPersist();qwPreviewSelected();el.focus();}
function qwFormula(){const d=qwDialog('Формула','<div class="qw-row">'+['\\frac{a}{b}','x^{2}','a_{1}','\\sqrt{x}','(a+b)','\\Delta t'].map(v=>'<button type="button" data-formula="'+qwEsc(v)+'">'+qwContentHTML('\\('+v+'\\)')+'</button>').join('')+'</div><label>Выражение<input id="qw-formula-source" maxlength="600" value="\\frac{a}{b}"></label><div id="qw-formula-preview"></div><p class="qw-muted">Дробь: \\frac{a}{b} · корень: \\sqrt{x} · индексы: x^{2}, a_{1}</p>',qwButton('formula-insert','Вставить','class="qw-primary"'));const input=d.querySelector('input'),view=d.querySelector('#qw-formula-preview'),ok=d.querySelector('[data-qw-action="formula-insert"]');const update=()=>{try{view.innerHTML='<math xmlns="http://www.w3.org/1998/Math/MathML">'+qwMathML(qwMath(input.value))+'</math>';ok.disabled=false;}catch(e){view.textContent=e.message;ok.disabled=true;}};input.oninput=update;for(const e of d.querySelectorAll('[data-formula]'))e.onclick=()=>{input.value=e.dataset.formula;update();};ok.onclick=()=>{const s=input.value;d.close();qwInsert('\\('+s+'\\)');};update();}
function qwSymbols(){const groups={...(typeof QO_WRITER_SYMBOLS==='object'?QO_WRITER_SYMBOLS:{}),'Греческие':['α','β','γ','δ','ε','ζ','η','θ','ι','κ','λ','μ','ν','ξ','π','ρ','σ','τ','υ','φ','χ','ψ','ω','Γ','Δ','Θ','Λ','Π','Σ','Φ','Ψ','Ω'],'Единицы':['м','с','кг','Н','Дж','Вт','Па','В','А','Ом','м/с','м/с²','Дж/(кг·°C)']};const d=qwDialog('Символы',Object.entries(groups).map(([k,vs])=>'<h3>'+qwEsc(k)+'</h3><div class="qw-symbols">'+vs.map(v=>'<button type="button" data-symbol="'+qwEsc(v)+'">'+qwEsc(v)+'</button>').join('')+'</div>').join(''));for(const e of d.querySelectorAll('[data-symbol]'))e.onclick=()=>{d.close();qwInsert(e.dataset.symbol);};}
/* Online publishing: browser's native print-to-PDF preserves selectable text and vector SVG.
   The older one-click raster PDF exporter remains available as a compatibility fallback. */
function qwPrintTextPDF(teacher=false){
 const project=qwValidate(qwDoc),title=qwEsc(project.title),subject=project.subject==='math'?'Математика':'Физика';
 const tasks=project.tasks.map((q,i)=>{
  const answer=teacher?'<div class="qw-teacher-notes"><strong>Ответ:</strong> '+qwContentHTML(q.answer||'—')+
   (q.criteria?'<p><strong>Критерии:</strong> '+qwContentHTML(q.criteria)+'</p>':'')+
   (q.comment?'<p><strong>Комментарий:</strong> '+qwContentHTML(q.comment)+'</p>':'')+'</div>':'';
  return '<section class="qw-print-section">'+qwTaskPreview(q,i)+answer+'</section>';
 }).join('');
 const css=String.raw`
  @page{size:A4;margin:16mm 15mm}
  html,body{margin:0;padding:0;background:#fff;color:#111;font:11pt/1.42 Arial,"Liberation Sans",sans-serif}
  h1{font-size:17pt;margin:0 0 2mm}h2{font-size:10pt;font-weight:normal;color:#555;margin:0 0 7mm}
  .qw-paper-task{border:0;margin:0 0 7mm;padding:0;break-inside:auto}
  .qw-paper-task header{display:flex;justify-content:space-between;gap:8mm;margin:0 0 3mm;break-after:avoid}
  .qw-paper-task header b{font-size:12pt}.qw-paper-task header span{font-size:9pt;color:#444}
  .qw-task-flow{display:flex;align-items:flex-start;gap:5mm;min-width:0}
  .qw-task-flow>div{min-width:0;flex:1;white-space:normal;overflow-wrap:anywhere}
  .qw-task-flow figure{margin:0;max-width:48%;flex:none;break-inside:avoid}
  .qw-task-flow figure img,.qw-task-flow figure svg{width:100%;height:auto;display:block}
  .qw-figure-right figure{order:2}.qw-figure-below{display:block}.qw-figure-below figure{max-width:100%;margin:3mm 0;width:100%}
  .qw-answer-preview{display:flex;align-items:center;gap:2mm;margin:3mm 0;font-size:10pt}
  .qw-answer-preview span{display:inline-block;border-bottom:1px solid #333;min-width:35mm;height:6mm}
  .qw-answer-preview i{display:inline-block;width:6mm;height:7mm;border:1px solid #555}
  .qw-answer-preview .qw-answer-box{min-width:38mm}
  .qw-inline-blank{display:inline-block;border-bottom:1px solid #333;max-width:100%;height:1em}
  .qw-solution-preview{max-height:140mm;border:1px solid #aaa;box-sizing:border-box;break-inside:avoid}
  .qw-solution-lines{background:repeating-linear-gradient(to bottom,transparent 0,transparent 6.5mm,#ddd 6.6mm)}
  .qw-solution-grid{background-image:linear-gradient(#ddd 1px,transparent 1px),linear-gradient(90deg,#ddd 1px,transparent 1px);background-size:5mm 5mm}
  .qw-teacher-notes{background:#f7f7f7;border-left:3px solid #555;padding:3mm;margin:0 0 7mm;break-inside:avoid}
  .qw-teacher-notes p{margin:2mm 0 0}.qw-print-section{break-inside:auto}
  math{font-size:1.02em}img,svg{break-inside:avoid}
  `;
 const html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>'+title+
  '</title><style>'+css+'</style></head><body><h1>'+title+'</h1>'+
  '<h2>'+subject+(project.topic?' · '+qwEsc(project.topic):'')+
  (project.grade?' · '+qwEsc(project.grade)+' класс':'')+(project.variant?' · Вариант '+qwEsc(project.variant):'')+(teacher?' · С ответами':'')+'</h2>'+
  (project.instructions?'<p>'+qwContentHTML(project.instructions)+'</p>':'')+
  tasks+'</body></html>';
 const frame=document.createElement('iframe');frame.title='PDF с выделяемым текстом';
 frame.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;top:0';
 document.body.append(frame);
 frame.onload=()=>{
  try{frame.contentWindow.addEventListener('afterprint',()=>frame.remove(),{once:true});frame.contentWindow.focus();frame.contentWindow.print();
   status('В окне печати выберите «Сохранить как PDF» — текст останется выделяемым');}
  catch(e){status('Не удалось открыть печать PDF: '+e.message,true);}
 };
 frame.srcdoc=html;

}
function qwSaveFile(){try{const data=qwValidate(qwDoc);download((typeof safeFile==='function'?safeFile(data.title):'Работа')+'.qwork',JSON.stringify(data,null,2),'application/json');qwExported=JSON.stringify(qwDoc);qwPersist();status('QWORK подготовлен для скачивания');}catch(e){status(e.message,true);}}
async function qwExportPDF(teacher=false,options){if(qwBusy)return;qwBusy=true;try{status('Подготовка страниц PDF…');const bytes=await qwPDFBytes(qwDoc,teacher,options);download(safeFile(qwDoc.title)+(teacher?'_преподаватель':'_ученик')+'.pdf',bytes,'application/pdf');status('PDF подготовлен для скачивания');}catch(e){status('PDF: '+e.message,true);}finally{qwBusy=false;}}
async function qwPreview(){const d=qwDialog('Предпросмотр A4','<div class="qw-row"><label class="qw-check"><input type="checkbox" id="qw-teacher">Для преподавателя</label>'+['answers','criteria','comments'].map((k,i)=>'<label class="qw-check"><input type="checkbox" data-print-option="'+k+'" checked>'+['Ответы','Критерии','Комментарии'][i]+'</label>').join('')+'</div><div id="qw-pages">Подготовка страниц…</div>',qwButton('preview-text-pdf','PDF с текстом','class="qw-primary"')+qwButton('preview-pdf','PDF (растровый)')+'<span>PDF с текстом: выберите «Сохранить как PDF» в диалоге печати</span>');const options=()=>Object.fromEntries([...d.querySelectorAll('[data-print-option]')].map(e=>[e.dataset.printOption,e.checked]));let seq=0;const paint=async()=>{const n=++seq;try{const pages=await qwRenderPages(qwDoc,d.querySelector('#qw-teacher').checked,options());if(d.isConnected&&n===seq)d.querySelector('#qw-pages').replaceChildren(...pages);}catch(e){d.querySelector('#qw-pages').textContent=e.message;}};d.querySelectorAll('input').forEach(e=>e.onchange=paint);d.querySelector('[data-qw-action="preview-pdf"]').onclick=()=>qwExportPDF(d.querySelector('#qw-teacher').checked,options());d.querySelector('[data-qw-action="preview-text-pdf"]').onclick=()=>qwPrintTextPDF(d.querySelector('#qw-teacher').checked);await paint();}
function qwBankNormalize(x){
 if(!x||typeof x!=='object'||!x.task)throw Error('Некорректная запись банка');
 const task=qwValidate({...qwProject(),tasks:[x.task]}).tasks[0];
 return {id:qwText(x.id,80)||qwId(),subject:x.subject==='math'?'math':'physics',
  grade:qwText(x.grade??task.grade,24).trim(),exam:['general','oge','ege'].includes(x.exam)?x.exam:task.exam,
  topic:qwText(x.topic??task.topic,120).trim(),subtopic:qwText(x.subtopic??task.subtopic,120).trim(),
  origin:['original','adapted','generated'].includes(x.origin)?x.origin:task.origin,task};
}
function qwBankRead(){
 const raw=localStorage.getItem(QW_BANK_KEY);if(!raw)return [];
 const xs=JSON.parse(raw);if(!Array.isArray(xs)||xs.length>500)throw Error('Повреждён банк заданий');
 return xs.map(qwBankNormalize);
}
function qwBankSave(){
 const q=qwCurrent();if(!q)return;
 if(!q.prompt.trim()){status('Заполните условие задания перед сохранением в банк',true);return;}
 const fields='<div class="qw-settings">'+
  '<label>Предмет<select id="qw-bank-new-subject">'+qwOptions([['physics','Физика'],['math','Математика']],qwDoc.subject)+'</select></label>'+
  '<label>Класс<input id="qw-bank-new-grade" maxlength="24" value="'+qwEsc(q.grade||qwDoc.grade)+'"></label>'+
  '<label>Назначение<select id="qw-bank-new-exam">'+qwOptions([['general','Обычная работа'],['oge','ОГЭ'],['ege','ЕГЭ']],q.exam)+'</select></label>'+
  '<label>Тема<input id="qw-bank-new-topic" maxlength="120" placeholder="Механика" value="'+qwEsc(q.topic||qwDoc.topic)+'"></label>'+
  '<label>Подтема<input id="qw-bank-new-subtopic" maxlength="120" placeholder="Кинематика" value="'+qwEsc(q.subtopic)+'"></label>'+
  '<label>Происхождение<select id="qw-bank-new-origin">'+qwOptions([['original','Авторская задача'],['adapted','Самостоятельный аналог'],['generated','С помощью ИИ']],q.origin)+'</select></label></div>';
 const d=qwDialog('Сохранить задание в банк',fields,qwButton('confirm-bank-save','Добавить','class="qw-primary"'));
 d.querySelector('[data-qw-action="confirm-bank-save"]').onclick=()=>{
  try{
   const xs=qwBankRead();if(xs.length>=500)throw Error('Достигнут лимит 500 заданий. Создайте резервную копию банка.');
   const get=k=>d.querySelector('#qw-bank-new-'+k).value;
   const metadata={subject:get('subject'),grade:get('grade').trim().slice(0,24),exam:get('exam'),
    topic:get('topic').trim().slice(0,120),subtopic:get('subtopic').trim().slice(0,120),origin:get('origin')};
   const task=structuredClone(q);Object.assign(task,{grade:metadata.grade,exam:metadata.exam,
    topic:metadata.topic,subtopic:metadata.subtopic,origin:metadata.origin});
   xs.push({id:qwId(),...metadata,task});
   localStorage.setItem(QW_BANK_KEY,JSON.stringify(xs));
   d.close();status('Задание сохранено в банке');
  }catch(e){status('Банк: '+e.message,true);}
 };
}
function qwBank(){
 let xs;try{xs=qwBankRead();}catch(e){status(e.message,true);return;}
 const diagnostic=typeof qdBankRead==='function'?qdBankRead():[];
 const filters='<div class="qw-row qw-bank-filters">'+
  '<input id="qw-bank-search" type="search" placeholder="Условие, тема или подтема" aria-label="Поиск заданий">'+
  '<select id="qw-bank-subject" aria-label="Предмет">'+qwOptions([['all','Все предметы'],['physics','Физика'],['math','Математика']],'all')+'</select>'+
  '<select id="qw-bank-grade" aria-label="Класс">'+qwOptions([['all','Все классы'],...['5','6','7','8','9','10','11'].map(v=>[v,v])],'all')+'</select>'+
  '<select id="qw-bank-exam" aria-label="Экзамен">'+qwOptions([['all','Все назначения'],['general','Практика'],['oge','ОГЭ'],['ege','ЕГЭ']],'all')+'</select>'+
  '<select id="qw-bank-type" aria-label="Тип задания">'+qwOptions([['all','Все типы'],...Object.entries(QW_TYPES)],'all')+'</select>'+
  '</div><p id="qw-bank-count" role="status"></p><div id="qw-bank-list"></div>';
 const d=qwDialog('Банк заданий',filters+'<input type="file" id="qw-bank-import-file" accept=".qwbank,application/json" hidden>',
  qwButton('bank-export','Экспорт банка')+qwButton('bank-import','Импорт банка'));
 d.querySelector('[data-qw-action="bank-export"]').onclick=()=>{
  download('QuantumOffice_банк_заданий.qwbank',JSON.stringify({format:'quantum-work-bank',version:1,items:xs},null,2),'application/json');
 };
 const fileInput=d.querySelector('#qw-bank-import-file');
 d.querySelector('[data-qw-action="bank-import"]').onclick=()=>fileInput.click();
 fileInput.onchange=async()=>{
  const file=fileInput.files?.[0];fileInput.value='';if(!file)return;
  try{
   if(file.size>18000000)throw Error('Файл больше 18 МБ');
   const data=JSON.parse(await file.text());
   if(data?.format!=='quantum-work-bank'||data.version!==1||!Array.isArray(data.items)||data.items.length>500)throw Error('Неподдерживаемый формат QWBANK');
   const incoming=data.items.map(qwBankNormalize);
   const signature=x=>[x.subject,x.grade,x.exam,x.topic,x.subtopic,x.task.prompt.trim().toLocaleLowerCase('ru-RU')].join('|');
   const seen=new Set(xs.map(signature));const additions=[];
   for(const x of incoming){const key=signature(x);if(seen.has(key))continue;seen.add(key);additions.push({...x,id:qwId()});}
   if(xs.length+additions.length>500)throw Error('Превышен лимит 500 заданий');
   if(!additions.length){status('Новых заданий в файле нет');return;}
   localStorage.setItem(QW_BANK_KEY,JSON.stringify([...xs,...additions]));
   xs=[...xs,...additions];refresh();status('Импортировано заданий: '+additions.length);
  }catch(e){status('Импорт банка: '+e.message,true);}
 };
 const refresh=()=>{
  const search=d.querySelector('#qw-bank-search').value.toLocaleLowerCase('ru-RU').trim();
  const pick=k=>d.querySelector('#qw-bank-'+k).value;
  const subject=pick('subject'),grade=pick('grade'),exam=pick('exam'),type=pick('type');
  const shown=xs.filter(x=>(subject==='all'||x.subject===subject)&&
   (grade==='all'||x.grade===grade)&&(exam==='all'||x.exam===exam)&&
   (type==='all'||x.task.type===type)&&
   [x.task.prompt,x.topic,x.subtopic,x.grade,x.task.answer].some(v=>String(v||'').toLocaleLowerCase('ru-RU').includes(search)));
  d.querySelector('#qw-bank-count').textContent='Найдено: '+shown.length+' · Всего своих: '+xs.length;
  const items=shown.map(x=>{
   const tags=[x.subject==='math'?'Математика':'Физика',x.grade?x.grade+' кл.':'',
    x.exam==='oge'?'ОГЭ':x.exam==='ege'?'ЕГЭ':'',x.topic,x.subtopic].filter(Boolean).join(' · ');
   return '<div class="qw-bank-item"><div><span>'+qwEsc(x.task.prompt||QW_TYPES[x.task.type])+
    '</span><small style="display:block">'+qwEsc(tags)+'</small></div>'+
    '<button type="button" data-bank-add="'+qwEsc(x.id)+'">Вставить</button>'+
    '<button type="button" data-bank-delete="'+qwEsc(x.id)+'">Удалить</button></div>';
  }).join('');
  const diag=diagnostic.filter(x=>String(x.question?.prompt||x.prompt||'').toLocaleLowerCase('ru-RU').includes(search)).slice(0,30);
  const other=diag.length?'<h3>Задания из диагностики</h3>'+diag.map(x=>
   '<div class="qw-bank-item"><span>'+qwEsc(x.question?.prompt||x.prompt||'')+'</span>'+
   '<button type="button" data-diag-bank="'+qwEsc(x.id)+'">Вставить</button></div>').join(''):'';
  d.querySelector('#qw-bank-list').innerHTML=items+other||'<p>Заданий не найдено</p>';
 };
 d.querySelectorAll('input,select').forEach(e=>e.addEventListener('input',refresh));
 d.onclick=e=>{
  const add=e.target.closest('[data-bank-add],[data-diag-bank]'),del=e.target.closest('[data-bank-delete]');
  if(add){
   const own=add.dataset.bankAdd?xs.find(x=>x.id===add.dataset.bankAdd)?.task:null;
   const item=add.dataset.diagBank?diagnostic.find(x=>x.id===add.dataset.diagBank):null;
   const task=own||(item?qwFromDiagnostic(item.question||item):null);
   if(task&&qwDoc.tasks.length<80){
    qwChange(()=>{const copy=structuredClone(task);copy.id=qwId();qwDoc.tasks.push(copy);qwSelected=copy.id;});d.close();
   }else status('Задание недоступно или превышен лимит 80 заданий',true);
  }
  if(del&&confirm('Удалить задание из личного банка?')){
   const next=xs.filter(x=>x.id!==del.dataset.bankDelete);
   try{localStorage.setItem(QW_BANK_KEY,JSON.stringify(next));xs=next;refresh();}
   catch(e){status('Не удалось изменить банк',true);}
  }
 };
 refresh();
}
function qwExample(subject='physics'){
 const d=qwProject();d.title=subject==='math'?'Математика · тренировочная работа':'Физика · движение и тепловые явления';d.subject=subject;d.topic='Тренировочный вариант';d.instructions='Запишите краткие ответы и оформите решения. Графики и схемы используйте для обоснования.';
 const data=subject==='math'?[['short','Вычислите \\(\\frac{3}{4}+\\frac{1}{8}\\).','7/8'],['extended','Решите уравнение \\(x^{2}-5x+6=0\\). Обоснуйте ответ.','2; 3'],['graph','По графику определите значение y при x = 4.','6'],['diagram','На рисунке изображён прямоугольный треугольник ABC. Катеты AB = 6 см и AC = 4 см. Найдите его площадь.','12 см²'],['blanks','Заполните: \\(\\sqrt{81}\\) = [[blank:3]], \\(2^{5}\\) = [[blank:4]].','9; 32'],['combined','По графику функции определите промежутки возрастания и убывания, найдите наибольшее значение. Обоснуйте ответ.','Возрастает на [0; 2], убывает на [6; 9], наибольшее значение — 6.']]:[['short','Тело прошло 120 м за 15 с. Найдите среднюю скорость \\(v=\\frac{s}{t}\\), м/с.','8'],['extended','Воду массой 2 кг нагрели от 20 °C до 30 °C. Удельная теплоёмкость воды 4200 Дж/(кг·°C). Найдите количество теплоты и запишите формулу \\(Q=cm\\Delta t\\).','84 000 Дж'],['graph','На рисунке приведена зависимость скорости от времени. Найдите путь за первые 6 с.','30 м'],['diagram','На тело действуют две силы. Изобразите и опишите направление равнодействующей.','Вдоль большей силы'],['blanks','Заполните обозначения: сила — [[blank:3]], энергия — [[blank:3]], единица давления — [[blank:4]].','F; E; Па'],['combined','Ученик исследовал движение тележки по горизонтальной дорожке. Датчик регистрировал скорость через равные промежутки времени, а программа построила график зависимости v(t). Направление движения тележки приняли за положительное. Во время опыта тележка разгонялась, затем некоторое время двигалась с постоянной скоростью и наконец тормозила. Масса тележки и состояние поверхности дорожки не менялись.\n\nПеред началом работы ученик проверил показания датчика на неподвижной тележке. Опыт повторили три раза при одинаковых настройках привода. Полученные графики имели одинаковую форму, однако отдельные показания скорости немного различались. На рисунке приведён один из результатов измерений; значения времени указаны в секундах, скорости — в метрах в секунду.\n\nа) Укажите интервал равномерного движения и значение скорости на нём. б) Сравните модули ускорения при разгоне и торможении. в) Найдите путь тележки за весь показанный промежуток времени и объясните геометрический смысл расчёта. г) Предложите способ оценки погрешности результата по повторным измерениям.','Равномерное движение от 2 до 6 с; скорость 6 м/с. Модули ускорения: 3 м/с² при разгоне и 2 м/с² при торможении. Площадь под графиком — путь; за 9 с путь равен 39 м. Погрешность можно оценить по разбросу повторных измерений.']];
 d.tasks=data.map(([type,prompt,answer],i)=>{const q=qwTask(type);q.prompt=prompt;q.answer=answer;q.criteria='1 балл — правильная зависимость; 1 балл — обоснование.';q.comment='Допустим другой обоснованный способ решения.';q.graph.points=[{x:0,y:0,label:'A'},{x:2,y:6,label:'B'},{x:6,y:6,label:'C'},{x:9,y:0,label:'D'}];if(subject==='math'){q.graph.xlabel='x';q.graph.ylabel='y';}q.diagram=[{kind:'rect',x:180,y:120,x2:330,y2:220,label:'Тело'},{kind:'arrow',x:330,y:170,x2:470,y2:170,label:'F₁'},{kind:'arrow',x:180,y:170,x2:80,y2:170,label:'F₂'}];if(subject==='math'){q.diagram=qwValidateDiagram([{kind:'rightTriangle',x:130,y:70,x2:390,y2:260,label:'',vertices:[{x:130,y:260,label:'A'},{x:390,y:260,label:'B'},{x:130,y:70,label:'C'}],edgeLabels:['6 см','','4 см']}]);if(type==='graph'){Object.assign(q.graph,{xmin:-5,xmax:5,ymin:0,ymax:10,curveFamily:'quadratic',xlabel:'x',ylabel:'y',points:[]});q.graph.curve={...q.graph.curve,a:.375,b:0,c:0};}}if(i>3)q.part='Часть 2';if(type==='combined'){q.position='below';q.figureWidth=360;q.solutionHeight=170;}return q;});return d;
}
function qwVisualEditor(kind){
 const q=qwCurrent();if(!q)return;let value=structuredClone(kind==='graph'?q.graph:q.diagram),selected=-1,tool=kind==='graph'?'point':'line',drag=null,history=[],snapGeometry=true,geometryStep=20;
 const d=qwDialog(kind==='graph'?'Редактор графика':'Редактор схемы','<div class="qw-visual-tools">'+(kind==='graph'?'<label>Шаблон<select id="qw-graph-preset">'+qwOptions([['custom','Свой график'],['v','v(t)'],['x','x(t)'],['a','a(t)'],['p','p(V)'],['i','I(U)'],['parabola','Парабола'],['sin','Синус'],['cos','Косинус']],'custom')+'</select></label>':(['select','line','arrow','dashed','rect','circle','point','text','angle','triangle','rightTriangle','quadrilateral'].map((k,i)=>'<button type="button" data-tool="'+k+'" aria-pressed="'+(k===tool)+'">'+['Выбрать / двигать','Линия','Стрелка','Пунктир','Прямоугольник','Окружность','Точка','Подпись','Угол','Треугольник','Прямоугольный треугольник','Четырёхугольник'][i]+'</button>').join('')))+'<button type="button" id="qw-visual-undo">Отменить</button><button type="button" id="qw-visual-delete">Удалить выбранное</button></div><div id="qw-visual-stage" tabindex="0" aria-label="Поле редактирования '+(kind==='graph'?'графика':'схемы')+'"></div>'+(kind==='diagram'?'<div class="qw-visual-canvas-footer"><label class="qw-check"><input id="qw-snap-geometry" type="checkbox" checked>Сетка и привязка</label><label class="qw-grid-step-label">Шаг<select id="qw-grid-step-geometry" aria-label="Шаг сетки">'+qwOptions([['10','10 px'],['20','20 px'],['40','40 px']],'20')+'</select></label></div>':'')+'<div id="qw-visual-properties" aria-label="Свойства выбранного объекта" tabindex="0"></div>','<span id="qw-visual-state" role="status"></span>'+qwButton('visual-apply','Применить','class="qw-primary"'));
 d.classList.add('qw-visual-dialog');d.querySelector('.qw-dialog-body').classList.add('qw-visual-body');
 const stage=d.querySelector('#qw-visual-stage'),props=d.querySelector('#qw-visual-properties'),hint=d.querySelector('#qw-visual-state');
 const point=e=>{const b=stage.querySelector('svg').getBoundingClientRect(),x=qwNum((e.clientX-b.left)/b.width*520,0,520,0),y=qwNum((e.clientY-b.top)/b.height*320,0,320,0);return kind==='diagram'&&snapGeometry&&!e.shiftKey?{x:Math.round(x/geometryStep)*geometryStep,y:Math.round(y/geometryStep)*geometryStep}:{x,y};};
  const gridPoint=p=>{const b=QW_PLOT;return qwSnapGraphPoint(value,value.xmin+(p.x-b.left)/(b.right-b.left)*(value.xmax-value.xmin),value.ymin+(b.bottom-p.y)/(b.bottom-b.top)*(value.ymax-value.ymin));};
 function remember(){history.push(structuredClone(value));history=history.slice(-30);}
 function draw(full=true){stage.innerHTML=kind==='graph'?qwGraphSVG(value,true):qwDiagramSVG(value,true,snapGeometry?geometryStep:false);if(selected>=0){const el=stage.querySelector('[data-qw-'+(kind==='graph'?'point':'object')+'="'+selected+'"]');if(el)el.classList.add('qw-visual-selected');}hint.className='';hint.textContent=kind==='graph'?value.points.length+' / 40 точек':value.length+' / 60 фигур';if(!full)return;
  if(kind==='graph')props.innerHTML='<div class="qw-graph-settings">'+['xmin','xmax','ymin','ymax','step','xlabel','ylabel'].map((k,i)=>'<label>'+['X от','X до','Y от','Y до','Шаг','Подпись X','Подпись Y'][i]+'<input data-graph-field="'+k+'" type="'+(i<5?'number':'text')+'" '+(i<5?'step="any"':'maxlength="30"')+' value="'+qwEsc(value[k])+'"></label>').join('')+['snapToGrid','grid','connected','smooth'].map((k,i)=>'<label class="qw-check"><input data-graph-field="'+k+'" type="checkbox" '+(value[k]?'checked':'')+'>'+['Привязка к пересечениям сетки','Сетка','Соединять точки','Плавная линия'][i]+'</label>').join('')+'</div>'+
   '<div class="qw-function-settings"><label>Тип графика<select id="qw-curve-family">'+qwOptions([['points','По точкам'],['quadratic','Парабола'],['trigonometric','Тригонометрия']],value.curveFamily)+'</select></label>'+
   (value.curveFamily==='quadratic'?['a','b','c'].map(k=>'<label>Коэффициент '+k+'<input data-curve-param="'+k+'" type="number" step="any" value="'+qwEsc(value.curve[k])+'"></label>').join(''):'')+
   (value.curveFamily==='trigonometric'?'<label>Функция<select id="qw-curve-trig">'+qwOptions([['sin','sin'],['cos','cos']],value.curve.trig)+'</select></label>'+
     ['amplitude','frequency','phase','offset'].map((k,i)=>'<label>'+['Амплитуда','Частота (рад)','Фаза (рад)','Смещение'][i]+'<input data-curve-param="'+k+'" type="number" step="any" value="'+qwEsc(value.curve[k])+'"></label>').join(''):'')+
   '</div><button type="button" id="qw-add-point">Добавить точку</button><div class="qw-point-list">'+value.points.map((p,i)=>'<div data-point-row="'+i+'"><b>'+(i+1)+'</b>'+['x','y','label'].map(k=>'<input aria-label="'+k+' точки '+(i+1)+'" data-point-index="'+i+'" data-point-field="'+k+'" type="'+(k==='label'?'text':'number')+'" '+(k==='label'?'maxlength="30"':'step="any"')+' value="'+qwEsc(p[k])+'">').join('')+'<button type="button" data-point-up="'+i+'" '+(!i?'disabled':'')+' title="Раньше в ломаной">↑</button><button type="button" data-point-delete="'+i+'" aria-label="Удалить точку '+(i+1)+'">×</button></div>').join('')+'</div>';
  else props.innerHTML='<div class="qw-row"><label>Подпись выбранной фигуры<input id="qw-object-label" maxlength="80" value="'+qwEsc(value[selected]?.label||'')+'" '+(selected<0?'disabled':'')+'></label></div>'+
   (value[selected]?.vertices?'<details open><summary>Вершины и обозначения</summary><div class="qw-vertex-list">'+value[selected].vertices.map((p,i)=>'<div><label>Вершина '+(i+1)+'<input data-vertex-index="'+i+'" data-vertex-field="label" maxlength="20" value="'+qwEsc(p.label)+'"></label><label>X<input data-vertex-index="'+i+'" data-vertex-field="x" type="number" min="0" max="520" step="any" value="'+p.x+'"></label><label>Y<input data-vertex-index="'+i+'" data-vertex-field="y" type="number" min="0" max="320" step="any" value="'+p.y+'"></label></div>').join('')+'</div><div class="qw-edge-list">'+value[selected].vertices.map((p,i)=>'<label>Сторона '+qwEsc(p.label||String(i+1))+'–'+qwEsc(value[selected].vertices[(i+1)%value[selected].vertices.length].label||String((i+1)%value[selected].vertices.length+1))+'<input data-edge-index="'+i+'" maxlength="40" placeholder="Длина / обозначение" value="'+qwEsc(value[selected].edgeLabels?.[i]||'')+'"></label>').join('')+'</div></details>':'')+
   (value[selected]&&['triangle','rightTriangle'].includes(value[selected].kind)?
    '<div class="qw-constructions"><label>Из вершины<select id="qw-construction-vertex">'+qwOptions(value[selected].vertices.map((p,i)=>[String(i),p.label||'Вершина '+(i+1)]),'0')+'</select></label>'+
    '<button type="button" data-construction="median">Провести медиану</button>'+
    '<button type="button" data-construction="altitude">Провести высоту</button></div>':'')+
   '<div class="qw-object-list">'+value.map((o,i)=>'<button type="button" data-object-select="'+i+'">'+(i+1)+'. '+qwEsc(o.kind)+' '+qwEsc(o.label)+'</button>').join('')+'</div>';
 }
 stage.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();const p=point(e),existing=e.target.closest('[data-qw-point],[data-qw-object]');remember();if(kind==='graph'){
  if(existing)selected=Number(existing.dataset.qwPoint);else {if(value.points.length>=40){history.pop();return;}const snapped=gridPoint(p);value.points.push({...snapped,label:''});selected=value.points.length-1;}
 }else if(tool==='select'){if(!existing){history.pop();selected=-1;draw();return;}selected=Number(existing.dataset.qwObject);}else{if(value.length>=60){history.pop();return;}let label='';if(tool==='text'){label=prompt('Подпись','')||'';if(!label){history.pop();return;}}value.push({kind:tool,x:p.x,y:p.y,x2:p.x,y2:p.y,label});selected=value.length-1;}
 const vertexHandle=kind==='diagram'&&tool==='select'?e.target.closest('[data-qw-vertex]'):null;
  drag={creating:kind==='diagram'&&tool!=='select',start:p,original:structuredClone(kind==='graph'?value.points[selected]:value[selected]),
   moving:kind==='diagram'&&tool==='select'&&!vertexHandle,vertexIndex:vertexHandle?Number(vertexHandle.dataset.qwVertex):-1};stage.setPointerCapture(e.pointerId);draw(false);
 };
 stage.onpointermove=e=>{if(!drag)return;const p=point(e);if(kind==='graph'){Object.assign(value.points[selected],gridPoint(p));}else{const o=value[selected];
   if(drag.vertexIndex>=0&&o.vertices?.[drag.vertexIndex]){
    o.vertices[drag.vertexIndex].x=p.x;o.vertices[drag.vertexIndex].y=p.y;
    const v=o.vertices;o.x=Math.min(...v.map(q=>q.x));o.y=Math.min(...v.map(q=>q.y));
    o.x2=Math.max(...v.map(q=>q.x));o.y2=Math.max(...v.map(q=>q.y));
   }else if(drag.moving){
    const a=drag.original,coords=a.vertices?.length?a.vertices:[{x:a.x,y:a.y},{x:a.x2,y:a.y2}],
     dx=qwNum(p.x-drag.start.x,-Math.min(...coords.map(v=>v.x)),520-Math.max(...coords.map(v=>v.x)),0),
     dy=qwNum(p.y-drag.start.y,-Math.min(...coords.map(v=>v.y)),320-Math.max(...coords.map(v=>v.y)),0);
    o.x=a.x+dx;o.x2=a.x2+dx;o.y=a.y+dy;o.y2=a.y2+dy;
    if(a.vertices)o.vertices=a.vertices.map(v=>({...v,x:v.x+dx,y:v.y+dy}));
   }else{o.x2=p.x;o.y2=p.y;}}draw(false);};
 stage.onpointerup=()=>{
   if(drag){
    if(kind==='diagram'&&drag.creating&&['triangle','rightTriangle','quadrilateral'].includes(value[selected]?.kind)){
     const o=value[selected];if(Math.abs(o.x2-o.x)<12)o.x2=Math.min(520,o.x+90);
     if(Math.abs(o.y2-o.y)<12)o.y2=Math.min(320,o.y+90);
     o.vertices=qwGeometryVertices(o);
    }
    drag=null;draw();
   }
  };stage.onpointercancel=()=>{if(drag){value=history.pop();drag=null;draw();}};
 function remove(){if(selected<0)return;remember();if(kind==='graph')value.points.splice(selected,1);else value.splice(selected,1);selected=-1;draw();}
 stage.onkeydown=e=>{if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}};
 d.querySelector('#qw-visual-undo').onclick=()=>{if(history.length){value=history.pop();selected=-1;draw();}};d.querySelector('#qw-visual-delete').onclick=remove;
 d.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;if(t.dataset.tool){tool=t.dataset.tool;for(const b of d.querySelectorAll('[data-tool]'))b.setAttribute('aria-pressed',String(b===t));}
  if(t.dataset.construction){
   try{
    if(value.length>=60)throw Error('Максимум 60 фигур');
    const index=Number(d.querySelector('#qw-construction-vertex')?.value||0);
    const result=qwTriangleConstruction(value[selected],t.dataset.construction,index);
    remember();value.push(result);selected=value.length-1;tool='select';draw();
    d.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool==='select')));
   }catch(error){hint.textContent=error.message;hint.className='qw-error';}
   return;
  }if(t.id==='qw-add-point'&&kind==='graph'&&value.points.length<40){remember();value.points.push({...qwSnapGraphPoint(value,(value.xmin+value.xmax)/2,(value.ymin+value.ymax)/2),label:''});selected=value.points.length-1;draw();}if(t.dataset.pointDelete!==undefined){selected=Number(t.dataset.pointDelete);remove();}if(t.dataset.pointUp!==undefined){const i=Number(t.dataset.pointUp);if(i>0){remember();[value.points[i-1],value.points[i]]=[value.points[i],value.points[i-1]];draw();}}if(t.dataset.objectSelect!==undefined){selected=Number(t.dataset.objectSelect);tool='select';draw();}});
 d.addEventListener('change',e=>{const t=e.target;try{if(t.id==='qw-snap-geometry'){snapGeometry=t.checked;draw(false);return;}if(t.id==='qw-grid-step-geometry'){geometryStep=Number(t.value);draw(false);return;}if(t.dataset.graphField){const next=structuredClone(value),k=t.dataset.graphField;next[k]=t.type==='checkbox'?t.checked:t.type==='number'?Number(t.value):t.value;const validated=qwValidateGraph(next);remember();value=validated;draw(false);}if(t.dataset.pointField){const next=structuredClone(value),k=t.dataset.pointField;next.points[Number(t.dataset.pointIndex)][k]=k==='label'?t.value:Number(t.value);const validated=qwValidateGraph(next);remember();value=validated;draw(false);}if(t.id==='qw-object-label'&&value[selected]){remember();value[selected].label=t.value;draw(false);}
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
    selected=-1;draw();
   }}catch(error){draw();hint.textContent=error.message;hint.className='qw-error';}});
 d.querySelector('[data-qw-action="visual-apply"]').onclick=()=>{try{const validated=kind==='graph'?qwValidateGraph(value):qwValidateDiagram(value);qwChange(()=>{q[kind]=validated;q.figure=kind;});d.close();}catch(e){hint.textContent=e.message;}};draw();
}
function qwNew(){if((qwDoc.tasks.length||qwCorrupt)&&!confirm('Создать новую работу? Для резервной копии сохраните QWORK.'))return;qwRemember();qwCorrupt='';qwDoc=qwProject();qwSelected='';qwPersist();qwRender();}
function qwAction(action,button){
 const q=qwCurrent();
 if(action==='new'){qwNew();return;}if(action==='open'){document.getElementById('qw-file')?.click();return;}if(action==='save'){qwSaveFile();return;}if(action==='settings'){qwSettings();return;}if(action==='preview'){qwPreview();return;}if(action==='pdf-text'){qwPrintTextPDF();return;}if(action==='pdf-student'||action==='pdf-teacher'){qwExportPDF(action==='pdf-teacher');return;}
 if(action==='left'||action==='right'||action==='close-panels'){qwLeft=action==='left'?!qwLeft:false;qwRight=action==='right'?!qwRight:false;qwRender();return;}
 if(action==='add'||action==='part'){if(qwDoc.tasks.length>=80){status('Максимум 80 заданий',true);return;}const name=action==='part'?prompt('Название части','Часть '+(new Set(qwDoc.tasks.map(q=>q.part)).size+1)):null;if(action==='part'&&name===null)return;qwChange(()=>{const t=qwTask(document.getElementById('qw-add-type')?.value||'short');t.part=name||q?.part||'Часть 1';qwDoc.tasks.push(t);qwSelected=t.id;qwLeft=false;});return;}
 if(action==='select'){qwSelected=button.dataset.id;qwLeft=false;qwRender();return;}
 if(action==='undo'||action==='redo'){const from=action==='undo'?qwUndo:qwRedo,to=action==='undo'?qwRedo:qwUndo;if(from.length){to.push(JSON.stringify(qwDoc));qwDoc=qwValidate(JSON.parse(from.pop()));qwPersist();qwRender();}return;}
 if(action==='example'){if(qwDoc.tasks.length&&!confirm('Заменить текущую работу примером? Сохраните QWORK для резервной копии.'))return;qwChange(()=>{qwDoc=qwExample(qwDoc.subject);qwSelected=qwDoc.tasks[0].id;});return;}
 if(action==='recovery'){download('QuantumOffice-work-recovery.json',qwCorrupt||JSON.stringify(qwDoc),'application/json');return;}
 if(action==='bank'){qwBank();return;}if(action==='from-diag'){const tasks=typeof qdWorkingDoc==='function'?qdWorkingDoc().sections.flatMap(s=>s.questions.map(q=>({...qwFromDiagnostic(q),part:s.title}))):[];if(!tasks.length){status('В диагностике нет заданий',true);return;}if(tasks.length+qwDoc.tasks.length>80){status('В работе может быть не более 80 заданий',true);return;}qwChange(()=>{qwDoc.tasks.push(...tasks);qwSelected=tasks[0].id;});return;}
 if(!q)return;
 if(action==='up'||action==='down'){qwChange(()=>qwMove(qwDoc,q.id,action==='up'?-1:1));return;}
 if(action==='duplicate'){qwChange(()=>{const copy=qwDuplicate(qwDoc,q.id);if(copy)qwSelected=copy.id;});return;}
 if(action==='delete'){if(!confirm('Удалить задание '+(qwDoc.tasks.indexOf(q)+1)+'?'))return;qwChange(()=>{qwDoc.tasks=qwDoc.tasks.filter(t=>t.id!==q.id);qwSelected='';});return;}
 if(action==='math'){qwFormula();return;}if(action==='symbols'){qwSymbols();return;}if(action==='blank'){qwInsert('[[blank:6]]');return;}
 if(action==='graph'||action==='diagram'){qwVisualEditor(action);return;}if(action==='image'){document.getElementById('qw-image').click();return;}
 if(action==='bank-save'){qwBankSave();return;}
}
if(typeof document!=='undefined'){
 document.addEventListener('click',e=>{if(!qwActive()||e.target.closest('#qw-dialog'))return;const b=e.target.closest('[data-qw-action],[data-action^="work-"]');if(!b)return;e.preventDefault();e.stopPropagation();qwAction(b.dataset.qwAction||b.dataset.action.slice(5),b);},true);
 document.addEventListener('focusin',e=>{if(qwActive()&&e.target.matches('#qo-work-root textarea,#qo-work-root input[data-qw-field]'))qwRemember();});
 document.addEventListener('input',e=>{if(!qwActive())return;const t=e.target,k=t.dataset.qwField,q=qwCurrent();if(!q||!['prompt','answer','criteria','comment','part'].includes(k))return;q[k]=qwText(t.value,k==='part'?120:16000);qwPersist();qwPreviewSelected();});
 document.addEventListener('change',async e=>{if(!qwActive())return;const t=e.target;
  if(t.id==='qw-file'){const file=t.files?.[0];t.value='';if(!file)return;try{if(file.size>QW_LIMITS.bytes)throw Error('Файл больше 18 МБ');const next=qwValidate(JSON.parse(await file.text()));for(const image of new Set(next.tasks.map(q=>q.image).filter(Boolean)))await qwImage(image);if((qwDoc.tasks.length||qwCorrupt)&&!confirm('Открыть работу вместо текущей? Сохраните текущую в QWORK.'))return;qwRemember();qwDoc=next;qwCorrupt='';qwSelected='';qwPersist();qwRender();status('Работа открыта');}catch(e){status('Не удалось открыть QWORK: '+e.message,true);}return;}
  if(t.id==='qw-image'){const file=t.files?.[0],q=qwCurrent();t.value='';if(!file||!q)return;try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>4000000)throw Error('Изображение: PNG/JPG/WebP до 4 МБ');const data=await new Promise((r,j)=>{const reader=new FileReader();reader.onload=()=>r(reader.result);reader.onerror=j;reader.readAsDataURL(file);});await qwImage(data);qwChange(()=>{q.image=data;q.figure='image';});}catch(e){status('Изображение: '+e.message,true);}return;}
  const k=t.dataset.qwField,q=qwCurrent();if(!q||!k||['prompt','answer','criteria','comment','part'].includes(k))return;qwRemember();if(t.type==='checkbox')q[k]=t.checked;else if(t.type==='number'){const ranges={points:[0,100],boxes:[1,30],solutionHeight:[24,500],figureWidth:[120,470]};const [min,max]=ranges[k]||[0,100];q[k]=qwNum(t.value,min,max,min);t.value=q[k];}else q[k]=t.value;
  if(k==='type'){if(['extended','combined'].includes(q.type))q.solutionVisible=true;if(q.type==='graph')q.figure='graph';if(q.type==='diagram')q.figure='diagram';}
  qwPersist();if(t.tagName==='SELECT'||t.type==='checkbox')qwRender();else qwPreviewSelected();
 });
 window.addEventListener('keydown',e=>{if(!qwActive())return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();e.stopImmediatePropagation();qwSaveFile();}if(e.key==='Escape'&&!document.querySelector('dialog[open]')){qwLeft=qwRight=false;qwRender();}},true);
}

function qwFooter(active){
 const spans=document.querySelectorAll('.qo-document-workspace>.qo-editor-foot>span');
 spans.forEach((e,i)=>{if(active){if(e.dataset.qwOriginal===undefined)e.dataset.qwOriginal=e.textContent;e.textContent=i===0?'A4 · PDF 180 dpi':i===1?qwDoc.tasks.length+' заданий · '+qwDoc.tasks.reduce((s,q)=>s+q.points,0)+' баллов':'QWORK / PDF';}else if(e.dataset.qwOriginal!==undefined){e.textContent=e.dataset.qwOriginal;delete e.dataset.qwOriginal;}});
}
