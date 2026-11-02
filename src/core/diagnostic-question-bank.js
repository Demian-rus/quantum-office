/* TASK120 — shared question bank, curated built-ins plus independent personal questions.
   Does not mutate QDIAG until the teacher explicitly adds a question. */
const QD_BANK_KEY='quantum-office.diagnostic-question-bank.v1';
const QD_BANK_LIMIT=500;
let qdBankOpen=false,qdBankQuery='',qdBankSubject='all',qdBankGrade='all',qdBankType='all',qdBankPage=0;
let qdBuilderLinkedTemplateId='',qdBuilderSavedSignature='';

function qdBankSafe(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const prompt=qdText(raw.question?.prompt,1600).trim();
  if(!prompt)return null;
  const normalized=qdNormalize({title:'Банк',sections:[{title:'Тема',questions:[raw.question]}]});
  const question=normalized.sections[0]?.questions[0];
  if(!question)return null;
  const subject=Object.hasOwn(QD_SUBJECTS,raw.subject)?raw.subject:'other';
  return {id:qdText(raw.id,65),subject,grade:qdText(raw.grade,18).trim(),
    topic:qdText(raw.topic,120).trim()||'Без темы',question};
}
function qdBankRead(){
  try {
    const payload=JSON.parse(localStorage.getItem(QD_BANK_KEY)||'[]');
    return Array.isArray(payload)?payload.slice(0,QD_BANK_LIMIT).map(qdBankSafe).filter(Boolean):[];
  }catch(_){return [];}
}
function qdBankWrite(items){
  try{localStorage.setItem(QD_BANK_KEY,JSON.stringify(items.slice(0,QD_BANK_LIMIT)));return true;}
  catch(_){return false;}
}
function qdBankBuiltins(){
  const result=[],seen=new Set();
  for(const item of QD_PRESETS){
    const preset=qdTemplate(item.id);
    if(!preset)continue;
    for(const section of preset.sections){
      for(const question of section.questions){
        if(!question.prompt.trim())continue;
        const signature=[item.subject,item.grade,qdPromptKey(question.prompt)].join('|');
        if(seen.has(signature))continue;
        seen.add(signature);
        result.push({id:'builtin:'+result.length,source:'built-in',subject:item.subject,grade:item.grade,
          topic:section.title,question});
      }
    }
  }
  return result;
}
function qdBankItems(){
  return [
    ...qdBankRead().map(x=>({...x,source:'custom'})),
    ...qdBankBuiltins()
  ];
}
function qdBankSignature(q){
  return qdPromptKey(q?.prompt||'');
}
function qdBankSaveQuestion(d,qid,subject,grade){
  const section=d.sections.find(s=>s.questions.some(q=>q.id===qid));
  const question=section?.questions.find(q=>q.id===qid);
  if(!question?.prompt.trim())return {ok:false,message:'Заполните вопрос перед сохранением в банк'};
  const items=qdBankRead();
  const signature=qdBankSignature(question);
  if(items.some(x=>x.subject===subject&&qdBankSignature(x.question)===signature))
    return {ok:false,message:'В вашем банке уже есть такой вопрос'};
  if(items.length>=QD_BANK_LIMIT)return {ok:false,message:'Лимит банка — 500 собственных вопросов'};
  const safe=qdBankSafe({id:qdNewId(),subject,grade,topic:section.title,question:qdCopyCard(question)});
  if(!safe)return {ok:false,message:'Не удалось подготовить вопрос'};
  if(!qdBankWrite([safe,...items]))return {ok:false,message:'Браузер не смог сохранить банк; экспортируйте работу'};
  return {ok:true};
}
function qdBankRemove(id){
  const items=qdBankRead();
  if(!items.some(x=>x.id===id))return false;
  return qdBankWrite(items.filter(x=>x.id!==id));
}
function qdBankFiltered(){
  const query=qdPromptKey(qdBankQuery),list=qdBankItems();
  return list.filter(x=>
    (qdBankSubject==='all'||x.subject===qdBankSubject)&&
    (qdBankGrade==='all'||x.grade===qdBankGrade)&&
    (qdBankType==='all'||x.question.type===qdBankType)&&
    (!query||qdPromptKey([x.question.prompt,x.topic,x.question.answer].join(' ')).includes(query))
  );
}
function qdBankAddToDoc(d,entry,targetId=''){
  if(!entry)return {ok:false,message:'Вопрос не найден'};
  if(qdQuestionList(d).length>=QD_LIMITS.questions)
    return {ok:false,message:'Достигнут лимит 240 заданий'};
  const signature=qdBankSignature(entry.question);
  if(qdQuestionList(d).some(q=>qdBankSignature(q)===signature))
    return {ok:false,message:'Вопрос уже есть в текущей диагностике'};
  let section=d.sections.find(s=>s.id===targetId);
  if(!section){
    section=d.sections.find(s=>qdPromptKey(s.title)===qdPromptKey(entry.topic));
    if(!section){
      if(d.sections.length>=QD_LIMITS.sections)return {ok:false,message:'Достигнут лимит 24 разделов'};
      section={id:qdNewId(),title:qdText(entry.topic,120)||'Без темы',questions:[]};
      d.sections.push(section);
    }
  }
  section.questions.push(qdCopyCard(entry.question));
  return {ok:true,section:section.title};
}
function qdBankResultsMarkup(){
  const all=qdBankFiltered(),pages=Math.max(1,Math.ceil(all.length/20));
  qdBankPage=Math.max(0,Math.min(qdBankPage,pages-1));
  const segment=all.slice(qdBankPage*20,(qdBankPage+1)*20);
  const d=qdDoc();
  const sectionOptions=d.sections.map(s=>'<option value="'+qdEsc(s.id)+'">'+qdEsc(s.title)+'</option>').join('');
  return '<div class="qd-bank-summary"><strong>'+all.length+' заданий найдено</strong>'+
    '<span>Показаны '+(segment.length?qdBankPage*20+1:0)+'–'+(qdBankPage*20+segment.length)+'</span></div>'+
    '<div class="qd-bank-results">'+(segment.length?segment.map(entry=>{
      const has=qdQuestionList(d).some(q=>qdBankSignature(q)===qdBankSignature(entry.question));
      return '<article class="qd-bank-item"><div class="qd-bank-item-main">'+
        '<div class="qd-bank-tags"><span>'+qdEsc(QD_SUBJECTS[entry.subject]||'Другое')+
        '</span><span>'+qdEsc(entry.grade)+' класс</span><span>'+qdEsc(entry.topic)+
        '</span><span>'+qdEsc(qdTypeTitle(entry.question.type))+'</span></div>'+
        '<p>'+qdEsc(entry.question.prompt)+'</p>'+
        '<details><summary>Ответ преподавателя</summary><p>'+qdEsc(entry.question.answer||'Ответ не заполнен')+'</p></details></div>'+
        '<div class="qd-bank-item-actions"><label>Добавить в<select data-qd-bank-section="'+qdEsc(entry.id)+'">'+
          '<option value="">Тема из банка</option>'+sectionOptions+'</select></label>'+
        '<button type="button" data-qd-action="bank-add" data-bank-id="'+qdEsc(entry.id)+
        '" '+(has?'disabled title="Уже в диагностике"':'')+'>'+(has?'Уже добавлен':'+ В диагностику')+'</button>'+
        (entry.source==='custom'?'<button type="button" data-qd-action="bank-remove" data-bank-id="'+qdEsc(entry.id)+'">Удалить из банка</button>':'')+
        '</div></article>';
    }).join(''):'<p class="qd-hint">Подходящих вопросов нет. Измените фильтры или сохраните вопрос из конструктора.</p>')+'</div>'+
    '<div class="qd-bank-pages"><button type="button" data-qd-action="bank-page-prev" '+(!qdBankPage?'disabled':'')+'>Назад</button>'+
      '<span>Страница '+(qdBankPage+1)+' из '+pages+'</span>'+
      '<button type="button" data-qd-action="bank-page-next" '+(qdBankPage>=pages-1?'disabled':'')+'>Далее</button></div>';
}
function qdBankMarkup(){
  const choices=(items,selected)=>items.map(([key,text])=>
    '<option value="'+qdEsc(key)+'" '+(key===selected?'selected':'')+'>'+qdEsc(text)+'</option>').join('');
  return '<section class="qd-panel qd-bank" id="qd-builder-bank" aria-label="Общий банк вопросов">'+
    '<div class="qd-bank-head"><div><h2>Банк вопросов</h2>'+
      '<p>Поиск по встроенным и собственным заданиям. Добавляйте выбранные вопросы в текущую диагностику.</p></div>'+
      '<button type="button" data-qd-action="bank-toggle" aria-expanded="'+qdBankOpen+'">'+
      (qdBankOpen?'Свернуть банк':'Открыть банк')+'</button></div>'+
    (qdBankOpen?'<div class="qd-bank-filters"><label>Поиск<input id="qd-bank-search" type="search" maxlength="120" value="'+qdEsc(qdBankQuery)+'" placeholder="Вопрос, тема, ответ"></label>'+
      '<label>Предмет<select id="qd-bank-subject">'+choices([['all','Все предметы'],...Object.entries(QD_SUBJECTS)],qdBankSubject)+'</select></label>'+
      '<label>Класс<select id="qd-bank-grade">'+choices([['all','Все'],...['5–6','7','8','9'].map(x=>[x,x])],qdBankGrade)+'</select></label>'+
      '<label>Тип<select id="qd-bank-type">'+choices([['all','Все типы'],['question','Вопрос'],['practice','Практика'],['single','Один ответ'],['multiple','Несколько'],['numeric','Число']],qdBankType)+'</select></label>'+
    '</div><div class="qd-bank-portable"><button type="button" data-qd-action="bank-export">Экспорт своих вопросов .qbank</button>'+ 
    '<button type="button" data-qd-action="bank-import">Импорт .qbank</button></div>'+ 
    '<div id="qd-bank-results">'+qdBankResultsMarkup()+'</div>'+
    '<p class="qd-hint">Встроенные задания не изменяются. Свой вопрос можно добавить в банк из его карточки. Повторы пропускаются. Банк на этом устройстве; данные учеников не сохраняются.</p>':'')+'</section>';
}
function qdBankRefresh(){
  const results=document.getElementById('qd-bank-results');
  if(results)results.innerHTML=qdBankResultsMarkup();
}
function qdBankExport(){
  download('QuantumOffice-question-bank.qbank',JSON.stringify({format:'quantum-question-bank',
    version:1,questions:qdBankRead()},null,2),'application/json;charset=utf-8');
}
function qdBankImport(raw){
  let data;try{data=JSON.parse(raw);}catch(_){return {ok:false,message:'Повреждённый файл банка'};}
  if(data?.format!=='quantum-question-bank'||data.version!==1||!Array.isArray(data.questions)||
     data.questions.length>QD_BANK_LIMIT)return {ok:false,message:'Неверный формат .qbank'};
  const old=qdBankRead(),next=old.slice(),seen=new Set(old.map(x=>x.subject+'|'+qdBankSignature(x.question)));
  let count=0;
  for(const value of data.questions){
    const x=qdBankSafe(value);
    if(!x)return {ok:false,message:'В файле найден повреждённый вопрос'};
    const key=x.subject+'|'+qdBankSignature(x.question);
    if(seen.has(key))continue;
    if(next.length>=QD_BANK_LIMIT)return {ok:false,message:'Недостаточно места в банке вопросов'};
    x.id=qdNewId();next.push(x);seen.add(key);count++;
  }
  if(!qdBankWrite(next))return {ok:false,message:'Не удалось сохранить импортированный банк'};
  return {ok:true,count};
}
