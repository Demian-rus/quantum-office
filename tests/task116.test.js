import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function fixture(){
 const writer={html:'<p>Preserve Writer</p>'},storage=new Map();
 const vm={qoWriter:writer,qoPersistWriter:()=>{},download:()=>{},safeFile:x=>x,
  confirm:()=>true,status:()=>{},console,structuredClone,
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
 runInNewContext(code+'\nthis.api={qdDoc,qdSample,qdGroupSnapshot,qdGroupTopicPlan,qdGroupTopicPlanCSV,qdGroupVisibleRows,qdGroupJournalMarkup,qdNormalize};',vm);
 const h={...vm.api,writer},d=h.qdDoc();h.qdSample();
 d.students=[{id:'a',name:'Аня'},{id:'b',name:'Борис'},{id:'c',name:'Света'}];
 const row=(id,studentId,date,percent,topics)=>({
   id,studentId,date,student:studentId==='a'?'Аня':studentId==='b'?'Борис':'Света',
   title:'Физика',marks:{},responses:{},
   summary:{yes:1,partial:0,no:1,rated:6,total:6,percent},
   topics:topics.map(([name,pct,rated=3])=>({name,percent:pct,rated,total:3}))
 });
 d.history=[
   row('a-new','a','2026-11-02T08:00:00Z',60,[
     ['Молекулы',45],['Молекулы',90],['Теплота',85]]),
   row('b-old','b','2026-10-01T08:00:00Z',85,[['Молекулы',85]]),
   row('b-new','b','2026-11-01T08:00:00Z',55,[
     ['Молекулы',40],['Теплота',30]]),
   row('c-new','c','2026-11-02T11:00:00Z',90,[
     ['Молекулы',0,0],['Теплота',80]])
 ];
 return {h,d,row};
}
test('TASK116 latest result, one pupil per topic and missing score excluded',()=>{
 const {h,d}=fixture(),before=JSON.stringify(d);
 const plan=h.qdGroupTopicPlan(h.qdGroupSnapshot(d));
 assert.equal(plan.length,2);
 assert.equal(plan[0].name,'Молекулы');
 assert.equal(plan[0].need,2);
 assert.equal(plan[0].assessed,2,'unrated pupils are not included');
 assert.equal(plan[1].name,'Теплота');
 assert.equal(plan[1].need,1);
 assert.equal(plan[1].assessed,3);
 assert.equal(JSON.stringify(d),before,'analysis must never edit original');
 assert.equal(h.writer.html,'<p>Preserve Writer</p>');
});
test('TASK116 topic filter composes with existing roster filters',()=>{
 const {h,d}=fixture(),snap=h.qdGroupSnapshot(d);
 const topic=h.qdGroupTopicPlan(snap).find(t=>t.name==='Теплота');
 assert.deepEqual(Array.from(h.qdGroupVisibleRows(snap,'all',topic.key),r=>r.student.id),['b']);
 assert.deepEqual(Array.from(h.qdGroupVisibleRows(snap,'attention',topic.key),r=>r.student.id),['b']);
 assert.equal(h.qdGroupVisibleRows(snap,'attention','nonexistent').length,0);
 assert.match(h.qdGroupJournalMarkup(d),/Темы для повторения/);
 assert.match(h.qdGroupJournalMarkup(d),/data-qd-action="group-topic"/);
});
test('TASK116 topic CSV is protected against spreadsheet formulas',()=>{
 const {h,d}=fixture();
 d.history.find(x=>x.id==='b-new').topics[1].name='=QUERY("x")';
 d.history.find(x=>x.id==='a-new').topics[2].name='=QUERY("x")';
 d.students[1].name='@cmd';
 const csv=h.qdGroupTopicPlanCSV(d);
 assert.ok(csv.startsWith('\ufeff'));
 assert.match(csv,/\'=QUERY/);
 assert.match(csv,/\'@cmd/);
 assert.match(csv,/Молекулы/);
 assert.doesNotMatch(csv,/b-old/);
});
test('TASK116 normalized document preserves the new group plan',()=>{
 const {h,d}=fixture();
 const copy=h.qdNormalize(JSON.parse(JSON.stringify(d)));
 assert.equal(h.qdGroupTopicPlan(h.qdGroupSnapshot(copy))[0].need,2);
});
test('TASK116 no weak topic never marks absence or unassessed record as a failure',()=>{
 const {h,d}=fixture();
 for(const entry of d.history)for(const topic of entry.topics)topic.percent=100;
 const snapshot=h.qdGroupSnapshot(d);
 assert.equal(h.qdGroupTopicPlan(snapshot).length,0);
 assert.match(h.qdGroupJournalMarkup(d),/нет тем ниже 60%/);
});
