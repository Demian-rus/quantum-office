import {addChart,chartData,chartSVG,changeChart,removeChart,suggestChartRange,chartLayout,CHART_MIN_WIDTH,CHART_MIN_HEIGHT,chartOptions,CHART_COLORS,linearRegression,regressionLabel,quadraticRegression,quadraticLabel} from './core/charts.js';
import {addConditionalRule,removeConditionalRule,prepareConditionalScales,conditionalFill} from './core/conditional.js';
import {addDataRule,deleteDataRule,validationAt} from './core/validation.js';
import {printSettings,changePrintSettings,selectedPrintArea,planPrint,printHTML} from './core/printing.js';
import { newWorkbook,newSheet,currentSheet,getCell,setCell,setTypedCell,setStyle,refsBetween,rectangle,referencedFromOtherSheet,displayedValue,valuesTSV,pasteTSV,importCSV,exportCSV,validateWorkbook,createExample,createScheduleTemplate,createJournalTemplate,createBudgetTemplate,cellName,parseCell,LIMITS,fillSelection,fillTypedSelection,fillTypedAreas,fillAreasDirection,extendFillHandle,resultOf,sortSelectedRows,findCells,replaceAllText,clearFormatting,clearCellValues,planAutoSum,filterRange,filterRowVisible,setFreeze,setAutoFilter,setFilterValue,gridGeometry,firstVisibleIndex,columnWidth,rowHeight,setColumnWidth,setRowHeight,DIMENSIONS,rowVisible,columnVisible,setHidden,showAllHidden,mergeAt,mergeCells,unmergeCells,applyBorderPreset,setWholeSheetAlignment,setBulkColumnStyle,setRectangleStyle,getEffectiveStyle,resolveBorderSide,invalidateGridGeometry,FONT_FAMILIES } from './core/workbook.js';
import {loadWorkspace,saveWorkspace,newWorkspace,encodeBook,decodeBook,encodeWorkspace,decodeWorkspace} from './core/store.js';
import {importXLSX,exportXLSX} from './core/xlsx.js';
import {copyCells,pasteCells,pasteValuesCells,moveCells} from './core/clipboard.js';
import {changeSheetStructure} from './core/structure.js';
import {planTextToColumns,applyTextToColumns,planRemoveDuplicates,applyRemoveDuplicates} from './core/data-transform.js';
import {createWorkbookRecalculator} from './core/recalculation.js';
import {openDirectQBook,readDirectFileText,writeVerifiedQBook} from './core/direct-file.js';
const app=document.getElementById('app');
/** Only validated, fixed border enums become CSS. */
function borderCSS(side,edge){
 if(!edge)return '';
 const line=edge.line;
 const width=['medium','mediumDashed','mediumDashDot','mediumDashDotDot'].includes(line)?2:
  line==='thick'?3:line==='double'?3:1;
 const type=line==='double'?'double':line==='dotted'?'dotted':
  ['dashed','mediumDashed','dashDot','dashDotDot','mediumDashDot','mediumDashDotDot','slantDashDot'].includes(line)?'dashed':'solid';
 return `border-${side}:${width}px ${type} ${edge.color};`;
}
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
let scrollLeft=0,scrollTop=0,undoStacks=new Map(),redoStacks=new Map(),statusMessage='',storeWarning=false;
const directFiles=new Map(),dirtyFiles=new Set(),savingBooks=new Set();
let searchTerm='',replaceTerm='',findIndex=-1,showFind=false;
let resizeDrag=null, filterColumn=null;
let internalClipboard=null;
let chartDrawerOpen=false,selectedChartId=null,chartDrag=null;
let conditionalPanelOpen=false;
let validationPanelOpen=false;
let printOpen=false;
let dataTool=null;
let extraRanges=[],extraRangeSheetId=null,sizeContext=null,fillDrag=null;
function book(){return workspace.books.find(b=>b.id===workspace.active)||null;}
function sheet(){return book()?currentSheet(book()):null;}
function status(message,bad=false){statusMessage=message;const node=document.getElementById('toast');if(node){node.textContent=message;node.className=bad?'toast bad active':'toast active';clearTimeout(status.timer);status.timer=setTimeout(()=>node.classList.remove('active'),3100);}}
function updateSaveIndicator(){const n=document.querySelector('#storage-indicator'),b=book();if(!n)return;
 const linked=b&&directFiles.has(b.id);
 n.textContent=linked?(dirtyFiles.has(b.id)?'● Изменено · не сохранено на диск':'✓ Файл проверен на диске')+(storeWarning?' · нет автосохранения браузера':''):
  storeWarning?'⚠ Черновик не записан':'● Черновик в браузере';
 n.title=storeWarning?'Локальная память браузера недоступна. Прямые сохранения на диск и резервные копии проверяйте отдельно.':'Черновики браузера не заменяют отдельные резервные копии.';
}
function persist(){try{saveWorkspace(workspace);storeWarning=false;}catch(e){storeWarning=true;status('Память браузера недоступна: сохраните .qbook и архив',true);}updateSaveIndicator();}
function changed(){if(book()){book().updated=dateNow();dirtyFiles.add(book().id);}persist();if(page==='sheet'){if(chartDrawerOpen)refreshChartPreview();refreshSheetCharts();}}
/** Failed operations must not leave partially written cells, a bogus Undo step
 * or a cleared Redo stack. A single snapshot serves both undo and rollback. */
