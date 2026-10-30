import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,newSheet,currentSheet,setCell,validateWorkbook} from '../src/core/workbook.js';
import {addChart,chartData,chartSVG,changeChart,removeChart,shiftCharts,validateCharts} from '../src/core/charts.js';
import {changeSheetStructure} from '../src/core/structure.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
function setup(){const b=newWorkbook(),s=currentSheet(b);for(const [ref,v] of Object.entries({A1:'Регион',B1:'План',A2:'Север',B2:'10',A3:'Юг',B3:'20',A4:'Восток',B4:'15'}))setCell(s,ref,v);return {b,s};}
test('TASK050: create, recalculate bar/line/pie, QBOOK and delete',()=>{
 const {b,s}=setup(),c=addChart(b,s,'bar','A1','B4');
 assert.equal(chartData(b,s,c).points.length,3);assert.match(chartSVG(chartData(b,s,c),'bar'),/role="img"/);
 setCell(s,'B2','55');assert.deepEqual(chartData(b,s,c).points.map(x=>x.value),[55,20,15]);
 changeChart(s,c.id,{title:'Продажи',type:'line'});
 assert.match(chartSVG(chartData(b,s,c),'line'),/polyline/);
 changeChart(s,c.id,{type:'pie'});assert.match(chartSVG(chartData(b,s,c),'pie'),/stroke-dasharray/);
 const saved=decodeBook(encodeBook(b));assert.equal(saved.sheets[0].charts[0].title,'Продажи');
 assert.equal(chartData(saved,saved.sheets[0],saved.sheets[0].charts[0]).points[0].value,55);
 removeChart(s,c.id);assert.equal(s.charts.length,0);
});
test('TASK050: cross-sheet formula results remain linked',()=>{
 const {b,s}=setup(),another=newSheet('Итоги');b.sheets.push(another);
 setCell(another,'A1','33');setCell(s,'B2','=Итоги!A1+2');
 const c=addChart(b,s,'line','A1','B4');
 assert.equal(chartData(b,s,c).points[0].value,35);
 setCell(another,'A1','40');assert.equal(chartData(b,s,c).points[0].value,42);
});
test('TASK050: unsafe shapes, zero pie, untrusted labels and metadata',()=>{
 const {b,s}=setup();
 assert.throws(()=>addChart(b,s,'bar','A1','F4'),/2–5 столбцов/);
 const short=addChart(b,s,'pie','A1','B2');
 assert.throws(()=>chartData(b,s,short),/минимум два/);
 setCell(s,'B2','текст');const malformed=addChart(b,s,'line','A1','B4');
 assert.throws(()=>chartData(b,s,malformed),/названия категорий и числа/);
 setCell(s,'B2','-1');const negative=addChart(b,s,'pie','A1','B4');
 assert.throws(()=>chartData(b,s,negative),/неотрицательными/);
 const c=addChart(b,s,'bar','A1','B4');setCell(s,'A2','<img onerror=alert(1)>');
 assert.doesNotMatch(chartSVG(chartData(b,s,c),'bar'),/<img/);
 assert.match(chartSVG(chartData(b,s,c),'bar'),/&lt;img/);
 const broken=structuredClone(b);broken.sheets[0].charts[0].type='script';
 assert.throws(()=>validateWorkbook(broken),/Повреждена диаграмма/);
 assert.throws(()=>changeChart(s,c.id,{title:'   '}),/название/);
});
test('TASK050: structural insert moves chart sources; deletion is atomic',()=>{
 const {b,s}=setup();addChart(b,s,'bar','A1','B4');
 changeSheetStructure(s,'row','insert',0,1);
 assert.equal(s.charts[0].from,'A2');assert.equal(s.charts[0].to,'B5');
 assert.equal(chartData(b,s,s.charts[0]).points[1].label,'Юг');
 const before=JSON.stringify(s);
 assert.throws(()=>changeSheetStructure(s,'col','delete',0,1),/разрушит диапазон диаграммы/);
 assert.equal(JSON.stringify(s),before);
 changeSheetStructure(s,'row','delete',0,1);
 assert.equal(s.charts[0].from,'A1');validateCharts(s);
});
