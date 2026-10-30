import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,setTypedCell,setStyle,getCell,extendFillHandle,validateWorkbook} from '../src/core/workbook.js';
import {dateSerial,formatTemporal} from '../src/core/dates.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
const make=()=>{const book=newWorkbook();return {book,sheet:currentSheet(book)};};
const values=(s,refs)=>refs.map(r=>getCell(s,r).value);

test('TASK071: upward arithmetic fill preserves seeds and cycles seed formatting backwards',()=>{
 const {sheet}=make();setCell(sheet,'B5','8');setCell(sheet,'B6','11');setStyle(sheet,'B6',{bold:true});
 assert.deepEqual(extendFillHandle(sheet,'B5','B6','up',1),{count:3,from:'B2',to:'B6',mode:'values'});
 assert.deepEqual(values(sheet,['B2','B3','B4','B5','B6']),['-1','2','5','8','11']);
 assert.equal(getCell(sheet,'B4').style.bold,true);assert.equal(getCell(sheet,'B3').style.bold,undefined);
});
test('TASK071: leftward fill continues each row independently and reverses text cycles',()=>{
 const {sheet}=make();
 for(const [r,v] of Object.entries({D3:'10',E3:'15',D4:'first',E4:'second'}))setCell(sheet,r,v);
 const r=extendFillHandle(sheet,'E4','D3','left',0);
 assert.deepEqual([r.from,r.to,r.count],['A3','E4',6]);
 assert.deepEqual(values(sheet,['A3','B3','C3']),['-5','0','5']);
 assert.deepEqual(values(sheet,['A4','B4','C4']),['second','first','second']);
});
test('TASK071: up and left formula fills respect mixed locks and reject out-of-bounds refs atomically',()=>{
 const {sheet}=make();setCell(sheet,'D6','=C6+$B$1+C$2+$B6');
 extendFillHandle(sheet,'D6','D6','up',3);
 assert.equal(getCell(sheet,'D4').value,'=C4+$B$1+C$2+$B4');
 extendFillHandle(sheet,'D6','D6','left',2);
 assert.equal(getCell(sheet,'C6').value,'=B6+$B$1+B$2+$B6');
 setCell(sheet,'D8','=B8');const before=JSON.stringify(sheet);
 assert.throws(()=>extendFillHandle(sheet,'D8','D8','left',0),/пределы/);
 assert.equal(JSON.stringify(sheet),before);
});
test('TASK071: one date advances across leap day/year while one ordinary number still repeats',()=>{
 const {book,sheet}=make();setTypedCell(sheet,'B2','28.02.2024');
 extendFillHandle(sheet,'B2','B2','down',4);
 assert.deepEqual(values(sheet,['B3','B4','B5']).map(v=>formatTemporal(v,'date')),
  ['29.02.2024','01.03.2024','02.03.2024']);
 setTypedCell(sheet,'E4','2026-01-01');extendFillHandle(sheet,'E4','E4','left',2);
 assert.equal(formatTemporal(getCell(sheet,'C4').value,'date'),'30.12.2025');
 setCell(sheet,'G1','42');extendFillHandle(sheet,'G1','G1','down',2);
 assert.equal(getCell(sheet,'G3').value,'42');
 validateWorkbook(book);const again=decodeBook(encodeBook(book));
 assert.equal(again.sheets[0].cells.B3.style.format,'date');
 assert.equal(again.sheets[0].cells.B3.value,String(dateSerial(2024,2,29)));
});
test('TASK071: two weekly dates extend both forward and backward with their original interval',()=>{
 const {sheet}=make();setTypedCell(sheet,'C5','06.03.2024');setTypedCell(sheet,'C6','13.03.2024');
 extendFillHandle(sheet,'C5','C6','up',2);extendFillHandle(sheet,'C5','C6','down',7);
 assert.deepEqual(values(sheet,['C3','C4','C7','C8']).map(v=>formatTemporal(v,'date')),
  ['21.02.2024','28.02.2024','20.03.2024','27.03.2024']);
});
test('TASK071: datetime fills retain time of day and inherited date formats become explicit',()=>{
 const {sheet}=make();setTypedCell(sheet,'C3','2026-12-31 18:30');
 extendFillHandle(sheet,'C3','C3','right',4);
 assert.equal(formatTemporal(getCell(sheet,'E3').value,'datetime'),'02.01.2027 18:30');
 sheet.columnStyles[2]={format:'date',color:'#336699'};setCell(sheet,'C8',String(dateSerial(2026,10,30)));
 extendFillHandle(sheet,'C8','C8','left',0);
 assert.equal(getCell(sheet,'A8').style.format,'date');assert.equal(getCell(sheet,'A8').style.color,'#336699');
 assert.equal(formatTemporal(getCell(sheet,'A8').value,'date'),'28.10.2026');
});
test('TASK071: temporal overflow/underflow reject the complete fill without replacing earlier destinations',()=>{
 const {sheet}=make();setTypedCell(sheet,'B4','02.01.1900');setCell(sheet,'B3','keep');
 let before=JSON.stringify(sheet);
 assert.throws(()=>extendFillHandle(sheet,'B4','B4','up',0),/1900/);
 assert.equal(JSON.stringify(sheet),before);
 setTypedCell(sheet,'D1','30.12.9999');before=JSON.stringify(sheet);
 assert.throws(()=>extendFillHandle(sheet,'D1','D1','down',3),/9999/);
 assert.equal(JSON.stringify(sheet),before);
});
test('TASK071: reversed fills retain hidden/merged/validation guards and the destination cap',()=>{
 const {sheet}=make();setCell(sheet,'D6','no');sheet.hiddenRows[3]=true;
 let before=JSON.stringify(sheet);
 assert.throws(()=>extendFillHandle(sheet,'D6','D6','up',2),/скрытые/);assert.equal(JSON.stringify(sheet),before);
 sheet.hiddenRows={};sheet.merges=[{from:'B6',to:'C6'}];before=JSON.stringify(sheet);
 assert.throws(()=>extendFillHandle(sheet,'D6','D6','left',0),/объединённые/);assert.equal(JSON.stringify(sheet),before);
 sheet.merges=[];sheet.validations=[{id:'v',from:'C6',to:'C6',kind:'list',options:['yes','okay']}];
 before=JSON.stringify(sheet);
 assert.throws(()=>extendFillHandle(sheet,'D6','D6','left',0),/Недопустимое/);assert.equal(JSON.stringify(sheet),before);
 assert.throws(()=>extendFillHandle(sheet,'D20000','D20000','up',0),/10 000/);
 for(const [direction,target] of [['up',-1],['up',5],['left',3],['left',100]])
  assert.throws(()=>extendFillHandle(sheet,'D6','D6',direction,target),/выше или левее/);
});
