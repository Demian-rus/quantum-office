import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,setStyle,getCell,getEffectiveStyle,
 validateWorkbook} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
import {styleCatalog,styleXML} from '../src/core/xlsx.js';
test('TASK075: four text styles and vertical alignment survive QBOOK',()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 setCell(sheet,'D12','Привет');
 setStyle(sheet,'D12',{bold:true,italic:true,underline:true,strike:true,verticalAlign:'bottom',align:'right'});
 validateWorkbook(book);
 assert.equal(getEffectiveStyle(sheet,'D12').verticalAlign,'bottom');
 const copy=decodeBook(encodeBook(book));
 assert.deepEqual(copy.sheets[0].cells.D12.style,getCell(sheet,'D12').style);
});
test('TASK075: global vertical alignment and underline support sparse styles',()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 sheet.defaultStyle={verticalAlign:'top',underline:true};
 sheet.columnStyles={2:{strike:true}};
 sheet.rectangleStyles=[{from:'C4',to:'F6',style:{verticalAlign:'bottom'}}];
 validateWorkbook(book);
 assert.equal(getEffectiveStyle(sheet,'C4').verticalAlign,'bottom');
 assert.equal(getEffectiveStyle(sheet,'D3').verticalAlign,'top');
 assert.equal(getEffectiveStyle(sheet,'C4').strike,true);
 const reopened=decodeBook(encodeBook(book));
 assert.equal(reopened.sheets[0].defaultStyle.underline,true);
});
test('TASK075: XLSX font definitions include underline/strike and cell vertical alignment',()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 setCell(sheet,'A1','Русский');
 setStyle(sheet,'A1',{underline:true,strike:true,verticalAlign:'center',align:'right'});
 const styles=styleCatalog(book),xml=styleXML(styles);
 assert.match(xml,/<u\/>/);
 assert.match(xml,/<strike\/>/);
 assert.match(xml,/vertical="center"/);
 assert.match(xml,/horizontal="right"/);
});
test('TASK075: invalid vertical/underline metadata rejected before serialization',()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 setStyle(sheet,'B2',{verticalAlign:'outside'});
 assert.throws(()=>validateWorkbook(book),/оформление/);
 setStyle(sheet,'B2',{verticalAlign:'center',underline:'yes'});
 assert.throws(()=>validateWorkbook(book),/оформление/);
});