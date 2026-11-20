import test from 'node:test';
import assert from 'node:assert/strict';
import {qwProject,qwTask,qwValidate,qwPrintSettings} from '../src/core/work-model.js';

test('TASK154 old QWORK print settings preserve v1 and exact old normalization',()=>{
 const p=qwProject();p.tasks=[qwTask('short')];p.tasks[0].prompt='Найдите значение';
 p.printSettings={fontPt:10.5,figurePosition:'auto',topicHeadings:true};
 const validated=qwValidate(p);
 assert.equal(validated.version,1);
 assert.deepEqual(validated.printSettings,p.printSettings);
 assert.equal(validated.layout,'worksheet');
});
test('TASK154 optional heading and typesetting controls roundtrip',()=>{
 const p=qwProject();p.tasks=[qwTask('short')];p.tasks[0].prompt='Найдите значение';
 p.printSettings={fontPt:10.5,figurePosition:'auto',topicHeadings:false,
  showTitle:true,titleText:'Аналоги ЕГЭ 2018',titleFont:'serif',titlePt:19,titleColor:'#123456',
  titleAlign:'right',bodyFont:'sans',bodyColor:'#222222',showMeta:false,showVariant:false,
  showPageNumbers:true,theme:'academic',monochrome:true};
 const v=qwValidate(JSON.parse(JSON.stringify(p)));
 assert.deepEqual(v.printSettings,p.printSettings);
 assert.equal(qwValidate(v).printSettings.titleText,'Аналоги ЕГЭ 2018');
 assert.equal(qwPrintSettings({}).fontPt,10);
});
test('TASK154 rejects invalid styling values, without executing user CSS or markup',()=>{
 for(const changes of [
  {titleText:'x'.repeat(161)},{titleFont:'url(https://example.com)'},{titleColor:'red'},
  {bodyColor:'#abc'},{bodyFont:'Comic Sans'},{titleAlign:'stretch'},
  {titlePt:99},{showTitle:'true'},{theme:'bad'},{monochrome:'yes'}
 ])assert.throws(()=>qwPrintSettings(changes));
});
