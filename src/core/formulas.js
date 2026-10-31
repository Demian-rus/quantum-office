import {dateSerial,serialDateParts,timeSerial,serialTimeParts} from './dates.js';

/** Bounded formula interpreter. No eval/Function/network, safe for untrusted sheets. */
export function colLabel(n) {
  let result = '';
  for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) result = String.fromCharCode(65 + ((x - 1) % 26)) + result;
  return result;
}
export function cellName(row, col) { return `${colLabel(col)}${row + 1}`; }
export function parseCell(ref) {
  const match = /^([A-Z]+)([1-9]\d*)$/.exec(String(ref).toUpperCase());
  if (!match) return null;
  let col = 0;
  for (const letter of match[1]) col = col * 26 + letter.charCodeAt(0) - 64;
  return { row: Number(match[2]) - 1, col: col - 1 };
}
const REF = /^\$?[A-Z]+\$?[1-9]\d*$/;
const FORMULA_LIMITS = {rows:100000, cols:100, tokens:2000, depth:80, range:10000};
function tokensOf(formula) {
  if (formula.length > 10000) throw Error('#ERROR!');
  const tokens=[];let pos=0;
  const re = /'(?:[^']|'')*'!|[A-Z_А-ЯЁ][A-Z0-9_.А-ЯЁ]*!|(?:\d+(?:\.\d+)?|\.\d+)(?:[Ee][+\-]?\d+)?|\$?[A-Z]+\$?[1-9]\d*|[A-Z_][A-Z0-9_.]*|<=|>=|<>|[()+\-*/,:;&=<>&]/iy;
  while (pos<formula.length) {
    if (/\s/.test(formula[pos])) {pos++;continue;}
    if (formula[pos]==='"') {
      let value='',ended=false;pos++;
      while(pos<formula.length){const ch=formula[pos++];if(ch==='"'){if(formula[pos]==='"'){value+='"';pos++;}else{ended=true;break;}}else value+=ch;}
      if(!ended)throw Error('#ERROR!');tokens.push({type:'string',value});
    } else {
      re.lastIndex=pos;const match=re.exec(formula);
      if(!match)throw Error('#ERROR!');const value=match[0].toUpperCase();
      tokens.push({type:'token',value});pos=re.lastIndex;
    }
    if(tokens.length>FORMULA_LIMITS.tokens)throw Error('#ERROR!');
  }
  return tokens;
}
function address(ref) {
  const a=parseCell(ref.replaceAll('$',''));
  if(!a||a.row<0||a.col<0||a.row>=FORMULA_LIMITS.rows||a.col>=FORMULA_LIMITS.cols)throw Error('#REF!');
  return a;
}
function rangeRefs(a,b){const x=address(a),y=address(b),count=(Math.abs(x.row-y.row)+1)*(Math.abs(x.col-y.col)+1);
  if(count>FORMULA_LIMITS.range)throw Error('#ERROR!');const refs=[];
  for(let row=Math.min(x.row,y.row);row<=Math.max(x.row,y.row);row++)
    for(let col=Math.min(x.col,y.col);col<=Math.max(x.col,y.col);col++)refs.push(cellName(row,col));
  return refs;
}
function parseFormula(source){const tokens=tokensOf(source);let i=0,depth=0;
  const at=()=>tokens[i]?.value;
  const eat=value=>{if(at()===value){i++;return true;}return false;};
  const expect=value=>{if(!eat(value))throw Error('#ERROR!');};
  function limited(parser){if(++depth>FORMULA_LIMITS.depth)throw Error('#ERROR!');try{return parser();}finally{depth--;}}
  function comparison(){return limited(()=>{let n=concat();while(['=','<>','>','<','>=','<='].includes(at())){const op=tokens[i++].value;n={kind:'binary',op,left:n,right:concat()};}return n;});}
  function concat(){let n=add();while(eat('&'))n={kind:'binary',op:'&',left:n,right:add()};return n;}
  function add(){let n=mul();while(at()==='+'||at()==='-'){const op=tokens[i++].value;n={kind:'binary',op,left:n,right:mul()};}return n;}
  function mul(){let n=unary();while(at()==='*'||at()==='/'){const op=tokens[i++].value;n={kind:'binary',op,left:n,right:unary()};}return n;}
  function unary(){if(eat('-'))return {kind:'unary',op:'-',arg:unary()};if(eat('+'))return {kind:'unary',op:'+',arg:unary()};return primary();}
  function primary(){return limited(()=>{
    if(eat('(')){const n=comparison();expect(')');return n;}
    const t=tokens[i++];if(!t)throw Error('#ERROR!');
    if(t.type==='string')return {kind:'literal',value:t.value};
    const value=t.value;
    if(/^(?:\d|\.)/.test(value))return {kind:'literal',value:Number(value)};
    let sheet=null, ref=value;
    if(value.endsWith('!')){
      sheet=value.startsWith("'")?value.slice(1,-2).replaceAll("''", "'"):value.slice(0,-1);
      if(!sheet||sheet.length>100)throw Error('#REF!');
      const next=tokens[i++];if(!next||next.type!=='token'||!REF.test(next.value))throw Error('#ERROR!');
      ref=next.value;
    }
    if(REF.test(ref)){address(ref);if(eat(':')){const end=tokens[i++];if(!end||!REF.test(end.value))throw Error('#ERROR!');rangeRefs(ref,end.value);return {kind:'range',sheet,from:ref,to:end.value};}return {kind:'ref',sheet,ref};}
    if(value==='TRUE'||value==='FALSE')return {kind:'literal',value:value==='TRUE'};
    if(/^[A-Z_][A-Z0-9_.]*$/.test(value)){
      if(value.includes('.'))throw Error('#ERROR!');if(!eat('('))throw Error('#NAME?');const args=[];
      if(!eat(')')){do{args.push(comparison());if(args.length>100)throw Error('#ERROR!');}while(eat(',')||eat(';'));expect(')');}
      return {kind:'call',name:value,args};
    }
    throw Error('#ERROR!');
  });}
  const root=comparison();if(i!==tokens.length)throw Error('#ERROR!');return root;
}
/** Ephemeral workbook snapshot: no cache is serialized or shared after an edit. */
export function createCalculationSession(){
 const d=new Date();
 return {results:new Map(),ast:new Map(),dependencies:new Map(),dependents:new Map(),edges:0,graphComplete:true,cycleVersion:0,today:dateSerial(d.getFullYear(),d.getMonth()+1,d.getDate()),stats:{evaluated:0,parsed:0,hits:0,edges:0}};
}
const identityFor=(sheet,ref)=>sheet.toLocaleUpperCase('ru-RU')+'!'+String(ref).replaceAll('$','').toUpperCase();
const MAX_GRAPH_EDGES=120000;
function trackDependency(ctx,visiting,ref,sheet){
 const state=ctx?.calculation;if(!state?.graphComplete||!visiting.size)return;
 const source=Array.from(visiting).at(-1),target=identityFor(sheet,ref);
 let deps=state.dependencies.get(source);
 if(!deps){deps=new Set();state.dependencies.set(source,deps);}
 if(deps.has(target))return;
 if(state.edges>=MAX_GRAPH_EDGES){state.graphComplete=false;return;}
 deps.add(target);
 let rev=state.dependents.get(target);
 if(!rev){rev=new Set();state.dependents.set(target,rev);}
 rev.add(source);state.edges++;state.stats.edges++;
}
function forgetDependencies(state,identity){
 const deps=state.dependencies.get(identity);
 if(!deps)return;
 for(const target of deps){
  const rev=state.dependents.get(target);rev?.delete(identity);
  if(rev?.size===0)state.dependents.delete(target);
  state.edges--;
 }
 state.dependencies.delete(identity);
}
/** Modify only a calculation snapshot (NOT the saved book). */
export function updateCalculationValue(ctx,sheetName,ref,value){
 const state=ctx?.calculation;
 if(!state?.graphComplete)throw Error('Граф зависимостей неполон: создайте новый снимок');
 const target=ctx.sheets?.get(String(sheetName).toLocaleUpperCase('ru-RU'));
 const p=parseCell(String(ref).replaceAll('$',''));
 if(!target||!p||p.row>=FORMULA_LIMITS.rows||p.col>=FORMULA_LIMITS.cols||typeof value!=='string'||value.length>50000)throw Error('Недопустимая ячейка');
 const cell=cellName(p.row,p.col),root=identityFor(target.name,cell),dirty=new Set([root]),queue=[root];
 for(let i=0;i<queue.length;i++)for(const dependent of state.dependents.get(queue[i])||[]){
  if(!dirty.has(dependent)){dirty.add(dependent);queue.push(dependent);}
 }
 target.cells[cell]=value;
 for(const key of dirty){state.results.delete(key);state.ast.delete(key);}
 for(const key of dirty)forgetDependencies(state,key);
 return dirty.size;
}
const isError=value=>typeof value==='string'&&/^#(?:REF!|DIV\/0!|VALUE!|NAME\?|CYCLE!|ERROR!|N\/A|NUM!)/.test(value);
const numericLike=v=>typeof v==='number'||typeof v==='boolean'||v===''||(typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v)));
const toNumber=value=>{if(isError(value))throw Error(value);if(value===''||value===null)return 0;if(typeof value==='boolean')return value?1:0;const n=Number(value);if(!Number.isFinite(n))throw Error('#VALUE!');return n;};
const toText=value=>{if(isError(value))throw Error(value);if(value===null||value===undefined)return '';if(typeof value==='boolean')return value?'TRUE':'FALSE';return String(value);};
const truth=value=>{if(isError(value))throw Error(value);if(typeof value==='boolean')return value;if(value===''||value===null)return false;return numericLike(value)?toNumber(value)!==0:toText(value).toUpperCase()!=='FALSE';};
const compare=(a,b)=>{if(isError(a))throw Error(a);if(isError(b))throw Error(b);if(numericLike(a)&&numericLike(b)){const av=toNumber(a),bv=toNumber(b);return av===bv?0:av>bv?1:-1;}return toText(a).localeCompare(toText(b), 'ru',{sensitivity:'base',numeric:false});};
function wildcardMatch(text,pattern){
  const hay=toText(text).toLocaleLowerCase('ru-RU'),needle=pattern.toLocaleLowerCase('ru-RU');
  let i=0,j=0,star=-1,backtrack=0;
  while(i<hay.length){
    if(j<needle.length&&(needle[j]==='?'||needle[j]===hay[i])){i++;j++;}
    else if(j<needle.length&&needle[j]==='*'){star=j++;backtrack=i;}
    else if(star!==-1){j=star+1;i=++backtrack;}
    else return false;
  }
  while(needle[j]==='*')j++;
  return j===needle.length;
}
function matches(actual,criterion){
  if(isError(actual))throw Error(actual);
  const raw=toText(criterion);if(raw.length>512)throw Error('#VALUE!');
  const match=/^(<=|>=|<>|=|<|>)([\s\S]*)$/.exec(raw);
  const op=match?.[1]||'=',expected=match?match[2]:criterion;
  if(typeof expected==='string'&&/[?*]/.test(expected)&&['=','<>'].includes(op)){
    const ok=wildcardMatch(actual,expected);return op==='='?ok:!ok;
  }
  const cmp=compare(actual,expected);
  return op==='='?cmp===0:op==='<>'?cmp!==0:op==='<'?cmp<0:op==='>'?cmp>0:op==='<='?cmp<=0:cmp>=0;
}

