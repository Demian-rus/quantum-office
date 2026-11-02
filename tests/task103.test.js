import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function harness(){
  const doc={name:'Текст',html:'<p>Существующий документ</p>'},downloads=[];
  let saves=0;
  const ctx={qoWriter:doc,qoPersistWriter:()=>saves++,
    download:(...a)=>downloads.push(a),safeFile:x=>x,confirm:()=>true,status:()=>{},console};
  runInNewContext(source+'\nthis.api={qdDoc,qdTemplate,qdApplyTemplate,qdReviewItems,qdScores,qdQuestionList,qdBuilder,qdRun,qdNormalize};',ctx);
  return {api:ctx.api,doc,downloads,get saves(){return saves;}};
}
test('TASK103 new templates contain genuine prompts and solutions and bounded unique IDs',()=>{
 const h=harness();
 for(const key of ['physics7','math56']){
  const t=h.api.qdTemplate(key);assert.ok(t.title.includes(key==='physics7'?'7 класс':'5–6 класс'));
  assert.ok(t.sections.length>=3);
  const ids=t.sections.flatMap(x=>x.questions.map(q=>q.id));
  assert.equal(new Set(ids).size,ids.length);
  assert.ok(ids.length>=8);
  for(const q of t.sections.flatMap(s=>s.questions)){
   assert.ok(q.prompt.length>=15);
   assert.ok(q.answer.length>=2);
   assert.equal(q.points,2);
  }
 }
 assert.equal(h.api.qdTemplate('unsafe'),null);
});
test('TASK103 template replacement resets only diagnostics and retains Writer HTML',()=>{
 const h=harness(),d=h.api.qdDoc();
 d.session.marks[d.sections[0].questions[0].id]='yes';
 d.history.push({student:'One',marks:{},summary:null});
 d.students.push({id:'student',name:'One'});
 assert.equal(h.api.qdApplyTemplate(d,'math56'),true);
 assert.equal(d.students.length,0);assert.equal(d.history.length,0);
 assert.equal(Object.keys(d.session.marks).length,0);
 assert.equal(d.display.mode,'list'); // TASK106 templates start in the chat-style all-questions view.
 assert.ok(h.saves>0);
 assert.equal(h.doc.html,'<p>Существующий документ</p>');
 const normalized=h.api.qdNormalize(JSON.parse(JSON.stringify(d)));
 assert.equal(normalized.sections.length,3);
 assert.equal(normalized.sections[0].questions.length,3);
});
test('TASK103 weakness recap contains only evaluated wrong/partial questions',()=>{
 const h=harness(),d=h.api.qdDoc();
 h.api.qdApplyTemplate(d,'physics7');
 const q=h.api.qdQuestionList(d),marks={[q[0].id]:'yes',[q[1].id]:'partial',[q[4].id]:'no'};
 const weak=h.api.qdReviewItems(d,marks);
 assert.equal(weak.length,2);
 assert.deepEqual([...weak.map(w=>w.grade)],['partial','no']);
 assert.equal(weak[0].section,d.sections[0].title);
 assert.ok(weak.every(w=>w.prompt&&w.id));
 d.session.marks=marks;
 assert.match(h.api.qdRun(),/На повторение/);
 assert.match(h.api.qdRun(),/К вопросу/);
});
