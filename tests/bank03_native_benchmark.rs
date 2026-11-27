//! Copied into src-tauri/tests by BANK-03.1 Windows evidence workflow.
#[path="../src/bank.rs"] mod current;
#[path="bank03_baseline/bank.rs"] mod previous;
use anyhow::Result;
use serde_json::{json,Value};
use std::{path::Path,sync::atomic::AtomicBool,time::Instant};
type Run=fn(&Path,&str,&Value,&AtomicBool)->Result<Value>;
fn timed<T>(f:impl FnOnce()->Result<T>)->Result<(T,f64)>{let t=Instant::now();let v=f()?;Ok((v,t.elapsed().as_secs_f64()*1000.0))}
fn item(i:usize,tagged:bool)->Value{
 let mut r=json!({"id":format!("b{i:05}"),"bankNumber":0,"subject":"physics","grade":"11","exam":"ege","year":if i%2==1{"2027"}else{"2026"},"part":"1","slot":"","difficulty":"","type":"short","topic":if i%4==0{"Электричество"}else{"Механика"},"subtopic":"","origin":"original","task":{"id":format!("q{i}"),"type":"short","figure":"none","image":"","prompt":format!("Синтетическая задача {i}"),"answer":i.to_string(),"comment":format!("Решение {i}"),"criteria":"1 балл"}});
 if tagged{r["examYears"]=if i%2==1{json!([2026,2027])}else{json!([2026])};}r
}
#[test]
fn bank03_native_scale()->Result<()>{
 let dir=tempfile::tempdir()?;let f=AtomicBool::new(false);let mut results=Vec::new();
 for count in [1000,5000,10000]{
  let path=dir.path().join(format!("legacy-{count}.sqlite3"));
  previous::run(&path,"open",&json!({}),&f)?;
  let records=(0..count).map(|i|item(i,false)).collect::<Vec<_>>();
  previous::run(&path,"import",&json!({"records":records,"now":"2026-11-27"}),&f)?;
  let old=previous::run(&path,"snapshot",&json!({}),&f)?;
  current::run(&path,"open",&json!({}),&f)?;
  let migrated=current::run(&path,"snapshot",&json!({}),&f)?;
  assert_eq!(old,migrated,"opening accepted SQLite must not rewrite records");
  assert_eq!(current::run(&path,"list",&json!({"filters":{"examYear":"none"},"offset":0,"limit":30,"includeImages":false}),&f)?["total"],count);
  for (tagged,runner) in [(false,previous::run as Run),(true,current::run as Run)]{
   let path=dir.path().join(format!("{tagged}-{count}.sqlite3"));runner(&path,"open",&json!({}),&f)?;
   let records=(0..count).map(|i|item(i,tagged)).collect::<Vec<_>>();
   runner(&path,"import",&json!({"records":records,"now":"2026-11-27"}),&f)?;
   let list=|filters:Value,offset|runner(&path,"list",&json!({"filters":filters,"offset":offset,"limit":30,"includeImages":false}),&f);
   let (_,catalogue)=timed(||{runner(&path,"open",&json!({}),&f)?;runner(&path,"facets",&json!({"fields":if tagged{vec!["grade","topic","subtopic","year","examYear"]}else{vec!["grade","topic","subtopic","year"]}}),&f)?;list(json!({}),0)})?;
   let (_,origin)=timed(||list(json!({"year":"2027"}),0))?;
   let filters=if tagged{json!({"examYear":"2027"})}else{json!({"year":"2027"})};
   let (matched,year_ms)=timed(||list(filters.clone(),0))?;assert_eq!(matched["total"],count/2);
   let mut combo=filters.clone();combo["subject"]=json!("physics");combo["exam"]=json!("ege");combo["topic"]=json!("Механика");
   let (combined,combined_ms)=timed(||list(combo,0))?;assert_eq!(combined["total"],count/2);
   let (page,page_ms)=timed(||list(filters,30))?;assert_eq!(page["items"][0]["bankNumber"],62);
   let(mut bulk100,mut bulk1000,mut targets_ms)=(None,None,None);
   if tagged{
    let (targets,t)=timed(||runner(&path,"year_targets",&json!({"filters":{"exam":"ege"}}),&f))?;targets_ms=Some(t);
    let (a,t)=timed(||runner(&path,"year_update",&json!({"targets":&targets.as_array().unwrap()[..100],"mode":"add","years":[2028,2029],"now":"2026-11-27"}),&f))?;assert_eq!(a["changed"],100);bulk100=Some(t);
    let next=runner(&path,"year_targets",&json!({"filters":{"exam":"ege"}}),&f)?;
    let (b,t)=timed(||runner(&path,"year_update",&json!({"targets":&next.as_array().unwrap()[..1000],"mode":"add","years":[2030],"now":"2026-11-27"}),&f))?;assert_eq!(b["changed"],1000);bulk1000=Some(t);
   }
   let (_,reopen)=timed(||runner(&path,"open",&json!({}),&f))?;
   if tagged{let last=runner(&path,"get",&json!({"id":"b00000"}),&f)?;assert_eq!(last["bankNumber"],1);assert!(last["examYears"].as_array().unwrap().contains(&json!(2030)));}
   let result=json!({"count":count,"current":tagged,"catalogueOpenMs":catalogue,"originFilterMs":origin,"matchedYearFilterMs":year_ms,"combinedFilterMs":combined_ms,"pageMs":page_ms,"targetsMs":targets_ms,"bulk100Ms":bulk100,"bulk1000Ms":bulk1000,"reopenMs":reopen});
   println!("BANK03_NATIVE_SCALE {}",result);results.push(result);
  }
 }
 assert_eq!(results.len(),6);
 if let Ok(path)=std::env::var("QW_BANK03_NATIVE_REPORT"){std::fs::write(path,serde_json::to_string_pretty(&json!({"status":"PASS","oldDatabaseExact":true,"results":results}))?)?;}
 Ok(())
}
