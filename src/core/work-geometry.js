/* Shared geometric operations. Model coordinates never depend on viewport size. */
import {qwGeometryVertices,qwPlotXY,qwEvaluateCurve,QW_PLOT} from './work-model.js';
function qwRotatePoint(p,center,degrees){
 const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=p.x-center.x,y=p.y-center.y;
 return {...p,x:center.x+x*c-y*s,y:center.y+x*s+y*c};
}
function qwObjectCenter(o){
 const ps=o.vertices||[{x:o.x,y:o.y},{x:o.x2,y:o.y2}];
 return {x:(Math.min(...ps.map(p=>p.x))+Math.max(...ps.map(p=>p.x)))/2,y:(Math.min(...ps.map(p=>p.y))+Math.max(...ps.map(p=>p.y)))/2};
}
function qwObjectPolygon(o){
 if(['triangle','rightTriangle','quadrilateral'].includes(o.kind))return qwGeometryVertices(o);
 const x=Math.min(o.x,o.x2),y=Math.min(o.y,o.y2),x2=Math.max(o.x,o.x2),y2=Math.max(o.y,o.y2);
 return o.kind==='incline'?[{x,y:y2},{x:x2,y:y2},{x:x2,y}]:[{x,y},{x:x2,y},{x:x2,y:y2},{x,y:y2}];
}
function qwSegmentDistance(p,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/l)):0;
 return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
function qwInPolygon(p,vs){
 let inside=false;
 for(let i=0,j=vs.length-1;i<vs.length;j=i++)if((vs[i].y>p.y)!==(vs[j].y>p.y)&&p.x<(vs[j].x-vs[i].x)*(p.y-vs[i].y)/(vs[j].y-vs[i].y)+vs[i].x)inside=!inside;
 return inside;
}
function qwSpringPoints(o){
 const dx=o.x2-o.x,dy=o.y2-o.y,len=Math.hypot(dx,dy)||1,ps=[{x:o.x,y:o.y}];
 for(let j=1;j<=19;j++){const t=j/20,off=j===1||j===19?0:j%2?8:-8;ps.push({x:o.x+dx*t-dy/len*off,y:o.y+dy*t+dx/len*off});}
 return [...ps,{x:o.x2,y:o.y2}];
}
function qwObjectBounds(o){
 if(['ray','infiniteLine'].includes(o.kind)){
  const ps=qwExtendedSegment(o).map(p=>qwRotatePoint(p,qwObjectCenter(o),o.rotation||0));
  if(!ps.length)return {x:o.x,y:o.y,x2:o.x,y2:o.y};
  return {x:Math.min(...ps.map(p=>p.x)),y:Math.min(...ps.map(p=>p.y)),x2:Math.max(...ps.map(p=>p.x)),y2:Math.max(...ps.map(p=>p.y))};
 }
 let ps=o.kind==='polyline'?o.vertices:o.kind==='arc'?qwArcPoints(o):['dimension','doubleArrow'].includes(o.kind)?qwLinearSegments(o).flat():qwObjectPolygon(o);
 if(o.kind==='text')ps=[{x:o.x,y:o.y-20},{x:o.x+Math.max(10,[...(o.label||'')].length*12),y:o.y+5}];
 const c=qwObjectCenter(o);
 if(['pulley','fixedPulley','movablePulley'].includes(o.kind)){const r=Math.max(8,Math.min(Math.abs(o.x2-o.x),Math.abs(o.y2-o.y))/2);ps=[{x:c.x-r,y:c.y-r-(o.kind==='movablePulley'?32:14)},{x:c.x+r,y:c.y+r+(o.kind==='movablePulley'?18:0)}];}
 ps=ps.map(p=>qwRotatePoint(p,c,o.rotation||0));
 return {x:Math.min(...ps.map(p=>p.x)),y:Math.min(...ps.map(p=>p.y)),x2:Math.max(...ps.map(p=>p.x)),y2:Math.max(...ps.map(p=>p.y))};
}
function qwTranslateObject(o,dx,dy){
 const moved={...structuredClone(o),x:o.x+dx,y:o.y+dy,x2:o.x2+dx,y2:o.y2+dy};
 if(o.vertices)moved.vertices=o.vertices.map(p=>({...p,x:p.x+dx,y:p.y+dy}));
 return moved;
}
function qwInclineAngle(o){const ps=qwObjectPolygon(o),a=ps[0],b=ps[2];return Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI+(o.rotation||0);}
/* New primitives share the same printable geometry and hit targets. Arc angles
   are mathematical degrees (positive counterclockwise); rotation stays clockwise. */
