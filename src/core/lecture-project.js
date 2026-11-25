import {qlValidate,qlDemo,qlSample} from './lecture-model.js';
const QL2_COLORS={ink:'#27384c',blue:'#6596c5',red:'#d96c65',green:'#56a58c',purple:'#8d79cf',gold:'#d49c53',pale:'#e3eaf2',white:'#ffffff'};
function ql2Assert(ok,msg){if(!ok)throw Error('QLECTURE: '+msg);}
function ql2Text(v,max=300){ql2Assert(typeof v==='string'&&v.length<=max,'некорректный текст');return v;}
function ql2Num(v,min=0,max=10000){ql2Assert(typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,'некорректное число');return v;}
function ql2Color(v){ql2Assert(typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v),'некорректный цвет');return v;}
function ql2Obj(v){ql2Assert(v&&typeof v==='object'&&!Array.isArray(v),'некорректный объект');return v;}
function ql2Arr(v,max){ql2Assert(Array.isArray(v)&&v.length<=max,'некорректный список');return v;}
function ql2Id(v){ql2Assert(typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v),'некорректный идентификатор');return v;}
function ql2Shape(s){
 ql2Obj(s);const t=s.kind;ql2Assert(['rect','circle','line','text'].includes(t),'неизвестная фигура');
 const v={id:ql2Id(s.id),kind:t,x:ql2Num(s.x,0,720),y:ql2Num(s.y,0,400),color:ql2Color(s.color)};
 if(t==='rect'){v.w=ql2Num(s.w,1,720);v.h=ql2Num(s.h,1,400);ql2Assert(v.x+v.w<=720&&v.y+v.h<=400,'прямоугольник за границей');}
 if(t==='circle'){v.r=ql2Num(s.r,1,200);ql2Assert(v.x-v.r>=0&&v.x+v.r<=720&&v.y-v.r>=0&&v.y+v.r<=400,'окружность за границей');}
 if(t==='line'){v.x2=ql2Num(s.x2,0,720);v.y2=ql2Num(s.y2,0,400);v.width=ql2Num(s.width,1,12);v.arrow=!!s.arrow;}
 if(t==='text'){v.text=ql2Text(s.text,120);v.size=ql2Num(s.size,10,64);v.align=s.align==='middle'?'middle':'start';}
 return v;
}
function ql2Unique(arr){const ids=new Set();for(const v of arr){ql2Assert(!ids.has(v.id),'повтор идентификатора');ids.add(v.id);}return arr;}
function ql2Visual(raw){
 ql2Obj(raw);const v={id:ql2Id(raw.id),kind:raw.kind,title:ql2Text(raw.title),caption:ql2Text(raw.caption??'',1000)};
 if(v.kind==='diagram'){v.shapes=ql2Unique(ql2Arr(raw.shapes,300).map(ql2Shape));}
 else if(v.kind==='graph'){v.demo=qlDemo(raw.demo);ql2Assert(v.demo.kind!=='photon','график поддерживает распад и ослабление');v.xLabel=ql2Text(raw.xLabel,60);v.yLabel=ql2Text(raw.yLabel,60);v.color=ql2Color(raw.color);v.progress=ql2Num(raw.progress??0,0,1);}
 else ql2Assert(false,'неизвестный тип иллюстрации');
 return v;
}
function ql2Validate(raw){
 ql2Obj(raw);ql2Assert(raw.format==='QLECTURE'&&(raw.version===1||raw.version===2),'неподдерживаемый формат');
 const v=qlValidate({...raw,version:1});
 ql2Assert(raw.mode===undefined||['lecture','script'].includes(raw.mode),'неизвестный режим');
 return {...v,version:2,mode:raw.mode??'script',scenes:v.scenes.map((s,i)=>({...s,visuals:ql2Unique(ql2Arr(raw.scenes[i].visuals??[],30).map(ql2Visual))}))};
}
function ql2Parse(text){ql2Assert(typeof text==='string'&&text.length<=8000000,'файл слишком большой');return ql2Validate(JSON.parse(text));}
function ql2Serialize(v){const s=JSON.stringify(ql2Validate(v),null,2);ql2Assert(s.length<=8000000,'файл слишком большой');return s;}
function ql2Timeline(raw){let t=0;return raw.scenes.map(s=>{const start=t;t+=s.durationSec;return {id:s.id,start,end:t};});}
function ql2Escape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
function ql2Svg(raw,progressOverride){
 const v=ql2Visual(raw),e=ql2Escape,C=QL2_COLORS;
 const text=(x,y,s,size=17,align='start',color=C.ink)=>'<text x="'+x+'" y="'+y+'" font-size="'+size+'" text-anchor="'+align+'" fill="'+color+'">'+e(s)+'</text>';
 let a='<svg xmlns="http://www.w3.org/2000/svg" width="720" height="400" viewBox="0 0 720 400" font-family="Arial, sans-serif"><rect width="720" height="400" fill="#ffffff"/>';
 const line=(x,y,x2,y2,c,w=2)=>'<line x1="'+x+'" y1="'+y+'" x2="'+x2+'" y2="'+y2+'" stroke="'+c+'" stroke-width="'+w+'" stroke-linecap="round"/>';
 const arrow=(x,y,x2,y2,c,w)=>{const d=Math.hypot(x2-x,y2-y);if(!d)return '';const ux=(x2-x)/d,uy=(y2-y)/d,h=Math.min(12,d*.4),bx=x2-h*ux,by=y2-h*uy;return line(x,y,bx,by,c,w)+'<path d="M '+x2+' '+y2+' L '+(bx-uy*h*.45)+' '+(by+ux*h*.45)+' L '+(bx+uy*h*.45)+' '+(by-ux*h*.45)+' Z" fill="'+c+'"/>';};
 if(v.kind==='diagram'){
  for(const s of v.shapes){
   a+='<g data-shape="'+s.id+'">';
   if(s.kind==='rect')a+='<rect x="'+s.x+'" y="'+s.y+'" width="'+s.w+'" height="'+s.h+'" rx="5" fill="'+s.color+'"/>';
   if(s.kind==='circle')a+='<circle cx="'+s.x+'" cy="'+s.y+'" r="'+s.r+'" fill="'+s.color+'"/>';
   if(s.kind==='line')a+=(s.arrow?arrow:line)(s.x,s.y,s.x2,s.y2,s.color,s.width);
   if(s.kind==='text')a+=text(s.x,s.y,s.text,s.size,s.align,s.color);
   a+='</g>';
  }
 }else{
  const L=78,R=615,T=52,B=320,m=v.demo.kind==='decay'?6:8,p=progressOverride??v.progress;
  ql2Num(p,0,1);
  a+=text(360,24,v.title,20,'middle');
  for(let k=0;k<=4;k++){const y=B-k*(B-T)/4;a+=line(L,y,R,y,C.pale,1)+text(L-10,y+5,k*25,13,'end');}
  for(let k=0;k<=m;k++){const x=L+k*(R-L)/m;a+=line(x,T,x,B,C.pale,1)+text(x,B+22,k,13,'middle');}
  a+=arrow(L,B,L,T-13,C.ink,2)+arrow(L,B,R+15,B,C.ink,2);
  a+=text(L,T-24,v.yLabel,15,'middle')+text(R+22,B+5,v.xLabel,15);
  const xy=u=>[L+(R-L)*u,B-(B-T)*qlSample(v.demo,u).fraction];
  a+='<path d="'+Array.from({length:161},(_,i)=>(i?'L':'M')+xy(i/160).join(' ')).join(' ')+'" fill="none" stroke="'+v.color+'" stroke-width="3"/>';
  const [x,y]=xy(p);a+=line(L,y,x,y,C.gold,1)+line(x,y,x,B,C.gold,1)+'<circle cx="'+x+'" cy="'+y+'" r="6" fill="'+C.gold+'"/>';
  const sample=qlSample(v.demo,p);
  a+=text(360,374,(100*sample.fraction).toFixed(2)+'% · '+(v.demo.kind==='decay'?'Среднее N = '+sample.expected.toFixed(2)+'; t = '+sample.time.toFixed(2)+' с':'x = '+sample.thickness.toFixed(2)+' усл. ед.'),16,'middle');
 }
 return a+'</svg>';
}
export {QL2_COLORS,ql2Shape,ql2Visual,ql2Validate,ql2Parse,ql2Serialize,ql2Timeline,ql2Escape,ql2Svg};
