import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {qwProject,qwTask,qwValidate} from '../src/core/work-model.js';

test('TASK153: booklet is a QWORK v1 layout and roundtrips without changing tasks',()=>{
 const doc=qwProject();doc.layout='booklet';doc.title='Сборник';doc.variant='2';
 const short=qwTask('short');short.prompt='Найдите скорость';short.answerVisible=true;short.part='Часть 1';
 const extended=qwTask('extended');extended.prompt='Докажите утверждение';extended.answerVisible=false;
 doc.tasks=[short,extended];const source=JSON.stringify(doc);
 const normalized=qwValidate(JSON.parse(source));
 assert.equal(normalized.version,1);assert.equal(normalized.layout,'booklet');
 assert.deepEqual(normalized.tasks,doc.tasks);assert.equal(JSON.stringify(doc),source);
 assert.equal(qwValidate(JSON.parse(JSON.stringify(normalized))).layout,'booklet');
});

test('TASK153: old QWORK print formats preserve their original semantics',()=>{
 for(const layout of ['worksheet','compact','practice','exam']){
  const doc=qwProject();doc.layout=layout;doc.tasks=[qwTask('short')];doc.tasks[0].prompt='Сохраните старый макет';
  assert.equal(qwValidate(doc).layout,layout,layout);
 }
 const doc=qwProject();doc.layout='unknown';assert.equal(qwValidate(doc).layout,'worksheet');
});

test('TASK153: booklet uses the vector-print path, never the canvas/JPEG PDF path',()=>{
 const builder=readFileSync(new URL('../src/core/work-builder.js',import.meta.url),'utf8');
 const layout=readFileSync(new URL('../src/core/work-layout.js',import.meta.url),'utf8');
 assert.match(builder,/if\(teacher\|\|\['compact','practice','booklet'\]\.includes\(qwDoc\.layout\)\)\{qwPrintTextPDF/);
 assert.match(builder,/\['worksheet','exam','compact','practice','answers','booklet'\]/);
 assert.match(builder,/format==='booklet'&&d\.variant/);
 assert.match(layout,/body\[data-qw-format="booklet"\] \.qw-booklet-entry>header/);
 assert.match(layout,/modern=\['compact','practice','answers','booklet'\]\.includes\(format\)/);
});
