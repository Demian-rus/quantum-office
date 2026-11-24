use anyhow::{anyhow,bail,ensure,Context,Result};
use base64::{engine::{general_purpose::{STANDARD,GeneralPurpose,GeneralPurposeConfig},DecodePaddingMode},Engine};
use rusqlite::{params,params_from_iter,Connection,OpenFlags,OptionalExtension,TransactionBehavior};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use std::{fs,path::{Path,PathBuf},sync::atomic::{AtomicBool,Ordering},time::Duration};
const FILTERS:[&str;11]=["subject","grade","exam","year","part","slot","difficulty","type","topic","subtopic","origin"];
fn sha(b:&[u8])->String{format!("{:x}",Sha256::digest(b))}
fn decoder()->GeneralPurpose{GeneralPurpose::new(&base64::alphabet::STANDARD,GeneralPurposeConfig::new().with_decode_allow_trailing_bits(true).with_decode_padding_mode(DecodePaddingMode::Indifferent))}
fn s<'a>(v:&'a Value,k:&str)->Result<&'a str>{v.get(k).and_then(Value::as_str).ok_or_else(||anyhow!("INVALID_RECORD: {}",k))}
fn n(v:&Value,k:&str)->Result<i64>{v.get(k).and_then(Value::as_i64).ok_or_else(||anyhow!("INVALID_RECORD: {}",k))}
fn cancel(f:&AtomicBool)->Result<()>{ensure!(!f.load(Ordering::SeqCst),"CANCELLED: Операция отменена");Ok(())}
fn meta(c:&Connection,k:&str)->Result<Value>{let x:String=c.query_row("SELECT value FROM meta WHERE key=?1",[k],|r|r.get(0))?;Ok(serde_json::from_str(&x)?)}
fn set(c:&Connection,k:&str,v:&Value)->Result<()>{c.execute("INSERT INTO meta(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",params![k,v.to_string()])?;Ok(())}
fn gen(c:&Connection)->Result<i64>{meta(c,"generation")?.as_i64().context("CORRUPT: generation")}
pub fn open(path:&Path,create:bool)->Result<Connection>{
 if create{fs::create_dir_all(path.parent().context("data directory")?)?;}
 let existed=path.exists();
 if existed{ensure!(fs::metadata(path)?.len()>0,"CORRUPT: Пустой файл существующей базы");}
 let flags=OpenFlags::SQLITE_OPEN_READ_WRITE|if create{OpenFlags::SQLITE_OPEN_CREATE}else{OpenFlags::empty()};
 let mut c=Connection::open_with_flags(path,flags)?;
 c.busy_timeout(Duration::from_secs(10))?;c.pragma_update(None,"foreign_keys",true)?;
 let version:i64=c.pragma_query_value(None,"user_version",|r|r.get(0))?;
 if version==0{
  ensure!(create&&!existed,"SCHEMA: Неизвестная существующая база; файл сохранён");
  let tx=c.transaction_with_behavior(TransactionBehavior::Immediate)?;
  let version:i64=tx.pragma_query_value(None,"user_version",|r|r.get(0))?;
  if version==0{tx.execute_batch(include_str!("schema.sql"))?;}else{ensure!(version==1,"SCHEMA: unsupported");}
  tx.commit()?;
 }else{ensure!(version==1,"SCHEMA: Неподдерживаемая версия {}",version);}
 if create{
  let quick:String=c.query_row("PRAGMA quick_check",[],|r|r.get(0))?;
  ensure!(quick=="ok","CORRUPT: {}",quick);
  let bad:i64=c.query_row("SELECT count(*) FROM pragma_foreign_key_check",[],|r|r.get(0))?;
  ensure!(bad==0,"CORRUPT: foreign keys");
 }
 let mode:String=c.query_row("PRAGMA journal_mode=WAL",[],|r|r.get(0))?;ensure!(mode.eq_ignore_ascii_case("wal"),"SQLITE: WAL unavailable");
 c.pragma_update(None,"synchronous","FULL")?;Ok(c)
}
struct Asset{key:String,mime:String,hash:String,bytes:Vec<u8>,suffix:String}
fn pack(mut r:Value)->Result<(Value,Option<Asset>)>{
 ensure!(r.is_object()&&r.get("imageAsset").is_none(),"INVALID_RECORD: object");
 let id=s(&r,"id")?;ensure!(!id.trim().is_empty()&&id.encode_utf16().count()<=80,"INVALID_RECORD: id");
 let task=r.get("task").and_then(Value::as_object).context("INVALID_RECORD: task")?;
 for k in ["prompt","answer","comment","criteria","type","figure","image"]{let x=task.get(k).and_then(Value::as_str).context("INVALID_RECORD: field")?;ensure!(x.len()<=if k=="image"{6_000_000}else{64_000},"INVALID_RECORD: length");}
 for k in FILTERS{ensure!(s(&r,k)?.len()<=512,"INVALID_RECORD: metadata");}
 ensure!(r["type"]==r["task"]["type"],"INVALID_RECORD: type");
 let url=s(&r["task"],"image")?;
 let a=if url.is_empty(){ensure!(r["task"]["figure"]!="image","ASSET_MISSING: Пустое изображение");None}else{
  let (prefix,body)=url.split_once(";base64,").context("ASSET_FORMAT: Base64")?;
  let mime=prefix.strip_prefix("data:").context("ASSET_FORMAT: MIME")?;
  ensure!(["image/png","image/jpeg","image/webp"].contains(&mime),"ASSET_FORMAT: MIME");
  let bytes=decoder().decode(body)?;ensure!(!bytes.is_empty()&&bytes.len()<=4_500_000,"ASSET_SIZE: image");
  let canonical=STANDARD.encode(&bytes);let split=canonical.len().saturating_sub(4);
  ensure!(body.len()>=split&&body.is_ascii()&&body[..split]==canonical[..split],"ASSET_FORMAT: spelling");
  if r["task"]["figure"]=="image"{
   let format=image::guess_format(&bytes)?;
   let expected=match mime{"image/png"=>image::ImageFormat::Png,"image/jpeg"=>image::ImageFormat::Jpeg,_=>image::ImageFormat::WebP};
   ensure!(format==expected,"ASSET_RASTER: MIME mismatch");
   let mut reader=image::ImageReader::with_format(std::io::Cursor::new(&bytes),format);
   let mut limits=image::Limits::default();limits.max_image_width=Some(16000);limits.max_image_height=Some(16000);limits.max_alloc=Some(256*1024*1024);reader.limits(limits);
   reader.decode().context("ASSET_RASTER: invalid image")?;
  }
  let hash=sha(&bytes);Some(Asset{key:format!("{}:{}",mime,hash),mime:mime.into(),hash,bytes,suffix:body[split..].into()})
 };
 r["task"]["image"]=json!("");ensure!(r.to_string().len()<=2_000_000,"INVALID_RECORD: too large");Ok((r,a))
}
fn signature(r:&Value,a:Option<&Asset>)->String{let mut v=r.clone();if let Some(o)=v.as_object_mut(){for k in ["id","bankNumber","revision","createdAt","updatedAt"]{o.remove(k);}}sha(json!([v,a.map(|x|(&x.key,&x.suffix))]).to_string().as_bytes())}
fn store(c:&Connection,a:&Asset)->Result<()>{
 c.execute("INSERT OR IGNORE INTO assets(key,mime,sha256,size,bytes) VALUES(?1,?2,?3,?4,?5)",params![a.key,a.mime,a.hash,a.bytes.len() as i64,a.bytes])?;
 let old:(String,String,i64,Vec<u8>)=c.query_row("SELECT mime,sha256,size,bytes FROM assets WHERE key=?1",[&a.key],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?)))?;
 ensure!(old.0==a.mime&&old.1==a.hash&&old.2==a.bytes.len() as i64&&old.3==a.bytes,"ASSET_COLLISION: stored bytes differ");Ok(())
}
fn write(c:&Connection,r:&Value,a:Option<&Asset>,update:bool)->Result<()>{
 let id=s(r,"id")?;let number=n(r,"bankNumber")?;let rev=n(r,"revision")?;
 ensure!((1..=99999).contains(&number)&&rev>0,"INVALID_RECORD: allocation");
 let created=s(r,"createdAt")?;let updated=s(r,"updatedAt")?;ensure!(created.len()<=80&&updated.len()<=80,"INVALID_RECORD: timestamp");
 let fields=[format!("{number:05}"),number.to_string(),s(&r["task"],"prompt")?.into(),s(&r["task"],"answer")?.into(),s(&r["task"],"comment")?.into(),s(&r["task"],"criteria")?.into(),s(r,"topic")?.into(),s(r,"subtopic")?.into(),s(r,"grade")?.into()];
 let search=fields.join("\n").to_lowercase();let sig=signature(r,a);if let Some(a)=a{store(c,a)?;}
 if update{
  c.execute("UPDATE tasks SET number=?2,revision=?3,created_at=?4,updated_at=?5,body=?6,search_text=?7,signature=?8 WHERE id=?1",params![id,number,rev,created,updated,r.to_string(),search,sig])?;
  c.execute("DELETE FROM task_assets WHERE task_id=?1",[id])?;
 }else{c.execute("INSERT INTO tasks(id,number,revision,created_at,updated_at,body,search_text,signature) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)",params![id,number,rev,created,updated,r.to_string(),search,sig])?;}
 if let Some(a)=a{c.execute("INSERT INTO task_assets(task_id,role,asset_key,suffix) VALUES(?1,'image',?2,?3)",params![id,a.key,a.suffix])?;}Ok(())
}
fn hydrate(c:&Connection,mut r:Value)->Result<Value>{
 let id=s(&r,"id")?;
 let row=c.query_row("SELECT a.key,a.mime,a.sha256,a.size,a.bytes,t.suffix FROM task_assets t JOIN assets a ON a.key=t.asset_key WHERE t.task_id=?1 AND t.role='image'",[id],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,i64>(3)?,r.get::<_,Vec<u8>>(4)?,r.get::<_,String>(5)?))).optional()?;
 if let Some((key,mime,hash,size,bytes,suffix))=row{
  ensure!(key==format!("{}:{}",mime,hash)&&size==bytes.len() as i64&&sha(&bytes)==hash,"ASSET_CHECKSUM: повреждённое вложение");
  let encoded=STANDARD.encode(&bytes);let split=encoded.len().saturating_sub(4);
  ensure!(suffix.len()<=4&&decoder().decode(&suffix)?==decoder().decode(&encoded[split..])?,"ASSET_CORRUPT: suffix");
  r["task"]["image"]=json!(format!("data:{};base64,{}{}",mime,&encoded[..split],suffix));
 }else{ensure!(r["task"]["figure"]!="image","ASSET_MISSING: Изображение недоступно");}Ok(r)
}
fn get(c:&Connection,id:&str,images:bool)->Result<Option<Value>>{let body:Option<String>=c.query_row("SELECT body FROM tasks WHERE id=?1",[id],|r|r.get(0)).optional()?;body.map(|x|{let v=serde_json::from_str(&x)?;if images{hydrate(c,v)}else{Ok(v)}}).transpose()}
fn count(c:&Connection)->Result<i64>{Ok(c.query_row("SELECT count(*) FROM tasks",[],|r|r.get(0))?)}
fn rows(c:&Connection,sql:&str,args:&[rusqlite::types::Value],images:bool,f:&AtomicBool)->Result<Vec<Value>>{
 let mut st=c.prepare(sql)?;let mut q=st.query(params_from_iter(args.iter()))?;let mut out=Vec::new();
 while let Some(r)=q.next()?{cancel(f)?;let x:String=r.get(0)?;let v=serde_json::from_str(&x)?;out.push(if images{hydrate(c,v)?}else{v});}Ok(out)
}
fn snapshot(c:&Connection,f:&AtomicBool)->Result<Value>{Ok(json!({"records":rows(c,"SELECT body FROM tasks ORDER BY id",&[],true,f)?,"meta":{"sequence":meta(c,"sequence")?,"legacyMigration":meta(c,"legacyMigration")?,"legacyBackup":meta(c,"legacyBackup")?},"generation":gen(c)?}))}
fn next(c:&Connection)->Result<i64>{Ok(meta(c,"sequence")?.as_i64().context("CORRUPT: sequence")?.max(c.query_row("SELECT coalesce(max(number),0) FROM tasks",[],|r|r.get(0))?))}
fn alloc(r:&mut Value,n:i64,rev:i64,created:&str,now:&str){r["bankNumber"]=json!(n);r["revision"]=json!(rev);r["createdAt"]=json!(created);r["updatedAt"]=json!(now);}
fn backup(c:&Connection,path:&Path)->Result<PathBuf>{
 let dir=path.parent().context("data path")?.join("snapshots");fs::create_dir_all(&dir)?;
 let dest=dir.join(format!("bank-{}.sqlite3",uuid::Uuid::new_v4()));
 let result=(||->Result<()>{c.execute("VACUUM INTO ?1",[dest.to_str().context("backup path")?])?;let check=Connection::open_with_flags(&dest,OpenFlags::SQLITE_OPEN_READ_ONLY)?;let integrity:String=check.query_row("PRAGMA quick_check",[],|r|r.get(0))?;ensure!(integrity=="ok","BACKUP_INVALID: native snapshot");fs::OpenOptions::new().write(true).open(&dest)?.sync_all()?;Ok(())})();
 if let Err(e)=result{let _=fs::remove_file(&dest);return Err(e);}
 let mut old:Vec<_>=fs::read_dir(&dir)?.filter_map(|e|e.ok()).filter(|e|e.path()!=dest&&e.file_name().to_string_lossy().starts_with("bank-")&&e.path().extension().and_then(|x|x.to_str())==Some("sqlite3")).collect();old.sort_by_key(|e|e.metadata().and_then(|m|m.modified()).ok());
 let remove=old.len().saturating_sub(2);for e in old.into_iter().take(remove){let _=fs::remove_file(e.path());}Ok(dest)
}
pub fn run(path:&Path,op:&str,p:&Value,f:&AtomicBool)->Result<Value>{
 cancel(f)?;ensure!(p.is_object(),"INVALID_REQUEST: payload");
 let mut conn=open(path,op=="open")?;
 if op=="open"{return Ok(json!({"storage":"SQLite"}));}
 if op=="native_backup"{return Ok(json!({"path":backup(&conn,path)?}));}
 if op=="restore"&&p["mode"]=="replace"{backup(&conn,path)?;}
 let writable=matches!(op,"create"|"update"|"delete"|"import"|"restore")||(op=="diagnostics"&&p["clean"]==true);
 let tx=conn.transaction_with_behavior(if writable{TransactionBehavior::Immediate}else{TransactionBehavior::Deferred})?;let c=&*tx;
 let result=match op{
  "state"=>json!({"generation":gen(c)?,"count":count(c)?}),
  "statistics"=>{let bytes=fs::metadata(path)?.len()+fs::metadata(format!("{}-wal",path.display())).map(|m|m.len()).unwrap_or(0);json!({"count":count(c)?,"storage":"SQLite","path":path,"estimatedBytes":bytes,"migration":"none","assetMigrationError":null,"lastBackupAt":null})},
  "snapshot"=>snapshot(c,f)?,
  "metadata"=>{ensure!(count(c)?<=500,"LIMIT: metadata");json!(rows(c,"SELECT body FROM tasks ORDER BY number",&[],false,f)?)},
  "get"=>get(c,s(p,"id")?,true)?.unwrap_or(Value::Null),
  "facets"=>{let mut result=serde_json::Map::new();for k in p["fields"].as_array().context("INVALID_REQUEST: fields")?{let k=k.as_str().context("INVALID_REQUEST: field")?;if !FILTERS.contains(&k){continue;}let sql=format!("SELECT DISTINCT json_extract(body,'$.{}') AS val FROM tasks WHERE val IS NOT NULL AND val!='' ORDER BY val",k);let mut st=c.prepare(&sql)?;let vals=st.query_map([],|r|r.get::<_,String>(0))?.collect::<rusqlite::Result<Vec<_>>>()?;result.insert(k.into(),json!(vals));}Value::Object(result)},
  "list"=>{
   let filters=p["filters"].as_object().context("INVALID_REQUEST: filters")?;let mut clauses=vec!["1=1".to_owned()];let mut args:Vec<rusqlite::types::Value>=Vec::new();
   for k in FILTERS{if let Some(v)=filters.get(k).and_then(Value::as_str){if !v.is_empty()&&v!="all"{clauses.push(format!("json_extract(body,'$.{}')=?",k));args.push(v.to_owned().into());}}}
   if let Some(term)=filters.get("search").and_then(Value::as_str){if !term.trim().is_empty(){clauses.push("instr(search_text,?)>0".into());args.push(term.trim().to_lowercase().into());}}
   let cond=clauses.join(" AND ");let total:i64=c.query_row(&format!("SELECT count(*) FROM tasks WHERE {cond}"),params_from_iter(args.iter()),|r|r.get(0))?;
   let offset=n(p,"offset")?.clamp(0,100000);let limit=n(p,"limit")?.clamp(1,80);args.push(limit.into());args.push(offset.into());
   let items=rows(c,&format!("SELECT body FROM tasks WHERE {cond} ORDER BY number LIMIT ? OFFSET ?"),&args,p["includeImages"]!=false,f)?;
   json!({"total":total,"offset":offset,"limit":limit,"hasMore":offset+(items.len() as i64)<total,"items":items})
  },
  "create"|"update"=>{
   let (mut r,a)=pack(p["record"].clone())?;let id=s(&r,"id")?.to_owned();let now=s(p,"now")?;
   if op=="create"{ensure!(get(c,&id,false)?.is_none(),"DUPLICATE_ID: existing");let seq=next(c)?+1;alloc(&mut r,seq,1,now,now);set(c,"sequence",&json!(seq))?;}
   else{let old=get(c,&id,false)?.context("NOT_FOUND: Запись удалена")?;ensure!(n(p,"revision")?==n(&old,"revision")?,"REVISION_CONFLICT: Задание изменено");alloc(&mut r,n(&old,"bankNumber")?,n(&old,"revision")?.checked_add(1).context("revision overflow")?,s(&old,"createdAt")?,now);}
   write(c,&r,a.as_ref(),op=="update")?;hydrate(c,r)?
  },
  "delete"=>{let id=s(p,"id")?;let old=get(c,id,true)?.context("NOT_FOUND: Запись удалена")?;ensure!(p["revision"].is_null()||n(p,"revision")?==n(&old,"revision")?,"REVISION_CONFLICT: Запись изменена");c.execute("DELETE FROM tasks WHERE id=?1",[id])?;old},
  "import"=>{
   let input=p["records"].as_array().context("INVALID_REQUEST: records")?;ensure!(input.len()<=20000,"LIMIT: import");
   let now=s(p,"now")?;let mut seq=next(c)?;let(mut imported,mut skipped)=(0,0);
   for v in input{cancel(f)?;let(mut r,a)=pack(v.clone())?;let sig=signature(&r,a.as_ref());
    let found:bool=c.query_row("SELECT EXISTS(SELECT 1 FROM tasks WHERE signature=?1)",[sig],|r|r.get(0))?;if found{skipped+=1;continue;}
    let requested=r["bankNumber"].as_i64().unwrap_or(0);seq=if requested>seq&&requested<=99999{requested}else{seq+1};ensure!(seq<=99999,"BANK_NUMBERS_EXHAUSTED: limit");
    let id=s(&r,"id")?.to_owned();if get(c,&id,false)?.is_some(){r["id"]=json!(format!("b{}",uuid::Uuid::new_v4()));}
    alloc(&mut r,seq,1,now,now);write(c,&r,a.as_ref(),false)?;imported+=1;
   }
   set(c,"sequence",&json!(seq))?;json!({"imported":imported,"skipped":skipped})
  },
  "restore"=>{
   ensure!(gen(c)?==n(p,"generation")?,"RESTORE_CONFLICT: Банк изменился");
   let mode=s(p,"mode")?;ensure!(mode=="replace"||mode=="empty"&&count(c)?==0,"RESTORE_MODE: mode");
   let canonical=s(p,"canonical")?;ensure!(canonical.len()<=260_000_000&&sha(canonical.as_bytes())==s(p,"sha256")?,"BACKUP_CHECKSUM: SHA-256");
   let body:Value=serde_json::from_str(canonical)?;ensure!(body["format"]=="quantum-work-bank-backup"&&body["version"]==3&&body["schema"]==1,"BACKUP_FORMAT: version");
   let input=body["records"].as_array().context("BACKUP_FORMAT: rows")?;ensure!(input.len()<=20000&&n(&body,"count")?==input.len() as i64,"BACKUP_COUNT: count");
   let seq=n(&body["meta"],"sequence")?;ensure!((0..=99999).contains(&seq),"BACKUP_SEQUENCE: sequence");
   c.execute("DELETE FROM tasks",[])?;c.execute("DELETE FROM assets",[])?;
   for v in input{cancel(f)?;let(r,a)=pack(v.clone())?;ensure!(n(&r,"bankNumber")?<=seq,"BACKUP_SEQUENCE: number");write(c,&r,a.as_ref(),false)?;ensure!(get(c,s(&r,"id")?,true)?.as_ref()==Some(v),"RESTORE_VERIFY: row mismatch");}
   for k in ["sequence","legacyMigration","legacyBackup"]{set(c,k,&body["meta"][k])?;}
   ensure!(count(c)?==input.len() as i64,"RESTORE_VERIFY: count");json!({"restored":input.len(),"sequence":seq,"verified":true})
  },
  "diagnostics"=>{
   let bad:i64=c.query_row("SELECT count(*) FROM pragma_foreign_key_check",[],|r|r.get(0))?;ensure!(bad==0,"ASSET_MISSING: invalid links");
   let(num,bytes):(i64,i64)=c.query_row("SELECT count(*),coalesce(sum(size),0) FROM assets",[],|r|Ok((r.get(0)?,r.get(1)?)))?;
   let refs:i64=c.query_row("SELECT count(*) FROM task_assets",[],|r|r.get(0))?;
   let (orphans,orphan_bytes):(i64,i64)=c.query_row("SELECT count(*),coalesce(sum(size),0) FROM assets a WHERE NOT EXISTS(SELECT 1 FROM task_assets t WHERE t.asset_key=a.key)",[],|r|Ok((r.get(0)?,r.get(1)?)))?;
   let deleted=if p["clean"]==true{c.execute("DELETE FROM assets WHERE NOT EXISTS(SELECT 1 FROM task_assets WHERE asset_key=assets.key)",[])?}else{0};
   json!({"count":num,"bytes":bytes,"references":refs,"orphans":orphans,"orphanBytes":orphan_bytes,"deleted":deleted,"inline":0})
  },
  _=>bail!("INVALID_REQUEST: unknown operation")
 };
 cancel(f)?;if writable{set(c,"generation",&json!(gen(c)?.checked_add(1).context("generation overflow")?))?;}tx.commit()?;Ok(result)
}
#[cfg(test)]mod tests{
 use super::*;
 fn record(id:&str)->Value{json!({"id":id,"bankNumber":0,"subject":"physics","grade":"8","exam":"general","year":"","part":"","slot":"","difficulty":"","type":"short","topic":"Механика","subtopic":"","origin":"original","task":{"id":id,"type":"short","figure":"none","image":"","prompt":"Скорость","answer":"2","comment":"решение","criteria":"1"}})}
 #[test]fn persistence_cas_and_rollback()->Result<()>{
  let d=tempfile::tempdir()?;let p=d.path().join("bank.sqlite3");let f=AtomicBool::new(false);
  run(&p,"open",&json!({}),&f)?;let a=run(&p,"create",&json!({"record":record("a"),"now":"2026-11-24"}),&f)?;assert_eq!(a["bankNumber"],1);assert_eq!(run(&p,"get",&json!({"id":"a"}),&f)?,a);
  let b=run(&p,"update",&json!({"record":record("a"),"revision":1,"now":"2026-11-24"}),&f)?;assert_eq!(b["revision"],2);
  assert!(run(&p,"update",&json!({"record":record("a"),"revision":1,"now":"2026-11-24"}),&f).is_err());
  let before=run(&p,"snapshot",&json!({}),&f)?;assert!(run(&p,"import",&json!({"records":[record("b"),{}],"now":"2026-11-24"}),&f).is_err());assert_eq!(run(&p,"snapshot",&json!({}),&f)?,before);
  run(&p,"delete",&json!({"id":"a","revision":2}),&f)?;let c=run(&p,"create",&json!({"record":record("c"),"now":"2026-11-24"}),&f)?;assert_eq!(c["bankNumber"],2);
  assert_eq!(run(&p,"list",&json!({"filters":{"search":"скорость"},"offset":0,"limit":30,"includeImages":false}),&f)?["total"],1);
  let snap=run(&p,"native_backup",&json!({}),&f)?;assert!(Path::new(snap["path"].as_str().unwrap()).is_file());Ok(())
 }
 #[test]fn corrupt_file_is_not_replaced()->Result<()>{let d=tempfile::tempdir()?;let p=d.path().join("bank.sqlite3");fs::write(&p,b"not SQLite")?;assert!(open(&p,true).is_err());assert_eq!(fs::read(&p)?,b"not SQLite");Ok(())}
 #[test]fn shared_binary_restore()->Result<()>{
  let d=tempfile::tempdir()?;let p=d.path().join("bank.sqlite3");let q=d.path().join("other.sqlite3");let f=AtomicBool::new(false);run(&p,"open",&json!({}),&f)?;run(&q,"open",&json!({}),&f)?;
  let mut a=record("a");a["task"]["image"]=json!("data:image/png;base64,YWJj");let mut b=a.clone();b["id"]=json!("b");b["task"]["id"]=json!("b");
  for r in [a,b]{run(&p,"create",&json!({"record":r,"now":"2026-11-24"}),&f)?;}
  let diag=run(&p,"diagnostics",&json!({}),&f)?;assert_eq!(diag["count"],1);assert_eq!(diag["references"],2);
  let snap=run(&p,"snapshot",&json!({}),&f)?;let body=json!({"format":"quantum-work-bank-backup","version":3,"schema":1,"count":2,"records":snap["records"],"meta":snap["meta"]}).to_string();let digest=sha(body.as_bytes());
  run(&q,"restore",&json!({"canonical":body,"sha256":digest,"mode":"empty","generation":0}),&f)?;
  let restored=run(&q,"snapshot",&json!({}),&f)?;assert_eq!(restored["records"],snap["records"]);assert_eq!(restored["meta"],snap["meta"]);
  run(&p,"delete",&json!({"id":"a","revision":1}),&f)?;assert_eq!(run(&p,"diagnostics",&json!({"clean":true}),&f)?["deleted"],0);
  run(&p,"delete",&json!({"id":"b","revision":1}),&f)?;assert_eq!(run(&p,"diagnostics",&json!({"clean":true}),&f)?["deleted"],1);Ok(())
 }
}