function transact(callback){
 const active=book();if(!active)return;
 const id=active.id,index=workspace.books.findIndex(b=>b.id===id);
 const original=structuredClone(active);
 const oldUndo=undoStacks.get(id),oldRedo=redoStacks.get(id);
 const next=[...(oldUndo||[]),original];if(next.length>50)next.shift();
 undoStacks.set(id,next);redoStacks.set(id,[]);
 try{
  callback();
  for(const part of active.sheets)invalidateGridGeometry(part);
  recalculator.reconcile(active,original);
 }catch(error){
  workspace.books[index]=original;
  if(oldUndo)undoStacks.set(id,oldUndo);else undoStacks.delete(id);
  if(oldRedo)redoStacks.set(id,oldRedo);else redoStacks.delete(id);
  for(const part of original.sheets)invalidateGridGeometry(part);
  recalculator.reset();
  throw error;
 }
 changed();
}
function replaceBook(fromHistory,toHistory,verb){
 const b=book();if(!b)return false;
 const stack=fromHistory.get(b.id)||[];
 if(!stack.length){status(verb==='undo'?'Нечего отменять':'Нечего повторять');return false;}
 const replacement=stack.pop();fromHistory.set(b.id,stack);
 const other=toHistory.get(b.id)||[];other.push(structuredClone(b));toHistory.set(b.id,other);
 workspace.books[workspace.books.findIndex(x=>x.id===b.id)]=replacement;
 recalculator.reset();dirtyFiles.add(b.id);persist();render();
 document.getElementById('grid-scroll')?.focus({preventScroll:true});
 status(verb==='undo'?'Действие отменено':'Действие повторено');
 return true;
}
function undo(){return replaceBook(undoStacks,redoStacks,'undo');}
function redo(){return replaceBook(redoStacks,undoStacks,'redo');}
function route(target){commitEditor();if(target==='home'){page='home';render();return;}if(target==='sheet'){page='sheet';if(!book()){if(!workspace.books.length){createBook();return;}workspace.active=workspace.books[0].id;}render();return;}page=target;render();}
function createBook(example=false){const b=example==='schedule'?createScheduleTemplate():example==='journal'?createJournalTemplate():example==='budget'?createBudgetTemplate():example?createExample():newWorkbook();workspace.books.unshift(b);workspace.active=b.id;page='sheet';activeCell=rangeEnd='A1';scrollLeft=scrollTop=0;persist();render();}
function openBook(id){const b=workspace.books.find(x=>x.id===id);if(!b)return;commitEditor();workspace.active=id;page='sheet';activeCell=rangeEnd='A1';scrollLeft=scrollTop=0;persist();render();}
function removeBook(id){const b=workspace.books.find(x=>x.id===id);if(!b||!confirm(`Удалить «${b.name}» из рабочего пространства? Скачанные файлы не будут удалены.`))return;directFiles.delete(id);dirtyFiles.delete(id);workspace.books=workspace.books.filter(x=>x.id!==id);workspace.active=workspace.books[0]?.id||null;if(!workspace.books.length)page='home';persist();render();}
function cloneBook(id){const orig=workspace.books.find(x=>x.id===id);if(!orig)return;const copy=structuredClone(orig), fresh=newWorkbook();copy.id=fresh.id;copy.name=`${copy.name} — копия`;copy.created=copy.updated=dateNow();workspace.books.unshift(copy);workspace.active=copy.id;persist();page='sheet';render();}
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
  if(title!==item.name){item.name=title;item.updated=dateNow();dirtyFiles.add(item.id);persist();}
  render();
 });
 form.append(input,ok,cancel);card.querySelector('.file-card-actions').before(form);
 input.focus();input.select();
}
function safeFile(s){return String(s).replace(/[\\/:*?"<>|]/g,'_').slice(0,90)||'quantum-office';}
function download(name,text,mime){const blob=new Blob([text],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
async function saveBook(asNew=false){
 commitEditor();const b=book();if(!b)return;
 const id=b.id,serialized=encodeBook(b),filename=`${safeFile(b.name)}.qbook`;
 if(savingBooks.has(id)){status('Сохранение этой книги уже выполняется',true);return;}
 if(typeof window.showSaveFilePicker!=='function'){
  if(directFiles.has(id)){status('Прямое сохранение недоступно; связанный файл не изменён',true);return;}
  download(filename,serialized,'application/json');
  status('Скачивание .qbook запрошено — проверьте загрузки. Запись не подтверждена.');return;
 }
 savingBooks.add(id);
 try{
  let link=asNew?null:directFiles.get(id);
  if(!link){
   const handle=await window.showSaveFilePicker({suggestedName:filename,types:[{description:'Quantum Office book',accept:{'application/json':['.qbook']}}]});
   const previous=await readDirectFileText(handle);
   if(previous!==''&&previous!==serialized)throw Error('Выбранный файл уже содержит другие данные. Перезапись запрещена — выберите другое имя.');
   link={handle,text:previous};
  }
  await writeVerifiedQBook(link.handle,link.text,serialized);
  const current=workspace.books.find(x=>x.id===id);
  if(current){
   directFiles.set(id,{handle:link.handle,text:serialized});
   const upToDate=encodeBook(current)===serialized;
   if(upToDate)dirtyFiles.delete(id);else dirtyFiles.add(id);
   updateSaveIndicator();
   status(upToDate?'Файл сохранён и проверен на диске':'Предыдущая версия сохранена. Есть новые несохранённые изменения.',!upToDate);
  }
 }catch(error){if(error.name!=='AbortError')status(error.message||'Запись не удалась. Проверьте файл на диске.',true);}
 finally{savingBooks.delete(id);updateSaveIndicator();}
}
async function openBookFromDisk(){
 if(typeof window.showOpenFilePicker!=='function'){status('Прямое открытие недоступно. Используйте обычный импорт .qbook без привязки к файлу.',true);return;}
 try{
  const [handle]=await window.showOpenFilePicker({multiple:false,types:[{description:'Quantum Office book',accept:{'application/json':['.qbook']}}]});
  if(!handle)return;
  const {book:loaded,text}=await openDirectQBook(handle);
  const imported=structuredClone(loaded);imported.id=newWorkbook().id;
  workspace.books.unshift(imported);workspace.active=imported.id;
  directFiles.set(imported.id,{handle,text});dirtyFiles.delete(imported.id);
  page='sheet';activeCell=rangeEnd='A1';scrollLeft=scrollTop=0;
  recalculator.reset();persist();render();
  status('Файл с диска открыт. Изменения записываются только по команде «Сохранить».');
 }catch(error){if(error.name!=='AbortError')status(error.message||'Ошибка открытия',true);}
}
function backup(){commitEditor();download(`Quantum-Office-архив-${new Date().toISOString().slice(0,10)}.qbackup`,encodeWorkspace(workspace),'application/json');status('Скачивание резервной копии запрошено. Проверьте загрузки.');}
async function importFile(file){if(!file)return;if(file.size>15_000_000){status('Файл больше 15 МБ не поддерживается',true);return;}try{
 const name=file.name.toLowerCase(),text=name.endsWith('.xlsx')?'':await file.text();
 if(name.endsWith('.qbackup')){
  const restored=decodeWorkspace(text);
  if(!confirm('Импорт архива заменит текущие черновики. Вы предварительно сохранили резервную копию?'))return;
  workspace=restored;directFiles.clear();dirtyFiles.clear();
  page='home';workspace.active=workspace.books[0]?.id??null;persist();render();
  status('Черновики восстановлены из архива. Файлы на диске не привязаны.');return;
 }
 let imported,importSummary=null;
 if(name.endsWith('.qbook')){imported=structuredClone(decodeBook(text));imported.id=newWorkbook().id;}
 else if(name.endsWith('.csv'))imported=importCSV(text,file.name.replace(/\.csv$/i,''));
 else if(name.endsWith('.xlsx')){importSummary={};imported=await importXLSX(await file.arrayBuffer(),file.name,importSummary);}
 else throw Error('Поддерживаются .qbook, .qbackup, .csv и .xlsx.');
 workspace.books.unshift(imported);workspace.active=imported.id;page='sheet';persist();render();
 if(name.endsWith('.xlsx')){const warnings=importSummary||{},missed=(warnings.skippedDataValidations||0)+(warnings.skippedConditionalFormatting||0)+(warnings.skippedCharts||0)+(warnings.skippedPrintSettings||0);status(`XLSX открыт: проверка данных — ${warnings.importedDataValidations||0}, условное форматирование — ${warnings.importedConditionalFormatting||0}, диаграммы — ${warnings.importedCharts||0}, параметры печати — ${warnings.importedPrintSettings||0}; пропущено неподдерживаемых объектов: ${missed}. Другие сложные возможности могут не переноситься.`);}else status('Импорт завершён. Для записи на диск используйте «Сохранить».');
 }catch(e){status(e.message||'Не удалось открыть файл',true);}
}
function selectedRects(){
 const active=rectangle(activeCell,rangeEnd);
 if(!active)return [];
 return [...(extraRangeSheetId===sheet()?.id?extraRanges:[]).map(r=>rectangle(r.from,r.to)).filter(Boolean),active];
}
function inAnySelection(row,col){return selectedRects().some(r=>row>=r.r1&&row<=r.r2&&col>=r.c1&&col<=r.c2);}
function requireSingleRange(message='Для этой операции выделите один непрерывный диапазон'){
 if(selectedRects().length<=1)return true;
 status(message,true);return false;
}
function addSelection(a,b=a){
 if(!sheet())return;
 const current={from:activeCell,to:rangeEnd};
 if(extraRangeSheetId!==sheet().id)extraRanges=[];
 if(extraRanges.length>=24){status('Можно выделить до 25 отдельных диапазонов',true);return;}
 extraRangeSheetId=sheet().id;
 extraRanges.push(current);
 setSelection(a,b,true);
}
function toggleCellSelection(ref){
 if(!sheet())return;
 const p=parseCell(ref);if(!p)return;
 const areas=selectedRects(),contained=areas.some(a=>p.row>=a.r1&&p.row<=a.r2&&p.col>=a.c1&&p.col<=a.c2);
 if(!contained){addSelection(ref);return;}
 const fragments=[];
 const push=(r1,c1,r2,c2)=>{
  if(r1<=r2&&c1<=c2)fragments.push({from:cellName(r1,c1),to:cellName(r2,c2)});
 };
 for(const a of areas){
  if(p.row<a.r1||p.row>a.r2||p.col<a.c1||p.col>a.c2){push(a.r1,a.c1,a.r2,a.c2);continue;}
  push(a.r1,a.c1,p.row-1,a.c2);
  push(p.row+1,a.c1,a.r2,a.c2);
  push(p.row,a.c1,p.row,p.col-1);
  push(p.row,p.col+1,p.row,a.c2);
 }
 // An active cell remains required when the last selected region is cleared.
 if(!fragments.length){setSelection(ref);return;}
 if(fragments.length>25){status('Можно выделить до 25 отдельных диапазонов',true);return;}
 const active=fragments.pop();extraRanges=fragments;
 extraRangeSheetId=sheet().id;
 setSelection(active.from,active.to,true);
}
function paintSelection(){
 document.querySelectorAll('.grid-cell').forEach(el=>{
  const p=parseCell(el.dataset.ref),chosen=inAnySelection(p.row,p.col);
  el.classList.toggle('is-selected',chosen);
  el.classList.toggle('is-active',el.dataset.ref===activeCell);
  el.setAttribute('aria-selected',String(chosen));
 });
}
function setSelection(a,b=a,keepExtra=false){if(!keepExtra){extraRanges=[];extraRangeSheetId=null;}if(a===b&&sheet()){const merged=mergeAt(sheet(),a);if(merged)a=merged.from,b=merged.from;}activeCell=a;rangeEnd=b;const box=document.querySelector('#name-box');if(box)box.value=a===b?a:`${a}:${b}`;const input=document.querySelector('#formula-input');if(input)input.value=getCell(sheet(),a).value;const slot=document.querySelector('#validation-choice-slot');if(slot)slot.innerHTML=validationDropdown();document.querySelector('#selection-info')?.replaceChildren(document.createTextNode(selectedRects().length>1?`${a} · ${selectedRects().length} области`:a===b?a:`${a}:${b}`));drawGrid();updateSelectionStats();}
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
function ensureVisible(r,c){const view=document.querySelector('#grid-scroll');if(!view||!sheet())return;const {x,y}=gridGeometry(sheet()),left=x[c],top=y[r]-headerH,width=x[c+1]-left,height=y[r+1]-y[r];
 if(c>=(sheet().freeze?.cols||0)&&left<view.scrollLeft+x[sheet().freeze?.cols||0])view.scrollLeft=Math.max(0,left-x[sheet().freeze?.cols||0]);
 else if(left+width>view.scrollLeft+view.clientWidth)view.scrollLeft=left+width-view.clientWidth;
 if(r>=(sheet().freeze?.rows||0)&&top<view.scrollTop+y[sheet().freeze?.rows||0]-headerH)view.scrollTop=Math.max(0,top-(y[sheet().freeze?.rows||0]-headerH));
 else if(top+height>view.scrollTop+view.clientHeight)view.scrollTop=top+height-view.clientHeight;}
function commitSelectedEntry(){
 if(!editing||!sheet())return;
 const {node}=editing,value=node.value;
 if(selectedRects().length===1&&activeCell===rangeEnd){commitEditor();return;}
 if(refuseHiddenSelection())return;
 try{
  const from=activeCell,to=rangeEnd,areas=selectedRects();
  let count=0;
  transact(()=>{count=areas.length>1?
    fillTypedAreas(sheet(),areas.map(a=>({from:cellName(a.r1,a.c1),to:cellName(a.r2,a.c2)})),value,from):
    fillTypedSelection(sheet(),from,to,value,from);});
  editing=null;node.remove();drawGrid();updateSelectionStats();
  const formula=document.getElementById('formula-input');if(formula)formula.value=getCell(sheet(),activeCell).value;
  document.getElementById('grid-scroll')?.focus({preventScroll:true});
  status(`Заполнено Ctrl+Enter: ${count} ячеек`);
 }catch(error){status(error.message||'Массовый ввод не выполнен',true);}
}
function commitEditor(cancel=false){if(!editing)return true;const {node,ref,initial}=editing;const value=cancel?initial:node.value;try{if(!cancel&&value!==initial)transact(()=>setTypedCell(sheet(),ref,value));}catch(err){status(err.message||'Недопустимое значение',true);node.focus();return false;}editing=null;node.remove();drawGrid();const formula=document.getElementById('formula-input');if(formula)formula.value=getCell(sheet(),ref).value;const slot=document.querySelector('#validation-choice-slot');if(slot)slot.innerHTML=validationDropdown();return true;}
function editCell(seed=null){if(!sheet())return;if(!rowVisible(sheet(),parseCell(activeCell)?.row)||!columnVisible(sheet(),parseCell(activeCell)?.col)){status('Ячейка скрыта: сначала отобразите строку или столбец',true);return;}commitEditor();const ref=activeCell,p=parseCell(ref),canvas=document.getElementById('grid-canvas');if(!canvas||!p)return;ensureVisible(p.row,p.col);
 const node=document.createElement('input');node.className='cell-editor';const {x,y}=gridGeometry(sheet());node.style.left=`${x[p.col]+1}px`;node.style.top=`${y[p.row]-headerH+1}px`;const merged=mergeAt(sheet(),ref),bounds=merged?rectangle(merged.from,merged.to):null;node.style.width=`${Math.max((bounds?x[bounds.c2+1]:x[p.col+1])-x[p.col]-2,160)}px`;node.style.height=`${(bounds?y[bounds.r2+1]:y[p.row+1])-y[p.row]-2}px`;const rawInput=getCell(sheet(),ref).value,fmt=getCell(sheet(),ref).style?.format;
 const {raw:editRaw,ctx:editCtx}=recalculator.view(book(),sheet());
 const initialInput=['date','time','datetime','duration'].includes(fmt)&&rawInput&&!rawInput.startsWith('=')?displayedValue(sheet(),ref,editRaw,editCtx):rawInput;
 node.value=seed===null?initialInput:seed;canvas.append(node);
 editing={node,ref,initial:initialInput};node.focus();if(seed===null)node.select();
 node.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();event.stopPropagation();commitSelectedEntry();}else if(event.key==='Enter'){event.preventDefault();if(commitEditor())moveSelection(event.shiftKey?-1:1,0);}else if(event.key==='Tab'){event.preventDefault();if(commitEditor())moveSelection(0,event.shiftKey?-1:1);}else if(event.key==='Escape'){event.preventDefault();commitEditor(true);}});
 node.addEventListener('blur',()=>{if(editing?.node===node)commitEditor();});}
function selectionContainsHiddenRows(){
 const rects=selectedRects(),s=sheet();if(!rects.length||!s)return false;
 for(const rect of rects){
 // A range spanning 100k rows is not intrinsically expensive: first inspect
 // explicit sparse hide maps. Only an active filter needs individual row checks.
 if(Object.keys(s.hiddenRows||{}).some(i=>+i>=rect.r1&&+i<=rect.r2))return true;
 if(Object.keys(s.hiddenColumns||{}).some(i=>+i>=rect.c1&&+i<=rect.c2))return true;
 const filter=filterRange(s);
 if(filter&&Object.keys(s.autoFilter?.rules||{}).length){
  for(let r=Math.max(rect.r1,filter.r1+1);r<=Math.min(rect.r2,filter.r2);r++)
   if(!rowVisible(s,r))return true;
 }
 }
 return false;
}
function refuseHiddenSelection(){if(!selectionContainsHiddenRows())return false;status('Выделение содержит скрытые строки или столбцы. Отобразите их перед массовым изменением.',true);return true;}
function clearSelected(){
 commitEditor();if(refuseHiddenSelection())return;
 if(selectedRects().length>1){
  try{
   const draft=structuredClone(sheet());let count=0;
   for(const a of selectedRects())count+=clearCellValues(draft,cellName(a.r1,a.c1),cellName(a.r2,a.c2));
   if(!count){status('В выделении нет содержимого для очистки');return;}
   transact(()=>{sheet().cells=draft.cells;});drawGrid();updateSelectionStats();status('Очищено: '+count+' ячеек');return;
  }catch(err){status(err.message,true);return;}
 }
 try{
  const count=clearCellValues(sheet(),activeCell,rangeEnd,true);
  if(!count){status('В выделении нет содержимого для очистки');return;}
  transact(()=>clearCellValues(sheet(),activeCell,rangeEnd));
  drawGrid();updateSelectionStats();status(`Очищено содержимое: ${count} ячеек`);
 }catch(err){status(err.message,true);}
}
function clearSelectedFormat(){
 commitEditor();if(refuseHiddenSelection())return;
 if(selectedRects().length>1){
  try{
   const draft=structuredClone(sheet());let count=0;
   for(const a of selectedRects())count+=clearFormatting(draft,cellName(a.r1,a.c1),cellName(a.r2,a.c2));
   if(!count){status('Оформление уже сброшено');return;}
   transact(()=>{sheet().cells=draft.cells;});drawGrid();status('Оформление сброшено: '+count);return;
  }catch(err){status(err.message,true);return;}
 }
 try{
  const count=clearFormatting(sheet(),activeCell,rangeEnd,true);
  if(!count){status('Оформление уже сброшено');return;}
  transact(()=>clearFormatting(sheet(),activeCell,rangeEnd));
  drawGrid();status(`Сброшено оформление: ${count} элементов`);
 }catch(err){status(err.message,true);}
}
function autoSum(){if(!requireSingleRange())return;commitEditor();if(refuseHiddenSelection())return;try{const changes=planAutoSum(sheet(),activeCell,rangeEnd);transact(()=>{for(const x of changes)setCell(sheet(),x.ref,x.value);});setSelection(changes[0].ref,changes.at(-1).ref);status(`Автосумма: ${changes.length} формул`);}catch(err){status(err.message,true);}}
function fillSelected(direction){
 if(!sheet())return;commitEditor();if(refuseHiddenSelection())return;
 const areas=selectedRects(),ranges=areas.map(a=>({from:cellName(a.r1,a.c1),to:cellName(a.r2,a.c2)}));
 const draft=structuredClone(sheet());
 try{
  const count=areas.length>1?fillAreasDirection(draft,ranges,direction):
   fillSelection(draft,activeCell,rangeEnd,direction);
  if(!count){status('Нет ячеек для заполнения');return;}
  transact(()=>{sheet().cells=draft.cells;});
  drawGrid();updateSelectionStats();status('Заполнено '+count+' ячеек'+(areas.length>1?' в '+areas.length+' областях':''));
 }catch(e){status(e.message,true);}
}
function updateSelectionStats(){
 const node=document.querySelector('#selection-stats');if(!node||!sheet())return;
 const rects=selectedRects();if(!rects.length)return;
 const total=rects.reduce((n,r)=>n+(r.r2-r.r1+1)*(r.c2-r.c1+1),0),
  prefix=rects.length>1?'Областей: '+rects.length+' · ':'';
 if(total>10000){node.textContent=prefix+'Выделено: до '+total+' ячеек';return;}
 const visited=new Set(),{raw,ctx}=recalculator.view(book(),sheet());
 let count=0,sum=0;
 for(const area of rects)for(let r=area.r1;r<=area.r2;r++)for(let c=area.c1;c<=area.c2;c++){
  const ref=cellName(r,c);if(visited.has(ref))continue;visited.add(ref);
  const value=resultOf(sheet(),ref,raw,ctx),number=Number(value);
  if(value!==''&&Number.isFinite(number)){count++;sum+=number;}
 }
 node.textContent=count?prefix+'Чисел: '+count+' · Сумма: '+Number(sum.toFixed(8))+
  ' · Среднее: '+Number((sum/count).toFixed(8)):prefix+'Выделено: '+visited.size;
}
function structuralAction(axis,mode){
 if(!requireSingleRange())return;
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
 const all=selection?.ranges||selectedRects();
 if(all.length>1){
  if(selection&&(selection.bookId!==book()?.id||selection.sheetId!==sheet()?.id)){status('Исходный лист изменился',true);return;}
  try{
   if(refuseHiddenSelection())return;
   let total=0;for(const r of all)total+=(r.r2-r.r1+1)*(r.c2-r.c1+1);
   if(total>10000)throw Error('Множественное оформление ограничено 10 000 ячейками');
   const refs=new Set();
   for(const r of all)for(let row=r.r1;row<=r.r2;row++)for(let col=r.c1;col<=r.c2;col++)refs.add(cellName(row,col));
   transact(()=>{for(const ref of refs)setStyle(sheet(),ref,patch);});drawGrid();status('Оформлено областей: '+all.length);
  }catch(err){status(err.message,true);}
  return;
 }
 const a=selection?.start||activeCell,b=selection?.end||rangeEnd;
 // A color picker may dispatch change only after focus moved to another cell.
 // Do not ever apply a stale snapshot to a different document or worksheet.
 if(selection&&(selection.bookId!==book()?.id||selection.sheetId!==sheet()?.id)){status('Исходный лист изменился — выберите цвет заново',true);return;}
 const rect=rectangle(a,b);if(!rect||!sheet())return;
 if(Object.keys(patch).length===1&&rect.r1===0&&rect.r2===LIMITS.rows-1){
  if(refuseHiddenSelection())return;
  try{
   transact(()=>setBulkColumnStyle(sheet(),a,b,patch));drawGrid();
   status(rect.c1===0&&rect.c2===LIMITS.columns-1?'Оформление применено ко всему листу':'Оформление применено ко всем строкам выбранных столбцов');
  }catch(err){status(err.message,true);}
  return;
 }
 if((rect.r2-rect.r1+1)*(rect.c2-rect.c1+1)>10000){
  if(refuseHiddenSelection())return;
  try{
   transact(()=>setRectangleStyle(sheet(),a,b,patch));drawGrid();
   status('Оформление сохранено компактно. Экспорт XLSX доступен в пределах 200 000 позиций.');
  }catch(err){status(err.message,true);}
  return;
 }
 for(let r=rect.r1;r<=rect.r2;r++)if(!rowVisible(sheet(),r)){status('Выделение содержит скрытые строки',true);return;}
 const refs=refsBetween(a,b);
 transact(()=>{for(const ref of refs)setStyle(sheet(),ref,patch);});drawGrid();
}
function recordColorSelection(){if(!book()||!sheet())return;pendingColorSelection={bookId:book().id,sheetId:sheet().id,start:activeCell,end:rangeEnd,ranges:selectedRects()};}
function applySelectedColor(kind,value){const captured=pendingColorSelection;pendingColorSelection=null;applyStyle({[kind]:value},captured);}
function setCellBorders(mode){
 commitEditor();if(refuseHiddenSelection())return;
 if(selectedRects().length>1){
  const draft=structuredClone(sheet());
  try{
   for(const r of selectedRects())applyBorderPreset(draft,cellName(r.r1,r.c1),cellName(r.r2,r.c2),mode);
   transact(()=>{sheet().cells=draft.cells;});borderMenuOpen=false;render();status('Границы применены ко всем областям');
  }catch(err){status(err.message,true);}return;
 }
 const draft=structuredClone(sheet());try{applyBorderPreset(draft,activeCell,rangeEnd,mode);
  transact(()=>applyBorderPreset(sheet(),activeCell,rangeEnd,mode));borderMenuOpen=false;render();status('Границы обновлены');
 }catch(err){status(err.message,true);}
}
function insertCheckboxes(){
 if(!sheet()||!book())return;
 commitEditor();if(refuseHiddenSelection())return;
 const rects=selectedRects();
 const refs=[];
 for(const a of rects)for(let r=a.r1;r<=a.r2;r++)for(let c=a.c1;c<=a.c2;c++){
  refs.push(cellName(r,c));
  if(refs.length>10000){status('Можно вставить не более 10 000 отметок за раз',true);return;}
 }
 try{
  for(const ref of refs){
   const value=getCell(sheet(),ref).value;
   if(value&&value!=='☐'&&value!=='☑')throw Error('Выделение содержит данные: вставка чекбоксов не заменяет текст');
   if(mergeAt(sheet(),ref))throw Error('Нельзя вставить отметку в объединённую ячейку');
  }
  transact(()=>{for(const ref of refs){setCell(sheet(),ref,'☐');setStyle(sheet(),ref,{align:'center'});}});
  drawGrid();status('Добавлено отметок: '+refs.length);
 }catch(err){status(err.message,true);}
}
function toggleCellCheckbox(ref){
 if(!sheet())return;
 const current=getCell(sheet(),ref).value;
 if(current!=='☐'&&current!=='☑')return;
 try{
  transact(()=>setCell(sheet(),ref,current==='☐'?'☑':'☐'));
  drawGrid();
 }catch(err){status(err.message,true);}
}
function updateMerge(mode){if(!requireSingleRange())return;
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
function toggleWrap(){if(!requireSingleRange())return;const next=!getEffectiveStyle(sheet(),activeCell).wrap;const rect=rectangle(activeCell,rangeEnd);if(!rect||refuseHiddenSelection())return;
 if(rect.r1===0&&rect.r2===LIMITS.rows-1){
  try{
   transact(()=>setBulkColumnStyle(sheet(),activeCell,rangeEnd,{wrap:next}));drawGrid();
   status('Перенос текста применён ко всем строкам выбранных столбцов. Высоту при необходимости настройте отдельно.');
  }catch(err){status(err.message,true);}
  return;
 }
 const size=(rect.r2-rect.r1+1)*(rect.c2-rect.c1+1);
 if(size>10000){
  try{
   transact(()=>setRectangleStyle(sheet(),activeCell,rangeEnd,{wrap:next}));drawGrid();
   status('Перенос текста сохранён компактно. Для этого диапазона используйте .qbook.');
  }catch(err){status(err.message,true);}
  return;
 }
 const refs=refsBetween(activeCell,rangeEnd);
 const {raw,ctx}=recalculator.view(book(),sheet());
 transact(()=>{for(const ref of refs)setStyle(sheet(),ref,{wrap:next});
  // Expand rows only when needed; never shrink a user-defined custom height.
  if(next){for(let r=rect.r1;r<=rect.r2;r++){let need=rowHeight(sheet(),r);for(let c=rect.c1;c<=rect.c2;c++){
    const content=displayedValue(sheet(),cellName(r,c),raw,ctx),charsPerLine=Math.max(5,Math.floor((columnWidth(sheet(),c)-16)/7));
    const count=String(content).split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/charsPerLine)),0);
    need=Math.max(need,Math.min(DIMENSIONS.maxRow,Math.max(DIMENSIONS.minRow,count*17+8)));
   } if(need>rowHeight(sheet(),r))setRowHeight(sheet(),r,need);}}
 });drawGrid();}

