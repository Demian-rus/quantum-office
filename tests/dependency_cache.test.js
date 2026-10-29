import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCell,updateCalculationValue} from '../src/core/formulas.js';
import {newWorkbook,newSheet,currentSheet,setCell,rawMap,formulaContext,resultOf,displayedValue} from '../src/core/workbook.js';
import {encodeBook,decodeBook} from '../src/core/store.js';

const calculation=(book,sheet)=>{const raw=rawMap(sheet);return {raw,ctx:formulaContext(book,sheet,raw)};};

test('memoizes cross-sheet dependencies, records reverse graph, and propagates edits',()=>{
 const b=newWorkbook(),s=currentSheet(b);s.name='График';
 setCell(s,'A1','10');setCell(s,'B1','=A1*2');setCell(s,'C1','=B1+1');
 const t=newSheet('Расчёты');b.sheets.push(t);setCell(t,'A1','=График!C1+1');
 const {raw,ctx}=calculation(b,t);
 assert.equal(resultOf(t,'A1',raw,ctx),22);
 assert.equal(ctx.calculation.results.get('ГРАФИК!C1'),21);
 assert.deepEqual([...ctx.calculation.dependencies.get('ГРАФИК!B1')],['ГРАФИК!A1']);
 assert.deepEqual([...ctx.calculation.dependents.get('ГРАФИК!C1')],['РАСЧЁТЫ!A1']);
 const first=ctx.calculation.stats.evaluated;
 assert.equal(resultOf(t,'A1',raw,ctx),22);
 assert.equal(ctx.calculation.stats.evaluated,first);
 assert.ok(ctx.calculation.stats.hits>0);
 assert.equal(updateCalculationValue(ctx,'График','A1','20'),4);
 assert.equal(resultOf(t,'A1',raw,ctx),42);
 assert.equal(ctx.calculation.results.get('РАСЧЁТЫ!A1'),42);
 assert.equal(ctx.calculation.graphComplete,true);
 assert.throws(()=>updateCalculationValue(ctx,'Несуществующий','A1','7'),/Недопустимая/);
});

test('lazy IF dependency edges change with condition; IFERROR/cycles are not cached',()=>{
 const b=newWorkbook(),s=currentSheet(b);s.name='График';
 [['A1','=IF(B1,C1,D1)'],['B1','1'],['C1','100'],['D1','200']].forEach(([ref,value])=>setCell(s,ref,value));
 let {raw,ctx}=calculation(b,s);
 assert.equal(resultOf(s,'A1',raw,ctx),'100');
 assert.ok(!ctx.calculation.dependencies.get('ГРАФИК!A1').has('ГРАФИК!D1'));
 assert.equal(updateCalculationValue(ctx,'График','D1','300'),1);
 assert.equal(resultOf(s,'A1',raw,ctx),100);
 assert.equal(updateCalculationValue(ctx,'График','B1','0'),2);
 assert.equal(resultOf(s,'A1',raw,ctx),'300');
 assert.ok(ctx.calculation.dependencies.get('ГРАФИК!A1').has('ГРАФИК!D1'));
 assert.equal(updateCalculationValue(ctx,'График','D1','400'),2);
 assert.equal(resultOf(s,'A1',raw,ctx),'400');
 setCell(s,'A1','=IFERROR(B1,20)');setCell(s,'B1','=A1');
 ({raw,ctx}=calculation(b,s));
 assert.equal(resultOf(s,'A1',raw,ctx),20);
 assert.equal(resultOf(s,'B1',raw,ctx),20);
 assert.ok(!ctx.calculation.results.has('ГРАФИК!A1'));
 assert.ok(!ctx.calculation.results.has('ГРАФИК!B1'));
 setCell(s,'A1','=B1');
 ({raw,ctx}=calculation(b,s));
 assert.equal(resultOf(s,'A1',raw,ctx),'#CYCLE!');
 assert.equal(resultOf(s,'B1',raw,ctx),'#CYCLE!');
});

test('cross-sheet SUMIF range edges, snapshot isolation and .qbook roundtrip',()=>{
 const b=newWorkbook('Доходы'),s=currentSheet(b);s.name='График';
 const ledger=newSheet('Учёт оплаты');b.sheets.push(ledger);
 for(let i=1;i<=10;i++){setCell(ledger,'A'+i,i%2===0?'Оплачено':'Долг');setCell(ledger,'B'+i,String(i*100));}
 setCell(s,'A1',"=SUMIF('Учёт оплаты'!A1:A10,\"Оплачено\",'Учёт оплаты'!B1:B10)");
 let {raw,ctx}=calculation(b,s);
 assert.equal(resultOf(s,'A1',raw,ctx),3000);
 assert.ok(ctx.calculation.dependencies.get('ГРАФИК!A1').has('УЧЁТ ОПЛАТЫ!B10'));
 assert.equal(updateCalculationValue(ctx,'Учёт оплаты','B10','999'),2);
 assert.equal(resultOf(s,'A1',raw,ctx),2999);
 setCell(ledger,'B10','10');
 assert.equal(resultOf(s,'A1',raw,ctx),2999);
 ({raw,ctx}=calculation(b,s));
 assert.equal(resultOf(s,'A1',raw,ctx),2010);
 const after=decodeBook(encodeBook(b)),reloaded=calculation(after,after.sheets[0]);
 assert.equal(resultOf(after.sheets[0],'A1',reloaded.raw,reloaded.ctx),2010);
});

test('200-cell fanout computes its shared subtotal once per snapshot',()=>{
 const b=newWorkbook('Нагрузка'),s=currentSheet(b);
 for(let i=1;i<=200;i++)setCell(s,'B'+i,String(i));
 setCell(s,'A1','=SUM(B1:B200)');
 for(let i=1;i<=200;i++)setCell(s,'C'+i,'=$A$1*2');
 const {raw,ctx}=calculation(b,s);
 for(let i=1;i<=200;i++)assert.equal(resultOf(s,'C'+i,raw,ctx),40200);
 assert.equal(ctx.calculation.stats.evaluated,201);
 assert.equal(ctx.calculation.stats.parsed,201);
 assert.equal(ctx.calculation.stats.hits,199);
 assert.ok(ctx.calculation.dependencies.get('ЛИСТ 1!A1').has('ЛИСТ 1!B200'));
 assert.equal(ctx.calculation.graphComplete,true);
 assert.equal(evaluateCell('C200',raw),40200);
});

test('editing, undo and TODAY all construct fresh calculation snapshots',()=>{
 const b=newWorkbook(),s=currentSheet(b);
 setCell(s,'A1','1');setCell(s,'B1','=A1+1');setCell(s,'C1','=TODAY()');
 const prior=structuredClone(b);
 const a=calculation(b,s);assert.equal(resultOf(s,'B1',a.raw,a.ctx),2);
 assert.equal(resultOf(s,'C1',a.raw,a.ctx),a.ctx.calculation.today);
 setCell(s,'A1','2');
 const next=calculation(b,s);assert.notEqual(a.ctx.calculation,next.ctx.calculation);
 assert.equal(resultOf(s,'B1',next.raw,next.ctx),3);
 const restored=calculation(prior,prior.sheets[0]);
 assert.equal(resultOf(prior.sheets[0],'B1',restored.raw,restored.ctx),2);
 assert.equal(displayedValue(s,'B1',next.raw,next.ctx),'3');
});
