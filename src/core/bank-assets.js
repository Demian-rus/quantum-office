/* TASK166.3 — internal binary image storage, portable QWORK stays unchanged. */
const BANK_ASSET_STORE='assets';
class BankAssetError extends Error{
 constructor(message,code='ASSET_INVALID'){super(message);this.name='BankAssetError';this.code=code;}
}
function bankAssetBytes(v){if(!(v instanceof ArrayBuffer))throw new BankAssetError('Двоичное изображение повреждено','ASSET_CORRUPT');return new Uint8Array(v);}
function bankAssetB64(bytes){
 let s='';for(let i=0;i<bytes.length;i+=24576)s+=btoa(String.fromCharCode(...bytes.subarray(i,i+24576)));return s;
}
async function bankAssetSHA(bytes){
 if(!globalThis.crypto?.subtle)throw new BankAssetError('SHA-256 недоступен','SHA256_UNAVAILABLE');
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}
function bankAssetSameBytes(a,b){const x=bankAssetBytes(a),y=bankAssetBytes(b);return x.length===y.length&&x.every((v,i)=>v===y[i]);}
function bankAssetValidate(asset,ref){
 if(!asset||!ref||!/^image\/(png|jpeg|webp)$/.test(ref.mime||'')||
 !/^[a-f0-9]{64}$/.test(ref.sha256||'')||ref.key!==ref.mime+':'+ref.sha256||
 asset.key!==ref.key||asset.sha256!==ref.sha256||asset.mime!==ref.mime||
 !Number.isInteger(ref.size)||ref.size<1||asset.size!==ref.size||bankAssetBytes(asset.bytes).length!==ref.size)
 throw new BankAssetError('Вложение отсутствует или повреждено','ASSET_CORRUPT');
}
async function bankAssetPrepareMany(records){
 const cache=new Map(),assets=new Map(),packed=[];
 for(const record of records){
  if(record.imageAsset!==undefined)throw new BankAssetError('Внешняя запись содержит внутреннюю ссылку','ASSET_REFERENCE');
  const url=record.task?.image;
  if(!url){packed.push(record);continue;}
  let prepared=cache.get(url);
  if(!prepared){
   const match=typeof url==='string'&&url.length<=6000000&&/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
   if(!match)throw new BankAssetError('Неверный Base64 или неподдерживаемый формат изображения','ASSET_FORMAT');
   let decoded;try{decoded=atob(match[2]);}catch{throw new BankAssetError('Повреждённый Base64 изображения','ASSET_BASE64');}
   if(!decoded.length)throw new BankAssetError('Изображение пустое','ASSET_BASE64');
   const bytes=Uint8Array.from(decoded,c=>c.charCodeAt(0)),sha256=await bankAssetSHA(bytes);
   const mime=match[1],key=mime+':'+sha256,size=bytes.length,canonical=bankAssetB64(bytes);
   // Preserve exact legacy Base64 spelling, including optional padding.
   const suffix=match[2].slice(canonical.length-4);
   if(canonical.slice(0,-4)!==match[2].slice(0,canonical.length-4))
    throw new BankAssetError('Недопустимое кодирование Base64','ASSET_BASE64');
   prepared={asset:{key,mime,sha256,size,bytes:bytes.buffer},ref:{key,mime,sha256,size,suffix}};
   const prior=assets.get(key);
   if(prior&&!bankAssetSameBytes(prior.bytes,prepared.asset.bytes))throw new BankAssetError('Несовпадение двоичных данных SHA-256','ASSET_COLLISION');
   assets.set(key,prepared.asset);cache.set(url,prepared);
  }
  packed.push({...record,task:{...record.task,image:''},imageAsset:prepared.ref});
 }
 return {records:packed,assets};
}
function bankAssetUnpack(record,assets,urls=new Map()){
 if(!record.imageAsset)return record;
 const ref=record.imageAsset,asset=assets.get(ref.key);bankAssetValidate(asset,ref);
 if(record.task?.image)throw new BankAssetError('Запись содержит две версии изображения','ASSET_REFERENCE');
 const variant=ref.key+'|'+ref.suffix;
 let url=urls.get(variant);
 if(!url){
  const canonical=bankAssetB64(bankAssetBytes(asset.bytes)),suffix=ref.suffix;
  try{if(typeof suffix!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(suffix)||suffix.length>4||atob(suffix)!==atob(canonical.slice(-4)))throw Error();}
  catch{throw new BankAssetError('Повреждена ссылка на изображение','ASSET_CORRUPT');}
  url='data:'+ref.mime+';base64,'+canonical.slice(0,-4)+suffix;urls.set(variant,url);
 }
 const {imageAsset,...portable}=record;
 return {...portable,task:{...record.task,image:url}};
}
async function bankAssetVerifyMap(assets){
 for(const [key,a] of assets){bankAssetValidate(a,{key,mime:a?.mime,sha256:a?.sha256,size:a?.size});
  if(await bankAssetSHA(bankAssetBytes(a.bytes))!==a.sha256)throw new BankAssetError('SHA-256 изображения не совпадает','ASSET_CHECKSUM');}
}
function bankAssetCollect(tx,records,done,fail,assets=new Map()){
 try{
  const keys=[...new Set(records.filter(r=>r?.imageAsset).map(r=>r.imageAsset.key))].filter(k=>!assets.has(k));
  if(!keys.length){done(assets);return;}
  let left=keys.length;
  for(const key of keys){
   const req=tx.objectStore(BANK_ASSET_STORE).get(key);req.onerror=()=>fail(req.error);
   req.onsuccess=()=>{try{if(!req.result)throw new BankAssetError('Изображение недоступно','ASSET_MISSING');
    assets.set(key,req.result);if(!--left)done(assets);}catch(e){fail(e);}};
  }
 }catch(e){fail(e);}
}
function bankAssetWriteSet(tx,assets,fail){
 try{
  const store=tx.objectStore(BANK_ASSET_STORE);
  for(const a of assets.values()){
   const req=store.get(a.key);req.onerror=()=>fail(req.error);
   req.onsuccess=()=>{try{
    if(req.result){bankAssetValidate(req.result,a);if(!bankAssetSameBytes(req.result.bytes,a.bytes))throw new BankAssetError('Несовпадение двоичных данных SHA-256','ASSET_COLLISION');}
    else store.add(a);
   }catch(e){fail(e);}};
  }
 }catch(e){fail(e);}
}
function bankAssetWithoutImage(record){const {imageAsset,...portable}=record;return {...portable,task:{...record.task,image:''}};}
export {BANK_ASSET_STORE,BankAssetError,bankAssetPrepareMany,bankAssetUnpack,bankAssetVerifyMap,bankAssetCollect,bankAssetWriteSet,bankAssetWithoutImage,bankAssetSHA,bankAssetB64,bankAssetValidate};
