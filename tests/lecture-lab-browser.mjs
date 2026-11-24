import { chromium } from 'playwright';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';import {readFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage({acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(resolve('lecture-lab/Quantum-Lectures.html')).href);
 assert.equal(await page.locator('.scene').count(),13);
 await page.locator('#mode').selectOption('lecture');assert.equal(await page.locator('.scene[open]').count(),13);
 await page.locator('#mode').selectOption('script');
 const decay=page.locator('[data-scene=decay]');if(!(await decay.getAttribute('open')!==null))await decay.locator(':scope > summary').click();
 await decay.getByText('Редактировать иллюстрацию',{exact:true}).click();
 await decay.getByText('Подпись X',{exact:true}).locator('..').locator('input').fill('Периоды');
 await decay.getByText('Подпись X',{exact:true}).locator('..').locator('input').press('Tab');
 assert.ok(await decay.locator('svg text').allTextContents().then(x=>x.includes('Периоды')));
 const intro=page.locator('[data-scene=intro]');if(await intro.getAttribute('open')===null)await intro.locator(':scope > summary').click();
 await intro.getByText('Редактировать иллюстрацию',{exact:true}).click();
 await intro.getByLabel('Текст',{exact:true}).fill('Исправленная подпись');await intro.getByLabel('Текст',{exact:true}).press('Tab');
 assert.ok(await intro.locator('svg text').allTextContents().then(x=>x.includes('Исправленная подпись')));
 const [svg]=await Promise.all([page.waitForEvent('download'),decay.getByRole('button',{name:'SVG',exact:true}).click()]);assert.match(await readFile(await svg.path(),'utf8'),/Периоды/);
 const [png]=await Promise.all([page.waitForEvent('download'),decay.getByRole('button',{name:'PNG',exact:true}).click()]);const p=await readFile(await png.path());assert.equal(p.readUInt32BE(16),1440);assert.equal(p.readUInt32BE(20),800);
 const [file]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);const saved=JSON.parse(await readFile(await file.path(),'utf8'));assert.equal(saved.version,2);assert.equal(saved.scenes.find(s=>s.id==='decay').visuals[0].xLabel,'Периоды');
 page.on('dialog',d=>d.accept());await page.locator('#load').setInputFiles({name:'test.qlecture',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await page.waitForFunction(()=>document.querySelector('#status').textContent==='Проект открыт.');
 assert.deepEqual(errors,[]);console.log('Lecture lab browser smoke PASS');
}finally{await browser.close();}
