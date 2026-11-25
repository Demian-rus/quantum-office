import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/core/native-drafts-bootstrap.js',import.meta.url),'utf8');
const KEY='quantum-office.work-builder.v1',WRITER='quantum-office-writer-v1';
async function harness({legacy={},initial={},write,afterWrite,saveExport,waitForBoot=true}={}){
 const rows=structuredClone(initial),calls=[],nodes=new Map(),events={};let loaded=false,closed=false;
 const app={inert:false,textContent:''};nodes.set('app',app);
 const node=()=>({id:'',hidden:false,disabled:false,textContent:'',children:[],setAttribute(){},append(...items){this.children.push(...items);},remove(){nodes.delete(this.id);}});
 const register=n=>{nodes.set(n.id,n);for(const child of n.children||[])register(child);};
 const context=vm.createContext({TextEncoder,btoa,setTimeout,clearTimeout,document:{getElementById:id=>nodes.get(id),createElement:node,body:{prepend:register,append:()=>{loaded=true;}}},localStorage:{getItem:key=>legacy[key]??null},__TAURI__:{event:{listen:async(name,fn)=>{events[name]=fn;}},core:{invoke:async(command,args)=>{
  calls.push({command,args});
  if(command==='draft_load')return structuredClone(rows);
  if(command==='draft_close'){closed=true;return;}
  if(command==='save_export')return saveExport?saveExport(args):false;
  if(command==='draft_write'){
   if(write)await write(args,rows);
   const reply={};for(const change of args.changes){if((rows[change.key]?.revision??0)!==change.revision)throw Error('DRAFT_CONFLICT');rows[change.key]={revision:change.revision+1,value:change.value};reply[change.key]={revision:change.revision+1};}if(afterWrite)await afterWrite(args,rows);return reply;
  }
  throw Error(command);
 }}}});
 vm.runInContext(source,context);
 for(let i=0;waitForBoot&&i<50&&!loaded&&!app.textContent;i++)await new Promise(r=>setTimeout(r,2));
 return {context,rows,calls,events,app,nodes,loaded:()=>loaded,closed:()=>closed};
}
test('desktop bootstrap copies absent legacy values, retains source and native tombstones',async()=>{
 const legacy={[KEY]:'legacy actual draft',[WRITER]:'do not resurrect'},initial={[WRITER]:{revision:3,value:null}};
 const h=await harness({legacy,initial});assert.equal(h.loaded(),true);assert.equal(h.context.qoDraftStorage.getItem(KEY),legacy[KEY]);assert.equal(h.context.qoDraftStorage.getItem(WRITER),null);
 assert.equal(h.calls.find(x=>x.command==='draft_write').args.changes[0].migration,true);
 h.context.qoDraftStorage.setItem(KEY,'updated');assert.equal(h.context.qoDraftStorage.pending,true);await h.context.qoDraftStorage.flush();assert.equal(h.rows[KEY].value,'updated');assert.equal(legacy[KEY],'legacy actual draft');
});
test('desktop close waits for acknowledgement and rejects a failed write',async()=>{
 let release,fail=false;
 const h=await harness({write:async()=>{await new Promise(r=>{release=r;});if(fail)throw Error('write denied');}});
 h.context.qoDraftStorage.setItem(KEY,'pending');h.events['qo-draft-close']();
 assert.equal(h.closed(),false);assert.equal(h.app.inert,true);fail=true;release();
 for(let i=0;i<30&&!h.context.qoDraftStorage.error;i++)await new Promise(r=>setTimeout(r,2));
 assert.equal(h.closed(),false);assert.equal(h.app.inert,false);assert.match(h.context.qoDraftStorage.error,/write denied/);assert.equal(h.context.qoDraftStorage.pending,true);
 fail=false;h.events['qo-draft-close']();release();
 for(let i=0;i<30&&!h.closed();i++)await new Promise(r=>setTimeout(r,2));
 assert.equal(h.closed(),true);assert.equal(h.rows[KEY].value,'pending');
});
test('desktop failed native startup never starts default editors',async()=>{
 const h=await harness({legacy:{[KEY]:'retained'},write:async()=>{throw Error('disk full');}});
 assert.equal(h.loaded(),false);assert.match(h.app.textContent,/disk full/);assert.equal(h.rows[KEY],undefined);
});

