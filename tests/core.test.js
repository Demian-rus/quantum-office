import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,newSheet,currentSheet,setCell,setStyle,getCell,resultOf,refsBetween,pasteTSV,valuesTSV,importCSV,exportCSV,createExample,validateWorkbook,displayedValue,translateFormula,fillSelection} from '../src/core/workbook.js';
import {saveWorkspace,loadWorkspace,encodeBook,decodeBook,encodeWorkspace,decodeWorkspace} from '../src/core/store.js';
test('multiple sheets',()=>{const b=newWorkbook();const s=newSheet('Second');b.sheets.push(s);b.activeSheetId=s.id;assert.equal(currentSheet(b).name,'Second');validateWorkbook(b);});
test('formula recomputation',()=>{const s=currentSheet(newWorkbook());setCell(s,'A1','10');setCell(s,'A2','5');setCell(s,'B1','=SUM(A1:A2)');assert.equal(resultOf(s,'B1'),15);setCell(s,'A2','9');assert.equal(resultOf(s,'B1'),19);});
test('cycle and division errors',()=>{const s=currentSheet(newWorkbook());setCell(s,'A1','=B1');setCell(s,'B1','=A1');setCell(s,'C1','=1/0');assert.equal(resultOf(s,'A1'),'#CYCLE!');assert.equal(resultOf(s,'C1'),'#DIV/0!');});
test('style and formatting',()=>{const s=currentSheet(newWorkbook());setCell(s,'B3','=5+2');setStyle(s,'B3',{bold:true,format:'currency'});assert.equal(getCell(s,'B3').style.bold,true);assert.match(displayedValue(s,'B3'),/7/);});
test('TSV and cell ranges',()=>{const s=currentSheet(newWorkbook());const info=pasteTSV(s,'B3','имя\tдоля\nСаша\t32');assert.equal(info.end,'C4');assert.deepEqual(refsBetween('B3','C4'),['B3','C3','B4','C4']);assert.equal(valuesTSV(s,'B3','C4'),'имя\tдоля\nСаша\t32');});
test('CSV quotes and newlines',()=>{const b=importCSV('Название,Цена\r\n"Папка, синяя",99\r\n"Строка\nдве",17');assert.equal(currentSheet(b).cells.A3.value,'Строка\nдве');assert.equal(importCSV(exportCSV(currentSheet(b))).sheets[0].cells.A2.value,'Папка, синяя');});
test('demo totals',()=>{const b=createExample();validateWorkbook(b);assert.equal(resultOf(b.sheets[0],'B6'),90000);assert.equal(resultOf(b.sheets[0],'C6'),79300);});
test('book format roundtrip',()=>{const b=createExample();assert.equal(decodeBook(encodeBook(b)).sheets[0].cells.D6.value,'=B6-C6');});
test('previous snapshot recovery',()=>{const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};const w={version:3,active:null,books:[newWorkbook('One')]};saveWorkspace(w,storage);w.books[0].name='Two';saveWorkspace(w,storage);map.set('quantum-office.workspace.v3','CORRUPT');assert.equal(loadWorkspace(storage).books[0].name,'One');});
test('workspace roundtrip',()=>{const w={version:3,books:[createExample()],active:null};assert.equal(decodeWorkspace(encodeWorkspace(w)).books.length,1);});
test('reject invalid reference',()=>{const b=newWorkbook();b.sheets[0].cells.A0={value:'oops',style:{}};assert.throws(()=>validateWorkbook(b));});
test('never eval formulas as JS',()=>{const s=currentSheet(newWorkbook());setCell(s,'A1','=process.exit(1)');assert.equal(resultOf(s,'A1'),'#ERROR!');});
test('unsafe styles rejected',()=>{const b=newWorkbook();b.sheets[0].cells.A1={value:'123',style:{bg:'red" onmouseover="alert(1)'}};assert.throws(()=>validateWorkbook(b));});

// Fill operations are transactional at the model layer, preserve styling and respect $ locks.
test('fill down moves relative formulas but preserves absolute anchors',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'A1','10');setCell(s,'B1','=A1+$C$1+$D1+E$2');setStyle(s,'B1',{bold:true});
 assert.equal(fillSelection(s,'B1','B3','down'),2);
 assert.equal(getCell(s,'B2').value,'=A2+$C$1+$D2+E$2');
 assert.equal(getCell(s,'B3').value,'=A3+$C$1+$D3+E$2');
 assert.equal(getCell(s,'B3').style.bold,true);
});
test('fill right shifts references and keeps source cells unchanged',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'A1','=C4+$B4+C$5+$D$6');setCell(s,'A2','Название');
 fillSelection(s,'A1','C2','right');
 assert.equal(getCell(s,'B1').value,'=D4+$B4+D$5+$D$6');
 assert.equal(getCell(s,'C1').value,'=E4+$B4+E$5+$D$6');
 assert.equal(getCell(s,'C2').value,'Название');
 assert.equal(getCell(s,'A1').value,'=C4+$B4+C$5+$D$6');
});
test('absolute references are evaluated without changing saved formula',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'A1','2');setCell(s,'A2','3');setCell(s,'B1','=SUM($A$1:$A$2)+$A1');
 assert.equal(resultOf(s,'B1'),7);assert.equal(getCell(s,'B1').value,'=SUM($A$1:$A$2)+$A1');
});
test('fill rejects underflow before modifying any target',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'B1','=A2000');setCell(s,'B2','KEEP');
 assert.throws(()=>fillSelection(s,'B1','B2','down'),/пределы/);
 assert.equal(getCell(s,'B2').value,'KEEP');
});
test('invalid fill selections leave data untouched',()=>{const s=currentSheet(newWorkbook());setCell(s,'A1','x');assert.throws(()=>fillSelection(s,'A1','A1','down'));assert.equal(getCell(s,'A1').value,'x');});
