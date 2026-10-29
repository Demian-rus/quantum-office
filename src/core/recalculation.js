/** UI-local incremental workbook calculations. Never serialize a calculation cache.
 * Reconciliation is called ONLY after a successful workbook transaction.
 * A changed workbook object, sheet schema, clock day or unsafe batch forces a rebuild. */
import {dateSerial} from './dates.js';
import {formulaContext} from './workbook.js';
import {updateCalculationValue} from './formulas.js';

export const MAX_INCREMENTAL_CHANGES=512;
const upper=name=>name.toLocaleUpperCase('ru-RU');
const signatures=book=>book.sheets.map(s=>s.id+'\u0000'+s.name).join('\u0001');
const serialToday=clock=>{
 const now=clock();
 return dateSerial(now.getFullYear(),now.getMonth()+1,now.getDate());
};

export function createWorkbookRecalculator(clock=()=>new Date()){
 let current=null;
 const stats={created:0,reused:0,incremental:0,dirtyCells:0,invalidated:0,resets:0,unchanged:0};
 function reset(){
  current=null;
  stats.resets++;
 }
 function stillValid(book){
  return current && current.book===book &&
   current.signature===signatures(book) &&
   current.ctx.calculation.today===serialToday(clock);
 }
 function view(book,sheet){
  if(!book||!sheet)return null;
  if(!stillValid(book)){
   const ctx=formulaContext(book,sheet);
   // Use the same local-day boundary for memoization and TODAY calculations.
   ctx.calculation.today=serialToday(clock);
   current={book,signature:signatures(book),ctx};
   stats.created++;
  }else stats.reused++;
  const entry=current.ctx.sheets.get(upper(sheet.name));
  if(!entry)throw Error('Лист не найден в расчётном контексте');
  // The one shared session/cache is independent of the active sheet.
  return {raw:entry.cells,ctx:{...current.ctx,sheetName:sheet.name}};
 }
 /** Compare the pre-transaction workbook with its new authoritative state.
  * Style-only changes retain the session. Values changed in a bounded batch
  * invalidate reverse dependencies; large/structural edits discard the cache.
  * No result is copied from the calculation session into the workbook. */
 function reconcile(book,before){
  if(!current||current.book!==book)return {mode:'unused',changed:0};
  if(!before||before.id!==book.id||
     signatures(before)!==signatures(book)||!stillValid(book)){
   reset();return {mode:'reset',changed:0};
  }
  const changed=[];
  for(let i=0;i<book.sheets.length;i++){
   const past=before.sheets[i].cells,latest=book.sheets[i].cells,part=book.sheets[i];
   // Per-transaction scanning is bounded by the workbook's 50k-cell limit
   // and is amortized with the existing full-book Undo snapshot.
   const keys=new Set([...Object.keys(past),...Object.keys(latest)]);
   for(const ref of keys){
    const oldValue=past[ref]?.value??'',newValue=latest[ref]?.value??'';
    if(oldValue!==newValue){
     changed.push([part.name,ref,newValue]);
     if(changed.length>MAX_INCREMENTAL_CHANGES){
      reset();return {mode:'reset',changed:changed.length};
     }
    }
   }
  }
  if(!changed.length){stats.unchanged++;return {mode:'unchanged',changed:0};}
  if(!current.ctx.calculation.graphComplete){
   reset();return {mode:'reset',changed:changed.length};
  }
  try{
   let invalidated=0;
   for(const [name,ref,value] of changed)
    invalidated+=updateCalculationValue(current.ctx,name,ref,value);
   stats.incremental++;stats.dirtyCells+=changed.length;stats.invalidated+=invalidated;
   return {mode:'incremental',changed:changed.length,invalidated};
  }catch{
   // A failed or incomplete graph must never be used for future results.
   reset();return {mode:'reset',changed:changed.length};
  }
 }
 return {view,reconcile,reset,stats};
}
