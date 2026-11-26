// The visual surface projects the existing task source through the shared renderer.
function qwLiveMount(surface, source) {
 const blocks=[];
 surface.innerHTML=qwRichMarkdownHTML(source,block=>blocks.push(block));
 qwLiveMarkAtoms(surface);
 surface.qwSourceBlocks=new WeakMap([...surface.children].map((element,index)=>
  [element,{source:blocks[index],html:element.outerHTML}]));
 if(!surface.firstChild)surface.innerHTML='<p><br></p>';
}

function qwLiveMarkAtoms(surface) {
 for(const node of surface.querySelectorAll('math,.qw-formula-error,.qw-inline-blank')){
  if(node.closest('[data-qw-live-atom]'))continue;
  const atom=document.createElement('span');
  const display=node.closest('.qw-rich-equation');
  const kind=node.matches('.qw-inline-blank')?'blank':
   node.matches('.qw-plain-math')?'plain':display?'display':'formula';
  atom.dataset.qwLiveAtom=kind;
  atom.dataset.qwLiveValue=kind==='blank'?String(parseInt(node.style.width,10)||4):
   node.getAttribute('aria-label')||node.textContent;
  atom.contentEditable='false';
  if(kind==='formula'||kind==='display'||kind==='plain'){
   atom.tabIndex=0;
   atom.setAttribute('role','button');
   atom.title='Изменить формулу';
  }
  node.replaceWith(atom);atom.append(node);
 }
}

function qwLiveHTML(source) {
 const template=document.createElement('template');
 template.innerHTML=qwRichMarkdownHTML(source);
 qwLiveMarkAtoms(template.content);
 return template.innerHTML;
}

