/* Desktop only. Initialize before editor scripts; never replace a failed native read with an empty browser draft. */
(() => {
 'use strict';
 const keys=["quantum-office.workspace.v3","quantum-office.workspace.v3.previous","quantum-office-writer-v1","quantum-office-slides-v1","quantum-studio-task093","quantum-office.work-builder.v1","quantum-office.diagnostic-question-bank.v1","quantum-office.diagnostic-templates.v1","quantum-office.diagnostic-template-versions.v1","quantum-office.diagnostic-workbench.v1","quantum-office.student-hub.source.v1","quantum-office.student-hub.results.v1","quantum-office-theme-v1","quantum-office-accent-v1","qo-studio-colors-v1","quantum-office-last-font-v2","quantum-office-recent-colors-v2"],allowed=new Set(keys),limit=64*1024*1024;
 const invoke=(command,args={})=>globalThis.__TAURI__.core.invoke(command,args);
 const errText=e=>typeof e==='string'?e:e?.message||String(e);
 const records=new Map(),dirty=new Map(),migration=new Set(),rejected=new Map();let running=null,timer=null,error='',closing=false,ready=false,bootTask;
 const notify=()=>{
  const problem=error||[...rejected.values()][0]||'';
  const state=problem?'Ошибка записи черновиков: '+problem:dirty.size||running?'Черновики: запись не подтверждена…':'Черновики: запись подтверждена';
  const banner=document.getElementById('qo-native-draft-status');
  if(banner){banner.textContent=state;banner.hidden=!problem&&!dirty.size&&!running;}
  globalThis.qoDraftStatus=()=>state;
  globalThis.qoDraftStatusChanged?.();
 };
 const check=key=>{key=String(key);if(!allowed.has(key))throw Error('Недопустимый ключ черновика: '+key);return key;};
 function change(key,value,fromLegacy=false){
  key=check(key);if(value!==null){value=String(value);if(new TextEncoder().encode(value).length>limit){const message='Черновик больше 64 МБ; сохраните отдельный файл';rejected.set(key,message);notify();throw Error(message);}}
  rejected.delete(key);if(fromLegacy)migration.add(key);
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
 async function onClose(){
  if(closing)return;closing=true;
  const app=document.getElementById('app');
  try{
   if(app)app.inert=true;
   // Do not destroy the WebView while startup is loading or migrating drafts.
   // A failed boot never starts editable documents; its legacy sources remain intact.
   await bootTask;
   if(ready){globalThis.qoFlushForClose?.();await flush();if(qoDraftStorage.error)throw Error(qoDraftStorage.error);}
   await invoke('draft_close');
  }catch(e){error=errText(e);notify();if(app)app.inert=false;closing=false;}
 }
 async function boot(){
  const app=document.getElementById('app');
  const banner=document.createElement('div');banner.id='qo-native-draft-status';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');document.body.prepend(banner);
  banner.textContent='Открытие нативных черновиков…';
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
