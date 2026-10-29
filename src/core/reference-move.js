/** Rebase references for an *actual cut move*, not a copy.
 * Only individual references and fully-contained rectangular ranges can
 * maintain their original reference semantics without a full formula AST.
 * Reject partially intersected ranges rather than silently changing them.
 * This function preserves sheet qualifiers, case, $ anchors and string literals.
 */
import {parseCell,cellName} from './formulas.js';

const CUT_REF_RE=/(?<![A-Za-z0-9_.$])(?:(?:'((?:[^']|'')+)'|([A-Za-z_А-ЯЁ][A-Za-z0-9_.А-ЯЁ]*))!)?(\$?[A-Z]{1,3}\$?[1-9]\d*)(?::(\$?[A-Z]{1,3}\$?[1-9]\d*))?(?![A-Za-z0-9_.])/gi;
const CUT_TOKEN_RE=new RegExp('"(?:[^"]|"")*"|'+CUT_REF_RE.source,'gi');
const cutRefOverlaps=(a,b)=>a.r1<=b.r2&&a.r2>=b.r1&&a.c1<=b.c2&&a.c2>=b.c1;
const cutRefInside=(a,b)=>a.r1>=b.r1&&a.r2<=b.r2&&a.c1>=b.c1&&a.c2<=b.c2;
const cutRefKey=name=>String(name).toLocaleUpperCase('ru-RU');
const cutRefRect=(a,b)=>{
 const p=parseCell(a.replaceAll('$','')),q=parseCell(b.replaceAll('$',''));
 if(!p||!q||p.row>=100000||q.row>=100000||p.col>=100||q.col>=100)return null;
 return {r1:Math.min(p.row,q.row),r2:Math.max(p.row,q.row),c1:Math.min(p.col,q.col),c2:Math.max(p.col,q.col)};
};
const cutRefShifted=(reference,dr,dc)=>{
 const p=parseCell(reference.replaceAll('$',''));
 if(!p)return reference;
 const row=p.row+dr,col=p.col+dc;
 if(row<0||row>=100000||col<0||col>=100)throw Error('Перенос формулы выходит за границы таблицы');
 const colLetters=cellName(0,col).replace(/[0-9]+$/,'');
 const colLock=reference.startsWith('$')?'$':'';
 const rowLock=/\$[1-9]\d*$/.test(reference)?'$':'';
 return colLock+colLetters+rowLock+(row+1);
};
export function rebaseMovedFormula(value,formulaSheetName,sourceSheetName,sourceRect,rowDelta,colDelta){
 if(typeof value!=='string'||!value.startsWith('='))return value;
 let altered=false;
 const changed=value.replace(CUT_TOKEN_RE,(whole,quoted,unquoted,a,b)=>{
  if(whole.startsWith('"'))return whole;
  const sheet=quoted!==undefined?quoted.replaceAll("''","'"):unquoted;
  if(cutRefKey(sheet||formulaSheetName)!==cutRefKey(sourceSheetName))return whole;
  const refRect=cutRefRect(a,b||a);
  if(!refRect||!cutRefOverlaps(refRect,sourceRect))return whole;
  if(!cutRefInside(refRect,sourceRect))
   throw Error('Формула содержит диапазон, частично пересекающий перемещение. Сохранены исходные данные.');
  const colon=b?':'+cutRefShifted(b,rowDelta,colDelta):'';
  const prefix=sheet===undefined?'':whole.slice(0,whole.length-a.length-(b?b.length+1:0));
  altered=true;
  return prefix+cutRefShifted(a,rowDelta,colDelta)+colon;
 });
 if(changed.length>50000)throw Error('Формула после перемещения превышает лимит длины');
 return altered?changed:value;
}
