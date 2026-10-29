import { newWorkbook,newSheet,currentSheet,getCell,setCell,setTypedCell,setStyle,refsBetween,rectangle,referencedFromOtherSheet,displayedValue,valuesTSV,pasteTSV,importCSV,exportCSV,validateWorkbook,createExample,createScheduleTemplate,createJournalTemplate,createBudgetTemplate,cellName,parseCell,LIMITS,fillSelection,resultOf,sortSelectedRows,findCells,replaceAllText,clearFormatting,planAutoSum,filterRange,filterRowVisible,setFreeze,setAutoFilter,setFilterValue,gridGeometry,firstVisibleIndex,columnWidth,rowHeight,setColumnWidth,setRowHeight,DIMENSIONS,rowVisible,columnVisible,setHidden,showAllHidden,mergeAt,mergeCells,unmergeCells,applyBorderPreset } from './core/workbook.js';
import {loadWorkspace,saveWorkspace,newWorkspace,encodeBook,decodeBook,encodeWorkspace,decodeWorkspace} from './core/store.js';
import {importXLSX,exportXLSX} from './core/xlsx.js';
import {copyCells,pasteCells} from './core/clipboard.js';
import {changeSheetStructure} from './core/structure.js';
import {createWorkbookRecalculator} from './core/recalculation.js';
const app=document.getElementById('app');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const niceDate=s=>{try{return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(s));}catch{return '—'}};
const dateNow=()=>new Date().toISOString();
const cellH=29,cellW=116,rowW=54,headerH=31;
let workspace;try{workspace=loadWorkspace();}catch{workspace=newWorkspace();}
// Session-local only: never stored in user books, autosave, or Undo snapshots.
const recalculator=createWorkbookRecalculator();
let templateKind='sheet';
let page='home', activeRibbon='home', activeCell='A1', rangeEnd='A1', editing=null,mouseSelecting=false;
let pendingColorSelection=null, activePalette=null, borderMenuOpen=false;
let scrollLeft=0,scrollTop=0, saveHandle=null,undoStacks=new Map(),redoStacks=new Map(),statusMessage='',storeWarning=false;
let searchTerm='',replaceTerm='',findIndex=-1,showFind=false;
let resizeDrag=null, filterColumn=null;
let internalClipboard=null;
function book(){return workspace.books.find(b=>b.id===workspace.active)||null;}
function sheet(){return book()?currentSheet(book()):null;}
function status(message,bad=false){statusMessage=message;const node=document.getElementById('toast');if(node){node.textContent=message;node.className=bad?'toast bad active':'toast active';clearTimeout(status.timer);status.timer=setTimeout(()=>node.classList.remove('active'),3100);}}
function persist(){try{saveWorkspace(workspace);storeWarning=false;const n=document.querySelector('#storage-indicator');if(n)n.textContent='● Автосохранено локально';}catch(e){storeWarning=true;const n=document.querySelector('#storage-indicator');if(n)n.textContent='⚠ Сохраните файл вручную';status('Память браузера недоступна: экспортируйте .qbook или архив',true);}}
function snapshot(){const b=book();if(!b)return;const a=undoStacks.get(b.id)||[];a.push(structuredClone(b));if(a.length>50)a.shift();undoStacks.set(b.id,a);redoStacks.set(b.id,[]);}
function changed(){if(book())book().updated=dateNow();persist();}
function transact(callback){const active=book();if(!active)return;snapshot();try{callback();recalculator.reconcile(active,undoStacks.get(active.id).at(-1));}catch(error){recalculator.reset();throw error;}changed();}
function replaceBook(fromHistory,toHistory){const b=book();if(!b)return;const stack=fromHistory.get(b.id)||[];if(!stack.length)return;const replacement=stack.pop();fromHistory.set(b.id,stack);const other=toHistory.get(b.id)||[];other.push(structuredClone(b));toHistory.set(b.id,other);workspace.books[workspace.books.findIndex(x=>x.id===b.id)]=replacement;persist();render();}
function undo(){replaceBook(undoStacks,redoStacks);}
function redo(){replaceBook(redoStacks,undoStacks);}
function route(target){commitEditor();if(target==='home'){page='home';render();return;}if(target==='sheet'){page='sheet';if(!book()){if(!workspace.books.length){createBook();return;}workspace.active=workspace.books[0].id;}render();return;}page=target;render();}
function createBook(example=false){const b=example==='schedule'?createScheduleTemplate():example==='journal'?createJournalTemplate():example==='budget'?createBudgetTemplate():example?createExample():newWorkbook();workspace.books.unshift(b);workspace.active=b.id;page='sheet';activeCell=rangeEnd='A1';scrollLeft=scrollTop=0;saveHandle=null;persist();render();}
function openBook(id){const b=workspace.books.find(x=>x.id===id);if(!b)return;commitEditor();workspace.active=id;page='sheet';activeCell=rangeEnd='A1';scrollLeft=scrollTop=0;saveHandle=null;persist();render();}
function removeBook(id){saveHandle=null;const b=workspace.books.find(x=>x.id===id);if(!b||!confirm(`Удалить «${b.name}» из рабочего пространства? Скачанные файлы не будут удалены.`))return;workspace.books=workspace.books.filter(x=>x.id!==id);workspace.active=workspace.books[0]?.id||null;if(!workspace.books.length)page='home';persist();render();}
function cloneBook(id){saveHandle=null;const orig=workspace.books.find(x=>x.id===id);if(!orig)return;const copy=structuredClone(orig), fresh=newWorkbook();copy.id=fresh.id;copy.name=`${copy.name} — копия`;copy.created=copy.updated=dateNow();workspace.books.unshift(copy);workspace.active=copy.id;persist();page='sheet';render();}
/** Rename a library card without opening its workbook or changing cell data. */
function renameBookInline(id,button){
 const item=workspace.books.find(b=>b.id===id),card=button.closest('.file-card');
 if(!item||!card||card.querySelector('.file-card-rename'))return;
 const form=document.createElement('form');form.className='file-card-rename';
 const input=document.createElement('input');input.type='text';input.maxLength=200;
 input.setAttribute('aria-label','Новое название книги');input.value=item.name;
 const ok=document.createElement('button');ok.type='submit';ok.textContent='Сохранить';
 const cancel=document.createElement('button');cancel.type='button';cancel.className='cancel-rename';cancel.textContent='Отмена';
 cancel.addEventListener('click',()=>form.remove());
 input.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();form.remove();}});
 form.addEventListener('submit',e=>{
  e.preventDefault();const title=input.value.trim();
  if(!title){status('Название книги не может быть пустым',true);input.focus();return;}
  if(title!==item.name){item.name=title;item.updated=dateNow();persist();}
  render();
 });
 form.append(input,ok,cancel);card.querySelector('.file-card-actions').before(form);
 input.focus();input.select();
}
function safeFile(s){return String(s).replace(/[\\/:*?"<>|]/g,'_').slice(0,90)||'quantum-office';}
function download(name,text,mime){const blob=new Blob([text],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
async function saveBook(){commitEditor();const b=book();if(!b)return;const filename=`${safeFile(b.name)}.qbook`,data=encodeBook(b);try{if('showSaveFilePicker' in window){if(!saveHandle){saveHandle=await window.showSaveFilePicker({suggestedName:filename,types:[{description:'Quantum Office book',accept:{'application/json':['.qbook']}}]});}const writer=await saveHandle.createWritable();await writer.write(data);await writer.close();status('Файл сохранён на диск');return;}}catch(err){if(err.name==='AbortError')return;saveHandle=null;status(`Прямое сохранение не удалось; файл будет скачан`,true);}download(filename,data,'application/json');status('Скачан файл .qbook');}
function backup(){commitEditor();download(`Quantum-Office-архив-${new Date().toISOString().slice(0,10)}.qbackup`,encodeWorkspace(workspace),'application/json');status('Резервная копия скачана');}
async function importFile(file){if(!file)return;if(file.size>15_000_000){status('Файл больше 15 МБ не поддерживается',true);return;}try{
 const name=file.name.toLowerCase();const text=name.endsWith('.xlsx')?'':await file.text();if(name.endsWith('.qbackup')){const restored=decodeWorkspace(text);if(!confirm('Импорт архива заменит текущие черновики. Вы предварительно сохранили резервную копию?'))return;workspace=restored;page='home';workspace.active=workspace.books[0]?.id??null;persist();render();status('Рабочее пространство восстановлено');return;}
 let imported;if(name.endsWith('.qbook')){imported=structuredClone(decodeBook(text));imported.id=newWorkbook().id;}else if(name.endsWith('.csv')){imported=importCSV(text,file.name.replace(/\.csv$/i,''));}else if(name.endsWith('.xlsx')){imported=await importXLSX(await file.arrayBuffer(),file.name);}else throw Error('Поддерживаются .qbook, .qbackup, .csv и .xlsx.');
 workspace.books.unshift(imported);workspace.active=imported.id;page='sheet';saveHandle=null;persist();render();status(name.endsWith('.xlsx')?'XLSX открыт: проверьте данные. Диаграммы и сложные возможности не переносились.':'Импорт завершён');
 }catch(e){status(e.message||'Не удалось открыть файл',true);}}
function paintSelection(){const rect=rectangle(activeCell,rangeEnd);if(!rect)return;document.querySelectorAll(".grid-cell").forEach(el=>{const p=parseCell(el.dataset.ref),chosen=p.row>=rect.r1&&p.row<=rect.r2&&p.col>=rect.c1&&p.col<=rect.c2;el.classList.toggle("is-selected",chosen);el.classList.toggle("is-active",el.dataset.ref===activeCell);el.setAttribute("aria-selected",String(chosen));});}
function setSelection(a,b=a){if(a===b&&sheet()){const merged=mergeAt(sheet(),a);if(merged)a=merged.from,b=merged.from;}activeCell=a;rangeEnd=b;const box=document.querySelector('#name-box');if(box)box.value=a===b?a:`${a}:${b}`;const input=document.querySelector('#formula-input');if(input)input.value=getCell(sheet(),a).value;document.querySelector('#selection-info')?.replaceChildren(document.createTextNode(a===b?a:`${a}:${b}`));drawGrid();updateSelectionStats();}
function moveSelection(dr,dc,extend=false){const p=parseCell(extend?rangeEnd:activeCell);if(!p)return;let r=Math.min(Math.max(p.row+dr,0),LIMITS.rows-1),c=Math.min(Math.max(p.col+dc,0),LIMITS.columns-1);
 if(dr){while(r>=0&&r<LIMITS.rows&&!rowVisible(sheet(),r))r+=Math.sign(dr);r=Math.min(Math.max(r,0),LIMITS.rows-1);}
 if(dc){while(c>=0&&c<LIMITS.columns&&!columnVisible(sheet(),c))c+=Math.sign(dc);c=Math.min(Math.max(c,0),LIMITS.columns-1);}
 if(!rowVisible(sheet(),r)||!columnVisible(sheet(),c))return;
 // Arrow navigation skips covered cells of the merge currently selected.
 const sourceMerge=mergeAt(sheet(),activeCell);
 if(!extend&&sourceMerge){const bounds=rectangle(sourceMerge.from,sourceMerge.to);const next=cellName(r,c);
  if(mergeAt(sheet(),next)===sourceMerge){
   if(dr>0)r=Math.min(LIMITS.rows-1,bounds.r2+1);
   else if(dr<0)r=Math.max(0,bounds.r1-1);
   else if(dc>0)c=Math.min(LIMITS.columns-1,bounds.c2+1);
   else if(dc<0)c=Math.max(0,bounds.c1-1);
  }
 }
 const target=cellName(r,c);setSelection(extend?activeCell:target,target);ensureVisible(r,c);}
function ensureVisible(r,c){const view=document.querySelector('#grid-scroll');if(!view||!sheet())return;const {x,y}=gridGeometry(sheet()),left=x[c],top=y[r],width=x[c+1]-left,height=y[r+1]-top;
 if(c>=(sheet().freeze?.cols||0)&&left<view.scrollLeft+x[sheet().freeze?.cols||0])view.scrollLeft=Math.max(0,left-x[sheet().freeze?.cols||0]);
 else if(left+width>view.scrollLeft+view.clientWidth)view.scrollLeft=left+width-view.clientWidth;
 if(r>=(sheet().freeze?.rows||0)&&top<view.scrollTop+y[sheet().freeze?.rows||0])view.scrollTop=Math.max(0,top-y[sheet().freeze?.rows||0]);
 else if(top+height>view.scrollTop+view.clientHeight)view.scrollTop=top+height-view.clientHeight;}
function commitEditor(cancel=false){if(!editing)return;const {node,ref,initial}=editing;const value=cancel?initial:node.value;editing=null;node.remove();if(!cancel&&value!==initial){transact(()=>setTypedCell(sheet(),ref,value));}drawGrid();const formula=document.getElementById('formula-input');if(formula)formula.value=getCell(sheet(),ref).value;}
function editCell(seed=null){if(!sheet())return;if(!rowVisible(sheet(),parseCell(activeCell)?.row)||!columnVisible(sheet(),parseCell(activeCell)?.col)){status('Ячейка скрыта: сначала отобразите строку или столбец',true);return;}commitEditor();const ref=activeCell,p=parseCell(ref),canvas=document.getElementById('grid-canvas');if(!canvas||!p)return;ensureVisible(p.row,p.col);
 const node=document.createElement('input');node.className='cell-editor';const {x,y}=gridGeometry(sheet());node.style.left=`${x[p.col]+1}px`;node.style.top=`${y[p.row]+1}px`;const merged=mergeAt(sheet(),ref),bounds=merged?rectangle(merged.from,merged.to):null;node.style.width=`${Math.max((bounds?x[bounds.c2+1]:x[p.col+1])-x[p.col]-2,160)}px`;node.style.height=`${(bounds?y[bounds.r2+1]:y[p.row+1])-y[p.row]-2}px`;const rawInput=getCell(sheet(),ref).value,fmt=getCell(sheet(),ref).style?.format;
 const {raw:editRaw,ctx:editCtx}=recalculator.view(book(),sheet());
 const initialInput=['date','time','datetime','duration'].includes(fmt)&&rawInput&&!rawInput.startsWith('=')?displayedValue(sheet(),ref,editRaw,editCtx):rawInput;
 node.value=seed===null?initialInput:seed;canvas.append(node);
 editing={node,ref,initial:initialInput};node.focus();if(seed===null)node.select();
 node.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commitEditor();moveSelection(event.shiftKey?-1:1,0);}else if(event.key==='Tab'){event.preventDefault();commitEditor();moveSelection(0,event.shiftKey?-1:1);}else if(event.key==='Escape'){event.preventDefault();commitEditor(true);}});
 node.addEventListener('blur',()=>{if(editing?.node===node)commitEditor();});}
function selectionContainsHiddenRows(){const rect=rectangle(activeCell,rangeEnd);if(!rect||!sheet())return false;for(let r=rect.r1;r<=rect.r2;r++)if(!rowVisible(sheet(),r))return true;for(let c=rect.c1;c<=rect.c2;c++)if(!columnVisible(sheet(),c))return true;return false;}
function refuseHiddenSelection(){if(!selectionContainsHiddenRows())return false;status('Выделение содержит скрытые строки или столбцы. Отобразите их перед массовым изменением.',true);return true;}
function clearSelected(){if(refuseHiddenSelection())return;const size=rectangle(activeCell,rangeEnd);if((size.r2-size.r1+1)*(size.c2-size.c1+1)>10000){status('Очистка ограничена 10 000 ячеек за раз',true);return;}const refs=refsBetween(activeCell,rangeEnd);transact(()=>{for(const ref of refs)setCell(sheet(),ref,'');});drawGrid();}
function clearSelectedFormat(){commitEditor();if(refuseHiddenSelection())return;try{const draft=structuredClone(sheet());const count=clearFormatting(draft,activeCell,rangeEnd);if(!count){status('Оформление уже сброшено');return;}transact(()=>{sheet().cells=draft.cells;});drawGrid();status(`Сброшено оформление: ${count} ячеек`);}catch(err){status(err.message,true);}}
function autoSum(){commitEditor();if(refuseHiddenSelection())return;try{const changes=planAutoSum(sheet(),activeCell,rangeEnd);transact(()=>{for(const x of changes)setCell(sheet(),x.ref,x.value);});setSelection(changes[0].ref,changes.at(-1).ref);status(`Автосумма: ${changes.length} формул`);}catch(err){status(err.message,true);}}
function fillSelected(direction){if(!sheet())return;commitEditor();if(refuseHiddenSelection())return;const draft=structuredClone(sheet());try{const count=fillSelection(draft,activeCell,rangeEnd,direction);transact(()=>{sheet().cells=draft.cells;});drawGrid();updateSelectionStats();status(`Заполнено ${count} ячеек`);}catch(e){status(e.message,true);}}
function updateSelectionStats(){const node=document.querySelector('#selection-stats');if(!node||!sheet())return;const rect=rectangle(activeCell,rangeEnd);if(!rect)return;const n=(rect.r2-rect.r1+1)*(rect.c2-rect.c1+1);if(n>10000){node.textContent=`Выделено: ${n} ячеек`;return;}const {raw,ctx}=recalculator.view(book(),sheet());let count=0,sum=0;for(let r=rect.r1;r<=rect.r2;r++)for(let c=rect.c1;c<=rect.c2;c++){const value=resultOf(sheet(),cellName(r,c),raw,ctx);const number=Number(value);if(value!==''&&Number.isFinite(number)){count++;sum+=number;}}node.textContent=count?`Чисел: ${count} · Сумма: ${Number(sum.toFixed(8))} · Среднее: ${Number((sum/count).toFixed(8))}`:`Выделено: ${n}`;}
function structuralAction(axis,mode){
 commitEditor();if(!sheet())return;
 const pos=parseCell(activeCell);if(!pos)return;
 const rect=rectangle(activeCell,rangeEnd);
 const index=axis==='row'?rect.r1:rect.c1;
 const count=axis==='row'?rect.r2-rect.r1+1:rect.c2-rect.c1+1;
 if(referencedFromOtherSheet(book(),sheet())){status('Изменение структуры листа со ссылками из других листов пока запрещено',true);return;}
 try{
  const draft=structuredClone(sheet());
  changeSheetStructure(draft,axis,mode,index,count); // Validate before adding undo history.
  transact(()=>changeSheetStructure(sheet(),axis,mode,index,count));
  const next=mode==='delete'?Math.min(index,axis==='row'?LIMITS.rows-1:LIMITS.columns-1):index;
  const dest=axis==='row'?cellName(next,pos.col):cellName(pos.row,next);
  filterColumn=null;internalClipboard=null;setSelection(dest);render();status(`${mode==='insert'?'Вставлено':'Удалено'} ${count} ${axis==='row'?'строк':'столбцов'}`);
 }catch(err){status(err.message||'Операция отклонена',true);}
}
function visibilityAction(axis,show){
 commitEditor();const s=sheet();if(!s)return;
 const p=parseCell(activeCell);if(!p)return;
 try{
  const index=axis==='row'?p.row:p.col;
  if(show){const key=axis==='row'?'hiddenRows':'hiddenColumns';const count=Object.keys(s[key]||{}).length;
   if(!count){status('Скрытых строк или столбцов нет');return;}
   transact(()=>showAllHidden(s,axis));render();status(`Отображено: ${count}`);return;
  }
  if(axis==='row'&&!rowVisible(s,index)||axis==='col'&&!columnVisible(s,index))throw Error('Уже скрыто');
  const trial=structuredClone(s);setHidden(trial,axis,index,true);
  transact(()=>setHidden(s,axis,index,true));
  // Switch to a visible cell without modifying the hidden contents.
  const next=(n,limit,visible)=>{for(let i=n+1;i<limit;i++)if(visible(i))return i;for(let i=n-1;i>=0;i--)if(visible(i))return i;return -1;};
  const rr=axis==='row'?next(index,LIMITS.rows,r=>rowVisible(s,r)):p.row;
  const cc=axis==='col'?next(index,LIMITS.columns,c=>columnVisible(s,c)):p.col;
  if(rr>=0&&cc>=0){activeCell=cellName(rr,cc);rangeEnd=activeCell;}
  render();status(`Скрыт ${axis==='row'?'ряд':'столбец'} ${index+1}`);
 }catch(err){status(err.message||'Не удалось скрыть',true);}
}
function applyStyle(patch,selection=null){
 const a=selection?.start||activeCell,b=selection?.end||rangeEnd;
 // A color picker may dispatch change only after focus moved to another cell.
 // Do not ever apply a stale snapshot to a different document or worksheet.
 if(selection&&(selection.bookId!==book()?.id||selection.sheetId!==sheet()?.id)){status('Исходный лист изменился — выберите цвет заново',true);return;}
 const rect=rectangle(a,b);if(!rect||!sheet())return;
 for(let r=rect.r1;r<=rect.r2;r++)if(!rowVisible(sheet(),r)){status('Выделение содержит скрытые строки',true);return;}
 const refs=refsBetween(a,b);if(refs.length>10000){status('Слишком большой диапазон',true);return;}
 transact(()=>{for(const ref of refs)setStyle(sheet(),ref,patch);});drawGrid();
}
function recordColorSelection(){if(!book()||!sheet())return;pendingColorSelection={bookId:book().id,sheetId:sheet().id,start:activeCell,end:rangeEnd};}
function applySelectedColor(kind,value){const captured=pendingColorSelection;pendingColorSelection=null;applyStyle({[kind]:value},captured);}
function setCellBorders(mode){
 commitEditor();if(refuseHiddenSelection())return;
 const draft=structuredClone(sheet());try{applyBorderPreset(draft,activeCell,rangeEnd,mode);
  transact(()=>applyBorderPreset(sheet(),activeCell,rangeEnd,mode));borderMenuOpen=false;render();status('Границы обновлены');
 }catch(err){status(err.message,true);}
}
function updateMerge(mode){
 commitEditor();if(!sheet())return;
 try{const draft=structuredClone(sheet());if(mode==='merge')mergeCells(draft,activeCell,rangeEnd);else if(!unmergeCells(draft,activeCell)){status('Выбранная ячейка не объединена');return;}
  transact(()=>{if(mode==='merge')mergeCells(sheet(),activeCell,rangeEnd);else unmergeCells(sheet(),activeCell);});
  if(mode==='merge'){const r=rectangle(activeCell,rangeEnd);activeCell=cellName(r.r1,r.c1);rangeEnd=activeCell;}
  render();status(mode==='merge'?'Ячейки объединены':'Объединение снято');
 }catch(err){status(err.message,true);}
}
const paletteColors=['#ffffff','#f3f4f6','#d1d5db','#9ca3af','#64748b','#111827','#fee2e2','#fecaca','#fca5a5','#ef4444','#b91c1c','#ffedd5','#fdba74','#f97316','#fef08a','#facc15','#fde68a','#86efac','#22c55e','#15803d','#ccfbf1','#5eead4','#0891b2','#bfdbfe','#60a5fa','#2563eb','#ddd6fe','#a78bfa','#7c3aed','#fbcfe8','#f472b6','#be185d'];
function palettePopup(){if(!activePalette)return '';
 const kind=activePalette==='bg'?'Заливка':'Цвет текста';
 return `<div class="format-popover palette-popover" role="dialog" aria-label="${kind}" data-popup="palette"><div class="popup-header"><strong>${kind}</strong><button data-action="popup-close" aria-label="Закрыть">×</button></div><div class="palette-grid">${paletteColors.map(c=>`<button class="palette-swatch" data-action="palette-pick" data-value="${c}" aria-label="${c}" title="${c}" style="background:${c}"></button>`).join('')}</div><div class="palette-custom"><label for="palette-custom-color">Свой цвет</label><input type="color" id="palette-custom-color" value="${activePalette==='bg'?'#d8f4e4':'#20354a'}" aria-label="Выбрать свой цвет"><button data-action="palette-clear">Без цвета</button></div></div>`;
}
function bordersPopup(){if(!borderMenuOpen)return '';
 const items=[['outline','Внешние границы','borderOutline'],['all','Все границы','borderAll'],['bottom','Нижняя граница','borderBottom'],['top','Верхняя граница','borderTop'],['left','Левая граница','borderLeft'],['right','Правая граница','borderRight'],['none','Без границ','borderNone']];
 return `<div class="format-popover border-popover" role="menu" aria-label="Варианты границ"><div class="popup-header"><strong>Границы выделения</strong><button data-action="popup-close" aria-label="Закрыть">×</button></div><div class="border-hint">Рамка вокруг диапазона не объединяет ячейки</div>${items.map(([id,label,icon])=>`<button class="border-choice" role="menuitem" data-action="border-mode" data-value="${id}"><span class="border-glyph">${toolIcon(id==='none'?'border-none':id==='all'?'border-all':'border-'+id,'')}</span>${label}</button>`).join('')}</div>`;
}
function toggleWrap(){const next=!getCell(sheet(),activeCell).style?.wrap;const rect=rectangle(activeCell,rangeEnd);if(!rect||refuseHiddenSelection())return;
 const refs=refsBetween(activeCell,rangeEnd);if(refs.length>10000){status('Слишком большой диапазон',true);return;}
 const {raw,ctx}=recalculator.view(book(),sheet());
 transact(()=>{for(const ref of refs)setStyle(sheet(),ref,{wrap:next});
  // Expand rows only when needed; never shrink a user-defined custom height.
  if(next){for(let r=rect.r1;r<=rect.r2;r++){let need=rowHeight(sheet(),r);for(let c=rect.c1;c<=rect.c2;c++){
    const content=displayedValue(sheet(),cellName(r,c),raw,ctx),charsPerLine=Math.max(5,Math.floor((columnWidth(sheet(),c)-16)/7));
    const count=String(content).split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/charsPerLine)),0);
    need=Math.max(need,Math.min(DIMENSIONS.maxRow,Math.max(DIMENSIONS.minRow,count*17+8)));
   } if(need>rowHeight(sheet(),r))setRowHeight(sheet(),r,need);}}
 });drawGrid();}

