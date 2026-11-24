import {readdirSync,readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {qwProject,qwTask,qwValidate,qwSetFigureWidth} from '../src/core/work-model.js';
test('legacy figures retain automatic sizing and requested ceiling',()=>{const d=qwProject(),q=qwTask('graph');q.figureWidth=310;d.tasks=[q];const loaded=qwValidate(d).tasks[0];assert.equal(loaded.figureWidth,310);assert.equal(loaded.figureWidthMode,undefined);});
test('manual width is independent, serializable and does not modify geometry',()=>{const d=qwProject(),a=qwTask('graph'),b=qwTask('diagram');d.tasks=[a,b];const before=structuredClone(d);assert.equal(qwSetFigureWidth(a,'manual',321.5),true);assert.deepEqual(a.graph,before.tasks[0].graph);assert.deepEqual(b,before.tasks[1]);const reopened=qwValidate(JSON.parse(JSON.stringify(d)));assert.equal(reopened.tasks[0].figureWidth,321.5);assert.equal(reopened.tasks[0].figureWidthMode,'manual');assert.equal(reopened.tasks[1].figureWidthMode,undefined);assert.equal(qwSetFigureWidth(reopened.tasks[0],'auto'),true);assert.equal(reopened.tasks[0].figureWidthMode,undefined);assert.equal(reopened.tasks[0].figureWidth,220);});
test('invalid manual widths leave the model unchanged, finite out-of-range values are bounded',()=>{const q=qwTask('graph'),before=structuredClone(q);for(const v of ['',null,NaN,Infinity,-2,0]){assert.equal(qwSetFigureWidth(q,'manual',v),false);assert.deepEqual(q,before);}assert.ok(qwSetFigureWidth(q,'manual',1));assert.equal(q.figureWidth,120);assert.ok(qwSetFigureWidth(q,'manual',999));assert.equal(q.figureWidth,470);});

test('historical tests have no obsolete PDF layout card/radio selectors',()=>{
 const root=new URL('./',import.meta.url),offenders=[];
 for(const entry of readdirSync(root,{withFileTypes:true})){
  if(!entry.isFile()||entry.name==='task1672.test.js'||!/\.(?:js|cjs|py)$/.test(entry.name))continue;
  const src=readFileSync(new URL(entry.name,root),'utf8');
  for(const [i,line] of src.split('\n').entries()){
   if(/\.qw-layout-card\b|qwLayoutCards\b|qw-pdf-layout[^;\n]{0,100}(?:\]:checked|\]\[value=|\.isChecked\()/.test(line))offenders.push(entry.name+':'+(i+1));
  }
 }
 assert.deepEqual(offenders,[]);
});
