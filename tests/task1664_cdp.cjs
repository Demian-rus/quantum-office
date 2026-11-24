/* Only attach to the real, local Tauri release WebView2 on disposable GitHub CI. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const out=path.join(__dirname,'..','evidence','native');
async function connectNative(stage){
 if(process.env.GITHUB_ACTIONS!=='true'||process.platform!=='win32')throw Error('Disposable Windows CI only');
 fs.mkdirSync(out,{recursive:true});const report={stage,attempts:[]},file=path.join(out,'cdp-'+stage+'.json'),endpoint='http://127.0.0.1:9222';
 const save=()=>fs.writeFileSync(file,JSON.stringify(report,null,2));
 for(let i=0;i<60;i++){
  const attempt={i,at:new Date().toISOString()};report.attempts.push(attempt);
  try{
   for(const name of ['version','list']){
    const response=await fetch(endpoint+'/json/'+name,{signal:AbortSignal.timeout(2000)});
    if(!response.ok)throw Error('CDP '+name+' HTTP '+response.status);
    const data=await response.json();attempt[name]=name==='list'?data.map(({id,type,url,title})=>({id,type,url,title})):data;
   }
   const browser=await chromium.connectOverCDP(endpoint,{timeout:5000});
   const pages=browser.contexts().flatMap(c=>c.pages());attempt.pages=pages.map(p=>p.url());
   for(const page of pages){
    if(!/^(https?:\/\/tauri\.localhost(?:\/|$)|tauri:\/\/localhost(?:\/|$))/.test(page.url()))continue;
    const identity=await page.evaluate(()=>({url:location.href,marker:!!document.querySelector('meta[name="quantum-office-native"]'),ipc:typeof globalThis.__TAURI__?.core?.invoke,ready:document.readyState,secure:isSecureContext}));
    attempt.identity=identity;
    if(identity.marker&&identity.ipc==='function'){report.status='PASS';save();console.log('CDP connected',JSON.stringify(identity));return {browser,page};}
   }
   attempt.error='CDP reachable, no native marker + IPC on Tauri origin';
  }catch(e){attempt.error=String(e);attempt.cause=String(e.cause||'');}
  save();if(i%5===0)console.log('CDP diagnostic',JSON.stringify(attempt));await new Promise(r=>setTimeout(r,1000));
 }
 report.status='FAIL';save();throw Error('Native CDP unavailable: '+JSON.stringify(report.attempts.slice(-3)));
}
module.exports={connectNative};
