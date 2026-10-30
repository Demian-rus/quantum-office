import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,newSheet,validateWorkbook} from '../src/core/workbook.js';
import {changePrintSettings,printSettings} from '../src/core/printing.js';
import {xlsxPrintSettings,xlsxPrintArea,parseXLSXPrintArea} from '../src/core/xlsx-print.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

test('TASK058: Excel page setup maps A4/Letter, orientation, scale and fit-to-width',()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 const initial=xlsxPrintSettings(sheet);
 assert.match(initial.sheetPr,/fitToPage="1"/);
 assert.match(initial.trailing,/paperSize="9"/);
 assert.match(initial.trailing,/orientation="portrait"/);
 changePrintSettings(sheet,{paper:'Letter',orientation:'landscape',scale:75,fitWidth:false});
 const printed=xlsxPrintSettings(sheet);
 assert.match(printed.sheetPr,/fitToPage="0"/);
 assert.match(printed.trailing,/paperSize="1"/);
 assert.match(printed.trailing,/orientation="landscape"/);
 assert.match(printed.trailing,/scale="75"/);
 assert.match(printed.trailing,/fitToWidth="0" fitToHeight="0"/);
 const roundtrip=decodeBook(encodeBook(book));
 assert.deepEqual(printSettings(roundtrip.sheets[0]),printSettings(sheet));
 validateWorkbook(roundtrip);
});

test('TASK058: Excel print area uses correct sheet-scoped defined name and quoted absolute refs',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 s.name="Отчёт O'Brien";
 changePrintSettings(s,{area:{from:'B3',to:'H22'}});
 const xml=xlsxPrintArea(s,1,s.name);
 assert.match(xml,/name="_xlnm.Print_Area" localSheetId="0"/);
 assert.match(xml,/&apos;Отчёт O&apos;&apos;Brien&apos;!\$B\$3:\$H\$22/);
 assert.deepEqual(parseXLSXPrintArea("'Отчёт O''Brien'!$B$3:$H$22",s.name),{from:'B3',to:'H22'});
 assert.deepEqual(parseXLSXPrintArea("'Отчёт O''Brien'!B3:H22",s.name),{from:'B3',to:'H22'});
 assert.equal(parseXLSXPrintArea("'Чужой лист'!$B$3:$H$22",s.name),null);
 const second=newSheet('Второй лист');b.sheets.push(second);
 changePrintSettings(second,{area:{from:'C4',to:'D12'}});
 assert.match(xlsxPrintArea(second,2,second.name),/localSheetId="1"/);
});
test('TASK058: unsafe multi-range print areas, external references and inverted coordinates are skipped',()=>{
 assert.equal(parseXLSXPrintArea("'Лист 1'!$A$1:$B$2,'Лист 1'!$D$1:$D$2",'Лист 1'),null);
 assert.equal(parseXLSXPrintArea("'Лист 1'!$D$20:$B$2",'Лист 1'),null);
 assert.equal(parseXLSXPrintArea("[Book2.xlsx]Other!$A$1:$B$2",'Лист 1'),null);
 assert.equal(parseXLSXPrintArea("'Лист 1'!$A$1:$ZZZ$1000000",'Лист 1'),null);
 assert.equal(parseXLSXPrintArea('maliciousFunction()', 'Лист 1'),null);
});
