const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1366,height:768},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../Quantum-Office.html')).href);
  for(const kind of ['sheet','writer','slides','photo']){
   await page.evaluate(kind=>route(kind),kind);
   const dims=await page.evaluate(()=>{
    const bar=document.querySelector('.ribbon,.qo-office-toolbar'),
     tabs=document.querySelector('.qo-work-tabs'),content=document.querySelector('.qo-work-ribbon');
    return {bar:bar?.offsetHeight,tabs:tabs?.offsetHeight,content:content?.offsetHeight,
     overflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert.equal(dims.bar,109,kind+' ribbon total height');
   assert.equal(dims.overflow,false,kind+' body width');
   if(kind!=='sheet'){assert.equal(dims.tabs,30);assert.equal(dims.content,78);}
  }
  assert.equal(await page.locator('.qo-work-tab[data-editor="photo"]').count(),2);
  assert.equal(await page.locator('[data-action="photo-brush-tool"]').count(),1);
  await page.locator('.qo-work-tab[data-editor="photo"][data-tab="file"]').click();
  assert.equal(await page.locator('[data-action="photo-export-project"]').isVisible(),true);
  await page.locator('.qo-work-tab[data-editor="photo"][data-tab="home"]').click();
  await page.locator('[data-action="photo-brush-tool"]').click();
  assert.equal(await page.evaluate(()=>qoPhotoTool),'brush');
  await page.locator('[data-action="photo-select-tool"]').click();
  const backup=await page.evaluate(()=>{
   const book=newWorkbook('QX контент');setCell(book.sheets[0],'A1','QX-001');
   workspace.books=[book];workspace.active=book.id;
   qoWriter.name='Мой сценарий';qoWriter.html='<h1>Критическое мышление</h1>';
   qoSlides.name='Мои слайды';qoPhotoFile='Обложка QX';
   const raw=encodeOfficeBackup(workspace,qoWriter,qoSlides,qoPhotoState());
   if(!raw.includes('quantum-office-backup-v2'))throw Error('Wrong backup version');
   return raw;
  });
  await page.evaluate(()=>{workspace.books=[];workspace.active=null;
   qoWriter.name='Изменено';qoSlides.name='Изменено';qoPhotoFile='Изменено';});
  await page.evaluate(async raw=>await importFile(new File([raw],'full-office.qbackup',{type:'application/json'})),backup);
  assert.deepEqual(await page.evaluate(()=>({
   name:qoWriter.name,slides:qoSlides.name,studio:qoPhotoFile,
   books:workspace.books.length,cell:workspace.books[0].sheets[0].cells.A1.value
  })),{name:'Мой сценарий',slides:'Мои слайды',studio:'Обложка QX',books:1,cell:'QX-001'});
  const oldFormat=await page.evaluate(()=>encodeWorkspace(workspace));
  await page.evaluate(()=>{qoWriter.name='НЕ ТРОГАТЬ';});
  await page.evaluate(async raw=>await importFile(new File([raw],'legacy.qbackup',{type:'application/json'})),oldFormat);
  assert.equal(await page.evaluate(()=>qoWriter.name),'НЕ ТРОГАТЬ');
  await page.setViewportSize({width:390,height:844});
  for(const kind of ['sheet','writer','slides','photo']){
   await page.evaluate(kind=>route(kind),kind);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,kind+' mobile width');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS TASK134: ribbon geometry, Studio tools, v2 restore, legacy v1, 390px');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});