function sortRange(direction){if(!requireSingleRange())return;if(!sheet())return;commitEditor();if(refuseHiddenSelection())return;const candidate=structuredClone(sheet());try{
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
 <div class="launcher-secondary"><button data-action="example">Открыть пример таблицы</button><button data-action="import">Открыть файл XLSX / QBOOK / CSV</button><button data-action="open-disk">Открыть QBOOK с диска</button></div>
 <div class="launcher-files"><div class="launcher-files-top"><span>Недавние файлы</span><button data-action="backup" title="Скачать резервную копию всех черновиков">Резервная копия</button></div><div class="files-grid">${cards||'<div class="empty-files"><span>◇</span><strong>Нет сохранённых черновиков</strong><p>Создайте таблицу или начните с шаблона расписания.</p></div>'}</div></div><div class="launcher-note">Черновики хранятся в браузере. Для надёжного хранения сохраняйте .qbook на диск.</div></main>`;
}
function placeholder(kind){const writer=kind==='writer';return `<main class="soon"><div class="soon-icon">${writer?'▤':'▣'}</div><span class="eyebrow">РАЗДЕЛ ЗАПЛАНИРОВАН</span><h1>${writer?'Quantum Writer':'Quantum Slides'}</h1><p>${writer?'Редактор текстов':'Редактор презентаций'} будет разработан после стабилизации таблиц. Мы не выдаём пустую имитацию за работающий редактор.</p><button class="primary-btn" data-action="route" data-target="sheet">Перейти к таблицам →</button></main>`;}
function sizeTargets(kind,index){
 // A whole-sheet selection is a compact default-dimension change, not 100k per-row writes.
 if(selectedRects().some(a=>a.r1===0&&a.r2===LIMITS.rows-1&&a.c1===0&&a.c2===LIMITS.columns-1))
  return ['all'];
 const full=kind==='col'?LIMITS.rows-1:LIMITS.columns-1,which=kind==='col'?'c':'r';
 const selected=selectedRects().filter(a=>kind==='col'?
  a.r1===0&&a.r2===full:a.c1===0&&a.c2===full);
 const contains=selected.some(a=>kind==='col'?
  index>=a.c1&&index<=a.c2:index>=a.r1&&index<=a.r2);
 if(!contains)return [index];
 const indices=new Set();
 for(const a of selected)for(let j=a[which+'1'];j<=a[which+'2'];j++){
  indices.add(j);if(indices.size>500)throw Error('За один раз можно изменить не более 500 строк или столбцов');
 }
 return [...indices].sort((a,b)=>a-b);
}
function sizeContextPanel(){
 if(!sizeContext||!sheet())return '';
 const m=sizeContext,style='left:'+m.x+'px;top:'+m.y+'px;',title=m.kind==='row'?'Высота строки':'Ширина столбца';
 if(m.kind==='cell')return '<div id="size-context-menu" class="size-context-menu" style="'+style+'" role="menu">'+
  '<button data-action="size-context-mode" data-kind="row" role="menuitem">Высота строки…</button>'+
  '<button data-action="size-context-mode" data-kind="col" role="menuitem">Ширина столбца…</button></div>';
 let targets;try{targets=sizeTargets(m.kind,m.index);}catch(err){return '<div id="size-context-menu" class="size-context-menu" style="'+style+'">'+esc(err.message)+'</div>';}
 const min=m.kind==='row'?DIMENSIONS.minRow:DIMENSIONS.minColumn,
  max=m.kind==='row'?DIMENSIONS.maxRow:DIMENSIONS.maxColumn;
 const initial=m.kind==='row'?rowHeight(sheet(),m.index):columnWidth(sheet(),m.index);
 return '<div id="size-context-menu" class="size-context-menu" style="'+style+'" role="dialog" aria-label="'+title+'">'+
  '<label>'+title+(targets[0]==='all'?' (все)':'')+(targets.length>1?' ('+targets.length+')':'')+
  '<input id="size-context-number" type="number" step="1" min="'+min+'" max="'+max+'" value="'+initial+'" aria-label="'+title+' в пикселях"></label>'+
  '<small>Допустимо: '+min+'–'+max+' пикселей</small>'+
  '<div class="size-context-actions"><button data-action="size-context-close">Отмена</button>'+
  '<button class="size-context-confirm" data-action="size-context-apply">Применить</button></div></div>';
}
function openSizeContext(kind,index,x,y){
 commitEditor();
 sizeContext={kind,index,x:Math.max(6,Math.min(x,window.innerWidth-268)),y:Math.max(6,Math.min(y,window.innerHeight-200))};
 const existing=document.getElementById('size-context-menu');existing?.remove();
 const holder=document.createElement('div');holder.innerHTML=sizeContextPanel();
 if(holder.firstElementChild)app.append(holder.firstElementChild);
 if(kind!=='cell'){const input=document.getElementById('size-context-number');input?.focus();input?.select();}
}
function applyContextSize(){
 if(!sizeContext||!['row','col'].includes(sizeContext.kind))return;
 const {kind,index}=sizeContext,value=Number(document.getElementById('size-context-number')?.value);
 try{
  if(!Number.isInteger(value))throw Error('Введите целое число пикселей');
  const targets=sizeTargets(kind,index);
  if(value<(kind==='row'?DIMENSIONS.minRow:DIMENSIONS.minColumn)||
     value>(kind==='row'?DIMENSIONS.maxRow:DIMENSIONS.maxColumn))
   throw Error('Размер вне допустимых границ');
  if(targets[0]!=='all'&&targets.every(i=>(kind==='row'?rowHeight(sheet(),i):columnWidth(sheet(),i))===value)){
   sizeContext=null;document.getElementById('size-context-menu')?.remove();return;
  }
  transact(()=>{
   if(targets[0]==='all'){
    if(kind==='row'){sheet().defaultRowHeight=value;sheet().rowHeights={};}
    else{sheet().defaultColumnWidth=value;sheet().columnWidths={};}
    invalidateGridGeometry(sheet());
   }else for(const i of targets)if(kind==='row')setRowHeight(sheet(),i,value);else setColumnWidth(sheet(),i,value);
  });
  sizeContext=null;render();status('Размер '+(kind==='row'?'строк':'столбцов')+': '+value+' px ('+(targets[0]==='all'?'все':targets.length)+')');
 }catch(err){status(err.message,true);}
}
function changeSize(kind){if(sizeContext){sizeContext=null;document.getElementById('size-context-menu')?.remove();}commitEditor();const p=parseCell(activeCell);if(!p)return;const current=kind==='col'?columnWidth(sheet(),p.col):rowHeight(sheet(),p.row);const input=prompt(kind==='col'?'Ширина столбца (48–520 пикселей)':'Высота строки (22–160 пикселей)',String(current));if(input===null)return;const value=Number(input);
 try{if(!Number.isInteger(value))throw Error('Введите целое число');transact(()=>{if(kind==='col')setColumnWidth(sheet(),p.col,value);else setRowHeight(sheet(),p.row,value);});drawGrid();status(`Размер изменён: ${value} пикселей`);}catch(err){status(err.message,true);}}
function autoFitColumn(index=null){commitEditor();const p=parseCell(activeCell);if(!p||!sheet())return;const c=index??p.col;let chars=0;const {raw,ctx}=recalculator.view(book(),sheet());for(const ref of Object.keys(sheet().cells)){const cell=parseCell(ref);if(cell?.col===c){const str=String(displayedValue(sheet(),ref,raw,ctx));for(const line of str.split('\n'))chars=Math.max(chars,line.length);}}const width=Math.max(DIMENSIONS.minColumn,Math.min(DIMENSIONS.maxColumn,Math.ceil(chars*7.2+20)));
 transact(()=>setColumnWidth(sheet(),c,width));drawGrid();status(`Столбец ${cellName(0,c).replace(/\d+$/,'')}: ${width} пикселей`);}
function resetRowHeight(index=null){const p=parseCell(activeCell);if(!p)return;transact(()=>setRowHeight(sheet(),index??p.row,DIMENSIONS.defaultRow));drawGrid();}
function toggleAutoFilter(){if(!requireSingleRange())return;commitEditor();if(sheet().autoFilter){transact(()=>{sheet().autoFilter=null});filterColumn=null;render();status('Автофильтр выключен — данные не изменены');return;}
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
 print:'<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6zM17 12h1"/>',
 validation:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 9l3 3 6-6M7 17h10"/>',
 conditional:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 10h18M10 3v18M11 16h7M13 13l2-2 2 2"/>',
 charts:'<rect x="3" y="11" width="4" height="9" rx="1"/><rect x="10" y="6" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="17" rx="1"/>',
 chartLine:'<polyline points="2,19 8,12 13,15 20,4"/><circle cx="8" cy="12" r="1"/><circle cx="13" cy="15" r="1"/>',
 chartPie:'<path d="M12 2v10h10A10 10 0 0 0 12 2z"/><path d="M10 4a9 9 0 1 0 11 10H10z"/>',
 pasteValues:'<path d="M8 4h9a2 2 0 0 1 2 2v5M8 4v3H5v12h8M8 4V2M9 13h10v7H9zM12 16h4M12 18h4"/>',
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
 if(['bold','italic','underline','strike'].includes(action))return original;
 if(action==='valign'){
  const where=/data-value="(top|center|bottom)"/.exec(extra)?.[1]||'center';
  const y=where==='top'?7:where==='bottom'?17:12;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 3h16M4 21h16" opacity=".25"/><path d="M6 ${y-3}h12M6 ${y}h12M6 ${y+3}h12"/></svg>`;
 }
 const direction=/data-value="(left|center|right)"/.exec(extra)?.[1];
 const name=action==='align'?'align'+({left:'Left',center:'Center',right:'Right'}[direction]||'Left'):action==='format'?({general:'num',currency:'currency',percent:'percent',integer:'integer',date:'date',time:'time',datetime:'datetime',duration:'duration'}[/data-value="([^"]+)"/.exec(extra)?.[1]]||'num'):
 ({'print-open':'print','validation-open':'validation','conditional-open':'conditional','chart-bar':'charts','chart-stacked':'charts','chart-stacked100':'charts','chart-line':'chartLine','chart-scatter':'chartLine','chart-pie':'chartPie','charts-open':'charts','copy':'copy','paste-values':'pasteValues','clear':'clear','clear-format':'eraser','bold':'bold','italic':'italic','autosum':'autosum','undo':'undo','redo':'redo','fill-down':'down','fill-right':'right','sort-asc':'sortAsc','sort-desc':'sortDesc','find-open':'search','filter-toggle':'filter','import':'fileOpen','csv':'csv','xlsx':'xlsx','save':'save','save-as':'save','open-disk':'fileOpen','backup':'backup','sheet-add':'plus','sheet-rename':'edit','freeze-row':'freezeRow','freeze-col':'freezeCol','freeze-at':'freezeAt','freeze-clear':'freezeOff','column-width':'width','column-fit':'columns','row-height':'height','row-reset':'refresh','goto':'home','insert-row':'insertRow','delete-row':'deleteRow','insert-col':'insertColumn','delete-col':'deleteColumn','border-all':'borderAll','border-none':'borderNone','border-menu':'borderOutline','border-outline':'borderOutline','border-bottom':'borderBottom','border-top':'borderTop','border-left':'borderLeft','border-right':'borderRight','merge-cells':'merge','unmerge-cells':'unmerge','text-palette':'textPalette','fill-palette':'fillPalette','wrap':'wrap','hide-row':'hideRow','show-rows':'showRows','hide-col':'hideCol','show-cols':'showCols'})[action];
 const path=icons[name];return path?`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`:original;
}
function ribbon(){
 const chosenFont=getEffectiveStyle(sheet(),activeCell).fontFamily||'Aptos';
 const chosenSize=getEffectiveStyle(sheet(),activeCell).fontSize||11;
 const fontTools='<div class="font-selectors"><select class="ribbon-font-picker" id="font-family-select" title="Гарнитура шрифта" aria-label="Шрифт">'+
  FONT_FAMILIES.map(name=>'<option value="'+esc(name)+'"'+(name===chosenFont?' selected':'')+'>'+esc(name)+'</option>').join('')+
  '</select><select class="ribbon-font-size" id="font-size-select" title="Размер шрифта" aria-label="Размер шрифта">'+
  [8,9,10,11,12,14,16,18,20,24,28,32,36,48,72].map(value=>'<option value="'+value+'"'+(value===chosenSize?' selected':'')+'>'+value+'</option>').join('')+'</select></div>';
 const tabs=[['home','Главная'],['edit','Правка'],['insert','Вставка'],['formula','Формулы'],['data','Данные'],['view','Вид'],['file','Файл']];
 const labeled=new Set();
 const button=(action,label,icon='',extra='')=>`<button class="tool-btn ${labeled.has(action)?'is-labeled':''}" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}" ${extra}><span class="tool-symbol" aria-hidden="true">${toolIcon(action,icon,extra)}</span><span class="tool-label">${esc(label)}</span></button>`;
 const group=(name,buttons)=>`<section class="ribbon-group ${name==='Шрифт'?'font-group':''}" aria-label="${esc(name)}"><div class="ribbon-group-content">${buttons}</div><div class="group-name">${esc(name)}</div></section>`;
 const colorTools=button('text-palette','Цвет текста','A')+button('fill-palette','Заливка ячеек','▰');
 let contents='';
 if(activeRibbon==='home')contents=
 group('Буфер',button('undo','Отменить','↶')+button('redo','Повторить','↷')+button('copy','Копировать','▢')+button('paste-values','Вставить значения','123')+button('clear','Очистить содержимое','⌫'))+
 group('Шрифт',fontTools+'<div class="font-action-row">'+button('bold','Жирный','<b class="font-letter">Ж</b>')+button('italic','Курсив','<i class="font-letter">К</i>')+button('underline','Подчёркнутый','<span class="font-letter underlined">Ч</span>')+button('strike','Зачёркнутый','<span class="font-letter struck">З</span>')+colorTools+'</div>')+
 group('Выравнивание','<div class="align-rows"><div class="align-row vertical">'+button('valign','По верхнему краю ячейки','▔','data-value="top"')+button('valign','По вертикальному центру','≡','data-value="center"')+button('valign','По нижнему краю ячейки','▁','data-value="bottom"')+'</div><div class="align-row horizontal">'+button('align','По левому краю','≡','data-value="left"')+button('align','По центру','≡','data-value="center"')+button('align','По правому краю','≡','data-value="right"')+'</div></div>')+
 group('Число',button('format','Общий','123','data-value="general"')+button('format','Рубли','₽','data-value="currency"')+button('format','Проценты','%','data-value="percent"')+button('format','Целое число','0','data-value="integer"')+button('format','Дата','📅','data-value="date"')+button('format','Время','⏱','data-value="time"')+button('format','Дата и время','◷','data-value="datetime"')+button('format','Длительность','◴','data-value="duration"'))+
 group('Вычисления',button('autosum','Автосумма','Σ'))+
 group('Оформление',button('border-menu','Границы','□')+button('merge-cells','Объединить ячейки','▣')+button('unmerge-cells','Разъединить','▤')+button('wrap','Перенос текста','↵')+button('conditional-open','Условное форматирование','▦')+button('clear-format','Сбросить формат','⟲'));
 if(activeRibbon==='edit')contents=
 group('История',button('undo','Отменить','↶')+button('redo','Повторить','↷'))+
 group('Ячейки',button('copy','Копировать','▢')+button('paste-values','Вставить значения','123')+button('clear','Очистить содержимое','⌫')+button('clear-format','Сбросить формат','⟲'))+
 group('Заполнение',button('fill-down','Заполнить вниз','↓')+button('fill-up','Заполнить вверх','↑')+button('fill-right','Заполнить вправо','→')+button('fill-left','Заполнить влево','←'))+
 group('Поиск',button('find-open','Найти / заменить','⌕'));
 if(activeRibbon==='formula')contents=group('Быстрые функции',button('autosum','Автосумма','Σ')+['SUM','AVERAGE','MIN','MAX','COUNT'].map(fn=>button('formula-fn',fn,'ƒx',`data-fn="${fn}"`)).join(''));
 if(activeRibbon==='data')contents=group('Сортировка',button('sort-asc','А → Я','↑')+button('sort-desc','Я → А','↓'))+group('Фильтр',button('filter-toggle','Автофильтр','⏷'))+group('Очистка данных',button('text-to-columns','Текст по столбцам','⇥')+button('remove-duplicates','Удалить дубликаты','≡'))+group('Проверка',button('validation-open','Проверка данных','✓'))+group('Импорт и экспорт',button('import','Открыть','↥')+button('csv','CSV','⇩')+button('xlsx','XLSX','⇩'));
 if(activeRibbon==='insert')contents=group('Отметки',button('insert-checkbox','Вставить чекбокс','☑'))+group('Структура',button('insert-row','Вставить выбранные строки','+')+button('delete-row','Удалить выбранные строки','×')+button('insert-col','Вставить выбранные столбцы','+')+button('delete-col','Удалить выбранные столбцы','×'))+group('Диаграммы',button('chart-bar','Столбчатая диаграмма','▥')+
  button('chart-stacked','С накоплением','▥')+
  button('chart-stacked100','С накоплением 100%','▥')+button('chart-line','Линейная диаграмма','⌁')+button('chart-scatter','Точечная XY','·')+button('chart-pie','Круговая диаграмма','◉')+button('charts-open','Мои диаграммы','▣'))+group('Листы',button('sheet-add','Новый лист','+'));
 if(activeRibbon==='view')contents=group('Печать',button('print-open','Печать таблицы','▤'))+group('Закрепление',button('freeze-row','Верхняя строка','▔')+button('freeze-col','Первый столбец','▏')+button('freeze-at','По выбранной ячейке','◧')+button('freeze-clear','Снять закрепление','×'))+group('Размеры',button('column-width','Ширина столбца','↔')+button('column-fit','Автоподбор ширины','⇥')+button('row-height','Высота строки','↕')+button('row-reset','Стандартная высота','↺'))+group('Скрытие',button('hide-row','Скрыть строку','−')+button('show-rows','Показать строки','+')+button('hide-col','Скрыть столбец','−')+button('show-cols','Показать столбцы','+'))+group('Переход',button('goto','В начало','⌂','data-ref="A1"')+button('goto','Строка 100','↧','data-ref="A100"')+button('goto','Столбец Z','↦','data-ref="Z1"'))+group('Поиск',button('find-open','Найти','⌕'));
 if(activeRibbon==='file')contents=group('Документ',button('save','Сохранить','⇩')+button('save-as','Сохранить как','⇩')+button('open-disk','Открыть с диска','↥')+button('backup','Архив','▤')+button('import','Импорт','↥'))+group('Экспорт',button('csv','CSV','⇩')+button('xlsx','XLSX','⇩'))+group('Печать',button('print-open','Предпросмотр и печать','▤'));
 const finder=showFind?`<div class="find-bar" role="search"><label>Найти <input id="find-term" value="${esc(searchTerm)}" placeholder="Текст или число" autocomplete="off"></label><button data-action="find-next" title="Следующее совпадение">Следующее ↵</button><label>Заменить на <input id="replace-term" value="${esc(replaceTerm)}" placeholder="Новое значение" autocomplete="off"></label><button data-action="replace-all">Заменить все</button><button data-action="find-close" aria-label="Закрыть поиск" title="Закрыть">×</button></div>`:'';
 return `<div class="ribbon"><div class="ribbon-tabs" role="tablist" aria-label="Инструменты таблицы">${tabs.map(([id,name])=>`<button role="tab" aria-selected="${activeRibbon===id}" class="${activeRibbon===id?'chosen':''}" data-action="ribbon" data-target="${id}">${name}</button>`).join('')}</div><div class="ribbon-controls">${contents}</div>${palettePopup()}${bordersPopup()}${finder}</div>`;
}



