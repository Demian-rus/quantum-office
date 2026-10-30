import '../vendor/jszip.min.js';
import {newWorkbook,newSheet,setCell,setStyle,setColumnWidth,setRowHeight,columnWidth,rowHeight,setHidden,rowVisible,validateWorkbook,LIMITS,setFreeze,setAutoFilter,setFilterValue,filterRange,filterRowVisible,getEffectiveStyle,getColumnBaseStyle,rectangle,cellName,parseCell,mergeCells,applyBorderPreset,uid} from './workbook.js';
import {validateDataRules} from './validation.js';
/** Limited OOXML workbook exchange. All parsing is local; no eval or network. */


export const JSZip = globalThis.JSZip;
export const encoder=new TextEncoder();
export const xmlEscape=s=>String(s??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export const element=(parent,tag)=>Array.from(parent?.children||[]).find(n=>n.localName===tag)||null;
export const elements=(parent,tag)=>Array.from(parent?.children||[]).filter(n=>n.localName===tag);
export const text=(node,tag)=>element(node,tag)?.textContent||'';
export function parseXML(xml){if(typeof DOMParser==='undefined')throw Error('Для чтения XLSX требуется браузер с XML-парсером');const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('Некорректный XML в XLSX');return doc.documentElement;}
export function rgba(xml){const v=xml?.getAttribute('rgb');return v&&/^(?:[0-9A-F]{2})?[0-9A-F]{6}$/i.test(v)?'#'+v.slice(-6).toLowerCase():undefined;}
/** SpreadsheetML theme references index light/dark pairs in the opposite
 * order from the XML clrScheme element sequence. This also handles sysClr. */
const THEME_SLOTS=['lt1','dk1','lt2','dk2','accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink'];
const DEFAULT_THEME=['#ffffff','#000000','#eeece1','#1f497d','#4f81bd','#c0504d','#9bbb59','#8064a2','#4bacc6','#f79646','#0000ff','#800080'];
const INDEXED_DEFAULT='000000 FFFFFF FF0000 00FF00 0000FF FFFF00 FF00FF 00FFFF 000000 FFFFFF FF0000 00FF00 0000FF FFFF00 FF00FF 00FFFF 800000 008000 000080 808000 800080 008080 C0C0C0 808080 9999FF 993366 FFFFCC CCFFFF 660066 FF8080 0066CC CCCCFF 000080 FF00FF FFFF00 00FFFF 800080 800000 008080 0000FF 00CCFF CCFFFF CCFFCC FFFF99 99CCFF FF99CC CC99FF FFCC99 3366FF 33CCCC 99CC00 FFCC00 FF9900 FF6600 666699 969696 003366 339966 003300 333300 993300 993366 333399 333333'.split(' ').map(s=>'#'+s.toLowerCase());
const colorHex=v=>typeof v==='string'&&/^[0-9a-f]{6}$/i.test(v)?'#'+v.toLowerCase():undefined;
export function themeColorsFromXML(theme){
 const scheme=element(element(theme,'themeElements'),'clrScheme');
 if(!scheme)return DEFAULT_THEME;
 return THEME_SLOTS.map((key,i)=>{
  const item=element(scheme,key),node=element(item,'sysClr')||element(item,'srgbClr');
  return colorHex(node?.getAttribute('lastClr'))||colorHex(node?.getAttribute('val'))||DEFAULT_THEME[i];
 });
}
/** Excel applies tint to HLS lightness, not to each RGB channel. */
export function tintHex(hex,tint){
 if(!Number.isFinite(tint)||tint===0||tint<-1||tint>1)return hex;
 const v=[1,3,5].map(n=>parseInt(hex.slice(n,n+2),16)/255);
 const max=Math.max(...v),min=Math.min(...v),difference=max-min;
 let h=0,saturation=0,lightness=(max+min)/2;
 if(difference){
  saturation=difference/(1-Math.abs(2*lightness-1));
  switch(max){
   case v[0]:h=((v[1]-v[2])/difference)%6;break;
   case v[1]:h=(v[2]-v[0])/difference+2;break;
   default:h=(v[0]-v[1])/difference+4;
  }
  h=(h/6+1)%1;
 }
 lightness=tint<0?lightness*(1+tint):lightness*(1-tint)+tint;
 const chroma=(1-Math.abs(2*lightness-1))*saturation,extra=chroma*(1-Math.abs((h*6)%2-1)),base=lightness-chroma/2;
 const group=Math.floor(h*6)%6;
 const triples=[[chroma,extra,0],[extra,chroma,0],[0,chroma,extra],[0,extra,chroma],[extra,0,chroma],[chroma,0,extra]];
 return '#'+triples[group].map(n=>Math.max(0,Math.min(255,Math.round((n+base)*255))).toString(16).padStart(2,'0')).join('');
}
export function resolveXLSXColor(node,themes=DEFAULT_THEME,indexed=INDEXED_DEFAULT){
 if(!node)return undefined;
 let color=rgba(node);
 if(!color&&node.hasAttribute('theme')){
  const index=Number(node.getAttribute('theme'));
  if(Number.isInteger(index)&&index>=0&&index<THEME_SLOTS.length)color=themes[index];
 }
 if(!color&&node.hasAttribute('indexed')){
  const index=Number(node.getAttribute('indexed'));
  if(Number.isInteger(index)&&index>=0&&index<64)color=indexed[index];
 }
 if(!color)return undefined;
 const tint=Number(node.getAttribute('tint')||0);
 return tintHex(color,tint);
}
export function stylesFromXML(root,themes=DEFAULT_THEME){if(!root)return [{}];
 const custom=elements(element(element(root,'colors'),'indexedColors'),'rgbColor').map(node=>rgba(node));
 const indexed=custom.length>=64?custom:INDEXED_DEFAULT;
 const color=node=>resolveXLSXColor(node,themes,indexed);const fonts=elements(element(root,'fonts'),'font').map(node=>{
 const fontSize=Number(element(node,'sz')?.getAttribute('val'));
 return {bold:!!element(node,'b'),italic:!!element(node,'i'),color:color(element(node,'color')),fontSize:Number.isFinite(fontSize)&&fontSize>=6&&fontSize<=72?fontSize:undefined};
});const fills=elements(element(root,'fills'),'fill').map(node=>{const p=element(node,'patternFill');return p?.getAttribute('patternType')==='solid'?color(element(p,'fgColor')):undefined;});const nums=new Map(elements(element(root,'numFmts'),'numFmt').map(n=>[+n.getAttribute('numFmtId'),n.getAttribute('formatCode')||'']));
 const borders=elements(element(root,'borders'),'border').map(node=>{
 const edges=Object.fromEntries(['left','right','top','bottom'].flatMap(side=>{
  const child=element(node,side),line=child?.getAttribute('style');
  if(!line)return [];
  const tint=color(element(child,'color'));
  return [[side,tint?{line,color:tint}:{line}]];
 }));
 const sides=Object.fromEntries(Object.keys(edges).map(side=>[side,true]));
 const colors=Object.values(edges).map(x=>x.color||'#000000');
 return {sides,edges,color:colors.length&&new Set(colors).size===1?colors[0]:undefined};
});
 return elements(element(root,'cellXfs'),'xf').map(xf=>{const font=fonts[+xf.getAttribute('fontId')]||{},bg=fills[+xf.getAttribute('fillId')],align=element(xf,'alignment')?.getAttribute('horizontal');const id=+xf.getAttribute('numFmtId');const fmt=nums.get(id)||'';const style={};if(font.bold)style.bold=true;if(font.italic)style.italic=true;if(font.color)style.color=font.color;if(font.fontSize)style.fontSize=font.fontSize;if(bg)style.bg=bg;const border=borders[Number(xf.getAttribute('borderId')||0)]||{};if(Object.keys(border.sides||{}).length){style.borders=border.sides;style.borderEdges=border.edges;if(border.color)style.borderColor=border.color;}if(element(xf,'alignment')?.getAttribute('wrapText')==='1')style.wrap=true;if(['left','right','center'].includes(align))style.align=align;if(id===46||/\[(?:hh?|mm?)\]/i.test(fmt))style.format='duration';
 else if(id===22||(/[yd]/i.test(fmt)&&/[hs]/i.test(fmt)))style.format='datetime';
 else if([14,15,16,17].includes(id)||/[yd]/i.test(fmt))style.format='date';
 else if([18,19,20,21,45,47].includes(id)||/[hs]/i.test(fmt))style.format='time';
 else if([9,10].includes(id)||/%/.test(fmt))style.format='percent';else if([5,6,7,8,44].includes(id)||/[₽€$£]/.test(fmt))style.format='currency';else if([1,3].includes(id)||fmt==='0')style.format='integer';return style;});}
export function safeName(name){return String(name||'Лист').replace(/[\\/\[\]*?:]/g,'_').slice(0,31)||'Лист';}
export const base='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
export const relNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const pkgNS='http://schemas.openxmlformats.org/package/2006/relationships';
/** OOXML requires styled blank cells for arbitrary rectangles. Expand only up
 * to this hard limit, then refuse before creating any output. */
export const MAX_XLSX_RECTANGLE_CELLS=200000;
const styleProps=['bg','color','bold','italic','wrap','format','align','fontSize'];
function rectangleBands(sheet,styles){
 const rects=(sheet.rectangleStyles||[]).map(layer=>rectangle(layer.from,layer.to));
 if(!rects.length)return [];
 const edges=[...new Set(rects.flatMap(r=>[r.r1,r.r2+1]))].sort((a,b)=>a-b),bands=[];
 for(let i=0;i<edges.length-1;i++){
  const first=edges[i],last=edges[i+1]-1,active=rects.filter(r=>r.r1<=first&&r.r2>=first);
  if(!active.length)continue;
  for(let col=0;col<LIMITS.columns;col++){
   if(!active.some(r=>r.c1<=col&&r.c2>=col))continue;
   bands.push({first,last,col,id:styles.register(getEffectiveStyle(sheet,cellName(first,col),false))});
  }
 }
 return bands;
}
function restoreSparseXLSXStyles(sheet,runs,styles){
 const layers=[];
 for(const run of runs)for(const prop of styleProps){
  let start=-1,lastValue;
  const flush=(end)=>{if(start<0)return;
   layers.push({from:cellName(run.first,start),to:cellName(run.last,end),style:{[prop]:lastValue}});start=-1;
  };
  for(let col=run.c1;col<=run.c2+1;col++){
   const expected=col<=run.c2?styles[run.id]?.[prop]:undefined;
   const base=col<=run.c2?getColumnBaseStyle(sheet,col)[prop]:undefined;
   const next=col<=run.c2&&expected!==base?(expected===undefined?null:expected):undefined;
   if(start>=0&&(col>run.c2||next!==lastValue||next===undefined))flush(col-1);
   if(next!==undefined&&start<0){start=col;lastValue=next;}
  }
 }
 if(layers.length>256)throw Error('Слишком много разрозненных областей оформления в XLSX (максимум 256). Импорт отменён.');
 sheet.rectangleStyles=layers;
}

export function zipPath(target){const path=String(target||'').replace(/^\//,'').replace(/^xl\//,'');const pieces=path.split('/');if(!path||pieces.some(p=>p==='..'||p==='.'||!p))throw Error('Небезопасный путь в XLSX');return 'xl/'+path;}
export function required(zip,path){const file=zip.file(path);if(!file)throw Error('В XLSX отсутствует '+path);return file;}
export async function readXML(zip,path){const f=required(zip,path);if((f._data?.uncompressedSize||0)>10_000_000)throw Error('Слишком большой XML внутри XLSX');return parseXML(await f.async('string'));}
/** Reading supports shared and inline strings, numeric values and formulas. Unsupported parts are deliberately not retained. */
export async function importXLSX(data,filename='Таблица',report=null){
 if((data?.byteLength??data?.size??0)>15_000_000)throw Error('XLSX больше 15 МБ не поддерживается');
 const zip=await JSZip.loadAsync(data,{checkCRC32:true,createFolders:false});
 const all=Object.values(zip.files).filter(f=>!f.dir);if(all.length>500||all.reduce((n,f)=>n+(f._data?.uncompressedSize||0),0)>30_000_000)throw Error('Слишком большой или подозрительный XLSX');
 const wbXML=await readXML(zip,'xl/workbook.xml');if(['1','true'].includes(element(wbXML,'workbookPr')?.getAttribute('date1904')))throw Error('XLSX с системой дат 1904 пока не поддерживается: импорт отменён, чтобы не сместить даты');const relationships=await readXML(zip,'xl/_rels/workbook.xml.rels');
 const rels=new Map(elements(relationships,'Relationship').map(n=>[n.getAttribute('Id'),n]));
 const sheets=elements(element(wbXML,'sheets'),'sheet');if(!sheets.length||sheets.length>LIMITS.sheets)throw Error('Недопустимое количество листов');
 const shared=[];if(zip.file('xl/sharedStrings.xml')){const sharedDoc=await readXML(zip,'xl/sharedStrings.xml');for(const si of elements(sharedDoc,'si')){shared.push(Array.from(si.getElementsByTagNameNS('*','t')).map(t=>t.textContent).join(''));if(shared.length>LIMITS.cells)throw Error('Слишком много общих строк');}}
 const themeRel=[...rels.values()].find(r=>r.getAttribute('Type')?.endsWith('/theme')&&r.getAttribute('TargetMode')!=='External');
 const themePath=themeRel?zipPath(themeRel.getAttribute('Target')):'xl/theme/theme1.xml';
 const theme=zip.file(themePath)?themeColorsFromXML(await readXML(zip,themePath)):DEFAULT_THEME;
 const fmt=zip.file('xl/styles.xml')?stylesFromXML(await readXML(zip,'xl/styles.xml'),theme):[{}];
 const book=newWorkbook(filename.replace(/\.xlsx$/i,''));book.sheets=[];let count=0;
 for(const sh of sheets){const rid=sh.getAttributeNS(relNS,'id')||sh.getAttribute('r:id');const rel=rels.get(rid);if(!rel||rel.getAttribute('TargetMode')==='External')throw Error('Нет локального листа в XLSX');
  const path=zipPath(rel.getAttribute('Target'));const xml=await readXML(zip,path);const sheet=newSheet(sh.getAttribute('name')||'Лист');
   // Excel row heights are points. Excel column widths are character counts;
   // the 7px character / 5px padding conversion matches Calibri 11 approx.
   // Per-sheet defaults avoid substituting Quantum's wider 116px columns.
   const defaults=element(xml,'sheetFormatPr');
   const defaultCol=Number(defaults?.getAttribute('defaultColWidth')||defaults?.getAttribute('baseColWidth')||0);
   const defaultRow=Number(defaults?.getAttribute('defaultRowHeight')||0);
   if(defaultCol>0){const px=Math.round(defaultCol*7+5);if(px>=12&&px<=520)sheet.defaultColumnWidth=px;}
   if(defaultRow>0){const px=Math.round(defaultRow*4/3);if(px>=12&&px<=160)sheet.defaultRowHeight=px;}
   const pane=element(element(xml,'sheetViews')?.getElementsByTagNameNS('*','sheetView')?.[0]||null,'pane');
   if(pane?.getAttribute('state')==='frozen'){
    const rows=Number(pane.getAttribute('ySplit')||0),cols=Number(pane.getAttribute('xSplit')||0);
    if(Number.isInteger(rows)&&Number.isInteger(cols)&&rows<=10&&cols<=10&&rows>=0&&cols>=0)setFreeze(sheet,rows,cols);
   }
   const auto=element(xml,'autoFilter');if(auto){const range=auto.getAttribute('ref')?.split(':');if(range?.length===2){try{setAutoFilter(sheet,range[0],range[1]);const rect=filterRange(sheet);for(const col of elements(auto,'filterColumn')){
    const index=rect.c1+Number(col.getAttribute('colId'));
    const opts=elements(element(col,'filters'),'filter');if(opts.length>=1&&opts.length<=200)setFilterValue(sheet,index,opts.length===1?(opts[0].getAttribute('val')||''):opts.map(n=>n.getAttribute('val')||''));
   }}catch{sheet.autoFilter=null;}}}
  const alignedColumns=new Map();
  for(const col of elements(element(xml,'cols'),'col')){
   const min=Number(col.getAttribute('min')),max=Number(col.getAttribute('max')),width=Number(col.getAttribute('width'));
   if(!Number.isInteger(min)||!Number.isInteger(max)||min<1||max>LIMITS.columns||max<min)continue;
   const columnStyleIndex=Number(col.getAttribute('style'));
   const columnAlign=col.hasAttribute('style')?fmt[columnStyleIndex]?.align:undefined;
   if(columnAlign)for(let c=min-1;c<max;c++)alignedColumns.set(c,columnAlign);
   if(col.hasAttribute('style')&&fmt[columnStyleIndex]){
    // XLSX may apply borders to a column without storing styled blank cells.
    const allowed=new Set(['bg','color','bold','italic','wrap','format','align','fontSize','borders','borderColor']);
    const loaded=Object.fromEntries(Object.entries(fmt[columnStyleIndex]).filter(([k])=>allowed.has(k)));
    for(let c=min-1;c<max;c++)if(Object.keys(loaded).length)sheet.columnStyles[String(c)]=loaded;
   }
   const px=Math.round(width*7+5);if(Number.isFinite(width)&&width>0&&px>=12&&px<=520)for(let c=min-1;c<max;c++)sheet.columnWidths[String(c)]=px;
   if(col.getAttribute('hidden')==='1')for(let c=min-1;c<max;c++)setHidden(sheet,'col',c,true);
  }
  if(alignedColumns.size===LIMITS.columns&&new Set(alignedColumns.values()).size===1){
   sheet.defaultAlign=alignedColumns.get(0);
   for(const v of Object.values(sheet.columnStyles))delete v.align;
  }
  const importedRows=elements(element(xml,'sheetData'),'row');
  const xmlCells=element(xml,'sheetData')?.getElementsByTagNameNS('*','c').length||0;
  if(xmlCells>MAX_XLSX_RECTANGLE_CELLS+LIMITS.cells)throw Error('XLSX содержит слишком много оформленных ячеек для безопасного импорта');
  // A short s="0" rectangle can be just as significant as a huge one:
  // it explicitly removes an inherited Excel column fill. Recover the mask
  // as a sparse layer rather than dropping it on small-workbook import.
  const needsMask=xmlCells<=LIMITS.cells&&Object.keys(sheet.columnStyles||{}).length>0&&
   Array.from(element(xml,'sheetData')?.getElementsByTagNameNS('*','c')||[])
    .some(c=>c.getAttribute('s')==='0'&&c.children.length===0);
  const compact=xmlCells>LIMITS.cells||needsMask;
  for(const row of importedRows){
   const index=Number(row.getAttribute('r')),ht=Number(row.getAttribute('ht'));
   if(row.hasAttribute('customHeight')&&Number.isInteger(index)&&index>=1&&index<=LIMITS.rows&&Number.isFinite(ht)&&ht>0){const px=Math.round(ht*4/3);if(px>=12&&px<=160)sheet.rowHeights[String(index-1)]=px;}
   if(row.hasAttribute('s')&&row.getAttribute('customFormat')!=='0'&&Number.isInteger(index)&&index>=1&&index<=LIMITS.rows){
    const id=Number(row.getAttribute('s')),style=fmt[id];
    if(!Number.isInteger(id)||!style)throw Error('Повреждён стиль строки XLSX');
    if(Object.keys(style).length)sheet.rowStyles[String(index-1)]=style;
   }
  }
  const completed=[],active=new Map();let previousRow=0;
  for(const row of importedRows){
   const rowIndex=Number(row.getAttribute('r')),candidates=[];
   if(compact&&(!Number.isInteger(rowIndex)||rowIndex<1||rowIndex>LIMITS.rows||rowIndex<=previousRow))
    throw Error('XLSX содержит некорректный порядок строк');
   for(const c of elements(row,'c')){
    const ref=c.getAttribute('r')||'';if(!/^([A-Z]+)([1-9]\d*)$/i.test(ref))continue;
    const p=parseCell(ref);if(!p||p.row>=LIMITS.rows||p.col>=LIMITS.columns)continue;
    const type=c.getAttribute('t'),value=text(c,'v'),formula=element(c,'f');let raw='';
    if(type==='d')throw Error('Неподдерживаемый ISO тип даты в XLSX: импорт отменён без потери данных');
    if(formula){if(formula.getAttribute('t')==='shared'&&!formula.textContent)throw Error('Неподдерживаемая общая формула в '+ref);raw='='+formula.textContent;}
    else if(type==='inlineStr')raw=Array.from(element(c,'is')?.getElementsByTagNameNS('*','t')||[]).map(n=>n.textContent).join('');
    else if(type==='s'){const index=+value;if(!Number.isInteger(index)||index<0||index>=shared.length)throw Error('Повреждённая общая строка');raw=shared[index];}
    else if(type==='b')raw=value==='1'?'TRUE':'FALSE';
    else if(type==='e')raw=value;
    else raw=value;
    const id=Number(c.getAttribute('s')||0),style=fmt[id]||{};
    // An explicit XLSX cell style replaces inherited row/column borders.
    const inherited=getEffectiveStyle(sheet,ref,false);
    const borderMask=c.hasAttribute('s')&&!style.borders&&inherited.borders;
    const actualStyle=borderMask?{...style,borders:{}}:style;
    if(!compact||raw){
     if(++count>LIMITS.cells)throw Error('Слишком много ячеек в XLSX');
     if(raw)setCell(sheet,ref,raw);
     if(Object.keys(actualStyle).length)setStyle(sheet,ref,actualStyle);
    }else if(Object.keys(style.borders||{}).length||style.border)
     throw Error('Большие XLSX-области с границами пустых ячеек пока не поддерживаются: импорт отменён');
    else if(borderMask){
     if(xmlCells>LIMITS.cells)throw Error('Большой XLSX содержит перекрытие границ столбцов: сохранение без потерь невозможно');
     if(++count>LIMITS.cells)throw Error('Слишком много ячеек в XLSX');
     setStyle(sheet,ref,{borders:{}});
    }
    if(compact&&c.hasAttribute('s'))candidates.push({col:p.col,id});
   }
   if(compact){
    candidates.sort((a,b)=>a.col-b.col);
    const runs=[];let group=null;
    for(const item of candidates){
     if(group&&item.col===group.c2+1&&item.id===group.id)group.c2=item.col;
     else{if(group)runs.push(group);group={c1:item.col,c2:item.col,id:item.id};}
    }
    if(group)runs.push(group);
    const next=new Map();
    for(const run of runs){
     const key=run.c1+':'+run.c2+':'+run.id,old=active.get(key);
     if(old&&old.last===rowIndex-2){old.last=rowIndex-1;next.set(key,old);}
     else next.set(key,{first:rowIndex-1,last:rowIndex-1,...run});
    }
    for(const [key,old] of active)if(!next.has(key))completed.push(old);
    active.clear();for(const [key,run] of next)active.set(key,run);
    previousRow=rowIndex;
   }
  }
  if(compact){completed.push(...active.values());restoreSparseXLSXStyles(sheet,completed,fmt);}
  for(const row of importedRows){
   const index=Number(row.getAttribute('r'));
   if(row.getAttribute('hidden')==='1'&&Number.isInteger(index)&&index>=1&&index<=LIMITS.rows&&filterRowVisible(sheet,index-1))setHidden(sheet,'row',index-1,true);
  }
  const merges=elements(element(xml,'mergeCells'),'mergeCell');
  if(merges.length>500)throw Error('Слишком много объединённых диапазонов');
  for(const merged of merges){const pieces=String(merged.getAttribute('ref')||'').toUpperCase().split(':');if(pieces.length!==2)throw Error('Повреждённый диапазон объединения');mergeCells(sheet,pieces[0],pieces[1]);}
  importXLSXValidations(sheet,xml,report);
  book.sheets.push(sheet);
 }
 book.activeSheetId=book.sheets[0].id;return validateWorkbook(book);
}

/** TASK054 supported OOXML data validation: literal lists and decimal intervals. */
export function xlsxDataValidations(sheet){
 const rules=sheet.validations||[];
 if(!rules.length)return '';
 const xml=rules.map(rule=>{
  const range=rule.from===rule.to?rule.from:rule.from+':'+rule.to;
  if(rule.kind==='list'){
   const items=rule.options.join(',');
   if(rule.options.some(v=>/[,"\r\n]/.test(v))||items.length+2>255)
    throw Error('Этот выпадающий список XLSX нельзя экспортировать без изменения вариантов. Сохраните .qbook.');
   return '<dataValidation type="list" showDropDown="0" allowBlank="1" errorStyle="stop" showErrorMessage="1" sqref="'+xmlEscape(range)+'"><formula1>'+xmlEscape('"'+items+'"')+'</formula1></dataValidation>';
  }
  if(rule.kind==='number')
   return '<dataValidation type="decimal" operator="between" allowBlank="1" errorStyle="stop" showErrorMessage="1" sqref="'+xmlEscape(range)+'"><formula1>'+xmlEscape(rule.min)+'</formula1><formula2>'+xmlEscape(rule.max)+'</formula2></dataValidation>';
  throw Error('Неизвестное правило проверки данных в XLSX');
 });
 return '<dataValidations count="'+xml.length+'">'+xml.join('')+'</dataValidations>';
}
export function importXLSXValidations(sheet,root,report=null){
 const nodes=elements(element(root,'dataValidations'),'dataValidation');
 let imported=0,skipped=0;
 for(const node of nodes){
  const kind=node.getAttribute('type'),op=node.getAttribute('operator'),
   f1=text(node,'formula1'),f2=text(node,'formula2');
  const refs=String(node.getAttribute('sqref')||'').trim().split(/\s+/);
  let rule=null;
  if(kind==='list'&&/^"[^"]*"$/.test(f1)){
   const options=f1.slice(1,-1).split(',');
   if(options.length>=2&&options.length<=30&&new Set(options).size===options.length&&
    options.every(v=>v&&v.length<=100&&v===v.trim()&&!v.startsWith('=')&&!/[\r\n;]/.test(v)))
    rule={kind:'list',options};
  }else if(kind==='decimal'&&(!op||op==='between')&&
    /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(f1.trim())&&
    /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(f2.trim())){
   const min=Number(f1),max=Number(f2);
   if(Number.isFinite(min)&&Number.isFinite(max)&&min<=max)rule={kind:'number',min,max};
  }
  if(!rule||refs.length>32){skipped++;continue;}
  const draft=structuredClone(sheet.validations||[]);
  let supported=true;
  for(const range of refs){
   const words=range.replaceAll('$','').toUpperCase().split(':');
   if(words.length>2){supported=false;break;}
   const r=rectangle(words[0],words[1]||words[0]);
   if(!r){supported=false;break;}
   draft.push({id:uid(),from:cellName(r.r1,r.c1),to:cellName(r.r2,r.c2),...rule});
   try{validateDataRules({...sheet,validations:draft});}catch{supported=false;break;}
  }
  if(!supported){skipped++;continue;}
  sheet.validations=draft;imported+=refs.length;
 }
 if(report&&typeof report==='object'){
  report.importedDataValidations=(report.importedDataValidations||0)+imported;
  report.skippedDataValidations=(report.skippedDataValidations||0)+skipped;
 }
 return {imported,skipped};
}

export function styleCatalog(book){
 const unique=[{}],lookup=new Map([['{}',0]]);
 const keyOf=s=>JSON.stringify(Object.keys(s||{}).sort().reduce((x,k)=>(x[k]=s[k],x),{}));
 const register=s=>{const key=keyOf(s);if(!lookup.has(key)){lookup.set(key,unique.length);unique.push(s);}return lookup.get(key);};
 for(const sheet of book.sheets){
  for(let c=0;c<LIMITS.columns;c++)register(getColumnBaseStyle(sheet,c));
  for(const rowStyle of Object.values(sheet.rowStyles||{}))register(rowStyle);
  for(const ref of Object.keys(sheet.cells))register(getEffectiveStyle(sheet,ref));
 }
 return {unique,lookup,register,getId:s=>lookup.get(keyOf(s))||0};
}
export function styleXML(styles){const fonts=[{bold:false,italic:false}],fills=[null,null],fontIds=new Map(),fillIds=new Map(),borderDefs=[{}],borderIds=new Map([[JSON.stringify([null,null,null,null]),0]]);const cells=styles.unique.map(s=>{
 const fontKey=JSON.stringify([!!s.bold,!!s.italic,s.color||'',s.fontSize||11]);let fi=fontIds.get(fontKey);if(fi===undefined){fi=fonts.length;fonts.push(s);fontIds.set(fontKey,fi);}
 let fillId=0;if(s.bg){if(!fillIds.has(s.bg)){fillIds.set(s.bg,fills.length);fills.push(s.bg);}fillId=fillIds.get(s.bg);}
 const sides=s.borders||(s.border==='thin'?{left:true,right:true,top:true,bottom:true}:{});
 const perSide={};
 for(const side of ['left','right','top','bottom'])if(sides[side]){
  const info=s.borderEdges?.[side],line=info?.line||'thin',color=info?.color||s.borderColor;
  perSide[side]=color?{line,color}:{line};
 }
 const key=JSON.stringify(['left','right','top','bottom'].map(side=>perSide[side]||null));
 if(!borderIds.has(key)){borderIds.set(key,borderDefs.length);borderDefs.push({edges:perSide});}
 return {fi,fillId,format:s.format==='date'?14:s.format==='time'?20:s.format==='datetime'?22:s.format==='duration'?46:s.format==='percent'?10:s.format==='currency'?44:s.format==='integer'?1:0,align:s.align,wrap:!!s.wrap,border:borderIds.get(key)};});
 let xml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${base}"><fonts count="${fonts.length}">${fonts.map(f=>`<font><sz val="${f.fontSize||11}"/><name val="Aptos"/>${f.bold?'<b/>':''}${f.italic?'<i/>':''}${f.color?`<color rgb="FF${f.color.slice(1).toUpperCase()}"/>`:''}</font>`).join('')}</fonts><fills count="${fills.length}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills.slice(2).map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c.slice(1).toUpperCase()}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills>${`<borders count="${borderDefs.length}">${borderDefs.map(b=>`<border>${['left','right','top','bottom'].map(edge=>{const part=b.edges?.[edge];return part?(part.color?`<${edge} style="${part.line}"><color rgb="FF${part.color.slice(1).toUpperCase()}"/></${edge}>`:`<${edge} style="${part.line}"/>`):`<${edge}/>`;}).join('')}<diagonal/></border>`).join('')}</borders>`}<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${cells.length}">${cells.map(c=>`<xf numFmtId="${c.format}" fontId="${c.fi}" fillId="${c.fillId}" borderId="${c.border}" xfId="0"${c.align||c.wrap?' applyAlignment="1"':''}>${c.align||c.wrap?`<alignment${c.align?` horizontal="${c.align}"`: ''}${c.wrap?' wrapText="1"':''}/>`:''}</xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;return xml;
}
export async function exportXLSX(book){validateWorkbook(book);
 const area=book.sheets.reduce((n,s)=>n+(s.rectangleStyles||[]).reduce((v,l)=>{
  const r=rectangle(l.from,l.to);return v+(r.r2-r.r1+1)*(r.c2-r.c1+1);
 },0),0);
 if(area>MAX_XLSX_RECTANGLE_CELLS)
  throw Error('Оформленные прямоугольники превышают безопасный лимит XLSX (200 000 ячеек). Сохраните .qbook: экспорт отменён без потери оформления.');
 const zip=new JSZip();const styles=styleCatalog(book);
 const sheetTypes=[];const usedSheetNames=new Set();const sheets=book.sheets.map((s,i)=>{
  const sheetName=safeName(s.name);if(usedSheetNames.has(sheetName.toLowerCase()))throw Error('Повторяющиеся названия листов после сокращения до 31 символа');usedSheetNames.add(sheetName.toLowerCase());
  const bands=rectangleBands(s,styles);
  let byRows=new Map();for(const [ref,c] of Object.entries(s.cells)){const match=/^([A-Z]+)(\d+)$/.exec(ref);if(!match)continue;const row=+match[2];if(!byRows.has(row))byRows.set(row,[]);
   const effectiveStyle=getEffectiveStyle(s,ref);
   const styleID=styles.getId(effectiveStyle),pos=parseCell(ref);
   const covered=(s.rectangleStyles||[]).some(l=>{
    const r=rectangle(l.from,l.to);return pos.row>=r.r1&&pos.row<=r.r2&&pos.col>=r.c1&&pos.col<=r.c2;
   });
   const styleAttr=styleID||covered?` s="${styleID}"`:'';const v=String(c.value??'');let tag='';
   if(v.startsWith('='))tag=`<c r="${ref}"${styleAttr}><f>${xmlEscape(v.slice(1))}</f></c>`;
   else if(v!==''&&/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(v)&&Number.isFinite(Number(v))&&(['date','time','datetime','duration'].includes(effectiveStyle.format)||v.replace(/[^\d]/g,'').replace(/^0+/,'').length<=15))tag=`<c r="${ref}"${styleAttr}><v>${xmlEscape(['date','time','datetime','duration'].includes(effectiveStyle.format)?String(Number(Number(v).toPrecision(15))):v)}</v></c>`;
   else if(v!=='' )tag=`<c r="${ref}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`;
   else if(styleID||covered)tag=`<c r="${ref}"${styleAttr}/>`;
   if(tag)byRows.get(row).push([ref,tag]);
  }
  // Styled blanks must exist in Excel XML; native Quantum stores only the
  // rectangle specification. Explicit value cells are already emitted above.
  for(const band of bands)for(let row=band.first;row<=band.last;row++){
   const ref=cellName(row,band.col);if(Object.hasOwn(s.cells,ref))continue;
   const number=row+1;if(!byRows.has(number))byRows.set(number,[]);
   byRows.get(number).push([ref,`<c r="${ref}" s="${band.id}"/>`]);
  }
  const colIndexes=new Set([...Object.keys(s.columnWidths||{}),...Object.keys(s.hiddenColumns||{}),
    ...(s.defaultAlign||Object.keys(s.defaultStyle||{}).length||Object.keys(s.columnStyles||{}).length
       ?Array.from({length:LIMITS.columns},(_,i)=>String(i)):[])]);
  const cols=[...colIndexes].sort((a,b)=>+a-+b).map(index=>{
   const pixels=s.columnWidths?.[index],style=getColumnBaseStyle(s,+index);
   const id=styles.getId(style);
   return '<col min="'+(+index+1)+'" max="'+(+index+1)+'"'+
     (pixels?' width="'+((pixels-5)/7).toFixed(2)+'" customWidth="1"':'')+
     (s.hiddenColumns?.[index]?' hidden="1"':'')+
     (id?' style="'+id+'"':'')+'/>';
  }).join('');
  const filter=filterRange(s),freeze=s.freeze||{rows:0,cols:0};
  const view=freeze.rows||freeze.cols?`<sheetViews><sheetView workbookViewId="0"><pane${freeze.cols?` xSplit="${freeze.cols}"`:''}${freeze.rows?` ySplit="${freeze.rows}"`:''} topLeftCell="${cellName(freeze.rows,freeze.cols)}" state="frozen"/></sheetView></sheetViews>`:'';
  const merges=s.merges?.length?`<mergeCells count="${s.merges.length}">${s.merges.map(m=>`<mergeCell ref="${xmlEscape(m.from)}:${xmlEscape(m.to)}"/>`).join('')}</mergeCells>`:'';
  const auto=filter?`<autoFilter ref="${cellName(filter.r1,filter.c1)}:${cellName(filter.r2,filter.c2)}">${Object.entries(s.autoFilter.rules||{}).map(([col,val])=>`<filterColumn colId="${Number(col)-filter.c1}"><filters>${(Array.isArray(val)?val:[val]).map(v=>`<filter val="${xmlEscape(v)}"/>`).join('')}</filters></filterColumn>`).join('')}</autoFilter>`:'';
  const hiddenRows=new Set([...Object.keys(s.hiddenRows||{}).map(v=>Number(v)+1),...(filter?Array.from({length:filter.r2-filter.r1},(_,i)=>filter.r1+i+2).filter(r=>!filterRowVisible(s,r-1)):[])]);
  const rows=new Set([...byRows.keys(),...Object.keys(s.rowHeights||{}).map(v=>Number(v)+1),...Object.keys(s.rowStyles||{}).map(v=>Number(v)+1),...hiddenRows]);
  const xml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${base}">${view}${s.defaultColumnWidth||s.defaultRowHeight?`<sheetFormatPr${s.defaultColumnWidth?` defaultColWidth="${((s.defaultColumnWidth-5)/7).toFixed(3)}"`:''}${s.defaultRowHeight?` defaultRowHeight="${(s.defaultRowHeight*3/4).toFixed(3)}"`:''}/>`:''}${cols?`<cols>${cols}</cols>`:''}<sheetData>${Array.from(rows).sort((a,b)=>a-b).map(r=>{const cc=byRows.get(r)||[],height=s.rowHeights?.[r-1],rowStyle=s.rowStyles?.[r-1],rowStyleID=rowStyle?styles.getId(rowStyle):null;return `<row r="${r}"${rowStyleID!==null?` s="${rowStyleID}" customFormat="1"`:''}${height?` ht="${(height*3/4).toFixed(2)}" customHeight="1"`:''}${hiddenRows.has(r)?' hidden="1"':''}>${cc.sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true})).map(x=>x[1]).join('')}</row>`;}).join('')}</sheetData>${auto}${merges}${xlsxDataValidations(s)}</worksheet>`;
  zip.file(`xl/worksheets/sheet${i+1}.xml`,xml);sheetTypes.push(`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
  return `<sheet name="${xmlEscape(sheetName)}" sheetId="${i+1}" r:id="rId${i+1}"/>`;
 });
 zip.file('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${base}" xmlns:r="${relNS}"><workbookPr date1904="0"/><sheets>${sheets.join('')}</sheets><calcPr fullCalcOnLoad="1"/></workbook>`);
 zip.file('xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${pkgNS}">${book.sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${relNS}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rIdStyles" Type="${relNS}/styles" Target="styles.xml"/></Relationships>`);
 zip.file('xl/styles.xml',styleXML(styles));
 zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetTypes.join('')}</Types>`);
 zip.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${pkgNS}"><Relationship Id="rId1" Type="${relNS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
 return zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:5}});
}
