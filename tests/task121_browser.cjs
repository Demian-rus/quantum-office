const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAF0lEQVR4nGP8//8/AyHARFDFqKIBUAQAP6kDFQZDzEYAAAAASUVORK5CYII=','base64');
(async()=>{
 const root=path.resolve(__dirname,'..'),browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1600,height:950},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
 await page.evaluate(()=>route('writer'));
 await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
 await page.locator('#qd-template-pick').selectOption('physics8');
 await page.locator('[data-qd-action="use-template"]').click();
 const first=page.locator('.qd-edit-card').first(),qid=await first.getAttribute('data-qid');
 assert.ok(qid);
 const promptSlot=first.locator('[data-qd-media-slot="prompt"]');
 const answerSlot=first.locator('[data-qd-media-slot="answer"]');
 assert.equal(await promptSlot.count(),1);
 assert.equal(await answerSlot.count(),1);
 await promptSlot.locator('[data-qd-media-file]').setInputFiles({name:'diagram.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(id=>Boolean(qdDoc().sections[0].questions[0].promptMedia?.id),qid);
 await page.locator('.qd-edit-card').first().locator('[data-qd-media-caption]').first().fill('Схема к условию');
 await page.locator('.qd-edit-card').first().locator('[data-qd-media-display]').first().selectOption('wide');
 // Simulate a screenshot pasted into the answer field, without browser clipboard permissions.
 await page.evaluate(data=>{
   const bytes=Uint8Array.from(atob(data),ch=>ch.charCodeAt(0));
   const file=new File([bytes],'answer.png',{type:'image/png'});
   const dt=new DataTransfer();dt.items.add(file);
   const input=document.querySelector('.qd-edit-card [data-qd-field="answer"]');
   input.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));
 },PNG.toString('base64'));
 await page.waitForFunction(()=>!!qdDoc().sections[0].questions[0].answerMedia);
 const originals=await page.evaluate(()=>{
   const q=qdDoc().sections[0].questions[0];
   return {prompt:q.promptMedia.id,answer:q.answerMedia.id,caption:q.promptMedia.caption,
     assets:qdMediaReferenced(qdDoc()).length};
 });
 assert.equal(originals.caption,'Схема к условию');
 assert.equal(originals.assets,2);
 await page.locator('[data-qd-action="compact-mode"]').click();
 assert.ok((await page.locator('.qd-edit-card').first().locator('.qd-media-chips').textContent()).includes('ответ'));
 await page.locator('[data-qd-action="mode"][data-mode="run"]').first().click();
 assert.equal(await page.locator('.qd-run-card').first().locator('.qd-media-run').count(),1,'only prompt image visible');
 await page.locator('.qd-run-card').first().locator('[data-qd-action="reveal"]').click();
 assert.equal(await page.locator('.qd-run-card').first().locator('.qd-media-run').count(),2,'answer image shown after reveal');
 await page.locator('.qd-run-card').first().locator('[data-qd-media-action="view"]').first().click();
 assert.ok(await page.locator('dialog.qd-media-dialog').isVisible());
 await page.locator('dialog [data-qd-media-dismiss]').click();
 await page.locator('[data-qd-action="mode"][data-mode="builder"]').first().click();
 await page.locator('.qd-edit-card').first().locator('[data-qd-action="card-expand"]').click();
 // Draw a new teacher answer, replacing only its media ref.
 await page.locator('.qd-edit-card').first().locator('[data-qd-media-action="draw"][data-kind="answer"]').click();
 const canvas=page.locator('dialog.qd-media-draw-dialog canvas');
 assert.ok(await canvas.isVisible());
 const bounds=await canvas.boundingBox();
 await page.mouse.move(bounds.x+40,bounds.y+40);
 await page.mouse.down();await page.mouse.move(bounds.x+180,bounds.y+100,{steps:5});await page.mouse.up();
 await page.locator('dialog [data-draw-save]').click();
 await page.waitForFunction(id=>qdDoc().sections[0].questions[0].answerMedia?.id!==id,originals.answer);
 assert.equal(await page.evaluate(()=>qdDoc().sections[0].questions[0].promptMedia.id),originals.prompt);
 // With media, export is a portable archive including assets.
 const event=page.waitForEvent('download');
 await page.evaluate(()=>qdExport());
 const dl=await event;assert.match(dl.suggestedFilename(),/\.qdiagx$/);
 const target=path.join(root,'task121-test.qdiagx');await dl.saveAs(target);
 assert.ok(fs.statSync(target).size>250);
 const before=await page.evaluate(()=>qdDoc().sections[0].questions[0].promptMedia.id);
 await page.locator('#qo-diag-file').setInputFiles(target);
 await page.waitForFunction(id=>qdDoc().sections[0].questions[0].promptMedia?.id!==id,before);
 assert.ok(await page.evaluate(async()=>Boolean(await qdMediaGet(qdDoc().sections[0].questions[0].promptMedia.id))));
 // Own template exports also carry asset bytes.
 await page.locator('[data-qd-action="mode"][data-mode="builder"]').first().click();
 await page.locator('[data-qd-action="builder-quick-save"]').click();
 const templateDownload=page.waitForEvent('download');
 await page.evaluate(()=>qdLibraryExport());
 const tpl=await templateDownload;assert.match(tpl.suggestedFilename(),/\.qtplx$/);
 const tplPath=path.join(root,'task121-test.qtplx');await tpl.saveAs(tplPath);
 assert.ok(fs.statSync(tplPath).size>250);
 for(const width of [1600,1100,650,390]){
   await page.setViewportSize({width,height:880});
   const metric=await page.evaluate(()=>({
     page:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,
     images:[...document.querySelectorAll('.qd-media-preview img')].map(x=>({right:x.getBoundingClientRect().right,
       panel:x.closest('.qd-edit-card')?.getBoundingClientRect().right}))
   }));
   assert.ok(metric.page<=metric.viewport+4,'horizontal overflow at '+width);
   assert.ok(metric.images.every(m=>!m.panel||m.right<=m.panel+1),'image escaped card at '+width);
 }
 fs.rmSync(target,{force:true});fs.rmSync(tplPath,{force:true});
 assert.deepEqual(errors,[]);
 console.log('PASS TASK121: file upload, screenshot paste, captions, compact, answer privacy, drawing, ZIP roundtrip and 390px');
 await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1);});
