import test from 'node:test';
import assert from 'node:assert/strict';
import {rebaseMovedFormula} from '../src/core/reference-move.js';
import {newWorkbook,currentSheet,setCell,getCell} from '../src/core/workbook.js';
import {copyCells,moveCells} from '../src/core/clipboard.js';

const region={r1:4,c1:3,r2:5,c2:4};
const move=(expr,formulaSheet='Source',sourceSheet='Source')=>rebaseMovedFormula(expr,formulaSheet,sourceSheet,region,5,3);

test('TASK047: Unicode qualifiers and Unicode identifier boundaries',()=>{
 assert.equal(move('=D5+$E$6+SUM(D5:E6)'), '=G10+$H$11+SUM(G10:H11)');
 assert.equal(move('="D5"&D5'), '="D5"&G10');
 assert.equal(move('=Résumé!D5'), '=Résumé!D5');
 assert.equal(move('=Résumé!D5','Résumé','Résumé'), '=Résumé!G10');
 assert.equal(move('=ÉТЮД_D5+D5'), '=ÉТЮД_D5+G10');
 assert.equal(move('=ÜBER_D5+D5'), '=ÜBER_D5+G10');
 assert.equal(move("='Source'!D5"), "='Source'!G10");
 assert.equal(move("='[Budget.xlsx]Source'!D5"), "='[Budget.xlsx]Source'!D5");
 assert.equal(move('=Лист_1!D5'), '=Лист_1!D5');
});
test('TASK047: external and unsupported references block cut atomically',()=>{
 assert.throws(()=>move('=[Budget.xlsx]Source!D5'),/внешнюю или неподдерживаемую/);
 assert.throws(()=>move('=Résumé-2026!D5'),/внешнюю или неподдерживаемую/);
 assert.throws(()=>move('=SUM(C5:D5)'),/частично пересекающий/);
 const b=newWorkbook(),s=currentSheet(b);s.name='Source';
 setCell(s,'D5','17');setCell(s,'X20','=[Budget.xlsx]Source!D5');
 const clip={...copyCells(s,'D5','D5',b),mode:'cut',bookId:b.id,sheetId:s.id};
 const before=JSON.stringify(b);
 assert.throws(()=>moveCells(b,s,'G10',clip),/внешнюю или неподдерживаемую/);
 assert.equal(JSON.stringify(b),before);
 assert.equal(getCell(s,'D5').value,'17');
});