function validationDropdown(){
 if(!sheet()||activeCell!==rangeEnd)return '';
 const rule=validationAt(sheet(),activeCell);
 if(!rule||rule.kind!=='list')return '';
 const current=getCell(sheet(),activeCell).value;
 return '<label class="validation-cell-control" title="Выберите разрешённое значение"><span>Список</span><select id="validation-cell-select" aria-label="Выбрать значение ячейки">'+
  '<option value="" '+(current===''?'selected':'')+'>— Выберите —</option>'+
  rule.options.map(value=>'<option value="'+esc(value)+'" '+(value===current?'selected':'')+'>'+esc(value)+'</option>').join('')+
  '</select></label>';
}
function validationPanel(){
 if(!validationPanelOpen||page!=='sheet'||!sheet())return '';
 const rules=sheet().validations||[];
 const list=rules.map(rule=>'<div class="validation-rule"><div><strong>'+
   esc(rule.kind==='list'?'Выпадающий список: '+rule.options.join(', '):'Число от '+rule.min+' до '+rule.max)+
   '</strong><small>'+esc(rule.from+':'+rule.to)+'</small></div>'+
   '<button data-action="validation-delete" data-id="'+esc(rule.id)+'" aria-label="Удалить проверку">×</button></div>').join('');
 return '<aside class="validation-panel" id="validation-panel" role="complementary" aria-label="Проверка данных">'+
 '<header class="validation-panel-head"><strong>Проверка данных</strong><span>'+rules.length+' / 32</span>'+
 '<button data-action="validation-close" aria-label="Закрыть проверку данных">×</button></header>'+
 '<div class="validation-form"><small>Выделенный диапазон: '+esc(activeCell===rangeEnd?activeCell:activeCell+':'+rangeEnd)+'</small>'+
 '<label>Тип правила <select id="validation-kind"><option value="list">Выпадающий список</option><option value="number">Число в диапазоне</option></select></label>'+
 '<label id="validation-list-row">Элементы списка <textarea id="validation-list" rows="3" placeholder="Да; Нет; Не определено"></textarea></label>'+
 '<div id="validation-number-row" hidden><label>Минимум <input id="validation-min" type="number" step="any" value="0"></label>'+
 '<label>Максимум <input id="validation-max" type="number" step="any" value="100"></label></div>'+
 '<button class="validation-add" data-action="validation-add">Добавить правило</button></div>'+
 '<div class="validation-rules"><h4>Правила текущего листа</h4>'+ (list||'<p>Нет правил. Выделите нужные ячейки и добавьте первое.</p>')+'</div>'+
 '<div class="validation-note">Пустое значение разрешено; неверный ручной ввод и вставка блокируются. Формулы не ограничены до вычисления. В XLSX переносятся простые списки и числовые ограничения; для полной копии сохраняйте .qbook.</div></aside>';
}
function createValidationFromPanel(){
 if(!sheet())return;
 commitEditor();
 try{
  const kind=document.querySelector('#validation-kind')?.value;
  const payload=kind==='list'?document.querySelector('#validation-list')?.value||'':
   (document.querySelector('#validation-min')?.value||'')+';'+(document.querySelector('#validation-max')?.value||'');
  transact(()=>addDataRule(sheet(),activeCell,rangeEnd,kind,payload));
  render();status('Проверка данных установлена');
 }catch(err){status(err.message||'Невозможно установить проверку',true);}
}

function conditionalPanel(){
 if(!conditionalPanelOpen||page!=='sheet'||!sheet())return '';
 const kinds={gt:'Больше чем',lt:'Меньше чем',eq:'Равно',contains:'Содержит текст',scale:'Цветовая шкала'};
 const rules=sheet().conditionalRules||[];
 const list=rules.map(rule=>{
  const caption=rule.kind==='scale'?'Шкала от малого к большому':kinds[rule.kind]+' '+rule.target;
  return '<div class="cf-rule"><span class="cf-rule-swatch" style="background:'+(rule.kind==='scale'?'linear-gradient(90deg,'+(rule.lowColor||'#f7e2dc')+','+(rule.highColor||'#5fb486')+')':rule.color)+'"></span>'+
    '<div class="cf-rule-label"><strong>'+esc(caption)+'</strong><small>'+esc(rule.from+':'+rule.to)+'</small></div>'+
    '<button data-action="conditional-remove" data-id="'+esc(rule.id)+'" aria-label="Удалить правило" title="Удалить правило">×</button></div>';
 }).join('');
 return '<aside class="cf-panel" id="cf-panel" role="complementary" aria-label="Условное форматирование">'+
   '<header class="cf-head"><strong>Условное форматирование</strong><span>'+rules.length+' / 24</span>'+
   '<button data-action="conditional-close" aria-label="Закрыть правила">×</button></header>'+
   '<div class="cf-form"><small>Новый диапазон: '+esc(activeCell===rangeEnd?activeCell:activeCell+':'+rangeEnd)+'</small>'+
   '<label>Условие <select id="cf-kind">'+Object.entries(kinds).map(([key,v])=>'<option value="'+key+'">'+v+'</option>').join('')+'</select></label>'+
   '<label id="cf-threshold-label">Значение <input id="cf-threshold" value="0" maxlength="150" placeholder="Число или фрагмент текста"></label>'+
   '<label id="cf-color-label">Цвет <input type="color" id="cf-color" value="#e2f2dc" aria-label="Цвет выделения"></label>'+
   '<button class="cf-add" data-action="conditional-add">Применить к выделению</button></div>'+
   '<div class="cf-rules"><h4>Правила листа</h4>'+(list||'<p>Пока нет правил. Выделите ячейки и задайте условие.</p>')+'</div>'+
   '<div class="cf-note">Значения и ручное оформление не изменяются. В XLSX переносятся простые условия и двухцветные шкалы; для полной копии сохраняйте .qbook.</div></aside>';
}
function addSelectedCondition(){
 if(!sheet())return;
 commitEditor();
 try{
  const kind=document.getElementById('cf-kind')?.value;
  const threshold=document.getElementById('cf-threshold')?.value||'';
  const color=document.getElementById('cf-color')?.value||'#e2f2dc';
  transact(()=>addConditionalRule(sheet(),activeCell,rangeEnd,kind,threshold,color));
  render();status('Правило условного форматирования добавлено');
 }catch(err){status(err.message||'Правило не создано',true);}
}

function chartPanel(){
 if(!chartDrawerOpen||page!=='sheet'||!book())return '';
 const saved=sheet().charts||[],selected=saved.find(c=>c.id===selectedChartId)||saved[0]||null;
 if(selected)selectedChartId=selected.id;
 let display='<div class="chart-empty">Выделите категории и до четырёх столбцов чисел. Затем создайте диаграмму на вкладке «Вставка».</div>';
 if(selected){try{display=chartSVG(chartData(book(),sheet(),selected,{allowEmpty:true}),selected.type,chartOptions(selected));}
  catch(err){display='<div class="chart-error">'+esc(err.message)+'</div>';}}
 const kinds={bar:'Столбчатая',stacked:'С накоплением',stacked100:'С накоплением 100%',line:'Линейная',scatter:'Точечная XY',pie:'Круговая'};
 const choices=saved.map(c=>'<button class="chart-choice '+(selected?.id===c.id?'active':'')+'" data-action="chart-open" data-id="'+esc(c.id)+'">'+esc(c.title)+'</button>').join('');
 const cfg=selected?chartOptions(selected):null,kind=selected?.type;
 const trendControls=selected&&kind==='scatter'?
  '<div class="chart-trend-controls"><strong>Аппроксимация XY</strong>'+
  '<label>Линия тренда <input id="chart-trendline" type="checkbox" '+(cfg.trendline?'checked':'')+'></label>'+
  '<label>Модель <select id="chart-trend-type" aria-label="Модель тренда">'+
  '<option value="linear" '+((cfg.trendType||'linear')==='linear'?'selected':'')+'>Линейная (1-я степень)</option>'+
  '<option value="quadratic" '+(cfg.trendType==='quadratic'?'selected':'')+'>Полиномиальная (2-я степень)</option>'+
  '</select></label>'+
  '<label>Показать уравнение <input id="chart-trend-equation" type="checkbox" '+(cfg.trendEquation?'checked':'')+'></label>'+
  '<label>Показать R² <input id="chart-trend-r2" type="checkbox" '+(cfg.trendR2?'checked':'')+'></label>'+
  (cfg.trendline?(()=>{
   try{
    const data=chartData(book(),sheet(),selected,{allowEmpty:true});
    if(!data.series?.some(s=>s.points.length))return '<small>Заполните числовые X и Y для расчёта тренда.</small>';
    return '<div class="chart-regression-results">'+data.series.map(item=>{
     const linear=linearRegression(item.points),quadratic=quadraticRegression(item.points),
      current=(cfg.trendType||'linear')==='quadratic'?quadratic:linear,
      equation=(cfg.trendType||'linear')==='quadratic'?quadraticLabel:regressionLabel;
     return '<div><b>'+esc(item.name)+'</b>: '+
      (current?esc(equation(current)):'невозможно рассчитать выбранную модель')+
      '<div>R² линейный: '+(linear?linear.r2.toFixed(4):'недоступен')+'</div>'+
      '<div>R² квадратичный: '+(quadratic?quadratic.r2.toFixed(4):'недоступен')+'</div>'+
      (linear&&quadratic?'<small>ΔR² = '+(quadratic.r2-linear.r2).toFixed(4)+
       ' (увеличение степени модели)</small>':'')+'</div>';
    }).join('')+'</div>';
   }catch(err){return '<small>'+esc(err.message)+'</small>';}
  })():'')+'</div>':'';
 const formatControls=selected?'<div class="chart-format" aria-label="Оформление диаграммы">'+
  '<strong>Оформление</strong><label>Подписи значений <input id="chart-labels" type="checkbox" '+(cfg.labels?'checked':'')+'></label>'+
  '<label>Легенда <select id="chart-legend">'+[['none','Скрыта'],['bottom','Снизу'],['right','Справа']].map(([v,label])=>'<option value="'+v+'" '+(cfg.legend===v?'selected':'')+'>'+label+'</option>').join('')+'</select></label>'+
  (kind!=='pie'?'<label>Линии сетки <input id="chart-grid" type="checkbox" '+(cfg.grid?'checked':'')+'></label>'+
  (kind==='stacked100'?
   '<small>Процентная ось автоматически ограничена диапазоном 0–100%. Сумма в каждой категории должна быть положительной.</small>':
  '<div class="chart-axis-fields"><label>'+(kind==='scatter'?'Минимум Y':'Минимум оси')+' <input id="chart-axis-min" type="number" step="any" placeholder="Авто" value="'+(cfg.min??'')+'"></label>'+
  '<label>'+(kind==='scatter'?'Максимум Y':'Максимум оси')+' <input id="chart-axis-max" type="number" step="any" placeholder="Авто" value="'+(cfg.max??'')+'"></label>'+
  '<button data-action="chart-axis-save">Применить оси</button></div>'):'')+
  (kind!=='pie'?'<div class="chart-colors"><small>Цвета рядов</small>'+
    Array.from({length:Math.max(1,rectangle(selected.from,selected.to).c2-rectangle(selected.from,selected.to).c1)},(_,i)=>
    '<label>Ряд '+(i+1)+' <input type="color" data-chart-color="'+i+'" aria-label="Цвет ряда '+(i+1)+'" value="'+(cfg.colors[i]||CHART_COLORS[i])+'"></label>').join('')+'</div>':'')+
  trendControls+'<button data-action="chart-style-reset" class="chart-reset">Сбросить оформление</button></div>':'';
 const settings=selected?'<div class="chart-settings"><label>Название <input id="chart-title" maxlength="120" value="'+esc(selected.title)+'" aria-label="Название диаграммы"></label>'+
   '<div class="chart-source"><label>Источник данных <input id="chart-range" spellcheck="false" aria-label="Диапазон диаграммы" value="'+esc(selected.from+':'+selected.to)+'" placeholder="A1:D6"></label>'+
   '<div class="chart-source-actions"><button data-action="chart-source">Применить диапазон</button><button data-action="chart-use-selection">По выделению</button></div></div>'+
   '<div class="chart-kinds">'+
   Object.entries(kinds).map(([key,label])=>'<button data-action="chart-type" data-type="'+key+'" class="'+(selected.type===key?'active':'')+'">'+label+'</button>').join('')+'</div>'+
   '<small>'+(kind==='scatter'?
   'Точечная XY: первый столбец — числовые X, следующие 1–4 столбца — числовые Y. Значения X не обязаны идти по порядку.':
   'Первый столбец — категории, следующие 1–4 столбца — числовые ряды. Круговая — один ряд. Можно создать диаграмму до заполнения данных.')+
   '</small></div>'+formatControls:'';
 return '<aside id="chart-panel" class="chart-panel" role="complementary" aria-label="Диаграммы листа">'+
   '<header class="chart-panel-head"><strong>Диаграммы</strong><span>'+saved.length+' / 30</span><button data-action="chart-close" aria-label="Закрыть диаграммы">×</button></header>'+
   '<nav class="chart-list">'+(choices||'<span>На листе пока нет диаграмм</span>')+'</nav>'+
   settings+'<div id="chart-preview" class="chart-preview">'+display+'</div>'+
   (selected?'<div class="chart-panel-foot"><button data-action="chart-delete">Удалить диаграмму</button><span>Столбчатые, накопительные, линейные и точечные XY (до 4 рядов) и круговые (1 ряд) сохраняются в XLSX. Резервная копия — .qbook.</span></div>':'')+'</aside>';
}
function refreshChartPreview(){
 const el=document.getElementById('chart-preview');if(!el||!book())return;
 const c=(sheet().charts||[]).find(x=>x.id===selectedChartId);if(!c)return;
 try{el.innerHTML=chartSVG(chartData(book(),sheet(),c,{allowEmpty:true}),c.type,chartOptions(c));}
 catch(err){el.innerHTML='<div class="chart-error">'+esc(err.message)+'</div>';}
}
/** Charts are sheet children, not side-panel previews. The overlay lives beside the
 * virtualized grid canvas, so scroll does not rebuild or detach it. */
