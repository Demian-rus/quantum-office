import test from 'node:test';
import assert from 'node:assert/strict';
import {qwTask,qwValidateGraph,QW_PLOT} from '../src/core/work-model.js';
import {qwAxisLayout,qwGraphSVG} from '../src/core/work-content.js';

const parseLabels=svg=>[...svg.matchAll(/<text class="qw-axis-number" data-axis="([xy])" data-value="([^"]+)" x="([^"]+)" y="([^"]+)" font-size="([^"]+)"/g)].map(m=>({axis:m[1],value:+m[2],x:+m[3],y:+m[4],font:+m[5]}));
test('TASK149 axis typography: negative values use small labels near their own ticks, one origin zero',()=>{
 for(const [xmin,xmax,ymin,ymax] of [[0,10,0,10],[0,10,-10,10],[-10,10,-10,10]]){
  const g=qwValidateGraph({...qwTask('graph').graph,xmin,xmax,ymin,ymax});
  const svg=qwGraphSVG(g),labels=parseLabels(svg);
  assert.ok(labels.some(n=>n.axis==='x'&&n.value===0));
  assert.equal(labels.filter(n=>n.value===0).length,1,'single zero at the crossing');
  assert.ok(labels.length>10,'visible readable scale without removing grid lines');
  const boxes=labels.map(n=>{
   const text=String(n.value),w=Math.max(8,text.length*n.font*.63);
   return {n,x:n.axis==='x'?n.x-w/2:n.x-w,y:n.y-n.font,w,h:n.font};
  });
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
   const a=boxes[i],b=boxes[j],x=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
   const y=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
   assert.ok(x*y<.01,'numbers must not overlap '+JSON.stringify([a.n,b.n]));
  }
  assert.ok(svg.includes('x2="'+(QW_PLOT.right+16)+'"'),'X arrow extends beyond grid');
  assert.ok(svg.includes('y2="'+(QW_PLOT.top-16)+'"'),'Y arrow extends beyond grid');
 }
 const math=qwValidateGraph({...qwTask('graph').graph,xmin:-10,xmax:10,ymin:-10,ymax:10,coordinateMode:'math'});
 const ticks=qwAxisLayout(math);
 assert.ok(ticks.axisX>QW_PLOT.left&&ticks.axisX<QW_PLOT.right);
 assert.ok(ticks.axisY>QW_PLOT.top&&ticks.axisY<QW_PLOT.bottom);
 assert.ok(ticks.ticks.x.filter(t=>t.numbered).length<ticks.ticks.x.length,'number density is independent of grid density');
});
test('TASK149 coordinate mode remains semantic and survives QWORK validation',()=>{
 const base=qwTask('graph').graph;
 assert.equal(base.coordinateMode,'first');
 for(const mode of ['first','positiveX','math','custom']){
  const g=qwValidateGraph({...base,coordinateMode:mode});
  assert.equal(qwValidateGraph(JSON.parse(JSON.stringify(g))).coordinateMode,mode);
 }
 const old=structuredClone(base);delete old.coordinateMode;
 assert.equal(qwValidateGraph(old).coordinateMode,'first');
 assert.equal(qwValidateGraph({...old,xmin:-5,xmax:5}).coordinateMode,'custom');
});
