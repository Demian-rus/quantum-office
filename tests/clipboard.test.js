import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,setStyle,getCell} from '../src/core/workbook.js';
import {copyCells,pasteCells} from '../src/core/clipboard.js';

test('single cell copy/paste works without editor focus or browser clipboard',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'A1','Содержимое');
 const copy=copyCells(s,'A1','A1');assert.equal(copy.text,'Содержимое');
 const result=pasteCells(s,'F9',copy);
 assert.equal(result.end,'F9');assert.equal(getCell(s,'F9').value,'Содержимое');
});
test('a block copy retains formulas, styles and relative references',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'A1','14');setCell(s,'B1','=A1*$C$1');
 setCell(s,'A2','9');setCell(s,'B2','=A2+$D2');setStyle(s,'A1',{bold:true,bg:'#e9eef5'});
 const copy=copyCells(s,'A1','B2');pasteCells(s,'E5',copy);
 assert.equal(getCell(s,'E5').value,'14');assert.deepEqual(getCell(s,'E5').style,{bold:true,bg:'#e9eef5'});
 assert.equal(getCell(s,'F5').value,'=E5*$C$1');
 assert.equal(getCell(s,'F6').value,'=E6+$D6');
 assert.equal(getCell(s,'A1').value,'14');
});
test('invalid paste stops before mutating any target',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'A1','=B100000');setCell(s,'A2','original');
 const copy=copyCells(s,'A1','A2');const before=structuredClone(s.cells);
 assert.throws(()=>pasteCells(s,'A2',copy),/пределы/);
 assert.deepEqual(s.cells,before);
});
test('copy snapshots the cells rather than pointing to live state',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'A1','OLD');
 const copy=copyCells(s,'A1','A1');setCell(s,'A1','NEW');
 pasteCells(s,'B1',copy);assert.equal(getCell(s,'B1').value,'OLD');
});