function refreshSheetCharts(){
 const layer=document.getElementById('grid-charts-layer');
 if(!layer||!book()||!sheet())return;
 const view=document.getElementById('grid-scroll'),s=sheet();
 layer.style.width=document.getElementById('grid-canvas')?.style.width||'100%';
 layer.style.height=document.getElementById('grid-canvas')?.style.height||'100%';
 layer.innerHTML=(s.charts||[]).map((chart,i)=>{
  const layout=chartLayout(s,chart,i);
  let content='';
  try{content=chartSVG(chartData(book(),s,chart,{allowEmpty:true}),chart.type,chartOptions(chart));}
  catch(err){content='<div class="chart-error">'+esc(err.message)+'</div>';}
  return '<section class="qo-sheet-chart'+(chart.id===selectedChartId?' is-chart-selected':'')+
   '" data-id="'+esc(chart.id)+'" style="left:'+layout.x+'px;top:'+layout.y+
   'px;width:'+layout.width+'px;height:'+layout.height+'px" role="group" aria-label="Диаграмма: '+esc(chart.title)+'">'+
   '<div class="qo-chart-toolbar"><span class="qo-chart-move" data-chart-drag="'+esc(chart.id)+
   '" title="Перетащите, чтобы переместить диаграмму">⋮⋮ '+esc(chart.title)+'</span>'+
   '<button data-action="chart-open" data-id="'+esc(chart.id)+'" title="Настройки диаграммы" aria-label="Настройки диаграммы">⚙</button></div>'+
   '<div class="qo-chart-body">'+content+'</div>'+
   '<span class="qo-chart-resize" data-chart-resize="'+esc(chart.id)+'" role="button" tabindex="0" aria-label="Изменить размер диаграммы" title="Потяните для изменения размера"></span></section>';
 }).join('');
}
/** Every drag is one Undo transaction; preview positions are never persisted until release. */
function startChartPointerDrag(e){
 if(e.button!==0||!sheet()||!book()||resizeDrag)return;
 const handle=e.target.closest('[data-chart-drag],[data-chart-resize]');
 if(!handle)return;
 const id=handle.dataset.chartDrag||handle.dataset.chartResize,chart=(sheet().charts||[]).find(c=>c.id===id);
 if(!chart)return;
 e.preventDefault();e.stopPropagation();mouseSelecting=false;commitEditor();
 const layout=chartLayout(sheet(),chart,(sheet().charts||[]).indexOf(chart));
 const element=[...document.querySelectorAll('.qo-sheet-chart')].find(node=>node.dataset.id===id);
 chartDrag={id,sheetId:sheet().id,kind:handle.dataset.chartResize?'resize':'move',originX:e.clientX,originY:e.clientY,
  initial:layout,next:layout,element,moved:false};
 selectedChartId=id;
}
function previewChartPointerDrag(e){
 if(!chartDrag||!sheet()||sheet().id!==chartDrag.sheetId)return;
 const d=chartDrag,dx=Math.round(e.clientX-d.originX),dy=Math.round(e.clientY-d.originY);
 if(Math.abs(dx)+Math.abs(dy)<2&&!d.moved)return;
 const {x,y}=gridGeometry(sheet()),maxX=x.at(-1),maxY=y.at(-1)-headerH;
 const v={...d.initial};
 if(d.kind==='move'){
  v.x=Math.max(rowW,Math.min(maxX-v.width,v.x+dx));
  v.y=Math.max(0,Math.min(maxY-v.height,v.y+dy));
 }else{
  v.width=Math.max(CHART_MIN_WIDTH,Math.min(1000,maxX-v.x,v.width+dx));
  v.height=Math.max(CHART_MIN_HEIGHT,Math.min(700,maxY-v.y,v.height+dy));
 }
 d.next=v;d.moved=Object.keys(v).some(k=>v[k]!==d.initial[k]);
 if(d.element){
  d.element.style.left=v.x+'px';d.element.style.top=v.y+'px';
  d.element.style.width=v.width+'px';d.element.style.height=v.height+'px';
 }
 e.preventDefault();
}
function finishChartPointerDrag(commit){
 const d=chartDrag;chartDrag=null;
 if(!d||!commit||!d.moved||sheet()?.id!==d.sheetId)return;
 try{transact(()=>changeChart(sheet(),d.id,{layout:d.next}));refreshSheetCharts();status('Положение диаграммы сохранено (Ctrl+Z — отменить)');}
 catch(err){refreshSheetCharts();status(err.message,true);}
}
function createSelectedChart(type){if(!requireSingleRange())return;
 if(!sheet())return;
 commitEditor();
 try{
  const source=suggestChartRange(sheet(),activeCell,rangeEnd,type);
  let c;transact(()=>{c=addChart(book(),sheet(),type,source.from,source.to);});
  selectedChartId=c.id;chartDrawerOpen=true;render();
  status(source.mode==='empty'?'Пустая диаграмма создана: заполните категории и числа или измените источник данных.':
    source.mode==='detected'?'Диаграмма создана: редактор автоматически нашёл соседние данные.':
    'Диаграмма создана и связана с выбранными ячейками.');
 }catch(err){status(err.message||'Диаграмма не создана',true);}
}


function printPreviewPanel(){
 if(!printOpen||page!=='sheet'||!book())return '';
 const cfg=printSettings(sheet());let preview='',description='',canPrint=true;
 try{
  const layout=planPrint(book(),sheet());
  preview=printHTML(layout);
  description=layout.pages.length+' стр. · '+layout.range.from+':'+layout.range.to+
   ' · масштаб '+Math.round(layout.scale*100)+'%';
 }catch(error){
  canPrint=false;description=error.message||'Не удалось сформировать печатные страницы';
  preview='<div class="print-error">'+esc(description)+'</div>';
 }
 const option=(value,label,current)=>'<option value="'+value+'" '+(String(value)===String(current)?'selected':'')+'>'+label+'</option>';
 const marked=cfg.area?'Выбранная область '+cfg.area.from+':'+cfg.area.to:'Заполненная область листа';
 return '<section id="print-view" class="print-view" aria-label="Предварительный просмотр печати">'+
 '<div class="print-toolbar"><div class="print-title"><strong>Предпросмотр печати</strong><span>'+esc(description)+'</span></div>'+
 '<button data-action="print-close" aria-label="Закрыть печать">×</button></div>'+
 '<div class="print-layout"><aside class="print-settings">'+
 '<label>Бумага<select id="print-paper">'+option('A4','A4',cfg.paper)+option('Letter','Letter',cfg.paper)+'</select></label>'+
 '<label>Ориентация<select id="print-orientation">'+option('portrait','Книжная',cfg.orientation)+option('landscape','Альбомная',cfg.orientation)+'</select></label>'+
 '<label>Масштаб<select id="print-scale">'+[60,75,90,100,125].map(n=>option(n,n+'%',cfg.scale)).join('')+'</select></label>'+
 '<label class="print-check"><input type="checkbox" id="print-fit" '+(cfg.fitWidth?'checked':'')+'> Подогнать по ширине</label>'+
 '<div class="print-section"><strong>Область печати</strong><small>'+esc(marked)+'</small>'+
 '<button data-action="print-use-selection">Печатать выделение</button>'+
 '<button data-action="print-use-used">Печатать заполненную область</button></div>'+
 '<p>Данные и формулы остаются в книге. Для экспорта сохраните отдельно исходный XLSX или .qbook.</p>'+
 '<button data-action="print-now" class="print-primary" '+(canPrint?'':'disabled')+'>Печатать / сохранить PDF</button>'+
 '</aside><div class="print-preview-pages">'+preview+'</div></div></section>';
}
function printSettingChange(patch){
 try{transact(()=>changePrintSettings(sheet(),patch));render();}
 catch(error){status(error.message||'Нельзя изменить параметры печати',true);}
}
function printNow(){
 try{
  const layout=planPrint(book(),sheet());
  let style=document.getElementById('print-page-rule');
  if(!style){style=document.createElement('style');style.id='print-page-rule';document.head.append(style);}
  style.textContent='@page {size: '+layout.paper+' '+layout.orientation+'; margin: 0;}';
  window.print();
 }catch(error){status(error.message||'Не удалось открыть печать',true);}
}

function dataToolPanel(){
 if(!dataTool||!sheet())return '';
 const t=dataTool,split=t.kind==='split',title=split?'Текст по столбцам':'Удалить дубликаты';
 let preview='',valid=true,summary='';
 try{
  const plan=split?
   planTextToColumns(sheet(),t.from,t.to,{delimiter:t.delimiter,overwrite:t.overwrite}):
   planRemoveDuplicates(sheet(),t.from,t.to,{header:t.header,key:t.key});
  summary=split?'Строк: '+plan.rows+' · Колонок: '+plan.cols:
   'Повторов: '+plan.removed+' · Останется: '+plan.kept;
  preview=split?'<div class="data-tool-preview">'+plan.preview.map(p=>
   '<div><b>'+p.row+'</b> '+p.fields.map(v=>'<span>'+esc(v.slice(0,60))+'</span>').join('')+'</div>').join('')+'</div>':
   '<div class="data-tool-preview"><p>'+(plan.removed?
    'Повторяющиеся строки: '+esc(plan.duplicateRows.join(', '))+(plan.removed>10?'…':''):
    'Повторов не найдено')+'</p></div>';
 }catch(err){valid=false;preview='<p class="data-tool-error">'+esc(err.message)+'</p>';}
 const controls=split?
  '<label>Разделитель <select id="data-tool-delimiter">'+
  [[';','Точка с запятой'],[',','Запятая'],['\t','Табуляция'],[' ','Пробел'],['|','Вертикальная черта']].map(([v,label])=>
   '<option value="'+esc(v)+'" '+(v===t.delimiter?'selected':'')+'>'+esc(label)+'</option>').join('')+
  '</select></label><label class="data-tool-check"><input type="checkbox" id="data-tool-overwrite" '+
  (t.overwrite?'checked':'')+'> Заменять существующие ячейки справа</label>':
  '<label class="data-tool-check"><input type="checkbox" id="data-tool-header" '+(t.header?'checked':'')+
  '> Первая строка — заголовки</label>'+
  '<label>Сравнивать <select id="data-tool-key"><option value="all" '+(t.key==='all'?'selected':'')+
  '>Все столбцы</option><option value="first" '+(t.key==='first'?'selected':'')+
  '>Первый столбец</option></select></label>';
 return '<aside id="data-tool-panel" class="data-tool-panel" role="dialog" aria-label="'+esc(title)+'">'+
  '<header><strong>'+esc(title)+'</strong><button data-action="data-tool-close" aria-label="Закрыть">×</button></header>'+
  '<div class="data-tool-body"><p class="data-tool-range">Диапазон: <b>'+esc(t.from+(t.from===t.to?'':':'+t.to))+
  '</b></p>'+controls+'<div class="data-tool-summary">'+esc(summary)+'</div>'+preview+
  '<p class="data-tool-caution">'+(split?'Поддерживаются кавычки CSV. Соседние ячейки не заменяются без разрешения.':
   'Строки уплотняются только внутри выделения. Формулы и объединения в нём не поддерживаются.')+
  '</p><div class="data-tool-actions"><button data-action="data-tool-close">Отмена</button>'+
  '<button class="data-tool-primary" data-action="data-tool-apply" '+(valid?'':'disabled')+
  '>Применить</button></div></div></aside>';
}
function sheetpage(){const b=book(),s=sheet();return `<main class="sheet-page">${ribbon()}<div class="formula-line"><input id="name-box" aria-label="Адрес выбранной ячейки" value="${esc(activeCell)}" spellcheck="false"><div id="validation-choice-slot">${validationDropdown()}</div><div class="fx-symbol">ƒx</div><input id="formula-input" aria-label="Формула или значение" spellcheck="false" value="${esc(getCell(s,activeCell).value)}" placeholder="Значение или формула (например, =SUM(A1:A9))"></div>${filterPopup()}<div id="grid-frame" class="grid-frame"><div id="grid-scroll" class="grid-scroll" tabindex="0" role="grid" aria-label="Лист ${esc(s.name)}"><div id="grid-canvas" class="grid-canvas"></div><div id="grid-charts-layer" class="grid-charts-layer" aria-label="Диаграммы на листе"></div></div><div id="grid-fill-handle" class="grid-fill-handle" role="button" aria-label="Маркер автозаполнения" title="Перетащите для продолжения значений или формул" hidden></div><div id="grid-frozen-rows" class="grid-frozen-rows" aria-label="Закреплённые строки"></div><div id="grid-frozen-cols" class="grid-frozen-cols" aria-label="Закреплённые столбцы"></div><div id="grid-col-overlay" class="grid-col-overlay" aria-label="Заголовки столбцов"></div><div id="grid-row-overlay" class="grid-row-overlay" aria-label="Заголовки строк"></div><button id="grid-corner" class="grid-corner-fixed" data-action="select-all" aria-label="Выделить весь лист" title="Выделить весь лист"></button></div><div class="sheet-footer"><div class="sheet-tabs"><button class="sheet-menu" data-action="sheet-add" title="Добавить лист">+</button>${b.sheets.map(x=>`<button class="sheet-tab ${s.id===x.id?'selected':''}" data-action="sheet-select" data-id="${esc(x.id)}" title="Двойной щелчок — переименовать лист">${esc(x.name)}</button>`).join('')}<button class="sheet-options" data-action="sheet-delete" title="Удалить лист">×</button></div><div class="sheet-status"><span id="selection-info">${esc(activeCell)}</span><span id="selection-stats">Выделено: 1</span></div></div>${chartPanel()}${conditionalPanel()}${validationPanel()}${printPreviewPanel()}${dataToolPanel()}</main>`;}
function render(){
 const previousGrid=document.getElementById('grid-scroll');
 if(previousGrid&&previousGrid.dataset.sheetId===sheet()?.id){
  scrollLeft=previousGrid.scrollLeft;scrollTop=previousGrid.scrollTop;
 }
 app.innerHTML=topbar()+(page==='home'?homepage():page==='templates'?templatesPage():page==='sheet'&&book()?sheetpage():placeholder(page))+`<input id="file-picker" type="file" accept=".qbook,.qbackup,.csv,.xlsx" hidden><div id="toast" class="toast" role="status"></div>`;
 if(page==='sheet'&&book()){const view=document.getElementById('grid-scroll');view.dataset.sheetId=sheet().id;
 // Materialize virtual canvas before restoring scrollTop to avoid Chromium clamp to 0.
 const canvas=view.querySelector('#grid-canvas'),geometry=gridGeometry(sheet());
 canvas.style.width=geometry.x[geometry.x.length-1]+'px';
 canvas.style.height=(geometry.y[geometry.y.length-1]-headerH)+'px';
 view.scrollLeft=scrollLeft;view.scrollTop=scrollTop;
 view.addEventListener('scroll',()=>{
  // Detached views can still dispatch queued scroll events after switching books.
  if(!view.isConnected||view.dataset.sheetId!==sheet()?.id)return;
  scrollLeft=view.scrollLeft;scrollTop=view.scrollTop;
  if(view._gridFrame)return;
  view._gridFrame=requestAnimationFrame(()=>{
   view._gridFrame=null;
   if(view.isConnected&&view.dataset.sheetId===sheet()?.id)drawGrid(true);
  });
 },{passive:true});drawGrid();refreshSheetCharts();updateSelectionStats();}updateSaveIndicator();}
