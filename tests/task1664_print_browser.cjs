/* Same fixture and strict visual gate as installed WebView2. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),assert=require('node:assert/strict');
const {makePrintFixture,printMetrics,checkPrint}=require('./task1664_visual.cjs');
const {makeTechnicalFixture,inspectGraphics,checkGraphics}=require('./task1664_graphics.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence','task1664-print');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true});
 try{
  const app=await browser.newPage();await app.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
  const fixtures=[['print',await makePrintFixture(app)],['ege2018',JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures','QuantumOffice_EGE2018_32.qwork'),'utf8'))],['graphics',await makeTechnicalFixture(app)]];
  for(const [prefix,fixture] of fixtures)fs.writeFileSync(path.join(out,prefix+'.qwork'),JSON.stringify(fixture,null,2));
  const report=[];
  for(const [prefix,fixture] of fixtures)for(const orientation of ['portrait','landscape']){
   const project=structuredClone(fixture);project.printSettings.orientation=orientation;
   const p=await browser.newPage({viewport:{width:1280,height:1200}});
   try{
    const html=await app.evaluate(project=>qwPrintDocumentHTML(project,false,{format:'booklet'}),project);
    await p.setContent(html);await p.evaluate(()=>window.qwPrintReady);
    const metrics=await p.evaluate(printMetrics);checkPrint(metrics,orientation,fixture);
    if(prefix!=='print'){const proof=await p.evaluate(inspectGraphics);checkGraphics(proof,prefix);fs.writeFileSync(path.join(out,prefix+'-'+orientation+'-browser-geometry.json'),JSON.stringify(proof,null,2));}
    if(prefix==='print'){
     const proof=await p.evaluate(()=>{const t=document.querySelector('[data-task="5"] .qw-task-text'),g=t.querySelector('.qw-task-tables');return {before:g.previousElementSibling?.textContent||'',after:g.nextElementSibling?.textContent||'',side:document.querySelector('[data-task="6"] figure')?.dataset.printPosition,below:document.querySelector('[data-task="9"] figure')?.dataset.printPosition};});
     assert.match(proof.before,/Измерения/);assert.match(proof.after,/Используя таблицу/);assert.equal(proof.side,'right');assert.equal(proof.below,'below');
    }
    await p.emulateMedia({media:'print'});await p.pdf({path:path.join(out,prefix+'-'+orientation+'-browser.pdf'),preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});await p.screenshot({path:path.join(out,prefix+'-'+orientation+'-browser.png'),fullPage:true});
    report.push({prefix,orientation,...metrics});
   }finally{await p.close();}
  }
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'PASS',report},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
