const assert=require('node:assert/strict');
async function checkBankLifecycle(p,id,dialogDecision){
 const action=k=>p.locator('[data-qw-action="'+k+'"]');
 const route=k=>p.locator('.global-bar [data-target="'+k+'"]').click();
 const prompt=p.locator('[data-bank-task-field="prompt"]');
 const original=await p.evaluate(async id=>JSON.parse(JSON.stringify(await qwBankRepository.getTask(id))),id);
 const unchanged=async()=>assert.deepEqual(await p.evaluate(async id=>JSON.parse(JSON.stringify(await qwBankRepository.getTask(id))),id),original);
 const edit=async()=>{await p.locator('[data-bank-view="'+id+'"]').click();await p.locator('.qw-bank-preview-actions [data-bank-edit="'+id+'"]').click();await p.locator('[data-bank-source]').click();await prompt.waitFor();};
 const graph=async()=>{await p.locator('[data-bank-visual="graph"]').click();await p.locator('#qw-visual-stage').waitFor();};
 await route('bank');await edit();
 // A genuinely unchanged transaction must leave without asking.
 let count=dialogDecision.count;await action('bank-edit-back').click();await p.locator('[data-bank-view="'+id+'"]').waitFor();assert.equal(dialogDecision.count,count);
 await edit();await prompt.fill('TASK167.3 unsaved parent condition');
 const sameEditor=async()=>{const token=await p.locator('#qw-dialog').evaluate(el=>el.dataset.lifecycleProbe='original');const count=dialogDecision.count;await route('bank');assert.equal(dialogDecision.count,count,'active tab must not ask to discard');assert.equal(await p.locator('#qw-dialog').getAttribute('data-lifecycle-probe'),token,'active tab must keep original editor DOM');assert.ok(await p.evaluate(()=>qwActiveEditorDirty()),'transaction must stay dirty');await unchanged();};
 await sameEditor();assert.equal(await prompt.inputValue(),'TASK167.3 unsaved parent condition');await graph();
 await action('visual-cancel').click();await prompt.waitFor();assert.equal(await prompt.inputValue(),'TASK167.3 unsaved parent condition');
 dialogDecision.accept=false;count=dialogDecision.count;await route('diagnostics');assert.equal(dialogDecision.count,count+1);assert.equal(await prompt.inputValue(),'TASK167.3 unsaved parent condition');await unchanged();
 await graph();count=dialogDecision.count;await route('diagnostics');assert.equal(dialogDecision.count,count+1);assert.ok(await p.locator('#qw-visual-stage').isVisible());await unchanged();
 await action('visual-cancel').click();await prompt.waitFor();assert.equal(await prompt.inputValue(),'TASK167.3 unsaved parent condition');
 // Confirm global discard from child; the old parent must not reopen.
 await graph();dialogDecision.accept=true;count=dialogDecision.count;await route('diagnostics');assert.equal(dialogDecision.count,count+1);await p.locator('#qo-diag-root').waitFor();await p.locator('#qw-dialog').waitFor({state:'detached'});await unchanged();
 await route('bank');await p.locator('[data-bank-view="'+id+'"]').waitFor();assert.equal(await prompt.count(),0,'discarded parent must not reopen');
 await edit();await graph();
 if(await p.locator('#qw-graph-preset').isVisible()===false)await p.locator('[data-visual-panel="tools"]').click();
 await p.locator('#qw-graph-preset').selectOption('v');await action('visual-apply').click();await prompt.waitFor();
 const previewToggle=p.locator('[data-bank-preview-toggle="prompt"]');await previewToggle.click();
 const rendered=p.locator('#qw-bank-edit-preview');await rendered.locator('svg[viewBox]').first().waitFor();
 const preview=await rendered.innerHTML();await sameEditor();assert.equal(await rendered.innerHTML(),preview,'applied graph remains in working copy');
 await previewToggle.click();
 dialogDecision.accept=false;count=dialogDecision.count;await route('diagnostics');assert.equal(dialogDecision.count,count+1);assert.ok(await prompt.isVisible());await unchanged();
 await prompt.fill('TASK167.3 explicitly saved bank condition');dialogDecision.accept=true;await action('bank-edit-save').click();await p.locator('[data-bank-view="'+id+'"]').waitFor();
 const saved=await p.evaluate(async id=>JSON.parse(JSON.stringify(await qwBankRepository.getTask(id))),id);
 assert.equal(saved.revision,original.revision+1);assert.equal(saved.task.prompt,'TASK167.3 explicitly saved bank condition');assert.equal(saved.task.figure,'graph');assert.match(saved.task.graph.ylabel,/v/);
 await edit();count=dialogDecision.count;await route('diagnostics');assert.equal(dialogDecision.count,count);assert.ok(await p.locator('#qo-diag-root').isVisible());
 return {status:'PASS',originalRevision:original.revision,savedRevision:saved.revision,confirmedRoutes:dialogDecision.count};
}
module.exports={checkBankLifecycle};
