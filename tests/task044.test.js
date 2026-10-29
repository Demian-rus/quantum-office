import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,setStyle,fillTypedSelection,getCell,mergeCells,LIMITS} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

test('Ctrl+Enter fills a rectangle, translating relative and absolute formula parts',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setStyle(s,'B2',{bg:'#88aaee'});
 setStyle(s,'C3',{bold:true});
 const n=fillTypedSelection(s,'B2','C3','=D2+$F$1+G$2+$H2');
 assert.equal(n,4);
 assert.equal(getCell(s,'B2').value,'=D2+$F$1+G$2+$H2');
 assert.equal(getCell(s,'C2').value,'=E2+$F$1+H$2+$H2');
 assert.equal(getCell(s,'B3').value,'=D3+$F$1+G$2+$H3');
 assert.equal(getCell(s,'C3').value,'=E3+$F$1+H$2+$H3');
 assert.equal(getCell(s,'B2').style.bg,'#88aaee');
 assert.equal(getCell(s,'C3').style.bold,true);
 const reopened=decodeBook(encodeBook(b));
 assert.equal(getCell(currentSheet(reopened),'C3').value,'=E3+$F$1+H$2+$H3');
});
test('scalar Ctrl+Enter preserves per-cell formatting and parsed number/date types',()=>{
 const s=currentSheet(newWorkbook());
 setCell(s,'B2','before');setStyle(s,'C3',{bg:'#facc15'});
 assert.equal(fillTypedSelection(s,'B2','C3','Занятие'),4);
 assert.equal(getCell(s,'B2').value,'Занятие');
 assert.equal(getCell(s,'C3').value,'Занятие');
 assert.equal(getCell(s,'C3').style.bg,'#facc15');
});
test('merge, excessive area and invalid contents reject with zero partial writes',()=>{
 const s=currentSheet(newWorkbook());
 setCell(s,'A1','keep');
 mergeCells(s,'C3','D4');
 const before=JSON.stringify(s);
 assert.throws(()=>fillTypedSelection(s,'A1','D4','blocked'),/объединённые/);
 assert.equal(JSON.stringify(s),before);
 assert.throws(()=>fillTypedSelection(s,'A1','CV100000','large'),/10 000/);
 assert.equal(JSON.stringify(s),before);
 assert.throws(()=>fillTypedSelection(s,'A1','B2',3),/содержимое/);
 assert.equal(JSON.stringify(s),before);
 assert.throws(()=>fillTypedSelection(s,'A1','B2','a'.repeat(50001)),/содержимое/);
 assert.equal(JSON.stringify(s),before);
});
test('global populated-cell bound is checked before writing any selection cell',()=>{
 const s=currentSheet(newWorkbook());
 for(let r=0;r<500;r++)for(let c=0;c<100;c++)s.cells[String.fromCharCode(65+c%26)+(r+1)]=s.cells[String.fromCharCode(65+c%26)+(r+1)]||{value:'x',style:{}};
 // Construct 49,999 distinct real references without allocating a dense 100k-row sheet.
 const alphabet=i=>{let t='';for(let j=i+1;j>0;j=Math.floor((j-1)/26))t=String.fromCharCode(65+(j-1)%26)+t;return t;};
 s.cells={};for(let r=0;r<500;r++)for(let c=0;c<100;c++)if(!(r===499&&c===99))s.cells[alphabet(c)+(r+1)]={value:'x',style:{}};
 const before=Object.keys(s.cells).length;
 assert.equal(before,49999);
 assert.throws(()=>fillTypedSelection(s,'A501','B501','new'),/50 000/);
 assert.equal(Object.keys(s.cells).length,before);
 assert.equal(getCell(s,'A501').value,'');
});
