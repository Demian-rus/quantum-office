import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {qwTask,qwValidateDiagram,qwTriangleConstruction} from '../src/core/work-model.js';
import {qwGraphSVG,qwDiagramSVG} from '../src/core/work-content.js';

function yAxisLabels(svg){
 return [...svg.matchAll(/<text x="66" y="[\d.]+".*?>([^<>]+)<\/text>/g)].map(x=>x[1]);
}
test('TASK146 crowded vertical ticks use consistent minimum separation',()=>{
 const graph=qwTask('graph').graph;
 const svg=qwGraphSVG(graph);
 assert.deepEqual(yAxisLabels(svg),['0','2','4','6','8','10']);
 assert.match(svg, /<text x="66" y="266"[^>]*>0<\/text>/);
 assert.match(svg, /<text x="66" y="50"[^>]*>10<\/text>/);
 const gridlines=(svg.match(/stroke="#d9dee4"/g)||[]).length;
 assert.ok(gridlines>=20);
});
test('TASK146 vertex names stay outside triangle edges',()=>{
 const polygon=qwValidateDiagram([{kind:'triangle',x:100,y:50,x2:340,y2:250,label:'',edgeLabels:['6 см','5 см','4 см']}]);
 const svg=qwDiagramSVG(polygon,false);
 const positions=new Map([...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>([^<>]+)<\/text>/g)]
   .map(x=>[x[3],{x:+x[1],y:+x[2]}]));
 for(const name of ['A','B','C']){
  const p=positions.get(name);
  assert.ok(p,'missing vertex '+name);
  if(name==='A')assert.ok(p.x<100&&p.y>250);
  if(name==='B')assert.ok(p.x>340&&p.y>250);
  if(name==='C')assert.ok(p.y<50);
 }
 assert.match(svg,/6 см/);
 assert.doesNotMatch(svg,/qw-geometry-guide|data-qw-vertex/);
});
test('TASK146 optional grid step is not exported',()=>{
 const o=qwValidateDiagram([{kind:'triangle',x:100,y:70,x2:320,y2:280,label:''}]);
 for(const step of [10,20,40]){
  const svg=qwDiagramSVG(o,true,step);
  assert.match(svg,new RegExp('width="'+step+'" height="'+step+'"'));
 }
 assert.doesNotMatch(qwDiagramSVG(o,false,10),/qw-geometry-guide/);
});
test('TASK146 visual dialog has stable sizing and an independent inspector',()=>{
 const css=readFileSync(new URL('../src/styles/work-builder.css',import.meta.url),'utf8');
 const js=readFileSync(new URL('../src/core/work-builder.js',import.meta.url),'utf8');
 assert.match(css,/\.qw-dialog\.qw-visual-dialog\{/);
 assert.match(css,/height:min\(850px,calc\(100dvh - 24px\)\)/);
 assert.match(css,/\.qw-visual-dialog #qw-visual-properties\{/);
 assert.match(css,/overflow-y:auto/);
 assert.match(js,/qw-visual-canvas-footer/);
 assert.match(js,/id="qw-grid-step-geometry"/);
 assert.match(js,/drag\.creating&&\['triangle'/);
 assert.match(js,/!e\.shiftKey/);
});

test('TASK146 exact median/altitude geometry is preserved in printable drawing',()=>{
 const [triangle]=qwValidateDiagram([{kind:'triangle',x:100,y:50,x2:340,y2:250,label:''}]);
 const median=qwTriangleConstruction(triangle,'median',0);
 assert.equal(median.kind,'dashed');
 assert.equal(median.x,100);assert.equal(median.y,250);
 assert.equal(median.x2,280);assert.equal(median.y2,150);
 const altitude=qwTriangleConstruction(triangle,'altitude',2);
 assert.equal(altitude.x,220);assert.equal(altitude.y,50);
 assert.equal(altitude.x2,220);assert.equal(altitude.y2,250);
 const svg=qwDiagramSVG([triangle,median,altitude],false);
 assert.equal((svg.match(/stroke-dasharray="6 4"/g)||[]).length,2);
 assert.doesNotMatch(svg,/qw-geometry-guide/);
});
test('TASK146 malformed constructions reject degenerate sides',()=>{
 const [triangle]=qwValidateDiagram([{kind:'triangle',x:100,y:50,x2:340,y2:250,label:''}]);
 assert.throws(()=>qwTriangleConstruction(triangle,'invalid',0),/Неизвестное/);
 assert.throws(()=>qwTriangleConstruction(triangle,'median',9),/Неизвестное/);
 triangle.vertices[1].x=triangle.vertices[2].x;
 triangle.vertices[1].y=triangle.vertices[2].y;
 assert.throws(()=>qwTriangleConstruction(triangle,'altitude',0),/ненулевую/);
});
