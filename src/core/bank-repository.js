import {createBankBackupV3,verifyBankBackupV3,bankStableJSON,bankExamYears,bankValidateExamYears,bankChangeExamYears} from './bank-backup.js';
import {BANK_ASSET_STORE,BankAssetError,bankAssetPrepareMany,bankAssetUnpack,bankAssetVerifyMap,bankAssetCollect,bankAssetWriteSet,bankAssetWithoutImage,bankAssetValidate} from './bank-assets.js';
/* TASK166.1 — one durable bank repository for browser HTML.
   Future native SQLite implements the same asynchronous contract; no mock
   SQLite adapter is shipped with this browser implementation. */
const BANK_DB_NAME='quantum-office-bank';
const BANK_DB_VERSION=2;
const BANK_LEGACY_KEY='quantum-office.work-bank.v1';
const BANK_LEGACY_COUNTER_KEY='quantum-office.work-bank.number-sequence.v1';
const BANK_NUMBER_LIMIT=99999;
const BANK_PAGE_LIMIT=80;
const BANK_FILTER_FIELDS=['subject','grade','exam','year','part','slot','difficulty','type','topic','subtopic','origin'];
const BANK_INDEX_FIELDS=['bankNumber',...BANK_FILTER_FIELDS,'updatedAt'];
const BANK_RECORD_FIELDS=['id','bankNumber','subject','grade','exam','topic','subtopic','origin','year','part','slot','difficulty','task','examYears'];

