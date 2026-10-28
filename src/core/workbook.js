import { cellName, parseCell, evaluateCell, csvEncode, csvDecode } from './formulas.js';
const uid=()=>globalThis.crypto?.randomUUID?.()??`q-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const stamp=()=>new Date().toISOString();
export const LIMITS={rows:2000,columns:100,cells:50000,sheets:25};
export function newSheet(name='Лист 1') {return {id:uid(),name,cells:{}};}
export function newWorkbook(name='Новая таблица') {const sheet=newSheet();return {id:uid(),type:'sheet',name,created:stamp(),updated:stamp(),sheets:[sheet],activeSheetId:sheet.id};}
export function currentSheet(book){return book.sheets.find(s=>s.id===book.activeSheetId)||book.sheets[0];}
export function getCell(sheet,ref){return sheet.cells[String(ref).toUpperCase()]||{value:'',style:{}};}
export function setCell(sheet,ref,value){if(!validRef(ref))throw Error('Адрес ячейки вне диапазона');const key=ref.toUpperCase();if(!sheet.cells[key])sheet.cells[key]={value:'',style:{}};sheet.cells[key].value=String(value??'').slice(0,50000);if(!sheet.cells[key].value&&!Object.keys(sheet.cells[key].style||{}).length)delete sheet.cells[key];}
export function setStyle(sheet,ref,patch){if(!validRef(ref))throw Error('Недопустимая ячейка');const key=ref.toUpperCase();const prev=getCell(sheet,key);sheet.cells[key]={value:prev.value,style:{...prev.style,...patch}};}
export function validRef(ref){const p=parseCell(String(ref));return !!p&&p.row<LIMITS.rows&&p.col<LIMITS.columns;}
export function refsBetween(a,b){const p=parseCell(a),q=parseCell(b);if(!p||!q)return [];const refs=[];for(let r=Math.min(p.row,q.row);r<=Math.max(p.row,q.row);r++)for(let c=Math.min(p.col,q.col);c<=Math.max(p.col,q.col);c++)if(r<LIMITS.rows&&c<LIMITS.columns)refs.push(cellName(r,c));return refs;}
export function rectangle(a,b){const p=parseCell(a),q=parseCell(b);return p&&q?{r1:Math.min(p.row,q.row),r2:Math.max(p.row,q.row),c1:Math.min(p.col,q.col),c2:Math.max(p.col,q.col)}:null;}
export function rawMap(sheet){return Object.fromEntries(Object.entries(sheet.cells).map(([k,v])=>[k,v.value]));}
export function resultOf(sheet,ref,map=rawMap(sheet)){return evaluateCell(ref,map);}
export function displayedValue(sheet,ref,map=rawMap(sheet)){
  const cell=getCell(sheet,ref),result=resultOf(sheet,ref,map);if(result===''||result==null)return '';
  if(typeof result!=='number')return String(result);
  const n=Number.isFinite(result)?result:0;
  if(cell.style?.format==='currency')return new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(n);
  if(cell.style?.format==='percent')return new Intl.NumberFormat('ru-RU',{style:'percent',maximumFractionDigits:2}).format(n);
  if(cell.style?.format==='integer')return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n);
  return String(n);
}
export function valuesTSV(sheet,a,b){const rect=rectangle(a,b);if(!rect)return '';
 const map=rawMap(sheet),rows=[];for(let r=rect.r1;r<=rect.r2;r++){const row=[];for(let c=rect.c1;c<=rect.c2;c++)row.push(String(resultOf(sheet,cellName(r,c),map)));rows.push(row.join('\t'));}return rows.join('\n');}
export function pasteTSV(sheet,start,text){const at=parseCell(start);if(!at||!validRef(start))throw Error('Недопустимая ячейка');
 const rows=String(text).replace(/\r\n?/g,'\n').replace(/\n$/,'').split('\n').map(line=>line.split('\t'));
 const maxR=Math.min(LIMITS.rows-at.row,rows.length),maxC=Math.min(LIMITS.columns-at.col,Math.max(...rows.map(r=>r.length)));
 if(maxR*maxC>20000)throw Error('Вставка ограничена 20 000 ячеек');
 for(let r=0;r<maxR;r++)for(let c=0;c<Math.min(maxC,rows[r].length);c++)setCell(sheet,cellName(at.row+r,at.col+c),rows[r][c]);
 return {rows:maxR,cols:maxC,end:cellName(at.row+maxR-1,at.col+maxC-1)};
}
export function importCSV(text,name='Импорт CSV'){
 const grid=csvDecode(String(text).replace(/^\uFEFF/,''));const book=newWorkbook(name);const sheet=currentSheet(book);if(grid.length>LIMITS.rows)throw Error('Слишком много строк');
 for(let r=0;r<grid.length;r++){if(grid[r].length>LIMITS.columns)throw Error('Слишком много столбцов');for(let c=0;c<grid[r].length;c++){if(grid[r][c])setCell(sheet,cellName(r,c),grid[r][c]);}}
 return book;
}
export function exportCSV(sheet){let maxR=0,maxC=0;for(const key of Object.keys(sheet.cells)){const p=parseCell(key);if(p){maxR=Math.max(maxR,p.row);maxC=Math.max(maxC,p.col);}}
 const raw=rawMap(sheet);return csvEncode(Array.from({length:maxR+1},(_,r)=>Array.from({length:maxC+1},(_,c)=>String(resultOf(sheet,cellName(r,c),raw)))));
}
export function validateWorkbook(book){
 if(!book||book.type!=='sheet'||typeof book.id!=='string'||typeof book.name!=='string'||book.name.length>200||!Array.isArray(book.sheets)||!book.sheets.length||book.sheets.length>LIMITS.sheets)throw Error('Неверный формат книги');
 let total=0;const ids=new Set();for(const sheet of book.sheets){if(!sheet||typeof sheet.id!=='string'||ids.has(sheet.id)||typeof sheet.name!=='string'||sheet.name.length>100||!sheet.cells||typeof sheet.cells!=='object'||Array.isArray(sheet.cells))throw Error('Повреждённый лист');ids.add(sheet.id);const keys=Object.keys(sheet.cells);total+=keys.length;for(const ref of keys){const cell=sheet.cells[ref];if(!validRef(ref)||!cell||typeof cell.value!=='string'||cell.value.length>50000||!cell.style||typeof cell.style!=='object'||Array.isArray(cell.style))throw Error('Повреждённая ячейка');
    const style=cell.style;
    if(Object.keys(style).some(k=>!['bold','italic','bg','color','align','format'].includes(k))||
       ['bold','italic'].some(k=>k in style&&typeof style[k]!=='boolean')||
       ['bg','color'].some(k=>k in style&&!/^#[0-9a-fA-F]{6}$/.test(style[k]))||
       ('align' in style&&!['left','center','right'].includes(style.align))||
       ('format' in style&&!['general','currency','percent','integer'].includes(style.format)))throw Error('Недопустимое оформление ячейки');}}
 if(total>LIMITS.cells)throw Error('Превышен лимит ячеек');if(!ids.has(book.activeSheetId))book.activeSheetId=book.sheets[0].id;return book;
}
export function createExample(){const b=newWorkbook('Пример — бюджет проекта'),s=currentSheet(b);s.name='Бюджет';
 const data=[['КАТЕГОРИЯ','ПЛАН','ФАКТ','ОСТАТОК'],['Оборудование','45000','38900','=B2-C2'],['Программное обеспечение','12000','8500','=B3-C3'],['Транспорт','15000','17700','=B4-C4'],['Материалы','18000','14200','=B5-C5'],['ИТОГО','=SUM(B2:B5)','=SUM(C2:C5)','=B6-C6']];
 data.forEach((row,r)=>row.forEach((val,c)=>setCell(s,cellName(r,c),val)));
 for(let c=0;c<4;c++){setStyle(s,cellName(0,c),{bold:true,bg:'#dceafe',color:'#1d457e'});setStyle(s,cellName(5,c),{bold:true,bg:'#edf5e8',color:'#27693b'});}
 for(let r=1;r<6;r++)for(let c=1;c<4;c++)setStyle(s,cellName(r,c),{format:'currency'});
 const s2=newSheet('Заметки');setCell(s2,'A1','Эта книга — демонстрация возможностей Quantum Sheets.');setCell(s2,'A3','Изменяйте цифры в столбцах B и C: формулы пересчитаются.');b.sheets.push(s2);return b;}
{cellName,parseCell};



const STORE_KEY='quantum-office.workspace.v3';
const PREVIOUS_KEY='quantum-office.workspace.v3.previous';
export {cellName, parseCell};
