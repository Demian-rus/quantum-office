import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,getCell,mergeCells,unmergeCells,mergeAt,applyBorderPreset,validateWorkbook,setFreeze} from '../src/core/workbook.js';
import {changeSheetStructure} from '../src/core/structure.js';

function sample(){return currentSheet(newWorkbook());}
test('merge preserves anchor and rejects nonempty covered cells atomically',()=>{
 const s=sample();setCell(s,'A1','Название');setCell(s,'B1','Важное');
 assert.throws(()=>mergeCells(s,'A1','C2'),/Сначала освободите/);
 assert.equal(s.merges.length,0);assert.equal(getCell(s,'B1').value,'Важное');
 setCell(s,'B1','');const m=mergeCells(s,'A1','C2');assert.deepEqual(m,{from:'A1',to:'C2'});
 assert.equal(mergeAt(s,'B2').from,'A1');assert.equal(getCell(s,'A1').value,'Название');
 assert.throws(()=>mergeCells(s,'C2','D3'),/пересекается/);
 assert.equal(unmergeCells(s,'C2'),true);assert.equal(unmergeCells(s,'A1'),false);
});
test('merge rejected across frozen panes but structural insertion preserves merge',()=>{
 const s=sample();setFreeze(s,1,0);assert.throws(()=>mergeCells(s,'A1','A2'),/закреплённую/);
 setFreeze(s,0,0);mergeCells(s,'A1','B2');changeSheetStructure(s,'row','insert',0);assert.deepEqual(s.merges,[{from:'A2',to:'B3'}]);
});
test('rectangle border presets do not draw internal borders',()=>{
 const s=sample();applyBorderPreset(s,'B2','D4','outline');
 assert.deepEqual(getCell(s,'B2').style.borders,{top:true,left:true});
 assert.deepEqual(getCell(s,'C2').style.borders,{top:true});
 assert.deepEqual(getCell(s,'C3').style,{});
 assert.deepEqual(getCell(s,'D4').style.borders,{bottom:true,right:true});
 applyBorderPreset(s,'B2','D4','all');assert.deepEqual(getCell(s,'C3').style.borders,{top:true,bottom:true,left:true,right:true});
 applyBorderPreset(s,'B2','D4','none');assert.deepEqual(getCell(s,'C3').style,{});
});
test('merge schema validation rejects overlap, lost covered values and illegal border props',()=>{
 const b=newWorkbook(),s=currentSheet(b);mergeCells(s,'A1','C3');validateWorkbook(b);
 s.merges.push({from:'B3',to:'D4'});assert.throws(()=>validateWorkbook(b),/Пересекающиеся/);
 s.merges.pop();setCell(s,'C3','hidden');assert.throws(()=>validateWorkbook(b),/Данные внутри/);
 setCell(s,'C3','');s.cells.D4={value:'a',style:{borders:{left:'thin'}}};assert.throws(()=>validateWorkbook(b),/оформление/);
});
