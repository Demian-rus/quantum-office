import test from 'node:test';
import assert from 'node:assert/strict';
import {qwMath,qwMathML,qwGraphSVG} from '../src/core/work-content.js';
import {qwValidate} from '../src/core/work-model.js';
import {task149CompactSamples} from './fixtures/task149_3_samples.js';
import {task149Sample} from './fixtures/task149_2_sample.js';

test('TASK149.3 degree notation is an ordinary degree glyph, not a raised superscript',()=>{
 for(const source of ['30°','30^{°}','30^\\circ']){
  const html=qwMathML(qwMath(source));assert.match(html,/°/);assert.doesNotMatch(html,/msup/);
 }
 assert.match(qwMathML(qwMath('x^{2}')),/msup/);
});
test('TASK149.3 explicit upright units keep structured powers, roots and subscripts',()=>{
 const html=qwMathML(qwMath('g=10\\mathrm{м/с^{2}}'));
 assert.match(html,/mathvariant="normal"/);assert.match(html,/<msup>/);
 const expressions=['F=mg','x^{2}-4x+3','a_{1}','F_{1}','\\frac{3}{4}','\\sqrt{x}'];
 for(const text of expressions)assert.doesNotMatch(qwMathML(qwMath(text)),/undefined|NaN/);
 assert.match(qwMathML(qwMath('x^{2}-4x+3')),/−/);
});
test('TASK149.3 decimal commas, brackets and unary signs have no binary-operator gaps',()=>{
 for(const source of ['0{,}25','(-3)^{2}']){
  const html=qwMathML(qwMath(source));assert.doesNotMatch(html,/0\.28em/);
 }
 assert.match(qwMathML(qwMath('0{,}25')),/<mo lspace="0" rspace="0">,<\/mo>/);
 assert.match(qwMathML(qwMath('x-3')),/<mo lspace="0\.28em" rspace="0\.28em">−<\/mo>/);
});
test('TASK149.3 printed graph typography is opt-in and never changes editor geometry',()=>{
 const g=task149Sample().tasks[2].graph,before=structuredClone(g);
 const editor=qwGraphSVG(g),printed=qwGraphSVG(g,false,{axisFont:22,titleFont:24});
 assert.notEqual(editor,printed);assert.equal(qwGraphSVG(g),editor);assert.deepEqual(g,before);
 assert.match(printed,/font-size="22"/);assert.match(editor,/font-size="12"/);
 const bounds=qwGraphSVG({...g,xmin:-10,xmax:10,ymin:-10,ymax:10},false,{axisFont:22,titleFont:24});
 assert.equal((bounds.match(/data-value="-10"/g)||[]).length,2);assert.equal((bounds.match(/data-value="10"/g)||[]).length,2);
});
test('TASK149.3 three distinct teaching sources preserve QWORK v1 and original manual layout',()=>{
 const old=task149Sample(),samples=task149CompactSamples();
 assert.deepEqual(samples.map(s=>s.project.tasks.length),[4,5,14]);
 for(const s of samples)assert.deepEqual(qwValidate(JSON.parse(JSON.stringify(s.project))),s.project);
 assert.equal(old.tasks[2].pageBreak,true);assert.ok(old.tasks.every(q=>q.position==='below'));
 assert.ok(samples[0].project.tasks.every(q=>q.position==='right'));
 assert.ok(samples[0].project.tasks.every(q=>q.points>0),'scores stay in the model');
});
