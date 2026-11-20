import test from 'node:test';
import assert from 'node:assert/strict';
import {qwProject,qwTask,qwValidate,qwValidateDiagram,qwResolveDiagram,qwRegularPolygonVertices} from '../src/core/work-model.js';
import {qwHitObject,qwObjectBounds,qwTranslateObject} from '../src/core/work-geometry.js';
import {qwDiagramSVG} from '../src/core/work-content.js';

const line={kind:'line',id:'AB',x:100,y:100,x2:300,y2:100,label:'AB',style:{stroke:'#dc2626',width:3}};
const midpoint={kind:'point',id:'M',x:0,y:0,x2:0,y2:0,label:'M',construction:{kind:'midpoint',reference:'AB'}};
const bisector={kind:'infiniteLine',id:'b',x:0,y:0,x2:1,y2:1,label:'m',construction:{kind:'perpendicularBisector',reference:'AB'}};
const angle={kind:'angle',id:'angle',x:100,y:200,x2:200,y2:100,label:'α'};
const angleRay={kind:'ray',id:'r',x:0,y:0,x2:1,y2:1,label:'l',construction:{kind:'angleBisector',reference:'angle'}};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,'expected '+a+' ≈ '+b);

test('TASK152 ellipse has elliptical path, stroke hit and real bounds',()=>{
 const ellipse={kind:'ellipse',x:80,y:100,x2:280,y2:200,label:'E',style:{stroke:'#2563eb',width:3}};
 const norm=qwValidateDiagram([ellipse])[0];
 assert.deepEqual(qwObjectBounds(norm),{x:80,y:100,x2:280,y2:200});
 assert.equal(qwHitObject(norm,{x:280,y:150}),true);
 assert.equal(qwHitObject(norm,{x:180,y:150}),false);
 assert.equal(qwHitObject(norm,{x:180,y:260}),false);
 const svg=qwDiagramSVG([norm]);
 assert.match(svg,/<ellipse[^>]*rx="100" ry="50"/);
 assert.match(svg,/stroke="#2563eb"/);
 assert.deepEqual(qwTranslateObject(norm,10,20).x,90);
});

test('TASK152 regular polygons are genuinely equilateral, derived and editable',()=>{
 for(const n of [3,4,5,6,8,12]){
  const original={kind:'regularPolygon',x:100,y:50,x2:260,y2:210,sides:n,label:'P',style:{fill:'#ffffff',stroke:'#162735',width:2}};
  const o=qwValidateDiagram([original])[0],vertices=qwRegularPolygonVertices(o);
  assert.equal(vertices.length,n);
  const distances=vertices.map((v,i)=>Math.hypot(v.x-vertices[(i+1)%n].x,v.y-vertices[(i+1)%n].y));
  for(const d of distances)near(d,distances[0]);
  assert.equal(qwHitObject(o,vertices[0]),true);
  assert.match(qwDiagramSVG([o]),/<polygon[^>]*points="/);
  const shifted=qwValidateDiagram([qwTranslateObject(o,12,8)])[0];
  near(qwRegularPolygonVertices(shifted)[0].x,vertices[0].x+12);
  near(qwRegularPolygonVertices(shifted)[0].y,vertices[0].y+8);
 }
 for(const sides of [0,2,13,5.5,'6',null])assert.throws(()=>qwValidateDiagram([{kind:'regularPolygon',x:1,y:2,x2:100,y2:120,sides,label:''}]));
});

test('TASK152 midpoint and perpendicular bisector follow edited and rotated segments',()=>{
 let d=qwValidateDiagram([line,midpoint,bisector]);
 near(d[1].x,200);near(d[1].y,100);
 near(d[2].x,200);near(d[2].y,100);
 near(d[2].x2,200);near(d[2].y2,140);
 d[0]=qwTranslateObject(d[0],15,25);d[0].x2+=40;d=qwResolveDiagram(d);
 near(d[1].x,235);near(d[1].y,125);
 near(d[2].x,235);near(d[2].y,125);
 d[0].rotation=90;d=qwResolveDiagram(d);
 const u={x:-(d[0].y2-d[0].y),y:d[0].x2-d[0].x},v={x:d[2].x2-d[2].x,y:d[2].y2-d[2].y};
 near(u.x*v.x+u.y*v.y,0);
 near(d[1].x,d[2].x);near(d[1].y,d[2].y);
 assert.deepEqual(qwValidateDiagram(JSON.parse(JSON.stringify(d))),d);
});

test('TASK152 angular bisector follows angle edits and remains a genuine ray',()=>{
 let d=qwValidateDiagram([angle,angleRay]),ray=d[1];
 near((ray.y2-ray.y)/(ray.x2-ray.x),-(Math.SQRT2-1));
 const prior={...ray};d[0].y2=40;d=qwResolveDiagram(d);ray=d[1];
 assert.notEqual(ray.y2-prior.y2,0);near(ray.x,d[0].x);near(ray.y,d[0].y);
 assert.match(qwDiagramSVG(d),/data-qw-extended="ray"/);
});

test('TASK152 QWORK v1 preserves dependencies, styling and geometry on JSON round-trip',()=>{
 const d=qwProject(),q=qwTask('diagram');q.prompt='Построения';q.figure='diagram';
 q.diagram=qwValidateDiagram([line,midpoint,bisector,angle,angleRay,{kind:'regularPolygon',x:310,y:80,x2:450,y2:220,label:'',sides:7},{kind:'ellipse',x:20,y:20,x2:90,y2:60,label:''}]);d.tasks=[q];
 const saved=JSON.parse(JSON.stringify(qwValidate(d))),reopened=qwValidate(saved);
 assert.deepEqual(reopened,saved);
 assert.equal(reopened.version,1);
 assert.equal(reopened.tasks[0].diagram[1].construction.reference,'AB');
 assert.equal(reopened.tasks[0].diagram[5].sides,7);
 assert.ok(qwDiagramSVG(reopened.tasks[0].diagram).includes('data-qw-label-owner'));
});

test('TASK152 corrupted, dangling and cyclic dependencies fail closed',()=>{
 assert.throws(()=>qwValidateDiagram([midpoint]),/исходная фигура/);
 assert.throws(()=>qwValidateDiagram([{...angleRay,construction:{kind:'angleBisector',reference:'AB'}},line]),/угол/);
 assert.throws(()=>qwValidateDiagram([line,{...midpoint,construction:{kind:'parallel',reference:'AB'}}]),/Некорректная связь/);
 const cyclic=[{...line,id:'A',construction:{kind:'parallel',reference:'B'}},{kind:'infiniteLine',id:'B',x:2,y:2,x2:3,y2:3,label:'',construction:{kind:'parallel',reference:'A'}}];
 assert.throws(()=>qwValidateDiagram(cyclic));
});
