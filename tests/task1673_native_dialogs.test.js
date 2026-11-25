import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import ownerModule from './task1673_native_dialogs.cjs';
const {createDialogOwner}=ownerModule;
test('native dialog owner awaits asynchronous handling and records failures',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'qo-dialog-')),file=join(dir,'evidence.json'),context=new EventEmitter(),owner=createDialogOwner(context,file);
 try{
  owner.enable();assert.equal(context.listenerCount('dialog'),1);let release,called=0,completed=false;
  const done=owner.expect('close',true,/^discard$/).then(r=>{completed=true;return r;});
  context.emit('dialog',{type:()=> 'confirm',message:()=> 'discard',accept:()=>{called++;return new Promise(r=>{release=r;});},dismiss:()=>{throw Error('unexpected dismiss');}});
  await Promise.resolve();assert.equal(called,1);assert.equal(completed,false);assert.equal(JSON.parse(readFileSync(file)).records[0].status,'received');
  release();assert.equal((await done).status,'handled');await owner.drain();
  const fail=owner.expect('decline',false,/^discard$/);context.emit('dialog',{type:()=> 'confirm',message:()=> 'discard',dismiss:async()=>{throw Error('CDP rejected');}});
  await assert.rejects(fail,/CDP rejected/);await assert.rejects(owner.drain(),/CDP rejected/);assert.equal(JSON.parse(readFileSync(file)).records[1].status,'FAIL');
 }finally{owner.dispose();assert.equal(context.listenerCount('dialog'),0);rmSync(dir,{recursive:true,force:true});}
});
