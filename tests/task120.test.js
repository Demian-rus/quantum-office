import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const catalog=readFileSync(new URL('../src/core/diagnostic-presets.js',import.meta.url),'utf8');
const bank=readFileSync(new URL('../src/core/diagnostic-question-bank.js',import.meta.url),'utf8');
const engine=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function harness(){
  const saved=new Map(),writer={html:'<p>Do not touch</p>'};
  const env={qoWriter:writer,qoPersistWriter:()=>{},download:()=>{},safeFile:x=>x,
    status:()=>{},confirm:()=>true,console,structuredClone,
    localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}};
  runInNewContext(catalog+'\n'+bank+'\n'+engine+
    '\nthis.api={qdDoc,qdTemplate,qdApplyTemplate,qdQuestionList,qdBankItems,qdBankRead,qdBankSaveQuestion,qdBankFiltered,qdBankAddToDoc,qdBankRemove,qdBankExport,qdBankImport,qdLibrarySaveCurrent,qdLibraryRead,qdLibraryUpdate,qdTemplateVersionsRead,qdTemplateRevisionRestore,qdBuilderTemplateMarkup,qdBankMarkup};',env);
  return {...env.api,saved,writer};
}
const meta={subject:'physics',grade:'8',purpose:'review'};
test('TASK120 searchable bank includes real built-ins, filters and limits duplicate insertion',()=>{
 const h=harness(),d=h.qdDoc();
 const bank=h.qdBankItems();
 assert.ok(bank.length>=200,'bank includes 200+ selected-subject questions');
 const selected=bank.find(x=>x.subject==='informatics'&&x.question.prompt.includes('двоичной'));
 assert.ok(selected,'informatics questions indexed');
 assert.equal(h.qdBankAddToDoc(d,selected).ok,true);
 assert.ok(d.sections.some(s=>s.title===selected.topic));
 const inserted=h.qdQuestionList(d).find(q=>q.prompt===selected.question.prompt);
 assert.ok(inserted&&inserted.id!==selected.question.id,'fresh independent question ID');
 assert.equal(h.qdBankAddToDoc(d,selected).ok,false,'duplicate must be rejected');
 assert.equal(h.writer.html,'<p>Do not touch</p>');
});
test('TASK120 personal question bank saves from builder with no pupil data, survives reload',()=>{
 const h=harness(),d=h.qdDoc();
 h.qdApplyTemplate(d,'physics7');
 d.students=[{id:'p',name:'Pupil name'}];
 d.history=[{id:'h',student:'Pupil name'}];
 const q=h.qdQuestionList(d)[0];
 const saved=h.qdBankSaveQuestion(d,q.id,'physics','7');
 assert.equal(saved.ok,true);
 assert.equal(h.qdBankRead().length,1);
 const data=h.qdBankRead()[0];
 assert.equal(data.subject,'physics');
 assert.ok(!JSON.stringify(data).includes('Pupil name'));
 assert.equal(h.qdBankSaveQuestion(d,q.id,'physics','7').ok,false);
 assert.equal(h.qdBankRemove(data.id),true);
 assert.equal(h.qdBankRead().length,0);
});
test('TASK120 import/export keeps custom questions only and rejects invalid payloads',()=>{
 const h=harness(),d=h.qdDoc();
 h.qdApplyTemplate(d,'informatics8algorithms');
 assert.equal(h.qdBankSaveQuestion(d,h.qdQuestionList(d)[0].id,'informatics','8').ok,true);
 const before=h.qdBankRead();
 const payload=JSON.stringify({format:'quantum-question-bank',version:1,questions:before});
 assert.equal(h.qdBankImport(payload).count,0,'dedupe imported questions');
 assert.equal(h.qdBankImport('{"format":"wrong"}').ok,false);
 assert.equal(h.qdBankImport('not json').ok,false);
 assert.equal(h.qdBankRead().length,1);
});
test('TASK120 personal template keeps 5 older revisions and can restore, current working diagnostic intact',()=>{
 const h=harness(),d=h.qdDoc();
 h.qdApplyTemplate(d,'physics8');
 const create=h.qdLibrarySaveCurrent(d,meta.subject,meta.grade,meta.purpose);
 assert.equal(create.ok,true);
 const id=create.id,original=h.qdLibraryRead()[0].sections[0].questions[0].answer;
 for(let i=0;i<6;i++){
  d.sections[0].questions[0].answer='Авторское исправление '+i;
  const updated=h.qdLibraryUpdate(id,{title:d.title,description:d.description,...meta},d,true);
  assert.equal(updated.ok,true);
 }
 const versions=h.qdTemplateVersionsRead()[id];
 assert.equal(versions.length,5);
 assert.equal(h.qdLibraryRead()[0].sections[0].questions[0].answer,'Авторское исправление 5');
 const prior=versions[0],restored=h.qdTemplateRevisionRestore(id,prior.id);
 assert.equal(restored.ok,true);
 assert.equal(h.qdLibraryRead()[0].sections[0].questions[0].answer,'Авторское исправление 4');
 assert.equal(d.sections[0].questions[0].answer,'Авторское исправление 5','working draft untouched');
 assert.equal(h.qdTemplateRevisionRestore(id,'not-real').ok,false);
 assert.ok(!JSON.stringify(h.qdLibraryRead()[0]).includes('students'));
 assert.equal(h.writer.html,'<p>Do not touch</p>');
});
test('TASK120 interfaces expose bank and versions without changing QDIAG schema',()=>{
 const h=harness(),d=h.qdDoc();
 assert.match(h.qdBankMarkup(),/Банк вопросов/);
 assert.match(h.qdBuilderTemplateMarkup(d),/Предыдущие версии/);
 assert.ok(!Object.hasOwn(d,'questionBank'));
 assert.ok(!Object.hasOwn(d,'templateVersions'));
});
