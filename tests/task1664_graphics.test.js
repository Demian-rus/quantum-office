import test from 'node:test';
import assert from 'node:assert/strict';
import {qwArrowGeometry,qwArrowSVG} from '../src/core/work-physics.js';
import {qwContentHTML,qwRichMarkdownHTML,qwMath,qwMathML} from '../src/core/work-content.js';
import {qwClosedContour,qwContourOutward,qwChooseLabelBox,qwContourPenalty} from '../src/core/work-labels.js';

test('TASK166.4 arrows: endpoint, butt cap and connected base for all lengths and directions',()=>{
 for(const width of [1,2,4,8])for(const length of [2,7,40,170])for(let angle=0;angle<360;angle+=15)for(const start of [false,true]){
  const a={x:100,y:100},rad=angle*Math.PI/180,b={x:a.x+length*Math.cos(rad),y:a.y+length*Math.sin(rad)},points=[a,b],saved=JSON.stringify(points);
  const {shaft,heads}=qwArrowGeometry(points,width,{start});
  assert.equal(heads.length,start?2:1);assert.equal(JSON.stringify(points),saved);
  for(const [i,h] of heads.entries()){
   const atStart=start&&i===0,tip=atStart?a:b,base=atStart?shaft[0]:shaft.at(-1);
   assert.deepEqual(h.tip,tip);assert.deepEqual(h.base,base);
   const dx=tip.x-base.x,dy=tip.y-base.y,L=Math.hypot(dx,dy),dot=p=>((p.x-tip.x)*dx+(p.y-tip.y)*dy)/L;
   assert.ok(L>0);assert.ok(shaft.every(p=>dot(p)<=-L+1e-8));assert.ok(h.vertices.every(p=>dot(p)<=1e-8));
   assert.ok(Math.abs((h.vertices[1].x+h.vertices[2].x)/2-base.x)<1e-8);
   assert.ok(Math.abs((h.vertices[1].y+h.vertices[2].y)/2-base.y)<1e-8);
  }
  const svg=qwArrowSVG(points,'#2563eb',width,{start});
  assert.match(svg,/stroke-linecap="butt"/);assert.doesNotMatch(svg,/marker-(start|end)=/);
 }
});
test('TASK166.4 plain math preserves source and typesets safe operators only',()=>{
 const source='h=6,6·10⁻³⁴ Дж·с; c=3·10⁸ м/с; e=1,6·10⁻¹⁹ Кл. A→B→C→D→A. x≤−2. a + b. https://example.com/?a=2';
 const html=qwContentHTML(source);
 assert.equal((html.match(/class="qw-plain-math"/g)||[]).length,6);
 assert.match(html,/<mtext>6,6·10⁻³⁴<\/mtext>/);
 assert.match(html,/<mtext>−2<\/mtext>/);
 assert.match(html,/https:\/\/example.com\/\?a=2/);
 assert.equal((html.match(/<mo lspace="0.28em" rspace="0.28em">→<\/mo>/g)||[]).length,4);
 assert.match(qwRichMarkdownHTML('**h=2** и '+String.fromCharCode(96)+'a=2'+String.fromCharCode(96)),/<code>a=2<\/code>/);
 assert.doesNotMatch(qwMathML(qwMath('x = -2')),/<mspace/);
 assert.match(qwMathML(qwMath('A→B')),/<mo lspace="0.28em" rspace="0.28em">→<\/mo>/);
 assert.equal(qwContentHTML('температура 12,5 °C; 4-7 с; x=2'), 'температура 12,5 °C; 4-7 с; '+qwContentHTML('x=2'));
});
test('TASK166.4 closed polygon captions prefer exterior, open graphs unchanged',()=>{
 for(const list of [[[100,100],[300,100],[300,230],[100,230]],[[170,90],[360,220],[110,220]],[[120,90],[350,90],[270,155],[350,230],[120,230]]]){
  const ps=list.map(([x,y])=>({x,y})),closed=qwClosedContour([...ps,ps[0]]);
  assert.equal(closed.length,ps.length);assert.equal(qwClosedContour(ps),null);
  for(let i=0;i<ps.length;i++){
   const a=ps[i],out=qwContourOutward(closed,i),init={x:a.x-6,y:a.y-6,w:12,h:14};
   const result=qwChooseLabelBox(a,init,{x:82,y:46,w:369,h:216},[],[],closed,out);
   assert.equal(qwContourPenalty(result.box,closed),0);assert.equal(result.score,0);
  }
 }
});

import {qwEffectiveObjectPaint,qwGraphTemplateStroke,qwGraphSVG,qwDiagramSVG} from '../src/core/work-content.js';
import {qwTask} from '../src/core/work-model.js';
test('FINAL FIX 2: effective paint matches SVG, without adding defaults to saved model',()=>{
 const g=qwTask('graph').graph;
 g.elements=[{kind:'line',x:0,y:0,x2:1,y2:1,label:''},{kind:'line',x:1,y:0,x2:2,y2:1,label:'',style:{stroke:'#16a34a',width:4}}];
 const d=[{kind:'line',x:10,y:20,x2:100,y2:40,label:''},{kind:'block',x:100,y:100,x2:150,y2:150,label:'',style:{stroke:'#dc2626',width:3}}];
 const before=JSON.stringify({g,d});
 const graph=qwGraphSVG(g,true),diagram=qwDiagramSVG(d,true);
 for(const [i,o] of g.elements.entries()){
  const paint=qwEffectiveObjectPaint(o,'graph-element');const group=graph.split('data-qw-element="'+i+'"')[1].split('</g>')[0];
  assert.ok(group.includes('stroke="'+paint.stroke+'"'));assert.ok(group.includes('stroke-width="'+paint.width+'"'));
 }
 for(const [i,o] of d.entries()){
  const paint=qwEffectiveObjectPaint(o,'diagram');const group=diagram.split('data-qw-object="'+i+'"')[1].split('</g>')[0];
  assert.ok(group.includes('stroke="'+paint.stroke+'"'));assert.ok(group.includes('stroke-width="'+paint.width+'"'));
 }
 assert.equal(qwGraphTemplateStroke(g,'lineStyle'),'#222222');assert.equal(qwGraphTemplateStroke(g,'curveStyle'),'#186ba3');assert.equal(qwGraphTemplateStroke(g,'curveStyle',true),'#222222');
 assert.equal(JSON.stringify({g,d}),before);
});
