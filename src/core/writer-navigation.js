/* TASK130 — Quantum Writer: outline, search, replacement and keyboard navigation.
 * Standalone browser module bundled before main.js. No document markup changes unless
 * the user explicitly runs a replacement. */
let qoWriterNavVisible=false;
let qoWriterNavMode='outline';
let qoWriterFindText='';
let qoWriterReplaceText='';
let qoWriterFoundIndex=-1;
let qoWriterNavTimer=null;
let qoWriterBulkHistory=null;
let qoWriterBulkRunning=false;

function qoWriterNavigationTools(){
 return qoWorkGroup('Навигация',
  qoWorkButton('writer-nav-outline','Структура документа','pages')+
  qoWorkButton('writer-nav-find','Найти · Ctrl+F','type')+
  qoWorkButton('writer-nav-replace','Заменить · Ctrl+H','copy'));
}
function qoWriterNavigationHTML(){
 return `<aside id="qo-writer-navigation" class="qo-writer-navigation" aria-label="Навигация по документу" ${qoWriterNavVisible?'':'hidden'}>
  <header class="qo-writer-nav-header"><strong>Навигация</strong><button type="button" data-qwn-close aria-label="Закрыть навигацию" title="Закрыть">×</button></header>
  <div class="qo-writer-nav-tabs" role="tablist" aria-label="Разделы навигации">
    <button type="button" data-qwn-mode="outline" role="tab" aria-selected="${qoWriterNavMode==='outline'}">Структура</button>
    <button type="button" data-qwn-mode="find" role="tab" aria-selected="${qoWriterNavMode==='find'}">Поиск</button>
    <button type="button" data-qwn-mode="replace" role="tab" aria-selected="${qoWriterNavMode==='replace'}">Замена</button>
  </div>
  <div id="qo-writer-nav-outline" class="qo-writer-nav-view" ${qoWriterNavMode==='outline'?'':'hidden'}>
    <div class="qo-writer-nav-meta">Заголовки 1–3 · нажмите для перехода</div>
    <div id="qo-writer-heading-list" class="qo-writer-heading-list"></div>
  </div>
  <div id="qo-writer-nav-search" class="qo-writer-nav-view" ${qoWriterNavMode==='outline'?'hidden':''}>
    <label class="qo-writer-nav-field"><span>Найти в документе</span><input id="qo-writer-nav-query" type="search" autocomplete="off" spellcheck="false" placeholder="Слово или фраза" value="${esc(qoWriterFindText)}"></label>
    <div class="qo-writer-nav-matches"><span id="qo-writer-nav-count" aria-live="polite">Введите текст для поиска</span><div><button type="button" data-qwn-prev title="Предыдущее совпадение" aria-label="Предыдущее совпадение">↑</button><button type="button" data-qwn-next title="Следующее совпадение" aria-label="Следующее совпадение">↓</button></div></div>
    <div id="qo-writer-nav-replace" ${qoWriterNavMode==='replace'?'':'hidden'}>
      <label class="qo-writer-nav-field"><span>Заменить на</span><input id="qo-writer-nav-replacement" autocomplete="off" spellcheck="false" value="${esc(qoWriterReplaceText)}"></label>
      <div class="qo-writer-nav-replace-actions"><button type="button" data-qwn-replace-one>Заменить</button><button type="button" data-qwn-replace-all>Заменить всё</button></div>
      <button type="button" id="qo-writer-nav-undo-replace" data-qwn-undo-replace hidden>Отменить последнюю замену</button>
    </div>
    <div class="qo-writer-nav-hint">Поиск учитывает слова внутри заголовков, абзацев и таблиц. Форматирование документа не используется как поисковый текст.</div>
  </div>
 </aside>`;
}
function qoWriterNavEditor(){return document.getElementById('qo-writer-page');}
function qoWriterNavToggle(open,mode=qoWriterNavMode){
 if(page!=='writer')return;
 if(qoWorkspaceTab.writer==='diagnostic')qoWorkSwitchTab('writer','home');
 qoWriterNavVisible=!!open;
 if(['outline','find','replace'].includes(mode))qoWriterNavMode=mode;
 const panel=document.getElementById('qo-writer-navigation');
 if(!panel)return;
 panel.hidden=!qoWriterNavVisible;
 panel.closest('.qo-writer-body')?.classList.toggle('qo-writer-with-nav',qoWriterNavVisible);
 for(const item of panel.querySelectorAll('[data-qwn-mode]')){
  item.setAttribute('aria-selected',String(item.dataset.qwnMode===qoWriterNavMode));
 }
 const outline=document.getElementById('qo-writer-nav-outline'),search=document.getElementById('qo-writer-nav-search');
 if(outline)outline.hidden=qoWriterNavMode!=='outline';
 if(search)search.hidden=qoWriterNavMode==='outline';
 const replace=document.getElementById('qo-writer-nav-replace');
 if(replace)replace.hidden=qoWriterNavMode!=='replace';
 if(qoWriterNavVisible){
  qoWriterNavRefresh();
  if(qoWriterNavMode!=='outline')document.getElementById('qo-writer-nav-query')?.focus();
 }else{
  qoWriterClearHighlights();
  qoWriterNavEditor()?.focus({preventScroll:true});
 }
}
function qoWriterNavOutline(){
 const editor=qoWriterNavEditor(),out=document.getElementById('qo-writer-heading-list');
 if(!editor||!out)return;
 const headings=[...editor.querySelectorAll('h1,h2,h3')].filter(h=>h.textContent.trim());
 out.replaceChildren();
 if(!headings.length){
  const empty=document.createElement('p');empty.className='qo-writer-nav-empty';
  empty.textContent='Заголовков пока нет. Выделите абзац и выберите «Заголовок 1», «Заголовок 2» или «Заголовок 3» в разделе «Главная».';
  out.append(empty);return;
 }
 headings.forEach((heading,i)=>{
  const level=Number(heading.tagName.slice(1));
  const button=document.createElement('button');button.type='button';
  button.className='qo-writer-heading-link qo-writer-heading-level-'+level;
  button.dataset.qwnHeading=String(i);
  button.title=heading.textContent.trim();
  const bullet=document.createElement('span');bullet.className='qo-writer-heading-symbol';bullet.textContent=String(level);
  const name=document.createElement('span');name.textContent=heading.textContent.trim();
  button.append(bullet,name);
  button.addEventListener('click',()=>{
   const range=document.createRange();range.selectNodeContents(heading);range.collapse(true);
   const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
   editor.focus({preventScroll:true});heading.scrollIntoView({block:'center',behavior:'instant'});
   if(typeof qoWriterRememberSelection==='function')qoWriterRememberSelection();
  });
  out.append(button);
 });
}
/* A flattened index preserves matches across adjacent bold/italic spans while
 * preventing accidental matches across paragraph and table-cell boundaries. */
