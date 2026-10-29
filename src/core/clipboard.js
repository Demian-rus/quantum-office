/** In-app clipboard: preserves formulas, styles and complete merged regions.
 * All edits are prevalidated before mutating a sheet; no eval or network. */
import {rectangle,cellName,parseCell,getCell,translateFormula,LIMITS,valuesTSV,mergeAt,mergeCells,validRef,getEffectiveStyle} from './workbook.js';
import {rebaseMovedFormula} from './reference-move.js';

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
   const effective=getEffectiveStyle(sheet,cellName(rect.r1+r,rect.c1+c));
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

/** Cut paste is transactional. Dependent references are adjusted on staged
 * workbook data only after the entire move geometry has been validated. */
export function moveCells(book,sheet,target,cutClip){
 if(!book||!sheet||!cutClip||cutClip.mode!=='cut'||cutClip.bookId!==book.id||cutClip.sheetId!==sheet.id)
  throw Error('Вырезанный диапазон можно перенести только в исходный лист');
 if(sheet.autoFilter)throw Error('Выключите автофильтр перед перемещением диапазона');
 const origin=parseCell(cutClip.start),dest=parseCell(target);
 if(!origin||!dest||!validRef(target)||!Number.isInteger(cutClip.rows)||!Number.isInteger(cutClip.cols)||
    cutClip.rows<1||cutClip.cols<1||cutClip.rows*cutClip.cols>10000)
  throw Error('Повреждённый диапазон вырезания');
 const src={r1:origin.row,c1:origin.col,r2:origin.row+cutClip.rows-1,c2:origin.col+cutClip.cols-1};
 const dst={r1:dest.row,c1:dest.col,r2:dest.row+cutClip.rows-1,c2:dest.col+cutClip.cols-1};
 if(src.r2>=LIMITS.rows||src.c2>=LIMITS.columns||dst.r2>=LIMITS.rows||dst.c2>=LIMITS.columns)
  throw Error('Перемещение выходит за границы листа');
 // Verify that neither region includes invisible material, even if cut
 // metadata came from an earlier visible state.
 for(const row of new Set([...Array(cutClip.rows)].flatMap((_,i)=>[src.r1+i,dst.r1+i])))
  if(sheet.hiddenRows?.[row]||sheet.autoFilter?.hiddenRows?.[row])throw Error('Сначала отобразите скрытые строки');
 for(const col of new Set([...Array(cutClip.cols)].flatMap((_,i)=>[src.c1+i,dst.c1+i])))
  if(sheet.hiddenColumns?.[col])throw Error('Сначала отобразите скрытые столбцы');
 const live=copyCells(sheet,cutClip.start,cellName(src.r2,src.c2),book);
 if(JSON.stringify(live.cells)!==JSON.stringify(cutClip.cells)||JSON.stringify(live.merges)!==JSON.stringify(cutClip.merges))
  throw Error('Исходные ячейки изменились после вырезания. Вырежьте диапазон заново');
 if(src.r1===dst.r1&&src.c1===dst.c1)return {rows:cutClip.rows,cols:cutClip.cols,end:cellName(dst.r2,dst.c2),unchanged:true};
 const draft=structuredClone(sheet);
 const fullMerges=(sheet.merges||[]).filter(m=>inside(rectangle(m.from,m.to),src));
 draft.merges=(draft.merges||[]).filter(m=>!fullMerges.some(source=>source.from===m.from&&source.to===m.to));
 for(const m of draft.merges)if(overlaps(dst,rectangle(m.from,m.to)))
  throw Error('Место вставки пересекается с другим объединением');
 // Remove only individually stored entries, not the sparse sheet defaults.
 for(const ref of Object.keys(draft.cells)){
  const p=parseCell(ref);
  if(p.row>=src.r1&&p.row<=src.r2&&p.col>=src.c1&&p.col<=src.c2)delete draft.cells[ref];
 }
 // The captured visible formatting must move with values. Snapshot-first
 // staging also handles overlapping source/destination rectangles correctly.
 for(let r=0;r<cutClip.rows;r++)for(let c=0;c<cutClip.cols;c++){
  const item=cutClip.cells[r]?.[c];
  if(typeof item?.value!=='string'||!item.style||typeof item.style!=='object'||Array.isArray(item.style))
   throw Error('Повреждённые данные вырезания');
  const ref=cellName(dst.r1+r,dst.c1+c);
  if(item.value||Object.keys(item.style).length)draft.cells[ref]={value:item.value,style:structuredClone(item.style)};
  else delete draft.cells[ref];
 }
 for(const m of cutClip.merges||[])
  mergeCells(draft,cellName(dst.r1+m.r1,dst.c1+m.c1),cellName(dst.r1+m.r2,dst.c1+m.c2));
 const oldCount=Object.keys(sheet.cells).length,nextCount=Object.keys(draft.cells).length;
 const total=book.sheets.reduce((n,sh)=>n+Object.keys(sh.cells).length,0)-oldCount+nextCount;
 if(total>LIMITS.cells)throw Error('Превышен лимит заполненных ячеек (50 000)');
 // Stage dependent formulas on every sheet, including formulas physically
 // relocated within the moved source. A failed range rewrite never touches
 // another sheet, the source, or the target.
 const dr=dst.r1-src.r1,dc=dst.c1-src.c1,pending=[];
 for(const current of book.sheets){
  const cells=current===sheet?draft.cells:current.cells;
  for(const [ref,item] of Object.entries(cells)){
   if(!item.value?.startsWith('='))continue;
   const rewritten=rebaseMovedFormula(item.value,current.name,sheet.name,src,dr,dc);
   if(rewritten!==item.value)pending.push({current,ref,value:rewritten});
  }
 }
 // Commit only after every formula has been safely checked. There are no
 // external awaits between this point and completion of the transaction.
 sheet.cells=draft.cells;sheet.merges=draft.merges;
 for(const entry of pending){
  const destination=entry.current===sheet?sheet:entry.current;
  destination.cells[entry.ref].value=entry.value;
 }
 return {rows:cutClip.rows,cols:cutClip.cols,end:cellName(dst.r2,dst.c2)};
}
