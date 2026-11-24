import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/core/native-drafts-bootstrap.js',import.meta.url),'utf8');
const KEY='quantum-office.work-builder.v1',WRITER='quantum-office-writer-v1';
async function harness({legacy={},initial={},write}={}){
 const rows=structuredClone(initial),calls=[],nodes=new Map(),events={};let loaded=false,closed=false;
 const app={inert:false,textContent:''};nodes.set('app',app);
 const node=()=>({id:'',hidden:false,textContent:'',setAttribute(){}});
 const context=vm.createContext({TextEncoder,setTimeout,clearTimeout,document:{getElementById:id=>nodes.get(id),createElement:node,body:{prepend:n=>nodes.set(n.id,n),append:()=>{loaded=true;}}},localStorage:{getItem:key=>legacy[key]??null},__TAURI__:{event:{listen:async(name,fn)=>{events[name]=fn;}},core:{invoke:async(command,args)=>{
  calls.push({command,args});
  if(command==='draft_load')return structuredClone(rows);
  if(command==='draft_close'){closed=true;return;}
  if(command==='draft_write'){
   if(write)await write(args,rows);
   const reply={};for(const change of args.changes){if((rows[change.key]?.revision??0)!==change.revision)throw Error('DRAFT_CONFLICT');rows[change.key]={revision:change.revision+1,value:change.value};reply[change.key]={revision:change.revision+1};}return reply;
  }
  throw Error(command);
 }}}});
 vm.runInContext(source,context);
 for(let i=0;i<50&&!loaded&&!app.textContent;i++)await new Promise(r=>setTimeout(r,2));
 return {context,rows,calls,events,app,loaded:()=>loaded,closed:()=>closed};
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