function qwLiveEscape(text) {
 return text.replace(/\u00a0/g,' ').replace(/[\\*_~^+\x60$|#>[\]]/g,'\\$&')
  .replace(/(^|\n)([ \t]*)(::(?:left|center|right|justify|format)[ \t]+|-{3,}(?=[ \t]*(?:\n|$))|- |\d{1,3}[.)] )/g,(_,line,space,marker)=>
   line+space+marker.replace(/[:.()-]/,'\\$&'));
}

function qwLiveAtomSource(node) {
 const value=node.dataset.qwLiveValue||'';
 switch(node.dataset.qwLiveAtom){
  case 'formula':return '\\('+value+'\\)';
  case 'display':return '$$\n'+value+'\n$$';
  case 'blank':return '[[blank:'+value+']]';
  default:return qwLiveEscape(value);
 }
}

function qwLiveInline(node) {
 if(!node)return '';
 if(node.nodeType===Node.TEXT_NODE)return qwLiveEscape(node.data);
 if(node.nodeType!==Node.ELEMENT_NODE)return '';
 if(node.hasAttribute('data-qw-live-atom'))return qwLiveAtomSource(node);
 if(node.tagName==='BR')return '\n';
 if(node.tagName==='CODE'&&!node.textContent.includes('\x60'))return '\x60'+node.textContent+'\x60';
 let value=[...node.childNodes].map(qwLiveInline).join('');
 if(!value.trim())return value;
 const tag=node.tagName,style=node.style||{};
 if(tag==='B'||tag==='STRONG'||/^(?:bold|[6-9]00)$/.test(style.fontWeight))value='__'+value+'__';
 if(tag==='I'||tag==='EM'||style.fontStyle==='italic')value='*'+value+'*';
 if(tag==='U'||style.textDecorationLine?.includes('underline'))value='++'+value+'++';
 if(tag==='DEL'||tag==='S'||tag==='STRIKE'||style.textDecorationLine?.includes('line-through'))value='~~'+value+'~~';
 if(tag==='SUP'||style.verticalAlign==='super')value='^{'+value+'}';
 if(tag==='SUB'||style.verticalAlign==='sub')value='~{'+value+'}';
 const format=node.dataset.qwTextStyle;
 if(format&&node.getAttribute('style'))value='[[style '+format+']]'+value+'[[/style]]';
 return value;
}

function qwLiveBlock(node,withStyle=true) {
 if(node.nodeType!==Node.ELEMENT_NODE)return qwLiveInline(node);
 if(node.hasAttribute('data-qw-live-atom'))return qwLiveAtomSource(node);
 const format=withStyle&&node.dataset.qwTextStyle;
 if(format){
  const body=node.classList.contains('qw-format-block')?[...node.children].map(child=>qwLiveBlock(child)).filter(Boolean):[qwLiveBlock(node,false)].filter(Boolean);
  return body.map(block=>'::format '+format+'\n'+block).join('\n\n');
 }
 if(node.hasAttribute('data-qw-callout')){
  const options=node.dataset.qwCalloutOptions,title=node.querySelector(':scope>.qw-callout-title [data-qw-callout-title]');
  const content=node.querySelector(':scope>.qw-callout-body');
  const body=content?qwLiveSource(content):'';
  return '> [!'+node.dataset.qwCallout+(options?' '+options:'')+'] '+qwLiveInline(title).trim().replace(/\s*\n\s*/g,' ')+'\n'+
   body.split('\n').map(line=>line?'> '+line:'>').join('\n');
 }
 const tag=node.tagName;
 if(node.matches('.qw-rich-equation')&&node.firstElementChild?.hasAttribute('data-qw-live-atom'))
  return qwLiveAtomSource(node.firstElementChild);
 if(tag==='HR')return '---';
 if(tag==='PRE'){
  const code=node.querySelector('code');
  return '\x60\x60\x60'+(code?.dataset.language||'')+'\n'+node.textContent+'\n\x60\x60\x60';
 }
 if(tag==='UL'||tag==='OL'){
  return [...node.children].filter(item=>item.tagName==='LI').map((item,index)=>
   (tag==='UL'?'- ':(index+1)+'. ')+qwLiveInline(item).trim().replace(/\n+/g,' ')).join('\n');
 }
 const table=tag==='TABLE'?node:node.matches('.qw-rich-table-scroll')?node.querySelector('table'):null;
 if(table){
  const rows=[...table.rows].map(row=>[...row.cells].map(cell=>qwLiveInline(cell).trim().replace(/\n+/g,' ')));
  if(!rows.length)return '';
  rows.splice(1,0,rows[0].map(()=> '---'));
  return rows.map(row=>'| '+row.join(' | ')+' |').join('\n');
 }
 if(tag==='DIV'&&[...node.children].some(child=>child.matches('p,div,ul,ol,h3,h4,h5,h6,blockquote,aside,table')))
  return qwLiveSource(node);
 const text=(node.dataset.qwTextStyle?[...node.childNodes].map(qwLiveInline).join(''):qwLiveInline(node)).replace(/\n$/,'');
 if(!text.trim())return '';
 if(/^H[1-6]$/.test(tag))return '#'.repeat(Math.max(1,Number(tag[1])-2))+' '+text;
 if(tag==='BLOCKQUOTE')return text.split('\n').map(line=>'> '+line).join('\n');
 const align=node.style?.textAlign;
 if(['left','center','right','justify'].includes(align))
  return text.split('\n').map(line=>'::'+align+' '+line).join('\n');
 return text;
}

function qwLiveSource(surface) {
 const parts=[];
 let inline='';
 for(const node of surface.childNodes){
  const known=surface.qwSourceBlocks?.get(node);
  if(node.nodeType===Node.ELEMENT_NODE&&node.matches('p,div,section,aside,h1,h2,h3,h4,h5,h6,ul,ol,blockquote,table,pre,hr')){
   if(inline.trim())parts.push(inline);inline='';
   const block=known?.html===node.outerHTML?known.source:qwLiveBlock(node);
   if(block?.trim())parts.push(block);
  }else inline+=qwLiveInline(node);
 }
 if(inline.trim())parts.push(inline);
 return parts.join('\n\n');
}

function qwLiveRange(surface) {
 const selection=window.getSelection();
 if(!selection?.rangeCount)return null;
 const range=selection.getRangeAt(0);
 return surface.contains(range.startContainer)&&surface.contains(range.endContainer)?range:null;
}

function qwLiveBookmark(surface) {
 const range=qwLiveRange(surface);
 if(!range)return null;
 const mark=(node,offset)=>{
  const path=[];
  while(node!==surface){
   const parent=node.parentNode;
   path.unshift([...parent.childNodes].indexOf(node));node=parent;
  }
  return {path,offset};
 };
 return [mark(range.startContainer,range.startOffset),mark(range.endContainer,range.endOffset)];
}

function qwLiveRestore(surface,bookmark) {
 surface.focus({preventScroll:true});
 const range=document.createRange();
 range.selectNodeContents(surface);range.collapse(false);
 if(bookmark){
  const point=({path,offset})=>{
   let node=surface;
   for(const index of path){if(!node.childNodes[index])break;node=node.childNodes[index];}
   if(node.nodeType===Node.ELEMENT_NODE&&node.closest('[contenteditable=false]')){
    const atom=node.closest('[contenteditable=false]');
    return [atom.parentNode,[...atom.parentNode.childNodes].indexOf(atom)+1];
   }
   return [node,Math.min(offset,node.nodeType===Node.TEXT_NODE?node.length:node.childNodes.length)];
  };
  const [start,end]=bookmark.map(point);
  range.setStart(...start);range.setEnd(...end);
 }
 const selection=window.getSelection();
 selection.removeAllRanges();selection.addRange(range);
}


// Writer and the education editor share Range-based paragraph targeting.
function qwLiveApplyStyle(node,format,defaults=false){
 const value=qwStyleSource(format);
 for(const rule of Object.values(QW_TEXT_RULES))node.style.removeProperty(rule.property);
 if(defaults){
  for(const key of ['before','after'])node.style.removeProperty('--qw-default-'+key);
  const spacing=qwDefaultSpacing(format);
  if(spacing)node.dataset.qwDefaultSpacing=spacing;else delete node.dataset.qwDefaultSpacing;
 }
 if(value){
  node.dataset.qwTextStyle=value;
  node.style.cssText+=qwTextStyleCSS(format,defaults);
 }else delete node.dataset.qwTextStyle;
}
function qwLiveTextSelection(surface,range,key,value){
 if(!range||range.collapsed)return false;
 const walker=document.createTreeWalker(surface,NodeFilter.SHOW_TEXT);
 const selected=[];
 while(walker.nextNode()){
  const node=walker.currentNode;
  if(node.parentElement.closest('[contenteditable=false]')||!range.intersectsNode(node))continue;
  const start=node===range.startContainer?range.startOffset:0;
  const end=node===range.endContainer?range.endOffset:node.length;
  if(end>start)selected.push({node,start,end});
 }
 let first,last;
 for(const {node,start,end} of selected){
  const parent=node.parentElement;
  if(end<node.length)node.splitText(end);
  const text=start?node.splitText(start):node;
  const current=parent.dataset.qwTextStyle&&parent.childNodes.length===1?parent:null;
  const format=qwTextStyle({...((current&&qwReadTextStyle(current.dataset.qwTextStyle))||{version:1}),[key]:value});
  const span=current||document.createElement('span');
  if(!current){text.replaceWith(span);span.append(text);}
  qwLiveApplyStyle(span,format);first??=text;last=text;
 }
 if(!first)return false;
 range.setStart(first,0);range.setEnd(last,last.length);
 const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
 return true;
}
function qwLiveParagraphStyle(surface,range,key,value){
 const selector='.qw-format-block,p,h3,h4,h5,h6,ul,ol,blockquote,.qw-rich-equation';
 const nodes=qoParagraphsInRange(surface,range,selector);
 const blocks=new Set(nodes.map(node=>node.closest('.qw-format-block')||node));
 for(const block of blocks){
  const current=qwReadTextStyle(block.dataset.qwTextStyle||'');
  qwLiveApplyStyle(block,qwTextStyle({...current,version:1,[key]:value}));
 }
 return blocks.size>0;
}
function qwLiveInsertBlock(surface,html){
 const range=qwLiveRange(surface);
 if(!range)return null;
 const origin=range.startContainer.nodeType===Node.ELEMENT_NODE?range.startContainer:range.startContainer.parentElement;
 const host=origin.closest('.qw-callout-body')||surface;
 let anchor=origin;
 while(anchor!==host&&anchor.parentElement!==host)anchor=anchor.parentElement;
 const template=document.createElement('template');template.innerHTML=html;
 const block=template.content.firstElementChild;
 if(!block)return null;
 range.deleteContents();
 if(anchor===host||!anchor.isConnected)host.append(block);else anchor.after(block);
 const editable=block.querySelector('.qw-callout-body p')||block;
 range.selectNodeContents(editable);range.collapse(false);
 const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
 return block;
}