function evaluateNode(node,cells,visiting,context){
  const ev=n=>evaluateNode(n,cells,visiting,context);
  const valueOfRef=(r,sheet=null)=>{
    const ref=r.replaceAll('$','');
    let target=cells,targetContext=context;
    if(sheet!==null){
      const match=context?.sheets?.get(sheet.toLocaleUpperCase('ru-RU'));
      if(!match)throw Error('#REF!');
      target=match.cells;targetContext={...context,sheetName:match.name};
    }
    trackDependency(context,visiting,ref,targetContext?.sheetName||context?.sheetName||'');
    const v=evaluateCell(ref,target,visiting,targetContext);if(isError(v))throw Error(v);return v;
  };
  const values=n=>n.kind==='range'?rangeRefs(n.from,n.to).map(ref=>valueOfRef(ref,n.sheet)):[ev(n)];
  const flattened=args=>args.flatMap(values);
  if(node.kind==='literal')return node.value;
  if(node.kind==='ref')return valueOfRef(node.ref,node.sheet);
  if(node.kind==='range')throw Error('#VALUE!');
  if(node.kind==='unary')return node.op==='-'?-toNumber(ev(node.arg)):toNumber(ev(node.arg));
  if(node.kind==='binary'){
    const a=ev(node.left),b=ev(node.right);
    if(node.op==='&')return toText(a)+toText(b);
    if(['=','<>','<','>','<=','>='].includes(node.op)){const diff=compare(a,b);return node.op==='='?diff===0:node.op==='<>'?diff!==0:node.op==='<'?diff<0:node.op==='>'?diff>0:node.op==='<='?diff<=0:diff>=0;}
    const x=toNumber(a),y=toNumber(b);if(node.op==='/'&&y===0)throw Error('#DIV/0!');
    return node.op==='+'?x+y:node.op==='-'?x-y:node.op==='*'?x*y:x/y;
  }
  const {name,args}=node;
  const requireArgs=(min,max=min)=>{if(args.length<min||args.length>max)throw Error('#ERROR!');};
  if(name==='IF'){requireArgs(2,3);return truth(ev(args[0]))?ev(args[1]):args.length===3?ev(args[2]):false;}
  if(name==='IFERROR'){requireArgs(2);try{const answer=ev(args[0]);return isError(answer)?ev(args[1]):answer;}catch(e){if(String(e.message).startsWith('#'))return ev(args[1]);throw e;}}
  if(name==='AND'||name==='OR'){if(!args.length)throw Error('#ERROR!');if(name==='AND'){for(const a of args)if(!truth(ev(a)))return false;return true;}for(const a of args)if(truth(ev(a)))return true;return false;}
  if(name==='NOT'){requireArgs(1);return !truth(ev(args[0]));}
  if(name==='COUNTIF'||name==='SUMIF'){
    requireArgs(name==='SUMIF'?2:2,name==='SUMIF'?3:2);
    if(args[0].kind!=='range')throw Error('#VALUE!');
    const refs=rangeRefs(args[0].from,args[0].to);const rule=ev(args[1]);
    let targets=refs,targetSheet=args[0].sheet;
    if(name==='SUMIF'&&args[2]){
      targetSheet=args[2].sheet;
      if(args[2].kind!=='range')throw Error('#VALUE!');
      const criterionFrom=address(args[0].from),criterionTo=address(args[0].to),sumFrom=address(args[2].from);
      if(criterionFrom.row>criterionTo.row||criterionFrom.col>criterionTo.col)throw Error('#VALUE!');
      targets=refs.map(ref=>{const a=address(ref);const row=sumFrom.row+a.row-criterionFrom.row,col=sumFrom.col+a.col-criterionFrom.col;
        if(row>=FORMULA_LIMITS.rows||col>=FORMULA_LIMITS.cols)throw Error('#REF!');return cellName(row,col);});
    }
    let count=0,total=0;for(let i=0;i<refs.length;i++)if(matches(valueOfRef(refs[i],args[0].sheet),rule)){
      count++;if(name==='SUMIF'){const v=valueOfRef(targets[i],targetSheet);if(numericLike(v))total+=toNumber(v);}
    }
    return name==='COUNTIF'?count:total;
  }
  // TASK081: structured lookup and criteria functions. Every reference is resolved
  // through valueOfRef so cross-sheet evaluation, errors, cycles and dependencies work.
  const gridOf=n=>{
    if(n.kind!=='range'&&n.kind!=='ref')throw Error('#VALUE!');
    const a=address(n.from||n.ref),b=address(n.to||n.ref);
    const r1=Math.min(a.row,b.row),r2=Math.max(a.row,b.row),
      c1=Math.min(a.col,b.col),c2=Math.max(a.col,b.col);
    if((r2-r1+1)*(c2-c1+1)>FORMULA_LIMITS.range)throw Error('#VALUE!');
    return {r1,r2,c1,c2,rows:r2-r1+1,cols:c2-c1+1,sheet:n.sheet||null};
  };
  const gridValue=(g,r,c)=>valueOfRef(cellName(g.r1+r,g.c1+c),g.sheet);
  const gridSame=(a,b)=>a.rows===b.rows&&a.cols===b.cols;
  const linear=(g)=>{
    if(g.rows!==1&&g.cols!==1)throw Error('#VALUE!');
    const length=Math.max(g.rows,g.cols);
    return Array.from({length},(_,i)=>gridValue(g,g.rows===1?0:i,g.rows===1?i:0));
  };
  const lookupEqual=(a,b)=>compare(a,b)===0;
  if(name==='COUNTIFS'||name==='SUMIFS'||name==='AVERAGEIFS'){
    const offset=name==='COUNTIFS'?0:1;
    if(args.length<offset+2||(args.length-offset)%2!==0||(args.length-offset)>20)throw Error('#ERROR!');
    const base=name==='COUNTIFS'?gridOf(args[0]):gridOf(args[1]);
    const groups=[];
    for(let i=offset;i<args.length;i+=2){
      const range=gridOf(args[i]);
      if(!gridSame(base,range))throw Error('#VALUE!');
      groups.push([range,ev(args[i+1])]);
    }
    const sum=name==='COUNTIFS'?null:gridOf(args[0]);
    if(sum&&!gridSame(base,sum))throw Error('#VALUE!');
    let count=0,total=0;
    for(let r=0;r<base.rows;r++)for(let c=0;c<base.cols;c++){
      let accepted=true;
      for(const [range,criterion] of groups){
        if(!matches(gridValue(range,r,c),criterion)){accepted=false;break;}
      }
      if(!accepted)continue;
      if(name==='COUNTIFS'){count++;continue;}
      const value=gridValue(sum,r,c);
      if(value!==''&&numericLike(value)){count++;total+=toNumber(value);}
    }
    return name==='COUNTIFS'?count:name==='SUMIFS'?total:count?total/count:'#DIV/0!';
  }
  if(name==='VLOOKUP'||name==='HLOOKUP'){
    requireArgs(3,4);
    const key=ev(args[0]),table=gridOf(args[1]),index=toNumber(ev(args[2]));
    const vertical=name==='VLOOKUP',limit=vertical?table.cols:table.rows,
      length=vertical?table.rows:table.cols;
    if(!Number.isInteger(index)||index<1)throw Error('#VALUE!');
    if(index>limit)throw Error('#REF!');
    const exact=args.length===4?!truth(ev(args[3])):false;
    let best=-1;
    for(let k=0;k<length;k++){
      const value=vertical?gridValue(table,k,0):gridValue(table,0,k);
      if(lookupEqual(value,key)){best=k;break;}
      if(!exact&&compare(value,key)<0)best=k;
    }
    if(best<0)throw Error('#N/A');
    return vertical?gridValue(table,best,index-1):gridValue(table,index-1,best);
  }
  if(name==='MATCH'){
    requireArgs(2,3);
    const key=ev(args[0]),hay=linear(gridOf(args[1])),mode=args[2]?toNumber(ev(args[2])):1;
    if(![-1,0,1].includes(mode))throw Error('#VALUE!');
    let best=-1;
    for(let i=0;i<hay.length;i++){
      if(mode===0&&typeof key==='string'&&/[?*]/.test(key)){
        if(wildcardMatch(hay[i],key))return i+1;
      }else if(lookupEqual(hay[i],key))return i+1;
      const difference=compare(hay[i],key);
      if(mode===1&&difference<0&& (best<0||compare(hay[i],hay[best])>0))best=i;
      if(mode===-1&&difference>0&& (best<0||compare(hay[i],hay[best])<0))best=i;
    }
    if(best<0)throw Error('#N/A');return best+1;
  }
  if(name==='INDEX'){
    requireArgs(2,3);
    const table=gridOf(args[0]);let row=toNumber(ev(args[1])),col=args[2]?toNumber(ev(args[2])):1;
    if(table.rows===1&&table.cols>1&&args.length===2){col=row;row=1;}
    if(!Number.isInteger(row)||!Number.isInteger(col)||row<1||col<1)throw Error('#VALUE!');
    if(row>table.rows||col>table.cols)throw Error('#REF!');
    return gridValue(table,row-1,col-1);
  }
  if(name==='XLOOKUP'){
    requireArgs(3,6);
    const key=ev(args[0]),look=linear(gridOf(args[1])),data=linear(gridOf(args[2]));
    if(look.length!==data.length)throw Error('#VALUE!');
    const mode=args[4]?toNumber(ev(args[4])):0,search=args[5]?toNumber(ev(args[5])):1;
    if(![-1,0,1,2].includes(mode)||![1,-1].includes(search))throw Error('#VALUE!');
    let candidate=-1;
    const indices=Array.from({length:look.length},(_,i)=>search===1?i:look.length-i-1);
    for(const i of indices){
      const value=look[i],equal=mode===2&&typeof key==='string'?
        wildcardMatch(value,key):lookupEqual(value,key);
      if(equal)return data[i];
      if(mode===-1&&compare(value,key)<0&& (candidate<0||compare(value,look[candidate])>0))candidate=i;
      if(mode===1&&compare(value,key)>0&& (candidate<0||compare(value,look[candidate])<0))candidate=i;
    }
    if(candidate>=0)return data[candidate];
    return args.length>=4?ev(args[3]):'#N/A';
  }
  if(name==='LEFT'||name==='RIGHT'){
    requireArgs(1,2);
    const chars=Array.from(toText(ev(args[0]))),length=args[1]?toNumber(ev(args[1])):1;
    if(!Number.isInteger(length)||length<0)throw Error('#VALUE!');
    return name==='LEFT'?chars.slice(0,length).join(''):length===0?'':chars.slice(-length).join('');
  }
  if(name==='MID'){
    requireArgs(3);
    const value=Array.from(toText(ev(args[0]))),start=toNumber(ev(args[1])),length=toNumber(ev(args[2]));
    if(!Number.isInteger(start)||!Number.isInteger(length)||start<1||length<0)throw Error('#VALUE!');
    return value.slice(start-1,start-1+length).join('');
  }
  if(name==='TRIM'||name==='UPPER'||name==='LOWER'){
    requireArgs(1);const value=toText(ev(args[0]));
    return name==='TRIM'?value.replace(/ +/g,' ').trim():
      name==='UPPER'?value.toLocaleUpperCase('ru-RU'):value.toLocaleLowerCase('ru-RU');
  }
  if(name==='CONCAT'||name==='TEXTJOIN'){
    if(!args.length)throw Error('#ERROR!');
    const first=name==='TEXTJOIN'?2:0;
    if(args.length<=first)throw Error('#ERROR!');
    const separator=name==='TEXTJOIN'?toText(ev(args[0])):'',ignoreEmpty=name==='TEXTJOIN'?truth(ev(args[1])):false;
    const values=flattened(args.slice(first)).map(toText).filter(v=>!ignoreEmpty||v!=='');
    const joined=values.join(separator);
    if(joined.length>32767)throw Error('#VALUE!');return joined;
  }
  if(name==='DATE'){
    requireArgs(3);const p=args.map(a=>toNumber(ev(a)));
    if(!p.every(Number.isInteger))throw Error('#VALUE!');
    try{return dateSerial(p[0],p[1],p[2],true);}catch{throw Error('#NUM!');}
  }
  if(name==='TODAY'){
    requireArgs(0);if(context?.calculation)return context.calculation.today;
    const now=new Date();return dateSerial(now.getFullYear(),now.getMonth()+1,now.getDate());
  }
  if(name==='YEAR'||name==='MONTH'||name==='DAY'){
    requireArgs(1);
    try{const p=serialDateParts(toNumber(ev(args[0])));return name==='YEAR'?p.year:name==='MONTH'?p.month:p.day;}
    catch{throw Error('#NUM!');}
  }
  if(name==='TIME'){
    requireArgs(3);const p=args.map(a=>toNumber(ev(a)));
    if(!p.every(Number.isInteger))throw Error('#VALUE!');
    try{return timeSerial(p[0],p[1],p[2]);}catch{throw Error('#NUM!');}
  }
  if(name==='HOUR'||name==='MINUTE'){
    requireArgs(1);
    try{const p=serialTimeParts(toNumber(ev(args[0])));return name==='HOUR'?p.hours:p.minutes;}
    catch{throw Error('#NUM!');}
  }
  if(name==='ROUND'){requireArgs(1,2);const x=toNumber(ev(args[0])),digits=args[1]?toNumber(ev(args[1])):0;
    if(!Number.isInteger(digits)||digits< -12||digits>12)throw Error('#NUM!');const power=10**digits;return Math.sign(x)*Math.round((Math.abs(x)+Number.EPSILON)*power)/power;}
  if(name==='ABS'){requireArgs(1);return Math.abs(toNumber(ev(args[0])));}
  if(name==='LEN'){requireArgs(1);return toText(ev(args[0])).length;}
  if(name==='SUM'||name==='AVERAGE'||name==='COUNT'||name==='COUNTA'||name==='COUNTBLANK'||name==='MIN'||name==='MAX'){
    if(!args.length)throw Error('#ERROR!');const vs=flattened(args);
    if(name==='COUNTA')return vs.filter(v=>v!==''&&v!==null).length;
    if(name==='COUNTBLANK')return vs.filter(v=>v===''||v===null).length;
    const nums=vs.filter(numericLike).filter(v=>v!=='').map(toNumber);
    if(name==='COUNT')return nums.length;
    if(name==='SUM')return nums.reduce((a,b)=>a+b,0);
    if(!nums.length)return name==='AVERAGE'?'#DIV/0!':0;
    if(name==='AVERAGE')return nums.reduce((a,b)=>a+b,0)/nums.length;
    return name==='MIN'?Math.min(...nums):Math.max(...nums);
  }
  throw Error('#NAME?');
}
export function evaluateCell(ref,cells,visiting=new Set(),context=null){
 const key=String(ref).replaceAll('$','').toUpperCase(),identity=context?identityFor(context.sheetName,key):key,state=context?.calculation;
 if(visiting.has(identity)){if(state)state.cycleVersion++;return '#CYCLE!';}
 const raw=String(cells[key]??'');if(!raw.startsWith('='))return raw;
 if(raw.includes('#REF!'))return '#REF!';
 if(state?.results.has(identity)){state.stats.hits++;return state.results.get(identity);}
 const cycleBefore=state?.cycleVersion;
 if(state){state.stats.evaluated++;forgetDependencies(state,identity);}
 const next=new Set(visiting);next.add(identity);
 let result;
 try{
  let ast=state?.ast.get(identity);
  if(!ast){ast=parseFormula(raw.slice(1));if(state){state.ast.set(identity,ast);state.stats.parsed++;}}
  result=evaluateNode(ast,cells,next,context);
  if(typeof result==='number')result=Number.isFinite(result)?Math.round((result+Number.EPSILON)*1e10)/1e10:'#NUM!';
 }catch(e){result=String(e.message||'').startsWith('#')?e.message:'#ERROR!';}
 // IFERROR may recover a cycle. Such results depend on evaluation root.
 if(state&&state.cycleVersion===cycleBefore)state.results.set(identity,result);
 return result;
}

export function csvEncode(grid) {
  return grid.map(row=>row.map(value=>{
    const s=String(value ?? '');
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(',')).join('\r\n');
}

export function csvDecode(input) {
  const rows=[], row=[]; let cell='', quoted=false;
  for(let i=0;i<input.length;i++){
    const ch=input[i];
    if (quoted) {
      if(ch==='"'&&input[i+1]==='"'){cell+='"';i++;}
      else if(ch==='"')quoted=false;
      else cell+=ch;
    } else if(ch==='"' && cell==='') quoted=true;
    else if(ch===','){row.push(cell);cell='';}
    else if(ch==='\n'||ch==='\r'){
      if(ch==='\r'&&input[i+1]==='\n')i++;
      row.push(cell);rows.push([...row]);row.length=0;cell='';
    } else cell+=ch;
  }
  if(quoted)throw new Error('Unclosed CSV quote');
  if(cell!==''||row.length){row.push(cell);rows.push(row);}
  return rows;
}
