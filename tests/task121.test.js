import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const paths=['diagnostic-presets.js','diagnostic-question-bank.js','diagnostics.js','diagnostic-media.js'];
const source=paths.map(p=>readFileSync(new URL('../src/core/'+p,import.meta.url),'utf8')).join('\n');
function fixture(){
  const storage=new Map(),writer={html:'<p>Original Writer</p>'};
  const context={qoWriter:writer,qoPersistWriter:()=>{},download:()=>{},safeFile:x=>x,
    status:()=>{},confirm:()=>true,structuredClone,Blob,console,
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
  runInNewContext(source+'\nthis.api={qdNormalize,qdDoc,qdTemplate,qdApplyTemplate,qdCopyCard,qdLibraryRead,'+
    'qdLibrarySaveCurrent,qdBankSaveQuestion,qdBankRead,qdMediaSafe,qdMediaReferenced,'+
    'qdMediaSlotHTML,qdMediaRunHTML,qdMediaOrigNormalize,qdQuestionList,qdMediaKey};',context);
  return {...context.api,storage,writer};
}
const ref={id:'img-abc123',caption:'Разрез <ядра> & пояснение',display:'wide'};
test('TASK121 normalizer round-trips both image refs without changing legacy QDIAG structure',()=>{
  const h=fixture(),d=h.qdNormalize({title:'Медиа',sections:[{id:'s',title:'Физика',questions:[
    {id:'q',prompt:'Что на рисунке?',answer:'Ответ',promptMedia:ref,
      answerMedia:{id:'img-answer',caption:'Решение',display:'small'}}
  ]}]});
  const q=d.sections[0].questions[0];
  assert.equal(q.promptMedia.id,ref.id);
  assert.equal(q.answerMedia.id,'img-answer');
  assert.equal(h.qdNormalize(JSON.parse(JSON.stringify(d))).sections[0].questions[0].promptMedia.caption,ref.caption);
  assert.equal(h.qdMediaReferenced(d).length,2);
  assert.equal(h.qdMediaOrigNormalize(d).sections[0].questions[0].promptMedia,undefined,
    'legacy normalizer still usable without media extension');
  assert.equal(h.writer.html,'<p>Original Writer</p>');
});
test('TASK121 rejects arbitrary refs and unsafe labels; copied cards retain asset links independently',()=>{
  const h=fixture();
  assert.equal(h.qdMediaSafe({id:'../../etc/passwd'}),null);
  assert.equal(h.qdMediaSafe({id:'img-a',display:'javascript:evil'}).display,'medium');
  const d=h.qdNormalize({sections:[{questions:[{
    id:'q1',prompt:'Test',promptMedia:{...ref},answerMedia:{id:'x" onerror="bad',caption:'x'}}
  ]}]});
  assert.equal(d.sections[0].questions[0].answerMedia,undefined);
  const original=d.sections[0].questions[0],clone=h.qdCopyCard(original);
  assert.notEqual(clone.id,original.id);
  assert.equal(clone.promptMedia.id,original.promptMedia.id);
  clone.promptMedia.caption='Changed only on copy';
  assert.equal(original.promptMedia.caption,ref.caption);
  const html=h.qdMediaSlotHTML(original,'prompt');
  assert.match(html,/data-qd-media-id="img-abc123"/);
  assert.match(html,/Разрез &lt;ядра&gt; &amp; пояснение/);
});
test('TASK121 own templates and personal question bank preserve media refs and never include pupil results',()=>{
  const h=fixture(),d=h.qdDoc();
  h.qdApplyTemplate(d,'physics8');
  d.sections[0].questions[0].promptMedia=ref;
  d.sections[0].questions[0].answerMedia={id:'img-answer',display:'medium',caption:'Пример'};
  d.students=[{id:'kid',name:'Pupil Private Name'}];
  d.history=[{id:'h1',student:'Pupil Private Name'}];
  const saved=h.qdLibrarySaveCurrent(d,'physics','8','review');
  assert.equal(saved.ok,true);
  const owned=h.qdLibraryRead()[0];
  assert.equal(owned.sections[0].questions[0].promptMedia.id,'img-abc123');
  assert.equal(owned.sections[0].questions[0].answerMedia.id,'img-answer');
  assert.doesNotMatch(JSON.stringify(owned),/Pupil Private Name/);
  assert.equal(h.qdBankSaveQuestion(d,d.sections[0].questions[0].id,'physics','8').ok,true);
  assert.equal(h.qdBankRead()[0].question.answerMedia.id,'img-answer');
  assert.equal(h.qdMediaReferenced({templates:[owned],questions:h.qdBankRead()}).length,2);
});
test('TASK121 teaching answer is rendered only when explicitly requested',()=>{
  const h=fixture();
  const markup=h.qdMediaRunHTML(ref,'answer');
  assert.match(markup,/qd-media-run/);
  assert.match(markup,/data-kind="answer"/);
  assert.match(markup,/img-abc123/);
  assert.equal(h.qdMediaRunHTML(null,'answer'),'');
});
