/** Bounded, non-destructive-before-validation data-cleaning operations. */
import {LIMITS,cellName,rectangle,getCell,parseCell} from './workbook.js';
import {checkValidatedInput} from './validation.js';

const DATA_MAX_ROWS=2000,DATA_MAX_COLUMNS=20,DATA_MAX_CELLS=10000;
const dataAreasOverlap=(a,b)=>a.r1<=b.r2&&a.r2>=b.r1&&a.c1<=b.c2&&a.c2>=b.c1;
function safeArea(sheet,area,{wide=false}={}){
 if(!area||area.r1<0||area.c1<0||area.r2>=LIMITS.rows||area.c2>=LIMITS.columns)
  throw Error('Диапазон выходит за границы листа');
 const rows=area.r2-area.r1+1,cols=area.c2-area.c1+1;
 if(rows>DATA_MAX_ROWS||cols>DATA_MAX_COLUMNS||rows*cols>DATA_MAX_CELLS)
  throw Error('Обработка ограничена 2 000 строками, 20 столбцами и 10 000 ячейками');
 if(sheet.autoFilter)throw Error('Сначала выключите автофильтр');
 if((sheet.rectangleStyles||[]).length)throw Error('Сначала уберите крупные области оформления для этой операции');
 for(let r=area.r1;r<=area.r2;r++)if(sheet.hiddenRows?.[r])throw Error('Сначала покажите скрытые строки');
 for(let c=area.c1;c<=area.c2;c++)if(sheet.hiddenColumns?.[c])throw Error('Сначала покажите скрытые столбцы');
 if((sheet.merges||[]).some(m=>dataAreasOverlap(area,rectangle(m.from,m.to))))
  throw Error('Выделение пересекается с объединёнными ячейками: сначала разъедините их');
 return {rows,cols};
}
export const TEXT_SPLIT_DELIMITERS={semicolon:';',comma:',',tab:'\t',space:' ',pipe:'|'};
/** Strict CSV-style quoting, including "" escaped quotes and embedded delimiters.
 * Unquoted / malformed quotes are rejected rather than silently losing data. */
export function splitDelimited(text,delimiter=';'){
 if(typeof text!=='string'||typeof delimiter!=='string'||delimiter.length!==1||
    ['\n','\r','"'].includes(delimiter))throw Error('Разделитель должен состоять из одного символа');
 const parts=[];let value='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){
   if(ch==='"'&&text[i+1]==='"'){value+='"';i++;}
   else if(ch==='"')quoted=false,closed=true;
   else value+=ch;
  }else if(ch===delimiter){
   parts.push(value);value='';closed=false;
  }else if(ch==='"'&&!value&&!closed){quoted=true;}
  else if(ch==='"')throw Error('Неправильные кавычки в исходном тексте');
  else if(closed)throw Error('Текст после закрывающей кавычки');
  else value+=ch;
 }
 if(quoted)throw Error('Не закрыты кавычки в исходном тексте');
 parts.push(value);
 return parts;
}
/** Preview and execution deliberately use the same validated deterministic plan. */
export function planTextToColumns(sheet,from,to=from,{delimiter=';',overwrite=false}={}){
 const source=rectangle(from,to);
 if(!source||source.c1!==source.c2)throw Error('Выделите один столбец с текстом');
 const {rows}=safeArea(sheet,source);
 const parsed=[],changes=[],conflicts=[];
 let width=1,sourceCount=0;
 for(let r=source.r1;r<=source.r2;r++){
  const ref=cellName(r,source.c1),text=String(getCell(sheet,ref).value??'');
  if(text.startsWith('='))throw Error('Формулы в исходном столбце не разделяются');
  const values=text?splitDelimited(text,delimiter):[''];
  width=Math.max(width,values.length);
  if(values.length>DATA_MAX_COLUMNS)throw Error('Строка содержит больше 20 полей');
  if(text)sourceCount++;
  parsed.push(values);
 }
 if(source.c1+width>LIMITS.columns)throw Error('Недостаточно столбцов справа');
 const target={r1:source.r1,r2:source.r2,c1:source.c1,c2:source.c1+width-1};
 safeArea(sheet,target);
 // All target positions are planned, including clearing stale extra split cells.
 for(let i=0;i<rows;i++)for(let j=0;j<width;j++){
  const ref=cellName(source.r1+i,source.c1+j),value=parsed[i][j]??'';
  if(value.length>50000)throw Error('Результат превышает размер ячейки');
  if(j>0&&getCell(sheet,ref).value!==''&&getCell(sheet,ref).value!==value)conflicts.push(ref);
  checkValidatedInput(sheet,ref,value);
  changes.push({ref,value});
 }
 if(conflicts.length&&!overwrite)throw Error('Справа заняты ячейки ('+conflicts.slice(0,3).join(', ')+'). Включите замену существующих данных');
 const nextCount=Object.keys(sheet.cells).length+
  changes.reduce((n,{ref,value})=>n+(!getCell(sheet,ref).value&&value?1:0),0);
 if(nextCount>LIMITS.cells)throw Error('Превышен лимит ячеек книги');
 return {rows,cols:width,sourceCount,delimiter,overwrite,conflicts:conflicts.length,
  from:cellName(target.r1,target.c1),to:cellName(target.r2,target.c2),
  preview:parsed.slice(0,6).map((fields,i)=>({row:source.r1+i+1,fields})),changes};
}
export function applyTextToColumns(sheet,plan){
 if(!plan||!Array.isArray(plan.changes)||plan.changes.length>DATA_MAX_CELLS)
  throw Error('Не задан корректный план обработки');
 // Validate entire plan against the current workbook state again before any mutation.
 const original=planTextToColumns(sheet,plan.from.split(':')[0],cellName(parseCell(plan.to).row,parseCell(plan.from).col),
  {delimiter:plan.delimiter||';',overwrite:plan.overwrite});
 if(JSON.stringify(original.changes)!==JSON.stringify(plan.changes))
  throw Error('Исходные данные изменились: обновите предпросмотр');
 for(const {ref,value} of plan.changes){
  const prev=getCell(sheet,ref),style=structuredClone(prev.style||{});
  if(value||Object.keys(style).length)sheet.cells[ref]={value,style};
  else delete sheet.cells[ref];
 }
 return {rows:plan.rows,cols:plan.cols,conflicts:plan.conflicts};
}
/** Dedup compacts only the selected rectangle. Outside columns/rows are untouched.
 * Formulas in selected cells are not moved because their references need a separate rewrite. */
