import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function setup(){
 const writer={name:'Документ',html:'<p>Не трогать текстовый документ</p>'};
 const saved=new Map();
 const vm={qoWriter:writer,qoPersistWriter:()=>{},download:()=>{},safeFile:x=>x,confirm:()=>true,status:()=>{},console,
   localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},structuredClone};
 runInNewContext(source+'\nthis.api={qdDoc,qdSample,qdReviewQueues,qdSidebarInsights,qdRunQuestion,qdQuestionList,qdAudit};',vm);
 return {...vm.api,writer};
}
test('TASK113 right rail routes unanswered and weak answers without duplicating progress card',()=>{
 const h=setup(),d=h.qdDoc();h.qdSample();
 const questions=h.qdQuestionList(d);
 d.session.marks[questions[0].id]='yes';
 d.session.marks[questions[1].id]='partial';
 d.session.marks[questions[2].id]='no';
 const queue=h.qdReviewQueues(d);
 assert.equal(queue.pending.length,questions.length-3);
 assert.equal(queue.review.length,2);
 assert.equal(queue.review[0].id,questions[1].id);
 assert.equal(queue.review[1].id,questions[2].id);
 const html=h.qdSidebarInsights(d,'run');
 assert.match(html,/Очередь занятия/);
 assert.match(html,/Следующие вопросы/);
 assert.match(html,/Вернуться к ответам/);
 assert.match(html,/Частично/);assert.match(html,/Не знает/);
 assert.match(html,/sidebar-question/);
 assert.doesNotMatch(html,/qd-side-big-number/);
 assert.doesNotMatch(html,/qd-side-main-bar/);
 assert.equal(h.writer.html,'<p>Не трогать текстовый документ</p>');
});
test('TASK113 single-question preview marks empty cards as not assessable',()=>{
 const h=setup(),d=h.qdDoc();
 const q=h.qdQuestionList(d)[0];
 q.prompt='';
 const html=h.qdRunQuestion(q,0,d);
 assert.match(html,/Заполните вопрос/);
 assert.match(html,/Новый вопрос|Вопрос пока не заполнен/);
 assert.match(html,/disabled title="Заполните вопрос в конструкторе"/);
 assert.match(html,/пустую карточку нельзя оценить/);
});
test('TASK113 builder rail shows actual problems and links to affected question',()=>{
 const h=setup(),d=h.qdDoc();h.qdSample();
 const first=d.sections[0].questions[0];
 first.prompt='';
 const report=h.qdAudit(d);
 assert.ok(report.length>=1);
 const html=h.qdSidebarInsights(d,'builder');
 assert.match(html,/Проверка заданий/);
 assert.match(html,/Требуют исправления/);
 assert.match(html,/sidebar-issue/);
 assert.match(html,/data-field="prompt"/);
 assert.ok(html.includes(first.id));
 assert.doesNotMatch(html,/Ход проверки/);
});
test('TASK113 completed work has empty review queue and user data stays private',()=>{
 const h=setup(),d=h.qdDoc();h.qdSample();
 const all=h.qdQuestionList(d);
 for(const q of all)d.session.marks[q.id]='yes';
 const queue=h.qdReviewQueues(d);
 assert.equal(queue.pending.length,0);assert.equal(queue.review.length,0);
 const html=h.qdSidebarInsights(d,'run');
 assert.match(html,/Все вопросы оценены/);
 assert.match(html,/Нет заданий с частичной/);
 assert.equal(d.history.length,0);
 assert.equal(h.writer.html,'<p>Не трогать текстовый документ</p>');
});
