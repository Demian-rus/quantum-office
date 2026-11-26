'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/exam-01');await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch();try{
 const context=await browser.newContext({offline:true,viewport:{width:1500,height:1000}});const page=await context.newPage();
 await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
 const project=await page.evaluate(()=>qwValidate({...qwProject(),title:'Внутреннее название',layout:'booklet',variant:'15',printSettings:{partHeadings:true,showMeta:true,titleAlign:'left',numbering:'none'},tasks:[{...qwTask(),prompt:'Условие первого задания.',part:'Часть 1',answer:'1',comment:'Решение 1',criteria:'Критерий 1',source:{kind:'bank',id:'real',number:815}},{...qwTask(),prompt:'Условие второго задания.',part:'Часть 2',answer:'2',comment:'Решение 2',criteria:'Критерий 2'}]}));
 for(const orientation of ['portrait','landscape'])for(const explicit of [false,true]){
 const html=await page.evaluate(({project,orientation,explicit})=>qwPrintDocumentHTML({...project,printSettings:{...project.printSettings,orientation,examPartHeadings:explicit}}),{project,orientation,explicit});
 const print=await context.newPage();await print.setContent(html);await print.evaluate(()=>window.qwPrintReady);
 const actual=await print.evaluate(()=>{const box=n=>n.getBoundingClientRect(),center=n=>{const b=box(n);return (b.left+b.right)/2;};const title=document.querySelector('.qw-print-title');return {error:window.__qwPrintError,title:title.textContent,titleCenter:Math.abs(center(title)-center(title.closest('.qw-print-sheet,.qw-print-page'))),titleAlign:getComputedStyle(title).textAlign,sections:[...document.querySelectorAll('.qw-topic-title')].map(n=>[n.textContent,getComputedStyle(n).textAlign]),numbers:[...document.querySelectorAll('.qw-exam-number-line')].map(n=>n.textContent),squares:document.querySelectorAll('.qw-task-marker').length,offsets:[...document.querySelectorAll('.qw-exam-publication')].map(n=>Math.abs(box(n.querySelector('.qw-exam-number-line')).left-box(n.querySelector('.qw-task-text')).left))};});
 assert.equal(actual.error,undefined);assert.equal(actual.title,'Вариант 15');assert.equal(actual.titleAlign,'center');assert.ok(actual.titleCenter<1);assert.deepEqual(actual.sections,explicit?[['Часть 1','center'],['Часть 2','center']]:[]);assert.deepEqual(actual.numbers,['№ 1 (00815).','№ 2.']);assert.equal(actual.squares,0);assert.ok(actual.offsets.every(x=>x<1));await print.close();
 }
 for(const profile of ['practice','notes']){
 const html=await page.evaluate(({project,profile})=>qwPrintDocumentHTML({...project,layout:'worksheet',printSettings:{profile,showTitle:true,titleText:'Учебный материал',numbering:profile==='notes'?'none':'auto'}}),{project,profile});
 const print=await context.newPage();await print.setContent(html);await print.evaluate(()=>window.qwPrintReady);
 assert.equal(await print.evaluate(()=>window.__qwPrintError),undefined);assert.equal(await print.locator('.qw-print-title').textContent(),'Учебный материал');assert.equal(await print.locator('.qw-exam-number-line').count(),0);await print.pdf({path:path.join(out,profile+'-regression.pdf'),preferCSSPageSize:true,printBackground:true});await print.locator('.qw-print-page').first().screenshot({path:path.join(out,profile+'-regression.png')});await print.close();
 }
 await context.close();console.log('PASS EXAM-01: variant, optional sections, legacy numbering, A4 geometry, practice/notes isolation');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
