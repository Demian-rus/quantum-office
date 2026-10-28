import { cellName,parseCell,colLabel,evaluateCell,csvEncode,csvDecode } from './formulas.js';
export const uid=()=>globalThis.crypto?.randomUUID?.()??`q-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const stamp=()=>new Date().toISOString();
export const LIMITS={rows:2000,columns:100,cells:50000,sheets:25};
export function newSheet(name='Лист 1') {return {id:uid(),name,cells:{},columnWidths:{},rowHeights:{},freeze:{rows:0,cols:0},autoFilter:null};}
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
 for(let col=0;col<LIMITS.columns;col++)x.push(x.at(-1)+columnWidth(sheet,col));
 for(let row=0;row<LIMITS.rows;row++)y.push(y.at(-1)+(filterRowVisible(sheet,row)?rowHeight(sheet,row):0));
 return {x,y};
}
export function firstVisibleIndex(positions,coordinate){
 let lo=0,hi=positions.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(positions[mid+1]<=coordinate)lo=mid+1;else hi=mid;}
 return Math.min(lo,positions.length-2);
}
export function getCell(sheet,ref){return sheet.cells[String(ref).toUpperCase()]||{value:'',style:{}};}
export function setCell(sheet,ref,value){if(!validRef(ref))throw Error('Адрес ячейки вне диапазона');const key=ref.toUpperCase();if(!sheet.cells[key])sheet.cells[key]={value:'',style:{}};sheet.cells[key].value=String(value??'').slice(0,50000);if(!sheet.cells[key].value&&!Object.keys(sheet.cells[key].style||{}).length)delete sheet.cells[key];}
export function setStyle(sheet,ref,patch){if(!validRef(ref))throw Error('Недопустимая ячейка');const key=ref.toUpperCase();const prev=getCell(sheet,key);sheet.cells[key]={value:prev.value,style:{...prev.style,...patch}};}
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
export function resultOf(sheet,ref,map=rawMap(sheet)){return evaluateCell(ref,map);}
export function displayedValue(sheet,ref,map=rawMap(sheet)){
  const cell=getCell(sheet,ref),result=resultOf(sheet,ref,map);if(result===''||result==null)return '';
  if(typeof result!=='number')return String(result);
  const n=Number.isFinite(result)?result:0;
  if(cell.style?.format==='currency')return new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(n);
  if(cell.style?.format==='percent')return new Intl.NumberFormat('ru-RU',{style:'percent',maximumFractionDigits:2}).format(n);
  if(cell.style?.format==='integer')return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n);
  return String(n);
}
export function valuesTSV(sheet,a,b){const rect=rectangle(a,b);if(!rect)return '';
 const map=rawMap(sheet),rows=[];for(let r=rect.r1;r<=rect.r2;r++){const row=[];for(let c=rect.c1;c<=rect.c2;c++)row.push(String(resultOf(sheet,cellName(r,c),map)));rows.push(row.join('\t'));}return rows.join('\n');}
export function pasteTSV(sheet,start,text){const at=parseCell(start);if(!at||!validRef(start))throw Error('Недопустимая ячейка');
 const rows=String(text).replace(/\r\n?/g,'\n').replace(/\n$/,'').split('\n').map(line=>line.split('\t'));
 const maxR=Math.min(LIMITS.rows-at.row,rows.length),maxC=Math.min(LIMITS.columns-at.col,Math.max(...rows.map(r=>r.length)));
 if(maxR*maxC>20000)throw Error('Вставка ограничена 20 000 ячеек');
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
export function exportCSV(sheet){let maxR=0,maxC=0;for(const key of Object.keys(sheet.cells)){const p=parseCell(key);if(p){maxR=Math.max(maxR,p.row);maxC=Math.max(maxC,p.col);}}
 const raw=rawMap(sheet);return csvEncode(Array.from({length:maxR+1},(_,r)=>Array.from({length:maxC+1},(_,c)=>String(resultOf(sheet,cellName(r,c),raw)))));
}
export function validateWorkbook(book){
 if(!book||book.type!=='sheet'||typeof book.id!=='string'||typeof book.name!=='string'||book.name.length>200||!Array.isArray(book.sheets)||!book.sheets.length||book.sheets.length>LIMITS.sheets)throw Error('Неверный формат книги');
 let total=0;const ids=new Set();for(const sheet of book.sheets){
  for(const [key,max,sizeMin,sizeMax] of [['columnWidths',LIMITS.columns,DIMENSIONS.minColumn,DIMENSIONS.maxColumn],['rowHeights',LIMITS.rows,DIMENSIONS.minRow,DIMENSIONS.maxRow]]){
   const map=sheet?.[key];if(map===undefined)continue;
   if(!map||typeof map!=='object'||Array.isArray(map)||Object.keys(map).length>max)throw Error('Повреждённые размеры листа');
   for(const [index,value] of Object.entries(map))if(!/^(0|[1-9]\d*)$/.test(index)||Number(index)>=max||!Number.isInteger(value)||value<sizeMin||value>sizeMax)throw Error('Некорректный размер строки или столбца');
  }
if(sheet.freeze!==undefined){
    const f=sheet.freeze;if(!f||!Number.isInteger(f.rows)||!Number.isInteger(f.cols)||f.rows<0||f.cols<0||f.rows>10||f.cols>10)throw Error('Повреждено закрепление областей');
   }
   if(sheet.autoFilter!==undefined&&sheet.autoFilter!==null){
    const f=sheet.autoFilter,rect=rectangle(f?.from,f?.to);
    if(!f||!rect||!validRef(f.from)||!validRef(f.to)||rect.r2<=rect.r1||!f.rules||typeof f.rules!=='object'||Array.isArray(f.rules))throw Error('Повреждён автофильтр');
    if(Object.entries(f.rules).some(([col,val])=>!(/^(0|[1-9]\d*)$/.test(col))||Number(col)<rect.c1||Number(col)>rect.c2||!(typeof val==='string'&&val.length<=50000||Array.isArray(val)&&val.length>0&&val.length<=200&&val.every(v=>typeof v==='string'&&v.length<=50000)&&new Set(val).size===val.length)))throw Error('Некорректные условия фильтра');
   }
 if(!sheet||typeof sheet.id!=='string'||ids.has(sheet.id)||typeof sheet.name!=='string'||sheet.name.length>100||!sheet.cells||typeof sheet.cells!=='object'||Array.isArray(sheet.cells))throw Error('Повреждённый лист');ids.add(sheet.id);const keys=Object.keys(sheet.cells);total+=keys.length;for(const ref of keys){const cell=sheet.cells[ref];if(!validRef(ref)||!cell||typeof cell.value!=='string'||cell.value.length>50000||!cell.style||typeof cell.style!=='object'||Array.isArray(cell.style))throw Error('Повреждённая ячейка');
    const style=cell.style;
    if(Object.keys(style).some(k=>!['bold','italic','bg','color','align','format'].includes(k))||
       ['bold','italic'].some(k=>k in style&&typeof style[k]!=='boolean')||
       ['bg','color'].some(k=>k in style&&!/^#[0-9a-fA-F]{6}$/.test(style[k]))||
       ('align' in style&&!['left','center','right'].includes(style.align))||
       ('format' in style&&!['general','currency','percent','integer'].includes(style.format)))throw Error('Недопустимое оформление ячейки');}}
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
