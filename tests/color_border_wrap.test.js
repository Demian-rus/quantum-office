import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,setStyle,getCell,validateWorkbook,setRowHeight,rowHeight} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
import {exportXLSX} from '../src/core/xlsx.js';

test('color, full border and wrapping persist in Quantum native book',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'B3','Длинное примечание к занятию');
 setStyle(s,'B3',{bg:'#15b9a1',color:'#111111',border:'thin',wrap:true});
 setRowHeight(s,2,74);
 const round=decodeBook(encodeBook(b));
 assert.deepEqual(getCell(round.sheets[0],'B3').style,{bg:'#15b9a1',color:'#111111',border:'thin',wrap:true});
 assert.equal(rowHeight(round.sheets[0],2),74);
});
test('border removal preserves data and other styles, and deletes empty phantom cells',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'A1','=SUM(B1:B2)');
 setStyle(s,'A1',{border:'thin',wrap:true,color:'#aa0033'});
 setStyle(s,'A1',{border:undefined});
 assert.equal(getCell(s,'A1').value,'=SUM(B1:B2)');
 assert.deepEqual(getCell(s,'A1').style,{wrap:true,color:'#aa0033'});
 setStyle(s,'D4',{border:'thin'});setStyle(s,'D4',{border:undefined});
 assert.equal(Object.hasOwn(s.cells,'D4'),false);
 validateWorkbook(newWorkbook());
});
test('invalid border or wrap styles rejected on imported workbook',()=>{
 const b=newWorkbook(),s=currentSheet(b);setCell(s,'A1','x');
 setStyle(s,'A1',{border:'url(evil)'});assert.throws(()=>validateWorkbook(b),/оформление/);
 setStyle(s,'A1',{border:undefined,wrap:'true'});assert.throws(()=>validateWorkbook(b),/оформление/);
});
test('XLSX emits real thin borders and wrapText in standard styles.xml',async()=>{
 const b=newWorkbook(),s=currentSheet(b);setCell(s,'A1','Перенос строки');setStyle(s,'A1',{border:'thin',wrap:true});
 const bytes=await exportXLSX(b);const zip=await globalThis.JSZip.loadAsync(bytes);
 const styles=await zip.file('xl/styles.xml').async('string');
 assert.match(styles,/<borders count="2">/);
 assert.match(styles,/<left style="thin"\/>/);
 assert.match(styles,/borderId="1"/);
 assert.match(styles,/wrapText="1"/);
});
