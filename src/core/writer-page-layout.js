/* TASK131 — Quantum Writer: printable page setup and running header/footer. */
const QO_WRITER_PAPER_SIZES=Object.freeze({A4:[210,297],A5:[148,210],Letter:[215.9,279.4]});
function qoWriterPaperSize(layout){
 const original=QO_WRITER_PAPER_SIZES[layout.paper]||QO_WRITER_PAPER_SIZES.A4;
 return layout.orientation==='landscape'?[original[1],original[0]]:original;
}
function qoWriterCSSQuoted(value){
 return '"'+String(value??'').replace(/\\/g,'\\\\').replace(/"/g,'\\"')
  .replace(/[\u0000-\u001f\u007f]/g,' ')+'"';
}
function qoWriterPageRules(layout){
 const f=layout||qoWriterLayout(),[width,height]=qoWriterPaperSize(f);
 const header=String(f.header||'').trim(),footer=String(f.footer||'').trim();
 // Running margin boxes are supported in current Chromium/Edge and repeat per printed page.
 return '@page{size:'+width+'mm '+height+'mm;margin:'+f.margin+'mm;'+
  (header?'@top-center{content:'+qoWriterCSSQuoted(header)+';font:9pt Arial,sans-serif;color:#456052;}':'')+
  (footer?'@bottom-left{content:'+qoWriterCSSQuoted(footer)+';font:9pt Arial,sans-serif;color:#456052;}':'')+
  (f.pageNumber?'@bottom-right{content:"Стр. " counter(page);font:9pt Arial,sans-serif;color:#456052;}':'')+'}';
}
function qoWriterPagePreviewHTML(layout){
 const f=layout||qoWriterLayout();
 return '<div id="qo-writer-page-header" class="qo-writer-page-header" aria-label="Верхний колонтитул">'+esc(f.header||'')+'</div>'+
  '<div id="qo-writer-page-footer" class="qo-writer-page-footer" aria-label="Нижний колонтитул">'+
  '<span id="qo-writer-footer-text">'+esc(f.footer||'')+'</span>'+
  '<span id="qo-writer-page-counter">'+(f.pageNumber?'Стр. 1':'')+'</span></div>';
}
function qoWriterUpdatePagePreview(){
 const f=qoWriterLayout(),page=document.getElementById('qo-writer-page');
 if(page)page.setAttribute('style',qoWriterCSS());
 const header=document.getElementById('qo-writer-page-header'),footer=document.getElementById('qo-writer-page-footer');
 if(header)header.textContent=f.header;
 if(footer){
  const text=footer.querySelector('#qo-writer-footer-text'),counter=footer.querySelector('#qo-writer-page-counter');
  if(text)text.textContent=f.footer;
  if(counter)counter.textContent=f.pageNumber?'Стр. 1':'';
 }
 const info=document.getElementById('qo-writer-layout-info');
 if(info)info.textContent=f.paper+' · '+(f.orientation==='landscape'?'альбомная':'книжная')+' · поля '+f.margin+' мм';
}
