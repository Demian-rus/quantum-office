import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,setStyle,setWholeSheetAlignment,validateWorkbook,cellName} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
import {copyCells,pasteCells} from '../src/core/clipboard.js';
import {exportXLSX} from '../src/core/xlsx.js';

test('aligning 200,000-cell sheet is O(populated cells), retains data and overrides old individual alignments',()=>{
 const book=newWorkbook(),s=currentSheet(book);
 setCell(s,'A1','Заголовок');setStyle(s,'A1',{align:'left',bold:true});
 setCell(s,'CV2000','Последняя ячейка');setStyle(s,'CV2000',{align:'right',bg:'#abcdef'});
 const old=structuredClone(book);
 setWholeSheetAlignment(s,'center');
 assert.equal(s.defaultAlign,'center');
 assert.equal(Object.keys(s.cells).length,2);
 assert.equal(s.cells.A1.style.align,undefined);
 assert.equal(s.cells.CV2000.style.align,undefined);
 assert.equal(s.cells.CV2000.style.bg,'#abcdef');
 assert.equal(s.cells.CV2000.value,'Последняя ячейка');
 validateWorkbook(book);
 const reopened=decodeBook(encodeBook(book));
 assert.equal(reopened.sheets[0].defaultAlign,'center');
 assert.equal(old.sheets[0].defaultAlign,null); // undo snapshot remains independent
 setStyle(s,'B2',{align:'right'});
 assert.equal(s.cells.B2.style.align,'right');
 assert.equal(s.defaultAlign,'center');
 setWholeSheetAlignment(s,'left');
 assert.equal(s.cells.B2,undefined);
 assert.equal(s.defaultAlign,'left');
});
test('large selection formatting cannot bypass color/border cell limits; malicious alignment metadata is rejected',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 assert.throws(()=>setWholeSheetAlignment(s,'middle'),/выравнивание/);
 s.defaultAlign='middle';
 assert.throws(()=>validateWorkbook(b),/выравнивания/);
 s.defaultAlign='center';
 assert.doesNotThrow(()=>validateWorkbook(b));
});
test('clipboard transfers the effective default alignment without creating individual cell objects',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setWholeSheetAlignment(s,'center');
 const clip=copyCells(s,'B2','C3',b);
 assert.equal(s.cells.B2,undefined);
 assert.equal(clip.cells[0][0].style.align,'center');
 pasteCells(s,'D4',clip);
 assert.equal(s.cells.D4.style.align,'center');
 assert.equal(s.defaultAlign,'center');
});
test('XLSX column styles serialize global centered alignment without 200,000 virtual cells',async()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'B2','Пример');setStyle(s,'B2',{bold:true});
 setWholeSheetAlignment(s,'center');
 const bytes=await exportXLSX(b),zip=await globalThis.JSZip.loadAsync(bytes,{checkCRC32:true});
 const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
 const styles=await zip.file('xl/styles.xml').async('string');
 assert.match(xml,/<col min="1" max="1"[^>]+style="\d+"/);
 assert.match(xml,/<col min="100" max="100"[^>]+style="\d+"/);
 assert.match(styles,/alignment horizontal="center"/);
 assert.equal((xml.match(/<c /g)||[]).length,1);
 assert.match(xml,/<c r="B2"[^>]* s="\d+"/);
});
