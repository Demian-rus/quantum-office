import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setStyle,validateWorkbook,resolveBorderSide,applyBorderPreset} from '../src/core/workbook.js';
import {styleCatalog,styleXML} from '../src/core/xlsx.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

test('per-edge border styles roundtrip natively and export exact OOXML sides',()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 setStyle(sheet,'A1',{borders:{top:true,bottom:true,left:true,right:true},
  borderEdges:{top:{line:'medium',color:'#aa0000'},bottom:{line:'dotted',color:'#00aa00'},
   left:{line:'double',color:'#0000aa'},right:{line:'thick',color:'#554433'}}});
 validateWorkbook(book);
 const reopened=decodeBook(encodeBook(book)),s=reopened.sheets[0];
 assert.equal(resolveBorderSide(s.cells.A1.style,'top').line,'medium');
 assert.equal(resolveBorderSide(s.cells.A1.style,'bottom').color,'#00aa00');
 const xml=styleXML(styleCatalog(reopened));
 assert.match(xml,/<top style="medium"><color rgb="FFAA0000"\/><\/top>/);
 assert.match(xml,/<bottom style="dotted"><color rgb="FF00AA00"\/><\/bottom>/);
 assert.match(xml,/<left style="double"><color rgb="FF0000AA"\/><\/left>/);
 assert.match(xml,/<right style="thick"><color rgb="FF554433"\/><\/right>/);
});
test('new border preset clears imported legacy per-edge overrides',()=>{
 const book=newWorkbook(),s=currentSheet(book);
 setStyle(s,'B2',{borders:{bottom:true},borderEdges:{bottom:{line:'thick',color:'#0000ff'}}});
 applyBorderPreset(s,'B2','B2','outline');
 assert.equal(s.cells.B2.style.borderEdges,undefined);
 assert.equal(resolveBorderSide(s.cells.B2.style,'bottom').line,'thin');
});
test('malformed edge style, unsafe colors and corrupted axis styles are rejected',()=>{
 for(const bad of [
  {top:{line:'100px',color:'#000000'}},
  {bottom:{line:'thin',color:'red;position:absolute'}},
  {left:{line:'medium',color:'#000000',evil:1}},
  {right:{color:'#abcabc'}},
  {'malicious-side':{line:'thin'}}
 ]){
  const book=newWorkbook(),s=currentSheet(book);
  setStyle(s,'A1',{borders:{top:true},borderEdges:bad});
  assert.throws(()=>validateWorkbook(book),/оформление ячейки/);
 }
 const book=newWorkbook(),s=currentSheet(book);
 s.rowStyles[2]={borders:{top:true},borderEdges:{top:{line:'double',color:'#ff0044'}}};
 assert.doesNotThrow(()=>validateWorkbook(book));
 s.rowStyles[2].borderEdges.top.line='4px';
 assert.throws(()=>validateWorkbook(book),/оформление строк/);
});
test('existing simple borders remain self-closing thin edges for OOXML clients',()=>{
 const book=newWorkbook(),s=currentSheet(book);
 applyBorderPreset(s,'C3','C3','outline');
 const xml=styleXML(styleCatalog(book));
 assert.match(xml,/<top style="thin"\/>/);
 assert.match(xml,/<bottom style="thin"\/>/);
 assert.match(xml,/<left style="thin"\/>/);
 assert.match(xml,/<right style="thin"\/>/);
});
