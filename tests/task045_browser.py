"""TASK045 — keyboard Ctrl+X/Ctrl+V cuts only after a verified atomic paste."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1500,'height':900})
 page.set_default_timeout(20000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 def select(ref):
  n=page.locator('#name-box');n.fill(ref);n.press('Enter')
 def value(ref):return page.evaluate('(ref)=>getCell(sheet(),ref).value',ref)
 # Real source selection, clipboard fallback and no destructive effect on cut.
 page.evaluate("""()=>{
  setCell(sheet(),'A1','Original');
  setCell(sheet(),'B1','Second');
  setStyle(sheet(),'A1',{bg:'#aaccff',bold:true});
 }""")
 select('A1:B1')
 page.keyboard.press('Control+x')
 page.wait_for_function("internalClipboard?.mode==='cut'")
 assert value('A1')=='Original' and value('B1')=='Second'
 assert page.evaluate('undoStacks.get(book().id)?.length||0')==0
 select('D4')
 page.keyboard.press('Control+v')
 page.wait_for_function("getCell(sheet(),'D4').value==='Original'")
 assert value('A1')=='' and value('B1')==''
 assert value('D4')=='Original' and value('E4')=='Second'
 assert page.evaluate("getCell(sheet(),'D4').style.bg")=='#aaccff'
 assert page.evaluate("internalClipboard===null")
 page.keyboard.press('Control+z')
 assert value('A1')=='Original' and value('B1')=='Second'
 assert value('D4')=='' and value('E4')==''
 page.keyboard.press('Control+y')
 assert value('D4')=='Original' and value('E4')=='Second'
 # Move overlapping source/destination without erasing the captured source.
 page.evaluate("setCell(sheet(),'A6','overlap 1');setCell(sheet(),'B6','overlap 2')")
 select('A6:B6')
 page.keyboard.press('Control+x')
 select('B6')
 page.keyboard.press('Control+v')
 page.wait_for_function("getCell(sheet(),'C6').value==='overlap 2'")
 assert value('A6')=='' and value('B6')=='overlap 1'
 # A failed move never clears source, writes destination or consumes cut.
 page.evaluate("setCell(sheet(),'A10','keep')")
 select('A10');page.keyboard.press('Control+x')
 page.evaluate("setCell(sheet(),'A10','edited since cut')")
 select('B10');page.keyboard.press('Control+v')
 assert value('A10')=='edited since cut' and value('B10')==''
 assert page.evaluate("internalClipboard?.mode")=='cut'
 assert 'изменились' in page.locator('#toast').inner_text()
 # A completely merged region may be moved as a unit with one Undo.
 page.evaluate("""()=>{
  setCell(sheet(),'F10','MERGED');
  mergeCells(sheet(),'F10','G10');
 }""")
 select('F10:G10')
 page.keyboard.press('Control+x')
 select('I10')
 page.keyboard.press('Control+v')
 page.wait_for_function("getCell(sheet(),'I10').value==='MERGED'")
 assert page.evaluate("sheet().merges.some(m=>m.from==='I10'&&m.to==='J10')")
 assert not page.evaluate("sheet().merges.some(m=>m.from==='F10')")
 page.keyboard.press('Control+z')
 assert page.evaluate("sheet().merges.some(m=>m.from==='F10'&&m.to==='G10')")
 assert value('F10')=='MERGED'
 # A dependent formula outside the cut source must be protected.
 page.evaluate("""()=>{
  setCell(sheet(),'A20','value');
  setCell(sheet(),'Z20','=A20*2');
 }""")
 select('A20');page.keyboard.press('Control+x')
 select('E20');page.keyboard.press('Control+v')
 assert value('A20')=='value' and value('E20')==''
 assert 'ссылаются формулы' in page.locator('#toast').inner_text()
 assert not errors,errors
 print('PASS TASK045: deferred cut, atomic paste, overlap, undo redo, stale guard, merge, dependent formulas')
 browser.close()