class BankStorageError extends Error{
 constructor(message,code='BANK_STORAGE'){super(message);this.name='BankStorageError';this.code=code;}
}
function bankRequest(req){return new Promise((resolve,reject)=>{
 req.onsuccess=()=>resolve(req.result);
 req.onerror=()=>reject(req.error||new BankStorageError('Не удалось прочитать IndexedDB'));
});}
function bankTransaction(db,names,mode,work){
 return new Promise((resolve,reject)=>{
  let tx;try{tx=db.transaction(names,mode);}catch(error){reject(error);return;}
  let response,manualError=null;
  tx.oncomplete=()=>resolve(response);
  tx.onabort=()=>reject(manualError||tx.error||new BankStorageError('Транзакция банка отменена'));
  tx.onerror=()=>{}; // onabort reports the transaction's final error
  const set=value=>{response=value;};
  const fail=error=>{if(!manualError)manualError=error;try{tx.abort();}catch{}};
  try{work(tx,set,fail);}catch(error){fail(error);}
 });
}
function bankHash(str){
 // FNV-1a is an integrity guard for migration, not a cryptographic signature.
 let n=2166136261;for(let i=0;i<str.length;i++){n^=str.charCodeAt(i);n=Math.imul(n,16777619);}
 return (n>>>0).toString(16).padStart(8,'0');
}
function bankIdentity(){
 if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')return 'b'+crypto.randomUUID();
 return 'b'+Date.now().toString(36)+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
}
function bankCanonicalJSON(value){
 // Deterministic deep comparison, including answers, solutions, rubrics,
 // diagrams, graphs and images. Never use a short hash to prove equality.
 if(Array.isArray(value))return '['+value.map(bankCanonicalJSON).join(',')+']';
 if(value&&typeof value==='object'){
  const fields=Object.keys(value).filter(k=>value[k]!==undefined).sort();
  return '{'+fields.map(k=>JSON.stringify(k)+':'+bankCanonicalJSON(value[k])).join(',')+'}';
 }
 return JSON.stringify(value);
}
function bankSignature(e){
 // IDs and permanent bank numbers are allocation metadata, not task content.
 // All other portable fields (including the complete validated QWORK task)
 // must match before an imported entry may be safely skipped.
 const content=bankPortable(e);
 delete content.id;delete content.bankNumber;delete content.examYears;
 return bankCanonicalJSON(content);
}
function bankStoredSignature(e){
 const content=bankPortable(e);delete content.id;delete content.bankNumber;delete content.examYears;
 if(e.imageAsset)content.imageAsset=e.imageAsset;
 return bankCanonicalJSON(content);
}
async function bankHydrateSet(data){
 await bankAssetVerifyMap(data.assets);const urls=new Map();
 return data.records.map(r=>bankAssetUnpack(r,data.assets,urls));
}
function bankClone(e){return structuredClone(e);}
function bankPortable(e){
 const x={};for(const k of BANK_RECORD_FIELDS)if(e[k]!==undefined)x[k]=bankClone(e[k]);return x;
}
function bankYearMatch(e,filter){
 if(filter===undefined||filter===null||filter===''||filter==='all')return true;
 const years=bankValidateExamYears(e);
 if(filter==='none')return !years.length;
 const year=Number(filter);
 if(!Number.isInteger(year)||year<1900||year>2099)throw new BankStorageError('Недопустимый фильтр года','INVALID_EXAM_YEARS');
 return years.includes(year);
}
function bankSearchMatch(e,filters={}){
 if(!bankYearMatch(e,filters.examYear))return false;
 for(const k of BANK_FILTER_FIELDS){
  const v=filters[k];if(v===undefined||v===null||v===''||v==='all')continue;
  if(String(k==='type'?e.task?.type:e[k]||'')!==String(v))return false;
 }
 const term=String(filters.search||'').trim().toLocaleLowerCase('ru-RU');
 if(term&&!([String(e.bankNumber),String(e.bankNumber).padStart(5,'0'),
  e.task?.title,e.task?.tags?.join(' '),e.task?.prompt,e.task?.answer,e.task?.comment,e.task?.criteria,
  e.topic,e.subtopic,e.grade].some(x=>String(x||'').toLocaleLowerCase('ru-RU').includes(term))))return false;
 return true;
}
function bankSafeGlobal(name){
 // Accessing Window.localStorage or indexedDB can itself throw SecurityError
 // for an opaque document origin (e.g. Playwright set_content).
 try{return globalThis[name]??null;}catch{return null;}
}
class BankRepository{
 constructor({indexedDB,legacyStorage,normalize=e=>e,dbName=BANK_DB_NAME}={}){
  this.factory=indexedDB===undefined?bankSafeGlobal('indexedDB'):indexedDB;
  this.legacyStorage=legacyStorage===undefined?bankSafeGlobal('localStorage'):legacyStorage;
  this.normalize=normalize;
  this.dbName=dbName;this.db=null;this._opening=null;this.migration=null;this._restorePlan=null;this.assetMigrationError=null;
 }
 async open({onProgress}={}){
  if(this._opening)return this._opening;
  if(this.db)return this;
  this._opening=this._open({onProgress});
  try{return await this._opening;}finally{this._opening=null;}
 }
 async _open({onProgress}={}){
  if(!this.factory)throw new BankStorageError('IndexedDB недоступна. Банк не будет записан; сохраните QWBANK.', 'IDB_UNAVAILABLE');
  const db=await new Promise((resolve,reject)=>{
   let request;
   try{request=this.factory.open(this.dbName,BANK_DB_VERSION);}
   catch(error){
    reject(new BankStorageError('IndexedDB запрещена или недоступна в этом окне. Остальные редакторы работают; для банка откройте файл в обычном профиле браузера.', 'IDB_UNAVAILABLE'));
    return;
   }
   request.onupgradeneeded=()=>{
    const db=request.result,tx=request.transaction;
    const tasks=db.objectStoreNames.contains('tasks')?tx.objectStore('tasks'):
     db.createObjectStore('tasks',{keyPath:'id'});
    for(const name of BANK_INDEX_FIELDS){
     if(!tasks.indexNames.contains(name))
      tasks.createIndex(name,name,{unique:name==='bankNumber'});
    }
    if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
    if(!db.objectStoreNames.contains(BANK_ASSET_STORE))db.createObjectStore(BANK_ASSET_STORE,{keyPath:'key'});
   };
   request.onerror=()=>reject(request.error||new BankStorageError('Не удалось открыть IndexedDB'));
   let blocked=false;
   request.onblocked=()=>{blocked=true;reject(new BankStorageError('Другая вкладка блокирует обновление базы. Закройте другие окна.', 'IDB_BLOCKED'));};
   request.onsuccess=()=>{if(blocked)request.result.close();else resolve(request.result);};
  });
  db.onversionchange=()=>{db.close();if(this.db===db)this.db=null;};
  this.db=db;
  try{await this._migrateLegacy();await this.migrateAssets({onProgress});return this;}
  catch(e){this.db=null;db.close();throw e;}
 }
 _db(){if(!this.db)throw new BankStorageError('Банк не открыт. Повторите подключение к хранилищу.', 'IDB_CLOSED');return this.db;}
 _clean(input){
  const normalized=this.normalize(bankClone(input));
  if(!normalized||typeof normalized!=='object'||Array.isArray(normalized)||!normalized.task||
   typeof normalized.task.prompt!=='string'||typeof normalized.id!=='string'||!normalized.id.trim()||
   normalized.id.length>80)throw new BankStorageError('Некорректная запись банка', 'INVALID_RECORD');
  const record=bankPortable(normalized);
  if(input.examYears!==undefined)record.examYears=bankValidateExamYears({...record,examYears:input.examYears});
  else if(record.examYears!==undefined)record.examYears=bankValidateExamYears(record);
  record.id=normalized.id;
  record.bankNumber=Number.isInteger(normalized.bankNumber)&&normalized.bankNumber>0&&normalized.bankNumber<=BANK_NUMBER_LIMIT?normalized.bankNumber:0;
  record.type=record.task.type;
  return record;
 }
 async _meta(key){return bankRequest(this._db().transaction('meta').objectStore('meta').get(key));}
 async _migrateLegacy(){
  // Always inspect the durable marker BEFORE touching legacy localStorage.
  // Once migration is confirmed, revoking localStorage must not hide the bank.
  const marker=await this._meta('legacyMigration');
  if(marker){
   if(marker.state==='complete'){
    const backup=await this._meta('legacyBackup');
    if(!backup||backup.hash!==marker.hash||typeof backup.raw!=='string'||
     bankHash(backup.raw)!==marker.hash)
     throw new BankStorageError('Контрольные данные переноса повреждены. Открытие остановлено.','LEGACY_VERIFY');
   }else if(marker.state!=='none')
    throw new BankStorageError('Неизвестный статус переноса. Открытие остановлено.','LEGACY_VERIFY');
   this.migration=marker;return;
  }
  let raw;
  try{
   if(!this.legacyStorage||typeof this.legacyStorage.getItem!=='function')
    throw new Error('localStorage недоступен');
   raw=this.legacyStorage.getItem(BANK_LEGACY_KEY);
  }catch(e){throw new BankStorageError('Нельзя проверить старый банк. Данные IndexedDB не изменены.','LEGACY_READ');}
  if(raw===null||raw===undefined){
   // A genuinely new bank must also receive an atomic initialization marker.
   // Without it, a valid bank created later would appear "unconfirmed" when
   // localStorage becomes unavailable, or an orphaned bank could be hidden.
   this.migration=await bankTransaction(this._db(),['tasks','meta'],'readwrite',(tx,set,fail)=>{
    const meta=tx.objectStore('meta'),tasks=tx.objectStore('tasks');
    const current=meta.get('legacyMigration');
    current.onerror=()=>fail(current.error);
    current.onsuccess=()=>{
     if(current.result){set(current.result);return;}
     const count=tasks.count();
     count.onerror=()=>fail(count.error);
     count.onsuccess=()=>{
      if(count.result){fail(new BankStorageError('В базе есть записи без подтверждённой миграции.','LEGACY_CONFLICT'));return;}
      const initialized={key:'legacyMigration',state:'none',createdAt:new Date().toISOString()};
      meta.put(initialized);set(initialized);
     };
    };
   });
   return;
  }
  let records;
  try{
   const input=JSON.parse(raw);
   if(!Array.isArray(input)||input.length>500)throw Error('Нарушена структура QWBANK v1');
   records=input.map(x=>this._clean(x));
  }catch(e){throw new BankStorageError('Старый банк повреждён: '+e.message+'. Исходные данные не изменены.', 'LEGACY_CORRUPT');}
  const ids=new Set(),numbers=new Set();let high=0;
  for(const r of records){
   if(ids.has(r.id))throw new BankStorageError('В старом банке повторяется внутренний ID. Перенос остановлен.', 'LEGACY_DUPLICATE_ID');
   ids.add(r.id);if(r.bankNumber&&!numbers.has(r.bankNumber)){numbers.add(r.bankNumber);high=Math.max(high,r.bankNumber);}else r.bankNumber=0;
  }
  for(const r of records)if(!r.bankNumber){
   do{high++;}while(numbers.has(high)&&high<=BANK_NUMBER_LIMIT);
   if(high>BANK_NUMBER_LIMIT)throw new BankStorageError('Исчерпаны номера банка','BANK_NUMBERS_EXHAUSTED');
   r.bankNumber=high;numbers.add(high);
  }
  let oldSeq=0;
  try{oldSeq=Number(this.legacyStorage?.getItem(BANK_LEGACY_COUNTER_KEY))||0;}catch{}
  const digest=bankHash(raw),when=new Date().toISOString();
  await bankTransaction(this._db(),['tasks','meta'],'readwrite',(tx,set,fail)=>{
   const store=tx.objectStore('tasks'),meta=tx.objectStore('meta');
   // The marker and count are rechecked INSIDE the transaction. Two windows
   // launching migration together therefore cannot half-import the same bank.
   const current=meta.get('legacyMigration');
   current.onerror=()=>fail(current.error);
   current.onsuccess=()=>{
    if(current.result){
     if(current.result.hash!==digest||current.result.count!==records.length)
      fail(new BankStorageError('Два окна обнаружили разные версии старого банка. Перенос остановлен.','LEGACY_CONFLICT'));
     else set(current.result);
     return;
    }
    const count=store.count();
    count.onerror=()=>fail(count.error);
    count.onsuccess=()=>{
     if(count.result){fail(new BankStorageError('База содержит записи без подтверждённой миграции.','LEGACY_CONFLICT'));return;}
     try{
      for(const r of records)store.add({...r,createdAt:when,updatedAt:when,revision:1});
      meta.put({key:'legacyBackup',raw,hash:digest,createdAt:when});
      meta.put({key:'sequence',value:Math.max(high,Math.min(BANK_NUMBER_LIMIT,oldSeq))});
      const marker={key:'legacyMigration',state:'complete',count:records.length,hash:digest,createdAt:when};
      meta.put(marker);set(marker);
     }catch(error){fail(error);}
    };
   };
  });
  const count=await bankRequest(this._db().transaction('tasks').objectStore('tasks').count());
  const saved=await this._meta('legacyMigration');
  if(count!==records.length||saved?.hash!==digest||saved?.count!==records.length)
   throw new BankStorageError('Перенос не прошёл проверку целостности. Старый банк не удалён.', 'LEGACY_VERIFY');
  // The user's old localStorage is deliberately left untouched as a safety copy.
  this.migration=saved;
 }
 getLegacyRecovery(){
  try{return this.legacyStorage?.getItem(BANK_LEGACY_KEY)??null;}
  catch{return null;}
 }
 /** Upgrade in bounded transactions, never remove the old row before its bytes are committed. */
 async migrateAssets({signal,onProgress}={}){
  this.assetMigrationError=null;
  try{
   if((await this._meta('assetMigration'))?.state==='complete')return true;
   let last=null,processed=0;
   for(;;){
    if(signal?.aborted)throw new BankAssetError('Перенос изображений прерван','ASSET_CANCELLED');
    const rows=await bankTransaction(this._db(),'tasks','readonly',(tx,set,fail)=>{
     const req=tx.objectStore('tasks').getAll(last===null?null:IDBKeyRange.lowerBound(last,true),16);
     req.onerror=()=>fail(req.error);req.onsuccess=()=>set(req.result);
    });
    if(!rows.length)break;
    last=rows.at(-1).id;const candidates=rows.filter(r=>r.task?.image&&!r.imageAsset);
    if(candidates.length){
     const packed=await bankAssetPrepareMany(candidates);
     if(signal?.aborted)throw new BankAssetError('Перенос изображений прерван','ASSET_CANCELLED');
     await bankTransaction(this._db(),['tasks',BANK_ASSET_STORE],'readwrite',(tx,set,fail)=>{
      const store=tx.objectStore('tasks');bankAssetWriteSet(tx,packed.assets,fail);
      const abort=()=>fail(new BankAssetError('Перенос изображений прерван','ASSET_CANCELLED'));
      if(signal){signal.addEventListener('abort',abort,{once:true});for(const event of ['complete','abort'])tx.addEventListener(event,()=>signal.removeEventListener('abort',abort),{once:true});if(signal.aborted){abort();return;}}
      candidates.forEach((original,i)=>{
       const req=store.get(original.id);req.onerror=()=>fail(req.error);
       req.onsuccess=()=>{try{
        const current=req.result;
        if(!current||current.imageAsset||!current.task?.image)return;
        if(bankStableJSON(current)!==bankStableJSON(original))throw new BankAssetError('Задание изменилось во время переноса; повторите открытие банка','ASSET_CONFLICT');
        store.put(packed.records[i]);
       }catch(e){fail(e);}};
      });
     });
    }
    processed+=rows.length;onProgress?.(processed);await new Promise(resolve=>setTimeout(resolve,0));
   }
   if(signal?.aborted)throw new BankAssetError('Перенос изображений прерван','ASSET_CANCELLED');
   await bankTransaction(this._db(),['tasks','meta',BANK_ASSET_STORE],'readwrite',(tx,set,fail)=>{
    const req=tx.objectStore('tasks').openCursor();
    req.onerror=()=>fail(req.error);
    const known=new Map();
    req.onsuccess=()=>{try{
     const c=req.result;
     if(c){
      const r=c.value;
      if(r.task?.image)throw new BankAssetError('Остались неперенесённые изображения','ASSET_MIGRATION');
      if(r.imageAsset){
       const ref=r.imageAsset,prior=known.get(ref.key);
       if(prior){if(prior.mime!==ref.mime||prior.size!==ref.size||prior.sha256!==ref.sha256)throw new BankAssetError('Несогласованные ссылки','ASSET_CORRUPT');c.continue();}
       else bankAssetCollect(tx,[r],assets=>{bankAssetValidate(assets.get(ref.key),ref);known.set(ref.key,{mime:ref.mime,size:ref.size,sha256:ref.sha256});c.continue();},fail);
      }else c.continue();return;
     }
     tx.objectStore('meta').put({key:'assetMigration',state:'complete'});
    }catch(e){fail(e);}};
   });
   return true;
  }catch(error){this.assetMigrationError=error.message||'Перенос изображений не завершён';return false;}
 }
 async getTask(id){
  const data=await bankTransaction(this._db(),['tasks',BANK_ASSET_STORE],'readonly',(tx,set,fail)=>{
   const req=tx.objectStore('tasks').get(String(id));req.onerror=()=>fail(req.error);
   req.onsuccess=()=>{const records=req.result?[req.result]:[];bankAssetCollect(tx,records,assets=>set({records,assets}),fail);};
  });return (await bankHydrateSet(data))[0];
 }
 async snapshotMetadata(){
  return bankTransaction(this._db(),'tasks','readonly',(tx,set,fail)=>{
   const list=[],req=tx.objectStore('tasks').openCursor();req.onerror=()=>fail(req.error);
   req.onsuccess=()=>{const c=req.result;if(!c){set(list);return;}list.push(bankPortable(bankAssetWithoutImage(c.value)));c.continue();};
  });
 }
 async listTasks(filters={},pagination={}){
  const limit=Math.min(BANK_PAGE_LIMIT,Math.max(1,Math.floor(Number(pagination.limit)||30)));
  const offset=Math.max(0,Math.floor(Number(pagination.offset)||0));
  const key=BANK_FILTER_FIELDS.find(k=>k!=='type'&&filters[k]&&filters[k]!=='all')||
   (filters.type&&filters.type!=='all'?'type':null);
  const data=await bankTransaction(this._db(),['tasks',BANK_ASSET_STORE],'readonly',(tx,set,fail)=>{
   const store=tx.objectStore('tasks'),source=key?store.index(key):store.index('bankNumber');
   const done=(items,total)=>{
    const result={total,offset,limit,hasMore:offset+items.length<total};
    if(pagination.includeImages===false){set({...result,items:items.map(bankAssetWithoutImage)});return;}
    bankAssetCollect(tx,items,assets=>set({...result,records:items,assets}),fail);
   };
   const read=(request,success)=>{
    request.onerror=()=>fail(request.error||Error('Ошибка поиска по банку'));
    request.onsuccess=()=>success(request.result);
   };
   const hasSearch=!!String(filters.search||'').trim();
   if(!key&&!hasSearch&&(!filters.examYear||filters.examYear==='all')){
    read(source.count(),total=>{
     if(offset>=total){done([],total);return;}
     if(!offset){read(source.getAll(null,limit),items=>done(items,total));return;}
     const items=[];let skip=offset;
     read(source.openCursor(),cursor=>{
      if(!cursor){done(items,total);return;}
      if(skip){cursor.advance(skip);skip=0;return;}
      items.push(cursor.value);
      if(items.length===limit)done(items,total);else cursor.continue();
     });
    });
    return;
   }
   const items=[],matches=[];let total=0;
   read(source.openCursor(key?IDBKeyRange.only(filters[key]):null),cursor=>{
    if(!cursor){
     if(!key){done(items,total);return;}
     // Equal category keys are traversed by ID. Order by the permanent number
     // before paging, retaining only IDs and numbers outside the returned page.
     matches.sort((a,b)=>a.number-b.number);
     const page=matches.slice(offset,offset+limit),records=new Array(page.length);
     let remaining=page.length;
     if(!remaining){done([],total);return;}
     page.forEach(({id},index)=>read(store.get(id),record=>{
      records[index]=record;if(!--remaining)done(records,total);
     }));
     return;
    }
    const entry=cursor.value;
    if(bankSearchMatch(entry,filters)){
     if(key)matches.push({id:entry.id,number:entry.bankNumber});
     else if(total>=offset&&items.length<limit)items.push(entry);
     total++;
    }
    cursor.continue();
   });
  });
  if(data.items)return data;
  const {assets,records,...result}=data;
  return {...result,items:await bankHydrateSet({assets,records})};
 }
 async listFacets(fields=['topic','subtopic','year']){
  const keys=fields.filter(k=>(BANK_INDEX_FIELDS.includes(k)&&k!=='bankNumber')||k==='examYear');
  return bankTransaction(this._db(),'tasks','readonly',(tx,set,fail)=>{
   const result={};let remaining=keys.length;
   if(!remaining){set(result);return;}
   const done=()=>{if(!--remaining)set(result);};
   for(const key of keys){
    result[key]=[];
    if(key==='examYear'){
     const years=new Set(),req=tx.objectStore('tasks').openCursor();
     req.onerror=()=>fail(req.error);
     req.onsuccess=()=>{try{const c=req.result;if(!c){result[key]=[...years].sort((a,b)=>a-b).map(String);done();return;}
      for(const y of bankValidateExamYears(c.value))years.add(y);c.continue();}catch(e){fail(e);}};
     continue;
    }
    const req=tx.objectStore('tasks').index(key).openKeyCursor(null,'nextunique');
    req.onerror=()=>fail(req.error||Error('Не удалось прочитать категории'));
    req.onsuccess=()=>{
     const cursor=req.result;
     if(!cursor){done();return;}
     if(cursor.key)result[key].push(String(cursor.key));
     cursor.continue();
    };
   }
  });
 }
 async createTask(input){
  const packed=await bankAssetPrepareMany([this._clean({...input,id:input.id||bankIdentity()})]),candidate=packed.records[0];
  const saved=await bankTransaction(this._db(),['tasks','meta',BANK_ASSET_STORE],'readwrite',(tx,set,fail)=>{
   bankAssetWriteSet(tx,packed.assets,fail);
   const tasks=tx.objectStore('tasks'),meta=tx.objectStore('meta');
   let sequence,high,ready=0;
   const finish=()=>{
    if(++ready!==2)return;
    const number=Math.max(sequence,high)+1;
    if(number>BANK_NUMBER_LIMIT){fail(new BankStorageError('Номера банка закончились','BANK_NUMBERS_EXHAUSTED'));return;}
    const now=new Date().toISOString(),record={...candidate,bankNumber:number,revision:1,createdAt:now,updatedAt:now};
    const exists=tasks.get(record.id);
    exists.onsuccess=()=>{
     if(exists.result){fail(new BankStorageError('Такой ID уже существует','DUPLICATE_ID'));return;}
     tasks.add(record);meta.put({key:'sequence',value:number});set(record);
    };
    exists.onerror=()=>fail(exists.error);
   };
   const seq=meta.get('sequence');seq.onsuccess=()=>{sequence=Number(seq.result?.value)||0;finish();};seq.onerror=()=>fail(seq.error);
   const last=tasks.index('bankNumber').openKeyCursor(null,'prev');
   last.onsuccess=()=>{high=Number(last.result?.key)||0;finish();};last.onerror=()=>fail(last.error);
  });
  return bankAssetUnpack(saved,packed.assets);
 }
 async updateTask(id,input,revision,{confirmExamReset=false}={}){
  const packed=await bankAssetPrepareMany([this._clean({...input,id})]),candidate=packed.records[0];
  const saved=await bankTransaction(this._db(),['tasks',BANK_ASSET_STORE],'readwrite',(tx,set,fail)=>{
   bankAssetWriteSet(tx,packed.assets,fail);
   const store=tx.objectStore('tasks'),req=store.get(String(id));
   req.onsuccess=()=>{
    const old=req.result;
    if(!old){fail(new BankStorageError('Запись удалена из банка','NOT_FOUND'));return;}
    if(!Number.isInteger(revision)||revision!==old.revision){
     fail(new BankStorageError('Задание изменено в другом окне. Скопируйте текст и откройте запись заново.','REVISION_CONFLICT'));return;
    }
    if(old.exam!==candidate.exam&&bankValidateExamYears(old).length&&(!confirmExamReset||bankValidateExamYears(candidate).length)){
     fail(new BankStorageError('Подтвердите сброс годов при смене экзамена','EXAM_RESET_REQUIRED'));return;
    }
    const next={...candidate,id:old.id,bankNumber:old.bankNumber,revision:old.revision+1,
     createdAt:old.createdAt,updatedAt:new Date().toISOString()};
    store.put(next);set(next);
   };
   req.onerror=()=>fail(req.error);
  });
  return bankAssetUnpack(saved,packed.assets);
 }
 // A single metadata-only snapshot for page/filter-wide selection.
 async listYearTargets(filters={}){
  return bankTransaction(this._db(),'tasks','readonly',(tx,set,fail)=>{
   const list=[],req=tx.objectStore('tasks').index('bankNumber').openCursor();
   req.onerror=()=>fail(req.error);req.onsuccess=()=>{try{const c=req.result;if(!c){set(list);return;}
    const r=c.value;if(bankSearchMatch(r,filters))list.push({id:r.id,revision:r.revision,exam:r.exam});c.continue();
   }catch(e){fail(e);}};
  });
 }
 async updateExamYears(targets,mode,values){
  const years=bankExamYears(values);
  if(!['add','remove','replace'].includes(mode)||!Array.isArray(targets)||targets.length>20000||new Set(targets.map(t=>t.id)).size!==targets.length)throw new BankStorageError('Некорректная массовая операция','INVALID_EXAM_YEARS');
  return bankTransaction(this._db(),'tasks','readwrite',(tx,set,fail)=>{
   const store=tx.objectStore('tasks');let remaining=targets.length,changed=0;const now=new Date().toISOString();
   if(!remaining){set({changed:0});return;}
   for(const target of targets){const req=store.get(target.id);req.onerror=()=>fail(req.error);
    req.onsuccess=()=>{try{const old=req.result;if(!old||!Number.isInteger(target.revision)||old.revision!==target.revision)throw new BankStorageError('Банк изменился. Повторите выбор.','REVISION_CONFLICT');
     const next=bankChangeExamYears(old,mode,years);
     if(bankCanonicalJSON(next)!==bankCanonicalJSON(bankValidateExamYears(old))){store.put({...old,examYears:next,revision:old.revision+1,updatedAt:now});changed++;}
     if(!--remaining)set({changed});
    }catch(e){fail(e);}};
   }
  });
 }
 async deleteTask(id,revision){
  return bankTransaction(this._db(),['tasks',BANK_ASSET_STORE],'readwrite',(tx,set,fail)=>{
   const store=tx.objectStore('tasks'),req=store.get(String(id));
   req.onsuccess=()=>{
    const old=req.result;
    if(!old){fail(new BankStorageError('Запись удалена из банка','NOT_FOUND'));return;}
    if(revision!==undefined&&revision!==old.revision){fail(new BankStorageError('Запись уже изменена в другом окне','REVISION_CONFLICT'));return;}
    bankAssetCollect(tx,[old],assets=>{const portable=bankAssetUnpack(old,assets);store.delete(old.id);set(portable);},fail);
   };
   req.onerror=()=>fail(req.error);
  });
 }
 async importBank(file,{signal}={}){
  const data=typeof file==='string'?JSON.parse(file):file;
  if(!data||data.format!=='quantum-work-bank'||!Array.isArray(data.items)||
   ![1,2].includes(data.version)||data.items.length>(data.version===1?500:20000))
   throw new BankStorageError('Требуется QWBANK v1 или расширенный QWBANK v2','BAD_IMPORT');
  if(data.version===2&&(data.count!==data.items.length||data.checksum!==bankHash(JSON.stringify(data.items))))
   throw new BankStorageError('Контрольная сумма QWBANK v2 не совпадает. Импорт не выполнен.','BAD_CHECKSUM');
  if(signal?.aborted)throw new BankAssetError('Импорт отменён','ASSET_CANCELLED');
  if(this.assetMigrationError)throw new BankAssetError('Сначала завершите перенос изображений: '+this.assetMigrationError,'ASSET_MIGRATION');
  const packed=await bankAssetPrepareMany(data.items.map(e=>this._clean({...e,id:e.id||bankIdentity()})));
  const entries=packed.records;
  if(signal?.aborted)throw new BankAssetError('Импорт отменён','ASSET_CANCELLED');
  return bankTransaction(this._db(),['tasks','meta',BANK_ASSET_STORE],'readwrite',(tx,set,fail)=>{
   const abort=()=>fail(new BankAssetError('Импорт отменён','ASSET_CANCELLED'));
   if(signal){signal.addEventListener('abort',abort,{once:true});for(const event of ['complete','abort'])tx.addEventListener(event,()=>signal.removeEventListener('abort',abort),{once:true});if(signal.aborted){abort();return;}}
   bankAssetWriteSet(tx,packed.assets,fail);
   const store=tx.objectStore('tasks'),meta=tx.objectStore('meta'),signatures=new Map(),used=new Set(),ids=new Set();
   let high=0,sequence=0;
   const marker=meta.get('sequence');
   marker.onsuccess=()=>{sequence=Number(marker.result?.value)||0;};
   marker.onerror=()=>fail(marker.error);
   const cursor=store.openCursor();
   cursor.onerror=()=>fail(cursor.error);
   cursor.onsuccess=()=>{
    const c=cursor.result;if(c){const e=c.value;signatures.set(bankStoredSignature(e),bankValidateExamYears(e));used.add(e.bankNumber);ids.add(e.id);high=Math.max(high,e.bankNumber);c.continue();return;}
    // All existing keys and the sequence are consulted in the same write
    // transaction, so two tabs cannot reserve the same number.
    let imported=0,skipped=0,yearConflicts=0;let next=Math.max(sequence,high);
    const now=new Date().toISOString();
    for(const e of entries){
     const signature=bankStoredSignature(e);
     if(signatures.has(signature)){skipped++;if(bankCanonicalJSON(signatures.get(signature))!==bankCanonicalJSON(bankValidateExamYears(e)))yearConflicts++;continue;}
     signatures.set(signature,bankValidateExamYears(e));
     let bankNumber=e.bankNumber;
     if(!bankNumber||used.has(bankNumber)||bankNumber<=next){
      do{next++;}while(used.has(next)&&next<=BANK_NUMBER_LIMIT);
      bankNumber=next;
     }else next=Math.max(next,bankNumber);
     if(bankNumber>BANK_NUMBER_LIMIT){fail(new BankStorageError('Номера банка закончились','BANK_NUMBERS_EXHAUSTED'));return;}
     used.add(bankNumber);
     let id=e.id;
     if(ids.has(id)){do{id=bankIdentity();}while(ids.has(id));}
     ids.add(id);
     if(signal?.aborted){abort();return;}
     try{store.add({...e,id,bankNumber,revision:1,createdAt:now,updatedAt:now});imported++;}catch(error){fail(error);return;}
    }
    meta.put({key:'sequence',value:next});
    set({imported,skipped,...(yearConflicts?{yearConflicts}:{})});
   };
  });
 }