function qwArcPoints(o){
 const cx=(o.x+o.x2)/2,cy=(o.y+o.y2)/2,r=(o.x2-o.x)/2,delta=o.endAngle-o.startAngle;
 const count=Math.max(1,Math.ceil(Math.abs(delta)/3));
 return Array.from({length:count+1},(_,i)=>{const a=(o.startAngle+delta*i/count)*Math.PI/180;return {x:cx+r*Math.cos(a),y:cy-r*Math.sin(a)};});
}
function qwLinearSegments(o){
 const a={x:o.x,y:o.y},b={x:o.x2,y:o.y2},dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,nx=-uy,ny=ux;
 const result=[[a,b]],width=o.style?.width||2;
 if(o.kind==='dimension')for(const p of [a,b])result.push([{x:p.x+nx*7,y:p.y+ny*7},{x:p.x-nx*7,y:p.y-ny*7}]);
 if(o.kind==='doubleArrow')for(const [p,sign] of [[a,1],[b,-1]])for(const side of [-1,1])result.push([p,{x:p.x+sign*ux*6*width+side*nx*3*width,y:p.y+sign*uy*6*width+side*ny*3*width}]);
 return result;
}
function qwExtendedSegment(o){
 const dx=o.x2-o.x,dy=o.y2-o.y;let lo=o.kind==='ray'?0:-Infinity,hi=Infinity;
 for(const [p,d,min,max]of [[o.x,dx,4,516],[o.y,dy,4,316]]){if(Math.abs(d)<1e-10){if(p<min||p>max)return [];continue;}const a=(min-p)/d,b=(max-p)/d;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));}
 if(lo>hi||!Number.isFinite(lo)||!Number.isFinite(hi))return [];return [{x:o.x+lo*dx,y:o.y+lo*dy},{x:o.x+hi*dx,y:o.y+hi*dy}];
}
function qwHitObject(o,point,tolerance=6){
 const p=qwRotatePoint(point,qwObjectCenter(o),-(o.rotation||0)),a={x:o.x,y:o.y},b={x:o.x2,y:o.y2},t=tolerance+(o.style?.width||2)/2;
 if(o.kind==='point')return Math.hypot(p.x-o.x,p.y-o.y)<=t+3;
 if(['ray','infiniteLine'].includes(o.kind)){const ps=qwExtendedSegment(o);return ps.length===2&&qwSegmentDistance(p,ps[0],ps[1])<=t;}
 if(o.kind==='text')return p.x>=o.x-t&&p.x<=o.x+Math.max(10,[...(o.label||'')].length*12)+t&&p.y>=o.y-20-t&&p.y<=o.y+5+t;
 if(o.kind==='arc'||o.kind==='polyline'){
  const ps=o.kind==='arc'?qwArcPoints(o):o.vertices;
  return ps.slice(1).some((b,i)=>qwSegmentDistance(p,ps[i],b)<=t);
 }
 if(['dimension','doubleArrow'].includes(o.kind))return qwLinearSegments(o).some(([a,b])=>qwSegmentDistance(p,a,b)<=t);
 if(['circle','pulley','fixedPulley','movablePulley'].includes(o.kind)){
  const c=qwObjectCenter(o),r=Math.max(8,Math.min(Math.abs(o.x2-o.x),Math.abs(o.y2-o.y))/2),rx=o.kind==='circle'?Math.max(1,Math.abs(o.x2-o.x)/2):r,ry=o.kind==='circle'?Math.max(1,Math.abs(o.y2-o.y)/2):rx;
  if(o.kind==='movablePulley'&&[ [{x:c.x-r,y:c.y-r-32},{x:c.x-r,y:c.y}], [{x:c.x+r,y:c.y-r-32},{x:c.x+r,y:c.y}], [{x:c.x,y:c.y},{x:c.x,y:c.y+r+18}] ].some(([a,b])=>qwSegmentDistance(p,a,b)<=t))return true;
  if(['pulley','fixedPulley'].includes(o.kind)&&qwSegmentDistance(p,c,{x:c.x,y:c.y-r-14})<=t)return true;
  const d=Math.hypot((p.x-c.x)/rx,(p.y-c.y)/ry),filled=o.style?.fill!==undefined?o.style.fill!=='none':o.kind!=='circle';
  return filled?d<=1+t/Math.min(rx,ry):Math.abs(d-1)*Math.min(rx,ry)<=t;
 }
 if(['line','arrow','dashed','rope','ground'].includes(o.kind))return qwSegmentDistance(p,a,b)<=t;
 if(o.kind==='spring'){const ps=qwSpringPoints(o);return ps.slice(1).some((b,i)=>qwSegmentDistance(p,ps[i],b)<=t);}
 if(o.kind==='angle')return qwSegmentDistance(p,a,{x:o.x2,y:o.y})<=t||qwSegmentDistance(p,a,b)<=t;
 const vs=qwObjectPolygon(o);
 const filled=o.style?.fill!==undefined?o.style.fill!=='none':['block','incline'].includes(o.kind);
 return filled&&qwInPolygon(p,vs)||vs.some((v,i)=>qwSegmentDistance(p,v,vs[(i+1)%vs.length])<=t);
}
function qwHitDiagram(objects,p,tolerance=6){
 for(let i=objects.length-1;i>=0;i--)if(qwHitObject(objects[i],p,tolerance))return i;
 // Empty interiors remain convenient drag targets only when no visible object is hit.
 for(let i=objects.length-1;i>=0;i--)if(['rect','triangle','rightTriangle','quadrilateral'].includes(objects[i].kind)&&qwInPolygon(qwRotatePoint(p,qwObjectCenter(objects[i]),-(objects[i].rotation||0)),qwObjectPolygon(objects[i])))return i;
 return -1;
}
function qwValidDrag(o,pixels){
 if(pixels<4)return false;
 if(['rect','circle','arc','triangle','rightTriangle','quadrilateral','block','incline','pulley','fixedPulley','movablePulley'].includes(o.kind))return Math.abs(o.x2-o.x)>.01&&Math.abs(o.y2-o.y)>.01;
 return Math.hypot(o.x2-o.x,o.y2-o.y)>.01;
}
function qwGraphObjectPoints(g,o){
 if(o.kind==='function')return Array.from({length:301},(_,i)=>{const x=g.xmin+(g.xmax-g.xmin)*i/300;return {x,y:qwEvaluateCurve({curveFamily:o.family,curve:o.curve},x)};});
 return o.vertices||[{x:o.x,y:o.y},...(['line','arrow'].includes(o.kind)?[{x:o.x2,y:o.y2}]:[])];
}
function qwHitGraph(g,p,tolerance=6){
 const b=QW_PLOT;if(p.x<b.left-tolerance||p.x>b.right+tolerance||p.y<b.top-tolerance||p.y>b.bottom+tolerance)return -1;
 for(let i=(g.elements||[]).length-1;i>=0;i--){
  const o=g.elements[i],ps=qwGraphObjectPoints(g,o).map(p=>qwPlotXY(g,p));
  const hit=o.kind==='point'?Math.hypot(p.x-ps[0].x,p.y-ps[0].y)<=tolerance+4:o.kind==='text'?p.x>=ps[0].x-tolerance&&p.x<=ps[0].x+Math.max(10,[...(o.label||'')].length*11)+tolerance&&p.y>=ps[0].y-20-tolerance&&p.y<=ps[0].y+5+tolerance:ps.slice(1).some((q,n)=>qwSegmentDistance(p,ps[n],q)<=tolerance+(o.style?.width||2)/2);
  if(hit)return g.points.length+i;
 }
 for(let i=g.points.length-1;i>=0;i--){const q=qwPlotXY(g,g.points[i]);if(Math.hypot(p.x-q.x,p.y-q.y)<=tolerance+4)return i;}
 return -1;
}
function qwTranslateGraphObject(o,dx,dy){
 const n=structuredClone(o);
 if(o.kind==='function'){
  if(o.family==='quadratic'){n.curve.b=o.curve.b-2*o.curve.a*dx;n.curve.c=o.curve.c+o.curve.a*dx*dx-o.curve.b*dx+dy;}
  else{n.curve.phase-=o.curve.frequency*dx;n.curve.offset+=dy;}
 }else if(o.vertices)n.vertices=o.vertices.map(p=>({x:p.x+dx,y:p.y+dy}));
 else{n.x+=dx;n.y+=dy;if(o.x2!==undefined){n.x2+=dx;n.y2+=dy;}}
 return n;
}
export {qwRotatePoint,qwObjectCenter,qwObjectPolygon,qwSegmentDistance,qwInPolygon,qwSpringPoints,qwHitObject,qwHitDiagram,qwValidDrag,qwObjectBounds,qwTranslateObject,qwInclineAngle,qwGraphObjectPoints,qwHitGraph,qwTranslateGraphObject,qwArcPoints,qwLinearSegments,qwExtendedSegment};
