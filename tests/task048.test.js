import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,setStyle,getCell,mergeCells,setHidden} from '../src/core/workbook.js';
import {copyCells,pasteValuesCells} from '../src/core/clipboard.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

test('TASK048: copy/paste values calculates formula once, preserves target styling and source',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A1','10');setCell(s,'B1','5');setCell(s,'C1','=A1+B1');
 setStyle(s,'G10',{bold:true,bg:'#ff0000'});setStyle(s,'H10',{bg:'#00ff00'});
 const clip=copyCells(s,'A1','C1',b);
 const info=pasteValuesCells(s,'G10',clip,b);
 assert.equal(info.end,'I10');
 assert.deepEqual(['G10','H10','I10'].map(k=>getCell(s,k).value),['10','5','15']);
 assert.deepEqual(getCell(s,'G10').style,{bold:true,bg:'#ff0000'});
 assert.deepEqual(getCell(s,'H10').style,{bg:'#00ff00'});
 assert.equal(getCell(s,'C1').value,'=A1+B1');
 setCell(s,'A1','30');assert.equal(getCell(s,'I10').value,'15','pasted result should not recalculate');
 const saved=decodeBook(encodeBook(b));
 assert.equal(getCell(currentSheet(saved),'I10').value,'15');
});
test('TASK048: prevent cut, malformed TSV and accidental formulas without edits',()=>{
 const b=newWorkbook(),s=currentSheet(b);setCell(s,'A1','safe');
 const clip=copyCells(s,'A1','A1',b),before=JSON.stringify(s.cells);
 assert.throws(()=>pasteValuesCells(s,'B1',{...clip,mode:'cut'},b),/скопируйте/);
 assert.throws(()=>pasteValuesCells(s,'B1',{...clip,text:'one\ntwo'},b),/переносы строк/);
 assert.throws(()=>pasteValuesCells(s,'B1',{...clip,text:'=A1'},b),/изменения типа/);
 assert.equal(JSON.stringify(s.cells),before);
});
test('TASK048: merges, hidden cells and out-of-bounds are rejected before mutation',()=>{
 const b=newWorkbook(),s=currentSheet(b);setCell(s,'A1','1');setCell(s,'A2','2');
 const clip=copyCells(s,'A1','A2',b);
 mergeCells(s,'D4','E4');
 const before=JSON.stringify(s.cells);
 assert.throws(()=>pasteValuesCells(s,'D4',clip,b),/объединённые/);
 assert.equal(JSON.stringify(s.cells),before);
 setHidden(s,'row',10,true);
 assert.throws(()=>pasteValuesCells(s,'B11',clip,b),/скрытые строки/);
 setHidden(s,'col',5,true);
 assert.throws(()=>pasteValuesCells(s,'F4',clip,b),/скрытые столбцы/);
 assert.throws(()=>pasteValuesCells(s,'A100000',clip,b),/пределы/);
});
