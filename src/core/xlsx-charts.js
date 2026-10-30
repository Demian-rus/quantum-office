/** TASK056: bounded Excel 2007+ OOXML drawing-chart interoperability. No external resources. */
import {chartData,chartRect,validateCharts,chartLayout,validateChartLayout} from './charts.js';
import {uid,parseCell,cellName,getCell,gridGeometry,firstVisibleIndex} from './workbook.js';

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
 const rect=chartRect(chart),data=chartData(book,sheet,chart,{allowEmpty:true});
 const header=data.header;
 const row1=rect.r1+(header?1:0),row2=rect.r2;
 const cat=oneCol(sheet,row1,row2,rect.c1),val=oneCol(sheet,row1,row2,rect.c2);
 const series=data.series||[{name:data.axis,points:data.points}];
 const seriesXML=series.map((entry,k)=>{
  const valueRef=oneCol(sheet,row1,row2,rect.c1+k+1),titleCell=oneCol(sheet,rect.r1,rect.r1,rect.c1+k+1);
  const title=data.header?
   '<c:tx><c:strRef><c:f>'+escape(titleCell)+'</c:f>'+
    chartSeriesValue([{name:entry.name}],'name','str')+'</c:strRef></c:tx>':
   '<c:tx><c:v>'+escape(entry.name)+'</c:v></c:tx>';
  return '<c:ser><c:idx val="'+k+'"/><c:order val="'+k+'"/>'+title+
   '<c:cat><c:strRef><c:f>'+escape(cat)+'</c:f>'+chartSeriesValue(entry.points,'label','str')+'</c:strRef></c:cat>'+
   '<c:val><c:numRef><c:f>'+escape(valueRef)+'</c:f>'+chartSeriesValue(entry.points,'value','num')+'</c:numRef></c:val></c:ser>';
 }).join('');
 const catAxis=100000+ordinal*2,valAxis=catAxis+1;
 const plot=chart.type==='pie'?
  '<c:pieChart><c:varyColors val="1"/>'+seriesXML+'<c:firstSliceAng val="0"/></c:pieChart>':
  chart.type==='bar'?
  '<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="1"/>'+seriesXML+
  '<c:axId val="'+catAxis+'"/><c:axId val="'+valAxis+'"/></c:barChart>'+chartAxis(catAxis,valAxis):
  '<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>'+seriesXML+
  '<c:marker val="1"/><c:axId val="'+catAxis+'"/><c:axId val="'+valAxis+'"/></c:lineChart>'+chartAxis(catAxis,valAxis);
 return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<c:chartSpace xmlns:c="'+C+'" xmlns:a="'+A+'" xmlns:r="'+R+'"><c:lang val="ru-RU"/>'+
 '<c:chart>'+richTitle(chart.title)+'<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>'+plot+
 '</c:plotArea><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>';
}
// Excel drawing anchors use cell indices and offsets in English Metric Units.
// Keep objects at their native sheet positions; no more arbitrary 'to the right' placement.
const chartEMU=9525;
function chartMarker(geometry,position,axis){
 const points=axis==='x'?geometry.x:geometry.y,shift=axis==='x'?0:31;
 const at=Math.max(points[0],Math.min(points.at(-1)-1,position+shift));
 const index=firstVisibleIndex(points,at);
 const offset=Math.max(0,Math.round((at-points[index])*chartEMU));
 return axis==='x'?'<xdr:col>'+index+'</xdr:col><xdr:colOff>'+offset+'</xdr:colOff>':
  '<xdr:row>'+index+'</xdr:row><xdr:rowOff>'+offset+'</xdr:rowOff>';
}
function marker(sheet,x,y){
 const geometry=gridGeometry(sheet);
 return chartMarker(geometry,x,'x')+chartMarker(geometry,y,'y');
}
const anchor=(sheet,chart,index)=>{
 const rect=chartRect(chart),layout=chartLayout(sheet,chart,index);
 const left=layout.x,top=layout.y;
 return '<xdr:twoCellAnchor><xdr:from>'+marker(sheet,left,top)+'</xdr:from><xdr:to>'+
  marker(sheet,left+layout.width,top+layout.height)+'</xdr:to>'+
 '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="'+(index+2)+'" name="Quantum Chart '+(index+1)+'"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>'+
 '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>'+
 '<a:graphic><a:graphicData uri="'+C+'"><c:chart xmlns:c="'+C+'" xmlns:r="'+R+'" r:id="rId'+(index+1)+'"/></a:graphicData></a:graphic>'+
 '</xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>';
};
function chartLayoutFromDrawing(sheet,reference){
 let node=reference.parentElement;
 while(node&&node.localName!=='twoCellAnchor')node=node.parentElement;
 if(!node)return null;
 const from=direct(node,'from'),to=direct(node,'to'),geometry=gridGeometry(sheet);
 function position(item,axis){
  const isX=axis==='x',index=Number(nestedText(item,isX?'col':'row')),
   offset=Number(nestedText(item,isX?'colOff':'rowOff'));
  const points=isX?geometry.x:geometry.y;
  if(!Number.isInteger(index)||index<0||index>=points.length-1||
     !Number.isFinite(offset)||offset<0)return NaN;
  return Math.round(points[index]+offset/chartEMU-(isX?0:31));
 }
 const left=position(from,'x'),top=position(from,'y'),right=position(to,'x'),bottom=position(to,'y');
 const layout={x:left,y:top,width:right-left,height:bottom-top};
 try{validateChartLayout(sheet,layout);return layout;}catch{return null;}
}
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
 const series=all(body,'ser');
 if(!series.length||series.length>4||type==='pie'&&series.length!==1)return null;
 let cats=null,valsFirst=null;
 for(let k=0;k<series.length;k++){
  const item=series[k],cat=direct(direct(item,'cat'),'strRef')||direct(direct(item,'cat'),'numRef'),
   val=direct(direct(item,'val'),'numRef');
  const category=sourceRange(nestedText(cat,'f'),sheet.name),values=sourceRange(nestedText(val,'f'),sheet.name);
  if(!category||!values||category.start.row!==values.start.row||
     category.end.row!==values.end.row||values.start.col!==category.start.col+k+1||
     values.end.row-values.start.row<1||values.end.row-values.start.row>50||
     cats&&(category.start.row!==cats.start.row||category.end.row!==cats.end.row||
            category.start.col!==cats.start.col))return null;
  if(!cats)cats=category;
  if(!valsFirst)valsFirst=values;
 }
 let row=cats.start.row;
 if(row>0){
  const hasHeader=series.every((_,k)=>{
   const before=String(getCell(sheet,cellName(row-1,valsFirst.start.col+k)).value||'').trim();
   return before!==''&&Number.isNaN(Number(before));
  });
  if(hasHeader)row--;
 }
 const range={from:cellName(row,cats.start.col),to:cellName(valsFirst.end.row,valsFirst.start.col+series.length-1)};
 const titleNode=direct(node,'title');
 const textNodes=titleNode?Array.from(titleNode.getElementsByTagNameNS(A,'t')):[];
 const caption=textNodes.map(x=>x.textContent).join('').trim();
 const chart={id:uid(),type,title:(caption||'Диаграмма '+((sheet.charts||[]).length+1)).slice(0,120),...range};
 try{chartData(book,sheet,chart,{allowEmpty:true});validateCharts({...sheet,charts:[...(sheet.charts||[]),chart]});}
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
   const importedLayout=chartLayoutFromDrawing(item.sheet,ref);
   if(importedLayout)chart.layout=importedLayout;
   item.sheet.charts.push(chart);imported++;
  }
 }
 if(report&&typeof report==='object'){
  report.importedCharts=(report.importedCharts||0)+imported;
  report.skippedCharts=(report.skippedCharts||0)+skipped;
 }
 return {imported,skipped};
}