let frozenRowScrollX=null;
function refreshFillHandle(){
 const handle=document.getElementById('grid-fill-handle'),frame=document.getElementById('grid-frame');
 if(!handle||!frame)return;
 const rects=selectedRects();
 if(page!=='sheet'||!sheet()||editing||rects.length!==1||fillDrag){
  handle.hidden=true;return;
 }
 const r=rects[0];
 if((r.r2-r.r1+1)*(r.c2-r.c1+1)>10000){handle.hidden=true;return;}
 const end=cellName(r.r2,r.c2),cell=Array.from(frame.querySelectorAll('.grid-cell')).find(el=>el.dataset.ref===end);
 if(!cell){handle.hidden=true;return;}
 const box=cell.getBoundingClientRect(),parent=frame.getBoundingClientRect(),
  visible=box.bottom>=parent.top+headerH&&box.bottom<=parent.bottom&&
   box.right>=parent.left+rowW&&box.right<=parent.right;
 if(!visible){handle.hidden=true;return;}
 handle.style.left=Math.round(box.right-parent.left-5)+'px';
 handle.style.top=Math.round(box.bottom-parent.top-5)+'px';
 handle.hidden=false;
}
function showFillDragPreview(){
 const d=fillDrag,source=d?.source,area=d?.area;
 for(const el of document.querySelectorAll('.grid-cell')){
  const p=parseCell(el.dataset.ref);
  const inDestination=p&&area&&p.row>=area.r1&&p.row<=area.r2&&p.col>=area.c1&&p.col<=area.c2;
  const inSource=p&&source&&p.row>=source.r1&&p.row<=source.r2&&p.col>=source.c1&&p.col<=source.c2;
  el.classList.toggle('fill-preview',!!inDestination&&!inSource);
 }
}
function fillDragTargetAt(x,y){
 const d=fillDrag,view=document.getElementById('grid-scroll');
 if(!d||!sheet()||!view)return;
 const box=view.getBoundingClientRect();
 const sx=Math.max(box.left+rowW+2,Math.min(box.right-7,x));
 const sy=Math.max(box.top+headerH+2,Math.min(box.bottom-7,y));
 const node=document.elementFromPoint(sx,sy)?.closest('.grid-cell');
 let p=parseCell(node?.dataset.ref);
 // The pointer may be over a scrollbar, frozen overlay or outside the viewport.
 // Use grid geometry in that case rather than losing the drag at the boundary.
 if(!p){
  const {x:gx,y:gy}=gridGeometry(sheet());
  p={row:firstVisibleIndex(gy,view.scrollTop+sy-box.top+headerH),
     col:firstVisibleIndex(gx,view.scrollLeft+sx-box.left)};
 }
 if(!p||!rowVisible(sheet(),p.row)||!columnVisible(sheet(),p.col))return;
 const a=d.source;
 const candidates=[
  {direction:'up',distance:Math.max(0,a.r1-p.row),target:p.row},
  {direction:'down',distance:Math.max(0,p.row-a.r2),target:p.row},
  {direction:'left',distance:Math.max(0,a.c1-p.col),target:p.col},
  {direction:'right',distance:Math.max(0,p.col-a.c2),target:p.col}
 ];
 const winner=candidates.reduce((best,part)=>part.distance>best.distance?part:best);
 const direction=winner.distance?winner.direction:null,target=direction?winner.target:null;
 if(direction===d.direction&&target===d.target)return;
 d.direction=direction;d.target=target;
 d.area=direction?{
  r1:direction==='up'?target:a.r1,c1:direction==='left'?target:a.c1,
  r2:direction==='down'?target:a.r2,c2:direction==='right'?target:a.c2
 }:null;
 showFillDragPreview();
}
// Scroll while a drag remains near or beyond the visible grid boundary.
// Each frame resolves the target against the newly scrolled virtual grid.
let fillScrollFrame=null;
function startFillAutoScroll(){
 if(fillScrollFrame!==null)return;
 const frame=()=>{
  fillScrollFrame=null;
  const d=fillDrag,view=document.getElementById('grid-scroll');
  if(!d||!view)return;
  const box=view.getBoundingClientRect(),edge=25;
  const axisSpeed=(point,min,max)=>point<min+edge?
   -Math.min(36,Math.ceil((min+edge-point)/3)):
   point>max-edge?Math.min(36,Math.ceil((point-(max-edge))/3)):0;
  const dx=axisSpeed(d.pointerX,box.left+rowW,box.right-8),
   dy=axisSpeed(d.pointerY,box.top+headerH,box.bottom-8);
  if(dx||dy){
   const previousX=view.scrollLeft,previousY=view.scrollTop;
   view.scrollLeft+=dx;view.scrollTop+=dy;
   if(previousX!==view.scrollLeft||previousY!==view.scrollTop)
    fillDragTargetAt(d.pointerX,d.pointerY);
  }
  fillScrollFrame=requestAnimationFrame(frame);
 };
 fillScrollFrame=requestAnimationFrame(frame);
}
function endFillDrag(apply){
 const d=fillDrag;if(!d)return;
 fillDrag=null;
 if(fillScrollFrame!==null){cancelAnimationFrame(fillScrollFrame);fillScrollFrame=null;}
 document.body.classList.remove('is-fill-dragging');
 document.querySelectorAll('.grid-cell.fill-preview').forEach(el=>el.classList.remove('fill-preview'));
 if(apply&&d.direction&&d.target!=null&&sheet()?.id===d.sheetId){
  try{
   const reverse=d.direction==='up'||d.direction==='left',
    vertical=d.direction==='up'||d.direction==='down',
    edge=vertical?(reverse?d.source.r1:d.source.r2):(reverse?d.source.c1:d.source.c2),
    width=vertical?d.source.c2-d.source.c1+1:d.source.r2-d.source.r1+1,
    count=Math.abs(d.target-edge)*width;
   if(count>10000)throw Error('Автозаполнение ограничено 10 000 ячеек');
   let out;transact(()=>{out=extendFillHandle(sheet(),
    cellName(d.source.r1,d.source.c1),cellName(d.source.r2,d.source.c2),d.direction,d.target);});
   setSelection(out.from,out.to);status('Автозаполнено: '+out.count+' ячеек');
  }catch(err){status(err.message,true);drawGrid();}
 }else refreshFillHandle();
}
function drawGrid(fromScroll=false){if(page!=='sheet'||!sheet())return;const view=document.getElementById('grid-scroll'),canvas=document.getElementById('grid-canvas');if(!view||!canvas||editing)return;
 const s=sheet();if(view.dataset.sheetId!==s.id)return;
 // Use the live viewport offsets, not values left by another disposed view.
 scrollLeft=view.scrollLeft;scrollTop=view.scrollTop;
 const {x,y}=gridGeometry(s),freezeR=s.freeze?.rows||0,freezeC=s.freeze?.cols||0;
 canvas.style.width=`${x.at(-1)}px`;canvas.style.height=`${y.at(-1)-headerH}px`;
 const firstR=Math.max(0,firstVisibleIndex(y,view.scrollTop+headerH)-16),lastR=Math.min(LIMITS.rows-1,firstVisibleIndex(y,view.scrollTop+view.clientHeight+headerH)+16);
 const firstC=Math.max(0,firstVisibleIndex(x,view.scrollLeft)-3),lastC=Math.min(LIMITS.columns-1,firstVisibleIndex(x,view.scrollLeft+view.clientWidth)+3);
 const rows=[...new Set([...Array.from({length:lastR-firstR+1},(_,i)=>firstR+i),...Array.from({length:freezeR},(_,i)=>i)])].sort((a,b)=>a-b);
 const cols=[...new Set([...Array.from({length:lastC-firstC+1},(_,i)=>firstC+i),...Array.from({length:freezeC},(_,i)=>i)])].sort((a,b)=>a-b);
 const rect=rectangle(activeCell,rangeEnd),allSelection=selectedRects(),filter=filterRange(s);const {raw,ctx}=recalculator.view(book(),s);const scaleStats=prepareConditionalScales(s,raw,ctx);let html='',pinnedRowsHtml='',pinnedColsHtml='';
 for(const m of s.merges||[]){const bounds=rectangle(m.from,m.to);if(bounds.r2>=firstR&&bounds.r1<=lastR&&bounds.c2>=firstC&&bounds.c1<=lastC){if(!rows.includes(bounds.r1))rows.push(bounds.r1);if(!cols.includes(bounds.c1))cols.push(bounds.c1);}}
 rows.sort((a,b)=>a-b);cols.sort((a,b)=>a-b);
 for(const r of rows)for(const c of cols){
  if(!rowVisible(s,r)||!columnVisible(s,c))continue;
  const ref=cellName(r,c),merged=mergeAt(s,ref);if(merged&&merged.from!==ref)continue;const bounds=merged?rectangle(merged.from,merged.to):null;
  const item=getCell(s,ref),selected=allSelection.some(a=>r>=a.r1&&r<=a.r2&&c>=a.c1&&c<=a.c2),active=ref===activeCell,style={...getEffectiveStyle(s,ref)};
  if(s.conditionalRules?.length){const fill=conditionalFill(s,ref,resultOf(s,ref,raw,ctx),scaleStats);if(fill)style.bg=fill;}
  const boundary={
   top:bounds?[...Array(bounds.c2-bounds.c1+1)].map((_,j)=>resolveBorderSide(getEffectiveStyle(s,cellName(bounds.r1,bounds.c1+j)),'top')).find(Boolean):resolveBorderSide(style,'top'),
   bottom:bounds?[...Array(bounds.c2-bounds.c1+1)].map((_,j)=>resolveBorderSide(getEffectiveStyle(s,cellName(bounds.r2,bounds.c1+j)),'bottom')).find(Boolean):resolveBorderSide(style,'bottom'),
   left:bounds?[...Array(bounds.r2-bounds.r1+1)].map((_,j)=>resolveBorderSide(getEffectiveStyle(s,cellName(bounds.r1+j,bounds.c1)),'left')).find(Boolean):resolveBorderSide(style,'left'),
   right:bounds?[...Array(bounds.r2-bounds.r1+1)].map((_,j)=>resolveBorderSide(getEffectiveStyle(s,cellName(bounds.r1+j,bounds.c2)),'right')).find(Boolean):resolveBorderSide(style,'right')
  };
  const val=displayedValue(s,ref,raw,ctx),align=style.align||s.defaultAlign||(/^[-+]?\d+(\.\d+)?$/.test(val)?'right':'left');
  const appearance=`justify-content:${align==='center'?'center':align==='right'?'flex-end':'flex-start'};${style.bg?`background:${style.bg};`:''}${style.color?`color:${style.color};`:''}${style.bold?'font-weight:750;':''}${style.italic?'font-style:italic;':''}${style.underline||style.strike?`text-decoration-line:${style.underline&&style.strike?'underline line-through':style.underline?'underline':'line-through'};text-decoration-thickness:1px;text-underline-offset:2px;`:''}${style.verticalAlign?`align-items:${style.verticalAlign==='top'?'flex-start':style.verticalAlign==='bottom'?'flex-end':'center'};`:''}${style.fontSize?`font-size:${Math.round(style.fontSize*4/3*100)/100}px;`:''}${style.fontFamily&&FONT_FAMILIES.includes(style.fontFamily)?`font-family:'${style.fontFamily}',sans-serif;`:''}${style.border==='thin'?`box-shadow:inset 0 0 0 1px ${style.borderColor||'#526d5c'};`:''}${['left','right','top','bottom'].map(side=>borderCSS(side,boundary[side])).join('')}text-align:${align};`;
  const pinnedR=r<freezeR,pinnedC=c<freezeC;
  const action=(filter&&r===filter.r1&&c>=filter.c1&&c<=filter.c2)?`<button class="filter-head" data-action="filter-menu" data-col="${c}" title="Фильтр столбца ${esc(cellName(0,c).replace(/\d+$/,''))}">▾</button>`:'';
  const destination=pinnedR?'row':pinnedC?'col':'main';
  const cellMarkup=`<div class="grid-cell ${merged?'is-merged':''} ${style.wrap?'is-wrapped':''} ${selected?'is-selected':''} ${active?'is-active':''} ${pinnedR?'frozen-row':''} ${pinnedC?'frozen-col':''}" data-ref="${ref}" role="gridcell" aria-selected="${selected}" style="top:${destination==='row'?y[r]-headerH:destination==='col'?y[r]-headerH-scrollTop:y[r]-headerH}px;left:${destination==='row'?x[c]-rowW-(pinnedC?0:scrollLeft):destination==='col'?x[c]-rowW:x[c]}px;width:${(bounds?x[bounds.c2+1]:x[c+1])-x[c]}px;height:${(bounds?y[bounds.r2+1]:y[r+1])-y[r]}px;${appearance}" title="${esc(ref)}">${val==='☐'||val==='☑'?`<button type="button" class="cell-checkbox" role="checkbox" data-action="checkbox-toggle" data-ref="${ref}" aria-label="Отметка ${ref}" aria-checked="${val==='☑'}" title="${val==='☑'?'Отмечено':'Отметить'}">${val==='☑'?'✓':''}</button>`:esc(val)}${action}</div>`;
  if(destination==='row')pinnedRowsHtml+=cellMarkup;
  else if(destination==='col')pinnedColsHtml+=cellMarkup;
  else html+=cellMarkup;
 }
 const rowOverlay=document.getElementById('grid-row-overlay'),colOverlay=document.getElementById('grid-col-overlay');
 let rowHtml='',colHtml='';
 for(const r of rows){if(!rowVisible(s,r))continue;const pinned=r<freezeR;
  rowHtml+=`<div class="rowhead ${pinned?'frozen-row':''} ${allSelection.some(a=>a.r1<=r&&r<=a.r2)?'header-selected':''} ${parseCell(activeCell)?.row===r?'header-active':''}" data-action="select-row" data-index="${r}" title="Выделить строку ${r+1}" style="top:${y[r]-headerH-(pinned?0:view.scrollTop)}px;left:0;width:${rowW}px;height:${y[r+1]-y[r]}px">${r+1}<span class="grid-resizer row-resizer" data-resize="row" data-index="${r}" title="Изменить высоту строки ${r+1}"></span></div>`;
 }
 for(const c of cols){if(!columnVisible(s,c))continue;const pinned=c<freezeC;
  colHtml+=`<div class="colhead ${pinned?'frozen-col':''} ${allSelection.some(a=>a.c1<=c&&c<=a.c2)?'header-selected':''} ${parseCell(activeCell)?.col===c?'header-active':''}" data-action="select-col" data-index="${c}" title="Выделить столбец ${cellName(0,c).replace(/\d+$/,'')}" style="top:0;left:${x[c]-rowW-(pinned?0:view.scrollLeft)}px;width:${x[c+1]-x[c]}px;height:${headerH}px">${esc(cellName(0,c).replace(/\d+$/,''))}<span class="grid-resizer col-resizer" data-resize="col" data-index="${c}" title="Потянуть для изменения ширины; двойной щелчок — автоподбор"></span></div>`;
 }
 rowOverlay.innerHTML=rowHtml;colOverlay.innerHTML=colHtml;
 canvas.innerHTML=html;
 const top=document.getElementById('grid-frozen-rows'),left=document.getElementById('grid-frozen-cols');
 if(top){top.style.height=`${y[freezeR]-headerH}px`;top.style.display=freezeR?'block':'none';
  if(!fromScroll||frozenRowScrollX!==view.scrollLeft||top.dataset.sheetId!==s.id){top.innerHTML=pinnedRowsHtml;frozenRowScrollX=view.scrollLeft;top.dataset.sheetId=s.id;}}
 if(left){left.style.width=`${x[freezeC]-rowW}px`;left.style.display=freezeC?'block':'none';left.innerHTML=pinnedColsHtml;}
 if(fillDrag)showFillDragPreview();
 refreshFillHandle();
}
// Selecting a row/column header by dragging should work like Excel.
let headerSelectionDrag=null,headerIgnoreClick=null;
function headerRange(axis,start,end){
 const lo=Math.min(start,end),hi=Math.max(start,end);
 return axis==='row'?
  [cellName(lo,0),cellName(hi,LIMITS.columns-1)]:
  [cellName(0,lo),cellName(LIMITS.rows-1,hi)];
}
app.addEventListener('pointerdown',e=>{
 if(e.button!==0||!sheet()||e.target.closest('.grid-resizer'))return;
 const header=e.target.closest('.rowhead,.colhead');
 if(!header)return;
 const axis=header.classList.contains('rowhead')?'row':'col',index=Number(header.dataset.index);
 if(!Number.isInteger(index))return;
 headerSelectionDrag={axis,start:index,end:index,moved:false,additive:e.ctrlKey||e.metaKey};
 // Prevent native text selection in the header; the regular click still selects one row/column.
 e.preventDefault();
},true);
window.addEventListener('pointermove',e=>{
 const drag=headerSelectionDrag;
 if(!drag||!(e.buttons&1)||!sheet())return;
 const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.rowhead,.colhead');
 if(!target||target.classList.contains('rowhead')!==(drag.axis==='row'))return;
 const index=Number(target.dataset.index);
 if(!Number.isInteger(index)||index===drag.end)return;
 drag.end=index;
 if(!drag.moved){
  drag.moved=true;
  const [a,b]=headerRange(drag.axis,drag.start,index);
  if(drag.additive)addSelection(a,b);
  else setSelection(a,b);
 }else{
  const [a,b]=headerRange(drag.axis,drag.start,index);
  setSelection(a,b,drag.additive);
 }
});
window.addEventListener('pointerup',()=>{
 if(headerSelectionDrag?.moved){
  headerIgnoreClick={axis:headerSelectionDrag.axis,until:performance.now()+120};
 }
 headerSelectionDrag=null;
});
window.addEventListener('pointercancel',()=>{headerSelectionDrag=null;});
app.addEventListener('click',async e=>{const target=e.target.closest('[data-action]');if(!target)return;const {action,id,value,ref,fn}=target.dataset;
 switch(action){case 'templates':templateKind=target.dataset.kind||'sheet';page='templates';render();break;case 'template-create':createBook(target.dataset.template==='new'?false:target.dataset.template);break;case 'select-row':{if(headerIgnoreClick?.axis==='row'&&performance.now()<headerIgnoreClick.until){headerIgnoreClick=null;break;}const index=Number(target.dataset.index),a=cellName(index,0),b=cellName(index,LIMITS.columns-1);if(e.ctrlKey||e.metaKey)addSelection(a,b);else setSelection(a,b);break;}case 'select-col':{if(headerIgnoreClick?.axis==='col'&&performance.now()<headerIgnoreClick.until){headerIgnoreClick=null;break;}const index=Number(target.dataset.index),a=cellName(0,index),b=cellName(LIMITS.rows-1,index);if(e.ctrlKey||e.metaKey)addSelection(a,b);else setSelection(a,b);break;}case 'select-all':setSelection('A1',cellName(LIMITS.rows-1,LIMITS.columns-1));break;case 'route':route(target.dataset.target);break;case 'new':createBook();break;case 'schedule':createBook('schedule');break;case 'example':createBook(true);break;case 'open':openBook(id);break;case 'clone':cloneBook(id);break;case 'rename-book':renameBookInline(id,target);break;case 'delete':removeBook(id);break;
 case 'import':document.querySelector('#file-picker')?.click();break;case 'open-disk':await openBookFromDisk();break;case 'backup':backup();break;case 'save':await saveBook();break;case 'save-as':await saveBook(true);break;
 case 'xlsx':if(book()){try{commitEditor();const data=await exportXLSX(book());download(`${safeFile(book().name)}.xlsx`,data,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');status('XLSX скачан: диаграммы, проверки данных, условное форматирование, области и параметры печати сохранены. Совместимость с Excel остаётся частичной; сохраните .qbook.');}catch(err){status(err.message||'Ошибка экспорта XLSX',true);}}break;
 case 'csv':if(sheet()){download(`${safeFile(book().name)}-${safeFile(sheet().name)}.csv`,'\uFEFF'+exportCSV(sheet(),book()),'text/csv;charset=utf-8');status('CSV скачан (текущий лист)');}break;
 case 'size-context-close':sizeContext=null;document.getElementById('size-context-menu')?.remove();break;
 case 'size-context-mode':if(sizeContext)openSizeContext(target.dataset.kind,parseCell(activeCell)?.[target.dataset.kind==='col'?'col':'row']??sizeContext.index,sizeContext.x,sizeContext.y);break;
 case 'size-context-apply':applyContextSize();break;
 case 'text-to-columns':case 'remove-duplicates':
  if(!requireSingleRange())break;
  commitEditor();chartDrawerOpen=false;conditionalPanelOpen=false;validationPanelOpen=false;printOpen=false;
  dataTool={kind:action==='text-to-columns'?'split':'dedup',from:activeCell,to:rangeEnd,
   delimiter:';',overwrite:false,header:true,key:'all'};render();break;
 case 'data-tool-close':dataTool=null;render();break;
 case 'data-tool-apply':{
  if(!dataTool)break;
  try{
   const t=dataTool,plan=t.kind==='split'?
    planTextToColumns(sheet(),t.from,t.to,{delimiter:t.delimiter,overwrite:t.overwrite}):
    planRemoveDuplicates(sheet(),t.from,t.to,{header:t.header,key:t.key});
   if(t.kind==='dedup'&&!plan.removed){dataTool=null;render();status('Повторов не найдено');break;}
   transact(()=>{if(t.kind==='split')applyTextToColumns(sheet(),plan);else applyRemoveDuplicates(sheet(),plan);validateWorkbook(book());});
   dataTool=null;render();status(t.kind==='split'?'Текст разделён по '+plan.cols+' столбцам':
    'Удалено повторов: '+plan.removed);
  }catch(err){render();status(err.message,true);}
  break;
 }
 case 'validation-open':chartDrawerOpen=false;conditionalPanelOpen=false;validationPanelOpen=true;render();break;
 case 'validation-close':validationPanelOpen=false;render();break;
 case 'validation-add':createValidationFromPanel();break;
 case 'validation-delete':try{transact(()=>deleteDataRule(sheet(),id));render();status('Проверка удалена');}catch(err){status(err.message,true);}break;
 case 'conditional-open':chartDrawerOpen=false;conditionalPanelOpen=true;render();break;
 case 'conditional-close':conditionalPanelOpen=false;render();break;
 case 'conditional-add':addSelectedCondition();break;
 case 'conditional-remove':try{transact(()=>removeConditionalRule(sheet(),id));render();status('Правило удалено');}catch(err){status(err.message,true);}break;
 case 'chart-bar':createSelectedChart('bar');break;case 'chart-stacked':createSelectedChart('stacked');break;case 'chart-stacked100':createSelectedChart('stacked100');break;case 'chart-line':createSelectedChart('line');break;case 'chart-scatter':createSelectedChart('scatter');break;case 'chart-pie':createSelectedChart('pie');break;
 case 'charts-open':chartDrawerOpen=true;render();break;
 case 'chart-close':chartDrawerOpen=false;render();break;
 case 'chart-open':selectedChartId=id;chartDrawerOpen=true;render();break;
 case 'chart-type':try{transact(()=>changeChart(sheet(),selectedChartId,{type:target.dataset.type}));render();}catch(err){status(err.message,true);}break;
 case 'chart-source':{const value=document.getElementById('chart-range')?.value.trim().replaceAll('$','').toUpperCase();
  const match=/^([A-Z]+[1-9]\d*):([A-Z]+[1-9]\d*)$/.exec(value||'');
  if(!match){status('Введите диапазон из 2–5 соседних столбцов, например A1:D6',true);break;}
  try{transact(()=>changeChart(sheet(),selectedChartId,{from:match[1],to:match[2]}));render();status('Источник диаграммы изменён');}
  catch(err){status(err.message,true);}break;}
 case 'chart-use-selection':try{const source=suggestChartRange(sheet(),activeCell,rangeEnd,(sheet().charts||[]).find(c=>c.id===selectedChartId)?.type||'bar');
  transact(()=>changeChart(sheet(),selectedChartId,{from:source.from,to:source.to}));render();status('Источник диаграммы привязан к выделению');}
  catch(err){status(err.message,true);}break;
 case 'chart-axis-save':{
  const read=id=>{const value=document.getElementById(id)?.value?.trim()||'';return value===''?null:Number(value);};
  try{transact(()=>changeChart(sheet(),selectedChartId,{options:{min:read('chart-axis-min'),max:read('chart-axis-max')}}));render();status('Границы осей обновлены');}
  catch(err){status(err.message,true);}break;
 }
 case 'chart-style-reset':try{transact(()=>changeChart(sheet(),selectedChartId,{options:{
  labels:false,legend:(sheet().charts||[]).find(c=>c.id===selectedChartId)?.type==='pie'?'right':'bottom',
  grid:true,min:null,max:null,colors:[],trendline:false,trendEquation:false,trendR2:false,trendType:'linear'}}));render();status('Оформление сброшено');}
  catch(err){status(err.message,true);}break;
 case 'chart-delete':try{transact(()=>removeChart(sheet(),selectedChartId));selectedChartId=(sheet().charts||[])[0]?.id||null;render();status('Диаграмма удалена');}catch(err){status(err.message,true);}break;
 case 'print-open':commitEditor();printOpen=true;render();break;
 case 'print-close':printOpen=false;render();break;
 case 'print-use-selection':printSettingChange({area:selectedPrintArea(activeCell,rangeEnd)});break;
 case 'print-use-used':printSettingChange({area:null});break;
 case 'print-now':printNow();break;
 case 'ribbon':activeRibbon=target.dataset.target;activePalette=null;borderMenuOpen=false;render();break;case 'sort-asc':sortRange('asc');break;case 'sort-desc':sortRange('desc');break;case 'find-open':showSearch();break;case 'find-close':showFind=false;render();break;case 'find-next':nextMatch();break;case 'replace-all':replaceAll();break;case 'undo':undo();break;case 'redo':redo();break;case 'clear':clearSelected();break;case 'clear-format':clearSelectedFormat();break;case 'autosum':autoSum();break;case 'fill-down':fillSelected('down');break;case 'fill-up':fillSelected('up');break;case 'fill-right':fillSelected('right');break;case 'fill-left':fillSelected('left');break;
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
 case 'insert-checkbox':insertCheckboxes();break;case 'checkbox-toggle':e.preventDefault();toggleCellCheckbox(ref);break;
 case 'merge-cells':updateMerge('merge');break;case 'unmerge-cells':updateMerge('unmerge');break;
 case 'border-all':setCellBorders('all');break;case 'border-none':setCellBorders('none');break;case 'wrap':toggleWrap();break;
 case 'bold':applyStyle({bold:!getEffectiveStyle(sheet(),activeCell).bold});break;case 'italic':applyStyle({italic:!getEffectiveStyle(sheet(),activeCell).italic});break;
 case 'underline':applyStyle({underline:!getEffectiveStyle(sheet(),activeCell).underline});break;
 case 'strike':applyStyle({strike:!getEffectiveStyle(sheet(),activeCell).strike});break;
 case 'valign':applyStyle({verticalAlign:value});break;case 'align':applyStyle({align:value});break;case 'format':applyStyle({format:value});break;
 case 'formula-fn':{const p=parseCell(activeCell);const from=p.row>0?cellName(0,p.col):cellName(1,p.col),to=p.row>0?cellName(p.row-1,p.col):cellName(9,p.col);const field=document.querySelector('#formula-input');if(field){field.value=`=${fn}(${from}:${to})`;field.focus();status('Проверьте диапазон, затем нажмите Enter');}break;}
 case 'copy':await copySelection();break;case 'paste-values':pasteOnlyValues();break;case 'goto':setSelection(ref);ensureVisible(parseCell(ref).row,parseCell(ref).col);break;
 case 'hide-row':visibilityAction('row',false);break;case 'show-rows':visibilityAction('row',true);break;case 'hide-col':visibilityAction('col',false);break;case 'show-cols':visibilityAction('col',true);break;
 case 'insert-row':structuralAction('row','insert');break;case 'delete-row':structuralAction('row','delete');break;case 'insert-col':structuralAction('col','insert');break;case 'delete-col':structuralAction('col','delete');break;
 case 'sheet-add':addSheet();break;case 'sheet-rename':renameSheet();break;case 'sheet-delete':deleteSheet();break;case 'sheet-select':if(e.detail>=2){renameSheet(id);break;}if(book().activeSheetId===id)break;commitEditor();book().activeSheetId=id;changed();setSelection('A1');render();break;
 }});
app.addEventListener('contextmenu',e=>{
 const header=e.target.closest('.rowhead,.colhead'),cell=e.target.closest('.grid-cell'),corner=e.target.closest('#grid-corner');
 if(!header&&!cell&&!corner)return; // keep browser context menu outside the spreadsheet grid
 e.preventDefault();e.stopPropagation();
 if(corner){setSelection('A1',cellName(LIMITS.rows-1,LIMITS.columns-1));openSizeContext('cell',0,e.clientX,e.clientY);return;}
 if(header){
  const kind=header.classList.contains('colhead')?'col':'row',index=Number(header.dataset.index);
  const fullSelected=selectedRects().some(r=>kind==='col'?
   r.r1===0&&r.r2===LIMITS.rows-1&&index>=r.c1&&index<=r.c2:
   r.c1===0&&r.c2===LIMITS.columns-1&&index>=r.r1&&index<=r.r2);
  if(!fullSelected)kind==='col'?setSelection(cellName(0,index),cellName(LIMITS.rows-1,index)):
   setSelection(cellName(index,0),cellName(index,LIMITS.columns-1));
  openSizeContext(kind,index,e.clientX,e.clientY);
 }else{
  const ref=cell.dataset.ref;
  if(!inAnySelection(parseCell(ref).row,parseCell(ref).col))setSelection(ref);
  openSizeContext('cell',0,e.clientX,e.clientY);
 }
},true);
app.addEventListener('pointerdown',e=>{
 if(sizeContext&&!e.target.closest('#size-context-menu')&&!e.target.closest('.rowhead,.colhead,.grid-cell')){
  sizeContext=null;document.getElementById('size-context-menu')?.remove();
 }
},true);
app.addEventListener('pointerdown',e=>{
 if(e.button!==0||!e.target.closest('#grid-fill-handle')||!sheet())return;
 e.preventDefault();e.stopPropagation();commitEditor();
 const rects=selectedRects();if(rects.length!==1)return;
 fillDrag={source:rects[0],sheetId:sheet().id,direction:null,target:null,area:null,pointerX:e.clientX,pointerY:e.clientY};
 startFillAutoScroll();
 mouseSelecting=false;document.body.classList.add('is-fill-dragging');
 document.getElementById('grid-fill-handle').hidden=true;
},true);
window.addEventListener('pointermove',e=>{if(fillDrag){fillDrag.pointerX=e.clientX;fillDrag.pointerY=e.clientY;fillDragTargetAt(e.clientX,e.clientY);}});
window.addEventListener('pointerup',()=>endFillDrag(true));
window.addEventListener('pointercancel',()=>endFillDrag(false));
app.addEventListener('pointerdown',startChartPointerDrag,true);
window.addEventListener('pointermove',previewChartPointerDrag);
window.addEventListener('pointerup',()=>finishChartPointerDrag(true));
window.addEventListener('pointercancel',()=>finishChartPointerDrag(false));
app.addEventListener('pointerdown',e=>{if(e.target.closest('.ribbon-color'))recordColorSelection();},true);
app.addEventListener('pointerdown',e=>{if((activePalette||borderMenuOpen)&&!e.target.closest('.format-popover,[data-action=fill-palette],[data-action=text-palette],[data-action=border-menu]')){activePalette=null;borderMenuOpen=false;document.querySelectorAll('.format-popover').forEach(el=>el.remove());}},true);
app.addEventListener('focusin',e=>{if(e.target?.matches?.('input[type=color]')&&!pendingColorSelection)recordColorSelection();});
app.addEventListener('input',e=>{if(e.target.id==='find-term')searchTerm=e.target.value;else if(e.target.id==='replace-term')replaceTerm=e.target.value;});
app.addEventListener('change',e=>{const t=e.target;if(t.id==='font-family-select'){if(FONT_FAMILIES.includes(t.value))applyStyle({fontFamily:t.value});return;}
 if(t.id==='font-size-select'){const value=Number(t.value);if(Number.isInteger(value)&&value>=6&&value<=72)applyStyle({fontSize:value});return;}

 if(dataTool&&['data-tool-delimiter','data-tool-overwrite','data-tool-header','data-tool-key'].includes(t.id)){
  if(t.id==='data-tool-delimiter')dataTool.delimiter=t.value;
  if(t.id==='data-tool-overwrite')dataTool.overwrite=t.checked;
  if(t.id==='data-tool-header')dataTool.header=t.checked;
  if(t.id==='data-tool-key')dataTool.key=t.value;
  render();return;
 }
 if(['chart-labels','chart-legend','chart-grid','chart-trendline','chart-trend-equation','chart-trend-r2','chart-trend-type'].includes(t.id)||t.dataset.chartColor!==undefined){
  const patch=t.id==='chart-labels'?{labels:t.checked}:t.id==='chart-legend'?{legend:t.value}:
   t.id==='chart-grid'?{grid:t.checked}:
   t.id==='chart-trendline'?{trendline:t.checked}:
   t.id==='chart-trend-equation'?{trendEquation:t.checked}:
   t.id==='chart-trend-r2'?{trendR2:t.checked}:
   t.id==='chart-trend-type'?{trendType:t.value}:(()=>{const chart=(sheet()?.charts||[]).find(c=>c.id===selectedChartId),range=rectangle(chart.from,chart.to),colors=Array.from({length:range.c2-range.c1},(_,i)=>chartOptions(chart).colors[i]||CHART_COLORS[i]);
     colors[Number(t.dataset.chartColor)]=t.value;return {colors};})();
  try{transact(()=>changeChart(sheet(),selectedChartId,{options:patch}));render();}
  catch(err){status(err.message,true);}return;
 }
 if(t.id==='print-paper'){printSettingChange({paper:t.value});return;}if(t.id==='print-orientation'){printSettingChange({orientation:t.value});return;}if(t.id==='print-scale'){printSettingChange({scale:Number(t.value)});return;}if(t.id==='print-fit'){printSettingChange({fitWidth:t.checked});return;}if(t.id==='validation-cell-select'){try{transact(()=>setTypedCell(sheet(),activeCell,t.value));setSelection(activeCell);status('Значение выбрано из списка');}catch(err){status(err.message,true);}return;}if(t.id==='validation-kind'){document.getElementById('validation-list-row').hidden=t.value!=='list';document.getElementById('validation-number-row').hidden=t.value!=='number';return;}if(t.id==='cf-kind'){document.getElementById('cf-threshold-label').hidden=t.value==='scale';document.getElementById('cf-color-label').hidden=t.value==='scale';return;}if(t.id==='chart-title'){try{transact(()=>changeChart(sheet(),selectedChartId,{title:t.value}));render();}catch(err){status(err.message,true);}return;}if(t.id==='find-term'){searchTerm=t.value;}else if(t.id==='replace-term'){replaceTerm=t.value;}else if(t.id==='file-picker'){importFile(t.files?.[0]);t.value='';}else if(t.id==='book-name'){if(!book())return;const next=t.value.trim();if(next){transact(()=>{book().name=next});}else t.value=book().name;}else if(t.id==='text-color'){applySelectedColor('color',t.value);}else if(t.id==='fill-color'){applySelectedColor('bg',t.value);}else if(t.id==='palette-custom-color'){applySelectedColor(activePalette,t.value);activePalette=null;render();document.getElementById('grid-scroll')?.focus({preventScroll:true});}else if(t.id==='formula-input'){try{transact(()=>setTypedCell(sheet(),activeCell,t.value));drawGrid();setSelection(activeCell);}catch(err){status(err.message||'Недопустимое значение',true);t.value=getCell(sheet(),activeCell).value;}}});
app.addEventListener('keydown',e=>{if(e.target.id==='size-context-number'&&e.key==='Enter'){e.preventDefault();applyContextSize();return;}if(e.target.id==='size-context-number'&&e.key==='Escape'){e.preventDefault();sizeContext=null;document.getElementById('size-context-menu')?.remove();return;}if(e.target.id==='find-term'&&e.key==='Enter'){e.preventDefault();nextMatch();return;}if(e.target.id==='name-box'&&e.key==='Enter'){e.preventDefault();const val=e.target.value.toUpperCase().replaceAll('$',''),match=/^([A-Z]+[1-9]\d*)(?::([A-Z]+[1-9]\d*))?$/.exec(val);if(match&&parseCell(match[1])?.row<LIMITS.rows&&parseCell(match[1])?.col<LIMITS.columns&&rowVisible(sheet(),parseCell(match[1]).row)&&columnVisible(sheet(),parseCell(match[1]).col)){setSelection(match[1],match[2]&&parseCell(match[2])?.row<LIMITS.rows&&parseCell(match[2])?.col<LIMITS.columns?match[2]:match[1]);const p=parseCell(match[1]);ensureVisible(p.row,p.col);e.target.blur();document.getElementById('grid-scroll')?.focus({preventScroll:true});}else status('Неверный адрес ячейки',true);}if(e.target.id==='formula-input'&&e.key==='Enter'){e.target.blur();}});
app.addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-resize]');if(!handle||e.button!==0||!sheet())return;e.preventDefault();e.stopPropagation();commitEditor();mouseSelecting=false;
 const axis=handle.dataset.resize,index=Number(handle.dataset.index);resizeDrag={axis,index,start:axis==='col'?e.clientX:e.clientY,original:axis==='col'?columnWidth(sheet(),index):rowHeight(sheet(),index),value:null,sheetId:sheet().id};document.body.classList.add('is-resizing');});
