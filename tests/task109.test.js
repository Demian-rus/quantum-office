import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function harness(){
  const writer={html:'<p>Существующий текст Writer</p>',name:'Документ'};
  const storage=new Map();
  const ctx={qoWriter:writer,qoPersistWriter:()=>{},download:()=>{},safeFile:x=>x,
    confirm:()=>true,status:()=>{},console,structuredClone,
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
  runInNewContext(source+'\nthis.api={qdDoc,qdSample,qdCopyCard,qdQuickAdd,qdDuplicateSection,qdDuplicateQuestion,qdQuestionList,qdBuilder,qdNormalize};',ctx);
  return {...ctx.api,writer};
}
test('TASK109 quickly create questions with real answers and correct types',()=>{
  const h=harness(),d=h.qdDoc(),sid=d.sections[0].id;
  const first=h.qdQuickAdd(d,sid,{prompt:'Что такое диффузия?',answer:'Перемешивание молекул',type:'question'});
  assert.equal(first.ok,true);
  const second=h.qdQuickAdd(d,sid,{prompt:'Сколько будет 2+2?',answer:'4',type:'numeric'});
  assert.equal(second.ok,true);
  const third=h.qdQuickAdd(d,sid,{prompt:'Выбери правильный ответ',answer:'Вариант A',type:'single'});
  assert.equal(third.ok,true);
  const questions=d.sections[0].questions;
  assert.equal(questions.length,4);
  assert.equal(questions[1].answer,'Перемешивание молекул');
  assert.equal(questions[2].numericAnswer,'4');
  assert.ok(questions[3].choices.length>=2);
  assert.equal(questions[3].type,'single');
  assert.notEqual(questions[1].id,questions[2].id);
  assert.equal(h.writer.html,'<p>Существующий текст Writer</p>');
});
test('TASK109 quick add is atomic for missing section, blank question and size limits',()=>{
 const h=harness(),d=h.qdDoc(),sid=d.sections[0].id;
 const before=JSON.stringify(d);
 assert.equal(h.qdQuickAdd(d,sid,{prompt:' ',answer:'test',type:'question'}).ok,false);
 assert.equal(h.qdQuickAdd(d,'missing',{prompt:'real',answer:'answer',type:'question'}).ok,false);
 assert.equal(JSON.stringify(d),before);
 d.sections[0].questions=Array.from({length:240},(_,i)=>({...d.sections[0].questions[0],id:'q'+i}));
 const snapshot=JSON.stringify(d);
 assert.equal(h.qdQuickAdd(d,sid,{prompt:'Новый вопрос',answer:'Текст'}).ok,false);
 assert.equal(JSON.stringify(d),snapshot);
});
test('TASK109 duplicated question has deep-independent answer choices',()=>{
 const h=harness(),d=h.qdDoc(),sid=d.sections[0].id;
 const original=d.sections[0].questions[0];
 original.type='multiple';
 original.choices=[{text:'Первый',correct:true},{text:'Второй',correct:false}];
 assert.equal(h.qdDuplicateQuestion(d,original.id),true);
 const copy=d.sections[0].questions[1];
 assert.notEqual(copy.id,original.id);
 assert.equal(copy.prompt,original.prompt);
 copy.choices[0].text='Изменённый';
 copy.choices[0].correct=false;
 assert.equal(original.choices[0].text,'Первый');
 assert.equal(original.choices[0].correct,true);
 assert.equal(sid,d.sections[0].id);
});
test('TASK109 duplicate section keeps original, independently copies IDs and preserves grades',()=>{
 const h=harness(),d=h.qdDoc();h.qdSample();
 const source=d.sections[0],id=source.questions[0].id;
 source.questions[0].choices=[{text:'A',correct:true},{text:'B',correct:false}];
 d.session.marks[id]='yes';
 d.history=[{id:'history',student:'Student',marks:{[id]:'yes'}}];
 const before=h.qdQuestionList(d).length;
 const result=h.qdDuplicateSection(d,source.id);
 assert.equal(result.ok,true);assert.equal(result.count,source.questions.length);
 const copy=d.sections[1];
 assert.match(copy.title,/копия/);
 assert.notEqual(copy.id,source.id);
 assert.equal(h.qdQuestionList(d).length,before+source.questions.length);
 for(let i=0;i<source.questions.length;i++){
   assert.notEqual(copy.questions[i].id,source.questions[i].id);
   assert.equal(copy.questions[i].prompt,source.questions[i].prompt);
 }
 copy.questions[0].choices[0].text='Only in copy';
 assert.equal(source.questions[0].choices[0].text,'A');
 assert.equal(d.session.marks[id],'yes');
 assert.equal(d.history.length,1);
 assert.equal(h.qdDuplicateSection(d,'missing').ok,false);
});
test('TASK109 duplicate section does not partially mutate at limits',()=>{
 const h=harness(),d=h.qdDoc(),s=d.sections[0];
 d.sections=Array.from({length:24},(_,i)=>({...s,id:'section'+i,questions:[]}));
 const before=JSON.stringify(d);
 assert.equal(h.qdDuplicateSection(d,'section0').ok,false);
 assert.equal(JSON.stringify(d),before);
 d.sections=[{...s,questions:Array.from({length:130},(_,i)=>({...s.questions[0],id:'q'+i}))},
             {id:'other',title:'Other',questions:Array.from({length:110},(_,i)=>({...s.questions[0],id:'extra'+i}))}];
 const snapshot=JSON.stringify(d);
 assert.equal(h.qdDuplicateSection(d,s.id).ok,false);
 assert.equal(JSON.stringify(d),snapshot);
});
test('TASK109 UI shows quick entry and section tools without touching user doc',()=>{
 const h=harness(),d=h.qdDoc();
 const html=h.qdBuilder();
 assert.match(html,/data-qd-quick="prompt"/);
 assert.match(html,/data-qd-quick="answer"/);
 assert.match(html,/data-qd-action="quick-add"/);
 assert.match(html,/data-qd-action="duplicate-section"/);
 assert.match(html,/data-qd-action="section-collapse"/);
 assert.equal(h.writer.html,'<p>Существующий текст Writer</p>');
});
