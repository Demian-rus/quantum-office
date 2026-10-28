import test from 'node:test';import assert from 'node:assert/strict';
import {newWorkbook,newSheet,currentSheet,setCell,setStyle,getCell,resultOf,refsBetween,pasteTSV,valuesTSV,importCSV,exportCSV,createExample,validateWorkbook,displayedValue,translateFormula,fillSelection} from '../src/core/workbook.js';
import {saveWorkspace,loadWorkspace,encodeBook,decodeBook,encodeWorkspace,decodeWorkspace} from '../src/core/store.js';
test('new book and multi-sheet model',()=>{const b=newWorkbook();assert.equal(b.sheets.length,1);const s=newSheet('Дополнительный');b.sheets.push(s);b.activeSheetId=s.id;assert.equal(currentSheet(b).name,'Дополнительный');assert.equal(validateWorkbook(b),b);});
test('formulas recalculate on edited inputs',()=>{const s=currentSheet(newWorkbook());setCell(s,'A1','10');setCell(s,'A2','5');setCell(s,'B1','=SUM(A1:A2)');assert.equal(resultOf(s,'B1'),15);setCell(s,'A2','9');assert.equal(resultOf(s,'B1'),19);});
test('formula errors include circular and division by zero',()=>{const s=currentSheet(newWorkbook());setCell(s,'A1','=B1');setCell(s,'B1','=A1');setCell(s,'C1','=1/0');assert.equal(resultOf(s,'A1'),'#CYCLE!');assert.equal(resultOf(s,'C1'),'#DIV/0!');});
test('cell style and currency formatting',()=>{const s=currentSheet(newWorkbook());setCell(s,'B3','=5+2');setStyle(s,'B3',{bold:true,format:'currency'});assert.equal(getCell(s,'B3').style.bold,true);assert.match(displayedValue(s,'B3'),/7/);});
test('range references and tsv paste',()=>{const s=currentSheet(newWorkbook());const info=pasteTSV(s,'B3','имя\tдоля\nСаша\t32');assert.equal(info.end,'C4');assert.deepEqual(refsBetween('B3','C4'),['B3','C3','B4','C4']);assert.equal(valuesTSV(s,'B3','C4'),'имя\tдоля\nСаша\t32');});
test('CSV roundtrip with escaping and utf8 text',()=>{const text='Название,Цена\r\n"Папка, синяя",99\r\n"Строка\nдве",17';const b=importCSV(text,'Каталог');assert.equal(currentSheet(b).cells.A3.value,'Строка\nдве');const csv=exportCSV(currentSheet(b));assert.equal(importCSV(csv).sheets[0].cells.A2.value,'Папка, синяя');});
test('sample workbook is valid and formula total is correct',()=>{const b=createExample();assert.equal(b.sheets.length,2);validateWorkbook(b);assert.equal(resultOf(b.sheets[0],'B6'),90000);assert.equal(resultOf(b.sheets[0],'C6'),79300);});
test('book format export/import without data loss',()=>{const b=createExample(),imported=decodeBook(encodeBook(b));assert.equal(imported.sheets[0].cells.D6.value,'=B6-C6');});
test('workspace backups survive corrupted primary save',()=>{const storage=new Map();const a={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};const w={version:3,active:null,books:[newWorkbook('One')]};saveWorkspace(w,a);w.books[0].name='Two';saveWorkspace(w,a);storage.set('quantum-office.workspace.v3','CORRUPT');assert.equal(loadWorkspace(a).books[0].name,'One');});
test('workspace export/import',()=>{const w={version:3,books:[createExample()],active:null};assert.equal(decodeWorkspace(encodeWorkspace(w)).books.length,1);});
test('invalid cells rejected before import',()=>{const b=newWorkbook();b.sheets[0].cells.A0={value:'oops',style:{}};assert.throws(()=>validateWorkbook(b));});
test('formula injection stays a string, never JavaScript execution',()=>{const s=currentSheet(newWorkbook());setCell(s,'A1','=process.exit(1)');assert.equal(resultOf(s,'A1'),'#ERROR!');});

test('unsafe imported style rejected',()=>{const b=newWorkbook();b.sheets[0].cells.A1={value:'123',style:{bg:'red\" onmouseover=\"alert(1)'}};assert.throws(()=>validateWorkbook(b));});

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

// Ribbon functionality: stable row sorting, literal find and all-or-nothing replace.
import {sortSelectedRows,findCells,replaceAllText} from '../src/core/workbook.js';
test('sort range preserves row relationships and cell styles',()=>{
 const s=currentSheet(newWorkbook());
 [['груша','3'],['яблоко','1'],['банан','2']].forEach((row,r)=>row.forEach((v,c)=>setCell(s,String.fromCharCode(65+c)+(r+1),v)));
 setStyle(s,'A1',{bold:true});
 assert.equal(sortSelectedRows(s,'A1','B3','asc'),3);
 assert.deepEqual(['A1','A2','A3'].map(ref=>getCell(s,ref).value),['банан','груша','яблоко']);
 assert.deepEqual(['B1','B2','B3'].map(ref=>getCell(s,ref).value),['2','3','1']);
 assert.equal(getCell(s,'A2').style.bold,true);
 sortSelectedRows(s,'A1','B3','desc');
 assert.deepEqual(['A1','A2','A3'].map(ref=>getCell(s,ref).value),['яблоко','груша','банан']);
});
test('numeric sort supports comma and stable equal keys',()=>{
 const s=currentSheet(newWorkbook());
 [['10','ten'],['2','two'],['2,5','two five'],['2','two second']].forEach((row,r)=>row.forEach((v,c)=>setCell(s,String.fromCharCode(65+c)+(r+1),v)));
 sortSelectedRows(s,'A1','B4','asc');
 assert.deepEqual(['B1','B2','B3','B4'].map(x=>getCell(s,x).value),['two','two second','two five','ten']);
});
test('formula sort is rejected before touching any cell',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'A1','z');setCell(s,'B1','=1+2');setCell(s,'A2','a');
 const snapshot=structuredClone(s.cells);
 assert.throws(()=>sortSelectedRows(s,'A1','B2','asc'),/формул/);
 assert.deepEqual(s.cells,snapshot);
});
test('find is case insensitive and ordered by sheet coordinates',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'C4','APPLE');setCell(s,'A2','apple');setCell(s,'B1','=SUM(APPLE)');
 assert.deepEqual(findCells(s,'apple'),['B1','A2','C4']);
 assert.deepEqual(findCells(s,'not here'),[]);
});
test('replace all is literal and leaves formulas unchanged',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'A1','тест тест');setCell(s,'B1','ТЕСТ');setCell(s,'C1','=SUM(A1)');
 assert.equal(replaceAllText(s,'тест','$12'),2);
 assert.equal(getCell(s,'A1').value,'$12 $12');assert.equal(getCell(s,'B1').value,'$12');
 assert.equal(getCell(s,'C1').value,'=SUM(A1)');
});
test('replace rejects empty and oversized output without mutation',()=>{
 const s=currentSheet(newWorkbook());setCell(s,'A1','a'.repeat(8));
 assert.throws(()=>replaceAllText(s,'','X'));
 assert.throws(()=>replaceAllText(s,'a','X'.repeat(7000)),/лимит/);
 assert.equal(getCell(s,'A1').value,'a'.repeat(8));
});