window.addEventListener('pointermove',e=>{if(!resizeDrag||!sheet()||sheet().id!==resizeDrag.sheetId)return;const d=resizeDrag;const offset=(d.axis==='col'?e.clientX:e.clientY)-d.start;const min=d.axis==='col'?DIMENSIONS.minColumn:DIMENSIONS.minRow,max=d.axis==='col'?DIMENSIONS.maxColumn:DIMENSIONS.maxRow;const next=Math.min(max,Math.max(min,Math.round(d.original+offset)));
 if(d.value===next)return;d.value=next;if(d.axis==='col')setColumnWidth(sheet(),d.index,next);else setRowHeight(sheet(),d.index,next);drawGrid();});
window.addEventListener('pointerup',()=>{if(!resizeDrag)return;const d=resizeDrag;resizeDrag=null;document.body.classList.remove('is-resizing');if(!sheet()||sheet().id!==d.sheetId)return;
 if(d.axis==='col')setColumnWidth(sheet(),d.index,d.original);else setRowHeight(sheet(),d.index,d.original);
 if(d.value!==null&&d.value!==d.original){transact(()=>{if(d.axis==='col')setColumnWidth(sheet(),d.index,d.value);else setRowHeight(sheet(),d.index,d.value);});status(`Размер: ${d.value} px`);}drawGrid();});
