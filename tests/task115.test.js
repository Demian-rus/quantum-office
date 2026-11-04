import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const code=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function harness(){
 const writer={html:'<p>Leave Writer unchanged</p>'},storage=new Map();
 const vm={qoWriter:writer,qoPersistWriter:()=>{},download:()=>{},safeFile:x=>x,confirm:()=>true,status:()=>{},console,structuredClone,
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}};
 runInNewContext(code+'\nthis.api={qdDoc,qdSample,qdGroupSnapshot,qdGroupVisibleRows,qdGroupJournalMarkup,qdGroupJournalCSV,qdNormalize};',vm);
 return {...vm.api,writer};
}
function fixtures(h){
 const d=h.qdDoc();h.qdSample();
 d.students=[{id:'a',name:'Аня'},{id:'b',name:'Борис'},{id:'c',name:'Света'}];
 const record=(id,studentId,date,pct,total,topicPct)=>({
  id,studentId,student:studentId==='a'?'Аня':'Борис',date,title:'Физика',
  marks:{},responses:{},summary:{yes:1,partial:0,no:1,rated:total,total,percent:pct},
  topics:[{name:'Молекулы',rated:3,total:3,percent:topicPct},
    {name:'Тепловые явления',rated:3,total:3,percent:pct}]
 });
 d.history=[record('a-new','a','2026-11-01T12:00:00Z',80,10,50),
            record('b-new','b','2026-11-02T12:00:00Z',40,8,25),
            record('a-old','a','2026-10-01T12:00:00Z',50,10,30),
            {id:'unlinked',student:'Гость',date:'2026-11-01',marks:{},summary:null,topics:null}];
 return d;
}
test('TASK115 group table uses latest saved entry by date, never array insertion order',()=>{
 const h=harness(),d=fixtures(h),s=h.qdGroupSnapshot(d);
 assert.equal(s.rows.length,3);assert.equal(s.withResults,2);assert.equal(s.unassigned,1);
 assert.equal(s.rows[0].last.id,'a-new');
 assert.equal(s.rows[0].previous.id,'a-old');
 assert.equal(s.rows[0].delta,30);
 assert.equal(s.rows[0].sameSize,true);
 assert.equal(s.rows[0].topics[0].percent,50);
 assert.equal(s.rows[1].last.summary.percent,40);
 assert.equal(s.rows[2].last,null);
 assert.equal(s.flagged,2);
 assert.equal(h.writer.html,'<p>Leave Writer unchanged</p>');
});
test('TASK115 group summary does not mix students; filter is non-destructive',()=>{
 const h=harness(),d=fixtures(h);
 const before=JSON.stringify(d);
 const s=h.qdGroupSnapshot(d);
 const flagged=h.qdGroupVisibleRows(s,'attention');
 assert.equal(flagged.length,2);
 assert.equal(flagged[0].student.name,'Аня');
 const html=h.qdGroupJournalMarkup(d);
 assert.match(html,/Сводка по ученикам/);
 assert.match(html,/Аня/);assert.match(html,/Борис/);assert.match(html,/Света/);
 assert.match(html,/История/);
 assert.match(html,/60%/);
 assert.match(html,/Проверок без привязанного профиля: 1/);
 assert.equal(JSON.stringify(d),before);
});
test('TASK115 different question counts visibly qualify trend',()=>{
 const h=harness(),d=fixtures(h);
 d.history.find(x=>x.id==='a-old').summary.total=4;
 const s=h.qdGroupSnapshot(d);
 assert.equal(s.rows[0].sameSize,false);
 assert.match(h.qdGroupJournalMarkup(d),/30 п.п. \*/);
});
test('TASK115 CSV escapes spreadsheet injection and remains a simple list',()=>{
 const h=harness(),d=fixtures(h);
 d.students[0].name='=HYPERLINK("bad")';
 d.history.find(x=>x.id==='a-new').topics[0].name='@CMD';
 const csv=h.qdGroupJournalCSV(d);
 assert.match(csv,/\'=HYPERLINK/);
 assert.match(csv,/\'@CMD/);
 assert.match(csv,/Сопоставимое число вопросов/);
 assert.match(csv,/Света/);
 assert.ok(!csv.includes('"marks"'));
 assert.ok(!csv.includes('Гость'));
});
test('TASK115 original and normalized QDIAG preserve pupil comparison',()=>{
 const h=harness(),d=fixtures(h);
 const copy=h.qdNormalize(JSON.parse(JSON.stringify(d)));
 assert.equal(h.qdGroupSnapshot(copy).withResults,2);
 assert.equal(h.qdGroupSnapshot(copy).rows[0].delta,30);
});
