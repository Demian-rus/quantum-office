import test from 'node:test';
import assert from 'node:assert/strict';
import {qwProject,qwTask,qwValidate} from '../src/core/work-model.js';
import {task149PrintSamples} from './fixtures/task149_4_samples.js';

test('TASK149.4 additive print formats and practice settings roundtrip in QWORK v1',()=>{
 for(const layout of ['worksheet','exam','compact','practice'])for(const grid of ['none','fine','normal']){
  const d=qwProject();Object.assign(d,{layout,practice:{perPage:3,grid},tasks:[qwTask('diagram')]});
  d.tasks[0].prompt='Авторское условие';d.tasks[0].answer='Сохранённый ответ';d.tasks[0].criteria='Критерий';
  assert.deepEqual(qwValidate(JSON.parse(JSON.stringify(d))),d);
 }
});
test('TASK149.4 old layout and illustration defaults remain backward compatible',()=>{
 const d=qwProject();d.tasks=[qwTask()];delete d.layout;delete d.tasks[0].position;
 const old=qwValidate(d);assert.equal(old.layout,'worksheet');assert.equal(old.tasks[0].position,'right');assert.equal(old.practice,undefined);
 assert.equal(qwTask('diagram').position,'auto');
 for(const position of ['auto','left','right','below']){d.tasks[0].position=position;assert.equal(qwValidate(d).tasks[0].position,position);}
});
test('TASK149.4 corrupt practice settings are rejected without changing the source project',()=>{
 for(const practice of [null,{}, {perPage:0,grid:'fine'},{perPage:7,grid:'normal'},{perPage:2,grid:'dark'},{perPage:'2',grid:'fine'}]){
  const d={...qwProject(),practice};const before=JSON.stringify(d);assert.throws(()=>qwValidate(d),/параметры листа/);assert.equal(JSON.stringify(d),before);
 }
});
test('TASK149.4 original sample contains 24 exercises, themes and a separate key source',()=>{
 const samples=task149PrintSamples();assert.deepEqual(samples.map(x=>x.project.tasks.length),[24,1,3]);
 for(const {project} of samples)assert.deepEqual(qwValidate(JSON.parse(JSON.stringify(project))),project);
 const d=samples[0].project;assert.equal(new Set(d.tasks.map(q=>q.prompt)).size,24);assert.equal(new Set(d.tasks.map(q=>q.topic)).size,3);
 assert.ok(d.tasks.filter(q=>q.figure!=='none').length>=12);assert.ok(d.tasks.filter(q=>q.figure==='none').length>=6);
 assert.ok(d.tasks.every(q=>q.answer));assert.equal(d.tasks.filter(q=>q.type==='extended').length,2);
});
