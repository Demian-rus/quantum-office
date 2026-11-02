
'use strict';
// TASK099: interactive diagnostic documents for Quantum Writer.
const QD_STATES = Object.freeze(['yes','partial','no']);
const QD_AUTO_TYPES = Object.freeze(['single','multiple','numeric']);
const QD_LIMITS = Object.freeze({sections:24,questions:240,history:50,students:80});
let qdMode = 'builder';
let qdRevealed = new Set();
let qdStudentFilter = '';
let qdPointerDrag = null;
let qdPointerBound = false;
const qdVerified = new WeakSet();
const qdNewId = () => 'qd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9);
const qdText = (value,max=1200) => typeof value==='string'?value.slice(0,max):'';
const qdEsc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const qdDefault = () => ({
  format:'quantum-diagnostic',version:1,title:'Диагностика знаний',description:'',
  sections:[{id:qdNewId(),title:'Раздел 1',questions:[{id:qdNewId(),type:'question',prompt:'',answer:'',points:2,partialCredit:50}]}],
  students:[],session:{student:'',studentId:'',marks:{},responses:{}},history:[]
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
          section.questions.push({id:id(q.id),type:qdType(q.type),
            prompt:qdText(q.prompt,1600),answer:qdText(q.answer,3500),
            points:qdPoints(q.points),partialCredit:qdPartialCredit(q.partialCredit),
            choices:qdChoices(q.choices),numericAnswer:qdText(q.numericAnswer,60),
            tolerance:qdTolerance(q.tolerance)});
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
    studentId:studentIds.has(session.studentId)?session.studentId:'',marks:{},responses:{}};
  if(session.marks&&typeof session.marks==='object'&&!Array.isArray(session.marks)){
    for(const [key,state] of Object.entries(session.marks)){
      if(questionIds.has(key)&&QD_STATES.includes(state))data.session.marks[key]=state;
    }
  }
  if(session.responses&&typeof session.responses==='object'&&!Array.isArray(session.responses)){
    for(const q of data.sections.flatMap(s=>s.questions)){
      if(Object.hasOwn(session.responses,q.id))data.session.responses[q.id]=qdNormalizeResponse(q,session.responses[q.id]);
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
        yes:x.yes,partial:x.partial,no:x.no,rated:x.rated,total:x.total,percent:Math.min(100,x.percent),
        ...(Number.isFinite(x.earned)&&Number.isFinite(x.possible)&&x.earned>=0&&x.possible>=0&&x.earned<=2400&&x.possible<=2400?
          {earned:qdScoreNumber(x.earned),possible:qdScoreNumber(x.possible)}:{})
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
    qdRevealed.clear();qdStudentFilter='';
  }
  return qoWriter.diagnostic;
}
function qdQuestionList(d=qdDoc()){
  return d.sections.flatMap(s=>s.questions.map(q=>({...q,section:s.title})));
}
function qdType(value){
  return ['question','practice',...QD_AUTO_TYPES].includes(value)?value:'question';
}
function qdAuto(type){return QD_AUTO_TYPES.includes(type);}
function qdChoices(raw){
  const values=Array.isArray(raw)?raw.slice(0,6):[];
  const result=values.map(item=>({text:qdText(item?.text,240),correct:item?.correct===true}));
  while(result.length<2)result.push({text:'',correct:false});
  return result;
}
function qdTolerance(v){
  return typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e9?v:0;
}
function qdParseNumber(value){
  const s=String(value??'').trim().replaceAll(' ','').replace(',', '.');
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d{1,3})?$/.test(s))return null;
  const n=Number(s);return Number.isFinite(n)&&Math.abs(n)<=1e12?n:null;
}
function qdNormalizeResponse(q,response){
  if(q.type==='numeric')return {value:qdText(response?.value,80)};
  const selected=Array.isArray(response?.selected)?response.selected:[];
  const indices=[...new Set(selected.filter(n=>Number.isInteger(n)&&n>=0&&n<q.choices.length))];
  return {selected:q.type==='single'?indices.slice(0,1):indices.slice(0,6)};
}
function qdCheckAnswer(q,response){
  if(!qdAuto(q.type))return null;
  const value=qdNormalizeResponse(q,response);
  if(q.type==='numeric'){
    const expected=qdParseNumber(q.numericAnswer),received=qdParseNumber(value.value);
    if(expected===null||received===null)return null;
    return Math.abs(expected-received)<=qdTolerance(q.tolerance)+Number.EPSILON*Math.max(1,Math.abs(expected))*4?'yes':'no';
  }
  const options=qdChoices(q.choices),valid=options.every(o=>o.text.trim().length>0);
  const correct=options.flatMap((o,i)=>o.correct?[i]:[]);
  const selected=value.selected;
  if(!valid||!correct.length||!selected.length||q.type==='single'&&correct.length!==1)return null;
  const chosen=new Set(selected);
  if(correct.length===selected.length&&correct.every(i=>chosen.has(i)))return 'yes';
  if(q.type==='multiple'&&selected.every(i=>correct.includes(i)))return 'partial';
  return 'no';
}
function qdPoints(value){return Number.isInteger(value)&&value>=1&&value<=10?value:2;}
function qdPartialCredit(value){return Number.isInteger(value)&&value>=0&&value<=100?value:50;}
function qdScoreNumber(n){return Math.round(n*100)/100;}
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
  const d=qdDoc(),count=qdQuestionList(d).length;
  return `<div class="qd-editor">
    <div class="qd-panel qd-meta">
      <label>Название диагностики<input data-qd-field="title" maxlength="120" value="${qdEsc(d.title)}"></label>
      <label>Описание<textarea data-qd-field="description" maxlength="600" rows="2">${qdEsc(d.description)}</textarea></label>
      <div class="qd-row qd-wrap qd-builder-tools">
        <span class="qd-count-pill">${count} / ${QD_LIMITS.questions} заданий · ${d.sections.length} разделов</span>
        <button data-qd-action="sample" type="button">Пример: физика, 8 класс</button>
        <button data-qd-action="add-section" type="button">+ Раздел</button>
      </div>
      <p class="qd-hint">Перетаскивайте карточки за значок захвата или используйте стрелки и меню разделов.</p>
    </div>
    ${d.sections.map((s,si)=>`<section class="qd-section qd-editor-section" data-section="${qdEsc(s.id)}">
      <div class="qd-section-head">
        <span class="qd-index">${si+1}</span>
        <label>Название раздела<input data-qd-field="section" data-sid="${qdEsc(s.id)}" maxlength="120" value="${qdEsc(s.title)}"></label>
        <div class="qd-section-actions">
          <button data-qd-action="section-up" data-sid="${qdEsc(s.id)}" type="button" ${si===0?'disabled':''} title="Раздел выше" aria-label="Раздел выше">↑</button>
          <button data-qd-action="section-down" data-sid="${qdEsc(s.id)}" type="button" ${si===d.sections.length-1?'disabled':''} title="Раздел ниже" aria-label="Раздел ниже">↓</button>
          <button data-qd-action="delete-section" data-sid="${qdEsc(s.id)}" type="button">Удалить</button>
        </div>
      </div>
      <div class="qd-question-list" data-qd-drop-section="${qdEsc(s.id)}">
      ${s.questions.map((q,qi)=>`<article class="qd-card qd-edit-card" data-qid="${qdEsc(q.id)}" data-section-id="${qdEsc(s.id)}">
        <div class="qd-card-head">
          <span class="qd-drag-handle" data-qd-drag="${qdEsc(q.id)}" tabindex="0" title="Перетащите карточку" aria-label="Перетащить вопрос">⠿</span>
          <span class="qd-counter">Вопрос ${qi+1}</span>
          <select data-qd-field="type" data-qid="${qdEsc(q.id)}" aria-label="Тип задания">
            <option value="question" ${q.type==='question'?'selected':''}>Вопрос</option>
            <option value="practice" ${q.type==='practice'?'selected':''}>Практика</option>
          </select>
          <button type="button" data-qd-action="question-up" data-qid="${qdEsc(q.id)}" ${qi===0?'disabled':''} aria-label="Поднять вопрос" title="Поднять вопрос">↑</button>
          <button type="button" data-qd-action="question-down" data-qid="${qdEsc(q.id)}" ${qi===s.questions.length-1?'disabled':''} aria-label="Опустить вопрос" title="Опустить вопрос">↓</button>
          <button type="button" data-qd-action="duplicate-question" data-qid="${qdEsc(q.id)}" title="Создать копию">Копия</button>
          <button type="button" data-qd-action="delete-question" data-qid="${qdEsc(q.id)}" data-sid="${qdEsc(s.id)}" title="Удалить вопрос">×</button>
        </div>
        <label>Что спросить у ученика<textarea data-qd-field="prompt" data-qid="${qdEsc(q.id)}" maxlength="1600" rows="2" placeholder="Введите вопрос">${qdEsc(q.prompt)}</textarea></label>
        <label>Ответ преподавателя (скрыт при проведении)<textarea data-qd-field="answer" data-qid="${qdEsc(q.id)}" maxlength="3500" rows="2" placeholder="Пояснение или решение">${qdEsc(q.answer)}</textarea></label>
        <div class="qd-settings">
          <label>Баллы за ответ<input data-qd-field="points" data-qid="${qdEsc(q.id)}" type="number" min="1" max="10" step="1" value="${qdPoints(q.points)}"></label>
          <label>За частичный ответ, %<input data-qd-field="partialCredit" data-qid="${qdEsc(q.id)}" type="number" min="0" max="100" step="5" value="${qdPartialCredit(q.partialCredit)}"></label>
          <label>Перенести в раздел<select data-qd-field="move-section" data-qid="${qdEsc(q.id)}" aria-label="Перенести вопрос в раздел"><option value="${qdEsc(s.id)}">Текущий раздел</option>
          ${d.sections.filter(other=>other.id!==s.id).map(other=>`<option value="${qdEsc(other.id)}">${qdEsc(other.title)}</option>`).join('')}</select></label>
        </div>
      </article>`).join('')}</div>
      <button type="button" data-qd-action="add-question" data-sid="${qdEsc(s.id)}">+ Добавить вопрос</button></section>`).join('')}
    <section class="qd-panel qd-roster">
      <div class="qd-row qd-wrap"><h2>Ученики</h2><span class="qd-muted">${d.students.length} / ${QD_LIMITS.students}</span></div>
      <p class="qd-hint">Список хранится внутри этой диагностики. Сохранённые результаты привязаны к ученику и не удаляются при смене имени.</p>
      <div class="qd-add-student"><input id="qd-student-new" maxlength="100" placeholder="Имя или код ученика" aria-label="Новый ученик"><button type="button" data-qd-action="add-student">+ Добавить</button></div>
      <div class="qd-student-list">${d.students.map(student=>`<div class="qd-student-row">
        <input data-qd-field="student-name" data-student-id="${qdEsc(student.id)}" value="${qdEsc(student.name)}" maxlength="100" aria-label="Изменить имя ученика">
        <span>${qdStudentResults(d,student.id).length} занятий</span>
        <button type="button" data-qd-action="remove-student" data-student-id="${qdEsc(student.id)}" aria-label="Удалить ученика">Удалить</button>
      </div>`).join('')||'<p class="qd-hint">Добавьте ученика, чтобы вести его историю.</p>'}</div>
    </section>
    <div class="qd-panel qd-bottom-actions">
      <button data-qd-action="add-section" type="button">+ Новый раздел</button>
      <button data-qd-action="mode" data-mode="run" class="qd-primary" type="button">Перейти к проведению</button>
    </div>
  </div>`;
}
function qdDateLabel(value){
  const date=new Date(value||'');return Number.isFinite(date.getTime())?date.toLocaleString('ru-RU'):'Дата неизвестна';
}
function qdRun(){
  const d=qdDoc(),all=qdQuestionList(d),s=qdScores(all,d.session.marks);
  const history=qdStudentFilter?qdStudentResults(d,qdStudentFilter):d.history;
  const profile=d.students.find(x=>x.id===qdStudentFilter);
  const scores=history.map(h=>h.summary||qdScores(all,h.marks)).filter(x=>x.rated);
  const average=scores.length?Math.round(scores.reduce((n,x)=>n+x.percent,0)/scores.length):null;
  return `<div class="qd-session">
    <div class="qd-panel qd-session-panel">
      <div class="qd-student-chooser">
        <label>Из списка учеников<select data-qd-field="student-select" aria-label="Выбрать ученика">
        <option value="">Без привязки к профилю</option>${d.students.map(student=>`<option value="${qdEsc(student.id)}" ${student.id===d.session.studentId?'selected':''}>${qdEsc(student.name)}</option>`).join('')}</select></label>
        <label>Ученик<input type="text" data-qd-field="student" maxlength="100" value="${qdEsc(d.session.student)}" placeholder="Имя или код ученика"></label>
        <button data-qd-action="remember-student" type="button" title="Создать профиль из введённого имени">+ В список</button>
      </div>
      <div class="qd-row qd-wrap">
        <button type="button" data-qd-action="reset">Начать заново</button>
        <button type="button" data-qd-action="save-result" class="qd-primary" ${!s.rated?'disabled':''}>Завершить и сохранить результат</button>
      </div>
    </div>
    ${d.sections.map((section,si)=>`<section class="qd-section">
      <div class="qd-section-title"><h2>${si+1}. ${qdEsc(section.title)}</h2><span>${section.questions.length} вопросов</span></div>
      ${section.questions.map((q,qi)=>{
        const mark=d.session.marks[q.id],visible=qdRevealed.has(q.id);
        return `<article class="qd-card ${mark?'qd-mark-'+mark:''}" data-qid="${qdEsc(q.id)}">
         <div class="qd-question"><span class="qd-counter">${qi+1}.</span><div>
         <span class="qd-type">${q.type==='practice'?'Практика':'Вопрос'} · ${qdPoints(q.points)} балл${qdPoints(q.points)===1?'':qdPoints(q.points)<5?'а':'ов'} · частично ${qdPartialCredit(q.partialCredit)}%</span>
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
      <p class="qd-percent">${s.rated?`Результат: <strong>${s.percent}%</strong> · ${s.earned} из ${s.possible} доступных баллов за проверенные вопросы.`:'Начните отмечать ответы, чтобы увидеть результат.'}</p>
      <div class="qd-topic-results">${d.sections.map(section=>{
        const st=qdScores(section.questions,d.session.marks);
        return `<div><span>${qdEsc(section.title)}</span><span>${st.rated}/${st.total} проверено · ${st.rated?st.percent+'%':'—'} · ${st.earned}/${st.possible} б.</span></div>`;
      }).join('')}</div>
    </section>
    <section class="qd-panel qd-history">
      <div class="qd-row qd-wrap"><h2>Журнал результатов</h2>
        <button type="button" data-qd-action="csv" ${!d.history.length?'disabled':''}>Экспорт CSV</button>
      </div>
      <label class="qd-filter-label">Показать результаты
        <select data-qd-field="history-filter"><option value="">Все ученики</option>
        ${d.students.map(student=>`<option value="${qdEsc(student.id)}" ${qdStudentFilter===student.id?'selected':''}>${qdEsc(student.name)}</option>`).join('')}
        </select>
      </label>
      ${profile?`<div class="qd-profile-insight"><strong>${qdEsc(profile.name)}</strong>
         <span>Занятий: ${history.length}</span>
         <span>Средний результат: ${average===null?'—':average+'%'}</span>
         <span>Последний результат: ${scores.length?scores.at(-1).percent+'%':'—'}</span></div>`:''}
      ${history.length?`<div class="qd-history-list">${[...history].reverse().map(h=>{
        const hs=h.summary||qdScores(all,h.marks);
        return `<div><span>${qdEsc(h.student||'Ученик без имени')}<small>${qdEsc(qdDateLabel(h.date))}</small></span>
        <strong>${hs.rated?hs.percent+'%':'—'}</strong><span>${hs.rated} проверено${Number.isFinite(hs.earned)?` · ${hs.earned}/${hs.possible} б.`:''}</span></div>`;
      }).join('')}</div>`:'<p>Результатов пока нет.</p>'}
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
  const rows=[['Дата','Ученик','Документ','Проверено','Всего','Знает','Частично','Не знает','Результат, %','Получено баллов','Возможные баллы'],
    ...d.history.map(h=>{const s=h.summary||qdScores(questions,h.marks);
      return [h.date,h.student,h.title||d.title,s.rated,s.total,s.yes,s.partial,s.no,s.percent,s.earned??'',s.possible??''];})];
  download((typeof safeFile==='function'?safeFile(d.title):'diagnostic')+'-results.csv',
    '\ufeff'+rows.map(row=>row.map(qdCsvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8');
}
function qdSample(){
  const section=(title,pairs,type='question')=>({id:qdNewId(),title,questions:pairs.map(([prompt,answer])=>({id:qdNewId(),type,prompt,answer,points:2,partialCredit:50}))});
  const d=qdDoc();d.title='Физика · 8 класс · Осенняя диагностика';d.description='Проверка понимания тепловых явлений и расчётных навыков.';
  d.sections=[
    section('Температура и внутренняя энергия',[
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
  d.students=[];d.session={student:'',studentId:'',marks:{}};d.history=[];qdStudentFilter='';qdRevealed.clear();qdStore();
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
  root.addEventListener('pointerdown',qdPointerDown);
  if(!qdPointerBound){
    window.addEventListener('pointermove',qdPointerMove,true);
    window.addEventListener('pointerup',qdPointerUp,true);
    window.addEventListener('pointercancel',qdPointerCancel,true);
    qdPointerBound=true;
  }
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

  if(action==='section-up'||action==='section-down'){
    const index=d.sections.findIndex(s=>s.id===button.dataset.sid),other=index+(action==='section-up'?-1:1);
    if(index<0||other<0||other>=d.sections.length)return;
    [d.sections[index],d.sections[other]]=[d.sections[other],d.sections[index]];
    qdStore();qdRefresh();return;
  }
  if(action==='question-up'||action==='question-down'){
    if(qdShiftQuestion(d,button.dataset.qid,action==='question-up'?-1:1)){qdStore();qdRefresh();}
    return;
  }
  if(action==='duplicate-question'){
    if(!qdDuplicateQuestion(d,button.dataset.qid))status('Не удалось скопировать: достигнут лимит или вопрос не найден',true);
    else {qdStore();qdRefresh();}return;
  }
  if(action==='add-student'||action==='remember-student'){
    const input=action==='add-student'?document.getElementById('qd-student-new'):document.querySelector('[data-qd-field="student"]');
    const student=qdAddStudent(d,input?.value||'');
    if(!student){status('Введите имя ученика или проверьте лимит списка',true);return;}
    if(action==='remember-student'){
      d.session.student=student.name;d.session.studentId=student.id;
    }
    qdStore();qdRefresh();status('Ученик добавлен в список');return;
  }
  if(action==='remove-student'){
    const student=d.students.find(s=>s.id===button.dataset.studentId);if(!student)return;
    if(!confirm('Удалить ученика из списка? Уже записанные результаты сохранятся в журнале.'))return;
    d.students=d.students.filter(s=>s.id!==student.id);
    if(d.session.studentId===student.id)d.session.studentId='';
    if(qdStudentFilter===student.id)qdStudentFilter='';
    qdStore();qdRefresh();return;
  }
  if(action==='add-section'){
    if(d.sections.length>=QD_LIMITS.sections){status('Максимум 24 раздела',true);return;}
    d.sections.push({id:qdNewId(),title:`Раздел ${d.sections.length+1}`,questions:[]});qdStore();qdRefresh();return;
  }
  if(action==='delete-section'){
    if(!confirm('Удалить раздел и все его вопросы?'))return;
    const old=d.sections.find(x=>x.id===button.dataset.sid);
    if(old)old.questions.forEach(q=>{delete d.session.marks[q.id];qdRevealed.delete(q.id);});
    d.sections=d.sections.filter(x=>x.id!==button.dataset.sid);qdStore();qdRefresh();return;
  }
  if(action==='add-question'){
    if(qdQuestionList(d).length>=QD_LIMITS.questions){status('Максимум 240 вопросов',true);return;}
    const section=d.sections.find(x=>x.id===button.dataset.sid);if(!section)return;
    section.questions.push({id:qdNewId(),type:'question',prompt:'',answer:'',points:2,partialCredit:50});qdStore();qdRefresh();return;
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
    d.session={student:'',studentId:'',marks:{}};qdRevealed.clear();qdStore();qdRefresh();return;
  }
  if(action==='save-result'){
    const stats=qdScores(qdQuestionList(d),d.session.marks);
    if(!stats.rated)return;
    d.history.push({id:qdNewId(),date:new Date().toISOString(),student:d.session.student,
      title:d.title,studentId:d.session.studentId||'',marks:{...d.session.marks},summary:stats});
    d.history=d.history.slice(-QD_LIMITS.history);
    d.session={student:'',studentId:'',marks:{}};qdRevealed.clear();qdStore();qdRefresh();
    status('Результат сохранён в истории диагностики');return;
  }
}


function qdPointerDown(event){
  const handle=event.target.closest?.('[data-qd-drag]');
  if(!handle||qdMode!=='builder'||event.button!==0)return;
  qdPointerDrag={id:handle.dataset.qdDrag,x:event.clientX,y:event.clientY,pointerId:event.pointerId,active:false};
  event.preventDefault();
}
function qdPointerLocation(event){
  const element=document.elementFromPoint(event.clientX,event.clientY);
  if(!element?.closest('#qo-diag-root'))return null;
  const zone=element.closest('[data-qd-drop-section]');
  if(!zone)return null;
  const card=element.closest('.qd-edit-card');
  return {zone,card};
}
function qdPointerMove(event){
  const drag=qdPointerDrag;
  if(!drag||event.pointerId!==drag.pointerId||qdMode!=='builder')return;
  if(!drag.active&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<7)return;
  drag.active=true;
  const location=qdPointerLocation(event);
  document.querySelectorAll('#qo-diag-root .qd-drop-target').forEach(el=>el.classList.remove('qd-drop-target'));
  (location?.card||location?.zone)?.classList.add('qd-drop-target');
}
function qdPointerUp(event){
  const drag=qdPointerDrag;
  if(!drag||event.pointerId!==drag.pointerId)return;
  const location=drag.active?qdPointerLocation(event):null;
  qdPointerDrag=null;qdClearDropTarget();
  if(!location||qdMode!=='builder')return;
  const rect=location.card?.getBoundingClientRect();
  const after=!!rect&&event.clientY>rect.top+rect.height/2;
  if(qdMoveQuestion(qdDoc(),drag.id,location.zone.dataset.qdDropSection,location.card?.dataset.qid||'',after)){
    qdStore();qdRefresh();
  }
}
function qdPointerCancel(){qdPointerDrag=null;qdClearDropTarget();}
function qdClearDropTarget(){
  document.querySelectorAll('#qo-diag-root .qd-drop-target').forEach(el=>el.classList.remove('qd-drop-target'));
}

function qdOnInput(event){
  const field=event.target.dataset.qdField;if(!field)return;
  const d=qdDoc(),value=event.target.value;
  if(field==='title')d.title=qdText(value,120);
  else if(field==='description')d.description=qdText(value,600);
  else if(field==='student'){
    d.session.student=qdText(value,100);
    if(d.students.find(x=>x.id===d.session.studentId)?.name!==d.session.student)d.session.studentId='';
  }
  else if(field==='section'){
    const s=d.sections.find(x=>x.id===event.target.dataset.sid);if(s)s.title=qdText(value,120);
  }else if(['prompt','answer'].includes(field)){
    const q=qdQuestionList(d).find(x=>x.id===event.target.dataset.qid);
    if(q){const orig=d.sections.flatMap(s=>s.questions).find(x=>x.id===q.id);if(orig)orig[field]=qdText(value,field==='answer'?3500:1600);}
  }else if(field==='student-name')return;
  else return;
  qdStore();
}
function qdOnChange(event){
  if(event.target.dataset.qdField==='history-filter'){
    qdStudentFilter=event.target.value;qdRefresh();return;
  }
  if(event.target.dataset.qdField==='student-select'){
    const student=qdDoc().students.find(s=>s.id===event.target.value);
    qdDoc().session.studentId=student?.id||'';
    qdDoc().session.student=student?.name||'';
    qdStore();qdRefresh();return;
  }
  if(event.target.dataset.qdField==='move-section'){
    const d=qdDoc();
    if(qdMoveQuestion(d,event.target.dataset.qid,event.target.value)){qdStore();qdRefresh();}
    return;
  }
  if(['points','partialCredit'].includes(event.target.dataset.qdField)){
    const q=qdDoc().sections.flatMap(s=>s.questions).find(q=>q.id===event.target.dataset.qid);
    if(!q)return;
    const n=Number(event.target.value);
    if(event.target.dataset.qdField==='points')q.points=qdPoints(n);
    else q.partialCredit=qdPartialCredit(n);
    qdStore();qdRefresh();return;
  }
  if(event.target.dataset.qdField==='student-name'){
    const d=qdDoc(),student=d.students.find(s=>s.id===event.target.dataset.studentId);
    if(!student)return;
    const value=qdText(event.target.value,100).trim();
    if(!value||d.students.some(s=>s.id!==student.id&&s.name.toLocaleLowerCase('ru-RU')===value.toLocaleLowerCase('ru-RU'))){
      status('Имя не может быть пустым или совпадать с другим учеником',true);
      event.target.value=student.name;return;
    }
    student.name=value;
    if(d.session.studentId===student.id)d.session.student=student.name;
    qdStore();qdRefresh();return;
  }
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
    qdMode='run';qoWriter.diagnosticMode='run';qdStudentFilter='';qdRevealed.clear();qdStore();qdRefresh();
  }).catch(()=>status('Не удалось открыть .qdiag: повреждённый или неподдерживаемый файл',true));
}
