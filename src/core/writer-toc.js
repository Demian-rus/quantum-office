/* TASK138 — in-document table of contents. No fabricated page numbers.
 * Heading IDs are stable, links are constrained to generated in-document anchors.
 * The TOC remains a normal part of QDOC/HTML and is rebuilt on edits. */
const QO_WRITER_TOC_ID=/^qo-toc-h-\d{1,6}$/;
function qoWriterTocEditor(){return document.getElementById('qo-writer-page');}
function qoWriterTocHeadings(editor){
 return [...editor.querySelectorAll('h1,h2,h3')]
  .filter(h=>!h.closest('[data-qo-toc]')&&h.textContent.trim());
}
function qoWriterTocAssignIds(headings){
 const used=new Set();
 for(const heading of headings){
  let id=heading.id;
  if(!QO_WRITER_TOC_ID.test(id)||used.has(id)){
   let index=1;
   while(used.has('qo-toc-h-'+index)||
      headings.some(h=>h!==heading&&h.id==='qo-toc-h-'+index))index++;
   id='qo-toc-h-'+index;
   heading.id=id;
  }
  used.add(id);
 }
}
function qoWriterTocRefresh(){
 const editor=qoWriterTocEditor(),toc=editor?.querySelector('[data-qo-toc="true"]');
 if(!editor||!toc)return false;
 const headings=qoWriterTocHeadings(editor);
 qoWriterTocAssignIds(headings);
 const signature=JSON.stringify(headings.map(h=>[h.id,h.tagName,h.textContent.trim()]));
 if(toc.dataset.qoTocSignature===signature)return true;
 toc.replaceChildren();
 const title=document.createElement('p'),strong=document.createElement('strong');
 strong.textContent='Оглавление';title.append(strong);toc.append(title);
 if(!headings.length){
  const empty=document.createElement('p');empty.textContent='Добавьте заголовки, затем обновите оглавление.';
  toc.append(empty);
 }else{
  for(const heading of headings){
   const row=document.createElement('p');
   const level=Number(heading.tagName[1]);
   if(level>1)row.style.marginLeft=(level-1)*6+'mm';
   const link=document.createElement('a');
   link.setAttribute('href','#'+heading.id);
   link.textContent=heading.textContent.trim();
   row.append(link);toc.append(row);
  }
 }
 toc.dataset.qoTocSignature=signature;
 return true;
}
function qoWriterTocInsert(){
 if(page!=='writer')return;
 const editor=qoWriterTocEditor();if(!editor)return;
 const old=editor.querySelector('[data-qo-toc="true"]');
 if(old){qoWriterTocRefresh();qoPersistWriter();status('Оглавление обновлено');return;}
 const headings=qoWriterTocHeadings(editor);
 if(!headings.length){status('Добавьте заголовки 1–3 перед вставкой оглавления',true);return;}
 const toc=document.createElement('div');
 toc.setAttribute('data-qo-toc','true');toc.setAttribute('contenteditable','false');
 toc.className='qo-writer-toc';
 editor.insertBefore(toc,editor.firstChild);
 qoWriterTocRefresh();qoPersistWriter();
 status('Оглавление создано по заголовкам документа');
}
function qoWriterTocUpdate(){
 if(page!=='writer')return;
 if(!qoWriterTocRefresh()){status('В документе пока нет оглавления',true);return;}
 qoPersistWriter();status('Оглавление обновлено');
}
function qoWriterTocRemove(){
 const toc=qoWriterTocEditor()?.querySelector('[data-qo-toc="true"]');
 if(!toc){status('В документе нет оглавления',true);return;}
 toc.remove();qoPersistWriter();status('Оглавление удалено');
}
function qoWriterTocOnClick(event){
 const link=event.target.closest?.('#qo-writer-page [data-qo-toc="true"] a[href^="#qo-toc-h-"]');
 if(!link||page!=='writer')return;
 event.preventDefault();event.stopPropagation();
 const id=link.getAttribute('href').slice(1);
 if(!QO_WRITER_TOC_ID.test(id))return;
 const heading=[...qoWriterTocHeadings(qoWriterTocEditor())].find(h=>h.id===id);
 if(!heading)return;
 heading.scrollIntoView({block:'center',behavior:'instant'});
 const range=document.createRange();range.selectNodeContents(heading);range.collapse(true);
 const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
 qoWriterTocEditor().focus({preventScroll:true});
 qoWriterRememberSelection();
}
document.addEventListener('click',qoWriterTocOnClick,true);
