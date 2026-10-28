/** MVP spreadsheet engine. Never evaluates JavaScript from user cells. */
export function colLabel(n) {
  let result = '';
  for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) result = String.fromCharCode(65 + ((x - 1) % 26)) + result;
  return result;
}

export function cellName(row, col) { return `${colLabel(col)}${row + 1}`; }

export function parseCell(ref) {
  const match = /^([A-Z]+)([1-9]\d*)$/.exec(ref.toUpperCase());
  if (!match) return null;
  let col = 0;
  for (const letter of match[1]) col = col * 26 + letter.charCodeAt(0) - 64;
  return { row: Number(match[2]) - 1, col: col - 1 };
}

export function tokenise(str) {
  const text = str.toUpperCase().replace(/\s+/g, '');
  const regex = /(?:\d+(?:\.\d+)?|\.[0-9]+)|[A-Z]+[1-9]\d*|[A-Z]+|[()+\-*/,:]/gy;
  const tokens = [];
  let offset = 0;
  while (offset < text.length) {
    regex.lastIndex = offset;
    const m = regex.exec(text);
    if (!m) throw new Error('Invalid formula');
    tokens.push(m[0]);
    offset = regex.lastIndex;
    if (tokens.length > 2000) throw new Error('Formula too long');
  }
  return tokens;
}

export function rangeRefs(start, end) {
  const a = parseCell(start), b = parseCell(end);
  if (!a || !b) throw new Error('Invalid range');
  const count = (Math.abs(a.row-b.row)+1) * (Math.abs(a.col-b.col)+1);
  if (count > 10000) throw new Error('Range too large');
  const refs = [];
  for (let row=Math.min(a.row,b.row);row<=Math.max(a.row,b.row);row++)
    for (let col=Math.min(a.col,b.col);col<=Math.max(a.col,b.col);col++) refs.push(cellName(row,col));
  return refs;
}

export function evaluateCell(ref, cells, visiting = new Set()) {
  if (visiting.has(ref)) return '#CYCLE!';
  const raw = String(cells[ref] ?? '');
  if (!raw.startsWith('=')) return raw;
  const next = new Set(visiting); next.add(ref);
  let tokens;
  try { tokens = tokenise(raw.slice(1)); } catch { return '#ERROR!'; }
  let i = 0;
  function peek() { return tokens[i]; }
  function eat(x) { if (peek() === x) { i++; return true; } return false; }
  function numeric(r) {
    const v = evaluateCell(r, cells, next);
    if (typeof v === 'string' && v.startsWith('#')) throw new Error(v);
    if (v === '') return 0;
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error('#VALUE!');
    return n;
  }
  function expression() {
    let n = term();
    while (peek() === '+' || peek() === '-') {
      const op = tokens[i++]; const rhs = term(); n = op === '+' ? n+rhs : n-rhs;
    }
    return n;
  }
  function term() {
    let n = factor();
    while (peek() === '*' || peek() === '/') {
      const op = tokens[i++]; const rhs = factor();
      if (op === '/' && rhs === 0) throw new Error('#DIV/0!');
      n = op === '*' ? n*rhs : n/rhs;
    }
    return n;
  }
  function factor() {
    if (eat('-')) return -factor();
    if (eat('+')) return factor();
    if (eat('(')) { const v=expression(); if (!eat(')')) throw new Error('#ERROR!'); return v; }
    const token = tokens[i++];
    if (!token) throw new Error('#ERROR!');
    if (/^(?:\d|\.)/.test(token)) return Number(token);
    if (/^[A-Z]+[1-9]\d*$/.test(token)) return numeric(token);
    if (/^[A-Z]+$/.test(token)) {
      if (!['SUM','AVERAGE','MIN','MAX','COUNT'].includes(token) || !eat('(')) throw new Error('#NAME?');
      const vals = [];
      if (!eat(')')) {
        do {
          if (/^[A-Z]+[1-9]\d*$/.test(peek()||'') && tokens[i+1] === ':') {
            const first=tokens[i++]; i++;
            const last=tokens[i++];
            for (const r of rangeRefs(first,last)) vals.push(numeric(r));
          } else vals.push(expression());
        } while (eat(','));
        if (!eat(')')) throw new Error('#ERROR!');
      }
      if (token === 'SUM') return vals.reduce((a,b)=>a+b,0);
      if (token === 'COUNT') return vals.length;
      if (token === 'AVERAGE') return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
      if (token === 'MIN') return vals.length ? Math.min(...vals) : 0;
      return vals.length ? Math.max(...vals) : 0;
    }
    throw new Error('#ERROR!');
  }
  try {
    const result=expression();
    if (i !== tokens.length || !Number.isFinite(result)) return '#ERROR!';
    return Math.round((result + Number.EPSILON) * 1e10) / 1e10;
  } catch (e) {
    return e.message?.startsWith('#') ? e.message : '#ERROR!';
  }
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
