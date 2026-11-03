import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,newSheet,currentSheet,setCell,setStyle,getCell,duplicateWorksheet,moveWorksheet,validateWorkbook} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

const newBook=()=>{
 const book=newWorkbook('План роликов');
 const a=currentSheet(book);a.name='Контент';
 setCell(a,'A1','ID');setCell(a,'A2','QX-001');setCell(a,'B2','Реакция');
 setStyle(a,'A1',{bold:true,bg:'#193A30'});
 a.columnWidths={0:210,1:310};a.rowHeights={1:46};a.freeze={rows:1,cols:1};
 a.printSettings={paper:'A4',orientation:'landscape',scale:100,fitWidth:true,area:{from:'A1',to:'B2'}};
 return {book,a};
};

test('TASK126: duplicate creates adjacent, active and independent full worksheet',()=>{
 const {book,a}=newBook(),copy=duplicateWorksheet(book,a.id);
 assert.equal(book.sheets.length,2);
 assert.equal(book.sheets[0].id,a.id);
 assert.equal(book.sheets[1].id,copy.id);
 assert.equal(book.activeSheetId,copy.id);
 assert.notEqual(copy.id,a.id);
 assert.equal(copy.name,'Контент — копия');
 assert.equal(getCell(copy,'A2').value,'QX-001');
 assert.deepEqual(getCell(copy,'A1').style,getCell(a,'A1').style);
 assert.deepEqual(copy.columnWidths,a.columnWidths);
 assert.deepEqual(copy.rowHeights,a.rowHeights);
 assert.deepEqual(copy.freeze,a.freeze);
 assert.deepEqual(copy.printSettings,a.printSettings);
 setCell(copy,'A2','QX-002');
 copy.columnWidths[0]=555;
 assert.equal(getCell(a,'A2').value,'QX-001');
 assert.equal(a.columnWidths[0],210);
 validateWorkbook(book);
});

test('TASK126: duplicate safely numbers subsequent copies',()=>{
 const {book,a}=newBook();
 const c1=duplicateWorksheet(book,a.id);
 const c2=duplicateWorksheet(book,a.id);
 assert.equal(c1.name,'Контент — копия');
 assert.equal(c2.name,'Контент — копия (2)');
 assert.equal(book.sheets[1].id,c2.id);
 validateWorkbook(book);
});

test('TASK126: long source names generate valid short unique copies',()=>{
 const {book,a}=newBook();a.name='Мои идеи для очень длинных видеороликов';
 const c1=duplicateWorksheet(book,a.id);
 const c2=duplicateWorksheet(book,a.id);
 assert.ok(c1.name.length<=31);
 assert.ok(c2.name.length<=31);
 assert.notEqual(c1.name,c2.name);
 validateWorkbook(book);
});

test('TASK126: copies regenerate IDs for per-sheet charts and rules',()=>{
 const {book,a}=newBook();
 a.charts=[{id:'chart-test',type:'bar',title:'Статистика',from:'A1',to:'B3'}];
 const copy=duplicateWorksheet(book,a.id);
 assert.notEqual(copy.charts[0].id,a.charts[0].id);
 assert.equal(copy.charts[0].title,'Статистика');
 validateWorkbook(book);
});

test('TASK126: copy preserves a formula without rewriting source workbook',()=>{
 const {book,a}=newBook();setCell(a,'C2','=A2');
 const copy=duplicateWorksheet(book,a.id);
 assert.equal(getCell(copy,'C2').value,'=A2');
 assert.equal(getCell(a,'C2').value,'=A2');
 validateWorkbook(book);
});

test('TASK126: keep original book valid after QBOOK roundtrip',()=>{
 const {book,a}=newBook();duplicateWorksheet(book,a.id);
 const loaded=decodeBook(encodeBook(book));
 assert.equal(loaded.sheets.length,2);
 assert.equal(getCell(loaded.sheets[1],'A2').value,'QX-001');
 assert.equal(loaded.sheets[1].printSettings.orientation,'landscape');
 assert.equal(loaded.activeSheetId,book.activeSheetId);
});

test('TASK126: reorder moves by one and preserves active ID',()=>{
 const {book,a}=newBook(),b=newSheet('Сценарии'),c=newSheet('Публикации');
 book.sheets.push(b,c);book.activeSheetId=b.id;
 assert.equal(moveWorksheet(book,b.id,1),true);
 assert.deepEqual(book.sheets.map(s=>s.name),['Контент','Публикации','Сценарии']);
 assert.equal(book.activeSheetId,b.id);
 assert.equal(moveWorksheet(book,b.id,-1),true);
 assert.deepEqual(book.sheets.map(s=>s.name),['Контент','Сценарии','Публикации']);
 validateWorkbook(book);
});

test('TASK126: moving beyond either edge is a harmless no-op',()=>{
 const {book,a}=newBook(),snapshot=JSON.stringify(book);
 assert.equal(moveWorksheet(book,a.id,-1),false);
 assert.equal(moveWorksheet(book,a.id,1),false);
 assert.equal(JSON.stringify(book),snapshot);
});

test('TASK126: duplicate rejects the sheet limit without partial mutation',()=>{
 const {book,a}=newBook();
 while(book.sheets.length<25)book.sheets.push(newSheet('Лист '+book.sheets.length));
 const before=JSON.stringify(book);
 assert.throws(()=>duplicateWorksheet(book,a.id),/25 листов/);
 assert.equal(JSON.stringify(book),before);
});

test('TASK126: unknown IDs and directions cannot change the book',()=>{
 const {book}=newBook(),before=JSON.stringify(book);
 assert.throws(()=>duplicateWorksheet(book,'missing'),/не найден/);
 assert.throws(()=>moveWorksheet(book,'missing',-1),/не найден/);
 assert.throws(()=>moveWorksheet(book,book.sheets[0].id,2),/параметры/);
 assert.equal(JSON.stringify(book),before);
});
