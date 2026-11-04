// Follow the visible Studio File tab before invoking native export controls.
const path=require('node:path');
module.exports=async function download(page,out,action){
 const studio=action==='photo-export'||action==='photo-export-project';
 if(studio)await page.locator('[data-action="workspace-tab"][data-editor="photo"][data-tab="file"]').click();
 try{
  const [file]=await Promise.all([
   page.waitForEvent('download'),
   page.locator(`[data-action="${action}"]:visible`).first().click()
  ]);
  const target=path.join(out,file.suggestedFilename());await file.saveAs(target);return target;
 }finally{
  if(studio)await page.locator('[data-action="workspace-tab"][data-editor="photo"][data-tab="home"]').click();
 }
};
