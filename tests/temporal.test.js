import test from 'node:test';
import assert from 'node:assert/strict';
import {dateSerial,serialDateParts,timeSerial,serialTimeParts,formatTemporal,parseTemporalInput} from '../src/core/dates.js';
import {newWorkbook,newSheet,currentSheet,setCell,setTypedCell,setStyle,getCell,rawMap,formulaContext,resultOf,displayedValue,validateWorkbook} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
import {exportXLSX} from '../src/core/xlsx.js';

function calc(book,sheet,ref){const raw=rawMap(sheet);return resultOf(sheet,ref,raw,formulaContext(book,sheet,raw));}
function display(book,sheet,ref){const raw=rawMap(sheet);return displayedValue(sheet,ref,raw,formulaContext(book,sheet,raw));}
test('1900 date serial, leap years, month rollover and Excel phantom day',()=>{
 assert.equal(dateSerial(1900,1,1),1);
 assert.equal(dateSerial(1900,2,28),59);
 assert.equal(dateSerial(1900,3,1),61);
 assert.deepEqual(serialDateParts(60),{year:1900,month:2,day:29,phantom:true});
 assert.deepEqual(serialDateParts(dateSerial(2024,2,29)),{year:2024,month:2,day:29});
 assert.throws(()=>dateSerial(2023,2,29),/Invalid date/);
 assert.throws(()=>dateSerial(2024,13,1),/Invalid date/);
 assert.equal(dateSerial(2024,2,30,true),dateSerial(2024,3,1));
 assert.equal(formatTemporal(60,'date'),'29.02.1900');
});
test('unambiguous date and time input uses numeric serial with display formatting',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setTypedCell(s,'A1','2026-10-29');
 setTypedCell(s,'B1','29.10.2026 09:30');
 setTypedCell(s,'A2','09:00');
 setTypedCell(s,'B2','12:30');
 setTypedCell(s,'C2','[27]:15');
 assert.equal(getCell(s,'A1').value,String(dateSerial(2026,10,29)));
 assert.equal(display(b,s,'A1'),'29.10.2026');
 assert.equal(display(b,s,'B1'),'29.10.2026 09:30');
 assert.equal(display(b,s,'A2'),'09:00');
 assert.equal(display(b,s,'B2'),'12:30');
 assert.equal(display(b,s,'C2'),'27:15');
 assert.equal(getCell(s,'C2').style.format,'duration');
 assert.equal(parseTemporalInput('2023-02-29'),null);
 setTypedCell(s,'D1','2023-02-29');
 assert.equal(getCell(s,'D1').value,'2023-02-29'); // invalid ISO date remains a string, never a serial
});
test('DATE TODAY YEAR MONTH DAY TIME HOUR MINUTE and duration calculations',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 for(const [ref,raw] of Object.entries({
  A1:'=DATE(2024;2;29)',A2:'=YEAR(A1)',A3:'=MONTH(A1)',A4:'=DAY(A1)',
  A5:'=DATE(2024,2,30)',A6:'=DATE(1899,12,31)',A7:'=DATE(2023,14,1)',
  B1:'=TIME(9,30,0)',B2:'=HOUR(B1)',B3:'=MINUTE(B1)',B4:'=TIME(24,0,0)',
  C1:'=TODAY()',C2:'=DATE(YEAR(C1),MONTH(C1),DAY(C1))',
  D1:'=YEAR(60)',D2:'=MONTH(60)',D3:'=DAY(60)',
  E1:'=IFERROR(YEAR(0),"invalid")'
 }))setCell(s,ref,raw);
 assert.equal(calc(b,s,'A1'),dateSerial(2024,2,29));
 assert.deepEqual(['A2','A3','A4'].map(ref=>calc(b,s,ref)),[2024,2,29]);
 assert.equal(calc(b,s,'A5'),dateSerial(2024,3,1));
 assert.equal(calc(b,s,'A6'),'#NUM!');
 assert.equal(calc(b,s,'A7'),dateSerial(2024,2,1));
 assert.equal(calc(b,s,'B2'),9);assert.equal(calc(b,s,'B3'),30);
 assert.equal(calc(b,s,'B4'),'#NUM!');
 assert.equal(calc(b,s,'C1'),calc(b,s,'C2'));
 assert.deepEqual(['D1','D2','D3'].map(ref=>calc(b,s,ref)),[1900,2,29]);
 assert.equal(calc(b,s,'E1'),'invalid');
 setTypedCell(s,'F1','09:15');setTypedCell(s,'F2','11:45');
 setCell(s,'F3','=F2-F1');setStyle(s,'F3',{format:'duration'});
 assert.equal(display(b,s,'F3'),'2:30');
 setCell(s,'F4','=F1-F2');setStyle(s,'F4',{format:'duration'});
 assert.equal(display(b,s,'F4'),'#NUM!');
});
test('typed values round-trip through .qbook, xlsx keeps dates as numeric cells',async()=>{
 const b=newWorkbook('Занятия'),s=currentSheet(b);s.name='График';
 setTypedCell(s,'A1','2026-10-29');
 setTypedCell(s,'B1','09:30');
 setTypedCell(s,'C1','[26]:15');
 setCell(s,'D1','=DATE(2024,2,29)');setStyle(s,'D1',{format:'date'});
 const finance=newSheet('Бухгалтерия');b.sheets.push(finance);
 setCell(finance,'A1','=График!A1+7');setStyle(finance,'A1',{format:'date'});
 const after=decodeBook(encodeBook(b));
 assert.equal(display(after,after.sheets[0],'A1'),'29.10.2026');
 assert.equal(display(after,after.sheets[1],'A1'),'05.11.2026');
 assert.equal(validateWorkbook(after),after);
 const zip=await globalThis.JSZip.loadAsync(await exportXLSX(after));
 const sheetXml=await zip.file('xl/worksheets/sheet1.xml').async('string');
 const stylesXml=await zip.file('xl/styles.xml').async('string');
 assert.match(sheetXml,/r="A1"[^>]*><v>\d+<\/v>/);
 assert.match(sheetXml,/r="B1"[^>]*><v>0\./);
 assert.match(sheetXml,/<f>DATE\(2024,2,29\)<\/f>/);
 assert.match(stylesXml,/numFmtId="14"/);
 assert.match(stylesXml,/numFmtId="20"/);
 assert.match(stylesXml,/numFmtId="46"/);
 assert.match((await zip.file('xl/workbook.xml').async('string')),/date1904="0"/);
});
test('reject invalid date format metadata rather than corrupt import',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A1','5');setStyle(s,'A1',{format:'date'});validateWorkbook(b);
 s.cells.A1.style.format='unknown-date';
 assert.throws(()=>validateWorkbook(b),/Недопустимое оформление/);
 assert.deepEqual(serialTimeParts(timeSerial(23,59,59)),{hours:23,minutes:59,seconds:59});
});
