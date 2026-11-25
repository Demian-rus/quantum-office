import test from 'node:test';
import assert from 'node:assert/strict';
import {qwProject,qwTask,qwValidate,qwPublishSettings} from '../src/core/work-model.js';
import {qwGraphSVG} from '../src/core/work-content.js';

test('publishing settings and catalogue metadata round trip without altering legacy condition headings',()=>{
 const legacy={...qwTask('graph'),prompt:'# Заголовок условия\nВычислите скорость.'};
 const doc=qwProject();doc.tasks=[legacy];
 const before=qwValidate(doc);assert.equal(before.tasks[0].publishing,undefined);
 const raw={...legacy,title:'Служебное название',tags:['график','график'],publishing:{
  figure:{width:47,maxMm:65,position:'below'},tables:{prompt:[null,{width:48,columns:[30,70]}],comment:[null]},
 }};
 doc.tasks=[raw];const normalized=qwValidate(doc);
 assert.deepEqual(qwValidate(JSON.parse(JSON.stringify(normalized))),normalized);
 assert.equal(normalized.tasks[0].prompt,legacy.prompt);
 assert.deepEqual(normalized.tasks[0].tags,['график']);
 assert.equal(normalized.tasks[0].publishing.tables.prompt[1].width,48);
 assert.equal(normalized.tasks[0].publishing.tables.comment,undefined);
});

test('malformed publishing fields fail validation before saving',()=>{
 for(const style of [null,[],{figure:{width:0}},{figure:{maxMm:'100'}},{figure:{position:'float'}},
  {tables:{prompt:[{columns:[0,99]}]}},{tables:{answer:[{align:'<script>'}]}},{tables:{comment:Array(41).fill(null)}}])
  assert.throws(()=>qwPublishSettings(style),/Некоррект|Не более/);
});

test('published graph labels localize fractions and negative values without changing tick coordinates',()=>{
 const {graph}=qwTask('graph');Object.assign(graph,{xmin:-1.5,xmax:2.5,ymin:.25,ymax:1.5,step:.5});
 const chart=qwGraphSVG(graph,false,{publishing:true});
 assert.match(chart,/data-value="-1\.5"[^>]*>−1,5<\/text>/);
 assert.match(chart,/data-value="1\.5"[^>]*>1,5<\/text>/);
 assert.match(chart,/data-qw-axis-head="x"/);
 assert.match(chart,/data-qw-axis-head="y"/);
});
