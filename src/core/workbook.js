import { cellName,parseCell,colLabel,evaluateCell,createCalculationSession,csvEncode,csvDecode } from './formulas.js';
import {formatTemporal,parseTemporalInput} from './dates.js';
import {validateCharts} from './charts.js';
import {validateConditionalRules} from './conditional.js';
import {validateDataRules,checkValidatedInput} from './validation.js';
import {validatePrintSettings} from './printing.js';
export const uid=()=>globalThis.crypto?.randomUUID?.()??`q-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const stamp=()=>new Date().toISOString();
// 100k virtual rows; populated cell count stays capped independently.
export const LIMITS={rows:100000,columns:100,cells:50000,sheets:25};
export function newSheet(name='Лист 1') {return {id:uid(),name,cells:{},charts:[],conditionalRules:[],validations:[],printSettings:{paper:'A4',orientation:'portrait',scale:100,fitWidth:true,area:null},columnWidths:{},rowHeights:{},hiddenRows:{},hiddenColumns:{},freeze:{rows:0,cols:0},autoFilter:null,merges:[],defaultAlign:null,defaultStyle:{},columnStyles:{},rowStyles:{},rectangleStyles:[]};}
export function newWorkbook(name='Новая таблица') {const sheet=newSheet();return {id:uid(),type:'sheet',name,created:stamp(),updated:stamp(),sheets:[sheet],activeSheetId:sheet.id};}
export function currentSheet(book){return book.sheets.find(s=>s.id===book.activeSheetId)||book.sheets[0];}
export const DIMENSIONS={defaultColumn:116,defaultRow:29,minColumn:48,maxColumn:520,minRow:22,maxRow:160};
const geometryCache=new WeakMap();
export function invalidateGridGeometry(sheet){if(sheet&&typeof sheet==='object')geometryCache.delete(sheet);}
export function columnWidth(sheet,index){return sheet.columnWidths?.[index]??sheet.defaultColumnWidth??DIMENSIONS.defaultColumn;}
export function rowHeight(sheet,index){return sheet.rowHeights?.[index]??sheet.defaultRowHeight??DIMENSIONS.defaultRow;}
export function setColumnWidth(sheet,index,value){
 if(!Number.isInteger(index)||index<0||index>=LIMITS.columns||!Number.isInteger(value)||value<DIMENSIONS.minColumn||value>DIMENSIONS.maxColumn)throw Error('Недопустимая ширина столбца');
 sheet.columnWidths??={};if(value===(sheet.defaultColumnWidth??DIMENSIONS.defaultColumn))delete sheet.columnWidths[index];else sheet.columnWidths[index]=value;
 invalidateGridGeometry(sheet);
}
export function setRowHeight(sheet,index,value){
 if(!Number.isInteger(index)||index<0||index>=LIMITS.rows||!Number.isInteger(value)||value<DIMENSIONS.minRow||value>DIMENSIONS.maxRow)throw Error('Недопустимая высота строки');
 sheet.rowHeights??={};if(value===(sheet.defaultRowHeight??DIMENSIONS.defaultRow))delete sheet.rowHeights[index];else sheet.rowHeights[index]=value;
 invalidateGridGeometry(sheet);
}
/** Explicit visibility is separate from filtering. The data and formulas remain intact. */
export function rowVisible(sheet,row){return !sheet.hiddenRows?.[row]&&filterRowVisible(sheet,row);}
export function columnVisible(sheet,col){return !sheet.hiddenColumns?.[col];}
export function setHidden(sheet,axis,index,hidden){
 const limit=axis==='row'?LIMITS.rows:axis==='col'?LIMITS.columns:0;
 if(!limit||!Number.isInteger(index)||index<0||index>=limit||typeof hidden!=='boolean')throw Error('Недопустимая строка или столбец');
 const key=axis==='row'?'hiddenRows':'hiddenColumns';sheet[key]??={};
 if(hidden){
  if(Object.keys(sheet[key]).length>=limit-1&&!sheet[key][index])throw Error('Нельзя скрыть все строки или столбцы');
  sheet[key][index]=true;
 }else delete sheet[key][index];
 invalidateGridGeometry(sheet);
}
export function showAllHidden(sheet,axis){
 const key=axis==='row'?'hiddenRows':axis==='col'?'hiddenColumns':null;
 if(!key)throw Error('Неизвестная ось');
 const count=Object.keys(sheet[key]||{}).length;sheet[key]={};invalidateGridGeometry(sheet);return count;
}
/** Filters never move or delete source cells. Only row visibility is changed. */
export function filterRange(sheet){const value=sheet.autoFilter;return value?rectangle(value.from,value.to):null;}
export function filterRowVisible(sheet,row){
 const rect=filterRange(sheet),rules=sheet.autoFilter?.rules||{};
 if(!rect||row<=rect.r1||row>rect.r2)return true;
 return Object.entries(rules).every(([col,needles])=>{
   const value=getCell(sheet,cellName(row,Number(col))).value;
   return Array.isArray(needles)?needles.includes(value):value===needles;
  });
}
export function setFreeze(sheet,rows,cols){
 if(!Number.isInteger(rows)||!Number.isInteger(cols)||rows<0||rows>10||cols<0||cols>10)throw Error('Закрепить можно не более 10 строк и столбцов');
 sheet.freeze={rows,cols};
}
export function setAutoFilter(sheet,from,to){
 const rect=rectangle(from,to);
 if(!rect||rect.r2<=rect.r1||rect.r2>=LIMITS.rows||rect.c2>=LIMITS.columns)throw Error('Выделите диапазон с заголовком и хотя бы одной строкой');
 sheet.autoFilter={from:cellName(rect.r1,rect.c1),to:cellName(rect.r2,rect.c2),rules:{}};
 invalidateGridGeometry(sheet);
}
export function setFilterValue(sheet,col,value){
 const rect=filterRange(sheet);
 if(!rect||!Number.isInteger(col)||col<rect.c1||col>rect.c2)throw Error('Столбец не входит в фильтр');
 if(value!==null){
   const validString=v=>typeof v==='string'&&v.length<=50000;
   if(!(validString(value)||(Array.isArray(value)&&value.length>0&&value.length<=200&&value.every(validString)&&new Set(value).size===value.length)))throw Error('Недопустимое значение фильтра');
  }
 const rules={...(sheet.autoFilter.rules||{})};
 if(value===null)delete rules[col];else rules[col]=value;
 sheet.autoFilter={...sheet.autoFilter,rules};invalidateGridGeometry(sheet);
}
export function gridGeometry(sheet){
 const cached=geometryCache.get(sheet);if(cached)return cached;
 const x=new Float64Array(LIMITS.columns+1),y=new Float64Array(LIMITS.rows+1);
 x[0]=54;y[0]=31;
 for(let col=0;col<LIMITS.columns;col++)x[col+1]=x[col]+(columnVisible(sheet,col)?columnWidth(sheet,col):0);
 for(let row=0;row<LIMITS.rows;row++)y[row+1]=y[row]+(rowVisible(sheet,row)?rowHeight(sheet,row):0);
 const geometry={x,y};geometryCache.set(sheet,geometry);return geometry;
}
export function firstVisibleIndex(positions,coordinate){
 let lo=0,hi=positions.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(positions[mid+1]<=coordinate)lo=mid+1;else hi=mid;}
 return Math.min(lo,positions.length-2);
}
export function getCell(sheet,ref){return sheet.cells[String(ref).toUpperCase()]||{value:'',style:{}};}
/** Supported real Excel edge styles; stored only on existing styled cells/axis defaults. */
export const XLSX_BORDER_LINES=new Set(['hair','thin','medium','thick','double','dotted','dashed','dashDot','dashDotDot','mediumDashed','mediumDashDot','mediumDashDotDot','slantDashDot']);
const BORDER_SIDES=['top','bottom','left','right'];
export function resolveBorderSide(style,side){
 if(!BORDER_SIDES.includes(side)||!style)return null;
 const active=style.borders?.[side]||(style.border==='thin'&&style.borders===undefined);
 if(!active)return null;
 const details=style.borderEdges?.[side];
 return {line:details?.line||'thin',color:details?.color||style.borderColor||'#526d5c'};
}
const validBorderEdges=edges=>edges&&typeof edges==='object'&&!Array.isArray(edges)&&
 Object.entries(edges).every(([side,info])=>BORDER_SIDES.includes(side)&&info&&
 typeof info==='object'&&!Array.isArray(info)&&Object.keys(info).length>=1&&
 Object.keys(info).every(k=>['line','color'].includes(k))&&
 XLSX_BORDER_LINES.has(info.line)&&
 (info.color===undefined||typeof info.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(info.color)));

/** Column-level inheritance excludes the explicit style of its first cell.
 * Excel column styles must not accidentally propagate A1's custom fill to A2. */
export function getColumnBaseStyle(sheet,col){
 const style={...(sheet.defaultStyle||{}),...(sheet.columnStyles?.[col]||{})};
 if(style.align===undefined&&sheet.defaultAlign!=null)style.align=sheet.defaultAlign;
 for(const key of Object.keys(style))if(style[key]===null)delete style[key];
 return style;
}
/** Layered style resolution, without allocation for empty virtual rows. */
export function getEffectiveStyle(sheet,ref,includeCell=true){
 const pos=parseCell(ref),own=includeCell?(sheet.cells[String(ref).toUpperCase()]?.style||{}):{};
 const column=pos?sheet.columnStyles?.[pos.col]:null;
 const style={...(sheet.defaultStyle||{}),...(column||{}),...(pos?sheet.rowStyles?.[pos.row]||{}:{})};
 if(pos)for(const layer of sheet.rectangleStyles||[]){
  const a=rectangle(layer.from,layer.to);
  if(pos.row>=a.r1&&pos.row<=a.r2&&pos.col>=a.c1&&pos.col<=a.c2)Object.assign(style,layer.style);
 }
 Object.assign(style,own);
 const align=Object.hasOwn(style,'align')?style.align:sheet.defaultAlign;
 if(align!==undefined&&align!==null)style.align=align;
 else delete style.align;
 for(const key of Object.keys(style))if(style[key]===null)delete style[key];
 return style;
}
export const FONT_FAMILIES=['Aptos','Calibri','Arial','Verdana','Tahoma','Georgia','Times New Roman','Consolas'];
const bulkStyleProps=new Set(['bg','color','bold','italic','wrap','format','align','fontSize','fontFamily']);
export const MAX_RECTANGLE_STYLES=256;
const intersects=(a,b)=>a.r1<=b.r2&&a.r2>=b.r1&&a.c1<=b.c2&&a.c2>=b.c1;
/** Pure subtraction, splits a rectangle into up to four untouched fragments. */
function subtractRectangleStyles(sheet,cut,property=null){
 const layers=[];let changed=0;
 const add=(a,style)=>{if(a.r1<=a.r2&&a.c1<=a.c2)layers.push({from:cellName(a.r1,a.c1),to:cellName(a.r2,a.c2),style:{...style}});};
 for(const layer of sheet.rectangleStyles||[]){
  const a=rectangle(layer.from,layer.to);
  if(!intersects(a,cut)||(property!==null&&!Object.hasOwn(layer.style,property))){layers.push(layer);continue;}
  changed++;
  const x={r1:Math.max(a.r1,cut.r1),r2:Math.min(a.r2,cut.r2),c1:Math.max(a.c1,cut.c1),c2:Math.min(a.c2,cut.c2)};
  if(a.r1<x.r1)add({...a,r2:x.r1-1},layer.style);
  if(x.r2<a.r2)add({...a,r1:x.r2+1},layer.style);
  if(a.c1<x.c1)add({r1:x.r1,r2:x.r2,c1:a.c1,c2:x.c1-1},layer.style);
  if(x.c2<a.c2)add({r1:x.r1,r2:x.r2,c1:x.c2+1,c2:a.c2},layer.style);
 }
 if(layers.length>MAX_RECTANGLE_STYLES)throw Error('Слишком много участков оформления');
 return {layers,changed};
}
export function setRectangleStyle(sheet,from,to,patch){
 const a=rectangle(from,to),pairs=Object.entries(patch||{});
 if(!a||!validRef(from)||!validRef(to)||pairs.length!==1||!bulkStyleProps.has(pairs[0][0]))throw Error('Недопустимое оформление диапазона');
 const [prop,raw]=pairs[0],value=raw===undefined?null:raw;
 if(value!==null&&((prop==='align'&&!['left','center','right'].includes(value))||
  (['bg','color'].includes(prop)&&!(typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value)))||
  (['bold','italic','wrap'].includes(prop)&&typeof value!=='boolean')||
  (prop==='format'&&!['general','currency','percent','integer','date','time','datetime','duration'].includes(value))))
  throw Error('Недопустимое оформление диапазона');
 if((sheet.rectangleStyles||[]).length>=MAX_RECTANGLE_STYLES)throw Error('Слишком много участков оформления');
 const next=[...(sheet.rectangleStyles||[]),{from:cellName(a.r1,a.c1),to:cellName(a.r2,a.c2),style:{[prop]:value}}];
 for(const [ref,item] of Object.entries(sheet.cells)){
  const p=parseCell(ref);if(!p||p.row<a.r1||p.row>a.r2||p.col<a.c1||p.col>a.c2||!Object.hasOwn(item.style||{},prop))continue;
  const style={...item.style};delete style[prop];
  if(!item.value&&!Object.keys(style).length)delete sheet.cells[ref];else sheet.cells[ref]={...item,style};
 }
 sheet.rectangleStyles=next;
}
/** Format full-height columns or entire sheet in O(saved cells + 100 columns).
 * Per-cell overrides for the changed property are cleared, other styles kept. */
export function setBulkColumnStyle(sheet,from,to,patch){
 const area=rectangle(from,to);
 if(!area||!validRef(from)||!validRef(to)||area.r1!==0||area.r2!==LIMITS.rows-1)throw Error('Выделите целые столбцы');
 const pairs=Object.entries(patch||{});
 if(pairs.length!==1||!bulkStyleProps.has(pairs[0][0]))throw Error('Недопустимое массовое оформление');
 const [prop,value]=pairs[0];
 if(prop==='align'&&value!==undefined&&!['left','center','right'].includes(value))throw Error('Недопустимое выравнивание');
 if(['bg','color'].includes(prop)&&value!==undefined&&!/^#[0-9a-fA-F]{6}$/.test(value))throw Error('Недопустимый цвет');
 if(['bold','italic','wrap'].includes(prop)&&value!==undefined&&typeof value!=='boolean')throw Error('Недопустимое оформление');
 if(prop==='format'&&value!==undefined&&!['general','currency','percent','integer','date','time','datetime','duration'].includes(value))throw Error('Недопустимый числовой формат');
 const full=area.c1===0&&area.c2===LIMITS.columns-1;
 const remainingRectangleStyles=subtractRectangleStyles(sheet,area,prop).layers;
 const next={...(sheet.defaultStyle||{})},columns={...(sheet.columnStyles||{})};
 if(full){
  if(prop==='align'){sheet.defaultAlign=value??null;delete next.align;}
  else if(value===undefined)delete next[prop];else next[prop]=value;
  for(const key of Object.keys(columns)){
   const style={...columns[key]};delete style[prop];
   if(Object.keys(style).length)columns[key]=style;else delete columns[key];
  }
 }else{
  for(let col=area.c1;col<=area.c2;col++){
   const key=String(col),style={...(columns[key]||{})};
   if(value===undefined){
    if(prop in (sheet.defaultStyle||{})||(prop==='align'&&sheet.defaultAlign!=null))style[prop]=null;
    else delete style[prop];
   }else style[prop]=value;
   if(Object.keys(style).length)columns[key]=style;else delete columns[key];
  }
 }
 for(const [ref,cell] of Object.entries(sheet.cells)){
  const pos=parseCell(ref);
  if(!pos||pos.col<area.c1||pos.col>area.c2||!(prop in (cell.style||{})))continue;
  const style={...cell.style};delete style[prop];
  if(!cell.value&&!Object.keys(style).length)delete sheet.cells[ref];
  else sheet.cells[ref]={...cell,style};
 }
 sheet.defaultStyle=next;sheet.columnStyles=columns;sheet.rectangleStyles=remainingRectangleStyles;
}

export function setCell(sheet,ref,value){if(!validRef(ref))throw Error('Адрес ячейки вне диапазона');checkValidatedInput(sheet,ref,String(value??'').slice(0,50000));const key=ref.toUpperCase();if(!sheet.cells[key])sheet.cells[key]={value:'',style:{}};sheet.cells[key].value=String(value??'').slice(0,50000);if(!sheet.cells[key].value&&!Object.keys(sheet.cells[key].style||{}).length)delete sheet.cells[key];if(sheet.autoFilter)invalidateGridGeometry(sheet);}
/** Convert explicit calendar/time input to serial values only for direct user entry.
 * All file import, clipboard and formula editing outside the UI preserve their raw values. */
export function setTypedCell(sheet,ref,input){
 const parsed=typeof input==='string'&&!input.startsWith('=')?parseTemporalInput(input):null;
 setCell(sheet,ref,parsed?parsed.value:input);
 if(parsed)setStyle(sheet,ref,{format:parsed.format});
 else if(typeof input==='string'&&/^=\s*(?:DATE|TODAY)\s*\(/i.test(input)&&(!getEffectiveStyle(sheet,ref).format||getEffectiveStyle(sheet,ref).format==='general'))setStyle(sheet,ref,{format:'date'});
 else if(typeof input==='string'&&/^=\s*TIME\s*\(/i.test(input)&&(!getEffectiveStyle(sheet,ref).format||getEffectiveStyle(sheet,ref).format==='general'))setStyle(sheet,ref,{format:'time'});
}
/** Full-sheet alignment is one property, not 200,000 styled cells.
 * Existing per-cell alignments are reset so this action truly affects all cells.
 * Empty style-only entries may be removed without losing any content. */
export function setWholeSheetAlignment(sheet,align){
 if(!['left','center','right'].includes(align))throw Error('Недопустимое выравнивание всего листа');
 sheet.rectangleStyles=subtractRectangleStyles(sheet,{r1:0,r2:LIMITS.rows-1,c1:0,c2:LIMITS.columns-1},'align').layers;
 sheet.defaultAlign=align;
 if(sheet.defaultStyle?.align!==undefined){const next={...sheet.defaultStyle};delete next.align;sheet.defaultStyle=next;}
 if(sheet.columnStyles)for(const col of Object.keys(sheet.columnStyles)){
  const style={...sheet.columnStyles[col]};delete style.align;
  if(Object.keys(style).length)sheet.columnStyles[col]=style;else delete sheet.columnStyles[col];
 }
 for(const [ref,item] of Object.entries(sheet.cells)){
  if(item.style?.align!==undefined){
   const style={...item.style};delete style.align;
   if(!item.value&&!Object.keys(style).length)delete sheet.cells[ref];
   else sheet.cells[ref]={...item,style};
  }
 }
}
export function setStyle(sheet,ref,patch){if(!validRef(ref))throw Error('Недопустимая ячейка');const key=ref.toUpperCase();const prev=getCell(sheet,key);const style={...prev.style,...patch};for(const [name,value] of Object.entries(patch))if(value===undefined)delete style[name];if(!prev.value&&!Object.keys(style).length)delete sheet.cells[key];else sheet.cells[key]={value:prev.value,style};}
/** Merge geometry is independent of styling. Covered cells never silently lose content. */
export function mergeAt(sheet,ref){const p=parseCell(ref);if(!p)return null;return (sheet.merges||[]).find(m=>{const v=rectangle(m.from,m.to);return p.row>=v.r1&&p.row<=v.r2&&p.col>=v.c1&&p.col<=v.c2;})||null;}
export function mergeCells(sheet,a,b){
 const r=rectangle(a,b);if(!r||r.r2>=LIMITS.rows||r.c2>=LIMITS.columns||!validRef(a)||!validRef(b))throw Error('Недопустимое объединение');
 if(r.r1===r.r2&&r.c1===r.c2)throw Error('Выделите минимум две ячейки');
 if((r.r2-r.r1+1)*(r.c2-r.c1+1)>2000)throw Error('Объединение ограничено 2000 ячеек');
 if(sheet.autoFilter)throw Error('Выключите автофильтр перед объединением');
 const frozen=sheet.freeze||{rows:0,cols:0};
 if(r.r1<frozen.rows&&r.r2>=frozen.rows||r.c1<frozen.cols&&r.c2>=frozen.cols)throw Error('Объединение пересекает закреплённую область');
 for(let row=r.r1;row<=r.r2;row++)for(let col=r.c1;col<=r.c2;col++){
  if(!rowVisible(sheet,row)||!columnVisible(sheet,col))throw Error('Нельзя объединять скрытые строки и столбцы');
  const ref=cellName(row,col);
  if(mergeAt(sheet,ref))throw Error('Диапазон пересекается с другим объединением');
  if((row!==r.r1||col!==r.c1)&&getCell(sheet,ref).value!=='')throw Error('Сначала освободите другие ячейки: их данные нельзя удалять при объединении');
 }
 sheet.merges??=[];const m={from:cellName(r.r1,r.c1),to:cellName(r.r2,r.c2)};sheet.merges.push(m);return m;
}
export function unmergeCells(sheet,ref){const item=mergeAt(sheet,ref);if(!item)return false;sheet.merges=sheet.merges.filter(m=>m!==item);return true;}
/** Iterate only stored cell entries inside a selection. A 10-million-cell
 * selected sheet still has at most 50,000 materialized entries per workbook.
 * Geometry, data outside the rectangle and merges are never expanded. */
function sparseSelection(sheet,from,to){
 const area=rectangle(from,to);
 if(!area||!validRef(from)||!validRef(to))throw Error('Недопустимый диапазон');
 return {area,entries:Object.entries(sheet.cells).filter(([ref])=>{
  const p=parseCell(ref);
  return p&&p.row>=area.r1&&p.row<=area.r2&&p.col>=area.c1&&p.col<=area.c2;
 })};
}
/** Clear values/formulas in a huge sparse selection, preserving every existing style.
 * inspectOnly counts without mutation so a no-op will not create an Undo entry. */
export function clearCellValues(sheet,from,to,inspectOnly=false){
 const {entries}=sparseSelection(sheet,from,to);
 let count=0;
 for(const [ref,entry] of entries){
  if(!entry.value)continue;
  count++;
  if(!inspectOnly){
   if(Object.keys(entry.style||{}).length)sheet.cells[ref]={...entry,value:''};
   else delete sheet.cells[ref];
  }
 }
 if(count&&!inspectOnly&&sheet.autoFilter)invalidateGridGeometry(sheet);
 return count;
}
/** Border presets apply to the selected *rectangle*, not every cell separately. */
export function applyBorderPreset(sheet,a,b,preset){
 if(!['outline','all','none','bottom','top','left','right'].includes(preset))throw Error('Неизвестный вариант границ');
 const r=rectangle(a,b);if(!r||!validRef(a)||!validRef(b))throw Error('Недопустимый диапазон');
 const count=(r.r2-r.r1+1)*(r.c2-r.c1+1);
 // Outside / one-sided borders only touch perimeter cells, even on an entire
 // sheet selection. No merge is required and existing interior borders survive.
 if(preset==='none'){
  // Removing borders from a selected full column/sheet never creates cells.
  const {entries}=sparseSelection(sheet,a,b);let removed=0;
  for(const [ref,item] of entries){
   const style=item.style||{};
   if(!style.border&&!style.borders)continue;
   removed++;
   const next={...style};delete next.border;delete next.borders;delete next.borderEdges;delete next.borderColor;
   if(!item.value&&!Object.keys(next).length)delete sheet.cells[ref];
   else sheet.cells[ref]={...item,style:next};
  }
  return removed;
 }
 if(preset==='all'&&count>10000)throw Error('Все границы ограничены 10 000 ячеек; используйте внешнюю рамку или очистку границ для больших диапазонов');
 const targets=new Map();
 const include=(row,col,sides)=>{
  const ref=cellName(row,col);
  const prev=targets.get(ref)||new Set();
  for(const side of sides)prev.add(side);
  targets.set(ref,prev);
 };
 if(preset==='all'||preset==='none'){
  for(let row=r.r1;row<=r.r2;row++)for(let col=r.c1;col<=r.c2;col++)include(row,col,['top','bottom','left','right']);
 }else{
  if(preset==='outline'||preset==='top'||preset==='bottom'){
   if(preset!=='bottom')for(let col=r.c1;col<=r.c2;col++)include(r.r1,col,['top']);
   if(preset!=='top')for(let col=r.c1;col<=r.c2;col++)include(r.r2,col,['bottom']);
  }
  if(preset==='outline'||preset==='left'||preset==='right'){
   if(preset!=='right')for(let row=r.r1;row<=r.r2;row++)include(row,r.c1,['left']);
   if(preset!=='left')for(let row=r.r1;row<=r.r2;row++)include(row,r.c2,['right']);
  }
 }
 // Avoid producing a book above the global cell limit; fail before mutation.
 const additions=[...targets.keys()].filter(ref=>!sheet.cells[ref]).length;
 if(Object.keys(sheet.cells).length+additions>LIMITS.cells)throw Error('Превышен лимит оформленных ячеек (50 000)');
 for(const [ref,sides] of targets){
  const previous=getCell(sheet,ref).style||{};
  const border={...(previous.borders||(previous.border==='thin'?{top:true,bottom:true,left:true,right:true}:{}))};
  if(preset==='none')for(const side of sides)delete border[side];
  else for(const side of sides)border[side]=true;
  setStyle(sheet,ref,{border:undefined,borders:Object.keys(border).length?border:undefined,borderEdges:undefined,borderColor:undefined});
 }
}
export function validRef(ref){const p=parseCell(String(ref));return !!p&&p.row<LIMITS.rows&&p.col<LIMITS.columns;}
export function refsBetween(a,b){const p=parseCell(a),q=parseCell(b);if(!p||!q)return [];const refs=[];for(let r=Math.min(p.row,q.row);r<=Math.max(p.row,q.row);r++)for(let c=Math.min(p.col,q.col);c<=Math.max(p.col,q.col);c++)if(r<LIMITS.rows&&c<LIMITS.columns)refs.push(cellName(r,c));return refs;}
export function rectangle(a,b){const p=parseCell(a),q=parseCell(b);return p&&q?{r1:Math.min(p.row,q.row),r2:Math.max(p.row,q.row),c1:Math.min(p.col,q.col),c2:Math.max(p.col,q.col)}:null;}
/** Translate A1 references on fill; $ locks a row/column. No eval or external libraries. */
export function translateFormula(source, rowDelta, colDelta){
 if(typeof source!=='string'||!source.startsWith('='))return source;
 if(!Number.isInteger(rowDelta)||!Number.isInteger(colDelta))throw Error('Некорректный сдвиг');
 return '='+source.slice(1).replace(/(?<![A-Z0-9_.$])(\$?)([A-Z]+)(\$?)([1-9]\d*)(?![A-Z0-9_.])/gi,(full,lockCol,letters,lockRow,digits)=>{
   const p=parseCell(letters+digits);
   if(!p||p.row>=LIMITS.rows||p.col>=LIMITS.columns)throw Error('Формула ссылается на ячейку вне таблицы');
   const row=p.row+(lockRow?0:rowDelta),col=p.col+(lockCol?0:colDelta);
   if(row<0||col<0||row>=LIMITS.rows||col>=LIMITS.columns)throw Error('Ссылка формулы выходит за пределы таблицы');
   return `${lockCol}${colLabel(col)}${lockRow}${row+1}`;
 });
}
/** Atomic fill plan: snapshot source values/styles first, validate, then mutate. */
/** Excel Ctrl+Enter: one typed value or a relative formula across a selection.
 * Validate every destination and stage changes before touching the source.
 * Existing destination styles are preserved unless typed date/time formatting
 * intentionally changes their number format. */
export function fillTypedSelection(sheet,from,to,input,origin=from){
 const area=rectangle(from,to),start=parseCell(origin);
 if(!area||!validRef(from)||!validRef(to)||!validRef(origin)||
    start.row<area.r1||start.row>area.r2||start.col<area.c1||start.col>area.c2)
  throw Error('Недопустимый диапазон заполнения');
 if(typeof input!=='string'||input.length>50000)throw Error('Недопустимое содержимое ячейки');
 const total=(area.r2-area.r1+1)*(area.c2-area.c1+1);
 if(total>10000)throw Error('Массовый ввод ограничен 10 000 ячеек');
 if((sheet.merges||[]).some(m=>{const r=rectangle(m.from,m.to);return r.r1<=area.r2&&r.r2>=area.r1&&r.c1<=area.c2&&r.c2>=area.c1;}))
  throw Error('Массовый ввод в объединённые ячейки не поддерживается');
 const staged=structuredClone(sheet);
 for(let row=area.r1;row<=area.r2;row++)for(let col=area.c1;col<=area.c2;col++){
  const ref=cellName(row,col);
  const typed=input.startsWith('=')?translateFormula(input,row-start.row,col-start.col):input;
  setTypedCell(staged,ref,typed);
 }
 if(Object.keys(staged.cells).length>LIMITS.cells)throw Error('Превышен лимит заполненных ячеек (50 000)');
 sheet.cells=staged.cells;
 return total;
}
/** Disjoint Ctrl selections: stage all destinations, then commit a single atomic mutation.
 * Each relative formula is translated from the active edit cell across all areas.
 * Repeated/overlapping areas are deduplicated so no target is written twice. */
export function fillTypedAreas(sheet,areas,input,origin){
 if(!Array.isArray(areas)||areas.length<1||areas.length>25||
    typeof input!=='string'||input.length>50000||!validRef(origin))
  throw Error('Недопустимое множественное выделение');
 const start=parseCell(origin),refs=new Set();
 for(const item of areas){
  const from=item.from,to=item.to,area=rectangle(from,to);
  if(!validRef(from)||!validRef(to)||!area)throw Error('Недопустимый диапазон');
  const total=(area.r2-area.r1+1)*(area.c2-area.c1+1);
  if(total>10000||refs.size+total>10000)throw Error('Массовый ввод ограничен 10 000 ячеек');
  if((sheet.merges||[]).some(m=>{
   const r=rectangle(m.from,m.to);
   return r.r1<=area.r2&&r.r2>=area.r1&&r.c1<=area.c2&&r.c2>=area.c1;
  }))throw Error('Массовый ввод в объединённые ячейки не поддерживается');
  for(let row=area.r1;row<=area.r2;row++)for(let col=area.c1;col<=area.c2;col++)
   refs.add(cellName(row,col));
 }
 const staged=structuredClone(sheet);
 for(const ref of refs){
  const at=parseCell(ref),typed=input.startsWith('=')?
    translateFormula(input,at.row-start.row,at.col-start.col):input;
  setTypedCell(staged,ref,typed);
 }
 if(Object.keys(staged.cells).length>LIMITS.cells)throw Error('Превышен лимит заполненных ячеек (50 000)');
 sheet.cells=staged.cells;
 if(sheet.autoFilter)invalidateGridGeometry(sheet);
 return refs.size;
}

/** Ctrl+D / Ctrl+R across disjoint rectangles, preserving source styles and formulas.
 * Reject overlaps: otherwise the fill source could be modified by another selected area. */
export function fillAreasDirection(sheet,areas,direction){
 if(!Array.isArray(areas)||areas.length<1||areas.length>25||
    !['down','right'].includes(direction))throw Error('Недопустимые параметры заполнения');
 const rects=areas.map(a=>{
  if(!validRef(a.from)||!validRef(a.to))throw Error('Недопустимый диапазон');
  return rectangle(a.from,a.to);
 });
 let total=0;
 for(let i=0;i<rects.length;i++){
  const a=rects[i];
  total+=(a.r2-a.r1+1)*(a.c2-a.c1+1);
  if(total>10000)throw Error('Заполнение ограничено 10 000 ячеек');
  for(let j=0;j<i;j++){
   const b=rects[j];
   if(a.r1<=b.r2&&a.r2>=b.r1&&a.c1<=b.c2&&a.c2>=b.c1)
    throw Error('Пересекающиеся области нельзя заполнить одновременно');
  }
 }
 const staged=structuredClone(sheet);
 let filled=0;
 for(const a of rects)
  filled+=fillSelection(staged,cellName(a.r1,a.c1),cellName(a.r2,a.c2),direction);
 if(Object.keys(staged.cells).length>LIMITS.cells)throw Error('Превышен лимит заполненных ячеек (50 000)');
 sheet.cells=staged.cells;
 if(sheet.autoFilter)invalidateGridGeometry(sheet);
 return filled;
}

/** TASK070: extend one rectangle through its Excel-like drag fill handle.
 * Numeric sequences (2+ evenly spaced entries) continue; formulas translate;
 * all other entries cycle, preserving cell styles. One atomic staged write. */
export function extendFillHandle(sheet,from,to,direction,targetIndex){
 if(!['up','down','left','right'].includes(direction))throw Error('Недопустимое направление автозаполнения');
 if(!validRef(from)||!validRef(to))throw Error('Неверный диапазон для автозаполнения');
 const a=rectangle(from,to),vertical=direction==='up'||direction==='down',
  reverse=direction==='up'||direction==='left',
  first=vertical?a.r1:a.c1,last=vertical?a.r2:a.c2,
  edge=reverse?first:last,bound=vertical?LIMITS.rows:LIMITS.columns;
 if(!Number.isInteger(targetIndex)||targetIndex<0||targetIndex>=bound||
    (reverse?targetIndex>=edge:targetIndex<=edge))
  throw Error(reverse?'Перетащите маркер выше или левее выделения':'Перетащите маркер ниже или правее выделения');
 const length=last-first+1,
  width=vertical?a.c2-a.c1+1:a.r2-a.r1+1,
  steps=Math.abs(targetIndex-edge);
 if((a.r2-a.r1+1)*(a.c2-a.c1+1)>10000||steps*width>10000)
  throw Error('Автозаполнение ограничено 10 000 ячеек');
 const affected={r1:direction==='up'?targetIndex:a.r1,c1:direction==='left'?targetIndex:a.c1,
  r2:direction==='down'?targetIndex:a.r2,c2:direction==='right'?targetIndex:a.c2};
 if((sheet.merges||[]).some(m=>{
  const b=rectangle(m.from,m.to);
  return b.r1<=affected.r2&&b.r2>=affected.r1&&b.c1<=affected.c2&&b.c2>=affected.c1;
 }))throw Error('Автозаполнение через объединённые ячейки не поддерживается');
 for(let row=affected.r1;row<=affected.r2;row++)if(!rowVisible(sheet,row))
  throw Error('Автозаполнение через скрытые или отфильтрованные строки запрещено');
 for(let col=affected.c1;col<=affected.c2;col++)if(!columnVisible(sheet,col))
  throw Error('Автозаполнение через скрытые столбцы запрещено');
 const prepared=[];
 const numeric=v=>typeof v==='string'&&v.trim()!==''&&
  /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(v.trim())&&Number.isFinite(Number(v));
 let hasDateSeries=false;
 for(let cross=0;cross<width;cross++){
  const source=Array.from({length},(_,i)=>{
   const row=vertical?a.r1+i:a.r1+cross,col=vertical?a.c1+cross:a.c1+i;
   const ref=cellName(row,col);
   return {row,col,cell:structuredClone(getCell(sheet,ref)),format:getEffectiveStyle(sheet,ref).format};
  });
  const nums=source.map(e=>numeric(e.cell.value)?Number(e.cell.value):null),
   allNumbers=nums.every(v=>v!==null),
   dateFormat=source[0].format,
   dateSeries=allNumbers&&['date','datetime'].includes(dateFormat)&&
    source.every((e,i)=>e.format===dateFormat&&nums[i]>=1&&nums[i]<=2958465),
   numericSeries=length>=2&&allNumbers,
   step=numericSeries?nums[1]-nums[0]:dateSeries?1:null,
   arithmetic=(numericSeries&&nums.every((v,i)=>Math.abs(v-(nums[0]+step*i))<=
    1e-9*Math.max(1,Math.abs(v))))||(dateSeries&&length===1);
  if(dateSeries&&arithmetic)hasDateSeries=true;
  for(let i=0;i<steps;i++){
   const sequenceIndex=reverse?-1-i:length+i,
    sourceIndex=((sequenceIndex%length)+length)%length,origin=source[sourceIndex],
    row=vertical?(reverse?a.r1-1-i:a.r2+1+i):a.r1+cross,
    col=vertical?a.c1+cross:(reverse?a.c1-1-i:a.c2+1+i);
   let value=origin.cell.value;
   if(arithmetic){
    const result=nums[0]+step*sequenceIndex;
    if(!Number.isFinite(result)||Math.abs(result)>1e15)
     throw Error('Числовая последовательность выходит за пределы допустимых значений');
    if(dateSeries&&(result<1||result>2958465))
     throw Error('Дата выходит за допустимые пределы календаря');
    value=String(Number(result.toPrecision(14)));
   }else if(value.startsWith('='))
    value=translateFormula(value,row-origin.row,col-origin.col);
   prepared.push({ref:cellName(row,col),value,style:structuredClone(origin.cell.style||{})});
  }
 }
 // Validate the full result on an isolated copy before changing the original sheet.
 const staged=structuredClone(sheet);
 for(const item of prepared){
  checkValidatedInput(staged,item.ref,item.value);
  if(item.value||Object.keys(item.style).length)staged.cells[item.ref]={value:item.value,style:item.style};
  else delete staged.cells[item.ref];
 }
 if(Object.keys(staged.cells).length>LIMITS.cells)throw Error('Превышен лимит заполненных ячеек (50 000)');
 sheet.cells=staged.cells;
 if(sheet.autoFilter)invalidateGridGeometry(sheet);
 return {count:prepared.length,from:cellName(affected.r1,affected.c1),
  to:cellName(affected.r2,affected.c2),
  mode:prepared.some(x=>x.value.startsWith('='))?'formula':hasDateSeries?'date':'values'};
}
export function fillSelection(sheet, from, to, direction){
 if(!['down','right'].includes(direction))throw Error('Неподдерживаемое направление');
 const rect=rectangle(from,to);if(!rect)throw Error('Неверный диапазон');
 if(direction==='down'&&rect.r1===rect.r2)throw Error('Выделите хотя бы две строки');
 if(direction==='right'&&rect.c1===rect.c2)throw Error('Выделите хотя бы два столбца');
 const total=(rect.r2-rect.r1+1)*(rect.c2-rect.c1+1);
 if(total>10000)throw Error('Выделено больше 10 000 ячеек');
 if((sheet.merges||[]).some(m=>{const x=rectangle(m.from,m.to);return x.r1<=rect.r2&&x.r2>=rect.r1&&x.c1<=rect.c2&&x.c2>=rect.c1;}))throw Error('Заполнение объединённых ячеек пока не поддерживается');
 const changes=[];
 for(let r=rect.r1;r<=rect.r2;r++)for(let c=rect.c1;c<=rect.c2;c++){
   if(direction==='down'&&r===rect.r1||direction==='right'&&c===rect.c1)continue;
   const originR=direction==='down'?rect.r1:r,originC=direction==='right'?rect.c1:c;
   const original=getCell(sheet,cellName(originR,originC));
   changes.push([cellName(r,c),translateFormula(original.value,r-originR,c-originC),structuredClone(original.style||{})]);
 }
 // Precheck validation for the entire fill to preserve atomicity.
 for(const [ref,value] of changes)checkValidatedInput(sheet,ref,value);
 // Do not corrupt existing data if even one translated reference is out of bounds.
 for(const [ref,value,style] of changes){
   if(value||Object.keys(style).length)sheet.cells[ref]={value,style};
   else delete sheet.cells[ref];
 }
 return changes.length;
}

export function rawMap(sheet){return Object.fromEntries(Object.entries(sheet.cells).map(([k,v])=>[k,v.value]));}
/** Prepare a bounded workbook snapshot for cross-sheet references. The current sheet map may be reused. */
export function referencedFromOtherSheet(book,target){
  const needle=target.name.toLocaleUpperCase('ru-RU');
  for(const other of book.sheets){if(other.id===target.id)continue;
    for(const cell of Object.values(other.cells)){
      if(!cell.value.startsWith('='))continue;
      // Quoted sheet names may contain doubled apostrophes. Conservative guard: reject
      // on a matching prefix even in unusual formulas rather than silently break links.
      const prefixes=cell.value.match(/'(?:[^']|'')*'!|[A-Z_А-ЯЁ][A-Z0-9_.А-ЯЁ]*!/gi)||[];
      if(prefixes.some(x=>{
        const name=x[0]==="'"?x.slice(1,-2).replaceAll("''", "'"):x.slice(0,-1);
        return name.toLocaleUpperCase('ru-RU')===needle;
      }))return true;
    }
  }
  return false;
}
export function formulaContext(book,sheet,map=rawMap(sheet)){
 if(!book)return null;
 const sheets=new Map();
 for(const part of book.sheets){const name=part.name.toLocaleUpperCase('ru-RU');
   if(sheets.has(name))throw Error('Неоднозначное название листа');
   sheets.set(name,{name:part.name,cells:part.id===sheet.id?map:rawMap(part)});
 }
 return {sheetName:sheet.name,sheets,calculation:createCalculationSession()};
}
export function resultOf(sheet,ref,map=rawMap(sheet),context=null){return evaluateCell(ref,map,new Set(),context);}
export function displayedValue(sheet,ref,map=rawMap(sheet),context=null){
  const cell=getCell(sheet,ref),result=resultOf(sheet,ref,map,context),fmt=getEffectiveStyle(sheet,ref).format;if(result===''||result==null)return '';
  if(['date','time','datetime','duration'].includes(fmt)&& (typeof result==='number'||typeof result==='string'&&/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(result)))return formatTemporal(Number(result),fmt);
  // Directly entered numeric cells are stored as strings. Number formatting must
  // still apply without changing their raw values, clipboard or formula semantics.
  const typedNumeric=['currency','percent','integer'].includes(fmt)&&typeof result==='string'&&/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(result);
  if(typeof result!=='number'&&!typedNumeric)return String(result);
  const n=Number.isFinite(Number(result))?Number(result):0;
  if(['date','time','datetime','duration'].includes(fmt))return formatTemporal(n,fmt);
  if(fmt==='currency')return new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(n);
  if(fmt==='percent')return new Intl.NumberFormat('ru-RU',{style:'percent',maximumFractionDigits:2}).format(n);
  if(fmt==='integer')return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n);
  return String(n);
}
export function valuesTSV(sheet,a,b,book=null){const rect=rectangle(a,b);if(!rect)return '';
 if((rect.r2-rect.r1+1)*(rect.c2-rect.c1+1)>20000)throw Error('Копирование ограничено 20 000 ячеек');
 const map=rawMap(sheet),ctx=formulaContext(book,sheet,map),rows=[];for(let r=rect.r1;r<=rect.r2;r++){const row=[];for(let c=rect.c1;c<=rect.c2;c++)row.push(String(resultOf(sheet,cellName(r,c),map,ctx)));rows.push(row.join('\t'));}return rows.join('\n');}
export function pasteTSV(sheet,start,text){const at=parseCell(start);if(!at||!validRef(start))throw Error('Недопустимая ячейка');
 const rows=String(text).replace(/\r\n?/g,'\n').replace(/\n$/,'').split('\n').map(line=>line.split('\t'));
 const maxR=Math.min(LIMITS.rows-at.row,rows.length),maxC=Math.min(LIMITS.columns-at.col,Math.max(...rows.map(r=>r.length)));
 if(maxR*maxC>20000)throw Error('Вставка ограничена 20 000 ячеек');
 for(let r=0;r<maxR;r++)for(let c=0;c<Math.min(maxC,rows[r].length);c++)if(mergeAt(sheet,cellName(at.row+r,at.col+c)))throw Error('Вставка в объединённый диапазон пока не поддерживается');
 for(let r=0;r<maxR;r++)for(let c=0;c<Math.min(maxC,rows[r].length);c++)checkValidatedInput(sheet,cellName(at.row+r,at.col+c),rows[r][c]);
 for(let r=0;r<maxR;r++)for(let c=0;c<Math.min(maxC,rows[r].length);c++)setCell(sheet,cellName(at.row+r,at.col+c),rows[r][c]);
 return {rows:maxR,cols:maxC,end:cellName(at.row+maxR-1,at.col+maxC-1)};
}
/** Sorts whole selected rows, keeping each cell style with its value. Formula cells are
 * rejected until reference-rewriting semantics for row moves are implemented. */
export function sortSelectedRows(sheet,start,end,direction='asc'){
 const rect=rectangle(start,end);
 if(!rect||rect.r1===rect.r2)throw Error('Выделите минимум две строки');
 const size=(rect.r2-rect.r1+1)*(rect.c2-rect.c1+1);
 if(size>10000)throw Error('Сортировка ограничена 10 000 ячеек');
 if(!['asc','desc'].includes(direction))throw Error('Неверное направление сортировки');
 if((sheet.rectangleStyles||[]).length)throw Error('Сортировка с крупными диапазонами оформления пока недоступна');
 if((sheet.merges||[]).some(m=>{const x=rectangle(m.from,m.to);return x.r1<=rect.r2&&x.r2>=rect.r1&&x.c1<=rect.c2&&x.c2>=rect.c1;}))throw Error('Сортировка диапазона с объединёнными ячейками пока не поддерживается');
 const rows=[];
 for(let r=rect.r1;r<=rect.r2;r++){
  const cells=[];
  for(let c=rect.c1;c<=rect.c2;c++){
   const cell=getCell(sheet,cellName(r,c));
   if(cell.value.startsWith('='))throw Error('Сортировка диапазона с формулами пока не поддерживается');
   cells.push(structuredClone(cell));
  }
  rows.push(cells);
 }
 const collator=new Intl.Collator('ru-RU',{numeric:true,sensitivity:'base'});
 const sorted=rows.map((row,index)=>({row,index})).sort((a,b)=>{
  const av=a.row[0].value.trim(),bv=b.row[0].value.trim();
  if(!av||!bv)return av? -1:bv? 1:a.index-b.index;
  const an=Number(av.replace(',','.')),bn=Number(bv.replace(',','.'));
  const result=Number.isFinite(an)&&Number.isFinite(bn)?Math.sign(an-bn):collator.compare(av,bv);
  return (direction==='desc'?-result:result)||a.index-b.index;
 });
 for(let i=0;i<sorted.length;i++)for(let j=0;j<sorted[i].row.length;j++){
  const ref=cellName(rect.r1+i,rect.c1+j),cell=sorted[i].row[j];
  if(cell.value||Object.keys(cell.style).length)sheet.cells[ref]=cell;
  else delete sheet.cells[ref];
 }
 return sorted.length;
}

/** Finds text in input values and formulas. Returns addresses in row-major order. */
export function findCells(sheet,query){
 const text=String(query??'').trim();if(!text)return [];
 const needle=text.toLocaleLowerCase('ru-RU');
 return Object.keys(sheet.cells).filter(ref=>validRef(ref)&&
   getCell(sheet,ref).value.toLocaleLowerCase('ru-RU').includes(needle))
  .sort((a,b)=>{const x=parseCell(a),y=parseCell(b);return x.row-y.row||x.col-y.col;});
}

/** Replaces literal text without executing input as a regular expression.
 * Formulas are left unchanged; model mutations are bounded and all-or-nothing. */
export function replaceAllText(sheet,search,replacement){
 const needle=String(search??'');const value=String(replacement??'');
 if(!needle)throw Error('Введите текст для поиска');
 if(needle.length>1000||value.length>10000)throw Error('Слишком длинный текст');
 const matches=[];const escaped=needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const re=new RegExp(escaped,'giu');
 for(const [ref,cell] of Object.entries(sheet.cells)){
  if(!validRef(ref)||cell.value.startsWith('='))continue;
  const next=cell.value.replace(re,()=>value);
  if(next!==cell.value){if(next.length>50000)throw Error('Результат превышает лимит ячейки');matches.push([ref,next]);}
 }
 if(matches.length>10000)throw Error('Слишком много совпадений');
 for(const [ref,next] of matches)setCell(sheet,ref,next);
 return matches.length;
}

export function importCSV(text,name='Импорт CSV'){
 const grid=csvDecode(String(text).replace(/^\uFEFF/,''));const book=newWorkbook(name);const sheet=currentSheet(book);if(grid.length>LIMITS.rows)throw Error('Слишком много строк');
 for(let r=0;r<grid.length;r++){if(grid[r].length>LIMITS.columns)throw Error('Слишком много столбцов');for(let c=0;c<grid[r].length;c++){if(grid[r][c])setCell(sheet,cellName(r,c),grid[r][c]);}}
 return book;
}
export function exportCSV(sheet,book=null){let maxR=0,maxC=0;for(const key of Object.keys(sheet.cells)){const p=parseCell(key);if(p){maxR=Math.max(maxR,p.row);maxC=Math.max(maxC,p.col);}}
 if((maxR+1)*(maxC+1)>250000)throw Error('CSV превышает 250 000 ячеек. Используйте .qbook или XLSX для разреженной таблицы');
 const raw=rawMap(sheet),ctx=formulaContext(book,sheet,raw);return csvEncode(Array.from({length:maxR+1},(_,r)=>Array.from({length:maxC+1},(_,c)=>String(resultOf(sheet,cellName(r,c),raw,ctx)))));
}
export function validateWorkbook(book){
 if(!book||book.type!=='sheet'||typeof book.id!=='string'||typeof book.name!=='string'||book.name.length>200||!Array.isArray(book.sheets)||!book.sheets.length||book.sheets.length>LIMITS.sheets)throw Error('Неверный формат книги');
 let total=0;const ids=new Set(),names=new Set();for(const sheet of book.sheets){
  validateCharts(sheet);
  validateConditionalRules(sheet);
  validateDataRules(sheet);
  validatePrintSettings(sheet);
  if(typeof sheet?.name!=='string'||!sheet.name.trim()||names.has(sheet.name.toLocaleUpperCase('ru-RU')))throw Error('Повторяющееся или пустое название листа');
  names.add(sheet.name.toLocaleUpperCase('ru-RU'));
  if(sheet.defaultAlign!=null&&!['left','center','right'].includes(sheet.defaultAlign))throw Error('Недопустимый формат выравнивания листа');
  const validSparseStyle=(style,allowNull=false)=>style&&typeof style==='object'&&!Array.isArray(style)&&
   Object.keys(style).every(k=>bulkStyleProps.has(k))&&Object.entries(style).every(([k,v])=>{
    if(v===null)return allowNull;
    if(k==='align')return ['left','center','right'].includes(v);
    if(k==='format')return ['general','currency','percent','integer','date','time','datetime','duration'].includes(v);
     if(k==='fontSize')return typeof v==='number'&&Number.isFinite(v)&&v>=6&&v<=72;
    if(k==='fontFamily')return typeof v==='string'&&FONT_FAMILIES.includes(v);
    if(k==='bg'||k==='color')return typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v);
    return typeof v==='boolean';
   });
  if(sheet.defaultStyle!==undefined&&!validSparseStyle(sheet.defaultStyle))throw Error('Повреждено оформление листа');
  if(sheet.rectangleStyles!==undefined){
   if(!Array.isArray(sheet.rectangleStyles)||sheet.rectangleStyles.length>MAX_RECTANGLE_STYLES)throw Error('Повреждены стили диапазонов');
   for(const layer of sheet.rectangleStyles){
    const r=layer&&typeof layer.from==='string'&&typeof layer.to==='string'?rectangle(layer.from,layer.to):null;
    if(!r||!validRef(layer.from)||!validRef(layer.to)||
     layer.from!==cellName(r.r1,r.c1)||layer.to!==cellName(r.r2,r.c2)||
     !validSparseStyle(layer.style,true)||Object.keys(layer.style).length!==1)
     throw Error('Повреждено оформление диапазона');
   }
  }
  // Row and column OOXML styles include border sides; validate without
  // allocating individual cells for the full span.
  const validAxisStyle=style=>style&&typeof style==='object'&&!Array.isArray(style)&&
   Object.entries(style).every(([key,value])=>{
    if(key==='borderColor')return typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value);
    if(key==='borderEdges')return validBorderEdges(value);
     if(key==='borders')return value&&typeof value==='object'&&!Array.isArray(value)&&
      Object.entries(value).every(([edge,on])=>['left','right','top','bottom'].includes(edge)&&on===true);
    return validSparseStyle({[key]:value},true);
   });
  for(const [name,max] of [['columnStyles',LIMITS.columns],['rowStyles',LIMITS.rows]]){
   const styles=sheet[name]||{};
   if(!styles||typeof styles!=='object'||Array.isArray(styles)||Object.keys(styles).length>max||
      Object.entries(styles).some(([key,style])=>!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=max||!validAxisStyle(style)))
    throw Error(name==='columnStyles'?'Повреждено оформление столбцов':'Повреждено оформление строк');
  }
  for(const [name,min,max] of [['defaultColumnWidth',12,DIMENSIONS.maxColumn],['defaultRowHeight',12,DIMENSIONS.maxRow]])if(sheet[name]!==undefined&&(!Number.isInteger(sheet[name])||sheet[name]<min||sheet[name]>max))throw Error('Некорректный размер листа XLSX');
   for(const [key,max,sizeMin,sizeMax] of [['columnWidths',LIMITS.columns,12,DIMENSIONS.maxColumn],['rowHeights',LIMITS.rows,12,DIMENSIONS.maxRow]]){
   const map=sheet?.[key];if(map===undefined)continue;
   if(!map||typeof map!=='object'||Array.isArray(map)||Object.keys(map).length>max)throw Error('Повреждённые размеры листа');
   for(const [index,value] of Object.entries(map))if(!/^(0|[1-9]\d*)$/.test(index)||Number(index)>=max||!Number.isInteger(value)||value<sizeMin||value>sizeMax)throw Error('Некорректный размер строки или столбца');
  }
for(const [key,max] of [['hiddenRows',LIMITS.rows],['hiddenColumns',LIMITS.columns]]){
    const map=sheet?.[key];if(map===undefined)continue;
    if(!map||typeof map!=='object'||Array.isArray(map)||Object.keys(map).length>=max)throw Error('Повреждена видимость строк или столбцов');
    for(const [index,value] of Object.entries(map))if(!/^(0|[1-9]\d*)$/.test(index)||Number(index)>=max||value!==true)throw Error('Повреждён скрытый индекс');
   }
   if(sheet.freeze!==undefined){
    const f=sheet.freeze;if(!f||!Number.isInteger(f.rows)||!Number.isInteger(f.cols)||f.rows<0||f.cols<0||f.rows>10||f.cols>10)throw Error('Повреждено закрепление областей');
   }
   if(sheet.autoFilter!==undefined&&sheet.autoFilter!==null){
    const f=sheet.autoFilter,rect=rectangle(f?.from,f?.to);
    if(!f||!rect||!validRef(f.from)||!validRef(f.to)||rect.r2<=rect.r1||!f.rules||typeof f.rules!=='object'||Array.isArray(f.rules))throw Error('Повреждён автофильтр');
    if(Object.entries(f.rules).some(([col,val])=>!(/^(0|[1-9]\d*)$/.test(col))||Number(col)<rect.c1||Number(col)>rect.c2||!(typeof val==='string'&&val.length<=50000||Array.isArray(val)&&val.length>0&&val.length<=200&&val.every(v=>typeof v==='string'&&v.length<=50000)&&new Set(val).size===val.length)))throw Error('Некорректные условия фильтра');
   }
 if(sheet.merges!==undefined){
   if(!Array.isArray(sheet.merges)||sheet.merges.length>500)throw Error('Некорректные объединения');
   const occupancy=new Set();for(const m of sheet.merges){
    if(!m||typeof m.from!=='string'||typeof m.to!=='string'||!validRef(m.from)||!validRef(m.to))throw Error('Недопустимое объединение');
    const r=rectangle(m.from,m.to),canonical=cellName(r.r1,r.c1)===m.from&&cellName(r.r2,r.c2)===m.to;
    if(!canonical||r.r1===r.r2&&r.c1===r.c2||(r.r2-r.r1+1)*(r.c2-r.c1+1)>2000)throw Error('Повреждённое объединение');
    for(let row=r.r1;row<=r.r2;row++)for(let col=r.c1;col<=r.c2;col++){
      const ref=cellName(row,col);if(occupancy.has(ref))throw Error('Пересекающиеся объединения');occupancy.add(ref);
      if((row!==r.r1||col!==r.c1)&&sheet.cells?.[ref]?.value)throw Error('Данные внутри объединения без верхней левой ячейки');
    }
   }
  }
 if(!sheet||typeof sheet.id!=='string'||ids.has(sheet.id)||typeof sheet.name!=='string'||sheet.name.length>100||!sheet.cells||typeof sheet.cells!=='object'||Array.isArray(sheet.cells))throw Error('Повреждённый лист');ids.add(sheet.id);const keys=Object.keys(sheet.cells);total+=keys.length;for(const ref of keys){const cell=sheet.cells[ref];if(!validRef(ref)||!cell||typeof cell.value!=='string'||cell.value.length>50000||!cell.style||typeof cell.style!=='object'||Array.isArray(cell.style))throw Error('Повреждённая ячейка');
    const style=cell.style;
    if(Object.keys(style).some(k=>!['bold','italic','bg','color','align','format','border','borders','borderEdges','borderColor','fontSize','fontFamily','wrap'].includes(k))||
       ['bold','italic','wrap'].some(k=>k in style&&typeof style[k]!=='boolean')||
       ['bg','color','borderColor'].some(k=>k in style&&!/^#[0-9a-fA-F]{6}$/.test(style[k]))||
       ('fontSize' in style&&(!Number.isFinite(style.fontSize)||style.fontSize<6||style.fontSize>72))||
       ('fontFamily' in style&&!FONT_FAMILIES.includes(style.fontFamily))||
        ('border' in style&&!['thin'].includes(style.border))||
       ('borders' in style&&(!style.borders||typeof style.borders!=='object'||Array.isArray(style.borders)||Object.entries(style.borders).some(([k,v])=>!['left','right','top','bottom'].includes(k)||v!==true)))||
        ('borderEdges' in style&&!validBorderEdges(style.borderEdges))||
       ('align' in style&&!['left','center','right'].includes(style.align))||
       ('format' in style&&!['general','currency','percent','integer','date','time','datetime','duration'].includes(style.format)))throw Error('Недопустимое оформление ячейки');}}
 if(total>LIMITS.cells)throw Error('Превышен лимит ячеек');if(!ids.has(book.activeSheetId))book.activeSheetId=book.sheets[0].id;return book;
}
export function createExample(){const b=newWorkbook('Пример — бюджет проекта'),s=currentSheet(b);s.name='Бюджет';
 const data=[['КАТЕГОРИЯ','ПЛАН','ФАКТ','ОСТАТОК'],['Оборудование','45000','38900','=B2-C2'],['Программное обеспечение','12000','8500','=B3-C3'],['Транспорт','15000','17700','=B4-C4'],['Материалы','18000','14200','=B5-C5'],['ИТОГО','=SUM(B2:B5)','=SUM(C2:C5)','=B6-C6']];
 data.forEach((row,r)=>row.forEach((val,c)=>setCell(s,cellName(r,c),val)));
 for(let c=0;c<4;c++){setStyle(s,cellName(0,c),{bold:true,bg:'#dceafe',color:'#1d457e'});setStyle(s,cellName(5,c),{bold:true,bg:'#edf5e8',color:'#27693b'});}
 for(let r=1;r<6;r++)for(let c=1;c<4;c++)setStyle(s,cellName(r,c),{format:'currency'});
 const s2=newSheet('Заметки');setCell(s2,'A1','Эта книга — демонстрация возможностей Quantum Sheets.');setCell(s2,'A3','Изменяйте цифры в столбцах B и C: формулы пересчитаются.');b.sheets.push(s2);return b;}


/** Clears style without deleting values/formulas or creating empty cells. */
/** Clear formats on stored cells, not on 10 million virtual empty positions.
 * Reset the sheet-wide alignment only for a true whole-sheet selection. */
export function clearFormatting(sheet,from,to,inspectOnly=false){
 const {area,entries}=sparseSelection(sheet,from,to);
 const all=area.r1===0&&area.c1===0&&area.r2===LIMITS.rows-1&&area.c2===LIMITS.columns-1;
 const remainingRectangleStyles=subtractRectangleStyles(sheet,area);
 let count=all&&(sheet.defaultAlign!=null||Object.keys(sheet.defaultStyle||{}).length>0)?1:0;
 count+=remainingRectangleStyles.changed;
 const columns=area.r1===0&&area.r2===LIMITS.rows-1?Object.keys(sheet.columnStyles||{}).filter(c=>+c>=area.c1&&+c<=area.c2):[];
 count+=columns.length;
 for(const [ref,entry] of entries){
  if(!Object.keys(entry.style||{}).length)continue;
  count++;
  if(!inspectOnly){
   if(entry.value)sheet.cells[ref]={...entry,style:{}};
   else delete sheet.cells[ref];
  }
 }
 if(!inspectOnly){
  sheet.rectangleStyles=remainingRectangleStyles.layers;
  if(all){sheet.defaultAlign=null;sheet.defaultStyle={};}
  if(columns.length){const next={...(sheet.columnStyles||{})};for(const c of columns)delete next[c];sheet.columnStyles=next;}
 }
 return count;
}
/** Plan autosum operations before any mutation, protecting occupied destinations. */
export function planAutoSum(sheet,from,to){
 const rect=rectangle(from,to);if(!rect)throw Error('Неверный диапазон');
 const entries=[];
 if(rect.r1!==rect.r2||rect.c1!==rect.c2){
   if(rect.r2>=LIMITS.rows-1)throw Error('Нет строки под выделением');
   if(rect.c2-rect.c1>=50)throw Error('Слишком много столбцов для автосуммы');
   for(let c=rect.c1;c<=rect.c2;c++){
     const target=cellName(rect.r2+1,c);
     if(getCell(sheet,target).value)throw Error(`Ячейка ${target} занята — автосумма отменена`);
     entries.push({ref:target,value:`=SUM(${cellName(rect.r1,c)}:${cellName(rect.r2,c)})`});
   }
 }else{
   const r=rect.r1,c=rect.c1,ref=cellName(r,c);
   if(getCell(sheet,ref).value)throw Error('Выберите пустую ячейку для автосуммы');
   let begin=r;
   while(begin>0&&getCell(sheet,cellName(begin-1,c)).value)begin--;
   if(begin<r)entries.push({ref,value:`=SUM(${cellName(begin,c)}:${cellName(r-1,c)})`});
   else{
     let left=c;
     while(left>0&&getCell(sheet,cellName(r,left-1)).value)left--;
     if(left<c)entries.push({ref,value:`=SUM(${cellName(r,left)}:${cellName(r,c-1)})`});
   }
   if(!entries.length)throw Error('Рядом нет заполненных ячеек для автосуммы');
 }
 return entries;
}

export {cellName,parseCell};

/** Reusable polished template helpers. Schema remains compatible with .qbook/XLSX. */
const tColor={ink:'#20354a',navy:'#25415d',blue:'#315e7c',pale:'#e9f1f8',green:'#28664e',mint:'#e7f4ec',gold:'#a36a1a',cream:'#fff0d4',white:'#ffffff',soft:'#f5f8fb',muted:'#617589'};
function tMerged(sheet,from,to,value,style){
 setCell(sheet,from,value);
 if(from!==to)mergeCells(sheet,from,to);
 setStyle(sheet,from,{bold:true,align:'left',...style});
}
function tHeaders(sheet,row,labels,widths){
 labels.forEach((name,c)=>{
  setColumnWidth(sheet,c,widths[c]);const ref=cellName(row,c);
  setCell(sheet,ref,name);setStyle(sheet,ref,{bg:tColor.navy,color:tColor.white,bold:true,align:'center',wrap:true,borders:{bottom:true}});
 });
 setRowHeight(sheet,row,46);
}
function tTint(sheet,row,first,last,color){
 for(let c=first;c<=last;c++)setStyle(sheet,cellName(row,c),{bg:color});
}
function tExamples(sheet,row,values,start=0){
 values.forEach((v,i)=>{if(v!==null&&v!==undefined&&v!=='')setCell(sheet,cellName(row,start+i),String(v));});
}
function tTop(sheet,last,title,subtitle){
 tMerged(sheet,'A1',colLabel(last)+'1',title,{bg:tColor.navy,color:tColor.white});
 tMerged(sheet,'A2',colLabel(last)+'2',subtitle,{bg:tColor.soft,color:tColor.muted,bold:false,wrap:true});
 setRowHeight(sheet,0,54);setRowHeight(sheet,1,36);
}

/** Timetable retains known A4/B2/I2 addresses and three sheets for older books/tests. */
export function createScheduleTemplate(){
 const book=newWorkbook('Недельное расписание занятий'),s=currentSheet(book);s.name='График';
 const headings=['День','Ученики','Класс / предмет','Время занятий','План занятий','Результаты','Примечание','Проведено','Стоимость','Оплачено'];
 tHeaders(s,1,headings,[83,185,190,154,300,188,220,118,124,118]);
 // Title sections do not cross the A:B frozen column boundary.
 tMerged(s,'A1','B1','ГРАФИК НЕДЕЛИ',{bg:tColor.navy,color:tColor.white,align:'center'});
 tMerged(s,'C1','J1','РАСПИСАНИЕ ЗАНЯТИЙ / ПЛАН / ОПЛАТА',{bg:tColor.blue,color:tColor.white});
 setRowHeight(s,0,52);
 tMerged(s,'A3','B3','НЕДЕЛЯ',{bg:tColor.green,color:tColor.white,align:'center'});
 tMerged(s,'C3','G3','УЧЕБНЫЙ ПРОЦЕСС',{bg:tColor.mint,color:tColor.green});
 tMerged(s,'H3','J3','ПОСЕЩЕНИЕ И ОПЛАТА',{bg:tColor.cream,color:tColor.gold});
 setRowHeight(s,2,32);
 const days=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
 const bands=['#f2f7fc','#f5f9fd','#f2f8f6','#f6f9fc','#f2f7fc','#fff8ec','#f4f5f8'];
 days.forEach((day,k)=>{
  const first=3+k*5,last=first+4;
  tMerged(s,cellName(first,0),cellName(last,0),day,{bg:k>=5?'#e9b963':'#ffca19',color:tColor.ink,align:'center'});
  for(let row=first;row<=last;row++){
   setRowHeight(s,row,34);tTint(s,row,1,9,bands[k]);
   if(row===last)for(let c=1;c<=9;c++)setStyle(s,cellName(row,c),{borders:{bottom:true}});
  }
 });
 tExamples(s,3,['Пример: ученик','Алгебра · 9 класс','16:00–17:00','Повторение квадратных уравнений','Задачи 1–5','Д/з: № 12, 14','Да','2500','Да'],1);
 setStyle(s,'B4',{bold:true,color:tColor.blue});setStyle(s,'E4',{wrap:true});setStyle(s,'G4',{wrap:true});setStyle(s,'I4',{format:'currency',bg:'#f7e7be',bold:true});
 setFreeze(s,3,2);
 const pay=newSheet('Бухгалтерия');
 tHeaders(pay,3,['Дата','Ученик','Предмет','Проведено','Стоимость','Оплачено','Долг','Комментарий'],[128,205,165,125,125,125,125,265]);
 tTop(pay,7,'УЧЁТ ЗАНЯТИЙ И ОПЛАТ','Заполняйте занятия и суммы. Долг рассчитывается автоматически.');
 tMerged(pay,'A3','H3','РАСЧЁТЫ И КОНТРОЛЬ ОПЛАТ',{bg:tColor.mint,color:tColor.green});setRowHeight(pay,2,30);
 for(let row=4;row<=15;row++){
  setRowHeight(pay,row,34);tTint(pay,row,0,7,row%2===0?tColor.white:tColor.soft);
  for(const c of [4,5,6])setStyle(pay,cellName(row,c),{format:'currency'});
  setCell(pay,cellName(row,6),'=E'+(row+1)+'-F'+(row+1));
 }
 tExamples(pay,4,['Пример','Пример: ученик','Алгебра','Да','2500','2500',null,'Данные приведены для примера']);
 setStyle(pay,'A5',{italic:true});setStyle(pay,'H5',{italic:true,color:tColor.muted,wrap:true});setFreeze(pay,4,0);
 const partner=newSheet('Партнёрка');
 tHeaders(partner,3,['Контакт','Организация','Формат работы','Статус','Комментарий'],[190,215,285,150,360]);
 tTop(partner,4,'ПАРТНЁРСТВА И КОНТАКТЫ','Рабочий реестр совместных проектов, рекомендаций и договорённостей.');
 tMerged(partner,'A3','E3','СТАТУСЫ И ДОГОВОРЁННОСТИ',{bg:tColor.mint,color:tColor.green});
 setRowHeight(partner,2,30);
 for(let row=4;row<16;row++){setRowHeight(partner,row,38);tTint(partner,row,0,4,row%2===0?tColor.white:tColor.soft);}
 tExamples(partner,4,['Пример: контакт','Образовательный проект','Совместная консультация','В обсуждении','Замените эту строку своими данными']);
 setStyle(partner,'E5',{italic:true,color:tColor.muted,wrap:true});setFreeze(partner,4,0);
 book.sheets.push(pay,partner);return validateWorkbook(book);
}

export function createJournalTemplate(){
 const book=newWorkbook('Журнал учеников'),s=currentSheet(book);s.name='Ученики';
 tHeaders(s,3,['Ученик','Класс','Предмет','Формат','Занятий','Оплачено','Прогресс','Примечания'],[206,95,180,135,110,130,200,340]);
 tTop(s,7,'ЖУРНАЛ УЧЕНИКОВ','Учёт групп, занятий, посещаемости и прогресса. Примерные записи можно заменить.');
 tMerged(s,'A3','D3','ОБУЧЕНИЕ И ФОРМАТ',{bg:tColor.pale,color:tColor.navy});
 tMerged(s,'E3','H3','ПОСЕЩАЕМОСТЬ И РЕЗУЛЬТАТЫ',{bg:tColor.mint,color:tColor.green});setRowHeight(s,2,30);
 for(let row=4;row<=25;row++){
  setRowHeight(s,row,38);tTint(s,row,0,7,row%2===0?tColor.white:tColor.soft);
  setStyle(s,cellName(row,5),{format:'currency'});setStyle(s,cellName(row,7),{wrap:true});
 }
 tExamples(s,4,['Пример: ученик 1','9','Математика','Индивидуально','4','10000','Повторение тем','Сильная сторона: алгебра']);
 tExamples(s,5,['Пример: ученик 2','11','Физика','Онлайн','3','7500','Решение задач','Повторить динамику']);
 for(const ref of ['A5','A6'])setStyle(s,ref,{bold:true,color:tColor.blue});
 for(const ref of ['G5','G6'])setStyle(s,ref,{bg:tColor.mint,color:tColor.green});
 setFreeze(s,4,0);return validateWorkbook(book);
}

export function createBudgetTemplate(){
 const book=newWorkbook('Доходы и расходы'),s=currentSheet(book);s.name='Учёт';
 tHeaders(s,4,['Дата','Категория','Описание операции','Доход','Расход','Баланс','Статус','Комментарий'],[130,185,310,142,142,148,153,310]);
 tTop(s,7,'ДОХОДЫ И РАСХОДЫ','Замените примерные операции своими. Баланс и итог пересчитываются автоматически.');
 tMerged(s,'A3','C3','ОПЕРАЦИИ',{bg:tColor.pale,color:tColor.navy});
 tMerged(s,'D3','F3','ДЕНЕЖНЫЙ ПОТОК',{bg:tColor.mint,color:tColor.green});
 tMerged(s,'G3','H3','КОНТРОЛЬ',{bg:tColor.cream,color:tColor.gold});
 setRowHeight(s,2,34);setRowHeight(s,3,24);
 const examples=[
  ['01.09.2026','Услуги','Пример: индивидуальное занятие','2500','0','Оплачено','Замените примеры своими данными'],
  ['02.09.2026','Расходы','Пример: канцелярия','0','450','Учтено','Материалы для занятий'],
  ['03.09.2026','Услуги','Пример: консультация','3000','0','Оплачено',''],
  ['04.09.2026','Расходы','Пример: подписка','0','700','Учтено','']
 ];
 for(let row=5;row<=18;row++){
  setRowHeight(s,row,36);tTint(s,row,0,7,row%2?tColor.white:tColor.soft);
  for(let c=3;c<=5;c++)setStyle(s,cellName(row,c),{format:'currency',align:'right'});
  setCell(s,cellName(row,5),'=SUM(D6:D'+(row+1)+')-SUM(E6:E'+(row+1)+')');
 }
 examples.forEach((entry,k)=>{
  const row=k+5;tExamples(s,row,[entry[0],entry[1],entry[2],entry[3],entry[4],null,entry[5],entry[6]]);
  if(k%2===0)setStyle(s,cellName(row,6),{bg:tColor.mint,color:tColor.green,bold:true});
  if(k===0)setStyle(s,'H6',{italic:true,wrap:true,color:tColor.muted});
 });
 setRowHeight(s,19,42);
 tMerged(s,'A20','C20','ИТОГО ЗА ПЕРИОД',{bg:tColor.navy,color:tColor.white});
 for(let c=3;c<=5;c++)setStyle(s,cellName(19,c),{bg:tColor.pale,bold:true,format:'currency',borders:{top:true,bottom:true}});
 setCell(s,'D20','=SUM(D6:D19)');setCell(s,'E20','=SUM(E6:E19)');setCell(s,'F20','=D20-E20');
 tMerged(s,'G20','H20','Проверьте заполнение перед использованием',{bg:tColor.cream,color:tColor.gold,wrap:true,bold:false});
 setFreeze(s,5,0);return validateWorkbook(book);
}
