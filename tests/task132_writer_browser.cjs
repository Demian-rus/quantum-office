const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1360,height:900},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../Quantum-Office.html')).href);
  await page.evaluate(()=>{
   route('writer');const editor=document.getElementById('qo-writer-page');
   editor.innerHTML='<h1>Проверка QX</h1><p>Текст <b>жирный</b>, <i>курсив</i>.</p>'+
    '<ul><li>Пункт А</li><li>Пункт Б</li></ul>'+
    '<table><tbody><tr><td>Логика</td><td>Физика</td></tr></tbody></table>'+
    '<p><a href="https://example.org">Источник</a></p>';
   qoWriter.layout={...qoWriterLayout(),paper:'A5',orientation:'landscape',
    header:'QX — черновик',footer:'Учебный материал',pageNumber:true};
   qoPersistWriter();render();
  });
  const generated=await page.evaluate(async()=>{
   const blob=await qoDocxExport(qoSafeRich(qoWriter.html),qoWriterLayout(),qoWriter.name);
   const zip=await JSZip.loadAsync(blob,{checkCRC32:true});
   const xml=await zip.file('word/document.xml').async('string');
   const header=await zip.file('word/header1.xml').async('string');
   const rels=await zip.file('word/_rels/document.xml.rels').async('string');
   return {parts:Object.keys(zip.files).length,docx:!!zip.file('[Content_Types].xml'),
    headings:xml.includes('Heading1'),bold:xml.includes('<w:b/>'),
    table:xml.includes('<w:tbl>')&&xml.includes('<w:tblGrid>')&&xml.includes('<w:gridCol'),list:xml.includes('<w:numPr>'),
    size:xml.includes('w:orient="landscape"'),header:header.includes('черновик'),
    externalLink:rels.includes('https://example.org')};
  });
  assert.equal(generated.docx,true);
  for(const field of ['headings','bold','table','list','size','header','externalLink'])assert.equal(generated[field],true,field);
  await page.locator('[data-editor="writer"][data-tab="file"]').click();
  const wait=page.waitForEvent('download');
  await page.locator('[data-action="writer-export-docx"]').click();
  const download=await wait;
  assert.match(download.suggestedFilename(),/\.docx$/i);
  const filepath=await download.path();
  await page.locator('#qo-writer-file').setInputFiles(filepath);
  await page.waitForTimeout(450);
  assert.equal(await page.locator('#qo-writer-page h1').innerText(),'Проверка QX');
  assert.equal(await page.locator('#qo-writer-page ul li').count(),2);
  assert.equal(await page.locator('#qo-writer-page table tr').count(),1);
  assert.equal(await page.locator('#qo-writer-page a[href="https://example.org/"]').count(),1);
  assert.equal(await page.evaluate(()=>qoWriterLayout().orientation),'landscape');
  assert.equal(await page.evaluate(()=>qoWriterLayout().header),'QX — черновик');
  assert.equal(await page.evaluate(()=>qoWriterLayout().footer),'Учебный материал');
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-editor="writer"][data-tab="file"]').click();
  assert.equal(await page.locator('[data-action="writer-export-docx"]').isVisible(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS TASK132: DOCX archive, styles, lists, tables, hyperlink, layout, roundtrip, mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});
