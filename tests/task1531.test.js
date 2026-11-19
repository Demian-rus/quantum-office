import test from 'node:test';
import assert from 'node:assert/strict';
import {qwProject,qwTask,qwValidate,qwSnapDiagramPoint} from '../src/core/work-model.js';
import {qwDiagramSVG} from '../src/core/work-content.js';

test('TASK153.1: legacy QWORK is stable and booklet remains opt-in',()=>{
 for(const layout of ['worksheet','compact','practice','exam','booklet']){
  const d=qwProject();d.layout=layout;const q=qwTask('short');q.prompt='Найдите скорость';d.tasks=[q];
  const before=JSON.stringify(d);assert.equal(qwValidate(JSON.parse(before)).layout,layout);
  assert.equal(JSON.stringify(d),before);
 }
});

test('TASK152.1: the block has no decorative internal stripe',()=>{
 const svg=qwDiagramSVG([{kind:'block',x:100,y:120,x2:210,y2:210,label:'m'}]);
 assert.match(svg,/<rect x="100" y="120"/);
 assert.doesNotMatch(svg,/#a1adba/);
});

test('TASK152.1: support hatch marks have equal length, spacing and no edge tails',()=>{
 const svg=qwDiagramSVG([{kind:'ground',x:100,y:190,x2:380,y2:190,label:''}]);
 const rx=/<line x1="([\d.]+)" y1="190" x2="([\d.]+)" y2="199" stroke="#687889"/g;
 const marks=[...svg.matchAll(rx)];
 assert.ok(marks.length>=15);
 assert.ok(marks.every(m=>Math.abs(Number(m[1])-Number(m[2])-6)<1e-8));
 assert.ok(marks.every((m,i)=>!i||Math.abs(Number(m[1])-Number(marks[i-1][1])-14)<1e-8));
 assert.ok(Number(marks[0][1])>100&&Number(marks.at(-1)[1])<380);
});

test('TASK152.1: rope and ground projection anchors preserve exact coordinates, not grid approximations',()=>{
 const ground={kind:'ground',x:70,y:200,x2:450,y2:200};
 const rope={kind:'rope',x:222,y:80,x2:222,y2:200};
 assert.deepEqual(qwSnapDiagramPoint({x:223,y:201},[ground],20),{x:223,y:200});
 assert.deepEqual(qwSnapDiagramPoint({x:221,y:145},[rope],20),{x:222,y:145});
 const pulley={kind:'movablePulley',x:180,y:140,x2:260,y2:220};
 const snap=qwSnapDiagramPoint({x:181,y:107},[pulley],20);
 assert.deepEqual(snap,{x:180,y:108},'rope joins native tangent at exact top coordinate');
});
