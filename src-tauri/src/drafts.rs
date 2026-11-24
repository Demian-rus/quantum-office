//! Native drafts separate from the task bank. No arbitrary filesystem IPC.
use anyhow::{bail,ensure,Context,Result};
use rusqlite::{params,Connection,OpenFlags,OptionalExtension,TransactionBehavior};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use std::{fs,path::Path,time::Duration,collections::HashSet};
const KEYS:&[&str]=&["quantum-office.workspace.v3","quantum-office.workspace.v3.previous","quantum-office-writer-v1","quantum-office-slides-v1","quantum-studio-task093","quantum-office.work-builder.v1","quantum-office.diagnostic-question-bank.v1","quantum-office.diagnostic-templates.v1","quantum-office.diagnostic-template-versions.v1","quantum-office.diagnostic-workbench.v1","quantum-office.student-hub.source.v1","quantum-office.student-hub.results.v1","quantum-office-theme-v1","quantum-office-accent-v1","qo-studio-colors-v1","quantum-office-last-font-v2","quantum-office-recent-colors-v2"];
const LIMIT:usize=64*1024*1024;
const TOTAL:usize=192*1024*1024;
fn hash(v:&str)->String{format!("{:x}",Sha256::digest(v.as_bytes()))}
fn initialize(path:&Path)->Result<()>{
 let parent=path.parent().context("DRAFT_PATH")?;fs::create_dir_all(parent)?;
 if path.try_exists()?{return Ok(());}
 let tmp=tempfile::Builder::new().prefix(".draft-init-").tempfile_in(parent)?.into_temp_path();
 {
  let c=Connection::open(&tmp)?;
  c.pragma_update(None,"journal_mode","DELETE")?;
  c.pragma_update(None,"synchronous","FULL")?;
  c.execute_batch("BEGIN IMMEDIATE;CREATE TABLE drafts(key TEXT PRIMARY KEY,revision INTEGER NOT NULL CHECK(revision>0),value TEXT,sha256 TEXT, CHECK((value IS NULL AND sha256 IS NULL) OR (value IS NOT NULL AND length(sha256)=64)));CREATE TABLE legacy_sources(key TEXT PRIMARY KEY,value TEXT NOT NULL,sha256 TEXT NOT NULL CHECK(length(sha256)=64));PRAGMA user_version=2;COMMIT;")?;
 }
 fs::OpenOptions::new().write(true).open(&tmp)?.sync_all()?;
 match tmp.persist_noclobber(path){Ok(())=>Ok(()),Err(e) if e.error.kind()==std::io::ErrorKind::AlreadyExists=>Ok(()),Err(e)=>Err(e.into())}
}
fn open(path:&Path)->Result<Connection>{
 initialize(path)?;
 ensure!(fs::metadata(path)?.len()>0,"DRAFT_CORRUPT: empty existing database");
 let c=Connection::open_with_flags(path,OpenFlags::SQLITE_OPEN_READ_WRITE)?;
 c.busy_timeout(Duration::from_secs(10))?;
 let version:i64=c.pragma_query_value(None,"user_version",|r|r.get(0))?;
 if version==1{
  // Earlier unaccepted candidate: migrate non-destructively under write lock.
  c.execute_batch("BEGIN IMMEDIATE;CREATE TABLE IF NOT EXISTS legacy_sources(key TEXT PRIMARY KEY,value TEXT NOT NULL,sha256 TEXT NOT NULL CHECK(length(sha256)=64));PRAGMA user_version=2;COMMIT;")?;
 }else{ensure!(version==2,"DRAFT_SCHEMA: unsupported version");}
 let deadline=std::time::Instant::now()+Duration::from_secs(10);
 loop{
  match c.query_row("PRAGMA journal_mode=WAL",[],|r|r.get::<_,String>(0)){
   Ok(mode) if mode.eq_ignore_ascii_case("wal")=>break,
   Ok(_) if std::time::Instant::now()<deadline=>std::thread::sleep(Duration::from_millis(50)),
   Err(rusqlite::Error::SqliteFailure(e,_)) if matches!(e.code,rusqlite::ErrorCode::DatabaseBusy|rusqlite::ErrorCode::DatabaseLocked)&&std::time::Instant::now()<deadline=>std::thread::sleep(Duration::from_millis(50)),
   Ok(_)=>bail!("DRAFT_SQLITE: WAL unavailable"),Err(e)=>return Err(e.into())
  }
 }
 c.pragma_update(None,"synchronous","FULL")?;Ok(c)
}
pub fn load(path:&Path)->Result<Value>{
 let c=open(path)?;
 let integrity:String=c.query_row("PRAGMA quick_check",[],|r|r.get(0))?;
 ensure!(integrity=="ok","DRAFT_CORRUPT: {}",integrity);
 let mut q=c.prepare("SELECT d.key,d.revision,d.value,d.sha256,l.value,l.sha256 FROM drafts d LEFT JOIN legacy_sources l ON l.key=d.key ORDER BY d.key")?;
 let mut rows=q.query([])?;let mut result=serde_json::Map::new();let mut total=0;
 while let Some(row)=rows.next()?{
  let key:String=row.get(0)?;let revision:i64=row.get(1)?;let value:Option<String>=row.get(2)?;let digest:Option<String>=row.get(3)?;
  ensure!(KEYS.contains(&key.as_str())&&revision>0,"DRAFT_SCHEMA: invalid row");
  ensure!(value.as_deref().map(hash)==digest,"DRAFT_CHECKSUM: {}",key);
  total+=value.as_ref().map_or(0,|v|v.len());ensure!(total<=TOTAL,"DRAFT_LIMIT: total");
  let original:Option<String>=row.get(4)?;let original_sha:Option<String>=row.get(5)?;
  ensure!(original.as_deref().map(hash)==original_sha,"DRAFT_LEGACY_CHECKSUM: {}",key);
  result.insert(key,json!({"revision":revision,"value":value,"sha256":digest,"legacySha256":original_sha}));
 }
 Ok(Value::Object(result))
}
pub fn write(path:&Path,changes:&Value)->Result<Value>{
 let items=changes.as_array().context("DRAFT_REQUEST: array")?;ensure!(!items.is_empty()&&items.len()<=KEYS.len(),"DRAFT_REQUEST: count");
 let mut c=open(path)?;let tx=c.transaction_with_behavior(TransactionBehavior::Immediate)?;
 let mut keys=HashSet::new();let mut result=serde_json::Map::new();
 for item in items{
  let key=item["key"].as_str().context("DRAFT_REQUEST: key")?;
  ensure!(KEYS.contains(&key)&&keys.insert(key),"DRAFT_REQUEST: unknown/duplicate key");
  let revision=item["revision"].as_i64().context("DRAFT_REQUEST: revision")?;
  ensure!(revision>=0,"DRAFT_REQUEST: revision");
  let current:Option<(i64,Option<String>,Option<String>)>=tx.query_row("SELECT revision,value,sha256 FROM drafts WHERE key=?1",[key],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional()?;
  if let Some((_,v,d))=&current{ensure!(v.as_deref().map(hash)==*d,"DRAFT_CHECKSUM: {}",key);}
  ensure!(current.as_ref().map_or(0,|r|r.0)==revision,"DRAFT_CONFLICT: {}",key);
  let value=match item.get("value"){Some(Value::Null)=>None,Some(Value::String(v))=>{ensure!(v.len()<=LIMIT,"DRAFT_LIMIT: {}",key);Some(v.as_str())},_=>bail!("DRAFT_REQUEST: value")};
  let digest=value.map(hash);let next=revision.checked_add(1).context("DRAFT_LIMIT: revision")?;
  if item["migration"]==true{
   ensure!(revision==0&&value.is_some(),"DRAFT_MIGRATION: only absent nonempty keys");
   tx.execute("INSERT INTO legacy_sources(key,value,sha256) VALUES(?1,?2,?3)",params![key,value,digest])?;
  }
  tx.execute("INSERT INTO drafts(key,revision,value,sha256) VALUES(?1,?2,?3,?4) ON CONFLICT(key) DO UPDATE SET revision=excluded.revision,value=excluded.value,sha256=excluded.sha256",params![key,next,value,digest])?;
  result.insert(key,json!({"revision":next,"sha256":digest}));
 }
 let bytes:i64=tx.query_row("SELECT coalesce(sum(length(CAST(value AS BLOB))),0) FROM drafts",[],|r|r.get(0))?;
 ensure!(bytes<=TOTAL as i64,"DRAFT_LIMIT: total");tx.commit()?;
 Ok(Value::Object(result))
}
#[cfg(test)]mod tests{
 use super::*;
 #[test]fn exact_restart_migration_conflict_and_rollback()->Result<()>{
  let d=tempfile::tempdir()?;let p=d.path().join("drafts.sqlite3");let k=KEYS[5];let w=KEYS[2];
  assert_eq!(load(&p)?,json!({}));
  let big=format!("{{\"image\":\"{}\"}}","a".repeat(12*1024*1024));
  write(&p,&json!([{"key":k,"revision":0,"value":big,"migration":true},{"key":w,"revision":0,"value":"writer"}]))?;
  let before=load(&p)?;assert_eq!(before[k]["value"],big);
  assert!(write(&p,&json!([{"key":w,"revision":1,"value":"changed"},{"key":k,"revision":0,"value":"stale"}])).is_err());assert_eq!(load(&p)?,before);
  write(&p,&json!([{"key":k,"revision":1,"value":null}]))?;assert_eq!(load(&p)?[k]["revision"],2);assert!(load(&p)?[k]["value"].is_null());assert_eq!(load(&p)?[k]["legacySha256"],before[k]["sha256"]);
  assert!(write(&p,&json!([{"key":"unknown","revision":0,"value":"bad"}])).is_err());
  let c=open(&p)?;c.execute("UPDATE drafts SET value='damaged' WHERE key=?1",[w])?;assert!(load(&p).is_err());Ok(())
 }
 #[test]fn concurrent_draft_open_and_cas()->Result<()>{
  let d=tempfile::tempdir()?;let p=d.path().join("drafts.sqlite3");let gate=std::sync::Arc::new(std::sync::Barrier::new(4));let mut jobs=vec![];
  for _ in 0..4{let p=p.clone();let gate=gate.clone();jobs.push(std::thread::spawn(move||->Result<bool>{gate.wait();load(&p)?;Ok(write(&p,&json!([{"key":KEYS[0],"revision":0,"value":"one"}])).is_ok())}));}
  let mut winners=0;for job in jobs{if job.join().unwrap()?{winners+=1;}}assert_eq!(winners,1);assert_eq!(load(&p)?[KEYS[0]]["revision"],1);Ok(())
 }
}
