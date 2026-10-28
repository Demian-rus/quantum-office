/** Limited OOXML workbook exchange. All parsing is local; no eval or network. */
import '../vendor/jszip.min.js';
import { newWorkbook,newSheet,setCell,setStyle,validateWorkbook,LIMITS,setColumnWidth,setRowHeight } from './workbook.js';
const JSZip = globalThis.JSZip;
const encoder=new TextEncoder();
const xmlEscape=s=>String(s??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const element=(parent,tag)=>Array.from(parent?.children||[]).find(n=>n.localName===tag)||null;
const elements=(parent,tag)=>Array.from(parent?.children||[]).filter(n=>n.localName===tag);
const text=(node,tag)=>element(node,tag)?.textContent||'';
function parseXML(xml){if(typeof DOMParser==='undefined')throw Error('Для чтения XLSX требуется браузер с XML-парсером');const doc=new DOMParser().parseFromString(xml,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('Некорректный XML в XLSX');return doc.documentElement;}
function rgba(xml){const v=xml?.getAttribute('rgb');return v&&/^(?:[0-9A-F]{2})?[0-9A-F]{6}$/i.test(v)?'#'+v.slice(-6).toLowerCase():undefined;}
function stylesFromXML(root){if(!root)return [{}];const fonts=elements(element(root,'fonts'),'font').map(node=>({bold:!!element(node,'b'),italic:!!element(node,'i'),color:rgba(element(node,'color'))}));const fills=elements(element(root,'fills'),'fill').map(node=>{const p=element(node,'patternFill');return p?.getAttribute('patternType')==='solid'?rgba(element(p,'fgColor')):undefined;});const nums=new Map(elements(element(root,'numFmts'),'numFmt').map(n=>[+n.getAttribute('numFmtId'),n.getAttribute('formatCode')||'']));return elements(element(root,'cellXfs'),'xf').map(xf=>{const font=fonts[+xf.getAttribute('fontId')]||{},bg=fills[+xf.getAttribute('fillId')],align=element(xf,'alignment')?.getAttribute('horizontal');const id=+xf.getAttribute('numFmtId');const fmt=nums.get(id)||'';const style={};if(font.bold)style.bold=true;if(font.italic)style.italic=true;if(font.color)style.color=font.color;if(bg)style.bg=bg;if(['left','right','center'].includes(align))style.align=align;if([9,10].includes(id)||/%/.test(fmt))style.format='percent';else if([5,6,7,8,44].includes(id)||/[₽€$£]/.test(fmt))style.format='currency';else if([1,3].includes(id)||fmt==='0')style.format='integer';return style;});}
function safeName(name){return String(name||'Лист').replace(/[\\/\[\]*?:]/g,'_').slice(0,31)||'Лист';}
const base='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const relNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const pkgNS='http://schemas.openxmlformats.org/package/2006/relationships';
function zipPath(target){const path=String(target||'').replace(/^\//,'').replace(/^xl\//,'');const pieces=path.split('/');if(!path||pieces.some(p=>p==='..'||p==='.'||!p))throw Error('Небезопасный путь в XLSX');return 'xl/'+path;}
function required(zip,path){const file=zip.file(path);if(!file)throw Error('В XLSX отсутствует '+path);return file;}
async function readXML(zip,path){const f=required(zip,path);if((f._data?.uncompressedSize||0)>10_000_000)throw Error('Слишком большой XML внутри XLSX');return parseXML(await f.async('string'));}
/** Reading supports shared and inline strings, numeric values and formulas. Unsupported parts are deliberately not retained. */
async function importXLSX(data,filename='Таблица'){
 if((data?.byteLength??data?.size??0)>15_000_000)throw Error('XLSX больше 15 МБ не поддерживается');
 const zip=await JSZip.loadAsync(data,{checkCRC32:true,createFolders:false});
 const all=Object.values(zip.files).filter(f=>!f.dir);if(all.length>500||all.reduce((n,f)=>n+(f._data?.uncompressedSize||0),0)>30_000_000)throw Error('Слишком большой или подозрительный XLSX');
 const wbXML=await readXML(zip,'xl/workbook.xml');const relationships=await readXML(zip,'xl/_rels/workbook.xml.rels');
 const rels=new Map(elements(relationships,'Relationship').map(n=>[n.getAttribute('Id'),n]));
 const sheets=elements(element(wbXML,'sheets'),'sheet');if(!sheets.length||sheets.length>LIMITS.sheets)throw Error('Недопустимое количество листов');
 const shared=[];if(zip.file('xl/sharedStrings.xml')){const sharedDoc=await readXML(zip,'xl/sharedStrings.xml');for(const si of elements(sharedDoc,'si')){shared.push(Array.from(si.getElementsByTagNameNS('*','t')).map(t=>t.textContent).join(''));if(shared.length>LIMITS.cells)throw Error('Слишком много общих строк');}}
 const fmt=zip.file('xl/styles.xml')?stylesFromXML(await readXML(zip,'xl/styles.xml')):[{}];
 const book=newWorkbook(filename.replace(/\.xlsx$/i,''));book.sheets=[];let count=0;
 for(const sh of sheets){const rid=sh.getAttributeNS(relNS,'id')||sh.getAttribute('r:id');const rel=rels.get(rid);if(!rel||rel.getAttribute('TargetMode')==='External')throw Error('Нет локального листа в XLSX');
  const path=zipPath(rel.getAttribute('Target'));const xml=await readXML(zip,path);const sheet=newSheet(sh.getAttribute('name')||'Лист');
  for(const col of elements(element(xml,'cols'),'col')){
   const min=Number(col.getAttribute('min')),max=Number(col.getAttribute('max')),width=Number(col.getAttribute('width'));
   if(!Number.isInteger(min)||!Number.isInteger(max)||min<1||max>LIMITS.columns||max<min||!Number.isFinite(width)||width<=0)continue;
   const px=Math.round(width*7+5);if(px<48||px>520)continue;
   for(let c=min-1;c<max;c++)setColumnWidth(sheet,c,px);
  }
  for(const row of elements(element(xml,'sheetData'),'row')){
   const index=Number(row.getAttribute('r')),ht=Number(row.getAttribute('ht'));
   if(row.hasAttribute('customHeight')&&Number.isInteger(index)&&index>=1&&index<=LIMITS.rows&&Number.isFinite(ht)&&ht>0){const px=Math.round(ht*4/3);if(px>=22&&px<=160)setRowHeight(sheet,index-1,px);}
  }
  for(const row of elements(element(xml,'sheetData'),'row'))for(const c of elements(row,'c')){const ref=c.getAttribute('r')||'';if(!/^([A-Z]+)([1-9]\d*)$/i.test(ref))continue;
   if(++count>LIMITS.cells)throw Error('Слишком много ячеек в XLSX');
   const type=c.getAttribute('t'),value=text(c,'v'),formula=element(c,'f');let raw='';
   if(formula){if(formula.getAttribute('t')==='shared'&&!formula.textContent)throw Error('Неподдерживаемая общая формула в '+ref);raw='='+formula.textContent;}
   else if(type==='inlineStr')raw=Array.from(element(c,'is')?.getElementsByTagNameNS('*','t')||[]).map(n=>n.textContent).join('');
   else if(type==='s'){const index=+value;if(!Number.isInteger(index)||index<0||index>=shared.length)throw Error('Повреждённая общая строка');raw=shared[index];}
   else if(type==='b')raw=value==='1'?'TRUE':'FALSE';
   else if(type==='e')raw=value;
   else raw=value;
   if(raw)setCell(sheet,ref,raw);
   const style=fmt[Number(c.getAttribute('s')||0)]||{};if(Object.keys(style).length)setStyle(sheet,ref,style);
  }
  book.sheets.push(sheet);
 }
 book.activeSheetId=book.sheets[0].id;return validateWorkbook(book);
}
function styleCatalog(book){const unique=[{}],lookup=new Map([['{}',0]]);for(const sheet of book.sheets)for(const c of Object.values(sheet.cells)){const s=c.style||{},key=JSON.stringify(Object.keys(s).sort().reduce((x,k)=>(x[k]=s[k],x),{}));if(!lookup.has(key)){lookup.set(key,unique.length);unique.push(s);}}return {unique,lookup,getId:s=>lookup.get(JSON.stringify(Object.keys(s||{}).sort().reduce((x,k)=>(x[k]=s[k],x),{})))||0};}
function styleXML(styles){const fonts=[{bold:false,italic:false}],fills=[null,null],fontIds=new Map(),fillIds=new Map();const cells=styles.unique.map(s=>{
 const fontKey=JSON.stringify([!!s.bold,!!s.italic,s.color||'']);let fi=fontIds.get(fontKey);if(fi===undefined){fi=fonts.length;fonts.push(s);fontIds.set(fontKey,fi);}
 let fillId=0;if(s.bg){if(!fillIds.has(s.bg)){fillIds.set(s.bg,fills.length);fills.push(s.bg);}fillId=fillIds.get(s.bg);}
 return {fi,fillId,format:s.format==='percent'?10:s.format==='currency'?44:s.format==='integer'?1:0,align:s.align};});
 let xml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${base}"><fonts count="${fonts.length}">${fonts.map(f=>`<font><sz val="11"/><name val="Aptos"/>${f.bold?'<b/>':''}${f.italic?'<i/>':''}${f.color?`<color rgb="FF${f.color.slice(1).toUpperCase()}"/>`:''}</font>`).join('')}</fonts><fills count="${fills.length}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills.slice(2).map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c.slice(1).toUpperCase()}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${cells.length}">${cells.map(c=>`<xf numFmtId="${c.format}" fontId="${c.fi}" fillId="${c.fillId}" borderId="0" xfId="0"${c.align?' applyAlignment="1"':''}>${c.align?`<alignment horizontal="${c.align}"/>`:''}</xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;return xml;
}
async function exportXLSX(book){validateWorkbook(book);const zip=new JSZip();const styles=styleCatalog(book);
 const sheetTypes=[];const usedSheetNames=new Set();const sheets=book.sheets.map((s,i)=>{
  const sheetName=safeName(s.name);if(usedSheetNames.has(sheetName.toLowerCase()))throw Error('Повторяющиеся названия листов после сокращения до 31 символа');usedSheetNames.add(sheetName.toLowerCase());
  let byRows=new Map();for(const [ref,c] of Object.entries(s.cells)){const match=/^([A-Z]+)(\d+)$/.exec(ref);if(!match)continue;const row=+match[2];if(!byRows.has(row))byRows.set(row,[]);
   const styleID=styles.getId(c.style||{});const styleAttr=styleID?` s="${styleID}"`:'';const v=String(c.value??'');let tag='';
   if(v.startsWith('='))tag=`<c r="${ref}"${styleAttr}><f>${xmlEscape(v.slice(1))}</f></c>`;
   else if(v!==''&&/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(v)&&Number.isFinite(Number(v))&&v.replace(/[^\d]/g,'').replace(/^0+/,'').length<=15)tag=`<c r="${ref}"${styleAttr}><v>${xmlEscape(v)}</v></c>`;
   else if(v!=='' )tag=`<c r="${ref}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`;
   else if(styleID)tag=`<c r="${ref}"${styleAttr}/>`;
   if(tag)byRows.get(row).push([ref,tag]);
  }
  const cols=Object.entries(s.columnWidths||{}).sort((a,b)=>Number(a[0])-Number(b[0])).map(([index,pixels])=>`<col min="${Number(index)+1}" max="${Number(index)+1}" width="${((pixels-5)/7).toFixed(2)}" customWidth="1"/>`).join('');
  const rows=new Set([...byRows.keys(),...Object.keys(s.rowHeights||{}).map(v=>Number(v)+1)]);
  const xml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${base}">${cols?`<cols>${cols}</cols>`:''}<sheetData>${Array.from(rows).sort((a,b)=>a-b).map(r=>{const cc=byRows.get(r)||[],height=s.rowHeights?.[r-1];return `<row r="${r}"${height?` ht="${(height*3/4).toFixed(2)}" customHeight="1"`:''}>${cc.sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true})).map(x=>x[1]).join('')}</row>`;}).join('')}</sheetData></worksheet>`;
  zip.file(`xl/worksheets/sheet${i+1}.xml`,xml);sheetTypes.push(`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
  return `<sheet name="${xmlEscape(sheetName)}" sheetId="${i+1}" r:id="rId${i+1}"/>`;
 });
 zip.file('xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${base}" xmlns:r="${relNS}"><sheets>${sheets.join('')}</sheets><calcPr fullCalcOnLoad="1"/></workbook>`);
 zip.file('xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${pkgNS}">${book.sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${relNS}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rIdStyles" Type="${relNS}/styles" Target="styles.xml"/></Relationships>`);
 zip.file('xl/styles.xml',styleXML(styles));
 zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetTypes.join('')}</Types>`);
 zip.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${pkgNS}"><Relationship Id="rId1" Type="${relNS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
 return zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:5}});
}
