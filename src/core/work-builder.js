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
function qwToolbar(){return qoWorkGroup('Работа',qoWorkButton('work-new','Создать работу','new')+qoWorkButton('work-open','Открыть QWORK','folder')+qoWorkButton('work-save','Сохранить QWORK','save'))+qoWorkGroup('Готовый вариант',qoWorkButton('work-preview','Предпросмотр','file-text')+qoWorkButton('work-pdf','Скачать PDF','download'));}
function qwTaskPreview(q,index=0,layout=qwDoc.layout){
 const visual=q.figure==='graph'?qwGraphSVG(q.graph):q.figure==='diagram'?qwDiagramSVG(q.diagram):q.figure==='image'&&q.image?'<img alt="Иллюстрация задания" src="'+q.image+'">':'';
 const figure=visual?'<figure style="width:'+Math.min(q.figureWidth,470)+'px">'+visual+'</figure>':'';
 const flow='<div class="qw-task-flow qw-figure-'+q.position+'">'+figure+'<div class="qw-task-text">'+qwContentHTML(q.prompt||'Условие не заполнено')+'</div></div>';
 if(layout==='exam')return '<article class="qw-paper-task qw-exam-task"><div class="qw-exam-grid"><b class="qw-exam-number">'+(index+1)+'.</b><div class="qw-exam-body">'+flow+'</div></div></article>';
 return '<article class="qw-paper-task qw-worksheet-task"><header><b>Задание '+(index+1)+'</b><span>'+qwEsc(QW_TYPES[q.type])+' · '+q.points+' б.</span></header>'+flow+
  (q.answerVisible?'<div class="qw-answer-preview">Ответ: '+(q.answerStyle==='boxes'?Array.from({length:q.boxes},()=>'<i></i>').join(''):q.answerStyle==='box'?'<i class="qw-answer-box"></i>':'<span></span>')+'</div>':'')+
  (q.solutionVisible?'<div class="qw-solution-preview qw-solution-'+q.solutionStyle+'" style="height:'+q.solutionHeight+'px"></div>':'')+'</article>';
}
function qwRender(){
 const host=document.getElementById('qo-work-root');if(!host)return;
 if(!qwDoc.tasks.some(q=>q.id===qwSelected))qwSelected=qwDoc.tasks[0]?.id||'';
 qwFooter(qwActive());
 const q=qwCurrent(),old=host.querySelector('.qw-center')?.scrollTop||0;
 host.className='qw-frame'+(qwLeft?' qw-left-open':'')+(qwRight?' qw-right-open':'');
 host.innerHTML='<aside class="qw-left" aria-label="Структура работы">'+qwButton('close-panels','Закрыть','class="qw-drawer-close"')+'<header><strong>Задания</strong><span>'+qwDoc.tasks.length+' / 80</span></header><label>Новое задание<select id="qw-add-type">'+qwOptions(Object.entries(QW_TYPES),'short')+'</select></label><div class="qw-row">'+qwButton('add','+ Задание','class="qw-primary"')+qwButton('part','+ Часть')+'</div><nav>'+qwDoc.tasks.map((t,i)=>((!i||qwDoc.tasks[i-1].part!==t.part)?'<h3>'+qwEsc(t.part||'Без части')+'</h3>':'')+'<button type="button" class="qw-nav-task" data-qw-action="select" data-id="'+qwEsc(t.id)+'" aria-current="'+(t.id===qwSelected)+'" title="'+qwEsc(t.prompt)+'"><b>'+(i+1)+'</b><span>'+qwEsc(t.prompt||QW_TYPES[t.type])+'</span></button>').join('')+'</nav><div class="qw-row">'+qwButton('bank','Банк заданий')+qwButton('from-diag','Из диагностики')+'</div></aside>'+
 '<main class="qw-center"><div class="qw-center-head"><h1>'+qwEsc(qwDoc.title)+'</h1><div class="qw-row">'+qwButton('left','Задания','class="qw-mobile"')+qwButton('right','Свойства','class="qw-mobile"')+qwButton('settings','Параметры работы')+qwButton('preview','Предпросмотр')+qwButton('pdf','Скачать PDF')+qwButton('save','Сохранить QWORK','class="qw-primary"')+'</div><div class="qw-row"><span id="qw-save-state" role="status">'+qwEsc(qwStorageError||'Черновик на устройстве')+'</span>'+qwButton('undo','Отменить',qwUndo.length?'':'disabled')+qwButton('redo','Повторить',qwRedo.length?'':'disabled')+qwButton('example','Пример работы')+'</div></div>'+
 (qwCorrupt?'<div class="qw-error" role="alert">'+qwEsc(qwStorageError)+qwButton('recovery','Скачать исходные данные')+qwButton('new','Новый проект')+'</div>':'')+
 (q?'<section class="qw-editor"><div class="qw-row"><strong>Задание '+(qwDoc.tasks.indexOf(q)+1)+'</strong>'+qwButton('up','↑','title="Переместить выше" '+(!qwDoc.tasks.indexOf(q)?'disabled':''))+qwButton('down','↓','title="Переместить ниже" '+(qwDoc.tasks.indexOf(q)===qwDoc.tasks.length-1?'disabled':''))+qwButton('duplicate','Копия')+qwButton('delete','Удалить')+'</div><label>Условие<textarea id="qw-prompt" data-qw-field="prompt" maxlength="16000" rows="7">'+qwEsc(q.prompt)+'</textarea></label><div class="qw-row qw-insert">'+qwButton('math','Формула')+qwButton('symbols','Символы')+qwButton('blank','Пустая вставка')+qwButton('graph','График')+qwButton('diagram','Схема')+qwButton('image','Изображение')+'</div></section><section class="qw-selected-preview" id="qw-task-preview" aria-label="Вид задания">'+qwTaskPreview(q,qwDoc.tasks.indexOf(q))+'</section>':'<div class="qw-empty"><h2>Нет заданий</h2>'+qwButton('add','Добавить задание','class="qw-primary"')+'</div>')+'</main>'+
 '<aside class="qw-right" aria-label="Свойства задания">'+qwButton('close-panels','Закрыть','class="qw-drawer-close"')+'<h2>Свойства задания'+(q?' № '+(qwDoc.tasks.indexOf(q)+1):'')+'</h2>'+(q?qwSelect('type','Тип',Object.entries(QW_TYPES),q.type)+qwField('part','Часть',q.part)+qwField('points','Баллы',q.points,'number','min="0" max="100"')+qwCheck('answerVisible','Поле ответа',q.answerVisible)+qwSelect('answerStyle','Формат ответа',[['line','Строка'],['box','Рамка'],['boxes','Ячейки']],q.answerStyle)+(q.answerStyle==='boxes'?qwField('boxes','Количество ячеек',q.boxes,'number','min="1" max="30"'):'')+qwCheck('solutionVisible','Место для решения',q.solutionVisible)+(q.solutionVisible?qwField('solutionHeight','Высота решения, пт',q.solutionHeight,'number','min="24" max="500"')+qwSelect('solutionStyle','Разлиновка',[['lines','Строки'],['grid','Клетка'],['blank','Без разлиновки']],q.solutionStyle):'')+qwSelect('figure','Иллюстрация',[['none','Нет'],['graph','График'],['diagram','Схема'],['image','Изображение']],q.figure)+(q.figure!=='none'?qwSelect('position','Расположение',[['left','Слева'],['right','Справа'],['below','Под условием']],q.position)+qwField('figureWidth','Ширина, пт',q.figureWidth,'number','min="120" max="470"'):'')+qwCheck('pageBreak','С новой страницы',q.pageBreak)+'<details><summary>Ответ и критерии</summary>'+['answer','criteria','comment'].map((k,i)=>'<label>'+['Ответ преподавателя','Критерии','Комментарий'][i]+'<textarea data-qw-field="'+k+'" rows="3" maxlength="16000">'+qwEsc(q[k])+'</textarea></label>').join('')+'</details>'+qwButton('bank-save','Сохранить задание в банк'):'<p>Нет выбранного задания</p>')+'</aside><input type="file" id="qw-file" accept=".qwork,application/json" hidden><input type="file" id="qw-image" accept="image/png,image/jpeg,image/webp" hidden>';
 host.querySelector('.qw-center').scrollTop=old;
}
function qwPreviewSelected(){const p=document.getElementById('qw-task-preview'),q=qwCurrent();if(p&&q)p.innerHTML=qwTaskPreview(q,qwDoc.tasks.indexOf(q));const t=document.querySelector('.qw-nav-task[aria-current="true"] span');if(t&&q){t.textContent=q.prompt||QW_TYPES[q.type];t.parentElement.title=q.prompt;}}
function qwDialog(title,body,footer=''){document.getElementById('qw-dialog')?.remove();const d=document.createElement('dialog');d.id='qw-dialog';d.className='qw-dialog';d.innerHTML='<header><strong>'+title+'</strong><button type="button" data-qw-close aria-label="Закрыть">×</button></header><div class="qw-dialog-body">'+body+'</div>'+(footer?'<footer>'+footer+'</footer>':'');d.addEventListener('close',()=>d.remove());d.querySelector('[data-qw-close]').onclick=()=>d.close();document.body.append(d);d.showModal();return d;}
function qwSettings(){const d=qwDialog('Параметры работы','<div class="qw-settings">'+['title','grade','topic','variant'].map((k,i)=>'<label>'+['Название','Класс','Тема','Вариант №'][i]+'<input data-meta="'+k+'" value="'+qwEsc(qwDoc[k])+'" maxlength="160"></label>').join('')+'<label>Предмет<select data-meta="subject">'+qwOptions([['physics','Физика'],['math','Математика']],qwDoc.subject)+'</select></label><label>Макет PDF<select data-meta="layout">'+qwOptions([['worksheet','Контрольная / самостоятельная'],['exam','Компактный ОГЭ / ЕГЭ']],qwDoc.layout)+'</select></label><label>Экзамен<select data-meta="exam">'+qwOptions([['oge','ОГЭ'],['ege','ЕГЭ']],qwDoc.exam)+'</select></label><label class="qw-settings-wide">Инструкция<textarea data-meta="instructions" rows="4" maxlength="4000">'+qwEsc(qwDoc.instructions)+'</textarea></label></div>',qwButton('meta-apply','Применить','class="qw-primary"'));d.querySelector('[data-qw-action="meta-apply"]').onclick=()=>{qwChange(()=>{for(const e of d.querySelectorAll('[data-meta]'))qwDoc[e.dataset.meta]=e.type==='checkbox'?e.checked:qwText(e.value,e.dataset.meta==='instructions'?4000:160);qwDoc.title=qwDoc.title.trim()||'Новая работа';});d.close();};}
function qwInsert(text){const el=document.getElementById('qw-prompt'),q=qwCurrent();if(!el||!q)return;qwRemember();const a=el.selectionStart??el.value.length,b=el.selectionEnd??a;el.setRangeText(text,a,b,'end');q.prompt=el.value.slice(0,16000);qwPersist();qwPreviewSelected();el.focus();}
function qwFormula(){const d=qwDialog('Формула','<div class="qw-row">'+['\\frac{a}{b}','x^{2}','a_{1}','\\sqrt{x}','(a+b)','\\Delta t'].map(v=>'<button type="button" data-formula="'+qwEsc(v)+'">'+qwContentHTML('\\('+v+'\\)')+'</button>').join('')+'</div><label>Выражение<input id="qw-formula-source" maxlength="600" value="\\frac{a}{b}"></label><div id="qw-formula-preview"></div><p class="qw-muted">Дробь: \\frac{a}{b} · корень: \\sqrt{x} · индексы: x^{2}, a_{1}</p>',qwButton('formula-insert','Вставить','class="qw-primary"'));const input=d.querySelector('input'),view=d.querySelector('#qw-formula-preview'),ok=d.querySelector('[data-qw-action="formula-insert"]');const update=()=>{try{view.innerHTML='<math xmlns="http://www.w3.org/1998/Math/MathML">'+qwMathML(qwMath(input.value))+'</math>';ok.disabled=false;}catch(e){view.textContent=e.message;ok.disabled=true;}};input.oninput=update;for(const e of d.querySelectorAll('[data-formula]'))e.onclick=()=>{input.value=e.dataset.formula;update();};ok.onclick=()=>{const s=input.value;d.close();qwInsert('\\('+s+'\\)');};update();}
function qwSymbols(){const groups={...(typeof QO_WRITER_SYMBOLS==='object'?QO_WRITER_SYMBOLS:{}),'Греческие':['α','β','γ','δ','ε','ζ','η','θ','ι','κ','λ','μ','ν','ξ','π','ρ','σ','τ','υ','φ','χ','ψ','ω','Γ','Δ','Θ','Λ','Π','Σ','Φ','Ψ','Ω'],'Единицы':['м','с','кг','Н','Дж','Вт','Па','В','А','Ом','м/с','м/с²','Дж/(кг·°C)']};const d=qwDialog('Символы',Object.entries(groups).map(([k,vs])=>'<h3>'+qwEsc(k)+'</h3><div class="qw-symbols">'+vs.map(v=>'<button type="button" data-symbol="'+qwEsc(v)+'">'+qwEsc(v)+'</button>').join('')+'</div>').join(''));for(const e of d.querySelectorAll('[data-symbol]'))e.onclick=()=>{d.close();qwInsert(e.dataset.symbol);};}
/* Online publishing: browser's native print-to-PDF preserves selectable text and vector SVG.
   The older one-click raster PDF exporter remains available as a compatibility fallback. */
