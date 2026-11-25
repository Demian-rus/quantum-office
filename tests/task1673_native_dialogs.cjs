/* Single owner for real WebView2 JavaScript dialogs. */
const fs=require('node:fs'),assert=require('node:assert/strict');
function createDialogOwner(context,file){
 const records=[],pending=new Set(),decision={accept:false,count:0};
 let expected=null,failure=null,enabled=false;
 const save=()=>fs.writeFileSync(file,JSON.stringify({status:failure?'FAIL':'RECORDED',ownerCount:1,records,error:failure?.message??null},null,2));
 function onDialog(dialog){
  const ticket=expected;expected=null;
  const row={index:++decision.count,type:dialog.type(),message:dialog.message(),scenario:ticket?.scenario??'editor navigation',decision:(ticket?.accept??decision.accept)?'accept':'dismiss',status:'received',receivedAt:new Date().toISOString()};
  records.push(row);save();
  const task=(async()=>{
   try{
    const valid=enabled&&row.type==='confirm'&&(!ticket||ticket.pattern.test(row.message));
    if(!valid)row.decision='dismiss';
    await (row.decision==='accept'?dialog.accept():dialog.dismiss());
    row.status='handled';row.handledAt=new Date().toISOString();
    assert.ok(valid,'Unexpected dialog: '+JSON.stringify(row));
    if(ticket){clearTimeout(ticket.timer);ticket.resolve({...row});}
   }catch(e){row.status='FAIL';row.error=String(e);failure??=e;if(ticket){clearTimeout(ticket.timer);ticket.reject(e);}}
   finally{save();console.log('TASK1673_NATIVE_DIALOG '+JSON.stringify(row));}
  })();
  pending.add(task);void task.then(()=>pending.delete(task),e=>{pending.delete(task);failure??=e;save();});
 }
 context.on('dialog',onDialog);save();
 return {decision,records,enable(){enabled=true;},expect(scenario,accept,pattern){
  assert.equal(expected,null,'Only one native dialog may be awaited');
  assert.equal(pending.size,0,'Previous dialog must be handled first');
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{const e=Error('Expected native dialog not received: '+scenario);failure??=e;expected=null;save();reject(e);},15000);
   expected={scenario,accept,pattern,timer,resolve,reject};
  });
 },cancel(error){if(expected){const ticket=expected;expected=null;clearTimeout(ticket.timer);ticket.reject(error);}},async drain(){
  while(pending.size)await Promise.all([...pending]);if(failure)throw failure;
 },dispose(){context.off('dialog',onDialog);if(expected){clearTimeout(expected.timer);expected.reject(Error('Dialog owner disposed before response'));expected=null;}}};
}
module.exports={createDialogOwner};
