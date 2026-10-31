/** Shared, bounded text layout for canvas, object geometry and flat exports. */
export const STUDIO_FONTS=Object.freeze(['Segoe UI','Arial','Georgia','Verdana','Courier New']);
export function studioTextFont(o){const font=STUDIO_FONTS.includes(o.font)?o.font:'Segoe UI';return `${o.italic?'italic ':''}${o.bold?'700':'400'} ${o.size||30}px "${font}",${font==='Georgia'?'serif':font==='Courier New'?'monospace':'sans-serif'}`;}
export function layoutStudioText(o,measure){
 const size=o.size||30,spacing=Number(o.spacing)||0,lineHeight=o.lineHeight??1.25,limit=o.textBox?.width??Infinity;
 const segment=typeof Intl.Segmenter==='function'?new Intl.Segmenter('ru',{granularity:'grapheme'}):null;
 const chars=s=>segment?[...segment.segment(s)].map(x=>x.segment):Array.from(s);
 const width=arr=>arr.reduce((n,c,i)=>n+measure(c)+(i?spacing:0),0),lines=[];
 const push=a=>lines.push({text:a.join(''),chars:a,width:width(a)});
 for(const paragraph of String(o.text||'').split('\n')){
  let current=[],used=0;
  for(const ch of chars(paragraph)){
   let wrapped=false;const next=used+measure(ch)+(current.length?spacing:0);
   if(current.length&&next>limit){wrapped=true;let at=-1;for(let i=current.length-1;i>0;i--)if(/\s/u.test(current[i])){at=i;break;}
    if(at>0){const head=current.slice(0,at);while(head.length&&/\s/u.test(head.at(-1)))head.pop();push(head);current=current.slice(at+1);}
    else{push(current);current=[];}used=width(current);
   }
   if(!current.length&&/\s/u.test(ch)&&wrapped)continue;
   current.push(ch);used+=measure(ch)+(current.length>1?spacing:0);
  }push(current);
 }
 const w=Number.isFinite(limit)?Math.max(limit,...lines.map(l=>l.width)):Math.max(16,...lines.map(l=>l.width)),h=Math.max(o.textBox?.height||0,size*1.25+(lines.length-1)*size*lineHeight),x=o.points[0][0],y=o.points[0][1]-size;
 for(const [i,l]of lines.entries()){l.x=x+(o.align==='center'?(w-l.width)/2:o.align==='right'?w-l.width:0);l.y=y+size+i*size*lineHeight;}
 return {lines,bounds:{x,y,w,h}};
}
export function rgbaStudioColor(bytes){const [r,g,b,a]=bytes;return {hex:'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''),alpha:a/255};}