/* Unified high-quality browser PDF. Native font shaping and vector SVG are kept. */
function qwPrintDocumentHTML(project,teacher=false,options={answers:true,criteria:true,comments:true}){
 const d=qwValidate(project),exam=d.layout==='exam',subject=d.subject==='math'?'Математика':'Физика';
 const tasks=d.tasks.map((q,i)=>{
  if(!q.prompt.trim())throw Error('Заполните условие задания '+(i+1));
  const notes=teacher?'<div class="qw-teacher-notes">'+
   (options.answers!==false?'<p><b>Ответ:</b> '+qwContentHTML(q.answer||'—')+'</p>':'')+
   (options.criteria!==false&&q.criteria?'<p><b>Критерии:</b> '+qwContentHTML(q.criteria)+'</p>':'')+
   (options.comments!==false&&q.comment?'<p><b>Комментарий:</b> '+qwContentHTML(q.comment)+'</p>':'')+'</div>':'';
  return '<section class="qw-print-section">'+qwTaskPreview(q,i,d.layout)+notes+'</section>';
 }).join('');
 const styles="@page{size:A4;margin:14mm 15mm}\n*{box-sizing:border-box}\nhtml{margin:0;background:#fff;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}\nbody{margin:0;font:10.8pt/1.48 \"Arial\",\"Liberation Sans\",sans-serif;color:#111}\n.qw-print-document{margin:0;padding:0}\n.qw-print-title{font-size:15pt;line-height:1.3;margin:0 0 2.5mm;font-weight:700}\n.qw-print-meta{font-size:9pt;line-height:1.4;margin:0 0 7mm;color:#444}\n.qw-print-intro{margin:0 0 5mm;line-height:1.4;white-space:pre-wrap}\n.qw-print-section{break-inside:auto}\n.qw-paper-task{border:0;margin:0 0 6mm;padding:0;background:white;color:#111;overflow-wrap:anywhere}\n.qw-paper-task>header{display:flex;justify-content:space-between;gap:8mm;margin:0 0 2mm;break-after:avoid}\n.qw-paper-task>header b{font-size:10.5pt}\n.qw-paper-task>header span{font-size:9pt;color:#444}\n.qw-task-flow{display:block;min-height:0}\n.qw-task-flow::after{content:\"\";display:block;clear:both}\n.qw-task-flow .qw-task-text{white-space:normal;overflow-wrap:anywhere;min-width:0}\n.qw-task-flow figure{float:right;margin:0 0 2mm 4mm;max-width:42%;break-inside:avoid}\n.qw-task-flow figure svg,.qw-task-flow figure img{display:block;width:100%;height:auto}\n.qw-figure-left figure{float:left;margin:0 4mm 2mm 0}\n.qw-figure-below figure{float:none;max-width:100%;margin:2mm 0;width:100%}\n.qw-answer-preview{display:flex;align-items:center;gap:2mm;margin:3mm 0 0;font-size:9.5pt}\n.qw-answer-preview span{display:inline-block;flex:1;border-bottom:1px solid #333;height:5mm;min-width:25mm}\n.qw-answer-preview i{display:inline-block;width:6mm;height:6.5mm;border:1px solid #777}\n.qw-answer-preview .qw-answer-box{width:32mm}\n.qw-inline-blank{display:inline-block;border-bottom:1px solid #333;height:1em;max-width:100%}\n.qw-solution-preview{max-height:140mm;margin:3mm 0 0;break-inside:avoid}\n.qw-solution-lines{background:repeating-linear-gradient(to bottom,transparent 0,transparent 6.5mm,#ddd 6.6mm)}\n.qw-solution-grid{background-image:linear-gradient(#ddd 1px,transparent 1px),linear-gradient(90deg,#ddd 1px,transparent 1px);background-size:5mm 5mm}\n.qw-teacher-notes{margin:2mm 0 6mm;padding:2.5mm 3mm;border-left:2px solid #777;background:#f9f9f9;font-size:9pt;break-inside:avoid}\n.qw-teacher-notes p{margin:0 0 1.5mm}\nmath{display:inline-block;vertical-align:-.22em;font:1.1em/1.25 \"Cambria Math\",\"STIX Two Math\",\"Times New Roman\",serif;margin:0 .16em;white-space:nowrap}\nmath mfrac{font-size:1.04em}\n.qw-exam-header{font:9pt/1.4 \"Times New Roman\",\"Liberation Serif\",serif;color:#222;margin:0 0 6mm;text-align:right}\n.qw-exam-task{font:10.5pt/1.28 \"Times New Roman\",\"Liberation Serif\",serif;margin:0 0 5.5mm;break-inside:avoid-page}\n.qw-exam-grid{display:grid;grid-template-columns:6mm minmax(0,1fr);gap:1.7mm}\n.qw-exam-number{font-weight:bold;font-size:10.5pt;line-height:1.3}\n.qw-exam-body{min-width:0}\n.qw-exam-task .qw-task-flow figure{max-width:37%;margin:0 0 1.4mm 3.5mm}\n.qw-exam-task .qw-figure-left figure{margin:0 3.5mm 1.4mm 0}\n.qw-exam-task .qw-figure-below figure{max-width:100%;margin:2mm 0}\n.qw-exam-task .qw-task-text{line-height:1.3}\n.qw-exam-task math{font-size:1.02em}\n@media screen{\n html{background:#e8edf2}\n body{padding:12px}\n .qw-print-document{width:210mm;max-width:none;min-height:297mm;margin:0 auto;padding:14mm 15mm;background:white;box-shadow:0 2px 8px #1f2b3740}\n}\n@media print{\n html,body{background:white;margin:0;padding:0}\n .qw-print-document{padding:0;margin:0;max-width:none;box-shadow:none}\n .qw-exam-task{break-inside:avoid-page}\n}";
 const header=exam?'<div class="qw-exam-header">'+qwEsc(subject)+' · '+(d.exam==='oge'?'ОГЭ':'ЕГЭ')+
  (d.variant?' · Вариант '+qwEsc(d.variant):'')+'</div>':
  '<h1 class="qw-print-title">'+qwEsc(d.title)+'</h1>'+
  '<div class="qw-print-meta">'+qwEsc(subject)+(d.grade?' · '+qwEsc(d.grade)+' класс':'')+
  (d.variant?' · Вариант '+qwEsc(d.variant):'')+(teacher?' · Для преподавателя':'')+'</div>'+
  (d.instructions?'<p class="qw-print-intro">'+qwContentHTML(d.instructions)+'</p>':'');
 return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>'+qwEsc(d.title)+
  '</title><style>'+styles+'</style></head><body class="'+(exam?'qw-print-exam':'qw-print-worksheet')+
  '"><main class="qw-print-document">'+header+tasks+'</main></body></html>';
}
function qwPrintTextPDF(teacher=false,options){
 let html;try{html=qwPrintDocumentHTML(qwDoc,teacher,options);}catch(e){status('PDF: '+e.message,true);return;}
 const frame=document.createElement('iframe');frame.title='Подготовка PDF';
 frame.style.cssText='position:fixed;left:-9999px;top:0;width:794px;height:1123px;opacity:0;pointer-events:none';
 document.body.append(frame);
 frame.onload=()=>{
  try{const win=frame.contentWindow;win.addEventListener('afterprint',()=>frame.remove(),{once:true});
   win.focus();win.print();status('В окне печати выберите «Сохранить как PDF»');}
  catch(e){status('PDF: '+e.message,true);frame.remove();}
 };
 frame.srcdoc=html;
}
function qwSaveFile(){try{const data=qwValidate(qwDoc);download((typeof safeFile==='function'?safeFile(data.title):'Работа')+'.qwork',JSON.stringify(data,null,2),'application/json');qwExported=JSON.stringify(qwDoc);qwPersist();status('QWORK подготовлен для скачивания');}catch(e){status(e.message,true);}}
async function qwExportPDF(teacher=false,options){if(qwBusy)return;qwBusy=true;try{status('Подготовка страниц PDF…');const bytes=await qwPDFBytes(qwDoc,teacher,options);download(safeFile(qwDoc.title)+(teacher?'_преподаватель':'_ученик')+'.pdf',bytes,'application/pdf');status('PDF подготовлен для скачивания');}catch(e){status('PDF: '+e.message,true);}finally{qwBusy=false;}}
async function qwPreview(){
 const d=qwDialog('Предпросмотр PDF','<div class="qw-row qw-preview-options">'+
  '<label class="qw-check"><input type="checkbox" id="qw-teacher">Для преподавателя</label>'+
  ['answers','criteria','comments'].map((k,i)=>'<label class="qw-check" data-teacher-option><input type="checkbox" data-print-option="'+k+'" checked>'+['Ответы','Критерии','Комментарии'][i]+'</label>').join('')+
  '</div><div id="qw-pages"><iframe id="qw-print-preview-frame" title="Макет PDF" loading="eager"></iframe></div>',
  qwButton('preview-pdf','Скачать PDF','class="qw-primary"'));
 d.classList.add('qw-print-preview-dialog');
 const options=()=>Object.fromEntries([...d.querySelectorAll('[data-print-option]')].map(e=>[e.dataset.printOption,e.checked]));
 const refresh=()=>{
  const teacher=d.querySelector('#qw-teacher').checked;
  d.querySelectorAll('[data-teacher-option]').forEach(e=>e.hidden=!teacher);
  try{d.querySelector('#qw-print-preview-frame').srcdoc=qwPrintDocumentHTML(qwDoc,teacher,options());}
  catch(e){d.querySelector('#qw-pages').textContent=e.message;}
 };
 d.querySelectorAll('input').forEach(e=>e.onchange=refresh);
 d.querySelector('[data-qw-action="preview-pdf"]').onclick=()=>qwPrintTextPDF(d.querySelector('#qw-teacher').checked,options());
 refresh();
}
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
const QW_VISUAL_TOOLS=[
 ['select','Выбрать и переместить'],['point','Точка'],['line','Отрезок'],
 ['arrow','Вектор / стрелка'],['dashed','Пунктир'],['rope','Нить / верёвка'],
 ['rect','Прямоугольник'],['circle','Окружность'],['text','Текстовая подпись'],
 ['angle','Угол'],['triangle','Треугольник'],['rightTriangle','Прямоугольный треугольник'],
 ['quadrilateral','Четырёхугольник'],['block','Брусок'],['incline','Наклонная плоскость'],
 ['pulley','Неподвижный блок'],['movablePulley','Подвижный блок'],['spring','Пружина'],['ground','Опора']
];
function qwVisualIcon(kind){
 const paths={
 select:'<path d="M4 3l2 16 4-4 4 6 3-2-4-6 6-1z"/>',
 polyline:'<path d="M3 18L9 6l6 11 6-13"/>',
 quadratic:'<path d="M3 3Q12 38 21 3"/>',
 sin:'<path d="M2 12C5-1 9-1 12 12s7 13 10 0"/>',
 cos:'<path d="M2 5C8 5 7 19 12 19s5-14 10-14"/>',
 point:'<circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/>',
 line:'<path d="M4 19L20 5"/><circle cx="4" cy="19" r="1.5"/><circle cx="20" cy="5" r="1.5"/>',
 arrow:'<path d="M4 19L20 5m-8 0h8v8"/>',
 dashed:'<path stroke-dasharray="4 3" d="M3 18L21 6"/>',
 rope:'<path d="M3 7q5-5 10 2t8 8"/>',
 rect:'<rect x="3" y="6" width="18" height="12" rx="1"/>',
 circle:'<circle cx="12" cy="12" r="9"/>',
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
 const titles={select:'Выделение / перемещение',point:'Точка',line:'Отрезок',arrow:'Стрелка',text:'Подпись',dashed:'Вспомогательная линия',pulley:'Неподвижный блок',movablePulley:'Подвижный блок',rope:'Нить'};
 return [['Основные',['select','point','line','arrow','text']],['Геометрия',['rect','circle','angle','triangle','rightTriangle','quadrilateral','dashed']],['Физика',['block','incline','pulley','movablePulley','rope','spring','ground']]].map(([title,keys])=>
  '<details class="qw-tool-group" open><summary>'+title+'</summary><div>'+keys.map(kind=>{
   const title=titles[kind]||Object.fromEntries(QW_VISUAL_TOOLS)[kind];
   return '<button type="button" class="qw-tool-tile" data-tool="'+kind+'" title="'+qwEsc(title)+'" aria-label="'+qwEsc(title)+'" aria-pressed="'+(selected===kind)+'">'+qwVisualIcon(kind)+'<span>'+qwEsc(title)+'</span></button>';
  }).join('')+'</div></details>').join('');
}
/* Desktop-first graph tools: drawing, axes and templates have distinct purposes. */
function qwGraphSidebar(tool,coordinateMode){
 const drawing=[['select','Выделение'],['point','Точка'],['line','Отрезок'],['polyline','Ломаная'],['arrow','Вектор'],['text','Подпись'],['quadratic','Парабола'],['sin','Синус'],['cos','Косинус']];
 return '<details class="qw-tool-group qw-drawing-group" open><summary>Рисование</summary><div class="qw-tool-grid">'+drawing.map(([key,title])=>'<button type="button" class="qw-tool-tile" data-tool="'+key+'" aria-label="'+title+'" title="'+title+'" aria-pressed="'+(tool===key)+'">'+qwVisualIcon(key)+'<span>'+title+'</span></button>').join('')+'</div>'+
  '<button type="button" id="qw-finish-polyline" disabled>Завершить ломаную (Enter)</button></details>'+
  '<details class="qw-tool-group qw-coordinate-group" open><summary>Координатная система</summary><label>Режим осей<select id="qw-coordinate-mode" aria-label="Координатная система" title="Координатная система">'+qwOptions([['first','Первая четверть'],['positiveX','X ≥ 0, Y ±'],['math','X ±, Y ±'],['custom','Свой диапазон']],coordinateMode||'first')+'</select></label><p class="qw-muted">Границы X/Y и шаг задаются справа. Свой диапазон сохраняет выбранные значения.</p></details>'+
  '<details class="qw-tool-group qw-template-group" open><summary>Шаблоны</summary><label>Готовый график<select id="qw-graph-preset">'+qwOptions([['custom','Свой график'],['v','v(t)'],['x','x(t)'],['a','a(t)'],['p','p(V)'],['i','I(U)'],['parabola','Парабола'],['sin','Синус'],['cos','Косинус']],'custom')+'</select></label><div id="qw-graph-mode"></div><button type="button" id="qw-add-point" data-tool="legacyPoint" aria-label="Добавить точку шаблона">'+qwVisualIcon('point')+'<span>Точка шаблона</span></button></details>';
}
function qwVisualEditor(kind){
 const q=qwCurrent();if(!q)return;let value=structuredClone(kind==='graph'?q.graph:q.diagram),selected=-1,tool='select',drag=null,history=[],snapGeometry=true,geometryStep=20,multi=new Set(),polyline=[];
 const panelButton=(panel,title)=>'<button type="button" data-visual-panel="'+panel+'" aria-controls="qw-visual-'+panel+'" aria-expanded="false">'+title+'</button>';
 const d=qwDialog(kind==='graph'?'Редактор графика':'Редактор схемы',
  '<nav class="qw-visual-panel-nav" aria-label="Панели редактора">'+panelButton('tools','Инструменты')+panelButton('properties','Свойства')+'</nav>'+
  '<aside class="qw-visual-tools" id="qw-visual-tools" aria-label="Инструменты">'+
  (kind==='graph'?qwGraphSidebar(tool,value.coordinateMode):qwVisualPalette(tool))+'</aside>'+
  '<section class="qw-visual-canvas" aria-label="Рабочий холст"><div class="qw-visual-stage-space"><div id="qw-visual-stage" tabindex="0" aria-label="Поле редактирования '+(kind==='graph'?'графика':'схемы')+'"></div></div>'+
  (kind==='diagram'?'<div class="qw-visual-canvas-footer"><label class="qw-check"><input id="qw-snap-geometry" type="checkbox" checked>Сетка и привязка</label><label class="qw-grid-step-label">Шаг<select id="qw-grid-step-geometry" aria-label="Шаг сетки">'+qwOptions([['10','10 px'],['20','20 px'],['40','40 px']],'20')+'</select></label></div>':'')+'</section>'+
  '<aside class="qw-visual-inspector" aria-label="Свойства и действия"><div id="qw-visual-properties" aria-label="Свойства выбранного объекта" tabindex="0"></div><div class="qw-visual-actions" aria-label="Действия с выделением"><button type="button" id="qw-visual-undo" aria-label="Отменить" title="Отменить последнее изменение" disabled>'+qwVisualIcon('undo')+'<span>Отменить</span></button><button type="button" id="qw-visual-delete" aria-label="Удалить выбранное" title="Удалить выбранный объект" disabled>'+qwVisualIcon('trash')+'<span>Удалить</span></button></div></aside>',
  '<span id="qw-visual-state" role="status"></span>'+qwButton('visual-apply','Применить','class="qw-primary"'));
 d.classList.add('qw-visual-dialog','qw-visual-'+kind);d.querySelector('.qw-dialog-body').classList.add('qw-visual-body');
 const stage=d.querySelector('#qw-visual-stage'),props=d.querySelector('#qw-visual-properties'),hint=d.querySelector('#qw-visual-state');
 const point=e=>{const b=stage.querySelector('svg').getBoundingClientRect(),x=qwNum((e.clientX-b.left)/b.width*520,0,520,0),y=qwNum((e.clientY-b.top)/b.height*320,0,320,0);return kind==='diagram'&&tool!=='select'&&snapGeometry&&!e.shiftKey?(tool==='select'&&!drag?{x:Math.round(x/geometryStep)*geometryStep,y:Math.round(y/geometryStep)*geometryStep}:qwSnapDiagramPoint({x,y},value,geometryStep,drag?selected:-1)):{x,y};};
  const gridPoint=p=>{const b=QW_PLOT;return qwSnapGraphPoint(value,value.xmin+(p.x-b.left)/(b.right-b.left)*(value.xmax-value.xmin),value.ymin+(b.bottom-p.y)/(b.bottom-b.top)*(value.ymax-value.ymin));};
 function selectOnly(index){selected=index;multi=new Set(index<0?[]:[index]);}
 function selectedIndices(){return [...multi].sort((a,b)=>a-b);}
 function objects(){return kind==='diagram'?value:[...value.points,...(value.elements||[])];}
 function objectAt(i,source=value){return kind==='diagram'?source[i]:i<source.points.length?source.points[i]:source.elements[i-source.points.length];}
 function setObject(i,o){if(kind==='diagram')value[i]=o;else if(i<value.points.length)value.points[i]=o;else value.elements[i-value.points.length]=o;}
 function graphObjectBounds(o){const ps=qwGraphObjectPoints(value,o).map(p=>qwPlotXY(value,p));return {x:Math.min(...ps.map(p=>p.x)),x2:Math.max(...ps.map(p=>p.x)),y:Math.min(...ps.map(p=>p.y)),y2:Math.max(...ps.map(p=>p.y))};}
 function finishPolyline(){if(polyline.length<2)return;remember();value.elements.push({kind:'polyline',vertices:polyline,label:''});polyline=[];selectOnly(objects().length-1);tool='select';draw();}
 function graphProperties(){
  const o=objectAt(selected),index=selected-value.points.length;
  return stylePanel()+(index>=0&&o?'<section class="qw-function-settings"><h2>Выбранный объект</h2>'+['x','y','x2','y2','label'].filter(k=>k==='label'||o[k]!==undefined).map(k=>'<label>'+({x:'Начало X',y:'Начало Y',x2:'Конец X',y2:'Конец Y',label:'Подпись'}[k])+'<input data-element-field="'+k+'" type="'+(k==='label'?'text':'number')+'" step="any" value="'+qwEsc(o[k])+'"></label>').join('')+(o.kind==='function'?Object.entries(o.curve).map(([key,n])=>key==='trig'?'<label>Функция<select data-element-curve="trig">'+qwOptions([['sin','sin'],['cos','cos']],n)+'</select></label>':'<label>'+key+'<input type="number" step="any" data-element-curve="'+key+'" value="'+n+'"></label>').join(''):'')+(o.vertices?o.vertices.map((p,i)=>'<div class="qw-row">'+['x','y'].map(k=>'<label>'+k+(i+1)+'<input type="number" step="any" data-polyline-vertex="'+i+'" data-coordinate="'+k+'" value="'+p[k]+'"></label>').join('')+'</div>').join(''):'')+'</section>':'')+
   '<h2>Независимые объекты</h2><div class="qw-graph-objects">'+value.elements.map((o,i)=>'<button type="button" data-graph-object="'+(i+value.points.length)+'" aria-pressed="'+multi.has(i+value.points.length)+'">'+(i+1)+'. '+qwEsc(({point:'Точка',line:'Отрезок',arrow:'Вектор',polyline:'Ломаная',text:'Подпись',function:o.family==='quadratic'?'Парабола':o.curve?.trig||'Функция'})[o.kind])+' '+qwEsc(o.label)+'</button>').join('')+'</div>'+
   '<h2>Оформление шаблона</h2><label>Цвет линии по точкам<input type="color" data-legacy-paint="lineStyle" value="'+(value.lineStyle?.stroke||'#142b42')+'"></label>'+(value.curveFamily!=='points'?'<label>Цвет функции шаблона<input type="color" data-legacy-paint="curveStyle" value="'+(value.curveStyle?.stroke||'#186ba3')+'"></label>':'');
 }
 function stylePanel(){
  if(!multi.size)return '';
  const o=objectAt(selected),paint=o?.style||{};
  return '<section class="qw-object-style"><h2>Оформление'+(multi.size>1?' · '+multi.size+' объектов':'')+'</h2>'+[['stroke','Цвет линии / контура','#162735'],['fill','Цвет заливки','#ffffff'],['text','Цвет подписи','#162735']].filter(([key])=>key!=='fill'||kind==='diagram'&&selectedIndices().some(i=>['rect','circle','triangle','rightTriangle','quadrilateral','block','incline','pulley','movablePulley'].includes(objectAt(i)?.kind))).map(([key,title,fallback])=>'<div class="qw-paint-row"><label>'+title+'<input type="color" data-style="'+key+'" value="'+(paint[key]&&paint[key]!=='none'?paint[key]:fallback)+'"></label><div class="qw-palette">'+['#162735','#dc2626','#16a34a','#2563eb','#9333ea','#ea580c'].map(color=>'<button type="button" data-style-key="'+key+'" data-style-color="'+color+'" style="--qw-swatch:'+color+'" aria-label="'+title+' '+color+'" title="'+title+' '+color+'"></button>').join('')+(key==='fill'?'<button type="button" data-style-key="fill" data-style-color="none" aria-label="Без заливки" title="Без заливки">×</button>':'')+'</div></div>').join('')+'<label>Толщина линии<input data-style="width" type="number" min="0.5" max="12" step="0.5" value="'+(paint.width||2)+'"></label></section>';
 }
 function rotationPanel(){
  const o=value[selected];if(!o||multi.size!==1||['point'].includes(o.kind))return '';
  return '<section class="qw-object-rotation"><label>'+(o.kind==='block'?'Поворот бруска, °':'Поворот, °')+'<input id="qw-block-rotation" type="number" min="-180" max="180" step="1" value="'+Number((o.rotation||0).toFixed(2))+'"></label><div class="qw-row">'+[15,45,90].map(n=>'<button type="button" data-rotate="'+n+'">+'+n+'°</button>').join('')+'</div>'+(o.kind==='block'&&value.some(p=>p.kind==='incline')?'<label>Наклонная плоскость<select id="qw-align-plane">'+value.map((p,i)=>p.kind==='incline'?'<option value="'+i+'">Плоскость '+(i+1)+'</option>':'').join('')+'</select></label><button type="button" id="qw-align-block">Выровнять брусок по плоскости</button>':'')+'</section>';
 }
 function decorateSelection(){
  if(selected<0)multi.clear();else if(!multi.has(selected))multi=new Set([selected]);
  const svg=stage.querySelector('svg');
  for(const i of multi){const selector=kind==='diagram'?'[data-qw-object="'+i+'"]':i<value.points.length?'[data-qw-point="'+i+'"]':'[data-qw-element="'+(i-value.points.length)+'"]';svg.querySelector(selector)?.classList.add('qw-visual-selected');}
  if(drag?.marquee){
   const a=drag.start,b=drag.end||a;svg.insertAdjacentHTML('beforeend','<rect data-qw-marquee x="'+Math.min(a.x,b.x)+'" y="'+Math.min(a.y,b.y)+'" width="'+Math.abs(a.x-b.x)+'" height="'+Math.abs(a.y-b.y)+'" fill="#1686ed18" stroke="#136bb1" stroke-dasharray="5 3" pointer-events="none"/>');
  }else if(kind==='diagram'&&multi.size===1&&value[selected]&&tool==='select'){
   const o=value[selected],c=qwObjectCenter(o),b=qwObjectBounds(o),p={x:c.x,y:b.y-22};
   svg.insertAdjacentHTML('beforeend','<g data-qw-editor-only><line x1="'+c.x+'" y1="'+c.y+'" x2="'+p.x+'" y2="'+p.y+'" stroke="#136bb1" stroke-dasharray="3 3" pointer-events="none"/><circle data-rotation-handle cx="'+p.x+'" cy="'+p.y+'" r="7" fill="white" stroke="#136bb1" stroke-width="2" style="cursor:grab" aria-label="Повернуть объект"/></g>');
  }
 }
 function applyStyle(key,next,indices=selectedIndices()){
  const style=qwValidateStyle({[key]:next});if(!indices.length)return;
  remember();for(const i of indices){const o=objectAt(i);if(o&&(key!=='fill'||['rect','circle','triangle','rightTriangle','quadrilateral','block','incline','pulley','movablePulley'].includes(o.kind)))o.style={...o.style,...style};}draw();
 }
 function rotateSelected(angle){if(selected<0)return;remember();value[selected].rotation=((angle+180)%360+360)%360-180;draw();}
 function remember(){history.push(structuredClone(value));history=history.slice(-30);}
 function draw(full=true){const scroll=props.scrollTop;stage.innerHTML=kind==='graph'?qwGraphSVG(drag?.creating||polyline.length?{...value,elements:[...value.elements,...(drag?.creating?[drag.draft]:[]),...(polyline.length?[{kind:'polyline',vertices:polyline,label:''}]:[])]}:value,true):qwDiagramSVG(drag?.creating?[...value,drag.draft]:value,true,snapGeometry?geometryStep:false);decorateSelection();if(selected>=0){const el=stage.querySelector('[data-qw-'+(kind==='graph'?'point':'object')+'="'+selected+'"]');if(el)el.classList.add('qw-visual-selected');}hint.className='';hint.textContent=kind==='graph'?value.points.length+' / 40 точек · '+value.elements.length+' / 60 объектов'+(polyline.length?' · Ломаная: '+polyline.length+' вершин':''):value.length+' / 60 фигур';d.querySelector('#qw-visual-undo').disabled=!history.length;d.querySelector('#qw-visual-delete').disabled=selected<0;d.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));if(kind==='graph'){d.querySelector('#qw-finish-polyline').disabled=polyline.length<2;d.querySelector('#qw-coordinate-mode').value=value.coordinateMode||'custom';}
  if(!full)return;
  if(kind==='graph')props.innerHTML='<div class="qw-graph-settings">'+['xmin','xmax','ymin','ymax','step','xlabel','ylabel'].map((k,i)=>'<label>'+['X от','X до','Y от','Y до','Шаг','Подпись X','Подпись Y'][i]+'<input data-graph-field="'+k+'" type="'+(i<5?'number':'text')+'" '+(i<5?'step="any"':'maxlength="30"')+' value="'+qwEsc(value[k])+'"></label>').join('')+['snapToGrid','grid','connected','smooth'].map((k,i)=>'<label class="qw-check"><input data-graph-field="'+k+'" type="checkbox" '+(value[k]?'checked':'')+'>'+['Привязка к пересечениям сетки','Сетка','Соединять точки','Плавная линия'][i]+'</label>').join('')+'</div>'+
   '<div class="qw-function-settings"><h2>Параметры '+({points:'линии',quadratic:'параболы',trigonometric:'функции'}[value.curveFamily])+'</h2>'+
   (value.curveFamily==='quadratic'?['a','b','c'].map(k=>'<label>Коэффициент '+k+'<input data-curve-param="'+k+'" type="number" step="any" value="'+qwEsc(value.curve[k])+'"></label>').join(''):'')+
   (value.curveFamily==='trigonometric'?'<label>Функция<select id="qw-curve-trig">'+qwOptions([['sin','sin'],['cos','cos']],value.curve.trig)+'</select></label>'+
     ['amplitude','frequency','phase','offset'].map((k,i)=>'<label>'+['Амплитуда','Частота (рад)','Фаза (рад)','Смещение'][i]+'<input data-curve-param="'+k+'" type="number" step="any" value="'+qwEsc(value.curve[k])+'"></label>').join(''):'')+
   '</div><h2>Точки</h2><div class="qw-point-list">'+value.points.map((p,i)=>'<div data-point-row="'+i+'"><b>'+(i+1)+'</b>'+['x','y','label'].map(k=>'<input aria-label="'+k+' точки '+(i+1)+'" data-point-index="'+i+'" data-point-field="'+k+'" type="'+(k==='label'?'text':'number')+'" '+(k==='label'?'maxlength="30"':'step="any"')+' value="'+qwEsc(p[k])+'">').join('')+'<button type="button" data-point-up="'+i+'" '+(!i?'disabled':'')+' title="Раньше в ломаной" aria-label="Переместить точку '+(i+1)+' раньше">'+qwVisualIcon('up')+'</button><button type="button" data-point-delete="'+i+'" aria-label="Удалить точку '+(i+1)+'" title="Удалить точку '+(i+1)+'">'+qwVisualIcon('trash')+'</button></div>').join('')+'</div>'+graphProperties();
  else props.innerHTML='<div class="qw-diagram-presets"><label>Готовые физические схемы<select id="qw-diagram-preset">'+qwOptions([['none','Выбрать схему'],['surface','Брусок на опоре'],['incline','Брусок на наклонной плоскости'],['pulley','Система с неподвижным блоком'],['movable','Система с подвижным блоком'],['spring','Брусок и пружина']],'none')+'</select></label></div><div class="qw-row"><label>Подпись выбранной фигуры<input id="qw-object-label" maxlength="80" value="'+qwEsc(value[selected]?.label||'')+'" '+(selected<0?'disabled':'')+'></label></div>'+
   stylePanel()+rotationPanel()+
   (value[selected]?.vertices?'<details open><summary>Вершины и обозначения</summary><div class="qw-vertex-list">'+value[selected].vertices.map((p,i)=>'<div><label>Вершина '+(i+1)+'<input data-vertex-index="'+i+'" data-vertex-field="label" maxlength="20" value="'+qwEsc(p.label)+'"></label><label>X<input data-vertex-index="'+i+'" data-vertex-field="x" type="number" min="0" max="520" step="any" value="'+p.x+'"></label><label>Y<input data-vertex-index="'+i+'" data-vertex-field="y" type="number" min="0" max="320" step="any" value="'+p.y+'"></label></div>').join('')+'</div><div class="qw-edge-list">'+value[selected].vertices.map((p,i)=>'<label>Сторона '+qwEsc(p.label||String(i+1))+'–'+qwEsc(value[selected].vertices[(i+1)%value[selected].vertices.length].label||String((i+1)%value[selected].vertices.length+1))+'<input data-edge-index="'+i+'" maxlength="40" placeholder="Длина / обозначение" value="'+qwEsc(value[selected].edgeLabels?.[i]||'')+'"></label>').join('')+'</div></details>':'')+
   (value[selected]&&['triangle','rightTriangle'].includes(value[selected].kind)?
    '<div class="qw-constructions"><label>Из вершины<select id="qw-construction-vertex">'+qwOptions(value[selected].vertices.map((p,i)=>[String(i),p.label||'Вершина '+(i+1)]),'0')+'</select></label>'+
    '<button type="button" data-construction="median">Провести медиану</button>'+
    '<button type="button" data-construction="altitude">Провести высоту</button></div>':'')+
   (multi.size?'<div class="qw-row"><button type="button" data-layer="front">На передний план</button><button type="button" data-layer="back">На задний план</button></div>':'')+'<h2>Объекты</h2><div class="qw-object-list">'+value.map((o,i)=>'<button type="button" aria-pressed="'+(multi.has(i))+'" data-object-select="'+i+'">'+(i+1)+'. '+qwEsc(Object.fromEntries(QW_VISUAL_TOOLS)[o.kind]||o.kind)+' '+qwEsc(o.label)+'</button>').join('')+'</div>';
  if(kind==='graph')d.querySelector('#qw-graph-mode').innerHTML='<label>Тип графика<select id="qw-curve-family">'+qwOptions([['points','По точкам'],['quadratic','Парабола'],['trigonometric','Тригонометрия']],value.curveFamily)+'</select></label>';
  props.scrollTop=scroll;
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
 d.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'&&!e.defaultPrevented&&!e.target.closest('input,textarea,[contenteditable="true"]')){e.preventDefault();e.stopPropagation();d.querySelector('#qw-visual-undo').click();return;}if(e.key==='Escape'&&(polyline.length||drag||multi.size)){e.preventDefault();cancelDrag();polyline=[];selectOnly(-1);draw();return;}if(e.key==='Escape'&&d.dataset.panel&&matchMedia('(max-width:1000px)').matches){e.preventDefault();e.stopPropagation();showPanel('');d.querySelector('[data-visual-panel]').focus();}});
 props.addEventListener('focusin',e=>{if(kind==='graph'&&e.target.dataset.pointIndex!==undefined){selectOnly(Number(e.target.dataset.pointIndex));draw(false);}});
 stage.onpointerdown=e=>{
  if(e.button!==0||drag)return;e.preventDefault();stage.focus();
  const p=point(e),before=structuredClone(value),previous=selected,scale=stage.querySelector('svg').getBoundingClientRect().width/520;
  const prior=new Set(multi),coordinate=kind==='graph'?gridPoint(p):p;
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
   if(['point','text'].includes(tool)){remember();value.push({kind:tool,x:p.x,y:p.y,x2:p.x,y2:p.y,label});selectOnly(value.length-1);draw();return;}
   creating=true;draft={kind:tool,x:p.x,y:p.y,x2:p.x,y2:p.y,label:''};
  }
  let handle=kind==='diagram'&&multi.size===1&&tool==='select'?e.target.closest('[data-qw-vertex]'):null;
  if(handle&&Number(handle.closest('[data-qw-object]').dataset.qwObject)!==selected)handle=null;
  drag={creating,draft,before,previous,selection:prior,start:coordinate,screen:{x:e.clientX,y:e.clientY},pixels:0,indices:selectedIndices(),vertexIndex:handle?Number(handle.dataset.qwVertex):-1};
  stage.setPointerCapture(e.pointerId);draw(false);
 };
 stage.onpointermove=e=>{
  if(!drag)return;const p=point(e),coordinate=kind==='graph'?gridPoint(p):p;
  if(drag.marquee){drag.end=p;draw(false);return;}
  if(drag.rotating){const angle=Math.atan2(p.y-drag.center.y,p.x-drag.center.x);value[selected].rotation=((drag.angle+(angle-drag.startAngle)*180/Math.PI+180)%360+360)%360-180;draw(false);return;}
  drag.pixels=Math.hypot(e.clientX-drag.screen.x,e.clientY-drag.screen.y);
  if(drag.creating){drag.draft.x2=coordinate.x;drag.draft.y2=coordinate.y;}
  else if(kind==='graph'){
   let dx=coordinate.x-drag.start.x,dy=coordinate.y-drag.start.y;
   const legacy=drag.indices.filter(i=>i<value.points.length).map(i=>drag.before.points[i]);
   if(legacy.length){dx=qwNum(dx,value.xmin-Math.min(...legacy.map(p=>p.x)),value.xmax-Math.max(...legacy.map(p=>p.x)),0);dy=qwNum(dy,value.ymin-Math.min(...legacy.map(p=>p.y)),value.ymax-Math.max(...legacy.map(p=>p.y)),0);}
   for(const i of drag.indices)setObject(i,qwTranslateGraphObject(objectAt(i,drag.before),dx,dy));
  }else{
   const o=value[selected];
   if(drag.vertexIndex>=0&&o.vertices?.[drag.vertexIndex]){
    const initial=drag.before[selected];
    if(initial.rotation){o.vertices=initial.vertices.map(v=>qwRotatePoint(v,qwObjectCenter(initial),initial.rotation));o.rotation=0;}
    const location=snapGeometry&&!e.shiftKey?qwSnapDiagramPoint(p,value,geometryStep,selected):p;
    const at=qwRotatePoint(location,qwObjectCenter(o),-(o.rotation||0));o.vertices[drag.vertexIndex].x=qwNum(at.x,0,520,0);o.vertices[drag.vertexIndex].y=qwNum(at.y,0,320,0);
    const v=o.vertices;o.x=Math.min(...v.map(q=>q.x));o.y=Math.min(...v.map(q=>q.y));o.x2=Math.max(...v.map(q=>q.x));o.y2=Math.max(...v.map(q=>q.y));
   }else{
    const bounds=drag.indices.map(i=>qwObjectBounds(drag.before[i]));let dx=p.x-drag.start.x,dy=p.y-drag.start.y;
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
   const o=pending.draft;if(kind==='diagram'){if(['triangle','rightTriangle','quadrilateral'].includes(o.kind))o.vertices=qwGeometryVertices(o);value.push(o);}else value.elements.push(o);selectOnly(objects().length-1);
  }
  if(JSON.stringify(value)!==JSON.stringify(pending.before)){
   try{value=kind==='graph'?qwValidateGraph(value):qwValidateDiagram(value);history.push(pending.before);history=history.slice(-30);}
   catch(error){value=pending.before;selectOnly(-1);draw();hint.textContent=error.message;return;}
  }
  draw();
 };
 function cancelDrag(){if(!drag)return;value=drag.before;selected=drag.previous;multi=drag.selection||new Set();drag=null;draw();}
 stage.onpointercancel=cancelDrag;stage.onlostpointercapture=cancelDrag;
 d.addEventListener('cancel',e=>{if(polyline.length||drag||multi.size){e.preventDefault();cancelDrag();polyline=[];selectOnly(-1);draw();}});
 function remove(){if(selected<0)return;remember();if(kind==='graph'){const count=value.points.length;value.points=value.points.filter((_,i)=>!multi.has(i));value.elements=value.elements.filter((_,i)=>!multi.has(i+count));}else value=value.filter((_,i)=>!multi.has(i));selectOnly(-1);draw();}
 stage.onkeydown=e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();multi=new Set(objects().map((_,i)=>i));selected=objects().length-1;draw();}
  else if(e.key==='Escape'){e.preventDefault();cancelDrag();polyline=[];selectOnly(-1);draw();}
  else if(e.key==='Enter'&&polyline.length){e.preventDefault();finishPolyline();}
  else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();d.querySelector('#qw-visual-undo').click();}
 };
 d.querySelector('#qw-visual-undo').onclick=()=>{cancelDrag();polyline=[];if(history.length){value=history.pop();selectOnly(-1);draw();}};d.querySelector('#qw-visual-delete').onclick=remove;
 d.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;if(t.dataset.tool){polyline=[];tool=t.dataset.tool;for(const b of d.querySelectorAll('[data-tool]'))b.setAttribute('aria-pressed',String(b===t));if(matchMedia('(max-width:1000px)').matches)showPanel('');draw();}
  if(t.id==='qw-finish-polyline'){finishPolyline();return;}
  if(t.dataset.graphObject!==undefined){const i=Number(t.dataset.graphObject);if(e.shiftKey){if(multi.has(i))multi.delete(i);else multi.add(i);selected=[...multi].at(-1)??-1;}else selectOnly(i);tool='select';draw();return;}
  if(t.dataset.styleColor){applyStyle(t.dataset.styleKey,t.dataset.styleColor);return;}
  if(t.dataset.rotate){rotateSelected((value[selected]?.rotation||0)+Number(t.dataset.rotate));return;}
  if(t.id==='qw-align-block'){const plane=value[Number(d.querySelector('#qw-align-plane').value)];rotateSelected(qwInclineAngle(plane));return;}
  if(t.dataset.layer&&multi.size){remember();const picked=value.filter((_,i)=>multi.has(i)),rest=value.filter((_,i)=>!multi.has(i));value=t.dataset.layer==='front'?[...rest,...picked]:[...picked,...rest];multi=new Set(picked.map((_,i)=>t.dataset.layer==='front'?rest.length+i:i));selected=[...multi].at(-1);draw();return;}
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
   if(t.id==='qw-coordinate-mode'){
    const range=qwCoordinatePreset(t.value);const next=qwValidateGraph({...value,...(range||{}),coordinateMode:t.value});remember();value=next;draw();showRangeWarning();return;
   }
   if(t.dataset.elementField||t.dataset.elementCurve||t.dataset.polylineVertex!==undefined){
    const next=structuredClone(value),o=next.elements[selected-next.points.length];if(!o)return;
    if(t.dataset.elementField){const k=t.dataset.elementField;o[k]=k==='label'?t.value:Number(t.value);}
    else if(t.dataset.elementCurve){const k=t.dataset.elementCurve;o.curve[k]=k==='trig'?t.value:Number(t.value);}
    else o.vertices[Number(t.dataset.polylineVertex)][t.dataset.coordinate]=Number(t.value);
    const validated=qwValidateGraph(next);remember();value=validated;draw(false);return;
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
   }}catch(error){draw();hint.textContent=error.message;hint.className='qw-error';}});
 d.querySelector('[data-qw-action="visual-apply"]').onclick=()=>{try{if(polyline.length){hint.textContent='Завершите ломаную или отмените её клавишей Escape';return;}const validated=kind==='graph'?qwValidateGraph(value):qwValidateDiagram(value);qwChange(()=>{q[kind]=validated;q.figure=kind;});d.close();}catch(e){hint.textContent=e.message;}};draw();
}
function qwNew(){if((qwDoc.tasks.length||qwCorrupt)&&!confirm('Создать новую работу? Для резервной копии сохраните QWORK.'))return;qwRemember();qwCorrupt='';qwDoc=qwProject();qwSelected='';qwPersist();qwRender();}
function qwAction(action,button){
 const q=qwCurrent();
 if(action==='new'){qwNew();return;}if(action==='open'){document.getElementById('qw-file')?.click();return;}if(action==='save'){qwSaveFile();return;}if(action==='settings'){qwSettings();return;}if(action==='preview'){qwPreview();return;}if(action==='pdf'||action==='pdf-text'){qwPrintTextPDF();return;}if(action==='pdf-student'||action==='pdf-teacher'){qwExportPDF(action==='pdf-teacher');return;}
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
 spans.forEach((e,i)=>{if(active){if(e.dataset.qwOriginal===undefined)e.dataset.qwOriginal=e.textContent;e.textContent=i===0?'A4 · PDF':i===1?qwDoc.tasks.length+' заданий · '+qwDoc.tasks.reduce((s,q)=>s+q.points,0)+' баллов':'QWORK / PDF';}else if(e.dataset.qwOriginal!==undefined){e.textContent=e.dataset.qwOriginal;delete e.dataset.qwOriginal;}});
}
