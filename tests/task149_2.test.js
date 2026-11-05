import test from 'node:test';
import assert from 'node:assert/strict';
import {qwProject,qwTask,qwValidate,qwValidateDiagram} from '../src/core/work-model.js';
import {qwHitObject,qwObjectBounds,qwTranslateObject,qwRotatePoint,qwObjectCenter} from '../src/core/work-geometry.js';
import {qwDiagramSVG} from '../src/core/work-content.js';
import {task149Sample} from './fixtures/task149_2_sample.js';

const shapes=()=>[
 {kind:'polyline',x:100,y:100,x2:200,y2:200,label:'ABC',vertices:[{x:100,y:200,label:'A'},{x:200,y:200,label:'B'},{x:200,y:100,label:'C'}]},
 {kind:'arc',x:100,y:100,x2:200,y2:200,startAngle:0,endAngle:90,label:'90°'},
 {kind:'dimension',x:100,y:100,x2:220,y2:100,label:'5 см',labelOffset:20},
 {kind:'doubleArrow',x:100,y:100,x2:220,y2:180,label:'a',rotation:30,style:{stroke:'#2563eb',width:3}}
];
test('TASK149.2 new figures roundtrip in QWORK v1 alongside an old unstyled line',()=>{
 const p=qwProject(),q=qwTask('diagram');q.prompt='Учебная схема';q.diagram=qwValidateDiagram([...shapes(),{kind:'line',x:10,y:20,x2:90,y2:20,label:''}]);p.tasks=[q];
 const saved=qwValidate(p);
 assert.equal(saved.version,1);assert.deepEqual(qwValidate(JSON.parse(JSON.stringify(saved))),saved);
 assert.deepEqual(saved.tasks[0].diagram[4],{kind:'line',x:10,y:20,x2:90,y2:20,label:''});
 assert.equal(p.tasks[0].diagram.length,5);
});
test('TASK149.2 corrupt new figure geometry rejects without mutating input',()=>{
 const cases=[{...shapes()[0],vertices:[{x:1,y:2}]},{...shapes()[0],vertices:[{x:1,y:2},{x:Infinity,y:2}]},
  {...shapes()[1],startAngle:NaN},{...shapes()[1],endAngle:0},{...shapes()[1],endAngle:400},{...shapes()[1],y2:180},
  {...shapes()[2],x2:100},{...shapes()[2],labelOffset:0},{...shapes()[3],x:-1},{...shapes()[3],style:{stroke:'url(#x)'}}];
 for(const item of cases){const before=structuredClone(item);assert.throws(()=>qwValidateDiagram([item]));assert.deepEqual(item,before);}
});
test('TASK149.2 polyline hits only its open segments and follows translation/rotation',()=>{
 const o=shapes()[0];assert.ok(qwHitObject(o,{x:160,y:200},1));assert.equal(qwHitObject(o,{x:160,y:160},1),false);
 const moved=qwTranslateObject(o,25,-10);assert.ok(qwHitObject(moved,{x:185,y:190},1));
 const rotated={...o,rotation:45},p=qwRotatePoint({x:160,y:200},qwObjectCenter(o),45);assert.ok(qwHitObject(rotated,p,1));
 assert.deepEqual(moved.vertices[0],{x:125,y:190,label:'A'});
});
test('TASK149.2 arc selects its actual swept curve, including signed/full angles',()=>{
 const o=shapes()[1];assert.ok(qwHitObject(o,{x:185.355,y:114.645},1));
 assert.equal(qwHitObject(o,{x:115,y:185},1),false);assert.equal(qwHitObject(o,{x:150,y:150},1),false);
 assert.ok(qwHitObject({...o,rotation:90},{x:150,y:200},1));
 assert.ok(qwHitObject({...o,endAngle:-90},{x:185.355,y:185.355},1));
 assert.ok(qwHitObject({...o,endAngle:360},{x:100,y:150},1));
 const bounds=qwObjectBounds(o);assert.ok(bounds.x>=149.9&&bounds.x2<=200.1&&bounds.y>=99.9&&bounds.y2<=150.1);
 const svg=qwDiagramSVG([{...o,endAngle:360}]);assert.equal((svg.match(/ A50 50/g)||[]).length,2,'full circle uses two valid arcs');
});
test('TASK149.2 dimension ticks and double arrow heads belong to their hit geometry',()=>{
 assert.ok(qwHitObject(shapes()[2],{x:100,y:106},.5));assert.equal(qwHitObject(shapes()[2],{x:160,y:120},.5),false);
 const o={kind:'doubleArrow',x:100,y:100,x2:200,y2:100,style:{width:3}};
 assert.ok(qwHitObject(o,{x:118,y:109},.5));assert.ok(qwHitObject(o,{x:182,y:91},.5));
 assert.equal(qwHitObject(o,{x:150,y:115},.5),false);
});
test('TASK149.2 printable SVG retains colors, two arrow heads, dimensions and vertex edit handles',()=>{
 const objects=qwValidateDiagram(shapes()),svg=qwDiagramSVG(objects),editing=qwDiagramSVG(objects,true);
 assert.match(svg,/<polyline /);assert.match(svg,/90°/);assert.match(svg,/5 см/);assert.match(svg,/marker-start=/);assert.match(svg,/auto-start-reverse/);
 assert.match(svg,/stroke="#2563eb" stroke-width="1"/);assert.doesNotMatch(svg,/data-qw-vertex|NaN|Infinity|\[object Object\]/);
 assert.equal((editing.match(/data-qw-vertex=/g)||[]).length,3);
});
test('TASK149.2 teaching source keeps the given maths, a true 30 degree incline and all four new primitives',()=>{
 const d=task149Sample();assert.equal(d.tasks.length,4);assert.deepEqual(qwValidate(JSON.parse(JSON.stringify(d))),d);
 const slope=d.tasks[0].diagram[0];assert.ok(Math.abs((slope.y2-slope.y)/(slope.x2-slope.x)-1/Math.sqrt(3))<1e-10);
 const curve=d.tasks[2].graph.curve,f=x=>curve.a*x*x+curve.b*x+curve.c;
 assert.equal(f(1),0);assert.equal(f(3),0);assert.equal(f(2),-1);assert.equal(d.tasks[2].pageBreak,true);
 assert.ok(d.tasks[1].diagram.some(o=>o.kind==='movablePulley'));
 const kinds=new Set(d.tasks.flatMap(q=>q.diagram.map(o=>o.kind)));for(const k of ['polyline','arc','dimension','doubleArrow'])assert.ok(kinds.has(k));
});
