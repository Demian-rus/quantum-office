/* TASK096: real Chromium controls, AA contrast, themes, document isolation and responsive zoom matrix. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright'));
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence/task096');fs.mkdirSync(out,{recursive:true});
const url=pathToFileURL(path.join(root,'Quantum-Office.html')).href,results=[],matrix=[],contrast=[],errors=[];
const check=(name,data={})=>{results.push({name,pass:true,...data});console.log('PASS',name)};
function rgb(s){const a=s.match(/[\d.]+/g).map(Number);return a.slice(0,3)}
function lum(c){return c.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0)}
function ratio(a,b){const x=lum(rgb(a)),y=lum(rgb(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
async function settle(p){await p.waitForTimeout(150)}
async function computedContrast(p, selector) {
 return p.locator(selector).evaluateAll(nodes=>nodes.filter(e=>e.getClientRects().length).map(el=>{
  const rgba=s=>{const n=s.match(/[\d.]+/g)?.map(Number)||[0,0,0,0];return [...n.slice(0,3),n[3]??1]};
  const over=(a,b)=>[0,1,2].map(i=>a[i]*a[3]+b[i]*(1-a[3]));
  const chain=[];for(let e=el;e;e=e.parentElement)chain.push(e);
  let bg=[255,255,255];for(const e of chain.reverse())bg=over(rgba(getComputedStyle(e).backgroundColor),bg);
  const fg=over(rgba(getComputedStyle(el).color),bg);
  return {selector:el.className,fg:'rgb('+fg.join(',')+')',bg:'rgb('+bg.join(',')+')',text:el.textContent.trim().slice(0,60)};
 }));
}
async function colors(p,selector){return p.locator(selector).first().evaluate(el=>{const s=getComputedStyle(el);return {fg:s.color,bg:s.backgroundColor,border:s.borderTopColor,outline:s.outlineColor,outlineWidth:s.outlineWidth,outlineStyle:s.outlineStyle}})}
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.QO_CHROMIUM_PATH?{executablePath:process.env.QO_CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:1440,height:960},acceptDownloads:true});
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());await p.goto(url);
 await p.evaluate(()=>{
  createBook(false);transact(()=>{setCell(sheet(),'A1','Показатель');setCell(sheet(),'B1','Значение');setCell(sheet(),'A2','План');setCell(sheet(),'B2','240');setCell(sheet(),'A3','Факт');setCell(sheet(),'B3','195');setCell(sheet(),'B4','=B2-B3');});
  qoWriter.html='<h1>Рабочие заметки</h1><p>Quantum Office · образец оформления</p><h2>Пространство для работы</h2><p>Панели, инструменты и документ имеют разные визуальные роли. Акцент помогает находить активные команды.</p><ul><li>Единое оформление редакторов</li><li>Удобная навигация с клавиатуры</li></ul>';
  route('photo');qoPhotoLeftOpen=true;qoPhotoRightOpen=true;qoPhotoRefresh();
 });
 await p.locator('[data-action="photo-template"][data-template="minimal"]').click();
 await p.evaluate(()=>{qoPhotoSidebar='layers';qoPhotoSetSelection([qoPhotoStrokes[1].id]);qoPhotoRefresh();qoPhotoFit();});
 const state=()=>({book:encodeBook(book()),writer:qoWriter.html,slides:JSON.stringify({...qoSlides,updated:undefined}),studio:JSON.stringify(qoPhotoState())});
 const before=await p.evaluate(state);
 const flatPixels=()=>{const c=document.createElement('canvas');c.width=qoPhotoCanvasW;c.height=qoPhotoCanvasH;qoPhotoPaint(c.getContext('2d'));return c.toDataURL()};
 const originalPixels=await p.evaluate(flatPixels);
 for(const theme of ['light','dark'])for(const accent of ['green','blue','violet','amber']){
  await p.evaluate(({theme,accent})=>{qoThemePreference=theme;qoAccent=accent;qoApplyAppearance()},{theme,accent});await settle(p);
  const palette=await p.evaluate(()=>{const s=getComputedStyle(document.documentElement);return Object.fromEntries(['text','muted','surface','surface-alt','surface-raised','bg','accent','accent-soft','accent-border','accent-fill','on-accent','focus','selected-hover','hover','pressed','shell','shell-text','shell-muted','shell-accent','border-strong','danger','danger-soft','success','success-soft','warning','warning-soft'].map(n=>{const el=document.createElement('i');el.style.color=`var(--qo-${n})`;document.body.append(el);const v=getComputedStyle(el).color;el.remove();return [n,v]}))});
  const pairs=[...['surface','surface-alt','surface-raised','bg'].flatMap(bg=>[['text',bg,4.5],['muted',bg,4.5]]),['accent','accent-soft',4.5],['accent','selected-hover',4.5],['on-accent','accent-fill',4.5],['accent-border','accent-soft',3],['focus','surface',3],['shell-text','shell',4.5],['shell-muted','shell',4.5],['shell-accent','shell',3],['border-strong','surface',3],['danger','danger-soft',4.5],['success','success-soft',4.5],['warning','warning-soft',4.5]];
  for(const [fg,bg,min]of pairs){const r=ratio(palette[fg],palette[bg]);contrast.push({theme,accent,fg,bg,ratio:+r.toFixed(2),min});assert.ok(r>=min,`${theme}/${accent} ${fg}/${bg}: ${r}`)}
  await p.evaluate(()=>status('Проверка сообщения об ошибке',true));await p.waitForTimeout(200);const errorToast=await colors(p,'#toast');assert.ok(ratio(errorToast.fg,errorToast.bg)>=4.5);assert.equal(errorToast.fg,palette.danger);assert.equal(errorToast.bg,palette['danger-soft']);await p.evaluate(()=>document.getElementById('toast').classList.remove('active'));
  for(const module of ['sheet','writer','slides','photo']){
   await p.evaluate(m=>route(m),module);await settle(p);
   const selector={sheet:'.ribbon-tabs button.chosen',writer:'.qo-work-tab.active',slides:'.qo-work-tab.active',photo:'[data-action="photo-select-tool"]'}[module];
   const selected=await colors(p,selector);assert.ok(ratio(selected.fg,selected.bg)>=4.5,JSON.stringify({theme,accent,module,selected}));
   const samples=await computedContrast(p,'.group-name,.sheet-status,.qo-work-group-caption,.qo-work-field,.qo-slide-stage-top,.qo-inspector-header h3,.qo-slide-properties>label,.qs-inspector-label,.qs-adjust,.qs-side-section p,.qs-inspector-head small,.qs-layer-title,.qs-rail-btn');
   for(const sample of samples){const r=ratio(sample.fg,sample.bg);contrast.push({theme,accent,module,...sample,ratio:+r.toFixed(2),min:4.5});assert.ok(r>=4.5,JSON.stringify({theme,accent,module,...sample,ratio:r}));}
   if(module==='photo'){
    await p.mouse.move(1400,950);await settle(p);const def=await colors(p,selector);await p.locator(selector).hover();await settle(p);const hover=await colors(p,selector);assert.notEqual(def.bg,hover.bg);
    await p.mouse.down();await settle(p);const pressed=await colors(p,selector);await p.mouse.up();await settle(p);assert.notEqual(hover.bg,pressed.bg);
    await p.locator(selector).focus();await p.keyboard.press('Tab');await p.keyboard.press('Shift+Tab');const focused=await colors(p,selector);assert.equal(focused.outlineStyle,'solid');assert.equal(focused.outlineWidth,'2px');
   }
  }
  assert.deepEqual(await p.evaluate(state),before,'appearance mutated document content');assert.equal(await p.evaluate(flatPixels),originalPixels,'appearance recolored Studio artwork');
 }
 check('8 palettes: actual text, selected, primary, focus, status and boundary contrast', {pairs:contrast.length});
 check('32 editor/accent combinations and selected + hover + pressed + keyboard focus');
 check('themes do not change QBOOK, rich text, QSLIDES or QSTUDIO data');
 // Every editor, representative selected tool, open appearance menu, and a real dialog.
 for(const theme of ['light','dark'])for(const module of ['sheet','writer','slides','photo']){
  await p.evaluate(({theme,module})=>{qoThemePreference=theme;qoAccent=theme==='light'?'blue':'violet';qoApplyAppearance();route(module);if(module==='photo'){qoPhotoLeftOpen=true;qoPhotoRightOpen=true;qoPhotoSetSelection([qoPhotoStrokes[1].id]);qoPhotoRefresh();qoPhotoFit()}},{theme,module});
  await p.screenshot({path:path.join(out,`${module}-${theme}.png`)});
  await p.locator('.qo-theme-toggle').click();await p.screenshot({path:path.join(out,`${module}-${theme}-menu.png`)});await p.keyboard.press('Escape');assert.equal(await p.locator('#qo-appearance-menu').count(),0);
 }
 await p.evaluate(()=>route('sheet'));await p.locator('[data-action=help-open]').click();await p.screenshot({path:path.join(out,'sheet-dark-dialog.png')});await p.locator('[data-action=help-close]').click();
 check('4 editors: real light/dark screenshots, selected tools, menus and help dialog');
 // Theme UI: OS events, keyboard, outside click, choice and persisted preferences.
 await p.locator('.qo-theme-toggle').click();await p.locator('[data-appearance-theme=system]').click();
 await p.emulateMedia({colorScheme:'light'});await p.waitForFunction(()=>document.documentElement.dataset.qoTheme==='light');
 await p.emulateMedia({colorScheme:'dark'});await p.waitForFunction(()=>document.documentElement.dataset.qoTheme==='dark');
 await p.locator('.qo-theme-toggle').click();await p.locator('[data-appearance-accent=amber]').click();
 await p.reload();assert.equal(await p.locator('html').getAttribute('data-qo-accent'),'amber');assert.equal(await p.evaluate(()=>qoThemePreference),'system');
 await p.locator('.qo-theme-toggle').click();await p.locator('[data-appearance-theme=dark]').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#qo-appearance-menu').count(),0);
 await p.locator('.qo-theme-toggle').click();await p.locator('.module').first().click();assert.equal(await p.locator('#qo-appearance-menu').count(),0);
 check('system OS changes, keyboard selection, outside/Escape close and persistence');
 await ctx.close();
 // Desktop browser zoom is represented by equal physical area, reduced CSS viewport and matching DPR.
 for(const width of [1920,1440,1024,768])for(const zoom of [1,1.25,1.5])for(const theme of ['light','dark']){
  const cssWidth=Math.floor(width/zoom),height=Math.floor(960/zoom),c=await browser.newContext({viewport:{width:cssWidth,height},deviceScaleFactor:zoom});
  const q=await c.newPage();q.on('pageerror',e=>errors.push(e.message));await q.goto(url);let shell=[];
  for(const module of ['sheet','writer','slides','photo']){
   await q.evaluate(({module,theme})=>{qoThemePreference=theme;qoAccent=theme==='light'?'green':'amber';qoApplyAppearance();route(module);if(module==='photo'){qoPhotoLeftOpen=false;qoPhotoRightOpen=false;qoPhotoRefresh();qoPhotoFit()}},{module,theme});
   const g=await q.evaluate(()=>{const h=document.querySelector('.global-bar'),r=h.getBoundingClientRect(),name=h.querySelector('.shell-document').getBoundingClientRect(),nav=h.querySelector('.modules').getBoundingClientRect(),right=h.querySelector('.global-right').getBoundingClientRect();return {header:[r.x,r.y,r.width,r.height],title:[name.x,name.y,name.width,name.height],overflow:document.documentElement.scrollWidth>innerWidth,overlap:nav.right>name.left+.1||name.right>right.left+.1,body:document.querySelector('main').getBoundingClientRect().height,unnamed:[...h.querySelectorAll('button')].filter(b=>!b.getAttribute('aria-label')&&!b.getAttribute('title')&&!b.textContent.trim()).length}});
   if(module==='slides'){
    const font=await q.evaluate(()=>{const frame=document.querySelector('.qo-slide-stage .qo-slide-frame'),el=frame.querySelector('.qo-slide-text');return {actual:parseFloat(getComputedStyle(el).fontSize),expected:(qoSlide().items.find(i=>i.kind==='text').size/960)*frame.clientWidth}});assert.ok(Math.abs(font.actual-font.expected)<.2,JSON.stringify(font));
   }
   assert.equal(g.overflow,false);assert.equal(g.overlap,false);assert.equal(g.unnamed,0);assert.ok(g.body>200);assert.equal(g.header[3],40);shell.push([g.header,g.title]);matrix.push({width,zoom,cssWidth,theme,module,...g});
   if(module==='photo'&&cssWidth<=1100){
    await q.locator('[data-action=photo-toggle-left]').click();assert.equal(await q.locator('.qs-sidebar').isVisible(),true);
    await q.locator('[data-action=photo-toggle-right]').first().click();assert.equal(await q.locator('.qs-inspector').isVisible(),true);assert.equal(await q.locator('.qs-sidebar').isVisible(),false);
    const field=q.locator('#qo-photo-size');await field.focus();await q.keyboard.press('ArrowRight');assert.ok(await q.evaluate(()=>qoPhotoSize>7));
    await q.locator('[data-action=photo-toggle-right]').first().click();assert.equal(await q.locator('.qs-inspector').isVisible(),false);
   }
   if(width===768&&zoom===1.5&&['photo','slides'].includes(module))await q.screenshot({path:path.join(out,`${module}-${theme}-768-150.png`)});
  }
  assert.deepEqual(shell[0],shell[1]);assert.deepEqual(shell[0],shell[2]);assert.deepEqual(shell[0],shell[3]);await c.close();
 }
 check('96 layouts: 1920/1440/1024/768 × 100/125/150% equivalents × both themes × 4 editors', {layouts:matrix.length});
 check('fixed header/title geometry and narrow Studio inspector, keyboard sliders, panel switching');
 // Component catalog reuses production CSS, including real loading, disabled-selected, menu and modal.
 const c=await browser.newContext({viewport:{width:1200,height:900},acceptDownloads:true}),q=await c.newPage();await q.goto(pathToFileURL(path.join(root,'dist/components.html')).href);
 for(const theme of ['light','dark']){
  await q.locator('#catalog-theme').selectOption(theme);await q.locator('#catalog-accent').selectOption(theme==='light'?'green':'amber');await settle(q);
  const disabled=await colors(q,'.qo-control[disabled][aria-pressed=true]'),normal=await colors(q,'.qo-control[disabled]:not([aria-pressed])');assert.equal(disabled.bg,normal.bg);assert.equal(disabled.fg,normal.fg);
  await q.screenshot({path:path.join(out,`components-${theme}.png`),fullPage:true});
  await q.locator('#menu-trigger').click();assert.equal(await q.locator('#catalog-menu').isVisible(),true);await q.keyboard.press('Escape');assert.equal(await q.locator('#catalog-menu').isVisible(),false);
  await q.locator('#dialog-trigger').click();assert.equal(await q.locator('#catalog-dialog').isVisible(),true);await q.screenshot({path:path.join(out,`components-${theme}-dialog.png`)});await q.keyboard.press('Escape');
 }
 const download=q.waitForEvent('download');await q.locator('#export-tokens').click();const d=await download;await d.saveAs(path.join(out,'catalog-tokens.json'));assert.equal(Object.keys(JSON.parse(fs.readFileSync(path.join(out,'catalog-tokens.json'))).tokens).length,16);
 check('live production component catalog: states, menus, modal and token JSON export');await c.close();
 assert.deepEqual(errors,[]);check('no Chromium runtime errors');await browser.close();
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,matrix,contrast,errors,zoomMethod:'physical viewport / zoom, matching deviceScaleFactor; headless layout equivalent, not OS browser chrome'},null,2));console.log('COMPLETE',results.length,'checks;',matrix.length,'layouts;',contrast.length,'contrast pairs');
})().catch(e=>{console.error(e);process.exitCode=1});
