import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,validateWorkbook} from '../src/core/workbook.js';
import {addChart,changeChart,chartData,chartSVG,suggestChartRange,shiftCharts} from '../src/core/charts.js';
import {xlsxChartXML} from '../src/core/xlsx-charts.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

const make=()=>{
 const b=newWorkbook(),s=currentSheet(b);
 for(const [ref,value] of Object.entries({
  A1:'Месяц',B1:'План',C1:'Факт',D1:'Прошлый год',
  A2:'Январь',B2:'12',C2:'17',D2:'7',
  A3:'Февраль',B3:'=B2+3',C3:'23',D3:'8',
  A4:'Март',B4:'25',C4:'18',D4:'11'
 }))setCell(s,ref,value);
 return {b,s};
};

test('TASK060: multi-series source yields grouped bars, named legends and formula-linked lines',()=>{
 const {b,s}=make(),c=addChart(b,s,'bar','A1','D4');
 const data=chartData(b,s,c);
 assert.equal(data.header,true);
 assert.deepEqual(data.series.map(x=>x.name),['План','Факт','Прошлый год']);
 assert.deepEqual(data.series.map(x=>x.points.map(p=>p.value)),[[12,15,25],[17,23,18],[7,8,11]]);
 assert.equal(data.points.length,3);
 const bars=chartSVG(data,'bar');
 assert.equal((bars.match(/<rect x=/g)||[]).length,12); // background + 9 grouped bars + legend swatches
 assert.match(bars,/Прошлый год/);
 assert.equal((chartSVG(data,'line').match(/<polyline /g)||[]).length,3);
 setCell(s,'C3','37');
 assert.equal(chartData(b,s,c).series[1].points[1].value,37);
 const saved=decodeBook(encodeBook(b));
 assert.deepEqual(chartData(saved,saved.sheets[0],saved.sheets[0].charts[0]).series[1].points[1].value,37);
 validateWorkbook(saved);
});
test('TASK060: numeric year headings are series names rather than an extra group of data',()=>{
 const {b,s}=make();
 setCell(s,'B1','2024');setCell(s,'C1','2025');setCell(s,'D1','2026');
 const c=addChart(b,s,'line','A1','D4'),data=chartData(b,s,c);
 assert.equal(data.header,true);
 assert.deepEqual(data.series.map(x=>x.name),['2024','2025','2026']);
 assert.deepEqual(data.points.map(x=>x.label),['Январь','Февраль','Март']);
 const xml=xlsxChartXML(b,s,c);
 assert.equal((xml.match(/<c:ser>/g)||[]).length,3);
 assert.match(xml,/\$B\$2:\$B\$4/);
});
test('TASK060: strict series bounds, pie isolation, malformed data and atomic source/type transitions',()=>{
 const {b,s}=make(),c=addChart(b,s,'line','A1','D4');
 assert.throws(()=>addChart(b,s,'bar','A1','F4'),/2–5 столбцов/);
 assert.throws(()=>addChart(b,s,'pie','A1','C4'),/два столбца/);
 const before=JSON.stringify(c);
 assert.throws(()=>changeChart(s,c.id,{type:'pie'}),/два столбца/);
 assert.equal(JSON.stringify(c),before);
 assert.throws(()=>changeChart(s,c.id,{from:'A1',to:'F4'}),/2–5 столбцов/);
 assert.equal(JSON.stringify(c),before);
 changeChart(s,c.id,{from:'A1',to:'B4',type:'pie'});
 assert.equal(chartData(b,s,c).series.length,1);
 const broken=addChart(b,s,'line','A1','D4');
 setCell(s,'C2','некорректно');
 assert.throws(()=>chartData(b,s,broken),/названия категорий и числа/);
});
test('TASK060: range inference carries all contiguous numeric series; pie uses first',()=>{
 const {s}=make();
 assert.deepEqual(suggestChartRange(s,'B2','B2'),{from:'A1',to:'D4',mode:'detected'});
 assert.deepEqual(suggestChartRange(s,'A1','D4'),{from:'A1',to:'D4',mode:'selection'});
 assert.deepEqual(suggestChartRange(s,'A1','A4'),{from:'A1',to:'D4',mode:'selection'});
 assert.deepEqual(suggestChartRange(s,'A1','D4','pie'),{from:'A1',to:'B4',mode:'selection'});
 assert.deepEqual(suggestChartRange(s,'A1','E4'),{from:'A1',to:'E4',mode:'selection'});
});
test('TASK060: valid Excel multi-ser XML binds one independent source formula for every series',()=>{
 const {s,b}=make(),c=addChart(b,s,'line','A1','D4');
 const xml=xlsxChartXML(b,s,c);
 assert.equal((xml.match(/<c:ser>/g)||[]).length,3);
 assert.equal((xml.match(/<c:idx val="/g)||[]).length,3);
 for(const col of ['B','C','D']){
  assert.match(xml,new RegExp('\\$'+col+'\\$2:\\$'+col+'\\$4'));
  assert.match(xml,new RegExp('\\$'+col+'\\$1:\\$'+col+'\\$1'));
 }
 assert.match(xml,/Факт/);
 assert.match(xml,/<c:pt idx="1"><c:v>15<\/c:v><\/c:pt>/);
 const single=addChart(b,s,'pie','A1','B4');
 assert.equal((xlsxChartXML(b,s,single).match(/<c:ser>/g)||[]).length,1);
});
test('TASK060: inserted/deleted columns may grow/shrink grouped sources only within bounds',()=>{
 const {s,b}=make(),c=addChart(b,s,'bar','A1','D4');
 const shifted=shiftCharts(s,'col','insert',2,1)[0];
 assert.equal(shifted.to,'E4');
 const snap=structuredClone(s);snap.charts=[shifted];
 assert.throws(()=>shiftCharts(snap,'col','insert',2,1),/Диаграмма выйдет/);
 assert.throws(()=>shiftCharts(s,'col','delete',0,1),/разрушит диапазон/);
});