function qoWriterNavTextIndex(){
 const root=qoWriterNavEditor();if(!root)return {text:'',parts:[]};
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 let full='',prevBlock=null,node,parts=[];
 while((node=walker.nextNode())){
  if(!node.data||node.parentElement?.closest('[contenteditable="false"]'))continue;
  const block=node.parentElement?.closest('p,h1,h2,h3,li,blockquote,td,th,div')||root;
  if(prevBlock&&block!==prevBlock)full+='\n';
  const start=full.length;full+=node.data;
  parts.push({node,start,end:full.length});prevBlock=block;
 }
 return {text:full,parts};
}
function qoWriterNavMatches(){
 const query=qoWriterFindText;
 if(!query.trim()||query.length>200)return {items:[],truncated:false};
 const indexed=qoWriterNavTextIndex(),hay=indexed.text.toLocaleLowerCase('ru-RU'),
  needle=query.toLocaleLowerCase('ru-RU'),items=[];
 let pos=0,truncated=false;
 while((pos=hay.indexOf(needle,pos))!==-1){
  if(items.length>=500){truncated=true;break;}
  const first=indexed.parts.find(p=>p.start<=pos&&p.end>pos);
  const last=indexed.parts.find(p=>p.start<pos+query.length&&p.end>=pos+query.length);
  if(first&&last){
   const range=document.createRange();range.setStart(first.node,pos-first.start);
   range.setEnd(last.node,pos+query.length-last.start);
   items.push({range,position:pos});
  }
  pos+=Math.max(1,needle.length);
 }
 return {items,truncated};
}
function qoWriterClearHighlights(){
 try{CSS.highlights?.delete('qo-writer-search');CSS.highlights?.delete('qo-writer-current');}catch{}
}
function qoWriterNavRefresh(){
 if(!qoWriterNavVisible||page!=='writer')return;
 qoWriterNavOutline();
 const stats=document.getElementById('qo-writer-nav-count');
 if(stats&&qoWriterNavMode!=='outline'){
  const result=qoWriterNavMatches();
  if(qoWriterFoundIndex>=result.items.length)qoWriterFoundIndex=-1;
  stats.textContent=!qoWriterFindText.trim()?'Введите текст для поиска':
   !result.items.length?'Ничего не найдено':
   (qoWriterFoundIndex<0?'—':qoWriterFoundIndex+1)+' из '+result.items.length+
   (result.truncated?' (первые 500)':'');
  qoWriterClearHighlights();
  try{
   if(CSS.highlights&&typeof Highlight==='function'&&result.items.length){
    CSS.highlights.set('qo-writer-search',new Highlight(...result.items.map(m=>m.range)));
    if(qoWriterFoundIndex>=0)CSS.highlights.set('qo-writer-current',new Highlight(result.items[qoWriterFoundIndex].range));
   }
  }catch{}
  const previous=document.getElementById('qo-writer-nav-undo-replace');
  if(previous)previous.hidden=!qoWriterBulkHistory;
 }
}
function qoWriterNavSchedule(){
 if(qoWriterNavTimer)clearTimeout(qoWriterNavTimer);
 qoWriterNavTimer=setTimeout(qoWriterNavRefresh,100);
}
function qoWriterNavNavigate(delta){
 const result=qoWriterNavMatches();
 if(!result.items.length){qoWriterFoundIndex=-1;qoWriterNavRefresh();return;}
 qoWriterFoundIndex=(qoWriterFoundIndex<0?(delta<0?result.items.length-1:0):
  (qoWriterFoundIndex+delta+result.items.length)%result.items.length);
 const match=result.items[qoWriterFoundIndex];
 const selection=window.getSelection();selection.removeAllRanges();selection.addRange(match.range.cloneRange());
 qoWriterNavEditor().focus({preventScroll:true});
 const span=match.range.startContainer.parentElement;
 span?.scrollIntoView({block:'center',behavior:'instant'});
 if(typeof qoWriterRememberSelection==='function')qoWriterRememberSelection();
 qoWriterNavRefresh();
}
function qoWriterNavSingleReplace(){
 const result=qoWriterNavMatches();if(!result.items.length)return;
 if(qoWriterFoundIndex<0)qoWriterFoundIndex=0;
 const match=result.items[Math.min(qoWriterFoundIndex,result.items.length-1)];
 const selection=window.getSelection();selection.removeAllRanges();selection.addRange(match.range);
 const editor=qoWriterNavEditor();editor.focus({preventScroll:true});
 const ok=document.execCommand('insertText',false,qoWriterReplaceText);
 if(!ok){status('Не удалось заменить текст',true);return;}
 qoWriterBulkHistory=null;
 qoPersistWriter();qoWriterStats();qoWriterFoundIndex=-1;
 qoWriterNavRefresh();qoWriterNavNavigate(1);
}
function qoWriterNavReplaceAll(){
 const editor=qoWriterNavEditor(),result=qoWriterNavMatches();
 if(!editor||!result.items.length)return;
 if(result.truncated){status('Найдено более 500 совпадений. Уточните текст для замены.',true);return;}
 if(!confirm('Заменить '+result.items.length+' совпадений во всём документе?'))return;
 const previous=editor.innerHTML;
 qoWriterBulkRunning=true;
 try{
  // Process from the end: earlier Range offsets remain stable after later edits.
  for(let i=result.items.length-1;i>=0;i--){
   const range=result.items[i].range;
   range.deleteContents();range.insertNode(document.createTextNode(qoWriterReplaceText));
  }
  qoPersistWriter();qoWriterStats();
  qoWriterBulkHistory={before:previous,after:editor.innerHTML,undone:false};
  qoWriterFoundIndex=-1;qoWriterNavRefresh();
  status('Заменено '+result.items.length+' совпадений','success');
 }catch(error){
  editor.innerHTML=previous;qoPersistWriter();status('Не удалось заменить: '+error.message,true);
 }finally{qoWriterBulkRunning=false;}
}
function qoWriterNavUndoReplacement(redo=false){
 const h=qoWriterBulkHistory,editor=qoWriterNavEditor();if(!h||!editor)return false;
 if(redo){if(!h.undone||editor.innerHTML!==h.before)return false;editor.innerHTML=h.after;h.undone=false;}
 else {if(h.undone||editor.innerHTML!==h.after)return false;editor.innerHTML=h.before;h.undone=true;}
 qoPersistWriter();qoWriterStats();qoWriterFoundIndex=-1;qoWriterNavRefresh();
 status(redo?'Замена восстановлена':'Массовая замена отменена','success');
 return true;
}
function qoWriterNavigationInstall(){
 // Native document editing remains responsible for ordinary undo and redo.
 document.addEventListener('click',event=>{
  if(page!=='writer')return;
  const action=event.target.closest('[data-action^="writer-nav-"]')?.dataset.action;
  if(action){
   event.preventDefault();event.stopImmediatePropagation();
   qoWriterNavToggle(true,action==='writer-nav-outline'?'outline':action==='writer-nav-replace'?'replace':'find');
   return;
  }
  if(event.target.closest('[data-qwn-close]')){qoWriterNavToggle(false);return;}
  const tab=event.target.closest('[data-qwn-mode]');if(tab){qoWriterNavToggle(true,tab.dataset.qwnMode);return;}
  if(event.target.closest('[data-qwn-prev]')){qoWriterNavNavigate(-1);return;}
  if(event.target.closest('[data-qwn-next]')){qoWriterNavNavigate(1);return;}
  if(event.target.closest('[data-qwn-replace-one]')){qoWriterNavSingleReplace();return;}
  if(event.target.closest('[data-qwn-replace-all]')){qoWriterNavReplaceAll();return;}
  if(event.target.closest('[data-qwn-undo-replace]')){qoWriterNavUndoReplacement();return;}
 },true);
 document.addEventListener('input',event=>{
  if(page!=='writer')return;
  if(event.target.id==='qo-writer-nav-query'){
   qoWriterFindText=event.target.value.slice(0,200);qoWriterFoundIndex=-1;qoWriterNavSchedule();return;
  }
  if(event.target.id==='qo-writer-nav-replacement'){
   qoWriterReplaceText=event.target.value.slice(0,5000);return;
  }
  if(event.target.id==='qo-writer-page'){
   if(!qoWriterBulkRunning)qoWriterBulkHistory=null;
   qoWriterFoundIndex=-1;qoWriterNavSchedule();
  }
 });
 document.addEventListener('change',event=>{
  if(page==='writer'&&event.target.id==='qo-writer-block')qoWriterNavSchedule();
 });
 document.addEventListener('keydown',event=>{
  if(page!=='writer')return;
  if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==='f'){
   event.preventDefault();event.stopImmediatePropagation();qoWriterNavToggle(true,'find');return;
  }
  if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==='h'){
   event.preventDefault();event.stopImmediatePropagation();qoWriterNavToggle(true,'replace');return;
  }
  if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==='z'&&
    qoWriterBulkHistory&&qoWriterNavEditor()?.contains(document.activeElement)){
    if(qoWriterNavUndoReplacement(event.shiftKey)){
     event.preventDefault();event.stopImmediatePropagation();return;
    }
  }
  if(event.key==='Escape'&&qoWriterNavVisible&&
   (event.target.closest('#qo-writer-navigation')||event.target.id==='qo-writer-page')){
   event.preventDefault();qoWriterNavToggle(false);return;
  }
  if(event.target.id==='qo-writer-nav-query'&&event.key==='Enter'){
   event.preventDefault();qoWriterNavNavigate(event.shiftKey?-1:1);
  }
 },true);
}
