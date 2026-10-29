import test from 'node:test';
import assert from 'node:assert/strict';
import {
 LIMITS,newWorkbook,currentSheet,setCell,setStyle,getCell,validateWorkbook,
 gridGeometry,firstVisibleIndex,setRowHeight,setHidden,setAutoFilter,setFilterValue,
 setWholeSheetAlignment,valuesTSV,exportCSV,importCSV,clearFormatting
} from '../src/core/workbook.js';
import {formulaContext,rawMap,resultOf} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
import {exportXLSX} from '../src/core/xlsx.js';

test('100,000 row grid uses a cached compact prefix map, not 10 million cell instances',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 assert.equal(LIMITS.rows,100000);
 const first=gridGeometry(s);
 assert.equal(first.y.length,100001);
 assert.equal(first.x.length,101);
 assert.equal(first.y[100000],31+100000*29);
 assert.equal(Object.keys(s.cells).length,0);
 assert.equal(gridGeometry(s),first);
 assert.equal(firstVisibleIndex(first.y,first.y[99999]+4),99999);
 setRowHeight(s,99999,75);
 const second=gridGeometry(s);
 assert.notEqual(first,second);
 assert.equal(second.y[100000],first.y[100000]+46);
 setHidden(s,'row',99998,true);
 const third=gridGeometry(s);
 assert.notEqual(third,second);
 assert.equal(third.y[100000],second.y[100000]-29);
 setHidden(s,'row',99998,false);
 assert.equal(gridGeometry(s).y[100000],second.y[100000]);
 validateWorkbook(b);
});
test('last row roundtrips native qbook and holds direct formula dependencies',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A100000','41');
 setCell(s,'B100000','=A100000+1');
 setStyle(s,'B100000',{bg:'#aabbcc',bold:true});
 setWholeSheetAlignment(s,'center');
 const map=rawMap(s),ctx=formulaContext(b,s,map);
 assert.equal(resultOf(s,'B100000',map,ctx),42);
 assert.equal(Object.keys(s.cells).length,2);
 const restored=decodeBook(encodeBook(b));
 assert.equal(getCell(restored.sheets[0],'A100000').value,'41');
 assert.equal(getCell(restored.sheets[0],'B100000').value,'=A100000+1');
 assert.equal(restored.sheets[0].defaultAlign,'center');
 assert.throws(()=>setCell(s,'A100001','wrong'),/диапазона/);
 validateWorkbook(restored);
});
test('high-row filter and grid visibility cache invalidate without scanning cells on every draw',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A99999','да');setCell(s,'A100000','нет');
 setAutoFilter(s,'A99998','A100000');
 setFilterValue(s,0,'да');
 const g=gridGeometry(s),total=g.y[100000];
 assert.equal(g.y[100000]-g.y[99999],0);
 assert.equal(gridGeometry(s),g);
 setCell(s,'A100000','да');
 const changed=gridGeometry(s);
 assert.notEqual(g,changed);
 assert.equal(changed.y[100000]-changed.y[99999],29);
 assert.equal(changed.y[100000],total+29);
});
test('CSV dense expansion fails safely; sparse XLSX writes only actual cells in far row',async()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'Z100000','дальний');
 assert.throws(()=>exportCSV(s,b),/250 000/);
 assert.throws(()=>valuesTSV(s,'A1','CV100000',b),/20 000/);
 assert.throws(()=>clearFormatting(s,'A1','CV100000'),/10 000/);
 assert.equal(getCell(s,'Z100000').value,'дальний');
 const zip=await globalThis.JSZip.loadAsync(await exportXLSX(b),{checkCRC32:true});
 const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
 assert.match(xml,/<row r="100000"/);
 assert.match(xml,/r="Z100000"/);
 assert.equal((xml.match(/<c /g)||[]).length,1);
 const imported=importCSV('Заголовок\nЗначение');
 assert.equal(getCell(imported.sheets[0],'A2').value,'Значение');
});
