/** In-app clipboard: preserves formulas, styles and complete merged regions.
 * All edits are prevalidated before mutating a sheet; no eval or network. */
import {rectangle,cellName,parseCell,getCell,translateFormula,LIMITS,valuesTSV,mergeAt,mergeCells,validRef} from './workbook.js';

const inside=(inner,outer)=>inner.r1>=outer.r1&&inner.r2<=outer.r2&&inner.c1>=outer.c1&&inner.c2<=outer.c2;
const overlaps=(a,b)=>a.r1<=b.r2&&a.r2>=b.r1&&a.c1<=b.c2&&a.c2>=b.c1;

export function copyCells(sheet,start,end,book=null){
 let rect=rectangle(start,end);if(!rect||!validRef(start)||!validRef(end))throw Error('Недопустимый диапазон');
 // Clicking one merged cell means copying the entire logical cell, as in a spreadsheet.
 if(start===end){const merged=mergeAt(sheet,start);if(merged)rect=rectangle(merged.from,merged.to);}
 const rows=rect.r2-rect.r1+1,cols=rect.c2-rect.c1+1;
 if(rows*cols>20000)throw Error('Копирование ограничено 20 000 ячейками');
 const merges=[];
 for(const merge of sheet.merges||[]){
  const region=rectangle(merge.from,merge.to);
  if(!overlaps(rect,region))continue;
  if(!inside(region,rect))throw Error('Объединённая ячейка попала в выделение частично. Выделите её целиком');
  merges.push({r1:region.r1-rect.r1,c1:region.c1-rect.c1,r2:region.r2-rect.r1,c2:region.c2-rect.c1});
 }
 const first=cellName(rect.r1,rect.c1),last=cellName(rect.r2,rect.c2);
 return {start:first,rows,cols,text:valuesTSV(sheet,first,last,book),merges,
  cells:Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>{
   const item=getCell(sheet,cellName(rect.r1+r,rect.c1+c));
   const effective={...(item.style||{})};
   if(sheet.defaultAlign&&!effective.align)effective.align=sheet.defaultAlign;
   return {value:item.value,style:structuredClone(effective)};
  }))};
}

export function pasteCells(sheet,target,clip){
 const at=parseCell(target),from=parseCell(clip?.start);
 if(!at||!from||!validRef(target)||!Number.isInteger(clip.rows)||!Number.isInteger(clip.cols)||!Array.isArray(clip.cells))throw Error('Повреждённые данные буфера');
 if(clip.rows<1||clip.cols<1||clip.rows*clip.cols>20000)throw Error('Слишком большой диапазон');
 if(at.row+clip.rows>LIMITS.rows||at.col+clip.cols>LIMITS.columns)throw Error('Вставка выходит за пределы листа');
 const targetRect={r1:at.row,c1:at.col,r2:at.row+clip.rows-1,c2:at.col+clip.cols-1};
 // Even a partial overwrite of an existing merge would corrupt its geometry.
 for(const m of sheet.merges||[])if(overlaps(targetRect,rectangle(m.from,m.to)))throw Error('Вставка поверх объединённой ячейки запрещена. Сначала разъедините ячейки назначения');
 const merges=clip.merges??[];
 if(!Array.isArray(merges)||merges.length>500)throw Error('Повреждённые данные объединений');
 const mergeCellsUsed=new Set();
 for(const m of merges){
  if(!m||![m.r1,m.c1,m.r2,m.c2].every(Number.isInteger)||m.r1<0||m.c1<0||m.r2>=clip.rows||m.c2>=clip.cols||m.r1>m.r2||m.c1>m.c2||(m.r1===m.r2&&m.c1===m.c2))throw Error('Повреждённые данные объединений');
  for(let r=m.r1;r<=m.r2;r++)for(let c=m.c1;c<=m.c2;c++){
   const key=`${r}:${c}`;if(mergeCellsUsed.has(key))throw Error('Пересекающиеся объединения в буфере');mergeCellsUsed.add(key);
  }
 }
 const changes=[];
 for(let r=0;r<clip.rows;r++){
  if(!Array.isArray(clip.cells[r])||clip.cells[r].length!==clip.cols)throw Error('Повреждённые данные буфера');
  for(let c=0;c<clip.cols;c++){
   const item=clip.cells[r][c];if(typeof item?.value!=='string'||item.value.length>50000||!item.style||typeof item.style!=='object'||Array.isArray(item.style))throw Error('Повреждённые данные буфера');
   const value=translateFormula(item.value,at.row-from.row,at.col-from.col);
   changes.push([cellName(at.row+r,at.col+c),{value,style:structuredClone(item.style)}]);
  }
 }
 // Apply all changes to a draft when copying merges. The merge validator checks
 // covered cells, frozen panes, hidden rows/columns and active auto-filters.
 if(merges.length){
  const trial=structuredClone(sheet);
  for(const [ref,item] of changes){if(item.value||Object.keys(item.style).length)trial.cells[ref]=item;else delete trial.cells[ref];}
  for(const m of merges)mergeCells(trial,cellName(at.row+m.r1,at.col+m.c1),cellName(at.row+m.r2,at.col+m.c2));
  sheet.cells=trial.cells;sheet.merges=trial.merges;
 }else{
  for(const [ref,item] of changes){if(item.value||Object.keys(item.style).length)sheet.cells[ref]=item;else delete sheet.cells[ref];}
 }
 return {rows:clip.rows,cols:clip.cols,end:cellName(at.row+clip.rows-1,at.col+clip.cols-1)};
}
