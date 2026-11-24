import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
// Exercise the actual frontend functions with controlled native dialog outcomes.
// This is a UI acknowledgement test, not a claim of physical Windows writes.
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const work=readFileSync(new URL('../src/core/work-builder.js',import.meta.url),'utf8');
const download=main.split('\n').find(l=>l.startsWith('function download('));
const save=work.split('\n').find(l=>l.startsWith('async function qwSaveFile('));
assert.ok(download&&save);
test('TASK166.4 native download and QWORK do not acknowledge before confirmed write',async()=>{
 const messages=[];let resolve;
 const context=vm.createContext({Blob,qoNativeDesktop:true,status:(...args)=>messages.push(args),qwValidate:x=>x,qwDoc:{title:'draft',tasks:[]},qwExported:'prior',qwPersist:()=>{},safeFile:s=>s,qoNativeSave:()=>new Promise(r=>{resolve=r;})});
 vm.runInContext(download+'\n'+save,context);
 let pending=context.qwSaveFile();
 assert.equal(context.qwExported,'prior');assert.deepEqual(messages,[]);
 resolve(false);await pending;assert.equal(context.qwExported,'prior');assert.match(messages.at(-1)[0],/отменено/i);
 context.qoNativeSave=async()=>{throw Error('Access denied');};
 await context.qwSaveFile();assert.equal(context.qwExported,'prior');assert.match(messages.at(-1)[0],/не сохранён.*Access denied/);
 context.qoNativeSave=async()=>true;
 await context.qwSaveFile();assert.equal(context.qwExported,JSON.stringify(context.qwDoc));assert.match(messages.at(-1)[0],/Файл сохранён/);
 context.qoNativeSave=()=>new Promise(r=>{resolve=r;});
 pending=context.qwSaveFile();context.qwDoc.title='changed during save';resolve(true);await pending;
 assert.notEqual(context.qwExported,JSON.stringify(context.qwDoc));
});
test('TASK166.4 browser download remains a request not confirmation',()=>{
 const messages=[];let clicks=0;const anchor={click(){clicks++;},remove(){}};
 const context=vm.createContext({Blob,qoNativeDesktop:false,status:(...args)=>messages.push(args),URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},document:{createElement:()=>anchor,body:{append(){}}},setTimeout:()=>{}});
 vm.runInContext(download,context);assert.equal(context.download('test.csv','a','text/csv'),undefined);assert.equal(clicks,1);assert.equal(anchor.download,'test.csv');assert.match(messages.at(-1)[0],/Скачивание запрошено/);
});
