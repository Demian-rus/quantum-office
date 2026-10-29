import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell,setStyle,getCell,rawMap,formulaContext,validateWorkbook,cellName} from '../src/core/workbook.js';
import {addConditionalRule,removeConditionalRule,conditionalFill,prepareConditionalScales,validateConditionalRules} from '../src/core/conditional.js';
import {changeSheetStructure} from '../src/core/structure.js';
import {encodeBook,decodeBook} from '../src/core/store.js';
function setup(){
 const book=newWorkbook(),sheet=currentSheet(book);
 for(const [ref,value] of Object.entries({A1:'Продажи',A2:'10',A3:'20',A4:'30',B2:'тревога',B3:'срок нарушен',B4:'=',C2:'=A2*3'}))setCell(sheet,ref,value);
 return {book,sheet};
}
test('TASK051: numeric, text, equality rules and live formulas, manual style retained',()=>{
 const {book,sheet}=setup();
 setStyle(sheet,'A4',{bg:'#ffffff',bold:true});
 const r=addConditionalRule(sheet,'A2','A4','gt','15','#ffcccc');
 assert.equal(conditionalFill(sheet,'A2',10),null);
 assert.equal(conditionalFill(sheet,'A3',20),'#ffcccc');
 assert.equal(conditionalFill(sheet,'A4',30),'#ffcccc');
 assert.deepEqual(getCell(sheet,'A4').style,{bg:'#ffffff',bold:true});
 addConditionalRule(sheet,'B2','B3','contains','нарушен','#ffffaa');
 assert.equal(conditionalFill(sheet,'B3','СРОК НАРУШЕН'),'#ffffaa');
 const formula=addConditionalRule(sheet,'C2','C2','gt','40','#aaccff');
 const raw=rawMap(sheet),ctx=formulaContext(book,sheet,raw);
 assert.equal(conditionalFill(sheet,'C2',30),null);
 setCell(sheet,'A2','20');
 const next=rawMap(sheet),nextCtx=formulaContext(book,sheet,next);
 assert.equal(conditionalFill(sheet,'C2',60),'#aaccff');
 removeConditionalRule(sheet,r.id);assert.equal(sheet.conditionalRules.length,2);
 assert.equal(sheet.conditionalRules[1].id,formula.id);
 const opened=decodeBook(encodeBook(book));
 assert.equal(opened.sheets[0].conditionalRules.length,2);
 validateConditionalRules(opened.sheets[0]);
});
test('TASK051: scale interpolates numeric values, missing nonnumeric is untouched',()=>{
 const {book,sheet}=setup();
 const rule=addConditionalRule(sheet,'A2','B4','scale');
 const raw=rawMap(sheet),ctx=formulaContext(book,sheet,raw);
 const stats=prepareConditionalScales(sheet,raw,ctx);
 assert.equal(stats.get(rule.id).min,10);assert.equal(stats.get(rule.id).max,30);
 assert.equal(conditionalFill(sheet,'A2',10,stats),'#f7e2dc');
 assert.equal(conditionalFill(sheet,'A4',30,stats),'#5fb486');
 assert.equal(conditionalFill(sheet,'B2','тревога',stats),null);
});
test('TASK051: invalid thresholds, ranges, schema and colors rejected atomically',()=>{
 const {book,sheet}=setup();
 const initial=JSON.stringify(sheet);
 assert.throws(()=>addConditionalRule(sheet,'A1','B2','gt','oops'),/условие/);
 assert.throws(()=>addConditionalRule(sheet,'A1','B2','lt','10','red'),/условие/);
 assert.throws(()=>addConditionalRule(sheet,'A1','B2000','scale'),/1 200/);
 assert.equal(JSON.stringify(sheet),initial);
 addConditionalRule(sheet,'A2','A3','gt','10','#abcdef');
 const broken=structuredClone(book);broken.sheets[0].conditionalRules[0].color='url(javascript:evil)';
 assert.throws(()=>validateWorkbook(broken),/Недопустимое условие/);
 const invalid=structuredClone(book);invalid.sheets[0].conditionalRules[0].kind='eval';
 assert.throws(()=>validateWorkbook(invalid),/Повреждено правило/);
});
test('TASK051: row insert updates rule coordinates and destructive column deletion rolls back',()=>{
 const {sheet}=setup();
 addConditionalRule(sheet,'A2','B4','gt','15','#bbffaa');
 changeSheetStructure(sheet,'row','insert',1,1);
 assert.equal(sheet.conditionalRules[0].from,'A3');
 assert.equal(sheet.conditionalRules[0].to,'B5');
 const before=JSON.stringify(sheet);
 assert.throws(()=>changeSheetStructure(sheet,'col','delete',0,2),/уничтожит диапазон/);
 assert.equal(JSON.stringify(sheet),before);
});
