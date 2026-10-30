import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,validateWorkbook} from '../src/core/workbook.js';
import {addDataRule} from '../src/core/validation.js';
import {xlsxDataValidations} from '../src/core/xlsx.js';

test('TASK054: Excel dropdown and numeric Data Validation XML are serialized without loss',()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 addDataRule(sheet,'B2','B4','list','Готово;В работе;Отложено');
 addDataRule(sheet,'D2','D4','number','-2.5;50.5');
 const xml=xlsxDataValidations(sheet);
 assert.match(xml,/<dataValidations count="2">/);
 assert.match(xml,/type="list".*?sqref="B2:B4"/);
 assert.match(xml,/<formula1>&quot;Готово,В работе,Отложено&quot;<\/formula1>/);
 assert.match(xml,/type="decimal" operator="between".*?sqref="D2:D4"/);
 assert.match(xml,/<formula1>-2.5<\/formula1><formula2>50.5<\/formula2>/);
 validateWorkbook(book);
});
test('TASK054: XML escape Excel validation labels and single cell ranges',()=>{
 const sheet=currentSheet(newWorkbook());
 addDataRule(sheet,'A1','A1','list','А&Б; Меньше < 5');
 const xml=xlsxDataValidations(sheet);
 assert.match(xml,/sqref="A1"/);
 assert.match(xml,/А&amp;Б/);
 assert.match(xml,/Меньше &lt; 5/);
 assert.equal(xlsxDataValidations(currentSheet(newWorkbook())),'');
});
test('TASK054: unsupported unrepresentable Excel literal lists fail instead of corrupting values',()=>{
 const sheet=currentSheet(newWorkbook());
 addDataRule(sheet,'B2','B2','list','Да, наверное;Нет');
 assert.throws(()=>xlsxDataValidations(sheet),/Сохраните \.qbook/);
 sheet.validations=[];
 addDataRule(sheet,'B2','B2','list','Да;Нет');
 sheet.validations[0].options=['А'.repeat(140),'Б'.repeat(140)];
 assert.throws(()=>xlsxDataValidations(sheet),/Сохраните \.qbook/);
});