window.addEventListener('pointercancel',()=>{if(!resizeDrag)return;const d=resizeDrag;resizeDrag=null;document.body.classList.remove('is-resizing');if(sheet()?.id===d.sheetId){if(d.axis==='col')setColumnWidth(sheet(),d.index,d.original);else setRowHeight(sheet(),d.index,d.original);drawGrid();}});
app.addEventListener('dblclick',e=>{const handle=e.target.closest('[data-resize]');if(!handle)return;e.preventDefault();e.stopPropagation();if(handle.dataset.resize==='col')autoFitColumn(Number(handle.dataset.index));else resetRowHeight(Number(handle.dataset.index));},true);
app.addEventListener('mousedown',e=>{if(e.button!==0)return;const cell=e.target.closest('.grid-cell');if(cell){if(e.target.closest('.filter-head,.cell-checkbox'))return;e.preventDefault();const ref=cell.dataset.ref;window.getSelection()?.removeAllRanges();const additive=e.ctrlKey||e.metaKey,alreadySelected=additive&&inAnySelection(parseCell(ref).row,parseCell(ref).col);
 if(additive)toggleCellSelection(ref);else setSelection(e.shiftKey?activeCell:ref,ref);
 if(e.detail>=2&&!additive){mouseSelecting=false;editCell();}
 else{mouseSelecting=!additive||!alreadySelected;document.getElementById('grid-scroll')?.focus({preventScroll:true});}}});
app.addEventListener('mouseover',e=>{if(!mouseSelecting)return;const cell=e.target.closest('.grid-cell');if(cell&&cell.dataset.ref!==rangeEnd)setSelection(activeCell,cell.dataset.ref,true);});
window.addEventListener('mouseup',()=>{mouseSelecting=false;});
app.addEventListener('dblclick',e=>{const cell=e.target.closest('.grid-cell');if(cell){if(e.target.closest('.filter-head,.cell-checkbox'))return;setSelection(cell.dataset.ref);editCell();}});
function captureSelection(){if(!requireSingleRange())return null;if(!sheet()||refuseHiddenSelection())return null;const rect=rectangle(activeCell,rangeEnd);if(rect&&(rect.r2-rect.r1+1)*(rect.c2-rect.c1+1)>10000){status('Копирование ограничено 10 000 ячеек',true);return null;}try{internalClipboard=copyCells(sheet(),activeCell,rangeEnd,book());return internalClipboard;}catch(error){status(error.message,true);return null;}}
async function cutSelection(){
 const clip=captureSelection();if(!clip)return false;
 clip.mode='cut';clip.bookId=book().id;clip.sheetId=sheet().id;
 internalClipboard=clip;
 try{await navigator.clipboard.writeText(clip.text);}catch{/* Retain internal clipboard without a browser permission */}
 status('Вырезано: исходные ячейки сохраняются до успешной вставки Ctrl+V');
 return true;
}
async function copySelection(){const clip=captureSelection();if(!clip)return false;
 try{await navigator.clipboard.writeText(clip.text);status('Скопировано');}catch{status('Скопировано внутри Quantum Sheets (буфер браузера недоступен)');}
 return true;}
function pasteOnlyValues(){
 if(!requireSingleRange())return false;
 if(!sheet())return false;
 if(!internalClipboard){status('Сначала скопируйте диапазон через Ctrl+C',true);return false;}
 if(refuseHiddenSelection())return false;
 try{
  let info;
  transact(()=>{info=pasteValuesCells(sheet(),activeCell,internalClipboard,book());});
  setSelection(activeCell,info.end);
  status(`Вставлены только значения: ${info.rows} × ${info.cols}`);return true;
 }catch(error){status(error.message||'Вставка значений отменена',true);return false;}
}
function pasteIntoCells(text,clip=null){if(!requireSingleRange())return false;if(!sheet()||refuseHiddenSelection())return false;
 try{
  if(!clip&&typeof text!=='string')throw Error('Буфер обмена пуст');
  if(!clip&&text.length===0)throw Error('Буфер обмена пуст');
  let info;const moving=clip?.mode==='cut';
  transact(()=>{info=moving?moveCells(book(),sheet(),activeCell,clip):clip?pasteCells(sheet(),activeCell,clip):pasteTSV(sheet(),activeCell,text);});
  if(moving)internalClipboard=null;
  setSelection(activeCell,info.end);status(moving?`Перемещено: ${info.rows} × ${info.cols}`:`Вставлено: ${info.rows} × ${info.cols}`);return true;
 }catch(error){status(error.message||'Вставка не выполнена',true);return false;}
}
// Clipboard events handle external data. In-app keyboard copy/paste also works on file:// without Clipboard API permissions.
window.addEventListener('copy',e=>{
 if(page!=='sheet'||editing||e.target?.matches?.('input,textarea,[contenteditable]')){internalClipboard=null;return;}
 const clip=captureSelection();if(!clip)return;
 if(e.clipboardData){e.preventDefault();e.clipboardData.setData('text/plain',clip.text);status('Скопировано');}
});
window.addEventListener('cut',e=>{
 if(page!=='sheet'||editing||e.target?.matches?.('input,textarea,[contenteditable]'))return;
 e.preventDefault();cutSelection();
 if(e.clipboardData&&internalClipboard?.mode==='cut')e.clipboardData.setData('text/plain',internalClipboard.text);
});
window.addEventListener('paste',e=>{
 if(page!=='sheet'||editing||e.target?.matches?.('input,textarea,[contenteditable]'))return;
 const text=e.clipboardData?.getData('text/plain');if(text===undefined)return;e.preventDefault();
 const clip=internalClipboard&&(text===internalClipboard.text||text==='')?internalClipboard:null;
 pasteIntoCells(text,clip);
});
// Copying in other windows invalidates a stale private clipboard; external paste stays native.
window.addEventListener('blur',()=>{internalClipboard=null;});
window.addEventListener('keydown',e=>{if(page!=='sheet'||!sheet())return;
 const t=e.target,form=t?.matches('input,textarea,[contenteditable]');
 // KeyboardEvent.key is layout dependent: physical Ctrl+Z may report "я"
 // on Russian keyboards. KeyboardEvent.code remains KeyZ / KeyY.
 const shortcut=(latin,code)=>e.code===code||e.key?.toLowerCase()===latin;
 // Preserve native text undo ONLY for a cell editor or actively modified input.
 const textEdit=!!editing||!!(form&&!t?.matches('#name-box,input[type=color]')&&
   !(t?.id==='formula-input'&&t.value===getCell(sheet(),activeCell).value));

 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'){e.preventDefault();showSearch();return;}
 if((e.ctrlKey||e.metaKey)&&shortcut('s','KeyS')){e.preventDefault();saveBook(e.shiftKey);return;}
 if((e.ctrlKey||e.metaKey)&&shortcut('z','KeyZ')&&!textEdit){e.preventDefault();if(e.shiftKey)redo();else undo();return;}
 if((e.ctrlKey||e.metaKey)&&shortcut('y','KeyY')&&!textEdit){e.preventDefault();redo();return;}
 if((e.ctrlKey||e.metaKey)&&shortcut('d','KeyD')&&!form){e.preventDefault();fillSelected('down');return;}
 if((e.ctrlKey||e.metaKey)&&shortcut('r','KeyR')&&!form){e.preventDefault();fillSelected('right');return;}
 if(form)return;
 if(e.altKey&&(e.key==='='||e.code==='Equal')){e.preventDefault();autoSum();return;}
 if((e.ctrlKey||e.metaKey)&&(e.key.toLowerCase()==='c'||e.code==='KeyC')){e.preventDefault();copySelection();return;}
 if((e.ctrlKey||e.metaKey)&&e.shiftKey&&shortcut('v','KeyV')){e.preventDefault();pasteOnlyValues();return;}
 if((e.ctrlKey||e.metaKey)&&(e.key.toLowerCase()==='v'||e.code==='KeyV')&&internalClipboard){e.preventDefault();pasteIntoCells(null,internalClipboard);return;}
 if((e.ctrlKey||e.metaKey)&&shortcut('x','KeyX')){e.preventDefault();cutSelection();return;}
 if(e.key==='Backspace'||e.key==='Delete'){e.preventDefault();clearSelected();return;}
 if(e.key==='F2'){e.preventDefault();editCell();return;}
 const steps={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1],Tab:[0,e.shiftKey?-1:1],Enter:[e.shiftKey?-1:1,0]};
 if(steps[e.key]){e.preventDefault();moveSelection(...steps[e.key],e.shiftKey&&e.key.startsWith('Arrow'));return;}
 if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();editCell(e.key);}
});
window.addEventListener('beforeunload',()=>{if(editing)commitEditor();});
render();
