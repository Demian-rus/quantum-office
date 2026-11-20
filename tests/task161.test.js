import test from 'node:test';
import assert from 'node:assert/strict';
import {qwTask,qwProject,qwValidate,qwValidateDiagram,qwResolveDiagram,
 qwDiagramPorts,qwNearestDiagramPort,QW_MECHANICS,QW_ELECTRICS} from '../src/core/work-model.js';
import {qwDiagramSVG} from '../src/core/work-content.js';
import {qwHitDiagram,qwTranslateObject} from '../src/core/work-geometry.js';

const object=(kind,x=80,y=65,x2=175,y2=128)=>({kind,x,y,x2,y2,label:'R₁'});
test('TASK161 all mechanics/electric tools are real QWORK v1 objects and printable SVG',()=>{
 for(const kind of [...QW_MECHANICS,...QW_ELECTRICS]){
  const o=object(kind);
  if(kind==='torque')o.direction='ccw';
  if(kind==='weightSet')o.count=3;
  if(kind==='dynamometer')o.reading=34;
  o.id='component'+kind;
  const parsed=qwValidateDiagram([o]);
  assert.equal(parsed[0].kind,kind);
  assert.equal(parsed[0].label,'R₁');
  assert.equal(qwValidateDiagram(parsed)[0].kind,kind);
  const svg=qwDiagramSVG(parsed,false);
  assert.ok(svg.startsWith('<svg'),kind);
  assert.ok(svg.includes('data-qw-label-owner'),kind);
  assert.ok(!svg.includes('NaN'),kind);
  assert.ok(svg.includes('stroke'),kind);
  const project=qwProject();project.tasks=[qwTask('diagram')];
  project.tasks[0].prompt='Проверьте компонент '+kind;
  project.tasks[0].diagram=parsed;project.tasks[0].figure='diagram';
  assert.deepEqual(qwValidate(JSON.parse(JSON.stringify(project))).tasks[0].diagram,parsed);
 }
});

test('TASK161 port connections survive component motion and rotation',()=>{
 const a={...object('battery',60,130,150,190),id:'power',label:'ε'},
  b={...object('lamp',290,130,380,190),id:'lamp',label:'L'},
  wire={kind:'wireOrth',id:'wire',x:150,y:160,x2:290,y2:160,label:'',
   links:{start:{id:'power',port:'R'},end:{id:'lamp',port:'L'}}};
 const original=qwValidateDiagram([a,b,wire]);
 const pa=qwDiagramPorts(original[0]).find(p=>p.port==='R'),
  pb=qwDiagramPorts(original[1]).find(p=>p.port==='L');
 assert.ok(Math.abs(original[2].x-pa.x)<1e-6);
 assert.ok(Math.abs(original[2].x2-pb.x)<1e-6);
 const moved=qwResolveDiagram([original[0],qwTranslateObject(original[1],-35,22),original[2]]);
 assert.ok(Math.abs(moved[2].x2-(pb.x-35))<1e-6);
 assert.ok(Math.abs(moved[2].y2-(pb.y+22))<1e-6);
 const rotated=qwResolveDiagram([{...moved[0],rotation:90},moved[1],moved[2]]);
 const newPort=qwDiagramPorts(rotated[0]).find(p=>p.port==='R');
 assert.ok(Math.abs(rotated[2].x-newPort.x)<1e-6);
 assert.ok(Math.abs(rotated[2].y-newPort.y)<1e-6);
 assert.equal(qwNearestDiagramPort(rotated,{x:newPort.x+2,y:newPort.y+2},10).id,'power');
 assert.ok(qwDiagramSVG(rotated).includes('wire'));
 assert.notEqual(rotated[2].x,original[2].x);
});

test('TASK161 dangling references, invalid parameter and duplicate ids fail closed',()=>{
 const base=object('resistor');base.id='r1';
 const wire={kind:'wireOrth',id:'w1',x:10,y:10,x2:120,y2:75,label:'',
  links:{end:{id:'r1',port:'R'}}};
 assert.equal(qwValidateDiagram([base,wire])[1].links.end.port,'R');
 for(const bad of [
  [{...base},{...wire,links:{end:{id:'missing',port:'R'}}}],
  [base,{...base}],
  [{...object('torque'),direction:'unknown'}],
  [{...object('weightSet'),count:9}],
  [{...object('dynamometer'),reading:-1}],
  [{...object('wireOrth'),links:{start:{id:'r1',port:'invalid'}}}],
 ]){
  assert.throws(()=>qwValidateDiagram(bad));
 }
});
test('TASK161 orthogonal wire hit and selectable composite figures',()=>{
 const list=qwValidateDiagram([
  {...object('resistor',40,80,140,130),id:'r1'},
  {kind:'wireOrth',x:140,y:105,x2:320,y2:230,label:''},
  {...object('dynamometer',335,70,410,260),id:'dynamo'}
 ]);
 assert.equal(qwHitDiagram(list,{x:230,y:105}),1);
 assert.equal(qwHitDiagram(list,{x:365,y:140}),2);
 const svg=qwDiagramSVG(list,false);
 assert.match(svg,/H230 V230 H320/);
 assert.ok(!svg.includes('data-qw-port="R"')||!svg.includes('vector-effect')); // print omits edit controls
});
