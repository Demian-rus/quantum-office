/* TASK144: standalone mathematics/physics workbench, reusing Office shell/symbols. */
const QW_KEY='quantum-office.work-builder.v1',QW_BANK_KEY='quantum-office.work-bank.v1';
let qwDoc=qwProject(),qwSelected='',qwLeft=false,qwRight=false,qwStorageError='',qwCorrupt='',qwUndo=[],qwRedo=[],qwExported='',qwBusy=false;
qwDoc.layout='compact';
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
function qwQuickButtons(){return '<div class="qw-quick-add" aria-label="Добавить задание">'+[['short','Краткий ответ','line'],['extended','Развёрнутый ответ','text'],['test','Тест','rect'],['diagram','Рисунок / схема','triangle'],['graph','График','quadratic'],['text','Текстовое задание','text']].map(([type,title,icon])=>qwButton('quick-add',qwVisualIcon(icon)+'<span>'+title+'</span>','data-type="'+type+'"')).join('')+'</div>';}
function qwTaskNavigation(){return qwDoc.tasks.map((t,i)=>((!i||qwDoc.tasks[i-1].part!==t.part)?'<h3 data-task-part="'+qwEsc(t.part)+'" data-task-gap="'+i+'">'+qwEsc(t.part||'Без части')+'</h3>':'')+'<div class="qw-nav-row" data-task-row="'+i+'" data-task-id="'+qwEsc(t.id)+'"><button type="button" draggable="true" class="qw-task-drag" data-drag-id="'+qwEsc(t.id)+'" aria-label="Перетащить задание '+(i+1)+'" title="Перетащите для изменения порядка"><svg viewBox="0 0 12 20" aria-hidden="true"><path d="M4 4h0m4 0h0M4 10h0m4 0h0M4 16h0m4 0h0" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg></button><button type="button" class="qw-nav-task" data-qw-action="select" data-id="'+qwEsc(t.id)+'" aria-current="'+(t.id===qwSelected)+'" title="'+qwEsc(t.prompt)+'"><b>'+(i+1)+'</b><span>'+qwEsc(t.prompt||(!t.answerVisible&&t.type==='short'?'Текстовое задание':QW_TYPES[t.type]))+'</span></button></div>').join('');}
function qwToolbar(){return qoWorkGroup('Работа',qoWorkButton('work-new','Создать работу','new')+qoWorkButton('work-open','Открыть QWORK','folder')+qoWorkButton('work-save','Сохранить QWORK','save'))+qoWorkGroup('Готовый вариант',qoWorkButton('work-preview','Макет и экспорт PDF','file-text')+qoWorkButton('work-pdf','Скачать PDF','download')+qoWorkButton('work-answers','Скачать ответы PDF','file-text'));}
function qwLayoutCards(current){
 const layouts=[['booklet','Экзаменационный сборник','Книжная типографика, номера в рамках и компактные задания.','M8 12h8v8H8zM20 14h9m-9 6h18m-18 6h12m-12 6h16m-16 6h18'],['compact','Компактный сборник','Много заданий на странице. Без места для ответов.','M9 12h18m-18 6h14m-14 6h18m-18 6h12m-12 6h18m-18 6h14'],['practice','Лист для решения','Условия сверху, ниже место для самостоятельного решения.','M9 12h18m-18 6h13M9 24h18v18H9zM15 24v18m6-18v18M9 30h18M9 36h18'],['worksheet','Обычная контрольная','Стандартная контрольная работа с полями ответов и настройками.','M9 12h18m-18 6h14M9 24h18m-18 8h18m-18 6h14M9 44h18']];
 return '<fieldset class="qw-layout-cards" id="qw-pdf-format"><legend>Формат PDF</legend>'+layouts.map(([id,title,description,path])=>'<label class="qw-layout-card"><input type="radio" name="qw-pdf-layout" value="'+id+'" '+(current===id?'checked':'')+'><svg viewBox="0 0 36 52" aria-hidden="true"><rect x="3" y="2" width="30" height="48" rx="1" fill="white" stroke="currentColor"/><path d="'+path+'" fill="none" stroke="currentColor" stroke-width=".8"/></svg><span><strong>'+title+'</strong></span></label>').join('')+'</fieldset>';
}
function qwTaskPreview(q,index=0,layout=qwDoc.layout,printing=false,preferences=null,rich=false){
 const visual=q.figure==='graph'?qwGraphSVG(q.graph,false,printing?{axisFont:22,titleFont:24}:{}):q.figure==='diagram'?qwDiagramSVG(q.diagram):q.figure==='image'&&q.image?'<img alt="Иллюстрация задания" src="'+q.image+'">':'';
 const figure=visual?'<figure data-figure-kind="'+q.figure+'" data-requested-width="'+Math.min(q.figureWidth,470)+'" style="width:'+Math.min(q.figureWidth,470)+'px">'+visual+'</figure>':'';
 const bankLabel=layout==='booklet'&&q.source?.kind==='bank'&&qwBankNumber(q.source.number)?
  '<span class="qw-booklet-bank-id" data-qw-bank-number="'+q.source.number+'">'+
  (q.source.slot?'Тип '+qwEsc(q.source.slot)+' ':'')+'№ '+String(q.source.number).padStart(5,'0')+'</span> ':'';
 const format=rich?qwRichMarkdownHTML:qwContentHTML;
 const text='<div class="qw-task-text'+(rich?' qw-rich':'')+'">'+bankLabel+format(q.prompt||'Условие не заполнено')+(q.type==='choice'?'<ol class="qw-choice-list">'+q.choices.map(c=>'<li>'+format(c)+'</li>').join('')+'</ol>':'')+'</div>';
 const effectivePreferences=preferences||(printing?null:qwDoc.printSettings);
 const position=effectivePreferences?.figurePosition&&effectivePreferences.figurePosition!=='auto'?effectivePreferences.figurePosition:q.position;
 const flow='<div class="qw-task-flow qw-figure-'+(!printing&&position==='auto'?'right':position)+'">'+(printing?text+figure:figure+text)+'</div>';
 if(layout==='booklet')return '<article class="qw-paper-task qw-compact-entry qw-booklet-entry"><header><b class="qw-task-number qw-print-number">'+(index+1)+'</b></header>'+flow+
  (q.answerVisible&&['short','choice','graph','diagram'].includes(q.type)?'<div class="qw-booklet-answer">Ответ: <span></span></div>':'')+'</article>';
 if(layout==='compact'||layout==='practice')return '<article class="qw-paper-task qw-compact-entry"><header><b class="qw-task-number qw-print-number">'+(index+1)+'.</b></header>'+flow+'</article>';
 if(layout==='exam')return '<article class="qw-paper-task qw-exam-task"><div class="qw-exam-grid"><b class="qw-exam-number qw-print-number">'+(index+1)+'.</b><div class="qw-exam-body">'+flow+'</div></div></article>';
 return '<article class="qw-paper-task qw-worksheet-task"><header><b class="qw-print-number">Задание '+(index+1)+'</b>'+(printing?'':'<span>'+qwEsc(QW_TYPES[q.type])+' · '+q.points+' б.</span>')+'</header>'+flow+
  (q.answerVisible?'<div class="qw-answer-preview">Ответ: '+(q.answerStyle==='boxes'?Array.from({length:q.boxes},()=>'<i></i>').join(''):q.answerStyle==='box'?'<i class="qw-answer-box"></i>':'<span></span>')+'</div>':'')+
  (q.solutionVisible?'<div class="qw-solution-preview qw-solution-'+q.solutionStyle+'" style="height:'+q.solutionHeight+'px"></div>':'')+'</article>';
}
function qwRender(){
 const host=document.getElementById('qo-work-root');if(!host)return;
 if(!qwDoc.tasks.some(q=>q.id===qwSelected))qwSelected=qwDoc.tasks[0]?.id||'';
 qwFooter(qwActive());
 const q=qwCurrent(),old=host.querySelector('.qw-center')?.scrollTop||0;
 host.className='qw-frame'+(qwLeft?' qw-left-open':'')+(qwRight?' qw-right-open':'');
 host.innerHTML='<aside class="qw-left" aria-label="Структура работы">'+qwButton('close-panels','Закрыть','class="qw-drawer-close"')+'<header><strong>Задания</strong><span>'+qwDoc.tasks.length+' / 80</span></header>'+qwQuickButtons()+'<div class="qw-row">'+qwButton('part','+ Часть')+'</div><nav aria-label="Порядок заданий">'+qwTaskNavigation()+'</nav><div class="qw-row">'+qwButton('bank','Банк заданий')+qwButton('from-diag','Из диагностики')+'</div></aside>'+
 '<main class="qw-center"><div class="qw-center-head"><h1>'+qwEsc(qwDoc.title)+'</h1><div class="qw-row">'+qwButton('left','Задания','class="qw-mobile"')+qwButton('right','Свойства','class="qw-mobile"')+qwButton('settings','Параметры работы')+qwButton('preview','Макет и экспорт PDF')+qwButton('pdf','Скачать PDF')+qwButton('save','Сохранить QWORK','class="qw-primary"')+'</div><div class="qw-row"><span id="qw-save-state" role="status">'+qwEsc(qwStorageError||'Черновик на устройстве')+'</span>'+qwButton('undo','Отменить',qwUndo.length?'':'disabled')+qwButton('redo','Повторить',qwRedo.length?'':'disabled')+qwButton('example','Пример работы')+'</div></div>'+
 (qwCorrupt?'<div class="qw-error" role="alert">'+qwEsc(qwStorageError)+qwButton('recovery','Скачать исходные данные')+qwButton('new','Новый проект')+'</div>':'')+
 (q?'<section class="qw-editor"><div class="qw-row"><strong>Задание '+(qwDoc.tasks.indexOf(q)+1)+'</strong>'+qwButton('up','↑','title="Переместить выше" '+(!qwDoc.tasks.indexOf(q)?'disabled':''))+qwButton('down','↓','title="Переместить ниже" '+(qwDoc.tasks.indexOf(q)===qwDoc.tasks.length-1?'disabled':''))+qwButton('duplicate','Копия')+qwButton('delete','Удалить')+'</div><label>Условие<textarea id="qw-prompt" data-qw-field="prompt" maxlength="16000" rows="7">'+qwEsc(q.prompt)+'</textarea></label>'+(q.type==='choice'?'<label>Варианты ответа (по одному в строке)<textarea data-qw-field="choices" rows="4">'+qwEsc(q.choices.join('\n'))+'</textarea></label>':'')+'<div class="qw-row qw-insert">'+qwButton('math','Формула')+qwButton('symbols','Символы')+qwButton('blank','Пустая вставка')+qwButton('graph','График')+qwButton('diagram','Схема')+qwButton('image','Изображение')+'</div></section><section class="qw-selected-preview" id="qw-task-preview" aria-label="Вид задания">'+qwTaskPreview(q,qwDoc.tasks.indexOf(q))+'</section>':'<div class="qw-empty"><h2>Нет заданий</h2>'+qwButton('add','Добавить задание','class="qw-primary"')+'</div>')+'</main>'+
 '<aside class="qw-right" aria-label="Свойства задания">'+qwButton('close-panels','Закрыть','class="qw-drawer-close"')+'<h2>Свойства задания'+(q?' № '+(qwDoc.tasks.indexOf(q)+1):'')+'</h2>'+(q?qwSelect('type','Тип',Object.entries(QW_TYPES),q.type)+qwField('part','Часть',q.part)+qwField('points','Баллы',q.points,'number','min="0" max="100"')+(!['compact','practice'].includes(qwDoc.layout)?qwCheck('answerVisible','Поле ответа',q.answerVisible)+qwSelect('answerStyle','Формат ответа',[['line','Строка'],['box','Рамка'],['boxes','Ячейки']],q.answerStyle)+(q.answerStyle==='boxes'?qwField('boxes','Количество ячеек',q.boxes,'number','min="1" max="30"'):'')+qwCheck('solutionVisible','Место для решения',q.solutionVisible)+(q.solutionVisible?qwField('solutionHeight','Высота решения, пт',q.solutionHeight,'number','min="24" max="500"')+qwSelect('solutionStyle','Разлиновка',[['lines','Строки'],['grid','Клетка'],['blank','Без разлиновки']],q.solutionStyle):''):'<p class="qw-muted">Поля для записи задаются форматом PDF.</p>')+qwSelect('figure','Иллюстрация',[['none','Нет'],['graph','График'],['diagram','Схема'],['image','Изображение']],q.figure)+(q.figure!=='none'?qwSelect('position','Расположение',[['auto','Автоматически'],['right','Справа'],['below','Под условием'],...(q.position==='left'?[['left','Слева (старый макет)']]:[])],q.position)+(!['compact','practice'].includes(qwDoc.layout)?qwField('figureWidth','Ширина, пт',q.figureWidth,'number','min="120" max="470"'):''):'')+qwCheck('pageBreak','С новой страницы',q.pageBreak)+'<details><summary>Ответ и критерии</summary>'+['answer','criteria','comment'].map((k,i)=>'<label>'+['Ответ для ключа','Критерии','Комментарий'][i]+'<textarea data-qw-field="'+k+'" rows="3" maxlength="16000">'+qwEsc(q[k])+'</textarea></label>').join('')+'</details>'+qwButton('bank-save','Сохранить задание в банк'):'<p>Нет выбранного задания</p>')+'</aside><input type="file" id="qw-file" accept=".qwork,application/json" hidden><input type="file" id="qw-image" accept="image/png,image/jpeg,image/webp" hidden>';
 host.querySelector('.qw-center').scrollTop=old;
}
function qwPreviewSelected(){const p=document.getElementById('qw-task-preview'),q=qwCurrent();if(p&&q)p.innerHTML=qwTaskPreview(q,qwDoc.tasks.indexOf(q));const t=document.querySelector('.qw-nav-task[aria-current="true"] span');if(t&&q){t.textContent=q.prompt||QW_TYPES[q.type];t.parentElement.title=q.prompt;}}
function qwDialog(title,body,footer=''){document.getElementById('qw-dialog')?.remove();const d=document.createElement('dialog');d.id='qw-dialog';d.className='qw-dialog';d.innerHTML='<header><strong>'+title+'</strong><button type="button" data-qw-close aria-label="Закрыть">×</button></header><div class="qw-dialog-body">'+body+'</div>'+(footer?'<footer>'+footer+'</footer>':'');d.addEventListener('close',()=>d.remove());d.querySelector('[data-qw-close]').onclick=()=>d.close();document.body.append(d);d.showModal();return d;}
function qwFormatOptions(current){return qwOptions([['booklet','Экзаменационный сборник'],['compact','Компактный сборник'],['practice','Лист для решения'],...(current==='exam'?[['exam','Прежний компактный макет (без проверки ФИПИ)']]:[]),['worksheet','Обычная контрольная работа']],current)+'<option disabled>Вариант ОГЭ / ЕГЭ — отдельный этап</option>';}
function qwPracticeControls(settings={},attribute='data-practice'){
 return '<label>Задач на странице<select '+attribute+'="perPage">'+qwOptions([[1,'Одна'],[2,'Две'],[3,'Три'],[4,'Четыре']],settings.perPage||2)+'</select></label><label>Пространство для решения<select '+attribute+'="grid">'+qwOptions([['none','Без разлиновки'],['fine','Мелкая светлая клетка'],['normal','Обычная клетка']],settings.grid||'fine')+'</select></label>';
}
function qwSettings(){
 const d=qwDialog('Параметры работы','<div class="qw-settings">'+['title','grade','topic','variant'].map((k,i)=>'<label>'+['Название','Класс','Тема','Вариант №'][i]+'<input data-meta="'+k+'" value="'+qwEsc(qwDoc[k])+'" maxlength="160"></label>').join('')+'<label>Предмет<select data-meta="subject">'+qwOptions(Object.entries(QW_SUBJECTS),qwDoc.subject)+'</select></label><label>Формат PDF<select data-meta="layout">'+qwFormatOptions(qwDoc.layout)+'</select></label><div class="qw-settings-wide qw-row" data-practice-controls>'+qwPracticeControls(qwDoc.practice)+'</div><label class="qw-settings-wide">Инструкция для обычной контрольной<textarea data-meta="instructions" rows="4" maxlength="4000">'+qwEsc(qwDoc.instructions)+'</textarea></label></div>',qwButton('meta-apply','Применить','class="qw-primary"'));
 const format=d.querySelector('[data-meta="layout"]'),toggle=()=>d.querySelector('[data-practice-controls]').hidden=format.value!=='practice';format.onchange=toggle;toggle();
 d.querySelector('[data-qw-action="meta-apply"]').onclick=()=>{qwChange(()=>{
  for(const e of d.querySelectorAll('[data-meta]'))qwDoc[e.dataset.meta]=qwText(e.value,e.dataset.meta==='instructions'?4000:160);
  if(format.value==='practice')qwDoc.practice={perPage:Number(d.querySelector('[data-practice="perPage"]').value),grid:d.querySelector('[data-practice="grid"]').value};
  qwDoc.title=qwDoc.title.trim()||'Новая работа';
 });d.close();};
}
function qwInsert(text){const el=document.getElementById('qw-prompt'),q=qwCurrent();if(!el||!q)return;qwRemember();const a=el.selectionStart??el.value.length,b=el.selectionEnd??a;el.setRangeText(text,a,b,'end');q.prompt=el.value.slice(0,16000);qwPersist();qwPreviewSelected();el.focus();}
function qwFormula(){const d=qwDialog('Формула','<div class="qw-row">'+['\\frac{a}{b}','x^{2}','a_{1}','\\sqrt{x}','(a+b)','\\Delta t'].map(v=>'<button type="button" data-formula="'+qwEsc(v)+'">'+qwContentHTML('\\('+v+'\\)')+'</button>').join('')+'</div><label>Выражение<input id="qw-formula-source" maxlength="600" value="\\frac{a}{b}"></label><div id="qw-formula-preview"></div><p class="qw-muted">Дробь: \\frac{a}{b} · корень: \\sqrt{x} · индексы: x^{2}, a_{1}</p>',qwButton('formula-insert','Вставить','class="qw-primary"'));const input=d.querySelector('input'),view=d.querySelector('#qw-formula-preview'),ok=d.querySelector('[data-qw-action="formula-insert"]');const update=()=>{try{view.innerHTML='<math xmlns="http://www.w3.org/1998/Math/MathML">'+qwMathML(qwMath(input.value))+'</math>';ok.disabled=false;}catch(e){view.textContent=e.message;ok.disabled=true;}};input.oninput=update;for(const e of d.querySelectorAll('[data-formula]'))e.onclick=()=>{input.value=e.dataset.formula;update();};ok.onclick=()=>{const s=input.value;d.close();qwInsert('\\('+s+'\\)');};update();}
function qwSymbols(){const groups={...(typeof QO_WRITER_SYMBOLS==='object'?QO_WRITER_SYMBOLS:{}),'Греческие':['α','β','γ','δ','ε','ζ','η','θ','ι','κ','λ','μ','ν','ξ','π','ρ','σ','τ','υ','φ','χ','ψ','ω','Γ','Δ','Θ','Λ','Π','Σ','Φ','Ψ','Ω'],'Единицы':['м','с','кг','Н','Дж','Вт','Па','В','А','Ом','м/с','м/с²','Дж/(кг·°C)']};const d=qwDialog('Символы',Object.entries(groups).map(([k,vs])=>'<h3>'+qwEsc(k)+'</h3><div class="qw-symbols">'+vs.map(v=>'<button type="button" data-symbol="'+qwEsc(v)+'">'+qwEsc(v)+'</button>').join('')+'</div>').join(''));for(const e of d.querySelectorAll('[data-symbol]'))e.onclick=()=>{d.close();qwInsert(e.dataset.symbol);};}
/* Online publishing: browser's native print-to-PDF preserves selectable text and vector SVG.
   The older one-click raster PDF exporter remains available as a compatibility fallback. */
