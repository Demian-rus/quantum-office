import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,newSheet,setCell,setStyle} from '../src/core/workbook.js';
import {exportXLSX} from '../src/core/xlsx.js';

test('XLSX writer emits valid ZIP parts with formulas, styles, UTF-8 and sheets',async()=>{
 const book=newWorkbook('Тест'),sheet=currentSheet(book);sheet.name='Расчёт';
 setCell(sheet,'A1','Название');setStyle(sheet,'A1',{bold:true,bg:'#112233'});
 setCell(sheet,'A2','00123');setCell(sheet,'B2','17');setCell(sheet,'C2','=B2*2');
 book.sheets.push(newSheet('Второй'));
 const data=await exportXLSX(book);assert.ok(data.length>600);
 const zip=await globalThis.JSZip.loadAsync(data);
 for(const part of ['[Content_Types].xml','xl/workbook.xml','xl/styles.xml','xl/worksheets/sheet1.xml','xl/worksheets/sheet2.xml'])assert.ok(zip.file(part),part);
 const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
 assert.match(xml,/r="C2"[^>]*><f>B2\*2<\/f>/);
 assert.match(xml,/r="A2"[^>]*t="inlineStr"/); // Leading zeros must survive.
 assert.match(xml,/r="B2"[^>]*><v>17<\/v>/);
 const bookxml=await zip.file('xl/workbook.xml').async('string');assert.match(bookxml,/Второй/);
});
test('XLSX export rejects sheet names colliding after Excel 31-char limit',async()=>{
 const b=newWorkbook();b.sheets[0].name='a'.repeat(31)+'A';b.sheets.push(newSheet('a'.repeat(31)+'B'));
 await assert.rejects(exportXLSX(b),/Повторяющиеся/);
});
