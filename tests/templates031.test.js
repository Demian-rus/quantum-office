import test from 'node:test';
import assert from 'node:assert/strict';
import {createScheduleTemplate,createJournalTemplate,createBudgetTemplate,getCell,validateWorkbook,rawMap,formulaContext,resultOf,displayedValue} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
import {exportXLSX} from '../src/core/xlsx.js';

test('weekly schedule is truly laid out: wide columns, seven day merges, visible bands and three tabs',()=>{
 const b=createScheduleTemplate(),s=b.sheets[0];
 assert.deepEqual(b.sheets.map(s=>s.name),['График','Бухгалтерия','Партнёрка']);
 assert.ok(s.columnWidths[4]>=280);
 assert.ok(s.columnWidths[6]>=200);
 assert.ok(s.rowHeights[3]>=32);
 assert.equal(s.merges.filter(m=>/^A\d+$/.test(m.from)&&m.to.startsWith('A')).length,7);
 assert.ok(s.merges.some(m=>m.from==='A4'&&m.to==='A8'));
 assert.equal(getCell(s,'B2').value,'Ученики');
 assert.equal(getCell(s,'I2').value,'Стоимость');
 assert.equal(getCell(s,'A4').style.bg,'#ffca19');
 assert.ok(getCell(s,'E4').style.wrap);
 assert.ok(getCell(b.sheets[1],'A1').value.includes('ОПЛАТ'));
 assert.ok(getCell(b.sheets[2],'A1').value.includes('ПАРТН'));
 assert.equal(getCell(b.sheets[1],'G5').value,'=E5-F5');
 validateWorkbook(b);
});
test('journal has grouped header, readable dimensions, prepared rows and labeled fictional examples',()=>{
 const b=createJournalTemplate(),s=b.sheets[0];
 assert.ok(s.merges.some(m=>m.from==='A1'&&m.to==='H1'));
 assert.ok(s.merges.some(m=>m.from==='E3'&&m.to==='H3'));
 assert.ok(s.columnWidths[7]>=300);
 assert.ok(s.rowHeights[4]>=34);
 assert.match(getCell(s,'A5').value,/Пример/);
 assert.ok(getCell(s,'H5').style.wrap);
 assert.equal(getCell(s,'F5').style.format,'currency');
 assert.equal(s.freeze.rows,4);
 validateWorkbook(b);
});
test('budget includes visual sections, numeric ledger, cumulative balance and total formulas',()=>{
 const b=createBudgetTemplate(),s=b.sheets[0];
 assert.equal(getCell(s,'D5').value,'Доход');
 assert.ok(s.columnWidths[2]>=280);
 assert.ok(s.merges.some(m=>m.from==='D3'&&m.to==='F3'));
 assert.equal(getCell(s,'F6').value,'=SUM(D6:D6)-SUM(E6:E6)');
 const raw=rawMap(s),ctx=formulaContext(b,s,raw);
 assert.equal(resultOf(s,'F6',raw,ctx),2500);
 assert.equal(resultOf(s,'F7',raw,ctx),2050);
 assert.equal(resultOf(s,'D20',raw,ctx),5500);
 assert.equal(resultOf(s,'E20',raw,ctx),1150);
 assert.equal(resultOf(s,'F20',raw,ctx),4350);
 assert.ok(displayedValue(s,'F20',raw,ctx).includes('4'));
 validateWorkbook(b);
});
test('professional templates survive qbook and XLSX export, including merged geometry and values',async()=>{
 for(const make of [createScheduleTemplate,createJournalTemplate,createBudgetTemplate]){
  const b=make(),round=decodeBook(encodeBook(b));
  assert.deepEqual(round.sheets.map(s=>s.merges),b.sheets.map(s=>s.merges));
  assert.deepEqual(round.sheets.map(s=>s.columnWidths),b.sheets.map(s=>s.columnWidths));
  assert.deepEqual(round.sheets.map(s=>s.rowHeights),b.sheets.map(s=>s.rowHeights));
  const zip=await globalThis.JSZip.loadAsync(await exportXLSX(b),{checkCRC32:true});
  const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(xml,/<mergeCells/);
  assert.match(xml,/<col /);
  assert.match(xml,/sheetData/);
 }
});
