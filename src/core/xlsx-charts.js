/** TASK056: bounded Excel 2007+ OOXML drawing-chart interoperability. No external resources. */
import {chartData,chartRect,validateCharts} from './charts.js';
import {uid,parseCell,cellName,getCell} from './workbook.js';

const DRAW='http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const A='http://schemas.openxmlformats.org/drawingml/2006/main';
const C='http://schemas.openxmlformats.org/drawingml/2006/chart';
const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE='http://schemas.openxmlformats.org/package/2006/relationships';
const CHART_REL=R+'/chart',DRAW_REL=R+'/drawing';
const escape=s=>String(s??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const direct=(parent,name)=>Array.from(parent?.children||[]).find(n=>n.localName===name)||null;
const all=(parent,name)=>Array.from(parent?.children||[]).filter(n=>n.localName===name);
const nestedText=(parent,name)=>direct(parent,name)?.textContent||'';
const relsFor=part=>part.replace(/^(.*\/)([^/]+)$/,'$1_rels/$2.rels');
const attr=(name,value)=>' '+name+'="'+escape(value)+'"';
const chartSeriesValue=(points,key,kind)=>'<c:'+kind+'Cache><c:ptCount val="'+points.length+'"/>'+points.map((p,i)=>'<c:pt idx="'+i+'"><c:v>'+escape(p[key])+'</c:v></c:pt>').join('')+'</c:'+kind+'Cache>';
const absolute=(sheet,rect)=>"'"+sheet.name.replaceAll("'","''")+"'!$"+cellName(0,rect.c1).replace(/\d+$/,'')+"$"+(rect.r1+1)+':$'+cellName(0,rect.c2).replace(/\d+$/,'')+'$'+(rect.r2+1);
const oneCol=(sheet,row1,row2,col)=>absolute(sheet,{r1:row1,r2:row2,c1:col,c2:col});
const richTitle=title=>'<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr/><a:r><a:rPr lang="ru-RU"/><a:t>'+escape(title)+'</a:t></a:r><a:endParaRPr lang="ru-RU"/></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>';
const chartAxis=(catId,valId)=>
 '<c:catAx><c:axId val="'+catId+'"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="'+valId+'"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblOffset val="100"/></c:catAx>'+
 '<c:valAx><c:axId val="'+valId+'"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:axPos val="l"/><c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="'+catId+'"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>';
/** Reference formulas keep charts live when worksheet values change in Excel. */
export function xlsxChartXML(book,sheet,chart,ordinal=0){
 const rect=chartRect(chart),data=chartData(book,sheet,chart);
 const total=rect.r2-rect.r1+1,header=total-data.points.length===1;
 if(total-data.points.length!==0&&!header)throw Error('Неверная геометрия данных диаграммы');
 const row1=rect.r1+(header?1:0),row2=rect.r2;
 const cat=oneCol(sheet,row1,row2,rect.c1),val=oneCol(sheet,row1,row2,rect.c2);
 const pts=data.points;
 const series='<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>'+escape(data.axis)+'</c:v></c:tx>'+
   '<c:cat><c:strRef><c:f>'+escape(cat)+'</c:f>'+chartSeriesValue(pts,'label','str')+'</c:strRef></c:cat>'+
   '<c:val><c:numRef><c:f>'+escape(val)+'</c:f>'+chartSeriesValue(pts,'value','num')+'</c:numRef></c:val></c:ser>';
 const catAxis=100000+ordinal*2,valAxis=catAxis+1;
 const plot=chart.type==='pie'?
  '<c:pieChart><c:varyColors val="1"/>'+series+'<c:firstSliceAng val="0"/></c:pieChart>':
  chart.type==='bar'?
  '<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="1"/>'+series+
  '<c:axId val="'+catAxis+'"/><c:axId val="'+valAxis+'"/></c:barChart>'+chartAxis(catAxis,valAxis):
  '<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>'+series+
  '<c:marker val="1"/><c:axId val="'+catAxis+'"/><c:axId val="'+valAxis+'"/></c:lineChart>'+chartAxis(catAxis,valAxis);
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<c:chartSpace xmlns:c="'+C+'" xmlns:a="'+A+'" xmlns:r="'+R+'"><c:lang val="ru-RU"/>'+
 '<c:chart>'+richTitle(chart.title)+'<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>'+plot+
 '</c:plotArea><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>';
}
const point=(row,col)=>'<xdr:col>'+col+'</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>'+row+'</xdr:row><xdr:rowOff>0</xdr:rowOff>';
const anchor=(sheet,chart,index)=>{
 const rect=chartRect(chart),left=Math.min(91,rect.c2+2);
 const top=Math.min(99984,rect.r1+index*16);
 return '<xdr:twoCellAnchor editAs="oneCell"><xdr:from>'+point(top,left)+'</xdr:from><xdr:to>'+point(top+14,left+8)+'</xdr:to>'+
 '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="'+(index+2)+'" name="Quantum Chart '+(index+1)+'"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>'+
 '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>'+
 '<a:graphic><a:graphicData uri="'+C+'"><c:chart xmlns:c="'+C+'" xmlns:r="'+R+'" r:id="rId'+(index+1)+'"/></a:graphicData></a:graphic>'+
 '</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>';
};
/** One drawing relationship per sheet and a dedicated chart part per chart. */
export function writeXLSXCharts(zip,book,sheet,sheetNumber){
 if(!sheet.charts?.length)return {drawing:'',overrides:[]};
 validateCharts(sheet);
 const n=sheetNumber,overrides=[];
 for(let i=0;i<sheet.charts.length;i++){
  const part='xl/charts/chart'+n+'-'+(i+1)+'.xml';
  zip.file(part,xlsxChartXML(book,sheet,sheet.charts[i],(n-1)*30+i));
  overrides.push('<Override PartName="/'+part+'" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>');
 }
 zip.file('xl/drawings/drawing'+n+'.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<xdr:wsDr xmlns:xdr="'+DRAW+'" xmlns:a="'+A+'" xmlns:c="'+C+'" xmlns:r="'+R+'">'+
  sheet.charts.map((chart,i)=>anchor(sheet,chart,i)).join('')+'</xdr:wsDr>');
 zip.file('xl/drawings/_rels/drawing'+n+'.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<Relationships xmlns="'+PACKAGE+'">'+sheet.charts.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="'+CHART_REL+'" Target="../charts/chart'+n+'-'+(i+1)+'.xml"/>').join('')+'</Relationships>');
 zip.file('xl/worksheets/_rels/sheet'+n+'.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<Relationships xmlns="'+PACKAGE+'"><Relationship Id="rIdDrawing" Type="'+DRAW_REL+'" Target="../drawings/drawing'+n+'.xml"/></Relationships>');
 overrides.push('<Override PartName="/xl/drawings/drawing'+n+'.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>');
 return {drawing:'<drawing xmlns:r="'+R+'" r:id="rIdDrawing"/>',overrides};
}

function parseXML(xml){
 if(typeof DOMParser==='undefined')throw Error('Для чтения диаграмм XLSX нужен XML-парсер');
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 if(doc.getElementsByTagName('parsererror').length)throw Error('Повреждён XML диаграммы');
 return doc.documentElement;
}
async function localXML(zip,path){
 const file=zip.file(path);
 if(!file||file._data?.uncompressedSize>10_000_000)return null;
 return parseXML(await file.async('string'));
}
/** Resolve only local OOXML package paths; never fetch or follow external URLs. */
export function safeChartPart(basePart,target){
 if(typeof target!=='string'||!target||/[\\?#\u0000-\u001f]/.test(target)||
    /^[a-z][a-z0-9+.-]*:/i.test(target))return null;
 const stack=target.startsWith('/')?[]:basePart.split('/').slice(0,-1);
 for(const seg of target.split('/')){
  if(!seg||seg==='.'){if(!seg)return null;continue;}
  if(seg==='..'){if(stack.length<=1)return null;stack.pop();continue;}
  if(!/^[a-z0-9_.-]+$/i.test(seg))return null;
  stack.push(seg);
 }
 const path=stack.join('/');
 return path.startsWith('xl/')&&!path.includes('/../')?path:null;
}
const relMap=root=>new Map(all(root,'Relationship').map(n=>[n.getAttribute('Id'),n]));
function sourceRange(formula,expectedName){
 if(typeof formula!=='string'||formula.length>220)return null;
 const bang=formula.lastIndexOf('!');if(bang<1)return null;
 let name=formula.slice(0,bang);
 if(name.startsWith("'")&&name.endsWith("'"))name=name.slice(1,-1).replaceAll("''","'");
 if(name.toLocaleLowerCase('ru-RU')!==expectedName.toLocaleLowerCase('ru-RU'))return null;
 const coord=formula.slice(bang+1).replaceAll('$','').toUpperCase();
 if(!/^[A-Z]{1,3}[1-9]\d*(?::[A-Z]{1,3}[1-9]\d*)?$/.test(coord))return null;
 const [a,b=a]=coord.split(':'),start=parseCell(a),end=parseCell(b);
 if(!start||!end||start.row>end.row||start.col!==end.col)return null;
 return {start,end};
}
function parseChart(book,sheet,chartRoot){
 const node=direct(chartRoot,'chart'),plot=direct(node,'plotArea');
 const types=Array.from(plot?.children||[]).filter(n=>['barChart','lineChart','pieChart'].includes(n.localName));
 if(types.length!==1)return null;
 const body=types[0],type=body.localName==='pieChart'?'pie':body.localName==='lineChart'?'line':'bar';
 if(type==='bar'&&direct(body,'barDir')?.getAttribute('val')!=='col')return null;
 if(type==='bar'&&direct(body,'grouping')?.getAttribute('val')!=='clustered')return null;
 if(type==='line'&&direct(body,'grouping')?.getAttribute('val')!=='standard')return null;
 const series=all(body,'ser');if(series.length!==1)return null;
 const ser=series[0],cat=direct(direct(ser,'cat'),'strRef')||direct(direct(ser,'cat'),'numRef');
 const val=direct(direct(ser,'val'),'numRef');
 const cats=sourceRange(nestedText(cat,'f'),sheet.name),vals=sourceRange(nestedText(val,'f'),sheet.name);
 if(!cats||!vals||cats.start.row!==vals.start.row||cats.end.row!==vals.end.row||
    vals.start.col!==cats.start.col+1||vals.end.row-cats.start.row<1||vals.end.row-cats.start.row>50)return null;
 let row=cats.start.row;
 // Header comes from the immediately preceding text cell only; caches never become workbook values.
 if(row>0){
  const before=getCell(sheet,cellName(row-1,vals.start.col)).value;
  if(before&&Number.isNaN(Number(String(before).trim())))row--;
 }
 const range={from:cellName(row,cats.start.col),to:cellName(vals.end.row,vals.end.col)};
 const titleNode=direct(node,'title');
 const textNodes=titleNode?Array.from(titleNode.getElementsByTagNameNS(A,'t')):[];
 const caption=textNodes.map(x=>x.textContent).join('').trim();
 const chart={id:uid(),type,title:(caption||'Диаграмма '+((sheet.charts||[]).length+1)).slice(0,120),...range};
 try{chartData(book,sheet,chart);validateCharts({...sheet,charts:[...(sheet.charts||[]),chart]});}
 catch{return null;}
 return chart;
}
export async function importXLSXCharts(zip,book,descriptors,report=null){
 let imported=0,skipped=0;
 for(const item of descriptors){
  const drawingTag=direct(item.xml,'drawing');
  if(!drawingTag)continue;
  const rootRels=await localXML(zip,relsFor(item.path));
  const drawingRel=relMap(rootRels).get(drawingTag.getAttributeNS(R,'id')||drawingTag.getAttribute('r:id'));
  const drawingPath=drawingRel?.getAttribute('TargetMode')==='External'?null:
   drawingRel?.getAttribute('Type')===DRAW_REL?safeChartPart(item.path,drawingRel.getAttribute('Target')):null;
  const drawing=drawingPath?await localXML(zip,drawingPath):null;
  if(!drawing){skipped++;continue;}
  const drawingRels=relMap(await localXML(zip,relsFor(drawingPath)));
  const refs=Array.from(drawing.getElementsByTagNameNS(C,'chart'));
  for(const ref of refs){
   const link=drawingRels.get(ref.getAttributeNS(R,'id')||ref.getAttribute('r:id'));
   const part=link?.getAttribute('Type')===CHART_REL&&link.getAttribute('TargetMode')!=='External'?
    safeChartPart(drawingPath,link.getAttribute('Target')):null;
   const chartXML=part?await localXML(zip,part):null;
   const chart=chartXML?parseChart(book,item.sheet,chartXML):null;
   if(!chart){skipped++;continue;}
   item.sheet.charts.push(chart);imported++;
  }
 }
 if(report&&typeof report==='object'){
  report.importedCharts=(report.importedCharts||0)+imported;
  report.skippedCharts=(report.skippedCharts||0)+skipped;
 }
 return {imported,skipped};
}
