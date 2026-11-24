#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod bank;
use std::{collections::HashMap,path::PathBuf,sync::{Arc,Mutex,atomic::{AtomicBool,Ordering}},io::Write};
use serde_json::Value;
use tauri::{Manager,State,AppHandle};
use base64::{Engine,engine::general_purpose::STANDARD};
#[derive(Default)]struct Requests(Mutex<HashMap<String,Arc<AtomicBool>>>);
fn path(app:&AppHandle)->Result<PathBuf,String>{Ok(app.path().app_data_dir().map_err(|e|e.to_string())?.join("bank.sqlite3"))}
#[tauri::command]
async fn bank_command(app:AppHandle,requests:State<'_,Requests>,operation:String,payload:Value,request_id:String)->Result<Value,String>{
 if request_id.len()>100{return Err("INVALID_REQUEST: id".into());}
 let file=path(&app)?;let flag=Arc::new(AtomicBool::new(false));
 {let mut map=requests.0.lock().map_err(|_|"SQLITE: lock")?;if map.len()>=128||map.contains_key(&request_id){return Err("BUSY: too many requests".into());}map.insert(request_id.clone(),flag.clone());}
 let result=tauri::async_runtime::spawn_blocking(move||bank::run(&file,&operation,&payload,&flag).map_err(|e|format!("{e:#}"))).await;
 if let Ok(mut map)=requests.0.lock(){map.remove(&request_id);}result.map_err(|e|e.to_string())?
}
#[tauri::command]fn bank_cancel(requests:State<'_,Requests>,request_id:String)->Result<(),String>{if let Some(flag)=requests.0.lock().map_err(|_|"SQLITE: lock")?.get(&request_id){flag.store(true,Ordering::SeqCst);}Ok(())}
#[tauri::command]async fn open_data_folder(app:AppHandle)->Result<(),String>{
 let file=path(&app)?;let dir=file.parent().ok_or("Data directory")?.to_owned();
 tauri::async_runtime::spawn_blocking(move||{std::fs::create_dir_all(&dir).map_err(|e|e.to_string())?;std::process::Command::new("explorer.exe").arg(dir).spawn().map_err(|e|e.to_string())?;Ok(())}).await.map_err(|e|e.to_string())?
}
#[tauri::command]async fn save_export(app:AppHandle,name:String,data:String)->Result<bool,String>{
 let root=app.path().app_data_dir().map_err(|e|e.to_string())?;
 tauri::async_runtime::spawn_blocking(move||{
  if name.is_empty()||name.len()>250||name.chars().any(|c|matches!(c,'\\'|'/'|':'|'\0'))||data.len()>440_000_000{return Err("INVALID_EXPORT: filename or size".into());}
  let bytes=STANDARD.decode(data).map_err(|e|e.to_string())?;
  let Some(dest)=rfd::FileDialog::new().set_file_name(&name).save_file() else{return Ok(false);};
  let parent=dest.parent().ok_or("Invalid directory")?;let actual=parent.canonicalize().map_err(|e|e.to_string())?;
  if let Ok(owned)=root.canonicalize(){if actual.starts_with(owned){return Err("Выберите папку вне каталога действующей базы".into());}}
  let mut temp=tempfile::NamedTempFile::new_in(parent).map_err(|e|e.to_string())?;temp.write_all(&bytes).map_err(|e|e.to_string())?;temp.as_file().sync_all().map_err(|e|e.to_string())?;temp.persist(&dest).map_err(|e|e.to_string())?;Ok(true)
 }).await.map_err(|e|e.to_string())?
}
fn main(){tauri::Builder::default().manage(Requests::default())
 .invoke_handler(tauri::generate_handler![bank_command,bank_cancel,open_data_folder,save_export])
 .run(tauri::generate_context!()).expect("Quantum Office desktop startup failed");}
