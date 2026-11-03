import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,newSheet,currentSheet,setCell,setStyle,getCell,
 planWorkbookReplacement,applyWorkbookReplacement,validateWorkbook} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
function sample(){
 const book=newWorkbook('Контент QX'),first=currentSheet(book);
 first.name='Идеи';const second=newSheet('Сценарии');
 book.sheets.push(second);
 setCell(first,'A1','QX-001');
 setCell(first,'A2','Обзор qx-002 и QX-003');
 setCell(first,'A3','=CONCAT("QX",A1)');
 setCell(second,'B2','QX-004');
 setStyle(first,'A2',{bold:true,bg:'#112233'});
 return {book,first,second};
}
test('TASK129: preview covers two sheets, literal case-insensitive occurrences, skips formulas',()=>{
 const {book}=sample();
 const p=planWorkbookReplacement(book,'qx','VID');
 assert.equal(p.truncated,false);assert.equal(p.items.length,3);
 assert.deepEqual(p.items.map(x=>x.sheetName+'!'+x.ref),['Идеи!A1','Идеи!A2','Сценарии!B2']);
 assert.equal(p.items[1].after,'Обзор VID-002 и VID-003');
});
test('TASK129: preview is read-only and does not affect formula or formatting',()=>{
 const {book}=sample();const before=JSON.stringify(book);
 planWorkbookReplacement(book,'QX','VID');
 assert.equal(JSON.stringify(book),before);
});
test('TASK129: selected replacements change only checked cells and keep styles',()=>{
 const {book,first,second}=sample();
 const p=planWorkbookReplacement(book,'QX','VID');
 const result=applyWorkbookReplacement(book,p,[p.items[1].key,p.items[2].key]);
 assert.deepEqual(result,{count:2,sheets:2});
 assert.equal(getCell(book.sheets[0],'A1').value,'QX-001');
 assert.equal(getCell(book.sheets[0],'A2').value,'Обзор VID-002 и VID-003');
 assert.equal(getCell(book.sheets[1],'B2').value,'VID-004');
 assert.equal(getCell(book.sheets[0],'A3').value,'=CONCAT("QX",A1)');
 assert.deepEqual(getCell(book.sheets[0],'A2').style,{bold:true,bg:'#112233'});
 validateWorkbook(book);
});
test('TASK129: selected replacements survive book export/import',()=>{
 const {book}=sample();const p=planWorkbookReplacement(book,'QX','VID');
 applyWorkbookReplacement(book,p,p.items.map(x=>x.key));
 const loaded=decodeBook(encodeBook(book));
 assert.equal(getCell(loaded.sheets[1],'B2').value,'VID-004');
 assert.equal(getCell(loaded.sheets[0],'A3').value,'=CONCAT("QX",A1)');
});
test('TASK129: stale preview rejects the entire transaction without changing selected cells',()=>{
 const {book}=sample();const p=planWorkbookReplacement(book,'QX','VID');
 setCell(book.sheets[1],'B2','CHANGED');
 const before=JSON.stringify(book);
 assert.throws(()=>applyWorkbookReplacement(book,p,p.items.map(x=>x.key)),/изменилась/);
 assert.equal(JSON.stringify(book),before);
});
test('TASK129: validation failure rejects all replacements atomically',()=>{
 const {book}=sample();const p=planWorkbookReplacement(book,'QX','VID');
 book.sheets[1].validations=[{id:'rule1',from:'B2',to:'B2',kind:'list',options:['QX-004']}];
 const before=JSON.stringify(book);
 assert.throws(()=>applyWorkbookReplacement(book,p,p.items.map(x=>x.key)),/Недопустимое значение/);
 assert.equal(JSON.stringify(book),before);
});
test('TASK129: preview blocks partial replacement if more than a bounded number of hits',()=>{
 const {book,first}=sample();
 for(let i=10;i<15;i++)setCell(first,'A'+i,'QX-'+i);
 const p=planWorkbookReplacement(book,'QX','VID',{limit:2});
 assert.equal(p.truncated,true);assert.equal(p.items.length,2);
 const before=JSON.stringify(book);
 assert.throws(()=>applyWorkbookReplacement(book,p,p.items.map(x=>x.key)),/Слишком много/);
 assert.equal(JSON.stringify(book),before);
});
test('TASK129: custom scope leaves all other sheets untouched',()=>{
 const {book,first}=sample();
 const p=planWorkbookReplacement(book,'QX','VID',{sheetId:first.id});
 assert.equal(p.items.length,2);
 applyWorkbookReplacement(book,p,p.items.map(x=>x.key));
 assert.equal(getCell(book.sheets[1],'B2').value,'QX-004');
});
test('TASK129: invalid keys and wrong book IDs never mutate the book',()=>{
 const {book}=sample(),p=planWorkbookReplacement(book,'QX','VID'),before=JSON.stringify(book);
 assert.throws(()=>applyWorkbookReplacement(book,p,['bad:key']),/Неизвестная/);
 const other=newWorkbook();
 assert.throws(()=>applyWorkbookReplacement(other,p,[p.items[0].key]),/другой книге/);
 assert.equal(JSON.stringify(book),before);
});
test('TASK129: replace literal regex symbols and preserve replacement dollar syntax',()=>{
 const {book}=sample();
 setCell(book.sheets[0],'D1','[QX] and [qx]');
 const p=planWorkbookReplacement(book,'[QX]','$&');
 assert.equal(p.items.length,1);assert.equal(p.items[0].after,'$& and $&');
 applyWorkbookReplacement(book,p,[p.items[0].key]);
 assert.equal(getCell(book.sheets[0],'D1').value,'$& and $&');
});
test('TASK129: empty selection and unsafe input do not mutate the book',()=>{
 const {book}=sample(),p=planWorkbookReplacement(book,'QX','VID'),before=JSON.stringify(book);
 assert.deepEqual(applyWorkbookReplacement(book,p,[]),{count:0,sheets:0});
 assert.equal(JSON.stringify(book),before);
 assert.throws(()=>planWorkbookReplacement(book,'QX','=SUM'),/формулу/);
 assert.throws(()=>planWorkbookReplacement(book,'', 'v'),/Введите текст/);
});
