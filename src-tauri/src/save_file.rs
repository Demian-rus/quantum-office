use anyhow::{ensure,Context,Result};
use std::{io::Write,path::Path};
pub fn save_selected(root:&Path,dest:Option<&Path>,bytes:&[u8])->Result<bool>{
 save_with(root,dest,|file|{file.write_all(bytes)?;Ok(())})
}
fn save_with(root:&Path,dest:Option<&Path>,write:impl FnOnce(&mut std::fs::File)->Result<()>)->Result<bool>{
 let Some(dest)=dest else{return Ok(false);};
 let parent=dest.parent().context("SAVE_PATH: Invalid directory")?;
 let actual=parent.canonicalize().context("SAVE_PATH: Недоступная папка")?;
 if root.try_exists()?{let owned=root.canonicalize()?;ensure!(!actual.starts_with(owned),"SAVE_PATH: Выберите папку вне каталога действующей базы");}
 let mut temp=tempfile::NamedTempFile::new_in(&actual).context("SAVE_CREATE: Не удалось создать временный файл")?;
 write(temp.as_file_mut()).context("SAVE_WRITE: Ошибка записи")?;
 temp.as_file().sync_all().context("SAVE_SYNC: Ошибка записи на диск")?;
 temp.persist(actual.join(dest.file_name().context("SAVE_PATH: имя файла")?)).context("SAVE_REPLACE: Не удалось заменить файл")?;
 Ok(true)
}
#[cfg(test)]mod tests{
 use super::*;use std::fs;
 #[test]fn cancel_success_replace_and_failed_write()->Result<()>{
  let d=tempfile::tempdir()?;let root=d.path().join("bank");fs::create_dir(&root)?;let dest=d.path().join("export.qwork");
  assert!(!save_selected(&root,None,b"cancel")?);assert!(!dest.exists());
  assert!(save_selected(&root,Some(&dest),b"old")?);assert_eq!(fs::read(&dest)?,b"old");
  assert!(save_selected(&root,Some(&dest),b"new")?);assert_eq!(fs::read(&dest)?,b"new");
  assert!(save_with(&root,Some(&dest),|f|{f.write_all(b"partial")?;anyhow::bail!("simulated disk full")}).is_err());
  assert_eq!(fs::read(&dest)?,b"new");
  assert!(save_selected(&root,Some(&d.path().join("missing").join("x")),b"x").is_err());
  assert!(save_selected(&root,Some(&root.join("bank.sqlite3")),b"x").is_err());
  let dir=d.path().join("directory");fs::create_dir(&dir)?;assert!(save_selected(&root,Some(&dir),b"x").is_err());assert!(dir.is_dir());
  #[cfg(windows)]{
   let mut permissions=fs::metadata(&dest)?.permissions();permissions.set_readonly(true);fs::set_permissions(&dest,permissions)?;
   let result=save_selected(&root,Some(&dest),b"denied");let mut permissions=fs::metadata(&dest)?.permissions();permissions.set_readonly(false);fs::set_permissions(&dest,permissions)?;
   assert!(result.is_err());assert_eq!(fs::read(&dest)?,b"new");
  }
  Ok(())
 }
}
