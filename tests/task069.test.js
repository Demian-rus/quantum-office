import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,getCell,setStyle,fillTypedAreas,fillAreasDirection,validateWorkbook} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
const init=()=>{const book=newWorkbook(),sheet=currentSheet(book);return {book,sheet};};
test('TASK069: Ctrl+Enter fills nonadjacent cells atomically, with relative references from active cell',()=>{
 const {book,sheet}=init();
 setCell(sheet,'A2','10');setCell(sheet,'C4','20');
 const areas=[{from:'B2',to:'B2'},{from:'D4',to:'D4'}];
 const n=fillTypedAreas(sheet,areas,'=C4','D4');
 assert.equal(n,2);
 assert.equal(getCell(sheet,'B2').value,'=A2');
 assert.equal(getCell(sheet,'D4').value,'=C4');
 assert.equal(getCell(sheet,'C3').value,'');
 validateWorkbook(book);
 const restored=decodeBook(encodeBook(book));
 assert.equal(restored.sheets[0].cells.B2.value,'=A2');
});
test('TASK069: grouped range typed fill handles overlap only once and keeps original formatting',()=>{
 const {sheet}=init();
 setStyle(sheet,'B2',{bold:true});
 const areas=[{from:'B2',to:'C3'},{from:'C3',to:'D3'}];
 const n=fillTypedAreas(sheet,areas,'42','C3');
 assert.equal(n,5);
 for(const key of ['B2','B3','C2','C3','D3'])assert.equal(getCell(sheet,key).value,'42');
 assert.equal(getCell(sheet,'B2').style.bold,true);
 assert.equal(getCell(sheet,'A2').value,'');
});
test('TASK069: invalid formula at one destination rolls back entire disjoint typed fill',()=>{
 const {sheet}=init();
 setCell(sheet,'A1','original');
 const before=JSON.stringify(sheet.cells);
 assert.throws(()=>fillTypedAreas(sheet,[{from:'A1',to:'A1'},{from:'D4',to:'D4'}],'=A1','D4'),/вне|Ссылка формулы/);
 assert.equal(JSON.stringify(sheet.cells),before);
});
test('TASK069: disjoint fill respects validation rules across every area without partial mutation',()=>{
 const {sheet}=init();
 setCell(sheet,'B2','existing');const before=JSON.stringify(sheet.cells);
 sheet.validations=[{id:'list1',from:'D4',to:'D4',kind:'list',options:['yes']}];
 assert.throws(()=>fillTypedAreas(sheet,[{from:'B2',to:'B2'},{from:'D4',to:'D4'}],'no','B2'),/Недопустимое значение/);
 assert.equal(JSON.stringify(sheet.cells),before);
 assert.equal(fillTypedAreas(sheet,[{from:'B2',to:'B2'},{from:'D4',to:'D4'}],'yes','B2'),2);
 assert.equal(getCell(sheet,'D4').value,'yes');
});
test('TASK069: Ctrl+D operates independently in two disjoint rectangles, translating relative references and copying style',()=>{
 const {book,sheet}=init();
 for(const [ref,val] of Object.entries({A6:'5',C6:'9',B6:'=A6',D6:'=C6'}))setCell(sheet,ref,val);
 setStyle(sheet,'B6',{italic:true});
 const areas=[{from:'B6',to:'B8'},{from:'D6',to:'D8'}];
 const n=fillAreasDirection(sheet,areas,'down');
 assert.equal(n,4);
 assert.deepEqual(['B7','B8','D7','D8'].map(x=>getCell(sheet,x).value),['=A7','=A8','=C7','=C8']);
 assert.equal(getCell(sheet,'B8').style.italic,true);
 validateWorkbook(book);
});
test('TASK069: Ctrl+R copies across two separate rows without mixing source cells',()=>{
 const {sheet}=init();
 for(const [ref,val] of Object.entries({B3:'hello',B5:'world'}))setCell(sheet,ref,val);
 const n=fillAreasDirection(sheet,[{from:'B3',to:'D3'},{from:'B5',to:'D5'}],'right');
 assert.equal(n,4);
 for(const ref of ['C3','D3'])assert.equal(getCell(sheet,ref).value,'hello');
 for(const ref of ['C5','D5'])assert.equal(getCell(sheet,ref).value,'world');
});
test('TASK069: overlaps, merges, unsupported dimensions and oversized selections are rejected before mutation',()=>{
 const {sheet}=init();
 setCell(sheet,'B2','keep');
 const snapshot=JSON.stringify(sheet.cells);
 assert.throws(()=>fillAreasDirection(sheet,[{from:'B2',to:'B4'},{from:'B3',to:'B5'}],'down'),/Пересекающиеся области/);
 assert.throws(()=>fillAreasDirection(sheet,[{from:'B2',to:'B2'}],'down'),/хотя бы две строки/);
 sheet.merges=[{from:'C2',to:'D2'}];
 assert.throws(()=>fillTypedAreas(sheet,[{from:'C2',to:'C2'}],'text','C2'),/объединённые/);
 sheet.merges=[];
 assert.throws(()=>fillTypedAreas(sheet,[{from:'A1',to:'A20000'}],'x','A1'),/10 000/);
 assert.equal(JSON.stringify(sheet.cells),snapshot);
});
