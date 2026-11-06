import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {qwProject,qwTask,qwValidate,qwValidateGraph,qwSnapGraphPoint,qwGraphGridStep} from '../src/core/work-model.js';

test('TASK145 new published works have no mandatory identity fields',()=>{
 const d=qwProject();
 assert.equal(d.identity,false);
 assert.equal(d.subject,'physics');
});

test('TASK145 classification metadata persists through QWORK validation',()=>{
 const d=qwProject(),q=qwTask('graph');
 Object.assign(q,{grade:'9',exam:'oge',topic:'Механика',subtopic:'Кинематика',origin:'original'});
 d.tasks=[q];
 const loaded=qwValidate(JSON.parse(JSON.stringify(d)));
 assert.equal(loaded.tasks[0].grade,'9');
 assert.equal(loaded.tasks[0].exam,'oge');
 assert.equal(loaded.tasks[0].topic,'Механика');
 assert.equal(loaded.tasks[0].subtopic,'Кинематика');
 assert.equal(loaded.tasks[0].origin,'original');
 assert.deepEqual(loaded,d);
});

test('TASK145 TASK144 projects without new metadata migrate safely',()=>{
 const d=qwProject(),q=qwTask('graph');d.tasks=[q];
 for(const key of ['grade','exam','topic','subtopic','origin'])delete q[key];
 delete q.graph.snapToGrid;delete q.graph.curveFamily;
 const loaded=qwValidate(d);
 assert.equal(loaded.tasks[0].exam,'general');
 assert.equal(loaded.tasks[0].origin,'original');
 assert.equal(loaded.tasks[0].graph.snapToGrid,true);
 assert.equal(loaded.tasks[0].graph.curveFamily,'points');
});

test('TASK145 graph points snap to visible coordinate grid intersections',()=>{
 const g=qwTask('graph').graph;
 assert.equal(qwGraphGridStep(g,'x'),1);
 assert.deepEqual(qwSnapGraphPoint(g,3.26,7.6),{x:3,y:8});
 g.snapToGrid=false;
 assert.deepEqual(qwSnapGraphPoint(g,3.26,7.6),{x:3.26,y:7.6});
});

test('TASK145 non-unit and negative-axis scales use the rendered grid step',()=>{
 const g=qwTask('graph').graph;
 Object.assign(g,{xmin:-5,xmax:5,ymin:-5,ymax:5,step:2,snapToGrid:true});
 assert.deepEqual(qwSnapGraphPoint(g,-3.2,3.3),{x:-4,y:4});
 Object.assign(g,{xmin:0,xmax:100,step:1});
 assert.equal(qwGraphGridStep(g,'x'),5);
 assert.equal(qwSnapGraphPoint(g,12.1,3.1).x,10);
 assert.equal(qwValidateGraph(g).snapToGrid,true);
});

test('TASK145 unknown task classification is sanitized',()=>{
 const d=qwProject(),q=qwTask();Object.assign(q,{exam:'xyz',origin:'unknown'});
 d.tasks=[q];const loaded=qwValidate(d);
 assert.equal(loaded.tasks[0].exam,'general');
 assert.equal(loaded.tasks[0].origin,'original');
});

test('TASK145 online PDF is selectable HTML and SVG, without identity prompt',()=>{
 const builder=readFileSync(new URL('../src/core/work-builder.js',import.meta.url),'utf8');
 const printer=readFileSync(new URL('../src/core/work-print.js',import.meta.url),'utf8');
 const layout=readFileSync(new URL('../src/core/work-layout.js',import.meta.url),'utf8');
 assert.match(builder,/function qwPrintTextPDF/);
 assert.match(layout,/@page\{size:A4/);
 assert.match(builder,/win\.focus\(\);win\.print\(\)/);
 assert.match(builder,/function qwPrintDocumentHTML/);
 assert.match(builder,/qwTaskPreview\(q,i,format,true,d\.printSettings\)/);
 assert.doesNotMatch(printer,/if\(d\.identity\)\{text\('ФИО/);
});
