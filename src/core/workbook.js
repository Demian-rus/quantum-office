import { cellName,parseCell,colLabel,evaluateCell,createCalculationSession,csvEncode,csvDecode } from './formulas.js';
import {formatTemporal,parseTemporalInput} from './dates.js';
export const uid=()=>globalThis.crypto?.randomUUID?.()??`q-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const stamp=()=>new Date().toISOString();
export const LIMITS={rows:2000,columns:100,cells:50000,sheets:25};
export function newSheet(name='Лист 1') {return {id:uid(),name,cells:{},columnWidths:{},rowHeights:{},hiddenRows:{},hiddenColumns:{},freeze:{rows:0,cols:0},autoFilter:null,merges:[]};}
export function newWorkbook(name='Новая таблица') {const sheet=newSheet();return {id:uid(),type:'sheet',name,created:stamp(),updated:stamp(),sheets:[sheet],activeSheetId:sheet.id};}
export function currentSheet(book){return book.sheets.find(s=>s.id===book.activeSheetId)||book.sheets[0];}
export const DIMENSIONS={defaultColumn:116,defaultRow:29,minColumn:48,maxColumn:520,minRow:22,maxRow:160};
export function columnWidth(sheet,index){return sheet.columnWidths?.[index]??DIMENSIONS.defaultColumn;}
export function rowHeight(sheet,index){return sheet.rowHeights?.[index]??DIMENSIONS.defaultRow;}
export function setColumnWidth(sheet,index,value){
 if(!Number.isInteger(index)||index<0||index>=LIMITS.columns||!Number.isInteger(value)||value<DIMENSIONS.minColumn||value>DIMENSIONS.maxColumn)throw Error('Недопустимая ширина столбца');
 sheet.columnWidths??={};if(value===DIMENSIONS.defaultColumn)delete sheet.columnWidths[index];else sheet.columnWidths[index]=value;
}
export function setRowHeight(sheet,index,value){
 if(!Number.isInteger(index)||index<0||index>=LIMITS.rows||!Number.isInteger(value)||value<DIMENSIONS.minRow||value>DIMENSIONS.maxRow)throw Error('Недопустимая высота строки');
 sheet.rowHeights??={};if(value===DIMENSIONS.defaultRow)delete sheet.rowHeights[index];else sheet.rowHeights[index]=value;
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
}
export function showAllHidden(sheet,axis){
 const key=axis==='row'?'hiddenRows':axis==='col'?'hiddenColumns':null;
 if(!key)throw Error('Неизвестная ось');
 const count=Object.keys(sheet[key]||{}).length;sheet[key]={};return count;
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
 sheet.autoFilter={...sheet.autoFilter,rules};
}
export function gridGeometry(sheet){
 const x=[54],y=[31];
 for(let col=0;col<LIMITS.columns;col++)x.push(x.at(-1)+(columnVisible(sheet,col)?columnWidth(sheet,col):0));
 for(let row=0;row<LIMITS.rows;row++)y.push(y.at(-1)+(rowVisible(sheet,row)?rowHeight(sheet,row):0));
 return {x,y};
}
export function firstVisibleIndex(positions,coordinate){
 let lo=0,hi=positions.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(positions[mid+1]<=coordinate)lo=mid+1;else hi=mid;}
 return Math.min(lo,positions.length-2);
}
export function getCell(sheet,ref){return sheet.cells[String(ref).toUpperCase()]||{value:'',style:{}};}
export function setCell(sheet,ref,value){if(!validRef(ref))throw Error('Адрес ячейки вне диапазона');const key=ref.toUpperCase();if(!sheet.cells[key])sheet.cells[key]={value:'',style:{}};sheet.cells[key].value=String(value??'').slice(0,50000);if(!sheet.cells[key].value&&!Object.keys(sheet.cells[key].style||{}).length)delete sheet.cells[key];}
/** Convert explicit calendar/time input to serial values only for direct user entry.
 * All file import, clipboard and formula editing outside the UI preserve their raw values. */
export function setTypedCell(sheet,ref,input){
 const parsed=typeof input==='string'&&!input.startsWith('=')?parseTemporalInput(input):null;
 setCell(sheet,ref,parsed?parsed.value:input);
 if(parsed)setStyle(sheet,ref,{format:parsed.format});
 else if(typeof input==='string'&&/^=\s*(?:DATE|TODAY)\s*\(/i.test(input)&&(!getCell(sheet,ref).style.format||getCell(sheet,ref).style.format==='general'))setStyle(sheet,ref,{format:'date'});
 else if(typeof input==='string'&&/^=\s*TIME\s*\(/i.test(input)&&(!getCell(sheet,ref).style.format||getCell(sheet,ref).style.format==='general'))setStyle(sheet,ref,{format:'time'});
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
/** Border presets apply to the selected *rectangle*, not every cell separately. */
export function applyBorderPreset(sheet,a,b,preset){
 if(!['outline','all','none','bottom','top','left','right'].includes(preset))throw Error('Неизвестный вариант границ');
 const r=rectangle(a,b);if(!r||!validRef(a)||!validRef(b))throw Error('Недопустимый диапазон');
 if((r.r2-r.r1+1)*(r.c2-r.c1+1)>10000)throw Error('Слишком большой диапазон');
 for(let row=r.r1;row<=r.r2;row++)for(let col=r.c1;col<=r.c2;col++){
  const ref=cellName(row,col),previous=getCell(sheet,ref).style||{};
  let borders={...(previous.borders|| (previous.border==='thin'?{top:true,bottom:true,left:true,right:true}:{}))};
  if(preset==='none')borders={};
  else if(preset==='all')borders={top:true,bottom:true,left:true,right:true};
  else if(preset==='outline'){
   borders={...borders,top:row===r.r1||undefined,bottom:row===r.r2||undefined,left:col===r.c1||undefined,right:col===r.c2||undefined};
  } else if(preset==='bottom')borders.bottom=row===r.r2||undefined;
  else if(preset==='top')borders.top=row===r.r1||undefined;
  else if(preset==='left')borders.left=col===r.c1||undefined;
  else if(preset==='right')borders.right=col===r.c2||undefined;
  borders=Object.fromEntries(Object.entries(borders).filter(([,v])=>v===true));
  setStyle(sheet,ref,{border:undefined,borders:Object.keys(borders).length?borders:undefined});
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
  const cell=getCell(sheet,ref),result=resultOf(sheet,ref,map,context);if(result===''||result==null)return '';
  if(['date','time','datetime','duration'].includes(cell.style?.format)&& (typeof result==='number'||typeof result==='string'&&/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(result)))return formatTemporal(Number(result),cell.style.format);
  if(typeof result!=='number')return String(result);
  const n=Number.isFinite(result)?result:0;
  if(['date','time','datetime','duration'].includes(cell.style?.format))return formatTemporal(n,cell.style.format);
  if(cell.style?.format==='currency')return new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(n);
  if(cell.style?.format==='percent')return new Intl.NumberFormat('ru-RU',{style:'percent',maximumFractionDigits:2}).format(n);
  if(cell.style?.format==='integer')return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n);
  return String(n);
}
export function valuesTSV(sheet,a,b,book=null){const rect=rectangle(a,b);if(!rect)return '';
 const map=rawMap(sheet),ctx=formulaContext(book,sheet,map),rows=[];for(let r=rect.r1;r<=rect.r2;r++){const row=[];for(let c=rect.c1;c<=rect.c2;c++)row.push(String(resultOf(sheet,cellName(r,c),map,ctx)));rows.push(row.join('\t'));}return rows.join('\n');}
export function pasteTSV(sheet,start,text){const at=parseCell(start);if(!at||!validRef(start))throw Error('Недопустимая ячейка');
 const rows=String(text).replace(/\r\n?/g,'\n').replace(/\n$/,'').split('\n').map(line=>line.split('\t'));
 const maxR=Math.min(LIMITS.rows-at.row,rows.length),maxC=Math.min(LIMITS.columns-at.col,Math.max(...rows.map(r=>r.length)));
 if(maxR*maxC>20000)throw Error('Вставка ограничена 20 000 ячеек');
 for(let r=0;r<maxR;r++)for(let c=0;c<Math.min(maxC,rows[r].length);c++)if(mergeAt(sheet,cellName(at.row+r,at.col+c)))throw Error('Вставка в объединённый диапазон пока не поддерживается');
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
 const raw=rawMap(sheet),ctx=formulaContext(book,sheet,raw);return csvEncode(Array.from({length:maxR+1},(_,r)=>Array.from({length:maxC+1},(_,c)=>String(resultOf(sheet,cellName(r,c),raw,ctx)))));
}
export function validateWorkbook(book){
 if(!book||book.type!=='sheet'||typeof book.id!=='string'||typeof book.name!=='string'||book.name.length>200||!Array.isArray(book.sheets)||!book.sheets.length||book.sheets.length>LIMITS.sheets)throw Error('Неверный формат книги');
 let total=0;const ids=new Set(),names=new Set();for(const sheet of book.sheets){
  if(typeof sheet?.name!=='string'||!sheet.name.trim()||names.has(sheet.name.toLocaleUpperCase('ru-RU')))throw Error('Повторяющееся или пустое название листа');
  names.add(sheet.name.toLocaleUpperCase('ru-RU'));
  for(const [key,max,sizeMin,sizeMax] of [['columnWidths',LIMITS.columns,DIMENSIONS.minColumn,DIMENSIONS.maxColumn],['rowHeights',LIMITS.rows,DIMENSIONS.minRow,DIMENSIONS.maxRow]]){
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
    if(Object.keys(style).some(k=>!['bold','italic','bg','color','align','format','border','borders','wrap'].includes(k))||
       ['bold','italic','wrap'].some(k=>k in style&&typeof style[k]!=='boolean')||
       ['bg','color'].some(k=>k in style&&!/^#[0-9a-fA-F]{6}$/.test(style[k]))||
       ('border' in style&&!['thin'].includes(style.border))||
       ('borders' in style&&(!style.borders||typeof style.borders!=='object'||Array.isArray(style.borders)||Object.entries(style.borders).some(([k,v])=>!['left','right','top','bottom'].includes(k)||v!==true)))||
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
export function clearFormatting(sheet,from,to){
 const refs=refsBetween(from,to);if(refs.length>10000)throw Error('Максимальный диапазон: 10 000 ячеек');
 let count=0;
 for(const ref of refs){const entry=sheet.cells[ref];if(!entry||!Object.keys(entry.style||{}).length)continue;count++;entry.style={};if(!entry.value)delete sheet.cells[ref];}
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

/** Starter weekly timetable; no external personal data. */
/** A practical weekly teaching schedule adapted to the user's spreadsheet structure.
 * Day sections use colored cell bands; merged regions are intentionally not
 * claimed until merging and OOXML round-trip are fully implemented. */
export function createScheduleTemplate(){
 const book=newWorkbook('График занятий');const s=currentSheet(book);s.name='График';
 const heading=['Дни недели','Ученики','Класс / предмет','Время занятий','План занятий','Результаты','Примечание','Проведено','Стоимость','Оплачено'];
 const widths=[73,148,170,123,360,145,220,108,107,105];
 widths.forEach((w,c)=>setColumnWidth(s,c,w));
 // Green upper bands and clear, editable column labels. No invented pupil data.
 for(let c=0;c<heading.length;c++){
  const ref=cellName(0,c),ref2=cellName(1,c);
  setCell(s,ref,c===0?'НЕДЕЛЬНЫЙ ГРАФИК':c===4?'ПЛАН ЗАНЯТИЙ':c===8?'ОПЛАТА':'');
  setStyle(s,ref,{bg:'#00c837',color:'#153d25',bold:true,align:'center'});
  setCell(s,ref2,heading[c]);setStyle(s,ref2,{bold:true,bg:'#f1f5f3',color:'#173f2b',align:'center'});
  setCell(s,cellName(2,c),'');setStyle(s,cellName(2,c),{bg:'#00c837'});
 }
 setRowHeight(s,0,26);setRowHeight(s,1,39);setRowHeight(s,2,22);
 const days=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
 days.forEach((day,k)=>{
  for(let j=0;j<5;j++){
   const r=3+k*5+j;
   setRowHeight(s,r,29);
   const dayRef=cellName(r,0);if(j===0)setCell(s,dayRef,day);
   setStyle(s,dayRef,{bg:'#ffca19',bold:true,color:'#252b25',align:'center'});
   setStyle(s,cellName(r,1),{bg:'#e0e3e5'});
   // Visible day-boundary bands are not baked into user-entered data.
  }
 });
 setFreeze(s,3,2);
 // Small weekly overview as in the reference sheet, to the right.
 const right=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
 right.forEach((d,i)=>{const c=11+i;setColumnWidth(s,c,78);setCell(s,cellName(1,c),d);setStyle(s,cellName(1,c),{bold:true,align:'center',bg:'#e8f5eb'});});
 const finance=newSheet('Бухгалтерия');const financeCols=['Дата','Ученик','Предмет','Занятие','Стоимость','Оплачено','Долг','Примечание'];
 financeCols.forEach((title,c)=>{setColumnWidth(finance,c,[120,175,170,150,115,115,120,255][c]);setCell(finance,cellName(0,c),title);setStyle(finance,cellName(0,c),{bold:true,bg:'#e2f2e7',color:'#165438'});});
 setFreeze(finance,1,0);
 const partner=newSheet('Партнёрка');['Контакт','Организация','Условия','Статус','Комментарий'].forEach((title,c)=>{setColumnWidth(partner,c,[175,195,260,140,290][c]);setCell(partner,cellName(0,c),title);setStyle(partner,cellName(0,c),{bold:true,bg:'#e2f2e7',color:'#165438'});});
 book.sheets.push(finance,partner);return validateWorkbook(book);
}
/** Blank education register, useful when lessons are not organized by week. */
export function createJournalTemplate(){
 const b=newWorkbook('Журнал учеников'),s=currentSheet(b);s.name='Ученики';
 const heads=['Ученик','Класс','Предмет','Формат','Контакт','Стоимость','Примечание'];
 heads.forEach((t,c)=>{setCell(s,cellName(0,c),t);setColumnWidth(s,c,[180,90,160,130,190,120,300][c]);setStyle(s,cellName(0,c),{bold:true,bg:'#d6eee0',color:'#155a3d'});});
 setFreeze(s,1,1);return validateWorkbook(b);
}
/** Basic bookkeeping starter; formulas on a separate totals row. */
export function createBudgetTemplate(){
 const b=newWorkbook('Доходы и расходы'),s=currentSheet(b);s.name='Учёт';
 const heads=['Дата','Категория','Описание','Доход','Расход','Баланс'];
 heads.forEach((t,c)=>{setCell(s,cellName(0,c),t);setColumnWidth(s,c,[130,160,290,140,140,145][c]);setStyle(s,cellName(0,c),{bold:true,bg:'#d6eee0',color:'#155a3d'});});
 setCell(s,'F2','=D2-E2');setFreeze(s,1,0);return validateWorkbook(b);
}
