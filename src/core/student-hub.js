/* TASK122 — Local Student Hub. No user workbook data is embedded in source.
 * Explicit workbook link -> contacts on sheet, profiles in diagnostics, single results index.
 * A .qbook stays unchanged unless the user edits it in Sheets. */
const QO_HUB_SOURCE_KEY='quantum-office.student-hub.source.v1';
const QO_HUB_RESULT_KEY='quantum-office.student-hub.results.v1';
const QO_HUB_MAX_RESULTS=3000;
let qoHubOpen=false,qoHubRosterOpen=false,qoHubQuery='',qoHubFocusName='';
function qoHubText(v,n=120){return String(v??'').trim().slice(0,n);}
function qoHubKey(name){return qoHubText(name,100).normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase('ru-RU');}
function qoHubRead(key,fallback){
 try{const x=JSON.parse(localStorage.getItem(key)||'null');return x??fallback;}catch(_){return fallback;}
}
function qoHubWrite(key,v){
 try{localStorage.setItem(key,JSON.stringify(v));return true;}catch(_){return false;}
}
function qoHubSource(){const x=qoHubRead(QO_HUB_SOURCE_KEY,null);
 if(!x||typeof x.bookId!=='string'||typeof x.sheetId!=='string')return null;
 return x;
}
function qoHubSourceSheet(){
 const linked=qoHubSource();if(!linked)return null;
 const b=workspace.books.find(x=>x.id===linked.bookId),s=b?.sheets.find(x=>x.id===linked.sheetId);
 return b&&s?{book:b,sheet:s}:null;
}
function qoHubCell(s,ref){return qoHubText(s.cells?.[ref]?.value,140);}
function qoHubIsRoster(s){return ['ученик','ученики'].includes(qoHubKey(qoHubCell(s,'A1')));}
function qoHubRoster(){
 const src=qoHubSourceSheet();if(!src||!qoHubIsRoster(src.sheet))return [];
 const s=src.sheet;
 const entries=Object.keys(s.cells||{}).filter(x=>/^A(?:[2-9]|[1-9]\d{1,4})$/.test(x))
    .map(x=>Number(x.slice(1))).filter(r=>r>=2&&r<=20000).sort((a,b)=>a-b);
 const counts=new Map();
 for(const r of entries){const name=qoHubCell(s,'A'+r);
  if(name)counts.set(qoHubKey(name),(counts.get(qoHubKey(name))||0)+1);
 }
 return entries.map(row=>{
   const name=qoHubCell(s,'A'+row),key=qoHubKey(name);if(!key)return null;
   return {id:[src.book.id,src.sheet.id,key].join('|'),row,name,key,
     info:qoHubCell(s,'C'+row),guardian:qoHubCell(s,'D'+row),
     studentUrl:qoHubUrl(s.hyperlinks?.['B'+row]),
     guardianUrl:qoHubUrl(s.hyperlinks?.['E'+row]),duplicate:counts.get(key)>1};
 }).filter(Boolean);
}
function qoHubUrl(url){
 if(typeof url!=='string'||url.length>2048)return '';
 try{const parsed=new URL(url);return ['https:','http:'].includes(parsed.protocol)?parsed.href:'';}catch(_){return '';}
}
function qoHubAttachCurrent(){
 const b=book(),s=sheet();
 if(!b||!s||!qoHubIsRoster(s)){status('Откройте лист со столбцом A «Ученик» в первой строке',true);return false;}
 if(!qoHubWrite(QO_HUB_SOURCE_KEY,{bookId:b.id,sheetId:s.id})){
   status('Не удалось сохранить связь с таблицей в браузере',true);return false;
 }
 qoHubOpen=true;
 status('Список учеников привязан: '+s.name+'. Изменения в таблице будут видны в диагностике.');
 return true;
}
function qoHubResults(){
 const rows=qoHubRead(QO_HUB_RESULT_KEY,[]);
 return Array.isArray(rows)?rows.slice(-QO_HUB_MAX_RESULTS).filter(row=>row&&typeof row.id==='string'&&typeof row.studentKey==='string'&&Number.isFinite(row.percent)): [];
}
function qoHubStudentResults(key){
 return qoHubResults().filter(x=>x.studentKey===key).sort((a,b)=>b.date.localeCompare(a.date));
}
function qoHubMatches(name){
 const key=qoHubKey(name);if(!key)return [];
 return qoHubRoster().filter(x=>x.key===key);
}
function qoHubSaveOne(entry){
 const matches=qoHubMatches(entry?.student||'');
 if(matches.length!==1||matches[0].duplicate)return {ok:false,reason:'Неоднозначная привязка ученика'};
 if(!entry?.summary||!Number.isFinite(entry.summary.percent))return {ok:false,reason:'Нет оценённого результата'};
 const src=qoHubSourceSheet();if(!src)return {ok:false,reason:'Источник не найден'};
 const rows=qoHubResults(),id=src.book.id+'|'+src.sheet.id+'|'+entry.id;
 if(rows.some(x=>x.id===id))return {ok:true,duplicate:true};
 const value={id,studentKey:matches[0].id,date:qoHubText(entry.date,32)||new Date().toISOString(),
   title:qoHubText(entry.title,120),percent:Math.max(0,Math.min(100,Math.round(entry.summary.percent))),
   earned:Number.isFinite(entry.summary.earned)?entry.summary.earned:null,
   possible:Number.isFinite(entry.summary.possible)?entry.summary.possible:null,
   rated:entry.summary.rated|0,total:entry.summary.total|0,
   topics:Array.isArray(entry.topics)?entry.topics.slice(0,24).map(t=>({
      name:qoHubText(t.name,120),rated:t.rated|0,total:t.total|0,
      percent:Math.max(0,Math.min(100,t.percent|0))})):[]};
 if(!qoHubWrite(QO_HUB_RESULT_KEY,[...rows,value].slice(-QO_HUB_MAX_RESULTS)))
   return {ok:false,reason:'Локальная память заполнена'};
 return {ok:true};
}
function qoHubImportCurrentHistory(){
 const d=qdDoc(),source=qoHubSourceSheet();
 if(!source){status('Сначала привяжите лист «Ученики» в редакторе таблиц',true);return;}
 if(!confirm('Добавить результаты текущей диагностики в общий журнал? Совпадающие записи будут пропущены.'))return;
 let count=0,unmatched=0;
 for(const item of d.history){
   const result=qoHubSaveOne(item);
   if(result.ok&&!result.duplicate)count++;
   else if(!result.ok)unmatched++;
 }
 status('В общий журнал добавлено: '+count+(unmatched?' · без однозначной связи: '+unmatched:''));
 qoHubDecorate();
}
function qoHubStudentIcon(name){
 const count=qoHubMatches(name).length;
 return count===1?'':'';
}
function qoHubEsc(s){return qdEsc(s);}
function qoHubHistoryHTML(student){
 const history=qoHubStudentResults(student.id);
 return '<section class="qo-hub-history"><div class="qo-hub-history-head"><strong>История диагностик</strong>'+
  '<span>'+history.length+' записей</span></div>'+
  (history.length?'<div class="qo-hub-results">'+history.slice(0,30).map(h=>
    '<div class="qo-hub-result"><div><strong>'+qoHubEsc(h.title||'Диагностика')+
    '</strong><small>'+qoHubEsc(qdDateLabel(h.date))+' · '+h.rated+' из '+h.total+' проверено</small></div>'+
    '<span class="qo-hub-score">'+h.percent+'%</span></div>').join('')+'</div>':
    '<p class="qo-hub-empty">Пока нет сохранённых проверок. После проведения результат появится здесь автоматически.</p>')+
    (history.length?'<button type="button" data-hub-action="export-csv" data-student="'+qoHubEsc(student.id)+'">Скачать историю CSV</button>':'')+
    '</section>';
}
function qoHubCurrentStudent(){
 const row=Number((activeCell.match(/\d+/)||[])[0]||'');
 return qoHubRoster().find(x=>x.row===row)||null;
}
function qoHubCardHTML(student){
 if(!student)return '<div class="qo-hub-empty"><strong>Выберите ученика</strong><p>Нажмите на его имя в столбце A, затем откройте карточку.</p></div>';
 const link=(url,label)=>url?'<a href="'+qoHubEsc(url)+'" target="_blank" rel="noopener noreferrer">'+label+'</a>':'';
 return '<div class="qo-hub-student"><h3>'+qoHubEsc(student.name)+'</h3>'+
   (student.info?'<p>'+qoHubEsc(student.info)+'</p>':'')+
   (student.duplicate?'<p class="qo-hub-warning">Имя повторяется в списке. Для записи результатов требуется уникальный идентификатор.</p>':'')+
   '<div class="qo-hub-contacts">'+(link(student.studentUrl,'Ссылка ученика')||'')+
     (student.guardian?'<span>Родитель: '+qoHubEsc(student.guardian)+'</span>':'')+
     (link(student.guardianUrl,'Ссылка родителя')||'')+'</div>'+
   qoHubHistoryHTML(student)+
   '<div class="qo-hub-card-actions"><button type="button" class="qo-hub-primary" data-hub-action="open-diagnostic" data-student="'+
      qoHubEsc(student.id)+'" '+(student.duplicate?'disabled':'')+'>Открыть диагностику</button></div></div>';
}
function qoHubSheetDecorate(){
 const formula=document.querySelector('.sheet-page .formula-line');
 if(!formula)return;
 if(!formula.querySelector('[data-hub-action="toggle"]')){
   formula.insertAdjacentHTML('beforeend','<button class="qo-hub-sheet-trigger" type="button" data-hub-action="toggle" '+
    'title="Ученики и журнал диагностик">Ученики <span class="qo-hub-trigger-counter">'+
    qoHubResults().length+'</span></button>');
 }
 const src=qoHubSourceSheet(),current=sheet();
 const selected=qoHubCurrentStudent();
 const section=document.createElement('aside');section.id='qo-hub-sheet-panel';
 section.className='qo-hub-panel'+(qoHubOpen?' is-open':'');
 section.setAttribute('aria-label','Карточки учеников');
 const isConnected=src&&src.book.id===book()?.id&&src.sheet.id===current?.id;
 section.innerHTML='<div class="qo-hub-panel-head"><div><strong>Ученики и диагностики</strong><span>'+
  (src?'Источник: '+qoHubEsc(src.book.name)+' / '+qoHubEsc(src.sheet.name):'Источник не выбран')+'</span></div>'+
  '<button data-hub-action="close" aria-label="Закрыть панель">×</button></div>'+
  (!isConnected?'<div class="qo-hub-connect"><p>'+(
   qoHubIsRoster(current)?'Текущий лист содержит список учеников. Его можно подключить к диагностике.':
   'Откройте лист «Ученики» с именами в столбце A.')+'</p>'+
   '<button data-hub-action="connect" '+(!qoHubIsRoster(current)?'disabled':'')+'>Связать текущий лист</button></div>':
   '<div class="qo-hub-summary">'+qoHubRoster().length+' учеников · '+qoHubResults().length+' сохранённых проверок</div>'+
   qoHubCardHTML(selected)+
   '<div class="qo-hub-backup"><button data-hub-action="export-all">Скачать общий журнал CSV</button>'+
   '<button data-hub-action="unlink">Отключить связь</button></div>') ;
 const previous=document.getElementById('qo-hub-sheet-panel');previous?.remove();
 document.querySelector('.sheet-page')?.append(section);
 qoHubBadges();
}
function qoHubBadges(){
 const src=qoHubSourceSheet();
 if(!src||page!=='sheet'||sheet()?.id!==src.sheet.id||book()?.id!==src.book.id)return;
 const rows=qoHubRoster();
 for(const x of rows){
  const c=document.querySelector('.grid-cell[data-ref="A'+x.row+'"]');
  if(!c||c.querySelector('.qo-hub-cell-badge'))continue;
  const count=qoHubStudentResults(x.id).length;
  if(count)c.insertAdjacentHTML('beforeend','<button type="button" class="qo-hub-cell-badge" data-hub-action="open-card" data-row="'+x.row+
    '" title="Диагностики: '+count+'" aria-label="Открыть историю диагностик: '+count+'">▣</button>');
 }
}
function qoHubRosterPanel(){
 const source=qoHubSourceSheet(),items=qoHubRoster(),search=qoHubKey(qoHubQuery),
   filtered=items.filter(x=>!search||qoHubKey(x.name+' '+x.info).includes(search));
 return '<section class="qd-panel qo-hub-roster"><div class="qo-hub-roster-head"><div><h3>Ученики из таблицы</h3>'+
   '<p>'+(source?'Связана таблица «'+qoHubEsc(source.book.name)+'», лист «'+qoHubEsc(source.sheet.name)+'».':
     'Сначала откройте таблицу и привяжите лист «Ученики».')+'</p></div>'+
   '<button data-hub-action="roster-toggle">'+(qoHubRosterOpen?'Свернуть':'Показать список')+'</button></div>'+
   (qoHubRosterOpen?'<div class="qo-hub-roster-body">'+
    (source?'<div class="qo-hub-roster-controls"><label>Найти ученика<input id="qo-hub-search" type="search" value="'+
       qoHubEsc(qoHubQuery)+'" placeholder="Имя, класс или предмет"></label>'+
      '<button data-hub-action="add-all">Добавить всех в диагностику</button></div>'+
      '<div class="qo-hub-roster-list">'+filtered.slice(0,80).map(x=>
       '<div class="qo-hub-roster-row"><div><strong>'+qoHubEsc(x.name)+'</strong>'+
       '<small>'+qoHubEsc(x.info)+'</small></div><span>'+qoHubStudentResults(x.id).length+' проверок</span>'+
       '<button data-hub-action="select" data-student="'+qoHubEsc(x.id)+'" '+(x.duplicate?'disabled title="Дублирующее имя"':'')+
       '>Выбрать</button></div>').join('')+'</div>'+
      '<div class="qo-hub-roster-bottom"><button data-hub-action="import-history">Связать прежние результаты</button>'+
      '<button data-hub-action="export-all">Журнал CSV</button></div>':
      '<p class="qo-hub-empty">Источник не выбран. Подключите таблицу в разделе «Таблицы».</p>')+
    '</div>':'')+'</section>';
}
function qoHubDiagDecorate(){
 const root=document.getElementById('qo-diag-root');
 if(!root)return;
 const target=qdMode==='builder'?root.querySelector('.qd-roster'):
   qdMode==='run'?(root.querySelector('.qd-session-drawer')||root.querySelector('.qd-session-panel')):null;
 if(!target||root.querySelector('.qo-hub-roster'))return;
 target.insertAdjacentHTML('afterend',qoHubRosterPanel());
 if(qdMode==='run'&&qoHubSourceSheet()){
   const student=qoHubMatches(qdDoc().session.student||'');
   if(student.length===1&&!student[0].duplicate){
     const anchor=root.querySelector('.qo-hub-roster');
     if(anchor)anchor.insertAdjacentHTML('afterend',
       '<details class="qd-panel qo-hub-inline-history"><summary>История ученика по всем диагностикам ('+
        qoHubStudentResults(student[0].id).length+')</summary>'+
        qoHubHistoryHTML(student[0])+'</details>');
   }
 }
}
function qoHubDecorate(){
 if(page==='sheet')qoHubSheetDecorate();
 else if(page==='writer')qoHubDiagDecorate();
}
function qoHubCSV(rows){
 return '\ufeff'+[['Дата','Ученик','Диагностика','Результат %','Проверено','Всего','Баллы','Максимум','Темы'],
 ...rows.map(r=>[r.date,qoHubRoster().find(x=>x.id===r.studentKey)?.name||'',
  r.title,r.percent,r.rated,r.total,r.earned??'',r.possible??'',
  r.topics.map(x=>x.name+' '+x.percent+'%').join(' | ')])].map(row=>row.map(qdCsvCell).join(';')).join('\r\n');
}
function qoHubChoose(id,openInWriter=false){
 const student=qoHubRoster().find(s=>s.id===id);
 if(!student||student.duplicate){status('Неоднозначный ученик в таблице',true);return;}
 const d=qdDoc(),profile=qdAddStudent(d,student.name);
 if(!profile){status('Лимит профилей диагностики достигнут',true);return;}
 d.session.student=profile.name;d.session.studentId=profile.id;
 qdStudentFilter=profile.id;
 qdStore();
 if(openInWriter){qoWorkspaceTab.writer='diagnostic';qdMode='run';qoWriter.diagnosticMode='run';route('writer');}
 else {qdRefresh();}
 status('Выбран ученик из таблицы: '+student.name);
}
function qoHubOnClick(event){
 const b=event.target.closest?.('[data-hub-action]');if(!b)return;
 event.preventDefault();event.stopImmediatePropagation();
 const type=b.dataset.hubAction;
 if(type==='toggle'){qoHubOpen=!qoHubOpen;qoHubDecorate();return;}
 if(type==='close'){qoHubOpen=false;qoHubDecorate();return;}
 if(type==='connect'){if(qoHubAttachCurrent())qoHubDecorate();return;}
 if(type==='unlink'){
   if(confirm('Отключить источник учеников? Сохранённый журнал результатов останется в браузере.')){
      localStorage.removeItem(QO_HUB_SOURCE_KEY);qoHubDecorate();
   }return;
 }
 if(type==='open-card'){activeCell='A'+b.dataset.row;qoHubOpen=true;qoHubDecorate();return;}
 if(type==='open-diagnostic'||type==='select'){qoHubChoose(b.dataset.student,type==='open-diagnostic');return;}
 if(type==='roster-toggle'){qoHubRosterOpen=!qoHubRosterOpen;qdRefresh();return;}
 if(type==='add-all'){
   const d=qdDoc(),items=qoHubRoster().filter(x=>!x.duplicate);
   let n=0;
   for(const x of items){const had=d.students.some(s=>qoHubKey(s.name)===x.key);
      const added=qdAddStudent(d,x.name);
      if(!added)break;if(!had)n++;
   }
   qdStore();qdRefresh();status('Импортировано учеников: '+n);return;
 }
 if(type==='import-history'){qoHubImportCurrentHistory();return;}
 if(type==='export-csv'||type==='export-all'){
   const rows=type==='export-all'?qoHubResults():qoHubStudentResults(b.dataset.student);
   download('QuantumOffice-ученики-диагностики.csv',qoHubCSV(rows),'text/csv;charset=utf-8');
   return;
 }
}
document.addEventListener('click',qoHubOnClick,true);
document.addEventListener('input',e=>{
 if(e.target?.id==='qo-hub-search'){qoHubQuery=e.target.value.slice(0,100);
    const list=document.querySelector('.qo-hub-roster-list');
    if(list){const doc=document.createElement('div');doc.innerHTML=qoHubRosterPanel();
       const replacement=doc.querySelector('.qo-hub-roster-list');
       if(replacement)list.replaceWith(replacement);
    }
 }
},true);
const qoHubOriginalQDClick=qdOnClick;
qdOnClick=function(e){
 const action=e.target.closest?.('[data-qd-action]')?.dataset.qdAction;
 const d=qdDoc(),before=d.history.length,student=d.session.student;
 const result=qoHubOriginalQDClick(e);
 if(action==='save-result'&&d.history.length>before){
  const latest=d.history.at(-1),linked=qoHubSaveOne(latest);
  if(linked.ok&&!linked.duplicate)status('Результат сохранён и привязан к таблице учеников');
  else if(!linked.ok&&qoHubSourceSheet()&&student)
    status('Результат сохранён в диагностике. Для общего журнала проверьте уникальность имени ученика.','warning');
 }
 return result;
};
const qoHubOriginalQDRefresh=qdRefresh;
qdRefresh=function(){qoHubOriginalQDRefresh();if(page==='writer')qoHubDiagDecorate();};
const qoHubOriginalDrawGrid=drawGrid;
drawGrid=function(...args){const ret=qoHubOriginalDrawGrid(...args);qoHubBadges();return ret;};
const qoHubOriginalRender=render;
render=function(...args){const ret=qoHubOriginalRender(...args);qoHubDecorate();return ret;};
qoHubDecorate();
