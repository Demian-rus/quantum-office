import test from 'node:test';
import assert from 'node:assert/strict';
import {qwProject,qwTask,qwValidate,qwValidateGraph,qwValidateDiagram,qwMove,qwDuplicate,qwFromDiagnostic,QW_TYPES} from '../src/core/work-model.js';
import {qwMath,qwMathML,qwTokens,qwContentHTML,qwGraphSVG,qwDiagramSVG,qwPlotXY} from '../src/core/work-content.js';
test('TASK144 six task kinds roundtrip formulas, blanks, graph, diagram and teacher metadata',()=>{
 const d=qwProject();d.tasks=Object.keys(QW_TYPES).map(type=>{const q=qwTask(type);q.prompt='α и \\(\\frac{x^{2}}{\\sqrt{y}}\\) [[blank:4]]';q.answer='Скрытый ключ';q.criteria='Критерий';q.comment='Комментарий';q.graph.points=[{x:0,y:1,label:'A'},{x:4,y:1,label:'B'},{x:4,y:7,label:'C'}];q.diagram=[{kind:'arrow',x:0,y:5,x2:50,y2:60,label:'F'}];q.source={kind:'diagnostic',id:'q1'};return q;});
 assert.deepEqual(qwValidate(JSON.parse(JSON.stringify(d))),d);
});
test('TASK144 import rejects duplicate identities, invalid graphs and version without mutating source',()=>{
 const d=qwProject();d.tasks=[qwTask()];const before=JSON.stringify(d);
 for(const alter of [x=>x.version=2,x=>x.tasks.push(structuredClone(x.tasks[0])),x=>x.tasks[0].graph.xmax=-1,x=>x.tasks[0].graph.points.push({x:100,y:2}),x=>x.tasks[0].type='unknown']){const bad=structuredClone(d);alter(bad);assert.throws(()=>qwValidate(bad));}
 assert.equal(JSON.stringify(d),before);
});
test('TASK144 untrusted image URLs and script-like figures are rejected',()=>{
 const d=qwProject();d.tasks=[qwTask('diagram')];
 for(const image of ['https://example.org/image.png','data:image/svg+xml;base64,PHN2Zz4=','javascript:alert(1)']){d.tasks[0].image=image;assert.throws(()=>qwValidate(d));}
 assert.throws(()=>qwValidateDiagram([{kind:'script',x:0,y:0,x2:1,y2:1}]));
});
test('TASK144 math fraction, root, powers, subscripts and Greek render structurally',()=>{
 const html=qwMathML(qwMath('\\frac{\\Delta t^{2}}{\\sqrt{x_{1}}}'));
 for(const tag of ['mfrac','msqrt','msup','msub'])assert.ok(html.includes('<'+tag+'>'));
 assert.match(html,/Δ/);assert.match(qwMathML(qwMath('\\rho+\\epsilon+\\tau')),/ρ/);assert.match(qwMathML(qwMath('\\rho+\\epsilon+\\tau')),/ε/);
});
test('TASK144 invalid and deeply nested formulas fail explicitly',()=>{
 for(const s of ['','\\frac{a}','x^{2','{'.repeat(15)+'x'+'}'.repeat(15),'x'.repeat(601)])assert.throws(()=>qwMath(s));
 assert.equal(qwTokens('\\(\\frac{a}\\)')[0].t,'error');
});
test('TASK144 inline blanks preserve text and mathematical content without HTML execution',()=>{
 const html=qwContentHTML('<script>x</script> \\(x^{2}\\) [[blank:8]]');assert.match(html,/&lt;script&gt;/);assert.match(html,/width:8ch/);assert.match(html,/<math/);assert.ok(!html.includes('<script>'));
});
test('TASK144 graph has bounded ticks, correctly mapped coordinates and safe labels',()=>{
 const g=qwTask('graph').graph;g.points=[{x:0,y:0,label:'<img>'},{x:5,y:5,label:'B'},{x:5,y:9,label:'C'}];
 assert.deepEqual(qwPlotXY(g,g.points[0]),{x:52,y:275});const svg=qwGraphSVG(g,true);assert.match(svg,/data-qw-point="2"/);assert.match(svg,/&lt;img&gt;/);assert.doesNotMatch(svg,/NaN|Infinity/);
 assert.throws(()=>qwValidateGraph({...g,step:0}));assert.throws(()=>qwValidateGraph({...g,xmin:10}));
});
test('TASK144 all seven diagram primitives survive validation and render as SVG',()=>{
 const shapes=['line','arrow','rect','circle','point','text','angle'].map(kind=>({kind,x:100,y:100,x2:200,y2:200,label:'α'}));assert.deepEqual(qwValidateDiagram(shapes),shapes);const svg=qwDiagramSVG(shapes,true);assert.match(svg,/ellipse/);assert.match(svg,/marker-end/);assert.match(svg,/data-qw-object="6"/);
});
test('TASK144 duplication and reorder keep original graph and identity independent',()=>{
 const d=qwProject(),a=qwTask('graph');a.prompt='A';a.graph.points=[{x:1,y:1,label:''}];d.tasks=[a];const copy=qwDuplicate(d,a.id);assert.notEqual(copy.id,a.id);copy.graph.points[0].y=7;assert.equal(a.graph.points[0].y,1);assert.ok(qwMove(d,copy.id,-1));assert.equal(d.tasks[0].id,copy.id);assert.equal(qwMove(d,copy.id,-1),false);
});
test('TASK144 diagnostic bridge copies educational fields and excludes student/session data',()=>{
 const source={id:'q1',type:'practice',prompt:'Опыт',answer:'Ключ',criteria:'Шаги',points:4,session:{student:'PRIVATE'}};const before=JSON.stringify(source),q=qwFromDiagnostic(source);assert.equal(q.type,'extended');assert.equal(q.source.id,'q1');assert.ok(!JSON.stringify(q).includes('PRIVATE'));assert.equal(JSON.stringify(source),before);
});
