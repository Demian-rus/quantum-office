/** Browser File System Access operations are explicit and per-workbook.
 * The handle is session-only; never store handles in .qbook or localStorage.
 * Verification is best effort and is NOT an OS fsync or crash-durability proof. */
import {decodeBook} from './store.js';

export const DIRECT_FILE_LIMIT=15_000_000;

export class DirectFileConflict extends Error {
 constructor(){super('Файл на диске изменён с момента открытия или последнего сохранения. Перезапись отменена — выберите «Сохранить как».');this.name='DirectFileConflict';}
}

export async function readDirectFileText(handle){
 if(!handle||typeof handle.getFile!=='function')throw Error('Не удалось получить доступ к файлу на диске');
 const file=await handle.getFile();
 if(!file||!Number.isFinite(file.size)||file.size>DIRECT_FILE_LIMIT)throw Error('Файл превышает допустимые 15 МБ');
 const text=await file.text();
 if(typeof text!=='string')throw Error('Не удалось прочитать файл');
 return text;
}

export async function openDirectQBook(handle){
 const text=await readDirectFileText(handle);
 return {book:decodeBook(text),text};
}

/** Check last read contents before writing, close and read back exactly.
 * If a writer fails, abort it where possible and leave the link's expected
 * content unchanged. No implicit download, retry or forced overwrite.
 * External writes occurring between comparison and close cannot be excluded:
 * true atomic compare-and-swap needs a tested native filesystem backend. */
export async function writeVerifiedQBook(handle,expectedText,serialized){
 if(typeof expectedText!=='string'||typeof serialized!=='string')throw Error('Неверные данные сохранения');
 decodeBook(serialized);
 if(serialized.length>DIRECT_FILE_LIMIT)throw Error('Книга слишком велика для прямого сохранения');
 const existing=await readDirectFileText(handle);
 if(existing!==expectedText)throw new DirectFileConflict();
 if(typeof handle.createWritable!=='function')throw Error('Нет разрешения на запись в файл');
 const writer=await handle.createWritable();
 try{
  await writer.write(serialized);
  await writer.close();
 }catch(error){
  if(typeof writer.abort==='function')try{await writer.abort();}catch{ /* retain original error */ }
  throw error;
 }
 const actual=await readDirectFileText(handle);
 if(actual!==serialized)throw Error('После записи файл отличается от книги. Проверьте файл и сохраните резервную копию — успех не подтверждён.');
 return serialized;
}
