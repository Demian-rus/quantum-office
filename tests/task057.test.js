import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,validateWorkbook} from '../src/core/workbook.js';
import {addChart,chartData,chartSVG,changeChart,suggestChartRange} from '../src/core/charts.js';
import {xlsxChartXML} from '../src/core/xlsx-charts.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

test('TASK057: blank selection creates a durable empty chart without adding fake table data',()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 const source=suggestChartRange(sheet,'A1','A1');
 assert.deepEqual(source,{from:'A1',to:'B6',mode:'empty'});
 const chart=addChart(book,sheet,'bar',source.from,source.to);
 assert.equal(Object.keys(sheet.cells).length,0);
 assert.equal(sheet.charts.length,1);
 assert.match(chartSVG(chartData(book,sheet,chart,{allowEmpty:true}),'bar'),/Диаграмма создана/);
 assert.throws(()=>chartData(book,sheet,chart),/названия категорий и числа/);
 assert.match(xlsxChartXML(book,sheet,chart),/<c:ptCount val="0"\/>/);
 const saved=decodeBook(encodeBook(book));
 assert.deepEqual(saved.sheets[0].charts[0].from,'A1');
 validateWorkbook(saved);
});

test('TASK057: fill data after chart creation updates live preview without recreating object',()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 const chart=addChart(book,sheet,'line','A1','B5'),id=chart.id;
 [['A1','Название'],['B1','Количество'],['A2','Север'],['B2','8'],
  ['A3','Юг'],['B3','21']].forEach(([key,value])=>setCell(sheet,key,value));
 assert.throws(()=>chartData(book,sheet,chart,{allowEmpty:true}),/названия категорий и числа/);
 setCell(sheet,'A4','Запад');setCell(sheet,'B4','12');
 setCell(sheet,'A5','Восток');setCell(sheet,'B5','3');
 const data=chartData(book,sheet,chart,{allowEmpty:true});
 assert.deepEqual(data.points.map(p=>p.value),[8,21,12,3]);
 assert.equal(sheet.charts[0].id,id);
 assert.match(chartSVG(data,'line'),/polyline/);
});

test('TASK057: one-click chart autodetects local data or clamps wider selections',()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 [['A1','Регион'],['B1','План'],['A2','Север'],['B2','10'],
  ['A3','Юг'],['B3','22'],['A4','Восток'],['B4','50']].forEach(([key,value])=>setCell(sheet,key,value));
 assert.deepEqual(suggestChartRange(sheet,'A1','A1'),{from:'A1',to:'B4',mode:'detected'});
 assert.deepEqual(suggestChartRange(sheet,'B3','B3'),{from:'A1',to:'B4',mode:'detected'});
 assert.deepEqual(suggestChartRange(sheet,'A1','D4'),{from:'A1',to:'D4',mode:'selection'});
 assert.deepEqual(suggestChartRange(sheet,'A2','B3'),{from:'A2',to:'B3',mode:'selection'});
});

test('TASK057: source updates reject malformed range atomically and preserve chart ID',()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 const chart=addChart(book,sheet,'bar','A1','B6');
 changeChart(sheet,chart.id,{from:'c2',to:'d4'});
 assert.equal(chart.from,'C2');assert.equal(chart.to,'D4');
 const snap=JSON.stringify(sheet.charts);
 assert.throws(()=>changeChart(sheet,chart.id,{from:'A1',to:'F9'}),/2–5 столбцов/);
 assert.equal(JSON.stringify(sheet.charts),snap);
 assert.throws(()=>changeChart(sheet,chart.id,{from:'Z1',to:'Z2'}),/2–5 столбцов/);
 assert.equal(JSON.stringify(sheet.charts),snap);
});