/* Unified high-quality browser PDF. Native font shaping and vector SVG are kept. */
function qwAnswerSections(d,options){
 const columns=d.tasks.length>=12?3:d.tasks.length>=6?2:1,sections=[];let short=[];
 const flush=()=>{if(!short.length)return;sections.push('<section class="qw-print-section qw-answer-row" data-task="'+short[0].number+'"><article class="qw-paper-task"><div class="qw-task-flow"><div class="qw-task-text qw-answer-columns" style="--qw-answer-columns:'+columns+'">'+short.map(({q,number})=>'<div class="qw-answer-item" data-answer-number="'+number+'"><b class="qw-print-number">'+number+'.</b><span class="qw-answer-text">'+qwContentHTML(q.answer.trim()||'—')+'</span></div>').join('')+'</div></div></article></section>');short=[];};
 d.tasks.forEach((q,i)=>{
  const extra=(options.includeCriteria===true&&q.criteria?'<br><b>Критерии:</b> '+qwContentHTML(q.criteria):'')+(options.includeComments===true&&q.comment?'<br><b>Комментарий:</b> '+qwContentHTML(q.comment):'');
  if(q.type==='extended'||q.answer.length>70||q.answer.includes('\n')||extra){flush();sections.push('<section class="qw-print-section qw-answer-long" data-task="'+(i+1)+'"><article class="qw-paper-task qw-compact-entry"><header><b class="qw-print-number">'+(i+1)+'.</b></header><div class="qw-task-flow"><div class="qw-task-text" data-answer-number="'+(i+1)+'">'+qwContentHTML(q.answer.trim()||'—')+extra+'</div></div></article></section>');}
  else{short.push({q,number:i+1});if(short.length===columns)flush();}
 });flush();return sections.join('');
}
function qwPrintDocumentHTML(project,teacher=false,options={answers:true,criteria:true,comments:true}){
 const d=qwValidate(project),format=options.format||(teacher?'answers':d.layout),exam=format==='exam',subject=QW_SUBJECTS[d.subject];
 if(!['worksheet','exam','compact','practice','answers','booklet'].includes(format))throw Error('Неизвестный формат PDF');
 if(!d.tasks.length)throw Error('Добавьте задания в работу');
 const p=qwPrintSettings(d.printSettings||{}),showTitle=p.showTitle??(d.title!=='Новая работа'),showMeta=p.showMeta??format!=='booklet',showVariant=p.showVariant!==false;
 const heading=p.titleText===undefined?d.title:p.titleText;
 const sectionTitle=q=>q.part&&!/^Часть \d+$/.test(q.part)?q.part:q.topic||q.part;
 let previousTopic='';const topics=new Set(d.tasks.map(sectionTitle).filter(Boolean));
 const tasks=format==='answers'?qwAnswerSections(d,options):d.tasks.map((q,i)=>{
  if(!q.prompt.trim())throw Error('Заполните условие задания '+(i+1));
  const topic=sectionTitle(q),showTopic=format==='compact'&&p.topicHeadings&&topic!==previousTopic&&(topics.size>1||topic&&!/^Часть \d+$/.test(topic));previousTopic=topic;
  return '<section class="qw-print-section" data-task="'+(i+1)+'" data-explicit-break="'+(q.pageBreak&&i>0)+'">'+(showTopic?'<h2 class="qw-topic-title">'+qwEsc(topic)+'</h2>':'')+qwTaskPreview(q,i,format,true,d.printSettings)+'</section>';
 }).join('');
 const printTheme=qwPrintTheme({theme:p.theme??(format==='booklet'?'academic':''),monochrome:p.monochrome??false,...options}),styles=qwPrintStyles(p.orientation??'portrait','spread');
 const meta=showMeta?(qwEsc(subject)+(d.grade?' · '+qwEsc(d.grade)+' класс':'')+(format!=='booklet'&&showVariant&&d.variant?' · Вариант '+qwEsc(d.variant):'')+(format==='answers'?' · Ключ ответов':'')):'';
 const brandMarkup=printTheme.id?'<div class="qw-print-brand qw-booklet-brand" title="QX | Квант Икс" aria-label="QX | Квант Икс"><span class="qw-qx-lettering">QX | Квант Икс</span></div>':'';
 const header=brandMarkup+
  (showTitle&&heading.trim()?'<h1 class="qw-print-title">'+(format==='answers'?'Ответы — ':'')+qwEsc(heading)+'</h1>':'')+
  (showMeta&&d.topic&&d.topic!==heading?'<p class="qw-print-topic">'+qwEsc(d.topic)+'</p>':'')+
  (format==='booklet'&&showVariant&&d.variant?'<p class="qw-booklet-variant">Вариант №'+qwEsc(d.variant)+'</p>':'')+
  (meta?'<div class="qw-print-meta">'+meta+'</div>':'')+
  (format==='worksheet'&&d.instructions?'<p class="qw-print-intro">'+qwContentHTML(d.instructions)+'</p>':'');
 const css=(d.printSettings?'--qw-print-size:'+p.fontPt+'pt;':'')+'--qw-title-size:'+(p.titlePt??14)+'pt;--qw-title-color:'+(p.titleColor??'#111111')+
  ';--qw-body-color:'+(p.bodyColor??'#111111')+';--qw-title-align:'+(p.titleAlign??'center')+';';
 return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>'+qwEsc(d.title)+
  '</title><style>'+styles+'</style></head><body style="'+css+'" data-qw-font="'+(p.bodyFont??(format==='booklet'?'serif':'sans'))+'" data-qw-title-custom="'+(['titlePt','titleFont','titleColor','titleAlign'].some(k=>p[k]!==undefined))+'" data-qw-math-custom="'+(p.bodyFont!==undefined)+'" data-qw-title-font="'+(p.titleFont??'sans')+
  '" data-qw-show-pages="'+(p.showPageNumbers!==false)+'" data-qw-orientation="'+(p.orientation??'portrait')+'" data-qw-landscape-layout="spread" '+(printTheme.id?'data-qw-theme="'+printTheme.id+'" ':'')+'data-qw-monochrome="'+printTheme.monochrome+
  '" data-qw-format="'+format+'" data-practice-count="'+(d.practice?.perPage||2)+'" data-practice-grid="'+(d.practice?.grid||'fine')+'" class="'+(exam?'qw-print-exam':'qw-print-worksheet')+
  '"><main class="qw-print-document"><div class="qw-print-source"><header class="qw-print-header">'+header+'</header>'+tasks+'</div></main><script>'+qwMeasureSVGInk.toString()+';'+qwPreparePrintDocument.toString()+';window.qwPrintReady=qwPreparePrintDocument().catch(error=>{window.__qwPrintError=error.message;document.body.textContent=error.message;document.body.className="qw-print-error";return null;});</script></body></html>';
}
function qwPrintTextPDF(teacher=false,options){
 let html;try{html=qwPrintDocumentHTML(qwDoc,teacher,options);}catch(e){status('PDF: '+e.message,true);return;}
 const frame=document.createElement('iframe');frame.title='Подготовка PDF';
 frame.style.cssText='position:fixed;left:-9999px;top:0;width:794px;height:1123px;opacity:0;pointer-events:none';
 document.body.append(frame);
 frame.onload=async()=>{
  try{const win=frame.contentWindow;if(!win.qwPrintReady)return;const prepared=win.document;await win.qwPrintReady;if(frame.contentDocument!==prepared)return;if(win.__qwPrintError)throw Error(win.__qwPrintError);win.addEventListener('afterprint',()=>frame.remove(),{once:true});
   win.focus();win.print();status('В окне печати выберите «Сохранить как PDF»');}
  catch(e){status('PDF: '+e.message,true);frame.remove();}
 };
 frame.srcdoc=html;
}
function qwSaveFile(){try{const data=qwValidate(qwDoc);download((typeof safeFile==='function'?safeFile(data.title):'Работа')+'.qwork',JSON.stringify(data,null,2),'application/json');qwExported=JSON.stringify(qwDoc);qwPersist();status('QWORK подготовлен для скачивания');}catch(e){status(e.message,true);}}
async function qwExportPDF(teacher=false,options){if(teacher||['compact','practice','booklet','worksheet','exam'].includes(qwDoc.layout)){qwPrintTextPDF(teacher,options);return;}if(qwBusy)return;qwBusy=true;try{status('Подготовка страниц PDF…');const bytes=await qwPDFBytes(qwDoc,false,options);download(safeFile(qwDoc.title)+'_ученик.pdf',bytes,'application/pdf');status('PDF подготовлен для скачивания');}catch(e){status('PDF: '+e.message,true);}finally{qwBusy=false;}}
async function qwPreview(output='tasks'){
 const key=output==='answers',prefs=qwPrintSettings(qwDoc.printSettings||{}),hasAnswers=qwDoc.tasks.some(q=>q.answer.trim());
 const selected=(name,on)=>'<label class="qw-check"><input type="checkbox" data-print-setting="'+name+'" '+(on?'checked':'')+'>'+({
  showTitle:'Добавить заголовок',showMeta:'Предмет и класс',showVariant:'Номер варианта',
  showPageNumbers:'Номера страниц',topicHeadings:'Заголовки тем',monochrome:'Чёрно-белый PDF'
 }[name]||name)+'</label>';
 const label=(title,control)=>'<label class="qw-pdf-field"><span>'+title+'</span>'+control+'</label>';
 const opt=(items,current)=>qwOptions(items,current);
 const design='<aside class="qw-pdf-design" aria-label="Оформление PDF">'+
  '<h3>Заголовок</h3>'+selected('showTitle',prefs.showTitle??qwDoc.title!=='Новая работа')+
  '<div id="qw-title-controls" class="qw-design-fields">'+
   label('Текст заголовка','<input type="text" data-print-setting="titleText" maxlength="160" placeholder="Введите заголовок" value="'+qwEsc(prefs.titleText??(qwDoc.title==='Новая работа'?'':qwDoc.title))+'">')+
   label('Шрифт заголовка','<select data-print-setting="titleFont">'+opt([['sans','Без засечек'],['serif','Книжный']],prefs.titleFont??'sans')+'</select>')+
   label('Размер заголовка, пт','<input type="number" data-print-setting="titlePt" min="11" max="26" step="1" value="'+(prefs.titlePt??14)+'">')+
   label('Выравнивание','<select data-print-setting="titleAlign">'+opt([['left','Слева'],['center','По центру'],['right','Справа']],prefs.titleAlign??'center')+'</select>')+
   label('Цвет заголовка','<input type="color" data-print-setting="titleColor" value="'+(prefs.titleColor??'#111111')+'">')+
  '</div><h3>Текст и страница</h3>'+
  label('Шрифт заданий','<select data-print-setting="bodyFont">'+opt([['serif','Книжный'],['sans','Без засечек']],prefs.bodyFont??(qwDoc.layout==='booklet'?'serif':'sans'))+'</select>')+
  label('Размер текста, пт','<input type="number" data-print-setting="fontPt" min="9" max="12" step="0.5" value="'+prefs.fontPt+'">')+
  label('Ориентация A4','<select data-print-setting="orientation">'+opt([['portrait','Книжная (вертикальная)'],['landscape','Альбомная (горизонтальная)']],prefs.orientation??'portrait')+'</select>')+

  label('Цвет текста','<input type="color" data-print-setting="bodyColor" value="'+(prefs.bodyColor??'#111111')+'">')+
  label('Рисунки','<select data-print-setting="figurePosition">'+opt([['auto','Автоматически'],['right','Справа'],['below','Под условием']],prefs.figurePosition)+'</select>')+
  selected('showMeta',prefs.showMeta??qwDoc.layout!=='booklet')+
  selected('showVariant',prefs.showVariant!==false)+selected('showPageNumbers',prefs.showPageNumbers!==false)+
  selected('topicHeadings',prefs.topicHeadings)+
  '<div data-practice-controls>'+qwPracticeControls(qwDoc.practice)+'</div>'+
  '<h3>Оформление QX</h3>'+
  label('Фирменный уголок','<select data-print-setting="theme">'+opt([['','Без бренда'],['academic','QX | Квант Икс']],prefs.theme===undefined?(qwDoc.layout==='booklet'?'academic':''):prefs.theme?'academic':'')+'</select>')+
  selected('monochrome',prefs.monochrome===true)+
  '</aside>';
 const answers='<div class="qw-row qw-preview-options">'+
  ['includeCriteria','includeComments'].map((k,i)=>'<label class="qw-check"><input type="checkbox" data-key-option="'+k+'">'+['Критерии','Комментарии'][i]+'</label>').join('')+'</div>';
 const d=qwDialog(key?'Отдельные ответы PDF':'Макет и экспорт PDF',
  '<div class="qw-pdf-controls">'+(key?answers:qwLayoutCards(qwDoc.layout))+'</div>'+
  '<div class="qw-pdf-workspace">'+design+
  '<div id="qw-pages"><iframe id="qw-print-preview-frame" title="Макет PDF" loading="eager"></iframe></div></div>'+
  '<p id="qw-label-warnings" class="qw-error" hidden></p>',
  '<output id="qw-page-count" role="status">Расчёт страниц…</output>'+
  (key?qwButton('preview-tasks','К макету'):qwButton('preview-answers','Скачать ответы PDF',hasAnswers?'':'disabled'))+
  qwButton('preview-pdf',key?'Скачать ответы PDF':'Скачать PDF','class="qw-primary"'));
 d.classList.add('qw-print-preview-dialog','qw-print-design-dialog');
 const preview=d.querySelector('#qw-print-preview-frame'),printButton=d.querySelector('[data-qw-action="preview-pdf"]');
 const options=()=>({format:key?'answers':qwDoc.layout,
  ...Object.fromEntries([...d.querySelectorAll('[data-key-option]')].map(e=>[e.dataset.keyOption,e.checked]))});
 let renderRevision=0,typingTimer=0;
 const refresh=()=>{
  const revision=++renderRevision;
  printButton.disabled=true;d.querySelector('#qw-pages').setAttribute('aria-busy','true');
  d.querySelector('#qw-page-count').textContent='Расчёт страниц…';
  const practice=d.querySelector('[data-practice-controls]');if(practice)practice.hidden=qwDoc.layout!=='practice';

  const title=d.querySelector('#qw-title-controls');if(title)title.hidden=!d.querySelector('[data-print-setting="showTitle"]').checked;
  preview.onload=async()=>{
   const win=preview.contentWindow,atLoad=win.document;
   if(atLoad.documentElement.dataset.qwRender!==String(revision)||!win.qwPrintReady)return;
   await win.qwPrintReady;
   if(revision!==renderRevision||preview.contentDocument!==atLoad)return;
   preview.dataset.ready=String(revision);d.querySelector('#qw-pages').setAttribute('aria-busy','false');
   printButton.disabled=!!win.__qwPrintError;
   d.querySelector('#qw-page-count').textContent=win.__qwPrintError?'Ошибка: '+win.__qwPrintError:win.__qwPrintLayout.layout==='spread'?'Листов A4: '+win.__qwPrintLayout.sheets+' · полос: '+win.__qwPrintLayout.pages.length:'Страниц: '+win.__qwPrintLayout.pages.length;
   const n=win.document.querySelectorAll('[data-label-conflict="true"]').length,w=d.querySelector('#qw-label-warnings');
   w.hidden=!n;w.textContent=n?'Пересечение подписей на рисунке: '+n:'';
  };
  try{preview.srcdoc=qwPrintDocumentHTML(qwDoc,false,options()).replace('<html lang="ru">','<html lang="ru" data-qw-render="'+revision+'">');}
  catch(error){preview.srcdoc='<p role="alert">'+qwEsc(error.message)+'</p>';d.querySelector('#qw-page-count').textContent=error.message;d.querySelector('#qw-pages').setAttribute('aria-busy','false');}
 };
 function commit(e){
  const layout=d.querySelector('[name="qw-pdf-layout"]:checked');
  const next=qwPrintSettings(qwDoc.printSettings||{});
  if(e?.dataset?.printSetting){
   const field=e.dataset.printSetting;
   next[field]=e.type==='checkbox'?e.checked:e.type==='number'?Number(e.value):e.value;
   if(field==='titleText'&&e.value.trim()){next.showTitle=true;d.querySelector('[data-print-setting="showTitle"]').checked=true;}
  }
  try{
   const normalized=qwPrintSettings(next);
   qwRemember();
   if(layout)qwDoc.layout=layout.value;
   if(e?.dataset?.practice)qwDoc.practice={perPage:Number(d.querySelector('[data-practice="perPage"]').value),grid:d.querySelector('[data-practice="grid"]').value};
   qwDoc.printSettings=normalized;qwPersist();qwRender();refresh();
  }catch(error){d.querySelector('#qw-page-count').textContent=error.message;}
 }
 d.querySelectorAll('[name="qw-pdf-layout"],[data-practice],[data-print-setting]').forEach(e=>{
  e.addEventListener('change',()=>{clearTimeout(typingTimer);commit(e);});
  if(e.matches('[data-print-setting="titleText"]'))e.addEventListener('input',()=>{clearTimeout(typingTimer);typingTimer=setTimeout(()=>commit(e),280);});
 });
 d.querySelectorAll('[data-key-option]').forEach(e=>e.addEventListener('change',refresh));
 const answersBtn=d.querySelector('[data-qw-action="preview-answers"]');if(answersBtn)answersBtn.onclick=()=>{d.close();qwPreview('answers');};
 const tasksBtn=d.querySelector('[data-qw-action="preview-tasks"]');if(tasksBtn)tasksBtn.onclick=()=>{d.close();qwPreview();};
 printButton.onclick=()=>qwPrintTextPDF(false,options());
 refresh();
}
const QW_BANK_NUMBER_KEY='quantum-office.work-bank.number-sequence.v1';
function qwBankNumber(value){
 return Number.isInteger(value)&&value>0&&value<=99999?value:0;
}
function qwBankAllocateNumber(items=[]){
 const used=new Set(items.map(x=>qwBankNumber(x.bankNumber)).filter(Boolean));
 const last=Number(localStorage.getItem(QW_BANK_NUMBER_KEY))||0;
 let next=Math.max(last,...used,0)+1;
 while(used.has(next)&&next<=99999)next++;
 if(next>99999)throw Error('Диапазон номеров банка исчерпан (99999)');
 localStorage.setItem(QW_BANK_NUMBER_KEY,String(next));
 return next;
}
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
  difficulty:['basic','advanced','high'].includes(x.difficulty)?x.difficulty:'',task};
}
function qwBankRead(){
 const raw=localStorage.getItem(QW_BANK_KEY);if(!raw)return [];
 const xs=JSON.parse(raw);if(!Array.isArray(xs)||xs.length>500)throw Error('Повреждён банк заданий');
 const entries=xs.map(qwBankNormalize),seen=new Set();let changed=false;
 for(const entry of entries){
  if(!entry.bankNumber||seen.has(entry.bankNumber)){
   entry.bankNumber=qwBankAllocateNumber(entries);changed=true;
  }
  seen.add(entry.bankNumber);
 }
 if(changed)localStorage.setItem(QW_BANK_KEY,JSON.stringify(entries));
 return entries;
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
 d.querySelector('[data-qw-action="confirm-bank-save"]').onclick=()=>{
  try{
   const xs=qwBankRead();if(xs.length>=500)throw Error('Достигнут лимит 500 заданий. Создайте резервную копию банка.');
   const get=k=>d.querySelector('#qw-bank-new-'+k).value;
   const metadata={subject:get('subject'),grade:get('grade').trim().slice(0,24),exam:get('exam'),
    topic:get('topic').trim().slice(0,120),subtopic:get('subtopic').trim().slice(0,120),origin:get('origin'),
    year:get('year').trim(),part:get('part'),slot:get('slot').trim(),difficulty:get('difficulty')};
   if(metadata.year&&!/^(19|20)\d{2}$/.test(metadata.year))throw Error('Год должен быть четырёхзначным');
   if(metadata.slot&&!/^([1-9]|[1-3]\d|40)$/.test(metadata.slot))throw Error('Номер задания: 1–40');
   const task=structuredClone(q);Object.assign(task,{grade:metadata.grade,exam:metadata.exam,
    topic:metadata.topic,subtopic:metadata.subtopic,origin:metadata.origin});
   xs.push(qwBankNormalize({id:qwId(),bankNumber:qwBankAllocateNumber(xs),...metadata,task}));
   localStorage.setItem(QW_BANK_KEY,JSON.stringify(xs));
   d.close();status('Задание сохранено в банке');
  }catch(e){status('Банк: '+e.message,true);}
 };
}
/* TASK164: Markdown editing of existing bank fields; QWBANK schema stays unchanged. */
function qwBankRichField(key,title,value,rows=5){
 const tools=[['bold','Ж','Жирный'],['italic','К','Курсив'],['heading','H3','Заголовок'],['list','•','Список'],['numbered','1.','Нумерация'],['quote','❝','Цитата'],['math','ƒx','Формула'],['table','▦','Таблица']];
 const buttons=tools.map(([cmd,label,hint])=>'<button type="button" data-bank-format="'+cmd+'" data-bank-format-field="'+key+'" title="'+hint+'" aria-label="'+hint+'">'+label+'</button>').join('');
 const extra=key==='comment'?'<button type="button" data-bank-format="ege" data-bank-format-field="comment">Шаблон решения</button>':key==='criteria'?'<button type="button" data-bank-format="rubric" data-bank-format-field="criteria">Шаблон критериев</button>':'';
 return '<div class="qw-bank-rich-editor" data-bank-rich="'+key+'">'+
 '<div class="qw-bank-rich-head"><strong>'+title+'</strong><button type="button" data-bank-preview-toggle="'+key+'" aria-pressed="false">Предпросмотр</button></div>'+
 '<div class="qw-bank-rich-tools">'+buttons+extra+'</div>'+
 '<textarea data-bank-task-field="'+key+'" rows="'+rows+'" maxlength="16000" spellcheck="true" aria-label="'+title+'">'+qwEsc(value)+'</textarea>'+
 '<div class="qw-bank-rich-render qw-rich" data-bank-render="'+key+'" hidden></div>'+
 '<small class="qw-bank-rich-hint">Markdown: **жирный**, *курсив*, заголовки, списки, таблицы, формулы.</small></div>';
}
function qwBankInsertMarkup(input,kind){
 if(!input||input.disabled)return;
 const from=input.selectionStart,to=input.selectionEnd,selected=input.value.slice(from,to),value=selected||'текст';
 let content='';
 if(kind==='bold')content='**'+value+'**';
 else if(kind==='italic')content='*'+value+'*';
 else if(kind==='math')content='\\('+ (selected||'F=ma') +'\\)';
 else if(kind==='heading')content='### '+(selected||'Название раздела');
 else if(kind==='quote')content='> '+(selected||'Пояснение');
 else if(kind==='list')content=(selected||'Первый пункт').split('\n').map(x=>'- '+x).join('\n');
 else if(kind==='numbered')content=(selected||'Первый шаг').split('\n').map((x,i)=>(i+1)+'. '+x).join('\n');
 else if(kind==='table')content='| Величина | Значение |\n| --- | --- |\n| '+(selected||'Название')+' | Значение |';
 else if(kind==='ege')content='### Физическая модель и обоснование\n[Объясните применимость физических законов.]\n\n### Решение\n1. [Запишите законы и формулы.]\n2. [Выполните преобразования.]\n3. [Подставьте значения с единицами.]';
 else if(kind==='rubric')content='### Критерии для этой задачи\n| Элемент решения | Баллы |\n| --- | --- |\n| Обоснование физических законов | — |\n| Преобразования и вычисления | — |\n| Результат и единица измерения | — |\n\n> Сверьте с критериями конкретного задания ЕГЭ.';
 else return;
 if((kind==='ege'||kind==='rubric')&&input.value.trim())content='\n\n'+content;
 input.setRangeText(content,from,to,'end');input.focus();
 input.dispatchEvent(new Event('input',{bubbles:true}));
}
/* TASK156: transactional editing of a bank item, independent of the open QWORK. */
function qwBankEdit(id,draft=null,returnFilters={}){
 const creating=id===null;
 let stored;
 if(!creating){
  try{stored=qwBankRead().find(x=>x.id===id);}catch(error){status(error.message,true);return;}
  if(!stored){status('Задание больше не найдено в банке',true);return;}
 }
 draft??=creating
  ?{id:qwId(),bankNumber:0,subject:'physics',grade:'11',exam:'ege',year:'',part:'1',slot:'',
    difficulty:'',topic:'',subtopic:'',origin:'adapted',task:qwTask('short')}
  :structuredClone(stored);
 const titles={subject:'Предмет',exam:'Экзамен',part:'Часть',difficulty:'Сложность',origin:'Происхождение'};
 const opts=(k,items)=>'<label>'+(titles[k]||k)+'<select data-bank-edit-field="'+k+'">'+qwOptions(items,draft[k])+'</select></label>';
 const field=(k,title,max=120)=>'<label>'+title+'<input data-bank-edit-field="'+k+'" maxlength="'+max+'" value="'+qwEsc(draft[k]||'')+'"></label>';
 const task=draft.task;
 const taskFields='<div class="qw-bank-edit-fields">'+
  '<label>Тип<select data-bank-task-field="type">'+qwOptions(Object.entries(QW_TYPES),task.type)+'</select></label>'+
  qwBankRichField('prompt','Условие задачи',task.prompt,7)+
  '<label data-bank-choices-wrap '+(task.type==='choice'?'':'hidden')+'>Варианты ответа, по одному в строке<textarea data-bank-choices rows="4" maxlength="3600">'+qwEsc((task.choices||[]).join('\n'))+'</textarea></label>'+ 
  '<label>Ответ<textarea data-bank-task-field="answer" rows="2" maxlength="8000">'+qwEsc(task.answer)+'</textarea></label>'+
  qwBankRichField('criteria','Критерии оценивания',task.criteria,4)+
  qwBankRichField('comment','Подробное решение',task.comment,8)+
  '<label class="qw-bank-choice-field">Иллюстрация<select data-bank-task-field="figure">'+qwOptions([['none','Без рисунка'],['graph','График (редактируемый)'],['diagram','Схема (редактируемая)'],['image','Изображение']],task.figure)+'</select></label>'+
  '<label class="qw-check"><input type="checkbox" data-bank-task-field="answerVisible" '+(task.answerVisible?'checked':'')+'>Поле для краткого ответа в PDF</label>'+
  '<div class="qw-bank-edit-visual-actions">'+
    '<button type="button" data-bank-visual="graph">Редактировать график</button>'+
    '<button type="button" data-bank-visual="diagram">Редактировать схему</button>'+
    '<button type="button" data-bank-visual="image">Заменить изображение</button>'+
    '<input type="file" id="qw-bank-edit-image" accept="image/png,image/jpeg,image/webp" hidden>'+
  '</div>'+

 '</div>';
 const category='<div class="qw-bank-edit-categories">'+
  opts('subject',Object.entries(QW_SUBJECTS))+
  field('grade','Класс',24)+
  opts('exam',[['general','Практика'],['oge','ОГЭ'],['ege','ЕГЭ']])+
  field('year','Год',4)+
  opts('part',[['','Без части'],['1','Часть 1'],['2','Часть 2']])+
  field('slot','Номер задания',2)+
  opts('difficulty',[['','Уровень не задан'],['basic','Базовый'],['advanced','Повышенный'],['high','Высокий']])+
  field('topic','Тема')+field('subtopic','Подтема')+
  opts('origin',[['original','Авторская'],['adapted','Авторский аналог'],['generated','С помощью ИИ']])+
 '</div>';
 const d=qwDialog(creating?'Новое задание в банке':'Редактировать задание в банке',
  '<div class="qw-bank-edit-layout">'+
   '<section class="qw-bank-edit-main"><h3>Содержание</h3>'+taskFields+'</section>'+
   '<aside class="qw-bank-edit-side"><h3>Категории</h3>'+category+'<div class="qw-bank-edit-preview-side"><h3>Предпросмотр задачи</h3><div id="qw-bank-edit-preview" class="qw-selected-preview" aria-label="Предпросмотр задания"></div></div></aside>'+
  '</div><p id="qw-bank-edit-error" role="alert" class="qw-error" hidden></p>',
  qwButton('bank-edit-back','В банк')+qwButton('bank-edit-save','Сохранить изменения','class="qw-primary"'));
 d.classList.add('qw-bank-edit-dialog');
 const error=d.querySelector('#qw-bank-edit-error');
 function showError(message){error.hidden=!message;error.textContent=message||'';}
 function collect(){
  for(const el of d.querySelectorAll('[data-bank-edit-field]'))draft[el.dataset.bankEditField]=el.value.trim();
  for(const el of d.querySelectorAll('[data-bank-task-field]')){
   const k=el.dataset.bankTaskField;
   task[k]=el.type==='checkbox'?el.checked:el.value;
  }
  const choicesControl=d.querySelector('[data-bank-choices]'),choicesWrap=d.querySelector('[data-bank-choices-wrap]');
  const isChoice=task.type==='choice';
  choicesWrap.hidden=!isChoice;
  if(isChoice)task.choices=choicesControl.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  task.grade=draft.grade;task.exam=draft.exam;task.topic=draft.topic;
  task.subtopic=draft.subtopic;task.origin=draft.origin;
  if(draft.part)task.part='Часть '+draft.part;
 }
 function preview(){
  try{
   d.querySelector('#qw-bank-edit-preview').innerHTML=qwTaskPreview({...task,answerVisible:false,solutionVisible:false},Number(draft.slot||1)-1,'worksheet',false,null,true);
   for(const key of ['prompt','comment','criteria']){
    const area=d.querySelector('[data-bank-render="'+key+'"]');
    if(area)area.innerHTML=qwRichMarkdownHTML(task[key]||'');
   }
  }
  catch(e){d.querySelector('#qw-bank-edit-preview').textContent='Предпросмотр: '+e.message;}
 }
 d.addEventListener('input',event=>{
  if(event.target.matches('[data-bank-edit-field],[data-bank-task-field],[data-bank-choices]')){collect();preview();}
 });
 d.addEventListener('change',event=>{
  if(event.target.matches('[data-bank-edit-field],[data-bank-task-field],[data-bank-choices]')){collect();preview();}
 });
 d.addEventListener('click',event=>{
  const action=event.target.closest('[data-bank-format]');
  if(action){qwBankInsertMarkup(d.querySelector('[data-bank-task-field="'+action.dataset.bankFormatField+'"]'),action.dataset.bankFormat);return;}
  const toggle=event.target.closest('[data-bank-preview-toggle]');
  if(!toggle)return;
  collect();preview();
  const key=toggle.dataset.bankPreviewToggle,block=d.querySelector('[data-bank-rich="'+key+'"]');
  const editing=block.dataset.mode==='preview';
  block.dataset.mode=editing?'edit':'preview';
  block.querySelector('textarea').hidden=!editing;
  block.querySelector('.qw-bank-rich-tools').hidden=!editing;
  block.querySelector('[data-bank-render]').hidden=editing;
  toggle.textContent=editing?'Предпросмотр':'Редактировать';
  toggle.setAttribute('aria-pressed',String(!editing));
 });
 d.querySelectorAll('[data-bank-visual]').forEach(button=>button.onclick=()=>{
  collect();
  const kind=button.dataset.bankVisual;
  if(kind==='image'){d.querySelector('#qw-bank-edit-image').click();return;}
  qwVisualEditor(kind,task,(updatedKind,validated)=>{
   task[updatedKind]=validated;task.figure=updatedKind;
   qwBankEdit(id,draft,returnFilters);
  },()=>qwBankEdit(id,draft,returnFilters));
 });
 d.querySelector('#qw-bank-edit-image').onchange=async(event)=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  try{
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>4_000_000)throw Error('Изображение: PNG/JPEG/WebP, не более 4 МБ');
   const data=await new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Файл не прочитан'));reader.readAsDataURL(file);
   });
   if(typeof data!=='string'||data.length>6_000_000)throw Error('Изображение слишком велико');
   task.image=data;task.figure='image';d.querySelector('[data-bank-task-field="figure"]').value='image';preview();showError('');
  }catch(e){showError(e.message);}
 };
 const back=()=>{d.close();qwBank(returnFilters);};
 d.querySelector('[data-qw-close]').onclick=back;
 d.querySelector('[data-qw-action="bank-edit-back"]').onclick=back;
 d.querySelector('[data-qw-action="bank-edit-save"]').onclick=()=>{
  try{
   collect();if(!task.prompt.trim())throw Error('Условие задания не может быть пустым');
   if(draft.year&&!/^(19|20)\d{2}$/.test(draft.year))throw Error('Введите год из четырёх цифр');
   if(draft.slot&&!/^([1-9]|[1-3]\d|40)$/.test(draft.slot))throw Error('Номер задания: от 1 до 40');
   const candidate=qwBankNormalize({...draft,id:creating?draft.id:id,task});
   const all=qwBankRead();
   if(creating){
    if(all.length>=500)throw Error('Локальный банк содержит 500 заданий. Экспортируйте QWBANK перед расширением.');
    candidate.bankNumber=qwBankAllocateNumber(all);
    all.push(candidate);
   }else{
    const index=all.findIndex(x=>x.id===id);
    if(index<0)throw Error('Запись удалена из банка в другом окне');
    all[index]=candidate;
   }
   localStorage.setItem(QW_BANK_KEY,JSON.stringify(all));
   d.close();qwBank({...returnFilters,__view:candidate.id});
   status(creating?'Задание добавлено в банк':'Задание сохранено в банке');
  }catch(e){showError('Не удалось сохранить: '+e.message);}
 };
 preview();
}
function qwBank(previousFilters={}){
 let xs;try{xs=qwBankRead();}catch(e){status(e.message,true);return;}
 const selected=new Map((previousFilters.__selected||[]).map(id=>[id,true])),diagnostic=typeof qdBankRead==='function'?qdBankRead():[];
 let activeId=previousFilters.__view||xs[0]?.id||'';
 const filters='<div class="qw-bank-catalogue"><section class="qw-bank-catalogue-results"><div id="qw-bank-filters" class="qw-bank-filter-panel">'+
  '<label>Поиск<input id="qw-bank-search" type="search" placeholder="Номер, условие, ответ или тема"></label>'+
  '<label>Предмет<select id="qw-bank-subject">'+qwOptions([['all','Все'],['physics','Физика'],['math','Математика'],['geometry','Геометрия'],['algebra','Алгебра']],'all')+'</select></label>'+
  '<label>Экзамен<select id="qw-bank-exam">'+qwOptions([['all','Все'],['general','Практика'],['oge','ОГЭ'],['ege','ЕГЭ']],'all')+'</select></label>'+
  '<label>Тема<select id="qw-bank-topic"></select></label>'+
  '<details class="qw-bank-extra-filters"><summary>Дополнительные фильтры</summary><div class="qw-bank-extra-grid">'+
   '<label>Класс<select id="qw-bank-grade">'+qwOptions([['all','Все'],...['5','6','7','8','9','10','11'].map(v=>[v,v])],'all')+'</select></label>'+
   '<label>Год<select id="qw-bank-year"></select></label>'+
   '<label>Часть<select id="qw-bank-part">'+qwOptions([['all','Все'],['1','Часть 1'],['2','Часть 2']],'all')+'</select></label>'+
   '<label>№ задания<select id="qw-bank-slot">'+qwOptions([['all','Все'],...Array.from({length:40},(_,i)=>[String(i+1),String(i+1)])],'all')+'</select></label>'+
   '<label>Уровень<select id="qw-bank-difficulty">'+qwOptions([['all','Все'],['basic','Базовый'],['advanced','Повышенный'],['high','Высокий']],'all')+'</select></label>'+
   '<label>Тип<select id="qw-bank-type">'+qwOptions([['all','Все'],...Object.entries(QW_TYPES)],'all')+'</select></label>'+
   '<label>Подтема<select id="qw-bank-subtopic"></select></label>'+
   '<label>Происхождение<select id="qw-bank-origin">'+qwOptions([['all','Все'],['original','Авторская'],['adapted','Аналог'],['generated','С помощью ИИ']],'all')+'</select></label>'+
  '</div></details>'+
  '</div><div class="qw-bank-selection-line"><output id="qw-bank-count" role="status"></output><strong id="qw-bank-selected-count">Выбрано: 0</strong></div><div id="qw-bank-list" class="qw-bank-catalogue-list"></div></section>'+
  '<section class="qw-bank-catalogue-preview" aria-label="Подробный просмотр задания"><div id="qw-bank-preview"></div></section></div>';
 const d=qwDialog('Банк заданий',filters+'<input type="file" id="qw-bank-import-file" accept=".qwbank,application/json" hidden>',
  qwButton('bank-new','+ Новая задача','class="qw-primary"')+qwButton('bank-export','Экспорт')+qwButton('bank-import','Импорт')+
  qwButton('bank-add-selection','Добавить выбранные','disabled')+
  qwButton('bank-assemble','Собрать вариант → PDF','class="qw-primary" disabled'));
 d.classList.add('qw-bank-assemble-dialog');
 const get=k=>d.querySelector('#qw-bank-'+k),pick=k=>get(k).value;
 function fillYears(){
  const old=pick('year');
  const years=[...new Set([...xs.map(x=>x.year).filter(Boolean),'2018'])].sort((a,b)=>Number(b)-Number(a));
  get('year').innerHTML=qwOptions([['all','Все годы'],...years.map(v=>[v,v])],years.includes(old)?old:'all');
 }
 function fillCategories(){
  for(const key of ['topic','subtopic']){
   const control=get(key),old=control.value||'all';
   const names=[...new Set(xs.map(x=>x[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
   control.innerHTML=qwOptions([['all',key==='topic'?'Все темы':'Все подтемы'],...names.map(name=>[name,name])],names.includes(old)?old:'all');
  }
 }
 const summary=value=>String(value||'').replace(/^\s{0,3}#{1,4}\s+/gm,'').replace(/\*\*|__|~~|`/g,'').replace(/\\\((.*?)\\\)/g,(_,inner)=>inner).replace(/\s+/g,' ').trim().slice(0,185);
 const signature=x=>[x.subject,x.grade,x.exam,x.year,x.part,x.slot,x.topic,x.subtopic,x.task.prompt.trim().toLocaleLowerCase('ru-RU')].join('|');
 const markSelection=()=>{
  d.querySelector('#qw-bank-selected-count').textContent='Выбрано: '+selected.size;
  for(const k of ['bank-add-selection','bank-assemble'])d.querySelector('[data-qw-action="'+k+'"]').disabled=!selected.size;
 };
 function showPreview(){
  const entry=xs.find(x=>x.id===activeId),host=d.querySelector('#qw-bank-preview');
  for(const row of d.querySelectorAll('[data-bank-entry]'))
   row.classList.toggle('is-active',row.dataset.bankEntry===activeId);
  if(!entry){
   host.innerHTML='<div class="qw-bank-preview-placeholder">Выберите задание в списке, чтобы открыть условие, рисунки и решение.</div>';
   return;
  }
  const task={...entry.task,answerVisible:false,solutionVisible:false};
  const number=String(entry.bankNumber).padStart(5,'0');
  const subject=QW_SUBJECTS[entry.subject]||entry.subject;
  const designation=(entry.exam==='ege'?'ЕГЭ':entry.exam==='oge'?'ОГЭ':'Практика')+
   (entry.grade?' · '+entry.grade+' класс':'');
  const paper=qwTaskPreview(task,Math.max(0,(Number(entry.slot)||1)-1),'worksheet',false,null,true);
  const answer=entry.task.answer?.trim()?qwRichMarkdownHTML(entry.task.answer):'<p>Ответ не указан.</p>';
  const details=entry.task.comment?.trim()?qwRichMarkdownHTML(entry.task.comment):'<p>Решение ещё не записано.</p>';
  const criteria=entry.task.criteria?.trim()?qwRichMarkdownHTML(entry.task.criteria):'<p>Критерии ещё не указаны.</p>';
  const solutionTitle=/^\s*#{1,4}\s*Решение\b/i.test(entry.task.comment||'')?'':'<h3>Решение</h3>';
  host.innerHTML='<div class="qw-bank-preview-toolbar"><div class="qw-bank-preview-meta">'+
   '<strong>№ '+number+'</strong><span>'+qwEsc(subject+' · '+designation)+'</span>'+
   (entry.topic?'<small>'+qwEsc(entry.topic+(entry.subtopic?' / '+entry.subtopic:''))+'</small>':'')+'</div>'+
   '<div class="qw-bank-preview-actions"><button type="button" data-bank-edit="'+qwEsc(entry.id)+'">Редактировать</button>'+
   '<button type="button" data-bank-enlarge aria-pressed="false">Увеличить</button></div></div>'+
   '<div class="qw-bank-video-canvas" aria-label="Просмотр условия задачи">'+
    '<div class="qw-bank-video-id">Тип '+qwEsc(entry.slot||'—')+' № '+number+'</div>'+
    paper+'</div>'+
   '<details class="qw-bank-solution"><summary>Ответ и решение</summary>'+
    '<div class="qw-bank-solution-body qw-rich"><section>'+solutionTitle+details+'</section>'+
    '<section><h3>Ответ</h3>'+answer+'</section>'+
    '<section><h3>Критерии оценивания</h3>'+criteria+'</section></div></details>';
 }
 const refresh=()=>{
  const search=pick('search').toLocaleLowerCase('ru-RU').trim();
  const keys=['subject','grade','exam','year','part','slot','difficulty','type','topic','subtopic','origin'];
  const shown=xs.filter(x=>keys.every(key=>{const value=pick(key);return value==='all'||(key==='type'?x.task.type:x[key])===value;})&&
   [String(x.bankNumber),String(x.bankNumber).padStart(5,'0'),x.task.prompt,x.topic,x.subtopic,x.grade,x.task.answer,x.task.comment,x.task.criteria].some(value=>String(value||'').toLocaleLowerCase('ru-RU').includes(search)));
  get('count').textContent='Найдено: '+shown.length+' / '+xs.length;
  const advanced=['grade','year','part','slot','difficulty','type','subtopic','origin'].filter(key=>pick(key)!=='all');
  d.querySelector('.qw-bank-extra-filters summary').textContent='Дополнительные фильтры'+(advanced.length?' · применено: '+advanced.length:'');
  const items=shown.map(x=>{
   const tags=[x.subject==='math'?'Математика':x.subject==='physics'?'Физика':x.subject,
    x.grade?x.grade+' кл.':'',
    x.exam==='ege'?'ЕГЭ':x.exam==='oge'?'ОГЭ':'Практика',
    x.year,x.part?'Часть '+x.part:'',x.slot?'№ '+x.slot:'',
    x.difficulty==='basic'?'Базовый':x.difficulty==='advanced'?'Повышенный':x.difficulty==='high'?'Высокий':'',
    x.topic,x.subtopic].filter(Boolean).join(' · ');
   return '<div class="qw-bank-item qw-bank-choice" data-bank-entry="'+qwEsc(x.id)+'"><label class="qw-bank-select-check">'+
    '<input type="checkbox" data-bank-select="'+qwEsc(x.id)+'" '+(selected.has(x.id)?'checked':'')+' aria-label="Выбрать задание">'+
    '<span class="qw-bank-card-copy"><strong>№ '+String(x.bankNumber).padStart(5,'0')+' · '+qwEsc(summary(x.task.prompt)||QW_TYPES[x.task.type])+'</strong>'+
    '<small>'+qwEsc(tags)+'</small></span></label>'+
    '<button type="button" data-bank-view="'+qwEsc(x.id)+'">Просмотр</button>'+
    '<button type="button" data-bank-edit="'+qwEsc(x.id)+'">Редактировать</button>'+
    '<button type="button" data-bank-add="'+qwEsc(x.id)+'">Добавить</button>'+
    '<button type="button" data-bank-delete="'+qwEsc(x.id)+'" aria-label="Удалить из банка">×</button></div>';
  }).join('');
  const diag=diagnostic.filter(x=>String(x.question?.prompt||x.prompt||'').toLocaleLowerCase('ru-RU').includes(search)).slice(0,30);
  const other=diag.length?'<h3>Из диагностики</h3>'+diag.map(x=>
   '<div class="qw-bank-item"><span>'+qwEsc(x.question?.prompt||x.prompt||'')+'</span>'+
   '<button type="button" data-diag-bank="'+qwEsc(x.id)+'">Добавить</button></div>').join(''):'';
  d.querySelector('#qw-bank-list').innerHTML=items+other||'<p class="qw-muted">Заданий не найдено. Создайте задачу кнопкой «+ Новая задача».</p>';
  if(!shown.some(x=>x.id===activeId))activeId=shown[0]?.id||'';
  showPreview();markSelection();
 };
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
   const incoming=data.items.map(qwBankNormalize),seen=new Set(xs.map(signature)),additions=[];
   const usedNumbers=new Set(xs.map(x=>x.bankNumber));
   for(const x of incoming){
    const key=signature(x);if(seen.has(key))continue;seen.add(key);
    let number=x.bankNumber;
    if(!number||usedNumbers.has(number))number=qwBankAllocateNumber([...xs,...additions]);
    usedNumbers.add(number);additions.push({...x,id:qwId(),bankNumber:number});
   }
   if(xs.length+additions.length>500)throw Error('Превышен лимит 500 заданий');
   if(!additions.length){status('Новых заданий нет');return;}
   const next=[...xs,...additions];localStorage.setItem(QW_BANK_KEY,JSON.stringify(next));
   xs=next;fillYears();fillCategories();refresh();status('Импортировано: '+additions.length);
  }catch(error){status('Импорт банка: '+error.message,true);}
 };
 const entries=()=>[...selected.keys()].map(id=>xs.find(x=>x.id===id)).filter(Boolean);
 function addTasks(choices,replace=false){
  if(!choices.length)return;
  if(choices.length+(replace?0:qwDoc.tasks.length)>80){status('В одной работе не более 80 заданий',true);return;}
  if(replace&&qwDoc.tasks.length&&!confirm('Заменить текущую работу выбранными заданиями? Сначала сохраните QWORK при необходимости.'))return;
  const copies=choices.map(entry=>{
   const t=structuredClone(entry.task);t.id=qwId();t.source={kind:'bank',id:entry.id,number:entry.bankNumber,...(entry.slot?{slot:entry.slot}:{})};
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
    result.printSettings={...qwPrintSettings(),fontPt:10.5,showTitle:true,titleText:result.title,
      showMeta:false,showVariant:false,bodyFont:'serif',titleFont:'sans'};
    result.tasks=copies;qwDoc=result;
   }else qwDoc.tasks.push(...copies);
   qwSelected=copies[0].id;
  });
  d.close();
  if(replace)qwPreview();
 }
 d.querySelector('#qw-bank-filters').addEventListener('input',refresh);
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
  if(action==='bank-new'){
   const saved=Object.fromEntries(['search','subject','grade','exam','year','part','slot','difficulty','type','topic','subtopic','origin'].map(k=>[k,pick(k)]));
   qwBankEdit(null,null,{...saved,__view:activeId,__selected:[...selected.keys()]});return;
  }
  const view=e.target.closest('[data-bank-view]');
  if(view){activeId=view.dataset.bankView;showPreview();return;}
  if(e.target.closest('[data-bank-enlarge]')){
   const on=!d.classList.contains('qw-bank-expanded');
   d.classList.toggle('qw-bank-expanded',on);
   e.target.textContent=on?'Свернуть':'Увеличить';
   e.target.setAttribute('aria-pressed',String(on));
   return;
  }
  if(action==='bank-assemble'){addTasks(entries(),true);return;}
  if(action==='bank-add-selection'){addTasks(entries(),false);return;}
  const edit=e.target.closest('[data-bank-edit]');
  if(edit){
   const filters=Object.fromEntries(['search','subject','grade','exam','year','part','slot','difficulty','type','topic','subtopic','origin'].map(k=>[k,pick(k)]));
   filters.__view=activeId;
   filters.__selected=[...selected.keys()];
   qwBankEdit(edit.dataset.bankEdit,null,filters);return;
  }
  const add=e.target.closest('[data-bank-add],[data-diag-bank]'),del=e.target.closest('[data-bank-delete]');
  if(add){
   const own=add.dataset.bankAdd?xs.find(x=>x.id===add.dataset.bankAdd)?.task:null;
   const item=add.dataset.diagBank?diagnostic.find(x=>x.id===add.dataset.diagBank):null;
   const task=own||(item?qwFromDiagnostic(item.question||item):null);
   if(task&&qwDoc.tasks.length<80){qwChange(()=>{const copy=structuredClone(task);copy.id=qwId();qwDoc.tasks.push(copy);qwSelected=copy.id;});d.close();}
   else status('Не удалось добавить задание',true);
  }
  if(del&&confirm('Удалить задание из личного банка?')){
   const next=xs.filter(x=>x.id!==del.dataset.bankDelete);
   try{localStorage.setItem(QW_BANK_KEY,JSON.stringify(next));xs=next;selected.delete(del.dataset.bankDelete);fillYears();fillCategories();refresh();}
   catch(error){status('Не удалось изменить банк',true);}
  }
 };
 fillYears();fillCategories();
 for(const [key,value] of Object.entries(previousFilters)){
  const input=get(key);if(input&&(input.type==='search'||[...(input.options||[])].some(o=>o.value===value)))input.value=value;
 }
 const extraKeys=['grade','year','part','slot','difficulty','type','subtopic','origin'];
 if(extraKeys.some(key=>pick(key)!=='all'))d.querySelector('.qw-bank-extra-filters').open=true;
 refresh();
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
function qwVisualEditor(kind,bankTask=null,onCommit=null,onCancel=null){
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
  '<span id="qw-visual-state" role="status"></span>'+qwButton('visual-apply','Применить','class="qw-primary"'));
 d.classList.add('qw-visual-dialog','qw-visual-'+kind);d.querySelector('.qw-dialog-body').classList.add('qw-visual-body');
 let visualCommitted=false;
 if(onCancel)d.addEventListener('close',()=>{if(!visualCommitted)onCancel();});
 const stage=d.querySelector('#qw-visual-stage'),props=d.querySelector('#qw-visual-properties'),hint=d.querySelector('#qw-visual-state');
 let inspectorSelection='';
 const point=e=>{const b=stage.querySelector('svg').getBoundingClientRect(),x=qwNum((e.clientX-b.left)/b.width*520,0,520,0),y=qwNum((e.clientY-b.top)/b.height*320,0,320,0);return kind==='diagram'&&tool!=='select'&&snapGeometry&&!e.shiftKey?(tool==='select'&&!drag?{x:Math.round(x/geometryStep)*geometryStep,y:Math.round(y/geometryStep)*geometryStep}:qwSnapDiagramPoint({x,y},value,geometryStep,drag?selected:-1)):{x,y};};
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
 function labelBox(node){const r=node.getBoundingClientRect(),s=stage.querySelector('svg').getBoundingClientRect();return {x:(r.left-s.left)/s.width*520,y:(r.top-s.top)/s.height*320,w:r.width/s.width*520,h:r.height/s.height*320};}
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
   '<label>Линия шаблона<input type="color" data-legacy-paint="lineStyle" value="'+(value.lineStyle?.stroke||'#142b42')+'"></label>'+
   (value.curveFamily!=='points'?'<label>Функция шаблона<input type="color" data-legacy-paint="curveStyle" value="'+(value.curveStyle?.stroke||'#186ba3')+'"></label>':'')+'</details>':'';
  return {selectedPanel,independent,templateColor};
 }
 function stylePanel(){
  if(!multi.size)return '';
  const o=objectAt(selected),paint=o?.style||{};
  const graphElement=kind==='graph'&&selected>=value.points.length;
  const defaultStroke=kind==='graph'?(graphElement?'#186ba3':'#142b42'):'#162735';
  return '<section class="qw-object-style"><h2>Оформление'+(multi.size>1?' · '+multi.size+' объектов':'')+'</h2>'+[['stroke','Цвет линии / контура',defaultStroke],['fill','Цвет заливки','#ffffff'],['text','Цвет подписи',kind==='graph'?(paint.stroke||defaultStroke):'#162735']].filter(([key])=>key!=='fill'||kind==='diagram'&&selectedIndices().some(i=>['rect','circle','ellipse','regularPolygon','triangle','rightTriangle','quadrilateral','block','incline','pulley','movablePulley'].includes(objectAt(i)?.kind))).map(([key,title,fallback])=>'<div class="qw-paint-row"><label>'+title+'<input type="color" data-style="'+key+'" value="'+(paint[key]&&paint[key]!=='none'?paint[key]:fallback)+'"></label><div class="qw-palette">'+['#162735','#dc2626','#16a34a','#2563eb','#9333ea','#ea580c'].map(color=>'<button type="button" data-style-key="'+key+'" data-style-color="'+color+'" style="--qw-swatch:'+color+'" aria-label="'+title+' '+color+'" title="'+title+' '+color+'"></button>').join('')+(key==='fill'?'<button type="button" data-style-key="fill" data-style-color="none" aria-label="Без заливки" title="Без заливки">×</button>':'')+'</div></div>').join('')+'<label>Толщина линии<input data-style="width" type="number" min="0.5" max="12" step="0.5" value="'+(paint.width||(graphElement?2.5:2))+'"></label></section>';
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
  const selectedPanel=o?'<section class="qw-inspector-section qw-selected-settings"><h2>Выбранный объект</h2><label>Подпись выбранной фигуры<input id="qw-object-label" maxlength="80" value="'+qwEsc(o.label)+'"></label>'+parameters+'</section>':'';
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
 function draw(full=true){if(kind==='diagram')value=qwResolveDiagram(value);if(labelSelected&&labelInfo(labelSelected)?.ownerIndex!==selected)labelSelected='';const scroll=props.scrollTop;stage.innerHTML=kind==='graph'?qwGraphSVG(drag?.creating||polyline.length?{...value,elements:[...value.elements,...(drag?.creating?[drag.draft]:[]),...(polyline.length?[{kind:'polyline',vertices:polyline,label:''}]:[])]}:value,true):qwDiagramSVG([...value,...(drag?.creating?[drag.draft]:[]),...(polyline.length>1?[diagramPolyline(polyline)]:[])],true,snapGeometry?geometryStep:false);decorateSelection();if(selected>=0){const el=stage.querySelector('[data-qw-'+(kind==='graph'?'point':'object')+'="'+selected+'"]');if(el)el.classList.add('qw-visual-selected');}hint.className='';hint.textContent=kind==='graph'?value.points.length+' / 40 точек · '+value.elements.length+' / 60 объектов'+(polyline.length?' · Ломаная: '+polyline.length+' вершин':''):value.length+' / 60 фигур'+(polyline.length?' · Ломаная: '+polyline.length+' вершин':'');if(['parallel','perpendicular'].includes(tool))hint.textContent+=' · '+(constructionReference<0?'Выберите опорную линию, затем точку.':'Укажите точку для построения.');if(tool==='equalMarks')hint.textContent+=' · Нажмите отрезок: одна, две или три засечки.';if(['midpoint','perpendicularBisector'].includes(tool))hint.textContent+=' · Нажмите исходный отрезок.';if(tool==='angleBisector')hint.textContent+=' · Нажмите исходный угол.';d.querySelector('#qw-visual-undo').disabled=!history.length;d.querySelector('#qw-visual-redo').disabled=!future.length;d.querySelector('#qw-visual-delete').disabled=selected<0;d.querySelector('#qw-visual-copy').disabled=selected<0;d.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));d.querySelector('#qw-finish-polyline').disabled=polyline.length<2;if(kind==='graph'){d.querySelector('#qw-coordinate-mode').value=value.coordinateMode||'custom';d.querySelector('#qw-coordinate-hint').textContent=({first:'X и Y начинаются с нуля. Изменить границы можно справа.',positiveX:'X ≥ 0, а Y имеет положительные и отрицательные значения.',math:'Обе оси проходят через нуль, деления подписаны возле осей.',custom:'Свободные числовые диапазоны X и Y задаются справа.'})[value.coordinateMode]||'Свободные диапазоны задаются справа.';}
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
    '<details class="qw-inspector-section" open><summary>Подписи осей</summary><div class="qw-axis-titles">'+['xlabel','ylabel'].map((k,i)=>'<label>'+['Подпись X','Подпись Y'][i]+'<input data-graph-field="'+k+'" type="text" maxlength="30" value="'+qwEsc(value[k])+'"></label>').join('')+'</div></details>'+
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
  const p=point(e),before=structuredClone(value),previous=selected,scale=stage.querySelector('svg').getBoundingClientRect().width/520;
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
 d.querySelector('[data-qw-action="visual-apply"]').onclick=()=>{try{if(polyline.length){hint.textContent='Завершите ломаную или отмените её клавишей Escape';return;}const validated=kind==='graph'?qwValidateGraph(value):qwValidateDiagram(value);if(onCommit){visualCommitted=true;d.close();onCommit(kind,validated);}else{qwChange(()=>{q[kind]=validated;q.figure=kind;});d.close();}}catch(e){hint.textContent=e.message;}};draw();
}
function qwNew(){if((qwDoc.tasks.length||qwCorrupt)&&!confirm('Создать новую работу? Для резервной копии сохраните QWORK.'))return;qwRemember();qwCorrupt='';qwDoc=qwProject();qwDoc.layout='compact';qwSelected='';qwPersist();qwRender();}
function qwAction(action,button){
 const q=qwCurrent();
 if(action==='new'){qwNew();return;}if(action==='open'){document.getElementById('qw-file')?.click();return;}if(action==='save'){qwSaveFile();return;}if(action==='settings'){qwSettings();return;}if(action==='preview'){qwPreview();return;}if(action==='answers'){qwPreview('answers');return;}if(action==='pdf'||action==='pdf-text'){qwPrintTextPDF();return;}if(action==='pdf-student'||action==='pdf-teacher'){if(action==='pdf-teacher')qwPreview('answers');else qwPrintTextPDF();return;}
 if(action==='left'||action==='right'||action==='close-panels'){qwLeft=action==='left'?!qwLeft:false;qwRight=action==='right'?!qwRight:false;qwRender();return;}
 if(action==='quick-add'||action==='add'||action==='part'){if(qwDoc.tasks.length>=80){status('Максимум 80 заданий',true);return;}const name=action==='part'?prompt('Название части','Часть '+(new Set(qwDoc.tasks.map(q=>q.part)).size+1)):null;if(action==='part'&&name===null)return;qwChange(()=>{const t=qwQuickTask(button?.dataset.type||'short');t.part=name||q?.part||'Часть 1';if(['math','geometry','algebra'].includes(qwDoc.subject)&&t.figure==='graph')Object.assign(t.graph,qwCoordinatePreset('math'),{coordinateMode:'math',xlabel:'x',ylabel:'y'});let at=qwDoc.tasks.length;if(action!=='part'&&q){at=qwDoc.tasks.map(t=>t.part).lastIndexOf(q.part)+1;}qwDoc.tasks.splice(at,0,t);qwSelected=t.id;qwLeft=false;});document.getElementById('qw-prompt')?.focus();return;}
 if(action==='select'){qwSelected=button.dataset.id;qwLeft=false;qwRender();return;}
 if(action==='undo'||action==='redo'){const from=action==='undo'?qwUndo:qwRedo,to=action==='undo'?qwRedo:qwUndo;while(from.length&&from.at(-1)===JSON.stringify(qwDoc))from.pop();if(from.length){to.push(JSON.stringify(qwDoc));qwDoc=qwValidate(JSON.parse(from.pop()));qwPersist();qwRender();}return;}
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
 document.addEventListener('input',e=>{if(!qwActive())return;const t=e.target,k=t.dataset.qwField,q=qwCurrent();if(!q||!['prompt','answer','criteria','comment','part'].includes(k))return;q[k]=qwText(t.value,k==='part'?120:16000);qwPersist();qwPreviewSelected();});
 document.addEventListener('change',async e=>{if(!qwActive())return;const t=e.target;
  if(t.id==='qw-file'){const file=t.files?.[0];t.value='';if(!file)return;try{if(file.size>QW_LIMITS.bytes)throw Error('Файл больше 18 МБ');const next=qwValidate(JSON.parse(await file.text()));for(const image of new Set(next.tasks.map(q=>q.image).filter(Boolean)))await qwImage(image);if((qwDoc.tasks.length||qwCorrupt)&&!confirm('Открыть работу вместо текущей? Сохраните текущую в QWORK.'))return;qwRemember();qwDoc=next;qwCorrupt='';qwSelected='';qwPersist();qwRender();status('Работа открыта');}catch(e){status('Не удалось открыть QWORK: '+e.message,true);}return;}
  if(t.id==='qw-image'){const file=t.files?.[0],q=qwCurrent();t.value='';if(!file||!q)return;try{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>4000000)throw Error('Изображение: PNG/JPG/WebP до 4 МБ');const data=await new Promise((r,j)=>{const reader=new FileReader();reader.onload=()=>r(reader.result);reader.onerror=j;reader.readAsDataURL(file);});await qwImage(data);qwChange(()=>{q.image=data;q.figure='image';});}catch(e){status('Изображение: '+e.message,true);}return;}
  const k=t.dataset.qwField,q=qwCurrent();if(!q||!k||['prompt','answer','criteria','comment','part'].includes(k))return;if(k==='choices'){try{const choices=t.value.split(/\n/).map(s=>s.trim()).filter(Boolean);qwValidate({...qwDoc,tasks:qwDoc.tasks.map(a=>a===q?{...q,choices}:a)});qwRemember();q.choices=choices;t.defaultValue=t.value;qwPersist();qwPreviewSelected();}catch(error){status(error.message,true);}return;}qwRemember();if(t.type==='checkbox')q[k]=t.checked;else if(t.type==='number'){const ranges={points:[0,100],boxes:[1,30],solutionHeight:[24,500],figureWidth:[120,470]};const [min,max]=ranges[k]||[0,100];q[k]=qwNum(t.value,min,max,min);t.value=q[k];}else q[k]=t.value;
  if(k==='type'){if(q.type==='choice')q.choices??=qwTask('choice').choices;if(['extended','combined'].includes(q.type))q.solutionVisible=true;if(q.type==='graph')q.figure='graph';if(q.type==='diagram')q.figure='diagram';}
  qwPersist();if(t.tagName==='SELECT'||t.type==='checkbox')qwRender();else qwPreviewSelected();
 });
 window.addEventListener('keydown',e=>{if(!qwActive())return;if((e.ctrlKey||e.metaKey)&&!document.querySelector('dialog[open]')&&(e.code==='KeyZ'||e.key.toLowerCase()==='z')&&!e.target.closest('textarea,input,[contenteditable="true"]')){e.preventDefault();e.stopImmediatePropagation();qwAction(e.shiftKey?'redo':'undo');return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();e.stopImmediatePropagation();qwSaveFile();}if(e.key==='Escape'&&!document.querySelector('dialog[open]')){qwLeft=qwRight=false;qwRender();}},true);
}

function qwFooter(active){
 const spans=document.querySelectorAll('.qo-document-workspace>.qo-editor-foot>span');
 spans.forEach((e,i)=>{if(active){if(e.dataset.qwOriginal===undefined)e.dataset.qwOriginal=e.textContent;e.textContent=i===0?'A4 · PDF':i===1?qwDoc.tasks.length+' заданий · '+qwDoc.tasks.reduce((s,q)=>s+q.points,0)+' баллов':'QWORK / PDF';}else if(e.dataset.qwOriginal!==undefined){e.textContent=e.dataset.qwOriginal;delete e.dataset.qwOriginal;}});
}
