/* TASK142: authoring outline, optional properties inspector and fast assessment.
   UI preferences are separate from QDIAG. All mutations use the existing model. */
const QD_DESK_KEY='quantum-office.diagnostic-workbench.v1';
let qdDesk={question:'',panels:true,properties:false};
try{const stored=JSON.parse(localStorage.getItem(QD_DESK_KEY)||'{}');qdDesk.question=qdText(stored.question,60);qdDesk.panels=stored.panels!==false;qdDesk.properties=stored.properties===true;}catch(_){/* default layout, document untouched */}
const qdDeskHintRevealed=new Set(),qdDeskBoundRoots=new WeakSet();
function qdDeskRemember(){try{localStorage.setItem(QD_DESK_KEY,JSON.stringify(qdDesk));}catch(_){}}
function qdDeskTools(){
 return '<button type="button" data-qd-action="panels" aria-pressed="'+qdDesk.panels+'" title="Показать или скрыть вспомогательные панели">'+(qdDesk.panels?'Скрыть панели':'Показать панели')+'</button>'+
 '<button type="button" data-qd-action="quick-question" title="Добавить вопрос · Ctrl+Enter">+ Вопрос</button>';
}
function qdDeskOutline(d){
 let num=0;
 return '<details class="qd-side-panel qd-topic-navigator qd-desk-outline" '+(typeof innerWidth==='undefined'||innerWidth>900?'open':'')+'><summary>Разделы и вопросы <span>'+qdQuestionList(d).length+'</span></summary>'+
 '<div class="qd-outline-body"><div class="qd-outline-actions"><button data-qd-action="toggle-all-sections" type="button">'+(qdCollapsedSections.size?'Развернуть все':'Свернуть разделы')+'</button></div>'+d.sections.map(s=>
 '<div class="qd-outline-section"><button type="button" class="qd-side-topic" data-qd-action="sidebar-topic" data-sid="'+qdEsc(s.id)+'">'+qdEsc(s.title)+' <small>'+s.questions.length+'</small></button>'+s.questions.map(q=>
 '<button type="button" class="qd-outline-question" data-qd-action="editor-select" data-qid="'+qdEsc(q.id)+'" aria-current="'+(q.id===qdDesk.question)+'" title="'+qdEsc(q.prompt||'Новый вопрос')+'"><span>'+ ++num+'</span><span>'+qdEsc(q.prompt||'Новый вопрос')+'</span></button>').join('')+'</div>').join('')+
 (!d.sections.length?'<p class="qd-hint">Создайте первый раздел и добавьте свои вопросы.</p>':'')+'</div></details>';
}
function qdDeskInspector(d){
 const q=qdQuestionList(d).find(q=>q.id===qdDesk.question);
 return '<aside class="qd-side-panel qd-side-insights qd-question-inspector" aria-label="Свойства выбранного вопроса"><h2>Параметры вопроса</h2>'+
 (q?'<p class="qd-current-question">'+qdEsc(q.prompt||'Новый вопрос')+'</p><button type="button" class="qd-inspector-toggle" data-qd-action="properties" aria-expanded="'+qdDesk.properties+'">'+(qdDesk.properties?'Вернуть параметры в карточку':'Открыть параметры здесь')+'</button>':'<p class="qd-hint">Выберите вопрос в списке слева или нажмите его номер в карточке.</p>')+
 '<div id="qd-question-properties" '+(qdDesk.properties&&q?'':'hidden')+'></div><details class="qd-inspector-overview" '+(!q?'open':'')+'><summary>Обзор и проверка</summary><div class="qd-overview-slot">'+qdSidebarInsights(d,'builder').replace('qd-side-insights','qd-overview-content')+'</div></details>'+
 '<details class="qd-keyboard-help"><summary>Горячие клавиши</summary><p>Ctrl+S — сохранить шаблон<br>Ctrl+Enter — новый вопрос<br>Ctrl+D — копия выбранного<br>Alt+↑ / ↓ — переместить вопрос<br>Shift+F10 — меню вопроса</p></details></aside>';
}
function qdDeskRefreshInspector(){
 const root=document.getElementById('qo-diag-root');if(!root)return;
 const overview=root.querySelector('.qd-overview-slot');
 if(overview)overview.innerHTML=qdSidebarInsights(qdWorkingDoc(),'builder').replace('qd-side-insights','qd-overview-content');
 const q=qdQuestionList(qdWorkingDoc()).find(q=>q.id===qdDesk.question);
 const label=root.querySelector('.qd-current-question');if(label&&q)label.textContent=q.prompt||'Новый вопрос';
 for(const button of root.querySelectorAll('.qd-outline-question')){
  const q=qdQuestionList(qdWorkingDoc()).find(q=>q.id===button.dataset.qid);
  if(q){button.lastElementChild.textContent=q.prompt||'Новый вопрос';button.title=q.prompt||'Новый вопрос';}
 }
}
function qdDeskDecorate(){
 const root=document.getElementById('qo-diag-root');if(!root)return;
 root.classList.toggle('qd-desk-builder',qdMode==='builder');root.classList.toggle('qd-desk-wide',!qdDesk.panels);root.classList.toggle('qd-properties-open',qdDesk.properties&&!!qdDesk.question);
 if(!qdDeskBoundRoots.has(root)){
  root.addEventListener('contextmenu',event=>{if(qdMode!=='builder')return;const card=event.target.closest('.qd-edit-card');const section=event.target.closest('.qd-section-head');if(!card&&!section)return;event.preventDefault();qdDeskMenu(card?.dataset.qid||'',section?.closest('[data-section]')?.dataset.section||'',event.clientX,event.clientY);});
  qdDeskBoundRoots.add(root);
 }
 if(qdMode!=='builder')return;
 const card=[...root.querySelectorAll('.qd-edit-card')].find(el=>el.dataset.qid===qdDesk.question);
 const properties=root.querySelector('#qd-question-properties');
 if(card){card.classList.add('qd-current-card');card.setAttribute('aria-label','Выбранный вопрос');}
 if(!card||!properties||!qdDesk.properties)return;
 const type=card.querySelector('[data-qd-field="type"]');
 if(type){const label=document.createElement('label');label.textContent='Тип задания';label.append(type);properties.append(label);}
 for(const selector of ['.qd-settings','.qd-numeric-editor','[data-qd-field="criteria"]','[data-qd-field="hint"]']){
  const element=card.querySelector(selector);if(element)properties.append(element.matches('textarea')?element.closest('label'):element);
 }
}
function qdDeskSelect(id){
 const d=qdWorkingDoc(),section=d.sections.find(s=>s.questions.some(q=>q.id===id));if(!section)return;
 qdDesk.question=id;qdDesk.properties=true;qdDesk.panels=true;qdCollapsedSections.delete(section.id);qdCardExpanded.add(id);qdDeskRemember();qdRefresh();if(innerWidth<1200){document.querySelector('#qd-question-properties select')?.focus();}else qdJumpToEdit(id);
}
function qdDeskAction(action,button,d){
 if(action==='library-recovery'){download('QuantumOffice-templates-recovery.json',localStorage.getItem(QD_LIBRARY_KEY)||'[]','application/json');return true;}
 if(action==='editor-select'){qdDeskSelect(button.dataset.qid);return true;}
 if(action==='properties'||action==='panels'){
  if(action==='properties')qdDesk.properties=!qdDesk.properties;else qdDesk.panels=!qdDesk.panels;
  qdDeskRemember();qdRefresh();return true;
 }
 if(action==='quick-question'){
  const root=qdWorkingDoc();if(qdQuestionList(root).length>=QD_LIMITS.questions){status('Максимум 240 вопросов',true);return true;}
  let section=root.sections.find(s=>s.questions.some(q=>q.id===qdDesk.question))||root.sections[0];
  if(!section){section={id:qdNewId(),title:'Раздел 1',questions:[]};root.sections.push(section);}
  const q={id:qdNewId(),type:'question',prompt:'',answer:'',hint:'',criteria:'',points:2,partialCredit:50};section.questions.push(q);qdStore();qdDeskSelect(q.id);return true;
 }
 if(action==='hint'){
  const id=button.dataset.qid;if(qdDeskHintRevealed.has(id))qdDeskHintRevealed.delete(id);else qdDeskHintRevealed.add(id);
  qdRefresh();return true;
 }
 if(action==='mode'||action==='reset'||action==='run-start')qdDeskHintRevealed.clear();
 if(action==='library-clear-filters'){
  qdLibraryQuery='';qdLibrarySubject='all';qdLibraryGrade='all';qdLibraryPurpose='all';qdLibrarySource='all';qdRefresh();return true;
 }
 return false;
}
function qdDeskHintHTML(q){
 const open=qdDeskHintRevealed.has(q.id);
 return '<div class="qd-pupil-hint"><button type="button" data-qd-action="hint" data-qid="'+qdEsc(q.id)+'" aria-expanded="'+open+'">'+(open?'Скрыть подсказку':'Подсказка ученику')+'</button>'+(open?'<p>'+qdEsc(q.hint).replace(/\n/g,'<br>')+'</p>':'')+'</div>';
}
function qdDeskRefreshScores(){
 const root=document.getElementById('qo-diag-root');if(!root||qdMode!=='run')return;
 const template=document.createElement('template');template.innerHTML=qdRun();
 // Keep every actionable element in place: blur/change can run between
 // pointerdown and click on Save, Next or the comment field.
 for(const selector of ['.qd-guided-status','.qd-guided-finish>span','.qd-results .qd-metrics','.qd-results .qd-progress','.qd-results .qd-percent','.qd-results .qd-topic-results']){
  const old=root.querySelector(selector),next=template.content.querySelector(selector);if(old&&next)old.replaceWith(next);
 }
 const queues=qdReviewQueues(qdDoc());
 const counters=root.querySelectorAll('.qd-review-sidebar .qd-side-stat strong');
 if(counters[0])counters[0].textContent=queues.pending.length;if(counters[1])counters[1].textContent=queues.review.length;
 const summary=root.querySelector('.qd-question-map>summary span'),stats=qdScores(qdQuestionList(),qdDoc().session.marks,qdDoc().session.scores);
 if(summary)summary.textContent=stats.rated+' из '+stats.total+' проверено';
 for(const button of root.querySelectorAll('.qd-map-number')){
  const q=qdQuestionList()[Number(button.dataset.index)],state=q&&qdDoc().session.marks[q.id];
  for(const mark of QD_STATES)button.classList.toggle('rated-'+mark,state===mark);
 }
 for(const card of root.querySelectorAll('.qd-run-card')){
  const state=qdDoc().session.marks[card.dataset.qid];
  for(const mark of QD_STATES)card.classList.toggle('qd-mark-'+mark,state===mark);
  let label=card.querySelector('.qd-card-assessed');if(!label&&state){label=document.createElement('p');label.className='qd-card-assessed';label.setAttribute('role','status');card.append(label);}if(label)label.textContent=state?({yes:'Знает',partial:'Частично',no:'Не знает'}[state])+(Number.isFinite(qdDoc().session.scores?.[card.dataset.qid])?' · '+qdDoc().session.scores[card.dataset.qid]+' б.':''):'';
  for(const b of card.querySelectorAll('[data-mark]')){b.classList.toggle('selected',b.dataset.mark===state);b.setAttribute('aria-pressed',String(b.dataset.mark===state));}
 }
 for(const button of root.querySelectorAll('[data-qd-action="save-result"]'))button.disabled=!qdScores(qdQuestionList(),qdDoc().session.marks,qdDoc().session.scores).rated;
}
function qdDeskMenu(qid,sid,x,y){
 document.getElementById('qd-context-menu')?.remove();
 const root=document.getElementById('qo-diag-root'),menu=document.createElement('div');menu.id='qd-context-menu';menu.className='qd-context-menu';menu.setAttribute('role','menu');
 const items=qid?[['editor-select','Параметры'],['duplicate-question','Дублировать'],['question-up','Переместить выше'],['question-down','Переместить ниже'],['delete-question','Удалить вопрос']]:[['duplicate-section','Дублировать раздел'],['section-up','Раздел выше'],['section-down','Раздел ниже'],['delete-section','Удалить раздел']];
 const section=qdWorkingDoc().sections.find(s=>s.questions.some(q=>q.id===qid));
 menu.innerHTML=items.map(([action,label])=>'<button type="button" role="menuitem" data-qd-action="'+action+'" data-qid="'+qdEsc(qid)+'" data-sid="'+qdEsc(sid||section?.id||'')+'">'+label+'</button>').join('');
 menu.style.left=Math.max(8,Math.min(x,innerWidth-226))+'px';menu.style.top=Math.max(8,Math.min(y,innerHeight-220))+'px';root.append(menu);menu.firstElementChild.focus();
 menu.addEventListener('click',()=>queueMicrotask(()=>menu.remove()));
 menu.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.remove();return;}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const buttons=[...menu.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);buttons[(index+(e.key==='ArrowDown'?1:buttons.length-1))%buttons.length].focus();}});
}
if(typeof window!=='undefined'){
 window.addEventListener('pointerdown',e=>{if(!e.target.closest('#qd-context-menu'))document.getElementById('qd-context-menu')?.remove();for(const menu of document.querySelectorAll('.qd-library-menu[open]'))if(!menu.contains(e.target))menu.open=false;});
 window.addEventListener('keydown',e=>{
  if(typeof page==='undefined'||page!=='writer'||qoWorkspaceTab.writer!=='diagnostic'||document.querySelector('dialog[open]'))return;
  if(e.key==='Escape'){document.getElementById('qd-context-menu')?.remove();for(const menu of document.querySelectorAll('.qd-library-menu[open]'))menu.open=false;if(qdMode==='builder'&&qdDesk.properties&&innerWidth<1200){qdDesk.properties=false;qdDeskRemember();qdRefresh();}return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&qdMode==='builder'){
   e.preventDefault();document.querySelector('[data-qd-action="builder-quick-save"]')?.click();return;
  }
  if(qdMode!=='builder')return;
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();qdDeskAction('quick-question',null,qdWorkingDoc());return;}
  const q=qdQuestionList(qdWorkingDoc()).find(q=>q.id===qdDesk.question);if(!q)return;
  if(e.shiftKey&&e.key==='F10'){e.preventDefault();const card=[...document.querySelectorAll('.qd-edit-card')].find(el=>el.dataset.qid===q.id),r=card?.getBoundingClientRect();qdDeskMenu(q.id,'',r?.x||20,r?.y||180);return;}
  if(e.altKey&&['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();qdShiftQuestion(qdWorkingDoc(),q.id,e.key==='ArrowUp'?-1:1);qdStore();qdRefresh();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'&&!e.target.closest('input,textarea,[contenteditable]')){e.preventDefault();if(qdDuplicateQuestion(qdWorkingDoc(),q.id)){qdStore();qdRefresh();}}
 });
}

function qdDeskLibraryWarning(){
 try{const raw=localStorage.getItem(QD_LIBRARY_KEY);if(!raw)return '';const data=JSON.parse(raw);if(Array.isArray(data)&&data.every(x=>qdLibrarySafe(x)))return '';}catch(_){}
 return '<div class="qd-data-warning" role="alert"><strong>Не удалось прочитать всю личную библиотеку.</strong><p>Исходные данные не перезаписываются. Скачайте их перед восстановлением.</p><button type="button" data-qd-action="library-recovery">Скачать исходные данные</button></div>';
}
