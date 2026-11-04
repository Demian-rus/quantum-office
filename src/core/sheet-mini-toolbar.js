/* TASK139: proximity-sensitive floating formatting ribbon for Quantum Sheets.
 * Reuses applyStyle()/setStyle()/transact() for identical behavior and Ctrl+Z.
 * Only shown after a deliberate mouse cell selection; never during editing. */
let qoMiniSheetState=null,qoMiniSheetArmed=false,qoMiniSheetColorOpen=false;
const QO_MINI_FONT_SIZES=[8,9,10,11,12,14,16,18,20,24,28,32,36,48,72];
function qoMiniSheetHide(){
 const node=document.getElementById('qo-mini-sheet-toolbar');
 if(node)node.remove();
 qoMiniSheetState=null;qoMiniSheetColorOpen=false;
}
function qoMiniSheetDistance(rect,x,y){
 if(!rect)return Infinity;
 return Math.hypot(Math.max(rect.left-x,0,x-rect.right),Math.max(rect.top-y,0,y-rect.bottom));
}
function qoMiniSheetSelectionBounds(){
 const frame=document.getElementById('grid-frame');
 const view=document.getElementById('grid-scroll');
 if(!frame||!view)return null;
 const limit=view.getBoundingClientRect();
 const boxes=[...frame.querySelectorAll('.grid-cell.is-selected')].map(el=>el.getBoundingClientRect())
  .filter(r=>r.width>0&&r.height>0&&r.right>limit.left+rowW&&r.left<limit.right&&r.bottom>limit.top&&r.top<limit.bottom);
 if(!boxes.length){
  const active=[...frame.querySelectorAll('.grid-cell')].find(el=>el.dataset.ref===activeCell);
  if(active)boxes.push(active.getBoundingClientRect());
 }
 if(!boxes.length)return null;
 return {left:Math.max(limit.left+rowW,Math.min(...boxes.map(r=>r.left))),
  top:Math.max(limit.top,Math.min(...boxes.map(r=>r.top))),
  right:Math.min(limit.right,Math.max(...boxes.map(r=>r.right))),
  bottom:Math.min(limit.bottom,Math.max(...boxes.map(r=>r.bottom)))};
}
function qoMiniSheetCapture(){
 return {bookId:book().id,sheetId:sheet().id,start:activeCell,end:rangeEnd,
  ranges:selectedRects().map(r=>({...r}))};
}
function qoMiniSheetRefresh(){
 const bar=document.getElementById('qo-mini-sheet-toolbar');
 if(!bar||!qoMiniSheetState||page!=='sheet'||sheet()?.id!==qoMiniSheetState.selection.sheetId){qoMiniSheetHide();return;}
 const style=getEffectiveStyle(sheet(),qoMiniSheetState.selection.start);
 for(const kind of ['bold','italic','underline','strike']){
  const button=bar.querySelector('[data-mini-style="'+kind+'"]');
  if(button){button.setAttribute('aria-pressed',String(!!style[kind]));button.classList.toggle('is-active',!!style[kind]);}
 }
 const font=bar.querySelector('[data-mini-font]');
 const size=bar.querySelector('[data-mini-size]');
 if(font)font.value=style.fontFamily&&FONT_FAMILIES.includes(style.fontFamily)?style.fontFamily:'Aptos';
 if(size)size.value=String(style.fontSize||11);
 const color=bar.querySelector('[data-mini-color]'),fill=bar.querySelector('[data-mini-bg]');
 if(color){color.value=/^#[\da-f]{6}$/i.test(style.color||'')?style.color:'#263b31';color.parentElement.style.setProperty('--mini-selected-color',color.value);}
 if(fill){fill.value=/^#[\da-f]{6}$/i.test(style.bg||'')?style.bg:'#f4e2a0';fill.parentElement.style.setProperty('--mini-selected-color',fill.value);}
}
function qoMiniSheetApply(patch){
 const state=qoMiniSheetState;
 if(!state||page!=='sheet'||book()?.id!==state.selection.bookId||sheet()?.id!==state.selection.sheetId){qoMiniSheetHide();return;}
 applyStyle(patch,state.selection);
 if(document.getElementById('qo-mini-sheet-toolbar'))qoMiniSheetRefresh();
}
function qoMiniSheetShow(point){
 qoMiniSheetHide();
 if(page!=='sheet'||!book()||!sheet()||editing||fillDrag||resizeDrag||chartDrag)return;
 const area=qoMiniSheetSelectionBounds();
 if(!area)return;
 const selection=qoMiniSheetCapture(),style=getEffectiveStyle(sheet(),activeCell);
 const font=style.fontFamily&&FONT_FAMILIES.includes(style.fontFamily)?style.fontFamily:'Aptos';
 const fonts=FONT_TOP.concat(FONT_OTHERS);
 const fontOptions=fonts.map(x=>'<option value="'+esc(x)+'"'+(x===font?' selected':'')+'>'+esc(x)+'</option>').join('');
 const sizes=[...new Set([...QO_MINI_FONT_SIZES,style.fontSize||11])].sort((a,b)=>a-b);
 const sizeOptions=sizes.map(n=>'<option value="'+n+'"'+(n===(style.fontSize||11)?' selected':'')+'>'+n+'</option>').join('');
 const buttons=[['bold','Жирный','<b>Ж</b>'],['italic','Курсив','<i>К</i>'],
  ['underline','Подчёркивание','<u>Ч</u>'],['strike','Зачёркивание','<s>З</s>']]
  .map(([key,title,inner])=>'<button type="button" class="qo-mini-format-btn" data-mini-style="'+key+'" title="'+title+'" aria-label="'+title+'" aria-pressed="false">'+inner+'</button>').join('');
 const bar=document.createElement('div');bar.id='qo-mini-sheet-toolbar';bar.className='qo-mini-sheet-toolbar';
 bar.setAttribute('role','toolbar');bar.setAttribute('aria-label','Быстрое оформление выделенных ячеек');
 bar.innerHTML='<select data-mini-font aria-label="Шрифт" title="Шрифт">'+fontOptions+'</select>'+
  '<select data-mini-size aria-label="Размер шрифта" title="Размер шрифта">'+sizeOptions+'</select>'+
  buttons+
  '<label class="qo-mini-color" title="Цвет текста"><span class="qo-mini-color-letter">A</span><input data-mini-color type="color" aria-label="Цвет текста"></label>'+
  '<label class="qo-mini-color" title="Заливка ячеек"><span class="qo-mini-fill-letter">▰</span><input data-mini-bg type="color" aria-label="Заливка ячеек"></label>';
 document.body.append(bar);
 qoMiniSheetState={selection,area};
 const bounds=bar.getBoundingClientRect(),width=bounds.width,height=bounds.height;
 const left=Math.max(8,Math.min(window.innerWidth-width-8,Math.min(area.right,Math.max(area.left,point?.x||area.left))-width/2));
 const preferTop=area.top-height-10;
 const frameTop=document.getElementById('grid-frame')?.getBoundingClientRect().top||0;
 const top=preferTop>=frameTop+6?preferTop:Math.min(window.innerHeight-height-8,area.bottom+10);
 bar.style.left=Math.round(left)+'px';bar.style.top=Math.max(8,Math.round(top))+'px';
 qoMiniSheetRefresh();
 bar.addEventListener('mousedown',e=>e.stopPropagation());
 bar.addEventListener('pointerdown',e=>{e.stopPropagation();if(e.target.matches('input[type=color]'))qoMiniSheetColorOpen=true;});
 bar.addEventListener('click',e=>{
  const kind=e.target.closest('[data-mini-style]')?.dataset.miniStyle;
  if(!kind)return;
  e.preventDefault();const current=!!getEffectiveStyle(sheet(),selection.start)[kind];
  qoMiniSheetApply({[kind]:!current});
 });
 bar.addEventListener('change',e=>{
  const t=e.target;
  if(t.matches('[data-mini-font]')&&FONT_FAMILIES.includes(t.value))qoMiniSheetApply({fontFamily:t.value});
  else if(t.matches('[data-mini-size]')&&Number.isInteger(Number(t.value))&&Number(t.value)>=6&&Number(t.value)<=72)qoMiniSheetApply({fontSize:Number(t.value)});
  else if(t.matches('[data-mini-color]')){qoMiniSheetApply({color:t.value});qoMiniSheetColorOpen=false;}
  else if(t.matches('[data-mini-bg]')){qoMiniSheetApply({bg:t.value});qoMiniSheetColorOpen=false;}
 });
 bar.addEventListener('focusout',e=>{if(e.target.matches('input[type=color]'))qoMiniSheetColorOpen=false;});
}
function qoMiniSheetInstall(){
 app.addEventListener('mousedown',e=>{
  if(page!=='sheet'||e.button!==0||e.target.closest('.filter-head,.cell-checkbox,.qo-cell-link,#grid-fill-handle'))return;
  const cell=e.target.closest('#grid-frame .grid-cell');
  if(!cell||e.detail>1||editing)return;
  qoMiniSheetArmed=true;
  qoMiniSheetHide();
 },true);
 window.addEventListener('mouseup',e=>{
  if(!qoMiniSheetArmed)return;
  qoMiniSheetArmed=false;
  if(e.button!==0||page!=='sheet'||editing)return;
  qoMiniSheetShow({x:e.clientX,y:e.clientY});
 });
 window.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'||!qoMiniSheetState||qoMiniSheetColorOpen)return;
  const bar=document.getElementById('qo-mini-sheet-toolbar');
  if(!bar)return;
  const d=Math.min(qoMiniSheetDistance(qoMiniSheetState.area,e.clientX,e.clientY),
   qoMiniSheetDistance(bar.getBoundingClientRect(),e.clientX,e.clientY));
  if(d>150)qoMiniSheetHide();
 },{passive:true});
 document.addEventListener('scroll',e=>{
  if(e.target?.closest?.('#grid-scroll')||e.target===document||e.target===document.documentElement)qoMiniSheetHide();
 },true);
 window.addEventListener('keydown',e=>{
  if(e.key==='Escape')qoMiniSheetHide();
  else if(page==='sheet'&&e.target?.closest?.('#grid-scroll')&&
   ['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','F2','Delete','Backspace','Enter'].includes(e.key))qoMiniSheetHide();
 },true);
 app.addEventListener('dblclick',e=>{if(e.target.closest('.grid-cell'))qoMiniSheetHide();},true);
 window.addEventListener('blur',()=>qoMiniSheetHide());
}