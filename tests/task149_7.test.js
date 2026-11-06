import test from 'node:test';
import assert from 'node:assert/strict';
import {qwObjectBounds,qwTranslateObject} from '../src/core/work-geometry.js';

test('TASK149.7 marquee bounds cover the visible ray and infinite line, not just their anchor',()=>{
 const line={kind:'infiniteLine',x:160,y:120,x2:260,y2:120,label:''};
 assert.deepEqual(qwObjectBounds(line),{x:4,y:120,x2:516,y2:120});
 assert.deepEqual(qwObjectBounds({...line,kind:'ray'}),{x:160,y:120,x2:516,y2:120});
 const moved=qwTranslateObject(line,10,20);
 assert.deepEqual(qwObjectBounds(moved),{x:4,y:140,x2:516,y2:140});
 assert.equal(moved.x,170);assert.equal(moved.x2,270);
 const rotated=qwObjectBounds({...line,rotation:90});
 for(const [key,value] of Object.entries({x:210,y:-86,x2:210,y2:426}))assert.ok(Math.abs(rotated[key]-value)<1e-9);
});
