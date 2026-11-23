/* TASK134 — durable, versioned cross-editor backup. Legacy .qbackup remains readable. */
import {validateWorkspace,decodeWorkspace} from './store.js';
import {bankStableJSON,verifyBankBackupV3} from './bank-backup.js';
import {validateStudioProject} from './studio-model.js';

export const OFFICE_BACKUP_V2='quantum-office-backup-v2';
const jsonSize=value=>JSON.stringify(value).length;

function validateBackupWriter(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||
    typeof value.name!=='string'||value.name.length>120||
    typeof value.html!=='string'||value.html.length>2700000||
    jsonSize(value)>8500000)throw Error('Некорректный документ «Тексты» в архиве');
 return value;
}
function validateBackupSlides(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||
    typeof value.name!=='string'||value.name.length>120||
    !Array.isArray(value.slides)||value.slides.length<1||value.slides.length>60||
    !Number.isInteger(value.active)||value.active<0||value.active>=value.slides.length||
    value.slides.some(s=>!s||!Array.isArray(s.items)||s.items.length>500)||
    jsonSize(value)>12500000)throw Error('Некорректная презентация в архиве');
 return value;
}
function validateBackupStudio(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||
    jsonSize(value)>34000000)throw Error('Некорректный проект «Студия» в архиве');
 return validateStudioProject(value);
}
/** Produce one portable download containing all four editors, not just spreadsheets. */
export function encodeOfficeBackup(workspace,writer,slides,studio){
 validateWorkspace(workspace);
 const snapshot={
  format:OFFICE_BACKUP_V2,
  createdAt:new Date().toISOString(),
  workspace,
  writer:validateBackupWriter(writer),
  slides:validateBackupSlides(slides),
  studio:validateBackupStudio(studio)
 };
 const result=JSON.stringify(snapshot);
 if(result.length>52000000)throw Error('Общий архив слишком большой — сохраните отдельные проекты');
 return result;
}
/** Read both v1 (sheets only) and v2 (all editors) with validation before mutation. */
export function decodeOfficeBackup(text){
 const value=JSON.parse(text);
 if(value?.format==='quantum-office-backup-v1')
  return {legacy:true,workspace:decodeWorkspace(text)};
 if(value?.format!==OFFICE_BACKUP_V2)throw Error('Неподдерживаемый формат резервной копии');
 validateWorkspace(value.workspace);
 return {
  legacy:false,
  workspace:value.workspace,
  writer:validateBackupWriter(value.writer),
  slides:validateBackupSlides(value.slides),
  studio:validateBackupStudio(value.studio),
  createdAt:typeof value.createdAt==='string'?value.createdAt:''
 };
}


/* TASK166.2: combined export contains bank records, but restoring IDB and
 * localStorage is NOT cross-store atomic. The reader exposes separate checked
 * components; UI deliberately requires two explicit recovery operations. */
export const OFFICE_BACKUP_V3='quantum-office-backup-v3';
async function qoOfficeDigest(body){
 const canonical=bankStableJSON(body),bytes=new TextEncoder().encode(canonical);
 if(bytes.length>325_000_000)throw Error('Архив превышает предел 325 МБ');
 if(!globalThis.crypto?.subtle)throw Error('SHA-256 недоступен в этом браузере');
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
 return {bytes:bytes.length,sha256:Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('')};
}
export async function encodeOfficeBackupWithBank(workspace,writer,slides,studio,bankArchive){
 await verifyBankBackupV3(bankArchive);
 const office=JSON.parse(encodeOfficeBackup(workspace,writer,slides,studio));
 const body={format:OFFICE_BACKUP_V3,version:3,createdAt:new Date().toISOString(),office,
  bank:structuredClone(bankArchive)};
 const manifest={algorithm:'SHA-256',serialization:'sorted-json-utf8-v1',
  ...await qoOfficeDigest(body)};
 return JSON.stringify({...body,manifest});
}
export async function decodeOfficeBackupWithBank(text){
 if(typeof text!=='string'||text.length>325_000_000)throw Error('Архив Office слишком большой');
 let data;try{data=JSON.parse(text);}catch{throw Error('Повреждённый JSON архива Office');}
 if(!data||data.format!==OFFICE_BACKUP_V3||data.version!==3)
  throw Error('Неподдерживаемый полный архив Office');
 const {manifest,...body}=data;
 if(manifest?.algorithm!=='SHA-256'||manifest?.serialization!=='sorted-json-utf8-v1'||
  !Number.isInteger(manifest.bytes)||!/^[a-f0-9]{64}$/.test(manifest.sha256||''))
  throw Error('Неверный SHA-256 манифест Office');
 const actual=await qoOfficeDigest(body);
 if(actual.bytes!==manifest.bytes||actual.sha256!==manifest.sha256)
  throw Error('Архив Office повреждён: SHA-256 не совпадает');
 const office=decodeOfficeBackup(JSON.stringify(data.office));
 if(office.legacy)throw Error('Внутренний архив редакторов несовместим');
 const bank=await verifyBankBackupV3(data.bank);
 return {office,bank:bank.archive,bankSummary:bank,
  createdAt:data.createdAt,sha256:actual.sha256};
}
