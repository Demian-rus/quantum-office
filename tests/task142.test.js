import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=['diagnostic-presets.js','diagnostic-question-bank.js','diagnostics.js'].map(p=>readFileSync(new URL('../src/core/'+p,import.meta.url),'utf8')).join('\n');
function harness(){
 const storage=new Map(),ctx={console,structuredClone,qoWriter:{html:'<p>Original</p>'},qoPersistWriter:()=>{},status:()=>{},confirm:()=>true,
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
 runInNewContext(source+`\nthis.api={qdBlank,qdNormalize,qdWorkingDoc,qdBuilderSignature,qdIsDirty,qdLibrarySaveCurrent,qdLibraryRead,qdLibraryItems,qdBankSaveQuestion,qdBankRead,qdLibraryWrite,
 query:q=>qdLibraryQuery=q,reload:d=>{qoWriter={html:'<p>Original</p>',diagnostic:JSON.parse(JSON.stringify(d))};return qdWorkingDoc();}};`,ctx);
 return {...ctx.api,storage};
}
function seed(h){const d=h.qdBlank();d.title='Авторская работа';d.subject='physics';d.grade='8';d.sections=[{id:'s',title:'Теплопередача',questions:[{id:'q',type:'question',prompt:'Почему нагревается ложка?',answer:'Теплопроводность',hint:'Подумайте о передаче энергии.',criteria:'Назвать физический процесс',points:2,partialCredit:50}]}];return d;}
test('TASK142 pupil hints survive QDIAG, template and bank roundtrips without copying student data',()=>{
 const h=harness(),d=seed(h);d.session.student='Private pupil';const copy=h.qdNormalize(JSON.parse(JSON.stringify(d)));
 assert.equal(copy.sections[0].questions[0].hint,'Подумайте о передаче энергии.');assert.equal(h.qdLibrarySaveCurrent(d,'physics','8','diagnostic').ok,true);
 assert.equal(h.qdLibraryRead()[0].sections[0].questions[0].hint,copy.sections[0].questions[0].hint);
 assert.equal(h.qdBankSaveQuestion(d,'q','physics','8').ok,true);assert.equal(h.qdBankRead()[0].question.hint,copy.sections[0].questions[0].hint);
 assert.ok(!JSON.stringify(h.qdLibraryRead()).includes('Private pupil'));assert.ok(!JSON.stringify(h.qdBankRead()).includes('Private pupil'));
});
test('TASK142 library search includes question, answer, topic and subject, with no library mutation',()=>{
 const h=harness(),d=seed(h);h.qdLibrarySaveCurrent(d,'physics','8','diagnostic');const before=JSON.stringify(h.qdLibraryRead());
 for(const query of ['ложка','теплопроводность','теплопередача','Физика']){h.query(query);assert.ok(h.qdLibraryItems().some(x=>x.source==='custom'),'missing '+query);}
 h.query('nothing-matches-142');assert.equal(h.qdLibraryItems().length,0);assert.equal(JSON.stringify(h.qdLibraryRead()),before);
});
test('TASK142 migrates an unchanged TASK141 saved signature, but a new hint makes the draft dirty',()=>{
 const h=harness(),d=seed(h);delete d.sections[0].questions[0].hint;d.author={templateId:'personal',savedSignature:h.qdBuilderSignature(d,true)};
 const reloaded=h.reload(d);assert.equal(h.qdIsDirty(),false);assert.equal(reloaded.author.templateId,'personal');reloaded.sections[0].questions[0].hint='Новая подсказка';assert.equal(h.qdIsDirty(),true);
});
test('TASK142 rejects writes over a partially corrupted library rather than dropping unparsed entries',()=>{
 const h=harness(),d=seed(h);h.qdLibrarySaveCurrent(d,'physics','8','diagnostic');const key='quantum-office.diagnostic-templates.v1',original=JSON.stringify([...h.qdLibraryRead(),{title:'Damaged',sections:'not an array'}]);
 h.storage.set(key,original);assert.equal(h.qdLibraryWrite(h.qdLibraryRead()),false);assert.equal(h.storage.get(key),original);
 const n=h.qdNormalize({...d,sections:[{id:'s',title:'x',questions:[{id:'q',prompt:'x',hint:'a'.repeat(5000)}]}]});assert.equal(n.sections[0].questions[0].hint.length,1200);
});
