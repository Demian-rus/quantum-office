const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');

(async()=>{
  const root=path.resolve(__dirname,'..');
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1510,height:930},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  await page.evaluate(()=>route('writer'));
  await page.locator('[data-editor="writer"][data-tab="diagnostic"]').click();
  await page.locator('[data-qd-action="sample"]').click();
  const before=await page.evaluate(()=>JSON.stringify(qdDoc()));
  await page.locator('[data-qd-pane="variants"] summary').click();
  await page.locator('#qd-var-count').selectOption('3');
  await page.locator('#qd-var-per-section').selectOption('2');
  await page.locator('#qd-var-seed').fill('2026-A4-lesson');
  assert.equal(await page.locator('.qd-variant-card').count(),3);
  assert.equal(await page.locator('[data-qd-action="variant-print"]').count(),6);
  const studentPromise=page.waitForEvent('download');
  await page.locator('.qd-variant-card').nth(1)
    .locator('[data-qd-action="variant-print"][data-variant-kind="student"]').click();
  const studentDownload=await studentPromise;
  const studentPath=path.join(root,'task111-student.html');
  await studentDownload.saveAs(studentPath);
  assert.match(studentDownload.suggestedFilename(),/variant-Б-student\.html$/);
  const keyPromise=page.waitForEvent('download');
  await page.locator('.qd-variant-card').nth(1)
    .locator('[data-qd-action="variant-print"][data-variant-kind="key"]').click();
  const keyDownload=await keyPromise;
  const keyPath=path.join(root,'task111-key.html');await keyDownload.saveAs(keyPath);
  const student=fs.readFileSync(studentPath,'utf8'),key=fs.readFileSync(keyPath,'utf8');
  assert.match(student,/<!doctype html>/i);
  assert.match(student,/@page\{size:A4/);
  assert.match(student,/Вариант Б/);
  assert.match(student,/ФИО:/);
  assert.match(student,/write-lines/);
  assert.ok(!student.includes('Ключ ответов'));
  assert.match(key,/Ключ ответов/);
  assert.match(key,/Ответ и критерии/);
  assert.ok(!key.includes('ФИО:'));
  const inspection=await browser.newPage({viewport:{width:800,height:1120}});
  await inspection.goto(pathToFileURL(studentPath).href);
  const geom=await inspection.evaluate(()=>({
    title:document.title,
    sections:document.querySelectorAll('.topic').length,
    questions:document.querySelectorAll('.question').length,
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
  }));
  assert.equal(geom.sections,3);
  assert.equal(geom.questions,6);
  assert.ok(geom.overflow<=1);
  await inspection.close();
  assert.equal(await page.evaluate(()=>JSON.stringify(qdDoc())),before);
  await page.setViewportSize({width:390,height:820});
  const mobile=await page.evaluate(()=>({
    viewport:document.documentElement.clientWidth,
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
  }));
  assert.ok(mobile.overflow<=4,'print actions should not overflow mobile diagnostics');
  fs.rmSync(studentPath,{force:true});fs.rmSync(keyPath,{force:true});
  assert.deepEqual(errors,[]);
  console.log('PASS TASK111: live student/key A4 exports, confidentiality, independent source and mobile fit');
  await browser.close();
})().catch(e=>{console.error(e.stack);process.exit(1);});