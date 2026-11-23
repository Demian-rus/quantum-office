import test from 'node:test';
import assert from 'node:assert/strict';
import {BankRepository,bankSignature,bankSearchMatch,BANK_PAGE_LIMIT}
 from '../src/core/bank-repository.js';

const e={id:'number-1',bankNumber:1807,subject:'physics',grade:'11',exam:'ege',
 year:'2018',part:'1',slot:'7',difficulty:'advanced',type:'short',topic:'Механика',
 subtopic:'Динамика',origin:'original',task:{type:'short',prompt:'Сила \\\\(F=ma\\\\)',answer:'12 Н',
 comment:'Решение',criteria:'2 балла'}};
test('TASK166.1 deterministic search fields preserve EGE bank numbering',()=>{
 assert.ok(bankSearchMatch(e,{}));
 assert.ok(bankSearchMatch(e,{subject:'physics',topic:'Механика',slot:'7',exam:'ege',search:'01807'}));
 assert.ok(bankSearchMatch(e,{search:'12 н'}));
 assert.ok(bankSearchMatch(e,{search:'2 балла'}));
 assert.ok(bankSearchMatch(e,{search:'динАмИкА'}));
 assert.ok(!bankSearchMatch(e,{subject:'math'}));
 assert.ok(!bankSearchMatch(e,{search:'электростатика'}));
 assert.ok(!bankSearchMatch(e,{type:'extended'}));
 assert.equal(bankSignature(e),bankSignature({...e,id:'other-id',bankNumber:8888}));
 assert.notEqual(bankSignature(e),bankSignature({...e,slot:'8'}));
});
test('TASK166.1 browser storage is required, never silently saved in volatile memory',async()=>{
 const repo=new BankRepository({indexedDB:null,legacyStorage:null,normalize:x=>x});
 await assert.rejects(()=>repo.open(),{code:'IDB_UNAVAILABLE'});
 assert.equal(repo.db,null);
 assert.ok(BANK_PAGE_LIMIT<=80);
});

test('TASK166.1 import identity includes full task model, not merely prompt and metadata',()=>{
 const same={...e,task:{...e.task}};
 assert.equal(bankSignature(e),bankSignature(same));
 assert.equal(bankSignature(e),bankSignature({...e,id:'different-id',bankNumber:9999}));
 for(const [key,changed] of [['answer','13 Н'],['comment','Иное решение'],
  ['criteria','3 балла'],['diagram',[{kind:'rect',x:10,y:5,x2:80,y2:90}]],
  ['graph',{points:[{x:1,y:2}]}],['image','data:image/png;base64,YWJj']]){
  assert.notEqual(bankSignature(e),bankSignature({...e,task:{...e.task,[key]:changed}}),
   'must not skip changed '+key);
 }
 assert.equal(bankSignature({...e,task:{...e.task,graph:{y:2,x:1}}}),
  bankSignature({...e,task:{...e.task,graph:{x:1,y:2}}}),
  'object-key order must not create false differences');
 assert.notEqual(bankSignature({...e,topic:'Электродинамика'}),bankSignature(e));
});
test('TASK166.1 inaccessible storage getters do not throw during module initialization',()=>{
 const localDesc=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const idbDesc=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');
 try{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new DOMException('blocked','SecurityError');}});
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,get(){throw new DOMException('blocked','SecurityError');}});
  const repo=new BankRepository();
  assert.equal(repo.factory,null);assert.equal(repo.legacyStorage,null);
 }finally{
  if(localDesc)Object.defineProperty(globalThis,'localStorage',localDesc);else delete globalThis.localStorage;
  if(idbDesc)Object.defineProperty(globalThis,'indexedDB',idbDesc);else delete globalThis.indexedDB;
 }
});
