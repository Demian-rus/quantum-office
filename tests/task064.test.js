import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,validateWorkbook} from '../src/core/workbook.js';
import {addChart,changeChart,chartData,chartSVG,chartOptions,linearRegression,regressionLabel} from '../src/core/charts.js';
import {xlsxChartXML} from '../src/core/xlsx-charts.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
const seed=()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 for(const [ref,value] of Object.entries({
  A1:'X',B1:'Идеал',C1:'Шум',
  A2:'-2',B2:'-1',C2:'0',
  A3:'0',B3:'3',C3:'2',
  A4:'2',B4:'7',C4:'=B4-2',
  A5:'4',B5:'11',C5:'11'
 }))setCell(sheet,ref,value);
 const chart=addChart(book,sheet,'scatter','A1','C5');
 return {book,sheet,chart};
};
test('TASK064: centered regression gives y=2x+3, exact R²=1 and correct residuals',()=>{
 const fit=linearRegression([{x:-2,value:-1},{x:0,value:3},{x:2,value:7},{x:4,value:11}]);
 assert.equal(fit.n,4);
 assert.ok(Math.abs(fit.slope-2)<1e-12);
 assert.ok(Math.abs(fit.intercept-3)<1e-12);
 assert.equal(fit.r2,1);
 assert.match(regressionLabel(fit),/y = 2x \+ 3/);
 const constantY=linearRegression([{x:-1,value:5},{x:2,value:5},{x:4,value:5}]);
 assert.equal(constantY.slope,0);assert.equal(constantY.intercept,5);assert.equal(constantY.r2,1);
 const negative=linearRegression([{x:0,value:10},{x:1,value:7},{x:2,value:4}]);
 assert.equal(negative.slope,-3);assert.equal(negative.intercept,10);
 assert.equal(negative.r2,1);
});
test('TASK064: trendline uses each numeric X/Y series, with real SVG line and R²; cell formulas recalc',()=>{
 const {book,sheet,chart}=seed();
 changeChart(sheet,chart.id,{options:{trendline:true,trendEquation:true,trendR2:true,
  legend:'right',colors:['#336699','#cc5544']}});
 const fits=chartData(book,sheet,chart).series.map(s=>linearRegression(s.points));
 assert.equal(fits[0].slope,2);assert.equal(fits[0].intercept,3);assert.equal(fits[0].r2,1);
 assert.ok(fits[1].r2>0&&fits[1].r2<1);
 const svg=chartSVG(chartData(book,sheet,chart),chart.type,chartOptions(chart));
 assert.equal((svg.match(/class="qo-xy-trendline"/g)||[]).length,2);
 assert.match(svg,/R² = 1/);
 assert.match(svg,/stroke="#336699" stroke-width="2.5"/);
 assert.match(svg,/stroke="#cc5544" stroke-width="2.5"/);
 setCell(sheet,'B5','15');
 assert.notEqual(linearRegression(chartData(book,sheet,chart).series[0].points).slope,2);
 const replay=decodeBook(encodeBook(book));
 assert.deepEqual(replay.sheets[0].charts[0].options,chart.options);
 validateWorkbook(replay);
});
test('TASK064: native Excel trendline per series, actual linear type and equation flags',()=>{
 const {book,sheet,chart}=seed();
 changeChart(sheet,chart.id,{options:{trendline:true,trendEquation:true,trendR2:true}});
 const xml=xlsxChartXML(book,sheet,chart);
 assert.equal((xml.match(/<c:trendline>/g)||[]).length,2);
 assert.equal((xml.match(/<c:trendlineType val="linear"\/>/g)||[]).length,2);
 assert.equal((xml.match(/<c:dispRSqr val="1"\/>/g)||[]).length,2);
 assert.equal((xml.match(/<c:dispEq val="1"\/>/g)||[]).length,2);
 assert.ok(xml.indexOf('<c:trendline>')<xml.indexOf('<c:xVal>'));
 assert.match(xml,/<c:xVal><c:numRef><c:f>/);
 assert.match(xml,/<c:yVal><c:numRef><c:f>/);
 changeChart(sheet,chart.id,{options:{trendEquation:false,trendR2:false}});
 const xml2=xlsxChartXML(book,sheet,chart);
 assert.equal((xml2.match(/<c:dispEq val="0"\/>/g)||[]).length,2);
 assert.equal((xml2.match(/<c:dispRSqr val="0"\/>/g)||[]).length,2);
 changeChart(sheet,chart.id,{options:{trendline:false}});
 assert.doesNotMatch(xlsxChartXML(book,sheet,chart),/<c:trendline>/);
});
test('TASK064: identical X values are explicitly singular, never a fabricated regression',()=>{
 assert.equal(linearRegression([{x:2,value:1},{x:2,value:3},{x:2,value:6}]),null);
 assert.equal(linearRegression([{x:1,value:2}]),null);
 assert.equal(linearRegression([{x:NaN,value:2},{x:2,value:1}]),null);
 assert.equal(linearRegression([{x:1e14,value:1},{x:2,value:2}]),null);
 const {book,sheet,chart}=seed();
 for(const ref of ['A2','A3','A4','A5'])setCell(sheet,ref,'2');
 changeChart(sheet,chart.id,{options:{trendline:true}});
 const svg=chartSVG(chartData(book,sheet,chart),'scatter',chartOptions(chart));
 assert.doesNotMatch(svg,/class="qo-xy-trendline"/);
 assert.match(svg,/X одинаковы/);
 assert.throws(()=>xlsxChartXML(book,sheet,chart),/минимум два различных значения X/);
});
test('TASK064: trend options reject wrong types and are cleared by atomic scatter-to-bar transition',()=>{
 const {book,sheet,chart}=seed();
 assert.throws(()=>changeChart(sheet,chart.id,{options:{trendline:'yes'}}),/Недопустимые параметры/);
 assert.throws(()=>changeChart(sheet,chart.id,{options:{trendR2:1}}),/Недопустимые параметры/);
 const old=JSON.stringify(chart);
 assert.throws(()=>changeChart(sheet,chart.id,{options:{hack:true}}),/Недопустимые параметры/);
 assert.equal(JSON.stringify(chart),old);
 changeChart(sheet,chart.id,{options:{trendline:true,trendEquation:true,trendR2:true}});
 changeChart(sheet,chart.id,{type:'bar'});
 assert.equal(chart.options.trendline,false);assert.equal(chart.options.trendR2,false);
 validateWorkbook(book);
 assert.throws(()=>changeChart(sheet,chart.id,{options:{trendline:true}}),/только для XY/);
 assert.equal(chart.type,'bar');assert.equal(chart.options.trendline,false);
 const tampered=structuredClone(book);
 tampered.sheets[0].charts[0].options.trendline=true;
 assert.throws(()=>validateWorkbook(tampered),/только для XY/);
});
