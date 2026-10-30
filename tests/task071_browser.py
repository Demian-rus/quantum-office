"""TASK071 Chromium: physical up/left dragging, date sequences and auto-scroll."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1580,'height':960})
 page.set_default_timeout(25000)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 page.evaluate("""()=>{
  for(const [ref,value] of Object.entries({
   B4:'2',B5:'5',E9:'10',F9:'15',C12:'=B12+$A$1',
   B19:'1',B20:'3'
  }))setCell(sheet(),ref,value);
  setTypedCell(sheet(),'H4','2028-03-01');
  changed();
 }""")
 def select(start,end=None):
  box=page.locator('#name-box')
  box.fill(start+(':'+end if end else ''))
  box.press('Enter')
 def drag(ref):
  handle=page.locator('#grid-fill-handle')
  assert handle.is_visible()
  h=handle.bounding_box()
  target=page.locator('.grid-cell[data-ref="'+ref+'"]').first
  assert target.is_visible()
  t=target.bounding_box()
  page.mouse.move(h['x']+h['width']/2,h['y']+h['height']/2)
  page.mouse.down()
  page.mouse.move(t['x']+t['width']/2,t['y']+t['height']/2,steps=12)
  assert target.evaluate("e=>e.classList.contains('fill-preview')")
  page.mouse.up()
 select('B4','B5')
 drag('B2')
 assert page.evaluate("getCell(sheet(),'B2').value")=='-4'
 assert page.evaluate("getCell(sheet(),'B3').value")=='-1'
 page.locator('#grid-scroll').focus()
 page.keyboard.press('Control+z')
 assert page.evaluate("getCell(sheet(),'B2').value")==''
 page.keyboard.press('Control+y')
 assert page.evaluate("getCell(sheet(),'B2').value")=='-4'
 select('E9','F9')
 drag('C9')
 assert page.evaluate("getCell(sheet(),'D9').value")=='5'
 assert page.evaluate("getCell(sheet(),'C9').value")=='0'
 select('C12')
 drag('C10')
 assert page.evaluate("getCell(sheet(),'C10').value")=='=B10+$A$1'
 select('H4')
 drag('H2')
 assert page.evaluate("getCell(sheet(),'H3').value===String(dateSerial(2028,2,29))")
 # Viewport-edge scroll continues the gesture rather than ending at the last visible row.
 select('B19','B20')
 handle=page.locator('#grid-fill-handle')
 assert handle.is_visible()
 h=handle.bounding_box()
 view=page.locator('#grid-scroll')
 v=view.bounding_box()
 page.mouse.move(h['x']+h['width']/2,h['y']+h['height']/2)
 page.mouse.down()
 page.mouse.move(h['x']+h['width']/2,min(951,v['y']+v['height']+30),steps=12)
 page.wait_for_timeout(650)
 scrolled=page.evaluate("document.getElementById('grid-scroll').scrollTop")
 assert scrolled>0,scrolled
 page.mouse.up()
 assert page.evaluate("getCell(sheet(),'B21').value")=='5'
 assert page.evaluate("decodeBook(encodeBook(book())).sheets[0].cells.B21.value")=='5'
 assert not errors,errors
 browser.close()
 print('PASS TASK071: mouse up/left/formulas/date, Undo/Redo, viewport auto-scroll and QBOOK')
