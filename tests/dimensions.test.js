import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setColumnWidth,setRowHeight,columnWidth,rowHeight,gridGeometry,firstVisibleIndex,validateWorkbook} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
import {exportXLSX} from '../src/core/xlsx.js';

test('column/row geometry is non-uniform and searchable',()=>{
 const s=currentSheet(newWorkbook());setColumnWidth(s,1,208);setRowHeight(s,2,61);
 assert.equal(columnWidth(s,1),208);assert.equal(rowHeight(s,2),61);
 const {x,y}=gridGeometry(s);
 assert.deepEqual(x.slice(0,4),[54,170,378,494]);
 assert.deepEqual(y.slice(0,5),[31,60,89,150,179]);
 assert.equal(firstVisibleIndex(x,170),1);
 assert.equal(firstVisibleIndex(y,90),2);
});
test('invalid size and malicious archive metadata rejected',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 for(const n of [0,47,521,Infinity,45.5])assert.throws(()=>setColumnWidth(s,0,n));
 for(const n of [0,21,161,33.5])assert.throws(()=>setRowHeight(s,0,n));
 s.columnWidths={'-1':116};assert.throws(()=>validateWorkbook(b));
 s.columnWidths={};s.rowHeights={'100000':50};assert.throws(()=>validateWorkbook(b));
});
test('.qbook stores sizes without losing old document compatibility',()=>{
 const b=newWorkbook(),s=currentSheet(b);setColumnWidth(s,0,180);setRowHeight(s,9,75);
 const restored=decodeBook(encodeBook(b)).sheets[0];
 assert.equal(columnWidth(restored,0),180);
 assert.equal(rowHeight(restored,9),75);
 const legacy=newWorkbook();delete legacy.sheets[0].columnWidths;delete legacy.sheets[0].rowHeights;
 assert.doesNotThrow(()=>validateWorkbook(legacy));
});
test('XLSX exports actual <cols> and customHeight metadata',async()=>{
 const b=newWorkbook(),s=currentSheet(b);setColumnWidth(s,0,180);setRowHeight(s,9,75);
 const data=await exportXLSX(b);const zip=await globalThis.JSZip.loadAsync(data);
 const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
 assert.match(xml,/<cols><col min="1" max="1" width="25.00" customWidth="1"\/><\/cols>/);
 assert.match(xml,/<row r="10" ht="56.25" customHeight="1">/);
});
