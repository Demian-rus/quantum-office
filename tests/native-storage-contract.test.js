import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyNativeStorageContract} from '../scripts/native-storage-contract.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('build native storage contract covers every redirected editor key in both allowlists',()=>{
 const build=read('scripts/build.mjs'),paths=JSON.parse(build.match(/const draftSources=new Set\((\[[^\]]+\])\);/)[1].replaceAll("'",'"'));
 const sources=Object.fromEntries(paths.map(p=>[p,read(p)])),js=read('src/core/native-drafts-bootstrap.js'),rust=read('src-tauri/src/drafts.rs');
 const keys=verifyNativeStorageContract(sources,js,rust);assert.ok(keys.includes('quantum-office.education-panels.v1'));
 const missing=js.replace(',"quantum-office.education-panels.v1"','');assert.throws(()=>verifyNativeStorageContract(sources,missing,rust),/allowlists differ/);
 const missingRust=rust.replace(',"quantum-office.education-panels.v1"','');assert.throws(()=>verifyNativeStorageContract(sources,missing,missingRust),/Missing native storage key/);
 const extra={...sources,'src/core/work-builder.js':sources['src/core/work-builder.js']+"\nlocalStorage.setItem('quantum-office.unregistered.v1','bad');"};
 assert.throws(()=>verifyNativeStorageContract(extra,js,rust),/Missing native storage key/);
});
