/* Compact diagnostics desktop contract: geometry and usable internal content. */
const assert=require('node:assert/strict');
async function checkDiagnosticDocks(page){
 const measured=await page.evaluate(()=>{
  const root=document.querySelector('#qo-diag-root'),frame=root.querySelector('.qd-workbench');
  const panels=['.qd-topic-navigator','.qd-workbench-main','.qd-side-insights'].map(s=>root.querySelector(s));
  const rect=e=>{const b=e.getBoundingClientRect(),c=getComputedStyle(e);return {left:b.left,right:b.right,width:b.width,padding:[parseFloat(c.paddingLeft),parseFloat(c.paddingRight)],client:e.clientWidth,scroll:e.scrollWidth,font:parseFloat(c.fontSize)};};
  return {frame:rect(frame),panels:panels.map(rect),viewport:innerWidth,overflow:document.documentElement.scrollWidth,
   controls:panels.flatMap(panel=>[...panel.querySelectorAll('button,input,select,textarea')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').map(el=>{const r=el.getBoundingClientRect(),p=panel.getBoundingClientRect();return {name:el.getAttribute('aria-label')||el.textContent.trim().slice(0,60)||el.id||el.tagName,width:r.width,height:r.height,inside:r.left>=p.left-2&&r.right<=p.right+2};}))};
 });
 const [left,center,right]=measured.panels;
 assert.ok(left.right<=center.left+1&&center.right<=right.left+1,'panels must not overlap');
 assert.ok(Math.abs(center.width-(right.left-left.right))<=2,'center fills space between rails');
 assert.ok(Math.abs(left.left-measured.frame.left)<=2&&Math.abs(right.right-measured.frame.right)<=2,'rails occupy frame edges');
 assert.ok(left.width>=170&&right.width>=240&&center.width>=600,'usable panel widths');
 for(const panel of measured.panels){assert.ok(panel.padding.every(x=>x>=6),'internal breathing room retained');assert.ok(panel.font>=10,'readable base font');assert.ok(panel.scroll<=panel.client+2,'panel horizontal overflow '+JSON.stringify(panel));}
 assert.ok(measured.overflow<=measured.viewport+3,'no document horizontal overflow');
 assert.ok(measured.controls.length>0&&measured.controls.every(c=>c.inside&&c.width>0&&c.height>0),'controls must fit their panels '+JSON.stringify(measured.controls.filter(c=>!c.inside||!c.width||!c.height)));
 return measured;
}
module.exports={checkDiagnosticDocks};
