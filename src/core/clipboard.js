/** In-app clipboard: the system clipboard can be unavailable for file:// previews.
 * Preserve raw formulas and cell styles without using eval or a web service. */
import {rectangle,cellName,parseCell,getCell,translateFormula,LIMITS,valuesTSV,mergeAt,mergeCells,validRef} from './workbook.js';

export function copyCells(sheet,start,end){
 let rect=rectangle(start,end);if(!rect||!validRef(start)||!validRef(end))throw Error('Недопустимый диапазон');
 if(start===end){const merged=mergeAt(sheet,start);if(merged)rect=rectangle(merged.from,merged.to);}
 const rows=rect.r2-rect.r1+1,cols=rect.c2-rect.c1+1;
 if(rows*cols>20000)throw Error('Копирование ограничено 20 000 ячейками');
 const merges=[];
 for(const merge of sheet.merges||[]){
  const m=rectangle(merge.from,merge.to);
  if(m.r1>rect.r2||m.r2<rect.r1||m.c1>rect.c2||m.c2<rect.c1)continue;
  if(m.r1<rect.r1||m.r2>rect.r2||m.c1<rect.c1||m.c2>rect.c2)throw Error('Объединённая ячейка попала в выделение частично. Выделите её целиком');
  merges.push({r1:m.r1-rect.r1,c1:m.c1-rect.c1,r2:m.r2-rect.r1,c2:m.c2-rect.c1});
 }
 return {start:cellName(rect.r1,rect.c1),rows,cols,text:valuesTSV(sheet,cellName(rect.r1,rect.c1),cellName(rect.r2,rect.c2)),merges,
  cells:Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>{
   const item=getCell(sheet,cellName(rect.r1+r,rect.c1+c));
   return {value:item.value,style:structuredClone(item.style||{})};
  }))};
}

export function pasteCells(sheet,target,clip){
 const at=parseCell(target),from=parseCell(clip?.start);
 if(!at||!from||!validRef(target)||!Number.isInteger(clip.rows)||!Number.isInteger(clip.cols)||!Array.isArray(clip.cells))throw Error('Повреждённые данные буфера');
 if(clip.rows<1||clip.cols<1||clip.rows*clip.cols>20000)throw Error('Слишком большой диапазон');
 if(at.row+clip.rows>LIMITS.rows||at.col+clip.cols>LIMITS.columns)throw Error('Вставка выходит за пределы листа');
 const t={r1:at.row,c1:at.col,r2:at.row+clip.rows-1,c2:at.col+clip.cols-1};
 for(const m of sheet.merges||[]){
  const x=rectangle(m.from,m.to);
  if(t.r1<=x.r2&&t.r2>=x.r1&&t.c1<=x.c2&&t.c2>=x.c1)throw Error('Вставка поверх объединённой ячейки запрещена. Сначала разъедините ячейки назначения');
 }
 const merges=clip.merges??[];
 if(!Array.isArray(merges)||merges.length>500)throw Error('Повреждённые данные объединений');
 const seen=new Set();
 for(const m of merges){
  if(!m||![m.r1,m.c1,m.r2,m.c2].every(Number.isInteger)||m.r1<0||m.c1<0||m.r2>=clip.rows||m.c2>=clip.cols||m.r1>m.r2||m.c1>m.c2||(m.r1===m.r2&&m.c1===m.c2))throw Error('Повреждённые данные объединений');
  for(let r=m.r1;r<=m.r2;r++)for(let c=m.c1;c<=m.c2;c++){const k=r+':'+c;if(seen.has(k))throw Error('Пересекающиеся объединения в буфере');seen.add(k);}
 }
 const changes=[];
 for(let r=0;r<clip.rows;r++){
  if(!Array.isArray(clip.cells[r])||clip.cells[r].length!==clip.cols)throw Error('Повреждённые данные буфера');
  for(let c=0;c<clip.cols;c++){
   const item=clip.cells[r][c];
   if(typeof item?.value!=='string'||item.value.length>50000||!item.style||typeof item.style!=='object'||Array.isArray(item.style))throw Error('Повреждённые данные буфера');
   const value=translateFormula(item.value,at.row-from.row,at.col-from.col);
   changes.push([cellName(at.row+r,at.col+c),{value,style:structuredClone(item.style)}]);
  }
 }
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
