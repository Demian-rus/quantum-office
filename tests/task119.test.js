import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const catalog=readFileSync(new URL('../src/core/diagnostic-presets.js',import.meta.url),'utf8');
const engine=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function harness(){
 const writer={html:'<p>Preserve Writer</p>'},saved=new Map();
 const vm={qoWriter:writer,qoPersistWriter:()=>{},download:()=>{},safeFile:x=>x,confirm:()=>true,
  status:()=>{},console,structuredClone,
  localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}};
 runInNewContext(catalog+'\n'+engine+
  '\nthis.api={qdDoc,qdTemplate,qdApplyTemplate,qdLibraryRead,qdLibraryItems,qdBuilderTemplateMarkup,qdBuilderSaveTemplate,qdQuestionList,qdNormalize};',vm);
 return {...vm.api,writer};
}
test('TASK119 built-in can be corrected and saved as personal template without altering original',()=>{
 const h=harness(),d=h.qdDoc();
 assert.equal(h.qdApplyTemplate(d,'physics8'),true);
 d.students=[{id:'p',name:'Test pupil'}];
 d.history=[{id:'h',student:'Test pupil',marks:{},summary:null}];
 const original=h.qdTemplate('physics8').sections[0].questions[0].prompt;
 d.sections[0].questions[0].prompt='Исправленная формулировка вопроса о сахаре';
 const result=h.qdBuilderSaveTemplate(d,'new','',{subject:'physics',grade:'8',purpose:'diagnostic'});
 assert.equal(result.ok,true);
 assert.equal(h.qdLibraryRead().length,1);
 const template=h.qdLibraryRead()[0];
 assert.equal(template.sections[0].questions[0].prompt,'Исправленная формулировка вопроса о сахаре');
 assert.equal(h.qdTemplate('physics8').sections[0].questions[0].prompt,original);
 assert.ok(!JSON.stringify(template).includes('"students"'));
 assert.ok(!JSON.stringify(template).includes('"history"'));
 assert.ok(!JSON.stringify(template).includes('"session"'));
 assert.equal(d.students.length,1);
 assert.equal(d.history.length,1);
 assert.equal(h.writer.html,'<p>Preserve Writer</p>');
});
test('TASK119 updating owned template preserves stable ID, rejects unknown IDs and overwrites only selected',()=>{
 const h=harness(),d=h.qdDoc();
 h.qdApplyTemplate(d,'physics7');
 const fields={subject:'physics',grade:'7',purpose:'review'};
 const saved=h.qdBuilderSaveTemplate(d,'new','',fields);
 assert.equal(saved.ok,true);
 const id=saved.id,originalTitle=d.title;
 const dup=h.qdBuilderSaveTemplate(d,'new','',fields);
 assert.equal(dup.ok,false,'saving same title twice should not silently replace');
 d.sections[0].questions[0].answer='Исправленный ответ преподавателя.';
 const bad=h.qdBuilderSaveTemplate(d,'update','not-real',fields);
 assert.equal(bad.ok,false);
 const updated=h.qdBuilderSaveTemplate(d,'update',id,fields);
 assert.equal(updated.ok,true);
 assert.equal(h.qdLibraryRead().length,1);
 assert.equal(h.qdLibraryRead()[0].id,id);
 assert.equal(h.qdLibraryRead()[0].title,originalTitle);
 assert.equal(h.qdLibraryRead()[0].sections[0].questions[0].answer,'Исправленный ответ преподавателя.');
});
test('TASK119 builder shows own save/update/export and metadata selectors even when empty',()=>{
 const h=harness(),d=h.qdDoc();
 const html=h.qdBuilderTemplateMarkup(d);
 assert.match(html,/Сохранить как новый шаблон/);
 assert.match(html,/Обновить мой шаблон/);
 assert.match(html,/Скачать библиотеку \.qtpl/);
 assert.match(html,/data-qd-action="builder-template-save"/);
 assert.match(html,/disabled/);
 assert.match(html,/Мой шаблон для обновления/);
});
