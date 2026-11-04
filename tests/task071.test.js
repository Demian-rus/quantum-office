import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,setTypedCell,setStyle,getCell,
 extendFillHandle,validateWorkbook,displayedValue} from '../src/core/workbook.js';
import {dateSerial} from '../src/core/dates.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

const setup=()=>{const book=newWorkbook(),sheet=currentSheet(book);return {book,sheet};};

test('TASK071: numeric series extrapolates upward and leftward, with original cells unchanged',()=>{
 const {sheet}=setup();
 setCell(sheet,'B4','2');setCell(sheet,'B5','5');
 const up=extendFillHandle(sheet,'B4','B5','up',0);
 assert.deepEqual(up,{count:3,from:'B1',to:'B5',mode:'values'});
 assert.deepEqual(['B1','B2','B3','B4','B5'].map(ref=>getCell(sheet,ref).value),['-7','-4','-1','2','5']);
 setCell(sheet,'D8','10');setCell(sheet,'E8','15');setStyle(sheet,'D8',{bold:true});
 const left=extendFillHandle(sheet,'D8','E8','left',0);
 assert.equal(left.count,3);
 assert.deepEqual(['A8','B8','C8'].map(ref=>getCell(sheet,ref).value),['-5','0','5']);
 assert.equal(getCell(sheet,'B8').style.bold,true);
});
test('TASK071: reversed formula drag respects relative, absolute and mixed references',()=>{
 const {sheet}=setup();
 setCell(sheet,'D5','=C5+$A$1+B$2+$B5');
 extendFillHandle(sheet,'D5','D5','up',2);
 assert.equal(getCell(sheet,'D4').value,'=C4+$A$1+B$2+$B4');
 assert.equal(getCell(sheet,'D3').value,'=C3+$A$1+B$2+$B3');
 setCell(sheet,'E7','=D7+$A$1');
 extendFillHandle(sheet,'E7','E7','left',2);
 assert.equal(getCell(sheet,'D7').value,'=C7+$A$1');
 assert.equal(getCell(sheet,'C7').value,'=B7+$A$1');
});
test('TASK071: reversed multi-row and cyclic text fill copies the correct source style',()=>{
 const {sheet}=setup();
 setCell(sheet,'C4','первый');setCell(sheet,'D4','второй');
 setCell(sheet,'C5','третий');setCell(sheet,'D5','четвёртый');
 setStyle(sheet,'D4',{italic:true});
 extendFillHandle(sheet,'C4','D5','left',0);
 assert.equal(getCell(sheet,'B4').value,'второй');
 assert.equal(getCell(sheet,'A4').value,'первый');
 assert.equal(getCell(sheet,'B5').value,'четвёртый');
 assert.equal(getCell(sheet,'B4').style.italic,true);
});
test('TASK071: one date continues across month/year and leap day in both directions',()=>{
 const {book,sheet}=setup();
 setTypedCell(sheet,'F2','2026-12-31');
 const next=extendFillHandle(sheet,'F2','F2','down',3);
 assert.equal(next.mode,'date');
 assert.equal(getCell(sheet,'F3').value,String(dateSerial(2027,1,1)));
 assert.equal(getCell(sheet,'F4').value,String(dateSerial(2027,1,2)));
 assert.equal(displayedValue(sheet,'F3'), '01.01.2027');
 setTypedCell(sheet,'G5','2028-03-01');
 extendFillHandle(sheet,'G5','G5','up',2);
 assert.equal(getCell(sheet,'G4').value,String(dateSerial(2028,2,29)));
 assert.equal(getCell(sheet,'G3').value,String(dateSerial(2028,2,28)));
 validateWorkbook(book);
 const copy=decodeBook(encodeBook(book));
 assert.equal(copy.sheets[0].cells.G4.value,String(dateSerial(2028,2,29)));
 assert.equal(copy.sheets[0].cells.G4.style.format,'date');
});
test('TASK071: two dates preserve a weekly interval when dragging left',()=>{
 const {sheet}=setup();
 setTypedCell(sheet,'G2','2026-11-13');setTypedCell(sheet,'H2','2026-11-20');
 extendFillHandle(sheet,'G2','H2','left',4);
 assert.equal(getCell(sheet,'F2').value,String(dateSerial(2026,11,6)));
 assert.equal(getCell(sheet,'E2').value,String(dateSerial(2026,10,30)));
});
test('TASK071: invalid date underflow and other guarded writes leave every source cell untouched',()=>{
 const {sheet}=setup();setTypedCell(sheet,'D3','1900-01-01');
 const before=JSON.stringify(sheet.cells);
 assert.throws(()=>extendFillHandle(sheet,'D3','D3','up',1),/Дата выходит/);
 assert.equal(JSON.stringify(sheet.cells),before);
 sheet.hiddenColumns={1:true};
 assert.throws(()=>extendFillHandle(sheet,'D3','D3','left',0),/скрытые/);
 assert.equal(JSON.stringify(sheet.cells),before);
 sheet.hiddenColumns={};
 // Use a non-date source so the validation check, not date underflow, is exercised.
 setCell(sheet,'D3','no');
 const beforeValidation=JSON.stringify(sheet.cells);
 sheet.validations=[{id:'v1',from:'B3',to:'B3',kind:'list',options:['yes']}];
 assert.throws(()=>extendFillHandle(sheet,'D3','D3','left',0),/Недопустимое значение/);
 assert.equal(JSON.stringify(sheet.cells),beforeValidation);
});
test('TASK071: high cardinality and edge cases are rejected without partial mutation',()=>{
 const {sheet}=setup();setCell(sheet,'B2','12');const before=JSON.stringify(sheet.cells);
 assert.throws(()=>extendFillHandle(sheet,'B2','B2','up',-1));
 assert.throws(()=>extendFillHandle(sheet,'B2','B2','left',1),/выше или левее/);
 assert.throws(()=>extendFillHandle(sheet,'B2','B2','down',100000));
 assert.throws(()=>extendFillHandle(sheet,'B2','B2','left',-999999));
 assert.equal(JSON.stringify(sheet.cells),before);
});
