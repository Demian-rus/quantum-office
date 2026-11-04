import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,newSheet,currentSheet,setCell,findWorkbookCells,findCells} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
function fixture(){
 const book=newWorkbook('QX');
 const content=currentSheet(book);content.name='Контент';
 const terms=newSheet('Термины'),plans=newSheet('План');
 book.sheets.push(terms,plans);
 setCell(content,'A2','QX-001');setCell(content,'B2','Энергия');
 setCell(terms,'C4','Рациональность');setCell(terms,'D4','QX-002');
 setCell(plans,'A1','QX-003');setCell(plans,'A2','=A1&"QX"');
 return {book,content,terms,plans};
}
test('TASK128: find literal text across all sheets in workbook order',()=>{
 const {book}=fixture();
 const {matches,truncated}=findWorkbookCells(book,'QX');
 assert.equal(truncated,false);
 assert.deepEqual(matches.map(m=>[m.sheetName,m.ref]),[
  ['Контент','A2'],['Термины','D4'],['План','A1'],['План','A2']
 ]);
});
test('TASK128: scope to a specific worksheet and preserve original search',()=>{
 const {book,terms}=fixture();
 assert.deepEqual(findWorkbookCells(book,'qx',{sheetId:terms.id}).matches.map(m=>m.ref),['D4']);
 assert.deepEqual(findCells(terms,'qx'),['D4']);
});
test('TASK128: search includes formulas and non-ASCII text, case-insensitive',()=>{
 const {book}=fixture();
 assert.deepEqual(findWorkbookCells(book,'раЦио').matches.map(m=>m.ref),['C4']);
 assert.equal(findWorkbookCells(book,'A1&').matches[0].value,'=A1&"QX"');
});
test('TASK128: results cap and truncation signal',()=>{
 const {book}=fixture();
 const result=findWorkbookCells(book,'QX',{limit:2});
 assert.equal(result.matches.length,2);assert.equal(result.truncated,true);
 const exact=findWorkbookCells(book,'Энергия',{limit:1});
 assert.equal(exact.truncated,false);
});
test('TASK128: does not mutate cells or active worksheet even after multiple searches',()=>{
 const {book}=fixture(),before=JSON.stringify(book);
 findWorkbookCells(book,'QX');
 findWorkbookCells(book,'missing');
 findWorkbookCells(book,'QX',{limit:1});
 assert.equal(JSON.stringify(book),before);
});
test('TASK128: search does not cross into other workbooks',()=>{
 const {book}=fixture(),other=newWorkbook('Другой');
 setCell(currentSheet(other),'A1','QX SECRET');
 assert.equal(findWorkbookCells(book,'SECRET').matches.length,0);
});
test('TASK128: rejects invalid target or unreasonable query',()=>{
 const {book}=fixture();
 assert.throws(()=>findWorkbookCells(book,'x',{sheetId:'missing'}),/Лист не найден/);
 assert.throws(()=>findWorkbookCells(book,'x',{limit:0}),/лимит/);
 assert.throws(()=>findWorkbookCells(book,'x'.repeat(1001)),/Слишком длинный/);
 assert.deepEqual(findWorkbookCells(book,'   '),{matches:[],truncated:false});
});
test('TASK128: search still works after QBOOK roundtrip',()=>{
 const {book}=fixture(),restored=decodeBook(encodeBook(book));
 assert.equal(findWorkbookCells(restored,'QX').matches.length,4);
});
