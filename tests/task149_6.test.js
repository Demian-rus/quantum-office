import test from 'node:test';
import assert from 'node:assert/strict';
import {qwProject,qwTask,qwQuickTask,qwValidate,qwValidateDiagram,qwResolveDiagram,qwReorder,qwCoordinatePreset} from '../src/core/work-model.js';
import {qwExtendedSegment,qwHitObject,qwTranslateObject} from '../src/core/work-geometry.js';
import {qwRotatePoint,qwObjectCenter,qwInclineAngle,qwSegmentDistance} from '../src/core/work-geometry.js';
import {task149ImprovedSamples} from './fixtures/task149_6_samples.js';
test('TASK149.6 mixed practice source has exact 30 degree mechanics and the block rests on the plane',()=>{
 const doc=task149ImprovedSamples()[1].project;assert.equal(doc.tasks.length,3);assert.equal(doc.practice.perPage,1);
 const [plane,block,gravity]=doc.tasks[2].diagram;assert.ok(Math.abs(qwInclineAngle(plane)+30)<1e-9);
 const c=qwObjectCenter(block),contact=qwRotatePoint({x:c.x,y:c.y+20},c,block.rotation);
 assert.ok(qwSegmentDistance(contact,{x:plane.x,y:plane.y2},{x:plane.x2,y:plane.y})<1e-8);assert.ok(Math.abs(gravity.x-c.x)<1e-9&&Math.abs(gravity.y-c.y)<1e-9);
});
for(const count of [2,10,50,80])test('TASK149.6 reorder '+count+' tasks keeps stable identities, content and answers',()=>{
 const d=qwProject();d.tasks=Array.from({length:count},(_,i)=>({...qwTask(),prompt:'Q'+i,answer:'A'+i,points:i,part:i<count/2?'A':'B'}));const source=structuredClone(d),last=d.tasks.at(-1);
 assert.ok(qwReorder(d,last.id,0,'A'));assert.equal(d.tasks[0].id,last.id);assert.equal(d.tasks[0].part,'A');
 for(const q of d.tasks){const before=source.tasks.find(t=>t.id===q.id);assert.deepEqual({...q,part:before.part},before);}
 assert.equal(new Set(d.tasks.map(q=>q.id)).size,count);assert.deepEqual(qwValidate(JSON.parse(JSON.stringify(d))).tasks,d.tasks);
 assert.equal(qwReorder(d,last.id,-1),false);assert.equal(qwReorder(d,'missing',0),false);
});
test('TASK149.6 quick presets map to actual types and choice options roundtrip',()=>{
 assert.equal(qwQuickTask('text').type,'short');assert.equal(qwQuickTask('text').answerVisible,false);assert.equal(qwQuickTask('graph').figure,'graph');assert.equal(qwQuickTask('diagram').figure,'diagram');
 const d=qwProject();d.subject='mixed';d.tasks=[qwQuickTask('test')];assert.equal(d.tasks[0].type,'choice');assert.deepEqual(qwValidate(d),d);
 for(const choices of [[],['one'],['one',''],[5,'two'],Array(13).fill('x')])assert.throws(()=>qwValidate({...d,tasks:[{...d.tasks[0],choices}]}));
});
test('TASK149.6 new presets use equal ten-unit spans while saved ranges remain exact',()=>{
 for(const mode of ['first','positiveX','math']){const p=qwCoordinatePreset(mode);assert.equal(p.xmax-p.xmin,10);assert.equal(p.ymax-p.ymin,10);}
 const d=qwProject();d.tasks=[qwTask('graph')];Object.assign(d.tasks[0].graph,{xmin:-10,xmax:10,ymin:-10,ymax:10,coordinateMode:'math'});assert.deepEqual(qwValidate(d).tasks[0].graph,d.tasks[0].graph);
});
test('TASK149.6 extended lines and rays use real clipped geometry for hit testing',()=>{
 const line={kind:'infiniteLine',x:100,y:100,x2:200,y2:200,label:''},ray={...line,kind:'ray'};
 assert.deepEqual(qwExtendedSegment(line),[{x:4,y:4},{x:316,y:316}]);assert.deepEqual(qwExtendedSegment(ray),[{x:100,y:100},{x:316,y:316}]);
 assert.ok(qwHitObject(line,{x:50,y:50}));assert.equal(qwHitObject(ray,{x:50,y:50}),false);assert.equal(qwHitObject(line,{x:50,y:90}),false);
});
test('TASK149.6 linked parallel/perpendicular constructions stay exact after edits, rotation and QWORK',()=>{
 const raw=[{kind:'line',id:'base',x:100,y:100,x2:300,y2:150,label:'',ticks:3},{kind:'infiniteLine',id:'p',x:80,y:200,x2:81,y2:201,label:'',construction:{kind:'parallel',reference:'base'}},{kind:'infiniteLine',x:200,y:200,x2:201,y2:201,label:'',construction:{kind:'perpendicular',reference:'p'}}];
 function exact(a){const u={x:a[1].x2-a[1].x,y:a[1].y2-a[1].y},v={x:a[2].x2-a[2].x,y:a[2].y2-a[2].y};assert.ok(Math.abs(u.x*v.x+u.y*v.y)<1e-8);}
 const loaded=qwValidateDiagram(raw);exact(loaded);const moved=loaded.map(o=>qwTranslateObject(o,5,10));moved[0].x2=240;moved[0].rotation=27;exact(qwResolveDiagram(moved));
 assert.deepEqual(qwValidateDiagram(JSON.parse(JSON.stringify(loaded))),loaded);assert.equal(loaded[0].ticks,3);assert.equal(loaded[1].construction.reference,'base');
 const snapshot=structuredClone(raw);for(const change of [a=>a[1].construction.reference='missing',a=>a[1].construction.reference='p',a=>a[0].id='p',a=>a[0].ticks=4]){const a=structuredClone(raw);change(a);assert.throws(()=>qwValidateDiagram(a));}assert.deepEqual(raw,snapshot);
});
