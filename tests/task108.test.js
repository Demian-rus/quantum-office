import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const src=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function harness(){
  const data=new Map(),writer={name:'Текстовый документ',html:'<p>Текст должен сохраниться</p>'};
  const downloads=[];
  const vm={qoWriter:writer,qoPersistWriter:()=>{},download:(...x)=>downloads.push(x),safeFile:x=>x,
    confirm:()=>true,status:()=>{},console,structuredClone,
    localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};
  runInNewContext(src+'\nthis.api={qdDoc,qdTemplate,qdQuestionList,qdLibrarySafe,qdLibraryRead,qdLibrarySaveCurrent,qdLibraryUpdate,qdLibraryClone,qdLibraryNameUsed,qdLibraryDelete,qdLibraryEditorMarkup,qdLibraryExport,qdLibraryImport};',vm);
  return {...vm.api,writer,downloads};
}
function seed(h){
  const d=h.qdDoc(),sample=h.qdTemplate('physics8');
  d.title='Физика: мои задания';
  d.description='Авторская диагностика';
  d.sections=sample.sections;
  const id=d.sections[0].questions[0].id;
  d.students=[{id:'pupil',name:'Не сохранять в шаблоне'}];
  d.session.marks={[id]:'yes'};
  d.history=[{id:'history',student:'Не сохранять в шаблоне'}];
  assert.equal(h.qdLibrarySaveCurrent(d,'physics','8','diagnostic').ok,true);
  return d;
}
test('TASK108 metadata editing keeps questions and all student records isolated',()=>{
 const h=harness(),d=seed(h),before=h.qdLibraryRead()[0],old=JSON.stringify(before.sections);
 const result=h.qdLibraryUpdate(before.id,{title:'Новая диагностика',description:'Итоговая проверка',
   subject:'math',grade:'9',purpose:'exam'},d,false);
 assert.equal(result.ok,true);
 const updated=h.qdLibraryRead()[0];
 assert.equal(updated.id,before.id);
 assert.equal(updated.title,'Новая диагностика');
 assert.equal(updated.subject,'math');assert.equal(updated.grade,'9');assert.equal(updated.purpose,'exam');
 assert.equal(updated.description,'Итоговая проверка');
 assert.equal(JSON.stringify(updated.sections),old);
 assert.equal(d.students[0].name,'Не сохранять в шаблоне');
 assert.equal(d.history.length,1);
 assert.ok(!JSON.stringify(updated).includes('Не сохранять в шаблоне'));
 assert.equal(h.writer.html,'<p>Текст должен сохраниться</p>');
 assert.match(h.qdLibraryEditorMarkup(),/^$/,'editor must be opt-in');
});
test('TASK108 updating questions explicitly replaces snapshot, never copies grading',()=>{
 const h=harness(),d=seed(h),original=h.qdLibraryRead()[0],first=d.sections[0].questions[0];
 d.sections=[{id:'new-section',title:'Практика',questions:[{
   ...first,id:'exercise',prompt:'Реши задачу с числами',answer:'42',type:'numeric',
   points:4,numericAnswer:'42',tolerance:0.5
 }]}];
 const result=h.qdLibraryUpdate(original.id,{title:original.title,description:'',subject:'physics',grade:'8',purpose:'practice'},d,true);
 assert.equal(result.ok,true);
 const latest=h.qdLibraryRead()[0];
 assert.equal(latest.sections.length,1);assert.equal(latest.sections[0].questions.length,1);
 assert.equal(latest.sections[0].questions[0].numericAnswer,'42');
 assert.equal(latest.sections[0].questions[0].points,4);
 assert.equal(latest.sections[0].questions[0].tolerance,0.5);
 assert.equal(d.session.marks[first.id],'yes');
 assert.equal(d.history[0].id,'history');
 assert.ok(!JSON.stringify(latest).includes('"marks"'));
});
test('TASK108 duplicate titles, empty content and invalid IDs reject without mutation',()=>{
 const h=harness(),d=seed(h);
 const prior=h.qdLibraryRead()[0];
 d.title='Другая работа';
 assert.equal(h.qdLibrarySaveCurrent(d,'physics','8','practice').ok,true);
 const old=JSON.stringify(h.qdLibraryRead());
 const problem=h.qdLibraryUpdate(prior.id,{title:'Другая работа',subject:'physics',grade:'8',purpose:'exam'},d,false);
 assert.equal(problem.ok,false);assert.match(problem.message,/существует/);
 assert.equal(h.qdLibraryUpdate('missing',{title:'X'},d,false).ok,false);
 assert.equal(h.qdLibraryUpdate(prior.id,{title:' '},d,false).ok,false);
 const empty={...d,sections:[{id:'s',title:'Empty',questions:[]}]};
 assert.equal(h.qdLibraryUpdate(prior.id,{title:prior.title,subject:'math',grade:'7',purpose:'exam'},empty,true).ok,false);
 assert.equal(JSON.stringify(h.qdLibraryRead()),old);
 assert.equal(h.qdLibrarySaveCurrent({...d,title:prior.title},'physics','8','diagnostic').ok,false);
});
test('TASK108 duplication creates independent IDs, can be exported and safely deleted',()=>{
 const h=harness(),d=seed(h),original=h.qdLibraryRead()[0];
 const copy=h.qdLibraryClone(original.id);
 assert.equal(copy.ok,true);assert.notEqual(copy.id,original.id);
 assert.match(copy.title,/копия/);
 const copies=h.qdLibraryRead();assert.equal(copies.length,2);
 assert.deepEqual([...copies.map(x=>x.title)],[copy.title,original.title]);
 const changed=h.qdLibraryUpdate(copy.id,{title:'Моя копия',description:'Своя',
   subject:'other',grade:'10',purpose:'practice'},d,false);
 assert.equal(changed.ok,true);
 assert.equal(h.qdLibraryRead().find(x=>x.id===original.id).title,original.title);
 h.qdLibraryExport();
 const file=JSON.parse(h.downloads.at(-1)[1]);
 assert.equal(file.format,'quantum-templates');assert.equal(file.templates.length,2);
 assert.ok(!JSON.stringify(file).includes('Не сохранять в шаблоне'));
 assert.equal(h.qdLibraryDelete(copy.id),true);
 assert.equal(h.qdLibraryRead().length,1);
 assert.equal(h.qdLibraryClone('missing').ok,false);
});
