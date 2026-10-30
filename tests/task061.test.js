import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,validateWorkbook} from '../src/core/workbook.js';
import {addChart,changeChart,chartOptions,chartData,chartSVG,validateChartOptions} from '../src/core/charts.js';
import {xlsxChartXML} from '../src/core/xlsx-charts.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
const setup=()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 for(const [k,v] of Object.entries({A1:'Квартал',B1:'План',C1:'Факт',A2:'Первый',B2:'10',C2:'13',A3:'Второй',B3:'20',C3:'18',A4:'Третий',B4:'15',C4:'25'}))setCell(sheet,k,v);
 return {book,sheet,chart:addChart(book,sheet,'line','A1','C4')};
};
test('TASK061: chart settings validate, persist and survive QBOOK without altering source',()=>{
 const {book,sheet,chart}=setup();
 const source=chart.from+':'+chart.to;
 changeChart(sheet,chart.id,{options:{labels:true,legend:'right',grid:false,min:4,max:30,colors:['#aa2233','#3366cc']}});
 validateWorkbook(book);
 assert.deepEqual(chartOptions(chart),{labels:true,legend:'right',grid:false,min:4,max:30,colors:['#aa2233','#3366cc']});
 assert.equal(chart.from+':'+chart.to,source);
 const restored=decodeBook(encodeBook(book));
 assert.deepEqual(chartOptions(restored.sheets[0].charts[0]),chartOptions(chart));
 const svg=chartSVG(chartData(book,sheet,chart),chart.type,chartOptions(chart));
 assert.match(svg,/#aa2233/);
 assert.match(svg,/#3366cc/);
 assert.match(svg,/>30<\/text>/);
 assert.match(svg,/Факт/);
 assert.equal((svg.match(/<polyline/g)||[]).length,2);
 assert.doesNotMatch(svg,/stroke="#e3eaf0"/);
 const ooxml=xlsxChartXML(book,sheet,chart);
 assert.match(ooxml,/<c:legendPos val="r"\/>/);
 assert.match(ooxml,/<c:showVal val="1"\/>/);
 assert.match(ooxml,/<c:min val="4"\/>/);
 assert.match(ooxml,/<c:max val="30"\/>/);
 assert.doesNotMatch(ooxml,/<c:majorGridlines\/>/);
 assert.match(ooxml,/<a:srgbClr val="AA2233"\/>/);
 assert.match(ooxml,/<a:srgbClr val="3366CC"\/>/);
});
test('TASK061: invalid UI-like changes are atomic; no unsafe color strings',()=>{
 const {book,sheet,chart}=setup();
 const original=JSON.stringify(chart);
 for(const patch of [
  {colors:['#fff']},{colors:['#aa2233','url(javascript:bad)']},
  {colors:[null]},{legend:'up'},{labels:'yes'},{grid:1},
  {min:50,max:40},{min:Infinity},{max:1e14},{colors:['#123456','#654321','#fefefe','#ab0000','#beeeee']}
 ]){
  assert.throws(()=>changeChart(sheet,chart.id,{options:patch}),/Недопустимые параметры/);
  assert.equal(JSON.stringify(chart),original);
 }
 assert.throws(()=>validateChartOptions({legend:'none',hack:'x'}),/Недопустимые параметры/);
 changeChart(sheet,chart.id,{options:{labels:true,min:0,max:50}});
 assert.throws(()=>changeChart(sheet,chart.id,{options:{min:60}}),/Недопустимые параметры/);
 assert.equal(chart.options.min,0);
 const bad=structuredClone(book);
 bad.sheets[0].charts[0].options.colors=['red'];
 assert.throws(()=>validateWorkbook(bad),/Недопустимые параметры/);
});
test('TASK061: default, pie and blank legacy charts still render, labels optional',()=>{
 const {book,sheet,chart}=setup();
 delete chart.options;
 validateWorkbook(book);
 const base=chartSVG(chartData(book,sheet,chart),'line');
 assert.equal((base.match(/<polyline/g)||[]).length,2);
 assert.match(xlsxChartXML(book,sheet,chart),/<c:legend>/);
 changeChart(sheet,chart.id,{options:{legend:'none',labels:false}});
 const hidden=chartSVG(chartData(book,sheet,chart),'line',chartOptions(chart));
 assert.doesNotMatch(hidden,/>План<\/text>/);
 assert.doesNotMatch(xlsxChartXML(book,sheet,chart),/<c:legend>/);
 const pie=addChart(book,sheet,'pie','A1','B4');
 changeChart(sheet,pie.id,{options:{labels:true,legend:'none'}});
 assert.match(chartSVG(chartData(book,sheet,pie),'pie',chartOptions(pie)),/10<\/text>/);
 assert.match(xlsxChartXML(book,sheet,pie),/<c:showVal val="1"\/>/);
 const emptyBook=newWorkbook(),emptySheet=currentSheet(emptyBook);
 const blank=addChart(emptyBook,emptySheet,'bar','A1','B6');
 changeChart(emptySheet,blank.id,{options:{labels:true,legend:'bottom',grid:false}});
 assert.match(chartSVG(chartData(emptyBook,emptySheet,blank,{allowEmpty:true}),blank.type,chartOptions(blank)),/Диаграмма создана/);
});
