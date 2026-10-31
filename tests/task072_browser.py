"""TASK072: actual Chromium checkboxes, fonts, scroll position and whole-sheet sizes."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1580,'height':960})
 page.set_default_timeout(25000)
 errors=[]
 page.on('pageerror',lambda err:errors.append(str(err)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 def select(ref):
  box=page.locator('#name-box')
  box.fill(ref)
  box.press('Enter')
 # Workbook model has separate virtual coordinates well past the viewport.
 select('B240:C240')
 page.evaluate("document.querySelector('#grid-scroll').scrollTop=6100")
 page.wait_for_timeout(150)
 before=page.evaluate("document.querySelector('#grid-scroll').scrollTop")
 assert before>1000,before
 page.locator('[data-action=merge-cells]').first.click()
 after=page.evaluate("document.querySelector('#grid-scroll').scrollTop")
 assert abs(after-before)<60,(before,after)
 assert page.evaluate("sheet().merges.some(m=>m.from==='B240'&&m.to==='C240')")
 # Clicking a check box changes the actual value and one Ctrl+Z undoes it.
 select('D245')
 page.locator('[data-action=ribbon][data-target=insert]').first.click()
 page.locator('[data-action=insert-checkbox]').first.click()
 assert page.evaluate("getCell(sheet(),'D245').value")== '☐'
 tick=page.locator('.grid-cell[data-ref="D245"] .cell-checkbox')
 assert tick.is_visible()
 tick.click()
 assert page.evaluate("getCell(sheet(),'D245').value")== '☑'
 page.locator('#grid-scroll').focus()
 page.keyboard.press('Control+z')
 assert page.evaluate("getCell(sheet(),'D245').value")== '☐'
 # Real font selector and text size, with QBOOK and XLSX persistence.
 select('E246')
 page.locator('[data-action=ribbon][data-target=home]').first.click()
 page.locator('#font-family-select').select_option('Georgia')
 page.locator('#font-size-select').select_option('16')
 assert page.evaluate("getCell(sheet(),'E246').style.fontFamily")=='Georgia'
 assert page.evaluate("getCell(sheet(),'E246').style.fontSize")==16
 assert page.locator('.grid-cell[data-ref="E246"]').get_attribute('style').find('Georgia')>=0
 # Right click full-sheet corner, then set default row height and column width.
 page.locator('#grid-corner').click()
 page.locator('#grid-corner').click(button='right')
 page.locator('[data-action=size-context-mode][data-kind=row]').click()
 page.locator('#size-context-number').fill('35')
 page.locator('[data-action=size-context-apply]').click()
 assert page.evaluate("sheet().defaultRowHeight")==35
 assert page.evaluate("Object.keys(sheet().rowHeights).length")==0
 page.locator('#grid-corner').click(button='right')
 page.locator('[data-action=size-context-mode][data-kind=col]').click()
 page.locator('#size-context-number').fill('146')
 page.locator('[data-action=size-context-apply]').click()
 assert page.evaluate("sheet().defaultColumnWidth")==146
 assert page.evaluate("Object.keys(sheet().columnWidths).length")==0
 # Individual adjustments still work, and whole-sheet operation is atomic.
 select('A4')
 page.locator('.rowhead[data-index="3"]').first.click(button='right')
 page.locator('#size-context-number').fill('50')
 page.locator('[data-action=size-context-apply]').click()
 assert page.evaluate("sheet().rowHeights['3']")==50
 assert page.evaluate("sheet().defaultRowHeight")==35
 roundtrip=page.evaluate("""async()=>{
  const b=book(),q=decodeBook(encodeBook(b));
  if(q.sheets[0].cells.E246.style.fontFamily!=='Georgia')throw Error('QBOOK font');
  if(q.sheets[0].cells.D245.value!=='☐')throw Error('QBOOK checkbox');
  const exported=await exportXLSX(b),again=await importXLSX(exported,'task072.xlsx',{});
  if(again.sheets[0].cells.E246.style.fontFamily!=='Georgia')throw Error('XLSX font lost');
  if(again.sheets[0].cells.D245.value!=='☐')throw Error('XLSX checkbox lost');
  return true;
 }""")
 assert roundtrip
 assert not errors,errors
 browser.close()
 print('PASS TASK072: checkbox click/undo, font XLSX, merged scroll position, default and individual sizes')
