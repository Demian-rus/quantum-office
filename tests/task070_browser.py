"""TASK070 Chromium: physical fill handle drag, series/formulas/styles, Ctrl+Z and XLSX."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1580,'height':960})
 page.set_default_timeout(25000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 page.evaluate("""()=>{
  for(const [ref,value] of Object.entries({
   B2:'2',B3:'5',F2:'6',G2:'=F2',
   A10:'1',B10:'3',D15:'plain'
  }))setCell(sheet(),ref,value);
  changed();
 }""")
 def select(a,b=None):
  box=page.locator('#name-box');box.fill(a+(':'+b if b else ''));box.press('Enter')
 def drag_to(ref):
  handle=page.locator('#grid-fill-handle')
  assert handle.is_visible(),handle.get_attribute('style')
  h=handle.bounding_box();assert h
  target=page.locator('.grid-cell[data-ref="'+ref+'"]').first
  assert target.is_visible()
  rect=target.bounding_box()
  page.mouse.move(h['x']+h['width']/2,h['y']+h['height']/2)
  page.mouse.down()
  page.mouse.move(rect['x']+rect['width']*.5,rect['y']+rect['height']*.5,steps=8)
  assert target.evaluate("e=>e.classList.contains('fill-preview')") is True
  page.mouse.up()
 select('B2','B3')
 drag_to('B6')
 assert [page.evaluate(f"getCell(sheet(),'{a}').value") for a in ['B4','B5','B6']]==['8','11','14']
 assert page.locator('#grid-fill-handle').is_visible()
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
 assert page.evaluate("getCell(sheet(),'B4').value")==''
 page.keyboard.press('Control+y')
 assert page.evaluate("getCell(sheet(),'B6').value")=='14'
 select('G2')
 drag_to('G5')
 assert [page.evaluate(f"getCell(sheet(),'{a}').value") for a in ['G3','G4','G5']]==['=F3','=F4','=F5']
 select('A10','B10')
 drag_to('E10')
 assert [page.evaluate(f"getCell(sheet(),'{a}').value") for a in ['C10','D10','E10']]==['5','7','9']
 select('D15')
 drag_to('D17')
 assert [page.evaluate(f"getCell(sheet(),'{a}').value") for a in ['D16','D17']]==['plain','plain']
 # Ctrl click to select disjoint cells hides the handle rather than corrupting unrelated cells.
 page.locator('.grid-cell[data-ref="B2"]').first.click()
 page.locator('.grid-cell[data-ref="D15"]').first.click(modifiers=['Control'])
 assert page.locator('#grid-fill-handle').is_hidden()
 # QBOOK/XLSX are durable, selection handle is session-only.
 output=page.evaluate("""async()=>{
  const b=book(),before=JSON.stringify(b),q=decodeBook(encodeBook(b));
  if(q.sheets[0].cells.G5.value!=='=F5')throw Error('QBOOK lost autofilled formula');
  const bytes=await exportXLSX(b);if(before!==JSON.stringify(b))throw Error('XLSX export mutated workbook');
  const report={},again=await importXLSX(bytes,'Автозаполнение.xlsx',report);
  const s=again.sheets[0];
  if(s.cells.G5.value!=='=F5'||s.cells.B6.value!=='14'||s.cells.E10.value!=='9')
   throw Error('Excel roundtrip lost mouse-filled cells');
  return true;
 }""")
 assert output is True
 assert not errors,errors
 browser.close()
 print('PASS TASK070: real fill-handle mouse drag series/formulas/right/down, preview, Undo/Redo, QBOOK and XLSX')
