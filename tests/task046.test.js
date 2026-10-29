import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,newSheet,setCell,getCell,setStyle,validateWorkbook,mergeCells} from '../src/core/workbook.js';
import {copyCells,moveCells} from '../src/core/clipboard.js';
import {rebaseMovedFormula} from '../src/core/reference-move.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

const cut=(b,s,a,z=a)=>({...copyCells(s,a,z,b),mode:'cut',bookId:b.id,sheetId:s.id});
const snapshot=b=>JSON.stringify(b);
const region={r1:4,c1:3,r2:5,c2:4}; // D5:E6

test('rebase only genuine formula references, preserving literals and function names',()=>{
 const expression='=SUM(D5:E6)+D5+$E$6+LOG10(1)&"D5 ""E6"""';
 const result=rebaseMovedFormula(expression,'Лист 1','Лист 1',region,5,3);
 assert.equal(result,'=SUM(G10:H11)+G10+$H$11+LOG10(1)&"D5 ""E6"""');
 assert.equal(rebaseMovedFormula('="D5"&D5','Лист 1','Лист 1',region,5,3),'="D5"&G10');
 assert.equal(rebaseMovedFormula('=D1+H5','Лист 1','Лист 1',region,5,3),'=D1+H5');
 assert.equal(rebaseMovedFormula('=D5','Other','Лист 1',region,5,3),'=D5');
 assert.equal(rebaseMovedFormula('=FALSE','Лист 1','Лист 1',region,5,3),'=FALSE');
});
test('cross-sheet explicit quoted and unquoted references follow cut, including absolute anchors',()=>{
 const original="='Лист 1'!$D$5+Лист_1!D5+'Лист 1'!D5:E6+Лист_1!$E6";
 const expected="='Лист 1'!$G$10+Лист_1!D5+'Лист 1'!G10:H11+Лист_1!$E6";
 assert.equal(rebaseMovedFormula(original,'Сводка','Лист 1',region,5,3),expected);
 const quoted="='A1 Zone'!D5+'A1 Zone'!$E$6";
 assert.equal(rebaseMovedFormula(quoted,'Сводка','A1 Zone',region,5,3),"='A1 Zone'!G10+'A1 Zone'!$H$11");
});
test('partially intersected rectangle refuses unchanged source and dependent formulas',()=>{
 for(const input of ['=SUM(C5:D5)','=D4:D6','=SUM(D5:F5)','=E6:E7']){
  assert.throws(()=>rebaseMovedFormula(input,'Лист 1','Лист 1',region,5,3),/частично пересекающий/,input);
 }
 assert.equal(rebaseMovedFormula('=SUM(D5:E6)','Лист 1','Лист 1',region,5,3),'=SUM(G10:H11)');
});
test('cut updates direct/range/qualified formulas across sheets with preserved values and QBOOK',()=>{
 const b=newWorkbook(),s=currentSheet(b);s.name='Учёт';const report=newSheet('Итоги');b.sheets.push(report);
 setCell(s,'D5','20');setCell(s,'E5','30');setCell(s,'D6','=D5+E5');
 setCell(s,'X20','=SUM(D5:E6)+$E$5');
 setCell(s,'X21','="D5 "&D6');
 setCell(report,'B3',"=Учёт!D5+'Учёт'!E5");
 setCell(report,'B4','=D5+1'); // local to Итоги: must remain untouched
 setStyle(s,'D5',{bg:'#ccffcc'});
 const clip=cut(b,s,'D5','E6');
 assert.equal(moveCells(b,s,'G10',clip).end,'H11');
 assert.equal(getCell(s,'G10').value,'20');
 assert.equal(getCell(s,'H10').value,'30');
 assert.equal(getCell(s,'G11').value,'=G10+H10');
 assert.equal(getCell(s,'G10').style.bg,'#ccffcc');
 assert.equal(getCell(s,'X20').value,'=SUM(G10:H11)+$H$10');
 assert.equal(getCell(s,'X21').value,'="D5 "&G11');
 assert.equal(getCell(report,'B3').value,"=Учёт!G10+'Учёт'!H10");
 assert.equal(getCell(report,'B4').value,'=D5+1');
 assert.equal(getCell(s,'D5').value,'');
 validateWorkbook(b);
 const saved=decodeBook(encodeBook(b));
 assert.equal(getCell(saved.sheets[1],'B3').value,"=Учёт!G10+'Учёт'!H10");
});
test('partial-range failure from another sheet is fully atomic for every sheet',()=>{
 const b=newWorkbook(),s=currentSheet(b);s.name='Источник';const report=newSheet('Отчёт');b.sheets.push(report);
 setCell(s,'D5','20');setCell(s,'E5','40');
 setCell(report,'C4','=SUM(Источник!C5:E5)');
 const before=snapshot(b),clip=cut(b,s,'D5','E5');
 assert.throws(()=>moveCells(b,s,'G10',clip),/частично пересекающий/);
 assert.equal(snapshot(b),before);
});
test('overlapping source and target + merged range keep rebindable formula links',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A1','7');setCell(s,'B1','=A1*2');setCell(s,'Z9','=A1+B1');
 const clip=cut(b,s,'A1','B1');
 assert.equal(moveCells(b,s,'B1',clip).end,'C1');
 assert.equal(getCell(s,'B1').value,'7');
 assert.equal(getCell(s,'C1').value,'=B1*2');
 assert.equal(getCell(s,'Z9').value,'=B1+C1');
 const next=cut(b,s,'B1','C1');
 setCell(s,'B4','Head');mergeCells(s,'B4','C4');
 const merged=cut(b,s,'B4','C4');
 assert.equal(moveCells(b,s,'E4',merged).end,'F4');
 assert.deepEqual(s.merges,[{from:'E4',to:'F4'}]);
});
