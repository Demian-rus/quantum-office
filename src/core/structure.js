/** Bounded, atomic sheet structure operations. No silent clipping of populated cells. */
import {LIMITS,cellName,parseCell} from './workbook.js';

const CELL_REF=/(?<![A-Z0-9_.$])(\$?)([A-Z]+)(\$?)([1-9]\d*)(?![A-Z0-9_.])/gi;

/** Structural edits move even $-anchored references (unlike fill/copy). */
export function rewriteStructureFormula(formula,axis,mode,index){
 if(typeof formula!=='string'||!formula.startsWith('='))return formula;
 const result='='+formula.slice(1).replace(CELL_REF,(full,lockCol,letters,lockRow,digits)=>{
  const source=parseCell(letters+digits);
  if(!source||source.row>=LIMITS.rows||source.col>=LIMITS.columns)return full;
  const old=axis==='row'?source.row:source.col;
  if(mode==='delete'&&old===index)return '#REF!';
  const shifted=mode==='insert'?old>=index?old+1:old:old>index?old-1:old;
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
export function changeSheetStructure(sheet,axis,mode,index){
 if(!['row','col'].includes(axis)||!['insert','delete'].includes(mode))throw Error('Неизвестная структурная операция');
 const limit=axis==='row'?LIMITS.rows:LIMITS.columns;
 if(!Number.isInteger(index)||index<0||index>=limit)throw Error('Строка или столбец вне таблицы');
 if(sheet.autoFilter)throw Error('Сначала отключите автофильтр, затем изменяйте структуру');
 if(sheet.merges?.length)throw Error('Сначала снимите объединения перед вставкой или удалением строк и столбцов');
 const cells={};
 for(const [ref,cell] of Object.entries(sheet.cells)){
  const pos=parseCell(ref);if(!pos||pos.row>=LIMITS.rows||pos.col>=LIMITS.columns)throw Error('Недопустимый адрес ячейки');
  const previous=axis==='row'?pos.row:pos.col;
  if(mode==='delete'&&previous===index)continue;
  const destination=mode==='insert'?previous>=index?previous+1:previous:previous>index?previous-1:previous;
  if(destination>=limit)throw Error('Последняя строка или столбец содержит данные; вставка запрещена');
  const r=axis==='row'?destination:pos.row,c=axis==='col'?destination:pos.col;
  const value=rewriteStructureFormula(cell.value,axis,mode,index);
  cells[cellName(r,c)]={value,style:structuredClone(cell.style||{})};
 }
 const key=axis==='row'?'rowHeights':'columnWidths';
 const shiftedDimensions={};
 for(const [k,v] of Object.entries(sheet[key]||{})){
  const old=Number(k);
  if(mode==='delete'&&old===index)continue;
  const next=mode==='insert'?old>=index?old+1:old:old>index?old-1:old;
  if(next>=limit)throw Error('Последняя строка или столбец имеет пользовательский размер');
  shiftedDimensions[next]=v;
 }
 const hiddenKey=axis==='row'?'hiddenRows':'hiddenColumns';
 const hidden={};for(const indexText of Object.keys(sheet[hiddenKey]||{})){
  const old=Number(indexText);
  if(mode==='delete'&&old===index)continue;
  const next=mode==='insert'&&old>=index?old+1:mode==='delete'&&old>index?old-1:old;
  if(next>=limit)throw Error('Последняя строка или столбец скрыта: сначала отобразите её');
  hidden[next]=true;
 }
 const freeze={...(sheet.freeze||{rows:0,cols:0})};
 const frozenKey=axis==='row'?'rows':'cols';
 if(mode==='insert'&&index<freeze[frozenKey])freeze[frozenKey]++;
 if(mode==='delete'&&index<freeze[frozenKey])freeze[frozenKey]--;
 if(freeze[frozenKey]>10)throw Error('Нельзя увеличить закреплённую область более 10 строк или столбцов');
 // Existing data and schema remain unchanged if even one step above failed.
 sheet.cells=cells;sheet[key]=shiftedDimensions;sheet[hiddenKey]=hidden;sheet.freeze=freeze;
 return {axis,mode,index,changed:Object.keys(cells).length};
}
