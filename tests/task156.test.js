import test from 'node:test';
import assert from 'node:assert/strict';
import {qwProject,qwTask,qwPrintSettings,qwValidate} from '../src/core/work-model.js';
import {qwPrintStyles} from '../src/core/work-layout.js';

test('TASK156: landscape spread and wide are optional, strict QWORK v1 attributes',()=>{
 const old=qwPrintSettings({fontPt:10,figurePosition:'auto',topicHeadings:true,orientation:'landscape'});
 assert.equal(old.landscapeLayout,undefined);
 for(const mode of ['spread','wide']){
  const p=qwProject();p.layout='booklet';p.tasks=[qwTask('short')];p.tasks[0].prompt='Авторская задача';
  p.printSettings={fontPt:10,figurePosition:'auto',topicHeadings:true,orientation:'landscape',landscapeLayout:mode};
  assert.deepEqual(qwValidate(JSON.parse(JSON.stringify(p))).printSettings,p.printSettings);
  assert.match(qwPrintStyles('landscape',mode),/@page\{size:A4 landscape;margin:0\}/);
 }
 assert.match(qwPrintStyles('portrait','spread'),/@page\{size:A4 portrait;margin:0\}/);
 for(const bad of ['2columns','book','invalid',null,{},0])assert.throws(()=>qwPrintSettings({landscapeLayout:bad}));
});
test('TASK156: logical two-up A4 is independent of print unit scale and remains vector',()=>{
 const css=qwPrintStyles('landscape','spread');
 assert.match(css,/width:297mm;height:210mm/);
 assert.match(css,/width:148\.5mm;height:210mm/);
 assert.match(css,/width:130\.5mm;height:183mm/);
 assert.match(css,/\.qw-print-sheet/);
 assert.doesNotMatch(css,/raster/i);
});
