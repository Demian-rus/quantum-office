import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,getCell,setStyle,validateWorkbook} from '../src/core/workbook.js';
import {splitDelimited,planTextToColumns,applyTextToColumns,planRemoveDuplicates,applyRemoveDuplicates} from '../src/core/data-transform.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
const newSheet=()=>{const book=newWorkbook(),sheet=currentSheet(book);return {book,sheet};};

test('TASK067: strict quoted delimiters, embedded delimiters, doubled quotes and empty fields',()=>{
 assert.deepEqual(splitDelimited('"Текст; один";42;"Он сказал ""да"""',';'),
  ['Текст; один','42','Он сказал "да"']);
 assert.deepEqual(splitDelimited('a,,c',','),['a','','c']);
 assert.deepEqual(splitDelimited('a\tb\tc','\t'),['a','b','c']);
 assert.deepEqual(splitDelimited('a b c',' '),['a','b','c']);
 assert.throws(()=>splitDelimited('"unclosed;42',';'),/Не закрыты/);
 assert.throws(()=>splitDelimited('a"b;c',';'),/кавычки/);
 assert.throws(()=>splitDelimited('"a"bad;c',';'),/после закрывающей/);
 assert.throws(()=>splitDelimited('a;b','\n'),/Разделитель/);
});

test('TASK067: split one selected column into adjacent cells with CSV quotes and stable formatting',()=>{
 const {book,sheet}=newSheet();
 setCell(sheet,'A1','"Иван; Иванов";25;"Москва"');
 setCell(sheet,'A2','Мария;31;Казань');
 setStyle(sheet,'A1',{bold:true});setStyle(sheet,'C1',{bg:'#ffeeaa'});
 const plan=planTextToColumns(sheet,'A1','A2',{delimiter:';'});
 assert.equal(plan.rows,2);assert.equal(plan.cols,3);
 assert.equal(plan.preview[0].fields[0],'Иван; Иванов');
 assert.equal(plan.preview[0].fields[1],'25');
 assert.equal(plan.conflicts,0);
 const out=applyTextToColumns(sheet,plan);
 assert.deepEqual(out,{rows:2,cols:3,conflicts:0});
 assert.equal(getCell(sheet,'A1').value,'Иван; Иванов');
 assert.equal(getCell(sheet,'B1').value,'25');
 assert.equal(getCell(sheet,'C1').value,'Москва');
 assert.equal(getCell(sheet,'B2').value,'31');
 assert.equal(getCell(sheet,'A1').style.bold,true);
 assert.equal(getCell(sheet,'C1').style.bg,'#ffeeaa');
 validateWorkbook(book);
 assert.equal(decodeBook(encodeBook(book)).sheets[0].cells.C1.value,'Москва');
});

test('TASK067: collision protection is atomic, overwrite explicit and stale plan rejected',()=>{
 const {book,sheet}=newSheet();
 setCell(sheet,'A1','x,y');setCell(sheet,'B1','existing');
 const before=JSON.stringify(sheet.cells);
 assert.throws(()=>planTextToColumns(sheet,'A1','A1',{delimiter:','}),/заняты/);
 assert.equal(JSON.stringify(sheet.cells),before);
 const p=planTextToColumns(sheet,'A1','A1',{delimiter:',',overwrite:true});
 assert.equal(p.conflicts,1);
 setCell(sheet,'A1','changed,y');
 assert.throws(()=>applyTextToColumns(sheet,p),/изменились/);
 assert.equal(getCell(sheet,'B1').value,'existing');
 const updated=planTextToColumns(sheet,'A1','A1',{delimiter:',',overwrite:true});
 applyTextToColumns(sheet,updated);
 assert.equal(getCell(sheet,'A1').value,'changed');
 assert.equal(getCell(sheet,'B1').value,'y');
 validateWorkbook(book);
});

test('TASK067: merge/hidden/filter/formula/validation prevents unsafe splitting',()=>{
 const {sheet}=newSheet();setCell(sheet,'A1','a;b');
 sheet.merges=[{from:'B1',to:'C1'}];
 assert.throws(()=>planTextToColumns(sheet,'A1','A1'),/объединёнными/);
 sheet.merges=[];sheet.hiddenColumns={1:true};
 assert.throws(()=>planTextToColumns(sheet,'A1','A1'),/скрытые столбцы/);
 sheet.hiddenColumns={};setCell(sheet,'A1','=1+2');
 assert.throws(()=>planTextToColumns(sheet,'A1','A1'),/Формулы/);
 setCell(sheet,'A1','a;b');sheet.validations=[{id:'v1',kind:'list',from:'B1',to:'B1',options:['ok']}];
 assert.throws(()=>planTextToColumns(sheet,'A1','A1'),/Недопустимое значение/);
 assert.equal(getCell(sheet,'B1').value,'');
});

test('TASK067: full-row duplicates compact only selected rectangle, preserving cell styles and header',()=>{
 const {book,sheet}=newSheet();
 for(const [ref,value] of Object.entries({
  A1:'Имя',B1:'Город',C1:'Отдел',
  A2:'Анна',B2:'Москва',C2:'Надпись',
  A3:'Борис',B3:'Уфа',C3:'Вне выделения',
  A4:'анна',B4:'Москва',C4:'Осталось',
  A5:'Лев',B5:'Пермь',C5:'Вне выделения',
 }))setCell(sheet,ref,value);
 setStyle(sheet,'A3',{italic:true});
 const plan=planRemoveDuplicates(sheet,'A1','B5',{header:true,key:'all'});
 assert.equal(plan.removed,1);assert.equal(plan.kept,3);
 assert.deepEqual(plan.duplicateRows,[4]);
 applyRemoveDuplicates(sheet,plan);
 assert.equal(getCell(sheet,'A1').value,'Имя');
 assert.equal(getCell(sheet,'A4').value,'Лев');
 assert.equal(getCell(sheet,'A5').value,'');
 assert.equal(getCell(sheet,'B5').value,'');
 assert.equal(getCell(sheet,'C4').value,'Осталось'); // outside selection untouched
 assert.equal(getCell(sheet,'A3').style.italic,true);
 validateWorkbook(book);
});

test('TASK067: choose first column or all, header toggle, reject formulas and stale duplicate plans',()=>{
 const {sheet}=newSheet();
 for(const [ref,value] of Object.entries({
  A1:'Name',B1:'Score',A2:'A',B2:'1',A3:'A',B3:'2',A4:'A',B4:'2'
 }))setCell(sheet,ref,value);
 assert.equal(planRemoveDuplicates(sheet,'A1','B4',{header:true,key:'all'}).removed,1);
 assert.equal(planRemoveDuplicates(sheet,'A1','B4',{header:true,key:'first'}).removed,2);
 const plan=planRemoveDuplicates(sheet,'A1','B4',{header:true,key:'first'});
 setCell(sheet,'B3','5');
 assert.throws(()=>applyRemoveDuplicates(sheet,plan),/изменились/);
 setCell(sheet,'B3','=2+3');
 assert.throws(()=>planRemoveDuplicates(sheet,'A1','B4'),/формулами/);
 assert.throws(()=>planRemoveDuplicates(sheet,'A1','A1'),/две строки/);
});

test('TASK067: hard bounds and giant selections do not generate runaway data',()=>{
 const {sheet}=newSheet();setCell(sheet,'A1','x;y');
 assert.throws(()=>planTextToColumns(sheet,'A1','A3000'),/ограничена/);
 assert.throws(()=>planRemoveDuplicates(sheet,'A1','W3'),/ограничена/);
 assert.throws(()=>planTextToColumns(sheet,'A1','B2'),/один столбец/);
});
