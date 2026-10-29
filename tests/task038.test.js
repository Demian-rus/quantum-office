import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,setRectangleStyle,getCell,getEffectiveStyle} from '../src/core/workbook.js';
import {exportXLSX,MAX_XLSX_RECTANGLE_CELLS} from '../src/core/xlsx.js';

test('Excel XLSX writes real style-only cells for 180k virtual cells while original remains sparse',async()=>{
 const book=newWorkbook(),s=currentSheet(book);
 setCell(s,'B50000','=1+2');setRectangleStyle(s,'B100','C90000',{bg:'#aabbcc'});
 const before=JSON.stringify(book);
 const zipped=await exportXLSX(book);
 const xml=await (await globalThis.JSZip.loadAsync(zipped,{checkCRC32:true})).file('xl/worksheets/sheet1.xml').async('string');
 assert.match(xml,/<c r="B100" s="\d+"\/>/);
 assert.match(xml,/<c r="C90000" s="\d+"\/>/);
 assert.match(xml,/<c r="B50000" s="\d+"><f>1\+2<\/f><\/c>/);
 assert.ok((xml.match(/<c /g)||[]).length>170000);
 assert.equal(getCell(s,'B50000').value,'=1+2');
 assert.equal(Object.keys(s.cells).length,1);
 assert.equal(JSON.stringify(book),before,'XLSX export mutated native workbook');
});
test('huge overlapping rectangles fail before output without losing native values',async()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'B50000','Исходное');
 setRectangleStyle(s,'B100','D90000',{bg:'#abcdef'});
 const before=JSON.stringify(b);
 assert.equal(MAX_XLSX_RECTANGLE_CELLS,200000);
 await assert.rejects(exportXLSX(b),/200 000.*\.qbook/);
 assert.equal(JSON.stringify(b),before);
 assert.equal(getEffectiveStyle(s,'C80000').bg,'#abcdef');
});
