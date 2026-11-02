import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function harness(){
  const out=[],writer={name:'Документ',html:'<p>Обычный текст Writer</p>'};
  const ctx={qoWriter:writer,qoPersistWriter:()=>{},download:(...args)=>out.push(args),
    safeFile:s=>String(s).replace(/[^a-zA-Zа-яА-ЯёЁ0-9_-]+/g,'-'),confirm:()=>true,status:()=>{},console};
  runInNewContext(source+'\nthis.api={qdDoc,qdSample,qdVariantsBuild,qdVariantPaperHTML,qdVariantPrintDownload,qdQuestionList,qdVariantPreview};',ctx);
  return {...ctx.api,out,writer};
}
test('TASK111 student paper hides all model answers and keeps writing space',()=>{
  const h=harness(),d=h.qdDoc();h.qdSample();
  const q=d.sections[0].questions[0];
  q.prompt='Назовите пример диффузии';
  q.answer='СЕКРЕТНЫЙ_ОТВЕТ_НЕ_ДЛЯ_УЧЕНИКА';
  d.sections[0].questions[1].type='practice';
  const plan=h.qdVariantsBuild(d,{count:2,perSection:0,seed:'class',shuffleChoices:true});
  assert.equal(plan.ok,true);
  const html=h.qdVariantPaperHTML(plan.variants[0],'student');
  assert.match(html,/<!doctype html>/i);
  assert.match(html,/Вариант А/);
  assert.match(html,/ФИО:/);
  assert.match(html,/write-lines/);
  assert.match(html,/@page\{size:A4/);
  assert.ok(!html.includes('СЕКРЕТНЫЙ_ОТВЕТ_НЕ_ДЛЯ_УЧЕНИКА'));
  assert.ok(!html.includes('Ключ ответов'));
  assert.equal(h.writer.html,'<p>Обычный текст Writer</p>');
});
test('TASK111 teacher key includes point allocation and correct answers',()=>{
  const h=harness(),d=h.qdDoc();h.qdSample();
  const q=d.sections[0].questions[0];
  q.prompt='Что произойдёт с объёмом?';
  q.answer='ПРАВИЛЬНЫЙ_ОТВЕТ';
  q.type='multiple';
  q.choices=[{text:'Альфа',correct:false},{text:'Бета',correct:true},{text:'Гамма',correct:true}];
  q.points=6;q.partialCredit=25;
  const plan=h.qdVariantsBuild(d,{count:2,perSection:0,seed:'12',shuffleChoices:true});
  assert.equal(plan.ok,true);
  const student=h.qdVariantPaperHTML(plan.variants[0],'student');
  assert.match(student,/Бета/);
  assert.ok(!student.includes('Правильные варианты:'));
  const teacher=h.qdVariantPaperHTML(plan.variants[0],'key');
  assert.match(teacher,/Ключ ответов/);
  assert.match(teacher,/Правильные варианты: Бета; Гамма|Правильные варианты: Гамма; Бета/);
  assert.match(teacher,/ПРАВИЛЬНЫЙ_ОТВЕТ/);
  assert.match(teacher,/частичный: 25%/);
  assert.doesNotMatch(teacher,/ФИО:/);
});
test('TASK111 numeric keys retain tolerance; student sheet conceals target',()=>{
  const h=harness(),d=h.qdDoc();h.qdSample();
  const q=d.sections[0].questions[0];q.type='numeric';q.prompt='Определи результат';
  q.numericAnswer='3.14';q.tolerance=0.05;q.answer='Число Пи приблизительно';
  const variant=h.qdVariantsBuild(d,{count:2,perSection:0,seed:'33',shuffleChoices:true}).variants[0];
  const student=h.qdVariantPaperHTML(variant,'student');
  const teacher=h.qdVariantPaperHTML(variant,'key');
  assert.ok(!student.includes('3.14'));
  assert.ok(!student.includes('Число Пи приблизительно'));
  assert.match(student,/Ответ: ___/);
  assert.match(teacher,/3.14/);
  assert.match(teacher,/0.05/);
});
test('TASK111 downloads print HTML, without editing source or personal records',()=>{
  const h=harness(),d=h.qdDoc();h.qdSample();
  d.session.student='ИМЯ_РЕБЕНКА_НЕ_ВКЛЮЧАТЬ';
  d.students=[{id:'s',name:'ИМЯ_РЕБЕНКА_НЕ_ВКЛЮЧАТЬ'}];
  d.history=[{id:'h',student:'ИМЯ_РЕБЕНКА_НЕ_ВКЛЮЧАТЬ'}];
  const original=JSON.stringify(d);
  const prev=h.qdVariantPreview(d);
  assert.match(prev,/Бланк ученика/);
  assert.match(prev,/Ключ ответов/);
  assert.match(prev,/Диагностика \.qdiag/);
  assert.equal(h.qdVariantPrintDownload(d,1,'student').ok,true);
  assert.equal(h.qdVariantPrintDownload(d,1,'key').ok,true);
  assert.equal(h.out.length,2);
  assert.match(h.out[0][0],/variant-Б-student\.html$/);
  assert.match(h.out[1][0],/variant-Б-answers\.html$/);
  for(const [,html,mime] of h.out){
    assert.equal(mime,'text/html;charset=utf-8');
    assert.ok(!html.includes('ИМЯ_РЕБЕНКА_НЕ_ВКЛЮЧАТЬ'));
  }
  assert.equal(JSON.stringify(d),original);
  assert.equal(h.qdVariantPrintDownload(d,5,'student').ok,false);
  assert.equal(h.qdVariantPrintDownload(d,0,'unknown').ok,false);
  assert.equal(h.qdVariantPaperHTML(null,'key'),'');
});
test('TASK111 all user content is HTML-escaped in printable sheets',()=>{
  const h=harness(),d=h.qdDoc();h.qdSample();
  const q=d.sections[0].questions[0];
  q.prompt='<script>alert("prompt")</script>';
  q.answer='<img src=x onerror=alert("answer")>';
  const variant=h.qdVariantsBuild(d,{count:2,perSection:0,seed:'esc',shuffleChoices:true}).variants[0];
  const student=h.qdVariantPaperHTML(variant,'student');
  const key=h.qdVariantPaperHTML(variant,'key');
  for(const html of [student,key]){
    assert.ok(!html.includes('<script>alert'));
    assert.ok(!html.includes('<img src=x onerror'));
    assert.match(html,/&lt;script&gt;/);
  }
  assert.match(key,/&lt;img/);
});