async function until(predicate){for(let i=0;i<100&&!predicate();i++)await new Promise(r=>setTimeout(r,2));assert.ok(predicate(),'Timed out waiting for draft state');}
test('close during legacy migration waits for durable write',async()=>{
 let release;
 const h=await harness({legacy:{[KEY]:'legacy'},waitForBoot:false,write:()=>new Promise(r=>{release=r;})});
 await until(()=>!!release);
 h.events['qo-draft-close']();
 assert.equal(h.closed(),false);assert.equal(h.app.inert,true);
 release();await until(h.closed);
 assert.equal(h.rows[KEY].value,'legacy');assert.equal(h.rows[KEY].revision,1);
});
test('lost acknowledgement is recovered only for the exact committed revision',async()=>{
 let lost=true;
 const h=await harness({afterWrite:()=>{if(lost){lost=false;throw Error('IPC disconnected after commit');}}});
 h.context.qoDraftStorage.setItem(KEY,'first');await h.context.qoDraftStorage.flush();
 assert.equal(h.rows[KEY].revision,1);assert.equal(h.context.qoDraftStorage.pending,false);
 h.context.qoDraftStorage.setItem(KEY,'second');await h.context.qoDraftStorage.flush();
 assert.equal(h.rows[KEY].revision,2);assert.equal(h.rows[KEY].value,'second');
});
test('a newer edit during write is committed in a following revision',async()=>{
 let release,count=0;
 const h=await harness({write:()=>{if(++count===1)return new Promise(r=>{release=r;});}});
 h.context.qoDraftStorage.setItem(KEY,'first');const pending=h.context.qoDraftStorage.flush();
 h.context.qoDraftStorage.setItem(KEY,'second');release();await pending;
 assert.equal(h.rows[KEY].revision,2);assert.equal(h.rows[KEY].value,'second');assert.equal(h.context.qoDraftStorage.pending,false);
});
test('external revision conflict retains the unsaved local value and does not overwrite disk',async()=>{
 const h=await harness({initial:{[KEY]:{revision:1,value:'original'}}});
 h.rows[KEY]={revision:2,value:'other instance'};
 h.context.qoDraftStorage.setItem(KEY,'my edit');
 await assert.rejects(h.context.qoDraftStorage.flush(),/DRAFT_CONFLICT/);
 assert.equal(h.rows[KEY].value,'other instance');assert.equal(h.context.qoDraftStorage.getItem(KEY),'my edit');assert.equal(h.context.qoDraftStorage.pending,true);
});

test('conflicted draft can be exported exactly before close; cancelling does not close',async()=>{
 let allow=false;
 const h=await harness({initial:{[KEY]:{revision:1,value:'original'}},saveExport:()=>allow});
 h.rows[KEY]={revision:2,value:'other instance'};
 h.context.qoDraftStorage.setItem(KEY,'my unsaved edit — физика');
 await assert.rejects(h.context.qoDraftStorage.flush(),/DRAFT_CONFLICT/);
 const button=h.nodes.get('qo-native-draft-recovery');
 assert.equal(button.hidden,false);
 button.onclick();await until(()=>!button.disabled);
 assert.equal(h.closed(),false);assert.equal(h.app.inert,false);assert.equal(h.context.qoDraftStorage.pending,true);
 allow=true;button.onclick();await until(h.closed);
 const saves=h.calls.filter(c=>c.command==='save_export');
 assert.equal(saves.length,2);
 const copy=JSON.parse(Buffer.from(saves[1].args.data,'base64').toString('utf8'));
 assert.equal(copy.format,'quantum-office-draft-recovery');
 assert.deepEqual(copy.entries,[{key:KEY,revision:1,value:'my unsaved edit — физика'}]);
 assert.equal(h.rows[KEY].value,'other instance');
});

test('native draft notifications are quiet during pending and ACK, persistent on failure, deduplicated and recoverable',async()=>{
 let fail=true;
 const h=await harness({write:()=>{if(fail)throw Error('test write denied');}});
 const notice=h.nodes.get('qo-native-draft-notice'),banner=h.nodes.get('qo-native-draft-status'),retry=h.nodes.get('qo-native-draft-retry'),recovery=h.nodes.get('qo-native-draft-recovery');
 assert.equal(notice.hidden,true);assert.equal(h.context.qoDraftStatusSummary(),'Черновик сохранён');
 h.context.qoDraftStorage.setItem(KEY,'changed');
 assert.equal(notice.hidden,true);assert.equal(h.context.qoDraftStatusSummary(),'Запись…');
 await assert.rejects(h.context.qoDraftStorage.flush(),/test write denied/);
 assert.equal(notice.hidden,false);assert.match(banner.textContent,/test write denied/);assert.equal(retry.hidden,false);assert.equal(recovery.hidden,false);
 assert.equal(h.context.qoDraftStatusSummary(),'Ошибка записи');
 let notifications=0;h.context.qoDraftStatusChanged=()=>notifications++;
 await assert.rejects(h.context.qoDraftStorage.flush(),/test write denied/);
 assert.equal(notifications,0,'same problem must not produce repeated status announcements');
 fail=false;retry.onclick();await until(()=>!h.context.qoDraftStorage.pending);
 assert.equal(notice.hidden,true);assert.equal(recovery.hidden,true);assert.equal(retry.hidden,true);
 assert.equal(h.rows[KEY].value,'changed');assert.equal(h.context.qoDraftStatusSummary(),'Черновик сохранён');
});

