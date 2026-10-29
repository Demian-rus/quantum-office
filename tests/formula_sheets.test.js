import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,newSheet,currentSheet,setCell,getCell,rawMap,formulaContext,resultOf,displayedValue,validateWorkbook,referencedFromOtherSheet} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
import {exportXLSX} from '../src/core/xlsx.js';

const make=()=>{const book=newWorkbook('График'),schedule=currentSheet(book);schedule.name='График';const finance=newSheet('Учёт оплаты');book.sheets.push(finance);return {book,schedule,finance};};
function calc(book,sheet,ref){const map=rawMap(sheet);return resultOf(sheet,ref,map,formulaContext(book,sheet,map));}
test('reference another sheet: quoted Cyrillic/spaces, bare name and absolute anchors',()=>{
 const {book,schedule,finance}=make();setCell(finance,'B2','1700');
 setCell(schedule,'A1',"='Учёт оплаты'!$B$2*2");assert.equal(calc(book,schedule,'A1'),3400);
 setCell(finance,'B2','2000');assert.equal(calc(book,schedule,'A1'),4000);
 setCell(schedule,'A2','=График!A1+1');assert.equal(calc(book,schedule,'A2'),4001);
 setCell(schedule,'A3',"='Учёт оплаты'!B2+График!A2");assert.equal(calc(book,schedule,'A3'),6001);
});
test('cross-sheet ranges aggregate with SUM, COUNTIF, SUMIF, IF and text criteria',()=>{
 const {book,schedule,finance}=make();
 [['A1','Да'],['A2','Нет'],['A3','Да'],['B1','100'],['B2','800'],['B3','400']].forEach(([r,v])=>setCell(finance,r,v));
 setCell(schedule,'A1',"=SUM('Учёт оплаты'!B1:B3)");assert.equal(calc(book,schedule,'A1'),1300);
 setCell(schedule,'A2',`=COUNTIF('Учёт оплаты'!A1:A3,"Да")`);assert.equal(calc(book,schedule,'A2'),2);
 setCell(schedule,'A3',`=SUMIF('Учёт оплаты'!A1:A3,"Да",'Учёт оплаты'!B1:B3)`);assert.equal(calc(book,schedule,'A3'),500);
 setCell(schedule,'A4',`=IF('Учёт оплаты'!B2>500,"Нужно проверить","Норма")`);assert.equal(calc(book,schedule,'A4'),'Нужно проверить');
});
test('quoted sheet name supports apostrophes and missing name is REF error',()=>{
 const {book,schedule,finance}=make();finance.name="O'Brien";setCell(finance,'A1','12');
 setCell(schedule,'A1',"='O''Brien'!A1");assert.equal(calc(book,schedule,'A1'),'12');
 setCell(schedule,'B1',"='Несуществующий лист'!A1");assert.equal(calc(book,schedule,'B1'),'#REF!');
});
test('detect cycles across sheets but do not confuse identical addresses',()=>{
 const {book,schedule,finance}=make();setCell(finance,'A1','50');setCell(schedule,'A1',"='Учёт оплаты'!A1");assert.equal(calc(book,schedule,'A1'),'50');
 setCell(finance,'A1','=График!A1');assert.equal(calc(book,schedule,'A1'),'#CYCLE!');assert.equal(calc(book,finance,'A1'),'#CYCLE!');
});
test('book validation rejects ambiguous sheet names and no book context reports REF',()=>{
 const {book,schedule,finance}=make();finance.name='график';assert.throws(()=>validateWorkbook(book),/Повторяющееся/);
 finance.name='Учёт оплаты';setCell(schedule,'A1',"='Учёт оплаты'!B2");assert.equal(resultOf(schedule,'A1'),'#REF!');
});
test('qbook retains cross-sheet formulas; XLSX preserves Excel formula text',async()=>{
 const {book,schedule,finance}=make();setCell(finance,'B2','50');setCell(schedule,'A1',"='Учёт оплаты'!B2+20");
 const after=decodeBook(encodeBook(book));assert.equal(calc(after,after.sheets[0],'A1'),70);
 const zip=await globalThis.JSZip.loadAsync(await exportXLSX(after));const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
 assert.match(xml,/Учёт оплаты/);assert.match(xml,/<f>\&apos;Учёт оплаты\&apos;!B2\+20<\/f>/);
});
test('external dependencies are detected to guard rename / remove / structure edits',()=>{
 const {book,schedule,finance}=make();setCell(schedule,'A1',"=SUM('Учёт оплаты'!B1:B9)");
 assert.equal(referencedFromOtherSheet(book,finance),true);assert.equal(referencedFromOtherSheet(book,schedule),false);
 setCell(schedule,'A1','нормально');assert.equal(referencedFromOtherSheet(book,finance),false);
});
