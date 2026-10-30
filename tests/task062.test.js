import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,validateWorkbook} from '../src/core/workbook.js';
import {addChart,changeChart,chartData,chartSVG,chartOptions,suggestChartRange,validateCharts} from '../src/core/charts.js';
import {xlsxChartXML} from '../src/core/xlsx-charts.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
const setup=()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 for(const [r,v] of Object.entries({
  A1:'Месяц',B1:'2024',C1:'2025',D1:'2026',
  A2:'Январь',B2:'10',C2:'30',D2:'=B2+C2',
  A3:'Февраль',B3:'20',C3:'30',D3:'50',
  A4:'Март',B4:'40',C4:'10',D4:'50'
 }))setCell(sheet,r,v);
 return {book,sheet};
};
test('TASK062: stacked bars accumulate data, keep live formulas and source references',()=>{
 const {book,sheet}=setup(),c=addChart(book,sheet,'stacked','A1','D4');
 const data=chartData(book,sheet,c);
 assert.equal(data.series.length,3);
 assert.deepEqual(data.series.map(s=>s.points[0].value),[10,30,40]);
 const svg=chartSVG(data,c.type,chartOptions(c));
 assert.equal((svg.match(/<rect x="/g)||[]).length,9);
 assert.match(svg,/>2024<\/text>/);
 const excel=xlsxChartXML(book,sheet,c);
 assert.match(excel,/<c:grouping val="stacked"\/>/);
 assert.match(excel,/<c:overlap val="100"\/>/);
 assert.equal((excel.match(/<c:ser>/g)||[]).length,3);
 for(const col of ['B','C','D'])assert.match(excel,new RegExp('\\$'+col+'\\$2:\\$'+col+'\\$4'));
 setCell(sheet,'D2','75');
 assert.equal(chartData(book,sheet,c).series[2].points[0].value,75);
 const loaded=decodeBook(encodeBook(book));
 assert.equal(loaded.sheets[0].charts[0].type,'stacked');
 validateWorkbook(loaded);
});
test('TASK062: percent charts stack to 100% and write native Excel percent axis',()=>{
 const {book,sheet}=setup(),c=addChart(book,sheet,'stacked100','A1','D4');
 const svg=chartSVG(chartData(book,sheet,c),c.type,chartOptions(c));
 assert.match(svg,/>100%<\/text>/);
 assert.match(svg,/>75%<\/text>/);
 assert.equal((svg.match(/<rect x="/g)||[]).length,9);
 const excel=xlsxChartXML(book,sheet,c);
 assert.match(excel,/<c:grouping val="percentStacked"\/>/);
 assert.match(excel,/<c:overlap val="100"\/>/);
 assert.match(excel,/<c:numFmt formatCode="0%" sourceLinked="0"\/>/);
 assert.doesNotMatch(excel,/<c:max val="100"\/>/);
 assert.equal((excel.match(/<c:numCache>/g)||[]).length,3);
});
test('TASK062: normal stacks support separately stacked negative and positive values',()=>{
 const {book,sheet}=setup();
 setCell(sheet,'C2','-8');setCell(sheet,'D2','-4');
 const c=addChart(book,sheet,'stacked','A1','D4');
 const svg=chartSVG(chartData(book,sheet,c),c.type);
 assert.match(svg,/height="[1-9]/);
 assert.ok((svg.match(/<rect x="/g)||[]).length>=9);
 assert.match(xlsxChartXML(book,sheet,c),/<c:grouping val="stacked"\/>/);
});
test('TASK062: percent variants refuse negative and zero totals, no silent XLSX corruption',()=>{
 const {book,sheet}=setup(),c=addChart(book,sheet,'stacked100','A1','D4');
 setCell(sheet,'B2','-1');
 assert.throws(()=>chartData(book,sheet,c),/100% с накоплением/);
 assert.throws(()=>xlsxChartXML(book,sheet,c),/100% с накоплением/);
 setCell(sheet,'B2','0');setCell(sheet,'C2','0');setCell(sheet,'D2','0');
 assert.throws(()=>chartData(book,sheet,c),/положительной суммой/);
 const old=JSON.stringify(c);
 assert.throws(()=>changeChart(sheet,c.id,{options:{min:10}}),/0–100%/);
 assert.equal(JSON.stringify(c),old);
 const broken=structuredClone(book);
 broken.sheets[0].charts[0].options={max:10};
 assert.throws(()=>validateWorkbook(broken),/0–100%/);
});
test('TASK062: switching chart types preserves Undo-compatible source, colors and clears manual percent axis',()=>{
 const {book,sheet}=setup(),c=addChart(book,sheet,'stacked','A1','D4');
 changeChart(sheet,c.id,{options:{min:5,max:150,colors:['#993311','#116699','#119955'],labels:true}});
 const oldId=c.id;
 changeChart(sheet,c.id,{type:'stacked100'});
 assert.equal(c.id,oldId);assert.equal(c.type,'stacked100');
 assert.equal(c.from,'A1');assert.equal(c.to,'D4');
 assert.deepEqual(c.options.colors,['#993311','#116699','#119955']);
 assert.equal(c.options.min,null);assert.equal(c.options.max,null);
 changeChart(sheet,c.id,{type:'bar'});
 assert.equal(c.type,'bar');
 changeChart(sheet,c.id,{type:'line'});
 assert.equal(c.type,'line');
 assert.deepEqual(suggestChartRange(sheet,'A1','D4','stacked'),{from:'A1',to:'D4',mode:'selection'});
 assert.throws(()=>changeChart(sheet,c.id,{type:'pie'}),/два столбца/);
 assert.equal(c.type,'line');
});
