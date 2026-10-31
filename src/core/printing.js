import {rectangle,cellName,parseCell,LIMITS,columnWidth,rowHeight,rowVisible,columnVisible,getEffectiveStyle,displayedValue,rawMap,formulaContext} from './workbook.js';
/** Bounded, browser-native printing of spreadsheet ranges. No external renderer. */

const PRINT_DEFAULTS={paper:'A4',orientation:'portrait',scale:100,fitWidth:true,area:null};
const PRINT_PAPERS={A4:[794,1123],Letter:[816,1056]};
const PRINT_MAX_CELLS=12000,PRINT_MAX_PAGES=60;
const PRINT_COLOR=/^#[\da-fA-F]{6}$/;
const printEsc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
function printValidArea(area){
 if(area===null)return null;
 if(!area||typeof area!=='object'||Array.isArray(area)||Object.keys(area).sort().join(',')!=='from,to'||
    typeof area.from!=='string'||typeof area.to!=='string')throw Error('Повреждена область печати');
 const r=rectangle(area.from,area.to);
 if(!r||r.r1<0||r.c1<0||r.r2>=LIMITS.rows||r.c2>=LIMITS.columns||
    area.from!==cellName(r.r1,r.c1)||area.to!==cellName(r.r2,r.c2))
  throw Error('Неверные границы области печати');
 return r;
}
export function printSettings(sheet){return {...PRINT_DEFAULTS,...(sheet.printSettings||{})};}
export function validatePrintSettings(sheet){
 if(sheet.printSettings===undefined)return;
 const cfg=sheet.printSettings;
 if(!cfg||typeof cfg!=='object'||Array.isArray(cfg)||Object.keys(cfg).some(k=>!Object.hasOwn(PRINT_DEFAULTS,k))||
    !Object.hasOwn(PRINT_PAPERS,cfg.paper)||!['portrait','landscape'].includes(cfg.orientation)||
    ![60,75,90,100,125].includes(cfg.scale)||typeof cfg.fitWidth!=='boolean')
  throw Error('Повреждены параметры печати');
 printValidArea(cfg.area);
}
export function changePrintSettings(sheet,patch){
 if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(k=>!Object.hasOwn(PRINT_DEFAULTS,k)))
  throw Error('Неверные параметры печати');
 const next={...printSettings(sheet),...patch};
 validatePrintSettings({printSettings:next});
 sheet.printSettings=next;
 return next;
}
export function selectedPrintArea(first,last){
 const r=rectangle(first,last);
 if(!r||r.r1<0||r.c1<0||r.r2>=LIMITS.rows||r.c2>=LIMITS.columns)throw Error('Неверное выделение для печати');
 return {from:cellName(r.r1,r.c1),to:cellName(r.r2,r.c2)};
}
export function usedPrintArea(sheet){
 let r1=Infinity,c1=Infinity,r2=-1,c2=-1;
 for(const [ref,item] of Object.entries(sheet.cells||{})){
  if(!item?.value)continue;
  const p=parseCell(ref);if(!p||p.row>=LIMITS.rows||p.col>=LIMITS.columns)continue;
  r1=Math.min(r1,p.row);r2=Math.max(r2,p.row);c1=Math.min(c1,p.col);c2=Math.max(c2,p.col);
 }
 if(!Number.isFinite(r1))throw Error('На листе нет заполненных ячеек для печати');
 return {r1,r2,c1,c2};
}
function printGroupIndices(indices,sizeOf,maximum){
 const result=[];let current=[],used=0;
 for(const index of indices){
  const size=sizeOf(index);
  if(size>maximum)throw Error('Строка или столбец не помещается в страницу');
  if(current.length&&used+size>maximum){result.push(current);current=[];used=0;}
  current.push(index);used+=size;
 }
 if(current.length)result.push(current);
 return result;
}
const printColumnLabel=c=>cellName(0,c).replace(/\d+$/,'');
const printCellStyle=(sheet,ref)=>{
 const style=getEffectiveStyle(sheet,ref),output=[];
 if(PRINT_COLOR.test(style.bg||''))output.push('background:'+style.bg);
 if(PRINT_COLOR.test(style.color||''))output.push('color:'+style.color);
 if(style.bold)output.push('font-weight:700');
 if(style.italic)output.push('font-style:italic');
 if(['left','center','right'].includes(style.align))output.push('text-align:'+style.align);
 return output.join(';');
};
/** Deterministic page plan: one width/height group per printed page. */
export function planPrint(book,sheet,override=null){
 const cfg=override?{...printSettings(sheet),...override}:printSettings(sheet);
 validatePrintSettings({printSettings:cfg});
 const range=cfg.area?printValidArea(cfg.area):usedPrintArea(sheet);
 const count=(range.r2-range.r1+1)*(range.c2-range.c1+1);
 if(count>PRINT_MAX_CELLS)throw Error('Область печати больше 12 000 ячеек: выберите меньший диапазон');
 const rows=[],cols=[];
 for(let r=range.r1;r<=range.r2;r++)if(rowVisible(sheet,r))rows.push(r);
 for(let c=range.c1;c<=range.c2;c++)if(columnVisible(sheet,c))cols.push(c);
 if(!rows.length||!cols.length)throw Error('В области печати нет видимых ячеек');
 const [paperW,paperH]=cfg.orientation==='landscape'?[...PRINT_PAPERS[cfg.paper]].reverse():PRINT_PAPERS[cfg.paper];
 const availableW=paperW-96,availableH=paperH-155;
 const allWidth=cols.reduce((total,c)=>total+columnWidth(sheet,c),0);
 const userScale=cfg.scale/100;
 const scale=cfg.fitWidth?Math.min(userScale,Math.max(.45,(availableW-34)/allWidth)):userScale;
 const colGroups=printGroupIndices(cols,c=>Math.max(1,Math.ceil(columnWidth(sheet,c)*scale)),availableW-34);
 const rowGroups=printGroupIndices(rows,r=>Math.max(1,Math.ceil(rowHeight(sheet,r)*scale)),availableH-27);
 if(colGroups.length*rowGroups.length>PRINT_MAX_PAGES)
  throw Error('Для печати потребуется больше 60 страниц. Уменьшите область.');
 const raw=rawMap(sheet),context=formulaContext(book,sheet,raw),pages=[],merges=sheet.merges||[];
 const total=colGroups.length*rowGroups.length;let pageIndex=0;
 for(const rGroup of rowGroups)for(const cGroup of colGroups){
  pageIndex++;
  const includedRows=new Set(rGroup),includedCols=new Set(cGroup),covered=new Set(),anchors=new Map();
  for(const merge of merges){
   const bounds=rectangle(merge.from,merge.to);
   if(!bounds)continue;
   const selectedRows=rGroup.filter(r=>r>=bounds.r1&&r<=bounds.r2);
   const selectedCols=cGroup.filter(c=>c>=bounds.c1&&c<=bounds.c2);
   if(!selectedRows.length||!selectedCols.length)continue;
   if(selectedRows.length!==bounds.r2-bounds.r1+1||selectedCols.length!==bounds.c2-bounds.c1+1)
    throw Error('Объединение пересекает границу печатной страницы. Уменьшите масштаб или область печати.');
   const anchor=cellName(bounds.r1,bounds.c1);
   anchors.set(anchor,{rowspan:selectedRows.length,colspan:selectedCols.length});
   for(const r of selectedRows)for(const c of selectedCols)if(r!==bounds.r1||c!==bounds.c1)covered.add(cellName(r,c));
  }
  const headers=['<th class="print-corner">№</th>',...cGroup.map(c=>'<th>'+printColumnLabel(c)+'</th>')].join('');
  const lines=rGroup.map(r=>{
   let cells='<th scope="row" class="print-rowhead">'+(r+1)+'</th>';
   for(const c of cGroup){
    const ref=cellName(r,c);if(covered.has(ref))continue;
    const merged=anchors.get(ref),span=merged?' rowspan="'+merged.rowspan+'" colspan="'+merged.colspan+'"':'';
    const style=printCellStyle(sheet,ref),content=printEsc(displayedValue(sheet,ref,raw,context));
    cells+='<td'+span+' style="'+style+'">'+content+'</td>';
   }
   return '<tr style="height:'+Math.max(18,Math.round(rowHeight(sheet,r)*scale))+'px">'+cells+'</tr>';
  }).join('');
  const widths='<col style="width:34px">'+cGroup.map(c=>'<col style="width:'+Math.max(1,Math.round(columnWidth(sheet,c)*scale))+'px">').join('');
  pages.push({
   index:pageIndex,rows:[rGroup[0]+1,rGroup.at(-1)+1],cols:[printColumnLabel(cGroup[0]),printColumnLabel(cGroup.at(-1))],
   html:'<section class="print-page" style="--paper-width:'+paperW+'px;--paper-height:'+paperH+'px">'+
    '<header class="print-page-header"><strong>'+printEsc(book?.name||'Таблица')+'</strong><span>'+printEsc(sheet.name)+'</span></header>'+
    '<table class="print-table" style="font-size:'+Math.max(7,Math.round(11*scale))+'px"><colgroup>'+widths+'</colgroup><thead><tr>'+headers+'</tr></thead><tbody>'+lines+'</tbody></table>'+
    '<footer class="print-page-footer"><span>'+printColumnLabel(cGroup[0])+(rGroup[0]+1)+':'+printColumnLabel(cGroup.at(-1))+(rGroup.at(-1)+1)+'</span><span>Страница '+pageIndex+' из '+total+'</span></footer></section>'
  });
 }
 return {pages,paper:cfg.paper,orientation:cfg.orientation,scale,range:{from:cellName(range.r1,range.c1),to:cellName(range.r2,range.c2)},count};
}
export function printHTML(plan){return plan.pages.map(p=>p.html).join('');}

/** Shift saved print area with structural edits; reject destructive changes. */
export function shiftPrintArea(sheet,axis,mode,index,count){
 const config=sheet.printSettings;if(!config?.area)return config;
 const r=printValidArea(config.area),start=axis==='row'?r.r1:r.c1,end=axis==='row'?r.r2:r.c2;
 const last=index+count-1;let first=start,finish=end;
 if(mode==='insert'){
  if(index<=start){first+=count;finish+=count;}
  else if(index<=end)finish+=count;
 }else if(last<start){first-=count;finish-=count;}
 else if(index<=end&&last>=start){
  const overlap=Math.min(last,end)-Math.max(index,start)+1;
  if(overlap>=end-start+1)throw Error('Удаление уничтожит сохранённую область печати');
  first=index<=start?index:start;finish=end-overlap;
 }
 if(first<0||finish>=(axis==='row'?LIMITS.rows:LIMITS.columns))
  throw Error('Область печати выйдет за пределы листа');
 const area=axis==='row'?
  {from:cellName(first,r.c1),to:cellName(finish,r.c2)}:
  {from:cellName(r.r1,first),to:cellName(r.r2,finish)};
 const shifted={...config,area};validatePrintSettings({printSettings:shifted});return shifted;
}
