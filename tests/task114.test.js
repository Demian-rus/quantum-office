import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function harness(){
 const writer={html:'<p>Unchanged</p>'},storage=new Map();
 const vm={qoWriter:writer,qoPersistWriter:()=>{},download:()=>{},safeFile:x=>x,status:()=>{},confirm:()=>true,console,structuredClone,
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
 runInNewContext(code+'\nthis.api={qdDoc,qdSample,qdNormalize,qdHistoryComparableRows,qdHistoryCompare,qdHistoryProgressMarkup,qdHistoryComparisonCSV};',vm);
 return {...vm.api,writer};
}
function seed(h){
 const d=h.qdDoc();h.qdSample();
 d.students=[{id:'s1',name:'Ученица А'},{id:'s2',name:'Ученик Б'}];
 const entry=(id,date,studentId,percent,topicPercent,count=4)=>({
  id,date,studentId,student:studentId==='s1'?'Ученица А':'Ученик Б',
  title:'Физика',marks:{},responses:{},
  summary:{yes:1,partial:0,no:0,rated:count,total:count,percent,earned:count*percent/100,possible:count},
  topics:[{name:'Молекулы и температура',rated:count,total:count,percent:topicPercent},
    {name:'Теплопередача',rated:3,total:3,percent}]
 });
 d.history=[entry('h1','2026-10-01T10:00:00Z','s1',40,25),
  entry('other','2026-10-12T10:00:00Z','s2',90,90),
  entry('h2','2026-10-20T10:00:00Z','s1',75,75),
  entry('h3','2026-11-01T10:00:00Z','s1',80,90)];
 return d;
}
test('TASK114 compare saved snapshots only for selected student',()=>{
 const h=harness(),d=seed(h);
 const r=h.qdHistoryCompare(d,'s1','h1','h2');
 assert.equal(r.ok,true);assert.equal(r.delta,35);
 assert.equal(r.from.id,'h1');assert.equal(r.to.id,'h2');
 assert.equal(r.topics[0].delta,50);assert.equal(r.topics[0].countsMatch,true);
 assert.equal(h.qdHistoryComparableRows(d,'s1').length,3);
 assert.equal(h.qdHistoryComparableRows(d,'s2').length,1);
 assert.equal(h.writer.html,'<p>Unchanged</p>');
});
test('TASK114 default latest two and guarded missing or legacy entries',()=>{
 const h=harness(),d=seed(h);
 const r=h.qdHistoryCompare(d,'s1');
 assert.equal(r.from.id,'h2');assert.equal(r.to.id,'h3');
 d.history.push({id:'legacy',date:'invalid',studentId:'s1',summary:null,topics:null});
 assert.equal(h.qdHistoryComparableRows(d,'s1').length,3);
 assert.equal(h.qdHistoryCompare(d,'s2').ok,false);
 assert.equal(h.qdHistoryCompare(d,'unknown').ok,false);
});
test('TASK114 display explicit warning when task counts differ',()=>{
 const h=harness(),d=seed(h);
 d.history.find(x=>x.id==='h2').summary.total=6;
 d.history.find(x=>x.id==='h2').topics[0].rated=6;
 const c=h.qdHistoryCompare(d,'s1','h1','h2');
 assert.equal(c.equalScope,false);
 assert.equal(c.topics[0].countsMatch,false);
 const ui=h.qdHistoryProgressMarkup(d,'s1');
 assert.match(ui,/Количество проверенных заданий/);
 assert.match(ui,/Разное число заданий/);
 assert.match(ui,/само по себе не доказывает/);
});
test('TASK114 chart selectors and safe CSV for subject labels',()=>{
 const h=harness(),d=seed(h);
 const html=h.qdHistoryProgressMarkup(d,'s1');
 assert.match(html,/qd-progress-trend/);
 assert.match(html,/history-compare-from/);
 assert.match(html,/history-compare-to/);
 assert.match(html,/Сравнение CSV/);
 assert.ok(!html.includes('Ученик Б'));
 assert.equal(h.qdHistoryComparisonCSV(d,'s1','h1','h3').ok,true);
 d.history[0].topics[0].name='=HYPERLINK("bad")';
 d.history.find(x=>x.id==='h3').topics[0].name='=HYPERLINK("bad")';
 const csv=h.qdHistoryComparisonCSV(d,'s1','h1','h3');
 assert.match(csv.content,/\'=HYPERLINK/);
});
test('TASK114 topic comparisons persist through QDIAG normalization',()=>{
 const h=harness(),d=seed(h);
 const restored=h.qdNormalize(JSON.parse(JSON.stringify(d)));
 assert.equal(h.qdHistoryCompare(restored,'s1','h1','h2').delta,35);
 assert.equal(h.qdHistoryComparableRows(restored,'s1').length,3);
});
