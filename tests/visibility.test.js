import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,getCell,setHidden,rowVisible,columnVisible,gridGeometry,showAllHidden,validateWorkbook,setAutoFilter,setFilterValue} from '../src/core/workbook.js';
import {changeSheetStructure} from '../src/core/structure.js';
import {decodeBook,encodeBook} from '../src/core/store.js';
import {exportXLSX} from '../src/core/xlsx.js';

test('explicit row/column hiding collapses geometry without modifying content',()=>{
 const b=newWorkbook(),s=currentSheet(b);setCell(s,'A2','secret');setCell(s,'B1','=A2');
 setHidden(s,'row',1,true);setHidden(s,'col',1,true);
 const geom=gridGeometry(s);assert.equal(geom.y[2],geom.y[1]);assert.equal(geom.x[2],geom.x[1]);
 assert.equal(rowVisible(s,1),false);assert.equal(columnVisible(s,1),false);
 assert.equal(getCell(s,'A2').value,'secret');assert.equal(getCell(s,'B1').value,'=A2');
 const copy=decodeBook(encodeBook(b));assert.deepEqual(copy.sheets[0].hiddenRows,{1:true});assert.deepEqual(copy.sheets[0].hiddenColumns,{1:true});
 assert.equal(showAllHidden(s,'row'),1);assert.equal(showAllHidden(s,'col'),1);
 assert.equal(rowVisible(s,1),true);assert.equal(columnVisible(s,1),true);
});
test('auto-filter and user hidden are separate causes of visibility',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'A1','Item');setCell(s,'A2','Apple');setCell(s,'A3','Pear');
 setAutoFilter(s,'A1','A3');setFilterValue(s,0,['Apple']);assert.equal(rowVisible(s,2),false);
 setHidden(s,'row',1,true);setFilterValue(s,0,null);assert.equal(rowVisible(s,2),true);assert.equal(rowVisible(s,1),false);
});
test('invalid hidden metadata rejected and the final visible axis entry cannot be hidden',()=>{
 const b=newWorkbook(),s=currentSheet(b);s.hiddenRows={foo:true};assert.throws(()=>validateWorkbook(b),/скрытый индекс/);
 s.hiddenRows={'100000':true};assert.throws(()=>validateWorkbook(b));s.hiddenRows={};
 for(let c=0;c<99;c++)setHidden(s,'col',c,true);
 assert.throws(()=>setHidden(s,'col',99,true),/Нельзя скрыть все/);
 assert.equal(columnVisible(s,99),true);
});
test('structural edits shift hidden flags without mutating data',()=>{
 const s=currentSheet(newWorkbook());setHidden(s,'row',3,true);setHidden(s,'col',2,true);
 changeSheetStructure(s,'row','insert',1);assert.deepEqual(s.hiddenRows,{4:true});
 changeSheetStructure(s,'col','delete',1);assert.deepEqual(s.hiddenColumns,{1:true});
 setHidden(s,'row',99999,true);const snapshot=structuredClone(s);
 assert.throws(()=>changeSheetStructure(s,'row','insert',99999),/Последняя строка или столбец скрыта/);
 assert.deepEqual(s,snapshot);
});
test('XLSX export records explicit hidden row/col and keeps values intact',async()=>{
 const b=newWorkbook(),s=currentSheet(b);setCell(s,'A2','value');setHidden(s,'row',1,true);setHidden(s,'col',1,true);
 const bytes=await exportXLSX(b);const zip=await globalThis.JSZip.loadAsync(bytes);const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
 assert.match(xml,/<col min="2" max="2" hidden="1"\/>/);
 assert.match(xml,/<row r="2" hidden="1">/);assert.match(xml,/value/);
});
