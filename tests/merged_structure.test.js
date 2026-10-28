import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,getCell,setStyle,mergeCells,validateWorkbook,setFreeze,setHidden,setRowHeight,setColumnWidth,LIMITS,cellName,setAutoFilter} from '../src/core/workbook.js';
import {changeSheetStructure} from '../src/core/structure.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
import {exportXLSX} from '../src/core/xlsx.js';
const make=()=>{const book=newWorkbook();return {book,s:currentSheet(book)};};
const names=s=>s.merges.map(m=>m.from+':'+m.to);
test('insertion before merge relocates anchor, style, formulas and .qbook geometry',()=>{
 const {book,s}=make();setCell(s,'B2','Header');setStyle(s,'B2',{bg:'#aabbcc'});mergeCells(s,'B2','D4');setCell(s,'F1','=B2+2');
 changeSheetStructure(s,'row','insert',1);assert.deepEqual(names(s),['B3:D5']);
 assert.equal(getCell(s,'B3').value,'Header');assert.equal(getCell(s,'F1').value,'=B3+2');
 changeSheetStructure(s,'col','insert',1);assert.deepEqual(names(s),['C3:E5']);
 assert.equal(getCell(s,'C3').style.bg,'#aabbcc');assert.equal(getCell(s,'G1').value,'=C3+2');
 validateWorkbook(book);assert.deepEqual(decodeBook(encodeBook(book)).sheets[0].merges,s.merges);
});
test('insertion inside existing merged rectangle expands both axes',()=>{
 const {book,s}=make();setCell(s,'B2','Merged');mergeCells(s,'B2','D4');
 changeSheetStructure(s,'row','insert',3);changeSheetStructure(s,'col','insert',3);
 assert.deepEqual(names(s),['B2:E5']);assert.equal(getCell(s,'B2').value,'Merged');validateWorkbook(book);
});
test('deleting before or inside non-anchor portion shifts or shrinks the merge',()=>{
 const {book,s}=make();setCell(s,'C3','M');mergeCells(s,'C3','E5');
 changeSheetStructure(s,'row','delete',0);changeSheetStructure(s,'col','delete',0);
 assert.deepEqual(names(s),['B2:D4']);
 changeSheetStructure(s,'row','delete',2);changeSheetStructure(s,'col','delete',2);
 assert.deepEqual(names(s),['B2:C3']);assert.equal(getCell(s,'B2').value,'M');validateWorkbook(book);
});
test('single-cell remnant unmerges without losing anchor',()=>{
 const {book,s}=make();setCell(s,'B2','M');mergeCells(s,'B2','C2');changeSheetStructure(s,'col','delete',2);
 assert.deepEqual(names(s),[]);assert.equal(getCell(s,'B2').value,'M');validateWorkbook(book);
});
test('deleting the anchor band is refused atomically for either axis',()=>{
 for(const axis of ['row','col']){
  const {s}=make();setCell(s,'B2','M');mergeCells(s,'B2','C3');const before=structuredClone(s);
  assert.throws(()=>changeSheetStructure(s,axis,'delete',1),/началом объединения/);assert.deepEqual(s,before);
 }
});
test('boundary pushes and excessive growth reject without mutations',()=>{
 for(const axis of ['row','col']){
  const {s}=make();const max=axis==='row'?LIMITS.rows:LIMITS.columns;
  if(axis==='row')mergeCells(s,cellName(max-2,1),cellName(max-1,1));
  else mergeCells(s,cellName(1,max-2),cellName(1,max-1));
  const before=structuredClone(s);
  assert.throws(()=>changeSheetStructure(s,axis,'insert',0),/Объединение/);assert.deepEqual(s,before);
 }
 const {s}=make();mergeCells(s,'A1','B1000');const before=structuredClone(s);
 assert.throws(()=>changeSheetStructure(s,'row','insert',1),/лимит 2000/);assert.deepEqual(s,before);
});
test('merged structural changes retain custom sizes, hidden rows and freeze panes',()=>{
 const {book,s}=make();setCell(s,'B3','X');mergeCells(s,'B3','C4');
 setRowHeight(s,2,58);setColumnWidth(s,1,180);setHidden(s,'row',5,true);setFreeze(s,1,1);
 changeSheetStructure(s,'row','insert',0);changeSheetStructure(s,'col','insert',0);
 assert.deepEqual(names(s),['C4:D5']);assert.equal(s.rowHeights[3],58);
 assert.equal(s.columnWidths[2],180);assert.equal(s.hiddenRows[6],true);
 assert.equal(s.freeze.rows,2);assert.equal(s.freeze.cols,2);validateWorkbook(book);
});
test('active filter still blocks structural changes with merges',()=>{
 const {s}=make();mergeCells(s,'A1','B2');setCell(s,'E1','Header');setCell(s,'E2','X');
 setAutoFilter(s,'E1','E2');const before=structuredClone(s);
 assert.throws(()=>changeSheetStructure(s,'row','insert',2),/автофильтр/);assert.deepEqual(s,before);
});
test('exported XLSX includes expanded merge geometry',async()=>{
 const {book,s}=make();setCell(s,'B2','Weekly');mergeCells(s,'B2','D3');
 changeSheetStructure(s,'row','insert',2);const bytes=await exportXLSX(book);
 const zip=await globalThis.JSZip.loadAsync(bytes);
 const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
 assert.match(xml,/mergeCell ref="B2:D4"/);
});