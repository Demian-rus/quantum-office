const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1366,height:900},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../Quantum-Office.html')).href);
  await page.evaluate(()=>{
   route('writer');
   const editor=document.getElementById('qo-writer-page');
   editor.innerHTML='<h1>Логика</h1><p>Первый абзац.</p><p>Второй абзац.</p><p><b>Третий</b> абзац.</p>';
   const text=editor.querySelector('p').firstChild,r=document.createRange();
   r.setStart(text,2);r.setEnd(text,4);
   const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);
   qoWriterRememberSelection();qoPersistWriter();
  });
  await page.locator('[data-editor="writer"][data-tab="layout"]').click();
  for(const [key,value] of [['left','10'],['first','5'],['before','12'],['after','6']]){
   const control=page.locator('#qo-writer-para-'+key);await control.fill(value);
   await control.dispatchEvent('change');
  }
  const styles=await page.evaluate(()=>[...document.querySelectorAll('#qo-writer-page p')].map(n=>n.getAttribute('style')));
  assert.match(styles[0],/margin-left: 10mm/);
  assert.match(styles[0],/text-indent: 5mm/);
  assert.match(styles[0],/margin-top: 12pt/);
  assert.match(styles[0],/margin-bottom: 6pt/);
  assert.equal(styles[1],null);
  await page.locator('[data-editor="writer"][data-tab="home"]').click();
  await page.locator('[data-action="writer-indent-more"]').click();
  assert.equal(await page.evaluate(()=>document.querySelector('#qo-writer-page p').style.marginLeft),'15mm');
  await page.locator('[data-action="writer-indent-less"]').click();
  assert.equal(await page.evaluate(()=>document.querySelector('#qo-writer-page p').style.marginLeft),'10mm');
  await page.evaluate(()=>{
   const nodes=document.querySelectorAll('#qo-writer-page p'),r=document.createRange();
   r.setStart(nodes[1].firstChild,0);r.setEnd(nodes[2].lastChild,2);
   const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);qoWriterRememberSelection();
  });
  await page.locator('[data-editor="writer"][data-tab="layout"]').click();
  await page.locator('#qo-writer-para-left').fill('5');
  await page.locator('#qo-writer-para-left').dispatchEvent('change');
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('#qo-writer-page p')].map(x=>x.style.marginLeft)),['10mm','5mm','5mm']);
  const result=await page.evaluate(async()=>{
   const doc=await qoDocxExport(qoSafeRich(qoWriter.html),qoWriterLayout(),qoWriter.name),
    zip=await JSZip.loadAsync(doc,{checkCRC32:true}),
    xml=await zip.file('word/document.xml').async('string'),
    parsed=await qoDocxImport(new File([doc],'check.docx',{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
   return {ind:/<w:ind /.test(xml),spacing:/<w:spacing /.test(xml),
    left:parsed.html.includes('margin-left:10mm'),before:parsed.html.includes('margin-top:12pt')};
  });
  assert.deepEqual(result,{ind:true,spacing:true,left:true,before:true});
  await page.locator('[data-action="writer-para-reset"]').click();
  assert.equal(await page.evaluate(()=>document.querySelectorAll('#qo-writer-page p')[1].style.marginLeft),'');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('#qo-writer-para-left').isVisible(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS TASK133: paragraph metrics, multiple selection, DOCX roundtrip, mobile');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exit(1);});