function sortRange(direction){if(!sheet())return;commitEditor();if(refuseHiddenSelection())return;const candidate=structuredClone(sheet());try{
 const count=sortSelectedRows(candidate,activeCell,rangeEnd,direction);
 transact(()=>{sheet().cells=candidate.cells;});drawGrid();updateSelectionStats();status(`Отсортировано ${count} строк по первому столбцу выделения`);
 }catch(error){status(error.message,true);}}
function showSearch(){showFind=true;render();document.getElementById('find-term')?.focus();}
function nextMatch(){if(!sheet()||!searchTerm.trim()){status('Введите текст для поиска',true);return;}
 const refs=findCells(sheet(),searchTerm);if(!refs.length){status('Совпадений нет',true);return;}
 const current=refs.indexOf(activeCell);findIndex=(current+1)%refs.length;
 const ref=refs[findIndex];setSelection(ref);const pos=parseCell(ref);ensureVisible(pos.row,pos.col);status(`Найдено ${refs.length} · ${findIndex+1} из ${refs.length}`);}
function replaceAll(){if(!sheet()||!searchTerm){status('Введите текст для поиска',true);return;}
 commitEditor();const clone=structuredClone(sheet());try{const count=replaceAllText(clone,searchTerm,replaceTerm);
 if(count){transact(()=>{sheet().cells=clone.cells;});drawGrid();updateSelectionStats();}
 status(count?`Заменено в ${count} ячейках (формулы не изменены)`:'Совпадений для замены нет');
 }catch(error){status(error.message,true);}}
