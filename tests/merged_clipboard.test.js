import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,getCell,setCell,setStyle,mergeCells,mergeAt,fillSelection,sortSelectedRows} from '../src/core/workbook.js';
import {copyCells,pasteCells} from '../src/core/clipboard.js';
const sheet=()=>currentSheet(newWorkbook());
test('merged cell copies full geometry, formula and style',()=>{
 const s=sheet();setCell(s,'B2','=A1+10');setStyle(s,'B2',{bg:'#ffee00'});mergeCells(s,'B2','D3');
 const clip=copyCells(s,'B2','B2');assert.equal(clip.rows,2);assert.equal(clip.cols,3);assert.equal(clip.merges.length,1);
 pasteCells(s,'F4',clip);assert.deepEqual(mergeAt(s,'G5'),{from:'F4',to:'H5'});
 assert.equal(getCell(s,'F4').value,'=E3+10');assert.equal(getCell(s,'F4').style.bg,'#ffee00');
});
test('multi-merge copied region preserves independent regions',()=>{
 const s=sheet();setCell(s,'A1','a');setCell(s,'C1','c');mergeCells(s,'A1','B2');mergeCells(s,'C1','D1');
 const clip=copyCells(s,'A1','D3');pasteCells(s,'E4',clip);
 assert.deepEqual(mergeAt(s,'E5'),{from:'E4',to:'F5'});assert.deepEqual(mergeAt(s,'G4'),{from:'G4',to:'H4'});
});
test('partial selection and collision are rejected before changing any cells',()=>{
 const s=sheet();setCell(s,'A1','a');mergeCells(s,'A1','C2');
 assert.throws(()=>copyCells(s,'B1','D2'),/частично/);
 const clip=copyCells(s,'A1','A1');mergeCells(s,'E4','F4');const before=structuredClone(s);
 assert.throws(()=>pasteCells(s,'D4',clip),/поверх объединённой/);assert.deepEqual(s,before);
});
test('out-of-range and invalid merged clipboard fail atomically',()=>{
 const s=sheet();mergeCells(s,'A1','B2');const clip=copyCells(s,'A1','A1'),before=structuredClone(s);
 assert.throws(()=>pasteCells(s,'CV2000',clip),/пределы/);
 const bad=structuredClone(clip);bad.merges[0].r2=99;
 assert.throws(()=>pasteCells(s,'F4',bad),/Повреждённые/);assert.deepEqual(s,before);
});
test('formula translation error never partially writes pasted data',()=>{
 const s=sheet();mergeCells(s,'B1','C1');const clip=copyCells(s,'A1','C1'),before=structuredClone(s);
 clip.cells[0][0].value='=A2000';
 assert.throws(()=>pasteCells(s,'D2',clip),/пределы/);assert.deepEqual(s,before);
});
test('sort and fill reject merged regions atomically',()=>{
 const s=sheet();mergeCells(s,'A1','B2');const before=structuredClone(s);
 assert.throws(()=>fillSelection(s,'A1','C3','down'),/объединённых/);
 assert.throws(()=>sortSelectedRows(s,'A1','C3','asc'),/объединёнными/);
 assert.deepEqual(s,before);
});
