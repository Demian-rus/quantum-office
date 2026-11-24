/* TASK166.4 — native IPC adapter, sharing QWORK/backup validators. */
const qoNativeDesktop=typeof document!=='undefined'&&!!document.querySelector('meta[name="quantum-office-native"]');
async function qoNativeInvoke(command,args={}){
 const invoke=globalThis.__TAURI__?.core?.invoke;
 if(typeof invoke!=='function')throw new BankStorageError('Нативный интерфейс SQLite недоступен. Переключение на IndexedDB запрещено.','NATIVE_UNAVAILABLE');
 try{return await invoke(command,args);}catch(e){const message=typeof e==='string'?e:e?.message||String(e);throw new BankStorageError(message,message.split(':')[0]||'SQLITE_ERROR');}
}
class SQLiteBankRepository{
 constructor({normalize=e=>e}={}){this.normalize=normalize;this.db=null;this._opening=null;this._restorePlan=null;this.legacyStorage=null;this.assetMigrationError=null;this.storage='SQLite';}
 async _call(operation,payload={},signal){
  if(signal?.aborted)throw new BankStorageError('Операция отменена','CANCELLED');
  const requestId=bankIdentity(),abort=()=>void qoNativeInvoke('bank_cancel',{requestId}).catch(()=>{});
  signal?.addEventListener('abort',abort,{once:true});
  try{return await qoNativeInvoke('bank_command',{operation,payload,requestId});}finally{signal?.removeEventListener('abort',abort);}
 }
 async open(){if(this.db)return this;if(this._opening)return this._opening;
  this._opening=(async()=>{await this._call('open');this.db=true;return this;})();
  try{return await this._opening;}finally{this._opening=null;}}
 async close(){if(this._opening)await this._opening;this.db=null;this._restorePlan=null;}
 async _run(operation,payload={},signal){await this.open();return this._call(operation,payload,signal);}
 getLegacyRecovery(){return null;}
 async _clean(input){
  const normalized=this.normalize(structuredClone(input));
  if(!normalized||!normalized.task||typeof normalized.task.prompt!=='string'||typeof normalized.id!=='string'||!normalized.id.trim()||normalized.id.length>80)throw new BankStorageError('Некорректная запись','INVALID_RECORD');
  const record=bankPortable(normalized);record.type=record.task.type;
  await bankAssetPrepareMany([record]);return record;
 }
 async getTask(id){return (await this._run('get',{id:String(id)}))??undefined;}
 async snapshotMetadata(){return this._run('metadata');}
 async listTasks(filters={},pagination={}){return this._run('list',{filters,offset:Math.max(0,Math.floor(Number(pagination.offset)||0)),limit:Math.min(BANK_PAGE_LIMIT,Math.max(1,Math.floor(Number(pagination.limit)||30))),includeImages:pagination.includeImages!==false});}
 async listFacets(fields=['topic','subtopic','year']){return this._run('facets',{fields});}
 async createTask(input){return this._run('create',{record:await this._clean({...input,id:input.id||bankIdentity()}),now:new Date().toISOString()});}
 async updateTask(id,input,revision){if(!Number.isInteger(revision))throw new BankStorageError('Требуется revision','REVISION_CONFLICT');return this._run('update',{record:await this._clean({...input,id}),revision,now:new Date().toISOString()});}
 async deleteTask(id,revision){return this._run('delete',{id:String(id),revision:revision??null});}
 async importBank(file,{signal}={}){
  const data=typeof file==='string'?JSON.parse(file):file;
  if(!data||data.format!=='quantum-work-bank'||!Array.isArray(data.items)||![1,2].includes(data.version)||data.items.length>(data.version===1?500:20000))throw new BankStorageError('Требуется QWBANK v1/v2','BAD_IMPORT');
  if(data.version===2&&(data.count!==data.items.length||data.checksum!==bankHash(JSON.stringify(data.items))))throw new BankStorageError('Контрольная сумма не совпадает','BAD_CHECKSUM');
  const records=[];for(const e of data.items){if(signal?.aborted)throw new BankStorageError('Импорт отменён','CANCELLED');records.push(await this._clean({...e,id:e.id||bankIdentity()}));}
  return this._run('import',{records,now:new Date().toISOString()},signal);
 }
 async _captureBackupSnapshot(){const {records,meta}=await this._run('snapshot');return {records,meta};}
 async createVerifiedBackup({signal,onProgress}={}){
  onProgress?.('Чтение согласованного снимка SQLite…');const {records,meta}=await this._run('snapshot',{},signal);
  onProgress?.('Проверка SHA-256…');return createBankBackupV3({records,meta},{signal});
 }
 async inspectRestore(input,{signal}={}){
  this._restorePlan=null;const checked=await verifyBankBackupV3(input,{signal});
  for(const r of checked.archive.records){const clean=this.normalize(structuredClone(r));if(bankStableJSON(clean.task)!==bankStableJSON(r.task))throw new BankStorageError('Нормализация меняет исходное содержание','RESTORE_CONTENT');}
  const meta=checked.archive.meta;
  if(meta.legacyMigration?.state==='complete'&&(bankHash(meta.legacyBackup?.raw||'')!==meta.legacyBackup?.hash||meta.legacyMigration.hash!==meta.legacyBackup.hash))throw new BankStorageError('Исходная копия миграции повреждена','RESTORE_LEGACY');
  await bankAssetPrepareMany(checked.archive.records);
  const before=await this._run('state',{},signal),token=bankIdentity();
  this._restorePlan={token,archive:structuredClone(checked.archive),before};
  return {token,createdAt:checked.createdAt,count:checked.count,version:checked.version,schema:checked.schema,sequence:checked.sequence,sha256:checked.sha256,bytes:checked.bytes,currentCount:before.count,mode:before.count?'replace':'empty'};
 }
 cancelRestore(){this._restorePlan=null;}
 async restoreVerifiedBackup({token,mode,signal}={}){
  const plan=this._restorePlan;if(!plan||token!==plan.token)throw new BankStorageError('Сначала проверьте архив','RESTORE_NOT_INSPECTED');
  if(!['empty','replace'].includes(mode)||mode==='empty'&&plan.before.count)throw new BankStorageError('Неверный режим восстановления','RESTORE_MODE');
  const {archive}=await verifyBankBackupV3(plan.archive,{signal}),{manifest,...body}=archive;
  const result=await this._run('restore',{canonical:bankStableJSON(body),sha256:manifest.sha256,generation:plan.before.generation,mode},signal);
  this._restorePlan=null;return result;
 }
 async exportBank(){const items=(await this._captureBackupSnapshot()).records.map(bankPortable);return items.length<=500?{format:'quantum-work-bank',version:1,items}:{format:'quantum-work-bank',version:2,schema:1,count:items.length,checksum:bankHash(JSON.stringify(items)),items};}
 async assetDiagnostics({clean=false,signal}={}){return this._run('diagnostics',{clean},signal);}
 async getStatistics(){return this._run('statistics');}
 async openDataFolder(){return qoNativeInvoke('open_data_folder');}
 async nativeSnapshot(){return this._run('native_backup');}
}
function createOfficeBankRepository(options){return qoNativeDesktop?new SQLiteBankRepository(options):createBankRepository(options);}
async function qoNativeSave(name,blob){const bytes=new Uint8Array(await blob.arrayBuffer());return qoNativeInvoke('save_export',{name,data:bankAssetB64(bytes)});}
export {SQLiteBankRepository,createOfficeBankRepository,qoNativeDesktop,qoNativeSave};
