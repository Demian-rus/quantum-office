import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,getCell,pasteTSV,validateWorkbook} from '../src/core/workbook.js';
import {addDataRule,deleteDataRule,validationAt} from '../src/core/validation.js';
import {changeSheetStructure} from '../src/core/structure.js';
import {copyCells,pasteCells,pasteValuesCells} from '../src/core/clipboard.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
test('TASK052 dropdown options validate and persist QBOOK',()=>{
 const b=newWorkbook(),s=currentSheet(b),rule=addDataRule(s,'B2','B4','list','Да; Нет; Не определено');
 assert.deepEqual(rule.options,['Да','Нет','Не определено']);
 assert.equal(validationAt(s,'B3')?.id,rule.id);assert.equal(validationAt(s,'C3'),null);
 setCell(s,'B2','Да');assert.throws(()=>setCell(s,'B2','Случайно'),/Выберите вариант/);
 assert.equal(getCell(s,'B2').value,'Да');setCell(s,'B2','');
 const restored=decodeBook(encodeBook(b));assert.deepEqual(restored.sheets[0].validations[0].options,rule.options);
 deleteDataRule(s,rule.id);setCell(s,'B2','Случайно');assert.equal(getCell(s,'B2').value,'Случайно');
});
test('TASK052 numeric range, formulas and atomic TSV',()=>{
 const b=newWorkbook(),s=currentSheet(b);addDataRule(s,'D1','D4','number','-2.5;10.5');
 setCell(s,'D1','-2.5');setCell(s,'D2','10.5');
 assert.throws(()=>setCell(s,'D1','10.6'),/числа от/);
 assert.throws(()=>setCell(s,'D1','abc'),/числа от/);
 assert.equal(getCell(s,'D1').value,'-2.5');
 setCell(s,'D3','=SUM(A1:A2)');
 const before=JSON.stringify(s.cells);
 assert.throws(()=>pasteTSV(s,'C1','ok\t11\nok\t9'),/числа от/);
 assert.equal(JSON.stringify(s.cells),before);
 pasteTSV(s,'C1','ok\t5\nok\t9');
 assert.equal(getCell(s,'D2').value,'9');
});
test('TASK052 clipboard and Paste Values preflight across all cells',()=>{
 const b=newWorkbook(),s=currentSheet(b);setCell(s,'A1','OK');setCell(s,'A2','BAD');
 addDataRule(s,'F7','F8','list','OK;YES');
 const clip=copyCells(s,'A1','A2',b),before=JSON.stringify(s.cells);
 assert.throws(()=>pasteCells(s,'F7',clip),/Выберите вариант/);
 assert.equal(JSON.stringify(s.cells),before);
 assert.throws(()=>pasteValuesCells(s,'F7',clip,b),/Выберите вариант/);
 assert.equal(JSON.stringify(s.cells),before);
});
test('TASK052 reject overlaps, malformed limits and unsafe schemas without mutation',()=>{
 const b=newWorkbook(),s=currentSheet(b);addDataRule(s,'B2','B3','list','A; B');
 const before=JSON.stringify(s.validations);
 assert.throws(()=>addDataRule(s,'B3','B4','number','0;10'),/пересекаться/);
 assert.throws(()=>addDataRule(s,'A1','A4500','number','0;10'),/4 000/);
 assert.throws(()=>addDataRule(s,'A1','A2','list','Да; Да'),/Некорректные/);
 assert.throws(()=>addDataRule(s,'A1','A2','number','8;2'),/Некорректный/);
 assert.equal(JSON.stringify(s.validations),before);
 const broken=structuredClone(b);broken.sheets[0].validations[0].options=['<script>','=HACK'];
 assert.throws(()=>validateWorkbook(broken),/Некорректные значения/);
});
test('TASK052 structural insert shifts ranges; destructive delete refused',()=>{
 const b=newWorkbook(),s=currentSheet(b);addDataRule(s,'C3','C7','list','В работе;Готово');
 changeSheetStructure(s,'row','insert',1,1);
 assert.equal(s.validations[0].from,'C4');assert.equal(s.validations[0].to,'C8');
 const before=JSON.stringify(s);
 assert.throws(()=>changeSheetStructure(s,'col','delete',2,1),/уничтожит диапазон/);
 assert.equal(JSON.stringify(s),before);
 changeSheetStructure(s,'row','delete',1,1);
 assert.equal(s.validations[0].from,'C3');
});
