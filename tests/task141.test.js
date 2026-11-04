import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const src=['diagnostic-presets.js','diagnostic-question-bank.js','diagnostics.js'].map(p=>readFileSync(new URL('../src/core/'+p,import.meta.url),'utf8')).join('\n');
function harness(){
 const saved=new Map(),env={qoWriter:{html:'<p>Writer retained</p>'},structuredClone,console,confirm:()=>true,qoPersistWriter:()=>{},status:()=>{},
 localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}};
 runInNewContext(src+`\nthis.api={qdDoc,qdWorkingDoc,qdBlank,qdAddStudent,qdLibrarySaveCurrent,qdLibraryRead,qdLibraryUpdate,qdLibraryLoad,qdLibraryClone,qdLibraryImport,qdBankSaveQuestion,qdBankRead,qdNormalize,qdBuilderSignature,qdIsDirty,qdStore,qdStartRun,qdScores,qdTemplate,qdQuestionList,qdTopicSnapshot,qdReportHTML,
 mode:m=>qdMode=m,reload:()=>{qoWriter={...qoWriter,diagnostic:JSON.parse(JSON.stringify(qoWriter.diagnostic))};return qdWorkingDoc();},
 markSaved:()=>{qdBuilderLinkedTemplateId='owned';qdBuilderSavedSignature=qdBuilderSignature(qdWorkingDoc());qdStore();}};`,env);
 return {...env.api,env,saved};
}
const fields={subject:'physics',grade:'8',purpose:'diagnostic'};
function seed(h){const d=h.qdBlank();d.title='Авторская диагностика';Object.assign(d,fields);d.sections=[{id:'s',title:'Тепловые явления',questions:[{id:'q',type:'question',prompt:'Что такое температура?',answer:'Мера средней кинетической энергии',criteria:'Объяснение через движение частиц',points:4,partialCredit:50}]}];return d;}
test('TASK141 genuinely empty templates save, reopen, duplicate and survive QTPL roundtrip',()=>{
 const h=harness(),d=h.qdBlank();d.title='Пустой личный шаблон';
 assert.equal(d.sections.length,0);assert.equal(h.qdLibrarySaveCurrent(d,'math','10','exam').ok,true);
 const id=h.qdLibraryRead()[0].id;assert.equal(h.qdLibraryLoad(d,id,'custom'),true);assert.equal(d.sections.length,0);
 const clone=h.qdLibraryClone(id);assert.equal(clone.ok,true);assert.notEqual(clone.id,id);
 const other=harness();assert.equal(other.qdLibraryImport(JSON.stringify({format:'quantum-templates',version:1,templates:h.qdLibraryRead()})).count,2);
 assert.equal(other.qdLibraryRead()[0].sections.length,0);
});
test('TASK141 blank and template changes preserve pupils, history and unfinished snapshot',()=>{
 const h=harness(),d=seed(h);d.students=[{id:'p',name:'Синтетический ученик'}];d.history=[{id:'old',student:'Синтетический ученик'}];
 h.qdStartRun(d);const run=d.run;h.qdBlank();assert.equal(d.students.length,1);assert.equal(d.history.length,1);assert.equal(d.run,run);
 h.qdLibraryLoad(d,'physics8','built-in');assert.equal(d.students.length,1);assert.equal(d.history.length,1);assert.equal(d.run,run);
});
test('TASK141 run is a separate snapshot while builder and source library remain independently editable',()=>{
 const h=harness(),d=seed(h);h.qdLibrarySaveCurrent(d,'physics','8','diagnostic');
 const original=JSON.stringify(h.qdLibraryRead());h.qdStartRun(d);h.mode('run');
 const run=h.qdDoc();run.session.responses.q={value:'Частицы движутся'};run.session.comments.q='Нужен пример';run.session.scores.q=3;run.session.marks.q='partial';h.qdStore();
 h.mode('builder');d.sections[0].questions[0].prompt='Изменённое условие';
 assert.equal(run.sections[0].questions[0].prompt,'Что такое температура?');assert.equal(JSON.stringify(h.qdLibraryRead()),original);
 h.mode('run');assert.equal(h.qdDoc().session.responses.q.value,'Частицы движутся');
});
test('TASK141 scores, written answers, comments, active question and source revision survive reload',()=>{
 const h=harness(),d=seed(h);d.author={templateId:'owned'};h.qdStartRun(d);h.mode('run');const run=h.qdDoc();
 run.session={student:'Test',studentId:'',marks:{q:'partial'},responses:{q:{value:'a'.repeat(700)}},comments:{q:'Комментарий'},scores:{q:3.25}};
 run.display.activeId='q';h.qdStore();h.env.qoWriter.diagnosticMode='run';const restored=h.reload();
 assert.equal(restored.run.document.session.responses.q.value.length,700);assert.equal(restored.run.document.session.scores.q,3.25);
 assert.equal(restored.run.document.session.comments.q,'Комментарий');assert.equal(restored.run.document.display.activeId,'q');
 const score=h.qdScores(run.sections[0].questions,run.session.marks,run.session.scores);assert.equal(score.earned,3.25);assert.equal(score.percent,81);
 assert.equal(h.qdTopicSnapshot(run,run.session.marks)[0].percent,81);
});
test('TASK141 dirty state and linked template persist through normalization with newly created questions',()=>{
 const h=harness(),d=seed(h);h.markSaved();assert.equal(h.qdIsDirty(),false);h.reload();assert.equal(h.qdIsDirty(),false);
 h.qdWorkingDoc().sections[0].questions[0].criteria='Уточнённые критерии';assert.equal(h.qdIsDirty(),true);
});
test('TASK141 input corruption and oversized template import reject atomically, unsafe score maps normalize',()=>{
 const h=harness(),d=seed(h);h.qdLibrarySaveCurrent(d,'physics','8','diagnostic');const original=JSON.stringify(h.qdLibraryRead());
 for(const sections of [[null],[{title:'x',questions:[null]}],Array.from({length:25},()=>({title:'x',questions:[]}))]){
 assert.equal(h.qdLibraryImport(JSON.stringify({format:'quantum-templates',version:1,templates:[{title:'Bad',sections}]})).ok,false);
 }
 assert.equal(JSON.stringify(h.qdLibraryRead()),original);
 const normalized=h.qdNormalize({...d,session:{scores:{q:99,bad:2},comments:{q:'ok',bad:'ignore'},responses:{q:{value:'text'}}}});
 assert.equal(Object.keys(normalized.session.scores).length,0);assert.equal(normalized.session.comments.q,'ok');assert.equal(normalized.session.comments.bad,undefined);
 h.saved.set('quantum-office.diagnostic-templates.v1','broken');assert.equal(h.qdLibrarySaveCurrent({...d,title:'New'},'physics','8','exam').ok,false);
 assert.equal(h.saved.get('quantum-office.diagnostic-templates.v1'),'broken');
});
test('TASK141 new criteria survive bank roundtrip without copying pupil data',()=>{
 const h=harness(),d=seed(h);d.session.student='Private';assert.equal(h.qdBankSaveQuestion(d,'q','physics','8').ok,true);
 assert.equal(h.qdBankRead()[0].question.criteria,'Объяснение через движение частиц');assert.ok(!JSON.stringify(h.qdBankRead()).includes('Private'));
});
test('TASK141 reports use stored question snapshots and escape answers and comments',()=>{
 const h=harness();seed(h);
 const entry={student:'Test',title:'Saved',date:'2026-11-04',marks:{q:'partial'},summary:{yes:0,partial:1,no:0,rated:1,total:1,percent:75,earned:3,possible:4},topics:[],
 questions:[{id:'q',prompt:'Old prompt',section:'Old topic'}],responses:{q:{value:'<img src=x onerror=alert(1)>'}},comments:{q:'<script>bad</script>'},scores:{q:3}};
 const html=h.qdReportHTML(entry);assert.match(html,/Old prompt/);assert.match(html,/&lt;script&gt;bad/);assert.ok(!html.includes('<img src=x'));
});
