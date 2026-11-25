/* TASK161: pure physics/circuit symbols and connection-port geometry.
   This module has no DOM dependencies. Preview and print use the same SVG. */
const QW_MECHANICS=['forceVector','velocityVector','accelerationVector','torque','dynamometer','weightSet'];
const QW_ELECTRICS=['resistor','rheostat','cell','battery','lamp','switchOpen','switchClosed','ammeter','voltmeter','wireOrth','junction'];
const QW_ELECTRIC_TERMINALS=QW_ELECTRICS.filter(x=>!['wireOrth'].includes(x));
function qwPhysicsPortPoint(o,port){
 const x=Math.min(o.x,o.x2),y=Math.min(o.y,o.y2),w=Math.abs(o.x2-o.x),h=Math.abs(o.y2-o.y),
  cx=x+w/2,cy=y+h/2;
 const compact=o.kind==='junction',r=compact?0:0;
 const point=port==='L'?{x:x+r,y:cy}:port==='R'?{x:x+w-r,y:cy}:
  port==='U'?{x:cx,y:y+r}:{x:cx,y:y+h-r};
 const angle=(o.rotation||0)*Math.PI/180,dx=point.x-cx,dy=point.y-cy;
 return {x:cx+dx*Math.cos(angle)-dy*Math.sin(angle),
  y:cy+dx*Math.sin(angle)+dy*Math.cos(angle)};
}
function qwDiagramPorts(o){
 if(!o||!QW_ELECTRIC_TERMINALS.includes(o.kind))return [];
 return (o.kind==='junction'?['L','R','U','D']:['L','R']).map(port=>({port,...qwPhysicsPortPoint(o,port)}));
}
function qwNearestDiagramPort(objects,point,radius=16){
 let best=null,d=radius;
 for(const o of objects){
  if(!o.id)continue;
  for(const p of qwDiagramPorts(o)){
   const distance=Math.hypot(point.x-p.x,point.y-p.y);
   if(distance<d){best={id:o.id,port:p.port,x:p.x,y:p.y};d=distance;}
  }
 }
 return best;
}
// Shared geometry: logical endpoint is the filled tip; a butt-capped shaft
// reaches its base, never protruding. Short and two-ended arrows shrink heads.
function qwArrowGeometry(points,width=2,options={}){
 const ps=points.filter((p,i)=>!i||Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y)>1e-8);
 if(ps.length<2)return {shaft:[],heads:[]};
 const ds=[0];for(let i=1;i<ps.length;i++)ds.push(ds[i-1]+Math.hypot(ps[i].x-ps[i-1].x,ps[i].y-ps[i-1].y));
 const length=ds.at(-1),start=!!options.start,end=options.end!==false,count=Number(start)+Number(end);
 const size=Math.min(options.length??Math.max(7,width*6),length/(count||1)*.82);
 const sample=d=>{let i=1;while(i<ds.length-1&&ds[i]<d)i++;const k=(d-ds[i-1])/(ds[i]-ds[i-1]);return {x:ps[i-1].x+(ps[i].x-ps[i-1].x)*k,y:ps[i-1].y+(ps[i].y-ps[i-1].y)*k};};
 const lo=start?size:0,hi=end?length-size:length,shaft=[sample(lo),...ps.filter((_,i)=>ds[i]>lo&&ds[i]<hi),sample(hi)],heads=[];
 const head=(tip,base)=>{
  const dx=tip.x-base.x,dy=tip.y-base.y,len=Math.hypot(dx,dy);
  if(len<1e-8)return;
  const half=Math.min(options.halfWidth??Math.max(width*.85,size*.5),len*.75);
  heads.push({tip,base,vertices:[tip,{x:base.x-dy/len*half,y:base.y+dx/len*half},{x:base.x+dy/len*half,y:base.y-dx/len*half}]});
 };
 if(start)head(ps[0],shaft[0]);if(end)head(ps.at(-1),shaft.at(-1));
 return {shaft,heads};
}
function qwArrowSVG(points,stroke='#222222',width=2,options={}){
 const {shaft,heads}=qwArrowGeometry(points,width,options),n=v=>Number(v.toFixed(4)),xy=p=>n(p.x)+','+n(p.y);
 if(!shaft.length)return '';
 return '<g data-qw-arrow="true"><polyline data-qw-arrow-shaft="true" points="'+shaft.map(xy).join(' ')+'" fill="none" style="fill:none" stroke="'+stroke+'" stroke-width="'+width+'" stroke-linecap="butt" stroke-linejoin="round"/>'+
 heads.map(h=>'<polygon data-qw-arrow-head="true" data-qw-tip="'+xy(h.tip)+'" data-qw-base="'+xy(h.base)+'" points="'+h.vertices.map(xy).join(' ')+'" fill="'+stroke+'" stroke="none"/>').join('')+'</g>';
}
function qwPhysicsShape(o,interactive=false){
 const kind=o.kind;
 if(!QW_ELECTRICS.includes(kind)&&!QW_MECHANICS.includes(kind))return '';
 const x=Math.min(o.x,o.x2),y=Math.min(o.y,o.y2),w=Math.max(1,Math.abs(o.x2-o.x)),
  h=Math.max(1,Math.abs(o.y2-o.y)),cx=x+w/2,cy=y+h/2,
  stroke=o.style?.stroke||'#222222',width=o.style?.width||2,
  n=v=>Number(v.toFixed(3)),a=' stroke="'+stroke+'" stroke-width="'+width+'" fill="none" stroke-linecap="round" stroke-linejoin="round"',
  line=(x1,y1,x2,y2)=>'<line x1="'+n(x1)+'" y1="'+n(y1)+'" x2="'+n(x2)+'" y2="'+n(y2)+'"'+a+'/>',
  path=d=>'<path d="'+d+'"'+a+'/>',
  circle=(px,py,r,fill='white')=>'<circle cx="'+n(px)+'" cy="'+n(py)+'" r="'+n(r)+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+width+'"/>',
  rect=(rx,ry,rw,rh,fill='white')=>'<rect x="'+n(rx)+'" y="'+n(ry)+'" width="'+n(Math.max(1,rw))+'" height="'+n(Math.max(1,rh))+'" rx="1" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+width+'"/>';
 if(['forceVector','velocityVector','accelerationVector'].includes(kind)){
  return qwArrowSVG([{x:o.x,y:o.y},{x:o.x2,y:o.y2}],stroke,width,{length:Math.min(13,Math.max(6,width*3.2))})+
   circle(o.x,o.y,Math.max(2,width*.9),stroke);
 }
 if(kind==='torque'){
  const r=Math.max(12,Math.min(w,h)/2),direction=o.direction==='ccw'?-1:1,
   from=direction>0?205:-25,to=direction>0?495:-315,
   steps=36,ps=Array.from({length:steps+1},(_,i)=>{
    const t=(from+(to-from)*i/steps)*Math.PI/180;
    return {x:cx+r*Math.cos(t),y:cy+r*Math.sin(t)};
   });
  return qwArrowSVG(ps,stroke,width,{length:11,halfWidth:4.5});
 }
 if(kind==='dynamometer'){
  let result=rect(x+w*.24,y+h*.06,w*.52,h*.7);
  for(let i=0;i<=5;i++){const yy=y+h*(.16+i*.1);result+=line(x+w*.58,yy,x+w*(i%2?.65:.73),yy);}
  const tick=y+h*(.16+Math.min(1,(o.reading||0)/100)*.5);
  result+=line(x+w*.3,tick,x+w*.56,tick)+
   line(cx,y+h*.76,cx,y+h*.88)+
   path('M'+n(cx)+' '+n(y+h*.88)+' a'+n(w*.08)+' '+n(h*.07)+' 0 1 0 '+n(w*.12)+' '+n(h*.09));
  return result;
 }
 if(kind==='weightSet'){
  const count=o.count||2,gap=w/(count+1),bar=y+h*.13;
  let out=line(x+w*.06,bar,x+w*.94,bar);
  for(let i=0;i<count;i++){
   const xx=x+gap*(i+1),hh=h*(.42+((i%3)*.08));
   out+=line(xx,bar,xx,y+h*.48)+rect(xx-gap*.34,y+h*.48,gap*.68,hh,'#f5f5f5');
  }
  return out;
 }
 if(kind==='junction')return '<circle cx="'+n(cx)+'" cy="'+n(cy)+'" r="'+n(Math.max(3.5,width*2))+'" fill="'+stroke+'"/>';
 if(kind==='wireOrth'){
  const mid=o.bend===undefined?(o.x+o.x2)/2:o.bend;
  return path('M'+n(o.x)+' '+n(o.y)+' H'+n(mid)+' V'+n(o.y2)+' H'+n(o.x2));
 }
 // Circuit symbols keep a small lead on each side and connect at real ports.
 const bodyL=x+w*.29,bodyR=x+w*.71,bw=bodyR-bodyL,r=Math.min(h*.4,w*.2);
 let out=line(x,cy,bodyL,cy)+line(bodyR,cy,x+w,cy);
 if(kind==='resistor'||kind==='rheostat'){
  out+=rect(bodyL,cy-h*.23,bw,h*.46);
  if(kind==='rheostat')out+=qwArrowSVG([{x:bodyL+bw*.15,y:cy+h*.45},{x:bodyR-bw*.07,y:cy-h*.31}],stroke,width);
 }else if(kind==='cell'||kind==='battery'){
  out='';
  const count=kind==='cell'?1:3;
  for(let i=0;i<count;i++){
   const pos=x+w*(.35+.3*i/Math.max(1,count-1));
   out+=line(pos,cy-h*.34,pos,cy+h*.34)+line(pos+w*.045,cy-h*.19,pos+w*.045,cy+h*.19);
  }
  out+=line(x,cy,x+w*.35,cy)+line(x+w*(kind==='cell'?.395:.695),cy,x+w,cy);
 }else if(kind==='lamp'){
  out+=circle(cx,cy,r)+line(cx-r*.65,cy-r*.65,cx+r*.65,cy+r*.65)+line(cx+r*.65,cy-r*.65,cx-r*.65,cy+r*.65);
 }else if(kind==='ammeter'||kind==='voltmeter'){
  out+=circle(cx,cy,r);
  out+='<text x="'+n(cx)+'" y="'+n(cy+Math.min(8,r*.4))+
    '" text-anchor="middle" fill="'+stroke+'" font-family="Arial,sans-serif" font-size="'+n(Math.max(12,Math.min(24,r*.85)))+'">'+(kind==='ammeter'?'A':'V')+'</text>';
 }else if(kind==='switchOpen'||kind==='switchClosed'){
  out=line(x,cy,bodyL,cy)+line(bodyR,cy,x+w,cy);
  out+=circle(bodyL,cy,Math.max(2,width),stroke)+circle(bodyR,cy,Math.max(2,width),stroke);
  out+=line(bodyL,cy,bodyR,kind==='switchOpen'?cy-h*.36:cy);
 }
 if(interactive){
  out+=qwDiagramPorts({...o,rotation:0}).map(p=>'<circle data-qw-port="'+p.port+'" cx="'+n(p.x)+'" cy="'+n(p.y)+
   '" r="4.2" fill="white" stroke="#0871b9" stroke-width="1" vector-effect="non-scaling-stroke"/>').join('');
 }
 return out;
}
export {QW_MECHANICS,QW_ELECTRICS,QW_ELECTRIC_TERMINALS,qwDiagramPorts,qwPhysicsPortPoint,qwNearestDiagramPort,qwPhysicsShape,qwArrowGeometry,qwArrowSVG};
