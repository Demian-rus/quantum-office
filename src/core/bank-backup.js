/* TASK166.2 — portable SHA-256 bank archives. No IndexedDB or UI dependencies.
   All future storage adapters (including SQLite) can use this exact format. */
export const BANK_BACKUP_FORMAT='quantum-work-bank-backup';
export const BANK_BACKUP_VERSION=3;
export const BANK_BACKUP_MAX_RECORDS=20000;
export const BANK_BACKUP_MAX_BYTES=260_000_000;
const BANK_SERIALIZATION='sorted-json-utf8-v1';
const BANK_SHA='SHA-256';

export class BankBackupError extends Error{
 constructor(message,code='BACKUP_INVALID'){super(message);this.name='BankBackupError';this.code=code;}
}
export function bankStableJSON(value){
 if(value===null)return 'null';
 if(typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'){
  if(!Number.isFinite(value))throw new BankBackupError('Недопустимое число в архиве');
  return JSON.stringify(value);
 }
 if(Array.isArray(value))return '['+value.map(bankStableJSON).join(',')+']';
 if(value&&typeof value==='object'){
  const keys=Object.keys(value).sort();
  return '{'+keys.map(k=>{
   if(value[k]===undefined)throw new BankBackupError('Неопределённое поле в архиве: '+k);
   return JSON.stringify(k)+':'+bankStableJSON(value[k]);
  }).join(',')+'}';
 }
 throw new BankBackupError('Недопустимый тип значения в архиве');
}
function archiveBytes(value){
 const canonical=bankStableJSON(value),bytes=new TextEncoder().encode(canonical);
 if(bytes.byteLength>BANK_BACKUP_MAX_BYTES)
  throw new BankBackupError('Размер архива превышает 260 МБ','BACKUP_TOO_LARGE');
 return bytes;
}
async function digestBytes(bytes){
 const subtle=globalThis.crypto?.subtle;
 if(!subtle)throw new BankBackupError('Нужен доступ к Web Crypto SHA-256. Используйте локальный HTML через безопасный origin.','SHA256_UNAVAILABLE');
 const hash=new Uint8Array(await subtle.digest(BANK_SHA,bytes));
 return Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('');
}
export function validateBankBackupStructure(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||
  body.format!==BANK_BACKUP_FORMAT)throw new BankBackupError('Это не резервная копия банка QWBANK v3','BACKUP_FORMAT');
 if(body.version!==BANK_BACKUP_VERSION)
  throw new BankBackupError('Неподдерживаемая версия резервной копии: '+String(body.version),'BACKUP_VERSION');
 if(body.schema!==1)
  throw new BankBackupError('Неподдерживаемая версия схемы: '+String(body.schema),'BACKUP_SCHEMA');
 if(!Number.isFinite(Date.parse(body.createdAt))||typeof body.createdAt!=='string')
  throw new BankBackupError('Дата создания копии некорректна');
 if(!Array.isArray(body.records)||body.records.length>BANK_BACKUP_MAX_RECORDS||
  !Number.isInteger(body.count)||body.count!==body.records.length)
  throw new BankBackupError('Количество заданий в архиве неверно','BACKUP_COUNT');
 if(!body.meta||typeof body.meta!=='object'||Array.isArray(body.meta)||
  !Number.isInteger(body.meta.sequence)||body.meta.sequence<0||body.meta.sequence>99999)
  throw new BankBackupError('Счётчик постоянных номеров недействителен','BACKUP_SEQUENCE');
 if(body.meta.legacyMigration!==null&&body.meta.legacyMigration!==undefined&&
  (typeof body.meta.legacyMigration!=='object'||!['none','complete'].includes(body.meta.legacyMigration.state)))
  throw new BankBackupError('Некорректный маркер миграции','BACKUP_LEGACY');
 if(body.meta.legacyBackup!==null&&body.meta.legacyBackup!==undefined&&
  (typeof body.meta.legacyBackup!=='object'||typeof body.meta.legacyBackup.raw!=='string'))
  throw new BankBackupError('Некорректный резервный источник миграции','BACKUP_LEGACY');
 if(body.meta.legacyMigration?.state==='complete'&&
  (!body.meta.legacyBackup||body.meta.legacyMigration.hash!==body.meta.legacyBackup.hash))
  throw new BankBackupError('Неполные данные старой миграции','BACKUP_LEGACY');
 const ids=new Set(),numbers=new Set();let max=0;
 for(const record of body.records){
  if(!record||typeof record!=='object'||Array.isArray(record)||
   typeof record.id!=='string'||!record.id.trim()||record.id.length>80||
   !Number.isInteger(record.bankNumber)||record.bankNumber<1||record.bankNumber>99999||
   !record.task||typeof record.task!=='object'||Array.isArray(record.task)||
   typeof record.task.prompt!=='string'||!Number.isInteger(record.revision)||record.revision<1||
   typeof record.createdAt!=='string'||typeof record.updatedAt!=='string')
   throw new BankBackupError('Некорректная запись банка','BACKUP_RECORD');
  if(ids.has(record.id))throw new BankBackupError('Повторяется ID записи','BACKUP_DUPLICATE_ID');
  if(numbers.has(record.bankNumber))throw new BankBackupError('Повторяется постоянный номер','BACKUP_DUPLICATE_NUMBER');
  ids.add(record.id);numbers.add(record.bankNumber);max=Math.max(max,record.bankNumber);
 }
 if(body.meta.sequence<max)throw new BankBackupError('Счётчик ниже последнего постоянного номера','BACKUP_SEQUENCE');
 return {count:body.count,createdAt:body.createdAt,version:body.version,schema:body.schema,
  sequence:body.meta.sequence,maxBankNumber:max};
}
export async function createBankBackupV3(snapshot,{signal}={}){
 if(signal?.aborted)throw new BankBackupError('Создание архива отменено','BACKUP_CANCELLED');
 // Snapshot must originate from ONE readonly IndexedDB transaction.
 const body={format:BANK_BACKUP_FORMAT,version:BANK_BACKUP_VERSION,schema:1,
  createdAt:new Date().toISOString(),count:snapshot.records.length,
  meta:structuredClone(snapshot.meta),
  records:structuredClone(snapshot.records).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)};
 validateBankBackupStructure(body);
 const bytes=archiveBytes(body),sha256=await digestBytes(bytes);
 if(signal?.aborted)throw new BankBackupError('Создание архива отменено','BACKUP_CANCELLED');
 const archive={...body,manifest:{algorithm:BANK_SHA,serialization:BANK_SERIALIZATION,
  bytes:bytes.byteLength,sha256}};
 // Verify the exported archive itself before making it available for download.
 await verifyBankBackupV3(archive,{signal});
 return archive;
}
export async function verifyBankBackupV3(input,{signal}={}){
 if(signal?.aborted)throw new BankBackupError('Проверка отменена','BACKUP_CANCELLED');
 let data;
 try{data=typeof input==='string'?JSON.parse(input):input;}catch{
  throw new BankBackupError('Файл содержит повреждённый JSON','BACKUP_JSON');
 }
 if(!data||typeof data!=='object'||Array.isArray(data))
  throw new BankBackupError('Некорректный архив','BACKUP_FORMAT');
 const {manifest,...body}=data;
 const summary=validateBankBackupStructure(body);
 if(!manifest||manifest.algorithm!==BANK_SHA||manifest.serialization!==BANK_SERIALIZATION||
  !Number.isInteger(manifest.bytes)||manifest.bytes<0||
  !/^[a-f0-9]{64}$/.test(manifest.sha256||''))
  throw new BankBackupError('Отсутствует корректный SHA-256 манифест','BACKUP_MANIFEST');
 const bytes=archiveBytes(body);
 if(bytes.byteLength!==manifest.bytes)
  throw new BankBackupError('Размер данных архива не совпадает с манифестом','BACKUP_CHECKSUM');
 const actual=await digestBytes(bytes);
 if(signal?.aborted)throw new BankBackupError('Проверка отменена','BACKUP_CANCELLED');
 if(actual!==manifest.sha256)
  throw new BankBackupError('SHA-256 не совпадает. Восстановление запрещено.','BACKUP_CHECKSUM');
 return {...summary,sha256:actual,bytes:bytes.byteLength,
  archive:data};
}
