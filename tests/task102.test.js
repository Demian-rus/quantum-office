import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function harness(){
  const doc={name:'Doc',html:'<p>Untouched Writer content</p>'},downloads=[];
  const ctx={qoWriter:doc,qoPersistWriter:()=>{},download:(...x)=>downloads.push(x),
    confirm:()=>true,safeFile:x=>x,status:()=>{},console};
  runInNewContext(source+
    '\\nthis.api={qdDoc,qdNormalize,qdSample,qdQuestionList,qdDisplay,qdCurrentIndex,qdSelectQuestion,qdAdvance,qdGuidedQuestions,qdRun,qdScores};',ctx);
  return {api:ctx.api,doc,downloads};
}
test('TASK102 guided view is default with one focus card and safe navigation',()=>{
  const h=harness(),d=h.api.qdDoc();
  assert.equal(h.api.qdDisplay(d).mode,'focus');
  h.api.qdSample();
  const all=h.api.qdQuestionList(d),first=all[0].id;
  assert.equal(h.api.qdCurrentIndex(d,all),0);
  assert.equal(h.api.qdSelectQuestion(d,4),true);
  assert.equal(h.api.qdCurrentIndex(d,all),4);
  assert.equal(h.api.qdSelectQuestion(d,-1),false);
  assert.equal(h.api.qdSelectQuestion(d,99),false);
  assert.equal(h.api.qdCurrentIndex(d,all),4);
  h.api.qdAdvance(d);assert.equal(h.api.qdCurrentIndex(d,all),5);
  assert.equal((h.api.qdRun().match(/class="qd-card qd-run-card/g)||[]).length,1);
  assert.match(h.api.qdRun(),/Карта вопросов/);
  assert.match(h.api.qdRun(),/Подробные результаты и журнал/);
  d.display.mode='list';
  assert.equal((h.api.qdRun().match(/class="qd-card qd-run-card/g)||[]).length,8);
  assert.equal(h.doc.html,'<p>Untouched Writer content</p>');
  assert.notEqual(first,all[5].id);
});
test('TASK102 save and normalize preserve focused question without exposing untrusted IDs',()=>{
  const h=harness();h.api.qdSample();const d=h.api.qdDoc(),questions=h.api.qdQuestionList(d);
  d.display={mode:'focus',activeId:questions[3].id};
  d.session.marks[questions[0].id]='yes';
  const loaded=h.api.qdNormalize(JSON.parse(JSON.stringify(d)));
  assert.equal(loaded.display.activeId,questions[3].id);
  assert.equal(loaded.display.mode,'focus');
  assert.equal(h.api.qdCurrentIndex(loaded,h.api.qdQuestionList(loaded)),3);
  const broken=h.api.qdNormalize({...d,display:{mode:'malicious',activeId:'<script>'}});
  assert.equal(broken.display.mode,'focus');
  assert.equal(broken.display.activeId,'');
  const empty=h.api.qdNormalize({...d,sections:[],display:{mode:'focus',activeId:questions[4].id}});
  assert.equal(h.api.qdCurrentIndex(empty,[]),-1);
  assert.match(h.api.qdGuidedQuestions(empty,[],h.api.qdScores([],{})),/Пока нет вопросов/);
  assert.equal(h.api.qdNormalize({...d,display:{mode:'list'}}).display.mode,'list');
});
