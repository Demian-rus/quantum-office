import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const code=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function setup(){
 const doc={name:'Текст',html:'<p>Обычный документ остаётся неизменным</p>'};
 const ctx={qoWriter:doc,qoPersistWriter:()=>{},download:()=>{},safeFile:x=>x,status:()=>{},confirm:()=>true,console};
 runInNewContext(code+'\nthis.api={qdDoc,qdSample,qdVariantsBuild,qdVariantPreview,qdWorkbench,qdSidebarTopics,qdSidebarInsights,qdQuestionList,qdScores,qdNormalize};',ctx);
 return {...ctx.api,writer:doc};
}
const prompts=variant=>variant.document.sections.map(s=>s.questions.map(q=>q.prompt));
test('TASK110 deterministic 2–4 variants preserve source and avoid repeating a question inside variants',()=>{
 const h=setup(),d=h.qdDoc();h.qdSample();
 const original=JSON.stringify(d);
 const opts={count:3,perSection:2,seed:'ноябрь-физика',shuffleChoices:true};
 const a=h.qdVariantsBuild(d,opts),b=h.qdVariantsBuild(d,opts);
 assert.equal(a.ok,true);assert.equal(a.variants.length,3);
 assert.deepEqual(JSON.parse(JSON.stringify(a.variants.map(prompts))),JSON.parse(JSON.stringify(b.variants.map(prompts))));
 for(const variant of a.variants){
  assert.equal(variant.document.sections.length,3);
  assert.equal(h.qdQuestionList(variant.document).length,6);
  assert.equal(new Set(h.qdQuestionList(variant.document).map(q=>q.id)).size,6);
  assert.equal(new Set(h.qdQuestionList(variant.document).map(q=>q.prompt)).size,6);
  assert.equal(variant.document.students.length,0);
  assert.equal(variant.document.history.length,0);
  assert.deepEqual(Object.keys(variant.document.session.marks),[]);
 }
 assert.equal(JSON.stringify(d),original);
 assert.equal(h.writer.html,'<p>Обычный документ остаётся неизменным</p>');
});
test('TASK110 per-section balancing, preserved right answers and safe choice shuffling',()=>{
 const h=setup(),d=h.qdDoc();h.qdSample();
 const q=d.sections[0].questions[0];
 q.type='single';q.choices=[{text:'А',correct:false},{text:'Б',correct:true},{text:'В',correct:false}];
 q.points=7;q.partialCredit=25;
 d.session.marks[q.id]='yes';d.history=[{id:'h',student:'Личные данные'}];d.students=[{id:'s',name:'Личные данные'}];
 const out=h.qdVariantsBuild(d,{count:2,perSection:0,seed:'same',shuffleChoices:true});
 assert.equal(out.ok,true);
 for(const v of out.variants){
  const cloned=v.document.sections[0].questions.find(x=>x.prompt===q.prompt);
  assert.equal(cloned.points,7);assert.equal(cloned.partialCredit,25);
  assert.equal(cloned.choices.find(x=>x.correct)?.text,'Б');
  assert.ok(!JSON.stringify(v.document).includes('Личные данные'));
 }
 assert.equal(d.session.marks[q.id],'yes');
 assert.equal(d.students.length,1);
});
test('TASK110 invalid settings reject gracefully without mutating source',()=>{
 const h=setup(),d=h.qdDoc();h.qdSample();
 const before=JSON.stringify(d);
 for(const options of [
  {count:1,perSection:2,seed:'a'},{count:5,perSection:2,seed:'a'},
  {count:2,perSection:-1,seed:'a'},{count:2,perSection:3,seed:'a'},
  {count:2,perSection:2,seed:''}
 ])assert.equal(h.qdVariantsBuild(d,options).ok,false);
 assert.equal(JSON.stringify(d),before);
});
test('TASK110 useful topic navigation and stats appear without copying the toolbar actions',()=>{
 const h=setup(),d=h.qdDoc();h.qdSample();
 const left=h.qdSidebarTopics(d,'builder'),right=h.qdSidebarInsights(d,'builder');
 assert.match(left,/qd-side-topic/);assert.match(left,/toggle-all-sections/);
 assert.match(right,/Проверка заданий/);assert.match(right,/Типы заданий/);
 assert.ok(!left.includes('writer-diag-library'));
 assert.ok(!right.includes('data-qd-action="mode"'));
 const html=h.qdWorkbench(d,'builder','<div>Центральная область</div>');
 assert.match(html,/qd-workbench-main/);
 assert.match(html,/qd-topic-navigator/);
 assert.match(html,/qd-side-insights/);
});
test('TASK110 variant preview shows downloadable variants and valid score counts',()=>{
 const h=setup(),d=h.qdDoc();h.qdSample();
 const html=h.qdVariantPreview(d);
 assert.match(html,/Вариант А/);
 assert.match(html,/Вариант Б/);
 assert.match(html,/variant-download/);
 assert.match(html,/баллов/);
});
