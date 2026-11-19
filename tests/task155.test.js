import test from 'node:test';
import assert from 'node:assert/strict';
import {qwPrintSettings,qwProject,qwTask,qwValidate} from '../src/core/work-model.js';

test('TASK155: portrait and landscape A4 are first-class QWORK v1 print settings',()=>{
 const legacy=qwPrintSettings({fontPt:10,figurePosition:'auto',topicHeadings:false});
 assert.equal(legacy.orientation,undefined,'old QWORK must not be rewritten');
 for(const orientation of ['portrait','landscape']){
  const doc=qwProject();doc.layout='booklet';doc.tasks=[qwTask('short')];doc.tasks[0].prompt='Найдите значение';
  doc.printSettings={fontPt:10,figurePosition:'auto',topicHeadings:false,orientation};
  const saved=JSON.parse(JSON.stringify(doc)),loaded=qwValidate(saved);
  assert.equal(loaded.printSettings.orientation,orientation);
  assert.equal(qwValidate(loaded).printSettings.orientation,orientation);
 }
 for(const invalid of ['sideways','landspace','horizontal',0,{},null])
  assert.throws(()=>qwPrintSettings({orientation:invalid}),String(invalid));
});
