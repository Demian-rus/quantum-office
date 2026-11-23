/* TASK166.1 — one durable bank repository for browser HTML.
   Future native SQLite implements the same asynchronous contract; no mock
   SQLite adapter is shipped with this browser implementation. */
const BANK_DB_NAME='quantum-office-bank';
const BANK_DB_VERSION=1;
const BANK_LEGACY_KEY='quantum-office.work-bank.v1';
const BANK_LEGACY_COUNTER_KEY='quantum-office.work-bank.number-sequence.v1';
const BANK_NUMBER_LIMIT=99999;
const BANK_PAGE_LIMIT=80;
const BANK_FILTER_FIELDS=['subject','grade','exam','year','part','slot','difficulty','type','topic','subtopic','origin'];
const BANK_INDEX_FIELDS=['bankNumber',...BANK_FILTER_FIELDS,'updatedAt'];
const BANK_RECORD_FIELDS=['id','bankNumber','subject','grade','exam','topic','subtopic','origin','year','part','slot','difficulty','task'];

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
  const fail=error=>{manualError=error;try{tx.abort();}catch{}};
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
function bankSignature(e){
 return [e.subject,e.grade,e.exam,e.year,e.part,e.slot,e.topic,e.subtopic,e.task?.prompt?.trim().toLocaleLowerCase('ru-RU')].join('|');
}
function bankClone(e){return structuredClone(e);}
function bankPortable(e){
 const x={};for(const k of BANK_RECORD_FIELDS)if(e[k]!==undefined)x[k]=bankClone(e[k]);return x;
}
function bankSearchMatch(e,filters={}){
 for(const k of BANK_FILTER_FIELDS){
  const v=filters[k];if(v===undefined||v===null||v===''||v==='all')continue;
  if(String(k==='type'?e.task?.type:e[k]||'')!==String(v))return false;
 }
 const term=String(filters.search||'').trim().toLocaleLowerCase('ru-RU');
 if(term&&!([String(e.bankNumber),String(e.bankNumber).padStart(5,'0'),
  e.task?.prompt,e.task?.answer,e.task?.comment,e.task?.criteria,
  e.topic,e.subtopic,e.grade].some(x=>String(x||'').toLocaleLowerCase('ru-RU').includes(term))))return false;
 return true;
}
class BankRepository{
 constructor({indexedDB=globalThis.indexedDB,legacyStorage=globalThis.localStorage,
  normalize=e=>e,dbName=BANK_DB_NAME}={}){
  this.factory=indexedDB;this.legacyStorage=legacyStorage;this.normalize=normalize;
  this.dbName=dbName;this.db=null;this._opening=null;this.migration=null;
 }
 async open(){
  if(this.db)return this;
  if(this._opening)return this._opening;
  this._opening=this._open();
  try{return await this._opening;}finally{this._opening=null;}
 }
 async _open(){
  if(!this.factory)throw new BankStorageError('IndexedDB недоступна. Банк не будет записан; сохраните QWBANK.', 'IDB_UNAVAILABLE');
  const db=await new Promise((resolve,reject)=>{
   const request=this.factory.open(this.dbName,BANK_DB_VERSION);
   request.onupgradeneeded=()=>{
    const db=request.result,tx=request.transaction;
    const tasks=db.objectStoreNames.contains('tasks')?tx.objectStore('tasks'):
     db.createObjectStore('tasks',{keyPath:'id'});
    for(const name of BANK_INDEX_FIELDS){
     if(!tasks.indexNames.contains(name))
      tasks.createIndex(name,name,{unique:name==='bankNumber'});
    }
    if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
   };
   request.onerror=()=>reject(request.error||new BankStorageError('Не удалось открыть IndexedDB'));
   request.onblocked=()=>reject(new BankStorageError('Другая вкладка блокирует обновление базы. Закройте другие окна.', 'IDB_BLOCKED'));
   request.onsuccess=()=>resolve(request.result);
  });
  db.onversionchange=()=>{db.close();if(this.db===db)this.db=null;};
  this.db=db;
  try{await this._migrateLegacy();return this;}
  catch(e){this.db=null;db.close();throw e;}
 }
 _db(){if(!this.db)throw new BankStorageError('Банк не открыт. Повторите подключение к хранилищу.', 'IDB_CLOSED');return this.db;}
 _clean(input){
  const normalized=this.normalize(bankClone(input));
  if(!normalized||typeof normalized!=='object'||Array.isArray(normalized)||!normalized.task||
   typeof normalized.task.prompt!=='string'||typeof normalized.id!=='string'||!normalized.id.trim()||
   normalized.id.length>80)throw new BankStorageError('Некорректная запись банка', 'INVALID_RECORD');
  const record=bankPortable(normalized);
  record.id=normalized.id;
  record.bankNumber=Number.isInteger(normalized.bankNumber)&&normalized.bankNumber>0&&normalized.bankNumber<=BANK_NUMBER_LIMIT?normalized.bankNumber:0;
  record.type=record.task.type;
  return record;
 }
 async _meta(key){return bankRequest(this._db().transaction('meta').objectStore('meta').get(key));}
 async _migrateLegacy(){
  let raw;
  try{raw=this.legacyStorage?.getItem(BANK_LEGACY_KEY);}
  catch(e){throw new BankStorageError('Нельзя прочитать старый банк. Экспортируйте данные до продолжения.', 'LEGACY_READ');}
  const marker=await this._meta('legacyMigration');
  if(marker){this.migration=marker;return;}
  if(raw===null||raw===undefined){this.migration={key:'legacyMigration',state:'none'};return;}
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
  const existing=await bankRequest(this._db().transaction('tasks').objectStore('tasks').count());
  if(existing)throw new BankStorageError('В базе есть задания без отметки о переносе. Автоматическое объединение запрещено.', 'LEGACY_CONFLICT');
  let oldSeq=0;
  try{oldSeq=Number(this.legacyStorage?.getItem(BANK_LEGACY_COUNTER_KEY))||0;}catch{}
  const digest=bankHash(raw),when=new Date().toISOString();
  await bankTransaction(this._db(),['tasks','meta'],'readwrite',(tx,set,fail)=>{
   const store=tx.objectStore('tasks'),meta=tx.objectStore('meta');
   try{
    for(const r of records)store.add({...r,createdAt:when,updatedAt:when,revision:1});
    meta.put({key:'legacyBackup',raw,hash:digest,createdAt:when});
    meta.put({key:'sequence',value:Math.max(high,Math.min(BANK_NUMBER_LIMIT,oldSeq))});
    const marker={key:'legacyMigration',state:'complete',count:records.length,hash:digest,createdAt:when};
    meta.put(marker);set(marker);
   }catch(e){fail(e);}
  });
  const count=await bankRequest(this._db().transaction('tasks').objectStore('tasks').count());
  const saved=await this._meta('legacyMigration');
  if(count!==records.length||saved?.hash!==digest||saved?.count!==records.length)
   throw new BankStorageError('Перенос не прошёл проверку целостности. Старый банк не удалён.', 'LEGACY_VERIFY');
  // The user's old localStorage is deliberately left untouched as a safety copy.
  this.migration=saved;
 }
 async getTask(id){return bankRequest(this._db().transaction('tasks').objectStore('tasks').get(String(id)));}
 async listTasks(filters={},pagination={}){
  const limit=Math.min(BANK_PAGE_LIMIT,Math.max(1,Number(pagination.limit)||30));
  const offset=Math.max(0,Math.floor(Number(pagination.offset)||0));
  const key=BANK_FILTER_FIELDS.find(k=>k!=='type'&&filters[k]&&filters[k]!=='all')||
   (filters.type&&filters.type!=='all'?'type':null);
  return bankTransaction(this._db(),'tasks','readonly',(tx,set,fail)=>{
   const store=tx.objectStore('tasks'),source=key?store.index(key):store;
   const req=source.openCursor(key?IDBKeyRange.only(filters[key]):null);
   const items=[];let total=0;
   req.onerror=()=>fail(req.error||Error('Ошибка поиска по банку'));
   req.onsuccess=()=>{
    const cursor=req.result;
    if(!cursor){set({items,total,offset,limit,hasMore:offset+items.length<total});return;}
    const e=cursor.value;
    if(bankSearchMatch(e,filters)){
     if(total>=offset&&items.length<limit)items.push(e);
     total++;
    }
    cursor.continue();
   };
  });
 }
 async listFacets(fields=['topic','subtopic','year']){
  const keys=fields.filter(k=>BANK_INDEX_FIELDS.includes(k)&&k!=='bankNumber');
  return bankTransaction(this._db(),'tasks','readonly',(tx,set,fail)=>{
   const result={};let remaining=keys.length;
   if(!remaining){set(result);return;}
   const done=()=>{if(!--remaining)set(result);};
   for(const key of keys){
    result[key]=[];
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
  const candidate=this._clean({...input,id:input.id||bankIdentity()});
  return bankTransaction(this._db(),['tasks','meta'],'readwrite',(tx,set,fail)=>{
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
 }
 async updateTask(id,input,revision){
  const candidate=this._clean({...input,id});
  return bankTransaction(this._db(),'tasks','readwrite',(tx,set,fail)=>{
   const store=tx.objectStore('tasks'),req=store.get(String(id));
   req.onsuccess=()=>{
    const old=req.result;
    if(!old){fail(new BankStorageError('Запись удалена из банка','NOT_FOUND'));return;}
    if(!Number.isInteger(revision)||revision!==old.revision){
     fail(new BankStorageError('Задание изменено в другом окне. Скопируйте текст и откройте запись заново.','REVISION_CONFLICT'));return;
    }
    const next={...candidate,id:old.id,bankNumber:old.bankNumber,revision:old.revision+1,
     createdAt:old.createdAt,updatedAt:new Date().toISOString()};
    store.put(next);set(next);
   };
   req.onerror=()=>fail(req.error);
  });
 }
 async deleteTask(id,revision){
  return bankTransaction(this._db(),'tasks','readwrite',(tx,set,fail)=>{
   const store=tx.objectStore('tasks'),req=store.get(String(id));
   req.onsuccess=()=>{
    const old=req.result;
    if(!old){fail(new BankStorageError('Запись удалена из банка','NOT_FOUND'));return;}
    if(revision!==undefined&&revision!==old.revision){fail(new BankStorageError('Запись уже изменена в другом окне','REVISION_CONFLICT'));return;}
    store.delete(old.id);set(old);
   };
   req.onerror=()=>fail(req.error);
  });
 }
 async importBank(file){
  const data=typeof file==='string'?JSON.parse(file):file;
  if(!data||data.format!=='quantum-work-bank'||data.version!==1||!Array.isArray(data.items)||
   data.items.length>500)throw new BankStorageError('Требуется корректный QWBANK v1 (до 500 заданий)', 'BAD_IMPORT');
  const entries=data.items.map(e=>this._clean({...e,id:e.id||bankIdentity()}));
  return bankTransaction(this._db(),['tasks','meta'],'readwrite',(tx,set,fail)=>{
   const store=tx.objectStore('tasks'),meta=tx.objectStore('meta'),signatures=new Set(),used=new Set(),ids=new Set();
   let high=0,sequence=0,started=false;
   const marker=meta.get('sequence');
   marker.onsuccess=()=>{sequence=Number(marker.result?.value)||0;};
   marker.onerror=()=>fail(marker.error);
   const cursor=store.openCursor();
   cursor.onerror=()=>fail(cursor.error);
   cursor.onsuccess=()=>{
    const c=cursor.result;if(c){const e=c.value;signatures.add(bankSignature(e));used.add(e.bankNumber);ids.add(e.id);high=Math.max(high,e.bankNumber);c.continue();return;}
    // All existing keys and the sequence are consulted in the same write
    // transaction, so two tabs cannot reserve the same number.
    let imported=0,skipped=0;let next=Math.max(sequence,high);
    const now=new Date().toISOString();
    for(const e of entries){
     const signature=bankSignature(e);
     if(signatures.has(signature)){skipped++;continue;}
     signatures.add(signature);
     let bankNumber=e.bankNumber;
     if(!bankNumber||used.has(bankNumber)||bankNumber<=next){
      do{next++;}while(used.has(next)&&next<=BANK_NUMBER_LIMIT);
      bankNumber=next;
     }else next=Math.max(next,bankNumber);
     if(bankNumber>BANK_NUMBER_LIMIT){fail(new BankStorageError('Номера банка закончились','BANK_NUMBERS_EXHAUSTED'));return;}
     used.add(bankNumber);
     let id=bankIdentity();while(ids.has(id))id=bankIdentity();ids.add(id);
     store.add({...e,id,bankNumber,revision:1,createdAt:now,updatedAt:now});imported++;
    }
    meta.put({key:'sequence',value:next});
    set({imported,skipped});
   };
  });
 }
 async exportBank(){
  const items=await bankTransaction(this._db(),'tasks','readonly',(tx,set,fail)=>{
   const list=[],req=tx.objectStore('tasks').openCursor();
   req.onerror=()=>fail(req.error);
   req.onsuccess=()=>{const c=req.result;if(!c){set(list);return;}list.push(bankPortable(c.value));c.continue();};
  });
  return {format:'quantum-work-bank',version:1,items};
 }
 async getStatistics(){
  const [count,migration,backup]=await Promise.all([
   bankRequest(this._db().transaction('tasks').objectStore('tasks').count()),
   this._meta('legacyMigration'),this._meta('lastBackup')]);
  let estimatedBytes=null;
  try{estimatedBytes=(await navigator.storage?.estimate?.())?.usage??null;}catch{}
  return {count,estimatedBytes,lastBackupAt:backup?.at||null,
   migration:migration?.state||'none',storage:'IndexedDB'};
 }
 async close(){if(this._opening)await this._opening;if(this.db){this.db.close();this.db=null;}}
}
function createBankRepository(options){return new BankRepository(options);}
export {BANK_DB_NAME,BANK_DB_VERSION,BANK_LEGACY_KEY,BANK_PAGE_LIMIT,
 BankStorageError,BankRepository,createBankRepository,bankSignature,bankSearchMatch};
