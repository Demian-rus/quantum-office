/* Attached captions share a measured SVG layout in the editor, saved SVG and PDF.
   Model offsets are SVG-space vectors from the owning anchor to the caption centre. */
function qwLabelSVG(id,anchor,position,markup,options={}){
 const esc=s=>String(s).replace(/[&"<>]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]));
 return '<g data-qw-label="'+esc(id)+'" data-label-anchor-x="'+anchor.x+'" data-label-anchor-y="'+anchor.y+'" data-label-mode="'+(options.free?'fixed':position?.mode||'auto')+'" data-label-dx="'+(position?.dx||0)+'" data-label-dy="'+(position?.dy||0)+'"'+(options.plot?' data-label-plot="true"':'')+'>'+markup+'</g>';
}
function qwLabelSegmentHits(a,b,box,padding=0){
 const r={x:box.x-padding,y:box.y-padding,w:box.w+2*padding,h:box.h+2*padding},dx=b.x-a.x,dy=b.y-a.y;let near=0,far=1;
 for(const [p,q]of[[-dx,a.x-r.x],[dx,r.x+r.w-a.x],[-dy,a.y-r.y],[dy,r.y+r.h-a.y]]){
  if(Math.abs(p)<1e-9){if(q<0)return false;continue;}const t=q/p;
  if(p<0){if(t>far)return false;near=Math.max(near,t);}else{if(t<near)return false;far=Math.min(far,t);}
 }return near<=far;
}
function qwLabelBoxOverlap(a,b,padding=0){return Math.max(0,Math.min(a.x+a.w+padding,b.x+b.w)-Math.max(a.x-padding,b.x))*Math.max(0,Math.min(a.y+a.h+padding,b.y+b.h)-Math.max(a.y-padding,b.y));}
function qwChooseLabelBox(anchor,initial,bounds,segments,occupied){
 const score=r=>{
  const outside=Math.max(0,bounds.x-r.x)+Math.max(0,r.x+r.w-bounds.x-bounds.w)+Math.max(0,bounds.y-r.y)+Math.max(0,r.y+r.h-bounds.y-bounds.h);
  let lines=0;for(const s of segments){if(s.maxX<r.x-s.pad||s.minX>r.x+r.w+s.pad||s.maxY<r.y-s.pad||s.minY>r.y+r.h+s.pad)continue;if(qwLabelSegmentHits(s.a,s.b,r,s.pad))lines++;}
  const labels=occupied.reduce((sum,b)=>sum+qwLabelBoxOverlap(r,b,2),0);return outside*100000+lines*10000+labels*100;
 };
 const initialScore=score(initial);let best={box:initial,score:initialScore,initialScore};if(best.score===0)return best;
 for(const gap of [10,16,24,34,46,60]){
  // Preserve safe existing positions. NW is preferred over SE when NE crosses an outgoing line.
  const xs=[anchor.x+gap,anchor.x-initial.w-gap],ys=[anchor.y-initial.h-gap/2,anchor.y+gap];
  const candidates=[{x:xs[0],y:ys[0]},{x:xs[1],y:ys[0]},{x:xs[0],y:ys[1]},{x:xs[1],y:ys[1]},
   {x:anchor.x-initial.w/2,y:anchor.y-initial.h-gap},{x:anchor.x-initial.w/2,y:anchor.y+gap},{x:xs[0],y:anchor.y-initial.h/2},{x:xs[1],y:anchor.y-initial.h/2}];
  for(const c of candidates){const box={...c,w:initial.w,h:initial.h},next=score(box);if(next<best.score)best={box,score:next,initialScore};if(next===0)return best;}
  if(initial.w<bounds.w-8&&initial.h<bounds.h-8)for(const c of candidates){
   const box={x:Math.max(bounds.x+4,Math.min(c.x,bounds.x+bounds.w-initial.w-4)),y:Math.max(bounds.y+4,Math.min(c.y,bounds.y+bounds.h-initial.h-4)),w:initial.w,h:initial.h},next=score(box);
   if(next<best.score)best={box,score:next,initialScore};if(next===0)return best;
  }
 }return best;
}
function qwPlaceSVGLabels(source){
 if(typeof document==='undefined'||!document.body||!source.includes('data-qw-label='))return source;
 const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;top:0;width:520px;height:320px;visibility:hidden;pointer-events:none';host.innerHTML=source;document.body.append(host);
 try{
  const svg=host.querySelector('svg'),labels=[...svg.querySelectorAll('[data-qw-label]')],inverse=svg.getCTM().inverse();
  const matrix=e=>inverse.multiply(e.getCTM()),point=(m,x,y)=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f});
  const rect=e=>{const b=e.getBBox(),m=matrix(e),ps=[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]].map(([x,y])=>point(m,x,y));return {x:Math.min(...ps.map(p=>p.x)),y:Math.min(...ps.map(p=>p.y)),w:Math.max(...ps.map(p=>p.x))-Math.min(...ps.map(p=>p.x)),h:Math.max(...ps.map(p=>p.y))-Math.min(...ps.map(p=>p.y))};};
  const anchor=e=>{const owner=e.closest('[data-qw-label-owner]')||svg;return point(matrix(owner),Number(e.dataset.labelAnchorX),Number(e.dataset.labelAnchorY));};
  const move=(e,dx,dy)=>{const m=matrix(e.parentElement),det=m.a*m.d-m.b*m.c;e.setAttribute('transform','translate('+((m.d*dx-m.c*dy)/det)+' '+((-m.b*dx+m.a*dy)/det)+')');};
  const segments=[];
  const add=(a,b,pad)=>segments.push({a,b,pad,minX:Math.min(a.x,b.x),maxX:Math.max(a.x,b.x),minY:Math.min(a.y,b.y),maxY:Math.max(a.y,b.y)});
  for(const e of svg.querySelectorAll('path,line,polyline,polygon,rect,circle,ellipse')){
   if(e.closest('defs,[data-qw-label],[data-qw-editor-only]')||e.hasAttribute('data-qw-vertex'))continue;
   const style=getComputedStyle(e),stroke=style.stroke;
   if(['rgb(217, 222, 228)','rgb(220, 230, 236)'].includes(stroke))continue; // construction/grid lines are background
   const radius=Number(e.getAttribute('r'))||0,filledPoint=e.tagName==='circle'&&radius<=7&&style.fill!=='none';
   if((stroke==='none'||Number(style.strokeOpacity)===0)&&!filledPoint)continue;
   const m=matrix(e),width=parseFloat(style.strokeWidth)||1,pad=Math.max(1.2,width/2)+2;
   if(filledPoint){const b=rect(e);for(let x=b.x;x<=b.x+b.w+1;x+=2)add({x,y:b.y},{x,y:b.y+b.h},1.5);continue;}
   const length=e.getTotalLength();if(!Number.isFinite(length)||length===0)continue;
   const count=e.tagName==='line'?1:Math.min(1200,Math.max(2,Math.ceil(length/2)));let previous=null;
   const clip=e.closest('[clip-path]');
   for(let n=0;n<=count;n++){const p=e.getPointAtLength(length*n/count),p2=point(m,p.x,p.y);
    if(previous&&(!clip||Math.max(previous.x,p2.x)>=82&&Math.min(previous.x,p2.x)<=451&&Math.max(previous.y,p2.y)>=46&&Math.min(previous.y,p2.y)<=262))add(previous,p2,pad);previous=p2;
   }
   for(const end of ['start','end'])if(style.getPropertyValue('marker-'+end)&&style.getPropertyValue('marker-'+end)!=='none'){
    const p=e.getPointAtLength(end==='start'?0:length),at=point(m,p.x,p.y),r=width*5;add({x:at.x-r,y:at.y},{x:at.x+r,y:at.y},r);
   }
  }
  const occupied=[...svg.querySelectorAll('text')].filter(e=>!e.closest('[data-qw-label],defs')).map(rect);
  // Explicit positions and free text are obstacles, never targets for automatic nudging.
  for(const e of labels.filter(e=>e.dataset.labelMode!=='auto')){
   const a=anchor(e),r=rect(e);
   if(e.dataset.labelMode==='manual')move(e,a.x+Number(e.dataset.labelDx)-r.x-r.w/2,a.y+Number(e.dataset.labelDy)-r.y-r.h/2);
   occupied.push(rect(e));
  }
  for(const e of labels){
   const a=anchor(e),r=rect(e),bounds=e.dataset.labelPlot?{x:82,y:46,w:369,h:216}:{x:3,y:3,w:514,h:314};
   const ownFixed=e.dataset.labelMode!=='auto',others=ownFixed?occupied.filter(b=>!(Math.abs(b.x-r.x)<.01&&Math.abs(b.y-r.y)<.01&&Math.abs(b.w-r.w)<.01&&Math.abs(b.h-r.h)<.01)):occupied;
   const placement=qwChooseLabelBox(a,r,bounds,segments,others);
   if(!ownFixed){move(e,placement.box.x-r.x,placement.box.y-r.y);occupied.push(rect(e));}
   const final=rect(e);e.dataset.labelWorldX=a.x;e.dataset.labelWorldY=a.y;e.dataset.labelOffsetX=final.x+final.w/2-a.x;e.dataset.labelOffsetY=final.y+final.h/2-a.y;
   // Manual positions stay exact even when unsafe; the editor exposes the conflict.
   const conflict=ownFixed?qwChooseLabelBox(a,final,bounds,segments,others).initialScore:placement.score;
   e.dataset.labelConflict=String(conflict>0);e.style.cursor='grab';e.style.pointerEvents='bounding-box';
  }
  return new XMLSerializer().serializeToString(svg);
 }finally{host.remove();}
}
export {qwLabelSVG,qwLabelSegmentHits,qwLabelBoxOverlap,qwChooseLabelBox,qwPlaceSVGLabels};
