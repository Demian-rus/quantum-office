const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const dpr of [1,1.25,1.5]){
   const page=await browser.newPage({viewport:{width:950,height:690},deviceScaleFactor:dpr});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto(pathToFileURL(path.resolve(__dirname,'../Quantum-Office.html')).href);
    await page.evaluate(()=>{
     createBook();const s=sheet();
     setCell(s,'C8','1500');setStyle(s,'C8',{bg:'#F60811'});
     setStyle(s,'D8',{bg:'#F60811'});
     mergeCells(s,'C11','F11');
     setStyle(s,'C11',{bg:'#0E8738',borders:{right:true,bottom:true},
      borderEdges:{right:{line:'thin',color:'#112233'},bottom:{line:'thin',color:'#112233'}}});
     setFreeze(s,5,2);render();
    });
    const state=await page.evaluate(()=>{
     const v=document.getElementById('grid-scroll'),f=document.getElementById('grid-frozen-rows'),
      fc=document.getElementById('grid-frozen-cols');
     const cell=ref=>document.querySelector('#grid-canvas .grid-cell[data-ref="'+ref+'"]');
     const box=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};
     const a=cell('C8'),b=cell('D8'),m=cell('C11');
     return {v:box(v),f:box(f),fc:box(fc),a:box(a),b:box(b),m:box(m),
      anchorBorder:getComputedStyle(m).borderRightColor,
      bottomBorder:getComputedStyle(m).borderBottomColor,
      boxSizing:getComputedStyle(a).boxSizing,background:getComputedStyle(a).backgroundColor,
      freezeHeight:qoFrozenHeight(),scrollTop:v.scrollTop};
    });
    assert.equal(state.boxSizing,'border-box');
    assert.equal(state.background,'rgb(246, 8, 17)');
    assert.equal(state.anchorBorder,'rgb(17, 34, 51)');
    assert.equal(state.bottomBorder,'rgb(17, 34, 51)');
    assert.equal(state.b.x,state.a.x+state.a.w,'adjacent painted cells have no gaps');
    assert.ok(Math.abs(state.v.y-state.f.y-state.f.h)<0.6,'scrollbar starts below frozen rows');
    assert.ok(Math.abs(state.v.y-state.fc.y)<0.6,'frozen columns align to scroll viewport');
    assert.equal(state.scrollTop,state.freezeHeight);
    await page.evaluate(()=>{const v=document.getElementById('grid-scroll');v.scrollTop=800;v.dispatchEvent(new Event('scroll'));});
    await page.waitForTimeout(140);
    assert.equal(await page.evaluate(()=>document.getElementById('grid-scroll').scrollTop),800);
    await page.evaluate(()=>ensureVisible(5,2));
    assert.equal(await page.evaluate(()=>document.getElementById('grid-scroll').scrollTop),state.freezeHeight);
    await page.evaluate(()=>updateFreeze(0,0));
    const unpinned=await page.evaluate(()=>{
     const v=document.getElementById('grid-scroll'),f=document.getElementById('grid-frame');
     return {offset:v.getBoundingClientRect().top-f.getBoundingClientRect().top,freeze:qoFrozenHeight()};
    });
    assert.equal(unpinned.offset,31);assert.equal(unpinned.freeze,0);
    assert.deepEqual(errors,[]);await page.close();
   }catch(error){await page.close();throw error;}
  }
  console.log('PASS TASK140: seamless backgrounds, merged custom edges, frozen scroll and 3 display scales');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exit(1);});