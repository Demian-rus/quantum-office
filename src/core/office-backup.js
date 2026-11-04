/* TASK134 — durable, versioned cross-editor backup. Legacy .qbackup remains readable. */
import {validateWorkspace,decodeWorkspace} from './store.js';
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
