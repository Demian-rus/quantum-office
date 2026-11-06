import test from 'node:test';
import assert from 'node:assert/strict';
import {qwHitDiagram,qwHitObject,qwValidDrag,qwRotatePoint} from '../src/core/work-geometry.js';

test('TASK148 A: accurate hit testing respects triangle voids, lines, rotation and stacking',()=>{
 const incline={kind:'incline',x:50,y:50,x2:450,y2:280},block={kind:'block',x:180,y:100,x2:260,y2:150,rotation:-30};
 assert.equal(qwHitObject(incline,{x:90,y:70}),false);
 assert.equal(qwHitDiagram([incline,block],{x:220,y:125}),1);
 assert.equal(qwHitObject(block,qwRotatePoint({x:190,y:105},{x:220,y:125},-30)),true);
 assert.equal(qwHitObject(block,{x:180,y:100},1),false);
 const line={kind:'line',x:30,y:30,x2:200,y2:200};
 assert.equal(qwHitObject(line,{x:35,y:190}),false);
 assert.equal(qwHitDiagram([line,{kind:'rect',x:20,y:20,x2:210,y2:210}],{x:100,y:100}),0,'an empty foreground interior cannot intercept a visible line');
 assert.equal(qwHitDiagram([line,{...line,kind:'rope'}],{x:100,y:100}),1);
 assert.equal(qwHitObject({kind:'circle',x:100,y:100,x2:200,y2:200},{x:150,y:150}),false);
});
test('TASK148 A: screen threshold and degenerate geometry do not create objects',()=>{
 for(const kind of ['line','arrow','rope','dashed','spring','rect','circle','block','triangle']){
  assert.equal(qwValidDrag({kind,x:10,y:10,x2:10,y2:10},20),false);
  assert.equal(qwValidDrag({kind,x:10,y:10,x2:50,y2:50},3),false);
  assert.equal(qwValidDrag({kind,x:10,y:10,x2:50,y2:50},5),true);
 }
});

