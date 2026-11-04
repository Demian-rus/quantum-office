const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../Quantum-Office.html')).href);
  for(const kind of ['writer','slides','photo']){
   await page.evaluate(k=>route(k),kind);
   const panels=await page.evaluate(()=>{
    const groups=[...document.querySelectorAll('.qo-work-panel.active .qo-work-group')];
    return groups.map(g=>{
     const inside=g.querySelector('.qo-work-group-body');
     const buttons=[...inside.querySelectorAll(':scope > button')];
     const tiles=[...inside.querySelectorAll('.qo-writer-icon-grid > button,.qo-writer-icon-grid > label')];
     return {title:g.querySelector('.qo-work-group-caption')?.textContent,
      items:(buttons.length?buttons:tiles).length,
      y:[...new Set((buttons.length?buttons:tiles).map(b=>Math.round(b.getBoundingClientRect().top)))]
     };
    });
   });
   assert.ok(panels.length>=2,kind);
   for(const group of panels)if(group.items>=2)assert.equal(group.y.length,2,kind+': '+group.title);
   const dims=await page.evaluate(()=>({
    tabs:document.querySelector('.qo-work-tabs').offsetHeight,
    ribbon:document.querySelector('.qo-work-ribbon').offsetHeight,
    pageOverflow:document.documentElement.scrollWidth>innerWidth
   }));
   assert.deepEqual(dims,{tabs:30,ribbon:78,pageOverflow:false},kind);
  }
  await page.evaluate(()=>route('writer'));
  assert.equal(await page.locator('.qo-writer-font-actions #qo-writer-text-color').count(),1);
  assert.equal(await page.locator('.qo-writer-font-actions #qo-writer-highlight').count(),1);
  assert.equal(await page.locator('[data-command="superscript"]').isVisible(),true);
  assert.equal(await page.locator('[data-command="subscript"]').isVisible(),true);
  assert.equal(await page.locator('[data-command="removeFormat"]').isVisible(),true);
  const rt=await page.evaluate(async()=>{
   const editor=document.getElementById('qo-writer-page');
   editor.innerHTML='<p>Степень: x2. Индекс: H2O.</p>';
   const text=editor.querySelector('p').firstChild,range=document.createRange();
   const pos=text.textContent.indexOf('2');
   range.setStart(text,pos);range.setEnd(text,pos+1);
   const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
   qoWriterRememberSelection();qoWriterCommand('superscript');
   const rendered=editor.querySelector('sup')?.textContent==='2';
   qoPersistWriter();
   const persisted=qoWriter.html.includes('<sup>2</sup>');
   const doc=await qoDocxExport(qoWriter.html,qoWriterLayout(),qoWriter.name);
   const zip=await JSZip.loadAsync(doc,{checkCRC32:true});
   const xml=await zip.file('word/document.xml').async('string');
   const parsed=await qoDocxImport(new File([doc],'math.docx',{
    type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
   }));
   return {rendered,persisted,exported:xml.includes('w:vertAlign w:val="superscript"'),
    imported:parsed.html.includes('<sup>2</sup>')};
  });
  assert.deepEqual(rt,{rendered:true,persisted:true,exported:true,imported:true});
  for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:844});
   for(const kind of ['sheet','writer','slides','photo']){
    await page.evaluate(k=>route(k),kind);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    assert.equal(overflow,false,kind+' at '+width+'px');
   }
  }
  assert.deepEqual(errors,[]);
  console.log('PASS TASK135: 2-row ribbons, icons, DOCX math, 390/768/1440px');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});
