import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,setStyle,getCell,validateWorkbook,FONT_FAMILIES,setRowHeight,setColumnWidth,gridGeometry} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
import {styleXML} from '../src/core/xlsx.js';

test('TASK072: fonts are real model styles, validated and serialized in QBOOK and Excel style XML',()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 assert(FONT_FAMILIES.includes('Georgia'));
 setCell(sheet,'B4','Проверка');
 setStyle(sheet,'B4',{fontFamily:'Georgia',fontSize:16,bold:true});
 validateWorkbook(book);
 const loaded=decodeBook(encodeBook(book));
 assert.equal(loaded.sheets[0].cells.B4.style.fontFamily,'Georgia');
 const xml=styleXML({unique:[{}, {fontFamily:'Georgia',fontSize:16,bold:true}],dxfColors:[]});
 assert.match(xml,/<name val="Georgia"\/>/);
 const broken=structuredClone(book);
 broken.sheets[0].cells.B4.style.fontFamily='Untrusted CSS';
 assert.throws(()=>validateWorkbook(broken),/оформление/);
});
test('TASK072: check states are ordinary portable cell values with QBOOK roundtrip',()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 setCell(sheet,'C9','☐');setStyle(sheet,'C9',{align:'center'});
 setCell(sheet,'D9','☑');setStyle(sheet,'D9',{align:'center'});
 validateWorkbook(book);
 const next=decodeBook(encodeBook(book));
 assert.equal(next.sheets[0].cells.C9.value,'☐');
 assert.equal(next.sheets[0].cells.D9.value,'☑');
});
test('TASK072: default dimensions compactly affect every virtual row/column',()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 setRowHeight(sheet,765,60);setColumnWidth(sheet,8,220);
 sheet.defaultRowHeight=34;sheet.defaultColumnWidth=145;
 sheet.rowHeights={};sheet.columnWidths={};
 validateWorkbook(book);
 assert.equal(gridGeometry(sheet).y[1000],31+1000*34);
 assert.equal(gridGeometry(sheet).x[100],54+100*145);
 assert.equal(Object.keys(sheet.rowHeights).length,0);
 const restored=decodeBook(encodeBook(book));
 assert.equal(restored.sheets[0].defaultRowHeight,34);
 assert.equal(restored.sheets[0].defaultColumnWidth,145);
});
