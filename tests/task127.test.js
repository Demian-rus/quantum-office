import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,newSheet,currentSheet,validateWorkbook,reorderWorksheet,setCell,getCell} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
const make=()=>{
 const b=newWorkbook('QX'),first=currentSheet(b);
 first.name='Контент';
 const second=newSheet('Саморазвитие'),third=newSheet('Сценарии');
 b.sheets.push(second,third);b.activeSheetId=second.id;
 setCell(first,'A2','QX-001');
 return {b,first,second,third};
};
test('TASK127: moving first tab to last preserves formulas and active sheet',()=>{
 const {b,first,second,third}=make();
 const active=b.activeSheetId;
 assert.equal(reorderWorksheet(b,first.id,third.id),true);
 assert.deepEqual(b.sheets.map(s=>s.name),['Саморазвитие','Сценарии','Контент']);
 assert.equal(b.activeSheetId,active);
 assert.equal(getCell(b.sheets[2],'A2').value,'QX-001');
 validateWorkbook(b);
});
test('TASK127: moving last tab before first maintains stable IDs',()=>{
 const {b,first,third}=make(),ids=new Set(b.sheets.map(s=>s.id));
 assert.equal(reorderWorksheet(b,third.id,first.id),true);
 assert.deepEqual(b.sheets.map(s=>s.name),['Сценарии','Контент','Саморазвитие']);
 assert.deepEqual(new Set(b.sheets.map(s=>s.id)),ids);
});
test('TASK127: no-op same tab does not mutate book',()=>{
 const {b,first}=make(),before=JSON.stringify(b);
 assert.equal(reorderWorksheet(b,first.id,first.id),false);
 assert.equal(JSON.stringify(b),before);
});
test('TASK127: rejects unknown source and target IDs atomically',()=>{
 const {b,first}=make(),before=JSON.stringify(b);
 assert.throws(()=>reorderWorksheet(b,'missing',first.id),/не найден/);
 assert.throws(()=>reorderWorksheet(b,first.id,'missing'),/не найден/);
 assert.equal(JSON.stringify(b),before);
});
test('TASK127: reordering survives QBOOK roundtrip',()=>{
 const {b,first,third}=make();reorderWorksheet(b,first.id,third.id);
 const restored=decodeBook(encodeBook(b));
 assert.deepEqual(restored.sheets.map(s=>s.name),['Саморазвитие','Сценарии','Контент']);
 assert.equal(restored.activeSheetId,b.activeSheetId);
 validateWorkbook(restored);
});
