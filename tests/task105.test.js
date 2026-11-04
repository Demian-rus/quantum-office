import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const code=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function harness(){
  const writer={name:'Исходный текст',html:'<p>Нельзя переписывать основной документ</p>'};
  let saves=0;
  const vm={qoWriter:writer,qoPersistWriter:()=>saves++,download:()=>{},safeFile:x=>x,
    confirm:()=>true,status:()=>{},console,structuredClone};
  runInNewContext(code+'\nthis.api={qdDoc,qdDefault,qdNormalize,qdQuestionList,qdAudit,qdMatchingQuestions,qdBatchApply,qdBatchToolbar,qdSelected,qdReviewItems};',vm);
  return {...vm.api,writer,get saves(){return saves;}};
}
function addQuestions(h){
 const d=h.qdDoc();
 d.sections=[
  {id:'s1',title:'Тепловые явления',questions:[
   {id:'q1',type:'question',prompt:'Почему нагревается вода?',answer:'Теплопередача',points:2,partialCredit:50},
   {id:'q2',type:'numeric',prompt:'Сколько джоулей?',answer:'Джоули',numericAnswer:'42',tolerance:0,points:4,partialCredit:50}
  ]},
  {id:'s2',title:'Механика',questions:[
   {id:'q3',type:'practice',prompt:'Вычисли скорость тела',answer:'10 м/с',points:2,partialCredit:50},
   {id:'q4',type:'question',prompt:'Почему объект движется?',answer:'Сила',points:3,partialCredit:50}
  ]}
 ];
 return d;
}
test('TASK105 find by prompt, hidden answer, section, type and only audit issues',()=>{
 const h=harness(),d=addQuestions(h);
 assert.deepEqual([...h.qdMatchingQuestions(d,'скорость').map(q=>q.id)],['q3']);
 assert.deepEqual([...h.qdMatchingQuestions(d,'теплопередача').map(q=>q.id)],['q1']);
 assert.deepEqual([...h.qdMatchingQuestions(d,'МЕХАНИКА').map(q=>q.id)],['q3','q4']);
 assert.deepEqual([...h.qdMatchingQuestions(d,'','numeric').map(q=>q.id)],['q2']);
 assert.deepEqual([...h.qdMatchingQuestions(d,'','practice').map(q=>q.id)],['q3']);
 assert.deepEqual([...h.qdMatchingQuestions(d,'missing').map(q=>q.id)],[]);
 d.sections[1].questions[1].answer='';
 assert.deepEqual([...h.qdMatchingQuestions(d,'','issues').map(q=>q.id)],['q4']);
 assert.equal(h.writer.html,'<p>Нельзя переписывать основной документ</p>');
});
test('TASK105 batch edits points and types without touching historical snapshots',()=>{
 const h=harness(),d=addQuestions(h);
 d.session.marks={q1:'yes',q2:'partial',q3:'no'};
 d.session.responses={q2:{value:'42'}};
 d.history=[{id:'h1',student:'Ученик',marks:{q2:'yes'},summary:{rated:1,total:4,percent:100}}];
 assert.equal(h.qdBatchApply(d,['q1','q2'],'points','9').ok,true);
 assert.equal(d.sections[0].questions[0].points,9);
 assert.equal(d.sections[0].questions[1].points,9);
 assert.equal(h.qdBatchApply(d,['q1'],'points','15').ok,false);
 assert.equal(d.sections[0].questions[0].points,9);
 assert.equal(h.qdBatchApply(d,['q2'],'type','single').ok,true);
 assert.equal(d.sections[0].questions[1].type,'single');
 assert.equal(d.sections[0].questions[1].choices.length>=2,true);
 assert.equal(d.session.marks.q2,undefined);
 assert.equal(d.session.responses.q2,undefined);
 assert.equal(d.session.marks.q1,'yes');
 assert.equal(d.history[0].marks.q2,'yes');
});
test('TASK105 batch move and delete preserve stable IDs, topic and historic records',()=>{
 const h=harness(),d=addQuestions(h);
 d.session.marks={q1:'partial',q3:'no'};
 d.session.responses={q3:{selected:[0]}};
 d.display={mode:'focus',activeId:'q3'};
 d.history=[{id:'h1',marks:{q3:'no'},summary:{rated:1,total:4,percent:0}}];
 let result=h.qdBatchApply(d,['q3','q1'],'move','s2');
 assert.equal(result.ok,true);
 assert.deepEqual([...d.sections[0].questions.map(q=>q.id)],['q2']);
 assert.deepEqual([...d.sections[1].questions.map(q=>q.id)],['q3','q4','q1']);
 assert.equal(d.session.marks.q1,'partial');
 assert.equal(h.qdBatchApply(d,['q1'],'move','missing').ok,false);
 result=h.qdBatchApply(d,['q3','q1'],'delete');
 assert.equal(result.ok,true);
 assert.deepEqual([...d.sections[1].questions.map(q=>q.id)],['q4']);
 assert.equal(d.session.marks.q3,undefined);
 assert.equal(d.session.responses.q3,undefined);
 assert.equal(d.display.activeId,'');
 assert.equal(d.history[0].marks.q3,'no');
 assert.equal(h.qdBatchApply(d,['q3'],'delete').ok,false);
});
test('TASK105 selection controls are present but do not alter legacy document serialization',()=>{
 const h=harness(),d=addQuestions(h);
 const html=h.qdBatchToolbar(d);
 assert.match(html,/qd-search/);
 assert.match(html,/qd-filter-kind/);
 assert.match(html,/select-visible/);
 assert.match(html,/qd-batch-action/);
 assert.match(html,/qd-batch-inputs/);
 const restored=h.qdNormalize(JSON.parse(JSON.stringify(d)));
 assert.equal(restored.sections.length,2);
 assert.equal(restored.sections[0].questions[0].prompt,d.sections[0].questions[0].prompt);
 assert.equal(h.writer.html,'<p>Нельзя переписывать основной документ</p>');
});
