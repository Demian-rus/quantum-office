const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/ux-01');
const app=pathToFileURL(path.join(root,'Quantum-Office.html')).href;

async function main(){
 fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});
 const browser=await chromium.launch(),errors=[];
 try{
  const context=await browser.newContext({viewport:{width:1920,height:1080},offline:true,acceptDownloads:true});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  const command=name=>page.locator('[data-qw-action="'+name+'"]');
  const live=section=>page.locator('[data-bank-live="'+section+'"]');
  const shot=async(name,area=page)=>{
   assert.equal(await page.locator('html').getAttribute('data-qo-theme'),'light');
   await page.evaluate(()=>document.fonts.ready);
   await area.screenshot({path:path.join(out,'screenshots',name+'.png'),animations:'disabled'});
  };
  await page.goto(app);
  await page.evaluate(()=>route('work'));
  assert.equal(await page.evaluate(()=>qwDoc.tasks.length),0);
  await page.locator('[data-action=work-new]').click();
  await command('add').click();
  assert.equal(await live('prompt').evaluate(node=>document.activeElement===node),true);
  await shot('empty-work-task');
  await live('prompt').fill('Проводник движется вдоль оси X. Найдите скорость.');
  await page.locator('[data-bank-format-select="formula"]').selectOption('fraction');
  await page.locator('[data-bank-equation-source]').fill('v=\\frac{s}{t}');
  await page.locator('[data-bank-equation-apply]').click();
  assert.equal(await live('prompt').locator('mfrac').count(),1);
  await page.locator('[data-bank-visual="diagram"]').click();
  await page.locator('[data-tool="forceVector"]').click();
  await shot('diagram-toolbar',page.locator('#qw-dialog header'));
  const stage=await page.locator('#qw-visual-stage svg').first().boundingBox();
  await page.mouse.move(stage.x+stage.width*.3,stage.y+stage.height*.45);
  await page.mouse.down();
  await page.mouse.move(stage.x+stage.width*.6,stage.y+stage.height*.45,{steps:8});
  await page.mouse.up();
  await command('visual-apply').click();
  await live('prompt').waitFor();
  assert.equal(await page.locator('[data-bank-live-figure] svg').count(),1);
  await page.locator('[data-bank-tab=comment]').click();
  await live('comment').fill('Проекция скорости равна отношению перемещения ко времени.');
  await page.locator('[data-bank-tab=answer]').click();
  await live('answer').fill('2 м/с');
  await page.locator('.qw-work-publishing>summary').click();
  const figureWidth=page.locator('#qw-task-editor [data-style-field="width"]');
  await figureWidth.fill('35');await figureWidth.press('Tab');
  await page.locator('[data-bank-tab=prompt]').click();
  const doc=await page.evaluate(()=>structuredClone(qwDoc));
  assert.match(doc.tasks[0].prompt,/\\frac/);
  assert.match(doc.tasks[0].comment,/Проекция/);
  assert.equal(doc.tasks[0].figure,'diagram');
  assert.equal(doc.tasks[0].publishing.figure.width,35);
  const layouts=[];
  for(const [width,height] of [[1366,768],[1920,1080],[2560,1440],[3440,1440]]){
   await page.setViewportSize({width,height});
   const record=await page.locator('[data-bank-rich=prompt]').evaluate(el=>{
    const paper=el.getBoundingClientRect(),scroll=el.closest('.qw-edit-scroll').getBoundingClientRect();
    return {width:paper.width,height:paper.height,background:getComputedStyle(el).backgroundColor,
     centerDelta:Math.abs((paper.left+paper.right-scroll.left-scroll.right)/2),horizontalOverflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert.ok(record.width<=821&&record.height>=359&&record.centerDelta<10&&!record.horizontalOverflow,JSON.stringify(record));
   assert.equal(record.background,'rgb(255, 255, 255)');
   layouts.push({width,height,...record});
   await shot('work-'+width);
  }
  await page.setViewportSize({width:1920,height:1080});
  await shot('work-toolbar',page.locator('[data-education-ribbon=work]'));
  assert.equal(await page.locator('[data-education-ribbon=work] .qo-work-group-caption').count(),0);
  const ribbon=await page.locator('[data-education-ribbon=work] button').evaluateAll(elements=>elements.map(button=>{
   const r=button.getBoundingClientRect(),i=button.querySelector('svg').getBoundingClientRect();
   return {height:r.height,icon:i.width,tooltip:button.title,vertical:Math.abs((r.top+r.bottom-i.top-i.bottom)/2)};
  }));
  assert.ok(ribbon.every(item=>item.height===34&&item.icon===16&&item.vertical<.2&&item.tooltip),JSON.stringify(ribbon));
  await page.locator('#qw-task-editor [data-bank-preview-toggle]').click();
  const frame=page.locator('#qw-print-preview-frame');
  await page.waitForFunction(()=>document.querySelector('#qw-print-preview-frame')?.dataset.ready);
  await page.locator('#qw-dialog [data-publish-fit=page]').click();
  const measure=()=>frame.evaluate(iframe=>{
   const win=iframe.contentWindow,p=win.document.querySelector('.qw-print-page'),r=p.getBoundingClientRect();
   return {width:r.width,height:r.height,pages:win.__qwPrintLayout.sheets,zoom:iframe.style.zoom,brand:!!win.document.querySelector('.qw-print-brand')};
  });
  const portrait=await measure();
  assert.ok(Math.abs(portrait.width/portrait.height-210/297)<.001&&portrait.brand);
  await shot('a4-portrait');
  await page.locator('#qw-dialog [data-publish-zoom]').fill('200');
  const large=await measure();
  assert.ok(Math.abs(large.width-portrait.width)<.05&&Math.abs(large.height-portrait.height)<.05&&large.pages===portrait.pages);
  await page.locator('[data-print-setting=orientation]').selectOption('landscape');
  await page.waitForFunction(()=>document.querySelector('#qw-print-preview-frame')?.contentWindow.__qwPrintLayout?.layout==='spread');
  await page.locator('#qw-dialog [data-publish-fit=page]').click();await shot('a4-landscape');
  const html=await page.evaluate(()=>qwPrintDocumentHTML(qwDoc,false,{format:'booklet'}));
  const print=await context.newPage();
  await print.setContent(html);
  await print.evaluate(()=>window.qwPrintReady);
  assert.equal(await print.evaluate(()=>window.__qwPrintError),undefined);
  await print.pdf({path:path.join(out,'created-work.pdf'),preferCSSPageSize:true,printBackground:true});
  await print.close();
  await page.locator('#qw-dialog [data-qw-close]').click();
  const saved=page.waitForEvent('download');
  await page.locator('[data-action=work-save]').click();
  const download=await saved, qwork=path.join(out,'created.qwork');
  await download.saveAs(qwork);
  await page.locator('[data-action=work-new]').click();
  await page.locator('#qw-file').setInputFiles(qwork);
  await live('prompt').waitFor();
  assert.equal(await page.evaluate(()=>qwDoc.tasks[0].answer),'2 м/с');
  const bad=Buffer.from('{"format":"quantum-work","version":99}');
  await page.locator('#qw-file').setInputFiles({name:'corrupt.qwork',mimeType:'application/json',buffer:bad});
  await page.waitForFunction(()=>document.body.innerText.includes('Не удалось открыть QWORK'));
  assert.equal(await page.evaluate(()=>qwDoc.tasks[0].answer),'2 м/с');
  await page.evaluate(()=>route('bank'));
  await command('bank-new').click();
  await page.waitForFunction(()=>document.activeElement?.dataset.bankLive==='prompt');
  await shot('bank-empty-task');
  await live('prompt').fill('Вычислите путь при равномерном движении.');
  await page.locator('[data-bank-format-select="formula"]').selectOption('fraction');
  await page.locator('[data-bank-equation-source]').fill('s=\\frac{v_0+v}{2}t');
  await page.locator('[data-bank-equation-apply]').click();
  await shot('bank-filled-task');
  await page.locator('[data-bank-preview-toggle]').click();
  await page.waitForFunction(()=>document.querySelector('[data-bank-publish-frame]')?.dataset.ready);
  await page.locator('[data-bank-preview-toggle]').click();
  await command('bank-edit-save').click();
  await page.locator('[data-bank-view]').first().waitFor();
  const bankRow=await page.evaluate(async()=>{const rows=await qwBankRepository.listTasks({}, {limit:30});return qwBankRepository.getTask(rows.items[0].id);});
  assert.match(bankRow.task.prompt,/\\frac/);
  const icon=await command('bank-new').evaluate(button=>{
   const i=button.querySelector('svg').getBoundingClientRect(),l=button.querySelector('span').getBoundingClientRect();
   return {height:i.height,delta:Math.abs((i.top+i.bottom-l.top-l.bottom)/2),display:getComputedStyle(button).display};
  });
  assert.equal(icon.height,16);assert.ok(icon.delta<.2&&icon.display.includes('flex'),JSON.stringify(icon));
  await shot('bank');
  await shot('bank-toolbar',command('bank-new').locator('..'));
  await page.locator('[data-bank-view]').first().click();
  await page.locator('[data-bank-add]').click();
  await live('prompt').waitFor();
  await live('prompt').fill('Редакция только в копии работы.');
  assert.equal(await page.evaluate(id=>qwBankRepository.getTask(id).then(row=>row.task.prompt),bankRow.id),bankRow.task.prompt);
  await page.evaluate(()=>route('diagnostics'));
  await shot('diagnostics');
  const labels=await page.evaluate(()=>{
   const expressions=['\\vec{F}','\\vec{F}_{\\mathrm{тр}}','\\vec{v}_0','\\vec{a}','\\vec{p}','\\vec{s}','\\vec{E}','\\vec{B}','v_x','a_x','F_x','\\frac{|\\vec{v}_0|}{\\rho}','\\omega_0^2'];
   const markup=qwDiagramSVG(expressions.map((label,i)=>({kind:'text',x:40+(i%3)*170,y:40+Math.floor(i/3)*55,x2:40+(i%3)*170,y2:40+Math.floor(i/3)*55,label})));
   const wrapper=document.createElement('div');wrapper.innerHTML=markup;
   return {labels:wrapper.querySelectorAll('[data-qw-science-math]').length,rules:wrapper.querySelectorAll('[data-qw-math-rule]').length,
    scalars:wrapper.querySelectorAll('[data-qw-science-math="v_x"] [data-qw-math-rule]').length,markup};
  });
  assert.deepEqual([labels.labels,labels.scalars],[13,0]);assert.ok(labels.rules>=10);
  fs.writeFileSync(path.join(out,'scientific-labels.svg'),labels.markup);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify({layouts,ribbon,icon,portrait,labels:{labels:labels.labels,rules:labels.rules}},null,2));
  console.log('PASS both editor contexts, QWORK round trip and corruption, SVG math captions, responsive layouts, A4 preview/PDF and bank controls');
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
