"""TASK069 Chromium: disjoint Ctrl+Enter, Ctrl+D/R, correct formulas, Undo and XLSX."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1560,'height':960},accept_downloads=True)
 page.set_default_timeout(20000);errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 page.evaluate("""()=>{
  for(const [k,v] of Object.entries({
   A2:'10',C4:'20',A6:'5',C6:'9',B6:'=A6',D6:'=C6',
   B11:'red',B13:'blue'
  }))setCell(sheet(),k,v);changed();
 }""")
 # Actual Ctrl+click noncontiguous cells and Enter in the active editor.
 cell=lambda ref:page.locator('.grid-cell[data-ref="'+ref+'"]').first
 cell('B2').click()
 cell('D4').click(modifiers=['Control'])
 assert 'Областей: 2' in page.locator('#selection-stats').inner_text()
 page.keyboard.press('F2')
 editor=page.locator('.cell-editor')
 editor.fill('=C4')
 editor.press('Control+Enter')
 assert page.evaluate("getCell(sheet(),'B2').value")=='=A2'
 assert page.evaluate("getCell(sheet(),'D4').value")=='=C4'
 assert page.evaluate("getCell(sheet(),'C3').value")==''
 page.locator('#grid-scroll').focus()
 page.keyboard.press('Control+z')
 assert page.evaluate("getCell(sheet(),'B2').value")==''
 assert page.evaluate("getCell(sheet(),'D4').value")==''
 page.keyboard.press('Control+y')
 assert page.evaluate("getCell(sheet(),'D4').value")=='=C4'
 # Ctrl+D across two nonadjacent rectangles; preserve their original values and relative references.
 page.evaluate("setSelection('B6','B8');addSelection('D6','D8');")
 assert 'Областей: 2' in page.locator('#selection-stats').inner_text()
 page.locator('#grid-scroll').focus()
 page.keyboard.press('Control+d')
 assert [page.evaluate(f"getCell(sheet(),'{ref}').value") for ref in ['B7','B8','D7','D8']]==['=A7','=A8','=C7','=C8']
 page.keyboard.press('Control+z')
 assert page.evaluate("getCell(sheet(),'B7').value")==''
 assert page.evaluate("getCell(sheet(),'D8').value")==''
 # Ctrl+R independent regions and Undo.
 page.evaluate("setSelection('B11','D11');addSelection('B13','D13');")
 page.locator('#grid-scroll').focus()
 page.keyboard.press('Control+r')
 for ref in ['C11','D11']: assert page.evaluate(f"getCell(sheet(),'{ref}').value")=='red'
 for ref in ['C13','D13']: assert page.evaluate(f"getCell(sheet(),'{ref}').value")=='blue'
 page.keyboard.press('Control+z')
 assert page.evaluate("getCell(sheet(),'C11').value")==''
 # Atomic rollback when a selected cell has validation constraints.
 page.evaluate("""()=>{
  const s=sheet();
  s.validations=[{id:'rule69',kind:'list',from:'F4',to:'F4',options:['yes','okay']}];
  setSelection('B4');addSelection('F4');
 }""")
 cell('F4').click(modifiers=['Control']) if False else None
 page.keyboard.press('F2')
 page.locator('.cell-editor').fill('bad')
 page.locator('.cell-editor').press('Control+Enter')
 assert page.evaluate("getCell(sheet(),'B4').value")==''
 assert page.evaluate("getCell(sheet(),'F4').value")==''
 assert 'Недопустимое значение' in page.locator('#toast').inner_text()
 page.locator('.cell-editor').fill('yes')
 page.locator('.cell-editor').press('Control+Enter')
 assert page.evaluate("getCell(sheet(),'B4').value")=='yes'
 assert page.evaluate("getCell(sheet(),'F4').value")=='yes'
 # Export must retain values and formula references after disjoint operations.
 output=page.evaluate("""async()=>{
  const before=JSON.stringify(book()),b=book(),q=decodeBook(encodeBook(b));
  if(q.sheets[0].cells.B2.value!=='=A2')throw Error('QBOOK lost translated formula');
  const bytes=await exportXLSX(b);
  if(JSON.stringify(book())!==before)throw Error('XLSX export mutated source');
  const report={},again=await importXLSX(bytes,'Selection.xlsx',report);
  if(again.sheets[0].cells.D4.value!=='=C4'||again.sheets[0].cells.F4.value!=='yes')
   throw Error('XLSX lost selected cells');
  return {ok:true};
 }""")
 assert output['ok']
 assert not errors,errors
 browser.close()
 print('PASS TASK069: multirange Ctrl+Enter, two-direction fill, formula refs, rollback, history and files')
