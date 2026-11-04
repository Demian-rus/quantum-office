import test from 'node:test';
import assert from 'node:assert/strict';
import {qwValidateDiagram} from '../src/core/work-model.js';
import {qwDiagramSVG} from '../src/core/work-content.js';

test('TASK147 right-angle marker exports valid SVG attributes for PDF image decoding',()=>{
 const diagram=qwValidateDiagram([{kind:'rightTriangle',x:100,y:60,x2:340,y2:260,label:''}]);
 for(const interactive of [false,true]){
  const svg=qwDiagramSVG(diagram,interactive);
  assert.doesNotMatch(svg,/\[object Object\]/);
  assert.match(svg,/<path d="M112 260L112 248L100 248" stroke="#162735" stroke-width="2" fill="none"\/>/);
 }
});
