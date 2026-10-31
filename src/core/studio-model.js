/** TASK095: pure, version-one-compatible Studio geometry and project validation. */
export const PHOTO_DEFAULTS=Object.freeze({brightness:100,contrast:100,saturation:100,exposure:0,blur:0,intensity:100,filter:'none'});
export function photoFilter(adjust={}){
 const a={...PHOTO_DEFAULTS,...adjust},strength=a.intensity/100;
 const fx=a.filter==='mono'?` grayscale(${strength})`:a.filter==='sepia'?` sepia(${strength})`:a.filter==='vivid'?` saturate(${1+strength}) contrast(${1+.15*strength})`:'';
 return `brightness(${a.brightness*Math.pow(2,a.exposure)}%) contrast(${a.contrast}%) saturate(${a.saturation}%) blur(${a.blur}px)`+fx;
}
export function photoCrop(left,top,right,bottom){
 const v=[left,top,right,bottom].map(Number);
 if(v.some(x=>!Number.isFinite(x)||x<0||x>95)||v[0]+v[2]>95||v[1]+v[3]>95)throw Error('Оставьте не менее 5% ширины и высоты фотографии');
 return {x:v[0]/100,y:v[1]/100,w:1-(v[0]+v[2])/100,h:1-(v[1]+v[3])/100};
}
export function rotatePoint(p,c,degrees){const r=degrees*Math.PI/180,cs=Math.cos(r),sn=Math.sin(r);return [c[0]+(p[0]-c[0])*cs-(p[1]-c[1])*sn,c[1]+(p[0]-c[0])*sn+(p[1]-c[1])*cs];}
export function validateStudioProject(value){
 const fail=()=>{throw Error('Некорректный проект QSTUDIO: данные не изменены');};
 if(!value||value.version!==1||!Array.isArray(value.strokes)||value.strokes.length>5000)fail();
 for(const key of ['width','height'])if(!Number.isInteger(value[key])||value[key]<64||value[key]>4096)fail();
 const finite=(x,min=-100000,max=100000)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
 const color=x=>typeof x==='string'&&/^#[\da-f]{6}$/i.test(x);
 const image=x=>typeof x==='string'&&(!x||/^data:image\/(png|jpeg|webp);base64,[\da-z+/=\s]+$/i.test(x));
 if(value.bg!==undefined&&!color(value.bg))fail();if(value.imageSrc!==undefined&&!image(value.imageSrc))fail();
 const checkAdjust=a=>{if(a===undefined)return;if(!a||typeof a!=='object')fail();for(const [key,min,max] of [['brightness',0,200],['contrast',0,200],['saturation',0,200],['exposure',-3,3],['blur',0,20],['intensity',0,100]])if(a[key]!==undefined&&!finite(a[key],min,max))fail();if(a.filter!==undefined&&!['none','mono','sepia','vivid'].includes(a.filter))fail();};
 checkAdjust(value.adjust);const ids=new Set();let points=0;
 for(const o of value.strokes){
  if(!o||typeof o.id!=='string'||!o.id||ids.has(o.id)||!['rect','ellipse','line','brush','text','image','triangle'].includes(o.tool)||!Array.isArray(o.points)||!o.points.length)fail();ids.add(o.id);
  points+=o.points.length;if(points>300000)fail();
  for(const p of o.points)if(!Array.isArray(p)||p.length!==2||!p.every(x=>finite(x)))fail();
  if(o.size!==undefined&&!finite(o.size,.1,1000))fail();if(o.opacity!==undefined&&!finite(o.opacity,0,1))fail();if(o.rotation!==undefined&&!finite(o.rotation,-36000,36000))fail();if(o.color!==undefined&&!color(o.color))fail();
  if(o.tool==='image'){if(!image(o.src)||!o.src||!finite(o.w,1,100000)||!finite(o.h,1,100000))fail();checkAdjust(o.adjust);if(o.crop){const c=o.crop;if(!['x','y','w','h'].every(k=>finite(c[k],0,1))||c.w<.05||c.h<.05||c.x+c.w>1.00001||c.y+c.h>1.00001)fail();}}
  if(o.tool==='text'&&(typeof o.text!=='string'||o.text.length>10000))fail();
 }
 return structuredClone(value);
}
