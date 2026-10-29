/** Conditional cell fills: a bounded rule set rendered without mutating source styles. */
import {uid,rectangle,cellName,LIMITS,resultOf} from './workbook.js';

export const CONDITIONAL_KINDS=['gt','lt','eq','contains','scale'];
const MAX_RULES=24,MAX_CELLS=1200;
const COLOR=/^#[0-9a-fA-F]{6}$/;
const conditionalNumber=value=>{
 const s=String(value??'').trim();
 return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)&&Number.isFinite(+s)?+s:null;
};
const area=rule=>{
 const rect=rule?.from&&rule?.to?rectangle(rule.from,rule.to):null;
 if(!rect||rect.r1<0||rect.c1<0||rect.r2>=LIMITS.rows||rect.c2>=LIMITS.columns||
    cellName(rect.r1,rect.c1)!==rule.from||cellName(rect.r2,rect.c2)!==rule.to||
    (rect.r2-rect.r1+1)*(rect.c2-rect.c1+1)>MAX_CELLS)
  throw Error('Диапазон условного форматирования ограничен 1 200 ячейками');
 return rect;
};
export function validateConditionalRules(sheet){
 if(sheet.conditionalRules===undefined)return;
 if(!Array.isArray(sheet.conditionalRules)||sheet.conditionalRules.length>MAX_RULES)
  throw Error('Повреждён список правил условного форматирования');
 const ids=new Set();
 for(const rule of sheet.conditionalRules){
  if(!rule||typeof rule!=='object'||Array.isArray(rule)||typeof rule.id!=='string'||
    rule.id.length<1||rule.id.length>100||ids.has(rule.id)||!CONDITIONAL_KINDS.includes(rule.kind)||
    Object.keys(rule).some(k=>!['id','kind','from','to','target','color'].includes(k)))
   throw Error('Повреждено правило условного форматирования');
  area(rule);
  if(rule.kind==='scale'){
   if(rule.target!==undefined||rule.color!==undefined)throw Error('Повреждена цветовая шкала');
  }else{
   if(typeof rule.target!=='string'||rule.target.length>150||!rule.target.trim()||
      rule.kind!=='contains'&&conditionalNumber(rule.target)===null||!COLOR.test(rule.color))
    throw Error('Недопустимое условие форматирования');
  }
  ids.add(rule.id);
 }
}
export function addConditionalRule(sheet,from,to,kind,target='',color='#e2f2dc'){
 if(!CONDITIONAL_KINDS.includes(kind))throw Error('Неизвестное условие');
 const r=rectangle(from,to);
 if(!r)throw Error('Выделите диапазон ячеек');
 const rule={id:uid(),kind,from:cellName(r.r1,r.c1),to:cellName(r.r2,r.c2)};
 if(kind!=='scale'){rule.target=String(target).trim();rule.color=color;}
 area(rule);
 const draft={...sheet,conditionalRules:[...(sheet.conditionalRules||[]),rule]};
 validateConditionalRules(draft);
 sheet.conditionalRules=draft.conditionalRules;
 return rule;
}
export function removeConditionalRule(sheet,id){
 const before=sheet.conditionalRules||[],next=before.filter(x=>x.id!==id);
 if(before.length===next.length)throw Error('Правило не найдено');
 sheet.conditionalRules=next;
}
export function prepareConditionalScales(sheet,raw,context){
 const stats=new Map();
 for(const rule of sheet.conditionalRules||[]){
  if(rule.kind!=='scale')continue;
  const r=area(rule);let lo=Infinity,hi=-Infinity;
  for(let row=r.r1;row<=r.r2;row++)for(let col=r.c1;col<=r.c2;col++){
   const value=conditionalNumber(resultOf(sheet,cellName(row,col),raw,context));
   if(value===null)continue;
   if(value<lo)lo=value;if(value>hi)hi=value;
  }
  stats.set(rule.id,Number.isFinite(lo)?{min:lo,max:hi}:null);
 }
 return stats;
}
const mix=(low,high,t)=>{
 const a=low.match(/\w\w/g).map(v=>parseInt(v,16)),b=high.match(/\w\w/g).map(v=>parseInt(v,16));
 return '#'+a.map((v,i)=>Math.round(v+(b[i]-v)*t).toString(16).padStart(2,'0')).join('');
};
/** Return only a display fill; never modify sheet.cells or getEffectiveStyle. */
export function conditionalFill(sheet,ref,value,scaleStats=new Map()){
 const p=/^([A-Z]+)([1-9]\d*)$/.exec(ref),pos=p?{row:+p[2]-1,col:0}:null;
 if(!pos)return null;for(const ch of p[1])pos.col=pos.col*26+ch.charCodeAt(0)-64;pos.col--;
 let fill=null;
 for(const rule of sheet.conditionalRules||[]){
  const r=area(rule);
  if(pos.row<r.r1||pos.row>r.r2||pos.col<r.c1||pos.col>r.c2)continue;
  if(rule.kind==='scale'){
   const bounds=scaleStats.get(rule.id),n=conditionalNumber(value);
   if(bounds&&n!==null){const t=bounds.max===bounds.min?1:Math.max(0,Math.min(1,(n-bounds.min)/(bounds.max-bounds.min)));
    fill=mix('#f7e2dc','#5fb486',t);}
   continue;
  }
  const n=conditionalNumber(value),threshold=conditionalNumber(rule.target);
  const match=rule.kind==='gt'&&n!==null&&n>threshold||
    rule.kind==='lt'&&n!==null&&n<threshold||
    rule.kind==='eq'&&(n!==null&&threshold!==null?n===threshold:String(value).toLocaleLowerCase('ru-RU')===rule.target.toLocaleLowerCase('ru-RU'))||
    rule.kind==='contains'&&String(value).toLocaleLowerCase('ru-RU').includes(rule.target.toLocaleLowerCase('ru-RU'));
  if(match)fill=rule.color;
 }
 return fill;
}
/** Structural edits shift ranges or refuse dangerous cuts; caller owns the transaction. */
export function shiftConditionalRules(sheet,axis,mode,index,count){
 return (sheet.conditionalRules||[]).map(rule=>{
  const r=area(rule),start=axis==='row'?r.r1:r.c1,end=axis==='row'?r.r2:r.c2;
  const last=index+count-1;let a=start,b=end;
  if(mode==='insert'){if(index<=start){a+=count;b+=count;}else if(index<=end)b+=count;}
  else if(last<start){a-=count;b-=count;}
  else if(index<=end&&last>=start){
   const lost=Math.min(last,end)-Math.max(start,index)+1;
   if(end-start+1<=lost)throw Error('Удаление уничтожит диапазон условного форматирования');
   a=index<=start?index:start;b=end-lost;
  }
  if(a<0||b>=(axis==='row'?LIMITS.rows:LIMITS.columns))
   throw Error('Правило выйдет за границы листа');
  const next={...rule,from:axis==='row'?cellName(a,r.c1):cellName(r.r1,a),
   to:axis==='row'?cellName(b,r.c2):cellName(r.r2,b)};
  area(next);return next;
 });
}
