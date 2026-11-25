/* Actual WebView2 input; evidence is written even on assertion failure. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
async function checkNativePdfDock(page,out){
 const report={status:'RUNNING',commit:process.env.GITHUB_SHA,events:[]},file=path.join(out,'native-dock-keyboard.json');
 const save=()=>{fs.writeFileSync(file,JSON.stringify(report,null,2));console.log('TASK1673_NATIVE_DOCK '+JSON.stringify(report));};
 const selector='#qw-dialog [data-qw-dock-resize="left"]',divider=page.locator(selector),toggle=page.locator('#qw-dialog [data-qw-dock-toggle="left"]');
 const measure=()=>page.evaluate(selector=>{
  const h=document.querySelector(selector),d=h.closest('#qw-dialog'),p=d.querySelector('.qw-pdf-design'),r=h.parentElement,b=d.querySelector('[data-qw-dock-toggle="left"]');
  const box=e=>{const v=e.getBoundingClientRect();return {x:v.x,y:v.y,width:v.width,height:v.height,right:v.right,bottom:v.bottom};};
  const describe=e=>({tag:e?.tagName,id:e?.id,classes:e?.className,resize:e?.dataset?.qwDockResize,insideEditor:!!e?.closest?.('#qw-dialog')});
  return {preference:qwPanelPreference('pdf'),stored:qoDraftStorage.getItem(QW_PANELS_KEY),legacyStored:localStorage.getItem(QW_PANELS_KEY),pending:qoDraftStorage.pending,storageError:qoDraftStorage.error,panel:box(p),divider:box(h),workspace:box(r),active:describe(document.activeElement),dividerFocused:document.activeElement===h,hasFocus:document.hasFocus(),visibility:document.visibilityState,viewport:{width:innerWidth,height:innerHeight,outerWidth,outerHeight,dpr:devicePixelRatio,visualWidth:visualViewport?.width,visualHeight:visualViewport?.height,visualScale:visualViewport?.scale},expanded:b.getAttribute('aria-expanded'),valueNow:h.getAttribute('aria-valuenow'),valueMin:h.getAttribute('aria-valuemin'),valueMax:h.getAttribute('aria-valuemax'),track:getComputedStyle(r).gridTemplateColumns,declared:r.style.getPropertyValue('--qw-dock-left'),events:globalThis.__qoNativeDockEvents||[]};
 },selector);
 const confirmDisk=async snapshot=>page.evaluate(async raw=>{
  if(typeof raw!=='string')throw Error('Missing native panel preference value');
  await qoDraftStorage.flush();if(qoDraftStorage.pending||qoDraftStorage.error)throw Error('Panel ACK not confirmed: '+qoDraftStorage.error);
  const row=(await __TAURI__.core.invoke('draft_load'))[QW_PANELS_KEY];
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))),b=>b.toString(16).padStart(2,'0')).join('');
  if(!row||row.value!==raw||row.sha256!==digest||!Number.isInteger(row.revision)||row.revision<1)throw Error('SQLite panel preference row differs from ACKed storage');
  return {revision:row.revision,sha256:row.sha256,legacySha256:row.legacySha256,value:row.value,acknowledged:true};
 },snapshot.stored);
 try{
  await divider.waitFor({state:'visible'});
  report.beforeCollapse=await measure();report.beforeDisk=await confirmDisk(report.beforeCollapse);await toggle.click();assert.equal(await page.locator('#qw-dialog .qw-pdf-design').isVisible(),false);
  report.collapsed=await measure();assert.equal(report.collapsed.expanded,'false');assert.equal(report.collapsed.preference.hideLeft,true);assert.equal(report.collapsed.panel.width,0);report.collapsedDisk=await confirmDisk(report.collapsed);assert.equal(report.collapsedDisk.revision,report.beforeDisk.revision+1);
  await toggle.click();await divider.waitFor({state:'visible'});
  report.restored=await measure();assert.equal(report.restored.expanded,'true');assert.equal(report.restored.preference.hideLeft,false);
  assert.equal(report.restored.preference.left,report.beforeCollapse.preference.left);assert.equal(report.restored.panel.width,report.beforeCollapse.panel.width);report.restoredDisk=await confirmDisk(report.restored);assert.equal(report.restoredDisk.revision,report.collapsedDisk.revision+1);
  // Activate the actual installed process, not a replacement page. CDP
  // bringToFront plus locator focus/press address WebView focus separately.
  const pid=Number(process.env.QO_NATIVE_PID);assert.ok(Number.isSafeInteger(pid)&&pid>0);
  const command="$p=Get-Process -Id "+pid+"; $s=New-Object -ComObject WScript.Shell; $activated=$s.AppActivate($p.Id); Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class QODockFocus { [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow(); [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p); }'; [uint32]$foreground=0; $null=[QODockFocus]::GetWindowThreadProcessId([QODockFocus]::GetForegroundWindow(),[ref]$foreground); @{activated=$activated;foregroundPid=$foreground;targetPid=$p.Id}|ConvertTo-Json -Compress";
  const native=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',timeout:15000});
  report.nativeFocus={status:native.status,stdout:native.stdout?.trim(),stderr:native.stderr?.trim(),error:native.error?.message};assert.equal(native.status,0,JSON.stringify(report.nativeFocus));
  await page.bringToFront();
  await page.evaluate(selector=>{
   const h=document.querySelector(selector);globalThis.__qoNativeDockEvents=[];
   const record=(phase,e)=>{globalThis.__qoNativeDockEvents.push({phase,key:e.key,code:e.code,shift:e.shiftKey,trusted:e.isTrusted,target:e.target===h?'divider':e.target?.tagName,prevented:e.defaultPrevented,focus:document.activeElement===h,hasFocus:document.hasFocus()});};
   document.addEventListener('keydown',e=>record('capture',e),true);
   h.addEventListener('keydown',e=>record('divider',e));
  },selector);
  await divider.focus();report.beforeKey=await measure();save();
  assert.ok(report.beforeKey.dividerFocused,'separator did not receive DOM focus');
  // Use the actual displayed width and responsive 40vw limit. Do not
  // assume the OS outer window size is equal to the WebView CSS viewport.
  const before=report.beforeKey,step=32,min=Number(before.valueMin),max=Number(before.valueMax),cap=Math.max(min,Math.min(max,before.viewport.width*.4));
  const direction=before.panel.width+step<=cap+.01?1:-1;
  const expected=Math.round(Math.max(min,Math.min(max,before.panel.width+direction*step)));
  report.action={key:direction===1?'Shift+ArrowRight':'Shift+ArrowLeft',step,direction,expectedPreference:expected,visibleCap:cap,expectedWidth:Math.min(cap,expected)};
  assert.ok(Math.abs(report.action.expectedWidth-before.panel.width)>=8,'viewport provides no measurable resize room');
  assert.notEqual(expected,before.preference.left,'chosen keyboard action must change saved preference');
  await divider.press(report.action.key);
  report.afterKey=await measure();report.events=report.afterKey.events;save();
  await page.waitForFunction(({expected})=>qwPanelPreference('pdf').left===expected,{expected},{timeout:3000});
  report.afterSettled=await measure();report.events=report.afterSettled.events;
  const after=report.afterSettled;
  assert.ok(after.events.some(e=>e.phase==='divider'&&e.key===(direction===1?'ArrowRight':'ArrowLeft')&&e.shift&&e.trusted&&e.focus&&e.prevented),'trusted Shift+Arrow key did not reach focused divider handler');
  assert.equal(after.preference.left,expected);assert.equal(after.preference.hideLeft,false);assert.equal(after.expanded,'true');assert.equal(Number(after.valueNow),expected);
  assert.equal(JSON.parse(after.stored).pdf.left,expected,'preference must really be persisted');
  assert.ok(direction*(after.panel.width-before.panel.width)>=8,'visible width did not change in the requested direction');
  assert.ok(Math.abs(after.panel.width-report.action.expectedWidth)<=2,'actual width differs from responsive track');
  assert.ok(Math.abs((after.divider.x-before.divider.x)-(after.panel.width-before.panel.width))<=2,'separator must track visible panel edge');
  report.keyboardDisk=await confirmDisk(after);assert.equal(report.keyboardDisk.revision,report.restoredDisk.revision+1);assert.equal(after.legacyStored,report.beforeCollapse.legacyStored,'legacy browser preference must not be overwritten');
  report.status='PASS';return after.preference;
 }catch(e){report.status='FAIL';report.error=String(e);try{report.failure=await measure();report.events=report.failure.events;}catch{}throw e;}
 finally{save();try{await page.screenshot({path:path.join(out,'native-dock-keyboard-'+report.status.toLowerCase()+'.png')});}catch{}}
}
module.exports={checkNativePdfDock};
