import test from 'node:test';
import assert from 'node:assert/strict';
import {createScheduleTemplate,getCell,validateWorkbook,cellName} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

test('weekly schedule has seven editable days and 30-minute time rows',()=>{
 const b=createScheduleTemplate(),s=b.sheets[0];validateWorkbook(b);
 assert.equal(b.sheets.length,2);assert.equal(s.name,'Неделя');
 assert.equal(getCell(s,'A2').value,'09:00');assert.equal(getCell(s,'A3').value,'09:30');
 assert.equal(getCell(s,'A26').value,'21:00');
 assert.equal(getCell(s,'H1').value,'Воскресенье');
 assert.equal(getCell(s,'B1').value,'Понедельник');
 assert.deepEqual(s.freeze,{rows:1,cols:1});
 assert.equal(b.sheets[1].name,'Ученики');
});

test('weekly schedule saves and reopens without losing sheets, content or dimensions',()=>{
 const b=createScheduleTemplate(),s=b.sheets[0];
 s.cells.C7={value:'Алгебра: 9 класс',style:{bold:true}};
 const reopened=decodeBook(encodeBook(b));
 assert.equal(reopened.sheets[0].cells.C7.value,'Алгебра: 9 класс');
 assert.equal(reopened.sheets[0].columnWidths['2'],166);
 assert.equal(reopened.sheets.length,2);
});
