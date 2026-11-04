/* TASK133 — Word-like paragraph metrics. Applied only to selected paragraphs. */
const QO_WRITER_PARAGRAPH_FIELDS=Object.freeze({
 left:{css:'marginLeft',unit:'mm',min:0,max:50},
 first:{css:'textIndent',unit:'mm',min:-20,max:30},
 before:{css:'marginTop',unit:'pt',min:0,max:48},
 after:{css:'marginBottom',unit:'pt',min:0,max:48}
});
function qoWriterParagraphMeasure(text,kind){
 const def=QO_WRITER_PARAGRAPH_FIELDS[kind];
 if(!def)return 0;
 const n=parseFloat(String(text||''));
 return Number.isFinite(n)?Math.max(def.min,Math.min(def.max,Math.round(n*2)/2)):0;
}
function qoWriterParagraphTargets(){
 const editor=document.getElementById('qo-writer-page');
 if(!editor)return [];
 const selected=window.getSelection();
 let range=qoWriterSelectionRange;
 if(selected?.rangeCount&&editor.contains(selected.anchorNode))range=selected.getRangeAt(0);
 if(!range||!editor.contains(range.commonAncestorContainer))return [];
 const blocks=[...editor.querySelectorAll('p,h1,h2,h3,blockquote,li')];
 if(range.collapsed){
  const node=range.startContainer,nodeElement=node.nodeType===1?node:node.parentElement;
  const one=nodeElement?.closest?.('p,h1,h2,h3,blockquote,li');
  return one&&editor.contains(one)?[one]:[];
 }
 return blocks.filter(block=>{
  try{return range.intersectsNode(block);}catch{return false;}
 });
}
function qoWriterParagraphSync(){
 if(page!=='writer')return;
 const block=qoWriterParagraphTargets()[0];
 for(const [key,spec] of Object.entries(QO_WRITER_PARAGRAPH_FIELDS)){
  const control=document.getElementById('qo-writer-para-'+key);
  if(!control)continue;
  if(document.activeElement===control)continue;
  control.value=block?String(qoWriterParagraphMeasure(block.style[spec.css],key)):'0';
 }
}
function qoWriterParagraphApply(kind,input){
 const editor=document.getElementById('qo-writer-page');
 if(!editor||page!=='writer')return false;
 qoWriterFocusSelection();
 const nodes=qoWriterParagraphTargets();
 if(!nodes.length){status('Установите курсор внутри абзаца',true);return false;}
 if(kind==='reset'){
  for(const node of nodes)for(const spec of Object.values(QO_WRITER_PARAGRAPH_FIELDS))node.style[spec.css]='';
 }else{
  const spec=QO_WRITER_PARAGRAPH_FIELDS[kind];if(!spec)return false;
  const value=qoWriterParagraphMeasure(input,kind);
  for(const node of nodes){
   if(kind==='left'){
    const first=qoWriterParagraphMeasure(node.style.textIndent,'first');
    if(first<0&&value+first<0)node.style.textIndent=String(-value)+'mm';
   }
   const adjusted=kind==='first'?Math.max(-qoWriterParagraphMeasure(node.style.marginLeft,'left'),value):value;
   node.style[spec.css]=String(adjusted)+spec.unit;
  }
 }
 qoWriterRememberSelection();qoPersistWriter();qoWriterParagraphSync();
 return true;
}
function qoWriterParagraphIndent(delta){
 const editor=document.getElementById('qo-writer-page');
 if(!editor||page!=='writer')return;
 qoWriterFocusSelection();
 const nodes=qoWriterParagraphTargets();
 if(!nodes.length){status('Установите курсор внутри абзаца',true);return;}
 for(const node of nodes){
  const left=qoWriterParagraphMeasure(node.style.marginLeft,'left'),newLeft=qoWriterParagraphMeasure(left+delta,'left');
  const first=qoWriterParagraphMeasure(node.style.textIndent,'first');
  if(first<0&&newLeft+first<0)node.style.textIndent=String(-newLeft)+'mm';
  node.style.marginLeft=String(newLeft)+'mm';
 }
 qoWriterRememberSelection();qoPersistWriter();qoWriterParagraphSync();
}
