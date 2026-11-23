import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {BANK_BACKUP_FORMAT,BANK_BACKUP_VERSION,bankStableJSON,createBankBackupV3,
 verifyBankBackupV3,validateBankBackupStructure} from '../src/core/bank-backup.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const record=(id,number,answer='12')=>({
 id,bankNumber:number,revision:3,createdAt:'2026-11-23T01:00:00.000Z',
 updatedAt:'2026-11-23T02:00:00.000Z',subject:'physics',grade:'11',
 topic:'Динамика',type:'graph',
 task:{type:'graph',prompt:'Одинаковая формулировка',answer,
  comment:'### Решение\nF=ma, ответ '+answer,
  criteria:'|Шаг|Баллы|\n|---|---|\n|Формула|1|',
  graph:{points:[{x:0,y:1},{x:4,y:5}]},
  diagram:[{kind:'circle',x:1,y:2}],
  image:'data:image/png;base64,MTIzNA=='}});
const snapshot=()=>({meta:{sequence:999,legacyMigration:null,legacyBackup:null},
 records:[record('a',101),record('b',105,'13')]});
const resign=data=>{
 const {manifest,...body}=data;
 const encoded=bankStableJSON(body);
 return {...body,manifest:{algorithm:'SHA-256',serialization:'sorted-json-utf8-v1',
  bytes:Buffer.byteLength(encoded,'utf8'),sha256:createHash('sha256').update(encoded,'utf8').digest('hex')}};
};
test('TASK166.2 SHA-256 full roundtrip preserves all solution, rubric, graph, diagram and image',async()=>{
 const backup=await createBankBackupV3(snapshot());
 assert.equal(backup.format,BANK_BACKUP_FORMAT);assert.equal(backup.version,BANK_BACKUP_VERSION);
 assert.equal(backup.manifest.sha256.length,64);
 const read=await verifyBankBackupV3(JSON.stringify(backup));
 assert.equal(read.count,2);assert.equal(read.sequence,999);
 assert.deepEqual(read.archive.records.map(x=>x.task),snapshot().records.map(x=>x.task));
});
test('TASK166.2 deterministic JSON independent of property insertion order',async()=>{
 assert.equal(bankStableJSON({z:{y:1,x:2},b:3}),bankStableJSON({b:3,z:{x:2,y:1}}));
 const file=await createBankBackupV3(snapshot());
 assert.equal((await verifyBankBackupV3(resign(file))).sha256,file.manifest.sha256);
});
test('TASK166.2 rejects corrupted JSON, changed byte and false SHA-256',async()=>{
 const b=await createBankBackupV3(snapshot());
 await assert.rejects(()=>verifyBankBackupV3('{ incomplete'),{code:'BACKUP_JSON'});
 const altered=structuredClone(b);altered.records[0].task.answer='CORRUPTED';
 await assert.rejects(()=>verifyBankBackupV3(altered),{code:'BACKUP_CHECKSUM'});
 await assert.rejects(()=>verifyBankBackupV3({...b,manifest:{...b.manifest,sha256:'0'.repeat(64)}}),{code:'BACKUP_CHECKSUM'});
});
test('TASK166.2 rejects count mismatch, duplicate ID or bank number even when signed',async()=>{
 const b=await createBankBackupV3(snapshot());
 const count=structuredClone(b);count.count=3;
 await assert.rejects(()=>verifyBankBackupV3(resign(count)),{code:'BACKUP_COUNT'});
 const ids=structuredClone(b);ids.records[1].id='a';
 await assert.rejects(()=>verifyBankBackupV3(resign(ids)),{code:'BACKUP_DUPLICATE_ID'});
 const nums=structuredClone(b);nums.records[1].bankNumber=101;
 await assert.rejects(()=>verifyBankBackupV3(resign(nums)),{code:'BACKUP_DUPLICATE_NUMBER'});
});
test('TASK166.2 rejects unsupported archive/schema version and invalid sequence',async()=>{
 const b=await createBankBackupV3(snapshot());
 const ver=structuredClone(b);ver.version=4;
 await assert.rejects(()=>verifyBankBackupV3(resign(ver)),{code:'BACKUP_VERSION'});
 const schema=structuredClone(b);schema.schema=9;
 await assert.rejects(()=>verifyBankBackupV3(resign(schema)),{code:'BACKUP_SCHEMA'});
 const seq=structuredClone(b);seq.meta.sequence=5;
 await assert.rejects(()=>verifyBankBackupV3(resign(seq)),{code:'BACKUP_SEQUENCE'});
});

test('TASK166.2 stable ID ordering does not use localeCompare',async()=>{
  const rows=snapshot();
  rows.records[0].id='a-lower';
  rows.records[1].id='Z-upper';
  const backup=await createBankBackupV3(rows);
  assert.deepEqual(backup.records.map(row=>row.id),['Z-upper','a-lower']);
  assert.equal((await verifyBankBackupV3(JSON.stringify(backup))).count,2);
});