function addSheet(){const b=book();if(!b)return;if(b.sheets.length>=LIMITS.sheets){status('Лимит: 25 листов');return;}
 let n=1;const names=new Set(b.sheets.map(s=>s.name.toLocaleLowerCase('ru-RU')));while(names.has(`лист ${n}`))n++;
 const name=`Лист ${n}`;transact(()=>{const s=newSheet(name);b.sheets.push(s);b.activeSheetId=s.id;});setSelection('A1');render();status(`Создан новый лист «${name}»`);}

function renameSheet(id=sheet()?.id){const b=book(),s=b?.sheets.find(x=>x.id===id);if(!s)return;
 const tab=[...document.querySelectorAll('.sheet-tab')].find(x=>x.dataset.id===id);if(!tab)return;
 const input=document.createElement('input');input.className='sheet-tab-editor';input.setAttribute('aria-label','Новое имя листа');input.maxLength=31;input.value=s.name;let settled=false;
 const finish=cancel=>{if(settled)return;settled=true;const next=input.value.trim();
  if(!cancel&&next&&next!==s.name){if(/[\\/*?:\[\]]/.test(next)||b.sheets.some(x=>x.id!==id&&x.name.toLowerCase()===next.toLowerCase()))status('Название листа недопустимо или уже существует',true);
   else if(referencedFromOtherSheet(b,s))status('Переименование листа со ссылками из других листов пока запрещено',true);
   else transact(()=>{s.name=next});}
  render();};
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();finish(false);}if(e.key==='Escape'){e.preventDefault();finish(true);}e.stopPropagation();});
 input.addEventListener('blur',()=>finish(false));tab.replaceWith(input);input.focus();input.select();}

function deleteSheet(){const b=book();if(b.sheets.length<=1){status('Нельзя удалить единственный лист');return;}if(referencedFromOtherSheet(b,sheet())){status('Этот лист используется в формулах других листов — удаление запрещено',true);return;}if(!confirm(`Удалить лист «${sheet().name}»?`))return;const id=b.activeSheetId;transact(()=>{b.sheets=b.sheets.filter(s=>s.id!==id);b.activeSheetId=b.sheets[0].id;});setSelection('A1');render();}
function topbar(){
 const tabs=`<nav class="modules" aria-label="Разделы приложения"><button class="module ${page==='home'?'active':''}" data-action="route" data-target="home">Обзор</button><button class="module ${page==='sheet'?'active':''}" data-action="route" data-target="sheet">▦ Таблицы</button><button class="module ${page==='writer'?'active':''}" data-action="route" data-target="writer">▤ Тексты</button><button class="module ${page==='slides'?'active':''}" data-action="route" data-target="slides">▣ Презентации</button></nav>`;
 if(page==='sheet'&&book())return `<header class="global-bar compact-shell"><button class="logo" data-action="route" data-target="home" title="На главную"><span class="logo-mark">Q</span><span>QUANTUM <b>OFFICE</b></span></button>${tabs}<div class="shell-document"><input id="book-name" aria-label="Название книги" value="${esc(book().name)}" maxlength="200" title="Изменить название книги"><span class="shell-save" id="storage-indicator">● Локально</span></div><div class="global-right"><button class="shell-action" data-action="import" title="Открыть файл">↥ <span>Открыть</span></button><button class="shell-action primary" data-action="save" title="Сохранить книгу">⇩ <span>Сохранить</span></button><button class="icon-button" data-action="backup" title="Резервная копия">▣</button></div></header>`;
 return `<header class="global-bar"><button class="logo" data-action="route" data-target="home"><span class="logo-mark">Q</span><span>QUANTUM <b>OFFICE</b><small>WORKSPACE / ALPHA</small></span></button>${tabs}<div class="global-right"><span class="local-badge">● ОФЛАЙН</span><button class="icon-button" data-action="backup" title="Скачать резервную копию всех файлов">⇩</button></div></header>`;
}
function launcherIcon(kind){
 const common='viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"';
 if(kind==='sheet')return `<svg ${common}><rect x="11" y="10" width="58" height="60" rx="9" fill="#E6F5EC" stroke="#2C9765" stroke-width="2.2"/><path d="M11 27H69M11 42H69M11 56H69M30 27V70M49 27V70" stroke="#69B58D" stroke-width="1.7"/><rect x="31" y="43" width="17" height="12" rx="2" fill="#269465"/><path d="M34 49H45" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>`;
 if(kind==='writer')return `<svg ${common}><path d="M20 9H51L64 22V69A4 4 0 0160 73H20A4 4 0 0116 69V13A4 4 0 0120 9Z" fill="#EFEAFC" stroke="#7764BD" stroke-width="2.2"/><path d="M50 9V23H64" stroke="#7764BD" stroke-width="2.2"/><path d="M25 34H53M25 43H54M25 52H50M25 61H44" stroke="#9886CF" stroke-width="3.4" stroke-linecap="round"/><path d="M25 26H39" stroke="#6551AC" stroke-width="3.4" stroke-linecap="round"/></svg>`;
 return `<svg ${common}><rect x="9" y="12" width="62" height="46" rx="7" fill="#FFF0E4" stroke="#DC8B48" stroke-width="2.2"/><rect x="17" y="20" width="46" height="30" rx="3" fill="#E6A56B"/><path d="M23 44L33 33L42 39L52 27L60 41" stroke="white" stroke-width="3.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 58V70M27 70H53" stroke="#DC8B48" stroke-width="3" stroke-linecap="round"/></svg>`;
}
function templatesPage(){
 const mode=templateKind;
 const data={
  sheet:{name:'Шаблоны таблиц',description:'Выберите основу для новой книги. Исходные шаблоны не изменяются.',items:[
   ['new','Пустая книга','Свободная таблица с несколькими листами по необходимости','grid'],
   ['schedule','Недельное расписание занятий','Дни недели, ученики, предметы, время, план и оплата','calendar'],
   ['journal','Журнал учеников','Учёт учащихся, контактов и занятий','users'],
   ['budget','Учёт доходов и расходов','Финансовая таблица с итогами','budget']]},
  writer:{name:'Шаблоны текстов',description:'Каталог будущих документов. Quantum Writer пока не реализован.',items:[
   [null,'Пустой документ','Текстовый редактор в разработке','file'],
   [null,'Конспект занятия','Структура урока, цели и материалы','file'],
   [null,'Письмо','Деловые и личные письма','file']]},
  slides:{name:'Шаблоны презентаций',description:'Каталог будущих презентаций. Quantum Slides пока не реализован.',items:[
   [null,'Пустая презентация','Редактор слайдов в разработке','slides'],
   [null,'Учебный материал','Слайды для объяснения темы','slides'],
   [null,'Доклад','Титульный слайд, разделы и выводы','slides']]}}[mode];
 const cards=data.items.map(([key,title,desc,icon])=>`<button class="template-card" ${key?`data-action="template-create" data-template="${key}"`:'disabled aria-disabled="true"'}><span class="template-card-art">${icon==='calendar'?'▦':icon==='users'?'♙':icon==='budget'?'▥':icon==='slides'?'▣':'▤'}</span><strong>${esc(title)}</strong><small>${esc(desc)}</small>${key?'<span class="template-card-arrow">Создать →</span>':'<span class="template-card-muted">Планируется</span>'}</button>`).join('');
 return `<main class="templates-page"><div class="templates-heading"><button data-action="route" data-target="home" class="templates-back">← На главную</button><h1>${data.name}</h1><p>${data.description}</p></div><div class="templates-grid">${cards}</div></main>`;
}
function homepage(){
 const cards=workspace.books.map(b=>`<article class="file-card"><button class="file-open" data-action="open" data-id="${esc(b.id)}"><span class="file-emoji" aria-hidden="true">▦</span><span class="file-card-name">${esc(b.name)}</span><small>${b.sheets.length} ${b.sheets.length===1?'лист':'листов'} · ${niceDate(b.updated)}</small></button><div class="file-card-actions"><button data-action="rename-book" data-id="${esc(b.id)}" aria-label="Переименовать книгу ${esc(b.name)}">Переименовать</button><button data-action="clone" data-id="${esc(b.id)}">Дублировать</button><button data-action="delete" data-id="${esc(b.id)}">Удалить</button></div></article>`).join('');
 return `<main class="home-main office-launcher"><div class="launcher-tools" aria-label="Выбор редактора">
 <button class="launcher-tile sheets" data-action="new"><span class="launcher-art">${launcherIcon('sheet')}</span><span class="launcher-name">Таблицы</span><span class="launcher-description">Данные, расчёты и расписания</span><span class="launcher-state available">Доступен</span></button>
 <button class="launcher-tile writer" data-action="route" data-target="writer"><span class="launcher-art">${launcherIcon('writer')}</span><span class="launcher-name">Тексты</span><span class="launcher-description">Документы и оформление</span><span class="launcher-state">В разработке</span></button>
 <button class="launcher-tile slides" data-action="route" data-target="slides"><span class="launcher-art">${launcherIcon('slides')}</span><span class="launcher-name">Презентации</span><span class="launcher-description">Слайды и выступления</span><span class="launcher-state">В разработке</span></button></div>
 <div class="launcher-template-actions" aria-label="Каталоги шаблонов"><button data-action="templates" data-kind="sheet">Шаблоны таблиц <span>→</span></button><button data-action="templates" data-kind="writer">Шаблоны текстов <span>→</span></button><button data-action="templates" data-kind="slides">Шаблоны презентаций <span>→</span></button></div>
 <div class="launcher-secondary"><button data-action="example">Открыть пример таблицы</button><button data-action="import">Открыть файл XLSX / QBOOK / CSV</button></div>
 <div class="launcher-files"><div class="launcher-files-top"><span>Недавние файлы</span><button data-action="backup" title="Скачать резервную копию всех черновиков">Резервная копия</button></div><div class="files-grid">${cards||'<div class="empty-files"><span>◇</span><strong>Нет сохранённых черновиков</strong><p>Создайте таблицу или начните с шаблона расписания.</p></div>'}</div></div><div class="launcher-note">Черновики хранятся в браузере. Для надёжного хранения сохраняйте .qbook на диск.</div></main>`;
}
function placeholder(kind){const writer=kind==='writer';return `<main class="soon"><div class="soon-icon">${writer?'▤':'▣'}</div><span class="eyebrow">РАЗДЕЛ ЗАПЛАНИРОВАН</span><h1>${writer?'Quantum Writer':'Quantum Slides'}</h1><p>${writer?'Редактор текстов':'Редактор презентаций'} будет разработан после стабилизации таблиц. Мы не выдаём пустую имитацию за работающий редактор.</p><button class="primary-btn" data-action="route" data-target="sheet">Перейти к таблицам →</button></main>`;}
function changeSize(kind){commitEditor();const p=parseCell(activeCell);if(!p)return;const current=kind==='col'?columnWidth(sheet(),p.col):rowHeight(sheet(),p.row);const input=prompt(kind==='col'?'Ширина столбца (48–520 пикселей)':'Высота строки (22–160 пикселей)',String(current));if(input===null)return;const value=Number(input);
 try{if(!Number.isInteger(value))throw Error('Введите целое число');transact(()=>{if(kind==='col')setColumnWidth(sheet(),p.col,value);else setRowHeight(sheet(),p.row,value);});drawGrid();status(`Размер изменён: ${value} пикселей`);}catch(err){status(err.message,true);}}
function autoFitColumn(index=null){commitEditor();const p=parseCell(activeCell);if(!p||!sheet())return;const c=index??p.col;let chars=0;const {raw,ctx}=recalculator.view(book(),sheet());for(const ref of Object.keys(sheet().cells)){const cell=parseCell(ref);if(cell?.col===c){const str=String(displayedValue(sheet(),ref,raw,ctx));for(const line of str.split('\n'))chars=Math.max(chars,line.length);}}const width=Math.max(DIMENSIONS.minColumn,Math.min(DIMENSIONS.maxColumn,Math.ceil(chars*7.2+20)));
 transact(()=>setColumnWidth(sheet(),c,width));drawGrid();status(`Столбец ${cellName(0,c).replace(/\d+$/,'')}: ${width} пикселей`);}
function resetRowHeight(index=null){const p=parseCell(activeCell);if(!p)return;transact(()=>setRowHeight(sheet(),index??p.row,DIMENSIONS.defaultRow));drawGrid();}
function toggleAutoFilter(){commitEditor();if(sheet().autoFilter){transact(()=>{sheet().autoFilter=null});filterColumn=null;render();status('Автофильтр выключен — данные не изменены');return;}
 const rect=rectangle(activeCell,rangeEnd);try{const draft=structuredClone(sheet());setAutoFilter(draft,cellName(rect.r1,rect.c1),cellName(rect.r2,rect.c2));transact(()=>{sheet().autoFilter=draft.autoFilter});render();status('Автофильтр включён — выберите столбец в его заголовке');}catch(e){status(e.message,true);}}
function updateFreeze(rows,cols){commitEditor();try{transact(()=>setFreeze(sheet(),rows,cols));render();status(rows||cols?`Закреплено строк: ${rows}, столбцов: ${cols}`:'Закрепление снято');}catch(e){status(e.message,true);}}
function filterPopup(){const f=sheet()?.autoFilter,rect=filterRange(sheet());if(filterColumn===null||!f||!rect)return '';
 const column=filterColumn;if(column<rect.c1||column>rect.c2)return '';
 const options=new Set();for(let r=rect.r1+1;r<=rect.r2;r++)options.add(getCell(sheet(),cellName(r,column)).value);
 const selected=Object.hasOwn(f.rules,column)?f.rules[column]:null;
 const values=[...options].sort((a,b)=>a.localeCompare(b,'ru-RU',{numeric:true}));
 const allowed=selected===null?null:new Set(Array.isArray(selected)?selected:[selected]);
 return `<aside class="filter-popup" role="dialog" aria-label="Фильтр столбца ${esc(cellName(0,column).replace(/\d+$/,''))}"><div class="filter-popup-head"><strong>Фильтр: ${esc(cellName(0,column).replace(/\d+$/,''))}</strong><button data-action="filter-close" title="Закрыть">×</button></div><div class="filter-bulk"><button data-action="filter-all">Выбрать все</button><button data-action="filter-none">Снять все</button></div><div class="filter-choices" role="group" aria-label="Выбранные значения">${values.slice(0,200).map((v,i)=>`<label><input type="checkbox" data-filter-index="${i}" ${allowed===null||allowed.has(v)?'checked':''}><span>${esc(v||'(пусто)')}</span></label>`).join('')}</div>${values.length>200?'<small>Показаны первые 200 значений. Используйте фильтрацию меньшего диапазона для остальных.</small>':''}<div class="filter-popup-actions"><button data-action="filter-apply">Применить</button><button data-action="filter-reset">Сбросить столбец</button></div><small>Отмеченные значения будут показаны. Исходные данные не изменяются.</small></aside>`;
}
// Consistent vector iconography; no external font or network requests.
const icons={
 hideRow:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M3 15h18M9 12h6"/>',
 showRows:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M3 15h18M12 10v4m-2-2h4"/>',
 hideCol:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M9 4v16M15 4v16M10 12h4"/>',
 showCols:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M9 4v16M15 4v16M12 10v4m-2-2h4"/>',
 freezeRow:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18"/>',
 freezeCol:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M9 4v16"/>',
 freezeAt:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M9 4v16M3 10h18"/>',
 freezeOff:'<rect x="3" y="4" width="18" height="16" rx="1" stroke-dasharray="3 3"/>',
 width:'<path d="M3 4v16M21 4v16M7 12h10m-7-3-3 3 3 3m4-6 3 3-3 3"/>',
 height:'<path d="M4 3h16M4 21h16M12 7v10m-3-7 3-3 3 3m-6 4 3 3 3-3"/>',
 backup:'<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/>',
 csv:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M7 8h10M7 12h6M7 16h10"/>',
 xlsx:'<path d="M5 3h11l4 4v14H5zM16 3v5h4M8 11l6 6m0-6-6 6"/>',
 num:'<path d="M7 7h4v12M6 19h7m1-9a4 4 0 1 1 7 0c0 3-6 4-6 7h6"/>',
 percent:'<circle cx="6" cy="7" r="2"/><circle cx="18" cy="17" r="2"/><path d="M5 20 19 4"/>',
 currency:'<path d="M7 4h7a4 4 0 0 1 0 8H7V4zm0 8v8m0-4h9M5 16h12"/>',
 integer:'<path d="M8 4h8v16H8zM10 8h4M10 16h4"/>',
 date:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M7 14h3M13 14h3M7 18h3"/>',
 time:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>',
 datetime:'<rect x="2" y="3" width="14" height="15" rx="2"/><path d="M2 7h14M6 2v3M12 2v3"/><circle cx="17" cy="16" r="5"/><path d="M17 13v3l2 1"/>',
 duration:'<path d="M7 3h10M7 21h10M8 3v5l4 4 4-4V3M8 21v-5l4-4 4 4v5"/>',

 copy:'<rect x="7" y="7" width="13" height="13" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/>',
 clear:'<path d="M20 20H9L3 14a2 2 0 0 1 0-3l8-8a2 2 0 0 1 3 0l7 7a2 2 0 0 1 0 3l-7 7"/><path d="m7 8 10 10"/>',
 bold:'<path d="M7 5h7a4 4 0 0 1 0 8H7zM7 13h8a4 4 0 0 1 0 8H7z"/>',
 italic:'<path d="M13 4h7M4 20h7M16 4 8 20"/>',
 alignLeft:'<path d="M4 5h16M4 10h10M4 15h16M4 20h10"/>',
 alignCenter:'<path d="M4 5h16M7 10h10M4 15h16M7 20h10"/>',
 alignRight:'<path d="M4 5h16M10 10h10M4 15h16M10 20h10"/>',
 autosum:'<path d="M20 4H5l8 8-8 8h15"/>',
 undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-2"/>',
 redo:'<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h2"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
 eraser:'<path d="m3 17 10-10a3 3 0 0 1 4 0l4 4a3 3 0 0 1 0 4l-5 5H6z"/><path d="m9 11 7 7"/>',
 down:'<path d="M12 3v16m-6-6 6 6 6-6"/>',
 right:'<path d="M3 12h16m-6-6 6 6-6 6"/>',
 sortAsc:'<path d="M6 21V4m-4 4 4-4 4 4M14 6h8m-8 6h6m-6 6h4"/>',
 sortDesc:'<path d="M6 3v17m-4-4 4 4 4-4M14 6h4m-4 6h6m-6 6h8"/>',
 filter:'<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
 fileOpen:'<path d="M3 19V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
 download:'<path d="M12 3v13m-5-5 5 5 5-5M4 20h16"/>',
 save:'<path d="M4 3h14l3 3v15H3V3z"/><path d="M7 3v6h10V3M7 21v-9h10v9"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 edit:'<path d="m16 5 3 3M4 20l5-.5L20 8a2 2 0 0 0-4-4L5 15z"/>',
 freeze:'<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 10h18M10 3v18"/>',
 columns:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M11 4v16M8 12l-3 0m14 0h-3"/>',
 rows:'<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 12h18"/>',
 home:'<path d="m3 10 9-7 9 7v10h-6v-7H9v7H3z"/>',
 refresh:'<path d="M20 7v5h-5M4 17v-5h5M5 9a8 8 0 0 1 14-3l1 1M4 17l1 1a8 8 0 0 0 14-3"/>',
 insertRow:'<path d="M3 5h18M3 18h18M3 12h18M12 8v8m-4-4h8"/>',
 deleteRow:'<path d="M3 5h18M3 18h18M3 12h18M8 8l8 8m0-8-8 8"/>',
 insertColumn:'<path d="M5 3v18M18 3v18M12 3v18M8 12h8m-4-4v8"/>',
 deleteColumn:'<path d="M5 3v18M18 3v18M12 3v18M8 8l8 8m0-8-8 8"/>',
 borderAll:'<rect x="3" y="3" width="18" height="18"/><path d="M12 3v18M3 12h18"/>',
 borderNone:'<rect x="3" y="3" width="18" height="18" stroke-dasharray="2 3"/>',
 wrap:'<path d="M3 5h18M3 9h11M3 13h14M3 17h10M16 17l4-4m0 0v8"/>' ,textPalette:'<path d="M4 20h16M8 15l4-11 4 11M9.5 11h5"/>',
 fillPalette:'<path d="m3 14 9-10 9 10-9 7zM3 14h18"/>',
 borderOutline:'<rect x="4" y="4" width="16" height="16"/>',
 borderBottom:'<path d="M4 20h16"/><path d="M4 4h16v16H4z" stroke-dasharray="2 3" opacity=".5"/>',
 borderTop:'<path d="M4 4h16"/><path d="M4 4v16h16V4" stroke-dasharray="2 3" opacity=".5"/>',
 borderLeft:'<path d="M4 4v16"/><path d="M4 4h16v16H4" stroke-dasharray="2 3" opacity=".5"/>',
 borderRight:'<path d="M20 4v16"/><path d="M4 4h16v16H4" stroke-dasharray="2 3" opacity=".5"/>',
 merge:'<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M7 12h10m-3-3 3 3-3 3M10 9l-3 3 3 3"/>',
 unmerge:'<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M12 5v14M5 12h14"/>'

};
function toolIcon(action,original,extra=''){
 const direction=/data-value="(left|center|right)"/.exec(extra)?.[1];
 const name=action==='align'?'align'+({left:'Left',center:'Center',right:'Right'}[direction]||'Left'):action==='format'?({general:'num',currency:'currency',percent:'percent',integer:'integer',date:'date',time:'time',datetime:'datetime',duration:'duration'}[/data-value="([^"]+)"/.exec(extra)?.[1]]||'num'):
 ({'copy':'copy','clear':'clear','clear-format':'eraser','bold':'bold','italic':'italic','autosum':'autosum','undo':'undo','redo':'redo','fill-down':'down','fill-right':'right','sort-asc':'sortAsc','sort-desc':'sortDesc','find-open':'search','filter-toggle':'filter','import':'fileOpen','csv':'csv','xlsx':'xlsx','save':'save','backup':'backup','sheet-add':'plus','sheet-rename':'edit','freeze-row':'freezeRow','freeze-col':'freezeCol','freeze-at':'freezeAt','freeze-clear':'freezeOff','column-width':'width','column-fit':'columns','row-height':'height','row-reset':'refresh','goto':'home','insert-row':'insertRow','delete-row':'deleteRow','insert-col':'insertColumn','delete-col':'deleteColumn','border-all':'borderAll','border-none':'borderNone','border-menu':'borderOutline','border-outline':'borderOutline','border-bottom':'borderBottom','border-top':'borderTop','border-left':'borderLeft','border-right':'borderRight','merge-cells':'merge','unmerge-cells':'unmerge','text-palette':'textPalette','fill-palette':'fillPalette','wrap':'wrap','hide-row':'hideRow','show-rows':'showRows','hide-col':'hideCol','show-cols':'showCols'})[action];
 const path=icons[name];return path?`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`:original;
}
function ribbon(){
 const tabs=[['home','Главная'],['edit','Правка'],['insert','Вставка'],['formula','Формулы'],['data','Данные'],['view','Вид'],['file','Файл']];
 const labeled=new Set(['find-open','sort-asc','sort-desc','save','import','xlsx','csv','backup','autosum','sheet-add','sheet-rename','replace-all','border-menu','merge-cells','unmerge-cells']);
 const button=(action,label,icon='',extra='')=>`<button class="tool-btn ${labeled.has(action)?'is-labeled':''}" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}" ${extra}><span class="tool-symbol" aria-hidden="true">${toolIcon(action,icon,extra)}</span><span class="tool-label">${esc(label)}</span></button>`;
 const group=(name,buttons)=>`<section class="ribbon-group" aria-label="${esc(name)}"><div class="ribbon-group-content">${buttons}</div><div class="group-name">${esc(name)}</div></section>`;
 const colorTools=button('text-palette','Цвет текста','A')+button('fill-palette','Заливка ячеек','▰');
 let contents='';
 if(activeRibbon==='home')contents=
 group('Буфер',button('undo','Отменить','↶')+button('redo','Повторить','↷')+button('copy','Копировать','▢')+button('clear','Очистить содержимое','⌫'))+
 group('Шрифт',button('bold','Жирный','<b>Ж</b>')+button('italic','Курсив','<i>К</i>')+colorTools)+
 group('Выравнивание',button('align','По левому краю','≡','data-value="left"')+button('align','По центру','≡','data-value="center"')+button('align','По правому краю','≡','data-value="right"'))+
 group('Число',button('format','Общий','123','data-value="general"')+button('format','Рубли','₽','data-value="currency"')+button('format','Проценты','%','data-value="percent"')+button('format','Целое число','0','data-value="integer"')+button('format','Дата','📅','data-value="date"')+button('format','Время','⏱','data-value="time"')+button('format','Дата и время','◷','data-value="datetime"')+button('format','Длительность','◴','data-value="duration"'))+
 group('Вычисления',button('autosum','Автосумма','Σ'))+
 group('Оформление',button('border-menu','Границы','□')+button('merge-cells','Объединить ячейки','▣')+button('unmerge-cells','Разъединить','▤')+button('wrap','Перенос текста','↵')+button('clear-format','Сбросить формат','⟲'));
 if(activeRibbon==='edit')contents=
 group('История',button('undo','Отменить','↶')+button('redo','Повторить','↷'))+
 group('Ячейки',button('copy','Копировать','▢')+button('clear','Очистить содержимое','⌫')+button('clear-format','Сбросить формат','⟲'))+
 group('Заполнение',button('fill-down','Заполнить вниз','↓')+button('fill-right','Заполнить вправо','→'))+
 group('Поиск',button('find-open','Найти / заменить','⌕'));
 if(activeRibbon==='formula')contents=group('Быстрые функции',button('autosum','Автосумма','Σ')+['SUM','AVERAGE','MIN','MAX','COUNT'].map(fn=>button('formula-fn',fn,'ƒx',`data-fn="${fn}"`)).join(''))+`<div class="ribbon-help">Подсказка: =SUM(A1:A10)</div>`;
 if(activeRibbon==='data')contents=group('Сортировка',button('sort-asc','А → Я','↑')+button('sort-desc','Я → А','↓'))+group('Фильтр',button('filter-toggle','Автофильтр','⏷'))+group('Импорт и экспорт',button('import','Открыть','↥')+button('csv','CSV','⇩')+button('xlsx','XLSX','⇩'));
 if(activeRibbon==='insert')contents=group('Структура',button('insert-row','Вставить выбранные строки','+')+button('delete-row','Удалить выбранные строки','×')+button('insert-col','Вставить выбранные столбцы','+')+button('delete-col','Удалить выбранные столбцы','×'))+group('Листы',button('sheet-add','Новый лист','+'))+`<div class="ribbon-help">Диаграммы и изображения — в разработке</div>`;
 if(activeRibbon==='view')contents=group('Закрепление',button('freeze-row','Верхняя строка','▔')+button('freeze-col','Первый столбец','▏')+button('freeze-at','По выбранной ячейке','◧')+button('freeze-clear','Снять закрепление','×'))+group('Размеры',button('column-width','Ширина столбца','↔')+button('column-fit','Автоподбор ширины','⇥')+button('row-height','Высота строки','↕')+button('row-reset','Стандартная высота','↺'))+group('Скрытие',button('hide-row','Скрыть строку','−')+button('show-rows','Показать строки','+')+button('hide-col','Скрыть столбец','−')+button('show-cols','Показать столбцы','+'))+group('Переход',button('goto','В начало','⌂','data-ref="A1"')+button('goto','Строка 100','↧','data-ref="A100"')+button('goto','Столбец Z','↦','data-ref="Z1"'))+group('Поиск',button('find-open','Найти','⌕'));
 if(activeRibbon==='file')contents=group('Документ',button('save','Сохранить','⇩')+button('backup','Архив','▤')+button('import','Открыть','↥'))+group('Экспорт',button('csv','CSV','⇩')+button('xlsx','XLSX','⇩'));
 const finder=showFind?`<div class="find-bar" role="search"><label>Найти <input id="find-term" value="${esc(searchTerm)}" placeholder="Текст или число" autocomplete="off"></label><button data-action="find-next" title="Следующее совпадение">Следующее ↵</button><label>Заменить на <input id="replace-term" value="${esc(replaceTerm)}" placeholder="Новое значение" autocomplete="off"></label><button data-action="replace-all">Заменить все</button><button data-action="find-close" aria-label="Закрыть поиск" title="Закрыть">×</button></div>`:'';
 return `<div class="ribbon"><div class="ribbon-tabs" role="tablist" aria-label="Инструменты таблицы">${tabs.map(([id,name])=>`<button role="tab" aria-selected="${activeRibbon===id}" class="${activeRibbon===id?'chosen':''}" data-action="ribbon" data-target="${id}">${name}</button>`).join('')}</div><div class="ribbon-controls">${contents}</div>${palettePopup()}${bordersPopup()}${finder}</div>`;
}
function sheetpage(){const b=book(),s=sheet();return `<main class="sheet-page">${ribbon()}<div class="formula-line"><input id="name-box" aria-label="Адрес выбранной ячейки" value="${esc(activeCell)}" spellcheck="false"><div class="fx-symbol">ƒx</div><input id="formula-input" aria-label="Формула или значение" spellcheck="false" value="${esc(getCell(s,activeCell).value)}" placeholder="Значение или формула (например, =SUM(A1:A9))"></div>${filterPopup()}<div id="grid-frame" class="grid-frame"><div id="grid-scroll" class="grid-scroll" tabindex="0" role="grid" aria-label="Лист ${esc(s.name)}"><div id="grid-canvas" class="grid-canvas"></div></div><div id="grid-frozen-rows" class="grid-frozen-rows" aria-label="Закреплённые строки"></div><div id="grid-frozen-cols" class="grid-frozen-cols" aria-label="Закреплённые столбцы"></div><div id="grid-col-overlay" class="grid-col-overlay" aria-label="Заголовки столбцов"></div><div id="grid-row-overlay" class="grid-row-overlay" aria-label="Заголовки строк"></div><button id="grid-corner" class="grid-corner-fixed" data-action="select-all" aria-label="Выделить весь лист" title="Выделить весь лист"></button></div><div class="sheet-footer"><div class="sheet-tabs"><button class="sheet-menu" data-action="sheet-add" title="Добавить лист">+</button>${b.sheets.map(x=>`<button class="sheet-tab ${s.id===x.id?'selected':''}" data-action="sheet-select" data-id="${esc(x.id)}" title="Двойной щелчок — переименовать лист">${esc(x.name)}</button>`).join('')}<button class="sheet-options" data-action="sheet-delete" title="Удалить лист">×</button></div><div class="sheet-status"><span id="selection-info">${esc(activeCell)}</span><span id="selection-stats">Выделено: 1</span><span>${LIMITS.rows.toLocaleString('ru-RU')} строк × ${LIMITS.columns} столбцов</span><span>Quantum Sheets / alpha</span></div></div></main>`;}
function render(){app.innerHTML=topbar()+(page==='home'?homepage():page==='templates'?templatesPage():page==='sheet'&&book()?sheetpage():placeholder(page))+`<input id="file-picker" type="file" accept=".qbook,.qbackup,.csv,.xlsx" hidden><div id="toast" class="toast" role="status"></div>`;
 if(page==='sheet'&&book()){const view=document.getElementById('grid-scroll');view.scrollLeft=scrollLeft;view.scrollTop=scrollTop;view.addEventListener('scroll',()=>{scrollLeft=view.scrollLeft;scrollTop=view.scrollTop;drawGrid(true);},{passive:true});drawGrid();updateSelectionStats();}}
let frozenRowScrollX=null;
function drawGrid(fromScroll=false){if(page!=='sheet'||!sheet())return;const view=document.getElementById('grid-scroll'),canvas=document.getElementById('grid-canvas');if(!view||!canvas||editing)return;
 const s=sheet(),{x,y}=gridGeometry(s),freezeR=s.freeze?.rows||0,freezeC=s.freeze?.cols||0;
 canvas.style.width=`${x.at(-1)}px`;canvas.style.height=`${y.at(-1)}px`;
 const firstR=Math.max(0,firstVisibleIndex(y,view.scrollTop)-2),lastR=Math.min(LIMITS.rows-1,firstVisibleIndex(y,view.scrollTop+view.clientHeight)+2);
 const firstC=Math.max(0,firstVisibleIndex(x,view.scrollLeft)-2),lastC=Math.min(LIMITS.columns-1,firstVisibleIndex(x,view.scrollLeft+view.clientWidth)+2);
 const rows=[...new Set([...Array.from({length:lastR-firstR+1},(_,i)=>firstR+i),...Array.from({length:freezeR},(_,i)=>i)])].sort((a,b)=>a-b);
 const cols=[...new Set([...Array.from({length:lastC-firstC+1},(_,i)=>firstC+i),...Array.from({length:freezeC},(_,i)=>i)])].sort((a,b)=>a-b);
 const rect=rectangle(activeCell,rangeEnd),filter=filterRange(s);const {raw,ctx}=recalculator.view(book(),s);let html='',pinnedRowsHtml='',pinnedColsHtml='';
 for(const m of s.merges||[]){const bounds=rectangle(m.from,m.to);if(bounds.r2>=firstR&&bounds.r1<=lastR&&bounds.c2>=firstC&&bounds.c1<=lastC){if(!rows.includes(bounds.r1))rows.push(bounds.r1);if(!cols.includes(bounds.c1))cols.push(bounds.c1);}}
 rows.sort((a,b)=>a-b);cols.sort((a,b)=>a-b);
 for(const r of rows)for(const c of cols){
  if(!rowVisible(s,r)||!columnVisible(s,c))continue;
  const ref=cellName(r,c),merged=mergeAt(s,ref);if(merged&&merged.from!==ref)continue;const bounds=merged?rectangle(merged.from,merged.to):null;
  const item=getCell(s,ref),selected=r>=rect.r1&&r<=rect.r2&&c>=rect.c1&&c<=rect.c2,active=ref===activeCell,style=item.style||{};
  const mergedBorders=bounds?{top:[...Array(bounds.c2-bounds.c1+1)].some((_,j)=>getCell(s,cellName(bounds.r1,bounds.c1+j)).style?.borders?.top),bottom:[...Array(bounds.c2-bounds.c1+1)].some((_,j)=>getCell(s,cellName(bounds.r2,bounds.c1+j)).style?.borders?.bottom),left:[...Array(bounds.r2-bounds.r1+1)].some((_,j)=>getCell(s,cellName(bounds.r1+j,bounds.c1)).style?.borders?.left),right:[...Array(bounds.r2-bounds.r1+1)].some((_,j)=>getCell(s,cellName(bounds.r1+j,bounds.c2)).style?.borders?.right)}:style.borders;
  const val=displayedValue(s,ref,raw,ctx),align=style.align||s.defaultAlign||(/^[-+]?\d+(\.\d+)?$/.test(val)?'right':'left');
  const appearance=`justify-content:${align==='center'?'center':align==='right'?'flex-end':'flex-start'};${style.bg?`background:${style.bg};`:''}${style.color?`color:${style.color};`:''}${style.bold?'font-weight:750;':''}${style.italic?'font-style:italic;':''}${style.border==='thin'?'box-shadow:inset 0 0 0 1px #526d5c;':''}${['left','right','top','bottom'].map(side=>mergedBorders?.[side]?`border-${side}:1px solid #526d5c;`:'').join('')}text-align:${align};`;
  const pinnedR=r<freezeR,pinnedC=c<freezeC;
  const action=(filter&&r===filter.r1&&c>=filter.c1&&c<=filter.c2)?`<button class="filter-head" data-action="filter-menu" data-col="${c}" title="Фильтр столбца ${esc(cellName(0,c).replace(/\d+$/,''))}">▾</button>`:'';
  const destination=pinnedR?'row':pinnedC?'col':'main';
  const cellMarkup=`<div class="grid-cell ${merged?'is-merged':''} ${style.wrap?'is-wrapped':''} ${selected?'is-selected':''} ${active?'is-active':''} ${pinnedR?'frozen-row':''} ${pinnedC?'frozen-col':''}" data-ref="${ref}" role="gridcell" aria-selected="${selected}" style="top:${destination==='row'?y[r]-headerH:destination==='col'?y[r]-headerH-scrollTop:y[r]}px;left:${destination==='row'?x[c]-rowW-scrollLeft:destination==='col'?x[c]-rowW:x[c]}px;width:${(bounds?x[bounds.c2+1]:x[c+1])-x[c]}px;height:${(bounds?y[bounds.r2+1]:y[r+1])-y[r]}px;${appearance}" title="${esc(ref)}">${esc(val)}${action}</div>`;
  if(destination==='row')pinnedRowsHtml+=cellMarkup;
  else if(destination==='col')pinnedColsHtml+=cellMarkup;
  else html+=cellMarkup;
 }
 const rowOverlay=document.getElementById('grid-row-overlay'),colOverlay=document.getElementById('grid-col-overlay');
 let rowHtml='',colHtml='';
 for(const r of rows){if(!rowVisible(s,r))continue;const pinned=r<freezeR;
  rowHtml+=`<div class="rowhead ${pinned?'frozen-row':''} ${rect.r1<=r&&r<=rect.r2?'header-selected':''} ${parseCell(activeCell)?.row===r?'header-active':''}" data-action="select-row" data-index="${r}" title="Выделить строку ${r+1}" style="top:${y[r]-headerH-(pinned?0:view.scrollTop)}px;left:0;width:${rowW}px;height:${y[r+1]-y[r]}px">${r+1}<span class="grid-resizer row-resizer" data-resize="row" data-index="${r}" title="Изменить высоту строки ${r+1}"></span></div>`;
 }
 for(const c of cols){if(!columnVisible(s,c))continue;const pinned=c<freezeC;
  colHtml+=`<div class="colhead ${pinned?'frozen-col':''} ${rect.c1<=c&&c<=rect.c2?'header-selected':''} ${parseCell(activeCell)?.col===c?'header-active':''}" data-action="select-col" data-index="${c}" title="Выделить столбец ${cellName(0,c).replace(/\d+$/,'')}" style="top:0;left:${x[c]-rowW-(pinned?0:view.scrollLeft)}px;width:${x[c+1]-x[c]}px;height:${headerH}px">${esc(cellName(0,c).replace(/\d+$/,''))}<span class="grid-resizer col-resizer" data-resize="col" data-index="${c}" title="Потянуть для изменения ширины; двойной щелчок — автоподбор"></span></div>`;
 }
 rowOverlay.innerHTML=rowHtml;colOverlay.innerHTML=colHtml;
 canvas.innerHTML=html;
 const top=document.getElementById('grid-frozen-rows'),left=document.getElementById('grid-frozen-cols');
 if(top){top.style.height=`${y[freezeR]-headerH}px`;top.style.display=freezeR?'block':'none';
  if(!fromScroll||frozenRowScrollX!==view.scrollLeft||top.dataset.sheetId!==s.id){top.innerHTML=pinnedRowsHtml;frozenRowScrollX=view.scrollLeft;top.dataset.sheetId=s.id;}}
 if(left){left.style.width=`${x[freezeC]-rowW}px`;left.style.display=freezeC?'block':'none';left.innerHTML=pinnedColsHtml;}
}
app.addEventListener('click',async e=>{const target=e.target.closest('[data-action]');if(!target)return;const {action,id,value,ref,fn}=target.dataset;
 switch(action){case 'templates':templateKind=target.dataset.kind||'sheet';page='templates';render();break;case 'template-create':createBook(target.dataset.template==='new'?false:target.dataset.template);break;case 'select-row':{const index=Number(target.dataset.index);setSelection(cellName(index,0),cellName(index,LIMITS.columns-1));break;}case 'select-col':{const index=Number(target.dataset.index);setSelection(cellName(0,index),cellName(LIMITS.rows-1,index));break;}case 'select-all':setSelection('A1',cellName(LIMITS.rows-1,LIMITS.columns-1));break;case 'route':route(target.dataset.target);break;case 'new':createBook();break;case 'schedule':createBook('schedule');break;case 'example':createBook(true);break;case 'open':openBook(id);break;case 'clone':cloneBook(id);break;case 'rename-book':renameBookInline(id,target);break;case 'delete':removeBook(id);break;
 case 'import':document.querySelector('#file-picker')?.click();break;case 'backup':backup();break;case 'save':await saveBook();break;
 case 'xlsx':if(book()){try{commitEditor();const data=await exportXLSX(book());download(`${safeFile(book().name)}.xlsx`,data,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');status('XLSX скачан: частичная совместимость, сохраните оригинал отдельно');}catch(err){status(err.message||'Ошибка экспорта XLSX',true);}}break;
 case 'csv':if(sheet()){download(`${safeFile(book().name)}-${safeFile(sheet().name)}.csv`,'\uFEFF'+exportCSV(sheet(),book()),'text/csv;charset=utf-8');status('CSV скачан (текущий лист)');}break;
 case 'ribbon':activeRibbon=target.dataset.target;activePalette=null;borderMenuOpen=false;render();break;case 'sort-asc':sortRange('asc');break;case 'sort-desc':sortRange('desc');break;case 'find-open':showSearch();break;case 'find-close':showFind=false;render();break;case 'find-next':nextMatch();break;case 'replace-all':replaceAll();break;case 'undo':undo();break;case 'redo':redo();break;case 'clear':clearSelected();break;case 'clear-format':clearSelectedFormat();break;case 'autosum':autoSum();break;case 'fill-down':fillSelected('down');break;case 'fill-right':fillSelected('right');break;
 case 'filter-toggle':toggleAutoFilter();break;
 case 'filter-menu':filterColumn=Number(target.dataset.col);render();break;
 case 'filter-close':filterColumn=null;render();break;
 case 'filter-reset':transact(()=>setFilterValue(sheet(),filterColumn,null));filterColumn=null;render();break;
 case 'filter-all':case 'filter-none':document.querySelectorAll('[data-filter-index]').forEach(box=>{box.checked=action==='filter-all';});break;
 case 'filter-apply':{const rect=filterRange(sheet());if(!rect||filterColumn===null)break;const choices=new Set();for(let r=rect.r1+1;r<=rect.r2;r++)choices.add(getCell(sheet(),cellName(r,filterColumn)).value);const values=[...choices].sort((a,b)=>a.localeCompare(b,'ru-RU',{numeric:true}));const boxes=[...document.querySelectorAll('[data-filter-index]')];const picked=boxes.filter(box=>box.checked).map(box=>values[Number(box.dataset.filterIndex)]);if(!picked.length){status('Выберите хотя бы одно значение',true);break;}if(values.length>200&&picked.length===boxes.length){status('Слишком много значений: сначала сократите диапазон',true);break;}const rule=picked.length===values.length?null:picked;transact(()=>setFilterValue(sheet(),filterColumn,rule));filterColumn=null;render();status(`Фильтр применён: ${picked.length} знач.`);break;}
 case 'freeze-row':updateFreeze(1,sheet().freeze?.cols||0);break;
 case 'freeze-col':updateFreeze(sheet().freeze?.rows||0,1);break;
 case 'freeze-at':{const pos=parseCell(activeCell);updateFreeze(pos.row,pos.col);break;}
 case 'freeze-clear':updateFreeze(0,0);break;
 case 'column-width':changeSize('col');break;case 'column-fit':autoFitColumn();break;case 'row-height':changeSize('row');break;case 'row-reset':resetRowHeight();break;
  case 'text-palette':case 'fill-palette':recordColorSelection();activePalette=action==='text-palette'?'color':'bg';borderMenuOpen=false;render();break;
 case 'palette-pick':applySelectedColor(activePalette,value);activePalette=null;render();document.getElementById('grid-scroll')?.focus({preventScroll:true});break;
 case 'palette-clear':applySelectedColor(activePalette,undefined);activePalette=null;render();document.getElementById('grid-scroll')?.focus({preventScroll:true});break;
 case 'border-menu':borderMenuOpen=!borderMenuOpen;activePalette=null;render();break;
 case 'border-mode':setCellBorders(value);break;
 case 'popup-close':activePalette=null;borderMenuOpen=false;render();break;
 case 'merge-cells':updateMerge('merge');break;case 'unmerge-cells':updateMerge('unmerge');break;
 case 'border-all':setCellBorders('all');break;case 'border-none':setCellBorders('none');break;case 'wrap':toggleWrap();break;
 case 'bold':applyStyle({bold:!getCell(sheet(),activeCell).style?.bold});break;case 'italic':applyStyle({italic:!getCell(sheet(),activeCell).style?.italic});break;case 'align':applyStyle({align:value});break;case 'format':applyStyle({format:value});break;
 case 'formula-fn':{const p=parseCell(activeCell);const from=p.row>0?cellName(0,p.col):cellName(1,p.col),to=p.row>0?cellName(p.row-1,p.col):cellName(9,p.col);const field=document.querySelector('#formula-input');if(field){field.value=`=${fn}(${from}:${to})`;field.focus();status('Проверьте диапазон, затем нажмите Enter');}break;}
 case 'copy':await copySelection();break;case 'goto':setSelection(ref);ensureVisible(parseCell(ref).row,parseCell(ref).col);break;
 case 'hide-row':visibilityAction('row',false);break;case 'show-rows':visibilityAction('row',true);break;case 'hide-col':visibilityAction('col',false);break;case 'show-cols':visibilityAction('col',true);break;
 case 'insert-row':structuralAction('row','insert');break;case 'delete-row':structuralAction('row','delete');break;case 'insert-col':structuralAction('col','insert');break;case 'delete-col':structuralAction('col','delete');break;
 case 'sheet-add':addSheet();break;case 'sheet-rename':renameSheet();break;case 'sheet-delete':deleteSheet();break;case 'sheet-select':if(e.detail>=2){renameSheet(id);break;}if(book().activeSheetId===id)break;commitEditor();book().activeSheetId=id;changed();setSelection('A1');render();break;
 }});
app.addEventListener('pointerdown',e=>{if(e.target.closest('.ribbon-color'))recordColorSelection();},true);
app.addEventListener('pointerdown',e=>{if((activePalette||borderMenuOpen)&&!e.target.closest('.format-popover,[data-action=fill-palette],[data-action=text-palette],[data-action=border-menu]')){activePalette=null;borderMenuOpen=false;document.querySelectorAll('.format-popover').forEach(el=>el.remove());}},true);
app.addEventListener('focusin',e=>{if(e.target?.matches?.('input[type=color]')&&!pendingColorSelection)recordColorSelection();});
app.addEventListener('input',e=>{if(e.target.id==='find-term')searchTerm=e.target.value;else if(e.target.id==='replace-term')replaceTerm=e.target.value;});
app.addEventListener('change',e=>{const t=e.target;if(t.id==='find-term'){searchTerm=t.value;}else if(t.id==='replace-term'){replaceTerm=t.value;}else if(t.id==='file-picker'){importFile(t.files?.[0]);t.value='';}else if(t.id==='book-name'){if(!book())return;const next=t.value.trim();if(next){transact(()=>{book().name=next});}else t.value=book().name;}else if(t.id==='text-color'){applySelectedColor('color',t.value);}else if(t.id==='fill-color'){applySelectedColor('bg',t.value);}else if(t.id==='palette-custom-color'){applySelectedColor(activePalette,t.value);activePalette=null;render();document.getElementById('grid-scroll')?.focus({preventScroll:true});}else if(t.id==='formula-input'){transact(()=>setTypedCell(sheet(),activeCell,t.value));drawGrid();}});
app.addEventListener('keydown',e=>{if(e.target.id==='find-term'&&e.key==='Enter'){e.preventDefault();nextMatch();return;}if(e.target.id==='name-box'&&e.key==='Enter'){const val=e.target.value.toUpperCase().replaceAll('$',''),match=/^([A-Z]+[1-9]\d*)(?::([A-Z]+[1-9]\d*))?$/.exec(val);if(match&&parseCell(match[1])?.row<LIMITS.rows&&parseCell(match[1])?.col<LIMITS.columns&&rowVisible(sheet(),parseCell(match[1]).row)&&columnVisible(sheet(),parseCell(match[1]).col)){setSelection(match[1],match[2]&&parseCell(match[2])?.row<LIMITS.rows&&parseCell(match[2])?.col<LIMITS.columns?match[2]:match[1]);const p=parseCell(match[1]);ensureVisible(p.row,p.col);e.target.blur();}else status('Неверный адрес ячейки',true);}if(e.target.id==='formula-input'&&e.key==='Enter'){e.target.blur();}});
app.addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-resize]');if(!handle||e.button!==0||!sheet())return;e.preventDefault();e.stopPropagation();commitEditor();mouseSelecting=false;
 const axis=handle.dataset.resize,index=Number(handle.dataset.index);resizeDrag={axis,index,start:axis==='col'?e.clientX:e.clientY,original:axis==='col'?columnWidth(sheet(),index):rowHeight(sheet(),index),value:null,sheetId:sheet().id};document.body.classList.add('is-resizing');});
window.addEventListener('pointermove',e=>{if(!resizeDrag||!sheet()||sheet().id!==resizeDrag.sheetId)return;const d=resizeDrag;const offset=(d.axis==='col'?e.clientX:e.clientY)-d.start;const min=d.axis==='col'?DIMENSIONS.minColumn:DIMENSIONS.minRow,max=d.axis==='col'?DIMENSIONS.maxColumn:DIMENSIONS.maxRow;const next=Math.min(max,Math.max(min,Math.round(d.original+offset)));
 if(d.value===next)return;d.value=next;if(d.axis==='col')setColumnWidth(sheet(),d.index,next);else setRowHeight(sheet(),d.index,next);drawGrid();});
window.addEventListener('pointerup',()=>{if(!resizeDrag)return;const d=resizeDrag;resizeDrag=null;document.body.classList.remove('is-resizing');if(!sheet()||sheet().id!==d.sheetId)return;
 if(d.axis==='col')setColumnWidth(sheet(),d.index,d.original);else setRowHeight(sheet(),d.index,d.original);
 if(d.value!==null&&d.value!==d.original){transact(()=>{if(d.axis==='col')setColumnWidth(sheet(),d.index,d.value);else setRowHeight(sheet(),d.index,d.value);});status(`Размер: ${d.value} px`);}drawGrid();});
window.addEventListener('pointercancel',()=>{if(!resizeDrag)return;const d=resizeDrag;resizeDrag=null;document.body.classList.remove('is-resizing');if(sheet()?.id===d.sheetId){if(d.axis==='col')setColumnWidth(sheet(),d.index,d.original);else setRowHeight(sheet(),d.index,d.original);drawGrid();}});
app.addEventListener('dblclick',e=>{const handle=e.target.closest('[data-resize]');if(!handle)return;e.preventDefault();e.stopPropagation();if(handle.dataset.resize==='col')autoFitColumn(Number(handle.dataset.index));else resetRowHeight(Number(handle.dataset.index));},true);
app.addEventListener('mousedown',e=>{const cell=e.target.closest('.grid-cell');if(cell){if(e.target.closest('.filter-head'))return;e.preventDefault();const ref=cell.dataset.ref;window.getSelection()?.removeAllRanges();setSelection(e.shiftKey?activeCell:ref,ref);if(e.detail>=2){mouseSelecting=false;editCell();}else{mouseSelecting=true;document.getElementById('grid-scroll')?.focus({preventScroll:true});}}});
app.addEventListener('mouseover',e=>{if(!mouseSelecting)return;const cell=e.target.closest('.grid-cell');if(cell&&cell.dataset.ref!==rangeEnd)setSelection(activeCell,cell.dataset.ref);});
window.addEventListener('mouseup',()=>{mouseSelecting=false;});
app.addEventListener('dblclick',e=>{const cell=e.target.closest('.grid-cell');if(cell){if(e.target.closest('.filter-head'))return;setSelection(cell.dataset.ref);editCell();}});
function captureSelection(){if(!sheet()||refuseHiddenSelection())return null;const rect=rectangle(activeCell,rangeEnd);if(rect&&(rect.r2-rect.r1+1)*(rect.c2-rect.c1+1)>10000){status('Копирование ограничено 10 000 ячеек',true);return null;}try{internalClipboard=copyCells(sheet(),activeCell,rangeEnd,book());return internalClipboard;}catch(error){status(error.message,true);return null;}}
async function copySelection(){const clip=captureSelection();if(!clip)return false;
 try{await navigator.clipboard.writeText(clip.text);status('Скопировано');}catch{status('Скопировано внутри Quantum Sheets (буфер браузера недоступен)');}
 return true;}
function pasteIntoCells(text,clip=null){if(!sheet()||refuseHiddenSelection())return false;
 try{
  if(!clip&&typeof text!=='string')throw Error('Буфер обмена пуст');
  if(!clip&&text.length===0)throw Error('Буфер обмена пуст');
  let info;transact(()=>{info=clip?pasteCells(sheet(),activeCell,clip):pasteTSV(sheet(),activeCell,text);});
  setSelection(activeCell,info.end);status(`Вставлено: ${info.rows} × ${info.cols}`);return true;
 }catch(error){status(error.message||'Вставка не выполнена',true);return false;}
}
// Clipboard events handle external data. In-app keyboard copy/paste also works on file:// without Clipboard API permissions.
window.addEventListener('copy',e=>{
 if(page!=='sheet'||editing||e.target?.matches?.('input,textarea,[contenteditable]')){internalClipboard=null;return;}
 const clip=captureSelection();if(!clip)return;
 if(e.clipboardData){e.preventDefault();e.clipboardData.setData('text/plain',clip.text);status('Скопировано');}
});
window.addEventListener('paste',e=>{
 if(page!=='sheet'||editing||e.target?.matches?.('input,textarea,[contenteditable]'))return;
 const text=e.clipboardData?.getData('text/plain');if(text===undefined)return;e.preventDefault();
 const clip=internalClipboard&&(text===internalClipboard.text||text==='')?internalClipboard:null;
 pasteIntoCells(text,clip);
});
// Copying in other windows invalidates a stale private clipboard; external paste stays native.
window.addEventListener('blur',()=>{internalClipboard=null;});
window.addEventListener('keydown',e=>{if(page!=='sheet'||!sheet())return;const t=e.target;const form=t?.matches('input,textarea,[contenteditable]');const textEdit=form&&!t?.matches('#name-box,input[type=color]')&&!(t?.id==='formula-input'&&t.value===getCell(sheet(),activeCell).value);
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'){e.preventDefault();showSearch();return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveBook();return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!textEdit){e.preventDefault();if(e.shiftKey)redo();else undo();return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'&&!textEdit){e.preventDefault();redo();return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'&&!form){e.preventDefault();fillSelected('down');return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='r'&&!form){e.preventDefault();fillSelected('right');return;}
 if(form)return;
 if(e.altKey&&(e.key==='='||e.code==='Equal')){e.preventDefault();autoSum();return;}
 if((e.ctrlKey||e.metaKey)&&(e.key.toLowerCase()==='c'||e.code==='KeyC')){e.preventDefault();copySelection();return;}
 if((e.ctrlKey||e.metaKey)&&(e.key.toLowerCase()==='v'||e.code==='KeyV')&&internalClipboard){e.preventDefault();pasteIntoCells(null,internalClipboard);return;}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='x'){e.preventDefault();const clip=captureSelection();if(clip?.merges?.length){status('Перемещение объединённых ячеек через Ctrl+X пока не поддерживается. Используйте копирование',true);return;}if(clip){copySelection().then(ok=>{if(ok)clearSelected();});}return;}
 if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();clearSelected();return;}
 if(e.key==='F2'){e.preventDefault();editCell();return;}
 const steps={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1],Tab:[0,e.shiftKey?-1:1],Enter:[e.shiftKey?-1:1,0]};
 if(steps[e.key]){e.preventDefault();moveSelection(...steps[e.key],e.shiftKey&&e.key.startsWith('Arrow'));return;}
 if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();editCell(e.key);}
});
window.addEventListener('beforeunload',()=>{if(editing)commitEditor();});
render();
