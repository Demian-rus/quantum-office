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
