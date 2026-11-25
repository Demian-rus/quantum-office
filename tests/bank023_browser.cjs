/* BANK-02.3: shared task geometry, vector exports and raster inspection inputs. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const samples = require('./fixtures/bank023-samples.cjs');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'evidence/bank-02.3');
const fixtureId = n => `bank023-${String(n).padStart(2, '0')}`;
const action = (page, name) => page.locator(`[data-qw-action="${name}"]`);

function inspectPrint() {
  const sheets = [...document.querySelectorAll('.qw-print-sheet')];
  const surfaces = sheets.length ? sheets : [...document.querySelectorAll('.qw-print-page')];
  const pt = 72/96;
  const bounds = node => node?.getBoundingClientRect();
  const center = rect => (rect.top+rect.bottom)/2;
  const overlap = (a,b) => Math.min(a.right,b.right)-Math.max(a.left,b.left)>.55 && Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.55;
  const inside = (a,b) => a.left>=b.left-1 && a.right<=b.right+1 && a.top>=b.top-1 && a.bottom<=b.bottom+1;
  function textBoxes(node) {
    if(!node)return [];
    const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT), boxes=[];
    while(walker.nextNode()){
      const leaf=walker.currentNode;
      if(!leaf.data.trim()||leaf.parentElement.closest('math'))continue;
      // Ignore the space before/after the line so only glyph runs are measured.
      const range=document.createRange();range.setStart(leaf,leaf.data.search(/\S/));range.setEnd(leaf,leaf.data.trimEnd().length);
      boxes.push(...range.getClientRects());
    }
    return boxes.concat([...node.querySelectorAll('math')].map(math=>bounds(math.getAttribute('display')==='block'?math.firstElementChild:math)));
  }
  const proof={layout:window.__qwPrintLayout,errors:[],tasks:[],roots:[],brief:[],maxCenterDeltaPt:0};
  for(const [page,surface] of surfaces.entries()){
    const pageBox=bounds(surface);
    const relative=r=>[r.left-pageBox.left,r.top-pageBox.top,r.right-pageBox.left,r.bottom-pageBox.top].map(x=>x*pt);
    for(const entry of surface.querySelectorAll('.qw-print-section')){
      const number=+entry.dataset.task;
      const area=entry.closest('.qw-page-content');
      const heading=entry.querySelector('.qw-task-heading'), marker=heading?.querySelector('.qw-task-marker');
      const permanent=heading?.querySelector('.qw-booklet-bank-id'), content=entry.querySelector('.qw-task-text');
      const answer=entry.querySelector('.qw-booklet-answer,.qw-answer-preview');
      const figure=entry.querySelector('figure');
      const issue=name=>proof.errors.push({task:number,page:page+1,error:name});
      if(heading){
        const b=bounds(marker),h=bounds(heading),c=bounds(content);
        if(Math.abs(b.width-b.height)>.08)issue('ordinal is not square');
        if(heading.querySelector('math')||heading.children.length!==(permanent?2:1))issue('heading contains other material');
        if(c.top<h.bottom+.5)issue('condition must begin on the next row');
        if(permanent){
          const id=bounds(permanent),deviation=Math.abs(center(b)-center(id))*pt;
          proof.maxCenterDeltaPt=Math.max(proof.maxCenterDeltaPt,deviation);
          if(deviation>.5)issue('identifier center misaligned');
          if(!/^№ \d{5}\.$/.test(permanent.textContent))issue('identifier punctuation');
          if(Math.abs(id.left-c.left)>.6)issue('condition indent');
          if([...content.querySelectorAll(':scope>p')].some(p=>Math.abs(bounds(p).left-id.left)>.6))issue('paragraph indent');
          if(answer&&Math.abs(bounds(answer).left-id.left)>.6)issue('answer line indent');
        }
        proof.tasks.push({number,page:page+1,rect:relative(bounds(entry)),mark:relative(b),permanent:permanent?.textContent||''});
      }
      if(figure){
        const drawing=bounds(figure);
        if(textBoxes(content).some(box=>overlap(box,drawing)))issue('condition intersects illustration');
        if(answer&&textBoxes(answer).concat([...answer.querySelectorAll('span,i')].map(bounds)).some(box=>overlap(box,drawing)))issue('answer intersects illustration');
        if(!inside(drawing,bounds(area)))issue('figure outside the printable area');
      }
      for(const math of entry.querySelectorAll('math')){
        const box=bounds(math.getAttribute('display')==='block'?math.firstElementChild:math);
        if(!inside(box,bounds(area)))issue('formula clipped at page edge');
      }
      for(const rad of entry.querySelectorAll('msqrt'))proof.roots.push({number,page:page+1,box:relative(bounds(rad)),base:relative(bounds(rad.firstElementChild)),expression:rad.closest('math').getAttribute('aria-label')});
      for(const item of entry.querySelectorAll('.qw-answer-item')){
        const ordinal=item.querySelector('.qw-print-number'), answerText=item.querySelector('.qw-answer-text');
        const boxes=textBoxes(answerText), a=bounds(answerText), n=bounds(ordinal);
        if(getComputedStyle(ordinal).fontWeight!=='700'||getComputedStyle(answerText).fontWeight!=='400')issue('incorrect key weight');
        if([...answerText.querySelectorAll('b,strong,math,mn,mi,mo')].some(node=>getComputedStyle(node).fontWeight!=='400'))issue('bold ink in answer');
        if(boxes.some(box=>box.left<a.left-1||box.left<n.right+.4))issue('wrapped answer under ordinal');
        const lines=new Set(boxes.map(box=>Math.round(box.top/3)));
        proof.brief.push({number:+item.dataset.answerNumber,width:n.width*pt,multipleLines:lines.size>1,leading:getComputedStyle(answerText).lineHeight});
      }
    }
  }
  return proof;
}

async function ready(page, selector) {
  await page.waitForFunction(selector => {
    const frame=document.querySelector(selector), doc=frame?.contentDocument;
    return !!frame?.dataset.ready && frame.dataset.ready===doc?.documentElement?.dataset.qwRender && doc?.body?.dataset.qwLayoutReady==='true';
  }, selector);
}

async function screenshot(page,name){
  assert.equal(await page.locator('html').getAttribute('data-qo-theme'),'light');
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('#toast.active').waitFor({state:'hidden'});
  await page.screenshot({path:path.join(out,'screenshots',name+'.png'),animations:'disabled'});
}

async function render(context,page,work,name,orientation,options){
  const html=await page.evaluate(({work,orientation,options})=>{
    work.printSettings.orientation=orientation;
    return qwPrintDocumentHTML(work,false,options);
  },{work,orientation,options});
  const surface=await context.newPage();
  try {
    await surface.setContent(html);
    await surface.evaluate(()=>window.qwPrintReady);
    assert.equal(await surface.evaluate(()=>window.__qwPrintError||null),null,name);
    await surface.emulateMedia({media:'print'});
    const proof=await surface.evaluate(inspectPrint);
    assert.deepEqual(proof.errors,[],`${name} geometry`);
    const features=await surface.evaluate(()=>({
      text:document.body.innerText, ordinal:document.querySelectorAll('.qw-task-marker').length,
      displayedRoot:document.querySelector('math')?document.fonts.check('10pt "QO Math"'):true,
      keyCaptions:[...document.querySelectorAll('.qw-answer-caption')].map(node=>({text:node.textContent,breaks:node.querySelectorAll('br').length})),
      rectangles:[...document.querySelectorAll('[data-task="14"] figure rect')].map(node=>[+node.getAttribute('width'),+node.getAttribute('height'),node.getAttribute('fill')]),
    }));
    assert.equal(features.displayedRoot,true);
    if(name.startsWith('pupil-')){
      assert.equal(features.ordinal,14);
      assert.equal(proof.tasks.find(item=>item.number===9).permanent,'№ 00809.');
      assert.deepEqual(features.rectangles,[[240,240,'#ffffff'],[100,100,'#e9e9e9']]);
      assert.doesNotMatch(features.text,/a₁ = 4|За первые 4 с путь/);
    }
    if(name==='key-brief'){
      assert.equal(proof.brief.length,14);
      assert.equal(new Set(proof.brief.map(row=>row.width)).size,1);
      assert.ok(proof.brief.some(row=>row.multipleLines));
      assert.equal(new Set(proof.brief.map(row=>row.leading)).size,1);
    }
    if(options.keyMode==='detailed'){
      assert.equal(features.keyCaptions.length,14);
      assert.ok(features.keyCaptions.every(({text,breaks})=>!breaks&&/^Ответ: [^\n]+$/.test(text)),JSON.stringify(features.keyCaptions));
      assert.ok(features.text.indexOf('За первые 4 с путь')<features.text.indexOf('Ответ: 18 м'));
    }
    await surface.pdf({path:path.join(out,name+'.pdf'),preferCSSPageSize:true,printBackground:true});
    return {name,...proof};
  }finally{await surface.close();}
}

async function main(){
  fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});
  const browser=await chromium.launch();const errors=[];
  try{
    const context=await browser.newContext({offline:true,colorScheme:'dark',viewport:{width:1500,height:950}});
    const page=await context.newPage(); page.on('pageerror',error=>errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root,'Quantum-Office.html')).href);
    assert.equal(await page.locator('html').getAttribute('data-qo-theme'),'light');
    await page.evaluate(rows=>{
      const tasks=rows.map(({type,subject='physics',graph,...values},i)=>{
        const task={...qwTask(type),...values,id:'bank023-task-'+(i+1)};
        if(graph)Object.assign(task.graph,graph);
        if(values.figureWidth)task.figureWidthMode='manual';
        return qwBankNormalize({id:'bank023-'+String(i+1).padStart(2,'0'),bankNumber:801+i,subject,grade:'11',part:'1',slot:String(i+1),task});
      });
      localStorage.setItem(QW_BANK_KEY,JSON.stringify(tasks));
    },samples);
    await page.locator('[data-action=launcher-bank]').click();
    const select=n=>page.locator(`[data-bank-view="${fixtureId(n)}"]`).click();
    const edit=n=>page.locator(`[data-bank-edit="${fixtureId(n)}"]`).click();
    await select(9);
    await page.locator('.qw-study-condition msqrt').waitFor();
    const card=await page.locator('.qw-study-task').evaluate(article=>{
      const id=article.querySelector('.qw-study-id'),marker=article.querySelector('.qw-task-marker'),body=article.querySelector('.qw-study-condition');
      const a=id.getBoundingClientRect(), b=marker.getBoundingClientRect(), c=body.getBoundingClientRect();
      return { id:id.textContent, delta:Math.abs((a.top+a.bottom-b.top-b.bottom)/2)*.75, square:Math.abs(b.width-b.height), next:c.top>b.bottom, indent:Math.abs(a.left-c.left) };
    });
    assert.equal(card.id,'№ 00809.');assert.ok(card.delta<=.5&&card.next&&card.indent<.6&&card.square<.08);
    await screenshot(page,'bank-card');
    await edit(9);await page.locator('[data-bank-live=prompt] msqrt').waitFor();await screenshot(page,'visual-editor');
    await action(page,'bank-edit-back').click();
    await select(1);await edit(1);await page.locator('[data-bank-publish-toggle]').click();
    await ready(page,'[data-bank-publish-frame]');
    const graphWidth=page.locator('[data-bank-publishing] [data-style-field=width]');
    await graphWidth.fill('28');
    await page.frameLocator('[data-bank-publish-frame]').locator('figure[data-publish-width="28"]').waitFor();
    await ready(page,'[data-bank-publish-frame]');
    const preview=await page.frameLocator('[data-bank-publish-frame]').locator('body').evaluate(inspectPrint);
    assert.deepEqual(preview.errors,[]);
    await screenshot(page,'figure-settings');
    await graphWidth.fill('34');await page.frameLocator('[data-bank-publish-frame]').locator('figure[data-publish-width="34"]').waitFor();
    await action(page,'bank-edit-back').click();

    const {work,archive}=await page.evaluate(async()=>{
      const archive=await qwBankRepository.createVerifiedBackup(), work=qwProject();
      work.title='Практикум по физике и математике';work.layout='booklet';
      work.printSettings=qwPrintSettings({fontPt:10,showTitle:true,showMeta:false,showVariant:false});
      work.tasks=archive.records.toSorted((a,b)=>a.bankNumber-b.bankNumber).map(row=>({...row.task,source:{kind:'bank',id:row.id,number:row.bankNumber}}));
      return {work:qwValidate(work),archive};
    });
    assert.equal(archive.count,14);
    assert.deepEqual(await page.evaluate(work=>qwValidate(JSON.parse(JSON.stringify(work))),work),work);
    fs.writeFileSync(path.join(out,'study.qwork'),JSON.stringify(work,null,2));
    fs.writeFileSync(path.join(out,'study.qwbank'),JSON.stringify(archive));
    const docs=[];
    docs.push(await render(context,page,work,'pupil-portrait','portrait',{format:'booklet'}));
    docs.push(await render(context,page,work,'pupil-landscape','landscape',{format:'booklet'}));
    docs.push(await render(context,page,work,'key-brief','portrait',{format:'answers',keyMode:'brief',includeNumbers:false}));
    docs.push(await render(context,page,work,'key-detailed','portrait',{format:'answers',keyMode:'detailed',includeCriteria:true}));
    docs.push(await render(context,page,work,'tasks-and-solutions','landscape',{format:'answers',keyMode:'detailed',includePrompt:true,includeCriteria:true}));

    const shapes=[
      String.raw`\sqrt{81}`,String.raw`\frac{\sqrt{81}+3^2}{2}`,String.raw`\sqrt{\frac{a_1^2+b_2^2}{c_3}}`,
      String.raw`\sqrt{1+\sqrt{\frac{x_2^2}{y_1^2}}}`,String.raw`\begin{cases}x_1=\sqrt{a^2+b^2} \\ y_2=\frac{\sqrt{81}}{2}\end{cases}`,
    ];
    const stress=await page.evaluate(({work,shapes})=>{
      const {tasks,printSettings}=work;
      work.title='Контроль математического набора';work.printSettings={...printSettings,fontPt:10};
      work.tasks=[{...tasks[1],prompt:'Высота обычной строки.'},...shapes.map((expression,i)=>({
        ...qwTask('short'),id:'check-'+i,prompt:'$$\n'+expression+'\n$$',answerVisible:false,source:{kind:'bank',id:'test'+i,number:98001+i},
      }))];return qwValidate(work);
    },{work,shapes});
    const proof=await render(context,page,stress,'math-raster-proof','portrait',{format:'booklet'});
    const squareSizes=proof.tasks.map(task=>[task.mark[2]-task.mark[0],task.mark[3]-task.mark[1]]);
    assert.ok(squareSizes.every(pair=>pair.every((size,i)=>Math.abs(size-squareSizes[0][i])<.05)));
    assert.ok(proof.roots.length>=7);
    docs.push(proof);
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify({card,preview:preview.maxCenterDeltaPt,docs},null,2));
    console.log('PASS numbering row ≤ 0.5 pt, figure/answer separation, MathML bounds, uniform brief key, figure inspector and five vector exports');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
