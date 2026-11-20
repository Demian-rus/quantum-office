import test from 'node:test';
import assert from 'node:assert/strict';
import {qwTask,qwProject,qwValidate} from '../src/core/work-model.js';
import {qwGraphSVG} from '../src/core/work-content.js';
import {qwPrintStyles} from '../src/core/work-layout.js';
import {qwPrintThemeStyles} from '../src/core/work-print-theme.js';

test('TASK160.1 graph axis shafts stop at filled arrowhead base',()=>{
 const graph=qwTask('graph').graph;
 for(const [xmin,xmax,ymin,ymax] of [[0,10,0,10],[-5,5,-5,5]]){
  Object.assign(graph,{xmin,xmax,ymin,ymax});
  const svg=qwGraphSVG(graph,false,{axisFont:22,titleFont:24});
  assert.match(svg,/data-qw-axis-shaft="x"/);
  assert.match(svg,/data-qw-axis-shaft="y"/);
  assert.match(svg,/data-qw-axis-head="x"/);
  assert.match(svg,/data-qw-axis-head="y"/);
  assert.doesNotMatch(svg,/marker-end="url\(#qw-arrow\)"/);
  const xShaft=svg.match(/<line[^>]*x2="([^"]+)"[^>]*data-qw-axis-shaft="x"/);
  const xHead=svg.match(/data-qw-axis-head="x" d="M[^ ]+ [^ ]+ L([^ ]+)/);
  const yShaft=svg.match(/<line[^>]*y2="([^"]+)"[^>]*data-qw-axis-shaft="y"/);
  const yHead=svg.match(/data-qw-axis-head="y" d="M[^ ]+ [^ ]+ L[^ ]+ ([^ ]+)/);
  assert.ok(xShaft&&xHead&&yShaft&&yHead);
  assert.ok(Math.abs(Number(xShaft[1])-Number(xHead[1]))<.001);
  assert.ok(Math.abs(Number(yShaft[1])-Number(yHead[1]))<.001);
 }
});

test('TASK160.1 booklet answer is not an absolutely positioned overlay',()=>{
 const css=qwPrintStyles('landscape','spread');
 assert.match(css,/\.qw-booklet-answer-by-figure/);
 assert.match(css,/\.qw-booklet-answer\{grid-column:2;grid-row:2/);
 assert.match(css,/\.qw-task-tables table/);
 assert.match(css,/\.qw-figure-below figure\{float:none!important/);
});

test('TASK160.1 QX is embedded handwritten black type without plaque',()=>{
 const css=qwPrintThemeStyles();
 assert.match(css,/font:700 15pt\/1 "QX Handwritten"/);
 assert.match(css,/color:#111!important/);
 assert.match(css,/background:transparent!important/);
 assert.match(css,/-webkit-text-stroke:0;/);
});

test('TASK160.1 QWORK bank display identity round-trips and does not depend on position',()=>{
 const doc=qwProject(),task=qwTask('short');
 task.prompt='Сколько секунд?';
 task.source={kind:'bank',id:'stored-bank-entry-1',number:1807,slot:'7'};
 doc.tasks=[task];const normalized=qwValidate(JSON.parse(JSON.stringify(doc)));
 assert.deepEqual(normalized.tasks[0].source,{kind:'bank',id:'stored-bank-entry-1',number:1807,slot:'7'});
 assert.equal(qwValidate(normalized).tasks[0].source.number,1807);
 const legacy=structuredClone(doc);legacy.tasks[0].source={kind:'bank',id:'old-record'};
 assert.deepEqual(qwValidate(legacy).tasks[0].source,{kind:'bank',id:'old-record'});
 for(const invalid of [{number:0},{number:100000},{number:'1807'},{slot:'41'}]){
  const broken=structuredClone(doc);broken.tasks[0].source={kind:'bank',id:'x',...invalid};
  assert.throws(()=>qwValidate(broken));
 }
});