import {qwValidateStyle,qwValidate,qwProject,qwTask,qwValidateDiagram} from '../src/core/work-model.js';
import {qwDiagramSVG} from '../src/core/work-content.js';
test('TASK148 B: styles and rotation persist in QWORK v1; SVG paints arrow heads individually',()=>{
 const d=qwProject(),q=qwTask('diagram');d.tasks=[q];
 q.diagram=qwValidateDiagram([{kind:'arrow',x:10,y:10,x2:200,y2:100,label:'F₁',rotation:-30,style:{stroke:'#DC2626',text:'#2563eb',width:4}}]);
 const restored=qwValidate(JSON.parse(JSON.stringify(d)));
 assert.deepEqual(restored.tasks[0].diagram,q.diagram);
 const svg=qwDiagramSVG(q.diagram);
 assert.match(svg,/stroke="#dc2626"/);assert.match(svg,/fill="#2563eb"/);assert.match(svg,/rotate\(-30/);
 assert.match(svg,/<marker[^>]+id="qw-arrow-[a-z0-9]+-0"[^>]*><path[^>]+stroke="#dc2626"/);
 assert.doesNotMatch(svg,/data-qw-(?:editor|vertex|marquee)/);
 for(const raw of [{stroke:'url(https://bad)'},{fill:'red" onload="evil'},{text:'#fff'},{width:NaN},{width:99}])assert.throws(()=>qwValidateStyle(raw));
});

test('TASK148 C: fixed and movable pulleys have distinct mechanics and old pulley remains valid',()=>{
 const fixed=qwValidateDiagram([{kind:'pulley',x:100,y:80,x2:180,y2:160,label:''}]);
 const moving=qwValidateDiagram([{...fixed[0],kind:'movablePulley'},{kind:'rope',x:100,y:40,x2:100,y2:120,label:''}]);
 const f=qwDiagramSVG(fixed),m=qwDiagramSVG(moving);
 assert.match(f,/<line x1="140" y1="120" x2="140" y2="66"/);
 assert.match(m,/V174q0 8 7 4/);assert.doesNotMatch(m,/y2="66"/);
 assert.equal(moving[1].kind,'rope');assert.deepEqual(qwValidateDiagram(JSON.parse(JSON.stringify(moving))),moving);
});

import {qwValidateGraph,qwCoordinatePreset,qwPlotXY,qwSnapDiagramPoint} from '../src/core/work-model.js';
import {qwHitGraph,qwTranslateGraphObject} from '../src/core/work-geometry.js';
import {qwGraphSVG} from '../src/core/work-content.js';
test('TASK148 D: independent graph primitives preserve math coordinates, colors and old points',()=>{
 const d=qwProject(),q=qwTask('graph');d.tasks=[q];Object.assign(q.graph,{xmin:-10,xmax:10,ymin:-10,ymax:10,coordinateMode:'math'});
 q.graph.points=[{x:2,y:-3,label:'P',style:{stroke:'#dc2626'}}];
 q.graph.elements=[{kind:'line',x:-8,y:-5,x2:-2,y2:0,label:'s₁',style:{stroke:'#dc2626',width:3}},{kind:'line',x:2,y:0,x2:8,y2:5,label:'s₂',style:{stroke:'#16a34a'}},{kind:'arrow',x:-5,y:8,x2:-2,y2:3,label:'F',style:{stroke:'#2563eb'}},{kind:'polyline',vertices:[{x:-5,y:-8},{x:0,y:-5},{x:5,y:-8}],label:''},{kind:'text',x:3,y:8,label:'<script>&'},{kind:'function',family:'quadratic',curve:{a:.1,b:0,c:0},style:{stroke:'#9333ea'}}];
 const restored=qwValidate(JSON.parse(JSON.stringify(d))),g=restored.tasks[0].graph;
 assert.equal(restored.version,1);assert.equal(g.elements.length,6);assert.equal(g.points[0].x,2);
 assert.equal(qwHitGraph(g,qwPlotXY(g,{x:-5,y:-2.5})),1,'first independent segment');
 assert.equal(qwHitGraph(g,qwPlotXY(g,{x:8,y:5})),2,'second independent segment');
 assert.deepEqual(qwTranslateGraphObject(g.elements[0],1,2),{...g.elements[0],x:-7,y:-3,x2:-1,y2:2});
 const svg=qwGraphSVG(g);assert.match(svg,/#dc2626/);assert.match(svg,/#16a34a/);assert.match(svg,/#2563eb/);assert.match(svg,/&lt;script&gt;&amp;/);assert.doesNotMatch(svg,/data-qw-(?:point|element|vertex)/);
 assert.equal((svg.match(/<g  clip-path/g)||[]).length,6);
 const narrowed=qwValidateGraph({...g,xmin:0,xmax:5,ymin:-10,ymax:10});assert.deepEqual(narrowed.elements,g.elements,'out-of-range primitives are retained for the UI warning');
});
test('TASK148 D: corrupt primitive imports reject without mutating their source',()=>{
 const base=qwTask('graph').graph;
 for(const bad of [{kind:'line',x:1,y:1,x2:1,y2:1},{kind:'polyline',vertices:[{x:1,y:1}]},{kind:'point',x:Infinity,y:0},{kind:'function',family:'eval',curve:{}},{kind:'text',x:0,y:0,style:{text:'url(#evil)'}}]){
  const source={...base,elements:[bad]},snapshot=structuredClone(source);assert.throws(()=>qwValidateGraph(source));assert.deepEqual(source,snapshot);
 }
 const legacy={...base};delete legacy.elements;assert.deepEqual(qwValidateGraph(legacy).elements,[]);
});
test('TASK148 C: rope anchors follow the pulley and rotated block geometry',()=>{
 const pulley={kind:'movablePulley',x:224,y:154,x2:296,y2:226};
 assert.deepEqual(qwSnapDiagramPoint({x:225,y:122},[pulley],20),{x:224,y:122});
 const block={kind:'block',x:100,y:100,x2:180,y2:140,rotation:-30};
 const anchor=qwRotatePoint({x:100,y:100},{x:140,y:120},-30);
 const snapped=qwSnapDiagramPoint(anchor,[block],20);assert.ok(Math.hypot(snapped.x-anchor.x,snapped.y-anchor.y)<1e-6);
});
