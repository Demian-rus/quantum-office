import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const src=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function harness(){
  const saved=new Map(),writer={name:'Текст',html:'<p>Original Writer</p>'};
  const vm={qoWriter:writer,qoPersistWriter:()=>{},download:()=>{},safeFile:x=>x,status:()=>{},confirm:()=>true,console,
    localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},structuredClone};
  runInNewContext(src+'\nthis.api={qdDoc,qdDefault,qdTemplate,qdLibraryResolve,qdLibraryPreviewPick,qdLibraryMergePlan,qdLibraryMergeApply,qdLibraryPreviewMarkup,qdLibrarySaveCurrent,qdQuestionList,qdNormalize};',vm);
  return {...vm.api,writer};
}
test('TASK107 preview renders sections with individual selection and concealed answers',()=>{
  const h=harness();
  assert.equal(h.qdLibraryPreviewPick('built-in','physics8'),true);
  const html=h.qdLibraryPreviewMarkup();
  assert.match(html,/Молекулы и температура/);
  assert.match(html,/qd-library-preview-question/);
  assert.match(html,/Показать ответ/);
  assert.match(html,/data-qd-template-select/);
  assert.match(html,/Добавить выбранные в текущую/);
  assert.ok(html.indexOf('<details>')>0);
  assert.equal(h.qdLibraryResolve('built-in','not-a-preset'),null);
});
test('TASK107 appending selected questions preserves existing marks and history',()=>{
  const h=harness(),d=h.qdDoc(),existing=d.sections[0].questions[0];
  existing.prompt='Уже существующий вопрос';d.session.marks[existing.id]='partial';
  d.history=[{id:'saved',student:'Pupil',marks:{[existing.id]:'yes'},summary:{rated:1,total:1,percent:100}}];
  const template=h.qdLibraryResolve('built-in','physics8');
  const chosen=template.sections[0].questions.slice(0,2).map(q=>q.id);
  const old=JSON.stringify(d);
  const plan=h.qdLibraryMergePlan(d,template,chosen);
  assert.equal(plan.ok,true);assert.equal(plan.items.length,2);assert.equal(plan.newSections.length,1);
  assert.equal(JSON.stringify(d),old,'planning must never alter current diagnostic');
  assert.equal(h.qdLibraryMergeApply(d,plan),true);
  assert.equal(h.qdQuestionList(d).length,3);
  assert.equal(d.sections[1].title,'Молекулы и температура');
  assert.equal(d.session.marks[existing.id],'partial');
  assert.equal(d.history[0].student,'Pupil');
  assert.equal(d.history[0].summary.percent,100);
  assert.equal(h.writer.html,'<p>Original Writer</p>');
});
test('TASK107 skip duplicate prompt without changing ID or creating empty sections',()=>{
  const h=harness(),d=h.qdDoc();
  const template=h.qdLibraryResolve('built-in','physics8');
  const original=template.sections[0].questions[0];
  d.sections[0].questions[0].prompt='  '+original.prompt.toLocaleUpperCase('ru-RU')+' ';
  const selected=new Set(template.sections[0].questions.slice(0,2).map(q=>q.id));
  const plan=h.qdLibraryMergePlan(d,template,selected);
  assert.equal(plan.ok,true);assert.equal(plan.items.length,1);assert.equal(plan.duplicates,1);
  assert.equal(h.qdLibraryMergeApply(d,plan),true);
  assert.equal(d.sections.length,2);
  const again=h.qdLibraryMergePlan(d,template,selected);
  assert.equal(again.ok,false);
  assert.match(again.error,/уже есть/);
});
test('TASK107 existing section title merges into that section without duplicates',()=>{
  const h=harness(),d=h.qdDoc(),t=h.qdLibraryResolve('built-in','physics8');
  d.sections[0].title='Молекулы и температура';
  const q=t.sections[0].questions[1];
  const plan=h.qdLibraryMergePlan(d,t,[q.id]);
  assert.equal(plan.ok,true);assert.equal(plan.newSections.length,0);
  h.qdLibraryMergeApply(d,plan);
  assert.equal(d.sections.length,1);
  assert.equal(d.sections[0].questions.at(-1).prompt,q.prompt);
});
test('TASK107 section and question limits reject atomically',()=>{
 const h=harness(),d=h.qdDoc(),t=h.qdLibraryResolve('built-in','physics8');
 const id=t.sections[0].questions[0].id;
 d.sections[0].questions=Array.from({length:240},(_,i)=>({...t.sections[0].questions[0],id:'q'+i,prompt:'Original '+i}));
 const before=JSON.stringify(d);
 const plan=h.qdLibraryMergePlan(d,t,[id]);
 assert.equal(plan.ok,false);assert.match(plan.error,/240/);
 assert.equal(JSON.stringify(d),before);
 assert.equal(h.qdLibraryMergeApply(d,plan),false);
});
test('TASK107 custom template can be previewed and appended with preserved numeric criteria',()=>{
 const h=harness(),d=h.qdDoc();
 const original=h.qdTemplate('physics8');
 d.title='Custom';d.sections=original.sections;
 d.sections[0].questions[0]={...d.sections[0].questions[0],type:'numeric',numericAnswer:'7,5',tolerance:0.25,points:4};
 const saved=h.qdLibrarySaveCurrent(d,'physics','8','practice');
 assert.equal(saved.ok,true);
 const model=h.qdLibraryResolve('custom',saved.id);
 assert.equal(model.sections[0].questions[0].type,'numeric');
 const target=h.qdDefault();target.sections[0].questions[0].prompt='Another';
 const p=h.qdLibraryMergePlan(target,model,[model.sections[0].questions[0].id]);
 assert.equal(p.ok,true);h.qdLibraryMergeApply(target,p);
 const added=h.qdQuestionList(target).at(-1);
 assert.equal(added.numericAnswer,'7,5');assert.equal(added.tolerance,0.25);assert.equal(added.points,4);
});