export function planRemoveDuplicates(sheet,from,to,{header=true,key='all'}={}){
 const area=rectangle(from,to);
 if(!area||area.r1===area.r2)throw Error('Выделите минимум две строки');
 const {rows,cols}=safeArea(sheet,area);
 if(!['all','first'].includes(key)||typeof header!=='boolean')throw Error('Неверные параметры поиска дублей');
 const first=header?1:0,keep=[],seen=new Set(),duplicates=[];
 for(let i=0;i<rows;i++){
  const cells=[];
  for(let j=0;j<cols;j++){
   const v=getCell(sheet,cellName(area.r1+i,area.c1+j));
   if(String(v.value).startsWith('='))throw Error('Удаление дублей с формулами в выделении пока не поддерживается');
   cells.push(structuredClone(v));
  }
  if(i<first){keep.push(cells);continue;}
  const checked=(key==='first'?cells.slice(0,1):cells).map(c=>c.value.toLocaleLowerCase('ru-RU'));
  const code=JSON.stringify(checked);
  if(seen.has(code))duplicates.push(area.r1+i+1);
  else{seen.add(code);keep.push(cells);}
 }
 const sourceSnapshot=Array.from({length:rows},(_,i)=>
  Array.from({length:cols},(_,j)=>structuredClone(getCell(sheet,cellName(area.r1+i,area.c1+j)))));
 const rowsAfter=[...keep,...Array.from({length:duplicates.length},()=>Array.from({length:cols},()=>({value:'',style:{}})))];
 const changes=[];
 for(let i=0;i<rowsAfter.length;i++)for(let j=0;j<cols;j++){
  const ref=cellName(area.r1+i,area.c1+j),cell=rowsAfter[i][j];
  checkValidatedInput(sheet,ref,cell.value);
  changes.push({ref,cell});
 }
 return {from:cellName(area.r1,area.c1),to:cellName(area.r2,area.c2),
  header,key,total:rows-first,removed:duplicates.length,kept:keep.length-first,
  duplicateRows:duplicates.slice(0,10),sourceSnapshot,changes};
}
export function applyRemoveDuplicates(sheet,plan){
 if(!plan||!Array.isArray(plan.changes)||plan.changes.length>DATA_MAX_CELLS)
  throw Error('Не задан корректный план удаления дублей');
 const fresh=planRemoveDuplicates(sheet,plan.from,plan.to,{header:plan.header,key:plan.key});
 if(JSON.stringify(fresh.sourceSnapshot)!==JSON.stringify(plan.sourceSnapshot)||
    JSON.stringify(fresh.changes)!==JSON.stringify(plan.changes))
  throw Error('Данные изменились: обновите предпросмотр');
 for(const {ref,cell} of plan.changes){
  if(cell.value||Object.keys(cell.style||{}).length)sheet.cells[ref]=structuredClone(cell);
  else delete sheet.cells[ref];
 }
 return {removed:plan.removed,kept:plan.kept};
}
