import test from 'node:test';
import assert from 'node:assert/strict';
import {
 newWorkbook,currentSheet,setCell,setStyle,getCell,mergeCells,clearCellValues,
 clearFormatting,applyBorderPreset,setWholeSheetAlignment,validateWorkbook
} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
import {exportXLSX} from '../src/core/xlsx.js';

test('sparse full-sheet Delete clears 10m selected positions without creating cells or losing formatting',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A1','верх');setCell(s,'A50000','=A1&"!"');setCell(s,'CV100000','низ');
 setStyle(s,'A50000',{bg:'#aabbcc',bold:true});
 setStyle(s,'D7',{bg:'#112233'});
 const before=structuredClone(b);
 assert.equal(clearCellValues(s,'A1','CV100000',true),3);
 assert.deepEqual(s,b.sheets[0]);
 assert.equal(clearCellValues(s,'A1','CV100000'),3);
 assert.equal(getCell(s,'A1').value,'');
 assert.equal(getCell(s,'A50000').value,'');
 assert.deepEqual(getCell(s,'A50000').style,{bg:'#aabbcc',bold:true});
 assert.equal(getCell(s,'CV100000').value,'');
 assert.equal(getCell(s,'D7').style.bg,'#112233');
 assert.equal(Object.keys(s.cells).length,2);
 assert.equal(clearCellValues(s,'A1','CV100000'),0);
 assert.equal(before.sheets[0].cells.CV100000.value,'низ');
 validateWorkbook(b);
});
test('sparse bulk Delete only removes selected column, respects merges and keeps formulas elsewhere',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A50000','a');setCell(s,'B50000','b');setCell(s,'C99999','=B50000');
 mergeCells(s,'D1','E3');setCell(s,'D1','объединено');
 assert.equal(clearCellValues(s,'B1','B100000'),1);
 assert.equal(getCell(s,'A50000').value,'a');
 assert.equal(getCell(s,'C99999').value,'=B50000');
 assert.equal(getCell(s,'D1').value,'объединено');
 assert.deepEqual(s.merges,[{from:'D1',to:'E3'}]);
 assert.throws(()=>clearCellValues(s,'A0','B100000'),/Недопустимый/);
 assert.equal(getCell(s,'A50000').value,'a');
});
test('clear formats over whole sheet removes sparse style entries and inherited default align',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setWholeSheetAlignment(s,'center');
 setCell(s,'A50000','важно');setStyle(s,'A50000',{bg:'#abcdef',wrap:true});
 setStyle(s,'CV100000',{bold:true});
 const previous=structuredClone(s);
 assert.equal(clearFormatting(s,'A1','CV100000',true),3);
 assert.deepEqual(s,previous);
 assert.equal(clearFormatting(s,'A1','CV100000'),3);
 assert.equal(s.defaultAlign,null);
 assert.equal(getCell(s,'A50000').value,'важно');
 assert.deepEqual(getCell(s,'A50000').style,{});
 assert.equal(s.cells.CV100000,undefined);
 assert.equal(clearFormatting(s,'A1','CV100000'),0);
 assert.equal(decodeBook(encodeBook(b)).sheets[0].defaultAlign,null);
});
test('clear formatting a far away subset preserves sheet-wide align and other cells',()=>{
 const s=currentSheet(newWorkbook());
 setWholeSheetAlignment(s,'right');
 setCell(s,'A5','сохранить');setStyle(s,'A5',{bold:true});
 setCell(s,'B99999','очистить');setStyle(s,'B99999',{bg:'#abcdef'});
 assert.equal(clearFormatting(s,'B90000','B100000'),1);
 assert.equal(s.defaultAlign,'right');
 assert.equal(getCell(s,'A5').style.bold,true);
 assert.equal(getCell(s,'B99999').value,'очистить');
 assert.deepEqual(getCell(s,'B99999').style,{});
});
test('no borders removes only populated border styles in a 10m selection and keeps other formatting',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A1','верх');
 setStyle(s,'A1',{border:'thin',bg:'#eeddcc'});
 setStyle(s,'A50000',{borders:{left:true,right:true}});
 setStyle(s,'CV100000',{border:'thin',bold:true});
 const before=structuredClone(s);
 assert.equal(applyBorderPreset(s,'A1','CV100000','none'),3);
 assert.equal(Object.keys(s.cells).length,2);
 assert.equal(getCell(s,'A1').value,'верх');
 assert.deepEqual(getCell(s,'A1').style,{bg:'#eeddcc'});
 assert.deepEqual(getCell(s,'CV100000').style,{bold:true});
 assert.equal(s.cells.A50000,undefined);
 assert.equal(applyBorderPreset(s,'A1','CV100000','none'),0);
 assert.throws(()=>applyBorderPreset(s,'A1','CV100000','all'),/10 000/);
 assert.equal(before.cells.A50000.style.borders.left,true);
 validateWorkbook(b);
});
test('bulk-clear state roundtrips in native and XLSX exports without expanding empty range',async()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A1','удалить');setCell(s,'CV100000','оставить');
 setStyle(s,'A1',{bg:'#abcdef'});
 clearCellValues(s,'A1','A99999');setWholeSheetAlignment(s,'left');
 const native=decodeBook(encodeBook(b)).sheets[0];
 assert.equal(native.cells.A1.value,'');
 assert.equal(native.cells.A1.style.bg,'#abcdef');
 assert.equal(native.cells.CV100000.value,'оставить');
 const zip=await globalThis.JSZip.loadAsync(await exportXLSX(b),{checkCRC32:true});
 const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
 assert.match(xml,/r="CV100000"/);
 assert.ok((xml.match(/<c /g)||[]).length<=2);
});
