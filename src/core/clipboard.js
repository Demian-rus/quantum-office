/** In-app clipboard: the system clipboard can be unavailable for file:// previews.
 * Preserve raw formulas and cell styles without using eval or a web service. */
import {rectangle,cellName,parseCell,getCell,translateFormula,LIMITS,valuesTSV,mergeAt} from './workbook.js';

export function copyCells(sheet,start,end){
 const rect=rectangle(start,end);if(!rect)throw Error('Недопустимый диапазон');
 const rows=rect.r2-rect.r1+1,cols=rect.c2-rect.c1+1;
 if(rows*cols>20000)throw Error('Копирование ограничено 20 000 ячейками');
 return {start:cellName(rect.r1,rect.c1),rows,cols,text:valuesTSV(sheet,start,end),
  cells:Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>{
   const item=getCell(sheet,cellName(rect.r1+r,rect.c1+c));
   return {value:item.value,style:structuredClone(item.style||{})};
  }))};
}

export function pasteCells(sheet,target,clip){
 const at=parseCell(target),from=parseCell(clip?.start);
 if(!at||!from||!Number.isInteger(clip.rows)||!Number.isInteger(clip.cols)||!Array.isArray(clip.cells))throw Error('Повреждённые данные буфера');
 if(clip.rows<1||clip.cols<1||clip.rows*clip.cols>20000)throw Error('Слишком большой диапазон');
 if(at.row+clip.rows>LIMITS.rows||at.col+clip.cols>LIMITS.columns)throw Error('Вставка выходит за пределы листа');
 const changes=[];
 for(let r=0;r<clip.rows;r++){
  if(!Array.isArray(clip.cells[r])||clip.cells[r].length!==clip.cols)throw Error('Повреждённые данные буфера');
  for(let c=0;c<clip.cols;c++){
   const item=clip.cells[r][c];if(typeof item?.value!=='string'||item.value.length>50000||!item.style||typeof item.style!=='object'||Array.isArray(item.style))throw Error('Повреждённые данные буфера');
   const destination=cellName(at.row+r,at.col+c);if(mergeAt(sheet,destination))throw Error('Вставка в объединённый диапазон пока не поддерживается');
   const value=translateFormula(item.value,at.row-from.row,at.col-from.col);
   changes.push([cellName(at.row+r,at.col+c),{value,style:structuredClone(item.style)}]);
  }
 }
 for(const [ref,item] of changes){if(item.value||Object.keys(item.style).length)sheet.cells[ref]=item;else delete sheet.cells[ref];}
 return {rows:clip.rows,cols:clip.cols,end:cellName(at.row+clip.rows-1,at.col+clip.cols-1)};
}
