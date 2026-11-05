import test from 'node:test';
import assert from 'node:assert/strict';
import {qwProject,qwTask,qwValidate,qwLabelPosition,qwPrintSettings} from '../src/core/work-model.js';
import {qwChooseLabelBox,qwLabelSegmentHits} from '../src/core/work-labels.js';
import {qwTranslateObject,qwTranslateGraphObject} from '../src/core/work-geometry.js';

const segment=(a,b,pad=2)=>({a,b,pad,minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x),minY:Math.min(a.y,b.y),maxY:Math.max(a.y,b.y)});
test('TASK149.5 a text box intersecting the interior of an outgoing segment is rejected',()=>{
 const a={x:155.8,y:218.8},b={x:377.2,y:46},box={x:165.13,y:194.38,w:13.4,h:21.44},line=segment(a,b),bounds={x:82,y:46,w:369,h:216};
 assert.ok(qwLabelSegmentHits(a,b,box));const result=qwChooseLabelBox(a,box,bounds,[line],[]);assert.equal(result.score,0);assert.ok(result.box.x+result.box.w<a.x);assert.ok(result.box.y<a.y);
 const bBox={x:387.2,y:53.58,w:12.68,h:21.44};assert.deepEqual(qwChooseLabelBox(b,bBox,bounds,[line],[]).box,bBox,'a safe B stays exactly in place');
});
test('TASK149.5 collisions include stroke padding and neighbouring text',()=>{
 assert.ok(qwLabelSegmentHits({x:0,y:0},{x:100,y:0},{x:20,y:2,w:10,h:12},3));
 const box={x:30,y:30,w:12,h:20},r=qwChooseLabelBox({x:25,y:55},box,{x:0,y:0,w:200,h:200},[],[box]);assert.equal(r.score,0);assert.notDeepEqual(r.box,box);
});
test('TASK149.5 a long caption at a grid corner finds space without moving the graph',()=>{
 const anchor={x:82,y:262},line=segment(anchor,{x:377,y:89}),box={x:92,y:238,w:69,h:22},bounds={x:82,y:46,w:369,h:216};
 const r=qwChooseLabelBox(anchor,box,bounds,[line],[]);assert.equal(r.score,0);assert.ok(r.box.x>=82&&r.box.y+r.box.h<=262);
});
test('TASK149.5 attached point, vertex, side and object offsets survive QWORK and group translation',()=>{
 const d=qwProject(),g=qwTask('graph'),q=qwTask('diagram'),manual={mode:'manual',dx:-23.25,dy:-16};g.prompt='График';g.graph.points=[{x:1,y:1,label:'A',labelPosition:manual}];
 q.prompt='Схема';q.diagram=[{kind:'triangle',x:100,y:70,x2:260,y2:180,label:'ABC',labelPosition:manual,vertices:[{x:100,y:180,label:'A',labelPosition:manual},{x:260,y:180,label:'B'},{x:180,y:70,label:'C'}],edgeLabels:['5','',''],edgeLabelPositions:[manual,null,null]}];d.tasks=[g,q];
 const loaded=qwValidate(d);assert.deepEqual(loaded.tasks[0].graph.points[0].labelPosition,manual);assert.deepEqual(loaded.tasks[1].diagram[0].vertices[0].labelPosition,manual);assert.deepEqual(loaded.tasks[1].diagram[0].edgeLabelPositions[0],manual);
 assert.deepEqual(qwValidate(JSON.parse(JSON.stringify(loaded))),loaded);
 const moved=qwTranslateObject(loaded.tasks[1].diagram[0],20,30);assert.deepEqual(moved.labelPosition,manual);assert.deepEqual(moved.vertices[0].labelPosition,manual);assert.equal(moved.vertices[0].x,120);
 const point=qwTranslateGraphObject(loaded.tasks[0].graph.points[0],2,3);assert.equal(point.x,3);assert.deepEqual(point.labelPosition,manual);
});
test('TASK149.5 malformed caption and print settings are rejected',()=>{
 for(const p of [null,{}, {mode:'other'}, {mode:'manual',dx:'3',dy:4},{mode:'manual',dx:Infinity,dy:4},{mode:'manual',dx:2000,dy:4}])assert.throws(()=>qwLabelPosition(p));
 for(const p of [null,{fontPt:5},{fontPt:'10'},{figurePosition:'diagonal'},{topicHeadings:'yes'}])assert.throws(()=>qwPrintSettings(p));
});
test('TASK149.5 optional print preferences preserve old defaults and roundtrip without changing questions',()=>{
 const d=qwProject();d.tasks=[qwTask()];d.tasks[0].prompt='Задание';assert.equal(qwValidate(d).printSettings,undefined);
 d.printSettings={fontPt:10.5,figurePosition:'below',topicHeadings:false};const before=JSON.stringify(d.tasks),loaded=qwValidate(JSON.parse(JSON.stringify(d)));assert.deepEqual(loaded.printSettings,d.printSettings);assert.equal(JSON.stringify(loaded.tasks),before);
 assert.deepEqual(qwPrintSettings(),{fontPt:10,figurePosition:'auto',topicHeadings:true});
});
