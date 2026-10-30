import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,validateWorkbook} from '../src/core/workbook.js';
import {addConditionalRule,conditionalFill} from '../src/core/conditional.js';
import {styleCatalog,styleXML,xlsxConditionalFormatting} from '../src/core/xlsx.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

test('TASK055: Excel rules serialize with DXF fill indexes and stable priorities',()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 addConditionalRule(sheet,'B2','B4','gt','15','#ffdddd');
 addConditionalRule(sheet,'C2','C4','lt','-2.5','#aabbcc');
 addConditionalRule(sheet,'D2','D4','eq','срок','#00ddff');
 addConditionalRule(sheet,'E2','E4','contains','ошибка "ввода"','#ffffaa');
 const styles=styleCatalog(book),xml=xlsxConditionalFormatting(sheet,styles);
 const stylesXml=styleXML(styles);
 assert.match(xml,/<conditionalFormatting sqref="B2:B4"><cfRule type="cellIs" operator="greaterThan" dxfId="0" priority="4"><formula>15<\/formula>/);
 assert.match(xml,/operator="lessThan" dxfId="1" priority="3"><formula>-2\.5<\/formula>/);
 assert.match(xml,/operator="equal" dxfId="2" priority="2"><formula>&quot;срок&quot;<\/formula>/);
 assert.match(xml,/type="containsText" dxfId="3" priority="1" text="ошибка &quot;ввода&quot;"/);
 assert.match(xml,/SEARCH\(&quot;ошибка &quot;&quot;ввода&quot;&quot;&quot;,E2\)/);
 assert.match(stylesXml,/<dxfs count="4">/);
 assert.match(stylesXml,/<fgColor rgb="FFFFDDDD"\/>/);
 assert.match(stylesXml,/<fgColor rgb="FF00DDFF"\/>/);
 assert.equal(xlsxConditionalFormatting(currentSheet(newWorkbook()),styleCatalog(newWorkbook())),'');
});

test('TASK055: two-color imported scale endpoints preserve runtime and QBOOK',()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 const rule=addConditionalRule(sheet,'A2','A4','scale');
 rule.lowColor='#112233';rule.highColor='#ddeeff';
 validateWorkbook(book);
 const xml=xlsxConditionalFormatting(sheet,styleCatalog(book));
 assert.match(xml,/<cfvo type="min"\/><cfvo type="max"\/>/);
 assert.match(xml,/<color rgb="FF112233"\/><color rgb="FFDDEEFF"\/>/);
 assert.equal(conditionalFill(sheet,'A2',10,new Map([[rule.id,{min:10,max:20}]])),'#112233');
 assert.equal(conditionalFill(sheet,'A4',20,new Map([[rule.id,{min:10,max:20}]])),'#ddeeff');
 const restored=decodeBook(encodeBook(book));
 assert.equal(restored.sheets[0].conditionalRules[0].lowColor,'#112233');
 assert.equal(restored.sheets[0].conditionalRules[0].highColor,'#ddeeff');
 const broken=structuredClone(book);
 broken.sheets[0].conditionalRules[0].highColor='url(alert(1))';
 assert.throws(()=>validateWorkbook(broken),/Повреждена цветовая шкала/);
});

test('TASK055: malformed simple conditions are rejected before generating OOXML',()=>{
 const book=newWorkbook(),sheet=currentSheet(book);
 addConditionalRule(sheet,'A1','A2','gt','1','#123456');
 sheet.conditionalRules[0].target='A1+2';
 assert.throws(()=>xlsxConditionalFormatting(sheet,styleCatalog(book)),/Недопустимое условие/);
});
