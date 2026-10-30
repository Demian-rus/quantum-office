import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,validateWorkbook,newSheet} from '../src/core/workbook.js';
import {addChart} from '../src/core/charts.js';
import {xlsxChartXML,safeChartPart,writeXLSXCharts} from '../src/core/xlsx-charts.js';
import {JSZip} from '../src/core/xlsx.js';

const setup=()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 for(const [ref,value] of Object.entries({
  A1:'Категория',B1:'План',A2:'Север',B2:'12',A3:'Юг',B3:'24',A4:'Восток',B4:'=B2+B3'
 }))setCell(sheet,ref,value);
 return {book,sheet};
};
test('TASK056: bar/line/pie emit reference-linked OOXML chart caches and titles',()=>{
 const {book,sheet}=setup();
 for(const type of ['bar','line','pie']){
  const chart=addChart(book,sheet,type,'A1','B4');chart.title='Итоги & <План>';
  const xml=xlsxChartXML(book,sheet,chart);
  assert.match(xml,/&apos;Лист 1&apos;!\$A\$2:\$A\$4/);
  assert.match(xml,/&apos;Лист 1&apos;!\$B\$2:\$B\$4/);
  assert.match(xml,/<c:strCache><c:ptCount val="3"\/>/);
  assert.match(xml,/<c:numCache><c:ptCount val="3"\/>/);
  assert.match(xml,/<c:pt idx="2"><c:v>36<\/c:v><\/c:pt>/);
  assert.match(xml,/Итоги &amp; &lt;План&gt;/);
  assert.match(xml,new RegExp('<c:'+(type==='bar'?'barChart':type==='line'?'lineChart':'pieChart')+'>'));
 }
 validateWorkbook(book);
});
test('TASK056: safe chart parts reject external traversal and resolve local drawing/chart paths',()=>{
 assert.equal(safeChartPart('xl/worksheets/sheet1.xml','../drawings/drawing1.xml'),'xl/drawings/drawing1.xml');
 assert.equal(safeChartPart('xl/drawings/drawing1.xml','../charts/chart1-1.xml'),'xl/charts/chart1-1.xml');
 assert.equal(safeChartPart('xl/worksheets/sheet1.xml','../../evil.xml'),null);
 assert.equal(safeChartPart('xl/drawings/drawing1.xml','https://example.com/chart.xml'),null);
 assert.equal(safeChartPart('xl/drawings/drawing1.xml','../charts/evil?.xml'),null);
});
test('TASK056: workbook drawings use explicit chart relationships and content types',async()=>{
 const {book,sheet}=setup();
 addChart(book,sheet,'bar','A1','B4');
 const other=newSheet('Второй лист');book.sheets.push(other);
 for(const [ref,value] of Object.entries({A1:'Товар',B1:'Значение',A2:'Хлеб',B2:'1',A3:'Сыр',B3:'2'}))setCell(other,ref,value);
 addChart(book,other,'line','A1','B3');
 const zip=new JSZip();
 const first=writeXLSXCharts(zip,book,sheet,1),second=writeXLSXCharts(zip,book,other,2);
 assert.match(first.drawing,/r:id="rIdDrawing"/);
 assert.equal(first.overrides.length,2);
 assert.equal(second.overrides.length,2);
 const files=zip.files;
 assert.ok(files['xl/drawings/drawing1.xml']);
 assert.ok(files['xl/drawings/drawing2.xml']);
 assert.ok(files['xl/charts/chart1-1.xml']);
 assert.ok(files['xl/charts/chart2-1.xml']);
 const drawing=await files['xl/drawings/drawing1.xml'].async('string');
 const rels=await files['xl/worksheets/_rels/sheet1.xml.rels'].async('string');
 assert.match(drawing,/<xdr:twoCellAnchor/);
 assert.match(rels,/Target="\.\.\/drawings\/drawing1\.xml"/);
});
test('TASK056: chart with formula result changing to invalid text refuses XLSX rather than omitting chart',()=>{
 const {book,sheet}=setup();
 const c=addChart(book,sheet,'bar','A1','B4');
 setCell(sheet,'B3','not a number');
 assert.throws(()=>xlsxChartXML(book,sheet,c),/названия категорий и числа/);
});
