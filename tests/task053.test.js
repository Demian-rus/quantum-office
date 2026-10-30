import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,setStyle} from '../src/core/workbook.js';
import {planPrint,printHTML,changePrintSettings,printSettings,selectedPrintArea,validatePrintSettings} from '../src/core/printing.js';
import {changeSheetStructure} from '../src/core/structure.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

test('TASK053 print preview contains actual values, calculated formulas and escaped cells',()=>{
 const b=newWorkbook('Отчёт <2026>'),s=currentSheet(b);
 setCell(s,'A1','Название');setCell(s,'B1','Сумма');
 setCell(s,'A2','Выручка');setCell(s,'B2','20');
 setCell(s,'A3','Итого <img src=x onerror=evil()>');setCell(s,'B3','=B2*2');
 setStyle(s,'B3',{bg:'#bbffee',bold:true});
 const plan=planPrint(b,s);
 assert.equal(plan.pages.length,1);assert.equal(plan.range.from,'A1');assert.equal(plan.range.to,'B3');
 const text=printHTML(plan);
 assert.match(text,/Отчёт &lt;2026&gt;/);
 assert.match(text,/Итого &lt;img src=x onerror=evil\(\)&gt;/);
 assert.doesNotMatch(text,/<img src=x/);
 assert.match(text,/>40<\/td>/);assert.match(text,/background:#bbffee/);
 assert.match(text,/Страница 1 из 1/);
});
test('TASK053 multi-page layout splits rows, counts pages, repeats column headings',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 for(let n=1;n<=90;n++){setCell(s,'A'+n,'Строка '+n);setCell(s,'B'+n,String(n));}
 const plan=planPrint(b,s);
 assert.ok(plan.pages.length>=3);
 assert.equal(plan.pages.length,Math.ceil(plan.pages.length));
 assert.equal((printHTML(plan).match(/print-page-header/g)||[]).length,plan.pages.length);
 assert.equal((printHTML(plan).match(/<th>A<\/th>/g)||[]).length,plan.pages.length);
});
test('TASK053 paper size, orientation, scale and fit width are configurable',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 for(let col=0;col<9;col++)setCell(s,String.fromCharCode(65+col)+'1',String(col+1));
 const initial=planPrint(b,s);
 assert.equal(initial.paper,'A4');assert.equal(initial.orientation,'portrait');
 changePrintSettings(s,{paper:'Letter',orientation:'landscape',scale:75,fitWidth:false});
 const next=planPrint(b,s);
 assert.equal(next.paper,'Letter');assert.equal(next.orientation,'landscape');assert.equal(next.scale,.75);
 assert.match(printHTML(next),/--paper-width:1056px/);
});
test('TASK053 selected print region persists in QBOOK and ignores outside cells',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A1','Скрывать');setCell(s,'B4','Внутри');setCell(s,'D7','Скрывать');
 changePrintSettings(s,{area:selectedPrintArea('B4','C5'),orientation:'landscape'});
 const plan=planPrint(b,s),html=printHTML(plan);
 assert.equal(plan.range.from,'B4');assert.equal(plan.range.to,'C5');
 assert.match(html,/Внутри/);assert.doesNotMatch(html,/Скрывать/);
 const saved=decodeBook(encodeBook(b)),other=currentSheet(saved);
 assert.deepEqual(other.printSettings.area,{from:'B4',to:'C5'});
 assert.equal(planPrint(saved,other).range.from,'B4');
});
test('TASK053 avoid unbounded preview, malformed page settings and empty sheets',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 assert.throws(()=>planPrint(b,s),/нет заполненных ячеек/);
 assert.throws(()=>changePrintSettings(s,{paper:'unknown'}),/Повреждены параметры/);
 assert.throws(()=>changePrintSettings(s,{orientation:'up'}),/Повреждены параметры/);
 assert.throws(()=>changePrintSettings(s,{area:{from:'B3',to:'A1'}}),/Неверные границы/);
 assert.throws(()=>changePrintSettings(s,{invalid:'something'}),/Неверные параметры/);
 setCell(s,'A1','начало');setCell(s,'A12001','конец');
 assert.throws(()=>planPrint(b,s),/12 000 ячеек/);
});
test('TASK053 print area tracks structural shifts and blocks deletion that destroys it',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'B2','Данные');
 changePrintSettings(s,{area:selectedPrintArea('B2','C5')});
 changeSheetStructure(s,'row','insert',1,1);
 assert.deepEqual(printSettings(s).area,{from:'B3',to:'C6'});
 const state=JSON.stringify(s);
 assert.throws(()=>changeSheetStructure(s,'col','delete',1,2),/уничтожит сохранённую область печати/);
 assert.equal(JSON.stringify(s),state);
 changeSheetStructure(s,'row','delete',1,1);
 assert.deepEqual(printSettings(s).area,{from:'B2',to:'C5'});
});
test('TASK053 merged cells print as rowspan and colspan when on one page',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A1','Общий заголовок');setCell(s,'A2','Данные');
 s.merges=[{from:'A1',to:'B1'}];
 const plan=planPrint(b,s,{area:{from:'A1',to:'B3'}});
 assert.match(printHTML(plan),/rowspan="1" colspan="2"/);
});
