'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const {practice,notes} = require('../content/physics-teaching-materials.cjs');

const root=path.resolve(__dirname,'..');
const output=path.resolve(process.argv[2]||path.join(root,'evidence/editor-01/materials'));
const app=pathToFileURL(path.join(root,'Quantum-Office.html')).href;

async function build(source,appPage){
 return appPage.evaluate(doc=>{
  const defaults={font:'sans',size:doc.profile==='notes'?12:10.5,line:doc.profile==='notes'?1.48:1.32};
  const project={...qwProject(),id:doc.id,title:doc.title,subject:'physics',grade:'11',topic:doc.topic,exam:'ege',layout:'worksheet',variant:'',
   printSettings:{profile:doc.profile,numbering:doc.profile==='notes'?'none':'continuous',orientation:'portrait',
    showTitle:true,showMeta:true,showVariant:false,titleAlign:'left',titlePt:21,text:{version:1,...defaults}}};
  project.tasks=doc.tasks.map((raw,i)=>{
   const figure=raw.graph?'graph':raw.diagram?'diagram':null;
   const task={...qwTask(figure||'short'),...raw,id:doc.id+'-'+(i+1),grade:'11',exam:'general',origin:'original',topic:raw.part,
    points:doc.profile==='notes'?0:[2,3,2,2,3,2][i],answerVisible:!!raw.answer,solutionVisible:false};
   if(figure){
    const geo=qwTask('graph').graph;
    if(raw.graph) task.graph={...geo,...raw.graph,curve:{...geo.curve,...raw.graph.curve}};
    task.publishing={...raw.publishing,figure:{width:45,maxMm:85,position:'below',align:'center',gapMm:2}};
   }
   return task;
  });
  return qwValidate(project);
 },source);
}

async function captureScreens(page,project,file,name){
 await page.evaluate(()=>route('work'));
 await page.locator('#qw-file').setInputFiles(file);
 await page.waitForFunction(id=>qwDoc.id===id,project.id);
 assert.equal(await page.locator('html').getAttribute('data-qo-theme'),'light');
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:path.join(output,'screenshots',name+'-editor.png')});
 if(name==='theory-notes'){
  const callout=page.locator('#qw-task-editor [data-bank-live=prompt] .qw-callout').first();
  await callout.screenshot({path:path.join(output,'screenshots','callout.png')});
 }
 await page.locator('[data-action=work-preview]').click();
 await page.waitForFunction(()=>document.querySelector('#qw-print-preview-frame')?.dataset.ready);
 await page.locator('#qw-dialog [data-publish-fit=page]').click();
 await page.screenshot({path:path.join(output,'screenshots',name+'-a4.png')});
 await page.locator('#qw-dialog [data-qw-close]').click();
}

async function print(context,page,project,name,options){
 const html=await page.evaluate(({project,options})=>qwPrintDocumentHTML(project,options.format==='answers',options),{project,options});
 const surface=await context.newPage();
 try{
  await surface.setContent(html);
  await surface.evaluate(()=>window.qwPrintReady);
  const report=await surface.evaluate(()=>{
   const pages=[...document.querySelectorAll('.qw-print-page')],host=document.querySelector('.qw-print-document');
   const query=selector=>[...host.querySelectorAll('.qw-print-page '+selector)];
   const wordStream=selector=>query(selector).map(node=>node.textContent.trim()).join(' ').replace(/\s+/g,' ');
   const layout=window.__qwPrintLayout;
   return {error:window.__qwPrintError,layout,content:pages.map(page=>page.innerText),
    overflows:pages.filter(page=>page.scrollHeight>page.clientHeight||page.scrollWidth>page.clientWidth).length,
    graphCount:query('figure[data-figure-kind=graph] svg').length,diagramCount:query('figure[data-figure-kind=diagram] svg').length,
    callouts:query('.qw-callout').length,continuations:query('[data-qw-callout-continuation]').length,
    answerCount:query('[data-answer-number]').length,tables:query('table').length,
    notesBody:wordStream('[data-qw-callout=example]>.qw-callout-body'),
    numbered:query('.qw-paper-task>header').filter(element=>getComputedStyle(element).display!=='none').length};
  });
  assert.equal(report.error,undefined,JSON.stringify(report));
  assert.equal(report.overflows,0,name);
  assert.ok(report.layout.pages.every(page=>page.freeMm>=-.1));
  if(name==='theory-notes'){
   assert.ok(report.continuations>=1,JSON.stringify(report.layout));
   assert.equal(report.numbered,0);
   const expected=await page.evaluate(value=>{
    const div=document.createElement('div');
    div.innerHTML=qwRichMarkdownHTML(value);
    return div.querySelector('[data-qw-callout=example] .qw-callout-body').textContent.trim().replace(/\s+/g,' ');
   },project.tasks[1].prompt);
   const normalized=value=>value.replace(/\s/g,'');
   assert.equal(normalized(report.notesBody),normalized(expected),'long callout must preserve all text, formula atoms and list items');
  }
  if(name==='practice-sheet')assert.deepEqual([report.graphCount,report.diagramCount,report.callouts,report.tables],[1,1,2,1]);
  if(name==='practice-key')assert.equal(report.answerCount,project.tasks.length);
  const file=path.join(output,name+'.pdf');
  await surface.pdf({path:file,preferCSSPageSize:true,printBackground:true});
  assert.equal((await fs.readFile(file)).subarray(0,5).toString(),'%PDF-');
  return {[name]:report};
 } finally{await surface.close();}
}

async function main(){
 await fs.mkdir(path.join(output,'screenshots'),{recursive:true});
 const browser=await chromium.launch();
 try{
  const context=await browser.newContext({viewport:{width:1920,height:1080},offline:true,colorScheme:'light'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
  await page.goto(app);
  const results={};
  for(const [name,spec] of [['practice-sheet',practice],['theory-notes',notes]]){
   const project=await build(spec,page);
   const file=path.join(output,name+'.qwork');
   await fs.writeFile(file,JSON.stringify(project,null,2)+'\n');
   await captureScreens(page,project,file,name);
   Object.assign(results,await print(context,page,project,name,{format:project.layout}));
   if(name==='practice-sheet')Object.assign(results,await print(context,page,project,'practice-key',{format:'answers',keyMode:'detailed',includeCriteria:true}));
  }
  assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(output,'layout-report.json'),JSON.stringify(results,null,2)+'\n');
  for(const [name,report] of Object.entries(results))console.log(name+': '+report.layout.sheets+' A4; callouts '+report.callouts+'; continuations '+report.continuations);
  console.log('PASS original practice and theory, QWORK opening, A4 figures, typography and lossless callout pagination');
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
