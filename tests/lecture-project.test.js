import test from 'node:test';import assert from 'node:assert/strict';
import {ql2Validate,ql2Parse,ql2Serialize,ql2Timeline,ql2Svg,ql2Visual} from '../src/core/lecture-project.js';
import {QL_RADIATION} from '../src/core/lecture-radiation.js';
import {QL2_RADIATION} from '../src/core/lecture-radiation-visuals.js';
test('v1 import preserves original content, v2 has 13 scenes and real diagrams',()=>{
 const old=ql2Validate(QL_RADIATION);assert.equal(old.scenes[0].narration,QL_RADIATION.scenes[0].narration);assert.equal(old.scenes[0].visuals.length,0);
 const v=ql2Parse(ql2Serialize(QL2_RADIATION));assert.deepEqual(v,QL2_RADIATION);assert.equal(v.scenes.length,13);assert.ok(v.scenes.every(s=>s.visuals.length));
});
test('mode switch retains everything; timeline derived from durations',()=>{
 const v=structuredClone(QL2_RADIATION);v.mode='lecture';assert.deepEqual(ql2Validate(v).scenes,QL2_RADIATION.scenes);
 assert.deepEqual(ql2Timeline(v).slice(0,2),[{id:'intro',start:0,end:50},{id:'terms',start:50,end:120}]);
 v.scenes[0].durationSec=60;assert.equal(ql2Timeline(v)[1].start,60);
});
test('render graph accurately and escape labels and diagram text',()=>{
 const g=structuredClone(QL2_RADIATION.scenes.find(s=>s.id==='decay').visuals[0]);g.xLabel='<script>';
 const svg=ql2Svg(g,1/6);assert.match(svg,/50\.00%/);assert.match(svg,/&lt;script&gt;/);assert.doesNotMatch(svg,/<script>/);
 const d=structuredClone(QL2_RADIATION.scenes[0].visuals[0]);d.shapes.find(s=>s.kind==='text').text='<img onerror="x">';assert.doesNotMatch(ql2Svg(d),/<img/);
});
test('invalid geometry, duplicate shapes and invalid progress rejected',()=>{
 const d=structuredClone(QL2_RADIATION.scenes[0].visuals[0]);d.shapes.push(d.shapes[0]);assert.throws(()=>ql2Visual(d));
 d.shapes.pop();d.shapes[0].x=Infinity;assert.throws(()=>ql2Visual(d));
 const g=structuredClone(QL2_RADIATION.scenes.find(s=>s.id==='decay').visuals[0]);g.progress=2;assert.throws(()=>ql2Visual(g));
});
