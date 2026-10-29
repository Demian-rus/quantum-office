/** Bounded, atomic sheet structure operations. No silent clipping of populated cells. */
import {LIMITS,cellName,parseCell,invalidateGridGeometry} from './workbook.js';

const MAX_BATCH=100;
const CELL_REF=/(?<![A-Z0-9_.$])(\$?)([A-Z]+)(\$?)([1-9]\d*)(?![A-Z0-9_.])/gi;

/** Structural edits move even $-anchored references (unlike fill/copy). */
export function rewriteStructureFormula(formula,axis,mode,index,count=1){
 if(typeof formula!=='string'||!formula.startsWith('='))return formula;
 const result='='+formula.slice(1).replace(CELL_REF,(full,lockCol,letters,lockRow,digits)=>{
  const source=parseCell(letters+digits);
  if(!source||source.row>=LIMITS.rows||source.col>=LIMITS.columns)return full;
  const old=axis==='row'?source.row:source.col;
  if(mode==='delete'&&old>=index&&old<index+count)return '#REF!';
  const shifted=mode==='insert'?(old>=index?old+count:old):(old>=index+count?old-count:old);
  if(shifted<0||shifted>=(axis==='row'?LIMITS.rows:LIMITS.columns))throw Error('Формула выходит за пределы листа');
  return axis==='row'?`${lockCol}${letters.toUpperCase()}${lockRow}${shifted+1}`:`${lockCol}${cellName(0,shifted).replace(/\d+$/,'')}${lockRow}${digits}`;
 });
 if(result.length>50000)throw Error('После перемещения формула превышает лимит');
 return result;
}

/**
 * Edit exactly one row/column. Build new cells and dimensions before touching sheet.
 * A filter is rejected until moving its range and selection rules can be proven safe.
 */
export function changeSheetStructure(sheet,axis,mode,index,count=1){
 if(!['row','col'].includes(axis)||!['insert','delete'].includes(mode))throw Error('Неизвестная структурная операция');
 const limit=axis==='row'?LIMITS.rows:LIMITS.columns;
 if(!Number.isInteger(index)||!Number.isInteger(count)||count<1||count>MAX_BATCH||index<0||index+count>limit)throw Error('Диапазон вне таблицы или больше 100');
 if(sheet.autoFilter)throw Error('Сначала отключите автофильтр, затем изменяйте структуру');
 if((sheet.rectangleStyles||[]).length)throw Error('Сначала сбросьте крупные области оформления: перенос границ при вставке и удалении пока не поддерживается');
 // Validate the projected geometry before mutating any cell. Insertions may
 // shift or expand a merge; non-anchor deletions may shrink it.
 const newMerges=[];const last=index+count-1;
 for(const merge of sheet.merges||[]){
  const a=parseCell(merge.from),b=parseCell(merge.to);
  if(!a||!b)throw Error('Повреждённое объединение');
  const start=axis==='row'?a.row:a.col,end=axis==='row'?b.row:b.col;
  let nextStart=start,nextEnd=end;
  if(mode==='insert'){
   if(index<=start){nextStart+=count;nextEnd+=count;}
   else if(index<=end){nextEnd+=count;}
  }else if(last<start){nextStart-=count;nextEnd-=count;}
  else if(index<=end&&last>=start){
   if(index<=start)throw Error('Удаление диапазона с началом объединения запрещено: сначала разъедините ячейки');
   nextEnd-=Math.min(last,end)-index+1;
  }
  if(nextEnd>=limit)throw Error('Объединение выйдет за пределы листа');
  const r1=axis==='row'?nextStart:a.row,c1=axis==='col'?nextStart:a.col;
  const r2=axis==='row'?nextEnd:b.row,c2=axis==='col'?nextEnd:b.col;
  if((r2-r1+1)*(c2-c1+1)>2000)throw Error('Объединение превысит лимит 2000 ячеек');
  if(r1!==r2||c1!==c2)newMerges.push({from:cellName(r1,c1),to:cellName(r2,c2)});
 }
 const cells={};
 for(const [ref,cell] of Object.entries(sheet.cells)){
  const pos=parseCell(ref);if(!pos||pos.row>=LIMITS.rows||pos.col>=LIMITS.columns)throw Error('Недопустимый адрес ячейки');
  const previous=axis==='row'?pos.row:pos.col;
  if(mode==='delete'&&previous>=index&&previous<=last)continue;
  const destination=mode==='insert'?(previous>=index?previous+count:previous):(previous>last?previous-count:previous);
  if(destination>=limit)throw Error('Последняя строка или столбец содержит данные; вставка запрещена');
  const r=axis==='row'?destination:pos.row,c=axis==='col'?destination:pos.col;
  const value=rewriteStructureFormula(cell.value,axis,mode,index,count);
  cells[cellName(r,c)]={value,style:structuredClone(cell.style||{})};
 }
 const key=axis==='row'?'rowHeights':'columnWidths';
 const shiftedDimensions={};
 for(const [k,v] of Object.entries(sheet[key]||{})){
  const old=Number(k);
  if(mode==='delete'&&old>=index&&old<=last)continue;
  const next=mode==='insert'?(old>=index?old+count:old):(old>last?old-count:old);
  if(next>=limit)throw Error('Последняя строка или столбец имеет пользовательский размер');
  shiftedDimensions[next]=v;
 }
 const hiddenKey=axis==='row'?'hiddenRows':'hiddenColumns';
 const hidden={};for(const indexText of Object.keys(sheet[hiddenKey]||{})){
  const old=Number(indexText);
  if(mode==='delete'&&old>=index&&old<=last)continue;
  const next=mode==='insert'?(old>=index?old+count:old):(old>last?old-count:old);
  if(next>=limit)throw Error('Последняя строка или столбец скрыта: сначала отобразите её');
  hidden[next]=true;
 }
 const freeze={...(sheet.freeze||{rows:0,cols:0})};
 const frozenKey=axis==='row'?'rows':'cols';
 if(mode==='insert'&&index<freeze[frozenKey])freeze[frozenKey]+=count;
 if(mode==='delete'&&index<freeze[frozenKey])freeze[frozenKey]-=Math.min(count,freeze[frozenKey]-index);
 if(freeze[frozenKey]>10)throw Error('Нельзя увеличить закреплённую область более 10 строк или столбцов');
 // Existing data and schema remain unchanged if even one step above failed.
 sheet.cells=cells;sheet[key]=shiftedDimensions;sheet[hiddenKey]=hidden;sheet.freeze=freeze;sheet.merges=newMerges;
 invalidateGridGeometry(sheet);
 return {axis,mode,index,count,changed:Object.keys(cells).length};
}
