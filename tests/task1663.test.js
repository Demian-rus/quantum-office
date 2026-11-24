import test from 'node:test';
import assert from 'node:assert/strict';
import {bankAssetPrepareMany,bankAssetUnpack,bankAssetVerifyMap,bankAssetSHA} from '../src/core/bank-assets.js';
const row=(id,image)=>({id,task:{image,prompt:'Task '+id}});
test('TASK166.3 binary deduplication and exact portable hydration',async()=>{
 const rows=[row('one','data:image/png;base64,YQ=='),row('two','data:image/png;base64,YQ'),row('three','data:image/png;base64,Yg=='),row('text','')];
 const packed=await bankAssetPrepareMany(rows);
 assert.equal(packed.assets.size,2);
 assert.equal(packed.records[0].task.image,'');
 assert.equal(packed.records[0].imageAsset.key,packed.records[1].imageAsset.key);
 assert.equal(packed.records[0].imageAsset.sha256,await bankAssetSHA(new Uint8Array([97])));
 assert.ok([...packed.assets.values()].every(x=>x.bytes instanceof ArrayBuffer));
 await bankAssetVerifyMap(packed.assets);
 assert.deepEqual(packed.records.map(x=>bankAssetUnpack(x,packed.assets)),rows);
});
test('TASK166.3 rejects invalid Base64, MIME and leaked internal refs',async()=>{
 await assert.rejects(()=>bankAssetPrepareMany([row('x','data:image/png;base64,A')]),{code:'ASSET_BASE64'});
 await assert.rejects(()=>bankAssetPrepareMany([row('x','data:image/svg+xml;base64,YQ==')]),{code:'ASSET_FORMAT'});
 await assert.rejects(()=>bankAssetPrepareMany([{...row('x',''),imageAsset:{key:'fake'}}]),{code:'ASSET_REFERENCE'});
});
test('TASK166.3 binary mutation and missing references are detected',async()=>{
 const p=await bankAssetPrepareMany([row('x','data:image/webp;base64,YQ==')]);
 const asset=[...p.assets.values()][0];new Uint8Array(asset.bytes)[0]=98;
 await assert.rejects(()=>bankAssetVerifyMap(p.assets),{code:'ASSET_CHECKSUM'});
 assert.throws(()=>bankAssetUnpack(p.records[0],new Map()),{code:'ASSET_CORRUPT'});
});
