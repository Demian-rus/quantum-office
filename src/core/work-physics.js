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
function qwPhysicsShape(o,interactive=false){
 const kind=o.kind;
 if(!QW_ELECTRICS.includes(kind)&&!QW_MECHANICS.includes(kind))return '';
 const x=Math.min(o.x,o.x2),y=Math.min(o.y,o.y2),w=Math.max(1,Math.abs(o.x2-o.x)),
  h=Math.max(1,Math.abs(o.y2-o.y)),cx=x+w/2,cy=y+h/2,
  stroke=o.style?.stroke||'#162735',width=o.style?.width||2,
  n=v=>Number(v.toFixed(3)),a=' stroke="'+stroke+'" stroke-width="'+width+'" fill="none" stroke-linecap="round" stroke-linejoin="round"',
  line=(x1,y1,x2,y2)=>'<line x1="'+n(x1)+'" y1="'+n(y1)+'" x2="'+n(x2)+'" y2="'+n(y2)+'"'+a+'/>',
  path=d=>'<path d="'+d+'"'+a+'/>',
  circle=(px,py,r,fill='white')=>'<circle cx="'+n(px)+'" cy="'+n(py)+'" r="'+n(r)+'" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+width+'"/>',
  rect=(rx,ry,rw,rh,fill='white')=>'<rect x="'+n(rx)+'" y="'+n(ry)+'" width="'+n(Math.max(1,rw))+'" height="'+n(Math.max(1,rh))+'" rx="1" fill="'+fill+'" stroke="'+stroke+'" stroke-width="'+width+'"/>';
 if(['forceVector','velocityVector','accelerationVector'].includes(kind)){
  const dx=o.x2-o.x,dy=o.y2-o.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,
   size=Math.min(13,Math.max(6,width*3.2)),ex=o.x2-ux*size,ey=o.y2-uy*size;
  return line(o.x,o.y,ex,ey)+
   '<path d="M'+n(o.x2)+' '+n(o.y2)+' L'+n(ex-uy*size*.42)+' '+n(ey+ux*size*.42)+
   ' L'+n(ex+uy*size*.42)+' '+n(ey-ux*size*.42)+' Z" fill="'+stroke+'"/>'+
   circle(o.x,o.y,Math.max(2,width*.9),stroke);
 }
 if(kind==='torque'){
  const r=Math.max(12,Math.min(w,h)/2),direction=o.direction==='ccw'?-1:1,
   from=direction>0?205:-25,to=direction>0?495:-315,
   steps=36,ps=Array.from({length:steps+1},(_,i)=>{
    const t=(from+(to-from)*i/steps)*Math.PI/180;
    return {x:cx+r*Math.cos(t),y:cy+r*Math.sin(t)};
   }),p=ps.at(-1),q=ps.at(-2),d=Math.hypot(p.x-q.x,p.y-q.y)||1,ux=(p.x-q.x)/d,uy=(p.y-q.y)/d,
   ex=p.x-ux*11,ey=p.y-uy*11;
  return path('M'+ps.slice(0,-1).map((p,i)=>(i?'L':'')+n(p.x)+' '+n(p.y)).join(' '))+
   '<path d="M'+n(p.x)+' '+n(p.y)+' L'+n(ex-uy*4.5)+' '+n(ey+ux*4.5)+
   ' L'+n(ex+uy*4.5)+' '+n(ey-ux*4.5)+' Z" fill="'+stroke+'"/>';
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
   out+=line(xx,bar,xx,y+h*.48)+rect(xx-gap*.34,y+h*.48,gap*.68,hh,'#f5f8fa');
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
  if(kind==='rheostat')out+=line(bodyL+bw*.15,cy+h*.45,bodyR-bw*.07,cy-h*.31)+
   '<path d="M'+n(bodyR-bw*.07)+' '+n(cy-h*.31)+' l-7 2 3 6 Z" fill="'+stroke+'"/>';
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
export {QW_MECHANICS,QW_ELECTRICS,QW_ELECTRIC_TERMINALS,qwDiagramPorts,qwPhysicsPortPoint,qwNearestDiagramPort,qwPhysicsShape};
