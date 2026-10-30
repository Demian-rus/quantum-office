import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,setStyle,getCell,extendFillHandle,validateWorkbook} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
const make=()=>{const book=newWorkbook(),sheet=currentSheet(book);return {book,sheet};};
test('TASK070: 2-number arithmetic series continues down with clean integer values',()=>{
 const {book,sheet}=make();setCell(sheet,'B2','2');setCell(sheet,'B3','5');setStyle(sheet,'B2',{bold:true});
 const result=extendFillHandle(sheet,'B2','B3','down',6);
 assert.deepEqual(result,{count:3,from:'B2',to:'B6',mode:'values'});
 assert.deepEqual(['B2','B3','B4','B5','B6'].map(ref=>getCell(sheet,ref).value),['2','5','8','11','14']);
 assert.equal(getCell(sheet,'B4').style.bold,true);
 validateWorkbook(book);assert.equal(decodeBook(encodeBook(book)).sheets[0].cells.B6.value,'14');
});
test('TASK070: two horizontally supplied numbers continue arithmetic progression to the right',()=>{
 const {sheet}=make();setCell(sheet,'B4','-1');setCell(sheet,'C4','-0.5');
 extendFillHandle(sheet,'B4','C4','right',5);
 assert.equal(getCell(sheet,'D4').value,'0');assert.equal(getCell(sheet,'E4').value,'0.5');
});
test('TASK070: single numerical source repeats; two text entries cycle, preserving formatting',()=>{
 const {sheet}=make();setCell(sheet,'C2','42');setCell(sheet,'D2','A');setCell(sheet,'D3','B');
 extendFillHandle(sheet,'C2','C2','down',4);
 assert.deepEqual(['C3','C4'].map(x=>getCell(sheet,x).value),['42','42']);
 setStyle(sheet,'D3',{italic:true});
 extendFillHandle(sheet,'D2','D3','down',6);
 assert.deepEqual(['D4','D5','D6'].map(x=>getCell(sheet,x).value),['A','B','A']);
 assert.equal(getCell(sheet,'D5').style.italic,true);
});
test('TASK070: formulas move with relative, absolute and mixed references',()=>{
 const {sheet}=make();setCell(sheet,'B2','=A2+$C$1+C$2+$D2');
 const r=extendFillHandle(sheet,'B2','B2','down',4);
 assert.equal(r.mode,'formula');
 assert.equal(getCell(sheet,'B3').value,'=A3+$C$1+C$2+$D3');
 assert.equal(getCell(sheet,'B4').value,'=A4+$C$1+C$2+$D4');
});
test('TASK070: multiple source columns independently continue two numeric sequences',()=>{
 const {sheet}=make();
 for(const [ref,value] of Object.entries({A1:'3',A2:'4',B1:'10',B2:'20'}))setCell(sheet,ref,value);
 const out=extendFillHandle(sheet,'A1','B2','down',4);
 assert.equal(out.count,4);
 assert.deepEqual(['A3','A4','B3','B4'].map(x=>getCell(sheet,x).value),['5','6','30','40']);
});
test('TASK070: invalid references, merged cells and hidden rows fail before any mutation',()=>{
 const {sheet}=make();setCell(sheet,'A2','=A1');const before=JSON.stringify(sheet.cells);
 assert.throws(()=>extendFillHandle(sheet,'A2','A2','down',100000),/ниже|предел/);
 sheet.merges=[{from:'A3',to:'B3'}];
 assert.throws(()=>extendFillHandle(sheet,'A2','A2','down',4),/объединённые/);
 sheet.merges=[];sheet.hiddenRows={2:true};
 assert.throws(()=>extendFillHandle(sheet,'A2','A2','down',4),/скрытые/);
 assert.equal(JSON.stringify(sheet.cells),before);
});
test('TASK070: formula failing near top boundary cannot partially overwrite a range',()=>{
 const {sheet}=make();
 setCell(sheet,'B1','=A1');setCell(sheet,'B2','=B1');
 const original=JSON.stringify(sheet.cells);
 // Deliberately invalid target column is rejected before commit.
 assert.throws(()=>extendFillHandle(sheet,'B1','B2','right',999),/превыш|предел|Автозаполнение/);
 assert.equal(JSON.stringify(sheet.cells),original);
});
test('TASK070: validation on one destination rejects entire fill without partial changes',()=>{
 const {sheet}=make();
 setCell(sheet,'B2','no');setCell(sheet,'B3','no');
 sheet.validations=[{id:'v1',from:'B5',to:'B5',kind:'list',options:['yes','okay']}];
 const prior=JSON.stringify(sheet.cells);
 assert.throws(()=>extendFillHandle(sheet,'B2','B3','down',5),/Недопустимое значение/);
 assert.equal(JSON.stringify(sheet.cells),prior);
});
test('TASK070: disallow malformed targets, unlimited fill sizes and unsupported directions',()=>{
 const {sheet}=make();setCell(sheet,'B2','2');
 assert.throws(()=>extendFillHandle(sheet,'B2','B2','down',1),/ниже или правее/);
 assert.throws(()=>extendFillHandle(sheet,'B2','B2','diagonal',3),/направление/);
 assert.throws(()=>extendFillHandle(sheet,'B2','B2','down',10050),/10 000/);
});
