import assert from 'node:assert/strict';
import test from 'node:test';
import {qwProject,qwTask,qwValidate,qwPrintSettings,qwExamPublication,qwExamVariant,qwExamNumberText} from '../src/core/work-model.js';

test('EXAM-01 number text uses only valid permanent numbers',()=>{
 assert.equal(qwExamNumberText(0,815),'№ 1 (00815).');
 for(const invalid of [undefined,null,0,-1,100000,'815','uuid'])assert.equal(qwExamNumberText(0,invalid),'№ 1.');
 assert.equal(qwExamVariant('015'),'15');assert.equal(qwExamVariant('old'),'1');
});
test('EXAM-01 legacy QWORK and explicit section settings round trip without changing data',()=>{
 const old=qwValidate({...qwProject(),layout:'booklet',variant:'15',printSettings:{partHeadings:true},tasks:[{...qwTask(),prompt:'Текст',source:{kind:'bank',id:'existing',number:815}}]});
 assert.equal(qwExamPublication(old),true);assert.equal(qwExamPublication(old,'answers'),true);
 assert.equal(old.printSettings.examPartHeadings,undefined);assert.equal(old.tasks[0].source.number,815);
 assert.deepEqual(qwValidate(JSON.parse(JSON.stringify(old))),old);
 const updated=qwValidate({...old,printSettings:{...old.printSettings,profile:'exam',examPartHeadings:true,examTopicHeadings:false}});
 assert.deepEqual(qwValidate(JSON.parse(JSON.stringify(updated))),updated);
 assert.throws(()=>qwPrintSettings({examPartHeadings:'yes'}));
 for(const profile of ['notes','practice'])assert.equal(qwExamPublication({...old,printSettings:{profile}}),false);
});

test('EXAM-01 key follows active format, not stale exam profile',()=>{
 for(const layout of ['compact','practice','worksheet'])assert.equal(qwExamPublication({layout,printSettings:{profile:'exam'}},'answers'),false);
 assert.equal(qwExamPublication({layout:'exam'},'answers'),false);
 assert.equal(qwExamPublication({layout:'exam',printSettings:{profile:'exam'}},'answers'),true);
 assert.equal(qwExamPublication({layout:'booklet',printSettings:{profile:'exam'}},'answers'),true);
});
