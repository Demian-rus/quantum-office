/** TASK097: nondestructive photo geometry and deterministic RGBA operations. */
export const PHOTO_ADVANCED=Object.freeze({temperature:0,tint:0,highlights:0,shadows:0,gamma:1,sharpness:0,vignette:0});
export const PHOTO_LIMITS=Object.freeze({temperature:[-100,100],tint:[-100,100],highlights:[-100,100],shadows:[-100,100],gamma:[.2,3],sharpness:[0,100],vignette:[0,100]});
const photoClamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function fitPhotoCrop(c,ratio){
 if(!Number.isFinite(ratio)||ratio<=0)return {...c};
 let w=c.w,h=c.h;if(w/h>ratio)w=h*ratio;else h=w/ratio;
 if(w<.05||h<.05)throw Error('Эти пропорции оставляют менее 5% фотографии');
 return {x:c.x+(c.w-w)/2,y:c.y+(c.h-h)/2,w,h};
}
export function movePhotoCrop(c,dx,dy){return {...c,x:photoClamp(c.x+dx,0,1-c.w),y:photoClamp(c.y+dy,0,1-c.h)};}
export function zoomPhotoCrop(c,zoom){
 if(!Number.isFinite(zoom)||zoom<1||zoom>10)throw Error('Масштаб фотографии: от 1 до 10');
 const factor=Math.min(zoom,c.w/.05,c.h/.05),w=c.w/factor,h=c.h/factor;
 return {x:photoClamp(c.x+(c.w-w)/2,0,1-w),y:photoClamp(c.y+(c.h-h)/2,0,1-h),w,h};
}
export function framePhotoCrop(c,frame={}){const z=zoomPhotoCrop(c,frame.zoom??1);return {...z,x:z.x+(c.w-z.w)/2*(frame.panX??0),y:z.y+(c.h-z.h)/2*(frame.panY??0)};}
export function resizePhotoCrop(c,key,p,ratio=0){
 let x=c.x,y=c.y,w=c.w,h=c.h;const right=x+w,bottom=y+h;
 if(!ratio){if(key.includes('w')){x=photoClamp(p[0],0,right-.05);w=right-x;}if(key.includes('e'))w=photoClamp(p[0]-x,.05,1-x);if(key.includes('n')){y=photoClamp(p[1],0,bottom-.05);h=bottom-y;}if(key.includes('s'))h=photoClamp(p[1]-y,.05,1-y);return {x,y,w,h};}
 const sx=key.includes('w')?-1:1,sy=key.includes('n')?-1:1;
 const ax=key.includes('w')?right:key.includes('e')?x:x+w/2,ay=key.includes('n')?bottom:key.includes('s')?y:y+h/2;
 const horizontal=/[we]/.test(key),vertical=/[ns]/.test(key);
 w=horizontal?Math.max(.05,(p[0]-ax)*sx):Math.max(.05,(p[1]-ay)*sy)*ratio;
 if(horizontal&&vertical)w=Math.max(w,Math.max(.05,(p[1]-ay)*sy)*ratio);
 const maxW=horizontal?(sx<0?ax:1-ax):2*Math.min(ax,1-ax),maxH=vertical?(sy<0?ay:1-ay):2*Math.min(ay,1-ay);
 w=Math.min(w,maxW,maxH*ratio);h=w/ratio;
 if(w<.05||h<.05)return {...c};
 return {x:horizontal?(sx<0?ax-w:ax):ax-w/2,y:vertical?(sy<0?ay-h:ay):ay-h/2,w,h};
}
export function adjustPhotoPixels(input,width,height,adjust={}){
 if(!(input instanceof Uint8ClampedArray)||input.length!==width*height*4||!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>16777216)throw Error('Слишком большой буфер фотографии');
 const a={...PHOTO_ADVANCED,...adjust};for(const [k,[min,max]]of Object.entries(PHOTO_LIMITS))if(!Number.isFinite(a[k])||a[k]<min||a[k]>max)throw Error('Недопустимая коррекция '+k);
 const out=new Uint8ClampedArray(input),t=a.temperature/100,m=a.tint/100,sh=a.shadows/100,hi=a.highlights/100,v=a.vignette/100;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4;if(!input[i+3])continue;const l=(.2126*input[i]+.7152*input[i+1]+.0722*input[i+2])/255;
  const shadow=Math.pow(1-l,3)*sh*.5,light=Math.pow(l,3)*hi*.5;
  const radial=Math.min(1,Math.pow((x-(width-1)/2)/Math.max(1,width/2),2)+Math.pow((y-(height-1)/2)/Math.max(1,height/2),2)),shade=1-v*.75*radial*radial;
  for(let k=0;k<3;k++){let n=input[i+k]/255;n*=k===0?(1+.25*t+.1*m):k===2?(1-.25*t+.1*m):(1-.2*m);const tone=shadow+light;n+=tone*(tone>=0?1-n:n);out[i+k]=255*Math.pow(photoClamp(n,0,1),1/a.gamma)*shade;}
 }
 if(a.sharpness){const copy=new Uint8ClampedArray(out),s=a.sharpness/100;for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;if(!copy[i+3])continue;for(let k=0;k<3;k++){let total=0;for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const n=(photoClamp(y+dy,0,height-1)*width+photoClamp(x+dx,0,width-1))*4;total+=copy[n+3]?copy[n+k]:copy[i+k];}out[i+k]=copy[i+k]+s*(4*copy[i+k]-total);}}}
 return out;
}
