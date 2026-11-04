import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function harness(){
  let storage=new Map(),saved=0;
  const writer={html:'<p>Original text is independent</p>',name:'Документ'};
  const out=[];
  const ctx={qoWriter:writer,qoPersistWriter:()=>saved++,download:(...a)=>out.push(a),
    safeFile:x=>x,confirm:()=>true,status:()=>{},console,
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    structuredClone:globalThis.structuredClone};
  runInNewContext(source+'\nthis.api={qdDoc,qdTemplate,qdNormalize,qdQuestionList,qdLibraryRead,qdLibrarySaveCurrent,qdLibraryItems,qdLibraryLoad,qdLibraryExport,qdLibraryImport,qdLibraryDelete,qdLibraryView,qdRun,qdRunQuestion,qdScores,qdLibrarySafe};',ctx);
  return {api:ctx.api,writer,out,get saved(){return saved;}};
}
test('TASK106 ready-to-use presets span subjects/classes and include chat screenshot physics questions',()=>{
 const {api}=harness();
 for(const id of ['physics8','physics7','physics9','math56','math7','informatics7','informatics9']){
  const d=api.qdTemplate(id);
  assert.ok(d&&d.sections.length>=2,'missing preset '+id);
  const questions=d.sections.flatMap(s=>s.questions);
  assert.ok(questions.length>=8,id+' insufficient question count');
  assert.ok(questions.every(q=>q.prompt&&q.answer),id+' unanswered');
 }
 const d=api.qdTemplate('physics8');
 assert.equal(d.sections[0].questions.length,5);
 assert.match(d.sections[0].questions[0].prompt,/сахар быстрее растворяется/);
 assert.equal(api.qdTemplate('invalid'),null);
});
test('TASK106 template saves only content, without pupils, scoring, or history',()=>{
 const {api,writer}=harness(),d=api.qdDoc();
 const t=api.qdTemplate('physics8');
 d.title=t.title;d.description=t.description;d.sections=t.sections;
 d.students=[{id:'secret',name:'Personal pupil'}];d.history=[{id:'h',student:'Personal pupil'}];
 d.session.marks[d.sections[0].questions[0].id]='yes';
 const result=api.qdLibrarySaveCurrent(d,'physics','8','diagnostic');
 assert.equal(result.ok,true);
 const saved=api.qdLibraryRead()[0];
 assert.equal(saved.sections.length,3);
 assert.ok(!JSON.stringify(saved).includes('Personal pupil'));
 assert.ok(!JSON.stringify(saved).includes('marks'));
 assert.equal(api.qdLibraryItems().filter(x=>x.source==='custom').length,1);
 assert.equal(writer.html,'<p>Original text is independent</p>');
});
test('TASK106 opening preset gives unmarked focus view and preserves pupil history',()=>{
 const {api}=harness(),d=api.qdDoc();
 d.students=[{id:'p',name:'Pupil'}];d.history=[{id:'h',student:'Pupil'}];
 const id=d.sections[0].questions[0].id;
 assert.equal(api.qdLibraryLoad(d,'physics8','built-in'),true);
 assert.equal(d.sections.length,3);
 assert.equal(d.display.mode,'focus');
 assert.notEqual(d.sections[0].questions[0].id,id);
 assert.equal(d.students.length,1);assert.equal(d.history.length,1);
 assert.equal(Object.keys(d.session.marks).length,0);
 assert.match(api.qdRun(),/qd-chat-card/);
 assert.match(api.qdRun(),/Показать ответ/);
 assert.match(api.qdRun(),/Не знает/);
 assert.match(api.qdLibraryView(),/Библиотека диагностик/);
});
test('TASK106 portable .qtpl roundtrip validates data and rejects unsafe payload',()=>{
 const h=harness(),d=h.api.qdDoc(),t=h.api.qdTemplate('math7');
 d.title=t.title;d.description=t.description;d.sections=t.sections;
 assert.equal(h.api.qdLibrarySaveCurrent(d,'math','7','review').ok,true);
 h.api.qdLibraryExport();
 const parsed=JSON.parse(h.out.at(-1)[1]);
 assert.equal(parsed.format,'quantum-templates');
 assert.equal(parsed.templates.length,1);
 assert.ok(!JSON.stringify(parsed).includes('"history"'));
 const result=h.api.qdLibraryImport(JSON.stringify(parsed));
 assert.equal(result.ok,true);
 assert.equal(result.count,0,'duplicates must not be imported');
 assert.equal(h.api.qdLibraryImport('not json').ok,false);
 assert.equal(h.api.qdLibraryImport(JSON.stringify({format:'quantum-templates',version:1,templates:[{}]})).ok,false);
 assert.equal(h.api.qdLibraryDelete(h.api.qdLibraryRead()[0].id),true);
 assert.equal(h.api.qdLibraryRead().length,0);
});
test('TASK106 chat card has right-side grades and answer reveal in one component',()=>{
 const h=harness(),q=h.api.qdTemplate('physics8').sections[0].questions[0];
 const d={session:{marks:{},responses:{}}};
 const card=h.api.qdRunQuestion(q,0,d);
 assert.match(card,/qd-chat-head/);
 assert.match(card,/qd-chat-rating/);
 assert.match(card,/data-mark="yes"/);
 assert.match(card,/data-mark="no"/);
 assert.match(card,/data-mark="partial"/);
 assert.match(card,/data-qd-action="reveal"/);
 assert.equal(card.includes('qd-chat-answer'),false,'answer must be hidden initially');
});
