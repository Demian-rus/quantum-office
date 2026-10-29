import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,setStyle,getCell,getEffectiveStyle,setRectangleStyle,setBulkColumnStyle,clearFormatting,validateWorkbook,sortSelectedRows,LIMITS,MAX_RECTANGLE_STYLES} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
import {copyCells,pasteCells} from '../src/core/clipboard.js';
import {changeSheetStructure} from '../src/core/structure.js';
import {exportXLSX} from '../src/core/xlsx.js';

test('180k-cell partial rectangle uses one style record, preserves formulas and 100k-row capacity',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'B50000','=1+2');setCell(s,'C90000','Содержимое');setCell(s,'D100000','Нижняя строка');
 setStyle(s,'B50000',{bg:'#111111',bold:true});
 setRectangleStyle(s,'B100','C90000',{bg:'#aabbcc'});
 assert.equal(s.rectangleStyles.length,1);
 assert.equal(Object.keys(s.cells).length,3);
 assert.equal(getEffectiveStyle(s,'B100').bg,'#aabbcc');
 assert.equal(getEffectiveStyle(s,'C89999').bg,'#aabbcc');
 assert.equal(getEffectiveStyle(s,'B50000').bg,'#aabbcc');
 assert.equal(getEffectiveStyle(s,'B50000').bold,true);
 assert.equal(getEffectiveStyle(s,'C90001').bg,undefined);
 assert.equal(getCell(s,'B50000').value,'=1+2');
 assert.equal(getCell(s,'D100000').value,'Нижняя строка');
 assert.equal(LIMITS.rows,100000);
 validateWorkbook(b);
});

test('ordered overlaps, explicit edits and no-fill masking work on virtual empty cells',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setBulkColumnStyle(s,'A1','CV100000',{bg:'#aabbcc'});
 setRectangleStyle(s,'B100','C90000',{bg:'#ff0000'});
 setRectangleStyle(s,'C50000','D90000',{bg:'#0000ff'});
 assert.equal(getEffectiveStyle(s,'B50000').bg,'#ff0000');
 assert.equal(getEffectiveStyle(s,'C50000').bg,'#0000ff');
 assert.equal(getEffectiveStyle(s,'C49999').bg,'#ff0000');
 setRectangleStyle(s,'C60000','C70000',{bg:undefined});
 assert.equal(getEffectiveStyle(s,'C65000').bg,undefined);
 assert.equal(getEffectiveStyle(s,'B65000').bg,'#ff0000');
 assert.equal(getEffectiveStyle(s,'A65000').bg,'#aabbcc');
 setStyle(s,'C65000',{bg:'#123456'});
 assert.equal(getEffectiveStyle(s,'C65000').bg,'#123456');
 assert.equal(Object.keys(s.cells).length,1);
 validateWorkbook(b);
});

test('sparse clear splits only intersected rectangle while leaving outer fragments',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setRectangleStyle(s,'B100','C90000',{bold:true});
 const before=JSON.stringify(s.rectangleStyles);
 assert.equal(clearFormatting(s,'B200','C300',true),1);
 assert.equal(JSON.stringify(s.rectangleStyles),before);
 assert.equal(clearFormatting(s,'B200','C300'),1);
 assert.equal(getEffectiveStyle(s,'B199').bold,true);
 assert.equal(getEffectiveStyle(s,'C301').bold,true);
 assert.equal(getEffectiveStyle(s,'C250').bold,undefined);
 assert.equal(getEffectiveStyle(s,'D250').bold,undefined);
 assert.equal(s.rectangleStyles.length,2);
 validateWorkbook(b);
 clearFormatting(s,'A1','CV100000');
 assert.equal(s.rectangleStyles.length,0);
});

test('later full-column style wins within column, adjacent rectangle keeps its color',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setRectangleStyle(s,'B100','D90000',{color:'#ff0000'});
 setBulkColumnStyle(s,'C1','C100000',{color:'#0000ff'});
 assert.equal(getEffectiveStyle(s,'C50000').color,'#0000ff');
 assert.equal(getEffectiveStyle(s,'B50000').color,'#ff0000');
 assert.equal(getEffectiveStyle(s,'D50000').color,'#ff0000');
 assert.equal(getEffectiveStyle(s,'C90001').color,'#0000ff');
 assert.equal(s.rectangleStyles.length,2);
 validateWorkbook(b);
});

test('native roundtrip retains sparse regions, clipboard copies effective style; XLSX uses bounded styled blank cells',async()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setRectangleStyle(s,'B100','C90000',{bg:'#42a5f5'});
 setCell(s,'B200','Текст');
 const restored=decodeBook(encodeBook(b)),copy=currentSheet(restored);
 assert.equal(copy.rectangleStyles.length,1);
 assert.equal(getEffectiveStyle(copy,'C89999').bg,'#42a5f5');
 const clip=copyCells(copy,'B200','B200',restored);
 assert.equal(clip.cells[0][0].style.bg,'#42a5f5');
 pasteCells(copy,'D200',clip);
 assert.equal(getEffectiveStyle(copy,'D200').bg,'#42a5f5');
 const zip=await globalThis.JSZip.loadAsync(await exportXLSX(restored),{checkCRC32:true});
 const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
 assert.match(xml,/<c r="C89999" s="\\d+"\\/>/);
 assert.ok((xml.match(/<c /g)||[]).length>170000);
 assert.equal(getCell(copy,'B200').value,'Текст');
 assert.equal(Object.keys(copy.cells).length,2);
});

test('corrupt layer, excessive layers, structural edits and sorting are rejected without mutation',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setRectangleStyle(s,'B100','C90000',{wrap:true});
 const snapshot=JSON.stringify(s);
 assert.throws(()=>changeSheetStructure(s,'row','insert',500),/области оформления/);
 assert.throws(()=>sortSelectedRows(s,'B100','C120'),/оформления/);
 assert.equal(JSON.stringify(s),snapshot);
 const broken=structuredClone(b);currentSheet(broken).rectangleStyles=[{from:'B10',to:'B100001',style:{bold:true}}];
 assert.throws(()=>validateWorkbook(broken),/диапазона/);
 const bad=structuredClone(b);currentSheet(bad).rectangleStyles=[{from:'B1',to:'B500',style:{bogus:true}}];
 assert.throws(()=>validateWorkbook(bad),/диапазона/);
 for(let i=1;i<MAX_RECTANGLE_STYLES;i++)setRectangleStyle(s,'D100','D200',{italic:true});
 assert.equal(s.rectangleStyles.length,MAX_RECTANGLE_STYLES);
 assert.throws(()=>setRectangleStyle(s,'E100','E200',{italic:true}),/Слишком много/);
 assert.equal(s.rectangleStyles.length,MAX_RECTANGLE_STYLES);
});