 /** Consistent bank snapshot, including metadata required to continue numbering.
  * All reads occur inside one IndexedDB readonly transaction. */
 async _captureBackupSnapshot(){
  const snapshot=await bankTransaction(this._db(),['tasks','meta',BANK_ASSET_STORE],'readonly',(tx,set,fail)=>{
   const records=[],result={records,meta:{sequence:0,legacyMigration:null,legacyBackup:null}};
   let remaining=4;
   const finish=()=>{if(!--remaining)bankAssetCollect(tx,records,assets=>set({...result,assets}),fail);};
   const meta=tx.objectStore('meta');
   for(const [key,field] of [['sequence','sequence'],['legacyMigration','legacyMigration'],['legacyBackup','legacyBackup']]){
    const req=meta.get(key);
    req.onerror=()=>fail(req.error);
    req.onsuccess=()=>{
     result.meta[field]=key==='sequence'?Number(req.result?.value)||0:req.result||null;
     finish();
    };
   }
   const cur=tx.objectStore('tasks').openCursor();
   cur.onerror=()=>fail(cur.error);
   cur.onsuccess=()=>{
    const c=cur.result;
    if(!c){finish();return;}
    records.push(c.value);c.continue();
   };
  });
  return {records:await bankHydrateSet(snapshot),meta:snapshot.meta};
 }
 async createVerifiedBackup({signal,onProgress}={}){
  await this.open();
  if(signal?.aborted)throw new BankStorageError('Создание копии отменено','BACKUP_CANCELLED');
  onProgress?.('Чтение согласованного снимка IndexedDB…');
  const snapshot=await this._captureBackupSnapshot();
  onProgress?.('Расчёт SHA-256 и проверка архива…');
  const archive=await createBankBackupV3(snapshot,{signal});
  onProgress?.('Проверка SHA-256 завершена');
  return archive;
 }
 /** Preview verification never writes to IDB. Replaces a prior uncommitted plan. */
 async inspectRestore(input,{signal}={}){
  await this.open();
  this._restorePlan=null;
  const checked=await verifyBankBackupV3(input,{signal});
  // The ordinary data normalizer validates QWORK content but MUST NOT
  // change what is restored. Persist the original, complete record unchanged.
  for(const r of checked.archive.records){
   const clean=this._clean(r);
   if(bankStableJSON(clean.task)!==bankStableJSON(r.task))
    throw new BankStorageError('Нормализация меняет исходное содержание задания; восстановление запрещено','RESTORE_CONTENT');
  }
  const legacy=checked.archive.meta;
  if(legacy.legacyMigration?.state==='complete'&&
    (bankHash(legacy.legacyBackup?.raw||'')!==legacy.legacyBackup?.hash||
     legacy.legacyMigration.hash!==legacy.legacyBackup.hash))
   throw new BankStorageError('Исходная копия миграции повреждена','RESTORE_LEGACY');
  await bankAssetPrepareMany(checked.archive.records);
  const before=await this._captureBackupSnapshot();
  const token=bankIdentity();
  this._restorePlan={token,archive:structuredClone(checked.archive),before};
  return {token,createdAt:checked.createdAt,count:checked.count,version:checked.version,
   schema:checked.schema,sequence:checked.sequence,sha256:checked.sha256,
   bytes:checked.bytes,currentCount:before.records.length,
   mode:before.records.length?'replace':'empty'};
 }
 cancelRestore(){this._restorePlan=null;}
 /** Single IndexedDB readwrite transaction: compare old complete snapshot,
  * clear/rebuild tasks, replace numbering and migration metadata, or abort all.
  * No deletion occurs before input SHA-256/structure/QWORK validation. */
 async restoreVerifiedBackup({token,mode,signal,_injectAfterWrites}={}){
  await this.open();
  const plan=this._restorePlan;
  if(!plan||plan.token!==token)
   throw new BankStorageError('Предварительная проверка архива не найдена; проверьте файл заново','RESTORE_NOT_INSPECTED');
  if(!['empty','replace'].includes(mode))
   throw new BankStorageError('Укажите способ восстановления','RESTORE_MODE');
  if(mode==='empty'&&plan.before.records.length)
   throw new BankStorageError('Банк не пуст. Требуется явное подтверждение замены','RESTORE_NOT_EMPTY');
  const validated=await verifyBankBackupV3(plan.archive,{signal});
  if(signal?.aborted)throw new BankStorageError('Восстановление отменено','RESTORE_CANCELLED');
  const expected=plan.before;
  const archived=validated.archive,packed=await bankAssetPrepareMany(archived.records);
  if(signal?.aborted)throw new BankStorageError('Восстановление отменено','RESTORE_CANCELLED');
  await bankTransaction(this._db(),['tasks','meta',BANK_ASSET_STORE],'readwrite',(tx,set,fail)=>{
   const store=tx.objectStore('tasks'),meta=tx.objectStore('meta');
   const cancelled=()=>fail(new BankStorageError('Восстановление отменено','RESTORE_CANCELLED'));
   if(signal){
    signal.addEventListener('abort',cancelled,{once:true});
    tx.addEventListener('complete',()=>signal.removeEventListener('abort',cancelled),{once:true});
    tx.addEventListener('abort',()=>signal.removeEventListener('abort',cancelled),{once:true});
    if(signal.aborted){cancelled();return;}
   }
   // Serialize writer and restore in one transaction; compare every prior row
   // and metadata against the inspected snapshot to reject changes from tabs.
   let index=0;const readAssets=new Map(),urls=new Map();
   const cursor=store.openCursor();
   cursor.onerror=()=>fail(cursor.error);
   cursor.onsuccess=()=>{
    const c=cursor.result;
    if(c){
     bankAssetCollect(tx,[c.value],assets=>{
      const current=bankAssetUnpack(c.value,assets,urls);
      if(index>=expected.records.length||bankStableJSON(current)!==bankStableJSON(expected.records[index++])){
       fail(new BankStorageError('Банк изменился после проверки архива. Проверьте архив заново.','RESTORE_CONFLICT'));return;
      }
      c.continue();
     },fail,readAssets);return;
    }
    if(index!==expected.records.length){
     fail(new BankStorageError('Количество записей изменилось','RESTORE_CONFLICT'));return;
    }
    const values={};
    const names=['sequence','legacyMigration','legacyBackup'];
    let left=names.length;
    for(const key of names){
     const req=meta.get(key);
     req.onerror=()=>fail(req.error);
     req.onsuccess=()=>{
      values[key]=key==='sequence'?Number(req.result?.value)||0:req.result||null;
      if(!--left){
       const current={sequence:values.sequence,legacyMigration:values.legacyMigration,legacyBackup:values.legacyBackup};
       if(bankStableJSON(current)!==bankStableJSON(expected.meta)){
        fail(new BankStorageError('Метаданные банка изменились в другом окне','RESTORE_CONFLICT'));return;
       }
       try{
        store.clear();tx.objectStore(BANK_ASSET_STORE).clear();
        bankAssetWriteSet(tx,packed.assets,fail);
        let writes=0;
        for(const record of packed.records){
         if(signal?.aborted){cancelled();return;}
         store.add(record);
         writes++;
         if(Number.isInteger(_injectAfterWrites)&&writes===_injectAfterWrites){
          fail(new BankStorageError('Сбой во время восстановления (тест)','RESTORE_INJECTED'));return;
         }
        }
        meta.put({key:'sequence',value:archived.meta.sequence});
        meta.put({key:'assetMigration',state:'complete'});
        const marker=archived.meta.legacyMigration||
         {key:'legacyMigration',state:'none',createdAt:new Date().toISOString()};
        meta.put({...marker,key:'legacyMigration'});
        if(archived.meta.legacyBackup)meta.put({...archived.meta.legacyBackup,key:'legacyBackup'});
        else meta.delete('legacyBackup');
        meta.put({key:'lastRestore',at:new Date().toISOString(),count:archived.count,sha256:archived.manifest.sha256});
        set({count:archived.count,sequence:archived.meta.sequence});
       }catch(error){fail(error);}
      }
     };
    }
   };
  });
  this.migration=archived.meta.legacyMigration||{state:'none'};this.assetMigrationError=null;
  this._restorePlan=null;
  // Post-commit exhaustive check, not a claim of cross-storage atomicity.
  const after=await this._captureBackupSnapshot();
  if(after.records.length!==archived.records.length||
   bankStableJSON(after.records.slice().sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0))!==
   bankStableJSON(archived.records.slice().sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0))||
   after.meta.sequence!==archived.meta.sequence||
   (archived.meta.legacyMigration?
    bankStableJSON(after.meta.legacyMigration)!==bankStableJSON(archived.meta.legacyMigration):
    after.meta.legacyMigration?.state!=='none')||
   bankStableJSON(after.meta.legacyBackup)!==bankStableJSON(archived.meta.legacyBackup||null))
   throw new BankStorageError('Контроль после записи не совпал. Не считайте восстановление успешным.','RESTORE_VERIFY');
  return {restored:archived.count,sequence:archived.meta.sequence,verified:true};
 }

 async exportBank(){
  const items=(await this._captureBackupSnapshot()).records.map(bankPortable);
  if(items.length<=500)return {format:'quantum-work-bank',version:1,items};
  // QWBANK v2 is the preliminary large-bank interchange format. A complete
  // binary-attachment backup with cryptographic manifest belongs to TASK166.4.
  return {format:'quantum-work-bank',version:2,schema:1,
   count:items.length,checksum:bankHash(JSON.stringify(items)),items};
 }
 /** Mark-and-sweep: the reference scan and deletion share one write transaction. */
 async assetDiagnostics({clean=false,signal}={}){
  return bankTransaction(this._db(),['tasks',BANK_ASSET_STORE],clean?'readwrite':'readonly',(tx,set,fail)=>{
   const refs=new Map(),assets=tx.objectStore(BANK_ASSET_STORE),tasks=tx.objectStore('tasks');
   const report={count:0,bytes:0,references:0,orphans:0,orphanBytes:0,deleted:0,inline:0};
   const abort=()=>fail(new BankAssetError('Очистка отменена','ASSET_CANCELLED'));
   if(signal){signal.addEventListener('abort',abort,{once:true});for(const event of ['complete','abort'])tx.addEventListener(event,()=>signal.removeEventListener('abort',abort),{once:true});if(signal.aborted){abort();return;}}
   const req=tasks.openCursor();req.onerror=()=>fail(req.error);
   req.onsuccess=()=>{try{
    const c=req.result;
    if(c){const r=c.value;if(r.task?.image)report.inline++;
     if(r.imageAsset){const ref=r.imageAsset;if(r.task?.image||typeof ref.key!=='string')throw new BankAssetError('Повреждена ссылка','ASSET_REFERENCE');
      const prior=refs.get(ref.key);
      if(prior&&(prior.mime!==ref.mime||prior.size!==ref.size||prior.sha256!==ref.sha256))throw new BankAssetError('Несогласованные ссылки','ASSET_CORRUPT');
      refs.set(ref.key,ref);report.references++;}
     c.continue();return;
    }
    const found=new Set(),orphans=[],a=assets.openCursor();a.onerror=()=>fail(a.error);
    a.onsuccess=()=>{try{
     const x=a.result;
     if(x){const v=x.value;bankAssetValidate(v,v);report.count++;report.bytes+=v.size;
      if(refs.has(x.key)){bankAssetValidate(v,refs.get(x.key));found.add(x.key);}
      else{report.orphans++;report.orphanBytes+=v.size;orphans.push(x.key);}
      x.continue();return;
     }
     if(found.size!==refs.size)throw new BankAssetError('В банке отсутствуют используемые изображения; очистка запрещена','ASSET_MISSING');
     if(clean)for(const key of orphans){if(signal?.aborted){abort();return;}assets.delete(key);report.deleted++;}
     set(report);
    }catch(error){fail(error);}};
   }catch(error){fail(error);}};
  });
 }
 async getStatistics(){
  const [count,migration,backup]=await Promise.all([
   bankRequest(this._db().transaction('tasks').objectStore('tasks').count()),
   this._meta('legacyMigration'),this._meta('lastBackup')]);
  let estimatedBytes=null;
  try{estimatedBytes=(await navigator.storage?.estimate?.())?.usage??null;}catch{}
  return {count,estimatedBytes,lastBackupAt:backup?.at||null,
   migration:migration?.state||'none',assetMigrationError:this.assetMigrationError,storage:'IndexedDB'};
 }
 async close(){if(this._opening)await this._opening;if(this.db){this.db.close();this.db=null;}}
}
function createBankRepository(options){return new BankRepository(options);}
export {BANK_DB_NAME,BANK_DB_VERSION,BANK_LEGACY_KEY,BANK_PAGE_LIMIT,
 BankStorageError,BankRepository,createBankRepository,bankSignature,bankSearchMatch};
