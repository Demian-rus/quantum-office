"""TASK039: actual UI Save, Save As, direct open, conflict, failures, per-book handles."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':860},accept_downloads=True)
 page.set_default_timeout(20000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.evaluate("""()=>{
  const mk=(raw='')=>({
   raw,writes:0,closed:0,aborted:0,fail:false,
   async getFile(){return {size:new TextEncoder().encode(this.raw).length,text:async()=>this.raw}},
   async createWritable(){
    const h=this;let value;
    return {
     async write(v){if(h.fail)throw Error('simulated disk fault');value=v;h.writes++},
     async close(){h.raw=value;h.closed++},
     async abort(){h.aborted++}
    };
   }
  });
  window.fakeDrive={a:mk(),b:mk(),c:mk(),bad:mk('invalid'),queue:[],opened:[]};
  window.showSaveFilePicker=async()=>window.fakeDrive.queue.shift();
  window.showOpenFilePicker=async()=>[window.fakeDrive.opened.shift()];
 }""")
 def select(ref):
  field=page.locator('#name-box');field.fill(ref);field.press('Enter')
 def write(ref,value):
  select(ref);field=page.locator('#formula-input');field.fill(value);field.press('Enter')
 def state():
  return page.evaluate("""()=>({
   id:book().id,name:book().name,values:book().sheets[0].cells,
   marker:document.getElementById('storage-indicator')?.textContent
  })""")
 page.locator('[data-action=new]').first.click()
 write('A1','Книга A')
 a_id=state()['id']
 assert 'Черновик' in state()['marker']
 page.evaluate('fakeDrive.queue.push(fakeDrive.a)')
 page.locator('[data-action=save]').first.click()
 page.wait_for_function('fakeDrive.a.closed===1')
 assert page.evaluate('decodeBook(fakeDrive.a.raw).sheets[0].cells.A1.value')=='Книга A'
 page.wait_for_function("document.querySelector('#storage-indicator')?.textContent?.includes('Файл проверен на диске')")
 write('A1','Версия A2')
 assert 'не сохранено на диск' in state()['marker']
 page.locator('[data-action=save]').first.click()
 page.wait_for_function('fakeDrive.a.closed===2')
 assert page.evaluate('decodeBook(fakeDrive.a.raw).sheets[0].cells.A1.value')=='Версия A2'
 page.wait_for_function("document.querySelector('#storage-indicator')?.textContent?.includes('Файл проверен на диске')")
 # Switching books must never reuse A's handle.
 page.get_by_role('button',name='Обзор').click()
 page.locator('[data-action=new]').first.click()
 write('A1','Книга Б')
 b_id=state()['id']
 page.evaluate('fakeDrive.queue.push(fakeDrive.b)')
 page.locator('[data-action=save]').first.click()
 page.wait_for_function('fakeDrive.b.closed===1')
 assert page.evaluate('fakeDrive.a.closed')==2
 assert page.evaluate('decodeBook(fakeDrive.b.raw).sheets[0].cells.A1.value')=='Книга Б'
 # External edit must block saving without overwriting.
 page.evaluate("fakeDrive.b.raw=encodeBook(newWorkbook('Внешний файл'))")
 write('B2','Меняю')
 page.locator('[data-action=save]').first.click()
 page.wait_for_function("(needle)=>document.querySelector('#toast')?.textContent?.includes(needle)",arg='изменён')
 assert page.evaluate('fakeDrive.b.closed')==1
 assert page.evaluate('decodeBook(fakeDrive.b.raw).name')=='Внешний файл'
 page.get_by_role('tab',name='Файл').click()
 page.evaluate('fakeDrive.queue.push(fakeDrive.c)')
 page.get_by_role('button',name='Сохранить как').click()
 page.wait_for_function('fakeDrive.c.closed===1')
 assert page.evaluate("decodeBook(fakeDrive.c.raw).sheets[0].cells.B2.value")=='Меняю'
 assert page.evaluate('decodeBook(fakeDrive.b.raw).name')=='Внешний файл'
 # A's original linked handle is still selected after switching back.
 page.get_by_role('button',name='Обзор').click()
 page.locator(f'[data-action=open][data-id="{a_id}"]').click()
 write('B2','Продолжение A')
 page.locator('[data-action=save]').first.click()
 page.wait_for_function('fakeDrive.a.closed===3')
 assert page.evaluate('decodeBook(fakeDrive.a.raw).sheets[0].cells.B2.value')=='Продолжение A'
 assert page.evaluate('fakeDrive.c.closed')==1
 # Failed write cannot claim success or implicitly download a new file.
 page.evaluate('fakeDrive.a.fail=true')
 write('C3','Нельзя потерять')
 page.locator('[data-action=save]').first.click()
 page.wait_for_function("(needle)=>document.querySelector('#toast')?.textContent?.includes(needle)",arg='simulated disk fault')
 assert page.evaluate('fakeDrive.a.closed')==3
 assert 'не сохранено на диск' in state()['marker']
 page.evaluate('fakeDrive.a.fail=false')
 # Open the actual linked QBOOK as a distinct workspace book and roundtrip.
 page.get_by_role('tab',name='Файл').click()
 page.evaluate('fakeDrive.opened.push(fakeDrive.a)')
 page.get_by_role('button',name='Открыть с диска').click()
 page.wait_for_function('(previous)=>book().id!==previous',arg=a_id)
 opened=state()
 assert opened['id']!=a_id and opened['values']['B2']['value']=='Продолжение A',opened
 assert 'проверен на диске' in opened['marker'],opened
 write('C3','Из дискового файла')
 page.locator('[data-action=save]').first.click()
 page.wait_for_function('fakeDrive.a.closed===4')
 assert page.evaluate('decodeBook(fakeDrive.a.raw).sheets[0].cells.C3.value')=='Из дискового файла'
 # Broken file is never injected into workspace.
 page.get_by_role('tab',name='Файл').click()
 count=page.evaluate('workspace.books.length')
 page.evaluate('fakeDrive.opened.push(fakeDrive.bad)')
 page.get_by_role('button',name='Открыть с диска').click()
 assert page.evaluate('workspace.books.length')==count
 assert page.evaluate('book().id')==opened['id']
 assert not errors,errors
 print('PASS TASK039: two files, verified save, conflicts, Save As, failure, direct open and corrupt-file refusal')
 browser.close()
