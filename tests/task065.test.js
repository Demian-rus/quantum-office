import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,validateWorkbook} from '../src/core/workbook.js';
import {addChart,changeChart,chartData,chartSVG,chartOptions,linearRegression,quadraticRegression,predictQuadratic,quadraticLabel} from '../src/core/charts.js';
import {xlsxChartXML} from '../src/core/xlsx-charts.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

const fixture=()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 for(const [r,v] of Object.entries({
  A1:'X',B1:'Парабола',C1:'Линейный',
  A2:'-2',B2:'9',C2:'-3',
  A3:'-1',B3:'2',C3:'-1',
  A4:'0',B4:'1',C4:'1',
  A5:'1',B5:'6',C5:'3',
  A6:'2',B6:'17',C6:'=C5+2'
 }))setCell(sheet,r,v);
 const chart=addChart(book,sheet,'scatter','A1','C6');
 return {book,sheet,chart};
};
test('TASK065: quadratic coefficients exact for y=3x²+2x+1, fit R²=1',()=>{
 const points=[-2,-1,0,1,2].map(x=>({x,value:3*x*x+2*x+1}));
 const fit=quadraticRegression(points);
 assert.ok(fit);
 for(const [name,expected] of [['a',3],['b',2],['c',1],['r2',1]]){
  assert.ok(Math.abs(fit[name]-expected)<1e-11,name+' = '+fit[name]);
 }
 assert.match(quadraticLabel(fit),/3x² \+ 2x \+ 1/);
 assert.ok(Math.abs(predictQuadratic(fit,2.5)-24.75)<1e-11);
 const linear=linearRegression(points);
 assert.ok(linear.r2<fit.r2);
});
test('TASK065: repeated/unsorted/signed X are accepted; large X offsets remain stable',()=>{
 const base=1_000_000_000;
 const xs=[base+2,base-1,base+4,base,base-2,base+2];
 const points=xs.map(x=>({x,value:3*(x-base)**2+2*(x-base)+7}));
 const q=quadraticRegression(points);
 assert.ok(q,'quadratic fit should remain valid with large X offset');
 assert.ok(q.r2>0.9999999999,q.r2);
 for(const p of points)assert.ok(Math.abs(predictQuadratic(q,p.x)-p.value)<1e-7);
 assert.equal(q.n,6);
});
test('TASK065: insufficient rank and unsafe data reject quadratic model',()=>{
 assert.equal(quadraticRegression([{x:1,value:1},{x:2,value:4}]),null);
 assert.equal(quadraticRegression([{x:1,value:1},{x:2,value:2},{x:1,value:3},{x:2,value:4}]),null);
 assert.equal(quadraticRegression([{x:NaN,value:1},{x:2,value:3},{x:3,value:4}]),null);
 assert.equal(quadraticRegression([{x:1e15,value:1},{x:2,value:3},{x:3,value:4}]),null);
});
test('TASK065: native OOXML polynomial order 2, R² and equation flags; linear preserved',()=>{
 const {book,sheet,chart}=fixture();
 changeChart(sheet,chart.id,{options:{trendline:true,trendType:'quadratic',trendEquation:true,trendR2:true,colors:['#123456','#654321']}});
 const xml=xlsxChartXML(book,sheet,chart);
 assert.equal((xml.match(/<c:trendlineType val="poly"\/>/g)||[]).length,2);
 assert.equal((xml.match(/<c:order val="2"\/>/g)||[]).length,2);
 assert.equal((xml.match(/<c:dispEq val="1"\/>/g)||[]).length,2);
 assert.equal((xml.match(/<c:dispRSqr val="1"\/>/g)||[]).length,2);
 assert.ok(xml.indexOf('<c:order val="2"/>')<xml.indexOf('<c:xVal>'));
 changeChart(sheet,chart.id,{options:{trendType:'linear'}});
 const linear=xlsxChartXML(book,sheet,chart);
 assert.equal((linear.match(/<c:trendlineType val="linear"\/>/g)||[]).length,2);
 assert.doesNotMatch(linear,/<c:order val="2"\/>/);
 changeChart(sheet,chart.id,{options:{trendline:false,trendType:'quadratic'}});
 assert.doesNotMatch(xlsxChartXML(book,sheet,chart),/<c:trendline>/);
});
test('TASK065: real SVG curved poly paths, no fake straight line, and per-series R²',()=>{
 const {book,sheet,chart}=fixture();
 changeChart(sheet,chart.id,{options:{trendline:true,trendType:'quadratic',trendEquation:true,trendR2:true}});
 const data=chartData(book,sheet,chart),svg=chartSVG(data,'scatter',chartOptions(chart));
 assert.equal((svg.match(/class="qo-xy-trendline qo-xy-quadratic"/g)||[]).length,2);
 assert.doesNotMatch(svg,/<line class="qo-xy-trendline"/);
 assert.match(svg,/x²/);
 assert.match(svg,/R² = 1/);
 assert.match(svg,/stroke-dasharray="7 4"/);
 assert.doesNotMatch(svg,/NaN|Infinity/);
 const fits=data.series.map(s=>quadraticRegression(s.points));
 assert.ok(fits.every(Boolean));
 const chosen=linearRegression(data.series[0].points);
 assert.ok(fits[0].r2>=chosen.r2);
});
test('TASK065: QBOOK, undo-friendly switch and rejected invalid/non-XY trend type',()=>{
 const {book,sheet,chart}=fixture();
 const before=JSON.stringify(chart);
 assert.throws(()=>changeChart(sheet,chart.id,{options:{trendType:'cubic'}}),/Недопустимые параметры/);
 assert.equal(JSON.stringify(chart),before);
 changeChart(sheet,chart.id,{options:{trendline:true,trendType:'quadratic',trendEquation:true,trendR2:true}});
 const saved=decodeBook(encodeBook(book));
 validateWorkbook(saved);
 assert.equal(saved.sheets[0].charts[0].options.trendType,'quadratic');
 changeChart(sheet,chart.id,{type:'bar'});
 assert.equal(chart.options.trendType,'linear');
 assert.equal(chart.options.trendline,false);
 assert.throws(()=>changeChart(sheet,chart.id,{options:{trendType:'quadratic'}}),/только для XY/);
 const corrupted=structuredClone(book);
 corrupted.sheets[0].charts[0].options.trendType='quadratic';
 assert.throws(()=>validateWorkbook(corrupted),/только для XY/);
});
test('TASK065: singular quadratic with two distinct X does not generate false SVG or OOXML',()=>{
 const {book,sheet,chart}=fixture();
 setCell(sheet,'A2','1');setCell(sheet,'A3','1');
 setCell(sheet,'A4','2');setCell(sheet,'A5','2');setCell(sheet,'A6','2');
 changeChart(sheet,chart.id,{options:{trendline:true,trendType:'quadratic'}});
 assert.equal(quadraticRegression(chartData(book,sheet,chart).series[0].points),null);
 assert.doesNotMatch(chartSVG(chartData(book,sheet,chart),'scatter',chartOptions(chart)),/class="qo-xy-trendline/);
 assert.throws(()=>xlsxChartXML(book,sheet,chart),/минимум три различных X/);
});
