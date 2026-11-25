/* TASK162: launcher alignment, inset navigation, bank entry and responsiveness. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task162-launcher');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const width of [1600,900,390]){
   const p=await browser.newPage({viewport:{width,height:900}});
   const errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
   const editors=p.locator('.launcher-editor');
   assert.equal(await editors.count(),4,'four main editor stacks');
   for(let i=0;i<4;i++){
    const group=editors.nth(i),main=group.locator('.launcher-tile'),quick=group.locator('.launcher-inset'),templates=group.locator('.launcher-template-actions');
    assert.equal(await main.count(),1);
    assert.equal(await quick.count(),2,'two small tiles per editor');
    const mr=await main.boundingBox(),qr=await quick.first().boundingBox(),tr=await templates.boundingBox();
    assert.ok(mr&&qr&&tr&&qr.y>=mr.y+mr.height-1,'insets are below large card');
    assert.ok(tr.y>=qr.y+qr.height-1,'templates are below insets');
    assert.ok(tr.x>=mr.x-1&&tr.x+tr.width<=mr.x+mr.width+1,'template link stays within own editor column');
    if(i<3)assert.equal(await templates.locator('button').count(),1);
   }
   assert.equal(await p.locator('.qo-education-launcher [data-action="launcher-work"]').count(),1);
   assert.equal(await p.locator('.qo-education-launcher [data-action="launcher-bank"]').count(),1);
   await p.screenshot({path:path.join(out,'launcher-'+width+'.png'),fullPage:true});
   if(width===1600){
    const boxes=await editors.locator('.launcher-tile').all();
    const widths=await Promise.all(boxes.map(async el=>(await el.boundingBox()).width));
    assert.ok(Math.max(...widths)-Math.min(...widths)<1,'proportional equal editor cards');
    await p.locator('[data-action="launcher-work"]').click();
    assert.equal(await p.locator('#qo-work-workspace').isVisible(),true,'constructor workspace opens');
    await p.locator('[data-action="route"][data-target="home"]').first().click();
    await p.locator('[data-action="launcher-bank"]').click();
    await p.locator('#qw-dialog .qw-bank-navigation').waitFor({state:'visible'});
    assert.equal(await p.locator('#qw-dialog .qw-bank-navigation').count(),1,'bank opens from launcher');
    assert.equal(await p.locator('#qw-bank-search').count(),1);
    await p.screenshot({path:path.join(out,'bank-entry.png'),fullPage:true});
   }
   assert.deepEqual(errors,[],'no browser errors at '+width);
   await p.close();
  }
  console.log('PASS TASK162 launcher: four proportional stacks; inset actions; aligned templates; responsive 1600/900/390; direct bank entry');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
