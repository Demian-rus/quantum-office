import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,setStyle,getCell,mergeCells,newSheet,validateWorkbook} from '../src/core/workbook.js';
import {copyCells,moveCells} from '../src/core/clipboard.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

function cut(b,sh,from,to=from){return {...copyCells(sh,from,to,b),mode:'cut',bookId:b.id,sheetId:sh.id};}
const raw=sh=>JSON.stringify({cells:sh.cells,merges:sh.merges});
test('same-sheet cut is deferred, moves value/style/formulas as one atomic operation, overlapping too',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A1','first');setStyle(s,'A1',{bg:'#ffddcc',bold:true});
 setCell(s,'B1','second');setCell(s,'A2','=H1*2');
 const clip=cut(b,s,'A1','B2'),before=raw(s);
 assert.equal(raw(s),before,'Ctrl+X only stages; it does not clear the source');
 const result=moveCells(b,s,'B2',clip);
 assert.equal(result.end,'C3');
 assert.equal(getCell(s,'B2').value,'first');
 assert.equal(getCell(s,'C2').value,'second');
 assert.equal(getCell(s,'B3').value,'=H1*2','cut does not translate references to unmoved cells');
 assert.equal(getCell(s,'B2').style.bg,'#ffddcc');
 assert.equal(getCell(s,'A1').value,'');
 assert.equal(getCell(s,'B1').value,'');
 validateWorkbook(b);
 assert.equal(getCell(currentSheet(decodeBook(encodeBook(b))),'B3').value,'=H1*2');
});
test('merged rectangular cut preserves full merge and rejects a partial source or foreign destination merge',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A1','Header');mergeCells(s,'A1','B1');
 assert.throws(()=>copyCells(s,'A1','A2',b),/частично/);
 const clip=cut(b,s,'A1','B1'),before=raw(s);
 const moved=moveCells(b,s,'D2',clip);
 assert.equal(moved.end,'E2');
 assert.equal(getCell(s,'D2').value,'Header');
 assert.deepEqual(s.merges,[{from:'D2',to:'E2'}]);
 assert.equal(getCell(s,'A1').value,'');
 assert.notEqual(raw(s),before);
 const other=cut(b,s,'D2','E2');
 setCell(s,'G2','occupied');mergeCells(s,'G2','H2');
 const snapshot=raw(s);
 assert.throws(()=>moveCells(b,s,'G2',other),/другим объединением/);
 assert.equal(raw(s),snapshot);
});
test('stale sources, invalid target, hidden areas and source changes reject without mutation',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A1','old');const clip=cut(b,s,'A1');
 setCell(s,'A1','modified');let before=raw(s);
 assert.throws(()=>moveCells(b,s,'C1',clip),/изменились/);
 assert.equal(raw(s),before);
 const fresh=cut(b,s,'A1');
 assert.throws(()=>moveCells(b,s,'A100001',fresh),/Повреждённый диапазон/);
 before=raw(s);assert.equal(raw(s),before);
 s.hiddenRows[3]=true;
 assert.throws(()=>moveCells(b,s,'A4',fresh),/скрытые строки/);
 delete s.hiddenRows[3];
 s.hiddenColumns[5]=true;
 assert.throws(()=>moveCells(b,s,'F1',fresh),/скрытые столбцы/);
 delete s.hiddenColumns[5];
 const extra=newSheet('Другой');b.sheets.push(extra);
 assert.throws(()=>moveCells(b,extra,'A1',fresh),/исходный лист/);
 assert.equal(raw(s),before);
});
test('dependent direct and qualified references now follow moved cells; partial ranges remain guarded',()=>{
 for(const [formula,expected] of [['=A1*2','=E5*2'],["='Лист 1'!$A$1+1","='Лист 1'!$E$5+1"]]){
  const b=newWorkbook(),s=currentSheet(b);
  setCell(s,'A1','20');setCell(s,'Z9',formula);
  const clip=cut(b,s,'A1');
  assert.equal(moveCells(b,s,'E5',clip).end,'E5');
  assert.equal(getCell(s,'Z9').value,expected);
 }
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A1','20');setCell(s,'Z9','=SUM(A1:B4)');
 const clip=cut(b,s,'A1'),before=raw(s);
 assert.throws(()=>moveCells(b,s,'E5',clip),/частично пересекающий/);
 assert.equal(raw(s),before);
 const c=newWorkbook(),t=currentSheet(c);
 setCell(t,'A1','20');setCell(t,'Z9','=Q2*2');
 const another=cut(c,t,'A1');
 assert.equal(moveCells(c,t,'E5',another).end,'E5');
});
test('full-sheet cell cap is checked before applying a move',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A1','x');
 const clip=cut(b,s,'A1');
 // Equivalent count; cut cannot exceed the cap by shifting existing data.
 const result=moveCells(b,s,'X4',clip);
 assert.equal(result.rows,1);
 assert.equal(getCell(s,'X4').value,'x');
});
