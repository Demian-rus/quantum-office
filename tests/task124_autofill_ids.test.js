import test from 'node:test';
import assert from 'node:assert/strict';
import {
 newWorkbook,currentSheet,setCell,setStyle,getCell,extendFillHandle,validateWorkbook
} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

const setup=values=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 for(const [ref,value] of Object.entries(values))setCell(sheet,ref,value);
 return {book,sheet};
};
const values=(sheet,refs)=>refs.map(ref=>getCell(sheet,ref).value);

test('TASK124: QX-001..QX-004 continue with QX-005 and preserve style and XLSX-independent workbook roundtrip',()=>{
 const {book,sheet}=setup({A2:'QX-001',A3:'QX-002',A4:'QX-003',A5:'QX-004'});
 setStyle(sheet,'A2',{bold:true});
 const result=extendFillHandle(sheet,'A2','A5','down',7);
 assert.equal(result.count,3);
 assert.deepEqual(values(sheet,['A5','A6','A7','A8']),['QX-004','QX-005','QX-006','QX-007']);
 assert.equal(getCell(sheet,'A6').style.bold,true);
 validateWorkbook(book);
 assert.equal(decodeBook(encodeBook(book)).sheets[0].cells.A8.value,'QX-007');
});

test('TASK124: numeric suffix zero padding handles carry and preserves a fixed numeric prefix',()=>{
 const {sheet}=setup({B1:'QX2026-099',B2:'QX2026-100'});
 extendFillHandle(sheet,'B1','B2','down',4);
 assert.deepEqual(values(sheet,['B3','B4','B5']),['QX2026-101','QX2026-102','QX2026-103']);
 const {sheet:other}=setup({C1:'VID-009',C2:'VID-010'});
 extendFillHandle(other,'C1','C2','down',3);
 assert.deepEqual(values(other,['C3','C4']),['VID-011','VID-012']);
});

test('TASK124: arithmetic steps and horizontal fill both work for labels',()=>{
 const {sheet}=setup({B3:'Урок 10',C3:'Урок 20'});
 extendFillHandle(sheet,'B3','C3','right',4);
 assert.deepEqual(values(sheet,['D3','E3']),['Урок 30','Урок 40']);
});

test('TASK124: one alphanumeric seed increments but a single plain number copies',()=>{
 const {sheet}=setup({A1:'QX-008',B1:'42'});
 extendFillHandle(sheet,'A1','A1','down',2);
 extendFillHandle(sheet,'B1','B1','down',2);
 assert.deepEqual(values(sheet,['A2','A3','B2','B3']),['QX-009','QX-010','42','42']);
});

test('TASK124: reverse direction extrapolates instead of cycling source',()=>{
 const {sheet}=setup({C3:'QX-007',D3:'QX-009'});
 extendFillHandle(sheet,'C3','D3','left',0);
 assert.deepEqual(values(sheet,['A3','B3']),['QX-003','QX-005']);
});

test('TASK124: multi-column fill detects a separate ID sequence per column',()=>{
 const {sheet}=setup({A1:'QX-001',A2:'QX-002',B1:'VID-010',B2:'VID-020'});
 extendFillHandle(sheet,'A1','B2','down',3);
 assert.deepEqual(values(sheet,['A3','A4','B3','B4']),['QX-003','QX-004','VID-030','VID-040']);
});

test('TASK124: different prefixes or irregular IDs still cycle rather than guessing',()=>{
 const {sheet}=setup({D1:'QX-001',D2:'VID-002',E1:'QX-001',E2:'QX-003',E3:'QX-004'});
 extendFillHandle(sheet,'D1','D2','down',3);
 extendFillHandle(sheet,'E1','E3','down',4);
 assert.deepEqual(values(sheet,['D3','D4','E4','E5']),['QX-001','VID-002','QX-001','QX-003']);
});

test('TASK124: explicit copy mode reproduces the seed pattern without incrementing',()=>{
 const {sheet}=setup({A1:'QX-001',A2:'QX-002',B1:'10',B2:'20'});
 extendFillHandle(sheet,'A1','B2','down',3,'copy');
 assert.deepEqual(values(sheet,['A3','A4','B3','B4']),['QX-001','QX-002','10','20']);
 assert.throws(()=>extendFillHandle(sheet,'A1','A2','down',3,'bogus'),/режим/);
});

test('TASK124: formulas take precedence over suffix inference',()=>{
 const {sheet}=setup({A1:'=B1',A2:'=B2'});
 extendFillHandle(sheet,'A1','A2','down',3);
 assert.deepEqual(values(sheet,['A3','A4']),['=B3','=B4']);
});

test('TASK124: invalid destination rejects an entire alphanumeric fill atomically',()=>{
 const {sheet}=setup({A1:'QX-001',A2:'QX-002'});
 sheet.validations=[{id:'t124',from:'A4',to:'A4',kind:'list',options:['OTHER']}];
 const snapshot=JSON.stringify(sheet.cells);
 assert.throws(()=>extendFillHandle(sheet,'A1','A2','down',3),/Недопустимое значение/);
 assert.equal(JSON.stringify(sheet.cells),snapshot);
});
