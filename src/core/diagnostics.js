
'use strict';
// TASK099: interactive diagnostic documents for Quantum Writer.
const QD_STATES = Object.freeze(['yes','partial','no']);
const QD_AUTO_TYPES = Object.freeze(['single','multiple','numeric']);
function qdHistoryResponses(raw){
  const result={};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return result;
  for(const [key,v] of Object.entries(raw).slice(0,QD_LIMITS.questions)){
    if(!/^[\w-]{1,60}$/.test(key)||!v||typeof v!=='object')continue;
    if(typeof v.value==='string')result[key]={value:qdText(v.value,80)};
    else if(Array.isArray(v.selected)){
      result[key]={selected:[...new Set(v.selected.filter(i=>Number.isInteger(i)&&i>=0&&i<6))].slice(0,6)};
    }
  }
  return result;
}
const QD_LIMITS = Object.freeze({sections:24,questions:240,history:50,students:80,templates:30});
let qdMode = 'builder';
let qdRevealed = new Set();
let qdStudentFilter = '';
let qdPointerDrag = null;
let qdPointerBound = false;
let qdKeyboardBound = false;
const qdVerified = new WeakSet();
const qdNewId = () => 'qd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9);
const qdText = (value,max=1200) => typeof value==='string'?value.slice(0,max):'';
const qdEsc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const qdDefault = () => ({
  format:'quantum-diagnostic',version:1,title:'Диагностика знаний',description:'',
  sections:[{id:qdNewId(),title:'Раздел 1',questions:[{id:qdNewId(),type:'question',prompt:'',answer:'',points:2,partialCredit:50}]}],
  students:[],session:{student:'',studentId:'',marks:{},responses:{}},
  display:{mode:'focus',activeId:''},history:[]
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
  const display=raw.display&&typeof raw.display==='object'?raw.display:{};
  data.display={mode:display.mode==='list'?'list':'focus',activeId:questionIds.has(display.activeId)?display.activeId:''};
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
      const marks={},responses=qdHistoryResponses(h.responses);
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
        title:qdText(h.title,120),marks,responses,summary,
        topics:Array.isArray(h.topics)?h.topics.slice(0,QD_LIMITS.sections).filter(t=>t&&typeof t==='object')
          .map(t=>({name:qdText(t.name,120),rated:Number.isInteger(t.rated)&&t.rated>=0&&t.rated<=240?t.rated:0,
            total:Number.isInteger(t.total)&&t.total>=0&&t.total<=240?t.total:0,
            percent:Number.isInteger(t.percent)&&t.percent>=0&&t.percent<=100?t.percent:0})):null};
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
  const values=Array.isArray(raw)?raw.slice(0,6):Array.from({length:4},()=>({text:'',correct:false}));
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

/* TASK109 — rapid in-section authoring and safe independent section cloning. */
let qdCollapsedSections=new Set();
let qdQuickLastType='question';
function qdCopyCard(q,independentId=true){
  return {...q,id:independentId?qdNewId():q.id,
    choices:qdChoices(q.choices).map(c=>({text:c.text,correct:!!c.correct}))};
}
function qdDuplicateSection(d,sid){
  const source=d.sections.find(s=>s.id===sid);
  if(!source)return {ok:false,message:'Раздел не найден'};
  if(d.sections.length>=QD_LIMITS.sections)return {ok:false,message:'Максимум 24 раздела'};
  if(qdQuestionList(d).length+source.questions.length>QD_LIMITS.questions)
    return {ok:false,message:'Максимум 240 вопросов'};
  const titles=new Set(d.sections.map(s=>qdPromptKey(s.title)));
  const base=qdText(source.title,100).trim()+' — копия';
  let title=base,suffix=2;
  while(titles.has(qdPromptKey(title)))title=base+' '+suffix++;
  title=qdText(title,120);
  const copy={id:qdNewId(),title,questions:source.questions.map(q=>qdCopyCard(q))};
  const index=d.sections.findIndex(s=>s.id===sid);
  d.sections.splice(index+1,0,copy);
  return {ok:true,id:copy.id,count:copy.questions.length};
}
function qdQuickAdd(d,sid,input){
  const section=d.sections.find(s=>s.id===sid);
  if(!section)return {ok:false,message:'Раздел не найден'};
  if(qdQuestionList(d).length>=QD_LIMITS.questions)return {ok:false,message:'Максимум 240 вопросов'};
  const prompt=qdText(input?.prompt,1600).trim(),answer=qdText(input?.answer,3500).trim();
  const type=qdType(input?.type);
  if(!prompt)return {ok:false,message:'Введите текст вопроса'};
  if(!['question','practice','single','multiple','numeric'].includes(type))
    return {ok:false,message:'Неизвестный тип'};
  const q={id:qdNewId(),type,prompt,answer,points:2,partialCredit:50,
    choices:qdChoices(),numericAnswer:'',tolerance:0};
  if(type==='numeric'&&qdParseNumber(answer)!==null)q.numericAnswer=answer;
  section.questions.push(q);
  return {ok:true,id:q.id};
}
function qdQuickMarkup(s){
  return '<div class="qd-quick-entry" data-qd-quick-sid="'+qdEsc(s.id)+'">'+
    '<div class="qd-quick-header"><strong>Быстро добавить вопрос</strong>'+
      '<span>Enter в вопросе · Ctrl+Enter в ответе</span></div>'+
    '<div class="qd-quick-fields">'+
      '<label>Вопрос<input data-qd-quick="prompt" maxlength="1600" placeholder="Что спросить у ученика?" aria-label="Новый вопрос"></label>'+
      '<label>Ответ преподавателя<textarea data-qd-quick="answer" maxlength="3500" rows="2" placeholder="Ответ или решение" aria-label="Ответ для нового вопроса"></textarea></label>'+
      '<label>Тип<select data-qd-quick="type" aria-label="Тип нового вопроса">'+
      [['question','Вопрос'],['practice','Практика'],['single','Один ответ'],['multiple','Несколько ответов'],['numeric','Число']]
        .map(([value,title])=>'<option value="'+value+'" '+(qdQuickLastType===value?'selected':'')+'>'+title+'</option>').join('')+
      '</select></label>'+
      '<button type="button" class="qd-primary" data-qd-action="quick-add" data-sid="'+qdEsc(s.id)+'">+ Добавить</button>'+
    '</div><p class="qd-hint">Для тестовых вопросов варианты ответа можно настроить в добавленной карточке.</p></div>';
}
function qdQuickKeydown(event){
  if(qdMode!=='builder'||event.isComposing||event.altKey||event.metaKey)return;
  const field=event.target?.dataset?.qdQuick;
  if(!field||event.key!=='Enter')return;
  const trigger=field==='prompt'&&!event.shiftKey&&!event.ctrlKey||
    field==='answer'&&event.ctrlKey;
  if(!trigger)return;
  const pane=event.target.closest('[data-qd-quick-sid]');
  const button=pane?.querySelector('[data-qd-action="quick-add"]');
  if(button&&!button.disabled){event.preventDefault();button.click();}
}

function qdDuplicateQuestion(d,qid){
  if(qdQuestionList(d).length>=QD_LIMITS.questions)return false;
  const section=d.sections.find(s=>s.questions.some(q=>q.id===qid));
  if(!section)return false;
  const index=section.questions.findIndex(q=>q.id===qid),orig=section.questions[index];
  section.questions.splice(index+1,0,qdCopyCard(orig));
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
      <button type="button" data-qd-action="mode" data-mode="library" class="${qdMode==='library'?'active':''}"
        aria-pressed="${qdMode==='library'}">Шаблоны</button>
      <button type="button" data-qd-action="mode" data-mode="builder" class="${qdMode==='builder'?'active':''}" aria-pressed="${qdMode==='builder'}">Конструктор</button>
      <button type="button" data-qd-action="mode" data-mode="run" class="${qdMode==='run'?'active':''}" aria-pressed="${qdMode==='run'}">Проведение</button>
    </div></div>`;
}

const QD_BULK_MAX_CHARS=24000;
let qdBulkDraft='',qdBulkTarget='',qdBulkOpen=false,qdAuditOpen=false,qdCompact=false;
let qdCardExpanded=new Set();
function qdPromptKey(value){
  return qdText(value,1600).replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
}
function qdAudit(d){
  const issues=[],seen=new Map();
  for(const s of d.sections){
    for(const q of s.questions){
      const prompt=qdText(q.prompt,1600).trim(),key=qdPromptKey(prompt);
      if(!prompt)issues.push({qid:q.id,kind:'error',field:'prompt',text:'Вопрос не заполнен'});
      else if(seen.has(key))issues.push({qid:q.id,kind:'warning',field:'prompt',text:'Повторяет другое задание'});
      else seen.set(key,q.id);
      if(['question','practice'].includes(q.type)&&!qdText(q.answer,3500).trim())
        issues.push({qid:q.id,kind:'warning',field:'answer',text:'Не заполнен ответ преподавателя'});
      if(['single','multiple'].includes(q.type)){
        const choices=qdChoices(q.choices),selected=choices.filter(x=>x.correct).length;
        if(choices.some(x=>!x.text.trim()))issues.push({qid:q.id,kind:'error',field:'choice-text',text:'Заполните все варианты ответа'});
        if(selected===0||(q.type==='single'&&selected!==1))
          issues.push({qid:q.id,kind:'error',field:'choice-correct',text:'Неверно отмечены правильные ответы'});
      }
      if(q.type==='numeric'&&qdParseNumber(q.numericAnswer)===null)
        issues.push({qid:q.id,kind:'error',field:'numericAnswer',text:'Введите корректный числовой ответ'});
    }
  }
  return issues;
}
function qdBulkPlan(d,text,targetId){
  const normalized=qdText(text,QD_BULK_MAX_CHARS+1).replace(/\r\n?/g,'\n');
  const lines=normalized.split('\n');
  const base=d.sections.find(s=>s.id===targetId)||d.sections[0];
  const existing=new Set(d.sections.flatMap(s=>s.questions.map(q=>qdPromptKey(q.prompt))).filter(Boolean));
  const sections=new Map(d.sections.map(s=>[qdPromptKey(s.title),s.id]));
  const proposed=new Map(),issues=[],items=[];
  let target=base?.id||'',skipped=0;
  if(normalized.length>QD_BULK_MAX_CHARS)return {ok:false,issues:['Слишком много текста — не более 24 000 символов'],items:[],skipped:0,newSections:0};
  if(lines.length>400)return {ok:false,issues:['Слишком много строк — максимум 400'],items:[],skipped:0,newSections:0};
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    if(!line)continue;
    const header=/^\[([^\]\r\n]{1,120})\]$/.exec(line);
    if(header){
      const name=header[1].trim(),key=qdPromptKey(name);
      if(!name){skipped++;issues.push('Строка '+(i+1)+': пустая тема');continue;}
      if(!sections.has(key)){
        if(proposed.size+d.sections.length>=QD_LIMITS.sections){
          issues.push('Строка '+(i+1)+': достигнут предел 24 разделов');return {ok:false,items:[],issues,skipped,newSections:0};
        }
        const id='bulk-section-'+proposed.size;
        proposed.set(id,name);sections.set(key,id);
      }
      target=sections.get(key);
      continue;
    }
    const practical=/^!\s+/.test(line),clean=practical?line.replace(/^!\s+/,''):line;
    const delimiter=clean.indexOf('|')>=0?'|':clean.indexOf('\t')>=0?'\t':null;
    const cut=delimiter?clean.indexOf(delimiter):-1;
    const prompt=(cut>=0?clean.slice(0,cut):clean).trim();
    const answer=cut>=0?clean.slice(cut+1).trim():'';
    const key=qdPromptKey(prompt);
    if(!prompt){skipped++;issues.push('Строка '+(i+1)+': отсутствует вопрос');continue;}
    if(prompt.length>1600||answer.length>3500){skipped++;issues.push('Строка '+(i+1)+': превышена длина вопроса или ответа');continue;}
    if(existing.has(key)){skipped++;issues.push('Строка '+(i+1)+': повторяющийся вопрос');continue;}
    if(!target){
      if(proposed.size+d.sections.length>=QD_LIMITS.sections)return {ok:false,items:[],issues:['Невозможно создать раздел: достигнут лимит'],skipped,newSections:0};
      if(!proposed.has('bulk-section-empty'))proposed.set('bulk-section-empty','Новые вопросы');
      target='bulk-section-empty';
    }
    existing.add(key);
    items.push({target,prompt,answer,type:practical?'practice':'question'});
    if(qdQuestionList(d).length+items.length>QD_LIMITS.questions){
      issues.push('Достигнут лимит 240 вопросов');return {ok:false,items:[],issues,skipped,newSections:0};
    }
  }
  if(!items.length)return {ok:false,items:[],issues:issues.length?issues:['Нет вопросов для добавления'],skipped,newSections:0};
  const usedNew=new Set(items.map(item=>item.target).filter(id=>proposed.has(id)));
  return {ok:true,items,issues,skipped,newSections:usedNew.size,
    sections:[...proposed.entries()].filter(([id])=>usedNew.has(id)).map(([id,title])=>({id,title}))};
}
function qdBulkCommit(d,plan){
  if(!plan.ok||!plan.items?.length)return false;
  const count=qdQuestionList(d).length;
  if(count+plan.items.length>QD_LIMITS.questions||d.sections.length+plan.newSections>QD_LIMITS.sections)return false;
  const created=new Map();
  for(const s of plan.sections||[]){
    const newSection={id:qdNewId(),title:s.title,questions:[]};
    d.sections.push(newSection);created.set(s.id,newSection.id);
  }
  const byId=new Map(d.sections.map(s=>[s.id,s]));
  for(const item of plan.items){
    const section=byId.get(created.get(item.target)||item.target);
    if(!section)return false;
    section.questions.push({id:qdNewId(),type:item.type,prompt:item.prompt,answer:item.answer,
      points:2,partialCredit:50,choices:qdChoices(),numericAnswer:'',tolerance:0});
  }
  return true;
}


function qdAuditMarkup(d){
  const issues=qdAudit(d),questions=qdQuestionList(d),bad=new Set(issues.map(x=>x.qid));
  return '<div class="qd-audit-summary"><strong>'+(questions.length-bad.size)+' / '+questions.length+' без замечаний</strong><span>'+issues.length+' замечаний</span></div>'+
    (issues.length?'<div class="qd-audit-list">'+issues.slice(0,60).map(issue=>{
      const item=questions.find(q=>q.id===issue.qid);
      return '<button type="button" class="qd-audit-item" data-qd-action="audit-jump" data-qid="'+qdEsc(issue.qid)+'" data-field="'+qdEsc(issue.field)+'">'+
        '<span class="qd-audit-marker '+issue.kind+'">'+(issue.kind==='error'?'Исправить':'Проверить')+'</span>'+
        '<span><strong>'+qdEsc(item?.prompt||'Новый вопрос')+'</strong><small>'+qdEsc(issue.text)+'</small></span></button>';
    }).join('')+'</div>':'<p class="qd-hint">Вопросы заполнены, ошибок не найдено.</p>');
}
function qdBulkPreview(d){
  const plan=qdBulkPlan(d,qdBulkDraft,qdBulkTarget);
  return '<div class="qd-bulk-summary"><strong>'+(plan.ok?'Добавится '+plan.items.length+' заданий':'Нет готовых вопросов')+'</strong>'+
    '<span>Новых разделов: '+(plan.newSections||0)+' · Пропущено: '+plan.skipped+'</span></div>'+
    (plan.issues.length?'<ul class="qd-bulk-warnings">'+plan.issues.slice(0,8).map(x=>'<li>'+qdEsc(x)+'</li>').join('')+'</ul>':'')+
    (plan.ok?'<div class="qd-bulk-items">'+plan.items.slice(0,4).map(x=>'<p><strong>'+qdEsc(x.prompt)+'</strong><small>'+qdEsc(x.answer||'Ответ не задан')+'</small></p>').join('')+'</div>':'')+
    '<button type="button" data-qd-action="bulk-commit" class="qd-primary" '+(plan.ok?'':'disabled')+'>Добавить '+(plan.ok?plan.items.length:0)+' заданий</button>';
}

let qdSearch='',qdFilterKind='all',qdSelected=new Set();
function qdMatchingQuestions(d,search=qdSearch,kind=qdFilterKind){
  const needle=qdPromptKey(search),problem=kind==='issues'?new Set(qdAudit(d).map(x=>x.qid)):null;
  const result=[];
  for(const section of d.sections)for(const q of section.questions){
    if(problem&&!problem.has(q.id))continue;
    if(kind!=='all'&&kind!=='issues'&&q.type!==kind)continue;
    if(needle&&!qdText(section.title+' '+q.prompt+' '+q.answer,6100).replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU').includes(needle))continue;
    result.push(q);
  }
  return result;
}
function qdBatchApply(d,ids,action,value){
  const wanted=new Set(ids);
  if(!wanted.size)return {ok:false,message:'Не выбраны вопросы'};
  const targets=d.sections.flatMap(s=>s.questions.filter(q=>wanted.has(q.id)));
  if(targets.length!==wanted.size)return {ok:false,message:'Выбор устарел — обновите список'};
  if(action==='points'){
    const points=Number(value);
    if(!Number.isInteger(points)||points<1||points>10)return {ok:false,message:'Баллы должны быть от 1 до 10'};
    targets.forEach(q=>q.points=points);
  }else if(action==='type'){
    if(!['question','practice','single','multiple','numeric'].includes(value))return {ok:false,message:'Неверный тип'};
    for(const q of targets)if(q.type!==value){
      q.type=value;
      if(['single','multiple'].includes(value))q.choices=qdChoices(q.choices);
      delete d.session.marks[q.id];delete d.session.responses[q.id];
    }
  }else if(action==='move'){
    const target=d.sections.find(s=>s.id===value);
    if(!target)return {ok:false,message:'Укажите существующий раздел'};
    const incoming=d.sections.filter(s=>s.id!==target.id)
      .flatMap(s=>s.questions.filter(q=>wanted.has(q.id)));
    for(const section of d.sections)if(section.id!==target.id)
      section.questions=section.questions.filter(q=>!wanted.has(q.id));
    target.questions.push(...incoming);
  }else if(action==='delete'){
    for(const section of d.sections)section.questions=section.questions.filter(q=>!wanted.has(q.id));
    for(const q of targets){
      delete d.session.marks[q.id];delete d.session.responses[q.id];qdRevealed.delete(q.id);
      qdCardExpanded.delete(q.id);
    }
    if(wanted.has(qdDisplay(d).activeId))qdDisplay(d).activeId='';
  }else return {ok:false,message:'Неизвестная операция'};
  return {ok:true,count:targets.length};
}
function qdBatchInputs(d,action='points'){
  if(action==='points')return '<label>Баллов за вопрос <input id="qd-batch-value" type="number" min="1" max="10" step="1" value="2"></label>';
  if(action==='type')return '<label>Тип заданий <select id="qd-batch-value">'+
    [['question','Вопрос'],['practice','Практика'],['single','Один ответ'],['multiple','Несколько ответов'],['numeric','Число']]
      .map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('')+'</select></label>';
  if(action==='move')return '<label>Перенести в раздел <select id="qd-batch-value">'+
    d.sections.map(s=>'<option value="'+qdEsc(s.id)+'">'+qdEsc(s.title)+'</option>').join('')+'</select></label>';
  return '<p class="qd-hint">Выбранные задания будут удалены из текущей диагностики; старые записи журнала сохранятся.</p>';
}
function qdSelectionSummary(d){
  const visible=qdMatchingQuestions(d);
  const visibleIds=new Set(visible.map(q=>q.id));
  const selected=qdSelected.size,shown=visible.filter(q=>qdSelected.has(q.id)).length;
  return 'Найдено '+visible.length+' из '+qdQuestionList(d).length+' · Выбрано '+selected+
    (selected&&shown!==selected?' (в фильтре '+shown+')':'');
}


/* TASK110: non-destructive, reproducible parallel assessment variants. */
let qdVariantsOpen=false;
let qdVariantOptions={count:2,perSection:0,seed:'2026',shuffleChoices:true};
const QD_VARIANT_NAMES=['А','Б','В','Г'];
function qdVariantHash(value){
  let x=2166136261;
  for(const ch of String(value)){x^=ch.charCodeAt(0);x=Math.imul(x,16777619);}
  return x>>>0;
}
function qdVariantShuffle(items,seed){
  const copy=items.slice();let x=(seed>>>0)||0x6d2b79f5;
  for(let i=copy.length-1;i>0;i--){
    x^=x<<13;x^=x>>>17;x^=x<<5;
    const j=(x>>>0)%(i+1);
    [copy[i],copy[j]]=[copy[j],copy[i]];
  }
  return copy;
}
function qdVariantsBuild(d,opts=qdVariantOptions){
  const count=Number(opts.count),size=Number(opts.perSection);
  if(!Number.isInteger(count)||count<2||count>4)return {ok:false,error:'Выберите от 2 до 4 вариантов'};
  if(!Number.isInteger(size)||size<0||size>240)return {ok:false,error:'Неверное количество вопросов на раздел'};
  const rawSeed=String(opts.seed??'').trim();
  if(!rawSeed||rawSeed.length>40)return {ok:false,error:'Введите короткий ключ генерации'};
  const groups=d.sections.map(s=>({
    title:s.title,questions:s.questions.filter(q=>qdText(q.prompt,1600).trim())
  })).filter(s=>s.questions.length);
  if(!groups.length)return {ok:false,error:'Сначала заполните хотя бы один вопрос'};
  if(size&&groups.some(s=>s.questions.length<size))
    return {ok:false,error:'Не хватает вопросов: в каждом непустом разделе должно быть не менее '+size};
  const ignored=d.sections.reduce((sum,s)=>sum+s.questions.length,0)-
    groups.reduce((sum,s)=>sum+s.questions.length,0);
  const variants=[];
  for(let v=0;v<count;v++){
    const sections=[];
    for(let si=0;si<groups.length;si++){
      const section=groups[si],pool=qdVariantShuffle(section.questions,qdVariantHash(rawSeed+'|'+si));
      const amount=size||pool.length;
      const picked=size?
        Array.from({length:amount},(_,i)=>pool[(v*amount+i)%pool.length]):
        pool.slice();
      const shuffled=qdVariantShuffle(picked,qdVariantHash(rawSeed+'|order|'+v+'|'+si));
      sections.push({id:qdNewId(),title:section.title,questions:shuffled.map((q,qi)=>{
        const copy=qdCopyCard(q);
        if(opts.shuffleChoices&&['single','multiple'].includes(copy.type))
          copy.choices=qdVariantShuffle(copy.choices,qdVariantHash(rawSeed+'|options|'+v+'|'+si+'|'+qi));
        return copy;
      })});
    }
    const title=qdText(d.title,98)+' — Вариант '+QD_VARIANT_NAMES[v];
    const doc=qdNormalize({title,description:d.description,sections,
      session:{student:'',studentId:'',marks:{},responses:{}},students:[],history:[],
      display:{mode:'list',activeId:''}});
    const questions=qdQuestionList(doc);
    variants.push({label:QD_VARIANT_NAMES[v],document:doc,
      count:questions.length,maxPoints:questions.reduce((sum,q)=>sum+qdPoints(q.points),0)});
  }
  return {ok:true,variants,ignored,sectionCount:groups.length,seed:rawSeed};
}

/* TASK111 — printable student sheets and separate teacher answer keys. */
function qdVariantPaperHTML(variant,kind='student'){
  if(!variant?.document?.sections||!['student','key'].includes(kind))return '';
  const doc=variant.document,teacher=kind==='key',label=variant.label;
  const title=qdEsc(doc.title||'Проверочная работа');
  const count=doc.sections.reduce((n,s)=>n+s.questions.length,0);
  const points=doc.sections.reduce((n,s)=>n+s.questions.reduce((m,q)=>m+qdPoints(q.points),0),0);
  const entries=doc.sections.map((section,si)=>'<section class="topic"><h2>'+(si+1)+'. '+qdEsc(section.title)+'</h2>'+
    section.questions.map((q,qi)=>{
      const answer=qdReference(q);
      const options=['single','multiple'].includes(q.type)?qdChoices(q.choices):[];
      const opts=options.length?
        '<ol class="answers" type="A">'+options.map(c=>
          '<li><span class="choice-box">'+(q.type==='multiple'?'□':'○')+'</span> '+qdEsc(c.text||'Не заполнено')+'</li>'
        ).join('')+'</ol>':'';
      const numeric=q.type==='numeric'&&!teacher?
        '<div class="write-line">Ответ: ______________________________</div>':'';
      const writing=!teacher&&!options.length&&q.type!=='numeric'?
        '<div class="write-lines"><span></span><span></span>'+
          (q.type==='practice'?'<span></span><span></span>':'')+'</div>':'';
      const solution=teacher?
        '<div class="solution"><strong>Ответ и критерии</strong><div>'+qdEsc(answer).replace(/\n/g,'<br>')+'</div>'+
          '<small>Полный ответ: '+qdPoints(q.points)+' балл(ов) · частичный: '+qdPartialCredit(q.partialCredit)+'%</small></div>':'';
      return '<article class="question"><div class="question-head"><span class="question-number">'+(qi+1)+'.</span>'+
        '<div class="question-text">'+qdEsc(q.prompt||'Вопрос не заполнен').replace(/\n/g,'<br>')+'</div>'+
        '<span class="points">'+qdPoints(q.points)+' б.</span></div>'+
        opts+numeric+writing+solution+'</article>';
    }).join('')+'</section>').join('');
  const purpose=teacher?'Ключ ответов — только преподавателю':'Бланк для ученика';
  return '<!doctype html><html lang="ru"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>'+qdEsc(purpose)+' · '+title+'</title>'+
    '<style>'+
    '@page{size:A4;margin:17mm 16mm}'+
    '*{box-sizing:border-box}body{font:13px/1.5 Arial,Helvetica,sans-serif;color:#202833;background:#fff;margin:0 auto;max-width:900px;padding:22px}'+
    '.doc-head{border-bottom:2px solid #263a56;padding-bottom:13px;margin-bottom:22px}'+
    '.eyebrow{color:#55667d;font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:700}'+
    'h1{font-size:23px;line-height:1.25;margin:5px 0 8px}'+
    '.byline{font-size:11px;color:#526278;display:flex;gap:18px;flex-wrap:wrap}'+
    '.pupil{margin:16px 0 0;display:flex;gap:20px;flex-wrap:wrap;font-size:12px}'+
    '.topic{margin:24px 0;break-inside:auto}h2{font-size:15px;border-bottom:1px solid #ced6e0;padding-bottom:6px;margin:0 0 12px;break-after:avoid}'+
    '.question{margin:0 0 19px;break-inside:avoid-page;page-break-inside:avoid}'+
    '.question-head{display:flex;gap:9px;align-items:baseline;line-height:1.55}'+
    '.question-number{font-weight:700;flex:none}.question-text{flex:1;overflow-wrap:anywhere}'+
    '.points{flex:none;font-size:11px;color:#526278;white-space:nowrap}'+
    '.answers{margin:8px 0 0 25px;padding-left:15px;display:grid;gap:6px}'+
    '.choice-box{display:inline-block;width:16px;color:#2d3e55}'+
    '.write-line{margin:12px 0 0 25px;min-height:32px}'+
    '.write-lines{display:grid;margin:9px 0 0 25px;gap:7px}'+
    '.write-lines span{border-bottom:1px solid #cbd3de;min-height:21px}'+
    '.solution{margin:10px 0 0 25px;padding:11px 13px;border-left:3px solid #35678a;background:#f4f7fa;overflow-wrap:anywhere}'+
    '.solution strong{display:block;margin-bottom:4px;font-size:11px}'+
    '.solution small{display:block;margin-top:7px;color:#57687f;font-size:10px}'+
    '.page-footer{border-top:1px solid #d1d8e0;margin-top:25px;padding-top:8px;color:#536279;font-size:10px}'+
    '@media print{body{padding:0;max-width:none}.question{break-inside:avoid-page}.solution{print-color-adjust:exact;-webkit-print-color-adjust:exact}}'+
    '</style></head><body><header class="doc-head"><div class="eyebrow">'+qdEsc(purpose)+'</div>'+
    '<h1>'+title+'</h1><div class="byline"><span>Вариант '+qdEsc(label)+'</span>'+
    '<span>Вопросов: '+count+'</span><span>Максимум: '+points+' баллов</span></div>'+
    (teacher?'':'<div class="pupil"><span>ФИО: __________________________________</span>'+
      '<span>Класс: __________</span><span>Дата: ______________</span></div>')+
    '</header>'+entries+'<footer class="page-footer">'+
      (teacher?'Лист ответов преподавателя. Не выдавайте ученикам.':'Проверочная работа · Вариант '+qdEsc(label))+
    '</footer></body></html>';
}
function qdVariantPrintDownload(d,index,kind){
  const generated=qdVariantsBuild(d);
  if(!generated.ok)return {ok:false,message:generated.error};
  if(!Number.isInteger(index)||index<0||index>=generated.variants.length)
    return {ok:false,message:'Вариант не найден'};
  if(!['student','key'].includes(kind))return {ok:false,message:'Неизвестный вид бланка'};
  const variant=generated.variants[index],html=qdVariantPaperHTML(variant,kind);
  if(!html)return {ok:false,message:'Не удалось создать бланк'};
  const file=(typeof safeFile==='function'?safeFile(d.title):'diagnostic')+
    '-variant-'+variant.label+'-'+(kind==='key'?'answers':'student')+'.html';
  download(file,html,'text/html;charset=utf-8');
  return {ok:true,file};
}

function qdVariantPreview(d){
  const result=qdVariantsBuild(d);
  if(!result.ok)return '<p class="qd-variant-error" role="status">'+qdEsc(result.error)+'</p>';
  return '<div class="qd-variant-summary">Вопросы распределены по '+result.sectionCount+
    ' темам · пропущено незаполненных: '+result.ignored+
    ' · источник остаётся без изменений</div><div class="qd-variant-grid">'+
    result.variants.map((v,i)=>'<article class="qd-variant-card"><div>'+
      '<strong>Вариант '+v.label+'</strong><span>'+v.count+' вопросов · '+v.maxPoints+' баллов</span></div>'+
      '<div class="qd-variant-topics">'+v.document.sections.map(s=>
        '<p><b>'+qdEsc(s.title)+'</b><span>'+s.questions.length+' вопросов</span></p>').join('')+'</div>'+
      '<div class="qd-variant-actions">'+
      '<button type="button" data-qd-action="variant-download" data-variant-index="'+i+
        '" title="Открывается в конструкторе Quantum Writer">Диагностика .qdiag</button>'+
      '<button type="button" data-qd-action="variant-print" data-variant-kind="student" data-variant-index="'+i+
        '" class="qd-primary">Бланк ученика</button>'+
      '<button type="button" data-qd-action="variant-print" data-variant-kind="key" data-variant-index="'+i+
        '">Ключ ответов</button></div></article>').join('')+
    '</div><p class="qd-hint">При одинаковом ключе генерации распределение вопросов повторяется; '+
    'при разных баллах у заданий сумма баллов между вариантами может отличаться. '+
    'Каждый файл создаётся без учеников, оценок и истории.</p>';
}
function qdVariantsMarkup(d){
  const opts=qdVariantOptions;
  return '<details class="qd-utility-details qd-variants-tool" data-qd-pane="variants" '+(qdVariantsOpen?'open':'')+'>'+
    '<summary>Варианты проверочной работы <span>А / Б / В / Г</span></summary>'+
    '<div class="qd-utility-content"><p class="qd-hint">Соберите несколько вариантов из текущих тем. '+
      'Варианты можно открывать как отдельные диагностики. Исходный документ не изменяется.</p>'+
      '<div class="qd-variant-controls"><label>Количество вариантов<select id="qd-var-count">'+
        [2,3,4].map(n=>'<option value="'+n+'" '+(opts.count===n?'selected':'')+'>'+n+'</option>').join('')+
      '</select></label><label>Вопросов из каждого раздела<select id="qd-var-per-section">'+
        '<option value="0" '+(opts.perSection===0?'selected':'')+'>Все вопросы</option>'+
        Array.from({length:12},(_,i)=>i+1).map(n=>
          '<option value="'+n+'" '+(opts.perSection===n?'selected':'')+'>'+n+'</option>').join('')+
      '</select></label><label>Ключ вариантов<input type="text" maxlength="40" id="qd-var-seed" value="'+qdEsc(opts.seed)+
      '" placeholder="Например, ноябрь-2026"></label><label class="qd-variant-checkbox">'+
      '<input type="checkbox" id="qd-var-choices" '+(opts.shuffleChoices?'checked':'')+'>'+
      'Перемешивать варианты ответов</label></div>'+
      '<div id="qd-variant-preview" aria-live="polite">'+(qdVariantsOpen?qdVariantPreview(d):'<p class="qd-hint">Откройте панель для настройки вариантов.</p>')+'</div></div></details>';
}
function qdVariantPreviewRefresh(){
  const preview=document.getElementById('qd-variant-preview');
  if(preview)preview.innerHTML=qdVariantPreview(qdDoc());
}

function qdBuilderUtilities(d){
  const issues=qdAudit(d);
  return '<div class="qd-panel qd-builder-utilities">'+
    '<div class="qd-utility-actions"><strong>Инструменты конструктора</strong><button data-qd-action="compact-mode" type="button">'+(qdCompact?'Развернуть все':'Компактный список')+'</button></div>'+
    '<details data-qd-pane="audit" class="qd-utility-details" '+(qdAuditOpen?'open':'')+'><summary>Проверка заданий <span>'+issues.length+' замечаний</span></summary>'+
    '<div id="qd-audit-body" class="qd-utility-content">'+qdAuditMarkup(d)+'</div></details>'+
    '<details data-qd-pane="bulk" class="qd-utility-details" '+(qdBulkOpen?'open':'')+'><summary>Массовое добавление вопросов <span>Из текста</span></summary>'+
    '<div class="qd-utility-content qd-bulk-panel"><p class="qd-hint">Одна строка — вопрос | ответ. Для новой темы напишите [Название]. Знак ! и пробел в начале строки означают практику.</p>'+
    '<pre class="qd-bulk-example">[Теплопередача]\nКак тепло приходит от Солнца? | Излучением\n! Найди количество теплоты. | Q = cmΔt</pre>'+
    '<label>Раздел без заголовка<select id="qd-bulk-target">'+d.sections.map(s=>'<option value="'+qdEsc(s.id)+'" '+(s.id===(qdBulkTarget||d.sections[0]?.id)?'selected':'')+'>'+qdEsc(s.title)+'</option>').join('')+'</select></label>'+
    '<label>Вставьте вопросы<textarea id="qd-bulk-text" rows="6" maxlength="'+QD_BULK_MAX_CHARS+'">'+qdEsc(qdBulkDraft)+'</textarea></label>'+
    '<div id="qd-bulk-preview" aria-live="polite">'+qdBulkPreview(d)+'</div></div></details>'+qdVariantsMarkup(d)+'</div>';
}


function qdBatchToolbar(d){
  const kinds=[['all','Все задания'],['question','Вопросы'],['practice','Практика'],['single','Один ответ'],
    ['multiple','Несколько ответов'],['numeric','Числа'],['issues','С замечаниями']];
  return '<section class="qd-panel qd-manage-bar" aria-label="Поиск и массовое редактирование">'+
    '<div class="qd-manage-filter"><label>Поиск<input type="search" id="qd-search" maxlength="160" value="'+qdEsc(qdSearch)+'" placeholder="Вопрос, ответ или тема"></label>'+
    '<label>Фильтр<select id="qd-filter-kind">'+kinds.map(([k,label])=>'<option value="'+k+'" '+(k===qdFilterKind?'selected':'')+'>'+label+'</option>').join('')+'</select></label>'+
    '<span id="qd-filter-count" aria-live="polite"></span></div>'+
    '<div class="qd-manage-select"><button type="button" data-qd-action="select-visible">Выбрать найденные</button>'+
    '<button type="button" data-qd-action="selection-clear">Снять выделение</button>'+
    '<strong id="qd-selection-count">'+qdSelected.size+' выбрано</strong></div>'+
    '<div class="qd-batch-editor"><label>Массовое действие<select id="qd-batch-action">'+
    '<option value="points">Изменить баллы</option><option value="type">Изменить тип</option>'+
    '<option value="move">Перенести в раздел</option><option value="delete">Удалить вопросы</option></select></label>'+
    '<div id="qd-batch-inputs">'+qdBatchInputs(d)+'</div>'+
    '<button type="button" data-qd-action="batch-apply" class="qd-primary">Применить к выбранным</button></div>'+
    '<p class="qd-hint">Массовое действие затрагивает все выбранные карточки, в том числе скрытые фильтром.</p></section>';
}
function qdApplyFilterUI(){
  if(qdMode!=='builder')return;
  const root=document.getElementById('qo-diag-root'),d=qdDoc();
  if(!root)return;
  const visible=new Set(qdMatchingQuestions(d).map(q=>q.id)),active=!!qdSearch.trim()||qdFilterKind!=='all';
  for(const section of root.querySelectorAll('.qd-editor-section')){
    let shown=0;
    for(const card of section.querySelectorAll('.qd-edit-card')){
      const show=visible.has(card.dataset.qid);
      card.hidden=!show;card.classList.toggle('qd-selected',qdSelected.has(card.dataset.qid));
      if(show)shown++;
    }
    section.hidden=!shown&&(active||!!section.querySelector('.qd-edit-card'));
    section.classList.toggle('qd-section-collapsed',!active&&qdCollapsedSections.has(section.dataset.section));
  }
  const count=root.querySelector('#qd-filter-count');
  if(count)count.textContent='Найдено '+visible.size+' из '+qdQuestionList(d).length;
  const countSelected=root.querySelector('#qd-selection-count');
  if(countSelected)countSelected.textContent=qdSelected.size+' выбрано';
  const empty=root.querySelector('#qd-no-matches');
  if(empty)empty.hidden=visible.size>0||!active;
  for(const button of root.querySelectorAll('[data-qd-action="batch-apply"],[data-qd-action="selection-clear"]'))
    button.disabled=!qdSelected.size;
}


/* TASK119 — save and update the *question template* right from the builder.
   A template deliberately excludes pupils, sessions, marks and result history. */
function qdBuilderTemplateDefaults(d){
  const my=qdLibraryRead(),existing=my.find(x=>qdPromptKey(x.title)===qdPromptKey(d.title));
  const preset=QD_PRESETS.find(p=>qdPromptKey(qdTemplate(p.id)?.title)===qdPromptKey(d.title));
  const subject=existing?.subject||preset?.subject||
    Object.entries(QD_SUBJECTS).find(([,label])=>d.title.startsWith(label))?.[0]||'other';
  const grade=existing?.grade||preset?.grade||d.title.match(/(?:^|\D)([5-9])\s*класс/i)?.[1]||'8';
  return {my,existing,subject,grade,purpose:existing?.purpose||preset?.purpose||'diagnostic'};
}
function qdBuilderSignature(d){
  return JSON.stringify({title:d.title,description:d.description,
    sections:d.sections.map(s=>({title:s.title,questions:s.questions.map(q=>({
      prompt:q.prompt,answer:q.answer,type:q.type,points:q.points,
      partialCredit:q.partialCredit,choices:q.choices,numericAnswer:q.numericAnswer,tolerance:q.tolerance
    }))}))});
}
function qdBuilderSaveStatus(){
  const label=document.getElementById('qd-builder-save-state');
  if(label)label.textContent=qdBuilderSavedSignature&&qdBuilderSavedSignature===qdBuilderSignature(qdDoc())?
    'Все изменения сохранены в шаблоне':'Локальный черновик · шаблон не обновлён';
}
function qdBuilderTemplateMarkup(d){
  const meta=qdBuilderTemplateDefaults(d);
  const options=(values,selected)=>values.map(([key,label])=>'<option value="'+qdEsc(key)+
    '" '+(key===selected?'selected':'')+'>'+qdEsc(label)+'</option>').join('');
  return '<section class="qd-panel qd-builder-save" aria-label="Сохранение шаблона диагностики">'+
    '<div class="qd-builder-save-head"><div><h2>Сохранить изменения в шаблон</h2>'+
    '<p>Исправленные вопросы и ответы можно сохранить как свой шаблон или обновить ранее созданный.</p></div>'+
    '<span>'+qdQuestionList(d).length+' заданий</span></div>'+
    '<div class="qd-builder-save-fields">'+
      '<label>Предмет<select id="qd-builder-template-subject">'+
        options(Object.entries(QD_SUBJECTS),meta.subject)+'</select></label>'+
      '<label>Класс<input id="qd-builder-template-grade" maxlength="18" value="'+qdEsc(meta.grade)+'"></label>'+
      '<label>Цель<select id="qd-builder-template-purpose">'+
        options(Object.entries(QD_PURPOSES),meta.purpose)+'</select></label>'+
      '<label>Мой шаблон для обновления<select id="qd-builder-template-target">'+
        '<option value="">Выберите сохранённый шаблон</option>'+
        meta.my.map(t=>'<option value="'+qdEsc(t.id)+'" '+(meta.existing?.id===t.id?'selected':'')+
          '>'+qdEsc(t.title)+'</option>').join('')+'</select></label>'+
    '</div>'+
    '<div class="qd-builder-revisions"><label>Предыдущие версии выбранного шаблона'+
      '<select id="qd-builder-template-revision">'+
        qdTemplateVersionOptions(meta.existing?.id||'')+'</select></label>'+
      '<button type="button" data-qd-action="builder-template-restore" '+(!meta.existing?'disabled':'')+
        '>Восстановить версию в библиотеке</button></div>'+
    '<div class="qd-builder-save-actions">'+
      '<button type="button" class="qd-primary" data-qd-action="builder-template-save">Сохранить как новый шаблон</button>'+
      '<button type="button" data-qd-action="builder-template-update" '+(!meta.my.length?'disabled':'')+
        '>Обновить мой шаблон</button>'+
      '<button type="button" data-qd-action="builder-template-export" '+(!meta.my.length?'disabled':'')+
        '>Скачать библиотеку .qtpl</button></div>'+
    '<p class="qd-hint">Встроенные шаблоны не перезаписываются: исправленную версию сохраните как собственную. '+
      'Шаблон содержит только задания, без учеников и результатов. Для переноса на другое устройство скачайте .qtpl.</p>'+
    '</section>';
}
function qdBuilderSaveTemplate(d,mode,target,fields){
  if(mode==='new')return qdLibrarySaveCurrent(d,fields.subject,fields.grade,fields.purpose);
  if(mode!=='update'||!target)return {ok:false,message:'Выберите свой шаблон для обновления'};
  return qdLibraryUpdate(target,{
    title:d.title,description:d.description,subject:fields.subject,
    grade:fields.grade,purpose:fields.purpose
  },d,true);
}

function qdBuilder(){
  const d=qdDoc(),count=qdQuestionList(d).length;
  return `<div class="qd-editor">
    <div class="qd-builder-actionbar">
      <strong>Конструктор</strong><span id="qd-builder-save-state">${qdBuilderSavedSignature&&qdBuilderSavedSignature===qdBuilderSignature(d)?
        'Все изменения сохранены в шаблоне':'Локальный черновик · шаблон не обновлён'}</span>
      <button data-qd-action="builder-quick-save" class="qd-primary" type="button">Сохранить шаблон</button>
      <button data-qd-action="bank-open" type="button">Банк вопросов</button>
    </div>
    <div class="qd-panel qd-meta">
      <label>Название диагностики<input data-qd-field="title" maxlength="120" value="${qdEsc(d.title)}"></label>
      <label>Описание<textarea data-qd-field="description" maxlength="600" rows="2">${qdEsc(d.description)}</textarea></label>
      <div class="qd-row qd-wrap qd-builder-tools">
        <span class="qd-count-pill">${count} / ${QD_LIMITS.questions} заданий · ${d.sections.length} разделов</span>
        <button data-qd-action="sample" type="button">Пример: физика, 8 класс</button>
        <label class="qd-template-selector">Готовые диагностики
          <select id="qd-template-pick" aria-label="Выбрать готовую диагностику">
            ${QD_PRESETS.map(p=>'<option value="'+qdEsc(p.id)+'">'+qdEsc(QD_SUBJECTS[p.subject]||'Другое')+
              ' · '+qdEsc(p.grade)+' класс · '+qdEsc(p.label)+'</option>').join('')}
          </select></label>
        <button data-qd-action="use-template" type="button">Создать из шаблона</button>
        <button data-qd-action="sample-auto" type="button">+ Автоматические задания</button>
        <button data-qd-action="add-section" type="button">+ Раздел</button>
      </div>
      <p class="qd-hint">Перетаскивайте карточки за значок захвата или используйте стрелки и меню разделов.</p>
    </div>
    ${qdBuilderUtilities(d)}
    ${typeof qdBankMarkup==='function'?qdBankMarkup():''}
    ${qdBatchToolbar(d)}
    <p id="qd-no-matches" class="qd-empty-filter" hidden>По вашему запросу ничего не найдено.</p>
    ${d.sections.map((s,si)=>`<section class="qd-section qd-editor-section ${qdCollapsedSections.has(s.id)?'qd-section-collapsed':''}" data-section="${qdEsc(s.id)}">
      <div class="qd-section-head">
        <span class="qd-index">${si+1}</span>
        <label>Название раздела<input data-qd-field="section" data-sid="${qdEsc(s.id)}" maxlength="120" value="${qdEsc(s.title)}"></label>
        <div class="qd-section-actions">
          <button data-qd-action="section-up" data-sid="${qdEsc(s.id)}" type="button" ${si===0?'disabled':''} title="Раздел выше" aria-label="Раздел выше">↑</button>
          <button data-qd-action="section-down" data-sid="${qdEsc(s.id)}" type="button" ${si===d.sections.length-1?'disabled':''} title="Раздел ниже" aria-label="Раздел ниже">↓</button>
          <button data-qd-action="section-collapse" data-sid="${qdEsc(s.id)}" type="button"
     aria-expanded="${!qdCollapsedSections.has(s.id)}">${qdCollapsedSections.has(s.id)?'Развернуть':'Свернуть'}</button>
   <button data-qd-action="duplicate-section" data-sid="${qdEsc(s.id)}" type="button" title="Копировать раздел вместе с заданиями">Копия раздела</button>
   <button data-qd-action="delete-section" data-sid="${qdEsc(s.id)}" type="button">Удалить</button>
        </div>
      </div>
      <div class="qd-question-list" data-qd-drop-section="${qdEsc(s.id)}">
      ${s.questions.map((q,qi)=>`<article class="qd-card qd-edit-card ${qdCompact&&!qdCardExpanded.has(q.id)?'is-compact':''}" data-qid="${qdEsc(q.id)}" data-section-id="${qdEsc(s.id)}">
        <div class="qd-card-head">
          <span class="qd-drag-handle" data-qd-drag="${qdEsc(q.id)}" tabindex="0" title="Перетащите карточку" aria-label="Перетащить вопрос">⠿</span>
          <input type="checkbox" class="qd-select-card" data-qd-select data-qid="${qdEsc(q.id)}"
              aria-label="Выбрать вопрос ${qi+1}" ${qdSelected.has(q.id)?'checked':''}>
          <span class="qd-counter">Вопрос ${qi+1}</span>
           <span class="qd-card-preview" title="${qdEsc(q.prompt)}">${qdEsc(q.prompt||'Новый вопрос')}</span>
           ${qdCompact?`<button type="button" data-qd-action="card-expand" data-qid="${qdEsc(q.id)}">${qdCardExpanded.has(q.id)?'Свернуть':'Редактировать'}</button>`:''}
          <select data-qd-field="type" data-qid="${qdEsc(q.id)}" aria-label="Тип задания">
            <option value="question" ${q.type==='question'?'selected':''}>Вопрос</option>
            <option value="practice" ${q.type==='practice'?'selected':''}>Практика</option>
            <option value="single" ${q.type==='single'?'selected':''}>Выбор одного</option>
            <option value="multiple" ${q.type==='multiple'?'selected':''}>Несколько ответов</option>
            <option value="numeric" ${q.type==='numeric'?'selected':''}>Число</option>
          </select>
          <button type="button" data-qd-action="question-up" data-qid="${qdEsc(q.id)}" ${qi===0?'disabled':''} aria-label="Поднять вопрос" title="Поднять вопрос">↑</button>
          <button type="button" data-qd-action="question-down" data-qid="${qdEsc(q.id)}" ${qi===s.questions.length-1?'disabled':''} aria-label="Опустить вопрос" title="Опустить вопрос">↓</button>
          <button type="button" data-qd-action="duplicate-question" data-qid="${qdEsc(q.id)}" title="Создать копию">Копия</button>
          <button type="button" data-qd-action="delete-question" data-qid="${qdEsc(q.id)}" data-sid="${qdEsc(s.id)}" title="Удалить вопрос">×</button>
        </div>
        <label>Что спросить у ученика<textarea data-qd-field="prompt" data-qid="${qdEsc(q.id)}" maxlength="1600" rows="2" placeholder="Введите вопрос">${qdEsc(q.prompt)}</textarea></label>
        <label>Ответ преподавателя (скрыт при проведении)<textarea data-qd-field="answer" data-qid="${qdEsc(q.id)}" maxlength="3500" rows="2" placeholder="Пояснение или решение">${qdEsc(q.answer)}</textarea></label>
        ${['single','multiple'].includes(q.type)?`<div class="qd-choices-editor">
          <strong>Варианты ответов · отметьте правильные</strong>
          ${qdChoices(q.choices).map((choice,i)=>`<div class="qd-choice-edit">
            <input type="${q.type==='single'?'radio':'checkbox'}" name="qd-correct-${qdEsc(q.id)}" data-qd-field="choice-correct"
              data-qid="${qdEsc(q.id)}" data-index="${i}" ${choice.correct?'checked':''}
              title="Правильный вариант ${i+1}" aria-label="Правильный вариант ${i+1}">
            <input data-qd-field="choice-text" data-qid="${qdEsc(q.id)}" data-index="${i}" maxlength="240"
              value="${qdEsc(choice.text)}" placeholder="Вариант ${i+1}" aria-label="Текст варианта ${i+1}">
            <button type="button" data-qd-action="remove-choice" data-qid="${qdEsc(q.id)}" data-index="${i}"
              ${q.choices.length<=2?'disabled':''} aria-label="Удалить вариант ${i+1}">×</button>
          </div>`).join('')}
          <button type="button" data-qd-action="add-choice" data-qid="${qdEsc(q.id)}"
            ${q.choices.length>=6?'disabled':''}>+ Вариант</button>
          <p class="qd-hint">Автопроверка работает, когда все варианты заполнены и указан правильный ответ.</p>
        </div>`:''}
        ${q.type==='numeric'?`<div class="qd-numeric-editor">
          <label>Правильное числовое значение<input data-qd-field="numericAnswer" data-qid="${qdEsc(q.id)}"
            type="text" maxlength="60" inputmode="decimal" value="${qdEsc(q.numericAnswer||'')}" placeholder="Например, 84 или 84,5"></label>
          <label>Допустимая абсолютная погрешность<input data-qd-field="tolerance" data-qid="${qdEsc(q.id)}"
            type="number" min="0" max="1000000000" step="any" value="${qdTolerance(q.tolerance)}"></label>
        </div>`:''}
        <div class="qd-card-bank-tools"><button type="button" data-qd-action="bank-save-question"
          data-qid="${qdEsc(q.id)}">Сохранить вопрос в банк</button></div>
        <div class="qd-settings">
          <label>Баллы за ответ<input data-qd-field="points" data-qid="${qdEsc(q.id)}" type="number" min="1" max="10" step="1" value="${qdPoints(q.points)}"></label>
          <label>За частичный ответ, %<input data-qd-field="partialCredit" data-qid="${qdEsc(q.id)}" type="number" min="0" max="100" step="5" value="${qdPartialCredit(q.partialCredit)}"></label>
          <label>Перенести в раздел<select data-qd-field="move-section" data-qid="${qdEsc(q.id)}" aria-label="Перенести вопрос в раздел"><option value="${qdEsc(s.id)}">Текущий раздел</option>
          ${d.sections.filter(other=>other.id!==s.id).map(other=>`<option value="${qdEsc(other.id)}">${qdEsc(other.title)}</option>`).join('')}</select></label>
        </div>
      </article>`).join('')}</div>
      ${qdQuickMarkup(s)}
       <button type="button" data-qd-action="add-question" data-sid="${qdEsc(s.id)}">+ Пустая карточка</button></section>`).join('')}
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
    ${qdBuilderTemplateMarkup(d)}
    <div class="qd-panel qd-bottom-actions">
      <button data-qd-action="add-section" type="button">+ Новый раздел</button>
      <button type="button" data-qd-action="preview-chat">Просмотреть карточки как в чате</button>
      <button data-qd-action="mode" data-mode="run" class="qd-primary" type="button">Перейти к проведению</button>
    </div>
  </div>`;
}
function qdDateLabel(value){
  const date=new Date(value||'');return Number.isFinite(date.getTime())?date.toLocaleString('ru-RU'):'Дата неизвестна';
}
function qdTypeTitle(type){
  return ({question:'Вопрос',practice:'Практика',single:'Один правильный ответ',
    multiple:'Несколько ответов',numeric:'Числовой ответ'})[type]||'Вопрос';
}
function qdAutoInput(q,response){
  if(!qdAuto(q.type))return '';
  const v=qdNormalizeResponse(q,response);
  if(q.type==='numeric')return `<div class="qd-auto-input">
    <label>Ваш числовой ответ<input data-qd-field="numeric-response" data-qid="${qdEsc(q.id)}"
      maxlength="80" type="text" inputmode="decimal" value="${qdEsc(v.value)}" placeholder="Введите число"></label>
  </div>`;
  return `<div class="qd-auto-input" role="group" aria-label="Варианты ответа">
    ${qdChoices(q.choices).map((c,i)=>`<label class="qd-student-option">
      <input type="${q.type==='single'?'radio':'checkbox'}" data-qd-field="auto-selection"
        name="qd-answer-${qdEsc(q.id)}" data-qid="${qdEsc(q.id)}" data-index="${i}"
        ${v.selected.includes(i)?'checked':''}><span>${qdEsc(c.text||'Вариант не заполнен')}</span>
    </label>`).join('')}
  </div>`;
}
function qdReference(q){
  let details='';
  if(['single','multiple'].includes(q.type)){
    const correct=qdChoices(q.choices).filter(c=>c.correct&&c.text.trim()).map(c=>c.text);
    if(correct.length)details='Правильные варианты: '+correct.join('; ');
  }
  if(q.type==='numeric')details='Числовой ответ: '+(q.numericAnswer||'не задан')+' (± '+qdTolerance(q.tolerance)+')';
  return [details,q.answer].filter(Boolean).join('\n\n')||'Ответ не заполнен';
}
function qdDisplay(d=qdDoc()){
  if(!d.display||typeof d.display!=='object')d.display={mode:'focus',activeId:''};
  return d.display;
}
function qdCurrentIndex(d=qdDoc(),all=qdQuestionList(d)){
  if(!all.length)return -1;
  const requested=all.findIndex(q=>q.id===qdDisplay(d).activeId);
  if(requested>=0)return requested;
  const pending=all.findIndex(q=>!QD_STATES.includes(d.session.marks[q.id]));
  return pending>=0?pending:0;
}
function qdSelectQuestion(d,index){
  const all=qdQuestionList(d);
  if(!Number.isInteger(index)||index<0||index>=all.length)return false;
  qdDisplay(d).activeId=all[index].id;
  return true;
}
function qdAdvance(d){
  const all=qdQuestionList(d),index=qdCurrentIndex(d,all);
  if(index>=0&&index<all.length-1)qdSelectQuestion(d,index+1);
}
function qdRunQuestion(q,number,d){
  const mark=d.session.marks[q.id],visible=qdRevealed.has(q.id),points=qdPoints(q.points);
  const hasPrompt=!!qdText(q.prompt,1600).trim();
  const markButton=(state,title)=>'<button type="button" data-qd-action="mark" data-qid="'+qdEsc(q.id)+
    '" data-mark="'+state+'" '+(hasPrompt?'':'disabled title="Заполните вопрос в конструкторе"')+' aria-pressed="'+(mark===state)+'" class="'+(mark===state?'selected':'')+
    '">'+title+'</button>';
  return '<article class="qd-card qd-run-card qd-chat-card '+(mark?'qd-mark-'+mark:'')+'" data-qid="'+qdEsc(q.id)+'">'+
    '<div class="qd-chat-head"><div class="qd-question"><span class="qd-counter">'+(number+1)+'.</span><div>'+
      '<span class="qd-type">'+qdEsc(qdTypeTitle(q.type))+' · '+points+' '+(points===1?'балл':points<5?'балла':'баллов')+'</span>'+
      '<p>'+qdEsc(q.prompt||'Вопрос пока не заполнен').replace(/\n/g,'<br>')+'</p></div></div>'+
      '<div class="qd-rating qd-chat-rating" role="group" aria-label="Оценка ответа">'+
        markButton('yes','✓ Знает')+markButton('no','× Не знает')+
        markButton('partial','◐ Частично')+'</div></div>'+
    qdAutoInput(q,d.session.responses[q.id])+
    '<div class="qd-card-actions qd-chat-actions">'+
      '<button type="button" class="qd-answer-toggle" data-qd-action="reveal" data-qid="'+qdEsc(q.id)+
        '" aria-expanded="'+visible+'">'+(visible?'◉ Скрыть ответ':'◎ Показать ответ')+'</button>'+
      (qdAuto(q.type)?'<button type="button" class="qd-primary" data-qd-action="auto-check" data-qid="'+qdEsc(q.id)+
        '">Проверить автоматически</button>':'')+
    '</div>'+
    (visible?'<div class="qd-answer qd-chat-answer"><p>'+qdEsc(qdReference(q)).replace(/\n/g,'<br>')+'</p></div>':'')+
    (!hasPrompt?'<p class="qd-card-unfilled">Сначала заполните вопрос в конструкторе — пустую карточку нельзя оценить.</p>':'')+
    (mark?'<p class="qd-card-assessed" role="status">'+(mark==='yes'?'Знает':mark==='partial'?'Частично':'Не знает')+'</p>':'')+
  '</article>';
}
function qdListQuestions(d){
  let index=0;
  return d.sections.map((section,si)=>`<section class="qd-section" data-section="${qdEsc(section.id)}">
    <div class="qd-section-title"><h2>${si+1}. ${qdEsc(section.title)}</h2>
      <span>${section.questions.length} вопросов</span></div>
    ${section.questions.map(q=>qdRunQuestion(q,index++,d)).join('')}
  </section>`).join('');
}
function qdGuidedQuestions(d,all,s){
  if(!all.length)return `<section class="qd-panel qd-guided-empty"><h2>Пока нет вопросов</h2>
    <p>Добавьте задания в конструкторе и вернитесь к проведению.</p>
    <button type="button" data-qd-action="mode" data-mode="builder" class="qd-primary">Открыть конструктор</button></section>`;
  const index=qdCurrentIndex(d,all),q=all[index],progress=s.total?Math.round(s.rated/s.total*100):0;
  return `<section class="qd-guided" aria-label="Пошаговая диагностика">
    <div class="qd-guided-status">
      <div class="qd-guided-topline"><span class="qd-guided-section">${qdEsc(q.section)}</span>
        <strong>Вопрос ${index+1} из ${all.length}</strong></div>
      <div class="qd-guided-progress" role="progressbar" aria-label="Проверено вопросов"
        aria-valuenow="${s.rated}" aria-valuemin="0" aria-valuemax="${s.total}">
        <span style="width:${progress}%"></span></div>
      <div class="qd-guided-measures">
        <span>Проверено <strong>${s.rated} / ${s.total}</strong></span>
        <span>Результат <strong>${s.rated?s.percent+'%':'—'}</strong></span>
        <span>Баллы <strong>${s.earned} / ${s.possible}</strong></span>
      </div>
    </div>
    ${qdRunQuestion(q,index,d)}
    <div class="qd-guided-nav" role="group" aria-label="Перемещение по вопросам">
      <button type="button" data-qd-action="nav-prev" ${index===0?'disabled':''}>← Назад</button>
      <button type="button" data-qd-action="nav-next" class="qd-primary"
       ${index===all.length-1?'disabled':''}>Следующий →</button>
      <button type="button" data-qd-action="nav-unrated"
       ${s.rated===s.total?'disabled':''}>К непроверенному</button>
    </div>
    <details class="qd-question-map">
      <summary>Карта вопросов <span>${s.rated} из ${s.total} проверено</span></summary>
      <div class="qd-map-grid" role="group" aria-label="Выбор вопроса">
        ${all.map((item,i)=>{
          const grade=d.session.marks[item.id];
          const cls=i===index?' current':grade?' rated-'+grade:'';
          return `<button type="button" data-qd-action="nav-index" data-index="${i}"
            class="qd-map-number${cls}" aria-label="Вопрос ${i+1}: ${qdEsc(item.section)}"
            aria-current="${i===index?'step':'false'}" title="${qdEsc(item.section)}">${i+1}</button>`;
        }).join('')}
      </div>
    </details>
    <div class="qd-guided-finish">
      <span>Оценено ${s.rated} из ${s.total}</span>
      <button type="button" data-qd-action="save-result" class="qd-primary" ${!s.rated?'disabled':''}>Завершить и сохранить результат</button>
    </div>
    <p class="qd-shortcuts">Клавиши: 1 — знает, 2 — частично, 3 — не знает, ← → — переключение, R — ответ.</p>
  </section>`;
}
function qdRun(){
  const d=qdDoc(),all=qdQuestionList(d),s=qdScores(all,d.session.marks);
  const history=qdStudentFilter?qdStudentResults(d,qdStudentFilter):d.history;
  const profile=d.students.find(x=>x.id===qdStudentFilter);
  const scores=history.map(h=>h.summary||qdScores(all,h.marks)).filter(x=>x.rated);
  const average=scores.length?Math.round(scores.reduce((n,x)=>n+x.percent,0)/scores.length):null;
  return `<div class="qd-session">
    ${qdDisplay(d).mode==='focus'?`<details class="qd-session-drawer">
      <summary>Ученик: ${qdEsc(d.session.student||'не выбран')} <span>Настройки занятия</span></summary>`:''}
    <div class="qd-panel qd-session-panel">
      <div class="qd-student-chooser">
        <label>Из списка учеников<select data-qd-field="student-select" aria-label="Выбрать ученика">
        <option value="">Без привязки к профилю</option>${d.students.map(student=>`<option value="${qdEsc(student.id)}" ${student.id===d.session.studentId?'selected':''}>${qdEsc(student.name)}</option>`).join('')}</select></label>
        <label>Ученик<input type="text" data-qd-field="student" maxlength="100" value="${qdEsc(d.session.student)}" placeholder="Имя или код ученика"></label>
        <button data-qd-action="remember-student" type="button" title="Создать профиль из введённого имени">+ В список</button>
      </div>
      <div class="qd-row qd-wrap">
        <button type="button" data-qd-action="reset">Начать заново</button>
        ${qdDisplay(d).mode==='list'?`<button type="button" data-qd-action="save-result" class="qd-primary" ${!s.rated?'disabled':''}>Завершить и сохранить результат</button>`:''}
      </div>
    </div>
    ${qdDisplay(d).mode==='focus'?'</details>':''}
    <div class="qd-view-switch" role="group" aria-label="Вид проведения">
      <button type="button" data-qd-action="view" data-view="focus" aria-pressed="${qdDisplay(d).mode==='focus'}"
        class="${qdDisplay(d).mode==='focus'?'active':''}">По одному</button>
      <button type="button" data-qd-action="view" data-view="list" aria-pressed="${qdDisplay(d).mode==='list'}"
        class="${qdDisplay(d).mode==='list'?'active':''}">Все вопросы</button>
    </div>
    ${qdDisplay(d).mode==='focus'?qdGuidedQuestions(d,all,s):qdListQuestions(d)}
    ${qdDisplay(d).mode==='focus'?'<details class="qd-guided-insights"><summary>Подробные результаты и журнал</summary><div class="qd-guided-insights-body">':''}
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

      ${qdReviewItems(d).length?`<section class="qd-review-plan" aria-label="Что повторить с учеником">
        <div class="qd-review-title"><strong>На повторение</strong>
          <span>${qdReviewItems(d).filter(x=>x.grade==='no').length} не знает ·
          ${qdReviewItems(d).filter(x=>x.grade==='partial').length} частично</span></div>
        <div class="qd-review-items">
          ${qdReviewItems(d).slice(0,20).map(item=>`<div class="qd-review-item">
            <span class="qd-review-mark">${item.grade==='no'?'Повторить':'Закрепить'}</span>
            <div><strong>${qdEsc(item.section)}</strong><span>${qdEsc(item.prompt)}</span></div>
            <button type="button" data-qd-action="review-jump" data-qid="${qdEsc(item.id)}">К вопросу</button>
          </div>`).join('')}
        </div>
      </section>`:'<p class="qd-hint">Пока нет вопросов, отмеченных как «Частично» или «Не знает».</p>'}
      <div class="qd-report-action"><button type="button" data-qd-action="report-current" ${!s.rated?'disabled':''}>Скачать отчёт HTML / PDF через печать</button></div>
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
      ${!qdStudentFilter?qdGroupJournalMarkup(d):''}
      ${profile?`<div class="qd-profile-insight"><strong>${qdEsc(profile.name)}</strong>
         <span>Занятий: ${history.length}</span>
         <span>Средний результат: ${average===null?'—':average+'%'}</span>
         <span>Последний результат: ${scores.length?scores.at(-1).percent+'%':'—'}</span></div>`:''}
      ${profile?'<div id="qd-history-progress">'+qdHistoryProgressMarkup(d,qdStudentFilter)+'</div>':''}
      ${history.length?`<div class="qd-history-list">${[...history].reverse().map(h=>{
        const hs=h.summary||qdScores(all,h.marks);
        return `<div><span>${qdEsc(h.student||'Ученик без имени')}<small>${qdEsc(qdDateLabel(h.date))}</small></span>
        <strong>${hs.rated?hs.percent+'%':'—'}</strong><span>${hs.rated} проверено${Number.isFinite(hs.earned)?` · ${hs.earned}/${hs.possible} б.`:''}</span><button type="button" data-qd-action="report-saved" data-hid="${qdEsc(h.id)}">Отчёт</button></div>`;
      }).join('')}</div>`:'<p>Результатов пока нет.</p>'}
    </section>
    ${qdDisplay(d).mode==='focus'?'</div></details>':''}</div>`;
}

/* TASK114 — historical results are compared only from stored snapshots, never inferred
   from the current (potentially edited) question catalog. */
let qdHistoryComparisonFrom='',qdHistoryComparisonTo='';
function qdHistoryComparableRows(d,studentId){
  if(!studentId)return [];
  return qdStudentResults(d,studentId).filter(h=>
    h.summary&&h.summary.rated>0&&Array.isArray(h.topics)&&
    Number.isFinite(h.summary.percent)&&Number.isFinite(Date.parse(h.date)));
}
function qdHistoryCompare(d,studentId,fromId='',toId=''){
  const history=qdHistoryComparableRows(d,studentId);
  if(history.length<2)return {ok:false,reason:'Для сравнения нужны как минимум два сохранённых занятия с результатами по темам.',history};
  const current=history.find(h=>h.id===toId)||history.at(-1);
  const previous=history.find(h=>h.id===fromId&&h.id!==current.id)||
    history.filter(h=>h.id!==current.id).at(-1);
  if(!previous)return {ok:false,reason:'Выберите два разных занятия.',history};
  const older=new Map((previous.topics||[]).filter(x=>x.rated>0)
    .map(t=>[qdPromptKey(t.name),t]));
  const topics=(current.topics||[]).filter(x=>x.rated>0).flatMap(now=>{
    const past=older.get(qdPromptKey(now.name));
    if(!past)return [];
    const countsMatch=now.rated===past.rated&&now.total===past.total;
    return [{name:now.name,from:past.percent,to:now.percent,
      delta:now.percent-past.percent,countsMatch,
      fromRated:past.rated,toRated:now.rated}];
  });
  const fromScore=previous.summary,toScore=current.summary;
  return {ok:true,history,from:previous,to:current,topics,
    delta:toScore.percent-fromScore.percent,
    equalScope:fromScore.rated===toScore.rated&&fromScore.total===toScore.total,
    fromScore,toScore};
}
function qdHistoryProgressMarkup(d,studentId){
  const student=d.students.find(x=>x.id===studentId);
  if(!student)return '';
  const rows=qdHistoryComparableRows(d,studentId);
  if(rows.length<2)return '<section class="qd-progress-history" aria-label="Динамика по ученику">'+
    '<h3>Динамика занятий</h3><p class="qd-progress-hint">Для сравнения ученику нужны два сохранённых занятия с результатами по темам.</p></section>';
  const result=qdHistoryCompare(d,studentId,qdHistoryComparisonFrom,qdHistoryComparisonTo);
  if(!result.ok)return '<p class="qd-progress-hint">'+qdEsc(result.reason)+'</p>';
  const option=(selected)=>[...rows].reverse().map((h,i)=>
    '<option value="'+qdEsc(h.id)+'" '+(h.id===selected?'selected':'')+'>'+
    qdEsc(qdDateLabel(h.date))+' · '+h.summary.percent+'% · '+qdEsc(h.title||'Диагностика')+
    '</option>').join('');
  const trend=rows.slice(-8);
  const diff=result.delta;
  const direction=(n)=>n>0?'+'+n+' п.п.':n<0?n+' п.п.':'0 п.п.';
  const themeRows=result.topics.map(t=>
    '<div class="qd-progress-topic"><div><strong>'+qdEsc(t.name)+'</strong>'+
      '<span>'+t.from+'% → '+t.to+'%</span></div>'+
    '<div><span class="qd-progress-delta '+(t.delta>0?'up':t.delta<0?'down':'flat')+'">'+direction(t.delta)+'</span>'+
      (!t.countsMatch?'<small>Разное число заданий</small>':'')+'</div></div>').join('');
  return '<section class="qd-progress-history" aria-label="Динамика по ученику">'+
    '<div class="qd-progress-head"><div><h3>Динамика занятий</h3>'+
      '<p>Сохранённые результаты ученика: '+qdEsc(student.name)+'</p></div>'+
      '<button type="button" data-qd-action="progress-export">Сравнение CSV</button></div>'+
    '<div class="qd-progress-trend" aria-label="Последние результаты ученика">'+
      trend.map(h=>'<div class="qd-progress-trend-item">'+
        '<div class="qd-progress-trend-value">'+h.summary.percent+'%</div>'+
        '<div class="qd-progress-trend-bar"><span style="height:'+h.summary.percent+'%"></span></div>'+
        '<small>'+qdEsc(qdDateLabel(h.date).split(',')[0])+'</small></div>').join('')+
    '</div>'+
    '<div class="qd-progress-selectors"><label>Сравнить занятие<select data-qd-field="history-compare-from">'+
      option(result.from.id)+'</select></label>'+
      '<label>С занятием<select data-qd-field="history-compare-to">'+
      option(result.to.id)+'</select></label></div>'+
    '<div class="qd-progress-summary"><strong>'+result.fromScore.percent+'% → '+result.toScore.percent+'%</strong>'+
      '<span class="qd-progress-delta '+(diff>0?'up':diff<0?'down':'flat')+'">'+direction(diff)+'</span></div>'+
    (!result.equalScope?'<p class="qd-progress-caution">Количество проверенных заданий или их общий объём различается. Проценты показаны справочно, а не как строго сопоставимые оценки.</p>':'')+
    '<h4>Одинаковые темы в двух занятиях</h4>'+
    (themeRows||'<p class="qd-progress-hint">Совпадающих оценённых тем нет.</p>')+
    '<p class="qd-progress-hint">Сравнение строится по сохранённым результатам. Состав и сложность заданий могли различаться; изменение процента само по себе не доказывает рост или снижение знаний.</p>'+
    '</section>';
}
function qdHistoryProgressRefresh(){
  const el=document.getElementById('qd-history-progress');
  if(el)el.innerHTML=qdHistoryProgressMarkup(qdDoc(),qdStudentFilter);
}
function qdHistoryComparisonCSV(d,studentId,fromId,toId){
  const result=qdHistoryCompare(d,studentId,fromId,toId);
  if(!result.ok)return {ok:false,reason:result.reason};
  const fromDate=qdDateLabel(result.from.date),toDate=qdDateLabel(result.to.date);
  const header=['Тема','Дата 1','Результат 1, %','Дата 2','Результат 2, %',
    'Изменение, п.п.','Сопоставимое число заданий'];
  const rows=[header,['Вся работа',fromDate,result.fromScore.percent,toDate,result.toScore.percent,
    result.delta,result.equalScope?'Да':'Нет'],
    ...result.topics.map(t=>[t.name,fromDate,t.from,toDate,t.to,t.delta,t.countsMatch?'Да':'Нет'])];
  return {ok:true,rows,content:'\ufeff'+rows.map(row=>row.map(qdCsvCell).join(';')).join('\r\n')};
}


/* TASK115 — a group snapshot from the latest SAVED result for each roster pupil.
   Averages across different exercises are not treated as directly comparable. */
let qdGroupJournalFilter='all';
let qdGroupTopicFilter='';
let qdGroupTopicExpand=false;
/* TASK116: one contribution per pupil and topic, from that pupil's latest
   saved assessed entry. Missing or unassessed topics are not marked weak. */
function qdGroupTopicPlan(snapshot){
  const byTopic=new Map();
  for(const row of snapshot.rows){
    if(!row.last)continue;
    const pupilTopics=new Map();
    for(const item of (Array.isArray(row.last.topics)?row.last.topics:[])){
      if(!item||!Number.isFinite(item.rated)||item.rated<1||
        !Number.isFinite(item.percent)||item.percent<0||item.percent>100)continue;
      const name=qdText(item.name,120).trim(),key=qdPromptKey(name);
      if(!key)continue;
      const previous=pupilTopics.get(key);
      if(!previous||item.percent<previous.percent)pupilTopics.set(key,{name,key,percent:item.percent});
    }
    for(const item of pupilTopics.values()){
      if(!byTopic.has(item.key))byTopic.set(item.key,{
        key:item.key,name:item.name,assessed:0,need:0,studentIds:[],studentNames:[]
      });
      const topic=byTopic.get(item.key);
      topic.assessed++;
      if(item.percent<60){
        topic.need++;topic.studentIds.push(row.student.id);
        topic.studentNames.push(row.student.name);
      }
    }
  }
  return [...byTopic.values()].filter(x=>x.need>0).sort((a,b)=>
    b.need-a.need||b.need/b.assessed-a.need/a.assessed||a.name.localeCompare(b.name,'ru'));
}
function qdGroupTopicPlanMarkup(plan){
  if(!plan.length)return '<p class="qd-group-note">По последним оценённым проверкам нет тем ниже 60%.</p>';
  const shown=qdGroupTopicExpand?plan:plan.slice(0,6);
  return '<section class="qd-topic-plan" aria-label="Темы для повторения по группе">'+
    '<div class="qd-topic-plan-head"><div><h4>Темы для повторения</h4>'+
      '<p>Сколько учеников получили результат ниже 60% по теме в последней сохранённой проверке.</p></div>'+
      '<button type="button" data-qd-action="group-topics-export">План CSV</button></div>'+
    '<div class="qd-topic-plan-grid">'+shown.map(t=>
      '<button type="button" class="qd-topic-plan-card" data-qd-action="group-topic" data-topic="'+
        qdEsc(t.key)+'" aria-pressed="'+(qdGroupTopicFilter===t.key)+'">'+
        '<strong>'+qdEsc(t.name)+'</strong><span>'+t.need+' из '+t.assessed+
          ' учеников с оценкой по теме</span>'+
        '<span class="qd-topic-plan-meter" aria-hidden="true"><i style="width:'+
          Math.round(t.need/t.assessed*100)+'%"></i></span></button>').join('')+'</div>'+
    (plan.length>6?'<button type="button" class="qd-topic-plan-more" data-qd-action="group-topics-expand">'+
      (qdGroupTopicExpand?'Свернуть список':'Показать ещё '+(plan.length-6)+' тем')+'</button>':'')+
    '<p class="qd-group-note">Нажмите тему для фильтрации списка учеников; повторное нажатие снимает фильтр. '+
      'Неоценённые и отсутствующие темы не учитываются. Состав заданий мог различаться.</p></section>';
}
function qdGroupTopicPlanCSV(d){
  const plan=qdGroupTopicPlan(qdGroupSnapshot(d));
  const rows=[['Тема','Учеников с результатом ниже 60%','Учеников с оценкой по теме',
    'Ученики для повторения'],...plan.map(t=>[t.name,t.need,t.assessed,t.studentNames.join(', ')])];
  return '\ufeff'+rows.map(row=>row.map(qdCsvCell).join(';')).join('\r\n');
}

function qdGroupSnapshot(d){
  const rows=d.students.map(student=>{
    const entries=qdStudentResults(d,student.id)
      .filter(h=>h.summary&&h.summary.rated>0&&Number.isFinite(h.summary.percent)&&
        h.summary.percent>=0&&h.summary.percent<=100&&Number.isFinite(Date.parse(h.date)))
      .sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
    const last=entries.at(-1)||null,previous=entries.at(-2)||null;
    const topics=(Array.isArray(last?.topics)?last.topics:[])
      .filter(t=>t.rated>0&&t.percent>=0&&t.percent<60)
      .sort((a,b)=>a.percent-b.percent);
    const low=!!last&&(last.summary.percent<60||topics.length>0);
    const delta=previous?last.summary.percent-previous.summary.percent:null;
    const sameSize=!!previous&&last.summary.rated===previous.summary.rated&&
      last.summary.total===previous.summary.total;
    return {student,entries,last,previous,topics,low,delta,sameSize};
  });
  const unassigned=d.history.filter(h=>!d.students.some(p=>h.studentId===p.id||
    (!h.studentId&&qdPromptKey(h.student)===qdPromptKey(p.name)))).length;
  return {rows,withResults:rows.filter(r=>!!r.last).length,
    flagged:rows.filter(r=>r.low).length,unassigned};
}
function qdGroupVisibleRows(snapshot,filter=qdGroupJournalFilter,topic=qdGroupTopicFilter){
  const rows=filter==='attention'?snapshot.rows.filter(r=>r.low):snapshot.rows;
  return topic?rows.filter(r=>r.topics.some(t=>qdPromptKey(t.name)===topic)):rows;
}
function qdGroupJournalMarkup(d){
  const snapshot=qdGroupSnapshot(d),plan=qdGroupTopicPlan(snapshot);
  if(qdGroupTopicFilter&&!plan.some(t=>t.key===qdGroupTopicFilter))qdGroupTopicFilter='';
  const rows=qdGroupVisibleRows(snapshot);
  const delta=r=>r.delta===null?'—':(r.delta>0?'+':'')+r.delta+' п.п.'+
    (r.sameSize?'':' *');
  return '<section class="qd-group-journal" id="qd-group-journal" aria-label="Сводный журнал учеников">'+
    '<div class="qd-group-head"><div><h3>Сводка по ученикам</h3>'+
      '<p>Последняя сохранённая проверка каждого ученика. Не рейтинг и не средняя оценка класса.</p></div>'+
      '<button type="button" data-qd-action="group-export" '+(!snapshot.rows.length?'disabled':'')+
      '>Скачать сводку CSV</button></div>'+
    '<div class="qd-group-metrics">'+
      '<div><strong>'+snapshot.rows.length+'</strong><span>В списке</span></div>'+
      '<div><strong>'+snapshot.withResults+'</strong><span>Есть результаты</span></div>'+
      '<div><strong>'+snapshot.flagged+'</strong><span>Обратить внимание</span></div>'+
    '</div>'+
    qdGroupTopicPlanMarkup(plan)+
    '<div class="qd-group-filters" role="group" aria-label="Фильтр сводного журнала">'+
      '<button type="button" data-qd-action="group-filter" data-filter="all" aria-pressed="'+
        (qdGroupJournalFilter==='all')+'">Все ученики</button>'+
      '<button type="button" data-qd-action="group-filter" data-filter="attention" aria-pressed="'+
        (qdGroupJournalFilter==='attention')+'">Нужна проверка знаний</button></div>'+
    '<div class="qd-group-table-wrap"><table class="qd-group-table"><thead><tr>'+
      '<th scope="col">Ученик</th><th scope="col">Последняя проверка</th>'+
      '<th scope="col">Изменение</th><th scope="col">Темы для повторения</th>'+
      '<th scope="col"><span class="qd-sr-only">Открыть историю</span></th>'+
      '</tr></thead><tbody>'+
      (rows.length?rows.map(r=>'<tr>'+
        '<td><strong>'+qdEsc(r.student.name)+'</strong><small>'+r.entries.length+' занятий</small></td>'+
        '<td>'+(r.last?'<strong>'+r.last.summary.percent+'%</strong>'+
          '<small>'+qdEsc(qdDateLabel(r.last.date))+'</small>':'<span class="qd-group-muted">Нет результатов</span>')+'</td>'+
        '<td class="'+(r.delta>0?'qd-group-up':r.delta<0?'qd-group-down':'')+'">'+
          qdEsc(delta(r))+'</td>'+
        '<td>'+(r.topics.length?
            r.topics.slice(0,2).map(t=>'<span class="qd-group-topic">'+qdEsc(t.name)+
              ' · '+t.percent+'%</span>').join('')+
            (r.topics.length>2?'<small>И ещё '+(r.topics.length-2)+'</small>':''):
            r.last?'<span class="qd-group-muted">Нет тем ниже 60%</span>':
            '<span class="qd-group-muted">Нет сохранённой проверки</span>')+'</td>'+
        '<td><button type="button" data-qd-action="group-open-student" data-student="'+qdEsc(r.student.id)+
          '">История</button></td></tr>').join(''):
         '<tr><td colspan="5" class="qd-group-empty">'+
          (qdGroupTopicFilter?'По выбранной теме нет учеников для повторения.':
            qdGroupJournalFilter==='attention'?'По выбранному порогу учеников нет.':
            'Добавьте учеников в настройках занятия.')+'</td></tr>')+
      '</tbody></table></div>'+
    (snapshot.unassigned?'<p class="qd-group-note">Проверок без привязанного профиля: '+
      snapshot.unassigned+'. Они остаются в общем журнале, но не включены в сводку учеников.</p>':'')+
    '<p class="qd-group-note">«Обратить внимание» — условный фильтр: последний общий результат либо тема ниже 60%. '+
      'Разные наборы заданий могут иметь разную сложность. * У сравниваемых проверок различается количество заданий.</p>'+
    '</section>';
}
function qdGroupJournalRefresh(){
  const target=document.getElementById('qd-group-journal');
  if(target){const wrapper=document.createElement('div');wrapper.innerHTML=qdGroupJournalMarkup(qdDoc());
    if(wrapper.firstElementChild)target.replaceWith(wrapper.firstElementChild);}
}
function qdGroupJournalCSV(d){
  const snap=qdGroupSnapshot(d);
  const rows=[['Ученик','Сохранённых проверок','Дата последней','Последний результат, %',
    'Изменение, п.п.','Сопоставимое число вопросов','Темы ниже 60%, последний результат'],
    ...qdGroupVisibleRows(snap).map(row=>[
      row.student.name,row.entries.length,row.last?.date||'',
      row.last?.summary.percent??'',row.delta??'',row.delta===null?'':row.sameSize?'Да':'Нет',
      row.topics.map(t=>t.name+' ('+t.percent+'%)').join('; ')
    ])];
  return '\ufeff'+rows.map(cells=>cells.map(qdCsvCell).join(';')).join('\r\n');
}

function qdTopicSnapshot(doc,marks){
  return doc.sections.map(section=>{
    const s=qdScores(section.questions,marks);
    return {name:section.title,rated:s.rated,total:s.total,percent:s.percent};
  });
}
function qdReportHTML(entry){
  const doc=qdDoc(),all=qdQuestionList(doc),current=entry===undefined;
  const marks=current?doc.session.marks:entry.marks;
  const s=current?qdScores(all,marks):entry.summary||qdScores(all,marks);
  const topics=current?qdTopicSnapshot(doc,marks):entry.topics||qdTopicSnapshot(doc,marks);
  const pupil=qdEsc(current?doc.session.student:(entry.student||''))||'Не указан';
  const stamp=qdEsc(current?new Date().toLocaleString('ru-RU'):qdDateLabel(entry.date));
  const title=qdEsc(current?doc.title:(entry.title||doc.title));
  const rows=topics.map(t=>'<tr><td>'+qdEsc(t.name)+'</td><td>'+t.rated+' / '+t.total+'</td><td>'+t.percent+'%</td></tr>').join('');
  return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Отчёт · '+title+'</title>'+
   '<style>@page{size:A4;margin:20mm}body{font:15px/1.5 Arial,sans-serif;color:#192d27;margin:40px auto;max-width:820px;padding:0 24px}h1{font-size:27px}h2{font-size:18px;margin-top:30px}'+
   '.muted{color:#60746a}.score{display:flex;align-items:baseline;gap:14px;padding:20px;background:#f0f7f3;border-radius:12px}.score strong{font-size:36px;color:#1c684a}'+
   'table{border-collapse:collapse;width:100%}td,th{padding:10px;text-align:left;border-bottom:1px solid #cbd9d1}th{background:#eaf2ed}'+
   '@media print{body{margin:0;padding:0}.score{print-color-adjust:exact}}'+'</style></head><body>'+
   '<p class="muted">QUANTUM WRITER · ОТЧЁТ ДИАГНОСТИКИ</p><h1>'+title+'</h1>'+
   '<p><b>Ученик:</b> '+pupil+'<br><b>Дата:</b> '+stamp+'</p>'+
   '<div class="score"><strong>'+s.percent+'%</strong><span>Проверено '+s.rated+' из '+s.total+' заданий</span></div>'+
   '<p>Знает: '+s.yes+' · Частично: '+s.partial+' · Не знает: '+s.no+'</p>'+
   (Number.isFinite(s.earned)&&Number.isFinite(s.possible)?'<p><b>Баллы:</b> '+s.earned+' из '+s.possible+'</p>':'')+
   '<h2>Результаты по разделам</h2><table><thead><tr><th>Раздел</th><th>Проверено</th><th>Результат</th></tr></thead><tbody>'+rows+'</tbody></table>'+
   '<p class="muted">Процент рассчитан только по проверенным заданиям. Для сохранения PDF откройте этот файл и выберите «Печать → Сохранить как PDF».</p>'+
   '</body></html>';
}
function qdExportReport(entry){
  const doc=qdDoc(),stamp=new Date().toISOString().slice(0,10);
  download(safeFile(doc.title)+'-отчёт-'+stamp+'.html',qdReportHTML(entry),'text/html;charset=utf-8');
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


const QD_LIBRARY_KEY='quantum-office.diagnostic-templates.v1';
let qdLibraryQuery='',qdLibrarySubject='all',qdLibraryGrade='all',qdLibraryPurpose='all';
const QD_PRESETS=[
  {id:'physics8',subject:'physics',grade:'8',purpose:'diagnostic',label:'Молекулы и температура',description:'Устные вопросы, скрытые ответы, тепловые явления и задачи'},
  {id:'physics7',subject:'physics',grade:'7',purpose:'diagnostic',label:'Введение в физику',description:'Величины, движение, измерения и плотность'},
  {id:'physics9',subject:'physics',grade:'9',purpose:'review',label:'Законы движения',description:'Ускорение, законы Ньютона и импульс'},
  {id:'math56',subject:'math',grade:'5–6',purpose:'diagnostic',label:'Дроби, проценты и задачи',description:'Проверка базовых навыков за 5–6 класс'},
  {id:'math7',subject:'math',grade:'7',purpose:'review',label:'Алгебра: уравнения и функции',description:'Уравнения, графики, вычисления'},
  {id:'informatics7',subject:'informatics',grade:'7',purpose:'diagnostic',label:'Информация и алгоритмы',description:'Кодирование, файлы, алгоритмы и логика'},
  {id:'informatics9',subject:'informatics',grade:'9',purpose:'review',label:'Логика и программирование',description:'Булевы выражения, циклы и исполнители'},
  ...(typeof QD_PRESET_CURRICULUM==='object'?Object.entries(QD_PRESET_CURRICULUM.new)
    .map(([id,m])=>({id,subject:m.subject,grade:m.grade,purpose:m.purpose,
      label:m.label,description:m.description})) : [])
];
const QD_SUBJECTS={physics:'Физика',math:'Математика',informatics:'Информатика',
  russian:'Русский язык',biology:'Биология',geography:'География',
  chemistry:'Химия',other:'Другое'};
const QD_PURPOSES={diagnostic:'Входная диагностика',review:'Повторение',practice:'Тренировка',exam:'Контрольная'};
function qdLibrarySafe(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const subject=Object.hasOwn(QD_SUBJECTS,value.subject)?value.subject:'other';
  const purpose=Object.hasOwn(QD_PURPOSES,value.purpose)?value.purpose:'diagnostic';
  const title=qdText(value.title,120).trim();
  if(!title||!Array.isArray(value.sections))return null;
  const model=qdNormalize({title,description:qdText(value.description,600),sections:value.sections,
    students:[],history:[],session:{},display:{mode:'list',activeId:''}});
  if(!model.sections.length||!qdQuestionList(model).length)return null;
  return {id:qdText(value.id,60),title:model.title,description:model.description,
    subject,grade:qdText(value.grade,18)||'—',purpose,sections:model.sections};
}
function qdLibraryRead(){
  try{
    const raw=JSON.parse(localStorage.getItem(QD_LIBRARY_KEY)||'[]');
    return Array.isArray(raw)?raw.slice(0,QD_LIMITS.templates).map(qdLibrarySafe).filter(Boolean):[];
  }catch(_){return [];}
}
function qdLibraryWrite(items){
  try{localStorage.setItem(QD_LIBRARY_KEY,JSON.stringify(items.slice(0,QD_LIMITS.templates)));return true;}
  catch(_){return false;}
}

/* TASK120: bounded undo history for personal templates, outside the portable QTPL schema. */
const QD_TEMPLATE_VERSIONS_KEY='quantum-office.diagnostic-template-versions.v1';
function qdTemplateVersionsRead(){
  try{
    const data=JSON.parse(localStorage.getItem(QD_TEMPLATE_VERSIONS_KEY)||'{}');
    if(!data||typeof data!=='object'||Array.isArray(data))return {};
    const valid={};
    for(const [id,versions] of Object.entries(data).slice(0,QD_LIMITS.templates)){
      if(!Array.isArray(versions))continue;
      valid[id]=versions.slice(0,5).filter(v=>v&&typeof v.id==='string'&&v.template&&qdLibrarySafe(v.template))
        .map(v=>({id:v.id,date:qdText(v.date,60),template:qdLibrarySafe(v.template)}));
    }
    return valid;
  }catch(_){return {};}
}
function qdTemplateRevisionRemember(item){
  const data=qdTemplateVersionsRead(),previous=data[item.id]||[];
  data[item.id]=[{id:qdNewId(),date:new Date().toISOString(),
    template:qdLibrarySafe(item)},...previous].slice(0,5);
  try{
    localStorage.setItem(QD_TEMPLATE_VERSIONS_KEY,JSON.stringify(data));return {ok:true};
  }catch(_){return {ok:false,message:'Недостаточно места для резервной версии шаблона; скачайте .qtpl'};}
}
function qdTemplateVersionOptions(templateId){
  const versions=qdTemplateVersionsRead()[templateId]||[];
  return '<option value="">'+(versions.length?'Выберите версию':'Нет предыдущих версий')+'</option>'+
    versions.map((v,i)=>'<option value="'+qdEsc(v.id)+'">'+(i+1)+'. '+
      qdEsc(qdDateLabel(v.date))+' — '+v.template.sections.reduce((n,s)=>n+s.questions.length,0)+
      ' заданий</option>').join('');
}
function qdTemplateRevisionRestore(templateId,revisionId){
  const items=qdLibraryRead(),index=items.findIndex(x=>x.id===templateId);
  if(index<0)return {ok:false,message:'Свой шаблон не найден'};
  const item=qdTemplateVersionsRead()[templateId]?.find(x=>x.id===revisionId);
  if(!item)return {ok:false,message:'Версия не найдена'};
  const previous=qdLibrarySafe({...item.template,id:templateId});
  if(!previous)return {ok:false,message:'Повреждённая сохранённая версия'};
  if(qdLibraryNameUsed(items,previous.title,templateId))
    return {ok:false,message:'Название версии совпадает с другим шаблоном'};
  const remembered=qdTemplateRevisionRemember(items[index]);
  if(!remembered.ok)return remembered;
  items[index]=previous;
  if(!qdLibraryWrite(items))return {ok:false,message:'Не удалось восстановить шаблон из-за ограничения памяти'};
  return {ok:true,questions:qdQuestionList(previous).length};
}
let qdLibraryEditingId='';
function qdLibraryNameUsed(items,title,ignoreId=''){
  const normalized=qdPromptKey(title);
  return items.some(t=>t.id!==ignoreId&&qdPromptKey(t.title)===normalized);
}
function qdLibraryUpdate(id,fields,d=qdDoc(),replaceQuestions=false){
  const items=qdLibraryRead(),index=items.findIndex(t=>t.id===id);
  if(index<0)return {ok:false,message:'Шаблон не найден'};
  const original=items[index];
  const title=qdText(fields?.title,120).trim(),description=qdText(fields?.description,600);
  if(!title)return {ok:false,message:'Введите название шаблона'};
  if(qdLibraryNameUsed(items,title,id))return {ok:false,message:'Шаблон с таким названием уже существует'};
  const sections=replaceQuestions?d.sections:original.sections;
  if(replaceQuestions&&!qdQuestionList(d).some(q=>q.prompt.trim()))
    return {ok:false,message:'Нельзя перезаписать шаблон пустыми вопросами'};
  const draft=qdLibrarySafe({
    id:original.id,title,description,
    subject:fields.subject,grade:qdText(fields.grade,18).trim(),purpose:fields.purpose,
    sections
  });
  if(!draft)return {ok:false,message:'Не удалось сохранить шаблон'};
  const remembered=qdTemplateRevisionRemember(original);
  if(!remembered.ok)return remembered;
  const next=items.slice();next[index]=draft;
  if(!qdLibraryWrite(next))return {ok:false,message:'Недостаточно места в локальном хранилище — скачайте .qtpl'};
  return {ok:true,questions:draft.sections.reduce((s,t)=>s+t.questions.length,0)};
}
function qdLibraryClone(id){
  const items=qdLibraryRead(),item=items.find(x=>x.id===id);
  if(!item)return {ok:false,message:'Шаблон не найден'};
  if(items.length>=QD_LIMITS.templates)return {ok:false,message:'Достигнут лимит 30 шаблонов'};
  const base=item.title+' — копия';
  let title=base,num=2;
  while(qdLibraryNameUsed(items,title))title=base+' '+num++;
  const copy=qdLibrarySafe({...item,id:qdNewId(),title,sections:item.sections});
  if(!copy)return {ok:false,message:'Не удалось скопировать шаблон'};
  if(!qdLibraryWrite([copy,...items]))return {ok:false,message:'Недостаточно места для копии'};
  return {ok:true,id:copy.id,title:copy.title};
}
function qdLibraryEditorMarkup(){
  const item=qdLibraryRead().find(x=>x.id===qdLibraryEditingId);
  if(!item)return '';
  const options=(values,chosen)=>values.map(([v,label])=>
    '<option value="'+qdEsc(v)+'" '+(v===chosen?'selected':'')+'>'+qdEsc(label)+'</option>').join('');
  return '<section class="qd-panel qd-library-editor" aria-label="Редактирование своего шаблона">'+
    '<div class="qd-library-editor-title"><div><h2>Изменить свой шаблон</h2>'+
    '<p>Название и настройки можно изменить отдельно от вопросов. Содержимое не затронется, пока вы явно не включите его замену.</p></div>'+
    '<button type="button" data-qd-action="library-edit-cancel">Отмена</button></div>'+
    '<div class="qd-library-editor-fields">'+
    '<label>Название<input id="qd-library-edit-title" maxlength="120" value="'+qdEsc(item.title)+'"></label>'+
    '<label>Предмет<select id="qd-library-edit-subject">'+options(Object.entries(QD_SUBJECTS),item.subject)+'</select></label>'+
    '<label>Класс<input id="qd-library-edit-grade" maxlength="18" value="'+qdEsc(item.grade)+'"></label>'+
    '<label>Цель<select id="qd-library-edit-purpose">'+options(Object.entries(QD_PURPOSES),item.purpose)+'</select></label>'+
    '<label class="qd-library-editor-description">Описание<textarea id="qd-library-edit-description" maxlength="600" rows="3">'+qdEsc(item.description)+'</textarea></label>'+
    '</div>'+
    '<div class="qd-library-editor-refresh"><label>'+
    '<input type="checkbox" id="qd-library-edit-replace"><span>Обновить вопросы шаблона из текущей диагностики</span></label>'+
    '<p>По умолчанию сохраняются прежние вопросы ('+item.sections.reduce((s,t)=>s+t.questions.length,0)+
    '). Если включить замену, текущие вопросы скопируются в этот шаблон. Ученики, оценки и журнал не копируются.</p></div>'+
    '<div class="qd-library-editor-actions"><button type="button" data-qd-action="library-edit-save" class="qd-primary">Сохранить изменения</button>'+
    '<button type="button" data-qd-action="library-edit-cancel">Отменить</button></div></section>';
}
function qdLibraryEditorRefresh(){
  const root=document.getElementById('qd-library-editor-slot');
  if(root)root.innerHTML=qdLibraryEditorMarkup();
}

function qdLibrarySaveCurrent(d,subject,grade,purpose){
  const current=qdLibraryRead();
  if(current.length>=QD_LIMITS.templates)return {ok:false,message:'Достигнут лимит сохранённых шаблонов'};
  if(qdLibraryNameUsed(current,d.title))return {ok:false,message:'Шаблон с таким названием уже существует — откройте «Изменить» для обновления'};
  if(!qdQuestionList(d).some(q=>q.prompt.trim()))return {ok:false,message:'Заполните хотя бы один вопрос'};
  const data=qdLibrarySafe({
    id:qdNewId(),title:d.title,description:d.description,sections:d.sections,subject,grade,purpose
  });
  if(!data)return {ok:false,message:'Не удалось подготовить шаблон'};
  const next=[data,...current];
  if(!qdLibraryWrite(next))return {ok:false,message:'Недостаточно места в локальном хранилище. Сохраните .qdiag на диск'};
  return {ok:true,id:data.id};
}
function qdLibraryDelete(id){
  const current=qdLibraryRead();
  if(!current.some(x=>x.id===id))return false;
  return qdLibraryWrite(current.filter(x=>x.id!==id));
}
function qdLibraryItems(){
  const builtins=QD_PRESETS.map(x=>({...x,source:'built-in',title:qdTemplate(x.id)?.title||x.label,
    count:qdTemplate(x.id)?.sections.reduce((sum,s)=>sum+s.questions.length,0)||0}));
  const custom=qdLibraryRead().map(x=>({id:x.id,source:'custom',subject:x.subject,grade:x.grade,purpose:x.purpose,
    label:x.title,description:x.description,count:x.sections.reduce((sum,s)=>sum+s.questions.length,0)}));
  const needle=qdLibraryQuery.trim().toLocaleLowerCase('ru-RU');
  return [...custom,...builtins].filter(x=>
    (qdLibrarySubject==='all'||x.subject===qdLibrarySubject)&&
    (qdLibraryGrade==='all'||x.grade===qdLibraryGrade)&&
    (qdLibraryPurpose==='all'||x.purpose===qdLibraryPurpose)&&
    (!needle||(x.label+' '+x.description+' '+QD_SUBJECTS[x.subject]).toLocaleLowerCase('ru-RU').includes(needle))
  );
}
function qdLibraryLoad(d,id,source){
  let payload=null;
  if(source==='custom'){
    const x=qdLibraryRead().find(x=>x.id===id);
    if(x)payload={title:x.title,description:x.description,sections:x.sections};
  }else if(source==='built-in')payload=qdTemplate(id);
  if(!payload)return false;
  // Re-normalizing generates safe, fresh IDs so an old session cannot inherit marks.
  const model=qdNormalize({title:payload.title,description:payload.description,sections:payload.sections,
    students:[],history:[],session:{},display:{mode:'list'}});
  for(const s of model.sections){
    s.id=qdNewId();
    for(const q of s.questions)q.id=qdNewId();
  }
  d.title=model.title;d.description=model.description;d.sections=model.sections;
  d.students=[];d.history=[];d.session={student:'',studentId:'',marks:{},responses:{}};
  d.display={mode:'list',activeId:''};
  qdRevealed.clear();qdSelected.clear();qdSearch='';qdFilterKind='all';
  qdStore();return true;
}


let qdLibraryPreviewData=null,qdLibraryPreviewSelected=new Set();
function qdLibraryResolve(source,id){
  let raw=null;
  if(source==='built-in')raw=qdTemplate(id);
  if(source==='custom'){
    const custom=qdLibraryRead().find(x=>x.id===id);
    if(custom)raw={title:custom.title,description:custom.description,sections:custom.sections};
  }
  if(!raw)return null;
  const model=qdNormalize({title:raw.title,description:raw.description,sections:raw.sections});
  return qdQuestionList(model).length?model:null;
}
function qdLibraryPreviewPick(source,id){
  const model=qdLibraryResolve(source,id);
  if(!model)return false;
  qdLibraryPreviewData={source,id,model};
  qdLibraryPreviewSelected=new Set(qdQuestionList(model).map(q=>q.id));
  return true;
}
function qdLibraryMergePlan(d,model,selection){
  if(!model||!Array.isArray(model.sections))return {ok:false,error:'Шаблон не найден'};
  const chosen=new Set(selection);
  const knownIds=new Set(qdQuestionList(model).map(q=>q.id));
  if(!chosen.size||[...chosen].some(id=>!knownIds.has(id)))return {ok:false,error:'Выберите вопросы из текущего предпросмотра'};
  const prompts=new Set(qdQuestionList(d).map(q=>qdPromptKey(q.prompt)).filter(Boolean));
  const names=new Map(d.sections.map(s=>[qdPromptKey(s.title),{id:s.id,title:s.title}]));
  const additions=[],newSections=[];let duplicates=0;
  for(const section of model.sections){
    const selected=section.questions.filter(q=>chosen.has(q.id));
    if(!selected.length)continue;
    const clean=selected.filter(q=>{
      const key=qdPromptKey(q.prompt);
      if(!key||prompts.has(key)){duplicates++;return false;}
      prompts.add(key);return true;
    });
    if(!clean.length)continue;
    const key=qdPromptKey(section.title);
    if(!names.has(key)){
      names.set(key,{id:null,title:section.title});
      newSections.push({key,title:section.title});
    }
    for(const q of clean)additions.push({sectionKey:key,question:q});
  }
  if(!additions.length)return {ok:false,error:'Все выбранные задания уже есть в диагностике или не заполнены',duplicates,items:[]};
  if(d.sections.length+newSections.length>QD_LIMITS.sections)
    return {ok:false,error:'Лимит: максимум 24 раздела',duplicates,items:[]};
  if(qdQuestionList(d).length+additions.length>QD_LIMITS.questions)
    return {ok:false,error:'Лимит: максимум 240 вопросов',duplicates,items:[]};
  return {ok:true,items:additions,newSections,duplicates};
}
function qdLibraryMergeApply(d,plan){
  if(!plan?.ok||!plan.items?.length)return false;
  if(d.sections.length+plan.newSections.length>QD_LIMITS.sections||
    qdQuestionList(d).length+plan.items.length>QD_LIMITS.questions)return false;
  const byName=new Map(d.sections.map(s=>[qdPromptKey(s.title),s]));
  for(const s of plan.newSections){
    const section={id:qdNewId(),title:s.title,questions:[]};
    d.sections.push(section);byName.set(s.key,section);
  }
  for(const item of plan.items){
    const section=byName.get(item.sectionKey);
    if(!section)return false;
    const source=item.question;
    section.questions.push({
      id:qdNewId(),type:qdType(source.type),prompt:source.prompt,answer:source.answer,
      points:qdPoints(source.points),partialCredit:qdPartialCredit(source.partialCredit),
      choices:qdChoices(source.choices),numericAnswer:qdText(source.numericAnswer,60),
      tolerance:qdTolerance(source.tolerance)
    });
  }
  return true;
}
function qdLibraryPreviewMarkup(d=qdDoc()){
  const picked=qdLibraryPreviewData;
  if(!picked)return '';
  const {model,source,id}=picked,questions=qdQuestionList(model);
  const selected=qdLibraryPreviewSelected;
  const plan=qdLibraryMergePlan(d,model,selected);
  const numSelected=questions.filter(q=>selected.has(q.id)).length;
  return '<section class="qd-panel qd-library-preview" aria-label="Предпросмотр шаблона">'+
    '<div class="qd-library-preview-head"><div><p class="qd-eyebrow">ПРЕДПРОСМОТР ШАБЛОНА</p>'+
    '<h2>'+qdEsc(model.title)+'</h2><p>'+qdEsc(model.description)+'</p></div>'+
    '<button type="button" data-qd-action="library-preview-close" aria-label="Закрыть предпросмотр">× Закрыть</button></div>'+
    '<div class="qd-library-preview-options"><strong>'+numSelected+' из '+questions.length+' выбрано</strong>'+
    '<button type="button" data-qd-action="library-preview-all">Выбрать все</button>'+
    '<button type="button" data-qd-action="library-preview-none">Снять выделение</button></div>'+
    '<div class="qd-library-preview-sections">'+model.sections.map((section,si)=>
      '<section><div class="qd-library-preview-section-head"><h3>'+(si+1)+'. '+qdEsc(section.title)+'</h3>'+
      '<span>'+section.questions.length+' вопросов</span></div>'+
      section.questions.map((q,qi)=>
        '<article class="qd-library-preview-question"><label>'+
        '<input type="checkbox" data-qd-template-select="'+qdEsc(q.id)+'" '+(selected.has(q.id)?'checked':'')+'>'+
        '<span class="qd-library-preview-question-text"><strong>'+qdEsc(q.prompt||'Пустой вопрос')+'</strong>'+
        '<small>'+qdEsc(qdTypeTitle(q.type))+' · '+qdPoints(q.points)+' балл(ов)</small></span></label>'+
        '<details><summary>Показать ответ</summary><p>'+qdEsc(qdReference(q)).replace(/\n/g,'<br>')+'</p></details></article>'
      ).join('')+'</section>'
    ).join('')+'</div>'+
    '<div class="qd-library-preview-footer"><div class="qd-library-preview-count">'+
    (plan.ok?'<strong>Будет добавлено: '+plan.items.length+'</strong> · новых разделов: '+plan.newSections.length+
      (plan.duplicates?' · повторов пропущено: '+plan.duplicates:''):
      '<strong>'+qdEsc(plan.error||'Нет вопросов для добавления')+'</strong>')+
    '</div><div class="qd-library-preview-actions">'+
    '<button type="button" data-qd-action="library-open" data-source="'+qdEsc(source)+'" data-template="'+qdEsc(id)+'">Открыть вместо текущей</button>'+
    '<button type="button" class="qd-primary" data-qd-action="library-preview-add" '+(plan.ok?'':'disabled')+
      '>Добавить выбранные в текущую</button></div></div>'+
    '<p class="qd-hint">Добавление сохраняет текущих учеников и оценки. Совпадающие вопросы по формулировке пропускаются; новые разделы создаются только при необходимости.</p>'+
    '</section>';
}
function qdLibraryPreviewRefresh(){
  const target=document.getElementById('qd-library-preview-slot');
  if(target)target.innerHTML=qdLibraryPreviewMarkup();
}

function qdLibraryExport(){
  download('QuantumOffice-templates.qtpl',JSON.stringify({format:'quantum-templates',version:1,
    templates:qdLibraryRead()},null,2),'application/json;charset=utf-8');
}
function qdLibraryImport(text){
  let payload;
  try{payload=JSON.parse(text);}catch(_){return {ok:false,message:'Повреждённый файл'};}
  if(payload?.format!=='quantum-templates'||payload.version!==1||!Array.isArray(payload.templates))
    return {ok:false,message:'Файл должен содержать библиотеку .qtpl'};
  if(payload.templates.length>QD_LIMITS.templates)return {ok:false,message:'В файле слишком много шаблонов'};
  const current=qdLibraryRead(),room=QD_LIMITS.templates-current.length;
  if(payload.templates.length>room)return {ok:false,message:'Недостаточно места в библиотеке — удалите лишние шаблоны'};
  const names=new Set(current.map(x=>x.title.toLocaleLowerCase('ru-RU')));
  const incoming=[];
  for(const value of payload.templates){
    const item=qdLibrarySafe(value);
    if(!item)return {ok:false,message:'Найден повреждённый шаблон'};
    if(names.has(item.title.toLocaleLowerCase('ru-RU')))continue;
    item.id=qdNewId();names.add(item.title.toLocaleLowerCase('ru-RU'));incoming.push(item);
  }
  if(!qdLibraryWrite([...incoming,...current]))
    return {ok:false,message:'Недостаточно памяти для импортированной библиотеки'};
  return {ok:true,count:incoming.length};
}

function qdLibraryView(){
  const items=qdLibraryItems(),total=QD_PRESETS.length+qdLibraryRead().length;
  const options=(values,selected)=>values.map(([key,title])=>'<option value="'+key+'" '+(selected===key?'selected':'')+'>'+qdEsc(title)+'</option>').join('');
  return '<div class="qd-template-library">'+
    '<section class="qd-panel qd-library-heading"><div><h2>Библиотека диагностик</h2>'+
      '<p>Выберите предмет, класс и цель. Откройте готовую подборку или сохраните свою — ученики и результаты в шаблон не попадут.</p></div>'+
      '<span class="qd-library-total">'+total+' шаблонов</span></section>'+
    '<section class="qd-panel qd-library-filter"><label>Название или тема<input id="qd-library-search" type="search" maxlength="120" value="'+qdEsc(qdLibraryQuery)+'" placeholder="Найти диагностику"></label>'+
      '<label>Предмет<select id="qd-library-subject">'+options([['all','Все предметы'],...Object.entries(QD_SUBJECTS)],qdLibrarySubject)+'</select></label>'+
      '<label>Класс<select id="qd-library-grade">'+options([['all','Все классы'],...['5–6','7','8','9'].map(x=>[x,x+' класс'])],qdLibraryGrade)+'</select></label>'+
      '<label>Цель<select id="qd-library-purpose">'+options([['all','Любая цель'],...Object.entries(QD_PURPOSES)],qdLibraryPurpose)+'</select></label>'+
      '</section><section class="qd-library-grid" id="qd-library-items">'+qdLibraryCards(items)+'</section>'+'<div id="qd-library-editor-slot">'+qdLibraryEditorMarkup()+'</div>'+'<div id="qd-library-preview-slot">'+qdLibraryPreviewMarkup()+'</div>'+
      '<section class="qd-panel qd-library-save"><div><h3>Сохранить текущую диагностику как шаблон</h3>'+
      '<p>Шаблон будет доступен в этой программе на данном устройстве даже после создания нового документа. Хранится локально в браузере.</p></div>'+
      '<div class="qd-library-save-form"><label>Предмет<select id="qd-library-save-subject">'+options(Object.entries(QD_SUBJECTS),'physics')+'</select></label>'+
      '<label>Класс<input id="qd-library-save-grade" maxlength="18" value="8" placeholder="Например, 8"></label>'+
      '<label>Цель<select id="qd-library-save-purpose">'+options(Object.entries(QD_PURPOSES),'diagnostic')+'</select></label>'+
      '<button type="button" data-qd-action="library-save" class="qd-primary">Сохранить свой шаблон</button></div>'+
      '<p class="qd-library-portable-note">Перенос библиотеки: используйте кнопки QTPL в верхней ленте.</p>'+
      '<p class="qd-hint">Для переносимости между версиями HTML сохраняйте библиотеку в .qtpl. Локальное хранилище зависит от файла и настроек браузера.</p></section>'+
  '</div>';
}
function qdLibraryCards(items){
  return items.length?items.map(x=>'<article class="qd-library-card" data-template-id="'+qdEsc(x.id)+'">'+
    '<div class="qd-library-tags"><span>'+qdEsc(QD_SUBJECTS[x.subject]||'Другое')+'</span><span>'+qdEsc(x.grade)+' класс</span>'+
    '<span>'+qdEsc(QD_PURPOSES[x.purpose]||'Диагностика')+'</span></div>'+
    '<h3>'+qdEsc(x.label)+'</h3><p>'+qdEsc(x.description||'Собственный шаблон диагностики')+'</p>'+
    '<div class="qd-library-card-footer"><span>'+x.count+' вопросов</span><div>'+
    (x.source==='custom'?
    '<button type="button" data-qd-action="library-edit" data-template="'+qdEsc(x.id)+'">Изменить</button>'+
    '<button type="button" data-qd-action="library-clone" data-template="'+qdEsc(x.id)+'">Копировать</button>'+
    '<button type="button" data-qd-action="library-delete" data-source="custom" data-template="'+qdEsc(x.id)+'">Удалить</button>':'')+
    '<button type="button" data-qd-action="library-preview" data-source="'+x.source+'" data-template="'+qdEsc(x.id)+'">Просмотреть</button>'+    '<button type="button" class="qd-primary" data-qd-action="library-open" data-source="'+x.source+
      '" data-template="'+qdEsc(x.id)+'">Открыть</button></div></div></article>').join(''):
    '<div class="qd-library-empty">Ничего не найдено. Попробуйте другой предмет, класс или запрос.</div>';
}
function qdLibraryRefreshCards(){
  const grid=document.getElementById('qd-library-items');
  if(grid)grid.innerHTML=qdLibraryCards(qdLibraryItems());
}

function qdTemplate(key){
  const collections={
    physics8:{
      title:'Физика · 8 класс · Молекулы и температура',
      description:'Диагностика понимания молекулярного строения, внутренней энергии и теплопередачи.',
      sections:[
        {title:'Молекулы и температура',items:[
          ['Почему сахар быстрее растворяется в горячем чае, чем в холодной?','При более высокой температуре частицы движутся интенсивнее, поэтому диффузия и растворение обычно идут быстрее.'],
          ['Почему воздух можно сильно сжать, а воду — почти невозможно?','Расстояния между молекулами газа намного больше, чем между молекулами жидкости.'],
          ['Что происходит с молекулами вещества при нагревании?','Средняя кинетическая энергия их хаотического движения увеличивается.'],
          ['Может ли большой кусок льда иметь большую внутреннюю энергию, чем маленькая чашка горячей воды?','Да. Внутренняя энергия зависит не только от температуры, но и от массы, состава и агрегатного состояния.'],
          ['Можно ли измерить температуру тела по скорости движения одной молекулы?','Нет. Температура связана со статистическими характеристиками большого числа частиц, а скорости отдельных молекул различны.']
        ]},
        {title:'Теплопередача',items:[
          ['Как тепло Солнца достигает Земли сквозь вакуум?','Электромагнитным излучением, которому не требуется вещество.'],
          ['Почему металлическая ложка в горячем чае нагревается?','Тепло передаётся по металлу благодаря теплопроводности.'],
          ['Почему тёплый воздух поднимается вверх?','При нагревании воздух расширяется, становится менее плотным и поднимается под действием выталкивающей силы.']
        ]},
        {title:'Практика',items:[
          ['Найди количество теплоты для нагрева 2 кг воды на 10 °C, если c = 4200 Дж/(кг·°C).','Q = cmΔt = 4200 · 2 · 10 = 84 000 Дж.','practice'],
          ['Во сколько раз изменится количество теплоты, если массу воды удвоить, а изменение температуры оставить прежним?','Увеличится в 2 раза, так как Q = cmΔt.','practice']
        ]}
      ]
    },
    physics9:{
      title:'Физика · 9 класс · Законы движения',
      description:'Повторение механики: ускорение, силы, импульс и анализ движения.',
      sections:[
        {title:'Кинематика',items:[
          ['Что показывает ускорение?','Скорость изменения скорости тела за единицу времени.'],
          ['Чем отличается средняя скорость от мгновенной?','Средняя характеризует движение за интервал, мгновенная — в данный момент.'],
          ['Скорость тела выросла с 4 до 16 м/с за 6 с. Найди ускорение.','2 м/с².','practice']
        ]},
        {title:'Законы Ньютона',items:[
          ['При каком условии тело сохраняет скорость по модулю и направлению?','Если равнодействующая сил равна нулю, в инерциальной системе отсчёта.'],
          ['Почему действие и противодействие не уравновешивают друг друга?','Они приложены к разным телам.'],
          ['На тело массой 3 кг действует результирующая сила 12 Н. Найди ускорение.','4 м/с².','practice']
        ]},
        {title:'Импульс',items:[
          ['Что называют импульсом тела?','Произведение массы на скорость: p = mv.'],
          ['Как формулируется закон сохранения импульса?','В замкнутой системе векторная сумма импульсов остаётся постоянной.']
        ]}
      ]
    },
    math7:{
      title:'Математика · 7 класс · Уравнения и функции',
      description:'Арифметика, линейные уравнения, функции и графики.',
      sections:[
        {title:'Выражения',items:[
          ['Раскрой скобки: 3(x + 2) − x.','2x + 6.','practice'],
          ['Что значит привести подобные слагаемые?','Сложить коэффициенты у слагаемых с одинаковой буквенной частью.']
        ]},
        {title:'Уравнения',items:[
          ['Реши уравнение 4x − 7 = 9.','x = 4.','practice'],
          ['Почему обе части уравнения можно умножить на одно и то же ненулевое число?','Преобразование сохраняет множество решений.'],
          ['Реши 2(x − 3) = 3x + 1.','x = −7.','practice']
        ]},
        {title:'Функции',items:[
          ['Что такое функция?','Соответствие, при котором каждому допустимому значению аргумента сопоставляется одно значение функции.'],
          ['Принадлежит ли точка (2; 5) графику y = 2x + 1?','Да: 2 · 2 + 1 = 5.','practice'],
          ['Как по графику найти значение функции при x = 3?','Найти точку графика с абсциссой 3 и прочитать её ординату.']
        ]}
      ]
    },
    informatics7:{
      title:'Информатика · 7 класс · Информация и алгоритмы',
      description:'Входная диагностика: единицы информации, файлы, алгоритмы и таблицы.',
      sections:[
        {title:'Информация и файлы',items:[
          ['Чем отличаются данные от информации?','Данные — представление сведений, информация — осмысленные сведения для получателя.'],
          ['Что показывает расширение файла?','Обычно указывает на формат или тип содержимого файла.'],
          ['Сколько бит содержит один байт?','8 бит.']
        ]},
        {title:'Алгоритмы',items:[
          ['Какие свойства должен иметь корректный алгоритм?','Понятность исполнителю, определённость шагов, конечность и результативность для решаемой задачи.'],
          ['Чем цикл отличается от ветвления?','Цикл повторяет действия, ветвление выбирает одну из альтернатив по условию.'],
          ['Назови пример алгоритма из повседневной жизни.','Например, последовательность действий для приготовления чая с определёнными шагами.']
        ]},
        {title:'Практика',items:[
          ['Сколько байт в 2 Кбайт при двоичной системе счёта (1 Кбайт = 1024 байт)?','2048 байт.','practice'],
          ['Чему будет равно x после команд: x = 2; x = x + 3; x = x · 2?','10.','practice']
        ]}
      ]
    },
    informatics9:{
      title:'Информатика · 9 класс · Логика и программирование',
      description:'Повторение логики, циклов, условий и основ программирования.',
      sections:[
        {title:'Логические выражения',items:[
          ['Когда логическое выражение A И B истинно?','Только когда одновременно истинны A и B.'],
          ['Чему равно НЕ(истина И ложь)?','Истина.','practice'],
          ['Что означает условие x >= 5 И x < 10?','Число x принадлежит промежутку от 5 включительно до 10 не включительно.']
        ]},
        {title:'Циклы и переменные',items:[
          ['Чем цикл с условием отличается от цикла с известным числом повторений?','В первом число повторений определяется значениями условия, во втором заранее задано.'],
          ['Чему равно s после трёх выполнений s = s + 2, если сначала s = 0?','6.','practice'],
          ['Зачем нужны переменные?','Для хранения и изменения значений данных при выполнении алгоритма.']
        ]},
        {title:'Алгоритмические задачи',items:[
          ['Составь алгоритм нахождения максимума из трёх чисел.','Присвоить максимум первому числу, затем сравнить со вторым и третьим, при необходимости обновляя максимум.','practice'],
          ['Что происходит при делении целого числа на ноль?','Операция не определена; программа должна предотвратить такое действие.']
        ]}
      ]
    },
    physics7:{
      title:'Физика · 7 класс · Основные понятия',
      description:'Величины, измерения, движение и простые расчётные задания.',
      sections:[
        {title:'Физические величины',items:[
          ['Что называют физической величиной? Приведи два примера.','Величина — измеряемое свойство явления или тела: длина, масса, время, температура.'],
          ['Как найти цену деления шкалы прибора?','Найти разность значений соседних подписанных штрихов и разделить на число промежутков.'],
          ['Почему результаты измерений не всегда абсолютно точны?','Из-за ограничений прибора, цены деления и погрешностей наблюдения.']
        ]},
        {title:'Движение и скорость',items:[
          ['Чем путь отличается от перемещения?','Путь — длина траектории, перемещение — вектор от начальной до конечной точки.'],
          ['Как вычислить скорость при равномерном движении?','v = s / t.'],
          ['Поезд проехал 120 км за 2 часа. Какова средняя скорость?','60 км/ч.','practice']
        ]},
        {title:'Масса и плотность',items:[
          ['Что показывает плотность вещества?','Массу единицы объёма: ρ = m / V.'],
          ['Тело объёмом 2 м³ имеет массу 1000 кг. Определи плотность.','500 кг/м³.','practice']
        ]}
      ]
    },
    math56:{
      title:'Математика · 5–6 класс · Диагностика',
      description:'Дроби, проценты, уравнения и геометрические задачи.',
      sections:[
        {title:'Числа и дроби',items:[
          ['Почему при сложении дробей с разными знаменателями их сначала приводят к общему знаменателю?','Чтобы складывать равные доли единицы.'],
          ['Вычисли 1/2 + 1/4.','3/4.','practice'],
          ['Что означает сократить дробь?','Разделить числитель и знаменатель на одно и то же ненулевое число.']
        ]},
        {title:'Проценты и уравнения',items:[
          ['Что такое 1% от числа?','Одна сотая этого числа.'],
          ['Найди 15% от 200.','30.','practice'],
          ['Реши уравнение 3x + 7 = 22.','x = 5.','practice']
        ]},
        {title:'Геометрия',items:[
          ['Чем периметр прямоугольника отличается от его площади?','Периметр — сумма длин сторон; площадь — мера поверхности.'],
          ['Прямоугольник имеет стороны 5 см и 8 см. Найди периметр и площадь.','Периметр 26 см, площадь 40 см².','practice']
        ]}
      ]
    }
  };
  const curriculum=typeof QD_PRESET_CURRICULUM==='object'?QD_PRESET_CURRICULUM:null;
  const model=collections[key]||curriculum?.new?.[key];if(!model)return null;
  const sections=[...model.sections,...(curriculum?.upgrades?.[key]||[])];
  return {title:model.title,description:model.description,sections:sections.map(s=>({
    id:qdNewId(),title:s.title,
    questions:s.items.map(item=>{
      const q=Array.isArray(item)?{prompt:item[0],answer:item[1],type:item[2],points:item[3]}:item;
      const options=Array.isArray(q.options)?q.options.slice(0,6):null;
      const correct=Array.isArray(q.correct)?q.correct:[q.correct];
      return {id:qdNewId(),type:qdType(q.type),prompt:qdText(q.prompt,1600),
        answer:qdText(q.answer,3500),points:qdPoints(q.points),partialCredit:50,
        choices:options?qdChoices(options.map((text,i)=>({text,correct:correct.includes(i)}))):qdChoices(),
        numericAnswer:qdText(q.numericAnswer,60),tolerance:qdTolerance(q.tolerance)};
    })
  }))};
}
function qdApplyTemplate(d,key){
  const template=qdTemplate(key);if(!template)return false;
  d.title=template.title;d.description=template.description;d.sections=template.sections;
  d.students=[];d.history=[];d.session={student:'',studentId:'',marks:{},responses:{}};
  d.display={mode:'list',activeId:''};qdStudentFilter='';qdRevealed.clear();
  qdStore();return true;
}
function qdReviewItems(d,marks=d.session.marks){
  return d.sections.flatMap(section=>section.questions
    .filter(q=>marks[q.id]==='no'||marks[q.id]==='partial')
    .map(q=>({id:q.id,section:section.title,prompt:q.prompt,
      grade:marks[q.id]})));
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
  d.students=[];d.session={student:'',studentId:'',marks:{},responses:{}};d.history=[];qdStudentFilter='';d.display={mode:'focus',activeId:''};qdRevealed.clear();qdStore();
}

function qdRibbonAction(action){
  const d=qdDoc();
  if(action==='writer-diag-library')qdMode='library';
  else if(action==='writer-diag-builder')qdMode='builder';
  else if(action==='writer-diag-list'){qdMode='run';qdDisplay(d).mode='list';}
  else if(action==='writer-diag-focus'){qdMode='run';qdDisplay(d).mode='focus';}
  else if(action==='writer-diag-export'){qdExport();return;}
  else if(action==='writer-diag-import'){document.getElementById('qo-diag-file')?.click();return;}
  else if(action==='writer-diag-templates-export'){qdLibraryExport();return;}
  else if(action==='writer-diag-templates-import'){
    document.getElementById('qd-library-file')?.click();return;
  }
  else if(action==='writer-diag-csv'){qdCSV();return;}
  else if(action==='writer-diag-new'){
    if(!confirm('Создать новую пустую диагностику? Вопросы, ученики и история текущей диагностики будут заменены. Сначала сохраните .qdiag.'))return;
    const blank=qdDefault();
    d.title=blank.title;d.description=blank.description;d.sections=blank.sections;
    d.students=blank.students;d.history=blank.history;d.session=blank.session;
    d.display={mode:'list',activeId:''};
    qdMode='builder';qoWriter.diagnosticMode='builder';
    qdRevealed.clear();qdSelected.clear();qdSearch='';qdFilterKind='all';
    qdStore();qdRefresh();return;
  }
  else return;
  if(qdMode!=='library'){qoWriter.diagnosticMode=qdMode;qdStore();}
  qdRevealed.clear();qdRefresh();
}
function qdRibbonSync(){
  const root=document.getElementById('qo-diag-root');
  const info=document.querySelector('.qo-document-workspace .qo-diag-ribbon-guide strong');
  if(info&&root){
    const d=qdDoc(),count=qdQuestionList(d).length;
    info.textContent=count+' вопросов · '+d.sections.length+' разделов';
  }
}

function qdSidebarTopics(d,mode){
  return '<nav class="qd-side-panel qd-topic-navigator" aria-label="Навигация по разделам">'+
    '<h2>Разделы</h2><p class="qd-side-caption">'+d.sections.length+' тем · '+qdQuestionList(d).length+' вопросов</p>'+    (mode==='builder'?'<button type="button" class="qd-side-toggle" data-qd-action="toggle-all-sections">'+      (qdCollapsedSections.size?'Развернуть все':'Свернуть все')+'</button>':'')+
    '<div class="qd-side-topic-list">'+d.sections.map((section,i)=>{
      const graded=qdScores(section.questions,d.session.marks);
      const share=graded.total?Math.round(graded.rated/graded.total*100):0;
      return '<button type="button" class="qd-side-topic" data-qd-action="sidebar-topic" data-sid="'+qdEsc(section.id)+'">'+
        '<span class="qd-side-topic-title"><b>'+(i+1)+'.</b>'+qdEsc(section.title||'Без названия')+'</span>'+
        '<span class="qd-side-topic-meta">'+section.questions.length+' заданий'+
         (mode==='run'?' · '+graded.rated+' оценено':'')+'</span>'+
        (mode==='run'?'<span class="qd-side-mini-bar"><i style="width:'+share+'%"></i></span>':'')+
      '</button>';
    }).join('')+'</div>'+
    '<p class="qd-side-footnote">Нажмите тему, чтобы перейти к её вопросам.</p></nav>';
}

function qdReviewQueues(d){
  const all=qdQuestionList(d),pending=[],review=[];
  for(let i=0;i<all.length;i++){
    const q=all[i],mark=d.session.marks[q.id];
    if(!QD_STATES.includes(mark))pending.push({id:q.id,number:i+1,section:q.section,prompt:q.prompt});
    else if(mark==='no'||mark==='partial')review.push({id:q.id,number:i+1,section:q.section,prompt:q.prompt,mark});
  }
  return {pending,review};
}
function qdSideQuestionItems(items,empty,kind){
  if(!items.length)return '<p class="qd-side-empty">'+qdEsc(empty)+'</p>';
  return '<div class="qd-review-list">'+items.slice(0,5).map(q=>
    '<button type="button" class="qd-review-link" data-qd-action="sidebar-question" data-qid="'+qdEsc(q.id)+'">'+
      '<span class="qd-review-title"><b>'+q.number+'.</b>'+qdEsc(q.prompt||'Вопрос не заполнен')+'</span>'+
      '<span class="qd-review-meta">'+qdEsc(q.section)+
        (kind==='review'?' · '+(q.mark==='no'?'Не знает':'Частично'):'')+'</span>'+
    '</button>').join('')+'</div>';
}
function qdSidebarInsights(d,mode){
  const all=qdQuestionList(d),s=qdScores(all,d.session.marks);
  if(mode==='builder'){
    const issues=qdAudit(d),types=[
      ['Вопрос',all.filter(q=>q.type==='question').length],
      ['Практика',all.filter(q=>q.type==='practice').length],
      ['Тест',all.filter(q=>q.type==='single'||q.type==='multiple').length],
      ['Число',all.filter(q=>q.type==='numeric').length]
    ];
    return '<aside class="qd-side-panel qd-side-insights" aria-label="Контроль качества диагностики">'+
      '<h2>Проверка заданий</h2><p class="qd-side-caption">Недочёты можно открыть сразу в конструкторе</p>'+
      '<div class="qd-side-stat"><span>Вопросов</span><strong>'+all.length+'</strong></div>'+
      '<div class="qd-side-stat"><span>Всего баллов</span><strong>'+s.maxPoints+'</strong></div>'+
      '<div class="qd-side-stat"><span>Замечаний</span><strong>'+issues.length+'</strong></div>'+
      '<h3>Требуют исправления</h3>'+
      (issues.length?'<div class="qd-review-list">'+issues.slice(0,5).map(issue=>{
        const question=all.find(q=>q.id===issue.qid),index=all.findIndex(q=>q.id===issue.qid)+1;
        return '<button type="button" class="qd-review-link" data-qd-action="sidebar-issue" data-qid="'+qdEsc(issue.qid)+'" data-field="'+qdEsc(issue.field)+'">'+
          '<span class="qd-review-title"><b>'+index+'.</b>'+qdEsc(issue.text)+'</span>'+
          '<span class="qd-review-meta">'+qdEsc(question?.prompt||'Пустой вопрос')+'</span></button>';
      }).join('')+'</div>':'<p class="qd-side-empty">Ошибок заполнения не обнаружено.</p>')+
      (issues.length>5?'<p class="qd-side-footnote">Показано 5 из '+issues.length+' замечаний. Полный список — в аудите конструктора.</p>':'')+
      '<h3>Типы заданий</h3>'+
      types.map(([title,num])=>
        '<div class="qd-side-type"><div><span>'+title+'</span><b>'+num+'</b></div>'+
        '<span class="qd-side-mini-bar"><i style="width:'+(all.length?Math.round(num/all.length*100):0)+'%"></i></span></div>').join('')+
      '</aside>';
  }
  const queues=qdReviewQueues(d);
  return '<aside class="qd-side-panel qd-side-insights qd-review-sidebar" aria-label="Очередь вопросов">'+
    '<h2>Очередь занятия</h2><p class="qd-side-caption">'+qdEsc(d.session.student||'Ученик не выбран')+'</p>'+
    '<div class="qd-side-stat"><span>Не проверено</span><strong>'+queues.pending.length+'</strong></div>'+
    '<div class="qd-side-stat"><span>К повторению</span><strong>'+queues.review.length+'</strong></div>'+
    '<h3>Следующие вопросы</h3>'+
    qdSideQuestionItems(queues.pending,'Все вопросы оценены.','pending')+
    '<h3>Вернуться к ответам</h3>'+
    qdSideQuestionItems(queues.review,'Нет заданий с частичной или отрицательной оценкой.','review')+
    '<p class="qd-side-footnote">Нажмите на вопрос, чтобы перейти к нему. Очередь обновляется после оценки.</p>'+
    '</aside>';
}

function qdWorkbench(d,mode,content){
  return '<div class="qd-workbench">'+
    qdSidebarTopics(d,mode)+
    '<main class="qd-workbench-main">'+content+'</main>'+
    qdSidebarInsights(d,mode)+'</div>';
}
function qdScrollToTopic(sid){
  const root=document.getElementById('qo-diag-root');
  const target=[...root?.querySelectorAll('[data-section]')||[]].find(el=>el.dataset.section===sid);
  const scroll=document.getElementById('qo-diag-workspace');
  if(!target||!scroll)return false;
  scroll.scrollTop+=target.getBoundingClientRect().top-scroll.getBoundingClientRect().top-12;
  return true;
}

function qdRefresh(){
  const root=document.getElementById('qo-diag-root');if(!root)return;
  const scroll=document.getElementById('qo-diag-workspace'),top=scroll?.scrollTop||0;
  qdSelected=new Set([...qdSelected].filter(id=>qdQuestionList(qdDoc()).some(q=>q.id===id)));
  root.classList.toggle('qd-focused-root',qdMode==='run'&&qdDisplay().mode==='focus');
  root.classList.toggle('qd-library-root',qdMode==='library');
  root.innerHTML=qdToolbar()+(qdMode==='library'?qdLibraryView():qdWorkbench(qdDoc(),qdMode,qdMode==='builder'?qdBuilder():qdRun()))+
    `<div class="qd-filebar" hidden>
       <input id="qo-diag-file" type="file" accept=".qdiag,application/json" hidden>
       <input id="qd-library-file" type="file" accept=".qtpl,application/json" hidden>
       <input id="qd-bank-file" type="file" accept=".qbank,application/json" hidden>
       </div>`;
  if(scroll)scroll.scrollTop=top;
  qdApplyFilterUI();
  qdRibbonSync();
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
  root.addEventListener('keydown',qdQuickKeydown);
  root.addEventListener('input',qdOnInput);
  root.addEventListener('change',qdOnChange);
  root.addEventListener('toggle',qdOnBuilderToggle,true);
  root.addEventListener('pointerdown',qdPointerDown);
  if(!qdPointerBound){
    window.addEventListener('pointermove',qdPointerMove,true);
    window.addEventListener('pointerup',qdPointerUp,true);
    window.addEventListener('pointercancel',qdPointerCancel,true);
    qdPointerBound=true;
  }
  if(!qdKeyboardBound){window.addEventListener('keydown',qdGuidedKeydown);qdKeyboardBound=true;}
  qoDiagnosticVisibility();
}
function qdOnBuilderToggle(event){
  if(event.target.dataset?.qdPane==='audit')qdAuditOpen=event.target.open;
  if(event.target.dataset?.qdPane==='bulk')qdBulkOpen=event.target.open;
  if(event.target.dataset?.qdPane==='variants'){
    qdVariantsOpen=event.target.open;if(qdVariantsOpen)qdVariantPreviewRefresh();
  }
}
function qdJumpToEdit(qid,field='prompt'){
  const root=document.getElementById('qo-diag-root');
  const card=[...root?.querySelectorAll('.qd-edit-card')||[]].find(el=>el.dataset.qid===qid);
  if(!card)return;
  const scroll=document.getElementById('qo-diag-workspace');
  if(scroll)scroll.scrollTop+=card.getBoundingClientRect().top-scroll.getBoundingClientRect().top-20;
  const input=[...card.querySelectorAll('[data-qd-field]')].find(el=>el.dataset.qdField===field);
  (input||card.querySelector('textarea'))?.focus({preventScroll:true});
}
function qdRefreshSideInsights(){
  if(qdMode!=='builder')return;
  const sidebar=document.querySelector('#qo-diag-root .qd-side-insights');
  if(!sidebar)return;
  const wrapper=document.createElement('div');
  wrapper.innerHTML=qdSidebarInsights(qdDoc(),'builder');
  const next=wrapper.firstElementChild;
  if(next){sidebar.replaceWith(next);}
}
function qdRefreshAudit(){
  if(qdMode!=='builder')return;
  const audit=document.getElementById('qd-audit-body');
  if(audit)audit.innerHTML=qdAuditMarkup(qdDoc());
  const summary=document.querySelector('[data-qd-pane="audit"] summary span');
  if(summary)summary.textContent=qdAudit(qdDoc()).length+' замечаний';
}
function qdOnClick(event){
  const button=event.target.closest('[data-qd-action]');if(!button)return;
  const action=button.dataset.qdAction,d=qdDoc();
  if(action==='mode'){
    qdMode=['run','builder','library'].includes(button.dataset.mode)?button.dataset.mode:'builder';
    if(qdMode!=='library'){qoWriter.diagnosticMode=qdMode;qdStore();}
    qdRevealed.clear();qdRefresh();return;
  }

  if(action==='bank-open'){
    qdBankOpen=true;qdRefresh();
    document.getElementById('qd-builder-bank')?.scrollIntoView({block:'start',behavior:'instant'});
    return;
  }
  if(action==='bank-toggle'){
    qdBankOpen=!qdBankOpen;qdBankPage=0;qdRefresh();return;
  }
  if(action==='bank-page-prev'||action==='bank-page-next'){
    qdBankPage+=action==='bank-page-prev'?-1:1;qdBankRefresh();return;
  }
  if(action==='bank-add'){
    const item=qdBankItems().find(x=>x.id===button.dataset.bankId);
    const target=[...document.querySelectorAll('[data-qd-bank-section]')].find(el=>el.dataset.qdBankSection===button.dataset.bankId)?.value||'';
    const result=qdBankAddToDoc(d,item,target);
    if(!result.ok){status(result.message,true);return;}
    qdStore();qdRefresh();status('Вопрос добавлен в раздел «'+result.section+'»');return;
  }
  if(action==='bank-save-question'){
    const meta=qdBuilderTemplateDefaults(d);
    const result=qdBankSaveQuestion(d,button.dataset.qid,
      document.getElementById('qd-builder-template-subject')?.value||meta.subject,
      document.getElementById('qd-builder-template-grade')?.value||meta.grade);
    if(!result.ok){status(result.message,true);return;}
    qdBankRefresh();status('Вопрос добавлен в личный банк');return;
  }
  if(action==='bank-remove'){
    if(!confirm('Удалить свой вопрос из банка? В уже созданных диагностиках он останется.'))return;
    if(!qdBankRemove(button.dataset.bankId)){status('Не удалось удалить вопрос',true);return;}
    qdBankRefresh();status('Вопрос удалён из банка');return;
  }
  if(action==='bank-export'){qdBankExport();return;}
  if(action==='bank-import'){document.getElementById('qd-bank-file')?.click();return;}
  if(action==='builder-quick-save'){
    const meta=qdBuilderTemplateDefaults(d);
    const linked=qdLibraryRead().find(x=>x.id===qdBuilderLinkedTemplateId&&qdPromptKey(x.title)===qdPromptKey(d.title));
    const fields={subject:meta.subject,grade:meta.grade,purpose:meta.purpose};
    const result=qdBuilderSaveTemplate(d,linked?'update':'new',linked?.id||'',fields);
    if(!result.ok){
      status(result.message+' · Используйте форму сохранения внизу конструктора.',true);
      document.querySelector('.qd-builder-save')?.scrollIntoView({block:'start',behavior:'instant'});
      return;
    }
    qdBuilderLinkedTemplateId=linked?.id||result.id;
    qdBuilderSavedSignature=qdBuilderSignature(d);
    qdStore();qdRefresh();status(linked?'Изменения шаблона сохранены':'Создан собственный шаблон');
    return;
  }
  if(action==='builder-template-restore'){
    const target=document.getElementById('qd-builder-template-target')?.value||'';
    const revision=document.getElementById('qd-builder-template-revision')?.value||'';
    if(!target||!revision){status('Выберите свой шаблон и его предыдущую версию',true);return;}
    if(!confirm('Восстановить выбранную версию своего шаблона в библиотеке? Текущая диагностика не изменится.'))return;
    const result=qdTemplateRevisionRestore(target,revision);
    if(!result.ok){status(result.message,true);return;}
    qdRefresh();status('Версия шаблона восстановлена в библиотеке. Текущая диагностика не изменена.');
    return;
  }
  if(action==='preview-chat'){
    qdDisplay(d).mode='list';qdMode='run';qoWriter.diagnosticMode='run';
    qdRevealed.clear();qdStore();qdRefresh();return;
  }
  if(action==='library-preview'){
    if(!qdLibraryPreviewPick(button.dataset.source,button.dataset.template)){
      status('Шаблон не найден',true);return;
    }
    qdLibraryPreviewRefresh();
    const preview=document.querySelector('#qd-library-preview-slot .qd-library-preview');
    if(preview)preview.scrollIntoView({block:'start',behavior:'instant'});
    return;
  }
  if(action==='library-preview-close'){
    qdLibraryPreviewData=null;qdLibraryPreviewSelected.clear();qdLibraryPreviewRefresh();return;
  }
  if(action==='library-preview-all'||action==='library-preview-none'){
    const model=qdLibraryPreviewData?.model;if(!model)return;
    qdLibraryPreviewSelected=action==='library-preview-all'?
      new Set(qdQuestionList(model).map(q=>q.id)):new Set();
    qdLibraryPreviewRefresh();return;
  }
  if(action==='library-preview-add'){
    const model=qdLibraryPreviewData?.model;
    const plan=qdLibraryMergePlan(d,model,qdLibraryPreviewSelected);
    if(!plan.ok){status(plan.error||'Выберите вопросы',true);qdLibraryPreviewRefresh();return;}
    if(!qdLibraryMergeApply(d,plan)){status('Невозможно добавить вопросы',true);return;}
    qdStore();qdLibraryPreviewRefresh();
    status('Добавлено '+plan.items.length+' вопросов'+(plan.duplicates?'; пропущено повторов: '+plan.duplicates:''));
    return;
  }
  if(action==='library-open'){
    const id=button.dataset.template,source=button.dataset.source;
    if(!confirm('Открыть шаблон вместо текущих вопросов? Текущая диагностика и журнал будут заменены. Для сохранности сначала скачайте .qdiag.'))return;
    if(!qdLibraryLoad(d,id,source)){status('Шаблон не найден',true);return;}
    qdBuilderLinkedTemplateId=source==='custom'?id:'';
    qdBuilderSavedSignature=source==='custom'?qdBuilderSignature(d):'';
    qdMode='run';qoWriter.diagnosticMode='run';qdStore();qdRefresh();status('Шаблон открыт');return;
  }
  if(action==='library-edit'){
    qdLibraryEditingId=button.dataset.template;
    qdLibraryEditorRefresh();
    document.getElementById('qd-library-editor-slot')?.scrollIntoView({block:'start',behavior:'instant'});
    return;
  }
  if(action==='library-edit-cancel'){
    qdLibraryEditingId='';qdLibraryEditorRefresh();return;
  }
  if(action==='library-edit-save'){
    const fields={
      title:document.getElementById('qd-library-edit-title')?.value,
      description:document.getElementById('qd-library-edit-description')?.value,
      subject:document.getElementById('qd-library-edit-subject')?.value,
      grade:document.getElementById('qd-library-edit-grade')?.value,
      purpose:document.getElementById('qd-library-edit-purpose')?.value
    };
    const replaceQuestions=!!document.getElementById('qd-library-edit-replace')?.checked;
    if(replaceQuestions&&!confirm('Заменить все вопросы выбранного шаблона вопросами текущей диагностики? Старая версия шаблона будет перезаписана. Для резервной копии сначала экспортируйте .qtpl.'))return;
    const result=qdLibraryUpdate(qdLibraryEditingId,fields,d,replaceQuestions);
    if(!result.ok){status(result.message,true);return;}
    if(qdLibraryPreviewData?.source==='custom'&&qdLibraryPreviewData.id===qdLibraryEditingId)
      qdLibraryPreviewPick('custom',qdLibraryEditingId);
    qdLibraryEditingId='';qdRefresh();
    status('Шаблон обновлён: '+result.questions+' вопросов');return;
  }
  if(action==='library-clone'){
    const result=qdLibraryClone(button.dataset.template);
    if(!result.ok){status(result.message,true);return;}
    qdRefresh();status('Создана копия: '+result.title);return;
  }
  if(action==='builder-template-save'||action==='builder-template-update'){
    const fields={
      subject:document.getElementById('qd-builder-template-subject')?.value||'other',
      grade:document.getElementById('qd-builder-template-grade')?.value||'',
      purpose:document.getElementById('qd-builder-template-purpose')?.value||'diagnostic'
    };
    const mode=action==='builder-template-save'?'new':'update';
    const target=document.getElementById('qd-builder-template-target')?.value||'';
    if(mode==='update'){
      const item=qdLibraryRead().find(x=>x.id===target);
      if(!item){status('Выберите свой шаблон для обновления',true);return;}
      if(!confirm('Перезаписать сохранённый шаблон «'+item.title+'» текущими заданиями? Для резервной копии сначала скачайте .qtpl.'))return;
    }
    const result=qdBuilderSaveTemplate(d,mode,target,fields);
    if(!result.ok){status(result.message||'Не удалось сохранить шаблон',true);return;}
    qdBuilderLinkedTemplateId=mode==='new'?result.id:target;
    qdBuilderSavedSignature=qdBuilderSignature(d);
    qdStore();qdRefresh();
    status(mode==='new'?'Создан новый шаблон в локальной библиотеке':
      'Обновлён мой шаблон: '+result.questions+' заданий');
    return;
  }
  if(action==='builder-template-export'){qdLibraryExport();return;}
  if(action==='library-save'){
    const subject=document.getElementById('qd-library-save-subject')?.value||'other';
    const grade=document.getElementById('qd-library-save-grade')?.value||'';
    const purpose=document.getElementById('qd-library-save-purpose')?.value||'diagnostic';
    const result=qdLibrarySaveCurrent(d,subject,grade,purpose);
    if(!result.ok){status(result.message,true);return;}
    qdRefresh();status('Шаблон сохранён в библиотеку на этом устройстве');return;
  }
  if(action==='library-export'){qdLibraryExport();return;}
  if(action==='library-import'){document.getElementById('qd-library-file')?.click();return;}
  if(action==='library-delete'){
    if(!confirm('Удалить свой шаблон из библиотеки? Текущая диагностика сохранится.'))return;
    if(qdLibraryDelete(button.dataset.template)){
      if(qdLibraryPreviewData?.id===button.dataset.template){qdLibraryPreviewData=null;qdLibraryPreviewSelected.clear();}
      if(qdLibraryEditingId===button.dataset.template)qdLibraryEditingId='';
      qdRefresh();status('Шаблон удалён');}
    else status('Не удалось удалить шаблон',true);
    return;
  }
  if(action==='review-jump'){
    const index=qdQuestionList(d).findIndex(q=>q.id===button.dataset.qid);
    if(index<0)return;
    qdDisplay(d).mode='focus';qdSelectQuestion(d,index);
    qdRevealed.clear();qdStore();qdRefresh();qdScrollToQuestion();return;
  }
  if(action==='view'){
    d.display=qdDisplay(d);
    d.display.mode=button.dataset.view==='list'?'list':'focus';
    qdStore();qdRefresh();return;
  }
  if(action==='nav-prev'||action==='nav-next'||action==='nav-index'||action==='nav-unrated'){
    const all=qdQuestionList(d),pos=qdCurrentIndex(d,all);
    let index=pos;
    if(action==='nav-prev')index=pos-1;
    if(action==='nav-next')index=pos+1;
    if(action==='nav-index')index=Number(button.dataset.index);
    if(action==='nav-unrated'){
      const pending=all.findIndex((q,i)=>i>pos&&!QD_STATES.includes(d.session.marks[q.id]));
      index=pending>=0?pending:all.findIndex(q=>!QD_STATES.includes(d.session.marks[q.id]));
    }
    if(qdSelectQuestion(d,index)){qdRevealed.clear();qdStore();qdRefresh();qdScrollToQuestion();}
    return;
  }

  if(action==='select-visible'){
    for(const q of qdMatchingQuestions(d))qdSelected.add(q.id);
    qdRefresh();return;
  }
  if(action==='selection-clear'){qdSelected.clear();qdRefresh();return;}
  if(action==='batch-apply'){
    const operation=document.getElementById('qd-batch-action')?.value;
    const value=document.getElementById('qd-batch-value')?.value;
    const ids=[...qdSelected];
    if(!ids.length){status('Сначала выберите вопросы',true);return;}
    if(operation==='delete'&&!confirm('Удалить '+ids.length+' выбранных вопросов? Старые результаты в журнале сохранятся.'))return;
    const result=qdBatchApply(d,ids,operation,value);
    if(!result.ok){status(result.message,true);return;}
    qdSelected.clear();qdCardExpanded.clear();qdStore();qdRefresh();
    status('Изменено вопросов: '+result.count);return;
  }
  if(action==='sidebar-question'){
    const id=button.dataset.qid,all=qdQuestionList(d);
    const index=all.findIndex(q=>q.id===id);
    if(index<0||qdMode!=='run')return;
    if(qdDisplay(d).mode==='focus'){
      qdSelectQuestion(d,index);qdRevealed.clear();qdStore();qdRefresh();qdScrollToQuestion();return;
    }
    const root=document.getElementById('qo-diag-root');
    const card=[...root?.querySelectorAll('.qd-run-card')||[]].find(el=>el.dataset.qid===id);
    const scroll=document.getElementById('qo-diag-workspace');
    if(card&&scroll)scroll.scrollTop+=card.getBoundingClientRect().top-scroll.getBoundingClientRect().top-16;
    return;
  }
  if(action==='sidebar-issue'){
    const id=button.dataset.qid,section=d.sections.find(s=>s.questions.some(q=>q.id===id));
    if(!section||qdMode!=='builder')return;
    qdCollapsedSections.delete(section.id);
    qdSearch='';qdFilterKind='all';
    if(qdCompact)qdCardExpanded.add(id);
    qdRefresh();qdJumpToEdit(id,button.dataset.field);return;
  }
  if(action==='sidebar-topic'){
    const sid=button.dataset.sid,section=d.sections.find(x=>x.id===sid);
    if(!section)return;
    if(qdMode==='builder'){
      qdCollapsedSections.delete(sid);
      if(qdSearch||qdFilterKind!=='all'){qdSearch='';qdFilterKind='all';}
      qdRefresh();qdScrollToTopic(sid);
      return;
    }
    if(qdMode==='run'&&qdDisplay(d).mode==='focus'){
      const target=qdQuestionList(d).findIndex(q=>q.id===section.questions[0]?.id);
      if(target>=0){qdSelectQuestion(d,target);qdRevealed.clear();qdStore();qdRefresh();}
      return;
    }
    qdScrollToTopic(sid);return;
  }
  if(action==='variant-print'){
    const result=qdVariantPrintDownload(d,Number(button.dataset.variantIndex),button.dataset.variantKind);
    if(!result.ok)status(result.message,true);
    return;
  }
  if(action==='variant-download'){
    const result=qdVariantsBuild(d);
    const index=Number(button.dataset.variantIndex);
    const variant=result.ok&&Number.isInteger(index)?result.variants[index]:null;
    if(!variant){status(result.error||'Неверные настройки вариантов',true);return;}
    const base=typeof safeFile==='function'?safeFile(d.title):'diagnostic';
    download(base+'-variant-'+variant.label+'.qdiag',
      JSON.stringify(variant.document,null,2),'application/json;charset=utf-8');
    return;
  }
  if(action==='toggle-all-sections'){
    qdCollapsedSections=qdCollapsedSections.size?new Set():new Set(d.sections.map(s=>s.id));
    qdRefresh();return;
  }
  if(action==='compact-mode'){
    qdCompact=!qdCompact;qdCardExpanded.clear();qdRefresh();return;
  }
  if(action==='card-expand'){
    const id=button.dataset.qid;
    if(qdCardExpanded.has(id))qdCardExpanded.delete(id);
    else qdCardExpanded.add(id);
    qdRefresh();if(qdCardExpanded.has(id))qdJumpToEdit(id);return;
  }
  if(action==='audit-jump'){
    qdSearch='';qdFilterKind='all';
    const id=button.dataset.qid;
    if(qdCompact)qdCardExpanded.add(id);
    qdAuditOpen=true;qdRefresh();qdJumpToEdit(id,button.dataset.field);return;
  }
  if(action==='bulk-commit'){
    const plan=qdBulkPlan(d,qdBulkDraft,qdBulkTarget);
    if(!plan.ok){status('Исправьте ошибки массовой вставки',true);return;}
    if(!qdBulkCommit(d,plan)){status('Не удалось добавить вопросы из-за ограничения размера',true);return;}
    qdBulkDraft='';qdBulkOpen=false;qdAuditOpen=true;
    qdStore();qdRefresh();status('Добавлено '+plan.items.length+' новых заданий');return;
  }
  if(action==='export'){qdExport();return;}
  if(action==='csv'){qdCSV();return;}
  if(action==='import'){document.getElementById('qo-diag-file')?.click();return;}
  if(action==='use-template'){
    const key=document.getElementById('qd-template-pick')?.value;
    if(!qdTemplate(key))return;
    if(!confirm('Заменить текущую диагностику шаблоном? Вопросы, ученики и история этого документа будут заменены. При необходимости сначала скачайте .qdiag.'))return;
    qdApplyTemplate(d,key);
    qdBuilderLinkedTemplateId='';qdBuilderSavedSignature='';
    qdSelected.clear();qdSearch='';qdFilterKind='all';qdRefresh();return;
  }
  if(action==='sample-auto'){
    if(qdQuestionList(d).length+2>QD_LIMITS.questions||d.sections.length>=QD_LIMITS.sections){
      status('Превышен лимит разделов или заданий',true);return;
    }
    d.sections.push({id:qdNewId(),title:'Автопроверка · пример',questions:[
      {id:qdNewId(),type:'single',prompt:'Каким способом тепло Солнца достигает Земли через вакуум?',
        answer:'В вакууме передача энергии происходит электромагнитным излучением.',
        choices:[{text:'Теплопроводность',correct:false},{text:'Конвекция',correct:false},
          {text:'Излучение',correct:true},{text:'Диффузия',correct:false}],
        numericAnswer:'',tolerance:0,points:2,partialCredit:50},
      {id:qdNewId(),type:'numeric',prompt:'Сколько килоджоулей нужно для нагрева 2 кг воды на 10 °C? c = 4200 Дж/(кг·°C).',
        answer:'Q = cmΔt = 4200 × 2 × 10 = 84 000 Дж = 84 кДж.',
        choices:qdChoices(),numericAnswer:'84',tolerance:0.5,points:4,partialCredit:50}
    ]});
    qdStore();qdRefresh();return;
  }
  if(action==='sample'){
    if(!confirm('Заменить текущую диагностику примером? Вопросы и история текущего документа будут заменены.'))return;
    qdSample();qdSelected.clear();qdSearch='';qdFilterKind='all';qdRefresh();return;
  }

  if(action==='section-collapse'){
    const sid=button.dataset.sid;
    if(!d.sections.some(s=>s.id===sid))return;
    if(qdCollapsedSections.has(sid))qdCollapsedSections.delete(sid);
    else qdCollapsedSections.add(sid);
    qdRefresh();return;
  }
  if(action==='duplicate-section'){
    const result=qdDuplicateSection(d,button.dataset.sid);
    if(!result.ok){status(result.message,true);return;}
    qdCollapsedSections.delete(result.id);
    qdStore();qdRefresh();status('Раздел скопирован: '+result.count+' вопросов');return;
  }
  if(action==='quick-add'){
    const section=button.closest('[data-qd-quick-sid]');
    if(!section)return;
    const get=field=>section.querySelector('[data-qd-quick="'+field+'"]')?.value||'';
    const input={prompt:get('prompt'),answer:get('answer'),type:get('type')};
    const result=qdQuickAdd(d,section.dataset.qdQuickSid,input);
    if(!result.ok){status(result.message,true);return;}
    qdQuickLastType=input.type;qdStore();qdRefresh();
    const refreshed=[...document.querySelectorAll('[data-qd-quick-sid]')]
      .find(el=>el.dataset.qdQuickSid===section.dataset.qdQuickSid);
    refreshed?.querySelector('[data-qd-quick="prompt"]')?.focus({preventScroll:true});
    status('Вопрос добавлен');return;
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
  if(action==='add-choice'||action==='remove-choice'){
    const q=d.sections.flatMap(s=>s.questions).find(q=>q.id===button.dataset.qid);
    if(!q||!['single','multiple'].includes(q.type))return;
    const choices=qdChoices(q.choices),i=Number(button.dataset.index);
    if(action==='add-choice'&&choices.length<6)choices.push({text:'',correct:false});
    else if(action==='remove-choice'&&choices.length>2&&Number.isInteger(i)&&i>=0&&i<choices.length)choices.splice(i,1);
    else return;
    q.choices=choices;delete d.session.marks[q.id];delete d.session.responses[q.id];
    qdStore();qdRefresh();return;
  }
  if(action==='auto-check'){
    const q=d.sections.flatMap(s=>s.questions).find(q=>q.id===button.dataset.qid);
    if(!q||!qdAuto(q.type))return;
    const grade=qdCheckAnswer(q,d.session.responses[q.id]);
    if(grade===null){status('Выберите ответ или проверьте настройку правильного ответа',true);return;}
    d.session.marks[q.id]=grade;qdStore();qdRefresh();return;
  }
  if(action==='add-section'){
    if(d.sections.length>=QD_LIMITS.sections){status('Максимум 24 раздела',true);return;}
    d.sections.push({id:qdNewId(),title:`Раздел ${d.sections.length+1}`,questions:[]});qdStore();qdRefresh();return;
  }
  if(action==='delete-section'){
    if(!confirm('Удалить раздел и все его вопросы?'))return;
    const old=d.sections.find(x=>x.id===button.dataset.sid);
    if(old)old.questions.forEach(q=>{delete d.session.marks[q.id];delete d.session.responses[q.id];qdRevealed.delete(q.id);});
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
    delete d.session.marks[button.dataset.qid];delete d.session.responses[button.dataset.qid];qdRevealed.delete(button.dataset.qid);
    qdStore();qdRefresh();return;
  }
  if(action==='mark'){
    const qid=button.dataset.qid,mark=button.dataset.mark;
    const question=qdQuestionList(d).find(q=>q.id===qid);
    if(!QD_STATES.includes(mark)||!question)return;
    if(!qdText(question.prompt,1600).trim()){
      status('Сначала заполните формулировку вопроса в конструкторе',true);return;
    }
    const isNewGrade=d.session.marks[qid]!==mark;
    if(!isNewGrade)delete d.session.marks[qid];else d.session.marks[qid]=mark;
    if(isNewGrade&&qdDisplay(d).mode==='focus'&&qdQuestionList(d)[qdCurrentIndex(d)]?.id===qid){
      qdAdvance(d);qdRevealed.clear();
    }
    qdStore();qdRefresh();
    if(isNewGrade&&qdDisplay(d).mode==='focus')qdScrollToQuestion();
    return;
  }
  if(action==='reveal'){
    if(qdRevealed.has(button.dataset.qid))qdRevealed.delete(button.dataset.qid);
    else qdRevealed.add(button.dataset.qid);qdRefresh();return;
  }
  if(action==='reset'){
    if(Object.keys(d.session.marks).length&&!confirm('Очистить оценки текущего занятия без сохранения?'))return;
    d.session={student:'',studentId:'',marks:{},responses:{}};qdDisplay(d).activeId='';qdRevealed.clear();qdStore();qdRefresh();return;
  }
  if(action==='report-current'){qdExportReport();return;}
  if(action==='progress-export'){
    const result=qdHistoryComparisonCSV(d,qdStudentFilter,qdHistoryComparisonFrom,qdHistoryComparisonTo);
    if(!result.ok){status(result.reason||'Выберите занятия',true);return;}
    const student=d.students.find(x=>x.id===qdStudentFilter);
    download((typeof safeFile==='function'?safeFile(student?.name||'student'):'student')+'-динамика.csv',
      result.content,'text/csv;charset=utf-8');return;
  }
  if(action==='group-filter'){
    qdGroupJournalFilter=button.dataset.filter==='attention'?'attention':'all';
    qdGroupJournalRefresh();return;
  }
  if(action==='group-topic'){
    const topic=qdText(button.dataset.topic,120);
    if(!qdGroupTopicPlan(qdGroupSnapshot(d)).some(x=>x.key===topic))return;
    qdGroupTopicFilter=qdGroupTopicFilter===topic?'':topic;
    qdGroupJournalRefresh();return;
  }
  if(action==='group-topics-expand'){
    qdGroupTopicExpand=!qdGroupTopicExpand;
    if(!qdGroupTopicExpand){
      const shown=qdGroupTopicPlan(qdGroupSnapshot(d)).slice(0,6);
      if(qdGroupTopicFilter&&!shown.some(t=>t.key===qdGroupTopicFilter))qdGroupTopicFilter='';
    }
    qdGroupJournalRefresh();return;
  }
  if(action==='group-topics-export'){
    download((typeof safeFile==='function'?safeFile(d.title):'diagnostic')+'-темы-группы.csv',
      qdGroupTopicPlanCSV(d),'text/csv;charset=utf-8');return;
  }
  if(action==='group-open-student'){
    if(!d.students.some(x=>x.id===button.dataset.student))return;
    qdStudentFilter=button.dataset.student;
    qdHistoryComparisonFrom='';qdHistoryComparisonTo='';
    qdRefresh();
    document.getElementById('qd-history-progress')?.scrollIntoView({block:'nearest'});
    return;
  }
  if(action==='group-export'){
    const data=qdGroupJournalCSV(d);
    download((typeof safeFile==='function'?safeFile(d.title):'diagnostic')+'-ученики.csv',
      data,'text/csv;charset=utf-8');return;
  }
  if(action==='report-saved'){
    const item=d.history.find(h=>h.id===button.dataset.hid);
    if(item)qdExportReport(item);
    return;
  }
  if(action==='save-result'){
    const stats=qdScores(qdQuestionList(d),d.session.marks);
    if(!stats.rated)return;
    d.history.push({id:qdNewId(),date:new Date().toISOString(),student:d.session.student,
      title:d.title,studentId:d.session.studentId||'',marks:{...d.session.marks},responses:structuredClone(d.session.responses),summary:stats,
      topics:qdTopicSnapshot(d,d.session.marks)});
    d.history=d.history.slice(-QD_LIMITS.history);
    d.session={student:'',studentId:'',marks:{},responses:{}};qdDisplay(d).activeId='';qdRevealed.clear();qdStore();qdRefresh();
    status('Результат сохранён в истории диагностики');return;
  }
}


function qdScrollToQuestion(){
  const scroll=document.getElementById('qo-diag-workspace'),guided=document.querySelector('#qo-diag-root .qd-guided');
  if(scroll&&guided)scroll.scrollTop+=guided.getBoundingClientRect().top-scroll.getBoundingClientRect().top-12;
}
function qdGuidedKeydown(event){
  if(qdMode!=='run'||event.ctrlKey||event.metaKey||event.altKey||event.repeat)return;
  const workspace=document.getElementById('qo-diag-workspace');
  if(!workspace||workspace.hidden||qdDisplay().mode!=='focus')return;
  if(event.target.closest?.('input,textarea,select,button,[contenteditable="true"],[role="textbox"]'))return;
  const actions={ArrowLeft:'nav-prev',ArrowRight:'nav-next',r:'reveal',R:'reveal'};
  const marks={'1':'yes','2':'partial','3':'no'};
  let button=null;
  if(marks[event.key])button=workspace.querySelector('.qd-guided [data-qd-action="mark"][data-mark="'+marks[event.key]+'"]');
  else if(actions[event.key]){
    const a=actions[event.key];button=workspace.querySelector('.qd-guided [data-qd-action="'+a+'"]');
  }
  if(button&&!button.disabled){event.preventDefault();button.click();}
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
  if(event.target.id==='qd-var-seed'){
    qdVariantOptions.seed=event.target.value.slice(0,40);
    qdVariantPreviewRefresh();return;
  }
  if(event.target.id==='qd-library-search'){
    qdLibraryQuery=event.target.value.slice(0,120);qdLibraryRefreshCards();return;
  }
  if(event.target.id==='qd-search'){
    qdSearch=event.target.value.slice(0,160);qdApplyFilterUI();return;
  }
  if(event.target.id==='qd-bank-search'){
    qdBankQuery=event.target.value.slice(0,120);qdBankPage=0;qdBankRefresh();return;
  }
  if(event.target.id==='qd-bulk-text'){
    qdBulkDraft=event.target.value.slice(0,QD_BULK_MAX_CHARS);
    const preview=document.getElementById('qd-bulk-preview');
    if(preview)preview.innerHTML=qdBulkPreview(qdDoc());
    return;
  }
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
  }else if(field==='choice-text'){
    const q=d.sections.flatMap(s=>s.questions).find(q=>q.id===event.target.dataset.qid);
    const i=Number(event.target.dataset.index);
    if(!q||!q.choices?.[i])return;
    q.choices[i].text=qdText(value,240);delete d.session.marks[q.id];
  }else if(field==='numericAnswer'){
    const q=d.sections.flatMap(s=>s.questions).find(q=>q.id===event.target.dataset.qid);
    if(!q)return;
    q.numericAnswer=qdText(value,60);delete d.session.marks[q.id];
  }else if(field==='numeric-response'){
    const q=d.sections.flatMap(s=>s.questions).find(q=>q.id===event.target.dataset.qid);
    if(!q||q.type!=='numeric')return;
    d.session.responses[q.id]={value:qdText(value,80)};delete d.session.marks[q.id];
  }else if(field==='student-name')return;
  else return;
  qdStore();
  if(['title','description','section','prompt','answer','choice-text','numericAnswer'].includes(field))
    qdBuilderSaveStatus();
  if(field==='prompt'){
    const card=event.target.closest('.qd-edit-card');
    const preview=card?.querySelector('.qd-card-preview');
    if(preview)preview.textContent=value.trim()||'Новый вопрос';
  }
  if(['prompt','answer','choice-text','numericAnswer'].includes(field)){
    qdRefreshAudit();qdRefreshSideInsights();
  }
}
function qdOnChange(event){
  if(['qd-var-count','qd-var-per-section','qd-var-choices'].includes(event.target.id)){
    if(event.target.id==='qd-var-count')qdVariantOptions.count=Number(event.target.value);
    if(event.target.id==='qd-var-per-section')qdVariantOptions.perSection=Number(event.target.value);
    if(event.target.id==='qd-var-choices')qdVariantOptions.shuffleChoices=event.target.checked;
    qdVariantPreviewRefresh();return;
  }
  if(['qd-bank-subject','qd-bank-grade','qd-bank-type'].includes(event.target.id)){
    if(event.target.id==='qd-bank-subject')qdBankSubject=event.target.value;
    if(event.target.id==='qd-bank-grade')qdBankGrade=event.target.value;
    if(event.target.id==='qd-bank-type')qdBankType=event.target.value;
    qdBankPage=0;qdBankRefresh();return;
  }
  if(event.target.matches?.('[data-qd-template-select]')){
    const id=event.target.dataset.qdTemplateSelect;
    if(event.target.checked)qdLibraryPreviewSelected.add(id);
    else qdLibraryPreviewSelected.delete(id);
    const slot=document.getElementById('qd-library-preview-slot');
    const footer=slot?.querySelector('.qd-library-preview-footer');
    const summary=slot?.querySelector('.qd-library-preview-options strong');
    const preview=qdLibraryPreviewData?.model;
    if(preview&&summary)summary.textContent=qdLibraryPreviewSelected.size+' из '+qdQuestionList(preview).length+' выбрано';
    if(footer&&preview){
      const plan=qdLibraryMergePlan(qdDoc(),preview,qdLibraryPreviewSelected);
      footer.querySelector('.qd-library-preview-count').innerHTML=plan.ok?
        '<strong>Будет добавлено: '+plan.items.length+'</strong> · новых разделов: '+plan.newSections.length+
        (plan.duplicates?' · повторов пропущено: '+plan.duplicates:''):
        '<strong>'+qdEsc(plan.error||'Выберите вопросы')+'</strong>';
      footer.querySelector('[data-qd-action="library-preview-add"]').disabled=!plan.ok;
    }
    return;
  }
  if(['qd-library-subject','qd-library-grade','qd-library-purpose'].includes(event.target.id)){
    if(event.target.id==='qd-library-subject')qdLibrarySubject=event.target.value;
    if(event.target.id==='qd-library-grade')qdLibraryGrade=event.target.value;
    if(event.target.id==='qd-library-purpose')qdLibraryPurpose=event.target.value;
    qdLibraryRefreshCards();return;
  }
  if(event.target.matches?.('[data-qd-select]')){
    const id=event.target.dataset.qid;
    if(event.target.checked)qdSelected.add(id);
    else qdSelected.delete(id);
    qdApplyFilterUI();return;
  }
  if(event.target.id==='qd-filter-kind'){
    qdFilterKind=event.target.value;
    qdApplyFilterUI();return;
  }
  if(event.target.id==='qd-batch-action'){
    const body=document.getElementById('qd-batch-inputs');
    if(body)body.innerHTML=qdBatchInputs(qdDoc(),event.target.value);
    return;
  }
  if(event.target.id==='qd-bulk-target'){
    qdBulkTarget=event.target.value;
    const preview=document.getElementById('qd-bulk-preview');
    if(preview)preview.innerHTML=qdBulkPreview(qdDoc());
    return;
  }
  if(event.target.dataset.qdField==='choice-correct'){
    const q=qdDoc().sections.flatMap(s=>s.questions).find(q=>q.id===event.target.dataset.qid),i=Number(event.target.dataset.index);
    if(!q||!['single','multiple'].includes(q.type)||!q.choices?.[i])return;
    if(q.type==='single')q.choices.forEach((c,j)=>c.correct=i===j);
    else q.choices[i].correct=event.target.checked;
    delete qdDoc().session.marks[q.id];qdStore();qdRefresh();return;
  }
  if(event.target.dataset.qdField==='tolerance'){
    const q=qdDoc().sections.flatMap(s=>s.questions).find(q=>q.id===event.target.dataset.qid);
    if(!q)return;
    q.tolerance=qdTolerance(Number(event.target.value));delete qdDoc().session.marks[q.id];
    qdStore();qdRefresh();return;
  }
  if(event.target.dataset.qdField==='auto-selection'){
    const d=qdDoc(),q=d.sections.flatMap(s=>s.questions).find(q=>q.id===event.target.dataset.qid);
    if(!q||!['single','multiple'].includes(q.type))return;
    const i=Number(event.target.dataset.index);
    let selected=qdNormalizeResponse(q,d.session.responses[q.id]).selected;
    if(i<0||i>=q.choices.length)return;
    if(q.type==='single')selected=[i];
    else if(event.target.checked)selected=[...new Set([...selected,i])];
    else selected=selected.filter(x=>x!==i);
    d.session.responses[q.id]={selected};delete d.session.marks[q.id];
    qdStore();return;
  }
  if(event.target.id==='qd-builder-template-target'){
    const item=qdLibraryRead().find(x=>x.id===event.target.value);
    if(item){
      const subject=document.getElementById('qd-builder-template-subject');
      const grade=document.getElementById('qd-builder-template-grade');
      const purpose=document.getElementById('qd-builder-template-purpose');
      if(subject)subject.value=item.subject;
      if(grade)grade.value=item.grade;
      if(purpose)purpose.value=item.purpose;
    }
    const versions=document.getElementById('qd-builder-template-revision');
    if(versions)versions.innerHTML=qdTemplateVersionOptions(item?.id||'');
    const restore=document.querySelector('[data-qd-action="builder-template-restore"]');
    if(restore)restore.disabled=!item;
    return;
  }
  if(event.target.dataset.qdField==='history-filter'){
    qdStudentFilter=event.target.value;qdHistoryComparisonFrom='';qdHistoryComparisonTo='';
    qdRefresh();return;
  }
  if(event.target.dataset.qdField==='history-compare-from'){
    qdHistoryComparisonFrom=event.target.value;
    qdHistoryProgressRefresh();return;
  }
  if(event.target.dataset.qdField==='history-compare-to'){
    qdHistoryComparisonTo=event.target.value;
    qdHistoryProgressRefresh();return;
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
    const d=qdDoc(),q=d.sections.flatMap(s=>s.questions).find(q=>q.id===event.target.dataset.qid);
    if(!q)return;
    q.type=qdType(event.target.value);
    if(qdAuto(q.type))q.choices=qdChoices(q.choices);
    delete d.session.marks[q.id];delete d.session.responses[q.id];
    qdStore();qdRefresh();return;
  }
  if(event.target.id==='qd-bank-file'){
    const file=event.target.files?.[0];event.target.value='';
    if(!file)return;
    if(file.size>2_000_000){status('Файл банка превышает 2 МБ',true);return;}
    file.text().then(raw=>{
      const result=qdBankImport(raw);
      if(!result.ok){status(result.message,true);return;}
      qdBankRefresh();status('Импортировано своих вопросов: '+result.count);
    }).catch(()=>status('Не удалось прочитать файл банка',true));
    return;
  }
  if(event.target.id==='qd-library-file'){
    const file=event.target.files?.[0];event.target.value='';
    if(!file)return;
    if(file.size>2_000_000){status('Слишком большой файл шаблонов',true);return;}
    file.text().then(content=>{
      const result=qdLibraryImport(content);
      if(!result.ok){status(result.message,true);return;}
      qdRefresh();status('Импортировано шаблонов: '+result.count);
    }).catch(()=>status('Не удалось прочитать библиотеку',true));
    return;
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
