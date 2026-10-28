import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,setAutoFilter,setFilterValue,filterRowVisible,filterRange,setFreeze,gridGeometry,validateWorkbook,cellName} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
import {exportXLSX} from '../src/core/xlsx.js';
function fixture(){const b=newWorkbook('Фильтры'),s=currentSheet(b);[['Товар','Сумма'],['яблоко','5'],['груша','7'],['яблоко','8'],['слива','3']].forEach((row,i)=>row.forEach((v,j)=>setCell(s,cellName(i,j),v)));return [b,s];}
test('auto-filter hides only matching data rows without mutation',()=>{const [b,s]=fixture();const before=structuredClone(s.cells);setAutoFilter(s,'A1','B5');setFilterValue(s,0,'яблоко');assert.deepEqual([0,1,2,3,4].filter(r=>filterRowVisible(s,r)),[0,1,3]);assert.deepEqual(s.cells,before);const y=gridGeometry(s).y;assert.equal(y[3]-y[2],0);assert.equal(y[4]-y[3],29);assert.equal(y[5]-y[4],0);validateWorkbook(b);});
test('empty values, multiple columns and clear column filters',()=>{const [,s]=fixture();setAutoFilter(s,'A1','B5');setCell(s,'B4','');setFilterValue(s,0,'яблоко');setFilterValue(s,1,'');assert.deepEqual([1,2,3,4].filter(r=>filterRowVisible(s,r)),[3]);setFilterValue(s,1,null);assert.deepEqual([1,2,3,4].filter(r=>filterRowVisible(s,r)),[1,3]);});
test('filters only affect rows inside bounded range',()=>{const [,s]=fixture();setAutoFilter(s,'A2','B4');setFilterValue(s,0,'груша');assert.equal(filterRowVisible(s,0),true);assert.equal(filterRowVisible(s,1),true);assert.equal(filterRowVisible(s,2),true);assert.equal(filterRowVisible(s,3),false);assert.equal(filterRowVisible(s,4),true);});
test('invalid filter range or column leaves workbook unmodified',()=>{const [,s]=fixture();assert.throws(()=>setAutoFilter(s,'A1','B1'));assert.equal(s.autoFilter,null);setAutoFilter(s,'A1','B5');assert.throws(()=>setFilterValue(s,3,'яблоко'));assert.deepEqual(s.autoFilter.rules,{});});
test('freeze settings are bounded, independent and retained in local file',()=>{const [b,s]=fixture();setAutoFilter(s,'A1','B5');setFilterValue(s,0,'яблоко');setFreeze(s,1,1);const copy=decodeBook(encodeBook(b));assert.deepEqual(copy.sheets[0].freeze,{rows:1,cols:1});assert.equal(copy.sheets[0].autoFilter.rules[0],'яблоко');assert.throws(()=>setFreeze(s,11,0));assert.deepEqual(s.freeze,{rows:1,cols:1});});
test('malformed saved filter and freeze are rejected',()=>{const [b,s]=fixture();s.freeze={rows:99,cols:0};assert.throws(()=>validateWorkbook(b),/закрепление/);s.freeze={rows:0,cols:0};s.autoFilter={from:'A1',to:'B5',rules:{'9':'x'}};assert.throws(()=>validateWorkbook(b),/фильтр/);});
test('XLSX stores standard autoFilter, hidden rows and frozen pane without touching data',async()=>{const [b,s]=fixture();setAutoFilter(s,'A1','B5');setFilterValue(s,0,'яблоко');setFreeze(s,1,1);const bytes=await exportXLSX(b);const zip=await globalThis.JSZip.loadAsync(bytes);const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');assert.match(xml,/<pane xSplit="1" ySplit="1" topLeftCell="B2" state="frozen"\/>/);assert.match(xml,/<autoFilter ref="A1:B5">/);assert.match(xml,/<filterColumn colId="0">/);assert.match(xml,/<row r="3" hidden="1">/);assert.match(xml,/r="A3"/);});

test('multivalue filter: OR in one column and AND across columns',()=>{
 const [b,s]=fixture();setAutoFilter(s,'A1','B5');setFilterValue(s,0,['яблоко','слива']);
 assert.deepEqual([1,2,3,4].filter(r=>filterRowVisible(s,r)),[1,3,4]);
 setFilterValue(s,1,['3','8']);
 assert.deepEqual([1,2,3,4].filter(r=>filterRowVisible(s,r)),[3,4]);
 const copy=decodeBook(encodeBook(b));validateWorkbook(copy);
 assert.deepEqual(copy.sheets[0].autoFilter.rules['0'],['яблоко','слива']);
});
test('invalid filter array never alters current filter',()=>{
 const [b,s]=fixture();setAutoFilter(s,'A1','B5');
 for(const bad of [[],['a','a'],[1,'a'],new Array(201).fill('x'),['x'.repeat(50001)]]){
  const before=JSON.stringify(s.autoFilter);
  assert.throws(()=>setFilterValue(s,0,bad));
  assert.equal(JSON.stringify(s.autoFilter),before);
 }
 s.autoFilter.rules['0']=['a','a'];assert.throws(()=>validateWorkbook(b),/фильтр/);
});
test('XLSX encodes multiple filters and hides only excluded rows',async()=>{
 const [b,s]=fixture();setAutoFilter(s,'A1','B5');setFilterValue(s,0,['яблоко','слива']);
 const bytes=await exportXLSX(b),zip=await globalThis.JSZip.loadAsync(bytes);
 const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
 assert.match(xml,/<filters><filter val="яблоко"\/><filter val="слива"\/><\/filters>/);
 assert.match(xml,/<row r="3" hidden="1">/);
 assert.doesNotMatch(xml,/<row r="2" hidden="1">/);
});
