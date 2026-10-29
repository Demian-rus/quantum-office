import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,currentSheet,setCell} from '../src/core/workbook.js';
import {encodeBook} from '../src/core/store.js';
import {DIRECT_FILE_LIMIT,DirectFileConflict,openDirectQBook,readDirectFileText,writeVerifiedQBook} from '../src/core/direct-file.js';

function fixture(name='Проверка'){const b=newWorkbook(name);setCell(currentSheet(b),'A1','Исходное');return b;}
function fakeHandle(initial=''){
 const state={data:initial,writes:0,closed:0,aborted:0,fail:'',onClose:null};
 const handle={
  getFile:async()=>({size:new TextEncoder().encode(state.data).length,text:async()=>state.data}),
  createWritable:async()=>({
   write:async data=>{if(state.fail==='write')throw Error('write failed');state.pending=data;state.writes++;},
   close:async()=>{if(state.fail==='close')throw Error('close failed');state.data=state.pending;state.closed++;if(state.onClose)await state.onClose(state);},
   abort:async()=>{state.aborted++;delete state.pending;}
  })
 };
 return {handle,state};
}

test('open .qbook validates a complete disk snapshot without modifying it',async()=>{
 const original=encodeBook(fixture()),fake=fakeHandle(original);
 const opened=await openDirectQBook(fake.handle);
 assert.equal(opened.text,original);
 assert.equal(opened.book.sheets[0].cells.A1.value,'Исходное');
 assert.equal(fake.state.writes,0);
 const broken=fakeHandle('invalid');
 await assert.rejects(openDirectQBook(broken.handle),/JSON|format|Неверн|Unexpected/);
});

test('verified write reads before and after close and preserves unrelated files',async()=>{
 const b=fixture(),disk=fakeHandle(''),other=fakeHandle('DO NOT CHANGE');
 const saved=await writeVerifiedQBook(disk.handle,'',encodeBook(b));
 assert.equal(disk.state.data,saved);
 assert.equal(disk.state.closed,1);
 setCell(currentSheet(b),'A1','Вторая версия');
 const next=await writeVerifiedQBook(disk.handle,saved,encodeBook(b));
 assert.equal(disk.state.data,next);
 assert.equal(other.state.data,'DO NOT CHANGE');
 assert.equal(disk.state.writes,2);
});

test('concurrent external modification triggers a typed conflict before createWritable',async()=>{
 const first=encodeBook(fixture()),disk=fakeHandle(first);
 disk.state.data=encodeBook(fixture('Внешнее изменение'));
 await assert.rejects(writeVerifiedQBook(disk.handle,first,encodeBook(fixture('Новое'))),DirectFileConflict);
 assert.equal(disk.state.writes,0);
 assert.equal(disk.state.closed,0);
});

test('write and close failures abort without claiming a verified save',async()=>{
 const content=encodeBook(fixture());
 for(const fail of ['write','close']){
  const disk=fakeHandle('');disk.state.fail=fail;
  await assert.rejects(writeVerifiedQBook(disk.handle,'',content),/failed/);
  assert.equal(disk.state.data,'');
  assert.equal(disk.state.aborted,1);
 }
});

test('unexpected post-close bytes do not pass verification',async()=>{
 const disk=fakeHandle('');disk.state.onClose=s=>s.data='OTHER BYTES';
 await assert.rejects(writeVerifiedQBook(disk.handle,'',encodeBook(fixture())),/отличается/);
 assert.equal(disk.state.data,'OTHER BYTES');
});

test('reject invalid, unreadable, oversized and malformed new source before writing',async()=>{
 const disk=fakeHandle('');
 await assert.rejects(writeVerifiedQBook(disk.handle,'','invalid'),/JSON|Unexpected/);
 assert.equal(disk.state.writes,0);
 const bad={getFile:async()=>{throw Error('permission denied');}};
 await assert.rejects(readDirectFileText(bad),/permission denied/);
 const big={getFile:async()=>({size:DIRECT_FILE_LIMIT+1,text:async()=>''})};
 await assert.rejects(readDirectFileText(big),/15 МБ/);
 assert.equal(DIRECT_FILE_LIMIT,15_000_000);
});
