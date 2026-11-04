import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,setStyle,getCell,extendFillHandle,validateWorkbook} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

const prepare=values=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 for(const [ref,value] of Object.entries(values))setCell(sheet,ref,value);
 return {book,sheet};
};
const check=(sheet,expected)=>{
 for(const [ref,value] of Object.entries(expected))assert.equal(getCell(sheet,ref).value,value,ref);
};

test('TASK125: ISO dates cross leap day and month boundary',()=>{
 const {book,sheet}=prepare({A1:'2024-02-28'});
 extendFillHandle(sheet,'A1','A1','down',3);
 check(sheet,{A2:'2024-02-29',A3:'2024-03-01',A4:'2024-03-02'});
 validateWorkbook(book);
 assert.equal(decodeBook(encodeBook(book)).sheets[0].cells.A3.value,'2024-03-01');
});
test('TASK125: ISO dates infer weekly step from two seeds',()=>{
 const {sheet}=prepare({A1:'2026-11-03',A2:'2026-11-10'});
 extendFillHandle(sheet,'A1','A2','down',3);
 check(sheet,{A3:'2026-11-17',A4:'2026-11-24'});
});
test('TASK125: Russian abbreviated weekdays wrap and retain capitalisation',()=>{
 const {sheet}=prepare({A1:'Сб'});
 extendFillHandle(sheet,'A1','A1','down',3);
 check(sheet,{A2:'Вс',A3:'Пн',A4:'Вт'});
});
test('TASK125: Full month names wrap December to January',()=>{
 const {sheet}=prepare({A1:'Ноябрь'});
 extendFillHandle(sheet,'A1','A1','down',3);
 check(sheet,{A2:'Декабрь',A3:'Январь',A4:'Февраль'});
});
test('TASK125: Copy mode does not infer named sequences',()=>{
 const {sheet}=prepare({A1:'Пн',A2:'Вт'});
 extendFillHandle(sheet,'A1','A2','down',3,'copy');
 check(sheet,{A3:'Пн',A4:'Вт'});
});
test('TASK125: Only formats preserves destination values',()=>{
 const {sheet}=prepare({A1:'QX-001',A2:'OLD',A3:'UNTOUCHED'});
 setStyle(sheet,'A1',{bold:true});
 setStyle(sheet,'A2',{italic:true});
 extendFillHandle(sheet,'A1','A1','down',2,'formats');
 check(sheet,{A2:'OLD',A3:'UNTOUCHED'});
 assert.equal(getCell(sheet,'A2').style.bold,true);
 assert.equal(getCell(sheet,'A2').style.italic,undefined);
});
test('TASK125: Values-only continues IDs but keeps existing destination style',()=>{
 const {sheet}=prepare({A1:'QX-001',A2:'QX-002',A3:'old'});
 setStyle(sheet,'A1',{bold:true});
 setStyle(sheet,'A3',{italic:true});
 extendFillHandle(sheet,'A1','A2','down',2,'values');
 check(sheet,{A3:'QX-003'});
 assert.equal(getCell(sheet,'A3').style.italic,true);
 assert.equal(getCell(sheet,'A3').style.bold,undefined);
});
test('TASK125: Formats-only bypasses validation on unchanged values',()=>{
 const {sheet}=prepare({A1:'OK',A2:'old'});
 setStyle(sheet,'A1',{bold:true});
 sheet.validations=[{id:'x',from:'A2',to:'A2',kind:'list',options:['OTHER']}];
 extendFillHandle(sheet,'A1','A1','down',1,'formats');
 check(sheet,{A2:'old'});
 assert.equal(getCell(sheet,'A2').style.bold,true);
});
test('TASK125: Existing arithmetic and alphanumeric progressions remain supported',()=>{
 const {sheet}=prepare({A1:'QX-001',A2:'QX-002',B1:'5',B2:'10'});
 extendFillHandle(sheet,'A1','B2','down',3);
 check(sheet,{A3:'QX-003',A4:'QX-004',B3:'15',B4:'20'});
});
test('TASK125: Unknown fill mode fails before mutation',()=>{
 const {sheet}=prepare({A1:'QX-001'});
 const before=JSON.stringify(sheet.cells);
 assert.throws(()=>extendFillHandle(sheet,'A1','A1','down',2,'unknown'),/режим/);
 assert.equal(JSON.stringify(sheet.cells),before);
});