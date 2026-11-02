
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function harness(){
  const doc={name:'Тест',html:'<p>Текст</p>'},downloads=[];
  let saved=0;
  const ctx={qoWriter:doc,qoPersistWriter:()=>saved++,
    download:(...x)=>downloads.push(x),safeFile:x=>x,
    confirm:()=>true,status:()=>{},console};
  runInNewContext(source+'\nthis.api={qdNormalize,qdDefault,qdDoc,qdScores,qdSample,qdBuilder,qdRun,qdEsc,qdExport,qdCSV,qdCsvCell,qdQuestionList};',ctx);
  return {api:ctx.api,doc,downloads,get saved(){return saved;}};
}
test('clean document, template and scoring',()=>{
  const h=harness(),d=h.api.qdDoc();
  assert.equal(d.sections.length,1);
  h.api.qdSample();
  assert.equal(h.api.qdQuestionList().length,8);
  const ids=h.api.qdQuestionList().map(x=>x.id);
  assert.equal(new Set(ids).size,ids.length);
  const marks={[ids[0]]:'yes',[ids[1]]:'partial',[ids[2]]:'no'};
  const s=h.api.qdScores(h.api.qdQuestionList(),marks);
  assert.equal(s.yes,1);assert.equal(s.partial,1);assert.equal(s.no,1);
  assert.equal(s.rated,3);assert.equal(s.total,8);assert.equal(s.percent,50);
  assert.ok(h.saved>0);
  assert.match(h.api.qdRun(),/Показать ответ/);
  assert.match(h.api.qdRun(),/Итоги диагностики/);
  assert.match(h.api.qdBuilder(),/Что спросить у ученика/);
});
test('strictly bound untrusted diagnostic content and escape markup',()=>{
  const h=harness();
  const raw={title:'<img src=x onerror=alert(1)>',description:'<script>bad</script>',
    sections:[{id:'same',title:'Тема',questions:[
      {id:'same',prompt:'<script>bad</script>',answer:'<img src=x onerror=1>'},
      {id:'same',prompt:'Вопрос',answer:'Решение',type:'practice'}
    ]}],session:{marks:{same:'yes',evil:'no'}},history:[{marks:{same:'no'}}]};
  const safe=h.api.qdNormalize(raw);
  assert.equal(safe.sections[0].questions.length,2);
  assert.equal(new Set([safe.sections[0].id,...safe.sections[0].questions.map(q=>q.id)]).size,3);
  assert.equal(safe.sections[0].questions[0].type,'question');
  assert.equal(safe.sections[0].questions[1].type,'practice');
  assert.equal(Object.keys(safe.session.marks).length,1);
  assert.ok(safe.title.startsWith('<img'));
  assert.equal(h.api.qdEsc(safe.title).includes('<img'),false);
  assert.equal(h.api.qdEsc(safe.title).includes('&lt;img'),true);
  assert.ok(h.api.qdNormalize({sections:Array.from({length:500},()=>({questions:Array.from({length:30},()=>({prompt:'x'}))}))}).sections.length<=24);
});
test('local export/import roundtrip and CSV formula neutralization',()=>{
  const h=harness();
  h.api.qdSample();
  h.doc.diagnostic.session.student='=SUM(1;1)';
  h.api.qdExport();
  const [filename,json,type]=h.downloads[0];
  assert.match(filename,/\.qdiag$/);
  assert.match(type,/json/);
  const roundtrip=h.api.qdNormalize(JSON.parse(json));
  assert.equal(roundtrip.sections.length,3);
  assert.equal(roundtrip.sections[2].questions[0].type,'practice');
  const ids=h.api.qdQuestionList().map(q=>q.id);
  h.doc.diagnostic.history.push({id:'one',date:'2026-11-02T10:00:00.000Z',
    student:'=HYPERLINK("evil")',title:'Тест',marks:{[ids[0]]:'yes'},
    summary:{yes:1,partial:0,no:0,rated:1,total:8,percent:100}});
  h.api.qdCSV();
  const csv=h.downloads[1][1];
  assert.match(csv,/'=HYPERLINK/);
  assert.match(csv,/100/);
  assert.equal(h.api.qdCsvCell('+HACK'),"\"'+HACK\"");
});
