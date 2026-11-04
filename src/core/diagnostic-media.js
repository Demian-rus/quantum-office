/* TASK121 — images for questions and teacher answers.
   Assets live in IndexedDB; QDIAGX/QTPLX/QBANKX carry assets as portable ZIPs.
   No external links, network requests or third-party upload services. */
const QD_MEDIA_DB='quantum-office-diagnostic-media-v1';
const QD_MEDIA_MAX_FILE=12*1024*1024, QD_MEDIA_MAX_ZIP=60*1024*1024;
const qdMediaUrls=new Map();
let qdMediaPasteTarget=null,qdMediaDrawing=null,qdMediaBound=false;
function qdMediaValidId(v){return typeof v==='string'&&/^[A-Za-z0-9_-]{1,65}$/.test(v);}
function qdMediaSafe(raw){
  if(!raw||typeof raw!=='object'||!qdMediaValidId(raw.id))return null;
  return {id:raw.id,caption:qdText(raw.caption,180),
    display:['small','medium','wide'].includes(raw.display)?raw.display:'medium'};
}
function qdMediaNewId(){return 'img-'+qdNewId();}
function qdMediaDb(){
  if(!('indexedDB' in window))return Promise.reject(Error('Изображения недоступны: IndexedDB отключён'));
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(QD_MEDIA_DB,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('assets',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||Error('Не удалось открыть хранилище'));
  });
}
async function qdMediaGet(id){
  if(!qdMediaValidId(id))return null;
  const db=await qdMediaDb();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('assets','readonly'),req=tx.objectStore('assets').get(id);
    req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
  });}finally{db.close();}
}
async function qdMediaPut(asset){
  if(!qdMediaValidId(asset?.id)||!(asset.blob instanceof Blob)||asset.blob.size>QD_MEDIA_MAX_FILE||
    !['image/png','image/jpeg','image/webp'].includes(asset.blob.type))throw Error('Недопустимое изображение');
  const db=await qdMediaDb();
  try{await new Promise((resolve,reject)=>{
    const tx=db.transaction('assets','readwrite');
    tx.objectStore('assets').put(asset);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });}finally{db.close();}
  const url=qdMediaUrls.get(asset.id);
  if(url){URL.revokeObjectURL(url);qdMediaUrls.delete(asset.id);}
}
async function qdMediaUrl(id){
  if(qdMediaUrls.has(id))return qdMediaUrls.get(id);
  const asset=await qdMediaGet(id);
  if(!asset)return '';
  const url=URL.createObjectURL(asset.blob);qdMediaUrls.set(id,url);return url;
}
function qdMediaRefQuestion(qid){
  return qdDoc().sections.flatMap(s=>s.questions).find(q=>q.id===qid);
}
function qdMediaKind(kind){return kind==='answer'?'answer':'prompt';}
function qdMediaLabel(kind){return kind==='answer'?'Иллюстрация ответа':'Иллюстрация вопроса';}
function qdMediaKey(kind){return kind==='answer'?'answerMedia':'promptMedia';}
function qdMediaEsc(x){return qdEsc(String(x??''));}
function qdMediaSlotHTML(q,kind){
  const ref=qdMediaSafe(q[qdMediaKey(kind)]);
  return '<details class="qd-media-fold" '+(ref?'open':'')+'><summary>'+qdMediaLabel(kind)+(ref?' · прикреплена':' · добавить файл, скриншот или рисунок')+'</summary>'+qdMediaSlotContent(q,kind)+'</details>';
}
function qdMediaSlotContent(q,kind){
  const ref=qdMediaSafe(q[qdMediaKey(kind)]),key=qdMediaKind(kind),qid=qdMediaEsc(q.id);
  return '<section class="qd-media-slot'+(ref?' is-filled':'')+'" tabindex="0" data-qd-media-slot="'+key+
    '" data-qid="'+qid+'" aria-label="'+qdMediaLabel(kind)+'">'+
    '<div class="qd-media-slot-title"><span class="qd-media-slot-icon" aria-hidden="true">▧</span><strong>'+
      qdMediaLabel(kind)+'</strong><span class="qd-media-slot-hint">PNG · JPG · WebP</span></div>'+
    (ref?'<div class="qd-media-preview qd-media-'+ref.display+'">'+
      '<button type="button" class="qd-media-preview-open" data-qd-media-action="view" data-qid="'+qid+
        '" data-kind="'+key+'" title="Открыть изображение крупно"><img data-qd-media-id="'+ref.id+
        '" alt="'+qdMediaEsc(ref.caption||qdMediaLabel(kind))+'"><span>Увеличить</span></button></div>'+
      '<div class="qd-media-settings"><label>Подпись<input data-qd-media-caption data-qid="'+qid+
        '" data-kind="'+key+'" maxlength="180" value="'+qdMediaEsc(ref.caption)+'" placeholder="Необязательно"></label>'+
      '<label>Размер<select data-qd-media-display data-qid="'+qid+'" data-kind="'+key+'">'+
        ['small','medium','wide'].map((v,i)=>'<option value="'+v+'" '+(ref.display===v?'selected':'')+'>'+
          ['Компактный','Обычный','Широкий'][i]+'</option>').join('')+'</select></label></div>':
      '<p class="qd-media-empty">Перетащите изображение сюда или вставьте скриншот из буфера.</p>')+
    '<div class="qd-media-actions"><button type="button" data-qd-media-action="paste" data-qid="'+qid+
       '" data-kind="'+key+'">Вставить скрин</button>'+
      '<button type="button" data-qd-media-action="upload" data-qid="'+qid+
       '" data-kind="'+key+'">'+(ref?'Заменить файл':'Загрузить')+'</button>'+
      '<button type="button" data-qd-media-action="draw" data-qid="'+qid+
       '" data-kind="'+key+'">'+(ref?'Редактировать рисунок':'Нарисовать')+'</button>'+
      (ref?'<button type="button" class="qd-media-remove" data-qd-media-action="remove" data-qid="'+qid+
       '" data-kind="'+key+'">Убрать</button>':'')+
      '<input type="file" hidden data-qd-media-file data-qid="'+qid+'" data-kind="'+key+
       '" accept="image/png,image/jpeg,image/webp"></div></section>';
}
function qdMediaRunHTML(ref,kind){
  const meta=qdMediaSafe(ref);
  if(!meta)return '';
  return '<figure class="qd-media-run qd-media-'+meta.display+'"><button type="button" class="qd-media-preview-open" '+
    'data-qd-media-action="view" data-kind="'+kind+'" data-qid="" data-asset="'+meta.id+
    '" title="Открыть иллюстрацию крупно"><img data-qd-media-id="'+meta.id+
    '" alt="'+qdMediaEsc(meta.caption||qdMediaLabel(kind))+'"></button>'+
    (meta.caption?'<figcaption>'+qdMediaEsc(meta.caption)+'</figcaption>':'')+'</figure>';
}
function qdMediaDecorate(root){
  if(!root)return;
  if(qdMode==='builder'){
    for(const card of root.querySelectorAll('.qd-edit-card')){
      const q=qdMediaRefQuestion(card.dataset.qid);
      if(!q)continue;
      for(const kind of ['prompt','answer']){
        const textarea=card.querySelector('[data-qd-field="'+kind+'"]');
        const label=textarea?.closest('label');
        if(label&&!card.querySelector('[data-qd-media-slot="'+kind+'"]'))
          label.insertAdjacentHTML('afterend',qdMediaSlotHTML(q,kind));
      }
      const chips=[];
      if(qdMediaSafe(q.promptMedia))chips.push('<span title="Есть иллюстрация вопроса">▣ условие</span>');
      if(qdMediaSafe(q.answerMedia))chips.push('<span title="Есть иллюстрация ответа">▣ ответ</span>');
      if(chips.length){
        const preview=card.querySelector('.qd-card-preview');
        if(preview)preview.insertAdjacentHTML('afterbegin','<span class="qd-media-chips">'+chips.join('')+'</span>');
      }
    }
  }else if(qdMode==='run'){
    for(const card of root.querySelectorAll('.qd-run-card')){
      const q=qdMediaRefQuestion(card.dataset.qid);
      if(!q)continue;
      const prompt=card.querySelector('.qd-question .qd-rich-content')||card.querySelector('.qd-question p'),answer=card.querySelector('.qd-chat-answer p');
      if(prompt&&qdMediaSafe(q.promptMedia))prompt.insertAdjacentHTML('afterend',qdMediaRunHTML(q.promptMedia,'prompt'));
      if(answer&&qdRevealed.has(q.id)&&qdMediaSafe(q.answerMedia))
        answer.insertAdjacentHTML('afterend',qdMediaRunHTML(q.answerMedia,'answer'));
    }
  }
  for(const img of root.querySelectorAll('img[data-qd-media-id]')){
    qdMediaUrl(img.dataset.qdMediaId).then(url=>{
      if(img.isConnected){
        if(url)img.src=url;else{
          img.alt='Изображение недоступно в этом браузере. Импортируйте файл с медиа.';
          img.classList.add('qd-media-missing');
        }
      }
    }).catch(()=>{if(img.isConnected){img.alt='Не удалось прочитать иллюстрацию';img.classList.add('qd-media-missing');}});
  }
  const builder=root.querySelector('.qd-builder-actionbar');
  if(builder&&typeof qdDeskTools!=='function'&&!builder.querySelector('[data-qd-media-action="help"]')){
    (builder.querySelector('.qd-command-row:last-child')||builder).insertAdjacentHTML('beforeend','<button type="button" data-qd-media-action="help" '+
      'title="Изображения к вопросам и ответам">Иллюстрации</button>');
  }
  for(const input of root.querySelectorAll('#qo-diag-file'))input.accept+='.qdiagx,';
  for(const input of root.querySelectorAll('#qd-library-file'))input.accept+='.qtplx,';
  for(const input of root.querySelectorAll('#qd-bank-file'))input.accept+='.qbankx,';
}
const qdMediaOrigNormalize=qdNormalize;
qdNormalize=function(raw,allowRun=true){
  const doc=qdMediaOrigNormalize(raw,allowRun);
  if(!raw||!Array.isArray(raw.sections))return doc;
  for(let i=0;i<doc.sections.length;i++){
    const inQuestions=raw.sections[i]?.questions;
    if(!Array.isArray(inQuestions))continue;
    for(let j=0;j<doc.sections[i].questions.length;j++){
      const target=doc.sections[i].questions[j],source=inQuestions[j];
      for(const kind of ['prompt','answer']){
        const meta=qdMediaSafe(source?.[qdMediaKey(kind)]);
        if(meta)target[qdMediaKey(kind)]=meta;
      }
    }
  }
  return doc;
};
const qdMediaOrigCopyCard=qdCopyCard;
qdCopyCard=function(q,independentId=true){
  const copy=qdMediaOrigCopyCard(q,independentId);
  for(const kind of ['prompt','answer']){
    const meta=qdMediaSafe(q?.[qdMediaKey(kind)]);
    if(meta)copy[qdMediaKey(kind)]={...meta};
  }
  return copy;
};
const qdMediaOrigRefresh=qdRefresh;
qdRefresh=function(){
  qdMediaOrigRefresh();
  qdMediaDecorate(document.getElementById('qo-diag-root'));
};
async function qdMediaCompress(file){
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>QD_MEDIA_MAX_FILE)
    throw Error('Только PNG/JPG/WebP до 12 МБ');
  const bitmap=await createImageBitmap(file),width=Math.min(1600,bitmap.width),height=Math.min(1600,bitmap.height);
  if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>60_000_000){
    bitmap.close();throw Error('Слишком большое изображение');
  }
  const scale=Math.min(1,1600/bitmap.width,1600/bitmap.height);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const cx=canvas.getContext('2d');
  cx.fillStyle='#ffffff';cx.fillRect(0,0,canvas.width,canvas.height);
  cx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  let blob=await new Promise(r=>canvas.toBlob(r,'image/webp',.83));
  if(!blob)blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
  if(!blob||blob.size>QD_MEDIA_MAX_FILE)throw Error('Не удалось обработать изображение');
  return blob;
}
async function qdMediaAssign(qid,kind,blob){
  const q=qdMediaRefQuestion(qid);
  if(!q)throw Error('Карточка больше не существует');
  const id=qdMediaNewId();
  await qdMediaPut({id,blob,createdAt:Date.now()});
  q[qdMediaKey(kind)]={id,caption:'',display:'medium'};
  qdStore();qdRefresh();
  if(typeof qdBuilderSaveStatus==='function')qdBuilderSaveStatus();
  status('Иллюстрация прикреплена к '+(kind==='answer'?'ответу':'вопросу'));
}
async function qdMediaAssignFile(file,qid,kind){
  try{await qdMediaAssign(qid,kind,await qdMediaCompress(file));}
  catch(e){status('Изображение: '+(e?.message||'не удалось прикрепить'),true);}
}
function qdMediaPicker(qid,kind){
  const slot=[...document.querySelectorAll('.qd-media-slot')].find(el=>el.dataset.qid===qid&&el.dataset.qdMediaSlot===kind);
  slot?.querySelector('[data-qd-media-file]')?.click();
}
async function qdMediaClipboard(qid,kind){
  qdMediaPasteTarget={qid,kind};
  const slot=[...document.querySelectorAll('.qd-media-slot')].find(el=>el.dataset.qid===qid&&el.dataset.qdMediaSlot===kind);
  slot?.focus();
  if(navigator.clipboard?.read){
    try{
      const items=await navigator.clipboard.read();
      for(const item of items){
        const mime=item.types.find(t=>['image/png','image/jpeg','image/webp'].includes(t));
        if(mime){await qdMediaAssignFile(await item.getType(mime),qid,kind);return;}
      }
    }catch(_){}
  }
  status('Нажмите Ctrl+V в выбранном блоке — скриншот прикрепится сюда');
}
function qdMediaPasteEvent(event){
  if(qdMode!=='builder')return;
  const item=[...(event.clipboardData?.items||[])].find(x=>x.kind==='file'&&x.type.startsWith('image/'));
  if(!item)return;
  const textarea=event.target.closest?.('[data-qd-field="prompt"],[data-qd-field="answer"]');
  const slot=event.target.closest?.('.qd-media-slot');
  const target=textarea?{qid:textarea.dataset.qid,kind:textarea.dataset.qdField}:
    slot?{qid:slot.dataset.qid,kind:slot.dataset.qdMediaSlot}:qdMediaPasteTarget;
  if(!target?.qid)return;
  event.preventDefault();event.stopPropagation();
  qdMediaPasteTarget=null;
  qdMediaAssignFile(item.getAsFile(),target.qid,qdMediaKind(target.kind));
}
function qdMediaDropEvent(event){
  const slot=event.target.closest?.('.qd-media-slot');
  if(!slot)return;
  event.preventDefault();event.stopPropagation();
  const file=[...(event.dataTransfer?.files||[])].find(x=>x.type.startsWith('image/'));
  if(file)qdMediaAssignFile(file,slot.dataset.qid,slot.dataset.qdMediaSlot);
}
function qdMediaView(id){
  if(!qdMediaValidId(id))return;
  qdMediaUrl(id).then(url=>{
    if(!url){status('Изображение недоступно. Импортируйте .qdiagx или .qtplx.',true);return;}
    const dialog=document.createElement('dialog');dialog.className='qd-media-dialog';
    dialog.innerHTML='<div class="qd-media-viewer"><div class="qd-media-viewer-head"><strong>Просмотр иллюстрации</strong>'+
      '<button type="button" data-qd-media-dismiss>Закрыть ×</button></div>'+
      '<img alt="Увеличенная иллюстрация" src="'+url+'"></div>';
    document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());
    dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-qd-media-dismiss]'))dialog.close();});
    dialog.showModal();
  }).catch(()=>status('Не удалось открыть изображение',true));
}
function qdMediaDraw(qid,kind){
  const q=qdMediaRefQuestion(qid);if(!q)return;
  const existing=qdMediaSafe(q[qdMediaKey(kind)]);
  const dialog=document.createElement('dialog');dialog.className='qd-media-dialog qd-media-draw-dialog';
  dialog.innerHTML='<div class="qd-media-draw-panel"><header><div><strong>Редактор иллюстрации</strong>'+
    '<p>'+qdMediaLabel(kind)+' · карандаш и ластик</p></div><button type="button" data-draw-close>Закрыть ×</button></header>'+
    '<div class="qd-media-draw-tools" role="toolbar" aria-label="Рисование">'+
    '<button type="button" data-draw-tool="pen" class="active">Карандаш</button>'+
    '<button type="button" data-draw-tool="eraser">Ластик</button>'+
    '<label>Цвет <input type="color" data-draw-color value="#183b63"></label>'+
    '<label>Толщина <input type="range" data-draw-width min="2" max="28" value="4"></label>'+
    '<button type="button" data-draw-undo>Отменить</button>'+
    '<button type="button" data-draw-clear>Очистить</button></div>'+
    '<canvas width="960" height="540" aria-label="Холст для рисунка"></canvas>'+
    '<footer><span>Мышь, стилус или палец</span><button type="button" data-draw-close>Отмена</button>'+
    '<button type="button" class="qd-primary" data-draw-save>Сохранить рисунок</button></footer></div>';
  document.body.append(dialog);
  const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d'),undo=[];
  let tool='pen',color='#183b63',width=4,painting=false,last=null;
  function blank(){ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);}
  function pushUndo(){if(undo.length>=12)undo.shift();undo.push(ctx.getImageData(0,0,canvas.width,canvas.height));}
  blank();
  if(existing)qdMediaUrl(existing.id).then(url=>{if(!url||!dialog.isConnected)return;
    const image=new Image();image.onload=()=>{if(dialog.isConnected){ctx.drawImage(image,0,0,canvas.width,canvas.height);}};image.src=url;
  });
  const point=event=>{const r=canvas.getBoundingClientRect();return {
    x:(event.clientX-r.left)*canvas.width/r.width,y:(event.clientY-r.top)*canvas.height/r.height
  };};
  canvas.addEventListener('pointerdown',event=>{
    event.preventDefault();canvas.setPointerCapture(event.pointerId);pushUndo();
    painting=true;last=point(event);
    ctx.beginPath();ctx.arc(last.x,last.y,(tool==='eraser'?width*3:width)/2,0,Math.PI*2);
    ctx.fillStyle=tool==='eraser'?'#ffffff':color;ctx.fill();
  });
  canvas.addEventListener('pointermove',event=>{
    if(!painting)return;event.preventDefault();const next=point(event);
    ctx.strokeStyle=tool==='eraser'?'#ffffff':color;ctx.lineWidth=tool==='eraser'?width*3:width;
    ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(next.x,next.y);ctx.stroke();last=next;
  });
  const finish=()=>{painting=false;last=null;};
  canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);
  dialog.addEventListener('click',async event=>{
    const toolButton=event.target.closest('[data-draw-tool]');
    if(toolButton){tool=toolButton.dataset.drawTool;
      dialog.querySelectorAll('[data-draw-tool]').forEach(b=>b.classList.toggle('active',b===toolButton));return;}
    if(event.target.closest('[data-draw-undo]')){const frame=undo.pop();if(frame)ctx.putImageData(frame,0,0);return;}
    if(event.target.closest('[data-draw-clear]')){pushUndo();blank();return;}
    if(event.target.closest('[data-draw-close]')){dialog.close();return;}
    if(event.target.closest('[data-draw-save]')){
      const blob=await new Promise(r=>canvas.toBlob(r,'image/webp',.85));
      if(blob){await qdMediaAssign(qid,kind,blob);dialog.close();}
    }
  });
  dialog.addEventListener('input',event=>{
    if(event.target.matches('[data-draw-color]'))color=event.target.value;
    if(event.target.matches('[data-draw-width]'))width=Number(event.target.value);
  });
  dialog.addEventListener('close',()=>dialog.remove());
  dialog.showModal();
}
function qdMediaAction(event){
  const button=event.target.closest('[data-qd-media-action]');
  if(!button)return false;
  event.preventDefault();event.stopPropagation();
  const action=button.dataset.qdMediaAction,qid=button.dataset.qid,
    kind=qdMediaKind(button.dataset.kind),q=qdMediaRefQuestion(qid);
  if(action==='help'){status('Добавьте PNG/JPG/WebP, вставьте Ctrl+V в блок или нарисуйте схему. При экспорте изображения включаются в .qdiagx/.qtplx.');return true;}
  if(action==='view'){
    const ref=q?.[qdMediaKey(kind)],id=button.dataset.asset||qdMediaSafe(ref)?.id;qdMediaView(id);return true;
  }
  if(!q)return true;
  if(action==='upload')qdMediaPicker(qid,kind);
  if(action==='paste')qdMediaClipboard(qid,kind);
  if(action==='draw')qdMediaDraw(qid,kind);
  if(action==='remove'&&confirm('Убрать иллюстрацию из этой карточки?')){
    delete q[qdMediaKey(kind)];qdStore();qdRefresh();qdBuilderSaveStatus();
  }
  return true;
}
const qdMediaOrigClick=qdOnClick;
qdOnClick=function(event){if(qdMediaAction(event))return;return qdMediaOrigClick(event);};
const qdMediaOrigChange=qdOnChange;
qdOnChange=function(event){
  const target=event.target;
  if(target.matches?.('[data-qd-media-file]')){
    const file=target.files?.[0],qid=target.dataset.qid,kind=target.dataset.kind;
    target.value='';if(file)qdMediaAssignFile(file,qid,kind);return;
  }
  if(target.matches?.('[data-qd-media-display]')){
    const q=qdMediaRefQuestion(target.dataset.qid),ref=q?.[qdMediaKey(target.dataset.kind)];
    if(ref){ref.display=['small','medium','wide'].includes(target.value)?target.value:'medium';
      qdStore();qdRefresh();qdBuilderSaveStatus();}
    return;
  }
  if(target.id==='qo-diag-file'&&target.files?.[0]?.name.toLowerCase().endsWith('.qdiagx')){
    const file=target.files[0];target.value='';
    qdMediaImportArchive(file,'diagnostic');return;
  }
  if(target.id==='qd-library-file'&&target.files?.[0]?.name.toLowerCase().endsWith('.qtplx')){
    const file=target.files[0];target.value='';
    qdMediaImportArchive(file,'templates');return;
  }
  if(target.id==='qd-bank-file'&&target.files?.[0]?.name.toLowerCase().endsWith('.qbankx')){
    const file=target.files[0];target.value='';
    qdMediaImportArchive(file,'bank');return;
  }
  return qdMediaOrigChange(event);
};
const qdMediaOrigInput=qdOnInput;
qdOnInput=function(event){
  const el=event.target;
  if(el.matches?.('[data-qd-media-caption]')){
    const q=qdMediaRefQuestion(el.dataset.qid),ref=q?.[qdMediaKey(el.dataset.kind)];
    if(ref){ref.caption=qdText(el.value,180);qdStore();qdBuilderSaveStatus();}
    return;
  }
  return qdMediaOrigInput(event);
};
const qdMediaOrigMount=qoDiagnosticMount;
qoDiagnosticMount=function(){
  qdMediaOrigMount();
  const root=document.getElementById('qo-diag-root');
  if(root&&!qdMediaBound){
    root.addEventListener('paste',qdMediaPasteEvent,true);
    root.addEventListener('dragover',e=>{if(e.target.closest('.qd-media-slot'))e.preventDefault();});
    root.addEventListener('drop',qdMediaDropEvent);
    qdMediaBound=true;
  }
};
function qdMediaReferenced(data){
  const ids=new Set();
  function scan(q){for(const kind of ['prompt','answer']){
    const ref=qdMediaSafe(q?.[qdMediaKey(kind)]);if(ref)ids.add(ref.id);
  }}
  if(Array.isArray(data?.run?.document?.sections))for(const section of data.run.document.sections)for(const q of section.questions||[])scan(q);
  if(Array.isArray(data?.sections))for(const s of data.sections)for(const q of s.questions||[])scan(q);
  if(Array.isArray(data?.templates))for(const t of data.templates)for(const s of t.sections||[])for(const q of s.questions||[])scan(q);
  if(Array.isArray(data?.questions))for(const entry of data.questions)scan(entry.question);
  return [...ids];
}
async function qdMediaExportArchive(type,data,filename){
  const ids=qdMediaReferenced(data);
  const zip=new JSZip(),assets=[];
  for(const id of ids){
    const asset=await qdMediaGet(id);
    if(!asset)throw Error('Не найдено изображение '+id+'. Импортируйте ранее сохранённый файл с медиа.');
    const ext=asset.blob.type==='image/png'?'png':asset.blob.type==='image/jpeg'?'jpg':'webp';
    const path='media/'+id+'.'+ext;
    zip.file(path,asset.blob);assets.push({id,path,mime:asset.blob.type,size:asset.blob.size});
  }
  zip.file('manifest.json',JSON.stringify({format:'quantum-diagnostic-media',version:1,type,data,assets}));
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:5}});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  status('Скачивание '+filename+' запрошено. Изображения включены в архив.');
}
async function qdMediaImportArchive(file,type){
  try{
    if(!file||file.size>QD_MEDIA_MAX_ZIP)throw Error('Архив превышает 60 МБ');
    const zip=await JSZip.loadAsync(await file.arrayBuffer(),{checkCRC32:true});
    const entry=zip.file('manifest.json');
    if(!entry)throw Error('В архиве отсутствует manifest.json');
    const manifest=JSON.parse(await entry.async('string'));
    if(manifest.format!=='quantum-diagnostic-media'||manifest.version!==1||manifest.type!==type||
      !Array.isArray(manifest.assets)||manifest.assets.length>240||!manifest.data)
      throw Error('Неподдерживаемый архив');
    const expected=new Set(qdMediaReferenced(manifest.data));
    if(expected.size!==manifest.assets.length)throw Error('Ссылки на изображения не совпадают с содержимым архива');
    const files=[],mapping=new Map();
    for(const descriptor of manifest.assets){
      if(!qdMediaValidId(descriptor.id)||!expected.has(descriptor.id)||
        !/^(image\/png|image\/jpeg|image\/webp)$/.test(descriptor.mime)||
        !/^media\/[A-Za-z0-9_-]{1,65}\.(png|jpg|webp)$/.test(descriptor.path)||
        descriptor.size>QD_MEDIA_MAX_FILE||descriptor.size<1)
        throw Error('Некорректное вложение');
      const zipFile=zip.file(descriptor.path);
      if(!zipFile)throw Error('Отсутствует '+descriptor.path);
      const uint8=await zipFile.async('uint8array');
      if(uint8.byteLength!==descriptor.size)throw Error('Повреждённое вложение');
      const id=qdMediaNewId();mapping.set(descriptor.id,id);
      files.push({id,blob:new Blob([uint8],{type:descriptor.mime}),createdAt:Date.now()});
    }
    function remap(q){for(const kind of ['prompt','answer']){
      const k=qdMediaKey(kind),ref=qdMediaSafe(q?.[k]);
      if(ref){if(!mapping.has(ref.id))throw Error('Отсутствует иллюстрация '+ref.id);
        q[k]={...ref,id:mapping.get(ref.id)};}
    }}
    const data=manifest.data;
    if(type==='diagnostic'){
      if(!qdValidTemplateSections(data.sections)||data.run?.document&&!qdValidTemplateSections(data.run.document.sections))throw Error('Неверная диагностика');
      if(!confirm('Открыть диагностику вместе с изображениями? Текущий документ будет заменён.'))return;
      for(const s of data.sections)for(const q of s.questions||[])remap(q);
      if(data.run?.document)for(const s of data.run.document.sections||[])for(const q of s.questions||[])remap(q);
    }else if(type==='templates'){
      if(data.format!=='quantum-templates'||!Array.isArray(data.templates))throw Error('Неверная библиотека');
      for(const t of data.templates)for(const s of t.sections||[])for(const q of s.questions||[])remap(q);
    }else if(type==='bank'){
      if(data.format!=='quantum-question-bank'||!Array.isArray(data.questions))throw Error('Неверный банк');
      for(const entry of data.questions)remap(entry.question);
    }
    for(const asset of files)await qdMediaPut(asset);
    if(type==='diagnostic'){
      qoWriter.diagnostic=qdNormalize(data);qdVerified.add(qoWriter);
      qdBuilderLinkedTemplateId='';qdBuilderSavedSignature='';
      qdMode='run';qoWriter.diagnosticMode='run';qdRevealed.clear();qdStudentFilter='';
      qdStore();qdRefresh();status('Диагностика с изображениями открыта');
    }else{
      const result=type==='templates'?qdLibraryImport(JSON.stringify(data)):qdBankImport(JSON.stringify(data));
      if(!result.ok)throw Error(result.message||'Не удалось импортировать');
      qdRefresh();status('Импортировано: '+result.count);
    }
  }catch(e){status('Не удалось открыть архив: '+(e?.message||'ошибка'),true);}
}
const qdMediaOrigExport=qdExport;
qdExport=function(){
  const d=qdWorkingDoc();
  if(!qdMediaReferenced(d).length)return qdMediaOrigExport();
  qdMediaExportArchive('diagnostic',d,(typeof safeFile==='function'?safeFile(d.title):'diagnostic')+'.qdiagx')
    .catch(e=>status('Не удалось сохранить изображения: '+e.message,true));
};
const qdMediaOrigLibraryExport=qdLibraryExport;
qdLibraryExport=function(){
  const data={format:'quantum-templates',version:1,templates:qdLibraryRead()};
  if(!qdMediaReferenced(data).length)return qdMediaOrigLibraryExport();
  qdMediaExportArchive('templates',data,'QuantumOffice-templates.qtplx')
    .catch(e=>status('Не удалось сохранить шаблоны: '+e.message,true));
};
const qdMediaOrigBankExport=qdBankExport;
qdBankExport=function(){
  const data={format:'quantum-question-bank',version:1,questions:qdBankRead()};
  if(!qdMediaReferenced(data).length)return qdMediaOrigBankExport();
  qdMediaExportArchive('bank',data,'QuantumOffice-question-bank.qbankx')
    .catch(e=>status('Не удалось сохранить банк: '+e.message,true));
};
