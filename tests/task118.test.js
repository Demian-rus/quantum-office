import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const catalog=readFileSync(new URL('../src/core/diagnostic-presets.js',import.meta.url),'utf8');
const engine=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function harness(){
 const writer={html:'<p>User document stays intact</p>'},storage=new Map();
 const vm={qoWriter:writer,qoPersistWriter:()=>{},download:()=>{},safeFile:x=>x,
  confirm:()=>true,status:()=>{},console,structuredClone,
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
 runInNewContext(catalog+'\n'+engine+
  '\nthis.api={QD_PRESETS,QD_PRESET_CURRICULUM,qdTemplate,qdLibraryItems,qdNormalize,qdCheckAnswer,qdLibraryLoad,qdDoc,qdQuestionList};',vm);
 return {...vm.api,writer};
}
test('TASK122 retains only physics, math and informatics built-ins',()=>{
 const h=harness();
 assert.equal(h.QD_PRESETS.length,14);
 assert.equal(new Set(Array.from(h.QD_PRESETS,p=>p.id)).size,14);
 assert.equal(Object.keys(h.QD_PRESET_CURRICULUM.upgrades).length,7);
 assert.equal(Object.keys(h.QD_PRESET_CURRICULUM.new).length,12);
 for(const id of ['physics8','physics7','physics9','math56','math7','informatics7','informatics9']){
  const t=h.qdTemplate(id),n=t.sections.reduce((s,x)=>s+x.questions.length,0);
  assert.ok(n>=18,id+' expanded: '+n);
  assert.ok(t.sections.length>=4,id+' must cover at least four topics');
 }
 const subjects=new Set(Array.from(h.QD_PRESETS,p=>p.subject));
 assert.deepEqual([...subjects].sort(),['informatics','math','physics']);
 assert.equal(h.writer.html,'<p>User document stays intact</p>');
});
test('TASK118 every builtin has nonempty answers, unique prompts and valid options',()=>{
 const h=harness();
 let total=0,automatic=0,practical=0;
 for(const entry of h.QD_PRESETS){
  const document=h.qdTemplate(entry.id);
  assert.ok(document,entry.id);
  const normalized=h.qdNormalize(JSON.parse(JSON.stringify(document)));
  const items=Array.from(normalized.sections).flatMap(s=>Array.from(s.questions));
  assert.ok(items.length>=15,entry.id);
  assert.ok(items.length<=240,entry.id);
  assert.ok(normalized.sections.length<=24,entry.id);
  assert.equal(new Set(items.map(q=>q.prompt.trim().toLocaleLowerCase('ru-RU'))).size,items.length,'duplicate '+entry.id);
  for(const q of items){
   assert.ok(q.prompt.trim().length>10,'short prompt '+entry.id);
   assert.ok(q.answer.trim().length>0,'missing answer '+entry.id);
   assert.ok(q.points>=1&&q.points<=10);
   assert.ok(['question','practice','single','multiple','numeric'].includes(q.type));
   if(q.type==='practice')practical++;
   if(q.type==='single'||q.type==='multiple'){
    automatic++;
    assert.ok(q.choices.every(c=>c.text.trim()),'blank choice '+entry.id);
    const selected=q.choices.flatMap((c,i)=>c.correct?[i]:[]);
    assert.ok(selected.length>=1,'no correct choices '+entry.id);
    if(q.type==='single')assert.equal(selected.length,1,'invalid single '+entry.id);
    assert.equal(h.qdCheckAnswer(q,{selected}),'yes','auto grading '+entry.id);
   }
   if(q.type==='numeric'){
    automatic++;
    assert.ok(Number.isFinite(Number(q.numericAnswer)));
    assert.equal(h.qdCheckAnswer(q,{value:q.numericAnswer}),'yes','numeric grading '+entry.id);
   }
  }
  total+=items.length;
 }
 assert.ok(total>=230,'expected at least 230 relevant questions, got '+total);
 assert.ok(automatic>=70,'automatic checks should add useful variety');
 assert.ok(practical>=20,'preserve practice tasks');
});
test('TASK118 library shows complete counts, does not overwrite user templates',()=>{
 const h=harness(),items=h.qdLibraryItems();
 assert.equal(items.length,14);
 assert.equal(items.some(x=>x.subject==='chemistry'||x.subject==='russian'||x.subject==='biology'||x.subject==='geography'),false);
 assert.equal(items.find(x=>x.id==='physics8').count,h.qdQuestionList(h.qdTemplate('physics8')).length);
 const d=h.qdDoc();
 d.title='User original';
 d.students=[{id:'pupil',name:'Pupil'}];
 d.history=[{id:'history',student:'Pupil'}];
 assert.ok(h.qdLibraryItems().length===14);
 assert.equal(d.title,'User original');
 assert.equal(d.students.length,1);
 assert.equal(d.history.length,1);
});
