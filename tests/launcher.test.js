import test from 'node:test';
import assert from 'node:assert/strict';
import {createScheduleTemplate,getCell,validateWorkbook,cellName} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

test('weekly teaching schedule follows day grouping, payment and subject columns',()=>{
 const b=createScheduleTemplate(),s=b.sheets[0];validateWorkbook(b);
 assert.equal(b.sheets.length,3);assert.equal(s.name,'График');
 assert.equal(getCell(s,'A4').value,'Пн');
 assert.equal(getCell(s,'A9').value,'Вт');
 assert.equal(getCell(s,'A34').value,'Вс');
 assert.equal(getCell(s,'B2').value,'Ученики');
 assert.equal(getCell(s,'C2').value,'Класс / предмет');
 assert.equal(getCell(s,'D2').value,'Время занятий');
 assert.equal(getCell(s,'I2').value,'Стоимость');
 assert.deepEqual(s.freeze,{rows:3,cols:2});
 assert.ok(s.merges.some(x=>x.from==='A4'&&x.to==='A8'));
 assert.ok(s.rowHeights[3]>=34);
 assert.equal(b.sheets[1].name,'Бухгалтерия');
 assert.equal(b.sheets[2].name,'Партнёрка');
});

test('weekly schedule saves and reopens without losing sheets, content or dimensions',()=>{
 const b=createScheduleTemplate(),s=b.sheets[0];
 s.cells.C7={value:'Алгебра: 9 класс',style:{bold:true}};
 const reopened=decodeBook(encodeBook(b));
 assert.equal(reopened.sheets[0].cells.C7.value,'Алгебра: 9 класс');
 assert.equal(reopened.sheets[0].columnWidths['2'],190);
 assert.equal(reopened.sheets.length,3);
});
