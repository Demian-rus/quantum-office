
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function sandbox(){
  let saved=0;
  const doc={name:'Doc',html:'<p>Do not alter the editor</p>'},downloads=[];
  const ctx={qoWriter:doc,qoPersistWriter:()=>saved++,download:(...args)=>downloads.push(args),
    safeFile:name=>name,confirm:()=>true,status:()=>{},console};
  runInNewContext(source+'\nthis.api={qdDefault,qdNormalize,qdDoc,qdSample,qdScores,qdQuestionList,qdMoveQuestion,qdShiftQuestion,qdDuplicateQuestion,qdAddStudent,qdStudentResults,qdBuilder,qdRun,qdExport,qdCSV,qdOnInput,qdScoreNumber};',ctx);
  return {api:ctx.api,doc,downloads,get saved(){return saved;}};
}

test('TASK100 weighted scores use each question maximum and partial credit exactly',()=>{
  const {api}=sandbox();
  const q=[{id:'a',points:10,partialCredit:25},{id:'b',points:2,partialCredit:50},{id:'c',points:1,partialCredit:0}];
  const s=api.qdScores(q,{a:'partial',b:'yes',c:'no'});
  assert.equal(s.percent,35); // 4.5 of 13
  assert.equal(s.earned,4.5);assert.equal(s.possible,13);
  assert.equal(s.yes,1);assert.equal(s.partial,1);assert.equal(s.no,1);
  assert.equal(api.qdScores(q,{}).percent,0);
  assert.equal(api.qdScores(q,{a:'yes'}).percent,100);
  assert.equal(api.qdScoreNumber(.25),.25);
});

test('TASK100 reorder, move to other section and duplicate retain original IDs and content',()=>{
  const {api}=sandbox();api.qdSample();const d=api.qdDoc();
  const a=d.sections[0],b=d.sections[1];
  const ids=a.questions.map(q=>q.id),other=b.questions.map(q=>q.id);
  assert.equal(api.qdShiftQuestion(d,ids[0],-1),false);
  assert.equal(api.qdShiftQuestion(d,ids[0],1),true);
  assert.equal(a.questions[1].id,ids[0]);
  assert.equal(api.qdMoveQuestion(d,ids[0],b.id,other[0]),true);
  assert.equal(b.questions[0].id,ids[0]);
  assert.equal(api.qdMoveQuestion(d,ids[0],b.id,other[0],true),true);
  assert.equal(b.questions[1].id,ids[0]);
  const count=api.qdQuestionList(d).length;
  const original=b.questions[1];
  original.points=9;original.partialCredit=30;
  assert.equal(api.qdDuplicateQuestion(d,original.id),true);
  assert.equal(api.qdQuestionList(d).length,count+1);
  const copy=b.questions[2];assert.notEqual(copy.id,original.id);
  assert.equal(copy.prompt,original.prompt);
  assert.equal(copy.points,9);assert.equal(copy.partialCredit,30);
  assert.equal(api.qdMoveQuestion(d,'missing',a.id),false);
  assert.equal(api.qdMoveQuestion(d,original.id,'missing'),false);
  assert.equal(api.qdMoveQuestion(d,original.id,b.id,original.id),false);
});

test('TASK100 named student profiles, history lookup and version-1 compatibility',()=>{
  const {api,doc,downloads}=sandbox();api.qdSample();const d=api.qdDoc();
  const student=api.qdAddStudent(d,'Вера');assert.ok(student.id);
  assert.equal(api.qdAddStudent(d,'вера').id,student.id);
  d.session={student:'Вера',studentId:student.id,marks:{[d.sections[0].questions[0].id]:'yes'}};
  d.history.push({id:'history1',date:'2026-11-02T10:00:00.000Z',student:'Вера',studentId:student.id,
    title:d.title,marks:{...d.session.marks},summary:api.qdScores(api.qdQuestionList(d),d.session.marks)});
  api.qdExport();
  const restored=api.qdNormalize(JSON.parse(downloads.at(-1)[1]));
  assert.equal(restored.students[0].name,'Вера');
  assert.equal(restored.history[0].summary.earned,2);
  assert.equal(restored.session.studentId,student.id);
  assert.equal(api.qdStudentResults(restored,student.id).length,1);
  const old=api.qdNormalize({version:1,sections:[{id:'s',title:'Old',questions:[{id:'q',prompt:'Legacy',answer:'Yep'}]}],
    history:[{student:'Вера',marks:{q:'partial'},summary:{yes:0,partial:1,no:0,rated:1,total:1,percent:50}}]});
  assert.equal(old.sections[0].questions[0].points,2);
  assert.equal(old.sections[0].questions[0].partialCredit,50);
  assert.equal(old.history[0].summary.percent,50);
  assert.equal(doc.html,'<p>Do not alter the editor</p>');
});

test('TASK100 normalize untrusted student and grading data to bounded fields',()=>{
  const {api}=sandbox();
  const oversized={students:Array.from({length:200},(_,i)=>({id:'student'+i,name:'X'.repeat(200)})),
    sections:[{id:'S',title:'T',questions:[
      {id:'Q',prompt:'X',points:999,partialCredit:-5},
      {id:'Q',prompt:'Y',points:2.5,partialCredit:300}
    ]}],session:{student:'X',studentId:'nonexistent',marks:{Q:'yes'}}};
  const fixed=api.qdNormalize(oversized);
  assert.equal(fixed.students.length,80);
  assert.equal(fixed.students[0].name.length,100);
  assert.equal(fixed.session.studentId,'');
  assert.equal(fixed.sections[0].questions[0].points,2);
  assert.equal(fixed.sections[0].questions[0].partialCredit,50);
  assert.equal(fixed.sections[0].questions[1].points,2);
  assert.equal(fixed.sections[0].questions[1].partialCredit,50);
  assert.ok(fixed.sections[0].questions[0].id!==fixed.sections[0].questions[1].id);
  assert.match(api.qdBuilder(),/Перенести в раздел/);
  assert.match(api.qdRun(),/Журнал результатов/);
});
