import {PHOTO_DEFAULTS,photoFilter,photoCrop,rotatePoint,validateStudioProject} from './core/studio-model.js';
import {addChart,chartData,chartSVG,changeChart,removeChart,suggestChartRange,chartLayout,CHART_MIN_WIDTH,CHART_MIN_HEIGHT,chartOptions,CHART_COLORS,linearRegression,regressionLabel,quadraticRegression,quadraticLabel} from './core/charts.js';
import {addConditionalRule,removeConditionalRule,prepareConditionalScales,conditionalFill} from './core/conditional.js';
import {addDataRule,deleteDataRule,validationAt} from './core/validation.js';
import {printSettings,changePrintSettings,selectedPrintArea,planPrint,printHTML} from './core/printing.js';
import {smartTableRange,createSmartTable,appendSmartTableRow,extendSmartTableAfterEntry,removeSmartTable,cellHyperlink,setHyperlink,removeHyperlink,filterConditionMatches,validFilterRule,newWorkbook,newSheet,currentSheet,getCell,setCell,setTypedCell,setStyle,refsBetween,rectangle,referencedFromOtherSheet,displayedValue,valuesTSV,pasteTSV,importCSV,exportCSV,validateWorkbook,createExample,createScheduleTemplate,createJournalTemplate,createBudgetTemplate,cellName,parseCell,LIMITS,fillSelection,fillTypedSelection,fillTypedAreas,fillAreasDirection,extendFillHandle,resultOf,sortSelectedRows,findCells,replaceAllText,clearFormatting,clearCellValues,planAutoSum,filterRange,filterRowVisible,setFreeze,setAutoFilter,setFilterValue,gridGeometry,firstVisibleIndex,columnWidth,rowHeight,setColumnWidth,setRowHeight,DIMENSIONS,rowVisible,columnVisible,setHidden,showAllHidden,mergeAt,mergeCells,unmergeCells,applyBorderPreset,setWholeSheetAlignment,setBulkColumnStyle,setRectangleStyle,getEffectiveStyle,resolveBorderSide,invalidateGridGeometry,FONT_FAMILIES } from './core/workbook.js';
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
const FONT_TOP=['Arial','Calibri','Segoe UI','Times New Roman','Verdana'];
const FONT_OTHERS=FONT_FAMILIES.filter(name=>!FONT_TOP.includes(name)).sort((a,b)=>a.localeCompare(b,'ru',{sensitivity:'base'}));
const qoReadSetting=(key,fallback)=>{try{const value=localStorage.getItem(key);return value===null?fallback:JSON.parse(value);}catch{return fallback;}};
const qoWriteSetting=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
let fontDropdownOpen=false;
let lastFontSelected=qoReadSetting('quantum-office-last-font-v2',null);
let recentColors=qoReadSetting('quantum-office-recent-colors-v2',[]);
if(!Array.isArray(recentColors))recentColors=[];
recentColors=recentColors.filter(c=>typeof c==='string'&&/^#[a-f0-9]{6}$/i.test(c)).slice(0,10);
const rememberColor=color=>{const c=String(color||'').toUpperCase();if(!/^#[0-9A-F]{6}$/.test(c))return;
 recentColors=[c,...recentColors.filter(x=>x.toUpperCase()!==c)].slice(0,10);
 qoWriteSetting('quantum-office-recent-colors-v2',recentColors);
};
function qoFontMenu(){if(!fontDropdownOpen||activeRibbon!=='home')return '';
 const chosen=getEffectiveStyle(sheet(),activeCell).fontFamily||'Aptos';
 const fontRow=name=>'<button type="button" role="option" class="font-item'+(name===chosen?' selected':'')+'" aria-selected="'+(name===chosen)+'" data-action="font-pick" data-value="'+esc(name)+'" title="'+esc(name)+'"><span class="font-sample" style="font-family:\''+esc(name)+'\',sans-serif">'+esc(name)+'</span>'+(chosen===name?'<span class="font-check">✓</span>':'')+'</button>';
 const last=FONT_FAMILIES.includes(lastFontSelected)?lastFontSelected:null;
 const remainder=FONT_OTHERS.filter(name=>name!==last);
 return '<div class="font-menu" role="listbox" aria-label="Выбор шрифта"><div class="font-menu-title">Шрифт <button data-action="font-menu-close" aria-label="Закрыть список шрифтов">×</button></div>'+
 '<div class="font-menu-scroll"><div class="font-section-title">Популярные</div>'+FONT_TOP.map(fontRow).join('')+
 '<div class="font-menu-divider"></div><div class="font-section-title">Последний выбранный</div>'+(last?fontRow(last):'<div class="font-menu-hint">Шрифт ещё не выбран</div>')+
 '<div class="font-menu-divider"></div><div class="font-section-title">Все шрифты · по алфавиту</div>'+remainder.map(fontRow).join('')+'</div>'+
 '<div class="font-menu-foot">Вид шрифта зависит от наличия гарнитуры в системе</div></div>';
}
function qoPickFont(name){if(!FONT_FAMILIES.includes(name))return;
 lastFontSelected=name;qoWriteSetting('quantum-office-last-font-v2',name);
 fontDropdownOpen=false;applyStyle({fontFamily:name});render();
}

let scrollLeft=0,scrollTop=0,undoStacks=new Map(),redoStacks=new Map(),statusMessage='',storeWarning=false;
const directFiles=new Map(),dirtyFiles=new Set(),savingBooks=new Set();
let searchTerm='',replaceTerm='',findIndex=-1,showFind=false;
let resizeDrag=null, filterColumn=null;
let internalClipboard=null;
let chartDrawerOpen=false,selectedChartId=null,chartDrag=null;
let smartTableHelpOpen=false;
let linkEditorRef=null;
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
function changed(){if(book()){book().updated=dateNow();dirtyFiles.add(book().id);}syncHistoryButtons();persist();if(page==='sheet'){if(chartDrawerOpen)refreshChartPreview();refreshSheetCharts();}}
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
function syncHistoryButtons(){const id=book()?.id;for(const [action,stack] of [['undo',undoStacks],['redo',redoStacks]]){for(const el of document.querySelectorAll('.ribbon [data-action="'+action+'"]')){const available=!!id&&(stack.get(id)?.length||0)>0;el.disabled=!available;el.setAttribute('aria-disabled',String(!available));}}}
function undo(){return replaceBook(undoStacks,redoStacks,'undo');}
function redo(){return replaceBook(redoStacks,undoStacks,'redo');}
function route(target){if(page==='writer')qoPersistWriter();if(page==='slides')qoPersistSlides();commitEditor();if(target==='home'){page='home';render();return;}if(target==='sheet'){page='sheet';if(!book()){if(!workspace.books.length){createBook();return;}workspace.active=workspace.books[0].id;}render();return;}page=target;render();}
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
   transact(()=>{sheet().cells=draft.cells;sheet().hyperlinks=draft.hyperlinks||{};});drawGrid();updateSelectionStats();status('Очищено: '+count+' ячеек');return;
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
 const oneDecimal=n=>new Intl.NumberFormat('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:1}).format(Math.round((n+Number.EPSILON)*10)/10);
 node.textContent=count?prefix+'Чисел: '+count+' · Сумма: '+oneDecimal(sum)+
  ' · Среднее: '+oneDecimal(sum/count):prefix+'Выделено: '+visited.size;
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
function qoApplyPaletteKeepOpen(kind,value){
 const el=document.querySelector('#grid-frame > .palette-popover .palette-body');
 const priorScroll=el?.scrollTop||0;
 if(value!==undefined)rememberColor(value);
 applySelectedColor(kind,value);
 // Keep a fresh selection snapshot after the write, but never let a stale one leak to another book.
 recordColorSelection();
 render();
 const next=document.querySelector('#grid-frame > .palette-popover .palette-body');
 if(next)next.scrollTop=priorScroll;
}

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
const QO_THEME_BASE=['#27313A','#111827','#4B505A','#183D56','#2B5589','#8A3034','#47702F','#633E80','#21677F','#A24C26'];
const QO_STANDARD=['#FFFFFF','#000000','#C00000','#FF0000','#FFC000','#FFFF00','#92D050','#00B050','#00B0F0','#0070C0','#002060','#7030A0'];
function qoMixColor(a,b,t){const x=a.slice(1),y=b.slice(1);const v=i=>Math.round(parseInt(x.slice(i,i+2),16)*(1-t)+parseInt(y.slice(i,i+2),16)*t);
 return '#'+[0,2,4].map(i=>v(i).toString(16).padStart(2,'0')).join('').toUpperCase();}
const QO_THEME=[QO_THEME_BASE,...[.2,.37,.54,.70,.83].map(t=>QO_THEME_BASE.map(c=>qoMixColor(c,'#FFFFFF',t)))];
let paletteExpanded=false;
let paletteHue=165,paletteSat=70,paletteVal=80;
function qoColorHex(){return qoHSVtoHex(paletteHue,paletteSat,paletteVal);}
function qoHSVtoHex(h,s,v){const hh=((h%360)+360)%360,ss=Math.max(0,Math.min(100,s))/100,vv=Math.max(0,Math.min(100,v))/100;
 const c=vv*ss,x=c*(1-Math.abs(hh/60%2-1)),m=vv-c;let z;
 if(hh<60)z=[c,x,0];else if(hh<120)z=[x,c,0];else if(hh<180)z=[0,c,x];else if(hh<240)z=[0,x,c];else if(hh<300)z=[x,0,c];else z=[c,0,x];
 return '#'+z.map(q=>Math.round((q+m)*255).toString(16).padStart(2,'0')).join('').toUpperCase();}
function qoHexHSV(hex){const c=hex.replace('#','');if(!/^[a-f\d]{6}$/i.test(c))return null;
 const [r,g,b]=[0,2,4].map(i=>parseInt(c.slice(i,i+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
 let h=0;if(d){if(max===r)h=60*((g-b)/d%6);else if(max===g)h=60*((b-r)/d+2);else h=60*((r-g)/d+4);}return [((h%360)+360)%360,max===0?0:d/max*100,max*100];}
function qoSetCustomColor(hex){const value=String(hex||'').trim(),valid=/^#[0-9a-fA-F]{6}$/.test(value);
 if(!valid)return false;
 const hsv=qoHexHSV(value);[paletteHue,paletteSat,paletteVal]=hsv;return true;}
function qoColorPickerPreview(){const color=qoColorHex();const zone=document.getElementById('palette-sv');if(zone){zone.style.backgroundColor='hsl('+paletteHue+',100%,50%)';}
 const dot=document.getElementById('palette-sv-dot');if(dot){dot.style.left=paletteSat+'%';dot.style.top=(100-paletteVal)+'%';}
 const input=document.getElementById('palette-hex');if(input)input.value=color;
 const sw=document.getElementById('palette-selected-preview');if(sw)sw.style.backgroundColor=color;
 const label=document.getElementById('palette-result');if(label)label.textContent=color;
 const hue=document.getElementById('palette-hue');if(hue)hue.value=String(paletteHue);
}
function qoPaletteSVAt(x,y){const el=document.getElementById('palette-sv');if(!el)return;
 const r=el.getBoundingClientRect();paletteSat=Math.round(100*Math.max(0,Math.min(1,(x-r.left)/r.width)));
 paletteVal=Math.round(100*(1-Math.max(0,Math.min(1,(y-r.top)/r.height))));qoColorPickerPreview();}
let qoPalettePointer=null;
function qoPaletteSwatch(color,label=''){const normalized=color.toUpperCase(),style=getEffectiveStyle(sheet(),activeCell),selected=(style?.[activePalette]||'').toUpperCase()===normalized;
 return '<button type="button" class="palette-swatch'+(selected?' selected':'')+'" data-action="palette-pick" data-value="'+normalized+'" aria-label="'+(label||normalized)+'" title="'+(label||normalized)+'" style="background-color:'+normalized+'">'+(selected?'<span aria-hidden="true" class="palette-swatch-mark">✓</span>':'')+'</button>';}
function palettePopup(){if(!activePalette)return '';
 const kind=activePalette==='bg'?'Цвет заливки':'Цвет текста';
 const theme=QO_THEME.map(row=>'<div class="palette-theme-row">'+row.map(c=>qoPaletteSwatch(c)).join('')+'</div>').join('');
 return '<div class="format-popover palette-popover'+(chartDrawerOpen?' palette-avoid-chart':'')+'" role="dialog" aria-label="'+kind+'" data-popup="palette">'+
 '<div class="popup-header"><strong>'+kind+'</strong><button data-action="popup-close" aria-label="Закрыть">×</button></div>'+
 '<div class="palette-body"><button type="button" class="palette-auto" data-action="palette-clear"><span class="palette-auto-symbol">'+(activePalette==='color'?'А':'◻')+'</span>Автоматически / без заливки</button>'+
 '<div class="palette-section-title">Цвета темы</div><div class="palette-theme-grid">'+theme+'</div>'+
 '<div class="palette-section-title">Стандартные цвета</div><div class="palette-standard">'+QO_STANDARD.map(c=>qoPaletteSwatch(c)).join('')+'</div>'+
 '<div class="palette-section-title">Последние цвета</div><div class="palette-recent">'+(recentColors.length?recentColors.map(c=>qoPaletteSwatch(c)).join(''):'<span class="palette-no-recent">Выбранные цвета появятся здесь</span>')+'</div>'+
 '<button class="palette-more" data-action="palette-more" aria-expanded="'+paletteExpanded+'"><span>Другие цвета…</span><span class="palette-more-icon">'+(paletteExpanded?'−':'+')+'</span></button>'+
 (paletteExpanded?'<div class="palette-custom-panel"><div class="palette-sv" id="palette-sv" style="background-color:hsl('+paletteHue+',100%,50%)" role="slider" tabindex="0" aria-label="Яркость и насыщенность"><div id="palette-sv-dot" class="palette-sv-dot" style="left:'+paletteSat+'%;top:'+(100-paletteVal)+'%"></div></div>'+
 '<label class="palette-hue-label">Оттенок <input id="palette-hue" type="range" min="0" max="359" step="1" value="'+paletteHue+'" aria-label="Оттенок"></label>'+
 '<div class="palette-custom-bottom"><div id="palette-selected-preview" class="palette-selected-preview" style="background-color:'+qoColorHex()+'"></div><label>HEX <input id="palette-hex" type="text" maxlength="7" value="'+qoColorHex()+'" spellcheck="false" aria-label="HEX-код цвета"></label><span id="palette-result">'+qoColorHex()+'</span></div>'+
 '<button class="palette-custom-apply" data-action="palette-custom-apply">Применить цвет</button></div>':'')+'</div></div>';
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

function sortRange(direction,options={}){
 if(!requireSingleRange()||!sheet())return;
 commitEditor();if(refuseHiddenSelection())return;
 try{
  let count=0;
  transact(()=>{count=sortSelectedRows(sheet(),activeCell,rangeEnd,direction,options);});
  drawGrid();updateSelectionStats();
  const key=colLabel(options.keyColumn??rectangle(activeCell,rangeEnd).c1);
  status(`Отсортировано ${count} строк по столбцу ${key} (${direction==='asc'?'по возрастанию':'по убыванию'})`);
 }catch(error){status(error.message,true);}
}
function sortFromContext(direction){
 const column=Number(document.getElementById('context-sort-column')?.value);
 const header=!!document.getElementById('context-sort-header')?.checked;
 sizeContext=null;document.getElementById('size-context-menu')?.remove();
 sortRange(direction,{keyColumn:column,header});
}

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
 const input=document.createElement('input');input.className='sheet-tab-editor';input.setAttribute('aria-label','Новое имя листа');input.maxLength=31;input.value=s.name;input.style.width=Math.max(66,Math.ceil(tab.getBoundingClientRect().width))+'px';let settled=false;
 const finish=cancel=>{if(settled)return;settled=true;const next=input.value.trim();
  if(!cancel&&next&&next!==s.name){if(/[\\/*?:\[\]]/.test(next)||b.sheets.some(x=>x.id!==id&&x.name.toLowerCase()===next.toLowerCase()))status('Название листа недопустимо или уже существует',true);
   else if(referencedFromOtherSheet(b,s))status('Переименование листа со ссылками из других листов пока запрещено',true);
   else transact(()=>{s.name=next});}
  render();};
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();finish(false);}if(e.key==='Escape'){e.preventDefault();finish(true);}e.stopPropagation();});
 input.addEventListener('blur',()=>finish(false));tab.replaceWith(input);input.focus();input.select();}

function deleteSheet(){const b=book();if(b.sheets.length<=1){status('Нельзя удалить единственный лист');return;}if(referencedFromOtherSheet(b,sheet())){status('Этот лист используется в формулах других листов — удаление запрещено',true);return;}if(!confirm(`Удалить лист «${sheet().name}»?`))return;const id=b.activeSheetId;transact(()=>{b.sheets=b.sheets.filter(s=>s.id!==id);b.activeSheetId=b.sheets[0].id;});setSelection('A1');render();}
function qoHeaderIcon(kind){
 const symbols={sheet:'file-spreadsheet',writer:'file-text',open:'folder-open',save:'save',backup:'archive',sun:'sun',moon:'moon'};
 const body=kind==='slides'?'<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8M12 16v5M7 11l3-3 2 2 4-4"/>':kind==='photo'?'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.4"/><path d="m5 17 5-5 3 3 3-5 4 7"/>':(QO_WORKSPACE_ICONS[kind]||QO_LUCIDE[symbols[kind]]);
 return '<svg class="qo-top-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+body+'</svg>';
}
function topbar(){
 const tabs=`<nav class="modules" aria-label="Разделы приложения"><button class="module ${page==='home'?'active':''}" data-action="route" data-target="home" aria-label="Обзор" title="Обзор">Обзор</button><button class="module ${page==='sheet'?'active':''}" data-action="route" data-target="sheet" aria-label="Таблицы" title="Таблицы">${qoHeaderIcon('sheet')}<span>Таблицы</span></button><button class="module ${page==='writer'?'active':''}" data-action="route" data-target="writer" aria-label="Тексты" title="Тексты">${qoHeaderIcon('writer')}<span>Тексты</span></button><button class="module ${page==='slides'?'active':''}" data-action="route" data-target="slides" aria-label="Презентации" title="Презентации">${qoHeaderIcon('slides')}<span>Презентации</span></button><button class="module ${page==='photo'?'active':''}" data-action="route" data-target="photo" aria-label="Фото — Quantum Studio" title="Фото — Quantum Studio">${qoHeaderIcon('photo')}<span>Фото</span></button></nav>`;
 const current=book();
 const brand=`<button class="logo" data-action="route" data-target="home" title="На главную"><span class="logo-mark" aria-hidden="true"><svg viewBox="0 0 28 28" class="shell-brand"><rect x="3" y="3" width="22" height="22" rx="7" fill="url(#qoBrandUnified)"/><path d="M8.5 8.5h4.5a4 4 0 0 1 0 8H8.5z" fill="#DDF6EA"/><path d="M14 19.7h4.9" stroke="#DDF6EA" stroke-width="2.1" stroke-linecap="round"/><path d="M17.35 16.35a4.2 4.2 0 1 1 0-5.94" stroke="#DDF6EA" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" fill="none"/><defs><linearGradient id="qoBrandUnified" x1="4" y1="4" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stop-color="#2FB580"/><stop offset="1" stop-color="#156548"/></linearGradient></defs></svg></span><span class="logo-wordmark">QUANTUM <b>OFFICE</b></span></button>`;
 const title=page==='writer'?`<input id="qo-writer-title" class="qo-shell-title-input" aria-label="Название текстового документа" maxlength="120" value="${esc(qoWriter.name)}" title="Переименовать документ">`:page==='slides'?`<input id="qo-slides-title" class="qo-shell-title-input" aria-label="Название презентации" maxlength="120" value="${esc(qoSlides.name)}" title="Переименовать презентацию">`:page==='photo'?`<input id="qs-project-title" class="qo-shell-title-input" aria-label="Название проекта" maxlength="120" value="${esc(qoPhotoFile)}">`:current?`<input id="book-name" aria-label="Название книги" value="${esc(current.name)}" maxlength="200" title="Изменить название книги">`:
  '<span class="qo-shell-placeholder">Quantum Office</span>';
 const actions=`<div class="global-right"><button class="qo-theme-toggle" data-action="theme-toggle" title="Оформление" aria-label="Выбрать тему оформления" aria-haspopup="dialog" aria-expanded="false">${qoHeaderIcon(qoGlobalTheme==='dark'?'sun':'moon')}</button><button class="shell-action" data-action="import" title="Открыть файл"><span class="shell-btn-icon" aria-hidden="true">${qoHeaderIcon('open')}</span><span>Открыть</span></button><button class="shell-action primary" data-action="save" title="Сохранить документ" ${(current||['writer','slides','photo'].includes(page))?'':'disabled'}><span class="shell-btn-icon" aria-hidden="true">${qoHeaderIcon('save')}</span><span>Сохранить</span></button><button class="icon-button" data-action="backup" title="Резервная копия всех файлов" aria-label="Резервная копия всех файлов">${qoHeaderIcon('backup')}</button></div>`;
 return `<header class="global-bar compact-shell qo-unified-shell">${brand}${tabs}<div class="shell-document"><div class="shell-doc-wrap">${title}<span class="shell-save" id="storage-indicator">● Черновик в браузере</span></div></div>${actions}</header>`;
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
  writer:{name:'Шаблоны текстов',description:'Документы открываются в работающем первом варианте Quantum Writer.',items:[
   ['writer-blank','Пустой документ','Текстовый редактор в разработке','file'],
   ['writer-lesson','Конспект занятия','Структура урока, цели и материалы','file'],
   ['writer-letter','Письмо','Деловые и личные письма','file']]},
  slides:{name:'Шаблоны презентаций',description:'Первые шаблоны открываются в Quantum Slides.',items:[
   ['slides-blank','Пустая презентация','Редактор слайдов в разработке','slides'],
   ['slides-lesson','Учебный материал','Слайды для объяснения темы','slides'],
   ['slides-report','Доклад','Титульный слайд, разделы и выводы','slides']]}}[mode];
 const cards=data.items.map(([key,title,desc,icon])=>`<button class="template-card" ${key?`data-action="template-create" data-template="${key}"`:'disabled aria-disabled="true"'}><span class="template-card-art">${icon==='calendar'?'▦':icon==='users'?'♙':icon==='budget'?'▥':icon==='slides'?'▣':'▤'}</span><strong>${esc(title)}</strong><small>${esc(desc)}</small>${key?'<span class="template-card-arrow">Создать →</span>':'<span class="template-card-muted">Планируется</span>'}</button>`).join('');
 return `<main class="templates-page"><div class="templates-heading"><button data-action="route" data-target="home" class="templates-back">← На главную</button><h1>${data.name}</h1><p>${data.description}</p></div><div class="templates-grid">${cards}</div></main>`;
}
function homepage(){
 const cards=workspace.books.map(b=>`<article class="file-card"><button class="file-open" data-action="open" data-id="${esc(b.id)}"><span class="file-emoji" aria-hidden="true">▦</span><span class="file-card-name">${esc(b.name)}</span><small>${b.sheets.length} ${b.sheets.length===1?'лист':'листов'} · ${niceDate(b.updated)}</small></button><div class="file-card-actions"><button data-action="rename-book" data-id="${esc(b.id)}" aria-label="Переименовать книгу ${esc(b.name)}">Переименовать</button><button data-action="clone" data-id="${esc(b.id)}">Дублировать</button><button data-action="delete" data-id="${esc(b.id)}">Удалить</button></div></article>`).join('');
 return `<main class="home-main office-launcher"><div class="launcher-tools" aria-label="Выбор редактора">
 <button class="launcher-tile sheets" data-action="new"><span class="launcher-art">${launcherIcon('sheet')}</span><span class="launcher-name">Таблицы</span><span class="launcher-description">Данные, расчёты и расписания</span><span class="launcher-state available">Доступен</span></button>
 <button class="launcher-tile writer" data-action="route" data-target="writer" aria-label="Тексты" title="Тексты"><span class="launcher-art">${launcherIcon('writer')}</span><span class="launcher-name">Тексты</span><span class="launcher-description">Документы и оформление</span><span class="launcher-state available">Первая версия</span></button>
 <button class="launcher-tile slides" data-action="route" data-target="slides" aria-label="Презентации" title="Презентации"><span class="launcher-art">${launcherIcon('slides')}</span><span class="launcher-name">Презентации</span><span class="launcher-description">Слайды и выступления</span><span class="launcher-state available">Первая версия</span></button>
 <button class="launcher-tile photo" data-action="route" data-target="photo" aria-label="Фото — Quantum Studio" title="Фото — Quantum Studio"><span class="launcher-art">${qoHeaderIcon('photo')}</span><span class="launcher-name">Фото</span><span class="launcher-description">Изображения, рисование и коррекция</span><span class="launcher-state available">Базовый редактор</span></button></div>
 <div class="launcher-template-actions" aria-label="Каталоги шаблонов"><button data-action="templates" data-kind="sheet">Шаблоны таблиц <span>→</span></button><button data-action="templates" data-kind="writer">Шаблоны текстов <span>→</span></button><button data-action="templates" data-kind="slides">Шаблоны презентаций <span>→</span></button></div>
 <div class="launcher-secondary"><button data-action="example">Открыть пример таблицы</button><button data-action="import">Открыть файл XLSX / QBOOK / CSV</button><button data-action="open-disk">Открыть QBOOK с диска</button></div>
 <div class="launcher-files"><div class="launcher-files-top"><span>Недавние файлы</span><button data-action="backup" title="Скачать резервную копию всех черновиков">Резервная копия</button></div><div class="files-grid">${cards||'<div class="empty-files"><span>◇</span><strong>Нет сохранённых черновиков</strong><p>Создайте таблицу или начните с шаблона расписания.</p></div>'}</div></div><div class="launcher-note">Черновики хранятся в браузере. Для надёжного хранения сохраняйте .qbook на диск.</div></main>`;
}
// TASK089: First usable offline Writer and Slides workspaces, independently saved.
const qoDeskRead=(key,otherwise)=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):otherwise;}catch{return otherwise;}};
const qoWriterKey='quantum-office-writer-v1',qoSlidesKey='quantum-office-slides-v1';
const qoNewWriter=()=>({name:'Новый документ',html:'<p><br></p>',updated:Date.now()});
let qoWriter=qoDeskRead(qoWriterKey,qoNewWriter());
if(!qoWriter||typeof qoWriter.name!=='string'||typeof qoWriter.html!=='string')qoWriter=qoNewWriter();
const qoWriterDefaults=()=>({margin:20,font:'Georgia',size:16,line:1.55,pageNumber:true});
function qoWriterLayout(){
 const x=qoWriter.layout&&typeof qoWriter.layout==='object'?qoWriter.layout:{};
 return {margin:[12,15,20,25,30].includes(+x.margin)?+x.margin:20,
  font:['Georgia','Arial','Times New Roman','Segoe UI','Verdana'].includes(x.font)?x.font:'Georgia',
  size:[12,14,16,18,20].includes(+x.size)?+x.size:16,
  line:[1.2,1.4,1.55,1.8,2].includes(+x.line)?+x.line:1.55,
  pageNumber:x.pageNumber!==false};
}
qoWriter.layout=qoWriterLayout();
let qoWriterSelectionRange=null,qoWriterSelectedImage=null;
function qoWriterCSS(){const f=qoWriterLayout();return `--qo-writer-margin:${f.margin}mm;--qo-writer-font:'${f.font}';--qo-writer-size:${f.size}px;--qo-writer-line:${f.line}`;}

const qoNewSlide=(i=1)=>({id:'slide-'+Date.now()+'-'+Math.random().toString(16).slice(2,8),bg:'#ffffff',items:[
 {id:'title',kind:'text',text:i===1?'Заголовок презентации':'Новый слайд',x:8,y:15,w:84,h:21,size:36,bold:true,color:'#193b32',align:'center'},
 {id:'body',kind:'text',text:i===1?'Подзаголовок или тема урока':'Добавьте содержание слайда',x:12,y:49,w:76,h:19,size:21,bold:false,color:'#55746a',align:'center'}
]});
const qoNewSlides=()=>({name:'Новая презентация',slides:[qoNewSlide()],active:0,selected:'title',updated:Date.now()});
let qoSlides=qoDeskRead(qoSlidesKey,qoNewSlides());
if(!qoSlides||!Array.isArray(qoSlides.slides)||!qoSlides.slides.length)qoSlides=qoNewSlides();
const qoSafeURL=s=>{try{const url=new URL(s);return ['https:','http:','mailto:'].includes(url.protocol)?url.href:null;}catch{return null;}};
function qoSafeRich(html){
 const template=document.createElement('template');template.innerHTML=String(html||'').slice(0,2700000);
 const allow=new Set(['DIV','P','BR','H1','H2','H3','UL','OL','LI','B','STRONG','I','EM','U','S','SPAN','FONT','BLOCKQUOTE','A','TABLE','THEAD','TBODY','TFOOT','TR','TH','TD','IMG']);
 const out=document.createElement('div');
 function copyChildren(parent,dest){
  for(const node of parent.childNodes){
   if(node.nodeType===3){dest.append(document.createTextNode(node.textContent));continue;}
   if(node.nodeType!==1)continue;
   if(['STYLE','SCRIPT','HEAD','META','LINK','TITLE','NOSCRIPT','IFRAME','OBJECT','EMBED','SVG','MATH'].includes(node.tagName))continue;
   if(!allow.has(node.tagName)){copyChildren(node,dest);continue;}
   if(['STYLE','SCRIPT','HEAD','META','LINK','TITLE','NOSCRIPT','IFRAME','OBJECT','EMBED'].includes(node.tagName))continue;
   const next=document.createElement(node.tagName==='FONT'?'span':node.tagName.toLowerCase());
   if(node.tagName==='IMG'){
    const src=node.getAttribute('src')||'';
    if(!/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(src)||src.length>2700000)continue;
    next.setAttribute('src',src);next.setAttribute('alt',(node.getAttribute('alt')||'Изображение').slice(0,120));
    const width=node.style.width;if(/^\d{1,3}%$/.test(width)&&parseInt(width)>=10&&parseInt(width)<=100)next.style.width=width;
    dest.append(next);continue;
   }
   if(node.tagName==='DIV'&&node.getAttribute('data-qo-break')==='true'){
    next.setAttribute('data-qo-break','true');next.setAttribute('contenteditable','false');dest.append(next);continue;
   }
   if(node.tagName==='TH'||node.tagName==='TD'){
    const colspan=Math.min(12,Math.max(1,+node.getAttribute('colspan')||1));
    if(colspan>1)next.setAttribute('colspan',String(colspan));
   }

   if(node.tagName==='A'){const href=qoSafeURL(node.getAttribute('href'));if(href){next.setAttribute('href',href);next.setAttribute('target','_blank');next.setAttribute('rel','noopener noreferrer');}}
   const alignment=node.style?.textAlign;
   if(['left','center','right','justify'].includes(alignment))next.style.textAlign=alignment;
   if(node.tagName==='SPAN'||node.tagName==='FONT'){
    const color=(node.tagName==='FONT'?node.getAttribute('color'):node.style.color),fontSize=node.style.fontSize,bg=node.style.backgroundColor;
    if(bg&&CSS.supports('color',bg))next.style.backgroundColor=bg;
    if(color&&CSS.supports('color',color))next.style.color=color;
    if(fontSize&&/^\d{1,2}px$/.test(fontSize))next.style.fontSize=fontSize;
    const weight=node.style.fontWeight,italic=node.style.fontStyle,decoration=node.style.textDecorationLine;
    if(['bold','normal','700','400'].includes(weight))next.style.fontWeight=weight;
    if(['italic','normal'].includes(italic))next.style.fontStyle=italic;
    if(['underline','line-through','underline line-through','none'].includes(decoration))next.style.textDecorationLine=decoration;
   }
   copyChildren(node,next);dest.append(next);
  }
 }
 copyChildren(template.content,out);return out.innerHTML;
}
function qoPersistWriter(){
 const editor=document.getElementById('qo-writer-page');if(editor)qoWriter.html=qoSafeRich(editor.innerHTML);
 const title=document.getElementById('qo-writer-title');if(title)qoWriter.name=title.value.trim().slice(0,120)||'Новый документ';
 qoWriter.updated=Date.now();try{localStorage.setItem(qoWriterKey,JSON.stringify(qoWriter));}catch{status('Документ слишком большой для автосохранения. Экспортируйте HTML.',true);}
}
// TASK092: editor-specific contextual ribbon and native-looking compact icon controls.
const qoWorkspaceTab={writer:'home',slides:'home',photo:'home'};
const QO_WORKSPACE_ICONS={
 'moon':'<path d="M20.9 13.05A9 9 0 0 1 10.95 3.1 9 9 0 1 0 20.9 13.05Z"/>',
 'lock':'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 'unlock':'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-2.6"/>',
 'eye':'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 'eye-off':'<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.3 6.4C3.5 8.1 2 12 2 12s4 7 10 7c1.9 0 3.6-.7 5-1.7"/>',
 'align-horizontal-justify-center':'<path d="M12 2v20"/><rect x="4" y="6" width="16" height="4" rx="1"/><rect x="6" y="14" width="12" height="4" rx="1"/>',

 'table':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
 'image':'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="2"/><path d="m3 18 5-5 4 4 3-3 6 5"/>',
 'link':'<path d="M10 13a5 5 0 0 0 7.1 0l2.4-2.4a5 5 0 0 0-7.1-7.1L11 4.9M14 11a5 5 0 0 0-7.1 0l-2.4 2.4a5 5 0 0 0 7.1 7.1L13 19.1"/>',
 'align-left':'<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
 'align-center':'<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
 'align-right':'<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
 'align-full':'<path d="M4 6h16M4 10h16M4 14h16M4 18h16"/>',
 'bullet':'<circle cx="4" cy="7" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="17" r="1"/><path d="M8 7h13M8 12h13M8 17h13"/>',
 'numbered':'<path d="M3 6h2v5M3 11h4M3 15h3l-3 4h3M10 7h11M10 12h11M10 17h11"/>',
 'plus':'<path d="M12 5v14M5 12h14"/>',
 'minus':'<path d="M5 12h14"/>',
 'play':'<path d="m8 5 12 7-12 7z"/>',
 'square':'<rect x="4" y="4" width="16" height="16" rx="1"/>',
 'line':'<path d="M3 20 21 4"/>',
 'brush':'<path d="m20 4-9 9M8 15c-4 0-4 6-7 6 6 1 10-1 10-6a3 3 0 0 0-3-3"/>',
 'settings':'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
 'pages':'<rect x="6" y="3" width="13" height="16" rx="1"/><path d="M3 7v14h13"/>',
 'break':'<path d="M4 5h16M4 9h16M4 15h16M4 19h16M10 12h4"/>',
 'duplicate':'<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M4 16V4h12"/>',
 'type':'<path d="M12 5v14M5 8V5h14v3M9 19h6"/>',
 'sun':'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
 'new':'<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M15 4h6M18 1v6"/>',
 'download':'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 'folder':'<path d="M3 6h7l2 2h9v12H3z"/>',
 'palette':'<path d="M12 3a9 9 0 1 0 0 18c3 0 2-4 4-4h2a4 4 0 0 0 4-4A10 10 0 0 0 12 3Z"/><circle cx="7" cy="10" r="1"/><circle cx="11" cy="7" r="1"/><circle cx="16" cy="8" r="1"/>',
 'fit':'<path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/>',
 'eye':'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 'hand':'<path d="M8 13V6a2 2 0 0 1 4 0v7M12 11V4a2 2 0 0 1 4 0v9M16 11V6a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-4-2-6-5l-3-4a2 2 0 0 1 3-3l1 3Z"/>','crop':'<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>',
 'trash':'<path d="M4 6h16M9 6V4h6v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
 'redo':'<path d="m17 3 4 4-4 4M21 7H8a5 5 0 0 0-5 5v4"/>',
 'undo':'<path d="m7 3-4 4 4 4M3 7h13a5 5 0 0 1 5 5v4"/>',
 'ellipse':'<ellipse cx="12" cy="12" rx="9" ry="6"/>',
 'highlighter':'<path d="m15 4 5 5-10 10H5v-5L15 4ZM4 22h16"/>',
 'layers':'<path d="m12 2 10 6-10 6L2 8l10-6Zm-10 11 10 6 10-6"/>',
 'copy':'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4h12"/>',
 'front':'<path d="m12 2 8 5-8 5-8-5 8-5M4 13l8 5 8-5M12 14v7m-3-3 3 3 3-3"/>',
 'back':'<path d="m12 2 8 5-8 5-8-5 8-5M4 13l8 5 8-5M12 21v-7m-3 3 3-3 3 3"/>'
};
Object.assign(QO_WORKSPACE_ICONS,{
 'mouse-pointer':'<path d="m5 3 15 9-7 1-3 7z"/><path d="m13 13 4 6"/>',
 'layout-template':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M9 11h12"/>',
 'shapes':'<rect x="3" y="4" width="9" height="9" rx="1"/><circle cx="17" cy="16" r="5"/>',
 'upload':'<path d="M12 16V3m-5 5 5-5 5 5M4 17v4h16v-4"/>',
 'layers':'<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5"/>',
 'copy':'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V4h12"/>',
 'arrow-up-to-line':'<path d="M4 3h16M12 21V7m-5 5 5-5 5 5"/>',
 'arrow-down-to-line':'<path d="M4 21h16M12 3v14m-5-5 5 5 5-5"/>',
 'save':'<path d="M5 3h12l4 4v14H3V3zM7 3v6h10V3M7 21v-9h10v9"/>',
 'ellipse':'<ellipse cx="12" cy="12" rx="9" ry="6"/>',
 'sun':'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2"/>'
});
Object.assign(QO_WORKSPACE_ICONS,{'sliders-horizontal':'<path d="M3 6h4m4 0h10M3 18h10m4 0h4M7 3v6m4 6v6m2-6v6M7 6h4M13 18h4"/>','triangle':'<path d="m12 3 10 18H2Z"/>','flip-horizontal':'<path d="M12 2v20M3 6l6 6-6 6V6Zm18 0-6 6 6 6V6Z"/>','flip-vertical':'<path d="M2 12h20M6 3l6 6 6-6H6Zm0 18 6-6 6 6H6Z"/>','hand':'<path d="M8 13V6a2 2 0 0 1 4 0v7M12 11V4a2 2 0 0 1 4 0v9M16 11V6a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-4-2-6-5l-3-4a2 2 0 0 1 3-3l1 3Z"/>','crop':'<path d="M6 2v16h16M2 6h16v16"/>','settings':'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>'});
function qoWorkIcon(name){const path=QO_WORKSPACE_ICONS[name]||((typeof QO_LUCIDE!=='undefined')?QO_LUCIDE[name]:null)||QO_WORKSPACE_ICONS.type;
 return `<svg class="qo-work-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}
function qoWorkButton(action,label,icon,extra='',variant=''){return `<button type="button" class="qo-work-btn ${variant}" data-action="${action}" ${extra} title="${esc(label)}" aria-label="${esc(label)}">${qoWorkIcon(icon)}<span>${esc(label)}</span></button>`;}
function qoWorkTabBar(kind,tabs){return `<nav class="qo-work-tabs" aria-label="Разделы инструментов">${tabs.map(([id,name])=>`<button type="button" data-action="workspace-tab" data-editor="${kind}" data-tab="${id}" class="qo-work-tab ${qoWorkspaceTab[kind]===id?'active':''}" aria-selected="${qoWorkspaceTab[kind]===id}" role="tab">${name}</button>`).join('')}</nav>`;}
function qoWorkGroup(title,children,extra=''){return `<div class="qo-work-group ${extra}"><div class="qo-work-group-body">${children}</div><div class="qo-work-group-caption">${title}</div></div>`;}
function qoWorkPanel(kind,id,html){return `<div class="qo-work-panel ${qoWorkspaceTab[kind]===id?'active':''}" data-editor-panel="${kind}" data-panel-tab="${id}" ${qoWorkspaceTab[kind]===id?'':'hidden'}>${html}</div>`;}
function qoWorkSwitchTab(kind,tab){
 if(!['writer','slides','photo'].includes(kind))return;
 if(!document.querySelector(`[data-editor-panel="${kind}"][data-panel-tab="${tab}"]`))return;
 if(kind==='writer')qoWriterRememberSelection();
 qoWorkspaceTab[kind]=tab;
 document.querySelectorAll(`[data-editor-panel="${kind}"]`).forEach(el=>{const on=el.dataset.panelTab===tab;el.hidden=!on;el.classList.toggle('active',on);});
 document.querySelectorAll(`.qo-work-tabs [data-editor="${kind}"]`).forEach(el=>{const on=el.dataset.tab===tab;el.classList.toggle('active',on);el.setAttribute('aria-selected',String(on));});
}
function qoWriterStats(){const doc=document.getElementById('qo-writer-page'),out=document.getElementById('qo-writer-stats');if(!doc||!out)return;const value=doc.innerText.trim();out.textContent=`Слов: ${(value.match(/\S+/g)||[]).length} · Знаков: ${value.length}`;}
function qoWriterPage(){
 const f=qoWriterLayout();
 const sel=(options,v)=>options.map(([val,label])=>`<option value="${esc(String(val))}" ${String(val)===String(v)?'selected':''}>${esc(label)}</option>`).join('');
 const main=qoWorkGroup('Шрифт',`
 <div class="qo-work-stack"><div class="qo-work-inline"><label class="qo-work-field"><span>Семейство</span><select id="qo-writer-font" class="qo-writer-font">${sel(['Georgia','Arial','Times New Roman','Segoe UI','Verdana'].map(x=>[x,x]),f.font)}</select></label>
 <label class="qo-work-field"><span>Размер</span><select id="qo-writer-size" class="qo-writer-mini">${sel([12,14,16,18,20].map(x=>[x,x+' px']),f.size)}</select></label></div>
 <div class="qo-work-inline qo-style-line"><button data-action="writer-cmd" data-command="bold" title="Жирный (Ctrl+B)"><b>Ж</b></button><button data-action="writer-cmd" data-command="italic" title="Курсив (Ctrl+I)"><i>К</i></button><button data-action="writer-cmd" data-command="underline" title="Подчёркивание"><u>Ч</u></button><button data-action="writer-cmd" data-command="strikeThrough" title="Зачёркивание"><s>З</s></button><label class="qo-compact-color" title="Цвет текста"><input id="qo-writer-text-color" type="color" value="#263b31" aria-label="Цвет текста"></label><label class="qo-compact-color" title="Маркер текста"><input id="qo-writer-highlight" type="color" value="#fff49b" aria-label="Выделение маркером"></label></div></div>`);
 const paragraphs=qoWorkGroup('Абзац',`<div class="qo-work-stack"><div class="qo-work-inline">
 <label class="qo-work-field"><span>Стиль</span><select id="qo-writer-block">${sel([['p','Обычный текст'],['h1','Заголовок 1'],['h2','Заголовок 2'],['h3','Заголовок 3']],'p')}</select></label>
 <label class="qo-work-field"><span>Интервал</span><select id="qo-writer-line" class="qo-writer-small">${sel([[1.2,'1,2'],[1.4,'1,4'],[1.55,'1,55'],[1.8,'1,8'],[2,'2,0']],f.line)}</select></label></div>
 <div class="qo-work-inline qo-work-mini-actions">
 <button data-action="writer-cmd" data-command="insertUnorderedList" title="Маркированный список">${qoWorkIcon('bullet')}</button>
 <button data-action="writer-cmd" data-command="insertOrderedList" title="Нумерованный список">${qoWorkIcon('numbered')}</button>
 <span class="qo-mini-divider"></span>
 <button data-action="writer-cmd" data-command="justifyLeft" title="По левому краю">${qoWorkIcon('align-left')}</button>
 <button data-action="writer-cmd" data-command="justifyCenter" title="По центру">${qoWorkIcon('align-center')}</button>
 <button data-action="writer-cmd" data-command="justifyRight" title="По правому краю">${qoWorkIcon('align-right')}</button>
 <button data-action="writer-cmd" data-command="justifyFull" title="По ширине">${qoWorkIcon('align-full')}</button></div></div>`);
 const insert=qoWorkGroup('Объекты',qoWorkButton('writer-table','Таблица','table')+qoWorkButton('writer-image','Рисунок','image')+qoWorkButton('writer-link','Ссылка','link')+qoWorkButton('writer-break','Разрыв','break'));
 const tabtools=qoWorkGroup('Работа с таблицей',qoWorkButton('writer-add-row','Строка +','plus')+qoWorkButton('writer-add-col','Столбец +','plus')+qoWorkButton('writer-delete-row','Убрать строку','minus')+qoWorkButton('writer-delete-table','Удалить таблицу','trash'));
 const imagetools=qoWorkGroup('Выбранное изображение',`<label class="qo-work-field"><span>Ширина изображения</span><select id="qo-writer-img-width" class="qo-writer-small" disabled title="Нажмите на изображение в документе">${sel([[25,'25%'],[50,'50%'],[75,'75%'],[100,'100%']],100)}</select></label>`+qoWorkButton('writer-remove-image','Удалить фото','trash','id="qo-writer-remove-image" disabled'));
 const layout=qoWorkGroup('Параметры страницы',`<div class="qo-work-stack"><label class="qo-work-field"><span>Размер бумаги</span><div class="qo-work-value">A4 · 210 × 297 мм</div></label><label class="qo-work-field"><span>Поля со всех сторон</span><select id="qo-writer-margin" class="qo-writer-small" title="Поля в миллиметрах">${sel([[12,'12 мм'],[15,'15 мм'],[20,'20 мм'],[25,'25 мм'],[30,'30 мм']],f.margin)}</select></label></div>`);
 const files=qoWorkGroup('Документ',qoWorkButton('writer-new','Создать','new')+qoWorkButton('writer-import','Открыть','folder')+qoWorkButton('writer-export-qdoc','Сохранить QDOC','save','','qo-accent-tool'));
 const exporttools=qoWorkGroup('Экспорт и печать',qoWorkButton('writer-export-html','HTML','file-text')+qoWorkButton('writer-export-txt','TXT','file-text')+qoWorkButton('writer-print','Печать / PDF','printer'));
 return `<main class="qo-document-workspace" aria-label="Текстовый редактор">
 <div class="qo-office-toolbar">
 ${qoWorkTabBar('writer',[['home','Главная'],['insert','Вставка'],['layout','Макет'],['file','Файл']])}
 <div class="qo-work-ribbon" role="toolbar" aria-label="Инструменты текстового редактора">
 ${qoWorkPanel('writer','home',main+paragraphs)}
 ${qoWorkPanel('writer','insert',insert+tabtools+imagetools)}
 ${qoWorkPanel('writer','layout',layout+qoWorkGroup('Структура документа',qoWorkButton('writer-break','Разрыв страницы','break')))}
 ${qoWorkPanel('writer','file',files+exporttools)}
 </div></div>
 <section class="qo-editor-scroll"><div class="qo-writer-pagewrap"><article id="qo-writer-page" class="qo-paper" style="${qoWriterCSS()}" contenteditable="true" role="textbox" aria-label="Текст документа" aria-multiline="true" spellcheck="true">${qoSafeRich(qoWriter.html)}</article></div></section>
 <input type="file" id="qo-writer-file" accept=".qdoc,.txt,.html,text/plain,text/html,application/json" hidden><input type="file" id="qo-writer-image-file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>
 <footer class="qo-editor-foot qo-office-footer"><span>A4 · ${f.margin} мм · ${esc(f.font)}</span><span id="qo-writer-stats">Слов: — · Знаков: —</span><span>QDOC / HTML / TXT</span></footer></main>`;
}
function qoWriterRememberSelection(){
 const sel=window.getSelection(),node=sel?.anchorNode,editor=document.getElementById('qo-writer-page');
 if(editor&&node&&editor.contains(node)&&sel.rangeCount)qoWriterSelectionRange=sel.getRangeAt(0).cloneRange();
}
function qoWriterFocusSelection(){
 const editor=document.getElementById('qo-writer-page');if(!editor)return;
 editor.focus();
 if(qoWriterSelectionRange&&editor.contains(qoWriterSelectionRange.commonAncestorContainer)){
  const sel=window.getSelection();sel.removeAllRanges();sel.addRange(qoWriterSelectionRange);
 }
}
function qoWriterCommand(command){
 qoWriterFocusSelection();document.execCommand(command,false,null);qoWriterRememberSelection();qoPersistWriter();
}
function qoWriterInsert(html){
 qoWriterFocusSelection();document.execCommand('insertHTML',false,qoSafeRich(html));
 qoWriterRememberSelection();qoPersistWriter();
}
function qoWriterInsertBreak(){
 const cell=qoWriterCell();
 if(cell){
  const table=cell.closest('table');
  const divider=document.createElement('div');divider.setAttribute('data-qo-break','true');divider.setAttribute('contenteditable','false');
  const para=document.createElement('p');para.append(document.createElement('br'));table.after(divider,para);
  const range=document.createRange();range.setStart(para,0);range.collapse(true);
  const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
  qoWriterRememberSelection();qoPersistWriter();return;
 }
 qoWriterInsert('<div data-qo-break="true" contenteditable="false"></div><p><br></p>');
}
function qoWriterCell(){
 qoWriterFocusSelection();const sel=window.getSelection(),node=sel?.anchorNode;
 return (node?.nodeType===1?node:node?.parentElement)?.closest?.('td,th')||null;
}
function qoWriterTableAction(action){
 const cell=qoWriterCell(),table=cell?.closest('table');
 if(!cell||!table){status('Сначала установите курсор внутрь ячейки таблицы',true);return;}
 const row=cell.closest('tr'),rows=[...table.rows],index=[...row.cells].indexOf(cell);
 if(action==='writer-add-row'){
  const newRow=row.cloneNode(false);for(const c of row.cells){const next=document.createElement(c.tagName.toLowerCase());next.append(document.createElement('br'));newRow.append(next);}row.after(newRow);
 }else if(action==='writer-add-col'){
  if(rows.some(r=>r.cells.length>=12)){status('Максимум 12 столбцов',true);return;}
  for(const r of rows){const el=document.createElement(r.closest('thead')?'th':'td');el.append(document.createElement('br'));r.cells[Math.min(index,r.cells.length-1)]?.after(el)||r.append(el);}
 }else if(action==='writer-delete-row'){
  if(rows.length<=1){table.remove();}else row.remove();
 }else if(action==='writer-delete-table'){table.remove();}
 qoWriterSelectionRange=null;qoPersistWriter();
}
function qoWriterImageSelect(img){
 document.querySelectorAll('#qo-writer-page img').forEach(el=>el.classList.remove('qo-writer-img-active'));
 qoWriterSelectedImage=img;
 const select=document.getElementById('qo-writer-img-width'),button=document.getElementById('qo-writer-remove-image');
 if(select){select.disabled=!img;select.value=img?.style.width?.replace('%','')||'100';}
 if(button)button.disabled=!img;
 if(img)img.classList.add('qo-writer-img-active');
}
function qoWriterHTMLDocument(){
 const f=qoWriterLayout(),safe=qoSafeRich(qoWriter.html);
 const style=`@page{size:A4;margin:${f.margin}mm}body{margin:0;font:${f.size}px/${f.line} '${f.font}',serif;color:#142a1d}main{max-width:${210-2*f.margin}mm;margin:0 auto}h1,h2,h3{font-family:Arial,sans-serif;break-after:avoid}table{width:100%;table-layout:fixed;border-collapse:collapse;margin:14px 0}td,th{padding:7px;border:1px solid #9caea1}th{background:#edf5ef}img{display:block;max-width:100%;height:auto;margin:12px auto}div[data-qo-break="true"]{break-after:page;page-break-after:always;height:0}a{color:#176f58}@media screen{body{background:#edf2ee;padding:28px}main{min-height:${297-2*f.margin}mm;background:white;padding:${f.margin}mm;box-shadow:0 3px 18px #0002}}`;
 return '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>'+esc(qoWriter.name)+'</title><style>'+style+'</style></head><body><main>'+safe+'</main></body></html>';
}
function qoWriterExport(format){
 qoPersistWriter();
 if(format==='txt'){
  const clone=document.createElement('div');clone.innerHTML=qoSafeRich(qoWriter.html);
  clone.querySelectorAll('[data-qo-break]').forEach(el=>el.replaceWith(document.createTextNode('\\n\\n--- Разрыв страницы ---\\n\\n')));
  download(`${safeFile(qoWriter.name)}.txt`,clone.innerText||clone.textContent||'','text/plain;charset=utf-8');
 }else if(format==='qdoc'){
  download(`${safeFile(qoWriter.name)}.qdoc`,JSON.stringify({format:'quantum-writer',version:2,name:qoWriter.name,html:qoSafeRich(qoWriter.html),layout:qoWriterLayout(),updated:Date.now()},null,2),'application/json;charset=utf-8');
 }else download(`${safeFile(qoWriter.name)}.html`,qoWriterHTMLDocument(),'text/html;charset=utf-8');
}
function qoWriterPrint(){
 qoPersistWriter();const style=document.getElementById('qo-writer-print-style')||document.createElement('style');
 style.id='qo-writer-print-style';style.textContent=`@media print{@page{size:A4;margin:${qoWriterLayout().margin}mm;${qoWriterLayout().pageNumber?'@bottom-right{content:counter(page);font:10px Arial;color:#567363}':''}}}`;
 document.head.append(style);window.print();
}
function qoSlide(){return qoSlides.slides[Math.max(0,Math.min(qoSlides.slides.length-1,qoSlides.active))];}
function qoPersistSlides(){const title=document.getElementById('qo-slides-title');if(title)qoSlides.name=title.value.trim().slice(0,120)||'Новая презентация';qoSlides.updated=Date.now();try{localStorage.setItem(qoSlidesKey,JSON.stringify(qoSlides));}catch{status('Недостаточно места для презентации. Сохраните файл .qslides.',true);}}
function qoSlidePreview(slide,interactive){const items=slide.items.map(item=>{
 const dim=`left:${Number(item.x)}%;top:${Number(item.y)}%;width:${Number(item.w)}%;height:${Number(item.h)}%;`;
 if(item.kind==='image')return `<div class="qo-slide-object qo-slide-image${interactive&&qoSlides.selected===item.id?' selected':''}" style="${dim}" ${interactive?`data-slide-item="${esc(item.id)}"`:''}><img src="${esc(item.data)}" alt="Изображение слайда" draggable="false"></div>`;
 if(item.kind==='shape')return `<div class="qo-slide-object qo-slide-shape${interactive&&qoSlides.selected===item.id?' selected':''}" style="${dim}background:${esc(/^#[0-9a-f]{6}$/i.test(item.fill||'')?item.fill:'#2c9569')};" ${interactive?`data-slide-item="${esc(item.id)}"`:''}></div>`;
 return `<div class="qo-slide-object qo-slide-text${interactive&&qoSlides.selected===item.id?' selected':''}" style="${dim}font-size:${Math.max(10,Number(item.size)||20)}px;font-size:${Math.max(10,Number(item.size)||20)/9.6}cqw;color:${esc(item.color||'#233b33')};text-align:${esc(item.align||'left')};font-weight:${item.bold?'700':'400'}" ${interactive?`data-slide-item="${esc(item.id)}"`:''}>${esc(item.text||'').replace(/\n/g,'<br>')}</div>`;
 }).join('');return `<div class="qo-slide-frame" style="background:${esc(slide.bg||'#ffffff')}">${items}</div>`;}
function qoSlidesPage(){const current=qoSlide();
 const slide=qoWorkGroup('Слайды',qoWorkButton('slides-add','Новый слайд','plus','','qo-accent-tool')+qoWorkButton('slides-duplicate','Дублировать','duplicate')+qoWorkButton('slides-remove','Удалить','trash'));
 const objects=qoWorkGroup('Объекты',qoWorkButton('slides-add-text','Текст','type')+qoWorkButton('slides-add-image','Изображение','image')+qoWorkButton('slides-add-shape','Фигура','square'));
 const arrange=qoWorkGroup('Объект',qoWorkButton('slides-duplicate-object','Дублировать объект','copy')+qoWorkButton('slides-front','На передний план','front')+qoWorkButton('slides-back','На задний план','back')+qoWorkButton('slides-center','По центру слайда','align-center'));
 const design=qoWorkGroup('Оформление слайда',`<label class="qo-slide-bg qo-work-color-field"><span>Цвет фона</span><input id="qo-slides-bg" type="color" value="${esc(current.bg)}" title="Фон текущего слайда"></label><span class="qo-work-text">Формат 16:9 · 1280 × 720 px при экспорте PNG</span>`);
 const show=qoWorkGroup('Показ презентации',qoWorkButton('slides-present','Начать показ','play','','qo-accent-tool')+qoWorkButton('slides-export-png','Текущий слайд PNG','image'));
 const files=qoWorkGroup('Презентация',qoWorkButton('slides-import','Открыть файл','folder')+qoWorkButton('slides-export','Сохранить .qslides','save','','qo-accent-tool'));
 return `<main class="qo-slides-workspace"><div class="qo-office-toolbar"> ${qoWorkTabBar('slides',[['home','Главная'],['insert','Вставка'],['design','Дизайн'],['show','Показ'],['file','Файл']])}
 <div class="qo-work-ribbon" role="toolbar" aria-label="Инструменты презентации">${qoWorkPanel('slides','home',slide+arrange)}${qoWorkPanel('slides','insert',objects+arrange)}${qoWorkPanel('slides','design',design)}${qoWorkPanel('slides','show',show)}${qoWorkPanel('slides','file',files+show)}</div></div>
 <div class="qo-slides-layout"><aside class="qo-slide-rail" aria-label="Слайды презентации"><div class="qo-slide-rail-heading"><strong>Слайды</strong><button data-action="slides-add" title="Добавить слайд" aria-label="Добавить слайд">${qoWorkIcon('plus')}</button></div><div class="qo-slide-rail-list">${qoSlides.slides.map((s,i)=>`<button class="qo-slide-thumb${i===qoSlides.active?' active':''}" data-action="slides-select" data-index="${i}" aria-label="Слайд ${i+1}"><span>${i+1}</span>${qoSlidePreview(s,false)}</button>`).join('')}</div></aside>
 <section class="qo-slide-stage"><div class="qo-slide-stage-inner"><div class="qo-slide-stage-top"><strong>Слайд ${qoSlides.active+1} из ${qoSlides.slides.length}</strong><span>16:9</span></div>${qoSlidePreview(current,true)}<div class="qo-slide-stage-hint">Перетащите объект для перемещения · Точные значения — справа</div></div></section>
 <aside class="qo-slide-properties"><div class="qo-inspector-header"><span class="qo-inspector-eyebrow">ОФОРМЛЕНИЕ</span><h3>Свойства объекта</h3></div>${qoSlideProperties(current)}</aside></div>
 <input type="file" id="qo-slide-image-picker" accept="image/png,image/jpeg,image/webp" hidden><input type="file" id="qo-slide-import-picker" accept=".qslides,application/json" hidden><div id="qo-slides-overlay" class="qo-slide-show" hidden></div></main>`;
}
function qoSlideProperties(slide){const item=slide.items.find(x=>x.id===qoSlides.selected);if(!item)return '<p>Выберите текст, изображение или фигуру на слайде.</p>';
 const position=`<div class="qo-slide-position"><label>X <input data-slide-prop="x" type="number" min="0" max="95" value="${Number(item.x)}"></label><label>Y <input data-slide-prop="y" type="number" min="0" max="95" value="${Number(item.y)}"></label><label>Ширина <input data-slide-prop="w" type="number" min="5" max="100" value="${Number(item.w)}"></label><label>Высота <input data-slide-prop="h" type="number" min="5" max="100" value="${Number(item.h)}"></label></div>`;
 if(item.kind==='image')return `<strong>Изображение</strong>${position}<button data-action="slides-delete-object">Удалить изображение</button>`;
 if(item.kind==='shape')return `<strong>Прямоугольник</strong><label>Цвет заливки <input data-slide-prop="fill" type="color" value="${esc(item.fill||'#2c9569')}"></label>${position}<button data-action="slides-delete-object">Удалить фигуру</button>`;
 return `<label>Текст<textarea id="qo-slide-text" rows="5">${esc(item.text||'')}</textarea></label><label>Размер <input data-slide-prop="size" type="number" min="10" max="100" value="${Number(item.size)||22}"></label>
 <label>Цвет <input data-slide-prop="color" type="color" value="${esc(item.color||'#233b33')}"></label>
 <label>Выравнивание <select data-slide-prop="align">${['left','center','right'].map(x=>`<option value="${x}"${item.align===x?' selected':''}>${{left:'Слева',center:'Центр',right:'Справа'}[x]}</option>`).join('')}</select></label>
 <label class="qo-slide-checkbox"><input data-slide-prop="bold" type="checkbox"${item.bold?' checked':''}> Жирный</label>${position}<button data-action="slides-delete-object">Удалить объект</button>`;
}
function qoSlideSelect(id){qoSlides.selected=id;render();}
function qoSlideAddObject(kind,data=null){const slide=qoSlide(),id='obj-'+Date.now()+'-'+Math.random().toString(16).slice(2,6);
 slide.items.push(kind==='image'?{id,kind,data,x:25,y:24,w:50,h:50}:
 kind==='shape'?{id,kind:'shape',fill:'#2c9569',x:25,y:28,w:48,h:33}:
 {id,kind:'text',text:'Новый текст',x:22,y:30,w:56,h:19,size:26,bold:false,color:'#286a53',align:'center'});
 qoSlides.selected=id;qoPersistSlides();render();}

async function qoSlidesExportPNG(){
 const slide=qoSlide(),canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
 const ctx=canvas.getContext('2d');ctx.fillStyle=slide.bg||'#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
 for(const item of slide.items){
  const x=canvas.width*item.x/100,y=canvas.height*item.y/100,w=canvas.width*item.w/100,h=canvas.height*item.h/100;
  if(item.kind==='shape'){ctx.fillStyle=/^#[0-9a-f]{6}$/i.test(item.fill||'')?item.fill:'#2c9569';ctx.fillRect(x,y,w,h);continue;}
  if(item.kind==='image'){
   try{const img=await new Promise((resolve,reject)=>{const a=new Image();a.onload=()=>resolve(a);a.onerror=reject;a.src=item.data;});
   const fit=Math.min(w/img.naturalWidth,h/img.naturalHeight);ctx.drawImage(img,x+(w-img.naturalWidth*fit)/2,y+(h-img.naturalHeight*fit)/2,img.naturalWidth*fit,img.naturalHeight*fit);}catch{}continue;
  }
  ctx.fillStyle=item.color||'#213d30';ctx.font=`${item.bold?'bold ':''}${Math.max(10,Number(item.size)||20)*1.38}px "Segoe UI",Arial,sans-serif`;
  ctx.textAlign=item.align||'left';ctx.textBaseline='top';
  const sx=item.align==='center'?x+w/2:item.align==='right'?x+w:x;
  for(const [lineNo,line] of String(item.text||'').split('\n').entries())ctx.fillText(line,sx,y+lineNo*(Math.max(10,Number(item.size)||20)*1.55),w);
 }
 await new Promise(resolve=>canvas.toBlob(blob=>{if(blob){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${safeFile(qoSlides.name)}_${qoSlides.active+1}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}resolve();},'image/png'));
}
function qoSlidesDownload(){qoPersistSlides();download(`${safeFile(qoSlides.name)}.qslides`,JSON.stringify({format:'quantum-office-slides-v1',presentation:qoSlides},null,2),'application/json');}
function qoSlidesPresent(){const overlay=document.getElementById('qo-slides-overlay');if(!overlay)return;
 overlay.hidden=false;overlay.innerHTML=`<button class="qo-slide-show-exit" data-action="slides-exit">× Выход</button>${qoSlidePreview(qoSlide(),false)}<div class="qo-slide-show-controls"><button data-action="slides-prev">←</button><span>${qoSlides.active+1} / ${qoSlides.slides.length}</span><button data-action="slides-next">→</button></div>`;
}
let qoSlideDrag=null;

// TASK095: appearance changes never rebuild or recolor document surfaces.
let qoGlobalTheme='light',qoThemePreference='light',qoAccent='green';
const qoSystemTheme=matchMedia('(prefers-color-scheme: dark)');
try{qoThemePreference=localStorage.getItem('quantum-office-theme-v1')||'light';qoAccent=localStorage.getItem('quantum-office-accent-v1')||'green';}catch{}
if(!['light','dark','system'].includes(qoThemePreference))qoThemePreference='light';
if(!['green','blue','violet','amber'].includes(qoAccent))qoAccent='green';
function qoApplyAppearance(){qoGlobalTheme=qoThemePreference==='system'?(qoSystemTheme.matches?'dark':'light'):qoThemePreference;document.documentElement.dataset.qoTheme=qoGlobalTheme;document.documentElement.dataset.qoAccent=qoAccent;if(document.getElementById('qo-photo-canvas'))qoPhotoRender();}
qoApplyAppearance();qoSystemTheme.addEventListener('change',qoApplyAppearance);
function qoCloseTheme(){document.getElementById('qo-appearance-menu')?.remove();document.querySelector('.qo-theme-toggle')?.setAttribute('aria-expanded','false');}
function qoToggleTheme(){
 if(document.getElementById('qo-appearance-menu')){qoCloseTheme();return;}
 const menu=document.createElement('section');menu.id='qo-appearance-menu';menu.className='qo-appearance-menu';menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Оформление');
 menu.innerHTML='<strong>Оформление</strong><p>Общий вид всех редакторов</p><div class="qo-theme-choices">'+[['light','Светлая'],['dark','Тёмная'],['system','Системная']].map(([id,label])=>`<button data-appearance-theme="${id}" aria-pressed="${qoThemePreference===id}"><span class="qo-theme-preview ${id}"><i></i><b></b></span><span>${label}</span><small>${qoThemePreference===id?'✓':' '}</small></button>`).join('')+'</div><strong class="qo-accent-heading">Акцент</strong><div class="qo-accent-choices">'+[['green','Зелёный','#19805c'],['blue','Синий','#3676d8'],['violet','Фиолетовый','#8b5ed7'],['amber','Янтарный','#a76a15']].map(([id,label,color])=>`<button data-appearance-accent="${id}" title="${label}" aria-label="${label}" aria-pressed="${qoAccent===id}" style="--swatch:${color}">${qoAccent===id?'✓':''}</button>`).join('')+'</div>';
 document.body.append(menu);document.querySelector('.qo-theme-toggle')?.setAttribute('aria-expanded','true');menu.querySelector('[aria-pressed="true"]')?.focus();
}
document.addEventListener('click',e=>{const t=e.target.closest('[data-appearance-theme],[data-appearance-accent]');if(t){if(t.dataset.appearanceTheme)qoThemePreference=t.dataset.appearanceTheme;else qoAccent=t.dataset.appearanceAccent;try{localStorage.setItem('quantum-office-theme-v1',qoThemePreference);localStorage.setItem('quantum-office-accent-v1',qoAccent);}catch{}qoApplyAppearance();qoCloseTheme();document.querySelector('.qo-theme-toggle')?.focus();return;}if(!e.target.closest('#qo-appearance-menu,.qo-theme-toggle'))qoCloseTheme();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('qo-appearance-menu')){qoCloseTheme();document.querySelector('.qo-theme-toggle')?.focus();}const m=document.getElementById('qo-appearance-menu');if(m&&e.key==='Tab'){const a=[...m.querySelectorAll('button')],i=a.indexOf(document.activeElement);if(e.shiftKey&&i===0){a.at(-1).focus();e.preventDefault();}else if(!e.shiftKey&&i===a.length-1){a[0].focus();e.preventDefault();}}});
// TASK093: editable multi-object Quantum Studio workspace.
let qoPhotoImage=null,qoPhotoImageSrc='',qoPhotoFile='Без названия',qoPhotoTool='select',qoPhotoColor='#137f5d',qoPhotoSize=7;
let qoPhotoAdjust={brightness:100,contrast:100,saturation:100};
let qoPhotoStrokes=[],qoPhotoHistory=[],qoPhotoRedo=[],qoPhotoActiveStroke=null;
let qoPhotoCanvasW=1100,qoPhotoCanvasH=650,qoPhotoBG='#ffffff',qoPhotoTransparent=false,qoPhotoZoom=.7;
let qoPhotoLeftOpen=innerWidth>1000,qoPhotoRightOpen=innerWidth>1100,qoPhotoCompare=false,qoPhotoGuides=[],qoPhotoDraftSaved=true;
let qoPhotoSidebar='templates',qoPhotoSelectedId=null,qoPhotoDrag=null,qoPhotoCounter=1;
const qoPhotoSelectedIds=new Set();let qoPhotoMarquee=null;
const qoPhotoImages=new Map(),qoPhotoStorageKey='quantum-studio-task093';
const qoPhotoPresets=[['wide','Пейзаж 16:9',1280,720],['square','Квадрат',1080,1080],['portrait','Публикация 4:5',1080,1350],['story','История 9:16',1080,1920],['letter','Лист A4',794,1123],['wide','Обложка видео',1280,720],['wide','Баннер',1920,640]];
function qoPhotoId(){return 'ps-'+qoPhotoCounter++;}
function qoPhotoButton(action,icon,label,extra=''){return `<button type="button" class="qs-btn" data-action="photo-${action}" title="${esc(label)}" aria-label="${esc(label)}" ${extra}>${qoWorkIcon(icon)}<span>${esc(label)}</span></button>`;}
function qoPhotoSideButton(tab,icon,name){return `<button class="qs-rail-btn ${qoPhotoSidebar===tab?'active':''}" data-action="photo-panel" data-panel="${tab}" aria-pressed="${qoPhotoSidebar===tab}" title="${name}">${qoWorkIcon(icon)}<span>${name}</span></button>`;}
function qoPhotoElement(tool,label,icon){return `<button type="button" class="qs-element" data-action="photo-add" data-tool="${tool}">${qoWorkIcon(icon)}<span>${label}</span></button>`;}
function qoPhotoSelection(){return qoPhotoStrokes.filter(o=>qoPhotoSelectedIds.has(o.id)||(qoPhotoSelectedIds.size===0&&o.id===qoPhotoSelectedId));}
function qoPhotoSetSelection(ids){qoPhotoSelectedIds.clear();for(const id of ids)if(qoPhotoStrokes.some(o=>o.id===id))qoPhotoSelectedIds.add(id);qoPhotoSelectedId=[...qoPhotoSelectedIds].at(-1)||null;}
function qoPhotoExpandSelection(o){return o?.groupId?qoPhotoStrokes.filter(x=>x.groupId===o.groupId).map(x=>x.id):o?[o.id]:[];}
function qoPhotoSelectObject(o,additive=false){const ids=qoPhotoExpandSelection(o);if(additive){const previous=new Set(qoPhotoSelection().map(x=>x.id)),all=ids.every(id=>previous.has(id));for(const id of ids){if(all)previous.delete(id);else previous.add(id);}qoPhotoSetSelection(previous);}else qoPhotoSetSelection(ids);}
function qoPhotoSelectionBounds(arr=qoPhotoSelection()){if(!arr.length)return null;const b=arr.map(qoPhotoVisualBounds);return {x:Math.min(...b.map(v=>v.x)),y:Math.min(...b.map(v=>v.y)),w:Math.max(...b.map(v=>v.x+v.w))-Math.min(...b.map(v=>v.x)),h:Math.max(...b.map(v=>v.y+v.h))-Math.min(...b.map(v=>v.y))};}
function qoPhotoGroupSelection(group){const chosen=qoPhotoSelection();if(group&&chosen.length<2)return;if(!chosen.length)return;qoPhotoSnapshot();const groupId=group?'g-'+qoPhotoId():null;for(const o of chosen)o.groupId=groupId;qoPhotoRefresh();}
function qoPhotoSetLock(locked){const selected=qoPhotoSelection();if(!selected.length)return;qoPhotoSnapshot();selected.forEach(o=>o.locked=locked);qoPhotoRefresh();}
function qoPhotoAlign(axis){const selected=qoPhotoSelection().filter(o=>!o.locked);if(!selected.length)return;qoPhotoSnapshot();const bounds=qoPhotoSelectionBounds(selected);for(const o of selected){const b=qoPhotoBounds(o);if(axis==='center')qoPhotoMove(o,bounds.x+bounds.w/2-(b.x+b.w/2),0);if(axis==='middle')qoPhotoMove(o,0,bounds.y+bounds.h/2-(b.y+b.h/2));if(axis==='canvas-center')qoPhotoMove(o,qoPhotoCanvasW/2-(bounds.x+bounds.w/2),0);if(axis==='canvas-middle')qoPhotoMove(o,0,qoPhotoCanvasH/2-(bounds.y+bounds.h/2));}qoPhotoRefresh();}
function qoPhotoRemoveSelection(){const ids=new Set(qoPhotoSelection().filter(o=>!o.locked).map(o=>o.id));if(!ids.size)return;qoPhotoSnapshot();qoPhotoStrokes=qoPhotoStrokes.filter(o=>!ids.has(o.id));qoPhotoSetSelection([]);qoPhotoRefresh();}
function qoPhotoDuplicateSelection(){const selected=qoPhotoSelection();if(!selected.length)return;qoPhotoSnapshot();const clones=selected.map(o=>structuredClone(o)),groups=new Map();for(const o of clones){o.id=qoPhotoId();if(o.groupId){if(!groups.has(o.groupId))groups.set(o.groupId,'g-'+qoPhotoId());o.groupId=groups.get(o.groupId);}o.locked=false;qoPhotoMove(o,24,24);}qoPhotoStrokes.push(...clones);qoPhotoSetSelection(clones.map(o=>o.id));qoPhotoRefresh();}
function qoPhotoUpdateSelectionInspector(){const inspector=document.querySelector('.qs-inspector');if(inspector)inspector.outerHTML=qoPhotoInspectorHTML();const sidebar=document.querySelector('.qs-sidebar');if(sidebar&&qoPhotoSidebar==='layers')sidebar.outerHTML=qoPhotoSidebarHTML();qoPhotoRender();}
function qoPhotoSidebarHTML(){const selected=qoPhotoObject();let body='';
 if(qoPhotoSidebar==='photos'){body='<div class="qs-side-section"><h4>Работа с фотографиями</h4><button class="qs-primary" data-action="photo-insert-image">Добавить фотографию</button><p>Выберите фото на холсте: коррекция, отражение и повторная обрезка доступны в свойствах. Исходник хранится в проекте.</p><button class="qs-secondary" data-action="photo-toggle-right">Открыть свойства</button></div>';}else if(qoPhotoSidebar==='drawing'){body=`<div class="qs-side-section"><h4>Кисть</h4>${qoPhotoElement('brush','Кисть','brush')}<label class="qs-inspector-label">Цвет<input id="qo-photo-color" type="color" value="${qoPhotoColor}"></label><label class="qs-inspector-label">Толщина<input id="qo-photo-size" type="range" min="1" max="60" value="${qoPhotoSize}"></label><p>Выберите кисть и рисуйте на холсте. Каждый штрих — отдельный слой.</p></div>`;}else if(qoPhotoSidebar==='templates'){
  body=`<div class="qs-side-section"><h4>Размер макета</h4><p>Популярные форматы для публикаций и документов</p><div class="qs-preset-list">${qoPhotoPresets.map(([key,name,w,h])=>`<button class="qs-preset" data-action="photo-preset" data-w="${w}" data-h="${h}"><span class="qs-preset-illustration ${key}"></span><span><strong>${name}</strong><small>${w} × ${h} px</small></span></button>`).join('')}</div></div><div class="qs-side-section"><h4>Готовые композиции</h4><p>Все элементы можно изменять после вставки</p><div class="qs-layout-choices"><button data-action="photo-template" data-template="poster"><span class="qs-template-prev poster">ВАШ<br>ЗАГОЛОВОК</span>Афиша</button><button data-action="photo-template" data-template="minimal"><span class="qs-template-prev minimal">ЗАГОЛОВОК<br><i>Подзаголовок</i></span>Минимализм</button></div></div>`;
 }else if(qoPhotoSidebar==='elements'){
  body=`<div class="qs-side-section"><h4>Фигуры</h4><div class="qs-elements">${qoPhotoElement('rect','Прямоугольник','square')}${qoPhotoElement('ellipse','Эллипс','ellipse')}${qoPhotoElement('line','Линия','line')}${qoPhotoElement('triangle','Треугольник','triangle')}</div></div><div class="qs-side-section"><h4>Рисование</h4><div class="qs-elements">${qoPhotoElement('brush','Кисть','brush')}${qoPhotoElement('select','Выделить','mouse-pointer')}</div><p>Для выделения элемента используйте инструмент «Выделить».</p></div>`;
 }else if(qoPhotoSidebar==='text'){
  body=`<div class="qs-side-section"><h4>Добавить текст</h4><button class="qs-text-template headline" data-action="photo-add-text" data-size="70">Добавить заголовок</button><button class="qs-text-template subheading" data-action="photo-add-text" data-size="38">Добавить подзаголовок</button><button class="qs-text-template paragraph" data-action="photo-add-text" data-size="24">Добавить основной текст</button></div>`;
 }else if(qoPhotoSidebar==='uploads'){
  body=`<div class="qs-side-section"><h4>Изображения</h4><button class="qs-primary" data-action="photo-insert-image">${qoWorkIcon('upload')} Добавить изображение</button><button class="qs-secondary" data-action="photo-load">Открыть фото как фон</button><p>Загруженное изображение добавляется отдельным редактируемым слоем.</p></div>`;
 }else if(qoPhotoSidebar==='layers'){
  body=`<div class="qs-side-section"><h4>Слои <span>${qoPhotoStrokes.length}</span></h4><p>Слои сверху находятся впереди остальных элементов</p><div class="qs-layer-list">${qoPhotoStrokes.slice().reverse().map((o,i)=>`<div class="qs-layer-row"><button class="qs-layer ${qoPhotoSelection().some(x=>x.id===o.id)?'active':''}" data-action="photo-select-layer" data-id="${esc(o.id)}" title="Shift или Ctrl — множественный выбор"><span class="qs-layer-icon">${qoWorkIcon(o.tool==='text'?'type':o.tool==='image'?'image':o.tool==='brush'?'brush':o.tool==='ellipse'?'ellipse':'square')}</span><span class="qs-layer-title">${esc(o.tool==='text'?(o.text||'Текст').slice(0,28):o.tool==='image'?'Изображение':o.tool==='brush'?'Кисть':o.tool==='rect'?'Прямоугольник':o.tool==='ellipse'?'Эллипс':'Линия')}${o.groupId?' · группа':''}</span><small>${qoPhotoStrokes.length-i}</small></button><button class="qs-layer-control" title="${o.hidden?'Показать':'Скрыть'}" data-action="photo-layer-visibility" data-id="${esc(o.id)}">${qoWorkIcon(o.hidden?'eye-off':'eye')}</button><button class="qs-layer-control" title="${o.locked?'Разблокировать':'Заблокировать'}" data-action="photo-layer-lock" data-id="${esc(o.id)}">${qoWorkIcon(o.locked?'lock':'unlock')}</button></div>`).join('')||'<p>Объектов пока нет.</p>'}</div></div>`;
 }else if(qoPhotoSidebar==='background'){
  const colors=['#ffffff','#151d31','#e5f7f2','#fff0d9','#e9dcff','#fbd9d8','#184d59','#f6cf56','#22b7ad','#f5f5f5'];
  body=`<div class="qs-side-section"><h4>Фон холста</h4><div class="qs-color-grid">${colors.map(c=>`<button data-action="photo-bg-color" data-color="${c}" title="${c}" aria-pressed="${c===qoPhotoBG}" style="background:${c};"></button>`).join('')}</div><label class="qs-inspector-label">Свой цвет<input type="color" id="qs-background-color" value="${qoPhotoBG}"></label><label class="qs-toggle"><input type="checkbox" id="qs-transparent" ${qoPhotoTransparent?'checked':''}> Прозрачный фон при экспорте</label></div><div class="qs-side-section"><h4>Размер документа</h4><div class="qs-dual"><label>Ширина<input type="number" id="qs-width" min="64" max="4096" value="${qoPhotoCanvasW}"></label><label>Высота<input type="number" id="qs-height" min="64" max="4096" value="${qoPhotoCanvasH}"></label></div><button class="qs-secondary" data-action="photo-resize">Применить размер</button></div>`;
 }
 return `<aside class="qs-sidebar" aria-label="${esc(qoPhotoSidebar)}"><div class="qs-sidebar-head"><strong>${({templates:'Шаблоны и форматы',elements:'Элементы',text:'Текст',uploads:'Загрузки',layers:'Слои',background:'Фон и размер',photos:'Фотографии',drawing:'Рисование'})[qoPhotoSidebar]}</strong></div><div class="qs-sidebar-scroll">${body}</div></aside>`;
}
function qoPhotoInspectorHTML(){const selected=qoPhotoSelection(),o=selected.length===1?selected[0]:null;const b=o?qoPhotoBounds(o):null;
 if(selected.length>1){const grouped=selected.every(x=>x.groupId&&x.groupId===selected[0].groupId);return `<aside class="qs-inspector"><div class="qs-inspector-head"><strong>Выделено объектов: ${selected.length}</strong><small>${grouped?'Группа':'Несколько слоёв'}</small></div><div class="qs-inspector-body"><div class="qs-inspector-tools">${qoPhotoButton('group', 'combine','Сгруппировать')}${qoPhotoButton('ungroup','split','Разгруппировать')}${qoPhotoButton('duplicate','copy','Дублировать')}${qoPhotoButton('delete','trash','Удалить')}</div><div class="qs-inspector-tools">${qoPhotoButton('lock','lock','Заблокировать')}${qoPhotoButton('unlock','unlock','Разблокировать')}</div><h4>Выравнивание</h4><div class="qs-inspector-tools">${qoPhotoButton('align-center','align-horizontal-justify-center','По горизонтали')}${qoPhotoButton('align-middle','align-vertical-justify-center','По вертикали')}${qoPhotoButton('canvas-center','move-horizontal','К центру страницы')}${qoPhotoButton('canvas-middle','move-vertical','К середине страницы')}</div><p>Перетаскивайте выделение целиком. Shift или Ctrl — добавить объект. Рамка на пустой области — выбрать несколько.</p></div></aside>`;}

 return `<aside class="qs-inspector"><div class="qs-inspector-head"><strong>${o?'Выбранный объект':'Свойства проекта'}</strong><small>${o?o.tool.toUpperCase():`${qoPhotoCanvasW} × ${qoPhotoCanvasH} px`}</small></div>${o?`
 <div class="qs-inspector-body">${o.tool==='image'?qoPhotoImageInspector(o):''}<div class="qs-inspector-tools">${qoPhotoButton('duplicate','copy','Дублировать')}${qoPhotoButton('front','arrow-up-to-line','Выше')}${qoPhotoButton('back','arrow-down-to-line','Ниже')}${qoPhotoButton('delete','trash','Удалить')}</div>
 <div class="qs-inspector-tools">${qoPhotoButton('lock','lock','Блокировать')}${qoPhotoButton('unlock','unlock','Разблокировать')}${o.groupId?qoPhotoButton('ungroup','split','Разгруппировать'):''}</div>
 <label class="qs-inspector-label">Прозрачность · ${Math.round((o.opacity??1)*100)}%<input id="qs-object-opacity" type="range" min="0" max="100" step="1" value="${Math.round((o.opacity??1)*100)}"></label>
 <label class="qs-inspector-label">Поворот (градусы)<input id="qs-object-rotation" type="number" min="-360" max="360" step="1" value="${o.rotation||0}"></label>
 <label class="qs-inspector-label">Цвет <input id="qs-object-color" type="color" value="${esc(o.color||'#12805b')}"></label>
 ${o.tool==='text'?`<label class="qs-inspector-label">Текст<textarea id="qs-object-text" rows="3" maxlength="500">${esc(o.text||'')}</textarea></label>${qoPhotoTextInspector(o)}<label class="qs-inspector-label">Размер шрифта<input id="qs-object-size" type="number" min="8" max="300" value="${o.size}"></label>`:o.tool!=='image'?`<label class="qs-inspector-label">Толщина линии<input id="qs-object-size" type="number" min="1" max="150" value="${o.size}"></label>`:''}
 ${['rect','ellipse'].includes(o.tool)?`<label class="qs-toggle"><input id="qs-object-filled" type="checkbox" ${o.fill?'checked':''}> Заливка фигуры</label>`:''}
 <div class="qs-dual"><label>X<input id="qs-object-x" type="number" value="${Math.round(b.x)}"></label><label>Y<input id="qs-object-y" type="number" value="${Math.round(b.y)}"></label></div>
 ${o.tool!=='brush'?`<div class="qs-dual"><label>Ширина<input id="qs-object-w" type="number" min="1" value="${Math.round(b.w)}"></label><label>Высота<input id="qs-object-h" type="number" min="1" value="${Math.round(b.h)}"></label></div>`:''}
 <p>Перетащите объект на холсте. Угловые маркеры — размер; круг сверху — поворот. Shift — пропорции / шаг 15°. Alt — свободный размер фото.</p></div>`:`
 <div class="qs-inspector-body"><label class="qs-inspector-label">Цвет инструмента<input id="qo-photo-color" type="color" value="${qoPhotoColor}"></label><label class="qs-inspector-label">Толщина кисти <output id="qs-brush-output">${qoPhotoSize}</output><input id="qo-photo-size" type="range" min="1" max="60" value="${qoPhotoSize}"></label>
 <h4>Коррекция фонового фото</h4>${[['brightness','Яркость'],['contrast','Контраст'],['saturation','Насыщенность']].map(([key,label])=>`<label class="qs-adjust">${label}<output>${qoPhotoAdjust[key]}%</output><input type="range" data-photo-adjust="${key}" min="0" max="200" value="${qoPhotoAdjust[key]}"></label>`).join('')}
 ${qoPhotoButton('reset','sun','Сбросить коррекцию')}</div>`}</aside>`;
}
function qoPhotoPage(){return `<main class="qo-photo-workspace qs-studio ${qoPhotoLeftOpen?'qs-left-open':''} ${qoPhotoRightOpen?'qs-right-open':''}" aria-label="Quantum Studio">
 <header class="qs-editor-toolbar"><div class="qs-toolbar-left">${qoPhotoButton('toggle-left','panel-left','Левая панель')}${qoPhotoButton('undo','undo','Отменить',!qoPhotoHistory.length?'disabled':'')}${qoPhotoButton('redo','redo','Повторить',!qoPhotoRedo.length?'disabled':'')}<span class="qs-divider"></span>${qoPhotoButton('select-tool','mouse-pointer','Выделение',qoPhotoTool==='select'?'aria-pressed="true"':'')}${qoPhotoButton('hand-tool','hand','Перемещение холста',qoPhotoTool==='hand'?'aria-pressed="true"':'')}${qoPhotoButton('brush-tool','brush','Кисть',qoPhotoTool==='brush'?'aria-pressed="true"':'')}${qoPhotoButton('add-text','type','Текст')}${qoPhotoButton('insert-image','image','Изображение')}</div><div class="qs-toolbar-right"><span class="qs-saved-indicator">${qoPhotoDraftSaved?'Черновик сохранён':'Скачайте QSTUDIO'}</span>${qoPhotoButton('toggle-right','sliders-horizontal','Свойства')}${qoPhotoButton('export-project','save','Проект QSTUDIO')}${qoPhotoButton('export','download','PNG')}</div></header>
 <section class="qs-editor-layout"><nav class="qs-nav" aria-label="Разделы редактора">
 ${qoPhotoSideButton('templates','layout-template','Шаблоны')}${qoPhotoSideButton('elements','shapes','Элементы')}${qoPhotoSideButton('text','type','Текст')}${qoPhotoSideButton('uploads','upload','Загрузки')}${qoPhotoSideButton('photos','image','Фото')}${qoPhotoSideButton('drawing','brush','Рисование')}${qoPhotoSideButton('layers','layers','Слои')}${qoPhotoSideButton('background','settings','Настройки')}</nav>
 ${qoPhotoSidebarHTML()}
 <div class="qs-center"><div class="qs-canvas-stage" id="qs-stage"><div class="qs-stage-inner"><canvas id="qo-photo-canvas" width="${qoPhotoCanvasW}" height="${qoPhotoCanvasH}" aria-label="Холст редактора дизайна"></canvas></div></div>
 <footer class="qs-bottom"><div class="qs-document-size">${qoPhotoCanvasW} × ${qoPhotoCanvasH} px · ${qoPhotoStrokes.length} слоёв</div><div class="qs-zoom"><button data-action="photo-zoom-out" title="Уменьшить">−</button><input id="qs-zoom" type="range" min="10" max="200" step="5" value="${Math.round(qoPhotoZoom*100)}"><button data-action="photo-zoom-in" title="Увеличить">+</button><span id="qs-zoom-label">${Math.round(qoPhotoZoom*100)}%</span><button data-action="photo-fit" class="qs-fit">Вписать</button></div></footer></div>
 ${qoPhotoInspectorHTML()}</section>
 <input type="file" id="qo-photo-file" hidden accept="image/png,image/jpeg,image/webp,.qstudio,application/json">
 <input type="file" id="qs-image-file" hidden accept="image/png,image/jpeg,image/webp">
 </main>`;}
function qoPhotoState(){return {version:1,name:qoPhotoFile,width:qoPhotoCanvasW,height:qoPhotoCanvasH,bg:qoPhotoBG,transparent:qoPhotoTransparent,strokes:structuredClone(qoPhotoStrokes),adjust:{...qoPhotoAdjust},imageSrc:qoPhotoImageSrc};}
function qoPhotoSnapshot(){qoPhotoHistory.push(qoPhotoState());if(qoPhotoHistory.length>35)qoPhotoHistory.shift();qoPhotoRedo=[];}
function qoPhotoLoadImageSrc(src){qoPhotoImageSrc=src||'';qoPhotoImage=null;if(src){const img=new Image();img.onload=()=>{if(qoPhotoImageSrc===src){qoPhotoImage=img;qoPhotoRender();}};img.src=src;}}
function qoPhotoApplyState(v){v=validateStudioProject(v);qoPhotoCompare=false;qoPhotoStrokes=v.strokes||[];qoPhotoCanvasW=v.width||1100;qoPhotoCanvasH=v.height||650;qoPhotoBG=v.bg||'#ffffff';qoPhotoTransparent=!!v.transparent;qoPhotoAdjust=v.adjust||{brightness:100,contrast:100,saturation:100};qoPhotoFile=v.name||'Без названия';qoPhotoSelectedId=null;qoPhotoSelectedIds.clear();qoPhotoCounter=Math.max(qoPhotoCounter,...qoPhotoStrokes.map(o=>Number((o.id||'').split('-')[1])||0))+1;qoPhotoLoadImageSrc(v.imageSrc||'');}
function qoPhotoPersist(){try{localStorage.setItem(qoPhotoStorageKey,JSON.stringify(qoPhotoState()));qoPhotoDraftSaved=true;}catch{qoPhotoDraftSaved=false;}const indicator=document.querySelector('.qs-saved-indicator');if(indicator)indicator.textContent=qoPhotoDraftSaved?'Черновик сохранён':'Скачайте QSTUDIO · черновик не сохранён';}
function qoPhotoObject(){return qoPhotoStrokes.find(o=>o.id===qoPhotoSelectedId)||null;}
function qoPhotoBounds(o){const a=o.points?.[0]||[0,0],last=o.points?.at(-1)||a;
 if(o.tool==='text')return qoPhotoTextBounds(o);
 if(o.tool==='image')return {x:a[0],y:a[1],w:o.w||200,h:o.h||150};
 const pts=o.points||[a];const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);const pad=o.tool==='brush'||o.tool==='line'?o.size/2:0;
 return {x:Math.min(...xs)-pad,y:Math.min(...ys)-pad,w:Math.max(1,Math.max(...xs)-Math.min(...xs)+pad*2),h:Math.max(1,Math.max(...ys)-Math.min(...ys)+pad*2)};
}
function qoPhotoDrawObject(ctx,o){if(o.hidden)return;const pts=o.points||[],a=pts[0];if(!a)return;ctx.save();ctx.globalAlpha=Math.max(0,Math.min(1,o.opacity??1));if(o.rotation){const b=qoPhotoBounds(o);ctx.translate(b.x+b.w/2,b.y+b.h/2);ctx.rotate(Number(o.rotation)*Math.PI/180);ctx.translate(-b.x-b.w/2,-b.y-b.h/2);}ctx.lineWidth=Math.max(1,o.size||4);ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=o.color||'#137f5d';ctx.fillStyle=o.color||'#137f5d';
 if(o.tool==='text'){qoPhotoDrawText(ctx,o);}
 else if(o.tool==='image'){let img=qoPhotoImages.get(o.src);if(!img&&o.src){img=new Image();img.onload=()=>qoPhotoRender();img.src=o.src;qoPhotoImages.set(o.src,img);}if(img?.complete&&img.naturalWidth)qoPhotoDrawImage(ctx,o,img);}
 else if(o.tool==='triangle'){const b=qoPhotoBounds(o);ctx.beginPath();ctx.moveTo(b.x+b.w/2,b.y);ctx.lineTo(b.x+b.w,b.y+b.h);ctx.lineTo(b.x,b.y+b.h);ctx.closePath();o.fill?ctx.fill():ctx.stroke();}
 else if(o.tool==='rect'){const b=pts.at(-1);if(b){const x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]),w=Math.abs(b[0]-a[0]),h=Math.abs(b[1]-a[1]);o.fill?ctx.fillRect(x,y,w,h):ctx.strokeRect(x,y,w,h);}}
 else if(o.tool==='ellipse'){const b=pts.at(-1);if(b){const cx=(a[0]+b[0])/2,cy=(a[1]+b[1])/2,rx=Math.abs(a[0]-b[0])/2,ry=Math.abs(a[1]-b[1])/2;if(rx&&ry){ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);o.fill?ctx.fill():ctx.stroke();}}}
 else{ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(pts.length===1)ctx.lineTo(a[0]+.1,a[1]+.1);ctx.stroke();}ctx.restore();}
function qoPhotoPaint(ctx,overlay=false){const w=ctx.canvas.width,h=ctx.canvas.height;ctx.clearRect(0,0,w,h);if(!qoPhotoTransparent){ctx.fillStyle=qoPhotoBG;ctx.fillRect(0,0,w,h);}if(qoPhotoImage){ctx.save();ctx.filter=`brightness(${qoPhotoAdjust.brightness}%) contrast(${qoPhotoAdjust.contrast}%) saturate(${qoPhotoAdjust.saturation}%)`;const f=Math.min(w/qoPhotoImage.naturalWidth,h/qoPhotoImage.naturalHeight);const iw=qoPhotoImage.naturalWidth*f,ih=qoPhotoImage.naturalHeight*f;ctx.drawImage(qoPhotoImage,(w-iw)/2,(h-ih)/2,iw,ih);ctx.restore();}
 for(const o of qoPhotoStrokes)qoPhotoDrawObject(ctx,o);if(qoPhotoActiveStroke)qoPhotoDrawObject(ctx,qoPhotoActiveStroke);
 if(overlay){const selected=qoPhotoSelection();if(selected.length)qoPhotoDrawHandles(ctx,selected);qoPhotoDrawGuides(ctx);if(qoPhotoMarquee){const a=qoPhotoMarquee.start,p=qoPhotoMarquee.end;ctx.save();ctx.setLineDash([5,5]);const uiAccent=getComputedStyle(document.documentElement).getPropertyValue('--qo-paper-accent').trim();ctx.fillStyle=uiAccent;ctx.strokeStyle=uiAccent;ctx.globalAlpha=.13;ctx.fillRect(Math.min(a[0],p[0]),Math.min(a[1],p[1]),Math.abs(a[0]-p[0]),Math.abs(a[1]-p[1]));ctx.globalAlpha=1;ctx.strokeRect(Math.min(a[0],p[0]),Math.min(a[1],p[1]),Math.abs(a[0]-p[0]),Math.abs(a[1]-p[1]));ctx.restore();}}
}
function qoPhotoRender(){const canvas=document.getElementById('qo-photo-canvas');if(!canvas)return;if(canvas.width!==qoPhotoCanvasW)canvas.width=qoPhotoCanvasW;if(canvas.height!==qoPhotoCanvasH)canvas.height=qoPhotoCanvasH;canvas.style.cursor=qoPhotoTool==='hand'?'grab':qoPhotoTool==='select'?'default':'crosshair';canvas.style.width=Math.round(qoPhotoCanvasW*qoPhotoZoom)+'px';canvas.style.height=Math.round(qoPhotoCanvasH*qoPhotoZoom)+'px';const ctx=canvas.getContext('2d');if(ctx)qoPhotoPaint(ctx,true);}
function qoPhotoCoords(e){const c=document.getElementById('qo-photo-canvas'),r=c.getBoundingClientRect();return [Math.max(0,Math.min(qoPhotoCanvasW,(e.clientX-r.left)*qoPhotoCanvasW/r.width)),Math.max(0,Math.min(qoPhotoCanvasH,(e.clientY-r.top)*qoPhotoCanvasH/r.height))];}
function qoPhotoHit(pos){for(let i=qoPhotoStrokes.length-1;i>=0;i--){if(qoPhotoStrokes[i].hidden)continue;const obj=qoPhotoStrokes[i],b=qoPhotoBounds(obj);const local=rotatePoint(pos,[b.x+b.w/2,b.y+b.h/2],-(obj.rotation||0)),margin=Math.max(9,qoPhotoStrokes[i].size/2||5);if(local[0]>=b.x-margin&&local[0]<=b.x+b.w+margin&&local[1]>=b.y-margin&&local[1]<=b.y+b.h+margin)return qoPhotoStrokes[i];}return null;}
function qoPhotoMove(o,dx,dy){o.points.forEach(p=>{p[0]+=dx;p[1]+=dy;});}
function qoPhotoResizeObject(o,w,h){w=Math.max(8,w);h=Math.max(8,h);const b=qoPhotoBounds(o);if(o.tool==='image'){o.w=w;o.h=h;}else if(o.tool==='text'){o.size=Math.max(8,Math.min(300,o.size*h/b.h));}else{const fx=w/Math.max(1,b.w),fy=h/Math.max(1,b.h);o.points.forEach(p=>{p[0]=b.x+(p[0]-b.x)*fx;p[1]=b.y+(p[1]-b.y)*fy;});}}
function qoPhotoRefresh(){if(!qoPhotoSelectedId)qoPhotoSelectedIds.clear();else if(!qoPhotoSelectedIds.has(qoPhotoSelectedId)){qoPhotoSelectedIds.clear();qoPhotoSelectedIds.add(qoPhotoSelectedId);}render();qoPhotoPersist();}
function qoPhotoAdd(tool,options={}){qoPhotoSnapshot();const mid=[qoPhotoCanvasW/2,qoPhotoCanvasH/2];let o={id:qoPhotoId(),tool,color:qoPhotoColor,size:tool==='text'?options.size||42:Math.max(2,qoPhotoSize),fill:false,points:[[mid[0]-100,mid[1]-70],[mid[0]+100,mid[1]+70]]};
 if(tool==='text')o={...o,points:[[mid[0]-180,mid[1]]],text:options.text||'Ваш текст',bold:options.size>=60};
 if(tool==='line')o.points=[[mid[0]-110,mid[1]],[mid[0]+110,mid[1]]];
 if(tool==='brush'){qoPhotoTool='brush';qoPhotoSidebar='elements';qoPhotoSelectedId=null;qoPhotoHistory.pop();qoPhotoRefresh();return;}
 if(tool==='select'){qoPhotoTool='select';qoPhotoHistory.pop();qoPhotoRefresh();return;}
 qoPhotoStrokes.push(o);qoPhotoSetSelection([o.id]);qoPhotoTool='select';qoPhotoRefresh();}
function qoPhotoChangeSize(w,h){w=Math.round(Number(w));h=Math.round(Number(h));if(!Number.isFinite(w)||!Number.isFinite(h)||w<64||h<64||w>4096||h>4096){status('Размер: от 64 до 4096 px',true);return;}qoPhotoSnapshot();qoPhotoCanvasW=w;qoPhotoCanvasH=h;qoPhotoSelectedId=null;qoPhotoRefresh();qoPhotoFit();}
function qoPhotoFit(){const stage=document.getElementById('qs-stage');if(!stage)return;qoPhotoZoom=Math.min(1.5,Math.max(.1,Math.min((stage.clientWidth-90)/qoPhotoCanvasW,(stage.clientHeight-90)/qoPhotoCanvasH)));qoPhotoRender();const r=document.getElementById('qs-zoom');if(r)r.value=Math.round(qoPhotoZoom*100);const l=document.getElementById('qs-zoom-label');if(l)l.textContent=Math.round(qoPhotoZoom*100)+'%';}
function qoPhotoZoomTo(value){qoPhotoZoom=Math.max(.1,Math.min(2,Number(value)));qoPhotoRender();const r=document.getElementById('qs-zoom');if(r)r.value=Math.round(qoPhotoZoom*100);const l=document.getElementById('qs-zoom-label');if(l)l.textContent=Math.round(qoPhotoZoom*100)+'%';}
function qoPhotoFileDownload(name,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
async function qoPhotoExport(){try{await qoPhotoWaitImages();}catch(error){status(error.message,true);return;}const c=document.createElement('canvas');c.width=qoPhotoCanvasW;c.height=qoPhotoCanvasH;const compare=qoPhotoCompare;qoPhotoCompare=false;try{qoPhotoPaint(c.getContext('2d'),false);}finally{qoPhotoCompare=compare;}c.toBlob(blob=>{if(!blob)return status('Не удалось экспортировать PNG',true);const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=safeFile(qoPhotoFile.replace(/\.[^.]+$/,''))+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);},'image/png');}
function qoPhotoExportProject(){qoPhotoFileDownload(safeFile(qoPhotoFile.replace(/\.[^.]+$/,''))+'.qstudio',JSON.stringify(qoPhotoState()),'application/json');}
async function qoPhotoReadImage(file){if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8_000_000)throw Error('Изображение: PNG, JPEG или WebP до 8 МБ');return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Ошибка чтения файла'));r.readAsDataURL(file);});}
async function qoPhotoFileLoad(file){if(file.name.toLowerCase().endsWith('.qstudio')){const v=JSON.parse(await file.text());if(!v||v.version!==1||!Array.isArray(v.strokes)||v.strokes.length>5000||v.width<64||v.width>4096||v.height<64||v.height>4096)throw Error('Некорректный проект QSTUDIO');qoPhotoApplyState(v);qoPhotoHistory=[];qoPhotoRedo=[];qoPhotoRefresh();qoPhotoFit();return;}
 const src=await qoPhotoReadImage(file);qoPhotoSnapshot();qoPhotoLoadImageSrc(src);qoPhotoFile=file.name;qoPhotoAdjust={brightness:100,contrast:100,saturation:100};qoPhotoSelectedId=null;qoPhotoRefresh();}
async function qoPhotoInsertImage(file){const src=await qoPhotoReadImage(file);const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Ошибка изображения'));i.src=src;});qoPhotoImages.set(src,img);qoPhotoSnapshot();const scale=Math.min(1,qoPhotoCanvasW*.65/img.naturalWidth,qoPhotoCanvasH*.65/img.naturalHeight),w=Math.max(12,Math.round(img.naturalWidth*scale)),h=Math.max(12,Math.round(img.naturalHeight*scale));const o={id:qoPhotoId(),tool:'image',src,color:'#000000',size:1,points:[[(qoPhotoCanvasW-w)/2,(qoPhotoCanvasH-h)/2]],w,h};qoPhotoStrokes.push(o);qoPhotoSetSelection([o.id]);qoPhotoTool='select';qoPhotoRefresh();}
try{const saved=JSON.parse(localStorage.getItem(qoPhotoStorageKey)||'null');if(saved?.version===1&&Array.isArray(saved.strokes))qoPhotoApplyState(saved);}catch{}

// TASK095: transforms, non-destructive image layers and text editing.
function qoPhotoVisualBounds(o){const b=qoPhotoBounds(o),c=[b.x+b.w/2,b.y+b.h/2],p=[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]].map(p=>rotatePoint(p,c,o.rotation||0));return {x:Math.min(...p.map(p=>p[0])),y:Math.min(...p.map(p=>p[1])),w:Math.max(...p.map(p=>p[0]))-Math.min(...p.map(p=>p[0])),h:Math.max(...p.map(p=>p[1]))-Math.min(...p.map(p=>p[1]))};}
function qoPhotoHandles(o){const b=qoPhotoBounds(o),c=[b.x+b.w/2,b.y+b.h/2];return [[b.x,b.y,'nw'],[b.x+b.w,b.y,'ne'],[b.x+b.w,b.y+b.h,'se'],[b.x,b.y+b.h,'sw'],[b.x+b.w/2,b.y-28/qoPhotoZoom,'rotate']].map(([x,y,key])=>({point:rotatePoint([x,y],c,o.rotation||0),key}));}
function qoPhotoDrawHandles(ctx,selected){ctx.save();ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--qo-paper-accent').trim()||'#19805c';ctx.lineWidth=1.5/qoPhotoZoom;if(selected.length===1){const o=selected[0],h=qoPhotoHandles(o);ctx.beginPath();h.slice(0,4).forEach((p,i)=>i?ctx.lineTo(...p.point):ctx.moveTo(...p.point));ctx.closePath();ctx.stroke();if(!o.locked){const b=qoPhotoBounds(o),top=rotatePoint([b.x+b.w/2,b.y],[b.x+b.w/2,b.y+b.h/2],o.rotation||0);ctx.beginPath();ctx.moveTo(...top);ctx.lineTo(...h[4].point);ctx.stroke();for(const {point:p,key} of h){const r=4/qoPhotoZoom;ctx.fillStyle='white';ctx.beginPath();key==='rotate'?ctx.arc(...p,r*1.3,0,Math.PI*2):ctx.rect(p[0]-r,p[1]-r,r*2,r*2);ctx.fill();ctx.stroke();}}}else{const b=qoPhotoSelectionBounds(selected);ctx.setLineDash([5/qoPhotoZoom,4/qoPhotoZoom]);ctx.strokeRect(b.x,b.y,b.w,b.h);}ctx.restore();}
function qoPhotoDrawGuides(ctx){ctx.save();ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--qo-guide').trim();ctx.lineWidth=1/qoPhotoZoom;ctx.setLineDash([4/qoPhotoZoom,3/qoPhotoZoom]);for(const [axis,v] of qoPhotoGuides){ctx.beginPath();if(axis==='x'){ctx.moveTo(v,0);ctx.lineTo(v,qoPhotoCanvasH);}else{ctx.moveTo(0,v);ctx.lineTo(qoPhotoCanvasW,v);}ctx.stroke();}if(qoPhotoDrag?.mode==='rotate'){ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--qo-paper-accent').trim();ctx.font=`${12/qoPhotoZoom}px sans-serif`;ctx.fillText(`${Math.round(qoPhotoObject()?.rotation||0)}°`,qoPhotoDrag.prev[0]+15/qoPhotoZoom,qoPhotoDrag.prev[1]);}ctx.restore();}
function qoPhotoDrawImage(ctx,o,img){ctx.save();if(!(qoPhotoCompare&&o.id===qoPhotoSelectedId))ctx.filter=photoFilter(o.adjust);const c=o.crop||{x:0,y:0,w:1,h:1};ctx.translate(o.points[0][0]+o.w/2,o.points[0][1]+o.h/2);ctx.scale(o.flipX?-1:1,o.flipY?-1:1);ctx.drawImage(img,c.x*img.naturalWidth,c.y*img.naturalHeight,c.w*img.naturalWidth,c.h*img.naturalHeight,-o.w/2,-o.h/2,o.w,o.h);ctx.restore();}
async function qoPhotoWaitImages(){const sources=[qoPhotoImageSrc,...qoPhotoStrokes.filter(o=>o.tool==='image'&&!o.hidden).map(o=>o.src)].filter(Boolean);await Promise.all(sources.map(src=>new Promise((resolve,reject)=>{let img=qoPhotoImages.get(src);if(!img){img=new Image();qoPhotoImages.set(src,img);img.src=src;}if(img.complete){img.naturalWidth?resolve():reject(Error('Изображение не загружено'));return;}img.addEventListener('load',resolve,{once:true});img.addEventListener('error',()=>reject(Error('Не удалось прочитать изображение')),{once:true});})));if(qoPhotoImageSrc)qoPhotoImage=qoPhotoImages.get(qoPhotoImageSrc);}
function qoPhotoImageInspector(o){const a={...PHOTO_DEFAULTS,...o.adjust},c=o.crop||{x:0,y:0,w:1,h:1};return `<section class="qs-photo-properties"><h4>Фотография</h4><div class="qs-inspector-tools">${qoPhotoButton('flip-x','flip-horizontal','Отразить ↔')}${qoPhotoButton('flip-y','flip-vertical','Отразить ↕')}${qoPhotoButton('compare','eye',qoPhotoCompare?'Вернуть коррекцию':'Без коррекции',`aria-pressed="${qoPhotoCompare}"`)}</div><details open><summary>Свет и цвет</summary>${[['brightness','Яркость',0,200,1,'%'],['contrast','Контраст',0,200,1,'%'],['saturation','Насыщенность',0,200,1,'%'],['exposure','Экспозиция',-3,3,.1,' EV'],['blur','Размытие',0,20,.5,' px']].map(([key,label,min,max,step,unit])=>`<label class="qs-adjust">${label}<output>${a[key]}${unit}</output><input aria-label="${label} фотографии" data-layer-adjust="${key}" data-unit="${unit}" type="range" min="${min}" max="${max}" step="${step}" value="${a[key]}" ${o.locked?'disabled':''}></label>`).join('')}<label class="qs-inspector-label">Фильтр<select data-layer-adjust="filter" aria-label="Фильтр фотографии" ${o.locked?'disabled':''}>${[['none','Оригинал'],['mono','Монохром'],['sepia','Сепия'],['vivid','Насыщенный']].map(([id,label])=>`<option value="${id}" ${id===a.filter?'selected':''}>${label}</option>`).join('')}</select></label><label class="qs-adjust">Интенсивность<output>${a.intensity}%</output><input data-layer-adjust="intensity" data-unit="%" aria-label="Интенсивность фильтра" type="range" min="0" max="100" value="${a.intensity}" ${o.locked?'disabled':''}></label>${qoPhotoButton('layer-reset','sun','Сбросить коррекцию')}</details><details><summary>Обрезка · исходник сохранён</summary><p>Отступы от краёв исходника, %. Обрезку можно менять повторно.</p><div class="qs-dual">${[['left','Слева',c.x*100],['top','Сверху',c.y*100],['right','Справа',(1-c.x-c.w)*100],['bottom','Снизу',(1-c.y-c.h)*100]].map(([id,label,value])=>`<label>${label}<input type="number" data-qs-crop="${id}" aria-label="Обрезка ${label.toLowerCase()}" min="0" max="95" step=".5" value="${Math.round(value*10)/10}"></label>`).join('')}</div><div class="qs-inspector-tools">${qoPhotoButton('crop-apply','crop','Обрезать')}${qoPhotoButton('crop-reset','rotate-ccw','Весь исходник')}</div></details><p class="qs-original-note">Коррекция и обрезка применяются к этому слою. Исходное фото остаётся в QSTUDIO.</p></section>`;}
function qoPhotoFont(o){return `${o.bold?'700':'400'} ${o.size||30}px "${['Segoe UI','Arial','Georgia','Verdana','Courier New'].includes(o.font)?o.font:'Segoe UI'}"`;}
function qoPhotoTextBounds(o){const ctx=document.createElement('canvas').getContext('2d');ctx.font=qoPhotoFont(o);const lines=(o.text||'').split('\n'),a=o.points[0],space=Number(o.spacing)||0,w=Math.max(16,...lines.map(t=>ctx.measureText(t).width+Math.max(0,t.length-1)*space));return {x:a[0],y:a[1]-o.size,w,h:o.size*1.25*lines.length};}
function qoPhotoDrawText(ctx,o){ctx.font=qoPhotoFont(o);const b=qoPhotoTextBounds(o),spacing=Number(o.spacing)||0;for(const [i,line] of (o.text||'').split('\n').entries()){const width=ctx.measureText(line).width+Math.max(0,line.length-1)*spacing;let x=b.x+(o.align==='center'?(b.w-width)/2:o.align==='right'?b.w-width:0),y=o.points[0][1]+i*o.size*1.25;for(const ch of line){ctx.fillText(ch,x,y);x+=ctx.measureText(ch).width+spacing;}}}
function qoPhotoTextInspector(o){return `<label class="qs-inspector-label">Шрифт<select data-qs-text="font">${['Segoe UI','Arial','Georgia','Verdana','Courier New'].map(f=>`<option ${o.font===f?'selected':''}>${f}</option>`).join('')}</select></label><div class="qs-dual"><label>Интервал<input type="number" min="-3" max="30" data-qs-text="spacing" value="${o.spacing||0}"></label><label>Выравнивание<select data-qs-text="align">${[['left','Слева'],['center','Центр'],['right','Справа']].map(([id,label])=>`<option value="${id}" ${(o.align||'left')===id?'selected':''}>${label}</option>`).join('')}</select></label></div><label class="qs-toggle"><input type="checkbox" data-qs-text="bold" ${o.bold?'checked':''}>Полужирный</label>`;}
function qoPhotoExtraAction(action,target){
 if(action==='photo-hand-tool'){qoPhotoTool=qoPhotoTool==='hand'?'select':'hand';qoPhotoRefresh();return true;}
 if(action==='photo-toggle-left'||action==='photo-toggle-right'){if(action.endsWith('left')){qoPhotoLeftOpen=!qoPhotoLeftOpen;if(qoPhotoLeftOpen&&innerWidth<=1100)qoPhotoRightOpen=false;}else{qoPhotoRightOpen=!qoPhotoRightOpen;if(qoPhotoRightOpen&&innerWidth<=1100)qoPhotoLeftOpen=false;}qoPhotoRefresh();return true;}
 if(action==='photo-compare'){qoPhotoCompare=!qoPhotoCompare;qoPhotoUpdateSelectionInspector();return true;}
 if(!['photo-flip-x','photo-flip-y','photo-layer-reset','photo-crop-apply','photo-crop-reset'].includes(action))return false;
 const o=qoPhotoObject();if(!o||o.tool!=='image'||o.locked)return true;
 let crop;if(action==='photo-crop-apply'){try{crop=photoCrop(...['left','top','right','bottom'].map(id=>document.querySelector(`[data-qs-crop="${id}"]`)?.value));}catch(error){status(error.message,true);return true;}}
 qoPhotoSnapshot();qoPhotoCompare=false;
 if(action==='photo-flip-x')o.flipX=!o.flipX;else if(action==='photo-flip-y')o.flipY=!o.flipY;else if(action==='photo-layer-reset')o.adjust={...PHOTO_DEFAULTS};else{crop??={x:0,y:0,w:1,h:1};o.crop=crop;const img=qoPhotoImages.get(o.src);if(img?.naturalWidth)o.h=Math.max(8,o.w*img.naturalHeight*crop.h/(img.naturalWidth*crop.w));}qoPhotoRefresh();return true;
}
let qoPhotoPan=null,qoPhotoSpace=false,qoPhotoBrushRedo=null;
window.addEventListener('keydown',e=>{if(page==='photo'&&e.code==='Space'&&!e.target.closest?.('input,textarea,select,[contenteditable]')){qoPhotoSpace=true;e.preventDefault();}});
window.addEventListener('keyup',e=>{if(e.code==='Space')qoPhotoSpace=false;});
app.addEventListener('pointerdown',e=>{const stage=e.target.closest('#qs-stage');if(page!=='photo'||!stage||(!qoPhotoSpace&&qoPhotoTool!=='hand'&&e.button!==1))return;qoPhotoPan={stage,x:e.clientX,y:e.clientY,left:stage.scrollLeft,top:stage.scrollTop};stage.setPointerCapture(e.pointerId);e.preventDefault();e.stopImmediatePropagation();},true);
window.addEventListener('pointermove',e=>{if(!qoPhotoPan)return;const d=qoPhotoPan;d.stage.scrollLeft=d.left-(e.clientX-d.x);d.stage.scrollTop=d.top-(e.clientY-d.y);});
window.addEventListener('pointerup',()=>{qoPhotoPan=null;});window.addEventListener('blur',()=>{qoPhotoPan=null;qoPhotoSpace=false;});
let qoLayerAdjustTransaction=null,qoBackgroundAdjustTransaction=null;
app.addEventListener('input',e=>{if(!e.target.matches('[data-photo-adjust]'))return;if(qoBackgroundAdjustTransaction!==e.target){qoPhotoSnapshot();qoBackgroundAdjustTransaction=e.target;}},true);
app.addEventListener('change',e=>{if(e.target.matches('[data-photo-adjust]')){qoBackgroundAdjustTransaction=null;qoPhotoRefresh();}},true);
app.addEventListener('input',e=>{const t=e.target;if(!t.matches('[data-layer-adjust]'))return;const o=qoPhotoObject();if(!o||o.tool!=='image'||o.locked)return;if(qoLayerAdjustTransaction!==t){qoPhotoSnapshot();qoLayerAdjustTransaction=t;}o.adjust={...PHOTO_DEFAULTS,...o.adjust,[t.dataset.layerAdjust]:t.dataset.layerAdjust==='filter'?t.value:Number(t.value)};qoPhotoCompare=false;if(t.previousElementSibling?.tagName==='OUTPUT')t.previousElementSibling.textContent=t.value+(t.dataset.unit||'');qoPhotoRender();},true);
app.addEventListener('change',e=>{const t=e.target;if(t.matches('[data-layer-adjust]')){qoLayerAdjustTransaction=null;qoPhotoPersist();qoPhotoUpdateSelectionInspector();return;}if(t.matches('[data-qs-text]')){const o=qoPhotoObject();if(!o||o.tool!=='text'||o.locked)return;qoPhotoSnapshot();const key=t.dataset.qsText;o[key]=key==='bold'?t.checked:key==='spacing'?Math.max(-3,Math.min(30,Number(t.value)||0)):t.value;qoPhotoRefresh();}},true);
app.addEventListener('dblclick',e=>{if(page!=='photo'||e.target.id!=='qo-photo-canvas')return;const o=qoPhotoHit(qoPhotoCoords(e));if(!o||o.tool!=='text'||o.locked)return;qoPhotoSetSelection([o.id]);const c=e.target.getBoundingClientRect(),b=qoPhotoBounds(o),el=document.createElement('textarea');el.className='qs-inline-text';el.setAttribute('aria-label','Текст на холсте');el.value=o.text;el.maxLength=500;Object.assign(el.style,{position:'fixed',left:c.left+b.x*qoPhotoZoom+'px',top:c.top+b.y*qoPhotoZoom+'px',width:Math.max(180,b.w*qoPhotoZoom+24)+'px',height:Math.max(80,b.h*qoPhotoZoom+24)+'px',font:qoPhotoFont({...o,size:o.size*qoPhotoZoom}),color:o.color,transform:`rotate(${o.rotation||0}deg)`});document.body.append(el);let done=false;const finish=cancel=>{if(done)return;done=true;if(!cancel&&el.value!==o.text){qoPhotoSnapshot();o.text=el.value;qoPhotoRefresh();}el.remove();};el.onkeydown=e=>{e.stopPropagation();if(e.key==='Escape')finish(true);if((e.ctrlKey||e.metaKey)&&e.key==='Enter')finish(false);};el.onblur=()=>finish(false);el.focus();el.select();});

function placeholder(kind){const writer=kind==='writer';return `<main class="soon"><div class="soon-icon">${writer?'▤':'▣'}</div><span class="eyebrow">РАЗДЕЛ ЗАПЛАНИРОВАН</span><h1>${writer?'Quantum Writer':'Quantum Slides'}</h1><p>${writer?'Редактор текстов':'Редактор презентаций'} будет разработан после стабилизации таблиц. Мы не выдаём пустую имитацию за работающий редактор.</p><button class="primary-btn" data-action="route" data-target="sheet" aria-label="Таблицы" title="Таблицы">Перейти к таблицам →</button></main>`;}
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
 if(m.kind==='all')return '<div id="size-context-menu" class="size-context-menu" style="'+style+'" role="menu">'+
  '<strong class="context-title">Весь лист</strong><button data-action="size-context-mode" data-kind="row" role="menuitem">Высота всех строк…</button>'+
  '<button data-action="size-context-mode" data-kind="col" role="menuitem">Ширина всех столбцов…</button></div>';
 if(m.kind==='cell'){
  const multi=selectedRects().some(a=>a.r1!==a.r2||a.c1!==a.c2)||selectedRects().length>1;
  const selection=rectangle(activeCell,rangeEnd),sortAvailable=multi&&selectedRects().length===1&&selection&&selection.r1<selection.r2;
  const key=(sortAvailable&&m.sortColumn>=selection.c1&&m.sortColumn<=selection.c2)?m.sortColumn:selection?.c1;
  const placeLeft=m.x+230+258>window.innerWidth;
  const headerWords=sortAvailable?Array.from({length:selection.c2-selection.c1+1},(_,i)=>getCell(sheet(),cellName(selection.r1,selection.c1+i)).value.trim().toLocaleLowerCase('ru-RU')):[];
  const likelyHeader=headerWords.some(v=>/^(?:имя|имена|фамилия|фамилии|фио|ученик|ученики|родитель|родители|оценка|оценки|баллы|класс|предмет|телефон|контакт|группа|дата|ссылка|профиль|стоимость|оплачено|время|статус|примечание)$/.test(v));
  const submenu=sortAvailable?'<div class="sort-menu-item">'+
   '<button type="button" class="context-sort-trigger" data-action="context-sort-toggle" aria-haspopup="true" aria-expanded="false" role="menuitem">'+
   '<span>Сортировать</span><span aria-hidden="true">'+(placeLeft?'◂':'▸')+'</span></button>'+
   '<div class="sort-submenu '+(placeLeft?'sort-submenu-left':'')+'" role="group" aria-label="Параметры сортировки">'+
   '<strong class="sort-menu-heading">Сортировка диапазона</strong>'+
   '<label>Сортировать по столбцу<select id="context-sort-column" aria-label="Столбец сортировки">'+
   Array.from({length:selection.c2-selection.c1+1},(_,i)=>{
    const col=selection.c1+i,letter=colLabel(col);
    const title=getCell(sheet(),cellName(selection.r1,col)).value.trim().slice(0,28);
    return '<option value="'+col+'" '+(col===key?'selected':'')+'>'+esc(letter+(title?' — '+title:''))+'</option>';
   }).join('')+'<</select></label>'+
   '<label class="sort-header-toggle"><input id="context-sort-header" type="checkbox" '+(likelyHeader?'checked':'')+'>Первая строка — заголовок</label>'+
   '<button data-action="context-sort" data-direction="asc" role="menuitem">А → Я · 0 → 9</button>'+
   '<button data-action="context-sort" data-direction="desc" role="menuitem">Я → А · 9 → 0</button>'+
   '<small>Строки перемещаются целиком внутри выделения, вместе со ссылками и оформлением.</small></div></div>':'';
  return '<div id="size-context-menu" class="size-context-menu cell-context-menu" style="'+style+'" role="menu">'+
   '<strong class="context-title">'+(multi?'Выделенный диапазон':'Ячейка '+esc(activeCell))+'</strong>'+
   submenu+
   '<button data-action="size-context-mode" data-kind="row" role="menuitem">Высота строки…</button><button data-action="size-context-mode" data-kind="col" role="menuitem">Ширина столбца…</button>'+
   '<button data-action="context-copy" role="menuitem">Копировать'+(multi?' диапазон':'')+'</button>'+
   '<button data-action="context-paste" role="menuitem">Вставить значения</button>'+
   '<button data-action="context-clear" role="menuitem">Очистить содержимое</button>'+
   (multi?'':'<button data-action="context-checkbox" role="menuitem">Вставить отметку</button><button data-action="context-link" role="menuitem">Гиперссылка…</button>')+
   '</div>';
 }
 let targets;try{targets=sizeTargets(m.kind,m.index);}catch(err){return '<div id="size-context-menu" class="size-context-menu" style="'+style+'">'+esc(err.message)+'</div>';}
 const min=m.kind==='row'?DIMENSIONS.minRow:DIMENSIONS.minColumn,
  max=m.kind==='row'&&targets[0]==='all'?DIMENSIONS.maxDefaultRow:m.kind==='row'?DIMENSIONS.maxRow:DIMENSIONS.maxColumn;
 const initial=m.kind==='row'?rowHeight(sheet(),m.index):columnWidth(sheet(),m.index);
 return '<div id="size-context-menu" class="size-context-menu" style="'+style+'" role="dialog" aria-label="'+title+'">'+
  '<label>'+title+(targets[0]==='all'?' (все)':'')+(targets.length>1?' ('+targets.length+')':'')+
  '<input id="size-context-number" type="number" step="1" min="'+min+'" max="'+max+'" value="'+initial+'" aria-label="'+title+' в пикселях"></label>'+
  '<small>Допустимо: '+min+'–'+max+' пикселей</small>'+
  '<div class="size-context-actions"><button data-action="size-context-close">Отмена</button>'+
  '<button class="size-context-confirm" data-action="size-context-apply">Применить</button></div></div>';
}
function openSizeContext(kind,index,x,y,sortColumn=null){
 commitEditor();
 sizeContext={kind,index,sortColumn,x:Math.max(6,Math.min(x,window.innerWidth-268)),y:Math.max(6,Math.min(y,window.innerHeight-200))};
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
     value>(kind==='row'&&targets[0]==='all'?DIMENSIONS.maxDefaultRow:kind==='row'?DIMENSIONS.maxRow:DIMENSIONS.maxColumn))
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
function changeSize(kind){if(sizeContext){sizeContext=null;document.getElementById('size-context-menu')?.remove();}commitEditor();const p=parseCell(activeCell);if(!p)return;const current=kind==='col'?columnWidth(sheet(),p.col):rowHeight(sheet(),p.row);const input=prompt(kind==='col'?'Ширина столбца (48–3000 пикселей)':'Высота строки (22–2000 пикселей)',String(current));if(input===null)return;const value=Number(input);
 try{if(!Number.isInteger(value))throw Error('Введите целое число');transact(()=>{if(kind==='col')setColumnWidth(sheet(),p.col,value);else setRowHeight(sheet(),p.row,value);});drawGrid();status(`Размер изменён: ${value} пикселей`);}catch(err){status(err.message,true);}}
function autoFitColumn(index=null){commitEditor();const p=parseCell(activeCell);if(!p||!sheet())return;const c=index??p.col;let chars=0;const {raw,ctx}=recalculator.view(book(),sheet());for(const ref of Object.keys(sheet().cells)){const cell=parseCell(ref);if(cell?.col===c){const str=String(displayedValue(sheet(),ref,raw,ctx));for(const line of str.split('\n'))chars=Math.max(chars,line.length);}}const width=Math.max(DIMENSIONS.minColumn,Math.min(DIMENSIONS.maxColumn,Math.ceil(chars*7.2+20)));
 transact(()=>setColumnWidth(sheet(),c,width));drawGrid();status(`Столбец ${cellName(0,c).replace(/\d+$/,'')}: ${width} пикселей`);}
function resetRowHeight(index=null){const p=parseCell(activeCell);if(!p)return;transact(()=>setRowHeight(sheet(),index??p.row,DIMENSIONS.defaultRow));drawGrid();}
function createSelectedSmartTable(){
 if(!requireSingleRange())return;
 commitEditor();const r=rectangle(activeCell,rangeEnd);
 try{
  const trial=structuredClone(sheet()),from=cellName(r.r1,r.c1),to=cellName(r.r2,r.c2);
  const result=createSmartTable(trial,from,to);
  if(result==='existing'){status('Этот диапазон уже является умной таблицей');return;}
  transact(()=>createSmartTable(sheet(),from,to));
  activeRibbon='data';render();status(result==='expanded'?'Диапазон умной таблицы расширен. Условия фильтра сброшены':'Умная таблица создана');
 }catch(e){status(e.message,true);}
}
function addSelectedSmartTableRow(){
 if(!sheet()?.smartTable){status('Сначала создайте умную таблицу',true);return;}
 commitEditor();const r=smartTableRange(sheet()),row=r.r2+1;
 try{
  // Never overwrite pre-existing user data immediately underneath the table.
  if(Array.from({length:r.c2-r.c1+1},(_,i)=>getCell(sheet(),cellName(row,r.c1+i)).value).some(Boolean))
   throw Error('Под таблицей уже есть данные. Добавьте строку в пустой области');
  transact(()=>appendSmartTableRow(sheet()));
  render();setSelection(cellName(row,r.c1));ensureVisible(row,r.c1);status('Добавлена строка с продолжением формул и оформления');
 }catch(e){status(e.message,true);}
}
function clearSelectedSmartTable(){
 if(!sheet()?.smartTable){status('На листе нет умной таблицы',true);return;}
 commitEditor();transact(()=>removeSmartTable(sheet()));render();status('Преобразовано в диапазон. Данные и оформление сохранены');
}
function toggleAutoFilter(){if(!requireSingleRange())return;commitEditor();if(sheet().autoFilter){transact(()=>{sheet().autoFilter=null});filterColumn=null;filterUiColumn=null;render();status('Автофильтр выключен — данные не изменены');return;}
 const rect=rectangle(activeCell,rangeEnd);try{const draft=structuredClone(sheet());setAutoFilter(draft,cellName(rect.r1,rect.c1),cellName(rect.r2,rect.c2));transact(()=>{sheet().autoFilter=draft.autoFilter});render();status('Автофильтр включён — выберите столбец в его заголовке');}catch(e){status(e.message,true);}}
function updateFreeze(rows,cols){commitEditor();try{transact(()=>setFreeze(sheet(),rows,cols));render();status(rows||cols?`Закреплено строк: ${rows}, столбцов: ${cols}`:'Закрепление снято');}catch(e){status(e.message,true);}}
let filterUiChoices=[],filterUiPicked=new Set(),filterUiQuery='',filterUiColumn=null;
function buildFilterChoices(){
 const rect=filterRange(sheet());if(!rect||filterColumn===null)return;
 const values=new Set();for(let r=rect.r1+1;r<=rect.r2;r++)values.add(getCell(sheet(),cellName(r,filterColumn)).value);
 filterUiChoices=[...values].sort((a,b)=>a.localeCompare(b,'ru-RU',{numeric:true}));
 const rule=sheet().autoFilter?.rules?.[filterColumn];
 filterUiPicked=new Set(typeof rule==='string'?[rule]:Array.isArray(rule)?rule:filterUiChoices);
 filterUiColumn=filterColumn;filterUiQuery='';
}
function filterVisibleChoices(){
 const q=filterUiQuery.toLocaleLowerCase('ru-RU');
 return filterUiChoices.map((value,index)=>({value,index})).filter(item=>!q||item.value.toLocaleLowerCase('ru-RU').includes(q));
}
function qoFilterChoiceMarkup(){
 const list=filterVisibleChoices();
 return list.slice(0,200).map(({value,index})=>`<label class="filter-choice"><input type="checkbox" data-filter-index="${index}" ${filterUiPicked.has(value)?'checked':''}><span>${esc(value||'(пусто)')}</span></label>`).join('')+
 (list.length>200?`<p class="filter-tip">Показаны 200 из ${list.length}. Уточните поиск или используйте условие.</p>`:'');
}
function qoFilterRefreshChoices(){
 const list=document.getElementById('qo-filter-list'),counter=document.getElementById('qo-filter-counter');
 if(list)list.innerHTML=qoFilterChoiceMarkup();
 if(counter)counter.textContent=`Найдено: ${filterVisibleChoices().length} · выбрано: ${filterUiPicked.size}`;
}
function filterPopup(){const f=sheet()?.autoFilter,rect=filterRange(sheet());if(filterColumn===null||!f||!rect)return '';
 if(filterUiColumn!==filterColumn)buildFilterChoices();
 const column=filterColumn,rule=f.rules?.[column],condition=rule&&typeof rule==='object'&&!Array.isArray(rule)?rule:null;
 const op=condition?.op||'contains';
 const operators=[['contains','Текст содержит'],['notContains','Текст не содержит'],['startsWith','Начинается с'],['endsWith','Заканчивается на'],
  ['equals','Текст равен'],['notEquals','Текст не равен'],['empty','Пустые'],['notEmpty','Непустые'],
  ['gt','Число больше'],['gte','Число не меньше'],['lt','Число меньше'],['lte','Число не больше'],['numEq','Число равно'],['numNe','Число не равно']];
 return `<aside class="filter-popup qo-filter-popup" role="dialog" aria-label="Фильтр столбца ${esc(colLabel(column))}">
 <div class="filter-popup-head"><strong>Фильтр · ${esc(colLabel(column))}</strong><button data-action="filter-close" title="Закрыть" aria-label="Закрыть фильтр">×</button></div>
 <div class="qo-filter-content"><label class="qo-filter-label">Поиск значений<input type="search" id="qo-filter-search" placeholder="Например: Мария" value="${esc(filterUiQuery)}" autocomplete="off"></label>
 <div class="filter-bulk"><button data-action="filter-all">Выбрать найденные</button><button data-action="filter-none">Снять найденные</button><button data-action="filter-only-found">Только найденные</button></div>
 <div id="qo-filter-list" class="filter-choices" role="group" aria-label="Выбранные значения">${qoFilterChoiceMarkup()}</div>
 <small id="qo-filter-counter">Найдено: ${filterVisibleChoices().length} · выбрано: ${filterUiPicked.size}</small>
 <div class="filter-popup-actions"><button data-action="filter-apply">Показать выбранные</button></div>
 <div class="qo-filter-condition"><strong>Фильтр по условию</strong><select id="qo-filter-operator" aria-label="Условие фильтра">${operators.map(([key,label])=>`<option value="${key}"${op===key?' selected':''}>${label}</option>`).join('')}</select>
 <input id="qo-filter-term" placeholder="Значение условия" aria-label="Значение условия" value="${esc(condition?.value||'')}" ${['empty','notEmpty'].includes(op)?'disabled':''}>
 <button data-action="filter-condition-apply" class="qo-filter-main">Применить условие</button></div>
 <div class="qo-filter-footer"><button data-action="filter-reset">Сбросить этот столбец</button><button data-action="filter-reset-all">Сбросить все фильтры</button></div>
 <small>Фильтры скрывают строки, но не меняют данные. Условия разных столбцов действуют вместе.</small></div></aside>`;
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
// Lucide SVG icons: https://lucide.dev — ISC license; see docs/THIRD_PARTY_NOTICES.md.
const QO_LUCIDE={"paint-bucket":"<path d=\"M11 7 6 2\" />\n  <path d=\"M18.992 12H2.041\" />\n  <path d=\"M21.145 18.38A3.34 3.34 0 0 1 20 16.5a3.3 3.3 0 0 1-1.145 1.88c-.575.46-.855 1.02-.855 1.595A2 2 0 0 0 20 22a2 2 0 0 0 2-2.025c0-.58-.285-1.13-.855-1.595\" />\n  <path d=\"m8.5 4.5 2.148-2.148a1.205 1.205 0 0 1 1.704 0l7.296 7.296a1.205 1.205 0 0 1 0 1.704l-7.592 7.592a3.615 3.615 0 0 1-5.112 0l-3.888-3.888a3.615 3.615 0 0 1 0-5.112L5.67 7.33\" />","undo-2":"<path d=\"M9 14 4 9l5-5\" />\n  <path d=\"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11\" />","redo-2":"<path d=\"m15 14 5-5-5-5\" />\n  <path d=\"M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13\" />","copy":"<rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\" />\n  <path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\" />","clipboard-paste":"<path d=\"M11 14h10\" />\n  <path d=\"M16 4h2a2 2 0 0 1 2 2v1.344\" />\n  <path d=\"m17 18 4-4-4-4\" />\n  <path d=\"M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113\" />\n  <rect x=\"8\" y=\"2\" width=\"8\" height=\"4\" rx=\"1\" />","eraser":"<path d=\"M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21\" />\n  <path d=\"m5.082 11.09 8.828 8.828\" />","type":"<path d=\"M12 4v16\" />\n  <path d=\"M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2\" />\n  <path d=\"M9 20h6\" />","grid-2x2":"<path d=\"M12 3v18\" />\n  <path d=\"M3 12h18\" />\n  <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" />","combine":"<path d=\"M14 3a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1\" />\n  <path d=\"M19 3a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1\" />\n  <path d=\"m7 15 3 3\" />\n  <path d=\"m7 21 3-3H5a2 2 0 0 1-2-2v-2\" />\n  <rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\" />\n  <rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\" />","split":"<path d=\"M16 3h5v5\" />\n  <path d=\"M8 3H3v5\" />\n  <path d=\"M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3\" />\n  <path d=\"m15 9 6-6\" />","align-vertical-justify-start":"<rect width=\"14\" height=\"6\" x=\"5\" y=\"16\" rx=\"2\" />\n  <rect width=\"10\" height=\"6\" x=\"7\" y=\"6\" rx=\"2\" />\n  <path d=\"M2 2h20\" />","align-vertical-justify-center":"<rect width=\"14\" height=\"6\" x=\"5\" y=\"16\" rx=\"2\" />\n  <rect width=\"10\" height=\"6\" x=\"7\" y=\"2\" rx=\"2\" />\n  <path d=\"M2 12h20\" />","align-vertical-justify-end":"<rect width=\"14\" height=\"6\" x=\"5\" y=\"12\" rx=\"2\" />\n  <rect width=\"10\" height=\"6\" x=\"7\" y=\"2\" rx=\"2\" />\n  <path d=\"M2 22h20\" />","sigma":"<path d=\"M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2\" />","russian-ruble":"<path d=\"M4 16h6\" />\n  <path d=\"M7 20V5a1 1 0 011-1h6a4 4 0 010 8H4\" />","percent":"<line x1=\"19\" x2=\"5\" y1=\"5\" y2=\"19\" />\n  <circle cx=\"6.5\" cy=\"6.5\" r=\"2.5\" />\n  <circle cx=\"17.5\" cy=\"17.5\" r=\"2.5\" />","hash":"<line x1=\"4\" x2=\"20\" y1=\"9\" y2=\"9\" />\n  <line x1=\"4\" x2=\"20\" y1=\"15\" y2=\"15\" />\n  <line x1=\"10\" x2=\"8\" y1=\"3\" y2=\"21\" />\n  <line x1=\"16\" x2=\"14\" y1=\"3\" y2=\"21\" />","calendar-days":"<path d=\"M8 2v3\" />\n  <path d=\"M16 2v3\" />\n  <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" />\n  <path d=\"M3 9h18\" />\n  <path d=\"M8 13h.01\" />\n  <path d=\"M12 13h.01\" />\n  <path d=\"M16 13h.01\" />\n  <path d=\"M8 17h.01\" />\n  <path d=\"M12 17h.01\" />\n  <path d=\"M16 17h.01\" />","clock-3":"<circle cx=\"12\" cy=\"12\" r=\"10\" />\n  <path d=\"M12 6v6h4\" />","calendar-clock":"<path d=\"M16 14v2.2l1.6 1\" />\n  <path d=\"M16 2v3\" />\n  <path d=\"M21 7.338V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h2.338\" />\n  <path d=\"M3 9h5.859\" />\n  <path d=\"M8 2v3\" />\n  <circle cx=\"16\" cy=\"16\" r=\"6\" />","timer":"<line x1=\"10\" x2=\"14\" y1=\"2\" y2=\"2\" />\n  <line x1=\"12\" x2=\"15\" y1=\"14\" y2=\"11\" />\n  <circle cx=\"12\" cy=\"14\" r=\"8\" />","printer":"<path d=\"M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2\" />\n  <path d=\"M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6\" />\n  <rect x=\"6\" y=\"14\" width=\"12\" height=\"8\" rx=\"1\" />","chart-column":"<path d=\"M3 3v16a2 2 0 0 0 2 2h16\" />\n  <path d=\"M18 17V9\" />\n  <path d=\"M13 17V5\" />\n  <path d=\"M8 17v-3\" />","chart-column-stacked":"<path d=\"M11 13H7\" />\n  <path d=\"M19 9h-4\" />\n  <path d=\"M3 3v16a2 2 0 0 0 2 2h16\" />\n  <rect x=\"15\" y=\"5\" width=\"4\" height=\"12\" rx=\"1\" />\n  <rect x=\"7\" y=\"8\" width=\"4\" height=\"9\" rx=\"1\" />","chart-line":"<path d=\"M3 3v16a2 2 0 0 0 2 2h16\" />\n  <path d=\"m19 9-5 5-4-4-3 3\" />","chart-scatter":"<circle cx=\"7.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\" />\n  <circle cx=\"18.5\" cy=\"5.5\" r=\".5\" fill=\"currentColor\" />\n  <circle cx=\"11.5\" cy=\"11.5\" r=\".5\" fill=\"currentColor\" />\n  <circle cx=\"7.5\" cy=\"16.5\" r=\".5\" fill=\"currentColor\" />\n  <circle cx=\"17.5\" cy=\"14.5\" r=\".5\" fill=\"currentColor\" />\n  <path d=\"M3 3v16a2 2 0 0 0 2 2h16\" />","chart-pie":"<path d=\"M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z\" />\n  <path d=\"M21.21 15.89A10 10 0 1 1 8 2.83\" />","chart-no-axes-combined":"<path d=\"M12 16v5\" />\n  <path d=\"M16 14.639V21\" />\n  <path d=\"M20 10.656V21\" />\n  <path d=\"m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15\" />\n  <path d=\"M4 18.463V21\" />\n  <path d=\"M8 14.656V21\" />","rows-3":"<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />\n  <path d=\"M21 9H3\" />\n  <path d=\"M21 15H3\" />","columns-3":"<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />\n  <path d=\"M9 3v18\" />\n  <path d=\"M15 3v18\" />","search":"<path d=\"m21 21-4.34-4.34\" />\n  <circle cx=\"11\" cy=\"11\" r=\"8\" />","list-filter":"<path d=\"M2 5h20\" />\n  <path d=\"M6 12h12\" />\n  <path d=\"M9 19h6\" />","arrow-down-a-z":"<path d=\"m3 16 4 4 4-4\" />\n  <path d=\"M7 20V4\" />\n  <path d=\"M20 8h-5\" />\n  <path d=\"M15 10V6.5a2.5 2.5 0 0 1 5 0V10\" />\n  <path d=\"M15 14h5l-5 6h5\" />","arrow-up-z-a":"<path d=\"m3 8 4-4 4 4\" />\n  <path d=\"M7 4v16\" />\n  <path d=\"M15 4h5l-5 6h5\" />\n  <path d=\"M15 20v-3.5a2.5 2.5 0 0 1 5 0V20\" />\n  <path d=\"M20 18h-5\" />","folder-open":"<path d=\"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2\" />","file-spreadsheet":"<path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\" />\n  <path d=\"M14 2v5a1 1 0 0 0 1 1h5\" />\n  <path d=\"M8 13h2\" />\n  <path d=\"M14 13h2\" />\n  <path d=\"M8 17h2\" />\n  <path d=\"M14 17h2\" />","file-text":"<path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\" />\n  <path d=\"M14 2v5a1 1 0 0 0 1 1h5\" />\n  <path d=\"M10 9H8\" />\n  <path d=\"M16 13H8\" />\n  <path d=\"M16 17H8\" />","save":"<path d=\"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z\" />\n  <path d=\"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7\" />\n  <path d=\"M7 3v4a1 1 0 0 0 1 1h7\" />","archive":"<rect width=\"20\" height=\"5\" x=\"2\" y=\"3\" rx=\"1\" />\n  <path d=\"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8\" />\n  <path d=\"M10 12h4\" />","panel-top":"<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />\n  <path d=\"M3 9h18\" />","panel-left":"<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />\n  <path d=\"M9 3v18\" />","panels-top-left":"<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />\n  <path d=\"M3 9h18\" />\n  <path d=\"M9 21V9\" />","move-horizontal":"<path d=\"m18 8 4 4-4 4\" />\n  <path d=\"M2 12h20\" />\n  <path d=\"m6 8-4 4 4 4\" />","move-vertical":"<path d=\"M12 2v20\" />\n  <path d=\"m8 18 4 4 4-4\" />\n  <path d=\"m8 6 4-4 4 4\" />","arrow-down-to-line":"<path d=\"M12 17V3\" />\n  <path d=\"m6 11 6 6 6-6\" />\n  <path d=\"M19 21H5\" />","arrow-up-to-line":"<path d=\"M5 3h14\" />\n  <path d=\"m18 13-6-6-6 6\" />\n  <path d=\"M12 7v14\" />","arrow-left-to-line":"<path d=\"M3 19V5\" />\n  <path d=\"m13 6-6 6 6 6\" />\n  <path d=\"M7 12h14\" />","arrow-right-to-line":"<path d=\"M17 12H3\" />\n  <path d=\"m11 18 6-6-6-6\" />\n  <path d=\"M21 5v14\" />","pencil":"<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\" />\n  <path d=\"m15 5 4 4\" />","arrow-right-left":"<path d=\"m16 3 4 4-4 4\" />\n  <path d=\"M20 7H4\" />\n  <path d=\"m8 21-4-4 4-4\" />\n  <path d=\"M4 17h16\" />","trash":"<path d=\"M10 11v6\" />\n  <path d=\"M14 11v6\" />\n  <path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\" />\n  <path d=\"M3 6h18\" />\n  <path d=\"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\" />","list-plus":"<path d=\"M16 5H3\" />\n  <path d=\"M11 12H3\" />\n  <path d=\"M16 19H3\" />\n  <path d=\"M18 9v6\" />\n  <path d=\"M21 12h-6\" />","list-minus":"<path d=\"M16 5H3\" />\n  <path d=\"M11 12H3\" />\n  <path d=\"M16 19H3\" />\n  <path d=\"M21 12h-6\" />","paintbrush":"<path d=\"m14.622 17.897-10.68-2.913\" />\n  <path d=\"M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z\" />\n  <path d=\"M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15\" />"};

const QO_ICON_ACTION={
 'undo':'undo-2','redo':'redo-2','copy':'copy','paste-values':'clipboard-paste',
 'clear':'trash','clear-format':'eraser','border-menu':'grid-2x2','fill-palette':'paint-bucket',
 'merge-cells':'combine','unmerge-cells':'split','wrap':'arrow-right-left',
 'conditional-open':'paintbrush','validation-open':'list-plus',
 'autosum':'sigma','print-open':'printer','find-open':'search',
 'sort-asc':'arrow-down-a-z','sort-desc':'arrow-up-z-a','filter-toggle':'list-filter','filter-clear-all':'eraser',
 'import':'folder-open','open-disk':'folder-open','csv':'file-text','xlsx':'file-spreadsheet',
 'save':'save','save-as':'save','backup':'archive','sheet-add':'list-plus',
 'sheet-rename':'pencil','insert-row':'rows-3','delete-row':'list-minus',
 'insert-col':'columns-3','delete-col':'list-minus',
 'column-width':'move-horizontal','row-height':'move-vertical',
 'column-fit':'columns-3','row-reset':'undo-2',
 'freeze-row':'panel-top','freeze-col':'panel-left','freeze-at':'panels-top-left',
 'freeze-clear':'split','smart-create':'grid-2x2','smart-add-row':'list-plus','smart-remove':'split','hide-row':'rows-3','hide-col':'columns-3',
 'show-rows':'rows-3','show-cols':'columns-3',
 'chart-bar':'chart-column','chart-stacked':'chart-column-stacked',
 'chart-stacked100':'chart-column-stacked','chart-line':'chart-line',
 'chart-scatter':'chart-scatter','chart-pie':'chart-pie','charts-open':'chart-no-axes-combined',
 'fill-up':'arrow-up-to-line','fill-down':'arrow-down-to-line',
 'fill-left':'arrow-left-to-line','fill-right':'arrow-right-to-line',
 'text-to-columns':'columns-3','remove-duplicates':'list-filter',
 'goto':'search','border-all':'grid-2x2'
};
const QO_FORMAT_ICON={general:'type',currency:'russian-ruble',percent:'percent',
 integer:'hash',date:'calendar-days',time:'clock-3',
 datetime:'calendar-clock',duration:'timer'};
const QO_VERTICAL_ICON={top:'align-vertical-justify-start',
 center:'align-vertical-justify-center',bottom:'align-vertical-justify-end'};
function qoButtonValue(extra){return /data-value="([^"]+)"/.exec(extra)?.[1]||'';}
function qoToolState(action,value=''){
 if(!sheet())return null;
 const style=getEffectiveStyle(sheet(),activeCell);
 if(['bold','italic','underline','strike','wrap'].includes(action))return !!style[action];
 if(action==='align')return (style.align||'left')===value;
 if(action==='valign')return (style.verticalAlign||'center')===value;
 if(action==='format')return (style.format||'general')===value;
 if(action==='border-menu')return !!borderMenuOpen;
 if(action==='text-palette')return activePalette==='color';
 if(action==='fill-palette')return activePalette==='bg';
 if(action==='filter-toggle')return !!sheet().autoFilter;
 return null;
}
function qoSyncRibbonState(){
 if(page!=='sheet'||!sheet())return;
 for(const el of document.querySelectorAll('.ribbon .tool-btn')){
  const state=qoToolState(el.dataset.action,el.dataset.value||'');
  el.classList.toggle('is-active',state===true);
  if(state!==null)el.setAttribute('aria-pressed',String(state));
 }
 const style=getEffectiveStyle(sheet(),activeCell);
 const fontName=(style.fontFamily&&FONT_FAMILIES.includes(style.fontFamily))?style.fontFamily:'Aptos';
 const picker=document.querySelector('#font-picker-trigger .font-picker-name');if(picker){picker.textContent=fontName;picker.style.fontFamily='\''+fontName+'\',sans-serif';}
 const native=document.getElementById('font-family-select');if(native&&native.value!==fontName)native.value=fontName;
 const size=document.getElementById('font-size-select');if(size){const current=String(style.fontSize||11);if([...size.options].some(o=>o.value===current))size.value=current;}
 for(const [action,value] of [['text-palette',style.color||'#151515'],['fill-palette',style.bg||'#2b946c']]){
  const swatch=document.querySelector('.ribbon [data-action="'+action+'"] .qo-swatch');
  if(swatch)swatch.style.backgroundColor=value;
 }
}
function toolIcon(action,original,extra=''){
 if(['bold','italic','underline','strike'].includes(action))return original;
 if(action==='text-palette')return '<span class="qo-text-color"><strong>А</strong><i class="qo-swatch"></i></span>';
 const value=qoButtonValue(extra);
 const lucideName=action==='valign'?QO_VERTICAL_ICON[value]:
  action==='format'?QO_FORMAT_ICON[value]:QO_ICON_ACTION[action];
 const lucide=QO_LUCIDE[lucideName];
 if(lucide){
  const svg='<svg class="qo-lucide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+lucide+'</svg>';
  if(action==='fill-palette')return '<span class="qo-paint-icon">'+svg+'<i class="qo-swatch"></i></span>';
  if(action==='chart-stacked100')return '<span class="qo-chart-100">'+svg+'<i aria-hidden="true">100%</i></span>';
  return svg;
 }

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
 const fontTools='<div class="font-selectors"><div class="font-choice"><select class="ribbon-font-picker-native" id="font-family-select" tabindex="-1" aria-label="Шрифт">'+
  FONT_TOP.concat(FONT_OTHERS).map(name=>'<option value="'+esc(name)+'"'+(name===chosenFont?' selected':'')+'>'+esc(name)+'</option>').join('')+
  '</select><button type="button" class="font-picker-trigger" data-action="font-menu" id="font-picker-trigger" aria-label="Выбор шрифта" aria-expanded="'+fontDropdownOpen+'"><span class="font-picker-name" style="font-family:'+esc(chosenFont)+',sans-serif">'+esc(chosenFont)+'</span><span class="font-picker-chevron" aria-hidden="true"><svg viewBox="0 0 20 20" focusable="false"><path d="m5 7.5 5 5 5-5"/></svg></span></button></div><select class="ribbon-font-size" id="font-size-select" title="Размер шрифта" aria-label="Размер шрифта">'+
  [8,9,10,11,12,14,16,18,20,24,28,32,36,48,72].map(value=>'<option value="'+value+'"'+(value===chosenSize?' selected':'')+'>'+value+'</option>').join('')+'</select></div>';
 const tabs=[['home','Главная'],['edit','Правка'],['insert','Вставка'],['formula','Формулы'],['data','Данные'],['view','Вид'],['file','Файл']];
 const labeled=new Set();
 const button=(action,label,icon='',extra='')=>{if(action==='formula-fn')icon='<span class="formula-fn-name">'+esc(label)+'</span>';const value=qoButtonValue(extra),pressed=qoToolState(action,value),disabled=['undo','redo'].includes(action)&&!(action==='undo'?undoStacks:redoStacks).get(book()?.id)?.length;return `<button type="button" class="tool-btn ${pressed===true?'is-active':''} ${action==='formula-fn'?'is-formula-fn':''} ${labeled.has(action)?'is-labeled':''}" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}"${pressed!==null?` aria-pressed="${pressed}"`:''}${disabled?' disabled aria-disabled="true"':''} ${extra}><span class="tool-symbol" aria-hidden="true">${toolIcon(action,icon,extra)}</span><span class="tool-label">${esc(label)}</span></button>`;};
 const group=(name,buttons)=>`<section class="ribbon-group ${name==='Шрифт'?'font-group':name==='Выравнивание'?'alignment-group':''}" aria-label="${esc(name)}"><div class="ribbon-group-content">${buttons}</div><div class="group-name">${esc(name)}</div></section>`;
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
 if(activeRibbon==='formula')contents=
 group('Итоги',button('autosum','Автосумма','Σ')+['SUM','AVERAGE','MIN','MAX','COUNT'].map(fn=>button('formula-fn',fn,'ƒx',`data-fn="${fn}"`)).join(''))+
 group('Условия', ['SUMIF','SUMIFS','COUNTIF','COUNTIFS','AVERAGEIFS'].map(fn=>button('formula-fn',fn,'ƒx',`data-fn="${fn}"`)).join(''))+
 group('Поиск', ['VLOOKUP','HLOOKUP','XLOOKUP','INDEX','MATCH'].map(fn=>button('formula-fn',fn,'ƒx',`data-fn="${fn}"`)).join(''))+
 group('Текст', ['LEFT','RIGHT','MID','TEXTJOIN'].map(fn=>button('formula-fn',fn,'ƒx',`data-fn="${fn}"`)).join(''));
 if(activeRibbon==='data')contents=group('Умная таблица',button('smart-create','Преобразовать выделение в таблицу','▦')+button('smart-add-row','Добавить строку','+')+button('smart-remove','Преобразовать в диапазон','×'))+group('Сортировка',button('sort-asc','А → Я','↑')+button('sort-desc','Я → А','↓'))+group('Фильтр',button('filter-toggle','Автофильтр','⏷')+button('filter-clear-all','Сбросить условия фильтра','×'))+group('Очистка данных',button('text-to-columns','Текст по столбцам','⇥')+button('remove-duplicates','Удалить дубликаты','≡'))+group('Проверка',button('validation-open','Проверка данных','✓'))+group('Импорт и экспорт',button('import','Открыть','↥')+button('csv','CSV','⇩')+button('xlsx','XLSX','⇩'));
 if(activeRibbon==='insert')contents=group('Отметки',button('insert-checkbox','Вставить чекбокс','☑'))+group('Ссылки',button('insert-link','Вставить или изменить гиперссылку','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3A5 5 0 0 0 11 21.07l1.72-1.71"/></svg>'))+group('Структура',button('insert-row','Вставить выбранные строки','+')+button('delete-row','Удалить выбранные строки','×')+button('insert-col','Вставить выбранные столбцы','+')+button('delete-col','Удалить выбранные столбцы','×'))+group('Диаграммы',button('chart-bar','Столбчатая диаграмма','▥')+
  button('chart-stacked','С накоплением','▥')+
  button('chart-stacked100','С накоплением 100%','▥')+button('chart-line','Линейная диаграмма','⌁')+button('chart-scatter','Точечная XY','·')+button('chart-pie','Круговая диаграмма','◉')+button('charts-open','Мои диаграммы','▣'))+group('Листы',button('sheet-add','Новый лист','+'));
 if(activeRibbon==='view')contents=group('Печать',button('print-open','Печать таблицы','▤'))+group('Закрепление',button('freeze-row','Верхняя строка','▔')+button('freeze-col','Первый столбец','▏')+button('freeze-at','По выбранной ячейке','◧')+button('freeze-clear','Снять закрепление','×'))+group('Размеры',button('column-width','Ширина столбца','↔')+button('column-fit','Автоподбор ширины','⇥')+button('row-height','Высота строки','↕')+button('row-reset','Стандартная высота','↺'))+group('Скрытие',button('hide-row','Скрыть строку','−')+button('show-rows','Показать строки','+')+button('hide-col','Скрыть столбец','−')+button('show-cols','Показать столбцы','+'))+group('Переход',button('goto','В начало','⌂','data-ref="A1"')+button('goto','Строка 100','↧','data-ref="A100"')+button('goto','Столбец Z','↦','data-ref="Z1"'))+group('Поиск',button('find-open','Найти','⌕'));
 if(activeRibbon==='file')contents=group('Документ',button('save','Сохранить','⇩')+button('save-as','Сохранить как','⇩')+button('open-disk','Открыть с диска','↥')+button('backup','Архив','▤')+button('import','Импорт','↥'))+group('Экспорт',button('csv','CSV','⇩')+button('xlsx','XLSX','⇩'))+group('Печать',button('print-open','Предпросмотр и печать','▤'));
 const finder=showFind?`<div class="find-bar" role="search"><label>Найти <input id="find-term" value="${esc(searchTerm)}" placeholder="Текст или число" autocomplete="off"></label><button data-action="find-next" title="Следующее совпадение">Следующее ↵</button><label>Заменить на <input id="replace-term" value="${esc(replaceTerm)}" placeholder="Новое значение" autocomplete="off"></label><button data-action="replace-all">Заменить все</button><button data-action="find-close" aria-label="Закрыть поиск" title="Закрыть">×</button></div>`:'';
 return `<div class="ribbon"><div class="ribbon-tabs" role="tablist" aria-label="Инструменты таблицы">${tabs.map(([id,name])=>`<button role="tab" aria-selected="${activeRibbon===id}" class="${activeRibbon===id?'chosen':''}" data-action="ribbon" data-target="${id}">${name}</button>`).join('')}<button type="button" class="qo-help-tab" data-action="help-open" aria-haspopup="dialog">Справка</button></div><div class="ribbon-controls">${contents}</div>${bordersPopup()}${qoFontMenu()}${finder}</div>`;
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
   '<div class="chart-source-actions"><button data-action="chart-source">Применить диапазон</button><button data-action="chart-use-selection">По выделению</button></div>'+
   '<div class="chart-manual"><label>Ввод данных вручную <textarea id="chart-manual-data" placeholder="Категория&#10;Пн&#9;5&#10;Вт&#9;7" aria-label="Ввод данных для диаграммы"></textarea></label>'+
   '<div class="chart-source-actions"><button data-action="chart-manual-apply">Вставить в лист и обновить источник</button></div></div></div>'+
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
   '<button data-action="chart-open" data-id="'+esc(chart.id)+'" title="Настройки диаграммы" aria-label="Настройки диаграммы">⚙</button>'+
   '<button data-action="chart-remove" data-id="'+esc(chart.id)+'" title="Удалить диаграмму" aria-label="Удалить диаграмму">×</button></div>'+
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



function applyChartManualData(text){
 const chart=(sheet()?.charts||[]).find(c=>c.id===selectedChartId);if(!chart)throw Error('Диаграмма не выбрана');
 const raw=String(text||'').replace(/\u00a0/g,' ').trim();
 if(!raw)throw Error('Введите данные для диаграммы');
 const rows=raw.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{
  const parts=line.includes('\t')?line.split('\t'):line.includes(';')?line.split(';'):line.split(',');
  return parts.map(v=>v.trim());
 });
 if(!rows.length)throw Error('Нет данных для вставки');
 const start=parseCell(chart.from);if(!start)throw Error('Некорректная стартовая ячейка диаграммы');
 const width=Math.max(...rows.map(r=>r.length));
 const from=cellName(start.row,start.col),to=cellName(start.row+rows.length-1,start.col+width-1);
 transact(()=>{
  rows.forEach((row,r)=>row.forEach((value,c)=>setTypedCell(sheet(),cellName(start.row+r,start.col+c),value)));
  changeChart(sheet(),selectedChartId,{from,to});
 });
 render();
 status('Данные вставлены в лист и привязаны к диаграмме');
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
function hyperlinkPanel(){
 if(!linkEditorRef||!sheet())return '';
 const ref=linkEditorRef,cell=getCell(sheet(),ref),url=cellHyperlink(sheet(),ref)||'';
 const display=url&&cell.value===url?'':cell.value;
 return '<div class="qo-link-backdrop" data-action="link-close"><section class="qo-link-dialog" role="dialog" aria-modal="true" aria-label="Гиперссылка">'+
  '<header><div><strong>Гиперссылка</strong><small>Ячейка '+esc(ref)+'</small></div><button type="button" data-action="link-close" aria-label="Закрыть">×</button></header>'+
  '<div class="qo-link-fields"><label>Текст для отображения<input id="qo-link-label" maxlength="50000" spellcheck="false" placeholder="Например, Профиль ученика" value="'+esc(display)+'"></label>'+
  '<label>Адрес ссылки<input id="qo-link-url" maxlength="2048" type="url" spellcheck="false" placeholder="https://example.com/profile" value="'+esc(url)+'"></label>'+
  '<p>Можно вставлять адреса сайтов и почтовые ссылки mailto:. Открытие происходит в новой вкладке.</p></div>'+
  '<footer>'+(url?'<button type="button" class="qo-link-remove" data-action="link-remove">Удалить ссылку</button>':'')+
  '<button type="button" data-action="link-close">Отмена</button><button type="button" class="qo-link-primary" data-action="link-save">Сохранить ссылку</button></footer></section></div>';
}
function openLinkEditor(ref=activeCell){
 if(!sheet()||!validRef(ref))return;
 if(!commitEditor())return;
 linkEditorRef=mergeAt(sheet(),ref)?.from||ref;
 render();document.getElementById('qo-link-url')?.focus({preventScroll:true});
}
function saveLinkEditor(){
 const ref=linkEditorRef;if(!ref||!sheet())return;
 const url=document.getElementById('qo-link-url')?.value.trim()||'',
  label=document.getElementById('qo-link-label')?.value||'';
 try{transact(()=>setHyperlink(sheet(),ref,url,label));linkEditorRef=null;render();status('Гиперссылка сохранена');}
 catch(err){status(err.message,true);document.getElementById('qo-link-url')?.focus();}
}
function smartTableHelpPanel(){
 if(!smartTableHelpOpen||page!=='sheet')return '';
 return `<div class="qo-help-backdrop" data-action="help-close-backdrop"><section class="qo-smart-help qo-central-help" role="dialog" aria-modal="true" aria-label="Справка Quantum Office" tabindex="-1">
 <header><div><small>QUANTUM OFFICE</small><strong>Справка по таблицам</strong></div><button data-action="help-close" aria-label="Закрыть справку" title="Закрыть">×</button></header>
 <div class="qo-smart-help-body">
 <h3>Фильтр</h3><p>Фильтр временно скрывает строки, которые не соответствуют выбранным значениям или условиям. Данные остаются в ячейках и не удаляются. Условия по разным столбцам действуют одновременно.</p>
 <p><b>Применение:</b> выделяется диапазон вместе с заголовками → «Данные» → «Автофильтр» → стрелка в заголовке столбца → выбор значений → «Показать выбранные».</p>
 <p><b>Сброс:</b> «Сбросить этот столбец» или «Сбросить все фильтры».</p>
 <h3>Умная таблица</h3><p>Умная таблица — прямоугольный список с заголовком и одной записью в каждой строке. При вводе в первой строке под таблицей диапазон расширяется; оформление и формулы продолжаются.</p>
 <p><b>Создание:</b> выделяется весь список, включая заголовки → «Данные» → «Создать». Повторяющиеся названия столбцов разрешены. Допускается таблица из одного столбца.</p>
 <p><b>Расширение:</b> существующая умная таблица может быть расширена новым выделением, полностью содержащим её исходный диапазон. При расширении условия фильтра сбрасываются.</p>
 <h3>Ограничения</h3><p>Одна умная таблица на листе. Вложенные таблицы не создаются. Объединённые ячейки внутри диапазона не поддерживаются. Для отдельных списков используются разные листы.</p>
 <h3>Выбор диапазона</h3><p>Для сортировки записей вместе с контактами, ссылками и оценками выделяются все связанные столбцы. Выделение одного столбца не перемещает соседние данные.</p>
 <h3>Сохранение</h3><p>QBOOK сохраняет структуру умной таблицы. XLSX сохраняет данные, оформление, формулы и автофильтр, но не создаёт полноценный объект Excel Table.</p>
 </div></section></div>`;
}
function sheetpage(){const b=book(),s=sheet();return `<main class="sheet-page">${ribbon()}<div class="formula-line"><input id="name-box" aria-label="Адрес выбранной ячейки" value="${esc(activeCell)}" spellcheck="false"><div id="validation-choice-slot">${validationDropdown()}</div><div class="fx-symbol">ƒx</div><input id="formula-input" aria-label="Формула или значение" spellcheck="false" value="${esc(getCell(s,activeCell).value)}" placeholder="Значение или формула (например, =SUM(A1:A9))"></div>${filterPopup()}<div id="grid-frame" class="grid-frame"><div id="grid-scroll" class="grid-scroll" tabindex="0" role="grid" aria-label="Лист ${esc(s.name)}"><div id="grid-canvas" class="grid-canvas"></div><div id="grid-charts-layer" class="grid-charts-layer" aria-label="Диаграммы на листе"></div></div><div id="grid-fill-handle" class="grid-fill-handle" role="button" aria-label="Маркер автозаполнения" title="Перетащите для продолжения значений или формул" hidden></div><div id="grid-frozen-rows" class="grid-frozen-rows" aria-label="Закреплённые строки"></div><div id="grid-frozen-cols" class="grid-frozen-cols" aria-label="Закреплённые столбцы"></div><div id="grid-col-overlay" class="grid-col-overlay" aria-label="Заголовки столбцов"></div><div id="grid-row-overlay" class="grid-row-overlay" aria-label="Заголовки строк"></div><button id="grid-corner" class="grid-corner-fixed" data-action="select-all" aria-label="Выделить весь лист" title="Выделить весь лист"></button>${palettePopup()}</div><div class="sheet-footer"><div class="sheet-tabs"><button class="sheet-menu" data-action="sheet-add" title="Добавить лист">+</button>${b.sheets.map(x=>`<button class="sheet-tab ${s.id===x.id?'selected':''}" data-action="sheet-select" data-id="${esc(x.id)}" title="Двойной щелчок — переименовать лист">${esc(x.name)}</button>`).join('')}<button class="sheet-options" data-action="sheet-delete" title="Удалить лист">×</button></div><div class="sheet-status"><span id="selection-info">${esc(activeCell)}</span><span id="selection-stats">Выделено: 1</span></div></div>${hyperlinkPanel()}${chartPanel()}${conditionalPanel()}${validationPanel()}${printPreviewPanel()}${dataToolPanel()}${smartTableHelpPanel()}</main>`;}
function render(){
 qoCloseTheme();
 const oldStage=document.getElementById('qs-stage'),stageScroll=oldStage?[oldStage.scrollLeft,oldStage.scrollTop]:null;
 const previousGrid=document.getElementById('grid-scroll');
 if(previousGrid&&previousGrid.dataset.sheetId===sheet()?.id){
  scrollLeft=previousGrid.scrollLeft;scrollTop=previousGrid.scrollTop;
 }
 app.innerHTML=topbar()+(page==='home'?homepage():page==='templates'?templatesPage():page==='sheet'&&book()?sheetpage():page==='writer'?qoWriterPage():page==='slides'?qoSlidesPage():page==='photo'?qoPhotoPage():placeholder(page))+`<input id="file-picker" type="file" accept=".qbook,.qbackup,.csv,.xlsx" hidden><div id="toast" class="toast" role="status"></div>`;
 // Keep the filter dialog inside the scrollable worksheet frame, below the ribbon.
 if(page==='writer')qoWriterStats();
 if(page==='photo'){qoPhotoRender();const stage=document.getElementById('qs-stage');if(stage&&stageScroll){stage.scrollLeft=stageScroll[0];stage.scrollTop=stageScroll[1];}}
 document.title='Quantum Office — '+({writer:'Тексты',slides:'Презентации',photo:'Фото',sheet:'Таблицы',home:'Обзор',templates:'Шаблоны'}[page]||'Офис');
 const filterDialog=app.querySelector('.qo-filter-popup'),frame=app.querySelector('#grid-frame');
 if(filterDialog&&frame)frame.append(filterDialog);
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
 },{passive:true});drawGrid();refreshSheetCharts();updateSelectionStats();}updateSaveIndicator();syncHistoryButtons();}
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
 const smart=smartTableRange(s);
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
  const action=(filter&&r===filter.r1&&c>=filter.c1&&c<=filter.c2)?`<button class="filter-head ${Object.hasOwn(s.autoFilter?.rules||{},c)?'has-rule':''}" data-action="filter-menu" data-col="${c}" title="Фильтр столбца ${esc(cellName(0,c).replace(/\d+$/,''))}">▾</button>`:'';
  const destination=pinnedR?'row':pinnedC?'col':'main';
  const href=cellHyperlink(s,ref),linkAction=href?`<a class="qo-cell-link" data-action="link-open" data-ref="${ref}" href="${esc(href)}" target="_blank" rel="noopener noreferrer" title="Открыть ссылку: ${esc(href)}" aria-label="Открыть ссылку из ${ref}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 5H19v5.5"/><path d="M19 5l-9.5 9.5"/><path d="M19 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4.5"/></svg></a>`:'';
  const cellMarkup=`<div class="grid-cell ${merged?'is-merged':''} ${style.wrap?'is-wrapped':''} ${selected?'is-selected':''} ${active?'is-active':''} ${pinnedR?'frozen-row':''} ${pinnedC?'frozen-col':''}" data-ref="${ref}" role="gridcell" aria-selected="${selected}" style="top:${destination==='row'?y[r]-headerH:destination==='col'?y[r]-headerH-scrollTop:y[r]-headerH}px;left:${destination==='row'?x[c]-rowW-(pinnedC?0:scrollLeft):destination==='col'?x[c]-rowW:x[c]}px;width:${(bounds?x[bounds.c2+1]:x[c+1])-x[c]}px;height:${(bounds?y[bounds.r2+1]:y[r+1])-y[r]}px;${appearance}" title="${esc(ref)}">${val==='☐'||val==='☑'?`<button type="button" class="cell-checkbox" role="checkbox" data-action="checkbox-toggle" data-ref="${ref}" aria-label="Отметка ${ref}" aria-checked="${val==='☑'}" title="${val==='☑'?'Отмечено':'Отметить'}">${val==='☑'?'✓':''}</button>`:href?`<span class="qo-link-text">${esc(val)}</span>`:esc(val)}${linkAction}${action}</div>`;
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
 qoSyncRibbonState();
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
 if(action==='workspace-tab'){qoWorkSwitchTab(target.dataset.editor,target.dataset.tab);return;}
 if(action==='theme-toggle'){qoToggleTheme();return;}

 if(action.startsWith('photo-')){
  if(qoPhotoExtraAction(action,target))return;
  if(action==='photo-panel'){qoPhotoSidebar=target.dataset.panel;qoPhotoLeftOpen=true;if(innerWidth<=1100)qoPhotoRightOpen=false;qoPhotoRefresh();return;}
  if(action==='photo-load'){document.getElementById('qo-photo-file')?.click();return;}
  if(action==='photo-insert-image'){document.getElementById('qs-image-file')?.click();return;}
  if(action==='photo-select-tool'||action==='photo-brush-tool'){qoPhotoTool=action==='photo-select-tool'?'select':'brush';qoPhotoSelectedId=null;qoPhotoRefresh();return;}
  if(action==='photo-add'){qoPhotoAdd(target.dataset.tool);return;}
  if(action==='photo-add-text'){qoPhotoAdd('text',{size:Number(target.dataset.size),text:target.dataset.size==='70'?'Ваш заголовок':target.dataset.size==='38'?'Подзаголовок':'Ваш текст'});return;}
  if(action==='photo-preset'){qoPhotoChangeSize(target.dataset.w,target.dataset.h);return;}
  if(action==='photo-template'){qoPhotoSnapshot();const w=qoPhotoCanvasW,h=qoPhotoCanvasH;qoPhotoStrokes=[];qoPhotoBG=target.dataset.template==='poster'?'#152841':'#e5f4ed';qoPhotoTransparent=false;const poster=target.dataset.template==='poster';qoPhotoStrokes.push({id:qoPhotoId(),tool:'rect',color:poster?'#d9ad75':'#378d67',size:3,fill:true,points:[[w*.1,h*.15],[w*.9,h*.18]]},{id:qoPhotoId(),tool:'text',text:poster?'ВАШ ЗАГОЛОВОК':'Новый проект',color:poster?'#f9e1b8':'#24503d',bold:true,size:Math.max(20,Math.round(w*.052)),points:[[w*.13,h*.47]]},{id:qoPhotoId(),tool:'text',text:'Подзаголовок или описание',color:poster?'#fff6e1':'#47705d',size:Math.max(12,Math.round(w*.027)),points:[[w*.13,h*.58]]});qoPhotoSelectedId=null;qoPhotoRefresh();return;}
  if(action==='photo-bg-color'){qoPhotoSnapshot();qoPhotoBG=target.dataset.color;qoPhotoTransparent=false;qoPhotoRefresh();return;}
  if(action==='photo-resize'){qoPhotoChangeSize(document.getElementById('qs-width')?.value,document.getElementById('qs-height')?.value);return;}
  if(action==='photo-select-layer'){qoPhotoSelectObject(qoPhotoStrokes.find(o=>o.id===target.dataset.id),e.shiftKey||e.ctrlKey||e.metaKey);qoPhotoTool='select';qoPhotoRefresh();return;}
  if(action==='photo-layer-lock'||action==='photo-layer-visibility'){const o=qoPhotoStrokes.find(x=>x.id===target.dataset.id);if(o){qoPhotoSnapshot();if(action==='photo-layer-lock')o.locked=!o.locked;else o.hidden=!o.hidden;qoPhotoRefresh();}return;}
  if(action==='photo-group'||action==='photo-ungroup'){qoPhotoGroupSelection(action==='photo-group');return;}
  if(action==='photo-lock'||action==='photo-unlock'){qoPhotoSetLock(action==='photo-lock');return;}
  if(action==='photo-align-center'||action==='photo-align-middle'||action==='photo-canvas-center'||action==='photo-canvas-middle'){qoPhotoAlign(action==='photo-align-center'?'center':action==='photo-align-middle'?'middle':action==='photo-canvas-center'?'canvas-center':'canvas-middle');return;}
  if(action==='photo-add-text'){qoPhotoAdd('text');return;}
  if(action==='photo-undo'){const snap=qoPhotoHistory.pop();if(snap){qoPhotoRedo.push(qoPhotoState());qoPhotoApplyState(snap);qoPhotoRefresh();}return;}
  if(action==='photo-redo'){const snap=qoPhotoRedo.pop();if(snap){qoPhotoHistory.push(qoPhotoState());qoPhotoApplyState(snap);qoPhotoRefresh();}return;}
  if(action==='photo-duplicate'){qoPhotoDuplicateSelection();return;}
  if(action==='photo-delete'){qoPhotoRemoveSelection();return;}
  if(action==='photo-front'||action==='photo-back'){const i=qoPhotoStrokes.findIndex(o=>o.id===qoPhotoSelectedId),n=i+(action==='photo-front'?1:-1);if(i>=0&&n>=0&&n<qoPhotoStrokes.length&&!qoPhotoStrokes[i].locked){qoPhotoSnapshot();[qoPhotoStrokes[i],qoPhotoStrokes[n]]=[qoPhotoStrokes[n],qoPhotoStrokes[i]];qoPhotoRefresh();}return;}
  if(action==='photo-reset'){qoPhotoSnapshot();qoPhotoAdjust={brightness:100,contrast:100,saturation:100};qoPhotoRefresh();return;}
  if(action==='photo-zoom-out'||action==='photo-zoom-in'){qoPhotoZoomTo(qoPhotoZoom+(action==='photo-zoom-in'?.1:-.1));return;}
  if(action==='photo-fit'){qoPhotoFit();return;}
  if(action==='photo-export'){qoPhotoExport();return;}
  if(action==='photo-export-project'){qoPhotoExportProject();return;}
  return;
 }
 if(action==='writer-cmd'){qoWriterCommand(target.dataset.command);return;}
 if(action==='writer-link'){
  const url=prompt('Адрес ссылки (https://...)');if(url===null)return;
  const safe=qoSafeURL(url.trim());if(!safe){status('Допустимы HTTPS, HTTP и mailto',true);return;}
  qoWriterFocusSelection();document.execCommand('createLink',false,safe);qoPersistWriter();return;
 }
 if(action==='writer-new'){
  if(!confirm('Создать новый текстовый документ? Текущий документ можно скачать в HTML.'))return;
  qoWriter=qoNewWriter();render();qoPersistWriter();return;
 }
 if(action==='writer-import'){document.getElementById('qo-writer-file')?.click();return;}
 if(action==='writer-export-html'){qoWriterExport('html');return;}
 if(action==='writer-export-txt'){qoWriterExport('txt');return;}
 if(action==='writer-print'){qoWriterPrint();return;}
 if(action==='writer-export-qdoc'){qoWriterExport('qdoc');return;}
 if(action==='writer-break'){qoWriterInsertBreak();return;}
 if(action==='writer-table'){
  const raw=prompt('Размер таблицы: строки × столбцы (например, 3x4)','3x3');if(raw===null)return;
  const match=raw.trim().match(/^(\d{1,2})\s*[xх×*]\s*(\d{1,2})$/i);
  if(!match){status('Укажите строки и столбцы в формате 3x4',true);return;}
  const count=Math.min(20,+match[1]),cols=Math.min(12,+match[2]);if(count<1||cols<1){status('Недопустимый размер таблицы',true);return;}
  const tr=Array.from({length:count},(_,i)=>`<tr>${Array.from({length:cols},()=>`<${i===0?'th':'td'}><br></${i===0?'th':'td'}>`).join('')}</tr>`).join('');
  qoWriterInsert('<table><tbody>'+tr+'</tbody></table><p><br></p>');return;
 }
 if(['writer-add-row','writer-add-col','writer-delete-row','writer-delete-table'].includes(action)){qoWriterTableAction(action);return;}
 if(action==='writer-image'){document.getElementById('qo-writer-image-file')?.click();return;}
 if(action==='writer-remove-image'){
  if(qoWriterSelectedImage?.isConnected){qoWriterSelectedImage.remove();qoWriterImageSelect(null);qoPersistWriter();}return;
 }
 if(action.startsWith('slides-')){
  if(action==='slides-add'){if(qoSlides.slides.length>=60){status('Лимит: 60 слайдов',true);return;}qoSlides.slides.splice(qoSlides.active+1,0,qoNewSlide(qoSlides.slides.length+1));qoSlides.active++;qoSlides.selected='title';qoPersistSlides();render();return;}
  if(action==='slides-duplicate'){if(qoSlides.slides.length>=60)return;const clone=structuredClone(qoSlide());clone.id='slide-'+Date.now();qoSlides.slides.splice(qoSlides.active+1,0,clone);qoSlides.active++;qoPersistSlides();render();return;}
  if(action==='slides-remove'){if(qoSlides.slides.length===1){status('Необходимо оставить хотя бы один слайд',true);return;}qoSlides.slides.splice(qoSlides.active,1);qoSlides.active=Math.max(0,qoSlides.active-1);qoSlides.selected=null;qoPersistSlides();render();return;}
  if(action==='slides-select'){qoSlides.active=Math.max(0,Math.min(qoSlides.slides.length-1,Number(target.dataset.index)||0));qoSlides.selected=null;qoPersistSlides();render();return;}
  if(action==='slides-add-text'){qoSlideAddObject('text');return;}
  if(action==='slides-add-shape'){qoSlideAddObject('shape');return;}
  if(action==='slides-add-image'){document.getElementById('qo-slide-image-picker')?.click();return;}
  if(['slides-duplicate-object','slides-front','slides-back','slides-center'].includes(action)){
   const items=qoSlide().items,index=items.findIndex(x=>x.id===qoSlides.selected);
   if(index<0){status('Сначала выберите объект на слайде',true);return;}
   const item=items[index];
   if(action==='slides-duplicate-object'){
    if(items.length>=40){status('Лимит: 40 объектов на слайд',true);return;}
    const clone=structuredClone(item);clone.id='obj-'+Date.now()+'-'+Math.random().toString(16).slice(2,7);clone.x=Math.min(100-clone.w,clone.x+4);clone.y=Math.min(100-clone.h,clone.y+4);items.push(clone);qoSlides.selected=clone.id;
   }else if(action==='slides-center'){item.x=(100-item.w)/2;item.y=(100-item.h)/2;}
   else{items.splice(index,1);action==='slides-front'?items.push(item):items.unshift(item);}
   qoPersistSlides();render();return;
  }
  if(action==='slides-delete-object'){qoSlide().items=qoSlide().items.filter(item=>item.id!==qoSlides.selected);qoSlides.selected=null;qoPersistSlides();render();return;}
  if(action==='slides-present'){qoSlidesPresent();return;}
  if(action==='slides-exit'){const overlay=document.getElementById('qo-slides-overlay');if(overlay){overlay.hidden=true;overlay.innerHTML='';}return;}
  if(action==='slides-next'||action==='slides-prev'){qoSlides.active=Math.max(0,Math.min(qoSlides.slides.length-1,qoSlides.active+(action==='slides-next'?1:-1)));qoSlidesPresent();return;}
  if(action==='slides-export'){qoSlidesDownload();return;}
  if(action==='slides-import'){document.getElementById('qo-slide-import-picker')?.click();return;}
  if(action==='slides-export-png'){await qoSlidesExportPNG();return;}
  if(action==='slides-print'){window.print();return;}
 }

 if(action==='link-open'){e.stopPropagation();return;}
 switch(action){case 'templates':templateKind=target.dataset.kind||'sheet';page='templates';render();break;case 'template-create':{
 const t=target.dataset.template;
 if(t.startsWith('writer-')){qoWriter=qoNewWriter();if(t==='writer-lesson')qoWriter.html='<h1>Конспект занятия</h1><h2>Цель занятия</h2><p>Описание цели.</p><h2>Материалы</h2><ul><li>Материал 1</li></ul><h2>Ход занятия</h2><p>План работы.</p>';if(t==='writer-letter')qoWriter.html='<p>Дата</p><h2>Тема письма</h2><p>Уважаемые коллеги!</p><p>Текст письма.</p><p>С уважением,</p>';page='writer';render();qoPersistWriter();break;}
 if(t.startsWith('slides-')){qoSlides=qoNewSlides();if(t==='slides-lesson'){qoSlides.name='Учебная презентация';qoSlides.slides.push(qoNewSlide(2));}if(t==='slides-report')qoSlides.name='Доклад';page='slides';render();qoPersistSlides();break;}
 createBook(t==='new'?false:t);break;}case 'select-row':{if(headerIgnoreClick?.axis==='row'&&performance.now()<headerIgnoreClick.until){headerIgnoreClick=null;break;}const index=Number(target.dataset.index),a=cellName(index,0),b=cellName(index,LIMITS.columns-1);if(e.ctrlKey||e.metaKey)addSelection(a,b);else setSelection(a,b);break;}case 'select-col':{if(headerIgnoreClick?.axis==='col'&&performance.now()<headerIgnoreClick.until){headerIgnoreClick=null;break;}const index=Number(target.dataset.index),a=cellName(0,index),b=cellName(LIMITS.rows-1,index);if(e.ctrlKey||e.metaKey)addSelection(a,b);else setSelection(a,b);break;}case 'select-all':setSelection('A1',cellName(LIMITS.rows-1,LIMITS.columns-1));break;case 'route':route(target.dataset.target);break;case 'new':createBook();break;case 'schedule':createBook('schedule');break;case 'example':createBook(true);break;case 'open':openBook(id);break;case 'clone':cloneBook(id);break;case 'rename-book':renameBookInline(id,target);break;case 'delete':removeBook(id);break;
 case 'import':if(page==='photo'){document.getElementById('qo-photo-file')?.click();break;}if(page==='writer'){document.getElementById('qo-writer-file')?.click();break;}if(page==='slides'){document.getElementById('qo-slide-import-picker')?.click();break;}document.querySelector('#file-picker')?.click();break;case 'open-disk':await openBookFromDisk();break;case 'backup':backup();break;case 'save':if(page==='writer'){qoWriterExport('qdoc');break;}if(page==='slides'){qoSlidesDownload();break;}if(page==='photo'){qoPhotoExportProject();break;}await saveBook();break;case 'save-as':await saveBook(true);break;
 case 'xlsx':if(book()){try{commitEditor();const data=await exportXLSX(book());download(`${safeFile(book().name)}.xlsx`,data,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');status('XLSX скачан: диаграммы, проверки данных, условное форматирование, области и параметры печати сохранены. Совместимость с Excel остаётся частичной; сохраните .qbook.');}catch(err){status(err.message||'Ошибка экспорта XLSX',true);}}break;
 case 'csv':if(sheet()){download(`${safeFile(book().name)}-${safeFile(sheet().name)}.csv`,'\uFEFF'+exportCSV(sheet(),book()),'text/csv;charset=utf-8');status('CSV скачан (текущий лист)');}break;
 case 'size-context-close':sizeContext=null;document.getElementById('size-context-menu')?.remove();break;
 case 'size-context-mode':if(sizeContext)openSizeContext(target.dataset.kind,parseCell(activeCell)?.[target.dataset.kind==='col'?'col':'row']??sizeContext.index,sizeContext.x,sizeContext.y);break;
 case 'size-context-apply':applyContextSize();break;
 case 'context-copy':sizeContext=null;document.getElementById('size-context-menu')?.remove();await copySelection();break;
 case 'context-paste':sizeContext=null;document.getElementById('size-context-menu')?.remove();pasteOnlyValues();break;
 case 'context-clear':sizeContext=null;document.getElementById('size-context-menu')?.remove();clearSelected();break;
 case 'context-checkbox':sizeContext=null;document.getElementById('size-context-menu')?.remove();insertCheckboxes();break;
 case 'context-link':sizeContext=null;document.getElementById('size-context-menu')?.remove();openLinkEditor();break;
 case 'context-sort-toggle':{
  const parent=target.closest('.sort-menu-item');const expanded=parent?.classList.toggle('is-open');
  target.setAttribute('aria-expanded',String(!!expanded));
  if(expanded)parent.querySelector('#context-sort-column')?.focus();break;}
 case 'context-sort':sortFromContext(target.dataset.direction);break;
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
 case 'chart-remove':try{selectedChartId=id||selectedChartId;transact(()=>removeChart(sheet(),selectedChartId));chartDrawerOpen=false;selectedChartId=(sheet().charts||[])[0]?.id||null;render();status('Диаграмма удалена');}catch(err){status(err.message,true);}break;
 case 'chart-manual-apply':try{applyChartManualData(document.getElementById('chart-manual-data')?.value||'');}catch(err){status(err.message||'Не удалось вставить данные',true);}break;
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
 case 'smart-help':case 'help-open':smartTableHelpOpen=true;render();document.querySelector('.qo-central-help')?.focus({preventScroll:true});break;case 'smart-help-close':case 'help-close':smartTableHelpOpen=false;render();break;case 'help-close-backdrop':if(e.target===target){smartTableHelpOpen=false;render();}break;
 case 'smart-create':createSelectedSmartTable();break;case 'smart-add-row':addSelectedSmartTableRow();break;case 'smart-remove':clearSelectedSmartTable();break;
 case 'filter-toggle':toggleAutoFilter();break;
 case 'filter-clear-all':if(!sheet()?.autoFilter){status('Автофильтр не включён');break;}transact(()=>{sheet().autoFilter.rules={};invalidateGridGeometry(sheet());});filterColumn=null;filterUiColumn=null;render();status('Все условия фильтра очищены');break;
 case 'filter-menu':filterColumn=Number(target.dataset.col);buildFilterChoices();render();break;
 case 'filter-close':filterColumn=null;filterUiColumn=null;render();break;
 case 'filter-reset':transact(()=>setFilterValue(sheet(),filterColumn,null));filterColumn=null;filterUiColumn=null;render();break;
 case 'filter-reset-all':transact(()=>{sheet().autoFilter.rules={};invalidateGridGeometry(sheet());});filterColumn=null;filterUiColumn=null;render();status('Все фильтры сброшены');break;
 case 'filter-only-found':{const found=filterVisibleChoices();if(found.length>200){status('Найдено больше 200 вариантов — уточните поиск',true);break;}filterUiPicked=new Set(found.map(p=>p.value));qoFilterRefreshChoices();break;}
 case 'filter-all':case 'filter-none':for(const {value} of filterVisibleChoices())if(action==='filter-all')filterUiPicked.add(value);else filterUiPicked.delete(value);qoFilterRefreshChoices();break;
 case 'filter-apply':{
  if(filterColumn===null)break;
  if(!filterUiPicked.size){status('Выберите хотя бы одно значение',true);break;}
  const chosen=filterUiChoices.filter(value=>filterUiPicked.has(value));
  if(chosen.length>200&&chosen.length!==filterUiChoices.length){status('Больше 200 значений — используется фильтр по условию',true);break;}
  // Rebuild only from the current column; stale popup selections cannot enter a rule.
  const rule=chosen.length===filterUiChoices.length?null:chosen;
  try{transact(()=>setFilterValue(sheet(),filterColumn,rule));filterColumn=null;filterUiColumn=null;render();status('Фильтр значений применён');}catch(err){status(err.message,true);}break;
 }
 case 'filter-condition-apply':{
  const op=document.getElementById('qo-filter-operator')?.value,term=document.getElementById('qo-filter-term')?.value??'';
  try{const rule={kind:'condition',op,value:term.trim()};transact(()=>setFilterValue(sheet(),filterColumn,rule));filterColumn=null;filterUiColumn=null;render();status('Условие фильтра применено');}catch(err){status(err.message,true);}break;
 }
 case 'freeze-row':updateFreeze(1,sheet().freeze?.cols||0);break;
 case 'freeze-col':updateFreeze(sheet().freeze?.rows||0,1);break;
 case 'freeze-at':{const pos=parseCell(activeCell);updateFreeze(pos.row,pos.col);break;}
 case 'freeze-clear':updateFreeze(0,0);break;
 case 'column-width':changeSize('col');break;case 'column-fit':autoFitColumn();break;case 'row-height':changeSize('row');break;case 'row-reset':resetRowHeight();break;
  case 'text-palette':case 'fill-palette':recordColorSelection();activePalette=action==='text-palette'?'color':'bg';paletteExpanded=false;qoSetCustomColor(getEffectiveStyle(sheet(),activeCell)[activePalette]|| (activePalette==='color'?'#111111':'#36936A'));borderMenuOpen=false;fontDropdownOpen=false;render();break;
 case 'palette-pick':qoApplyPaletteKeepOpen(activePalette,value);break;
 case 'palette-clear':qoApplyPaletteKeepOpen(activePalette,undefined);break;
 case 'palette-more':paletteExpanded=!paletteExpanded;render();if(paletteExpanded){const pop=document.querySelector('.palette-popover');if(pop)pop.scrollTop=pop.scrollHeight;}break;
 case 'palette-custom-apply':{const hex=qoColorHex();qoApplyPaletteKeepOpen(activePalette,hex);break;}
 case 'font-menu':fontDropdownOpen=!fontDropdownOpen;activePalette=null;borderMenuOpen=false;render();break;
 case 'font-menu-close':fontDropdownOpen=false;render();break;
 case 'font-pick':qoPickFont(value);break;
 case 'border-menu':borderMenuOpen=!borderMenuOpen;activePalette=null;fontDropdownOpen=false;render();break;
 case 'border-mode':setCellBorders(value);break;
 case 'popup-close':activePalette=null;paletteExpanded=false;borderMenuOpen=false;fontDropdownOpen=false;render();break;
 case 'insert-link':openLinkEditor();break;
 case 'link-save':saveLinkEditor();break;
 case 'link-close':if(e.target.closest('.qo-link-dialog')&&target.classList.contains('qo-link-backdrop'))break;linkEditorRef=null;render();break;
 case 'link-remove':if(linkEditorRef){transact(()=>removeHyperlink(sheet(),linkEditorRef));linkEditorRef=null;render();status('Гиперссылка удалена');}break;
 case 'insert-checkbox':insertCheckboxes();break;case 'checkbox-toggle':e.preventDefault();toggleCellCheckbox(ref);break;
 case 'merge-cells':updateMerge('merge');break;case 'unmerge-cells':updateMerge('unmerge');break;
 case 'border-all':setCellBorders('all');break;case 'border-none':setCellBorders('none');break;case 'wrap':toggleWrap();break;
 case 'bold':applyStyle({bold:!getEffectiveStyle(sheet(),activeCell).bold});break;case 'italic':applyStyle({italic:!getEffectiveStyle(sheet(),activeCell).italic});break;
 case 'underline':applyStyle({underline:!getEffectiveStyle(sheet(),activeCell).underline});break;
 case 'strike':applyStyle({strike:!getEffectiveStyle(sheet(),activeCell).strike});break;
 case 'valign':applyStyle({verticalAlign:value});break;case 'align':applyStyle({align:value});break;case 'format':applyStyle({format:value});break;
 case 'formula-fn':{
  const p=parseCell(activeCell),from=p.row>0?cellName(0,p.col):cellName(1,p.col),to=p.row>0?cellName(p.row-1,p.col):cellName(9,p.col);
  const range=from+':'+to,examples={SUMIF:`SUMIF(${range},"условие")`,SUMIFS:`SUMIFS(${range},${range},"условие")`,
   COUNTIF:`COUNTIF(${range},"условие")`,COUNTIFS:`COUNTIFS(${range},"условие")`,AVERAGEIFS:`AVERAGEIFS(${range},${range},"условие")`,
   VLOOKUP:'VLOOKUP(A1,A2:C10,2,FALSE)',HLOOKUP:'HLOOKUP(A1,A1:J3,2,FALSE)',XLOOKUP:'XLOOKUP(A1,A2:A10,B2:B10,"Не найдено")',
   INDEX:'INDEX(A1:C10,2,2)',MATCH:'MATCH(A1,B1:B10,0)',LEFT:'LEFT(A1,3)',RIGHT:'RIGHT(A1,3)',
   MID:'MID(A1,2,4)',TEXTJOIN:'TEXTJOIN(", ",TRUE,A1:A10)'};
  const formula='='+ (examples[fn]||fn+'('+range+')');
  const field=document.querySelector('#formula-input');if(field){field.value=formula;field.focus();field.setSelectionRange(formula.length,formula.length);
   status('Заготовка '+fn+' добавлена в строку формул. Исправьте аргументы и нажмите Enter');}break;}
 case 'copy':await copySelection();break;case 'paste-values':pasteOnlyValues();break;case 'goto':setSelection(ref);ensureVisible(parseCell(ref).row,parseCell(ref).col);break;
 case 'hide-row':visibilityAction('row',false);break;case 'show-rows':visibilityAction('row',true);break;case 'hide-col':visibilityAction('col',false);break;case 'show-cols':visibilityAction('col',true);break;
 case 'insert-row':structuralAction('row','insert');break;case 'delete-row':structuralAction('row','delete');break;case 'insert-col':structuralAction('col','insert');break;case 'delete-col':structuralAction('col','delete');break;
 case 'sheet-add':addSheet();break;case 'sheet-rename':renameSheet();break;case 'sheet-delete':deleteSheet();break;case 'sheet-select':if(e.detail>=2){renameSheet(id);break;}if(book().activeSheetId===id)break;commitEditor();book().activeSheetId=id;changed();setSelection('A1');render();break;
 }});
app.addEventListener('contextmenu',e=>{
 const header=e.target.closest('.rowhead,.colhead'),cell=e.target.closest('.grid-cell'),corner=e.target.closest('#grid-corner');
 if(!header&&!cell&&!corner)return; // keep browser context menu outside the spreadsheet grid
 e.preventDefault();e.stopPropagation();
 if(corner){setSelection('A1',cellName(LIMITS.rows-1,LIMITS.columns-1));openSizeContext('all',0,e.clientX,e.clientY);return;}
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
  openSizeContext('cell',0,e.clientX,e.clientY,parseCell(ref)?.col);
 }
},true);
app.addEventListener('pointerdown',e=>{
 if(sizeContext&&!e.target.closest('#size-context-menu')){
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
app.addEventListener('pointerdown',e=>{if((activePalette||borderMenuOpen)&&!e.target.closest('.format-popover,[data-action=fill-palette],[data-action=text-palette],[data-action=border-menu]')){activePalette=null;paletteExpanded=false;borderMenuOpen=false;document.querySelectorAll('.format-popover').forEach(el=>el.remove());}if(fontDropdownOpen&&!e.target.closest('.font-menu,.font-picker-trigger')){fontDropdownOpen=false;document.querySelectorAll('.font-menu').forEach(el=>el.remove());}},true);
app.addEventListener('focusin',e=>{if(e.target?.matches?.('input[type=color]')&&!pendingColorSelection)recordColorSelection();});
let qoSVActive=false;
app.addEventListener('pointerdown',e=>{
 const zone=e.target.closest('#palette-sv');if(!zone)return;
 qoSVActive=true;qoPaletteSVAt(e.clientX,e.clientY);try{zone.setPointerCapture(e.pointerId);}catch{}e.preventDefault();
});
app.addEventListener('pointermove',e=>{if(qoSVActive)qoPaletteSVAt(e.clientX,e.clientY);});
window.addEventListener('pointerup',()=>{qoSVActive=false;});
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&smartTableHelpOpen){smartTableHelpOpen=false;render();e.preventDefault();e.stopPropagation();}
},true);
window.addEventListener('keydown',e=>{
 if(page!=='photo'||document.getElementById('qo-appearance-menu')||e.target.closest?.('input,textarea,select,[contenteditable]'))return;
 if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();document.querySelector('[data-action="photo-'+(e.key.toLowerCase()==='y'||e.shiftKey?'redo':'undo')+'"]')?.click();return;}
 if((e.key==='Delete'||e.key==='Backspace')&&qoPhotoSelection().length){e.preventDefault();qoPhotoRemoveSelection();return;}
 if(e.key==='Escape'&&(qoPhotoDrag||qoPhotoActiveStroke||qoPhotoMarquee)){qoPhotoCancelPointer();e.preventDefault();e.stopPropagation();return;}
 if(e.key==='Escape'&&qoPhotoSelection().length){qoPhotoSetSelection([]);qoPhotoRefresh();e.preventDefault();}
},true);
app.addEventListener('keydown',e=>{
 if(e.target.id==='palette-sv'&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
  if(e.key==='ArrowUp')paletteVal=Math.min(100,paletteVal+2);
  if(e.key==='ArrowDown')paletteVal=Math.max(0,paletteVal-2);
  if(e.key==='ArrowLeft')paletteSat=Math.max(0,paletteSat-2);
  if(e.key==='ArrowRight')paletteSat=Math.min(100,paletteSat+2);
  qoColorPickerPreview();e.preventDefault();
 }
 if(e.key==='Escape'&&sizeContext){sizeContext=null;document.getElementById('size-context-menu')?.remove();e.preventDefault();return;}
 if(e.key==='Escape'&&smartTableHelpOpen){smartTableHelpOpen=false;render();e.preventDefault();return;}
 if(e.key==='Escape'&&linkEditorRef){linkEditorRef=null;render();return;}
 if(e.key==='Escape'&&(fontDropdownOpen||activePalette)){fontDropdownOpen=false;activePalette=null;paletteExpanded=false;render();}
});

app.addEventListener('input',e=>{
 if(e.target.id==='qo-photo-size'){qoPhotoSize=Number(e.target.value);const out=document.getElementById('qs-brush-output');if(out)out.textContent=String(qoPhotoSize);return;}
 if(e.target.id==='qs-zoom'){qoPhotoZoomTo(Number(e.target.value)/100);return;}
 if(e.target.id==='qs-project-title'){qoPhotoFile=e.target.value.slice(0,120)||'Без названия';qoPhotoPersist();return;}
 if(e.target.matches('[data-photo-adjust]')){qoPhotoAdjust[e.target.dataset.photoAdjust]=Number(e.target.value);e.target.previousElementSibling.textContent=String(e.target.value)+'%';qoPhotoRender();qoPhotoPersist();return;}
 if(e.target.id==='qo-writer-page'||e.target.id==='qo-writer-title'){qoPersistWriter();if(e.target.id==='qo-writer-page')qoWriterStats();return;}
 if(e.target.id==='qo-slides-title'){qoPersistSlides();return;}
 if(e.target.id==='qo-slide-text'){
  const item=qoSlide()?.items.find(i=>i.id===qoSlides.selected);if(item){item.text=e.target.value.slice(0,3000);qoPersistSlides();const el=document.querySelector('.qo-slide-stage [data-slide-item="'+CSS.escape(item.id)+'"]');if(el)el.textContent=item.text;}
  return;
 }
 if(e.target.id==='qo-filter-search'){filterUiQuery=e.target.value;qoFilterRefreshChoices();return;}if(e.target.matches('[data-filter-index]')){const value=filterUiChoices[Number(e.target.dataset.filterIndex)];if(value!==undefined){if(e.target.checked)filterUiPicked.add(value);else filterUiPicked.delete(value);}qoFilterRefreshChoices();return;}if(e.target.id==='find-term')searchTerm=e.target.value;else if(e.target.id==='replace-term')replaceTerm=e.target.value;else if(e.target.id==='palette-hue'){paletteHue=Number(e.target.value);qoColorPickerPreview();}else if(e.target.id==='palette-hex'){if(qoSetCustomColor(e.target.value))qoColorPickerPreview();}});
app.addEventListener('change',async e=>{const t=e.target;
 if(t.id==='qo-writer-file'){
  const file=t.files?.[0];if(!file)return;
  if(file.size>3_000_000){status('Размер документа ограничен 3 МБ',true);return;}
  try{
   const raw=await file.text(),kind=file.name.toLowerCase();
   if(kind.endsWith('.qdoc')){
    const doc=JSON.parse(raw);if(doc.format!=='quantum-writer'||typeof doc.html!=='string'||doc.html.length>2400000)throw Error('Недопустимый QDOC');
    qoWriter={name:(doc.name||file.name).slice(0,120),html:qoSafeRich(doc.html),layout:doc.layout,updated:Date.now()};
   }else qoWriter={name:file.name.replace(/\.[^.]+$/,''),html:kind.endsWith('.html')?qoSafeRich(raw):'<p>'+esc(raw).replace(/\n/g,'<br>')+'</p>',layout:qoWriterDefaults(),updated:Date.now()};
   qoWriter.layout=qoWriterLayout();qoWriterSelectionRange=null;qoWriterImageSelect(null);render();qoPersistWriter();
  }catch(error){status('Не удалось открыть документ: неверный формат или повреждённые данные',true);}return;
 }
 if(t.id==='qo-writer-image-file'){
  const file=t.files?.[0];if(!file)return;
  if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>1_500_000){status('Допустимы PNG/JPEG/WebP/GIF размером до 1,5 МБ',true);return;}
  const reader=new FileReader();reader.onload=()=>{
   const img=String(reader.result||'');if(!/^data:image\/(png|jpeg|webp|gif);base64,/i.test(img)){status('Не удалось открыть изображение',true);return;}
   qoWriterInsert('<p><img src="'+img+'" alt="Изображение" style="width:75%"></p><p><br></p>');
  };reader.readAsDataURL(file);t.value='';return;
 }
 if(['qo-writer-margin','qo-writer-font','qo-writer-size','qo-writer-line'].includes(t.id)){
  const key=t.id.replace('qo-writer-','');qoWriter.layout[key]=['font'].includes(key)?t.value:Number(t.value);
  qoWriter.layout=qoWriterLayout();const el=document.getElementById('qo-writer-page');if(el)el.setAttribute('style',qoWriterCSS());qoPersistWriter();return;
 }
 if(t.id==='qo-writer-text-color'||t.id==='qo-writer-highlight'){
  qoWriterFocusSelection();document.execCommand(t.id==='qo-writer-highlight'?'hiliteColor':'foreColor',false,t.value);qoWriterRememberSelection();qoPersistWriter();return;
 }
 if(t.id==='qo-writer-img-width'){
  if(qoWriterSelectedImage?.isConnected){qoWriterSelectedImage.style.width=t.value+'%';qoPersistWriter();}return;
 }
 if(page==='photo'&&t.id==='qs-image-file'){const f=t.files?.[0];if(f)try{await qoPhotoInsertImage(f);}catch(error){status(error.message,true);}t.value='';return;}
 if(page==='photo'&&t.id==='qs-background-color'){qoPhotoSnapshot();qoPhotoBG=t.value;qoPhotoTransparent=false;qoPhotoRefresh();return;}
 if(page==='photo'&&t.id==='qs-transparent'){qoPhotoSnapshot();qoPhotoTransparent=t.checked;qoPhotoRefresh();return;}
 if(page==='photo'&&t.id.startsWith('qs-object-')){const o=qoPhotoObject();if(!o||o.locked)return;const key=t.id.slice('qs-object-'.length),b=qoPhotoBounds(o);qoPhotoSnapshot();
  if(key==='opacity')o.opacity=Number(t.value)/100;else if(key==='rotation')o.rotation=Math.max(-360,Math.min(360,Number(t.value)||0));else if(key==='color')o.color=t.value;else if(key==='text')o.text=t.value.slice(0,500);else if(key==='size')o.size=Math.max(1,Math.min(300,Number(t.value)||1));else if(key==='filled')o.fill=t.checked;
  else if(key==='x')qoPhotoMove(o,Number(t.value)-b.x,0);else if(key==='y')qoPhotoMove(o,0,Number(t.value)-b.y);else if(key==='w')qoPhotoResizeObject(o,Number(t.value),b.h);else if(key==='h')qoPhotoResizeObject(o,b.w,Number(t.value));
  qoPhotoRefresh();return;
 }
 if(t.id==='qo-photo-color'){qoPhotoColor=t.value;return;}
 if(t.id==='qo-photo-file'){const file=t.files?.[0];if(file)try{await qoPhotoFileLoad(file);}catch(error){status(error.message,true);}t.value='';return;}
 if(t.id==='qo-writer-block'){
  qoWriterFocusSelection();document.execCommand('formatBlock',false,t.value==='p'?'p':t.value);qoPersistWriter();return;
 }
 if(t.id==='qo-slides-bg'){qoSlide().bg=t.value;qoPersistSlides();render();return;}
 if(t.matches('[data-slide-prop]')){
  const item=qoSlide()?.items.find(i=>i.id===qoSlides.selected);if(!item)return;
  const prop=t.dataset.slideProp;
  if(prop==='bold')item.bold=t.checked;
  else if(['x','y','w','h','size'].includes(prop))item[prop]=Math.max(prop==='size'?10:prop==='w'||prop==='h'?5:0,Math.min(prop==='size'?100:100,Number(t.value)||0));
  else if(prop==='color')item.color=t.value;
  else if(prop==='fill'&&/^#[0-9a-f]{6}$/i.test(t.value))item.fill=t.value;
  else if(prop==='align'&&['left','center','right'].includes(t.value))item.align=t.value;
  qoPersistSlides();render();return;
 }
 if(t.id==='qo-slide-image-picker'||t.id==='qo-slide-import-picker'){
  const file=t.files?.[0];if(!file)return;
  try{
   if(t.id==='qo-slide-image-picker'){
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1_500_000)throw Error('Поддерживаются PNG, JPG или WebP до 1,5 МБ');
    const result=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Ошибка чтения изображения'));reader.readAsDataURL(file);});
    qoSlideAddObject('image',result);
   }else{
    if(file.size>3_500_000)throw Error('Файл слишком большой');
    const loaded=JSON.parse(await file.text());if(loaded?.format!=='quantum-office-slides-v1')throw Error('Неподдерживаемый файл презентации');
    const presentation=loaded.presentation;
    if(!presentation||!Array.isArray(presentation.slides)||!presentation.slides.length||presentation.slides.length>60)throw Error('Некорректная презентация');
    for(const slide of presentation.slides){if(!Array.isArray(slide.items)||slide.items.length>40)throw Error('Слишком много объектов');
     for(const item of slide.items){if(!['image','text','shape'].includes(item.kind))throw Error('Неподдерживаемый объект');
      if(item.kind==='shape'&&!/^#[0-9a-f]{6}$/i.test(item.fill||''))throw Error('Недопустимый цвет фигуры');
      if(item.kind==='image'&&!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(item.data||''))throw Error('Неверный файл изображения');
      if(item.kind==='text'&&String(item.text||'').length>3000)throw Error('Слишком длинный текст');
     }
    }
    qoSlides=structuredClone(presentation);qoSlides.active=Math.max(0,Math.min(qoSlides.slides.length-1,Number.isInteger(presentation.active)?presentation.active:0));qoSlides.selected=qoSlide().items.some(x=>x.id===presentation.selected)?presentation.selected:null;render();qoPersistSlides();
   }
  }catch(error){status(error.message,true);}
  return;
 }

 if(t.id==='qo-filter-operator'){const el=document.getElementById('qo-filter-term');if(el)el.disabled=['empty','notEmpty'].includes(t.value);return;}
if(t.id==='font-family-select'){if(FONT_FAMILIES.includes(t.value))qoPickFont(t.value);return;}
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
document.addEventListener('selectionchange',()=>{if(page==='writer')qoWriterRememberSelection();});
app.addEventListener('click',e=>{
 if(page!=='writer')return;
 if(e.target.matches('#qo-writer-page img'))qoWriterImageSelect(e.target);
 else if(e.target.closest('#qo-writer-page'))qoWriterImageSelect(null);
});
app.addEventListener('mousedown',e=>{if(e.target.closest('[data-action^="writer-"]'))e.preventDefault();},true);
app.addEventListener('paste',e=>{
 if(e.target.closest('#qo-writer-page')){
  e.preventDefault();document.execCommand('insertText',false,e.clipboardData?.getData('text/plain')||'');qoPersistWriter();
 }
},true);
// TASK095: Studio pointer transactions and cancellation.
app.addEventListener('pointerdown',e=>{
 if(page!=='photo'||e.button!==0||e.target.id!=='qo-photo-canvas')return;
 const pos=qoPhotoCoords(e);qoPhotoCompare=false;qoPhotoGuides=[];
 if(qoPhotoTool==='select'){
  const selected=qoPhotoSelection(),single=selected.length===1?selected[0]:null;
  const handle=single&&!single.locked?qoPhotoHandles(single).find(h=>Math.hypot(pos[0]-h.point[0],pos[1]-h.point[1])<10/qoPhotoZoom):null;
  const obj=handle?single:qoPhotoHit(pos),additive=e.shiftKey||e.ctrlKey||e.metaKey;
  if(obj){if(additive&&!handle){qoPhotoSelectObject(obj,true);}else{
   if(!qoPhotoSelection().some(o=>o.id===obj.id))qoPhotoSelectObject(obj,false);
   const editable=qoPhotoSelection().filter(o=>!o.locked);if(editable.length){const b=qoPhotoBounds(obj);qoPhotoDrag={id:obj.id,start:pos,prev:pos,mode:handle?.key==='rotate'?'rotate':handle?'resize':'move',handle:handle?.key,bounds:b,initial:structuredClone(obj),objects:structuredClone(editable),ids:editable.map(o=>o.id),before:qoPhotoState(),redo:structuredClone(qoPhotoRedo),started:false};}
  }}else{qoPhotoMarquee={start:pos,end:pos,additive,initial:additive?qoPhotoSelection().map(x=>x.id):[]};if(!additive)qoPhotoSetSelection([]);}
  qoPhotoUpdateSelectionInspector();e.target.setPointerCapture?.(e.pointerId);e.preventDefault();return;
 }
 if(qoPhotoTool!=='brush')return;qoPhotoBrushRedo=structuredClone(qoPhotoRedo);qoPhotoSnapshot();qoPhotoActiveStroke={id:qoPhotoId(),tool:'brush',color:qoPhotoColor,size:qoPhotoSize,points:[pos],fill:false};qoPhotoSetSelection([]);e.target.setPointerCapture?.(e.pointerId);e.preventDefault();
});
app.addEventListener('pointermove',e=>{
 if(page!=='photo')return;
 if(qoPhotoDrag){const d=qoPhotoDrag,pos=qoPhotoCoords(e),o=qoPhotoStrokes.find(x=>x.id===d.id);if(!o)return;
  if(!d.started&&Math.hypot(pos[0]-d.start[0],pos[1]-d.start[1])<1)return;
  if(!d.started){qoPhotoSnapshot();d.started=true;}
  if(d.mode==='move'){
   let dx=pos[0]-d.start[0],dy=pos[1]-d.start[1];const b=qoPhotoSelectionBounds(d.objects);qoPhotoGuides=[];
   if(!e.altKey){for(const axis of ['x','y']){const start=axis==='x'?b.x:b.y,size=axis==='x'?b.w:b.h,delta=axis==='x'?dx:dy;const candidates=[0,(axis==='x'?qoPhotoCanvasW:qoPhotoCanvasH)/2,axis==='x'?qoPhotoCanvasW:qoPhotoCanvasH];for(const other of qoPhotoStrokes.filter(x=>!d.ids.includes(x.id)&&!x.hidden)){const v=qoPhotoVisualBounds(other),a=axis==='x'?v.x:v.y,z=axis==='x'?v.w:v.h;candidates.push(a,a+z/2,a+z);}let distance=6/qoPhotoZoom,correction=0,guide=null;for(const target of candidates)for(const offset of [0,size/2,size]){const diff=target-(start+delta+offset);if(Math.abs(diff)<distance){distance=Math.abs(diff);correction=diff;guide=target;}}if(guide!==null){if(axis==='x')dx+=correction;else dy+=correction;qoPhotoGuides.push([axis,guide]);}}}
   for(const original of d.objects){const target=qoPhotoStrokes.find(x=>x.id===original.id);Object.assign(target,structuredClone(original));qoPhotoMove(target,dx,dy);}
  }else if(d.mode==='rotate'){const b=d.bounds,c=[b.x+b.w/2,b.y+b.h/2],angle=(Math.atan2(pos[1]-c[1],pos[0]-c[0])-Math.atan2(d.start[1]-c[1],d.start[0]-c[0]))*180/Math.PI+(d.initial.rotation||0);o.rotation=e.shiftKey?Math.round(angle/15)*15:Math.round(angle*10)/10;
  }else{
   const b=d.bounds,c=[b.x+b.w/2,b.y+b.h/2],sx=d.handle.includes('e')?1:-1,sy=d.handle.includes('s')?1:-1,anchor=rotatePoint([sx===1?b.x:b.x+b.w,sy===1?b.y:b.y+b.h],c,d.initial.rotation||0),local=rotatePoint(pos,anchor,-(d.initial.rotation||0));let w=Math.max(8,(local[0]-anchor[0])*sx),h=Math.max(8,(local[1]-anchor[1])*sy);if((d.initial.tool==='image'&&!e.altKey)||e.shiftKey){const ratio=b.w/Math.max(1,b.h);if(w/h>ratio)h=w/ratio;else w=h*ratio;}Object.assign(o,structuredClone(d.initial));qoPhotoResizeObject(o,w,h);const after=qoPhotoBounds(o),center=rotatePoint([anchor[0]+sx*after.w/2,anchor[1]+sy*after.h/2],anchor,o.rotation||0);qoPhotoMove(o,center[0]-after.w/2-after.x,center[1]-after.h/2-after.y);
  }d.prev=pos;qoPhotoRender();return;
 }
 if(qoPhotoMarquee){qoPhotoMarquee.end=qoPhotoCoords(e);qoPhotoRender();return;}if(qoPhotoActiveStroke){qoPhotoActiveStroke.points.push(qoPhotoCoords(e));qoPhotoRender();}
});
app.addEventListener('pointerup',()=>{if(page!=='photo')return;if(qoPhotoDrag){const changed=qoPhotoDrag.started;qoPhotoDrag=null;qoPhotoGuides=[];if(changed)qoPhotoRefresh();else qoPhotoUpdateSelectionInspector();return;}if(qoPhotoMarquee){const a=qoPhotoMarquee.start,b=qoPhotoMarquee.end,ids=new Set(qoPhotoMarquee.initial),x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]),w=Math.abs(a[0]-b[0]),h=Math.abs(a[1]-b[1]);if(w>4&&h>4)for(const o of qoPhotoStrokes){if(o.hidden)continue;const v=qoPhotoVisualBounds(o);if(v.x<x+w&&v.x+v.w>x&&v.y<y+h&&v.y+v.h>y)for(const id of qoPhotoExpandSelection(o))ids.add(id);}qoPhotoMarquee=null;qoPhotoSetSelection(ids);qoPhotoRefresh();return;}if(qoPhotoActiveStroke){qoPhotoStrokes.push(qoPhotoActiveStroke);qoPhotoActiveStroke=null;qoPhotoRefresh();}});
function qoPhotoCancelPointer(){if(!qoPhotoDrag&&!qoPhotoActiveStroke&&!qoPhotoMarquee)return;if(qoPhotoDrag?.started){const state=qoPhotoDrag.before,redo=qoPhotoDrag.redo;qoPhotoHistory.pop();qoPhotoApplyState(state);qoPhotoRedo=redo;}if(qoPhotoActiveStroke){const state=qoPhotoHistory.pop();if(state)qoPhotoApplyState(state);qoPhotoRedo=qoPhotoBrushRedo||[];}qoPhotoDrag=null;qoPhotoActiveStroke=null;qoPhotoMarquee=null;qoPhotoGuides=[];qoPhotoRefresh();}
window.addEventListener('pointercancel',qoPhotoCancelPointer);window.addEventListener('blur',qoPhotoCancelPointer);
window.addEventListener('keydown',e=>{if(page==='photo'&&e.key==='Escape')qoPhotoCancelPointer();});

app.addEventListener('pointerdown',e=>{
 if(page!=='slides'||e.button!==0)return;
 const object=e.target.closest('.qo-slide-stage [data-slide-item]');if(!object)return;
 const item=qoSlide().items.find(i=>i.id===object.dataset.slideItem);if(!item)return;
 e.preventDefault();qoSlideDrag={id:item.id,originalX:item.x,originalY:item.y,x:e.clientX,y:e.clientY,element:object};
 qoSlides.selected=item.id;document.querySelectorAll('.qo-slide-stage .qo-slide-object').forEach(el=>el.classList.toggle('selected',el===object));
});
window.addEventListener('pointermove',e=>{
 if(!qoSlideDrag||page!=='slides')return;
 const rect=qoSlideDrag.element.closest('.qo-slide-frame')?.getBoundingClientRect();if(!rect)return;
 const item=qoSlide().items.find(i=>i.id===qoSlideDrag.id);if(!item)return;
 item.x=Math.max(0,Math.min(100-item.w,qoSlideDrag.originalX+100*(e.clientX-qoSlideDrag.x)/rect.width));
 item.y=Math.max(0,Math.min(100-item.h,qoSlideDrag.originalY+100*(e.clientY-qoSlideDrag.y)/rect.height));
 qoSlideDrag.element.style.left=item.x+'%';qoSlideDrag.element.style.top=item.y+'%';
});
window.addEventListener('pointerup',()=>{if(qoSlideDrag){qoSlideDrag=null;qoPersistSlides();if(page==='slides')render();}});
window.addEventListener('keydown',e=>{if(page!=='slides')return;
 const overlay=document.getElementById('qo-slides-overlay');if(!overlay||overlay.hidden)return;
 if(e.key==='Escape'){overlay.hidden=true;overlay.innerHTML='';}
 if(['ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();qoSlides.active=Math.max(0,Math.min(qoSlides.slides.length-1,qoSlides.active+(e.key==='ArrowRight'?1:-1)));qoSlidesPresent();}
});
app.addEventListener('mousedown',e=>{if(e.button!==0)return;const cell=e.target.closest('.grid-cell');if(cell){if(e.target.closest('.filter-head,.cell-checkbox,.qo-cell-link'))return;e.preventDefault();const ref=cell.dataset.ref;window.getSelection()?.removeAllRanges();const additive=e.ctrlKey||e.metaKey,alreadySelected=additive&&inAnySelection(parseCell(ref).row,parseCell(ref).col);
 if(additive)toggleCellSelection(ref);else setSelection(e.shiftKey?activeCell:ref,ref);
 if(e.detail>=2&&!additive){mouseSelecting=false;editCell();}
 else{mouseSelecting=!additive||!alreadySelected;document.getElementById('grid-scroll')?.focus({preventScroll:true});}}});
app.addEventListener('mouseover',e=>{if(!mouseSelecting)return;const cell=e.target.closest('.grid-cell');if(cell&&cell.dataset.ref!==rangeEnd)setSelection(activeCell,cell.dataset.ref,true);});
window.addEventListener('mouseup',()=>{mouseSelecting=false;});
app.addEventListener('dblclick',e=>{const cell=e.target.closest('.grid-cell');if(cell){if(e.target.closest('.filter-head,.cell-checkbox,.qo-cell-link'))return;setSelection(cell.dataset.ref);editCell();}});
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

 if((e.ctrlKey||e.metaKey)&&(e.code==='KeyK'||e.key.toLowerCase()==='k')&&!form){e.preventDefault();openLinkEditor();return;}
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
