"""TASK075: checkbox click isolation, Cyrillic styles, vertical align, header-range drag."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1550,'height':920})
 page.set_default_timeout(20000)
 errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 def select(ref):
  box=page.locator('#name-box');box.fill(ref);box.press('Enter')
 def cell(ref):return page.locator('.grid-cell[data-ref="'+ref+'"]').first
 select('B4')
 page.get_by_role('tab',name='Вставка').click()
 select('D7')
 page.locator('[data-action=insert-checkbox]').first.click()
 select('B4')
 before=page.locator('#name-box').input_value()
 assert not cell('D7').get_attribute('aria-selected')=='true'
 page.locator('.grid-cell[data-ref="D7"] .cell-checkbox').click()
 assert page.evaluate("getCell(sheet(),'D7').value")=='☑'
 assert page.locator('#name-box').input_value()==before
 assert cell('D7').get_attribute('aria-selected')=='false'
 cell('D7').click(position={'x':3,'y':4})
 assert page.locator('#name-box').input_value()=='D7'
 select('E9')
 page.get_by_role('tab',name='Главная').click()
 for action,property in [('bold','bold'),('italic','italic'),('underline','underline'),('strike','strike')]:
  page.locator('[data-action='+action+']').first.click()
  assert page.evaluate("(prop)=>getCell(sheet(),'E9').style[prop]",property)==True
 assert page.locator('.ribbon-group.font-group .font-action-row .tool-btn').count()==6
 assert 'Ж' in page.locator('[data-action=bold]').first.inner_text()
 assert 'К' in page.locator('[data-action=italic]').first.inner_text()
 assert 'Ч' in page.locator('[data-action=underline]').first.inner_text()
 assert 'З' in page.locator('[data-action=strike]').first.inner_text()
 for value in ('top','center','bottom'):
  page.locator('[data-action=valign][data-value='+value+']').click()
  assert page.evaluate("getCell(sheet(),'E9').style.verticalAlign")==value
 for value in ('left','center','right'):
  page.locator('[data-action=align][data-value='+value+']').click()
  assert page.evaluate("getCell(sheet(),'E9').style.align")==value
 assert 'line-through' in cell('E9').evaluate('e=>getComputedStyle(e).textDecorationLine')
 def drag_header(kind,start,end):
  selector='.rowhead' if kind=='row' else '.colhead'
  a=page.locator(selector+'[data-index="'+str(start)+'"]').first.bounding_box()
  b=page.locator(selector+'[data-index="'+str(end)+'"]').first.bounding_box()
  assert a and b
  point=lambda box:(box['x']+box['width']*(0.5 if kind=='row' else 0.3),box['y']+box['height']*(0.3 if kind=='row' else 0.5))
  ax,ay=point(a);bx,by=point(b)
  page.mouse.move(ax,ay);page.mouse.down()
  page.mouse.move(bx,by,steps=14);page.mouse.up()
 drag_header('row',3,7)
 assert page.locator('#name-box').input_value()=='A4:CV8'
 assert cell('C5').get_attribute('aria-selected')=='true'
 drag_header('col',1,4)
 assert page.locator('#name-box').input_value()=='B1:F100000'
 assert cell('E5').get_attribute('aria-selected')=='true'
 assert cell('A5').get_attribute('aria-selected')=='false'
 # Ordinary click still selects a single header, and resizing remains available.
 page.locator('.rowhead[data-index="2"]').first.click()
 assert page.locator('#name-box').input_value()=='A3:CV3'
 assert page.locator('.rowhead[data-index="2"] .row-resizer').count()==1
 assert page.evaluate("decodeBook(encodeBook(book())).sheets[0].cells.E9.style.underline")==True
 # Full XLSX round trip must carry formatting, not only the exported XML.
 page.evaluate("""async()=>{
  const bytes=await exportXLSX(book());
  const opened=await importXLSX(bytes,'task075.xlsx',{});
  const style=opened.sheets[0].cells.E9.style;
  if(!style.underline||!style.strike||style.verticalAlign!=='bottom'||style.align!=='right')
   throw Error('Style lost in XLSX roundtrip: '+JSON.stringify(style));
 }""")
 assert not errors,errors
 browser.close()
 print('PASS TASK075: checkbox isolation, Cyrillic formatting, Excel vertical alignment and row/column drag')
