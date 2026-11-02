import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const code=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function harness(){
  const doc={html:'<p>Original</p>',name:'Doc'},downloads=[];
  const context={qoWriter:doc,qoPersistWriter:()=>{},
    download:(...args)=>downloads.push(args),safeFile:x=>x,confirm:()=>true,status:()=>{},console,
    structuredClone:globalThis.structuredClone};
  runInNewContext(code+'\nthis.exports={qdDoc,qdNormalize,qdParseNumber,qdCheckAnswer,qdNormalizeResponse,qdReportHTML,qdExportReport,qdSample,qdQuestionList,qdScores,qdType,qdChoices,qdBuilder,qdRun};',context);
  return {doc,downloads,...context.exports};
}
test('TASK101 exact choice, multiple subset credit and incorrect choices',()=>{
  const h=harness();
  const single={id:'s',type:'single',choices:[
    {text:'1',correct:false},{text:'2',correct:true},{text:'3',correct:false}]};
  assert.equal(h.qdCheckAnswer(single,{selected:[1]}),'yes');
  assert.equal(h.qdCheckAnswer(single,{selected:[0]}),'no');
  assert.equal(h.qdCheckAnswer(single,{selected:[]}),null);
  const multi={id:'m',type:'multiple',choices:[
    {text:'A',correct:true},{text:'B',correct:false},{text:'C',correct:true}]};
  assert.equal(h.qdCheckAnswer(multi,{selected:[0,2]}),'yes');
  assert.equal(h.qdCheckAnswer(multi,{selected:[2]}),'partial');
  assert.equal(h.qdCheckAnswer(multi,{selected:[0,1]}),'no');
  assert.equal(h.qdCheckAnswer(multi,{selected:[1]}),'no');
  assert.equal(h.qdCheckAnswer(multi,{selected:[]}),null);
  assert.equal(h.qdCheckAnswer({...single,choices:single.choices.map(c=>({...c,correct:false}))},{selected:[1]}),null);
  assert.equal(h.qdCheckAnswer({...single,choices:[{text:'',correct:true},{text:'B',correct:false}]},{selected:[0]}),null);
});
test('TASK101 numeric grading: decimal comma, negatives, zero, tolerance and invalid values',()=>{
  const h=harness(),n={id:'n',type:'numeric',numericAnswer:'-12,5',tolerance:0.25};
  assert.equal(h.qdParseNumber('-12,5'),-12.5);
  assert.equal(h.qdParseNumber('1 000,5'),1000.5);
  assert.equal(h.qdParseNumber('0x12'),null);
  assert.equal(h.qdParseNumber('3+4'),null);
  assert.equal(h.qdParseNumber('1e999'),null);
  assert.equal(h.qdCheckAnswer(n,{value:'-12.7'}),'yes');
  assert.equal(h.qdCheckAnswer(n,{value:'-12,9'}),'no');
  assert.equal(h.qdCheckAnswer(n,{value:'hello'}),null);
  assert.equal(h.qdCheckAnswer({...n,numericAnswer:'invalid'},{value:'1'}),null);
  assert.equal(h.qdCheckAnswer({...n,numericAnswer:'0',tolerance:0},{value:'0'}),'yes');
});
test('TASK101 imported QDIAG limits inputs and preserves older question types and marks',()=>{
  const h=harness();
  const d=h.qdNormalize({
    title:'Physics',
    sections:[{id:'sec1',title:'Section',questions:[
      {id:'s',type:'single',prompt:'Select',choices:[{text:'One',correct:true},{text:'Two',correct:false}]},
      {id:'m',type:'multiple',prompt:'Choose',choices:[{text:'A',correct:true},{text:'B',correct:false}]},
      {id:'n',type:'numeric',prompt:'Value',numericAnswer:'42',tolerance:0.5},
      {id:'old',type:'practice',prompt:'Legacy',answer:'Answer'}]}],
    session:{student:'Test',marks:{s:'yes',m:'partial',n:'no',old:'yes'},
      responses:{s:{selected:[0,9,-1]},m:{selected:[0,0,9]},n:{value:'42'},old:{selected:[0]}}}
  });
  assert.equal(d.sections[0].questions.length,4);
  assert.equal(d.sections[0].questions[3].type,'practice');
  assert.equal(d.session.marks.s,'yes');
  assert.equal(d.session.responses.s.selected.length,1);
  assert.equal(d.session.responses.m.selected.length,1);
  assert.equal(d.session.responses.n.value,'42');
  assert.equal(d.sections[0].questions[2].tolerance,0.5);
  assert.equal(h.qdNormalize({sections:[{questions:[{type:'random',choices:Array(10).fill({text:'x',correct:true}),tolerance:-1}]}]}).sections[0].questions[0].type,'question');
  assert.equal(h.qdType('numeric'),'numeric');
  assert.equal(h.qdChoices().length,4);
});
test('TASK101 report escapes user content and respects immutable snapshots',()=>{
  const h=harness(),d=h.qdDoc();
  d.title='<img src=x onerror=alert(1)>';
  d.sections=[{id:'a',title:'<script>alert(1)</script>',
    questions:[{id:'q',prompt:'Question',type:'numeric',numericAnswer:'1',tolerance:0,points:2,partialCredit:50}]}];
  d.session={student:'<b>Student</b>',studentId:'',marks:{q:'yes'},responses:{q:{value:'1'}}};
  const html=h.qdReportHTML();
  assert.ok(html.includes('&lt;b&gt;Student&lt;/b&gt;'));
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('100%'));
  assert.ok(!html.includes('<img src=x'));
  assert.match(h.qdRun(),/Проверить автоматически/);
  assert.match(h.qdBuilder(),/Числовое значение|числовое значение/i);
  h.qdExportReport();
  assert.match(h.downloads[0][0],/\.html$/);
  assert.match(h.downloads[0][2],/text\/html/);
  assert.equal(h.doc.html,'<p>Original</p>');
});