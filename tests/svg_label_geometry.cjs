/* Independent native SVG checks: denser sampling than the production placer,
   no calls to its scoring/intersection helpers or stored conflict flags. */
module.exports=function inspectSVG(svg){
 const inverse=svg.getCTM().inverse(),matrix=e=>inverse.multiply(e.getCTM()),at=(m,p)=>({x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f});
 const box=e=>{const b=e.getBBox(),m=matrix(e),ps=[{x:b.x,y:b.y},{x:b.x+b.width,y:b.y},{x:b.x+b.width,y:b.y+b.height},{x:b.x,y:b.y+b.height}].map(p=>at(m,p));return {x:Math.min(...ps.map(p=>p.x)),y:Math.min(...ps.map(p=>p.y)),w:Math.max(...ps.map(p=>p.x))-Math.min(...ps.map(p=>p.x)),h:Math.max(...ps.map(p=>p.y))-Math.min(...ps.map(p=>p.y))};};
 let nodes=[...svg.querySelectorAll('[data-qw-label]')];if(!nodes.length)nodes=[...svg.querySelectorAll('text')].filter(e=>/^[AB]$/.test(e.textContent));
 const allLabels=new Set(nodes),insideLabel=e=>!!e.closest('[data-qw-label]')||allLabels.has(e);
 const fixed=[...svg.querySelectorAll('text')].filter(e=>!insideLabel(e)).map(box),curves=[],points=[];
 for(const e of svg.querySelectorAll('line,path,polyline,polygon,rect,circle,ellipse')){
  if(e.closest('defs,[data-qw-label],[data-qw-editor-only]')||e.hasAttribute('data-qw-vertex'))continue;
  const style=getComputedStyle(e),r=Number(e.getAttribute('r'))||0;
  if(['rgb(217, 222, 228)','rgb(220, 230, 236)'].includes(style.stroke))continue;
  if(e.tagName==='circle'&&r<=7&&style.fill!=='none'){const m=matrix(e);points.push({...at(m,{x:Number(e.getAttribute('cx')),y:Number(e.getAttribute('cy'))}),r});continue;}
  if(style.stroke==='none')continue;
  const length=e.getTotalLength(),m=matrix(e),sample=[];if(!length)continue;
  const n=Math.min(4000,Math.max(2,Math.ceil(length/.45)));
  for(let i=0;i<=n;i++){const p=at(m,e.getPointAtLength(length*i/n));if(!e.closest('[clip-path]')||p.x>=82&&p.x<=451&&p.y>=46&&p.y<=262)sample.push(p);}
  curves.push({sample,pad:(parseFloat(style.strokeWidth)||1)/2+.1});
 }
 const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
 const labels=nodes.map(e=>({id:e.dataset.qwLabel||e.textContent,text:e.textContent,box:box(e),mode:e.dataset.labelMode||'auto',node:e}));
 return {labels:labels.map(l=>{
  const b=l.box,contains=(p,pad)=>p.x>b.x-pad&&p.x<b.x+b.w+pad&&p.y>b.y-pad&&p.y<b.y+b.h+pad;
  const lines=curves.filter(c=>c.sample.some(p=>contains(p,c.pad))).length;
  const dots=points.filter(p=>Math.hypot(Math.max(b.x-p.x,0,p.x-b.x-b.w),Math.max(b.y-p.y,0,p.y-b.y-b.h))<p.r+.1).length;
  const nearby=labels.filter(other=>other!==l&&overlap(b,other.box)>.1).map(other=>other.id),axisText=fixed.filter(f=>overlap(b,f)>.1).length;
  const plot=l.node.dataset.labelPlot||!l.node.dataset.qwLabel&&svg.getAttribute('aria-label')==='Координатный график',bounds=plot?{x:82,y:46,x2:451,y2:262}:{x:0,y:0,x2:520,y2:320};
  return {id:l.id,text:l.text,box:b,lines,points:dots,labels:nearby,axisText,outside:b.x<bounds.x-.2||b.y<bounds.y-.2||b.x+b.w>bounds.x2+.2||b.y+b.h>bounds.y2+.2,mode:l.mode};
 })};
};
