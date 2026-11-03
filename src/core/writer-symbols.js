/* TASK137: offline scientific symbol palette, inserted at the selected caret. */
const QO_WRITER_SYMBOLS={
 'Греческие':['α','β','γ','δ','θ','λ','μ','π','σ','φ','ω','Δ','Σ','Ω'],
 'Математика':['±','×','÷','≈','≠','≤','≥','∞','√','∑','∏','∫','∂','∇','∈','∉','⊂','∩','∪','∝','∅','∀','∃'],
 'Физика':['°','℃','℉','ℏ','ℓ','Å','µ','Ω','·','²','³','⁻','₀','₁','₂','₃','₄','₅','₆','₇','₈','₉'],
 'Стрелки':['→','←','↑','↓','↔','⇒','⇔','↗','↘','⇑','⇓'],
 'Знаки':['«','»','—','–','…','§','№','©','®','™','‰','′','″','•','✓','✕']
};
function qoWriterCloseSymbols(){document.getElementById('qo-writer-symbols-dialog')?.remove();}
function qoWriterOpenSymbols(){
 if(page!=='writer')return;
 qoWriterCloseSymbols();qoWriterRememberSelection();
 const node=document.createElement('div');node.id='qo-writer-symbols-dialog';node.className='qo-writer-symbols-backdrop';
 node.innerHTML='<section class="qo-writer-symbols-panel" role="dialog" aria-modal="true" aria-label="Вставка символа">'+
 '<header><strong>Вставить символ</strong><button type="button" data-symbol-close title="Закрыть">×</button></header>'+
 '<div class="qo-writer-symbols-tabs" role="tablist" aria-label="Категории"></div>'+
 '<div class="qo-writer-symbols-grid" role="group" aria-label="Символы"></div>'+
 '<footer>Символ вставляется в положение курсора в документе</footer></section>';
 const tabs=node.querySelector('.qo-writer-symbols-tabs'),grid=node.querySelector('.qo-writer-symbols-grid');
 const categories=Object.keys(QO_WRITER_SYMBOLS);
 function show(category){
  tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.symbolCategory===category)));
  grid.replaceChildren();
  for(const character of QO_WRITER_SYMBOLS[category]){
   const btn=document.createElement('button');btn.type='button';btn.textContent=character;
   btn.setAttribute('aria-label','Вставить '+character);btn.title=character;
   btn.addEventListener('click',()=>{
    qoWriterInsert(character.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'));
    qoWriterCloseSymbols();status('Символ вставлен: '+character);
   });
   grid.append(btn);
  }
 }
 for(const category of categories){
  const btn=document.createElement('button');btn.type='button';btn.dataset.symbolCategory=category;
  btn.setAttribute('role','tab');btn.textContent=category;
  btn.addEventListener('click',()=>show(category));tabs.append(btn);
 }
 node.querySelector('[data-symbol-close]').addEventListener('click',qoWriterCloseSymbols);
 node.addEventListener('pointerdown',event=>{if(event.target===node)qoWriterCloseSymbols();});
 node.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();qoWriterCloseSymbols();}
 });
 document.body.append(node);show(categories[0]);node.querySelector('[data-symbol-close]').focus();
}
