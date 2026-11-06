import test from 'node:test';
import assert from 'node:assert/strict';
import {qwTask,qwValidate,qwValidateGraph,qwValidateDiagram,qwEvaluateCurve,qwGeometryVertices,qwProject} from '../src/core/work-model.js';
import {qwGraphSVG,qwDiagramSVG,qwPlotXY} from '../src/core/work-content.js';

test('TASK145 quadratic and trigonometric curves render and persist independently',()=>{
 const g=qwTask('graph').graph;
 g.curveFamily='quadratic';Object.assign(g.curve,{a:1,b:0,c:-1});
 assert.equal(qwEvaluateCurve(g,2),3);
 const quadratic=qwGraphSVG(g);
 assert.match(quadratic,/stroke="#186ba3"/);
 assert.doesNotMatch(quadratic,/NaN|Infinity/);
 g.curveFamily='trigonometric';Object.assign(g.curve,{trig:'sin',amplitude:2,frequency:1,phase:0,offset:1});
 assert.ok(Math.abs(qwEvaluateCurve(g,Math.PI/2)-3)<1e-10);
 g.curve.trig='cos';assert.equal(qwEvaluateCurve(g,0),3);
 const d=qwProject();d.tasks=[qwTask('graph')];d.tasks[0].graph=g;
 assert.deepEqual(qwValidate(JSON.parse(JSON.stringify(d))),d);
});

test('TASK145 custom graph coefficient bounds protect plot generation',()=>{
 const g=qwTask('graph').graph;
 g.curveFamily='trigonometric';g.curve.amplitude=Infinity;
 assert.throws(()=>qwValidateGraph(g),/параметр/);
 g.curve.amplitude=3;g.curve.trig='unknown';
 assert.equal(qwValidateGraph(g).curve.trig,'sin');
});

test('TASK145 graph axis captions identify their axes without changing point coordinates',()=>{
 const g=qwTask('graph').graph;
 g.points=[{x:0,y:0,label:'A'},{x:10,y:10,label:'B'}];
 const svg=qwGraphSVG(g,true);
 assert.deepEqual(qwPlotXY(g,{x:0,y:0}),{x:82,y:262});
 assert.match(svg,/<text class="qw-axis-title" data-axis="x"[^>]*>t, с<\/text>/);
 assert.match(svg,/<text class="qw-axis-title" data-axis="y"[^>]*>v, м\/с<\/text>/);
 assert.match(svg,/paint-order="stroke"/);
 assert.match(svg,/data-qw-point="0"/);
 assert.doesNotMatch(svg,/NaN|Infinity/);
});

test('TASK145 math diagram supports independently labeled triangles and quadrilaterals',()=>{
 const triangle={kind:'triangle',x:120,y:50,x2:350,y2:250,label:''};
 const right={kind:'rightTriangle',x:50,y:70,x2:220,y2:250,label:''};
 const quad={kind:'quadrilateral',x:270,y:50,x2:440,y2:210,label:''};
 const xs=qwValidateDiagram([triangle,right,quad]);
 assert.deepEqual(xs.map(o=>o.vertices.length),[3,3,4]);
 assert.deepEqual(xs[0].vertices.map(v=>v.label),['A','B','C']);
 assert.equal(qwGeometryVertices(xs[1]).length,3);
 xs[0].vertices[2].label='Γ';xs[0].edgeLabels[0]='6 см';
 const svg=qwDiagramSVG(xs,true);
 assert.match(svg,/<polygon points="/);
 assert.match(svg,/Γ/);
 assert.match(svg,/paint-order="stroke"/);
 assert.match(svg,/6 см/);
 assert.match(svg,/data-qw-vertex="2"/);
 assert.match(svg,/qw-geometry-guide/);
 assert.doesNotMatch(qwDiagramSVG(xs),/data-qw-vertex|qw-geometry-guide/);
 assert.match(svg,/data-qw-object="2"/);
 const copy=qwValidateDiagram(xs);
 assert.equal(copy[0].vertices[2].label,'Γ');
 assert.equal(copy[0].edgeLabels[0],'6 см');
});

test('TASK145 malformed geometric vertices are rejected',()=>{
 const figure={kind:'triangle',x:0,y:0,x2:100,y2:100,vertices:[{x:0,y:0,label:'A'}]};
 assert.throws(()=>qwValidateDiagram([figure]),/вершины/);
 figure.vertices=[{x:0,y:0,label:'A'},{x:NaN,y:5,label:'B'},{x:10,y:10,label:'C'}];
 assert.throws(()=>qwValidateDiagram([figure]),/координаты/);
});
