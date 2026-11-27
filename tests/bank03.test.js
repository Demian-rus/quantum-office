import test from 'node:test';
import assert from 'node:assert/strict';
import {bankExamYears,bankValidateExamYears,bankChangeExamYears,createBankBackupV3,verifyBankBackupV3} from '../src/core/bank-backup.js';
import {bankSearchMatch,bankSignature} from '../src/core/bank-repository.js';
import {qwProject,qwValidate} from '../src/core/work-model.js';
const old={id:'a',bankNumber:815,exam:'ege',subject:'physics',year:'2019',task:{type:'short',prompt:'Скорость',answer:'2',criteria:'1',comment:'Решение'}};
test('BANK-03.1 years are explicit, canonical and scoped to exam type',()=>{
 assert.deepEqual(bankExamYears(undefined),[]);
 assert.deepEqual(bankExamYears([2027,1900,2025,2027,2099]),[1900,2025,2027,2099]);
 for(const value of [null,'2027',{},[2027.1],[1899],[2100],['2027'],[null],[true]])assert.throws(()=>bankExamYears(value),{code:'INVALID_EXAM_YEARS'});
 assert.throws(()=>bankValidateExamYears({...old,exam:'general',examYears:[2027]}),{code:'INVALID_EXAM_YEARS'});
 assert.deepEqual(bankChangeExamYears({...old,examYears:[2026]},'add',[2027]),[2026,2027]);
 assert.deepEqual(bankChangeExamYears({...old,examYears:[2026,2027]},'remove',[2026]),[2027]);
 assert.deepEqual(bankChangeExamYears({...old,examYears:[2026]},'replace',[]),[]);
});
test('BANK-03.1 distinct origin/year filters and identity excludes only year tags',()=>{
 assert.ok(bankSearchMatch(old,{year:'2019',examYear:'none'}));
 assert.ok(!bankSearchMatch(old,{examYear:'2019'}));
 const tagged={...old,examYears:[2026,2027]};
 assert.ok(bankSearchMatch(tagged,{exam:'ege',subject:'physics',year:'2019',examYear:'2027',search:'00815'}));
 assert.ok(!bankSearchMatch(tagged,{exam:'oge',examYear:'2027'}));
 assert.ok(!bankSearchMatch(tagged,{examYear:'none'}));
 assert.equal(bankSignature(old),bankSignature(tagged));
 assert.notEqual(bankSignature(old),bankSignature({...tagged,year:'2027'}));
 assert.notEqual(bankSignature(old),bankSignature({...tagged,task:{...tagged.task,criteria:'changed'}}));
});
test('BANK-03.1 QWORK exam model year remains optional and independent of variant',()=>{
 const work={...qwProject(),variant:'2',examYear:2027};
 const result=qwValidate(work);assert.equal(result.variant,'2');assert.equal(result.examYear,2027);
 assert.ok(!Object.hasOwn(qwValidate(qwProject()),'examYear'));
 assert.throws(()=>qwValidate({...work,examYear:'2027'}));
});
test('BANK-03.1 verified archives retain old absence, new years and manifest',async()=>{
 const record={...old,revision:1,createdAt:'2026-01-01',updatedAt:'2026-01-01'};
 const snapshot={records:[record,{...record,id:'b',bankNumber:816,examYears:[2026,2027]}],meta:{sequence:816,legacyMigration:null,legacyBackup:null}};
 const backup=await createBankBackupV3(snapshot);
 const result=await verifyBankBackupV3(backup);assert.deepEqual(result.archive.records,snapshot.records);
 const changed=structuredClone(backup);changed.records[1].examYears=[2027];
 await assert.rejects(()=>verifyBankBackupV3(changed),{code:'BACKUP_CHECKSUM'});
 await assert.rejects(()=>createBankBackupV3({...snapshot,records:[{...record,examYears:[2027,2027]}]}),{code:'INVALID_EXAM_YEARS'});
});
