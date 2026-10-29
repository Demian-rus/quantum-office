"""TASK044: actual Ctrl+Enter range typing + rollback of failed transactions."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1400,'height':860},accept_downloads=True)
 page.set_default_timeout(20000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 def select(rng):
  box=page.locator('#name-box');box.fill(rng);box.press('Enter')
 def check(ref):
  return page.evaluate('(ref)=>getCell(sheet(),ref).value',ref)
 select('B2:C3')
 page.keyboard.type('Урок')
 assert page.locator('.cell-editor').is_visible()
 page.locator('.cell-editor').press('Control+Enter')
 page.wait_for_function("getCell(sheet(),'C3').value==='Урок'")
 for ref in ('B2','C2','B3','C3'):assert check(ref)=='Урок',ref
 assert page.evaluate("document.activeElement?.id")== 'grid-scroll'
 # One undo covers all four cells; redo brings all four back.
 page.keyboard.press('Control+z')
 assert all(check(ref)=='' for ref in ('B2','C2','B3','C3'))
 page.keyboard.press('Control+y')
 assert all(check(ref)=='Урок' for ref in ('B2','C2','B3','C3'))
 # Bulk fill formulas through the real editor, with relative translation.
 select('B6:C7')
 page.keyboard.type('=')
 page.locator('.cell-editor').fill('=D6+$F$1')
 page.locator('.cell-editor').press('Control+Enter')
 assert check('B6')=='=D6+$F$1'
 assert check('C6')=='=E6+$F$1'
 assert check('B7')=='=D7+$F$1'
 assert check('C7')=='=E7+$F$1'
 # A rejected partial mutation must preserve the entire workbook, history,
 # dirty status and the previous redo stack.
 state=page.evaluate("""()=>{
  const b=book(),old=JSON.stringify(b),undos=undoStacks.get(b.id)?.length||0;
  try{transact(()=>{setCell(sheet(),'Z100','partial');throw Error('simulated failure');});}
  catch(e){if(e.message!=='simulated failure')throw e;}
  return {same:JSON.stringify(book())===old,
    old:sheet().cells.Z100?.value||'',
    undosBefore:undos,undosAfter:undoStacks.get(b.id)?.length||0};
 }""")
 assert state['same'] and state['old']=='' and state['undosBefore']==state['undosAfter'],state
 # Clear after a success and undo once, then a failed edit must not erase Redo.
 select('B2');page.keyboard.press('Delete')
 page.keyboard.press('Control+z')
 redo=page.evaluate("""()=>{
  const b=book(),id=b.id,stackBefore=redoStacks.get(id).length,snapshot=JSON.stringify(b);
  try{transact(()=>{setCell(sheet(),'Z99','bad');throw Error('aborted');});}
  catch(e){if(e.message!=='aborted')throw e;}
  return {stackBefore,stackAfter:redoStacks.get(id).length,identical:snapshot===JSON.stringify(book()),bad:sheet().cells.Z99};
 }""")
 assert redo['stackBefore']>0 and redo['stackBefore']==redo['stackAfter'] and redo['identical'] and not redo['bad'],redo
 page.keyboard.press('Control+y')
 assert check('B2')==''
 # Ctrl+Enter must fail on merged selections without touching contents.
 page.evaluate("""()=>{mergeCells(sheet(),'D10','E10');setSelection('C10','E10');}""")
 before=page.evaluate("JSON.stringify(sheet().cells)")
 page.keyboard.type('Запрещено')
 page.locator('.cell-editor').press('Control+Enter')
 assert page.evaluate('JSON.stringify(sheet().cells)')==before
 assert 'объединённые' in page.locator('#toast').inner_text()
 assert not errors,errors
 print('PASS TASK044: Ctrl+Enter typed range, shifted formulas, one-step Undo/Redo, transaction rollback and merged rejection')
 browser.close()
