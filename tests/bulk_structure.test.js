import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,getCell,mergeCells,validateWorkbook} from '../src/core/workbook.js';
import {changeSheetStructure} from '../src/core/structure.js';
test('bulk inserts and deletions rebase formulas',()=>{
 const b=newWorkbook(),s=currentSheet(b);setCell(s,'A2','x');setCell(s,'A4','z');setCell(s,'B4','=A4');
 changeSheetStructure(s,'row','insert',1,2);
 assert.equal(getCell(s,'A4').value,'x');assert.equal(getCell(s,'B6').value,'=A6');
 changeSheetStructure(s,'row','delete',1,2);
 assert.equal(getCell(s,'B4').value,'=A4');validateWorkbook(b);
});
test('merged block shifts and shrinks with batch operations',()=>{
 const b=newWorkbook(),s=currentSheet(b);setCell(s,'B2','X');mergeCells(s,'B2','D4');
 changeSheetStructure(s,'row','insert',3,2);assert.deepEqual(s.merges,[{from:'B2',to:'D6'}]);
 changeSheetStructure(s,'row','delete',3,2);assert.deepEqual(s.merges,[{from:'B2',to:'D4'}]);
 const old=structuredClone(s);assert.throws(()=>changeSheetStructure(s,'row','delete',0,2),/началом объединения/);assert.deepEqual(s,old);
});
test('boundary overflow refuses atomically',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'A2000','last');const old=structuredClone(s);
 assert.throws(()=>changeSheetStructure(s,'row','insert',1,3),/Последняя/);assert.deepEqual(s,old);
});
test('count bounds enforced',()=>{
 const s=currentSheet(newWorkbook());assert.throws(()=>changeSheetStructure(s,'row','insert',0,101),/100/);
});