import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,validateWorkbook} from '../src/core/workbook.js';
import {addChart,changeChart,chartData,chartSVG,chartOptions,suggestChartRange} from '../src/core/charts.js';
import {xlsxChartXML} from '../src/core/xlsx-charts.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
const make=()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 for(const [key,val] of Object.entries({
  A1:'Время, сек',B1:'Датчик 1',C1:'Датчик 2',
  A2:'-5',B2:'10',C2:'=B2+2',
  A3:'7',B3:'-3',C3:'4',
  A4:'13',B4:'25',C4:'12',
  A5:'7',B5:'8',C5:'13'
 }))setCell(sheet,key,val);
 return {book,sheet};
};
test('TASK063: XY data use real signed, unsorted and repeated numeric X values',()=>{
 const {book,sheet}=make(),chart=addChart(book,sheet,'scatter','A1','C5');
 const d=chartData(book,sheet,chart);
 assert.deepEqual(d.series.map(s=>s.name),['Датчик 1','Датчик 2']);
 assert.deepEqual(d.series[0].points.map(p=>p.x),[-5,7,13,7]);
 assert.deepEqual(d.series[0].points.map(p=>p.value),[10,-3,25,8]);
 assert.deepEqual(d.series[1].points.map(p=>p.value),[12,4,12,13]);
 const svg=chartSVG(d,'scatter',chartOptions(chart));
 assert.equal((svg.match(/class="qo-scatter-point"/g)||[]).length,8);
 assert.equal((svg.match(/<polyline/g)||[]).length,0);
 assert.match(svg,/Датчик 1/);
 const xs=[...svg.matchAll(/class="qo-scatter-point" cx="([^"]+)"/g)].map(m=>Number(m[1]));
 assert.ok(xs[0]<xs[1]&&xs[1]<xs[2]&&xs[3]===xs[1],JSON.stringify(xs));
 setCell(sheet,'A4','25');setCell(sheet,'C3','=B3*2');
 assert.equal(chartData(book,sheet,chart).series[0].points[2].x,25);
 assert.equal(chartData(book,sheet,chart).series[1].points[1].value,-6);
 const restored=decodeBook(encodeBook(book));
 assert.equal(restored.sheets[0].charts[0].type,'scatter');
 validateWorkbook(restored);
});
test('TASK063: true Excel scatterChart uses paired numeric X and Y formulas and two value axes',()=>{
 const {book,sheet}=make(),chart=addChart(book,sheet,'scatter','A1','C5');
 changeChart(sheet,chart.id,{options:{legend:'right',labels:true,grid:false,min:-10,max:40,colors:['#cc3344','#3355cc']}});
 const xml=xlsxChartXML(book,sheet,chart);
 assert.match(xml,/<c:scatterChart><c:scatterStyle val="marker"\/>/);
 assert.equal((xml.match(/<c:ser>/g)||[]).length,2);
 assert.equal((xml.match(/<c:valAx>/g)||[]).length,2);
 assert.equal((xml.match(/<c:xVal>/g)||[]).length,2);
 assert.equal((xml.match(/<c:yVal>/g)||[]).length,2);
 assert.doesNotMatch(xml,/<c:cat>/);
 assert.match(xml,/\$A\$2:\$A\$5/);
 assert.match(xml,/\$B\$2:\$B\$5/);
 assert.match(xml,/\$C\$2:\$C\$5/);
 assert.match(xml,/<a:srgbClr val="CC3344"\/>/);
 assert.match(xml,/<a:srgbClr val="3355CC"\/>/);
 assert.match(xml,/<c:min val="-10"\/>/);
 assert.match(xml,/<c:max val="40"\/>/);
});
test('TASK063: refuse text, blanks and overlarge XY coordinates without silently shifting points',()=>{
 const {book,sheet}=make(),c=addChart(book,sheet,'scatter','A1','C5');
 setCell(sheet,'A3','unknown');
 assert.throws(()=>chartData(book,sheet,c),/числа по обеим осям/);
 assert.throws(()=>xlsxChartXML(book,sheet,c),/числа по обеим осям/);
 setCell(sheet,'A3','7');setCell(sheet,'C4','');
 assert.throws(()=>chartData(book,sheet,c),/числа по обеим осям/);
 setCell(sheet,'C4','12');setCell(sheet,'A4','1e15');
 assert.throws(()=>chartData(book,sheet,c),/числа по обеим осям|координаты/);
});
test('TASK063: type switching stays compatible, chart detection supports numeric X, empty XY is durable',()=>{
 const {book,sheet}=make(),c=addChart(book,sheet,'line','A1','C5');
 changeChart(sheet,c.id,{type:'scatter'});
 assert.equal(chartData(book,sheet,c).series[0].points[0].x,-5);
 assert.deepEqual(suggestChartRange(sheet,'B3','B3','scatter'),{from:'A1',to:'C5',mode:'detected'});
 changeChart(sheet,c.id,{type:'bar'});
 assert.equal(c.type,'bar');
 const blank=newWorkbook(),bs=currentSheet(blank),source=suggestChartRange(bs,'A1','A1','scatter');
 const ec=addChart(blank,bs,'scatter',source.from,source.to);
 assert.match(chartSVG(chartData(blank,bs,ec,{allowEmpty:true}),'scatter'),/Диаграмма создана/);
 validateWorkbook(blank);
});
