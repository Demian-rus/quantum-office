/* Desktop only. Initialize before editor scripts; never replace a failed native read with an empty browser draft. */
(() => {
 'use strict';
 const keys=["quantum-office.workspace.v3","quantum-office.workspace.v3.previous","quantum-office-writer-v1","quantum-office-slides-v1","quantum-studio-task093","quantum-office.work-builder.v1","quantum-office.diagnostic-question-bank.v1","quantum-office.diagnostic-templates.v1","quantum-office.diagnostic-template-versions.v1","quantum-office.diagnostic-workbench.v1","quantum-office.student-hub.source.v1","quantum-office.student-hub.results.v1","quantum-office-theme-v1","quantum-office-accent-v1","qo-studio-colors-v1","quantum-office-last-font-v2","quantum-office-recent-colors-v2"],allowed=new Set(keys),limit=64*1024*1024;
 const invoke=(command,args={})=>globalThis.__TAURI__.core.invoke(command,args);
 const errText=e=>typeof e==='string'?e:e?.message||String(e);
 const records=new Map(),dirty=new Map(),migration=new Set(),rejected=new Map(),rejectedValues=new Map();let running=null,timer=null,error='',closing=false,ready=false,bootTask;
 let lastState='',lastSummary='',transientToast=null;
 const notify=()=>{
  const problem=error||[...rejected.values()][0]||'';
  const state=problem?'Ошибка записи черновиков: '+problem+'. Сохраните документ отдельным файлом или аварийную копию перед закрытием.':dirty.size||running?'Черновики: запись не подтверждена…':'Черновики: запись подтверждена';
  const summary=problem?'Ошибка записи':!ready?'Открытие черновиков…':dirty.size||running?'Запись…':'Черновик сохранён';
  const banner=document.getElementById('qo-native-draft-status'),notice=document.getElementById('qo-native-draft-notice');
  const message=problem?state:!ready?'Открытие нативных черновиков…':'';
  if(banner&&banner.textContent!==message){banner.textContent=message;banner.setAttribute('role',problem?'alert':'status');banner.setAttribute('aria-live',problem?'assertive':'polite');}
  if(notice){notice.hidden=!message;notice.className='toast active qo-draft-notice'+(problem?' bad':'');}
  const recovery=document.getElementById('qo-native-draft-recovery');if(recovery)recovery.hidden=!(ready&&problem&&(dirty.size||rejectedValues.size));
  const retry=document.getElementById('qo-native-draft-retry');if(retry)retry.hidden=!(ready&&problem&&dirty.size);
  globalThis.qoDraftStatus=()=>state;
  globalThis.qoDraftStatusSummary=()=>summary;
  if(lastState!==state||lastSummary!==summary){lastState=state;lastSummary=summary;globalThis.qoDraftStatusChanged?.();}
 };
 const check=key=>{key=String(key);if(!allowed.has(key))throw Error('Недопустимый ключ черновика: '+key);return key;};
 function change(key,value,fromLegacy=false){
  key=check(key);if(value!==null){value=String(value);if(new TextEncoder().encode(value).length>limit){const message='Черновик больше 64 МБ; сохраните отдельный файл';rejected.set(key,message);rejectedValues.set(key,value);notify();throw Error(message);}}
  rejected.delete(key);rejectedValues.delete(key);if(fromLegacy)migration.add(key);
  const existing=records.get(key);
  if(existing?.value===value){notify();return;}
  records.set(key,{revision:existing?.revision??0,value});dirty.set(key,value);
  notify();clearTimeout(timer);timer=setTimeout(()=>{void flush().catch(()=>{});},180);
 }
 async function flush(){
  clearTimeout(timer);timer=null;
  if(running)return running;
  running=(async()=>{
   try{
    while(dirty.size){
     const batch=[...dirty].map(([key,value])=>({key,value,revision:records.get(key).revision,migration:migration.has(key)}));
     let reply;
     try{reply=await invoke('draft_write',{changes:batch});}
     catch(e){
      // An acknowledgement can be lost after commit. Only accept an exact
      // durable value at the expected next revision, never overwrite a conflict.
      const loaded=await invoke('draft_load').catch(()=>null);
      if(!loaded||!batch.every(item=>loaded[item.key]?.revision===item.revision+1&&loaded[item.key].value===item.value))throw e;
      reply=loaded;
     }
     // Validate the whole batch before advancing any local revisions.
     for(const item of batch){
      const ack=reply?.[item.key];if(!Number.isInteger(ack?.revision)||ack.revision!==item.revision+1)throw Error('Некорректное подтверждение записи');
     }
     for(const item of batch){
      records.get(item.key).revision=reply[item.key].revision;migration.delete(item.key);
      if(dirty.get(item.key)===item.value)dirty.delete(item.key);
     }
     error='';
    }
   }catch(e){error=errText(e);throw e;}
  })();
  notify();
  try{await running;}finally{running=null;notify();}
 }
 globalThis.qoDraftStorage={
  getItem(key){return records.get(check(key))?.value??null;},
  setItem(key,value){change(key,String(value));},
  removeItem(key){change(key,null);},
  flush,
  get pending(){return dirty.size>0||!!running;},
  get error(){return error||[...rejected.values()][0]||'';},
 };
 // A declined editor exit is not a failed durable write. Do not modify
 // storage state, remove the editor, or disable the window before asking.
 function editorAllowsClose(){
  try{return globalThis.qoCanCloseEditors?.()!==false;}
  catch(e){console.error('Editor close guard failed:',e);return false;}
 }
 async function onClose(){
  if(closing)return;closing=true;
  const app=document.getElementById('app');
  if(ready&&!editorAllowsClose()){closing=false;return;}
  try{
   if(app)app.inert=true;
   // Do not destroy the WebView while startup is loading or migrating drafts.
   // A failed boot never starts editable documents; its legacy sources remain intact.
   if(!ready)await bootTask;
   if(ready){globalThis.qoFlushForClose?.();await flush();if(qoDraftStorage.error)throw Error(qoDraftStorage.error);}
   await invoke('draft_close');
  }catch(e){error=errText(e);notify();if(app)app.inert=false;closing=false;}
 }
 // No revision is rebased automatically. A user can rescue exact unconfirmed
 // values via the existing user-selected native save dialog, then reopen the
 // latest durable version. Cancellation or failed export keeps the window open.
 function recoveryValues(){
  return [...new Map([...dirty,...rejectedValues])].map(([key,value])=>({key,revision:records.get(key)?.revision??0,value}));
 }
 async function recoverAndClose(){
  if(closing||!ready)return;closing=true;
  const app=document.getElementById('app'),button=document.getElementById('qo-native-draft-recovery');
  if(!editorAllowsClose()){closing=false;return;}
  if(app)app.inert=true;if(button)button.disabled=true;
  try{
   globalThis.qoFlushForClose?.();
   clearTimeout(timer);timer=null;
   if(running)await running.catch(()=>{});
   const entries=recoveryValues();
   if(!entries.length){await invoke('draft_close');return;}
   const snapshot=JSON.stringify({format:'quantum-office-draft-recovery',version:1,createdAt:new Date().toISOString(),entries});
   const bytes=new TextEncoder().encode(snapshot);
   if(bytes.length>300000000)throw Error('Аварийная копия слишком велика; сохраните отдельные документы через редакторы');
   let binary='';for(let offset=0;offset<bytes.length;offset+=16384)binary+=String.fromCharCode(...bytes.subarray(offset,offset+16384));
   const saved=await invoke('save_export',{name:'Quantum-Office-draft-recovery.json',data:btoa(binary)});
   if(saved!==true)return;
   if(JSON.stringify(recoveryValues())!==JSON.stringify(entries))throw Error('Черновики изменились во время экспорта. Сохраните новую копию');
   await invoke('draft_close');
  }catch(e){error=errText(e);}
  finally{closing=false;if(app)app.inert=false;if(button)button.disabled=false;notify();}
 }
 async function boot(){
  const app=document.getElementById('app');
  // Both transient and durable notifications share one fixed stack, outside #app.
  // Background pending/ACK changes update only the existing compact indicator.
  const stack=document.createElement('aside');stack.id='qo-native-notifications';stack.setAttribute('aria-label','Уведомления');
  const notice=document.createElement('section');notice.id='qo-native-draft-notice';notice.className='toast active qo-draft-notice';
  const banner=document.createElement('div');banner.id='qo-native-draft-status';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');
  banner.textContent='Открытие нативных черновиков…';
  const retry=document.createElement('button');retry.id='qo-native-draft-retry';retry.type='button';retry.textContent='Повторить запись';retry.hidden=true;retry.onclick=()=>void flush().catch(()=>{});
  const recovery=document.createElement('button');recovery.id='qo-native-draft-recovery';recovery.type='button';recovery.textContent='Сохранить аварийную копию и закрыть';recovery.hidden=true;recovery.onclick=()=>void recoverAndClose();
  notice.append(banner,retry,recovery);stack.append(notice);document.body.prepend(stack);
  globalThis.qoDraftAttachToast=node=>{if(!node)return;if(transientToast&&transientToast!==node)transientToast.remove();transientToast=node;stack.append(node);};
  await globalThis.__TAURI__.event.listen('qo-draft-close',()=>void onClose());
  const loaded=await invoke('draft_load');
  for(const key of keys){
   const row=loaded[key];if(row){if(!Number.isInteger(row.revision)||row.revision<1||(row.value!==null&&typeof row.value!=='string'))throw Error('Неверный ответ хранилища');records.set(key,{revision:row.revision,value:row.value});}
  }
  // Existing native values (including tombstones) win. Old browser values stay untouched.
  for(const key of keys){if(!records.has(key)){const old=globalThis.localStorage.getItem(key);if(old!==null)change(key,old,true);}}
  await flush();
  ready=true;notify();
  const script=document.createElement('script');script.src='./app.js';script.onerror=()=>{error='Не удалось загрузить интерфейс';notify();};document.body.append(script);
 }
 bootTask=boot().catch(e=>{error=errText(e);notify();const app=document.getElementById('app');if(app)app.textContent='Не удалось открыть нативные черновики. Исходные файлы не изменены. Закройте приложение и сохраните копию каталога данных. '+error;});
})();
