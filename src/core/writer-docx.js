/* TASK132: offline DOCX interchange for Quantum Writer. Works with bundled JSZip. */
const QO_DOCX_NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const QO_DOCX_REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const QO_DOCX_PKGREL='http://schemas.openxmlformats.org/package/2006/relationships';
const QO_DOCX_CT='http://schemas.openxmlformats.org/package/2006/content-types';
const qoDocxEscape=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const qoDocxChildren=(el,name)=>Array.from(el?.children||[]).filter(x=>x.localName===name);
const qoDocxChild=(el,name)=>qoDocxChildren(el,name)[0]||null;
const qoDocxDesc=(el,name)=>Array.from(el?.getElementsByTagNameNS?.(QO_DOCX_NS,name)||[]);
const qoDocxAttr=(el,name)=>el?.getAttributeNS?.(QO_DOCX_NS,name)||el?.getAttribute?.('w:'+name)||el?.getAttribute?.(name)||'';
const qoDocxXml=(raw)=>{const document=new DOMParser().parseFromString(raw,'application/xml');if(document.querySelector('parsererror'))throw Error('Повреждён XML внутри DOCX');return document;};
const qoDocxColor=(color)=>{
 const value=String(color||'').trim(),m=value.match(/^#([0-9a-f]{6})$/i)||value.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
 if(!m)return null;
 if(m.length===2)return m[1].toUpperCase();
 return m.slice(1).map(v=>Math.min(255,Number(v)).toString(16).padStart(2,'0')).join('').toUpperCase();
};
function qoDocxRelationships(items){return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
 '<Relationships xmlns="'+QO_DOCX_PKGREL+'">'+items.map(x=>'<Relationship Id="'+x.id+'" Type="'+x.type+'" Target="'+qoDocxEscape(x.target)+'"'+(x.external?' TargetMode="External"':'')+'/>').join('')+'</Relationships>';}
function qoDocxParagraph(runHtml,tag='p',opts={}){
 const head=/^h[123]$/.test(tag)?'<w:pStyle w:val="Heading'+tag[1]+'"/>':tag==='blockquote'?'<w:pStyle w:val="Quote"/>':'';
 const align=opts.align&&['left','center','right','justify'].includes(opts.align)?'<w:jc w:val="'+(opts.align==='justify'?'both':opts.align)+'"/>':'';
 const list=opts.list?'<w:numPr><w:ilvl w:val="'+Math.min(6,opts.depth||0)+'"/><w:numId w:val="'+(opts.list==='ol'?2:1)+'"/></w:numPr>':'';
 return '<w:p><w:pPr>'+head+align+list+'</w:pPr>'+runHtml+'</w:p>';
}
function qoDocxRunProps(state){const props=[];
 if(state.b)props.push('<w:b/>');if(state.i)props.push('<w:i/>');if(state.u)props.push('<w:u w:val="single"/>');if(state.s)props.push('<w:strike/>');
 if(state.color)props.push('<w:color w:val="'+state.color+'"/>');
 if(state.highlight)props.push('<w:shd w:fill="'+state.highlight+'"/>');
 if(state.size)props.push('<w:sz w:val="'+Math.round(state.size*1.5)+'"/>');
 return props.length?'<w:rPr>'+props.join('')+'</w:rPr>':'';
}
async function qoDocxExport(html,layout,title){
 if(!globalThis.JSZip)throw Error('Модуль DOCX недоступен');
 const zip=new globalThis.JSZip(),root=document.createElement('div');root.innerHTML=String(html||'').slice(0,2700000);
 const rels=[],media=[],relation=(type,target,external=false)=>{const id='rId'+(rels.length+1);rels.push({id,type,target,external});return id;};
 const includeImage=(node)=>{
  const src=node.getAttribute('src')||'',match=/^data:image\/(png|jpeg|gif);base64,([a-z0-9+/=]+)$/i.exec(src);
  if(!match||src.length>2500000)return '';
  const fmt=match[1].toLowerCase(),ext=fmt==='jpeg'?'jpg':fmt;
  const bytes=atob(match[2]);if(bytes.length>1500000) return '';
  const index=media.length+1,name='image'+index+'.'+ext;
  media.push({name,ext,data:match[2]});
  const id=relation('http://schemas.openxmlformats.org/officeDocument/2006/relationships/image','media/'+name);
  const widthPct=Math.max(10,Math.min(100,parseInt(node.style.width)||75));
  const cx=Math.round(6_300_000*widthPct/100),cy=Math.round(cx*.5625),docId=index+100;
  const graphic='<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="'+cx+'" cy="'+cy+'"/><wp:docPr id="'+docId+'" name="Изображение '+index+'"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="'+docId+'" name="'+name+'"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="'+id+'"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline>';
  return '<w:r><w:drawing>'+graphic+'</w:drawing></w:r>';
 };
 function inline(node,state={}){
  if(node.nodeType===3){const value=node.nodeValue||'';return value?'<w:r>'+qoDocxRunProps(state)+'<w:t xml:space="preserve">'+qoDocxEscape(value)+'</w:t></w:r>':'';}
  if(node.nodeType!==1)return '';
  const tag=node.tagName.toLowerCase();
  if(tag==='br')return '<w:r><w:br/></w:r>';
  if(tag==='img')return includeImage(node);
  if(tag==='div'&&node.getAttribute('data-qo-break')==='true')return '<w:r><w:br w:type="page"/></w:r>';
  const next={...state};
  if(['b','strong'].includes(tag))next.b=true;if(['i','em'].includes(tag))next.i=true;
  if(tag==='u')next.u=true;if(['s','strike'].includes(tag))next.s=true;
  if(node.style?.fontWeight==='bold'||node.style?.fontWeight==='700')next.b=true;
  if(node.style?.fontStyle==='italic')next.i=true;
  if(node.style?.textDecorationLine?.includes('underline'))next.u=true;
  if(node.style?.textDecorationLine?.includes('line-through'))next.s=true;
  const color=qoDocxColor(node.style?.color),hl=qoDocxColor(node.style?.backgroundColor),size=parseInt(node.style?.fontSize||'',10);
  if(color)next.color=color;if(hl)next.highlight=hl;
  if(Number.isFinite(size)&&size>=8&&size<=96)next.size=size;
  const inner=Array.from(node.childNodes).map(n=>inline(n,next)).join('');
  if(tag==='a'){
   const href=node.getAttribute('href')||'';
   if(/^(https?:|mailto:)/i.test(href)&&href.length<2048){
    const id=relation('http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',href,true);
    return '<w:hyperlink r:id="'+id+'">'+inner+'</w:hyperlink>';
   }
  }
  return inner;
 }
 function nodeBlocks(nodes,depth=0){let xml='';
  for(const node of nodes){
   if(node.nodeType===3){if(node.textContent?.trim())xml+=qoDocxParagraph(inline(node));continue;}
   if(node.nodeType!==1)continue;
   const tag=node.tagName.toLowerCase();
   if(tag==='ul'||tag==='ol'){
    for(const li of node.children){if(li.tagName?.toLowerCase()!=='li')continue;
     const content=Array.from(li.childNodes).filter(n=>n.nodeType!==1||!['ul','ol'].includes(n.tagName.toLowerCase()));
     xml+=qoDocxParagraph(content.map(n=>inline(n)).join(''),'p',{list:tag,depth});
     xml+=nodeBlocks(Array.from(li.children).filter(n=>['ul','ol'].includes(n.tagName.toLowerCase())),depth+1);
    }continue;
   }
   if(tag==='table'){
    const rows=Array.from(node.querySelectorAll('tr')).slice(0,200);
    let tbl='<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>'+['top','left','bottom','right','insideH','insideV'].map(n=>'<w:'+n+' w:val="single" w:sz="4" w:color="A4B9AD"/>').join('')+'</w:tblBorders></w:tblPr>';
    for(const row of rows){tbl+='<w:tr>';
     for(const cell of Array.from(row.cells).slice(0,12)){
      const span=Math.min(12,Math.max(1,+cell.getAttribute('colspan')||1));
      tbl+='<w:tc><w:tcPr>'+(span>1?'<w:gridSpan w:val="'+span+'"/>':'')+'</w:tcPr>'+qoDocxParagraph(Array.from(cell.childNodes).map(n=>inline(n)).join(''))+'</w:tc>';
     }tbl+='</w:tr>';
    }xml+=tbl+'</w:tbl>';continue;
   }
   if(tag==='div'&&node.getAttribute('data-qo-break')==='true'){
    xml+=qoDocxParagraph('<w:r><w:br w:type="page"/></w:r>');continue;
   }
   if(['p','div','h1','h2','h3','blockquote'].includes(tag)){
    const children=Array.from(node.childNodes);
    xml+=qoDocxParagraph(children.map(n=>inline(n)).join(''),tag,{align:node.style?.textAlign});continue;
   }
   xml+=qoDocxParagraph(inline(node));
  }return xml;
 }
 const content=nodeBlocks(Array.from(root.childNodes))||'<w:p/>';
 const l=layout||{},papers={A4:[210,297],A5:[148,210],Letter:[215.9,279.4]};
 let [mmW,mmH]=papers[l.paper]||papers.A4;
 if(l.orientation==='landscape')[mmW,mmH]=[mmH,mmW];
 const twip=n=>Math.round(n*1440/25.4),margin=Math.max(12,Math.min(30,Number(l.margin)||20));
 const hasHeader=!!l.header,hasFooter=!!l.footer||l.pageNumber!==false;
 if(hasHeader)relation('http://schemas.openxmlformats.org/officeDocument/2006/relationships/header','header1.xml');
 if(hasFooter)relation('http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer','footer1.xml');
 const headerId=hasHeader?rels.find(x=>x.target==='header1.xml').id:null,footerId=hasFooter?rels.find(x=>x.target==='footer1.xml').id:null;
 const sect='<w:sectPr>'+(headerId?'<w:headerReference w:type="default" r:id="'+headerId+'"/>':'')+(footerId?'<w:footerReference w:type="default" r:id="'+footerId+'"/>':'')+
  '<w:pgSz w:w="'+twip(mmW)+'" w:h="'+twip(mmH)+'"'+(l.orientation==='landscape'?' w:orient="landscape"':'')+'/>'+
  '<w:pgMar w:top="'+twip(margin)+'" w:right="'+twip(margin)+'" w:bottom="'+twip(margin)+'" w:left="'+twip(margin)+'" w:header="425" w:footer="425" w:gutter="0"/></w:sectPr>';
 const documentXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="'+QO_DOCX_NS+'" xmlns:r="'+QO_DOCX_REL+'" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>'+content+sect+'</w:body></w:document>';
 zip.file('word/document.xml',documentXml);
 const styles=['Normal','Heading1','Heading2','Heading3','Quote'].map(n=>{
   const size=n==='Heading1'?32:n==='Heading2'?28:n==='Heading3'?24:Math.round((Number(l.size)||16)*1.5);
   const name=n.startsWith('Heading')?'heading '+n.slice(-1):n;
   return '<w:style w:type="paragraph" w:styleId="'+n+'"'+(n==='Normal'?' w:default="1"':'')+'><w:name w:val="'+name+'"/><w:rPr><w:sz w:val="'+size+'"/>'+(n==='Normal'?'':'<w:b/>')+'</w:rPr></w:style>';
 }).join('');
 zip.file('word/styles.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="'+QO_DOCX_NS+'">'+styles+'</w:styles>');
 const nums=['bullet','decimal'].map((fmt,i)=>'<w:abstractNum w:abstractNumId="'+i+'">'+Array.from({length:7},(_,lv)=>'<w:lvl w:ilvl="'+lv+'"><w:start w:val="1"/><w:numFmt w:val="'+fmt+'"/><w:lvlText w:val="'+(fmt==='bullet'?'•':'%'+(lv+1)+'.')+'"/><w:pPr><w:ind w:left="'+((lv+1)*720)+'" w:hanging="360"/></w:pPr></w:lvl>').join('')+'</w:abstractNum>').join('');
 zip.file('word/numbering.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="'+QO_DOCX_NS+'">'+nums+'<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>');
 rels.push({id:'rId'+(rels.length+1),type:'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',target:'styles.xml'});
 rels.push({id:'rId'+(rels.length+1),type:'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering',target:'numbering.xml'});
 const headerBody=t=>'<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t xml:space="preserve">'+qoDocxEscape(t)+'</w:t></w:r></w:p>';
 if(hasHeader)zip.file('word/header1.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="'+QO_DOCX_NS+'">'+headerBody(String(l.header).slice(0,120))+'</w:hdr>');
 if(hasFooter){const text=String(l.footer||'').slice(0,120);
  const number=l.pageNumber===false?'':'<w:r><w:t xml:space="preserve">  Стр. </w:t></w:r><w:fldSimple w:instr="PAGE"/>';
  zip.file('word/footer1.xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="'+QO_DOCX_NS+'"><w:p><w:r><w:t xml:space="preserve">'+qoDocxEscape(text)+'</w:t></w:r>'+number+'</w:p></w:ftr>');
 }
 for(const file of media)zip.file('word/media/'+file.name,file.data,{base64:true});
 zip.file('word/_rels/document.xml.rels',qoDocxRelationships(rels));
 zip.file('_rels/.rels',qoDocxRelationships([{id:'rId1',type:'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',target:'word/document.xml'}]));
 const types='<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+
  ['jpg','png','gif'].filter(ext=>media.some(m=>m.ext===ext)).map(ext=>'<Default Extension="'+ext+'" ContentType="image/'+(ext==='jpg'?'jpeg':ext)+'"/>').join('')+
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'+
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'+
  '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>'+
  (hasHeader?'<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>':'')+
  (hasFooter?'<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>':'');
 zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="'+QO_DOCX_CT+'">'+types+'</Types>');
 return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
}
async function qoDocxImport(file){
 if(!globalThis.JSZip)throw Error('Модуль DOCX недоступен');
 if(!file||file.size>12_000_000)throw Error('DOCX превышает лимит 12 МБ');
 const zip=await globalThis.JSZip.loadAsync(file,{checkCRC32:true}),files=Object.values(zip.files);
 if(files.length>1500||files.some(f=>(f._data?.uncompressedSize||0)>12_000_000))throw Error('DOCX содержит слишком много или слишком большие файлы');
 const main=zip.file('word/document.xml');if(!main)throw Error('В DOCX отсутствует документ Word');
 if((main._data?.uncompressedSize||0)>5_000_000)throw Error('Слишком большой текст DOCX');
 const xml=qoDocxXml(await main.async('string'));
 const body=qoDocxDesc(xml.documentElement,'body')[0];if(!body)throw Error('В DOCX отсутствует содержимое');
 const docRels=new Map(), relsFile=zip.file('word/_rels/document.xml.rels');
 if(relsFile){const rels=qoDocxXml(await relsFile.async('string'));
  for(const el of Array.from(rels.getElementsByTagName('*'))){if(el.localName!=='Relationship')continue;
   docRels.set(el.getAttribute('Id'),{target:el.getAttribute('Target')||'',external:el.getAttribute('TargetMode')==='External',type:el.getAttribute('Type')||''});
  }
 }
 const numFmt=new Map();const nf=zip.file('word/numbering.xml');
 if(nf){const root=qoDocxXml(await nf.async('string'));
  const abs=new Map();for(const a of Array.from(root.getElementsByTagName('*')).filter(e=>e.localName==='abstractNum')){
   const lvl=qoDocxDesc(a,'numFmt')[0];abs.set(a.getAttribute('w:abstractNumId'),qoDocxAttr(lvl,'val')||'bullet');
  }
  for(const n of Array.from(root.getElementsByTagName('*')).filter(e=>e.localName==='num')){
   const id=n.getAttribute('w:numId'),abstract=qoDocxAttr(qoDocxDesc(n,'abstractNumId')[0],'val');numFmt.set(id,abs.get(abstract)||'bullet');
  }
 }
 const mediaCache=new Map();
 async function runHTML(run){
  const props=qoDocxChild(run,'rPr'),marks=[];
  if(qoDocxChild(props,'b')&&qoDocxAttr(qoDocxChild(props,'b'),'val')!=='0')marks.push('b');
  if(qoDocxChild(props,'i')&&qoDocxAttr(qoDocxChild(props,'i'),'val')!=='0')marks.push('i');
  if(qoDocxChild(props,'u'))marks.push('u');if(qoDocxChild(props,'strike'))marks.push('s');
  const style=[];const color=qoDocxAttr(qoDocxChild(props,'color'),'val');if(/^[0-9a-f]{6}$/i.test(color))style.push('color:#'+color);
  const shading=qoDocxAttr(qoDocxChild(props,'shd'),'fill');if(/^[0-9a-f]{6}$/i.test(shading))style.push('background-color:#'+shading);
  const size=Number(qoDocxAttr(qoDocxChild(props,'sz'),'val'));if(Number.isFinite(size)&&size>=12&&size<=144)style.push('font-size:'+Math.round(size/1.5)+'px');
  let text='';
  for(const child of Array.from(run.children||[])){
   if(child.localName==='t')text+=qoDocxEscape(child.textContent||'');
   else if(child.localName==='tab')text+='&emsp;';
   else if(child.localName==='br'){if(qoDocxAttr(child,'type')==='page')text+='<span data-page-break="true"></span>';else text+='<br>';}
   else if(child.localName==='drawing'){
    const blip=Array.from(child.getElementsByTagName('*')).find(e=>e.localName==='blip');
    const id=blip?.getAttributeNS(QO_DOCX_REL,'embed')||blip?.getAttribute('r:embed');
    const rel=docRels.get(id),target=rel?.target||'';
    const filename=target.replace(/^\/+/,''),entry=filename.startsWith('word/')?filename:'word/'+filename.replace(/^\.\.\//,'');
    const ext=entry.split('.').pop()?.toLowerCase();
    if(rel&&!rel.external&&/^word\/media\/[^/]+$/.test(entry)&&['png','jpg','jpeg','gif'].includes(ext)&&zip.file(entry)){
     if(!mediaCache.has(entry)){
      const f=zip.file(entry);if((f._data?.uncompressedSize||0)<=1_500_000){
       const b64=await f.async('base64');if(b64.length<=2_000_000)mediaCache.set(entry,'data:image/'+(ext==='jpg'?'jpeg':ext)+';base64,'+b64);
      }
     }
     const data=mediaCache.get(entry);if(data)text+='<img src="'+data+'" alt="Изображение" style="width:75%">';
    }
   }
  }
  if(!text)return '';
  for(const mark of marks)text='<'+mark+'>'+text+'</'+mark+'>';
  if(style.length)text='<span style="'+style.join(';')+'">'+text+'</span>';
  return text;
 }
 async function paragraphHTML(p){
  const pr=qoDocxChild(p,'pPr'),s=qoDocxAttr(qoDocxChild(pr,'pStyle'),'val');
  const heading=/^Heading([123])$/i.exec(s);const tag=heading?'h'+heading[1]:s==='Title'?'h1':s==='Subtitle'?'h2':'p';
  const alignment=qoDocxAttr(qoDocxChild(pr,'jc'),'val');
  const align={both:'justify',center:'center',right:'right',left:'left'}[alignment];
  const parts=[];
  for(const node of Array.from(p.children||[])){
   if(node.localName==='r')parts.push(await runHTML(node));
   else if(node.localName==='hyperlink'){
    const id=node.getAttributeNS(QO_DOCX_REL,'id')||node.getAttribute('r:id'),rel=docRels.get(id);
    let content='';for(const inner of Array.from(node.children||[]))if(inner.localName==='r')content+=await runHTML(inner);
    if(rel&&rel.external&&/^(https?:|mailto:)/i.test(rel.target))parts.push('<a href="'+qoDocxEscape(rel.target)+'">'+content+'</a>');else parts.push(content);
   }
   else if(node.localName==='fldSimple'){parts.push(qoDocxEscape(node.textContent||''));}
  }
  const numPr=qoDocxChild(pr,'numPr'),numId=qoDocxAttr(qoDocxChild(numPr,'numId'),'val');
  return {tag,html:'<'+tag+(align?' style="text-align:'+align+'"':'')+'>'+(parts.join('')||'<br>')+'</'+tag+'>',inner:parts.join(''),list:numId?((numFmt.get(numId)==='decimal')?'ol':'ul'):/^ListBullet/i.test(s)?'ul':/^ListNumber/i.test(s)?'ol':null};
 }
 async function tableHTML(table){let out='<table><tbody>';
  for(const row of qoDocxChildren(table,'tr').slice(0,200)){
   out+='<tr>';
   for(const cell of qoDocxChildren(row,'tc').slice(0,12)){
    const span=Math.max(1,Math.min(12,Number(qoDocxAttr(qoDocxChild(qoDocxChild(cell,'tcPr'),'gridSpan'),'val'))||1));
    let content='';for(const p of qoDocxChildren(cell,'p'))content+=(await paragraphHTML(p)).inner+'<br>';
    out+='<td'+(span>1?' colspan="'+span+'"':'')+'>'+(content||'<br>')+'</td>';
   }out+='</tr>';
  }return out+'</tbody></table>';
 }
 let html='',activeList=null;
 for(const node of Array.from(body.children||[])){
  if(node.localName==='sectPr')continue;
  if(node.localName==='tbl'){
   if(activeList){html+='</'+activeList+'>';activeList=null;}html+=await tableHTML(node);continue;
  }
  if(node.localName!=='p')continue;
  const p=await paragraphHTML(node),type=p.list;
  if(type!==activeList){if(activeList)html+='</'+activeList+'>';if(type)html+='<'+type+'>';activeList=type;}
  if(type)html+='<li>'+(p.inner||'<br>')+'</li>';
  else html+=p.html;
 }
 if(activeList)html+='</'+activeList+'>';
 const sect=qoDocxDesc(body,'sectPr')[0],size=qoDocxChild(sect,'pgSz'),mar=qoDocxChild(sect,'pgMar');
 let width=Number(qoDocxAttr(size,'w'))*25.4/1440,height=Number(qoDocxAttr(size,'h'))*25.4/1440;
 const landscape=qoDocxAttr(size,'orient')==='landscape'||width>height;
 const orig=landscape?[height,width]:[width,height];
 const papers={A4:[210,297],A5:[148,210],Letter:[215.9,279.4]};let paper='A4';
 for(const [name,dim] of Object.entries(papers))if(Math.abs(orig[0]-dim[0])<3&&Math.abs(orig[1]-dim[1])<3){paper=name;break;}
 const mmMargin=Number(qoDocxAttr(mar,'top'))*25.4/1440;
 const margin=[12,15,20,25,30].reduce((a,b)=>Math.abs(a-mmMargin)<Math.abs(b-mmMargin)?a:b,20);
 const readHead=async(type)=>{
  const ref=qoDocxChildren(sect,type+'Reference')[0],id=ref?.getAttributeNS(QO_DOCX_REL,'id')||ref?.getAttribute('r:id');
  const rel=docRels.get(id);if(!rel||rel.external||!/^\w+\d+\.xml$/.test(rel.target))return {text:'',pageNumber:false};
  const entry=zip.file('word/'+rel.target);if(!entry||(entry._data?.uncompressedSize||0)>200000)return {text:'',pageNumber:false};
  const dom=qoDocxXml(await entry.async('string'));
  return {text:qoDocxDesc(dom.documentElement,'t').map(n=>n.textContent||'').join(' ').trim().slice(0,120),pageNumber:Array.from(dom.getElementsByTagName('*')).some(n=>n.localName==='fldSimple'&&/\bPAGE\b/.test(n.getAttribute('w:instr')||''))};
 };
 const header=await readHead('header'),footer=await readHead('footer');
 return {html,layout:{paper,orientation:landscape?'landscape':'portrait',margin,header:header.text,footer:footer.text.replace(/\s*Стр\.\s*$/,'').trim(),pageNumber:footer.pageNumber},name:file.name.replace(/\.docx$/i,'').slice(0,120),warnings:'Поддерживаются текст, базовое оформление, списки, таблицы, ссылки, встроенные изображения и параметры страницы. Макросы, комментарии, изменения, плавающие объекты и сложные колонтитулы не переносятся.'};
}