test('native editor decline does not flush, destroy, change the working copy or report a storage error',async()=>{
 const h=await harness();let allow=false,asked=0,flushed=0;
 h.context.qoCanCloseEditors=()=>{asked++;return allow;};
 h.context.qoFlushForClose=()=>{flushed++;h.context.qoDraftStorage.setItem(KEY,'confirmed durable edit');};
 h.events['qo-draft-close']();
 assert.equal(asked,1);assert.equal(flushed,0);assert.equal(h.app.inert,false);assert.equal(h.closed(),false);assert.equal(h.context.qoDraftStorage.error,'');
 allow=true;h.events['qo-draft-close']();await until(h.closed);
 assert.equal(asked,2);assert.equal(flushed,1);assert.equal(h.rows[KEY].value,'confirmed durable edit');
});
test('recovery and close checks editor guard before exporting, cancel retains real error and pending data',async()=>{
 let allow=false,exported=0;
 const h=await harness({write:()=>{throw Error('real disk failure');},saveExport:()=>{exported++;return true;}});
 h.context.qoDraftStorage.setItem(KEY,'exact recovery data');await assert.rejects(h.context.qoDraftStorage.flush(),/real disk failure/);
 h.context.qoCanCloseEditors=()=>allow;
 const button=h.nodes.get('qo-native-draft-recovery');button.onclick();
 assert.equal(exported,0);assert.equal(h.closed(),false);assert.equal(h.app.inert,false);assert.equal(button.disabled,false);assert.equal(h.context.qoDraftStorage.error,'real disk failure');assert.equal(h.context.qoDraftStorage.getItem(KEY),'exact recovery data');
 allow=true;button.onclick();await until(h.closed);assert.equal(exported,1);
 const copy=JSON.parse(Buffer.from(h.calls.find(c=>c.command==='save_export').args.data,'base64').toString('utf8'));assert.equal(copy.entries[0].value,'exact recovery data');
});

test('education panel preferences are allowed, migrated only when absent, ACKed and kept separate from QWORK',async()=>{
 const key='quantum-office.education-panels.v1',legacy={[key]:'{"pdf":{"left":254,"hideLeft":false}}'};
 const h=await harness({legacy,initial:{[KEY]:{revision:2,value:'existing QWORK'}}});
 const storage=h.context.qoDraftStorage;assert.equal(h.loaded(),true);assert.equal(storage.getItem(key),legacy[key]);
 assert.equal(h.rows[key].revision,1);assert.equal(h.calls.find(c=>c.command==='draft_write').args.changes[0].migration,true);
 const value='{"pdf":{"left":286,"hideLeft":true}}';storage.setItem(key,value);assert.equal(storage.getItem(key),value);assert.equal(storage.pending,true);await storage.flush();
 assert.equal(storage.pending,false);assert.equal(storage.error,'');assert.deepEqual(h.rows[key],{revision:2,value});assert.equal(h.rows[KEY].value,'existing QWORK');
 assert.throws(()=>storage.setItem(key+'.unknown','bad'),/Недопустимый ключ/);assert.throws(()=>storage.getItem(key+'.unknown'),/Недопустимый ключ/);assert.throws(()=>storage.removeItem(key+'.unknown'),/Недопустимый ключ/);
 const reopened=await harness({legacy,initial:h.rows});assert.equal(reopened.context.qoDraftStorage.getItem(key),value);assert.equal(reopened.calls.filter(c=>c.command==='draft_write').length,0);
 const tombstone=await harness({legacy,initial:{[key]:{revision:3,value:null}}});assert.equal(tombstone.context.qoDraftStorage.getItem(key),null);assert.equal(tombstone.calls.filter(c=>c.command==='draft_write').length,0);
});
test('education panel asynchronous write failures remain visible and retryable',async()=>{
 const key='quantum-office.education-panels.v1';let fail=true;
 const h=await harness({write:()=>{if(fail)throw Error('settings disk denied');}}),storage=h.context.qoDraftStorage;
 storage.setItem(key,'{"pdf":{"left":286}}');await assert.rejects(storage.flush(),/settings disk denied/);
 assert.equal(storage.pending,true);assert.match(storage.error,/settings disk denied/);assert.equal(h.nodes.get('qo-native-draft-notice').hidden,false);
 fail=false;await storage.flush();assert.equal(storage.pending,false);assert.equal(storage.error,'');assert.equal(h.rows[key].value,'{"pdf":{"left":286}}');
});
test('panel preference synchronous write rejection is observable, not a success',()=>{
 const source=readFileSync(new URL('../src/core/work-builder.js',import.meta.url),'utf8');
 const block=source.slice(source.indexOf('const QW_PANELS_KEY='),source.indexOf('function qwInstallPanels('));
 let warnings=[],messages=[],raw=null,fail=true;
 const context=vm.createContext({console:{warn:(...v)=>warnings.push(v)},status:(...v)=>messages.push(v),localStorage:{getItem:()=>raw,setItem:(k,v)=>{if(fail)throw Error('denied');raw=v;}}});
 vm.runInContext(block,context);
 assert.equal(vm.runInContext("qwSavePanelPreference('pdf',{left:286,hideLeft:true})",context),false);assert.equal(messages.length,1);assert.equal(messages[0][1],true);assert.equal(warnings.length,1);assert.equal(raw,null);
 fail=false;assert.equal(vm.runInContext("qwSavePanelPreference('pdf',{left:286,hideLeft:true})",context),true);assert.equal(JSON.parse(raw).pdf.left,286);
});
