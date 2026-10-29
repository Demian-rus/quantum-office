import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,newSheet,currentSheet,setCell,setStyle,getCell} from '../src/core/workbook.js';
import {copyCells,pasteCells,pasteValuesCells} from '../src/core/clipboard.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

test('TASK049: multiline and tab-containing values retain exact cell boundaries, style and QBOOK',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A1','Первая\nВторая');setCell(s,'B1','красный\tсиний');
 setCell(s,'A2','10');setCell(s,'B2','5');setCell(s,'C1','=SUM(A2:B2)');
 setStyle(s,'F10',{bg:'#ff0000',bold:true});
 const clip=copyCells(s,'A1','C1',b);
 assert.deepEqual(clip.values,[['Первая\nВторая','красный\tсиний','15']]);
 assert.equal(clip.cells[0][2].value,'=SUM(A2:B2)');
 setCell(s,'A1','ИЗМЕНЕНО');setCell(s,'A2','999');
 const result=pasteValuesCells(s,'F10',clip,b);
 assert.equal(result.end,'H10');
 assert.deepEqual(['F10','G10','H10'].map(ref=>getCell(s,ref).value),['Первая\nВторая','красный\tсиний','15']);
 assert.deepEqual(getCell(s,'F10').style,{bg:'#ff0000',bold:true});
 assert.equal(getCell(s,'C1').value,'=SUM(A2:B2)');
 const saved=decodeBook(encodeBook(b)),part=currentSheet(saved);
 assert.equal(getCell(part,'F10').value,'Первая\nВторая');
 assert.equal(getCell(part,'G10').value,'красный\tсиний');
 assert.equal(getCell(part,'H10').value,'15');
});
test('TASK049: cross-sheet formula results are snapshotted, not recalculated on paste',()=>{
 const b=newWorkbook(),s=currentSheet(b),other=newSheet('Итоги');
 s.name='Учёт';b.sheets.push(other);setCell(other,'A1','18');
 setCell(s,'D4','=Итоги!A1+2');
 const clip=copyCells(s,'D4','D4',b);
 assert.deepEqual(clip.values,[['20']]);
 setCell(other,'A1','90');
 pasteValuesCells(s,'H10',clip,b);
 assert.equal(getCell(s,'H10').value,'20');
});
test('TASK049: corrupt dimensions/text/data are rejected before any changes',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A1','строка\nс переносом');setCell(s,'B1','с\tтабуляцией');
 const clip=copyCells(s,'A1','B1',b),before=JSON.stringify(s.cells);
 for(const bad of [
  {...clip,text:'ДРУГОЕ'}, {...clip,values:[['A']]},
  {...clip,values:[[null,'x']]},{...clip,values:[[5,'x']]},
  {...clip,values:undefined},{...clip,mode:'cut'}
 ]){
  assert.throws(()=>pasteValuesCells(s,'F7',bad,b));
  assert.equal(JSON.stringify(s.cells),before);
 }
 assert.equal(getCell(s,'F7').value,'');
});
test('TASK049: literal result beginning with = is conservatively refused',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A1','="=НЕ ФОРМУЛА"');
 const clip=copyCells(s,'A1','A1',b);
 assert.equal(clip.values[0][0],'=НЕ ФОРМУЛА');
 const before=JSON.stringify(s.cells);
 assert.throws(()=>pasteValuesCells(s,'H10',clip,b),/изменения типа/);
 assert.equal(JSON.stringify(s.cells),before);
});
test('TASK049: ordinary Ctrl+V still copies formulas and styles',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A1','7');setCell(s,'B1','=A1*2');setStyle(s,'B1',{bold:true});
 const clip=copyCells(s,'A1','B1',b);
 pasteCells(s,'D4',clip);
 assert.equal(getCell(s,'E4').value,'=D4*2');
 assert.deepEqual(getCell(s,'E4').style,{bold:true});
});
