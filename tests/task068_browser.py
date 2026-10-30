"""TASK068: browser right-click sizing, Ctrl-multiselect rectangles, formatting and Undo."""
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
  for(const [ref,v] of Object.entries({
   B2:'12',C3:'100',D4:'8',A6:'22',A7:'24',B6:'10',B7:'6'
  }))setCell(sheet(),ref,v);
  changed();
 }""")
 cell=lambda ref:page.locator(f'.grid-cell[data-ref="{ref}"]').first
 page.get_by_role('tab',name='Главная').click()
 cell('B2').click()
 cell('D4').click(modifiers=['Control'])
 assert cell('B2').get_attribute('aria-selected')=='true'
 assert cell('D4').get_attribute('aria-selected')=='true'
 assert cell('C3').get_attribute('aria-selected')=='false'
 assert 'Областей: 2' in page.locator('#selection-stats').inner_text()
 # Format all disjoint positions, with a single Undo transaction.
 page.locator('[data-action=bold]').first.click()
 assert page.evaluate("getCell(sheet(),'B2').style.bold") is True
 assert page.evaluate("getCell(sheet(),'D4').style.bold") is True
 assert page.evaluate("getCell(sheet(),'C3').style.bold") is None or not page.evaluate("getCell(sheet(),'C3').style.bold")
 page.locator('#grid-scroll').focus()
 page.keyboard.press('Control+z')
 assert not page.evaluate("getCell(sheet(),'B2').style.bold")
 assert not page.evaluate("getCell(sheet(),'D4').style.bold")
 # Ctrl-drag adds an independently highlighted rectangle without filling the bounding box.
 cell('A6').click()
 page.keyboard.down('Control')
 cell('B6').hover()
 page.mouse.down()
 cell('B7').hover()
 page.mouse.up()
 page.keyboard.up('Control')
 assert cell('A6').get_attribute('aria-selected')=='true'
 assert cell('B6').get_attribute('aria-selected')=='true'
 assert cell('B7').get_attribute('aria-selected')=='true'
 assert cell('C6').get_attribute('aria-selected')=='false'
 # Delete only selected rectangles and Undo restores all content.
 page.locator('[data-action=clear]').first.click()
 assert page.evaluate("getCell(sheet(),'A6').value")==''
 assert page.evaluate("getCell(sheet(),'B6').value")==''
 assert page.evaluate("getCell(sheet(),'B7').value")==''
 assert page.evaluate("getCell(sheet(),'C3').value")=='100'
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
 assert page.evaluate("getCell(sheet(),'A6').value")=='22'
 assert page.evaluate("getCell(sheet(),'B6').value")=='10'
 # Unmodified browser menu outside the grid, own dimensions menu on a column header.
 col=lambda i:page.locator(f'.colhead[data-index="{i}"]').first
 row=lambda i:page.locator(f'.rowhead[data-index="{i}"]').first
 col(1).click(button='right')
 assert page.locator('#size-context-menu').count()==1
 assert page.locator('#size-context-number').get_attribute('min')=='48'
 page.locator('#size-context-number').fill('212')
 page.locator('[data-action=size-context-apply]').click()
 assert page.evaluate('columnWidth(sheet(),1)')==212
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
 assert page.evaluate('columnWidth(sheet(),1)')==116
 # Batch two nonadjacent column headers through Ctrl and a single right-click.
 col(0).click()
 col(2).click(modifiers=['Control'])
 col(2).click(button='right')
 assert '(2)' in page.locator('#size-context-menu label').inner_text()
 page.locator('#size-context-number').fill('180')
 page.locator('[data-action=size-context-apply]').click()
 assert page.evaluate('columnWidth(sheet(),0)')==180
 assert page.evaluate('columnWidth(sheet(),2)')==180
 assert page.evaluate('columnWidth(sheet(),1)')==116
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
 assert page.evaluate('columnWidth(sheet(),0)')==116
 assert page.evaluate('columnWidth(sheet(),2)')==116
 # Multirow sizing, with row heights and undo, independent of column widths.
 row(1).click()
 row(4).click(modifiers=['Control'])
 row(4).click(button='right')
 assert '(2)' in page.locator('#size-context-menu label').inner_text()
 assert page.locator('#size-context-number').get_attribute('min')=='22'
 page.locator('#size-context-number').fill('62')
 page.locator('#size-context-number').press('Enter')
 assert page.evaluate('rowHeight(sheet(),1)')==62
 assert page.evaluate('rowHeight(sheet(),4)')==62
 assert page.evaluate('rowHeight(sheet(),2)')==29
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
 assert page.evaluate('rowHeight(sheet(),1)')==29
 assert page.evaluate('rowHeight(sheet(),4)')==29
 # Strict input bounds; right click on a cell also offers dimensions.
 cell('B2').click(button='right')
 assert page.locator('[data-action=size-context-mode][data-kind="row"]').count()==1
 page.locator('[data-action=size-context-mode][data-kind="row"]').click()
 page.locator('#size-context-number').fill('300')
 page.locator('[data-action=size-context-apply]').click()
 assert page.evaluate('rowHeight(sheet(),1)')==29
 assert page.locator('#toast').is_visible()
 page.locator('[data-action=size-context-close]').click()
 # In a multi-range selection, sort cannot silently operate on only its final rectangle.
 page.get_by_role('tab',name='Данные').click()
 cell('B2').click()
 cell('D4').click(modifiers=['Control'])
 page.locator('[data-action=sort-asc]').first.click()
 assert 'один непрерывный диапазон' in page.locator('#toast').inner_text()
 assert not errors,errors
 browser.close()
 print('PASS TASK068: Ctrl-selected cells and drag, group formatting/clear, right-click row/column sizes and undo')
