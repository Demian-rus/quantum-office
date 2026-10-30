/** TASK058 — bounded SpreadsheetML print setup and sheet-scoped print areas. */
import {rectangle,parseCell,cellName,LIMITS} from './workbook.js';
import {changePrintSettings,printSettings} from './printing.js';

const XP_PAPERS={A4:'9',Letter:'1'};
const XP_PAPER_IDS={'9':'A4','1':'Letter'};
const XP_SCALES=new Set([60,75,90,100,125]);
const xpEscape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const xpChild=(node,tag)=>Array.from(node?.xpChildren||[]).find(c=>c.localName===tag)||null;
const xpChildren=(node,tag)=>Array.from(node?.xpChildren||[]).filter(c=>c.localName===tag);
const xpAsInteger=s=>/^\d+$/.test(String(s??''))?Number(s):NaN;
const xpTruthy=x=>x==='1'||x==='true';
/** Print settings are exported as Excel-native paper size, orientation and page scaling. */
export function xlsxPrintSettings(sheet){
 const cfg=printSettings(sheet);
 const setup='<pageSetup paperSize="'+XP_PAPERS[cfg.paper]+'" orientation="'+cfg.orientation+
  '" scale="'+cfg.scale+'" fitToWidth="'+(cfg.fitWidth?'1':'0')+'" fitToHeight="0"/>';
 return {sheetPr:'<sheetPr><pageSetUpPr fitToPage="'+(cfg.fitWidth?'1':'0')+'"/></sheetPr>',
  // Consistent static margins, since Quantum does not expose configurable margins.
  trailing:'<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>'+setup};
}
export function xlsxPrintArea(sheet,sheetNumber,name){
 const area=printSettings(sheet).area;
 if(!area)return '';
 const r=rectangle(area.from,area.to);
 if(!r)throw Error('Неправильная область печати XLSX');
 const canonical=ref=>{const p=parseCell(ref);return '$'+cellName(0,p.col).replace(/\d+$/,'')+'$'+(p.row+1);};
 const sheetName="'"+name.replaceAll("'","''")+"'";
 return '<definedName name="_xlnm.Print_Area" localSheetId="'+(sheetNumber-1)+'">'+
   xpEscape(sheetName+'!'+canonical(area.from)+':'+canonical(area.to))+'</definedName>';
}
/** Accept only ONE local rectangular area scoped to its existing worksheet. */
export function parseXLSXPrintArea(value,sheetName){
 if(typeof value!=='string'||value.length>260||/[,\[\]#]/.test(value))return null;
 const v=value.trim();
 const bang=v.lastIndexOf('!');
 if(bang<1)return null;
 let scope=v.slice(0,bang);
 if(scope.startsWith("'")&&scope.endsWith("'"))
  scope=scope.slice(1,-1).replaceAll("''","'");
 if(scope!==sheetName)return null;
 const refs=v.slice(bang+1).replaceAll('$','').toUpperCase().split(':');
 if(refs.length!==2)return null;
 const a=parseCell(refs[0]),b=parseCell(refs[1]);
 if(!a||!b||a.row>b.row||a.col>b.col||
    a.row>=LIMITS.rows||b.row>=LIMITS.rows||a.col>=LIMITS.columns||b.col>=LIMITS.columns)return null;
 return {from:cellName(a.row,a.col),to:cellName(b.row,b.col)};
}
export function workbookPrintAreaNodes(root){
 const groups=xpChild(root,'definedNames');
 return xpChildren(groups,'definedName').filter(n=>n.getAttribute('name')==='_xlnm.Print_Area');
}
/** Invalid or advanced Excel settings are surfaced as skipped rather than silently invented. */
export function importXLSXPrintSettings(sheet,sheetXml,workbookPrintAreas,sheetIndex,report=null){
 const patch={},setup=xpChild(sheetXml,'pageSetup'),top=xpChild(xpChild(sheetXml,'sheetPr'),'pageSetUpPr');
 let imported=0,skipped=0;
 if(setup){
  const paper=setup.getAttribute('paperSize');
  if(paper!==null){if(XP_PAPER_IDS[paper]){patch.paper=XP_PAPER_IDS[paper];imported++;}else skipped++;}
  const orientation=setup.getAttribute('orientation');
  if(orientation!==null){if(['portrait','landscape'].includes(orientation)){patch.orientation=orientation;imported++;}else skipped++;}
  const rawScale=setup.getAttribute('scale');
  if(rawScale!==null){
   const scale=xpAsInteger(rawScale);
   if(XP_SCALES.has(scale)){patch.scale=scale;imported++;}else skipped++;
  }
  const fit=top?.getAttribute('fitToPage');
  const width=setup.getAttribute('fitToWidth'),height=setup.getAttribute('fitToHeight');
  if(fit!==null&&fit!==undefined){
   if(xpTruthy(fit)&&width==='1'&&(height==='0'||height===null)){patch.fitWidth=true;imported++;}
   else if((fit==='0'||fit==='false')&&(width==='0'||width===null)&&(height==='0'||height===null)){patch.fitWidth=false;imported++;}
   else skipped++;
  }else if(width!==null||height!==null){
   if(width==='1'&&(height==='0'||height===null)){patch.fitWidth=true;imported++;}
   else if((width==='0'||width===null)&&(height==='0'||height===null)){patch.fitWidth=false;imported++;}
   else skipped++;
  }
 }
 const areaMatches=workbookPrintAreas.filter(n=>n.getAttribute('localSheetId')===String(sheetIndex));
 if(areaMatches.length){
  if(areaMatches.length!==1)skipped+=areaMatches.length;
  else{
   const area=parseXLSXPrintArea(areaMatches[0].textContent,sheet.name);
   if(area){patch.area=area;imported++;}else skipped++;
  }
 }
 if(Object.keys(patch).length)changePrintSettings(sheet,patch);
 if(report&&typeof report==='object'){
  report.importedPrintSettings=(report.importedPrintSettings||0)+imported;
  report.skippedPrintSettings=(report.skippedPrintSettings||0)+skipped;
 }
 return {imported,skipped};
}
