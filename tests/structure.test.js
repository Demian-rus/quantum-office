import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,setStyle,getCell,setFreeze,setAutoFilter,setColumnWidth,setRowHeight,resultOf,validateWorkbook,LIMITS} from '../src/core/workbook.js';
import {changeSheetStructure,rewriteStructureFormula} from '../src/core/structure.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
import {exportXLSX} from '../src/core/xlsx.js';

test('insert row shifts cells, styles, dimensions, and $ anchors',()=>{
 const book=newWorkbook(),s=currentSheet(book);
 setCell(s,'A1','Header');setCell(s,'A2','12');setCell(s,'B3','=A2+$A$2');setStyle(s,'B3',{bold:true});setRowHeight(s,1,55);setFreeze(s,2,0);
 changeSheetStructure(s,'row','insert',1);
 assert.equal(getCell(s,'A2').value,'');assert.equal(getCell(s,'A3').value,'12');
 assert.equal(getCell(s,'B4').value,'=A3+$A$3');assert.equal(resultOf(s,'B4'),24);
 assert.equal(getCell(s,'B4').style.bold,true);assert.equal(s.rowHeights[2],55);
 assert.equal(s.freeze.rows,3);validateWorkbook(book);
 assert.equal(decodeBook(encodeBook(book)).sheets[0].cells.B4.value,'=A3+$A$3');
});
test('insert column shifts formula references and column widths',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'B1','5');setCell(s,'C1','=B1+$B$1');setColumnWidth(s,1,188);setFreeze(s,0,2);
 changeSheetStructure(s,'col','insert',1);
 assert.equal(getCell(s,'C1').value,'5');assert.equal(getCell(s,'D1').value,'=C1+$C$1');
 assert.equal(resultOf(s,'D1'),10);assert.equal(s.columnWidths[2],188);assert.equal(s.freeze.cols,3);
});
test('delete row preserves remaining cells but references to deleted row become explicit #REF!',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'A1','11');setCell(s,'A2','22');setCell(s,'A3','33');setCell(s,'B3','=A2+A3');
 changeSheetStructure(s,'row','delete',1);
 assert.equal(getCell(s,'A2').value,'33');assert.equal(getCell(s,'A3').value,'');
 assert.equal(getCell(s,'B2').value,'=#REF!+A2');assert.equal(resultOf(s,'B2'),'#REF!');
});
test('delete column moves remaining data and updates formulas and frozen pane',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'A1','4');setCell(s,'B1','5');setCell(s,'C1','=A1+B1');setFreeze(s,0,2);
 changeSheetStructure(s,'col','delete',0);
 assert.equal(getCell(s,'A1').value,'5');assert.equal(getCell(s,'B1').value,'=#REF!+A1');assert.equal(s.freeze.cols,1);
});
test('insert rejects occupied boundary and preserves all cells and metadata',()=>{
 const s=currentSheet(newWorkbook());setCell(s,`A${LIMITS.rows}`,'END');setCell(s,'B1','=A1');
 const old=structuredClone(s);assert.throws(()=>changeSheetStructure(s,'row','insert',0),/Последняя/);assert.deepEqual(s,old);
 const s2=currentSheet(newWorkbook());setColumnWidth(s2,LIMITS.columns-1,125);const original=structuredClone(s2);
 assert.throws(()=>changeSheetStructure(s2,'col','insert',0),/последняя|Последняя/);assert.deepEqual(s2,original);
});
test('insert rejects formula referencing last column even if cell is empty',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'A1','=CV1'); // CV is column 100 (last index 99)
 const previous=structuredClone(s);
 assert.throws(()=>changeSheetStructure(s,'col','insert',0),/Формула/);
 assert.deepEqual(s,previous);
});
test('filter active blocks structural edit without mutation',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'A1','Товар');setCell(s,'A2','Книга');setAutoFilter(s,'A1','A2');
 const before=structuredClone(s);assert.throws(()=>changeSheetStructure(s,'row','delete',1),/автофильтр/);assert.deepEqual(s,before);
});
test('insert inside 10 frozen rows is rejected before mutation',()=>{
 const s=currentSheet(newWorkbook());setFreeze(s,10,0);const prev=structuredClone(s);
 assert.throws(()=>changeSheetStructure(s,'row','insert',3),/закреплённую/);assert.deepEqual(s,prev);
});
test('invalid axis/mode/index leave the sheet intact',()=>{
 const s=currentSheet(newWorkbook());const prev=structuredClone(s);
 for(const args of [['row','append',1],['depth','insert',1],['row','insert',-1],['col','delete',101]])assert.throws(()=>changeSheetStructure(s,...args));
 assert.deepEqual(s,prev);
});
test('structural formula rewrite handles fixed rows and ranges, no rewrite for unrelated text',()=>{
 assert.equal(rewriteStructureFormula('=SUM($A$1:B3)+C4','row','insert',1),'=SUM($A$1:B4)+C5');
 assert.equal(rewriteStructureFormula('=SUM(A1:A3)','row','delete',1),'=SUM(A1:A2)'); // row deleted inside range, endpoint shifts
 assert.equal(rewriteStructureFormula('text A1','row','insert',0),'text A1');
});
test('XLSX exports shifted cells and formulas',async()=>{
 const s=currentSheet(newWorkbook());setCell(s,'A1','9');setCell(s,'B1','=A1*2');changeSheetStructure(s,'row','insert',0);
 const b=newWorkbook();b.sheets=[s];b.activeSheetId=s.id;
 const data=await exportXLSX(b);const zip=await globalThis.JSZip.loadAsync(data);const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
 assert.match(xml,/r="B2"[^>]*><f>A2\*2<\/f>/);
});
