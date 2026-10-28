import { validateWorkbook } from './workbook.js';
const blank=()=>({version:3,books:[],active:null});
export function validateWorkspace(data){if(!data||data.version!==3||!Array.isArray(data.books)||data.books.length>300)throw Error('Некорректный архив Quantum Office');const seen=new Set();for(const book of data.books){validateWorkbook(book);if(seen.has(book.id))throw Error('Повторяющийся документ');seen.add(book.id);}return data;}
export function loadWorkspace(storage=globalThis.localStorage){for(const key of [STORE_KEY,PREVIOUS_KEY]){try{const raw=storage.getItem(key);if(raw)return validateWorkspace(JSON.parse(raw));}catch{continue;}}return blank();}
export function saveWorkspace(data,storage=globalThis.localStorage){validateWorkspace(data);const existing=storage.getItem(STORE_KEY);if(existing&&existing!==JSON.stringify(data)){try{storage.setItem(PREVIOUS_KEY,existing);}catch{ /* previous copy is best effort */ }}storage.setItem(STORE_KEY,JSON.stringify(data));}
export function newWorkspace(){return blank();}
export function encodeBook(book){validateWorkbook(book);return JSON.stringify({format:'quantum-office-book-v1',book},null,2);}
export function decodeBook(raw){const value=JSON.parse(raw);if(value?.format!=='quantum-office-book-v1')throw Error('Неподдерживаемый формат .qbook');return validateWorkbook(value.book);}
export function encodeWorkspace(workspace){validateWorkspace(workspace);return JSON.stringify({format:'quantum-office-backup-v1',workspace},null,2);}
export function decodeWorkspace(raw){const value=JSON.parse(raw);if(value?.format!=='quantum-office-backup-v1')throw Error('Неподдерживаемый формат резервной копии');return validateWorkspace(value.workspace);}
