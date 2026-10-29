/** Bounded, offline Data Validation: dropdown list or inclusive numeric interval.
 * Deliberately validates direct raw writes, not formula results or source imports.
 */
import {uid,rectangle,cellName,parseCell,LIMITS} from './workbook.js';
const VLD_MAX=32,VLD_CELLS=4000;
function vldArea(rule){
 const rect=rule&&typeof rule.from==='string'&&typeof rule.to==='string'?rectangle(rule.from,rule.to):null;
 if(!rect||rect.r2>=LIMITS.rows||rect.c2>=LIMITS.columns||
    rect.r1<0||rect.c1<0||cellName(rect.r1,rect.c1)!==rule.from||
    cellName(rect.r2,rect.c2)!==rule.to||
    (rect.r2-rect.r1+1)*(rect.c2-rect.c1+1)>VLD_CELLS)
  throw Error('Диапазон проверки данных не должен превышать 4 000 ячеек');
 return rect;
}
export function validateDataRules(sheet){
 if(sheet.validations===undefined)return;
 if(!Array.isArray(sheet.validations)||sheet.validations.length>VLD_MAX)
  throw Error('Повреждены правила проверки данных');
 const ids=new Set();
 for(const rule of sheet.validations){
  if(!rule||typeof rule!=='object'||Array.isArray(rule)||
     typeof rule.id!=='string'||!rule.id||rule.id.length>100||ids.has(rule.id)||
     !['list','number'].includes(rule.kind)||
     Object.keys(rule).some(key=>!['id','from','to','kind','options','min','max'].includes(key)))
   throw Error('Повреждено правило проверки данных');
  const rect=vldArea(rule);
  if(rule.kind==='list'){
   if(rule.min!==undefined||rule.max!==undefined||!Array.isArray(rule.options)||
      rule.options.length<2||rule.options.length>30||
      rule.options.some(value=>typeof value!=='string'||!value.trim()||value!==value.trim()||
        value.length>100||value.startsWith('='))||
      new Set(rule.options).size!==rule.options.length)throw Error('Некорректные значения выпадающего списка');
  }else if(rule.options!==undefined||typeof rule.min!=='number'||typeof rule.max!=='number'||
      !Number.isFinite(rule.min)||!Number.isFinite(rule.max)||rule.min>rule.max)
   throw Error('Некорректный диапазон чисел');
  for(const prev of sheet.validations){
   if(prev===rule)break;
   const earlier=vldArea(prev);
   if(rect.r1<=earlier.r2&&rect.r2>=earlier.r1&&rect.c1<=earlier.c2&&rect.c2>=earlier.c1)
    throw Error('Правила проверки данных не должны пересекаться');
  }
  ids.add(rule.id);
 }
}
export function validationAt(sheet,ref){
 const p=parseCell(ref);if(!p)return null;
 for(const rule of sheet.validations||[]){
  const rect=vldArea(rule);
  if(p.row>=rect.r1&&p.row<=rect.r2&&p.col>=rect.c1&&p.col<=rect.c2)return rule;
 }
 return null;
}
export function checkValidatedInput(sheet,ref,value){
 const rule=validationAt(sheet,ref),text=String(value??'');
 if(!rule||text===''||text.startsWith('='))return; // formulas are calculated separately
 if(rule.kind==='list'){
  if(!rule.options.includes(text))throw Error('Недопустимое значение в '+ref+'. Выберите вариант из списка.');
 }else{
  const normalized=text.trim();
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)||
      !Number.isFinite(Number(normalized))||
      Number(normalized)<rule.min||Number(normalized)>rule.max)
   throw Error('Ячейка '+ref+': разрешены числа от '+rule.min+' до '+rule.max);
 }
}
export function addDataRule(sheet,from,to,kind,payload){
 if(!['list','number'].includes(kind))throw Error('Выберите тип проверки');
 const rect=rectangle(from,to);if(!rect)throw Error('Выделите диапазон ячеек');
 const rule={id:uid(),from:cellName(rect.r1,rect.c1),to:cellName(rect.r2,rect.c2),kind};
 if(kind==='list'){
  if(typeof payload!=='string'||payload.length>3099)throw Error('Слишком длинный список');
  rule.options=payload.split(/[;\n]/).map(v=>v.trim()).filter(Boolean);
 }else{
  const parts=typeof payload==='string'?payload.split(';').map(v=>v.trim()):[];
  if(parts.length!==2||parts.some(v=>!v||!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v)))
   throw Error('Укажите минимальное и максимальное число через ;');
  rule.min=Number(parts[0]);rule.max=Number(parts[1]);
 }
 const candidate={...sheet,validations:[...(sheet.validations||[]),rule]};
 validateDataRules(candidate);
 sheet.validations=candidate.validations;
 return rule;
}
export function deleteDataRule(sheet,id){
 const old=sheet.validations||[],filtered=old.filter(rule=>rule.id!==id);
 if(filtered.length===old.length)throw Error('Правило не найдено');
 sheet.validations=filtered;
}
export function shiftDataRules(sheet,axis,mode,index,count){
 return (sheet.validations||[]).map(rule=>{
  const r=vldArea(rule),a0=axis==='row'?r.r1:r.c1,b0=axis==='row'?r.r2:r.c2;
  const last=index+count-1;let a=a0,b=b0;
  if(mode==='insert'){
   if(index<=a0){a+=count;b+=count;}
   else if(index<=b0)b+=count;
  }else if(last<a0){a-=count;b-=count;}
  else if(index<=b0&&last>=a0){
   const removed=Math.min(last,b0)-Math.max(index,a0)+1;
   if(removed>=b0-a0+1)throw Error('Удаление уничтожит диапазон проверки данных');
   a=index<=a0?index:a0;b=b0-removed;
  }
  if(a<0||b>=(axis==='row'?LIMITS.rows:LIMITS.columns))throw Error('Правило проверки выйдет за пределы листа');
  const next={...rule,from:axis==='row'?cellName(a,r.c1):cellName(r.r1,a),
    to:axis==='row'?cellName(b,r.c2):cellName(r.r2,b)};
  vldArea(next);return next;
 });
}
