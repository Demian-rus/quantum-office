import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {qwProject,qwTask,qwValidate,qwValidateDiagram,qwSnapDiagramPoint} from '../src/core/work-model.js';
import {qwDiagramSVG,qwMath,qwMathML} from '../src/core/work-content.js';

test('TASK146 accepts two document layout modes with backward-compatible QWORK',()=>{
 const d=qwProject();
 assert.equal(d.layout,'worksheet');
 d.layout='exam';d.exam='oge';d.tasks=[qwTask('graph')];
 const loaded=qwValidate(JSON.parse(JSON.stringify(d)));
 assert.equal(loaded.layout,'exam');assert.equal(loaded.exam,'oge');
 const old={...d};delete old.layout;delete old.exam;
 const fallback=qwValidate(old);
 assert.equal(fallback.layout,'worksheet');
 assert.equal(fallback.exam,'ege');
});

test('TASK146 applies explicit spacing to math relation operators',()=>{
 const equal=qwMathML(qwMath('v=\\frac{s}{t}'));
 assert.match(equal,/<mo lspace="0.28em" rspace="0.28em">=<\/mo>/);
 assert.match(equal,/<mfrac>/);
});

test('TASK146 preserves reusable physics primitives and rotations',()=>{
 const physics=qwValidateDiagram([
  {kind:'incline',x:70,y:90,x2:450,y2:260,label:''},
  {kind:'block',x:230,y:135,x2:300,y2:175,label:'m',rotation:-25},
  {kind:'pulley',x:220,y:56,x2:300,y2:136,label:''},
  {kind:'spring',x:84,y:209,x2:287,y2:209,label:'k'},
  {kind:'ground',x:70,y:260,x2:450,y2:260,label:''},
  {kind:'rope',x:300,y:110,x2:300,y2:240,label:''}
 ]);
 assert.equal(physics[1].rotation,-25);
 const html=qwDiagramSVG(physics,false);
 assert.match(html,/rotate\(-25/);
 assert.match(html,/stroke-dasharray|<circle/);
 assert.doesNotMatch(html,/qw-geometry-guide|data-qw-vertex/);
});

test('TASK146 automatically places a labeled point away from adjacent segments',()=>{
 const objects=qwValidateDiagram([
  {kind:'point',x:240,y:220,x2:240,y2:220,label:'A'},
  {kind:'point',x:400,y:220,x2:400,y2:220,label:'B'},
  {kind:'point',x:320,y:90,x2:320,y2:90,label:'C'},
  {kind:'line',x:240,y:220,x2:400,y2:220,label:''},
  {kind:'line',x:240,y:220,x2:320,y2:90,label:''},
  {kind:'line',x:320,y:90,x2:400,y2:220,label:''}
 ]);
 const output=qwDiagramSVG(objects,false);
 const labels=[...output.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>([ABC])<\/text>/g)]
  .map(x=>({x:+x[1],y:+x[2],name:x[3]}));
 assert.equal(labels.length,3);
 for(const label of labels){
  const vertex=label.name==='A'?{x:240,y:220}:label.name==='B'?{x:400,y:220}:{x:320,y:90};
  assert.ok(Math.hypot(label.x-vertex.x,label.y-vertex.y)>18,'label overlaps geometry vertex '+label.name);
 }
});
test('TASK146 has only one PDF button and icon-first physics drawing palette',()=>{
 const source=readFileSync(new URL('../src/core/work-builder.js',import.meta.url),'utf8');
 assert.match(source,/qoWorkButton\('work-pdf','Скачать PDF'/);
 assert.doesNotMatch(source,/qoWorkButton\('work-pdf-student'/);
 assert.doesNotMatch(source,/qwButton\('preview-pdf','PDF \(растровый\)'/);
 assert.match(source,/function qwPrintDocumentHTML/);
 assert.match(source,/const QW_VISUAL_TOOLS=\[/);
 assert.match(source,/\['select','Выбрать и переместить'\],\['point','Точка'\],\['line','Отрезок'\]/);
 assert.match(source,/function qwPhysicsPreset/);
});

test('TASK146 magnetic endpoints connect to nearby block and pulley anchors',()=>{
 const objects=qwValidateDiagram([
  {kind:'block',x:200,y:150,x2:280,y2:210,label:'m',rotation:0},
  {kind:'pulley',x:340,y:90,x2:420,y2:170,label:''},
  {kind:'point',x:122,y:96,x2:122,y2:96,label:'A'}
 ]);
 assert.deepEqual(qwSnapDiagramPoint({x:203,y:152},objects,20),{x:200,y:150});
 assert.deepEqual(qwSnapDiagramPoint({x:381,y:93},objects,20),{x:380,y:90});
 assert.deepEqual(qwSnapDiagramPoint({x:124,y:98},objects,20),{x:122,y:96});
 assert.deepEqual(qwSnapDiagramPoint({x:127,y:121},objects,20),{x:120,y:120});
 assert.deepEqual(qwSnapDiagramPoint({x:205,y:153},objects,20,0),{x:200,y:160});
});
