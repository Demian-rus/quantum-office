import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,getCell,setCell,setStyle,fillSelection,
 fillAreasDirection,mergeCells,validateWorkbook} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

function blank(){const book=newWorkbook();return {book,sheet:currentSheet(book)};}
test('TASK074: fill up translates formulas from bottom edge and preserves styles',()=>{
 const {book,sheet}=blank();
 setCell(sheet,'B5','=A5+$D$1');setStyle(sheet,'B5',{bold:true,color:'#123456'});
 assert.equal(fillSelection(sheet,'B3','B5','up'),2);
 assert.equal(getCell(sheet,'B3').value,'=A3+$D$1');
 assert.equal(getCell(sheet,'B4').value,'=A4+$D$1');
 assert.equal(getCell(sheet,'B5').value,'=A5+$D$1');
 assert.equal(getCell(sheet,'B3').style.color,'#123456');
 validateWorkbook(book);
 const restored=decodeBook(encodeBook(book));
 assert.equal(restored.sheets[0].cells.B4.value,'=A4+$D$1');
});
test('TASK074: fill left copies rightmost formula and literal data accurately',()=>{
 const {sheet}=blank();
 setCell(sheet,'E8','=D8+$A8');
 setStyle(sheet,'E8',{italic:true});
 assert.equal(fillSelection(sheet,'B8','E8','left'),3);
 assert.equal(getCell(sheet,'B8').value,'=A8+$A8');
 assert.equal(getCell(sheet,'C8').value,'=B8+$A8');
 assert.equal(getCell(sheet,'D8').value,'=C8+$A8');
 assert.equal(getCell(sheet,'D8').style.italic,true);
 setCell(sheet,'D10','готово');
 fillSelection(sheet,'B10','D10','left');
 assert.equal(getCell(sheet,'B10').value,'готово');
});
test('TASK074: multi-range directional fill is atomic, preserves unrelated cells',()=>{
 const {sheet}=blank();
 setCell(sheet,'B3','один');setCell(sheet,'E7','два');setCell(sheet,'H10','не менять');
 const n=fillAreasDirection(sheet,[{from:'B2',to:'B3'},{from:'E6',to:'E7'}],'up');
 assert.equal(n,2);
 assert.equal(getCell(sheet,'B2').value,'один');
 assert.equal(getCell(sheet,'E6').value,'два');
 assert.equal(getCell(sheet,'H10').value,'не менять');
 const snapshot=JSON.stringify(sheet.cells);
 assert.throws(()=>fillAreasDirection(sheet,[{from:'A1',to:'A3'},{from:'A3',to:'A5'}],'up'),/Пересекающиеся/);
 assert.equal(JSON.stringify(sheet.cells),snapshot);
});
test('TASK074: invalid direction, short source and merged range do not partially write',()=>{
 const {sheet}=blank();
 setCell(sheet,'C4','число');
 assert.throws(()=>fillSelection(sheet,'C4','C4','up'),/хотя бы две строки/);
 assert.throws(()=>fillSelection(sheet,'C4','C4','left'),/хотя бы два столбца/);
 assert.throws(()=>fillSelection(sheet,'B4','C4','sideways'),/Неподдерживаемое/);
 mergeCells(sheet,'D7','E7');
 const prior=JSON.stringify(sheet.cells);
 assert.throws(()=>fillSelection(sheet,'C7','E7','left'),/объединённых ячеек/);
 assert.equal(JSON.stringify(sheet.cells),prior);
});
