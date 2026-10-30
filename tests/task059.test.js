import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,validateWorkbook} from '../src/core/workbook.js';
import {addChart,changeChart,chartLayout,validateChartLayout,chartData} from '../src/core/charts.js';
import {xlsxChartXML,writeXLSXCharts} from '../src/core/xlsx-charts.js';
import {JSZip} from '../src/core/xlsx.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

function setup(){
 const b=newWorkbook(),s=currentSheet(b);
 for(const [ref,v] of Object.entries({A1:'Месяц',B1:'Доход',A2:'Январь',B2:'12',A3:'Февраль',B3:'34',A4:'Март',B4:'23'}))
  setCell(s,ref,v);
 return {b,s};
}
test('TASK059: inserted chart gets editable position and size, QBOOK retains it',()=>{
 const {b,s}=setup(),c=addChart(b,s,'bar','A1','B4');
 const initial=chartLayout(s,c);
 assert.ok(initial.x>=54);
 assert.ok(initial.y>=40);
 assert.ok(initial.width>=280);
 assert.ok(initial.height>=190);
 const next={...initial,x:initial.x+60,y:initial.y+42,width:630,height:355};
 changeChart(s,c.id,{layout:next});
 assert.deepEqual(chartLayout(s,c),next);
 assert.equal(chartData(b,s,c).points.length,3);
 const saved=decodeBook(encodeBook(b));
 assert.deepEqual(saved.sheets[0].charts[0].layout,next);
 validateWorkbook(saved);
});
test('TASK059: malformed, out-of-bounds and noninteger layouts reject atomically',()=>{
 const {s,b}=setup(),c=addChart(b,s,'line','A1','B4');
 const original=JSON.stringify(c);
 for(const layout of [
  {x:50,y:0,width:480,height:290},{x:100,y:10,width:240,height:300},
  {x:100,y:10,width:480,height:150},{x:100.3,y:10,width:480,height:292},
  {x:100,y:10,width:480,height:292,script:'bad'},
  {x:100,y:2900000,width:480,height:292},
  {x:100000,y:10,width:480,height:292}
 ]){
  assert.throws(()=>changeChart(s,c.id,{layout}),/положение или размер|за пределы/);
  assert.equal(JSON.stringify(c),original);
 }
 const broken=structuredClone(b);broken.sheets[0].charts[0].layout={x:1,y:0,width:480,height:292};
 assert.throws(()=>validateWorkbook(broken),/положение/);
});
test('TASK059: old .qbook chart without layout remains valid and has deterministic default',()=>{
 const {s,b}=setup(),c=addChart(b,s,'pie','A1','B4');
 delete c.layout;
 const layout=chartLayout(s,c,0);
 assert.ok(layout.x>=54);
 assert.ok(layout.y>=40);
 validateWorkbook(b);
 const recovered=decodeBook(encodeBook(b));
 assert.equal(recovered.sheets[0].charts[0].layout,undefined);
 assert.deepEqual(chartLayout(recovered.sheets[0],recovered.sheets[0].charts[0],0),layout);
});
test('TASK059: chart XLSX drawing two-cell markers follow stored position and dimensions',async()=>{
 const {s,b}=setup(),c=addChart(b,s,'bar','A1','B4');
 const desired={x:508,y:92,width:531,height:310};
 validateChartLayout(s,desired);
 changeChart(s,c.id,{layout:desired});
 const zip=new JSZip();writeXLSXCharts(zip,b,s,1);
 const drawing=await zip.file('xl/drawings/drawing1.xml').async('string');
 assert.match(drawing,/<xdr:twoCellAnchor>/);
 assert.match(drawing,/<xdr:colOff>\d+<\/xdr:colOff>/);
 assert.match(drawing,/<xdr:rowOff>\d+<\/xdr:rowOff>/);
 assert.match(drawing,/<xdr:graphicFrame/);
 assert.ok(!drawing.includes('editAs="oneCell"'));
 const chart=await zip.file('xl/charts/chart1-1.xml').async('string');
 assert.match(chart,/<c:barChart>/);
 assert.match(chart,/\$A\$2:\$A\$4/);
});
