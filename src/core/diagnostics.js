
'use strict';
// TASK099: interactive diagnostic documents for Quantum Writer.
const QD_STATES = Object.freeze(['yes','partial','no']);
const QD_LIMITS = Object.freeze({sections:24,questions:240,history:50,students:80});
let qdMode = 'builder';
let qdRevealed = new Set();
let qdStudentFilter = '';
let qdDraggedQuestion = '';
const qdVerified = new WeakSet();
const qdNewId = () => 'qd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9);
const qdText = (value,max=1200) => typeof value==='string'?value.slice(0,max):'';
const qdEsc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const qdDefault = () => ({
  format:'quantum-diagnostic',version:1,title:'Диагностика знаний',description:'',
  sections:[{id:qdNewId(),title:'Раздел 1',questions:[{id:qdNewId(),type:'question',prompt:'',answer:'',points:2,partialCredit:50}]}],
  students:[],session:{student:'',studentId:'',marks:{}},history:[]
});
function qdNormalize(raw){
  const data=qdDefault();
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return data;
  data.title=qdText(raw.title,120)||data.title;
  data.description=qdText(raw.description,600);
  const used=new Set();
  const id = v => {
    if(typeof v==='string'&&/^[\w-]{1,60}$/.test(v)&&!used.has(v)){used.add(v);return v;}
    let next=qdNewId();while(used.has(next))next=qdNewId();used.add(next);return next;
  };
  let count=0;
  if(Array.isArray(raw.sections)){
    data.sections=[];
    for(const s of raw.sections.slice(0,QD_LIMITS.sections)){
      if(!s||typeof s!=='object')continue;
      const section={id:id(s.id),title:qdText(s.title,120)||'Без названия',questions:[]};
      if(Array.isArray(s.questions)){
        for(const q of s.questions){
          if(count>=QD_LIMITS.questions)break;
          if(!q||typeof q!=='object')continue;
          section.questions.push({id:id(q.id),type:q.type==='practice'?'practice':'question',
            prompt:qdText(q.prompt,1600),answer:qdText(q.answer,3500),
            points:qdPoints(q.points),partialCredit:qdPartialCredit(q.partialCredit)});
          count++;
        }
      }
      data.sections.push(section);
    }
  }
  const questionIds=new Set(data.sections.flatMap(s=>s.questions.map(q=>q.id)));
  if(Array.isArray(raw.students)) data.students=raw.students.slice(0,QD_LIMITS.students)
    .filter(s=>s&&typeof s==='object'&&qdText(s.name,100).trim())
    .map(s=>({id:id(s.id),name:qdText(s.name,100).trim()}));
  const studentIds=new Set(data.students.map(s=>s.id));
  const session=raw.session&&typeof raw.session==='object'?raw.session:{};
  data.session={student:qdText(session.student,100),
    studentId:studentIds.has(session.studentId)?session.studentId:'',marks:{}};
  if(session.marks&&typeof session.marks==='object'&&!Array.isArray(session.marks)){
    for(const [key,state] of Object.entries(session.marks)){
      if(questionIds.has(key)&&QD_STATES.includes(state))data.session.marks[key]=state;
    }
  }
  if(Array.isArray(raw.history)){
    data.history=raw.history.slice(-QD_LIMITS.history).filter(h=>h&&typeof h==='object').map(h=>{
      const marks={};
      if(h.marks&&typeof h.marks==='object'&&!Array.isArray(h.marks)){
        for(const [key,state] of Object.entries(h.marks)){
          if(/^[\w-]{1,60}$/.test(key)&&QD_STATES.includes(state))marks[key]=state;
        }
      }
      const x=h.summary;
      const summary=x&&typeof x==='object'&&['yes','partial','no','rated','total','percent'].every(k=>Number.isInteger(x[k])&&x[k]>=0&&x[k]<=10000)?{
        yes:x.yes,partial:x.partial,no:x.no,rated:x.rated,total:x.total,percent:Math.min(100,x.percent)
      }:null;
      return {id:qdText(h.id,60)||qdNewId(),date:qdText(h.date,30),
        student:qdText(h.student,100),studentId:studentIds.has(h.studentId)?h.studentId:'',
        title:qdText(h.title,120),marks,summary};
    });
  }
  return data;
}
function qdDoc(){
  if(!qdVerified.has(qoWriter)){
    qoWriter.diagnostic=qdNormalize(qoWriter.diagnostic);
    qdMode=qoWriter.diagnosticMode==='run'?'run':'builder';
    qdVerified.add(qoWriter);
    qdRevealed.clear();
  }
  return qoWriter.diagnostic;
}
function qdQuestionList(d=qdDoc()){
  return d.sections.flatMap(s=>s.questions.map(q=>({...q,section:s.title})));
}
function qdPoints(value){return Number.isInteger(value)&&value>=1&&value<=10?value:2;}
function qdPartialCredit(value){return Number.isInteger(value)&&value>=0&&value<=100?value:50;}
function qdScoreNumber(n){return Math.round(n*10)/10;}
function qdScores(questions,marks){
  let yes=0,partial=0,no=0,earned=0,possible=0,maxPoints=0;
  for(const q of questions){
    const points=qdPoints(q.points),state=marks?.[q.id];
    maxPoints+=points;
    if(state==='yes'){yes++;earned+=points;possible+=points;}
    if(state==='partial'){partial++;earned+=points*qdPartialCredit(q.partialCredit)/100;possible+=points;}
    if(state==='no'){no++;possible+=points;}
  }
  const rated=yes+partial+no;
  return {yes,partial,no,rated,total:questions.length,
    earned:qdScoreNumber(earned),possible:qdScoreNumber(possible),maxPoints:qdScoreNumber(maxPoints),
    percent:possible?Math.round(earned/possible*100):0};
}
function qdMoveQuestion(d,qid,destSid,targetQid='',after=false){
  const source=d.sections.find(s=>s.questions.some(q=>q.id===qid));
  const dest=d.sections.find(s=>s.id===destSid);
  if(!source||!dest||qid===targetQid)return false;
  const index=source.questions.findIndex(q=>q.id===qid);
  const [question]=source.questions.splice(index,1);
  let destinationIndex=targetQid?dest.questions.findIndex(q=>q.id===targetQid):-1;
  if(destinationIndex<0)destinationIndex=dest.questions.length;
  else if(after)destinationIndex++;
  dest.questions.splice(destinationIndex,0,question);
  return true;
}
function qdDuplicateQuestion(d,qid){
  if(qdQuestionList(d).length>=QD_LIMITS.questions)return false;
  const section=d.sections.find(s=>s.questions.some(q=>q.id===qid));
  if(!section)return false;
  const index=section.questions.findIndex(q=>q.id===qid),orig=section.questions[index];
  section.questions.splice(index+1,0,{...orig,id:qdNewId()});
  return true;
}
function qdShiftQuestion(d,qid,step){
  const section=d.sections.find(s=>s.questions.some(q=>q.id===qid));
  if(!section)return false;
  const index=section.questions.findIndex(q=>q.id===qid),other=index+step;
  if(other<0||other>=section.questions.length)return false;
  [section.questions[index],section.questions[other]]=[section.questions[other],section.questions[index]];
  return true;
}
function qdAddStudent(d,name){
  name=qdText(name,100).trim();
  if(!name)return null;
  const found=d.students.find(s=>s.name.toLocaleLowerCase('ru-RU')===name.toLocaleLowerCase('ru-RU'));
  if(found)return found;
  if(d.students.length>=QD_LIMITS.students)return null;
  const entry={id:qdNewId(),name};d.students.push(entry);return entry;
}
function qdStudentResults(d,studentId){
  const student=d.students.find(s=>s.id===studentId);
  if(!student)return [];
  return d.history.filter(h=>h.studentId===studentId||
    (!h.studentId&&h.student.trim().toLocaleLowerCase('ru-RU')===student.name.toLocaleLowerCase('ru-RU')));
}
function qdStore(){qoPersistWriter();}
function qdToolbar(){
  const d=qdDoc();
  return `<div class="qd-top">
    <div><span class="qd-eyebrow">QUANTUM WRITER · ИНТЕРАКТИВНЫЙ ДОКУМЕНТ</span>
    <h1>${qdEsc(d.title)}</h1><p>${qdEsc(d.description||'Создавайте вопросы, открывайте ответы и отмечайте знания ученика.')}</p></div>
    <div class="qd-actions" role="group" aria-label="Режим работы">
      <button type="button" data-qd-action="mode" data-mode="builder" class="${qdMode==='builder'?'active':''}" aria-pressed="${qdMode==='builder'}">Конструктор</button>
      <button type="button" data-qd-action="mode" data-mode="run" class="${qdMode==='run'?'active':''}" aria-pressed="${qdMode==='run'}">Проведение</button>
    </div></div>`;
}
function qdBuilder(){
  const d=qdDoc();
  return `<div class="qd-editor">
    <div class="qd-panel qd-meta">
      <label>Название диагностики<input data-qd-field="title" maxlength="120" value="${qdEsc(d.title)}"></label>
      <label>Описание<textarea data-qd-field="description" maxlength="600" rows="2">${qdEsc(d.description)}</textarea></label>
      <div class="qd-row qd-wrap">
        <button data-qd-action="sample" type="button">Пример: физика, 8 класс</button>
        <button data-qd-action="add-section" type="button">+ Добавить раздел</button>
      </div>
    </div>
    ${d.sections.map((s,si)=>`<section class="qd-section qd-editor-section" data-section="${qdEsc(s.id)}">
      <div class="qd-section-head"><span class="qd-index">${si+1}</span>
      <label>Название раздела<input data-qd-field="section" data-sid="${qdEsc(s.id)}" maxlength="120" value="${qdEsc(s.title)}"></label>
      <button data-qd-action="delete-section" data-sid="${qdEsc(s.id)}" type="button" aria-label="Удалить раздел">Удалить раздел</button></div>
      <div class="qd-question-list">${s.questions.map((q,qi)=>`<article class="qd-card qd-edit-card">
        <div class="qd-card-head"><span class="qd-counter">Вопрос ${qi+1}</span><select data-qd-field="type" data-qid="${qdEsc(q.id)}" aria-label="Тип задания">
          <option value="question" ${q.type==='question'?'selected':''}>Вопрос</option>
          <option value="practice" ${q.type==='practice'?'selected':''}>Практика</option></select>
          <button type="button" data-qd-action="delete-question" data-qid="${qdEsc(q.id)}" data-sid="${qdEsc(s.id)}">Удалить</button></div>
        <label>Что спросить у ученика<textarea data-qd-field="prompt" data-qid="${qdEsc(q.id)}" maxlength="1600" rows="2" placeholder="Введите вопрос">${qdEsc(q.prompt)}</textarea></label>
        <label>Ответ преподавателя (скрыт при проведении)<textarea data-qd-field="answer" data-qid="${qdEsc(q.id)}" maxlength="3500" rows="2" placeholder="Пояснение или решение">${qdEsc(q.answer)}</textarea></label>
      </article>`).join('')}</div>
      <button type="button" data-qd-action="add-question" data-sid="${qdEsc(s.id)}">+ Добавить вопрос</button></section>`).join('')}
    <div class="qd-panel qd-bottom-actions">
      <button data-qd-action="add-section" type="button">+ Новый раздел</button>
      <button data-qd-action="mode" data-mode="run" class="qd-primary" type="button">Перейти к проведению</button>
    </div></div>`;
}
function qdRun(){
  const d=qdDoc(),all=qdQuestionList(d),s=qdScores(all,d.session.marks);
  return `<div class="qd-session">
    <div class="qd-panel qd-session-panel"><label>Ученик (необязательно)
    <input type="text" data-qd-field="student" maxlength="100" value="${qdEsc(d.session.student)}" placeholder="Имя или код ученика"></label>
    <div class="qd-row qd-wrap">
      <button type="button" data-qd-action="reset">Начать заново</button>
      <button type="button" data-qd-action="save-result" class="qd-primary" ${!s.rated?'disabled':''}>Завершить и сохранить результат</button>
    </div></div>
    ${d.sections.map((section,si)=>`<section class="qd-section">
      <div class="qd-section-title"><h2>${si+1}. ${qdEsc(section.title)}</h2><span>${section.questions.length} вопросов</span></div>
      ${section.questions.map((q,qi)=>{
        const mark=d.session.marks[q.id],visible=qdRevealed.has(q.id);
        return `<article class="qd-card ${mark?'qd-mark-'+mark:''}" data-qid="${qdEsc(q.id)}">
         <div class="qd-question"><span class="qd-counter">${qi+1}.</span><div><span class="qd-type">${q.type==='practice'?'Практика':'Вопрос'}</span>
         <p>${qdEsc(q.prompt||'Вопрос пока не заполнен').replace(/\n/g,'<br>')}</p></div></div>
         <div class="qd-card-actions">
           <button type="button" class="qd-answer-toggle" data-qd-action="reveal" data-qid="${qdEsc(q.id)}" aria-expanded="${visible}">${visible?'Скрыть ответ':'Показать ответ'}</button>
           <div class="qd-rating" role="group" aria-label="Оценка ответа">
             <button type="button" data-qd-action="mark" data-qid="${qdEsc(q.id)}" data-mark="yes" aria-pressed="${mark==='yes'}" class="${mark==='yes'?'selected':''}">✓ Знает</button>
             <button type="button" data-qd-action="mark" data-qid="${qdEsc(q.id)}" data-mark="partial" aria-pressed="${mark==='partial'}" class="${mark==='partial'?'selected':''}">◐ Частично</button>
             <button type="button" data-qd-action="mark" data-qid="${qdEsc(q.id)}" data-mark="no" aria-pressed="${mark==='no'}" class="${mark==='no'?'selected':''}">× Не знает</button>
           </div></div>
         ${visible?`<div class="qd-answer"><strong>Ответ</strong><p>${qdEsc(q.answer||'Ответ не заполнен').replace(/\n/g,'<br>')}</p></div>`:''}
        </article>`;
      }).join('')}</section>`).join('')}
    <section class="qd-panel qd-results" aria-label="Итоги диагностики">
      <h2>Итоги диагностики</h2>
      <div class="qd-metrics">
        <div><strong class="qd-good">${s.yes}</strong><span>Знает</span></div>
        <div><strong class="qd-partial">${s.partial}</strong><span>Частично</span></div>
        <div><strong class="qd-bad">${s.no}</strong><span>Не знает</span></div>
        <div><strong>${s.rated} / ${s.total}</strong><span>Проверено</span></div>
      </div>
      <div class="qd-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.total?Math.round(s.rated/s.total*100):0}" aria-label="Проверенные вопросы">
        <span class="qd-progress-good" style="width:${s.total?s.yes/s.total*100:0}%"></span>
        <span class="qd-progress-partial" style="width:${s.total?s.partial/s.total*100:0}%"></span>
        <span class="qd-progress-bad" style="width:${s.total?s.no/s.total*100:0}%"></span>
      </div>
      <p class="qd-percent">${s.rated?`Результат: <strong>${s.percent}%</strong> из проверенных вопросов (2 балла — знает, 1 — частично, 0 — не знает).`:'Начните отмечать ответы, чтобы увидеть результат.'}</p>
      <div class="qd-topic-results">${d.sections.map(section=>{
        const st=qdScores(section.questions,d.session.marks);
        return `<div><span>${qdEsc(section.title)}</span><span>${st.rated}/${st.total} проверено · ${st.rated?st.percent+'%':'—'}</span></div>`;
      }).join('')}</div>
    </section>
    <section class="qd-panel qd-history"><div class="qd-row qd-wrap"><h2>История результатов</h2>
      <button type="button" data-qd-action="csv" ${!d.history.length?'disabled':''}>Экспорт CSV</button></div>
      ${d.history.length?`<div class="qd-history-list">${[...d.history].reverse().map(h=>{const hs=h.summary||qdScores(all,h.marks);return `<div><span>${qdEsc(h.student||'Ученик без имени')}<small>${qdEsc(h.date?new Date(h.date).toLocaleString('ru-RU'):'Дата неизвестна')}</small></span>
        <strong>${hs.rated?hs.percent+'%':'—'}</strong><span>${hs.rated} проверено</span></div>`;}).join('')}</div>`:'<p>Сохранённые занятия появятся здесь после завершения диагностики.</p>'}
    </section></div>`;
}
function qdExport(){
  const d=qdDoc();
  download((typeof safeFile==='function'?safeFile(d.title):'diagnostic')+'.qdiag',
    JSON.stringify(d,null,2),'application/json;charset=utf-8');
}
function qdCsvCell(value){
  let x=String(value??'');
  if(/^[\s]*[=+\-@\t\r]/.test(x))x="'"+x;
  return '"'+x.replace(/"/g,'""')+'"';
}
function qdCSV(){
  const d=qdDoc(),questions=qdQuestionList(d);
  const rows=[['Дата','Ученик','Документ','Проверено','Всего','Знает','Частично','Не знает','Результат, %'],
    ...d.history.map(h=>{const s=h.summary||qdScores(questions,h.marks);
      return [h.date,h.student,h.title||d.title,s.rated,s.total,s.yes,s.partial,s.no,s.percent];})];
  download((typeof safeFile==='function'?safeFile(d.title):'diagnostic')+'-results.csv',
    '\ufeff'+rows.map(row=>row.map(qdCsvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');
}
function qdSample(){
  const section=(title,pairs,type='question')=>({id:qdNewId(),title,questions:pairs.map(([prompt,answer])=>({id:qdNewId(),type,prompt,answer}))});
  const d=qdDoc();d.title='Физика · 8 класс · Осенняя диагностика';d.description='Проверка понимания тепловых явлений и расчётных навыков.';
  d.sections=[
    section('Температура и внутреняя энергия',[
      ['Почему сахар быстрее растворяется в горячем чае?','Частицы при нагревании движутся быстрее. Диффузия и растворение обычно ускоряются.'],
      ['Какими способами можно изменить внутреннюю энергию тела?','Теплопередачей или совершением работы.'],
      ['Почему металл на ощупь холоднее дерева при одинаковой температуре?','Металл быстрее отводит тепло от руки благодаря высокой теплопроводности.']
    ]),
    section('Теплопередача и теплоёмкость',[
      ['Почему батареи отопления устанавливают у пола?','Нагретый воздух поднимается, возникает конвекция.'],
      ['Как солнечная энергия достигает Земли через вакуум?','Тепловым и другим электромагнитным излучением.'],
      ['Что означает удельная теплоёмкость воды 4200 Дж/(кг·°C)?','Для нагрева 1 кг воды на 1 °C требуется 4200 Дж теплоты при отсутствии фазового перехода.']
    ]),
    section('Практические задачи',[
      ['Сколько теплоты нужно для нагрева 2 кг воды от 20 до 30 °C? c = 4200 Дж/(кг·°C).','Q = cmΔt = 4200 × 2 × 10 = 84 000 Дж = 84 кДж.'],
      ['Смешали по 1 кг воды температурой 80 °C и 20 °C. Какая будет температура без потерь?','50 °C, поскольку массы и удельные теплоёмкости равны.']
    ],'practice')
  ];
  d.session={student:'',marks:{}};d.history=[];qdRevealed.clear();qdStore();
}
function qdRefresh(){
  const root=document.getElementById('qo-diag-root');if(!root)return;
  const scroll=document.getElementById('qo-diag-workspace'),top=scroll?.scrollTop||0;
  root.innerHTML=qdToolbar()+(qdMode==='builder'?qdBuilder():qdRun())+
    `<div class="qd-filebar"><button type="button" data-qd-action="export">Сохранить диагностику .qdiag</button>
       <button type="button" data-qd-action="import">Открыть .qdiag</button>
       <span>Работает без интернета · Для сохранности скачивайте файл</span>
       <input id="qo-diag-file" type="file" accept=".qdiag,application/json" hidden></div>`;
  if(scroll)scroll.scrollTop=top;
}
function qoDiagnosticVisibility(){
  const active=qoWorkspaceTab.writer==='diagnostic';
  document.getElementById('qo-writer-edit-scroll')?.toggleAttribute('hidden',active);
  document.getElementById('qo-diag-workspace')?.toggleAttribute('hidden',!active);
  if(active)qdRefresh();
}
function qoDiagnosticMount(){
  const root=document.getElementById('qo-diag-root');if(!root)return;
  root.addEventListener('click',qdOnClick);
  root.addEventListener('input',qdOnInput);
  root.addEventListener('change',qdOnChange);
  qoDiagnosticVisibility();
}
function qdOnClick(event){
  const button=event.target.closest('[data-qd-action]');if(!button)return;
  const action=button.dataset.qdAction,d=qdDoc();
  if(action==='mode'){qdMode=button.dataset.mode==='run'?'run':'builder';qoWriter.diagnosticMode=qdMode;qdRevealed.clear();qdStore();qdRefresh();return;}
  if(action==='export'){qdExport();return;}
  if(action==='csv'){qdCSV();return;}
  if(action==='import'){document.getElementById('qo-diag-file')?.click();return;}
  if(action==='sample'){
    if(!confirm('Заменить текущую диагностику примером? Вопросы и история текущего документа будут заменены.'))return;
    qdSample();qdRefresh();return;
  }
  if(action==='add-section'){
    if(d.sections.length>=QD_LIMITS.sections){status('Максимум 24 раздела',true);return;}
    d.sections.push({id:qdNewId(),title:`Раздел ${d.sections.length+1}`,questions:[]});qdStore();qdRefresh();return;
  }
  if(action==='delete-section'){
    if(!confirm('Удалить раздел и все его вопросы?'))return;
    d.sections=d.sections.filter(x=>x.id!==button.dataset.sid);qdStore();qdRefresh();return;
  }
  if(action==='add-question'){
    if(qdQuestionList(d).length>=QD_LIMITS.questions){status('Максимум 240 вопросов',true);return;}
    const section=d.sections.find(x=>x.id===button.dataset.sid);if(!section)return;
    section.questions.push({id:qdNewId(),type:'question',prompt:'',answer:''});qdStore();qdRefresh();return;
  }
  if(action==='delete-question'){
    const section=d.sections.find(x=>x.id===button.dataset.sid);if(!section)return;
    section.questions=section.questions.filter(q=>q.id!==button.dataset.qid);
    delete d.session.marks[button.dataset.qid];qdRevealed.delete(button.dataset.qid);
    qdStore();qdRefresh();return;
  }
  if(action==='mark'){
    const qid=button.dataset.qid,mark=button.dataset.mark;
    if(!QD_STATES.includes(mark)||!qdQuestionList(d).some(q=>q.id===qid))return;
    if(d.session.marks[qid]===mark)delete d.session.marks[qid];else d.session.marks[qid]=mark;
    qdStore();qdRefresh();return;
  }
  if(action==='reveal'){
    if(qdRevealed.has(button.dataset.qid))qdRevealed.delete(button.dataset.qid);
    else qdRevealed.add(button.dataset.qid);qdRefresh();return;
  }
  if(action==='reset'){
    if(Object.keys(d.session.marks).length&&!confirm('Очистить оценки текущего занятия без сохранения?'))return;
    d.session={student:'',marks:{}};qdRevealed.clear();qdStore();qdRefresh();return;
  }
  if(action==='save-result'){
    const stats=qdScores(qdQuestionList(d),d.session.marks);
    if(!stats.rated)return;
    d.history.push({id:qdNewId(),date:new Date().toISOString(),student:d.session.student,
      title:d.title,marks:{...d.session.marks},summary:stats});
    d.history=d.history.slice(-QD_LIMITS.history);
    d.session={student:'',marks:{}};qdRevealed.clear();qdStore();qdRefresh();
    status('Результат сохранён в истории диагностики');return;
  }
}
function qdOnInput(event){
  const field=event.target.dataset.qdField;if(!field)return;
  const d=qdDoc(),value=event.target.value;
  if(field==='title')d.title=qdText(value,120);
  else if(field==='description')d.description=qdText(value,600);
  else if(field==='student')d.session.student=qdText(value,100);
  else if(field==='section'){
    const s=d.sections.find(x=>x.id===event.target.dataset.sid);if(s)s.title=qdText(value,120);
  }else if(['prompt','answer'].includes(field)){
    const q=qdQuestionList(d).find(x=>x.id===event.target.dataset.qid);
    if(q){const orig=d.sections.flatMap(s=>s.questions).find(x=>x.id===q.id);if(orig)orig[field]=qdText(value,field==='answer'?3500:1600);}
  }else return;
  qdStore();
}
function qdOnChange(event){
  if(event.target.dataset.qdField==='type'){
    const q=qdDoc().sections.flatMap(s=>s.questions).find(q=>q.id===event.target.dataset.qid);
    if(q)q.type=event.target.value==='practice'?'practice':'question';
    qdStore();return;
  }
  if(event.target.id!=='qo-diag-file')return;
  const file=event.target.files?.[0];event.target.value='';
  if(!file)return;
  if(file.size>2_000_000){status('Файл диагностики слишком большой (максимум 2 МБ)',true);return;}
  file.text().then(raw=>{
    const parsed=JSON.parse(raw);
    if(!parsed||parsed.format!=='quantum-diagnostic'||parsed.version!==1||!Array.isArray(parsed.sections))
      throw Error('Неверный формат');
    if(!confirm('Заменить текущую диагностику содержимым файла?'))return;
    qoWriter.diagnostic=qdNormalize(parsed);qdVerified.add(qoWriter);
    qdMode='run';qoWriter.diagnosticMode='run';qdRevealed.clear();qdStore();qdRefresh();
  }).catch(()=>status('Не удалось открыть .qdiag: повреждённый или неподдерживаемый файл',true));
}
