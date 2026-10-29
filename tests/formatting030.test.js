import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,setStyle,getCell,applyBorderPreset,mergeCells,validateWorkbook} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
import {exportXLSX} from '../src/core/xlsx.js';

test('outer border is a perimeter of independent cells; no merging, no lost contents or inner border',()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 setCell(sheet,'B2','Первый');setCell(sheet,'C3','Середина');
 setCell(sheet,'D4','=SUM(B2:B3)');
 setStyle(sheet,'C3',{border:'thin',bg:'#123456'});
 applyBorderPreset(sheet,'B2','D4','outline');
 assert.deepEqual(sheet.merges,[]);
 assert.equal(getCell(sheet,'B2').value,'Первый');
 assert.equal(getCell(sheet,'D4').value,'=SUM(B2:B3)');
 assert.deepEqual(getCell(sheet,'B2').style.borders,{top:true,left:true});
 assert.deepEqual(getCell(sheet,'C2').style.borders,{top:true});
 assert.deepEqual(getCell(sheet,'D3').style.borders,{right:true});
 assert.deepEqual(getCell(sheet,'C3').style.borders,{top:true,bottom:true,left:true,right:true});
 assert.equal(getCell(sheet,'C3').style.bg,'#123456');
 validateWorkbook(book);
 const loaded=decodeBook(encodeBook(book));
 assert.deepEqual(getCell(loaded.sheets[0],'B2').style.borders,getCell(sheet,'B2').style.borders);
});

test('one-sided presets touch only selected rectangle edge and preserve previous border sides',()=>{
 const s=currentSheet(newWorkbook());
 applyBorderPreset(s,'B2','D3','outline');
 applyBorderPreset(s,'B2','D3','bottom');
 assert.deepEqual(getCell(s,'C2').style.borders,{top:true});
 assert.deepEqual(getCell(s,'C3').style.borders,{bottom:true});
 applyBorderPreset(s,'B2','D3','right');
 assert.deepEqual(getCell(s,'D2').style.borders,{top:true,right:true});
 assert.deepEqual(getCell(s,'B2').style.borders,{top:true,left:true});
 applyBorderPreset(s,'B2','D3','none');
 assert.equal(getCell(s,'B2').style.borders,undefined);
 assert.equal(s.merges.length,0);
});

test('full-sheet outer border writes only 4,196 perimeter cells, not 200k individual cells',()=>{
 const book=newWorkbook(),s=currentSheet(book);
 setCell(s,'C3','Сохранить');
 applyBorderPreset(s,'A1','CV2000','outline');
 assert.equal(Object.keys(s.cells).length,4197);
 assert.equal(getCell(s,'C3').value,'Сохранить');
 assert.equal(getCell(s,'C3').style.borders,undefined);
 assert.deepEqual(getCell(s,'A1').style.borders,{top:true,left:true});
 assert.deepEqual(getCell(s,'CV2000').style.borders,{bottom:true,right:true});
 assert.deepEqual(getCell(s,'B1000').style.borders,undefined);
 assert.deepEqual(getCell(s,'A1000').style.borders,{left:true});
 assert.deepEqual(getCell(s,'CV1000').style.borders,{right:true});
 validateWorkbook(book);
});

test('all/clear over 10k cells reject atomically; existing merges do not block border presets',()=>{
 const book=newWorkbook(),s=currentSheet(book);
 setCell(s,'A1','Заголовок');mergeCells(s,'A1','B2');
 const before=structuredClone(s);
 assert.throws(()=>applyBorderPreset(s,'A1','CV2000','all'),/10 000/);
 assert.deepEqual(s,before);
 applyBorderPreset(s,'A1','D3','outline');
 assert.deepEqual(s.merges,[{from:'A1',to:'B2'}]);
 assert.equal(getCell(s,'A1').value,'Заголовок');
 assert.deepEqual(getCell(s,'D3').style.borders,{bottom:true,right:true});
});

test('alignment and outer border styles survive qbook and XLSX exports',async()=>{
 const book=newWorkbook(),s=currentSheet(book);
 setCell(s,'B2','Проверка');setStyle(s,'B2',{align:'center',bg:'#fedcba'});
 setStyle(s,'B3',{align:'right'});applyBorderPreset(s,'B2','D4','outline');
 const restored=decodeBook(encodeBook(book));
 assert.equal(getCell(restored.sheets[0],'B2').style.align,'center');
 assert.equal(getCell(restored.sheets[0],'B3').style.align,'right');
 const bytes=await exportXLSX(book);
 const zip=await globalThis.JSZip.loadAsync(bytes);
 const styles=await zip.file('xl/styles.xml').async('string');
 assert.match(styles,/horizontal="center"/);
 assert.match(styles,/horizontal="right"/);
 assert.match(styles,/<top style="thin"\/>/);
 assert.match(styles,/<left style="thin"\/>/);
});
