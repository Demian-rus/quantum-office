
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
const QD_LIMITS = Object.freeze({sections:24,questions:240,history:50,students:80});
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
    if(needle&&!qdPromptKey(section.title+' '+q.prompt+' '+q.answer).includes(needle))continue;
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
    for(const section of d.sections)section.questions=section.questions.filter(q=>!wanted.has(q.id));
    target.questions.push(...targets);
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
    '<div id="qd-bulk-preview" aria-live="polite">'+qdBulkPreview(d)+'</div></div></details></div>';
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
        <label class="qd-template-selector">Готовые диагностики
          <select id="qd-template-pick" aria-label="Выбрать готовую диагностику">
            <option value="physics7">Физика · 7 класс</option>
            <option value="math56">Математика · 5–6 класс</option>
          </select></label>
        <button data-qd-action="use-template" type="button">Создать из шаблона</button>
        <button data-qd-action="sample-auto" type="button">+ Автоматические задания</button>
        <button data-qd-action="add-section" type="button">+ Раздел</button>
      </div>
      <p class="qd-hint">Перетаскивайте карточки за значок захвата или используйте стрелки и меню разделов.</p>
    </div>
    ${qdBuilderUtilities(d)}
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
      ${s.questions.map((q,qi)=>`<article class="qd-card qd-edit-card ${qdCompact&&!qdCardExpanded.has(q.id)?'is-compact':''}" data-qid="${qdEsc(q.id)}" data-section-id="${qdEsc(s.id)}">
        <div class="qd-card-head">
          <span class="qd-drag-handle" data-qd-drag="${qdEsc(q.id)}" tabindex="0" title="Перетащите карточку" aria-label="Перетащить вопрос">⠿</span>
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
  return `<article class="qd-card qd-run-card ${mark?'qd-mark-'+mark:''}" data-qid="${qdEsc(q.id)}">
    <div class="qd-question"><span class="qd-counter">${number+1}.</span><div>
      <span class="qd-type">${qdTypeTitle(q.type)} · ${points} ${points===1?'балл':points<=4?'балла':'баллов'} · частично ${qdPartialCredit(q.partialCredit)}%</span>
      <p>${qdEsc(q.prompt||'Вопрос пока не заполнен').replace(/\n/g,'<br>')}</p>
    </div></div>
    ${qdAutoInput(q,d.session.responses[q.id])}
    <div class="qd-card-actions">
      ${qdAuto(q.type)?`<button type="button" class="qd-primary" data-qd-action="auto-check" data-qid="${qdEsc(q.id)}">Проверить автоматически</button>`:''}
      <button type="button" class="qd-answer-toggle" data-qd-action="reveal" data-qid="${qdEsc(q.id)}"
       aria-expanded="${visible}">${visible?'Скрыть ответ':'Показать ответ'}</button>
      <div class="qd-rating" role="group" aria-label="Оценка ответа">
        <button type="button" data-qd-action="mark" data-qid="${qdEsc(q.id)}" data-mark="yes"
          aria-pressed="${mark==='yes'}" class="${mark==='yes'?'selected':''}">✓ Знает</button>
        <button type="button" data-qd-action="mark" data-qid="${qdEsc(q.id)}" data-mark="partial"
          aria-pressed="${mark==='partial'}" class="${mark==='partial'?'selected':''}">◐ Частично</button>
        <button type="button" data-qd-action="mark" data-qid="${qdEsc(q.id)}" data-mark="no"
          aria-pressed="${mark==='no'}" class="${mark==='no'?'selected':''}">× Не знает</button>
      </div>
    </div>
    ${visible?`<div class="qd-answer"><strong>Ответ</strong><p>${qdEsc(qdReference(q)).replace(/\n/g,'<br>')}</p></div>`:''}
    ${mark?`<p class="qd-card-assessed" role="status">${mark==='yes'?'Ответ зачтён':mark==='partial'?'Частично зачтён':'Ответ не зачтён'}</p>`:''}
  </article>`;
}
function qdListQuestions(d){
  let index=0;
  return d.sections.map((section,si)=>`<section class="qd-section">
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
      ${profile?`<div class="qd-profile-insight"><strong>${qdEsc(profile.name)}</strong>
         <span>Занятий: ${history.length}</span>
         <span>Средний результат: ${average===null?'—':average+'%'}</span>
         <span>Последний результат: ${scores.length?scores.at(-1).percent+'%':'—'}</span></div>`:''}
      ${history.length?`<div class="qd-history-list">${[...history].reverse().map(h=>{
        const hs=h.summary||qdScores(all,h.marks);
        return `<div><span>${qdEsc(h.student||'Ученик без имени')}<small>${qdEsc(qdDateLabel(h.date))}</small></span>
        <strong>${hs.rated?hs.percent+'%':'—'}</strong><span>${hs.rated} проверено${Number.isFinite(hs.earned)?` · ${hs.earned}/${hs.possible} б.`:''}</span><button type="button" data-qd-action="report-saved" data-hid="${qdEsc(h.id)}">Отчёт</button></div>`;
      }).join('')}</div>`:'<p>Результатов пока нет.</p>'}
    </section>
    ${qdDisplay(d).mode==='focus'?'</div></details>':''}</div>`;
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

function qdTemplate(key){
  const collections={
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
  const model=collections[key];if(!model)return null;
  return {title:model.title,description:model.description,sections:model.sections.map(s=>({
    id:qdNewId(),title:s.title,
    questions:s.items.map(([prompt,answer,type='question'])=>({
      id:qdNewId(),type,prompt,answer,points:2,partialCredit:50,choices:qdChoices(),
      numericAnswer:'',tolerance:0
    }))
  }))};
}
function qdApplyTemplate(d,key){
  const template=qdTemplate(key);if(!template)return false;
  d.title=template.title;d.description=template.description;d.sections=template.sections;
  d.students=[];d.history=[];d.session={student:'',studentId:'',marks:{},responses:{}};
  d.display={mode:'focus',activeId:''};qdStudentFilter='';qdRevealed.clear();
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
function qdRefresh(){
  const root=document.getElementById('qo-diag-root');if(!root)return;
  const scroll=document.getElementById('qo-diag-workspace'),top=scroll?.scrollTop||0;
  root.classList.toggle('qd-focused-root',qdMode==='run'&&qdDisplay().mode==='focus');
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
  if(action==='mode'){qdMode=button.dataset.mode==='run'?'run':'builder';qoWriter.diagnosticMode=qdMode;qdRevealed.clear();qdStore();qdRefresh();return;}

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
    qdApplyTemplate(d,key);qdRefresh();return;
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
    if(!QD_STATES.includes(mark)||!qdQuestionList(d).some(q=>q.id===qid))return;
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
  if(field==='prompt'){
    const card=event.target.closest('.qd-edit-card');
    const preview=card?.querySelector('.qd-card-preview');
    if(preview)preview.textContent=value.trim()||'Новый вопрос';
  }
  if(['prompt','answer','choice-text','numericAnswer'].includes(field))qdRefreshAudit();
}
function qdOnChange(event){
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
    const d=qdDoc(),q=d.sections.flatMap(s=>s.questions).find(q=>q.id===event.target.dataset.qid);
    if(!q)return;
    q.type=qdType(event.target.value);
    if(qdAuto(q.type))q.choices=qdChoices(q.choices);
    delete d.session.marks[q.id];delete d.session.responses[q.id];
    qdStore();qdRefresh();return;
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
